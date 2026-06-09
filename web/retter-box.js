import { getTenantCollectionPath } from './tenant-db.js';

const RETTER_BOX_COLLECTION = 'retter_boxen';
const RETTER_BOX_STATUS_LABELS = {
  draft: 'Vorschlag',
  printed: 'Gedruckt',
  sold: 'Verkauft',
  discarded: 'Verworfen',
};

const retterBoxState = {
  db: null,
  tenantId: '',
  writeOrQueueFirestore: null,
  showHUD: () => {},
  getFirebase: () => null,
  boxes: [],
  unsubscribe: null,
  initialized: false,
};

function isRetterBoxEnabled() {
  return window.BRANDING?.modules?.retterBox === true;
}

function resolveTenantId() {
  return String(retterBoxState.tenantId || '').trim();
}

function retterBoxCollectionPath() {
  if (!resolveTenantId()) return null;
  try {
    return getTenantCollectionPath(RETTER_BOX_COLLECTION);
  } catch {
    return null;
  }
}

function serverTimestamp() {
  return retterBoxState.getFirebase()?.firestore?.FieldValue?.serverTimestamp?.() || new Date().toISOString();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value) {
  const str = String(value || '').slice(0, 10);
  const parts = str.split('-');
  return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : (str || '-');
}

function itemFromProduct(product) {
  return {
    mhdId: String(product?.id || ''),
    name: product?.name || product?.produkt || 'Posten',
    brand: product?.brand || product?.marke || '',
    qty: Number(product?.qty ?? product?.menge ?? 0),
    unit: product?.mengeEinheit || product?.einheit || 'Stk.',
    mhd: product?.mhd || product?.mhdDate || product?.date || '',
    category: product?.kategorie || product?.warenKategorie || '',
    restDays: Number.isFinite(Number(product?.tage ?? product?.resttage)) ? Number(product?.tage ?? product?.resttage) : null,
  };
}

function activeDailyBox() {
  const today = todayIso();
  return retterBoxState.boxes.find((box) => box.date === today && box.status === 'draft')
    || retterBoxState.boxes.find((box) => box.date === today && box.status === 'printed')
    || null;
}

function buildRecipeSuggestion(items) {
  const text = items.map((item) => `${item.name} ${item.category || ''}`.toLowerCase()).join(' ');
  const hasDairy = /milch|joghurt|quark|sahne|käse|kaese|feta|mopro|mozzarella/.test(text);
  const hasPasta = /nudel|pasta|gnocchi|tortell|ravioli|spätzle|spaetzle/.test(text);
  const hasMeat = /schinken|wurst|salami|mortadella|fleisch|brat|grill/.test(text);
  const hasBread = /brot|baguette|pinsa|pizza/.test(text);

  if (hasDairy && hasPasta) {
    return {
      title: 'Schnelle Hofladen-Pfanne',
      steps: 'Nudeln oder Gnocchi kurz anbraten, Milchprodukt cremig unterheben, mit Pfeffer und Kraeutern abschmecken. Ware vor dem Verkauf pruefen und kuehl halten.',
    };
  }
  if (hasMeat || hasBread) {
    return {
      title: 'Vesper-Box vom Hofladen',
      steps: 'Wurst, Kaese oder Aufstrich zusammenstellen, dazu Brot oder Beilage empfehlen. Fuer zu Hause: kurz aufbacken, frisch schneiden und direkt geniessen.',
    };
  }
  if (hasDairy) {
    return {
      title: 'Fruehstuecks- oder Dessert-Box',
      steps: 'Joghurt, Quark oder Milchprodukt mit Obst, Muesli oder Honig kombinieren. Gekuehlt mit kurzem Rezeptzettel anbieten.',
    };
  }
  return {
    title: 'Heute-kochen-Box',
    steps: 'Produkte als einfache Kochidee buendeln. Kurz vor dem Verkauf pruefen, Preis festlegen und Rezeptzettel dazulegen.',
  };
}

function buildBoxPayload(box, items) {
  const suggestion = buildRecipeSuggestion(items);
  const productNames = items.map((item) => item.name).slice(0, 3).join(', ');
  return {
    id: box?.id || `retterbox-${todayIso()}`,
    title: box?.title || 'Retter-Box heute',
    date: todayIso(),
    status: box?.status || 'draft',
    items,
    itemCount: items.length,
    recipeTitle: suggestion.title,
    recipeSteps: suggestion.steps,
    customerText: productNames ? `Heute mit: ${productNames}` : 'Heute frisch zusammengestellt.',
    priceHint: box?.priceHint || '',
    tenantId: resolveTenantId(),
    updatedAt: serverTimestamp(),
  };
}

