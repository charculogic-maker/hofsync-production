/**
 * KI-Lieferschein-Scanner (TorFabrik) via Cloud Function parseDeliveryNote
 */

import { getAuthContext } from './auth.js';
import { logAndMapOperatorError } from './operator-errors.js';
import { waitForAppCheckReady } from './app-check.js';
import { createHttpsCallable } from './firebase-functions.js';

const TORFABRIK_TENANT_ID = 'torfabrik';

const deliveryNoteState = {
  tenantId: '',
  getFirebase: () => null,
  showHUD: () => {},
  writeOrQueueFirestore: null,
  pendingItems: [],
  ocrInFlight: false,
  saveInFlight: false,
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error('Datei konnte nicht gelesen werden.'));
    reader.readAsDataURL(file);
  });
}

function normalizeParsedItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((entry, index) => {
    const mengeRaw = entry?.menge ?? entry?.quantity ?? 1;
    const menge = Number(mengeRaw);
    return {
      artikel: String(entry?.artikel || entry?.name || '').trim(),
      menge: Number.isFinite(menge) && menge > 0 ? menge : 1,
      kategorie: String(entry?.kategorie || entry?.category || '').trim(),
      _rowId: `row-${index}`,
    };
  }).filter((row) => row.artikel);
}

async function callParseDeliveryNote(imageBase64, mimeType) {
  const firebase = deliveryNoteState.getFirebase();
  if (!firebase?.functions) {
    throw new Error('Firebase Functions SDK nicht geladen.');
  }
  const callable = createHttpsCallable('parseDeliveryNote', undefined, firebase);
  await waitForAppCheckReady();
  const result = await callable({ imageBase64, mimeType });
  return normalizeParsedItems(result?.data?.items);
}

function removePreviewOverlay() {
  document.getElementById('delivery-note-preview-overlay')?.remove();
}

