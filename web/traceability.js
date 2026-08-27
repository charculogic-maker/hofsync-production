/**
 * Chargen-Doku (Thekenbuch) – LMIV-Erfassung + Buch-Ansicht im Laden-Alltag.
 * Persistenz: tenants/{tenantId}/chargendoku/{id}
 */
import { waitForAppCheckReady } from './app-check.js';
import { createHttpsCallable } from './firebase-functions.js';
import { logAndMapOperatorError } from './operator-errors.js';
import { hasModule } from './tenant-modules.js';
import { isPlatformSuperAdmin } from './tenant-admin-auth.js';
import { canonicalTenantId, getGlobalTenantId, getTenantCollectionPath } from './tenant-db.js';

/** Firestore-Collection unter tenants/{tenantId}/ */
const CHARGEN_DOKU_COLLECTION = 'chargendoku';
/** Legacy-Collection – nur Lesen für bestehende Einträge */
const LEGACY_TRACEABILITY_COLLECTION = 'traceabilityRecords';

const ANIMAL_TYPES = [
  { value: 'rind', label: 'Rind' },
  { value: 'schwein', label: 'Schwein' },
  { value: 'gefluegel', label: 'Geflügel' },
  { value: 'schaf', label: 'Schaf' },
  { value: 'ziege', label: 'Ziege' },
];

const ORGANIC_ASSOCIATION_OPTIONS = new Set([
  'EU-Bio',
  'Bioland',
  'Demeter',
  'Naturland',
  'Keine / Konventionell',
]);

const COUNTRY_OPTIONS = [
  { value: 'Deutschland', label: 'Deutschland' },
  { value: 'Österreich', label: 'Österreich' },
  { value: 'Niederlande', label: 'Niederlande' },
  { value: 'Belgien', label: 'Belgien' },
  { value: 'Frankreich', label: 'Frankreich' },
  { value: 'Polen', label: 'Polen' },
  { value: 'Dänemark', label: 'Dänemark' },
  { value: 'Irland', label: 'Irland' },
  { value: 'Spanien', label: 'Spanien' },
  { value: 'Italien', label: 'Italien' },
  { value: 'Tschechien', label: 'Tschechien' },
  { value: 'Sonstiges EU-Land', label: 'Sonstiges EU-Land' },
  { value: 'Nicht-EU', label: 'Nicht-EU' },
];

const ANIMAL_TYPE_SET = new Set(ANIMAL_TYPES.map((item) => item.value));
const COUNTRY_VALUE_SET = new Set(COUNTRY_OPTIONS.map((item) => item.value));