async function saveBox(box, updates) {
  const path = retterBoxCollectionPath();
  if (!path || !retterBoxState.writeOrQueueFirestore) return null;
  const docId = updates.id || box?.id || `retterbox-${todayIso()}`;
  return retterBoxState.writeOrQueueFirestore({
    collectionPath: path,
    docId,
    op: box?.id ? 'update' : 'set',
    onlineData: updates,
    queueData: { ...updates, updatedAt: new Date().toISOString() },
    offlineMessage: 'Retter-Box wird automatisch synchronisiert, sobald WLAN verfuegbar ist.',
  });
}

export async function addRetterBoxCandidate(product) {
  if (!isRetterBoxEnabled()) return false;
  if (!product?.id) return false;
  const item = itemFromProduct(product);
  const existingBox = activeDailyBox();
  const existingItems = Array.isArray(existingBox?.items) ? existingBox.items : [];
  const items = existingItems.some((entry) => entry.mhdId === item.mhdId)
    ? existingItems.map((entry) => (entry.mhdId === item.mhdId ? { ...entry, ...item } : entry))
    : [...existingItems, item];
  const payload = {
    ...buildBoxPayload(existingBox, items),
    createdAt: existingBox?.createdAt || serverTimestamp(),
  };
  try {
    const result = await saveBox(existingBox, payload);
    retterBoxState.showHUD(
      result === 'queued' ? 'Lokal vorgemerkt' : 'Zur Retter-Box gelegt',
      `${item.name} ist im heutigen Vorschlag.`,
    );
    renderRetterBoxPanel();
    return true;
  } catch (err) {
    console.error('[CharcuLogic Retter-Box] Speichern fehlgeschlagen:', err);
    retterBoxState.showHUD('Fehler', 'Retter-Box konnte nicht gespeichert werden.', '!');
    return false;
  }
}

async function updateBoxStatus(boxId, status) {
  const box = retterBoxState.boxes.find((entry) => entry.id === boxId);
  if (!box) return;
  const payload = {
    ...box,
    status,
    updatedAt: serverTimestamp(),
  };
  if (status === 'printed') payload.printedAt = serverTimestamp();
  if (status === 'sold') payload.soldAt = serverTimestamp();
  if (status === 'discarded') payload.discardedAt = serverTimestamp();
  try {
    await saveBox(box, payload);
    retterBoxState.showHUD('Gespeichert', 'Der Status der Retter-Box wurde aktualisiert.');
  } catch (err) {
    console.error('[CharcuLogic Retter-Box] Status konnte nicht gespeichert werden:', err);
    retterBoxState.showHUD('Fehler', 'Status konnte nicht gespeichert werden.', '!');
  }
}

function renderBoxItems(items = []) {
  return items.map((item) => `
    <li>
      <strong>${escapeHtml(item.name)}</strong>
      <span>${escapeHtml(item.qty)} ${escapeHtml(item.unit || 'Stk.')} · MHD ${escapeHtml(formatDate(item.mhd))}</span>
    </li>
  `).join('');
}

function renderRetterBoxPanel() {
  const panel = document.getElementById('retter-box-panel');
  const list = document.getElementById('retter-box-list');
  if (!panel || !list) return;
  const enabled = isRetterBoxEnabled();
  panel.hidden = !enabled;
  panel.classList.toggle('hidden', !enabled);
  if (!enabled) return;

  const visible = [...retterBoxState.boxes]
    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))
    .slice(0, 6);

  list.innerHTML = visible.length ? visible.map((box) => {
    const statusLabel = RETTER_BOX_STATUS_LABELS[box.status] || box.status || 'Vorschlag';
    return `
      <article class="retter-box-card">
        <div class="retter-box-card-head">
          <div>
            <strong>${escapeHtml(box.title || 'Retter-Box')}</strong>
            <span>${escapeHtml(formatDate(box.date))} · ${escapeHtml(statusLabel)}</span>
          </div>
          <span class="retter-box-count">${Number(box.itemCount || box.items?.length || 0)} Artikel</span>
        </div>
        <ul class="retter-box-items">${renderBoxItems(box.items || [])}</ul>
        <div class="retter-box-recipe">
          <strong>${escapeHtml(box.recipeTitle || 'Rezeptvorschlag')}</strong>
          <span>${escapeHtml(box.recipeSteps || '')}</span>
        </div>
        <div class="retter-box-actions">
          <button type="button" class="btn btn-primary btn-compact" data-retter-box-print="${escapeHtml(box.id)}">Drucken</button>
          <button type="button" class="btn btn-secondary btn-compact" data-retter-box-status="sold" data-retter-box-id="${escapeHtml(box.id)}">Verkauft</button>
          <button type="button" class="btn btn-secondary btn-compact" data-retter-box-status="discarded" data-retter-box-id="${escapeHtml(box.id)}">Verwerfen</button>
        </div>
      </article>
    `;
  }).join('') : '<p class="admin-leitstand-hint">Noch keine Retter-Box fuer heute. Im MHD-Tab koennen wir passende Posten mit „Box“ vormerken.</p>';
}