function renderPreviewTable(items) {
  const rows = items.map((row, index) => `
    <tr data-row-index="${index}">
      <td><input type="text" class="gastro-input delivery-note-input-artikel" value="${escapeHtml(row.artikel)}" aria-label="Artikel"></td>
      <td><input type="number" class="gastro-input delivery-note-input-menge" value="${escapeHtml(row.menge)}" min="0.01" step="any" inputmode="decimal" aria-label="Menge"></td>
      <td><input type="text" class="gastro-input delivery-note-input-kategorie" value="${escapeHtml(row.kategorie)}" aria-label="Kategorie"></td>
    </tr>
  `).join('');

  return `
    <table class="delivery-note-preview-table">
      <thead>
        <tr><th>Artikel</th><th>Menge</th><th>Kategorie</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function readItemsFromPreviewTable() {
  const rows = document.querySelectorAll('#delivery-note-preview-overlay tbody tr');
  return Array.from(rows).map((row) => {
    const artikel = row.querySelector('.delivery-note-input-artikel')?.value?.trim() || '';
    const menge = parseFloat(String(row.querySelector('.delivery-note-input-menge')?.value || '').replace(',', '.'));
    const kategorie = row.querySelector('.delivery-note-input-kategorie')?.value?.trim() || '';
    return {
      artikel,
      menge: Number.isFinite(menge) && menge > 0 ? menge : 1,
      kategorie,
    };
  }).filter((item) => item.artikel);
}

function showDeliveryNotePreview(items) {
  removePreviewOverlay();
  deliveryNoteState.pendingItems = items;

  const overlay = document.createElement('div');
  overlay.id = 'delivery-note-preview-overlay';
  overlay.className = 'learn-mode-overlay';
  overlay.innerHTML = `
    <div class="learn-mode-card delivery-note-preview-card" role="dialog" aria-modal="true" aria-labelledby="delivery-note-preview-title">
      <div class="learn-mode-title" id="delivery-note-preview-title">Lieferschein – erkannte Posten</div>
      <p class="learn-mode-desc">Bitte Mengen und Kategorien prüfen, dann in den Bestand übernehmen.</p>
      <div class="delivery-note-preview-scroll">${renderPreviewTable(items)}</div>
      <div class="learn-mode-actions" style="display:flex;flex-direction:column;gap:10px;">
        <button type="button" class="btn btn-primary" id="delivery-note-preview-save">In Bestand speichern</button>
        <button type="button" class="btn" id="delivery-note-preview-cancel" style="background:#E5E5EA;color:#1C1C1E;">Abbrechen</button>
      </div>
    </div>
  `;
  document.querySelector('.app-container')?.appendChild(overlay);

  document.getElementById('delivery-note-preview-cancel')?.addEventListener('click', removePreviewOverlay);
  document.getElementById('delivery-note-preview-save')?.addEventListener('click', () => {
    saveDeliveryNoteInventory(readItemsFromPreviewTable());
  });
}

async function saveDeliveryNoteInventory(items) {
  if (deliveryNoteState.saveInFlight) return;
  const tenantId = deliveryNoteState.tenantId;
  if (tenantId !== TORFABRIK_TENANT_ID) {
    deliveryNoteState.showHUD('Nur TorFabrik', 'Bestand-Import ist für diesen Mandanten nicht freigeschaltet.', '!');
    return;
  }
  if (!items.length) {
    window.showToast?.('Keine gültigen Posten zum Speichern.', 'warning');
    return;
  }

  const author = getAuthContext()?.email?.split('@')[0] || 'system';
  const firebase = deliveryNoteState.getFirebase();
  const batchId = `ls_${Date.now()}`;
  const writeFn = deliveryNoteState.writeOrQueueFirestore;
  if (!writeFn) {
    deliveryNoteState.showHUD('Fehler', 'Speichern nicht initialisiert.', '!');
    return;
  }

  try {
    deliveryNoteState.saveInFlight = true;
    let hasQueuedWrites = false;
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      const docId = `${batchId}_${i}`;
      const result = await writeFn({
        collectionPath: 'inventory',
        docId,
        op: 'set',
        onlineData: {
          artikel: item.artikel,
          menge: item.menge,
          kategorie: item.kategorie,
          tenantId,
          source: 'delivery-note-ai',
          batchId,
          createdBy: author,
          createdAt: firebase?.firestore?.FieldValue?.serverTimestamp?.()
            || new Date().toISOString(),
        },
        queueData: {
          artikel: item.artikel,
          menge: item.menge,
          kategorie: item.kategorie,
          tenantId,
          source: 'delivery-note-ai',
          batchId,
          createdBy: author,
          createdAt: new Date().toISOString(),
        },
        offlineMessage: 'Lieferschein-Posten werden nachgereicht.',
      });
      if (result === 'queued') hasQueuedWrites = true;
    }
    removePreviewOverlay();
    if (hasQueuedWrites) {
      deliveryNoteState.showHUD('Lokal vorgemerkt', 'Wird automatisch synchronisiert, sobald WLAN verfügbar ist.');
      window.showToast?.(`${items.length} Lieferschein-Posten werden automatisch synchronisiert.`, 'warning');
      return;
    }
    deliveryNoteState.showHUD('Gespeichert', `${items.length} Posten in inventory übernommen.`);
    window.showToast?.(`${items.length} Lieferschein-Posten gespeichert.`, 'success');
  } catch (err) {
    console.error('[DeliveryNote] Speichern fehlgeschlagen:', err);
    window.showToast?.(logAndMapOperatorError(err, 'delivery-note'), 'error');
  } finally {
    deliveryNoteState.saveInFlight = false;
  }
}

async function handleDeliveryNoteFile(file) {
  if (!file || deliveryNoteState.ocrInFlight) return;
  const mimeType = String(file.type || 'image/jpeg').trim() || 'image/jpeg';
  if (!/^image\//i.test(mimeType)) {
    window.showToast?.('Bitte ein Foto (JPG/PNG) wählen.', 'warning');
    return;
  }

  window.showToast?.('Lieferschein wird analysiert…', 'warning');
  try {
    deliveryNoteState.ocrInFlight = true;
    const imageBase64 = await readFileAsBase64(file);
    const items = await callParseDeliveryNote(imageBase64, mimeType);
    if (!items.length) {
      window.showToast?.('Keine Artikel erkannt.', 'warning');
      return;
    }
    showDeliveryNotePreview(items);
  } catch (err) {
    console.error('[DeliveryNote] OCR fehlgeschlagen:', err);
    window.showToast?.(logAndMapOperatorError(err, 'delivery-note'), 'error');
  } finally {
    deliveryNoteState.ocrInFlight = false;
  }
}

function bindDeliveryNoteUi() {
  const btn = document.getElementById('btn-delivery-note-ai');
  const input = document.getElementById('delivery-note-file-input');
  if (!btn || !input || btn.dataset.deliveryNoteBound === '1') return;
  btn.dataset.deliveryNoteBound = '1';

  btn.addEventListener('click', () => {
    input.value = '';
    input.click();
  });

  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) handleDeliveryNoteFile(file);
  });
}

export function initDeliveryNoteScanner(options = {}) {
  deliveryNoteState.tenantId = options.tenantId || '';
  deliveryNoteState.getFirebase = typeof options.getFirebase === 'function' ? options.getFirebase : deliveryNoteState.getFirebase;
  deliveryNoteState.showHUD = typeof options.showHUD === 'function' ? options.showHUD : deliveryNoteState.showHUD;
  deliveryNoteState.writeOrQueueFirestore = options.writeOrQueueFirestore || deliveryNoteState.writeOrQueueFirestore;

  const btn = document.getElementById('btn-delivery-note-ai');
  const isTorfabrik = deliveryNoteState.tenantId === TORFABRIK_TENANT_ID;
  if (btn) btn.hidden = !isTorfabrik;

  if (isTorfabrik) bindDeliveryNoteUi();
}