const traceState = {
  db: null,
  writeOrQueueFirestore: null,
  showHUD: () => {},
  tenantId: '',
  getFirebase: () => (typeof firebase !== 'undefined' ? firebase : null),
  getCurrentUserId: () => '',
  initialized: false,
  pendingPhotoFile: null,
  pendingPhotoPreviewUrl: '',
  labelParseToken: 0,
  adminRecords: [],
  adminUnsubscribe: null,
  adminSearchQuery: '',
  adminDateFilter: '',
  selectedRecordId: '',
  adminTenantId: '',
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function resolveTenantId(explicit = '') {
  return canonicalTenantId(explicit || getGlobalTenantId() || traceState.tenantId || '');
}

function collectionPathFor(tenantId) {
  const id = resolveTenantId(tenantId);
  if (!id) return null;
  try {
    return getTenantCollectionPath(CHARGEN_DOKU_COLLECTION);
  } catch {
    return `tenants/${id}/${CHARGEN_DOKU_COLLECTION}`;
  }
}

/**
 * Platform-Super-Admins dürfen keine privaten Betriebsdaten (roh) lesen.
 * Nur Mandanten-Nutzer mit freigeschaltetem Modul chargenDoku.
 */
function canAccessChargenDokuRecords(tenantId = '') {
  const id = resolveTenantId(tenantId);
  if (!id) return false;
  if (!hasModule('chargenDoku')) return false;
  try {
    const user = typeof firebase !== 'undefined' ? firebase.auth?.()?.currentUser : null;
    if (isPlatformSuperAdmin(user)) return false;
  } catch (_) {
    /* ignore */
  }
  return true;
}

function bookEl(id) {
  return document.getElementById(id)
    || document.getElementById(id.replace(/^chargen-book-/, 'dev-trace-'));
}

function serverTimestamp() {
  return traceState.getFirebase()?.firestore?.FieldValue?.serverTimestamp?.() || new Date().toISOString();
}

function createRecordId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `tr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function animalTypeLabel(value) {
  return ANIMAL_TYPES.find((item) => item.value === value)?.label || value || '–';
}

function countrySelectHtml(id, selected = 'Deutschland') {
  const options = COUNTRY_OPTIONS.map((opt) => (
    `<option value="${escapeHtml(opt.value)}"${opt.value === selected ? ' selected' : ''}>${escapeHtml(opt.label)}</option>`
  )).join('');
  return `<select id="${id}" class="gastro-input">${options}</select>`;
}

function isRind(animalType) {
  return animalType === 'rind';
}

function emptyOrigin() {
  return {
    isSingleOrigin: true,
    singleOriginCountry: 'Deutschland',
    bornIn: '',
    raisedIn: '',
    slaughteredIn: '',
    cutIn: '',
    cuttingPlantNo: '',
  };
}

function readFormOrigin(animalType) {
  const single = Boolean(document.getElementById('trace-single-origin')?.checked);
  const origin = emptyOrigin();
  origin.isSingleOrigin = single;
  if (single) {
    origin.singleOriginCountry = String(document.getElementById('trace-single-country')?.value || '').trim();
    return origin;
  }
  origin.singleOriginCountry = '';
  origin.raisedIn = String(document.getElementById('trace-raised-in')?.value || '').trim();
  origin.slaughteredIn = String(document.getElementById('trace-slaughtered-in')?.value || '').trim();
  if (isRind(animalType)) {
    origin.bornIn = String(document.getElementById('trace-born-in')?.value || '').trim();
    origin.cutIn = String(document.getElementById('trace-cut-in')?.value || '').trim();
    origin.cuttingPlantNo = String(document.getElementById('trace-cutting-plant')?.value || '').trim();
  }
  return origin;
}

function validateForm(lotNumber, animalType, origin, hasPhoto) {
  if (!lotNumber) return 'Bitte Charge / LOT-Nummer eintragen.';
  if (!ANIMAL_TYPE_SET.has(animalType)) return 'Bitte Tierart wählen.';
  if (!hasPhoto) return 'Bitte zuerst das Etikett fotografieren.';
  if (origin.isSingleOrigin) {
    if (!origin.singleOriginCountry) return 'Bitte Ursprungsland wählen.';
    return '';
  }
  if (!origin.raisedIn) return 'Bitte „Aufgezogen / Gemästet in“ wählen.';
  if (!origin.slaughteredIn) return 'Bitte „Geschlachtet in“ wählen.';
  if (isRind(animalType)) {
    if (!origin.bornIn) return 'Bitte „Geboren in“ wählen.';
    if (!origin.cutIn) return 'Bitte „Zerlegt in“ wählen.';
    if (!origin.cuttingPlantNo) return 'Bitte Zulassungsnummer des Zerlegebetriebs eintragen.';
  }
  return '';
}

function syncOriginFieldsVisibility() {
  const animalType = String(document.getElementById('trace-animal-type')?.value || 'rind');
  const single = Boolean(document.getElementById('trace-single-origin')?.checked);
  const singleWrap = document.getElementById('trace-single-origin-fields');
  const multiWrap = document.getElementById('trace-multi-origin-fields');
  const rindOnly = document.getElementById('trace-rind-only-fields');
  if (singleWrap) singleWrap.hidden = !single;
  if (multiWrap) multiWrap.hidden = single;
  if (rindOnly) rindOnly.hidden = single || !isRind(animalType);
}

function revokePendingPreview() {
  if (traceState.pendingPhotoPreviewUrl) {
    try {
      URL.revokeObjectURL(traceState.pendingPhotoPreviewUrl);
    } catch (_) { /* noop */ }
    traceState.pendingPhotoPreviewUrl = '';
  }
}

function clearPendingPhoto() {
  revokePendingPreview();
  traceState.pendingPhotoFile = null;
  const input = document.getElementById('trace-photo-input');
  if (input) input.value = '';
  const preview = document.getElementById('trace-photo-preview');
  if (preview) {
    preview.hidden = true;
    preview.innerHTML = '';
  }
  const btn = document.getElementById('trace-photo-btn');
  if (btn) btn.textContent = '📸 Etikett fotografieren / scannen';
}

function setPendingPhoto(file) {
  if (!file || !String(file.type || '').startsWith('image/')) {
    traceState.showHUD('Hinweis', 'Bitte ein Foto vom Etikett aufnehmen.', '!');
    return false;
  }
  revokePendingPreview();
  traceState.pendingPhotoFile = file;
  traceState.pendingPhotoPreviewUrl = URL.createObjectURL(file);
  const preview = document.getElementById('trace-photo-preview');
  if (preview) {
    preview.hidden = false;
    preview.innerHTML = `
      <img src="${escapeHtml(traceState.pendingPhotoPreviewUrl)}" alt="Vorschau Etikett-Foto">
      <button type="button" class="btn btn-secondary btn-trace-photo-clear" id="trace-photo-clear">Foto entfernen</button>
    `;
    preview.querySelector('#trace-photo-clear')?.addEventListener('click', () => {
      traceState.labelParseToken += 1;
      hideLabelScanOverlay();
      clearPendingPhoto();
    });
  }
  const btn = document.getElementById('trace-photo-btn');
  if (btn) btn.textContent = '📸 Anderes Foto aufnehmen';
  return true;
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

function showLabelScanOverlay() {
  hideLabelScanOverlay();
  const host = document.querySelector('#page-chargen-doku .trace-capture-card')
    || document.getElementById('page-chargen-doku')
    || document.querySelector('#page-traceability .trace-capture-card')
    || document.getElementById('page-traceability');
  if (!host) return;
  if (getComputedStyle(host).position === 'static') {
    host.style.position = 'relative';
  }
  const overlay = document.createElement('div');
  overlay.id = 'trace-label-scan-overlay';
  overlay.className = 'trace-label-scan-overlay';
  overlay.innerHTML = `
    <div class="trace-label-scan-card" role="status" aria-live="polite">
      <div class="trace-label-scan-spinner" aria-hidden="true"></div>
      <p class="trace-label-scan-text">✨ KI analysiert Etikett…</p>
    </div>
  `;
  host.appendChild(overlay);
}

function hideLabelScanOverlay() {
  document.getElementById('trace-label-scan-overlay')?.remove();
}

function flashAutofilledFields(fieldIds) {
  fieldIds.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('trace-field-autofilled');
    window.setTimeout(() => el.classList.remove('trace-field-autofilled'), 2200);
  });
}

function setSelectOrInputValue(id, value) {
  const el = document.getElementById(id);
  if (!el || value == null) return false;
  const next = String(value).trim();
  if (!next && el.tagName !== 'SELECT') {
    el.value = '';
    return false;
  }
  if (el.tagName === 'SELECT') {
    const match = Array.from(el.options).find((opt) => opt.value === next);
    if (!match) return false;
    el.value = next;
    return true;
  }
  el.value = next;
  return true;
}

function applyParsedLabelToForm(label = {}) {
  const filledIds = [];
  const markFilled = (id, ok) => {
    if (ok) filledIds.push(id);
  };

  markFilled('trace-lot-number', setSelectOrInputValue('trace-lot-number', label.lotNumber));
  markFilled('trace-health-mark', setSelectOrInputValue('trace-health-mark', label.healthMark));
  markFilled(
    'trace-organic-control-body',
    setSelectOrInputValue('trace-organic-control-body', label.organicControlBody),
  );

  const association = ORGANIC_ASSOCIATION_OPTIONS.has(label.organicAssociation)
    ? label.organicAssociation
    : '';
  if (association) {
    markFilled('trace-organic-association', setSelectOrInputValue('trace-organic-association', association));
  } else {
    markFilled('trace-organic-association', setSelectOrInputValue('trace-organic-association', ''));
  }

  const animalType = ANIMAL_TYPE_SET.has(label.animalType) ? label.animalType : 'rind';
  markFilled('trace-animal-type', setSelectOrInputValue('trace-animal-type', animalType));

  const isSingleOrigin = label.isSingleOrigin === true;
  const singleOriginEl = document.getElementById('trace-single-origin');
  if (singleOriginEl) {
    singleOriginEl.checked = isSingleOrigin;
    filledIds.push('trace-single-origin');
  }

  syncOriginFieldsVisibility();

  if (isSingleOrigin) {
    const country = COUNTRY_VALUE_SET.has(label.singleOriginCountry)
      ? label.singleOriginCountry
      : (label.singleOriginCountry ? 'Sonstiges EU-Land' : '');
    // Never invent "Deutschland" when the KI left the country empty.
    if (country) {
      markFilled('trace-single-country', setSelectOrInputValue('trace-single-country', country));
    }
  } else {
    markFilled('trace-raised-in', setSelectOrInputValue(
      'trace-raised-in',
      COUNTRY_VALUE_SET.has(label.raisedIn) ? label.raisedIn : (label.raisedIn ? 'Sonstiges EU-Land' : ''),
    ));
    markFilled('trace-slaughtered-in', setSelectOrInputValue(
      'trace-slaughtered-in',
      COUNTRY_VALUE_SET.has(label.slaughteredIn) ? label.slaughteredIn : (label.slaughteredIn ? 'Sonstiges EU-Land' : ''),
    ));
    if (animalType === 'rind') {
      markFilled('trace-born-in', setSelectOrInputValue(
        'trace-born-in',
        COUNTRY_VALUE_SET.has(label.bornIn) ? label.bornIn : (label.bornIn ? 'Sonstiges EU-Land' : ''),
      ));
      markFilled('trace-cut-in', setSelectOrInputValue(
        'trace-cut-in',
        COUNTRY_VALUE_SET.has(label.cutIn) ? label.cutIn : (label.cutIn ? 'Sonstiges EU-Land' : ''),
      ));
      markFilled('trace-cutting-plant', setSelectOrInputValue('trace-cutting-plant', label.cuttingPlantNo));
    }
  }

  flashAutofilledFields([...new Set(filledIds)]);
  return filledIds.length > 0;
}

async function callParseMeatLabel(imageBase64, mimeType) {
  const firebaseApi = traceState.getFirebase();
  if (!firebaseApi?.app) {
    throw new Error('Etikett-Scan ist gerade nicht bereit.');
  }
  const callable = createHttpsCallable('parseMeatLabel', { timeout: 120000 }, firebaseApi);
  await waitForAppCheckReady();
  const result = await callable({ imageBase64, mimeType });
  return result?.data?.label || null;
}

function notifyToast(message, type = 'success') {
  if (typeof window.showToast === 'function') {
    window.showToast(message, type);
    return;
  }
  traceState.showHUD(type === 'error' || type === 'warning' ? 'Hinweis' : 'Gespeichert', message, '!');
}

async function analyzePendingLabelPhoto(file) {
  const token = ++traceState.labelParseToken;
  showLabelScanOverlay();
  try {
    if (!navigator.onLine) {
      throw new Error('offline');
    }
    const mimeType = String(file.type || 'image/jpeg').trim().toLowerCase() || 'image/jpeg';
    const imageBase64 = await readFileAsBase64(file);
    const label = await callParseMeatLabel(imageBase64, mimeType);
    if (token !== traceState.labelParseToken) return;
    if (!label || typeof label !== 'object') {
      throw new Error('empty-label');
    }
    applyParsedLabelToForm(label);
    notifyToast('Etikett erkannt. Bitte Daten kurz prüfen & speichern.', 'success');
  } catch (error) {
    if (token !== traceState.labelParseToken) return;
    notifyToast(logAndMapOperatorError(error, 'meat-label'), 'warning');
  } finally {
    if (token === traceState.labelParseToken) {
      hideLabelScanOverlay();
    }
  }
}

async function uploadTraceabilityPhoto(file, recordId, tenantId) {
  const firebaseApi = traceState.getFirebase();
  if (!firebaseApi?.storage) throw new Error('Foto-Speicher ist nicht bereit.');
  if (!tenantId) throw new Error('Mandant fehlt.');
  const path = `tenants/${tenantId}/chargendoku/${recordId}.jpg`;
  const ref = firebaseApi.storage().ref(path);
  const snapshot = await ref.put(file, { contentType: file.type || 'image/jpeg' });
  return snapshot.ref.getDownloadURL();
}

function resetCaptureForm() {
  const lot = document.getElementById('trace-lot-number');
  const mark = document.getElementById('trace-health-mark');
  const organicControlBody = document.getElementById('trace-organic-control-body');
  const organicAssociation = document.getElementById('trace-organic-association');
  const animal = document.getElementById('trace-animal-type');
  const single = document.getElementById('trace-single-origin');
  if (lot) lot.value = '';
  if (mark) mark.value = '';
  if (organicControlBody) organicControlBody.value = '';
  if (organicAssociation) organicAssociation.value = '';
  if (animal) animal.value = 'rind';
  if (single) single.checked = true;
  ['trace-single-country', 'trace-born-in', 'trace-raised-in', 'trace-slaughtered-in', 'trace-cut-in'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = 'Deutschland';
  });
  const plant = document.getElementById('trace-cutting-plant');
  if (plant) plant.value = '';
  clearPendingPhoto();
  syncOriginFieldsVisibility();
}

async function saveTraceabilityRecord() {
  const tenantId = resolveTenantId();
  const path = collectionPathFor(tenantId);
  if (!path || !traceState.writeOrQueueFirestore) {
    traceState.showHUD('Hinweis', 'Speichern ist gerade nicht möglich. Bitte kurz warten und erneut versuchen.', '!');
    return;
  }

  const lotNumber = String(document.getElementById('trace-lot-number')?.value || '').trim();
  const healthMark = String(document.getElementById('trace-health-mark')?.value || '').trim();
  const organicControlBodyVal = String(document.getElementById('trace-organic-control-body')?.value || '').trim();
  const organicAssociationVal = String(document.getElementById('trace-organic-association')?.value || '').trim();
  const animalType = String(document.getElementById('trace-animal-type')?.value || '').trim();
  const origin = readFormOrigin(animalType);
  const validationError = validateForm(lotNumber, animalType, origin, Boolean(traceState.pendingPhotoFile));
  if (validationError) {
    traceState.showHUD('Hinweis', validationError, '!');
    return;
  }

  const createdBy = String(traceState.getCurrentUserId() || '').trim();
  if (!createdBy) {
    traceState.showHUD('Hinweis', 'Anmeldung fehlt. Bitte erneut anmelden.', '!');
    return;
  }

  const saveBtn = document.getElementById('trace-save-btn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Wird gespeichert…';
  }

  const recordId = createRecordId();
  try {
    const imageUrl = await uploadTraceabilityPhoto(traceState.pendingPhotoFile, recordId, tenantId);
    const payload = {
      id: recordId,
      createdBy,
      status: 'active',
      lotNumber,
      healthMark,
      organicControlBody: organicControlBodyVal || '',
      organicAssociation: organicAssociationVal || '',
      imageUrl,
      animalType,
      origin,
      tenantId,
    };
    const nowIso = new Date().toISOString();
    await traceState.writeOrQueueFirestore({
      collectionPath: path,
      docId: recordId,
      op: 'set',
      onlineData: { ...payload, createdAt: serverTimestamp() },
      queueData: { ...payload, createdAt: nowIso },
      offlineMessage: 'Herkunftseintrag wird automatisch synchronisiert, sobald WLAN verfügbar ist.',
    });
    resetCaptureForm();
    traceState.showHUD('Gespeichert', 'Herkunft ist erfasst und im Thekenbuch aktiv.');
  } catch (err) {
    console.error('[CharcuLogic Traceability] Speichern fehlgeschlagen:', err);
    traceState.showHUD(
      'Hat nicht geklappt',
      'Herkunft konnte nicht gespeichert werden. Bitte Foto und Verbindung prüfen und erneut versuchen.',
      '!',
    );
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Herkunft speichern';
    }
  }
}

function bindCaptureControls() {
  const photoBtn = document.getElementById('trace-photo-btn');
  const photoInput = document.getElementById('trace-photo-input');
  photoBtn?.addEventListener('click', () => photoInput?.click());
  photoInput?.addEventListener('change', () => {
    const file = photoInput.files?.[0];
    if (!file) return;
    const ready = setPendingPhoto(file);
    if (ready) {
      void analyzePendingLabelPhoto(file);
    }
  });

  document.getElementById('trace-animal-type')?.addEventListener('change', syncOriginFieldsVisibility);
  document.getElementById('trace-single-origin')?.addEventListener('change', syncOriginFieldsVisibility);
  document.getElementById('trace-save-btn')?.addEventListener('click', () => {
    void saveTraceabilityRecord();
  });
}

function fillCountrySelects() {
  const map = {
    'trace-single-country': 'Deutschland',
    'trace-born-in': 'Deutschland',
    'trace-raised-in': 'Deutschland',
    'trace-slaughtered-in': 'Deutschland',
    'trace-cut-in': 'Deutschland',
  };
  Object.entries(map).forEach(([id, selected]) => {
    const el = document.getElementById(id);
    if (!el || el.options.length) return;
    const blank = '<option value="">Bitte wählen…</option>';
    el.innerHTML = blank + COUNTRY_OPTIONS.map((opt) => (
      `<option value="${escapeHtml(opt.value)}"${opt.value === selected ? ' selected' : ''}>${escapeHtml(opt.label)}</option>`
    )).join('');
  });
}

export function initTraceabilityModule(databaseInstance, writeOrQueueFirestoreFunction, showHudCallback, options = {}) {
  traceState.db = databaseInstance || null;
  traceState.writeOrQueueFirestore = writeOrQueueFirestoreFunction || null;
  traceState.showHUD = typeof showHudCallback === 'function' ? showHudCallback : () => {};
  traceState.tenantId = options.tenantId || traceState.tenantId;
  traceState.getFirebase = typeof options.getFirebase === 'function' ? options.getFirebase : traceState.getFirebase;
  traceState.getCurrentUserId = typeof options.getCurrentUserId === 'function'
    ? options.getCurrentUserId
    : () => '';

  if (!traceState.initialized) {
    fillCountrySelects();
    bindCaptureControls();
    bindChargenDokuSubnav();
    syncOriginFieldsVisibility();
    traceState.initialized = true;
  }
}

export function activateChargenDokuTab() {
  bindChargenDokuSubnav();
  syncOriginFieldsVisibility();
  setChargenDokuPanel('capture');
}

/** @deprecated Use activateChargenDokuTab */
export function activateTraceabilityTab() {
  return activateChargenDokuTab();
}

function toDateKey(value) {
  if (!value) return '';
  try {
    if (typeof value?.toDate === 'function') {
      return value.toDate().toISOString().slice(0, 10);
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  } catch (_) {
    return '';
  }
}

function formatDateTimeDe(value) {
  if (!value) return '–';
  try {
    const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return '–';
    return date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (_) {
    return '–';
  }
}

function statusLabel(status) {
  return status === 'archived' ? 'Archiviert' : 'Aktiv in Theke';
}

function filteredAdminRecords() {
  const query = String(traceState.adminSearchQuery || '').trim().toLowerCase();
  const dateFilter = String(traceState.adminDateFilter || '').trim();
  return traceState.adminRecords.filter((record) => {
    if (dateFilter && toDateKey(record.createdAt) !== dateFilter) return false;
    if (!query) return true;
    const haystack = `${record.lotNumber || ''} ${record.healthMark || ''} ${record.organicControlBody || ''} ${record.organicAssociation || ''} ${animalTypeLabel(record.animalType)}`.toLowerCase();
    return haystack.includes(query);
  });
}

function formatOriginForInspectors(origin = {}, animalType = '') {
  if (!origin || typeof origin !== 'object') return '<p>Keine Herkunftsdaten.</p>';
  if (origin.isSingleOrigin) {
    return `
      <dl class="trace-detail-dl">
        <div><dt>Ursprung</dt><dd>Ein einziges Land: <strong>${escapeHtml(origin.singleOriginCountry || '–')}</strong></dd></div>
      </dl>
    `;
  }
  const rows = [];
  if (isRind(animalType)) {
    rows.push(`<div><dt>Geboren in</dt><dd>${escapeHtml(origin.bornIn || '–')}</dd></div>`);
  }
  rows.push(`<div><dt>${isRind(animalType) ? 'Gemästet in' : 'Aufgezogen in'}</dt><dd>${escapeHtml(origin.raisedIn || '–')}</dd></div>`);
  rows.push(`<div><dt>Geschlachtet in</dt><dd>${escapeHtml(origin.slaughteredIn || '–')}</dd></div>`);
  if (isRind(animalType)) {
    rows.push(`<div><dt>Zerlegt in</dt><dd>${escapeHtml(origin.cutIn || '–')}</dd></div>`);
    rows.push(`<div><dt>Zulassungsnr. Zerlegebetrieb</dt><dd>${escapeHtml(origin.cuttingPlantNo || '–')}</dd></div>`);
  }
  return `<dl class="trace-detail-dl">${rows.join('')}</dl>`;
}

function hasBioCertification(record = {}) {
  const body = String(record.organicControlBody || '').trim();
  const assoc = String(record.organicAssociation || '').trim();
  if (body) return true;
  if (!assoc || assoc === 'Keine / Konventionell') return false;
  if (assoc === 'EU-Bio') return false;
  return true;
}

function formatBioCertificationSection(record = {}) {
  if (!hasBioCertification(record)) return '';
  const body = String(record.organicControlBody || '').trim();
  const assoc = String(record.organicAssociation || '').trim();
  return `
    <section class="trace-bio-section" aria-label="Bio-Zertifizierung">
      <div class="trace-bio-section-header">
        <span class="trace-bio-badge">Bio-Zertifizierung</span>
      </div>
      <dl class="trace-detail-dl">
        <div><dt>Öko-Kontrollstelle</dt><dd>${escapeHtml(body || '–')}</dd></div>
        <div><dt>Bio-Verband</dt><dd>${escapeHtml(assoc || '–')}</dd></div>
      </dl>
    </section>
  `;
}

function formatOrganicControlBodyCell(record = {}) {
  const body = String(record.organicControlBody || '').trim();
  if (!body) return '–';
  return `<span class="dev-trace-organic-badge" title="Öko-Kontrollstelle">${escapeHtml(body)}</span>`;
}

function renderAdminDetail(record) {
  const panel = bookEl('chargen-book-detail');
  if (!panel) return;
  if (!record) {
    panel.innerHTML = '<p class="dev-dashboard-intro">Eintrag wählen, um Etikett und LMIV-Daten anzuzeigen.</p>';
    return;
  }
  panel.innerHTML = `
    <div class="trace-detail-header">
      <h3 class="dev-dashboard-subsection-title">LMIV-Detail · ${escapeHtml(record.lotNumber || '–')}</h3>
      <button type="button" class="btn btn-secondary" id="chargen-book-detail-close">Schließen</button>
    </div>
    <div class="trace-detail-grid">
      <figure class="trace-detail-photo">
        ${record.imageUrl
    ? `<img src="${escapeHtml(record.imageUrl)}" alt="Original-Etikett Charge ${escapeHtml(record.lotNumber || '')}">`
    : '<p>Kein Foto vorhanden.</p>'}
        <figcaption>Original-Etikett (Foto)</figcaption>
      </figure>
      <div class="trace-detail-meta">
        <dl class="trace-detail-dl">
          <div><dt>Charge / LOT</dt><dd>${escapeHtml(record.lotNumber || '–')}</dd></div>
          <div><dt>Identitätskennzeichen</dt><dd>${escapeHtml(record.healthMark || '–')}</dd></div>
          <div><dt>Tierart</dt><dd>${escapeHtml(animalTypeLabel(record.animalType))}</dd></div>
          <div><dt>Status</dt><dd>${escapeHtml(statusLabel(record.status))}</dd></div>
          <div><dt>Erfasst am</dt><dd>${escapeHtml(formatDateTimeDe(record.createdAt))}</dd></div>
          <div><dt>Erfasst von (User-ID)</dt><dd><code>${escapeHtml(record.createdBy || '–')}</code></dd></div>
        </dl>
        ${formatBioCertificationSection(record)}
        <h4 class="trace-detail-origin-title">Herkunft laut LMIV</h4>
        ${formatOriginForInspectors(record.origin, record.animalType)}
      </div>
    </div>
  `;
  panel.querySelector('#chargen-book-detail-close')?.addEventListener('click', () => {
    traceState.selectedRecordId = '';
    renderAdminDetail(null);
    renderAdminTable();
  });
}

function renderAdminTable() {
  const body = bookEl('chargen-book-body');
  if (!body) return;
  const rows = filteredAdminRecords();
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="7" class="dev-dashboard-empty-msg">Keine Einträge für diese Suche.</td></tr>';
    return;
  }
  body.innerHTML = rows.map((record) => {
    const active = record.status !== 'archived';
    const selected = record.id === traceState.selectedRecordId;
    return `
      <tr class="dev-trace-row${selected ? ' is-selected' : ''}" data-record-id="${escapeHtml(record.id)}">
        <td><button type="button" class="dev-trace-lot-btn" data-open-detail="${escapeHtml(record.id)}">${escapeHtml(record.lotNumber || '–')}</button></td>
        <td>${escapeHtml(animalTypeLabel(record.animalType))}</td>
        <td>${escapeHtml(formatDateTimeDe(record.createdAt))}</td>
        <td>${escapeHtml(record.healthMark || '–')}</td>
        <td>${formatOrganicControlBodyCell(record)}</td>
        <td>
          <span class="dev-trace-status-pill" data-status="${active ? 'active' : 'archived'}">${escapeHtml(statusLabel(record.status))}</span>
        </td>
        <td>
          <button
            type="button"
            class="dev-dashboard-action-btn"
            data-toggle-status="${escapeHtml(record.id)}"
            data-next-status="${active ? 'archived' : 'active'}"
          >${active ? 'Archivieren' : 'In Theke aktivieren'}</button>
        </td>
      </tr>
    `;
  }).join('');
}

async function toggleRecordStatus(recordId, nextStatus) {
  const tenantId = resolveTenantId(traceState.adminTenantId);
  if (!tenantId || !traceState.db) return;
  if (!canAccessChargenDokuRecords(tenantId)) return;
  if (nextStatus !== 'active' && nextStatus !== 'archived') return;
  const record = traceState.adminRecords.find((item) => item.id === recordId);
  const collectionName = record?.__collection || CHARGEN_DOKU_COLLECTION;
  try {
    await traceState.db
      .collection('tenants')
      .doc(tenantId)
      .collection(collectionName)
      .doc(recordId)
      .update({ status: nextStatus });
    window.showToast?.(
      nextStatus === 'archived' ? 'Eintrag archiviert.' : 'Eintrag ist wieder aktiv in der Theke.',
      'success',
    );
  } catch (err) {
    console.error('[CharcuLogic Chargen-Doku] Status-Update fehlgeschlagen:', err);
    window.showToast?.('Status konnte nicht geändert werden.', 'error');
  }
}

function bindAdminPanelControls() {
  const search = bookEl('chargen-book-search');
  const date = bookEl('chargen-book-date');
  if (search && search.dataset.bound !== '1') {
    search.dataset.bound = '1';
    search.addEventListener('input', () => {
      traceState.adminSearchQuery = search.value || '';
      renderAdminTable();
    });
  }
  if (date && date.dataset.bound !== '1') {
    date.dataset.bound = '1';
    date.addEventListener('change', () => {
      traceState.adminDateFilter = date.value || '';
      renderAdminTable();
    });
  }

  const table = bookEl('chargen-book-table');
  if (table && table.dataset.bound !== '1') {
    table.dataset.bound = '1';
    table.addEventListener('click', (event) => {
      const openBtn = event.target.closest('[data-open-detail]');
      if (openBtn) {
        const id = openBtn.getAttribute('data-open-detail');
        const record = traceState.adminRecords.find((item) => item.id === id) || null;
        traceState.selectedRecordId = id || '';
        renderAdminDetail(record);
        renderAdminTable();
        return;
      }
      const toggleBtn = event.target.closest('[data-toggle-status]');
      if (toggleBtn instanceof HTMLButtonElement) {
        const id = toggleBtn.getAttribute('data-toggle-status');
        const next = toggleBtn.getAttribute('data-next-status');
        void toggleRecordStatus(id, next);
      }
    });
  }
}

function bindChargenDokuSubnav() {
  const root = document.getElementById('page-chargen-doku')
    || document.getElementById('page-traceability');
  if (!root || root.dataset.subnavBound === '1') return;
  root.dataset.subnavBound = '1';
  root.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-chargen-panel]');
    if (!(btn instanceof HTMLButtonElement)) return;
    const panel = btn.getAttribute('data-chargen-panel') || 'capture';
    setChargenDokuPanel(panel);
  });
}

function setChargenDokuPanel(panelKey = 'capture') {
  const capture = document.getElementById('chargen-doku-panel-capture');
  const book = document.getElementById('chargen-doku-panel-book');
  const showBook = panelKey === 'book';
  if (capture) capture.hidden = showBook;
  if (book) book.hidden = !showBook;
  document.querySelectorAll('[data-chargen-panel]').forEach((btn) => {
    const active = btn.getAttribute('data-chargen-panel') === panelKey;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  if (showBook) {
    startChargenDokuBookView(traceState.tenantId || getGlobalTenantId());
  }
}

function mergeChargenRecords(primarySnap, legacySnap) {
  const byId = new Map();
  (legacySnap?.docs || []).forEach((docSnap) => {
    const data = docSnap.data() || {};
    const id = data.id || docSnap.id;
    byId.set(id, { ...data, id, __collection: LEGACY_TRACEABILITY_COLLECTION });
  });
  (primarySnap?.docs || []).forEach((docSnap) => {
    const data = docSnap.data() || {};
    const id = data.id || docSnap.id;
    byId.set(id, { ...data, id, __collection: CHARGEN_DOKU_COLLECTION });
  });
  return Array.from(byId.values()).sort((a, b) => {
    const aMs = a.createdAt?.toMillis?.() || Date.parse(a.createdAt) || 0;
    const bMs = b.createdAt?.toMillis?.() || Date.parse(b.createdAt) || 0;
    return bMs - aMs;
  });
}

/** @param {string} [tenantId] */
export function startChargenDokuBookView(tenantId) {
  const resolved = resolveTenantId(tenantId);
  traceState.adminTenantId = resolved;
  bindAdminPanelControls();

  const body = bookEl('chargen-book-body');
  const statusEl = bookEl('chargen-book-status');

  if (!canAccessChargenDokuRecords(resolved)) {
    if (body) {
      body.innerHTML = '<tr><td colspan="7" class="dev-dashboard-empty-msg">Thekenbuch ist für diesen Zugang nicht freigeschaltet.</td></tr>';
    }
    if (statusEl) statusEl.textContent = 'Kein Zugriff';
    stopChargenDokuBookView();
    return;
  }

  if (!resolved || !traceState.db) {
    if (body) {
      body.innerHTML = '<tr><td colspan="7" class="dev-dashboard-empty-msg">Betrieb fehlt – Thekenbuch kann nicht geladen werden.</td></tr>';
    }
    return;
  }

  if (traceState.adminUnsubscribe) {
    traceState.adminUnsubscribe();
    traceState.adminUnsubscribe = null;
  }

  if (statusEl) statusEl.textContent = 'Lade Einträge…';

  const tenantRef = traceState.db.collection('tenants').doc(resolved);
  let primarySnap = null;
  let legacySnap = null;
  let primaryError = null;

  const publish = () => {
    if (primaryError) {
      if (statusEl) statusEl.textContent = 'Laden fehlgeschlagen';
      if (body) {
        body.innerHTML = '<tr><td colspan="7" class="dev-dashboard-empty-msg dev-dashboard-empty-msg--error">Zugriff oder Verbindung fehlgeschlagen.</td></tr>';
      }
      return;
    }
    if (!primarySnap) return;
    traceState.adminRecords = mergeChargenRecords(primarySnap, legacySnap);
    renderAdminTable();
    if (traceState.selectedRecordId) {
      const selected = traceState.adminRecords.find((item) => item.id === traceState.selectedRecordId) || null;
      renderAdminDetail(selected);
    }
    if (statusEl) {
      statusEl.textContent = `${traceState.adminRecords.length} Eintrag${traceState.adminRecords.length === 1 ? '' : 'e'} geladen`;
    }
  };

  const unsubPrimary = tenantRef
    .collection(CHARGEN_DOKU_COLLECTION)
    .orderBy('createdAt', 'desc')
    .limit(300)
    .onSnapshot(
      (snap) => {
        primaryError = null;
        primarySnap = snap;
        publish();
      },
      (err) => {
        console.error('[CharcuLogic Chargen-Doku] Listener fehlgeschlagen:', err);
        primaryError = err;
        publish();
      },
    );

  const unsubLegacy = tenantRef
    .collection(LEGACY_TRACEABILITY_COLLECTION)
    .orderBy('createdAt', 'desc')
    .limit(300)
    .onSnapshot(
      (snap) => {
        legacySnap = snap;
        publish();
      },
      (err) => {
        // Legacy optional – fehlende Rechte/Index nicht als Hard-Fail
        console.warn('[CharcuLogic Chargen-Doku] Legacy-Listener:', err?.message || err);
        legacySnap = { docs: [] };
        publish();
      },
    );

  traceState.adminUnsubscribe = () => {
    unsubPrimary();
    unsubLegacy();
  };
}

/** @deprecated Use startChargenDokuBookView */
export function startTraceabilityAdminView(tenantId) {
  return startChargenDokuBookView(tenantId);
}

export function stopChargenDokuBookView() {
  if (traceState.adminUnsubscribe) {
    traceState.adminUnsubscribe();
    traceState.adminUnsubscribe = null;
  }
}

/** @deprecated Use stopChargenDokuBookView */
export function stopTraceabilityAdminView() {
  return stopChargenDokuBookView();
}

export {
  ANIMAL_TYPES,
  COUNTRY_OPTIONS,
  countrySelectHtml,
  hasBioCertification,
};