function printRetterBox(boxId) {
  const box = retterBoxState.boxes.find((entry) => entry.id === boxId);
  if (!box) return;
  updateBoxStatus(boxId, 'printed');
  const items = renderBoxItems(box.items || []);
  const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(box.title || 'Retter-Box')}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #111; padding: 18mm; }
  h1 { font-size: 30pt; margin: 0 0 6mm; }
  .date { font-size: 12pt; margin-bottom: 8mm; }
  .box { border: 3px solid #111; padding: 8mm; margin-bottom: 8mm; }
  ul { padding-left: 18px; font-size: 13pt; }
  li { margin-bottom: 4mm; }
  li span { display: block; color: #555; font-size: 10pt; }
  h2 { font-size: 18pt; margin: 8mm 0 3mm; }
  p { font-size: 13pt; line-height: 1.45; }
  .note { border-top: 1px solid #999; margin-top: 10mm; padding-top: 4mm; font-size: 10pt; color: #444; }
</style>
</head>
<body>
  <h1>${escapeHtml(box.title || 'Retter-Box')}</h1>
  <div class="date">Zusammengestellt am ${escapeHtml(formatDate(box.date))}</div>
  <div class="box">
    <h2>In der Box</h2>
    <ul>${items}</ul>
  </div>
  <h2>${escapeHtml(box.recipeTitle || 'Rezeptvorschlag')}</h2>
  <p>${escapeHtml(box.recipeSteps || '')}</p>
  <p class="note">Bitte Ware vor dem Verkauf pruefen und durchgehend kuehl halten. Allergene und Zutaten am Produktetikett beachten.</p>
  <script>window.onload = () => window.print();</script>
</body>
</html>`;
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  } else {
    retterBoxState.showHUD('Drucken blockiert', 'Bitte Popups fuer diese Seite erlauben.', '!');
  }
}

function bindRetterBoxPanel() {
  const panel = document.getElementById('retter-box-panel');
  if (!panel || panel.dataset.retterBoxBound === '1') return;
  panel.dataset.retterBoxBound = '1';
  panel.addEventListener('click', (event) => {
    const printButton = event.target.closest('[data-retter-box-print]');
    if (printButton) {
      printRetterBox(printButton.dataset.retterBoxPrint);
      return;
    }
    const statusButton = event.target.closest('[data-retter-box-status]');
    if (statusButton) {
      updateBoxStatus(statusButton.dataset.retterBoxId, statusButton.dataset.retterBoxStatus);
    }
  });
}

function loadRetterBoxesFromCloud() {
  if (!retterBoxState.db || !isRetterBoxEnabled()) {
    renderRetterBoxPanel();
    return;
  }
  const path = retterBoxCollectionPath();
  if (!path) return;
  if (retterBoxState.unsubscribe) {
    retterBoxState.unsubscribe();
    retterBoxState.unsubscribe = null;
  }
  retterBoxState.unsubscribe = retterBoxState.db.collection(path).onSnapshot((snapshot) => {
    retterBoxState.boxes = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    renderRetterBoxPanel();
  }, (err) => console.error('[CharcuLogic Retter-Box] Live-Sync Fehler:', err));
}

export function initRetterBoxModule(databaseInstance, options = {}) {
  retterBoxState.db = databaseInstance || retterBoxState.db;
  retterBoxState.tenantId = options.tenantId || retterBoxState.tenantId;
  retterBoxState.writeOrQueueFirestore = options.writeOrQueueFirestore || retterBoxState.writeOrQueueFirestore;
  retterBoxState.showHUD = typeof options.showHUD === 'function' ? options.showHUD : retterBoxState.showHUD;
  retterBoxState.getFirebase = typeof options.getFirebase === 'function' ? options.getFirebase : retterBoxState.getFirebase;
  if (!retterBoxState.initialized) {
    bindRetterBoxPanel();
    window.CharcuLogicRetterBox = { addCandidate: addRetterBoxCandidate };
    retterBoxState.initialized = true;
  }
  loadRetterBoxesFromCloud();
  renderRetterBoxPanel();
}

export function refreshRetterBoxModule() {
  loadRetterBoxesFromCloud();
  renderRetterBoxPanel();
}
