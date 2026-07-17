/**
 * KI-Wareneingang (Phase 4 · ERP-Light)
 *
 * Wir lesen einen Lieferschein per Foto ein, schlagen für jeden Artikel ein
 * MHD vor (aus den Erfahrungswerten der letzten Lieferungen) und buchen die
 * gelieferten Mengen mit einem Klick in unseren Bestand ein.
 */

import { getAuthContext } from './auth.js';
import { logAndMapOperatorError } from './operator-errors.js';
import { waitForAppCheckReady } from './app-check.js';
import { getGlobalTenantId, getTenantCollection } from './tenant-db.js';
import { formatIsoToGerman, parseGermanDateToIso, initGermanDateInputs } from './date-input.js';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;

// Standard-MHD-Spannen je Warengruppe (Schlüsselwort im Artikelnamen, falls keine Historie).
const MHD_FALLBACK_KEYWORDS = [
  { test: /gefl(ü|ue)gel|h(ä|ae)hnchen|pute/i, tage: 4 },
  { test: /frischfleisch|\brind\b|\bschwein\b|hack|galloway/i, tage: 5 },
  { test: /wurst|aufschnitt|grillwurst|wiener/i, tage: 10 },
  { test: /k(ä|ae)se|mopro|jogh?urt|milch/i, tage: 14 },
  { test: /trockenware|konserven|vorrat|br(ö|oe)tchen/i, tage: 90 },
];
const MHD_FALLBACK_DEFAULT_TAGE = 7;
const MHD_STANDARD_HINT = 'MHD-Vorschlag (Standard-Haltbarkeit)';

// Sicherheitsriegel: Für StevesHof ist der KI-Wareneingang standardmäßig
// ausgeblendet. Nur das Test-Konto sieht ihn, bis das Feature freigegeben ist.
const FEATURE_TEST_EMAIL = 'patrik@charculogic.de';

const parserState = {
  getFirebase: () => null,
  showHUD: () => {},
  writeOrQueueFirestore: null,
  getHistory: () => [],
  pendingRows: [],
  ocrInFlight: false,
  saveInFlight: false,
  featureEnabled: true,
};

function isSteveshofTenant(tenantId) {
  return String(tenantId || '').trim().toLowerCase().startsWith('steveshof');
}

function isDeliveryParserVisible(tenantId, email) {
  if (!isSteveshofTenant(tenantId)) return true;
  return String(email || '').trim().toLowerCase() === FEATURE_TEST_EMAIL;
}

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function startOfDayIso(date = new Date()) {
  const probe = new Date(date);
  if (Number.isNaN(probe.getTime())) return '';
  probe.setHours(0, 0, 0, 0);
  const year = probe.getFullYear();
  const month = String(probe.getMonth() + 1).padStart(2, '0');
  const day = String(probe.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toIsoDateOnly(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (ISO_DATE_RE.test(raw)) return raw.slice(0, 10);
  const fromGerman = parseGermanDateToIso(raw);
  if (fromGerman) return fromGerman;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? '' : startOfDayIso(parsed);
}

function diffInDays(fromIso, toIso) {
  if (!fromIso || !toIso) return null;
  const from = new Date(`${fromIso}T00:00:00`);
  const to = new Date(`${toIso}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

function addDaysIso(baseIso, days) {
  const base = new Date(`${baseIso}T00:00:00`);
  if (Number.isNaN(base.getTime())) return '';
  base.setDate(base.getDate() + (Number(days) || 0));
  return startOfDayIso(base);
}

function articleDocId(name) {
  const slug = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return slug || `artikel-${Date.now()}`;
}

function toMhdKategorie(kategorie, artikel) {
  const text = `${kategorie || ''} ${artikel || ''}`.toLowerCase();
  if (/gem(ü|ue)se|salat|kr(ä|ae)uter|obst|frucht|beere|frische/.test(text)) return '🍎 Frische';
  if (/molkerei|milch|joghurt|jogurt|k(ä|ae)se|quark|sahne|butter|mopro|frischk/.test(text)) return '🥛MoPro';
  if (/tk|tiefk(ü|ue)hl|gefrier/.test(text)) return '🧊 TK';
  if (/getr(ä|ae)nk/.test(text)) return '🍺 Getränke';
  if (/gew(ü|ue)rz/.test(text)) return '🌿 Gewürze';
  if (/k(ü|ue)hl/.test(text)) return '🥗 Kühlware';
  return '📦 Trockenware';
}

function standardTageAusArtikelname(artikel) {
  const text = String(artikel || '').trim();
  for (const regel of MHD_FALLBACK_KEYWORDS) {
    if (regel.test.test(text)) return regel.tage;
  }
  return MHD_FALLBACK_DEFAULT_TAGE;
}

// ---------------------------------------------------------------------------
// Lernende MHD-Vorhersage aus den Erfahrungswerten der letzten Lieferungen
// ---------------------------------------------------------------------------

/**
 * Leitet das vorgeschlagene MHD für heute ab: mit Historie aus dem Durchschnitt
 * der bisherigen Liefer-Spannen (Wareneingang bis MHD), sonst per Schlüsselwort
 * im Artikelnamen über Standard-Haltbarkeit.
 */
export function vorhersagenMhd(artikel, kategorie, history, todayIso = startOfDayIso()) {
  const gesuchterName = String(artikel || '').trim().toLowerCase();
  const eintraege = Array.isArray(history) ? history : [];
  const spannen = [];

  if (gesuchterName) {
    for (const eintrag of eintraege) {
      const name = String(eintrag?.produkt || eintrag?.name || '').trim().toLowerCase();
      if (name !== gesuchterName) continue;

      const lieferIso = toIsoDateOnly(eintrag?.wareneingangAt || eintrag?.erfassungsDatum || eintrag?.createdAt);
      const damaligesMhd = toIsoDateOnly(eintrag?.mhd || eintrag?.mhdDate);
      if (!lieferIso || !damaligesMhd) continue;

      const spanne = diffInDays(lieferIso, damaligesMhd);
      if (spanne == null || spanne < 0) continue;
      spannen.push(spanne);
    }
  }

  if (spannen.length > 0) {
    const durchschnitt = Math.round(spannen.reduce((sum, tage) => sum + tage, 0) / spannen.length);
    return {
      mhdIso: addDaysIso(todayIso, durchschnitt),
      tage: durchschnitt,
      quelle: 'erfahrung',
      hinweis: `Erfahrungswert der letzten Lieferungen (${durchschnitt} Tage haltbar)`,
    };
  }

  const tage = standardTageAusArtikelname(artikel);
  return {
    mhdIso: addDaysIso(todayIso, tage),
    tage,
    quelle: 'standard',
    hinweis: MHD_STANDARD_HINT,
  };
}

// ---------------------------------------------------------------------------
// KI-Lieferschein einlesen
// ---------------------------------------------------------------------------

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
  return items.map((entry) => {
    const mengeRaw = entry?.menge ?? entry?.quantity ?? 1;
    const menge = Number(mengeRaw);
    return {
      artikel: String(entry?.artikel || entry?.name || '').trim(),
      menge: Number.isFinite(menge) && menge > 0 ? menge : 1,
      kategorie: String(entry?.kategorie || entry?.category || '').trim(),
    };
  }).filter((row) => row.artikel);
}

async function callParseDeliveryNote(imageBase64, mimeType) {
  const firebase = parserState.getFirebase();
  if (!firebase?.app) {
    throw new Error('Lieferschein-Einlesen ist gerade nicht bereit.');
  }
  const functionsRegion = firebase.app().functions('europe-west3');
  const callable = functionsRegion.httpsCallable('parseDeliveryNote');
  await waitForAppCheckReady();
  const result = await callable({ imageBase64, mimeType });
  return normalizeParsedItems(result?.data?.items);
}

// ---------------------------------------------------------------------------
// Lade-Animation
// ---------------------------------------------------------------------------

function showLoadingOverlay() {
  hideLoadingOverlay();
  const overlay = document.createElement('div');
  overlay.id = 'delivery-parser-loading-overlay';
  overlay.className = 'learn-mode-overlay delivery-parser-loading-overlay';
  overlay.innerHTML = `
    <div class="delivery-parser-loading-card" role="status" aria-live="polite">
      <div class="delivery-parser-spinner" aria-hidden="true"></div>
      <p class="delivery-parser-loading-text">Die KI liest den Lieferschein für uns...</p>
    </div>
  `;
  document.querySelector('.app-container')?.appendChild(overlay);
}

function hideLoadingOverlay() {
  document.getElementById('delivery-parser-loading-overlay')?.remove();
}

// ---------------------------------------------------------------------------
// Vorschau-Tabelle (Name · Liefermenge · vorgeschlagenes MHD)
// ---------------------------------------------------------------------------

function removePreviewOverlay() {
  document.getElementById('delivery-parser-overlay')?.remove();
}

function buildPreviewRows(items) {
  const todayIso = startOfDayIso();
  const history = parserState.getHistory() || [];
  return items.map((item, index) => {
    const prognose = vorhersagenMhd(item.artikel, item.kategorie, history, todayIso);
    return {
      ...item,
      _rowId: `dp-row-${index}`,
      mhdIso: prognose.mhdIso,
      quelle: prognose.quelle,
      hinweis: prognose.hinweis,
    };
  });
}

function renderPreviewTable(rows) {
  const body = rows.map((row, index) => {
    const mhdHint = row.quelle === 'erfahrung'
      ? `<span class="delivery-parser-badge delivery-parser-badge--erfahrung" title="${escapeHtml(row.hinweis)}">Erfahrungswert</span>`
      : `<span class="delivery-parser-mhd-hint">${escapeHtml(MHD_STANDARD_HINT)}</span>`;
    return `
      <tr data-row-index="${index}">
        <td>
          <input type="text" class="gastro-input delivery-parser-input-artikel" value="${escapeHtml(row.artikel)}" aria-label="Artikelname">
        </td>
        <td>
          <input type="number" class="gastro-input delivery-parser-input-menge" value="${escapeHtml(row.menge)}" min="0.01" step="any" inputmode="decimal" aria-label="Liefermenge">
        </td>
        <td>
          <input type="text" class="gastro-input input-date-de delivery-parser-input-mhd" value="${escapeHtml(formatIsoToGerman(row.mhdIso))}" placeholder="TT.MM.JJJJ" inputmode="numeric" maxlength="10" autocomplete="off" aria-label="Vorgeschlagenes MHD">
          ${mhdHint}
        </td>
      </tr>
    `;
  }).join('');

  return `
    <table class="delivery-note-preview-table delivery-parser-table">
      <thead>
        <tr><th>Artikel</th><th>Liefermenge</th><th>Vorgeschlagenes MHD</th></tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

function readRowsFromPreview() {
  const rows = document.querySelectorAll('#delivery-parser-overlay tbody tr');
  return Array.from(rows).map((row) => {
    const artikel = row.querySelector('.delivery-parser-input-artikel')?.value?.trim() || '';
    const mengeRaw = String(row.querySelector('.delivery-parser-input-menge')?.value || '').replace(',', '.');
    const menge = parseFloat(mengeRaw);
    const mhdGerman = row.querySelector('.delivery-parser-input-mhd')?.value?.trim() || '';
    const kategorie = row.querySelector('.delivery-parser-input-artikel')?.dataset?.kategorie || '';
    return {
      artikel,
      menge: Number.isFinite(menge) && menge > 0 ? menge : 1,
      mhdIso: parseGermanDateToIso(mhdGerman),
      kategorie,
    };
  }).filter((row) => row.artikel);
}

function showPreview(rows) {
  removePreviewOverlay();
  parserState.pendingRows = rows;

  const overlay = document.createElement('div');
  overlay.id = 'delivery-parser-overlay';
  overlay.className = 'learn-mode-overlay';
  overlay.innerHTML = `
    <div class="learn-mode-card delivery-note-preview-card" role="dialog" aria-modal="true" aria-labelledby="delivery-parser-title">
      <div class="learn-mode-title" id="delivery-parser-title">Lieferschein – erkannte Artikel</div>
      <p class="learn-mode-desc">Bitte Liefermenge und vorgeschlagenes MHD prüfen. Wir schlagen das MHD aus Erfahrungswerten oder Standard-Haltbarkeit vor.</p>
      <div class="delivery-note-preview-scroll">${renderPreviewTable(rows)}</div>
      <div class="learn-mode-actions" style="display:flex;flex-direction:column;gap:10px;">
        <button type="button" class="btn btn-primary" id="delivery-parser-save">📥 Artikel in den Bestand einbuchen</button>
        <button type="button" class="btn" id="delivery-parser-cancel" style="background:#E5E5EA;color:#1C1C1E;">Abbrechen</button>
      </div>
    </div>
  `;
  document.querySelector('.app-container')?.appendChild(overlay);

  rows.forEach((row, index) => {
    const artikelInput = overlay.querySelector(`tr[data-row-index="${index}"] .delivery-parser-input-artikel`);
    if (artikelInput) artikelInput.dataset.kategorie = row.kategorie || '';
  });

  initGermanDateInputs(overlay);

  overlay.querySelector('#delivery-parser-cancel')?.addEventListener('click', removePreviewOverlay);
  overlay.querySelector('#delivery-parser-save')?.addEventListener('click', () => {
    bucheLieferungEin(readRowsFromPreview());
  });
}

// ---------------------------------------------------------------------------
// In den Bestand einbuchen (Firestore)
// ---------------------------------------------------------------------------

async function erhoeheBestand(row, author, nowIso) {
  const firebase = parserState.getFirebase();
  const FieldValue = firebase?.firestore?.FieldValue;
  const tenantId = getGlobalTenantId();
  if (!tenantId) throw new Error('Mandant fehlt: Bestand konnte nicht gebucht werden.');
  const docRef = getTenantCollection('stammdaten').doc(articleDocId(row.artikel));
  await docRef.set({
    artikel: row.artikel,
    produkt: row.artikel,
    name: row.artikel,
    kategorie: toMhdKategorie(row.kategorie, row.artikel),
    currentStock: FieldValue?.increment ? FieldValue.increment(row.menge) : row.menge,
    lastMhd: row.mhdIso || '',
    lastDeliveryAt: nowIso,
    lastDeliveryBy: author,
    source: 'wareneingang-lieferschein',
    tenantId,
    updatedAt: FieldValue?.serverTimestamp ? FieldValue.serverTimestamp() : nowIso,
  }, { merge: true });
}

async function schreibeMhdPosten(row, author, nowIso) {
  const writeFn = parserState.writeOrQueueFirestore;
  if (typeof writeFn !== 'function') return 'written';

  const mhdIso = row.mhdIso || '';
  const tage = mhdIso ? diffInDays(startOfDayIso(), mhdIso) : null;
  const mhdKategorie = toMhdKategorie(row.kategorie, row.artikel);
  const postenId = `ls_${articleDocId(row.artikel)}_${Date.now()}`;

  const onlineData = {
    id: postenId,
    postenId,
    produkt: row.artikel,
    name: row.artikel,
    marke: '',
    brand: '',
    mhd: mhdIso,
    mhdDate: mhdIso,
    mhdText: Number.isFinite(tage) ? `${tage} Resttage` : 'Wareneingang',
    date: mhdIso ? formatIsoToGerman(mhdIso) : new Date().toLocaleDateString('de-DE'),
    tage,
    resttage: tage,
    status: 'aktiv',
    qty: row.menge,
    menge: row.menge,
    eingangMenge: row.menge,
    kategorie: mhdKategorie,
    soldOut: false,
    source: 'wareneingang-lieferschein',
    postentyp: 'wareneingang',
    wareneingangAt: nowIso,
    erfassungsDatum: nowIso,
    scannedBy: author,
    tenantId: getGlobalTenantId(),
    updatedAt: nowIso,
    createdAt: nowIso,
  };

  return writeFn({
    collectionPath: 'mhd_liste',
    docId: postenId,
    op: 'set',
    onlineData,
    queueData: onlineData,
    offlineMessage: 'Lieferschein wird automatisch verbucht, sobald WLAN verfügbar ist.',
  });
}

async function bucheLieferungEin(rows) {
  if (parserState.saveInFlight) return;
  if (!Array.isArray(rows) || rows.length === 0) {
    window.showToast?.('Keine Artikel zum Einbuchen gefunden.', 'warning');
    return;
  }
  const ohneMhd = rows.find((row) => !row.mhdIso);
  if (ohneMhd) {
    window.showToast?.('Bitte für jeden Artikel ein MHD als TT.MM.JJJJ eintragen.', 'warning');
    return;
  }

  const author = getAuthContext()?.email?.split('@')[0] || 'Team';
  const nowIso = new Date().toISOString();
  const saveBtn = document.getElementById('delivery-parser-save');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Wird eingebucht...';
  }

  try {
    parserState.saveInFlight = true;
    let hatWartende = false;
    for (const row of rows) {
      await erhoeheBestand(row, author, nowIso);
      const result = await schreibeMhdPosten(row, author, nowIso);
      if (result === 'queued') hatWartende = true;
    }
    removePreviewOverlay();
    if (hatWartende) {
      window.showToast?.('Lieferschein gespeichert – Bestände werden synchronisiert, sobald WLAN verfügbar ist.', 'warning');
      return;
    }
    window.showToast?.('Lieferschein erfolgreich verbucht. Alle Bestände wurden erhöht!', 'success');
  } catch (err) {
    console.error('[DeliveryParser] Einbuchen fehlgeschlagen:', err);
    window.showToast?.(logAndMapOperatorError(err, 'delivery-note'), 'error');
  } finally {
    parserState.saveInFlight = false;
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = '📥 Artikel in den Bestand einbuchen';
    }
  }
}

// ---------------------------------------------------------------------------
// Datei-Handling & Bindung
// ---------------------------------------------------------------------------

async function handleDeliveryFile(file) {
  if (!parserState.featureEnabled) return;
  if (!file || parserState.ocrInFlight) return;
  const mimeType = String(file.type || 'image/jpeg').trim() || 'image/jpeg';
  if (!/^image\//i.test(mimeType)) {
    window.showToast?.('Bitte ein Foto vom Lieferschein wählen.', 'warning');
    return;
  }

  showLoadingOverlay();
  try {
    parserState.ocrInFlight = true;
    const imageBase64 = await readFileAsBase64(file);
    const items = await callParseDeliveryNote(imageBase64, mimeType);
    if (!items.length) {
      window.showToast?.('Wir konnten keine Artikel auf dem Lieferschein erkennen.', 'warning');
      return;
    }
    showPreview(buildPreviewRows(items));
  } catch (err) {
    console.error('[DeliveryParser] Lieferschein-Einlesen fehlgeschlagen:', err);
    window.showToast?.(logAndMapOperatorError(err, 'delivery-note'), 'error');
  } finally {
    parserState.ocrInFlight = false;
    hideLoadingOverlay();
  }
}

function applyFeatureVisibility() {
  const btn = document.getElementById('btn-delivery-parser');
  if (btn) btn.hidden = !parserState.featureEnabled;
  if (!parserState.featureEnabled) {
    removePreviewOverlay();
    hideLoadingOverlay();
  }
}

function bindUi() {
  const btn = document.getElementById('btn-delivery-parser');
  const input = document.getElementById('delivery-parser-file-input');
  if (!btn || !input || btn.dataset.deliveryParserBound === '1') return;
  btn.dataset.deliveryParserBound = '1';

  btn.addEventListener('click', () => {
    if (!parserState.featureEnabled) return;
    input.value = '';
    input.click();
  });

  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) handleDeliveryFile(file);
  });
}

export function initDeliveryParser(options = {}) {
  parserState.getFirebase = typeof options.getFirebase === 'function' ? options.getFirebase : parserState.getFirebase;
  parserState.showHUD = typeof options.showHUD === 'function' ? options.showHUD : parserState.showHUD;
  parserState.writeOrQueueFirestore = options.writeOrQueueFirestore || parserState.writeOrQueueFirestore;
  parserState.getHistory = typeof options.getHistory === 'function' ? options.getHistory : parserState.getHistory;
  parserState.featureEnabled = isDeliveryParserVisible(options.tenantId, options.email);

  bindUi();
  applyFeatureVisibility();
}
