import { getGlobalTenantId, getTenantCollectionPath } from './tenant-db.js';
import { ACTIVE_EMPLOYEE_STORAGE_KEY, scopedTeamboardStorageKey } from './teamboard-storage.js';

function hasActiveFirebaseAuthUserForSelfHealing() {
  if (typeof window.hasActiveFirebaseAuthUser === 'function') {
    return window.hasActiveFirebaseAuthUser();
  }
  try {
    const firebaseApi = haccpState.getFirebase?.() || (typeof firebase !== 'undefined' ? firebase : null);
    return Boolean(firebaseApi?.apps?.length && firebaseApi.auth?.().currentUser);
  } catch (_) {
    return false;
  }
}

function maybeResetOnFirestorePermissionError(err, context = '') {
  if (!hasActiveFirebaseAuthUserForSelfHealing()) return false;
  if (typeof window.isFirestorePermissionDeniedError !== 'function') return false;
  if (!window.isFirestorePermissionDeniedError(err)) return false;
  void window.resetAuthStateOnPermissionDenied?.(err, context);
  return true;
}

const AUTH_LOOP_BREAKER_KEY = 'charculogic_auth_loop_breaker';

function canStartHaccpFirestoreLiveSync() {
  try {
    if (sessionStorage.getItem(AUTH_LOOP_BREAKER_KEY) === 'true') return false;
  } catch (_) { /* noop */ }
  if (typeof window.canStartFirestoreLiveListeners === 'function') {
    return window.canStartFirestoreLiveListeners();
  }
  const authApi = haccpState.getFirebase?.()?.auth?.();
  return Boolean(authApi?.currentUser);
}

const DEFAULT_HACCP_DEVICES = [
  { name: 'Kühlauslage Hofladen', bereich: 'Hofladen', protokollTyp: 'temperatur', geraeteTyp: 'kuehlung', sollMin: 0, sollMax: 7, einheit: '°C', intervall: 'taeglich', aktiv: true },
  { name: 'MoPro-Kühlung', bereich: 'Hofladen', protokollTyp: 'temperatur', geraeteTyp: 'kuehlung', sollMin: 0, sollMax: 7, einheit: '°C', intervall: 'taeglich', aktiv: true },
  { name: 'TK-Truhe', bereich: 'Hofladen', protokollTyp: 'temperatur', geraeteTyp: 'tk', sollMin: null, sollMax: -18, einheit: '°C', intervall: 'taeglich', aktiv: true },
  { name: 'Schneidemaschine', bereich: 'Produktion', protokollTyp: 'reinigung', geraeteTyp: 'geraet', intervall: 'nach_benutzung', aktiv: true },
  { name: 'Vakuumierer', bereich: 'Produktion', protokollTyp: 'reinigung', geraeteTyp: 'geraet', intervall: 'nach_benutzung', aktiv: true },
];

const HACCP_DRAFT_KEY = 'charculogic.draft.haccp';
const HACCP_CLEANING_PERSON_KEY = 'charculogic.haccp.cleaning.doneBy';

const HACCP_CLEANING_TEAM = [
  'Bettina',
  'Efecan',
  'Finn',
  'Heiko',
  'Melanie',
  'Mimi',
  'Nicole',
  'Paddy',
  'Stephie',
  'Thomas',
  'Aushilfe (andere)',
];

const HACCP_TEMPERATURE_GROUPS = [
  {
    id: 'deep-freeze',
    title: 'TIEF-KÜHLUNG',
    warnAbove: -15,
    unit: '°C',
    stations: [
      'TK-Truhe für Brötchen (Vorrat)',
      'SB-TK-Schrank Fleisch',
      'SB-TK-Schrank 2',
      'SB-TK-Schrank 3',
    ],
  },
  {
    id: 'fresh-cooling',
    title: 'FRISCHE-KÜHLUNG',
    warnAbove: 7,
    unit: '°C',
    stations: [
      'SB-Kühlschrank Frische und MoPro',
      'Käse-Theke',
      'Kühlvitrine Kuchen (Saisonal)',
    ],
  },
  {
    id: 'counters',
    title: 'DYNAMISCHE THEKEN',
    warnAbove: 7,
    unit: '°C',
    optionalDays: [0, 1, 2, 3],
    optionalHint: 'Theke laut Plan leer - Messung optional',
    stations: [
      'Wurst-Theke',
      'Fleisch-Theke',
    ],
  },
];

const HACCP_CLEANING_GROUPS = [
  {
    id: 'daily-shop',
    title: 'TÄGLICH (IM LADENBETRIEB)',
    period: 'day',
    tasks: [
      { id: 'verkaufstheke-waagen', name: 'Verkaufstheke & Waagen gereinigt' },
    ],
  },
  {
    id: 'production-days',
    title: 'NACH NUTZUNG (NUR AN PRODUKTIONSTAGEN)',
    period: 'day',
    tasks: [
      { id: 'wurstkueche', name: 'Wurstküche gereinigt & desinfiziert' },
      { id: 'messer-werkzeuge', name: 'Messer & Werkzeuge sterilisiert' },
      { id: 'rauch-kochanlagen', name: 'Rauch- und Kochanlagen gereinigt' },
    ],
  },
  {
    id: 'weekly',
    title: 'WÖCHENTLICH',
    period: 'week',
    tasks: [
      { id: 'kuehlhaus-grundreinigung', name: 'Kühlhaus Grundreinigung' },
    ],
  },
];

const haccpState = {
  db: null,
  writeOrQueueFirestore: null,
  showHUD: () => {},
  verifyAdminAction: (callback) => callback(),
  onFormSaved: () => {},
  restoreDraftFields: () => 0,
  tenantId: '',
  getFirebase: () => null,
  playClickSound: () => {},
  mode: 'temperatur',
  devices: [],
  logs: [],
  cleaningDoneBy: '',
  devicesUnsubscribe: null,
  logsUnsubscribe: null,
  initialized: false,
};

function saveHaccpDraft() {
  try {
    const draft = {
      ph: document.getElementById('haccp-ph')?.value || '',
      temp: document.getElementById('haccp-temp')?.value || '',
      batch: document.getElementById('haccp-batch')?.value || '',
      savedAt: Date.now(),
    };
    localStorage.setItem(HACCP_DRAFT_KEY, JSON.stringify(draft));
  } catch (_) { /* quota exceeded — silent */ }
}

function restoreHaccpDraft() {
  try {
    const raw = localStorage.getItem(HACCP_DRAFT_KEY);
    if (!raw) return;
    const draft = JSON.parse(raw);
    if (Date.now() - (draft.savedAt || 0) > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(HACCP_DRAFT_KEY);
      return;
    }
    const phEl = document.getElementById('haccp-ph');
    const tempEl = document.getElementById('haccp-temp');
    const batchEl = document.getElementById('haccp-batch');
    if (phEl && draft.ph) phEl.value = draft.ph;
    if (tempEl && draft.temp) tempEl.value = draft.temp;
    if (batchEl && draft.batch) batchEl.value = draft.batch;
    updateHACCPAlerts();
  } catch (_) { /* corrupt draft — silent */ }
}

function clearHaccpDraft() {
  try { localStorage.removeItem(HACCP_DRAFT_KEY); } catch (_) { /* noop */ }
}

function restoreCleaningPerson() {
  if (haccpState.cleaningDoneBy) return;
  try {
    const stored = localStorage.getItem(HACCP_CLEANING_PERSON_KEY)
      || localStorage.getItem(scopedTeamboardStorageKey(ACTIVE_EMPLOYEE_STORAGE_KEY, resolveHaccpTenantId()))
      || '';
    haccpState.cleaningDoneBy = HACCP_CLEANING_TEAM.includes(stored) ? stored : '';
  } catch (_) { /* noop */ }
}

function rememberCleaningPerson(name) {
  haccpState.cleaningDoneBy = HACCP_CLEANING_TEAM.includes(name) ? name : '';
  try {
    if (haccpState.cleaningDoneBy) {
      localStorage.setItem(HACCP_CLEANING_PERSON_KEY, haccpState.cleaningDoneBy);
      localStorage.setItem(scopedTeamboardStorageKey(ACTIVE_EMPLOYEE_STORAGE_KEY, resolveHaccpTenantId()), haccpState.cleaningDoneBy);
    } else {
      localStorage.removeItem(HACCP_CLEANING_PERSON_KEY);
      localStorage.removeItem(scopedTeamboardStorageKey(ACTIVE_EMPLOYEE_STORAGE_KEY, resolveHaccpTenantId()));
    }
  } catch (_) { /* noop */ }
  window.dispatchEvent(new CustomEvent('charculogic:active-employee-changed', {
    detail: { employeeName: haccpState.cleaningDoneBy },
  }));
}

export function initHaccpModule(databaseInstance, writeOrQueueFirestoreFunction, showHudCallback, verifyAdminActionCallback, options = {}) {
  haccpState.db = databaseInstance || null;
  haccpState.writeOrQueueFirestore = writeOrQueueFirestoreFunction || haccpState.writeOrQueueFirestore;
  haccpState.showHUD = typeof showHudCallback === 'function' ? showHudCallback : haccpState.showHUD;
  haccpState.verifyAdminAction = typeof verifyAdminActionCallback === 'function' ? verifyAdminActionCallback : haccpState.verifyAdminAction;
  haccpState.onFormSaved = typeof options.onFormSaved === 'function' ? options.onFormSaved : haccpState.onFormSaved;
  haccpState.restoreDraftFields = typeof options.restoreDraftFields === 'function' ? options.restoreDraftFields : haccpState.restoreDraftFields;
  haccpState.tenantId = options.tenantId || haccpState.tenantId;
  haccpState.getFirebase = typeof options.getFirebase === 'function' ? options.getFirebase : haccpState.getFirebase;
  haccpState.playClickSound = typeof options.playClickSound === 'function' ? options.playClickSound : haccpState.playClickSound;
  restoreCleaningPerson();

  if (!haccpState.initialized) {
    bindStaticHaccpControls();
    haccpState.initialized = true;
  }
  document.documentElement.dataset.haccpModule = 'ready';

  restoreHaccpDraft();
  updateHACCPAlerts();
  renderHaccpOperatorSelector();
  renderHaccpDaily();
}

export function startHaccpLiveSync() {
  if (!canStartHaccpFirestoreLiveSync()) return;
  if (!haccpState.db) return;
  loadHaccpDevicesFromCloud();
  loadHaccpLogsFromCloud();
  void seedDefaultHaccpDevicesIfEmpty();
}

export function activateHaccpTab() {
  updateHACCPAlerts();
  renderHaccpOperatorSelector();
  renderHaccpDaily();
}

function resolveHaccpTenantId() {
  return getGlobalTenantId() || haccpState.tenantId || '';
}

function haccpCollectionPath() {
  const tenantId = resolveHaccpTenantId();
  if (!tenantId) return null;
  try {
    return getTenantCollectionPath('haccp_logs');
  } catch {
    return null;
  }
}

function haccpDevicesCollectionPath() {
  const tenantId = resolveHaccpTenantId();
  if (!tenantId) return null;
  try {
    return getTenantCollectionPath('haccp_geraete');
  } catch {
    return null;
  }
}

function serverTimestamp() {
  return haccpState.getFirebase()?.firestore?.FieldValue?.serverTimestamp?.() || new Date().toISOString();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeDomId(value) {
  return String(value || '').replace(/[^A-Za-z0-9_-]/g, '_');
}

function localDateKey(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function isoWeekKey(date = new Date()) {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayNumber = day.getDay() || 7;
  day.setDate(day.getDate() + 4 - dayNumber);
  const yearStart = new Date(day.getFullYear(), 0, 1);
  const week = Math.ceil((((day - yearStart) / 86400000) + 1) / 7);
  return `${day.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function startOfIsoWeek(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayNumber = start.getDay() || 7;
  start.setDate(start.getDate() - dayNumber + 1);
  start.setHours(0, 0, 0, 0);
  return start;
}

function periodKeyForCleaning(group) {
  return group.period === 'week' ? isoWeekKey() : localDateKey();
}

function allCleaningTasks() {
  return HACCP_CLEANING_GROUPS.flatMap((group) =>
    group.tasks.map((task) => ({ ...task, groupId: group.id, groupTitle: group.title, period: group.period }))
  );
}

function cleaningTaskById(taskId) {
  return allCleaningTasks().find((task) => task.id === taskId) || null;
}

function cleaningLogDocId(task, periodKey) {
  return ['cleaning', task.id, periodKey].join('_').replace(/[^A-Za-z0-9_-]/g, '_');
}

function allTemperatureStations() {
  return HACCP_TEMPERATURE_GROUPS.flatMap((group) =>
    group.stations.map((name) => ({
      id: safeDomId(`${group.id}-${name}`).toLowerCase(),
      name,
      groupId: group.id,
      groupTitle: group.title,
      warnAbove: group.warnAbove,
      unit: group.unit || '°C',
      optionalHint: group.optionalDays?.includes(new Date().getDay()) ? group.optionalHint : '',
    }))
  );
}

function temperatureStationById(stationId) {
  return allTemperatureStations().find((station) => station.id === stationId) || null;
}

function temperatureLogDocId(station, dateKey = localDateKey()) {
  return ['temperature', station.id, dateKey].join('_').replace(/[^A-Za-z0-9_-]/g, '_');
}

function entryMatchesTemperatureToday(entry, station) {
  const sameStation = entry.facility === station.name || entry.deviceName === station.name || entry.stationId === station.id;
  const isTemperature = entry.type === 'temperature' || entry.logTyp === 'temperatur';
  return isTemperature && sameStation && (entry.datum || '') === localDateKey();
}

function temperatureCompletionForStation(station) {
  return (haccpState.logs || [])
    .filter((entry) => entryMatchesTemperatureToday(entry, station))
    .sort((a, b) => logMomentMillis(b) - logMomentMillis(a))[0] || null;
}

function haccpDeviceDocId(name) {
  return String(name || 'geraet')
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || `geraet-${Date.now()}`;
}

function activeHaccpDevices(type) {
  return haccpState.devices
    .filter((device) => device.aktiv !== false && device.protokollTyp === type)
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'de'));
}

async function seedDefaultHaccpDevicesIfEmpty() {
  if (!canStartHaccpFirestoreLiveSync()) return;
  if (!haccpState.db) return;
  const path = haccpDevicesCollectionPath();
  if (!path) return;
  const snap = await haccpState.db.collection(path).limit(1).get();
  if (!snap.empty) return;
  try {
    const batch = haccpState.db.batch();
    DEFAULT_HACCP_DEVICES.forEach((device) => {
      const ref = haccpState.db.collection(path).doc(haccpDeviceDocId(device.name));
      batch.set(ref, { ...device, tenantId: resolveHaccpTenantId(), createdAt: serverTimestamp() });
    });
    await batch.commit();
  } catch (err) {
    if (maybeResetOnFirestorePermissionError(err, 'HACCP-Save')) return;
    console.warn('[CharcuLogic HACCP] Standard-Geräte konnten nicht geseedet werden:', err);
  }
}

function loadHaccpDevicesFromCloud() {
  if (!canStartHaccpFirestoreLiveSync()) return;
  if (!haccpState.db) return;
  const path = haccpDevicesCollectionPath();
  if (!path) return;
  if (haccpState.devicesUnsubscribe) {
    haccpState.devicesUnsubscribe();
    haccpState.devicesUnsubscribe = null;
  }
  haccpState.devicesUnsubscribe = haccpState.db.collection(path).onSnapshot((snapshot) => {
    haccpState.devices = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    renderHaccpDaily();
  }, (err) => {
    if (maybeResetOnFirestorePermissionError(err, 'HACCP-Save')) return;
    console.error('[CharcuLogic HACCP] Geräte-Sync Fehler:', err);
  });
}

function loadHaccpLogsFromCloud() {
  if (!canStartHaccpFirestoreLiveSync()) return;
  if (!haccpState.db) return;
  const path = haccpCollectionPath();
  if (!path) return;
  if (haccpState.logsUnsubscribe) {
    haccpState.logsUnsubscribe();
    haccpState.logsUnsubscribe = null;
  }
  haccpState.logsUnsubscribe = haccpState.db.collection(path).onSnapshot((snapshot) => {
    haccpState.logs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    renderHaccpDaily();
  }, (err) => {
    if (maybeResetOnFirestorePermissionError(err, 'HACCP-Save')) return;
    console.error('[CharcuLogic HACCP] Protokoll-Sync Fehler:', err);
  });
}

function temperatureStatus(device, value) {
  const temp = Number(value);
  if (!Number.isFinite(temp)) return { ok: false, label: 'Wert fehlt' };
  const minOk = device.sollMin == null || temp >= Number(device.sollMin);
  const maxOk = device.sollMax == null || temp <= Number(device.sollMax);
  return minOk && maxOk ? { ok: true, label: 'OK' } : { ok: false, label: 'Abweichung' };
}

function selectedHaccpPerson() {
  return document.getElementById('haccp-cleaning-person')?.value || haccpState.cleaningDoneBy || '';
}

function isTemperatureTooWarm(value, warnAbove) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || warnAbove == null) return false;
  return numericValue > Number(warnAbove);
}

function requireHaccpDoneBy() {
  const doneBy = String(selectedHaccpPerson() || '').trim();
  if (!doneBy || doneBy === 'Name auswählen' || !HACCP_CLEANING_TEAM.includes(doneBy)) {
    haccpState.showHUD('Hinweis', 'Bitte wähle zuerst oben aus, wer die Prüfung durchgeführt hat!', '!');
    return '';
  }
  return doneBy;
}

function createHaccpLogId(entry) {
  if (entry.docId) {
    return String(entry.docId).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120);
  }
  const randomPart = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return [
    entry.logTyp || 'log',
    entry.deviceId || entry.chargenNummer || 'haccp',
    Date.now().toString(36),
    randomPart,
  ].filter(Boolean).join('_').replace(/[^A-Za-z0-9_-]/g, '_');
}

async function saveHaccpLog(entry) {
  const path = haccpCollectionPath();
  if (!path || !haccpState.writeOrQueueFirestore) return;

  const tenantId = resolveHaccpTenantId();
  if (!tenantId) throw new Error('Mandant fehlt — HACCP-Protokoll kann nicht gespeichert werden.');

  const { docId: requestedDocId, ...entryData } = entry;
  const fullEntry = {
    ...entryData,
    tenantId,
    datum: localDateKey(),
  };
  const docId = createHaccpLogId({ ...fullEntry, docId: requestedDocId });
  const nowIso = new Date().toISOString();
  const onlineData = { ...fullEntry, createdAt: serverTimestamp() };
  const queueData = { ...fullEntry, createdAt: nowIso };

  if ((fullEntry.type === 'cleaning' || fullEntry.type === 'temperature') && fullEntry.timestamp == null) {
    onlineData.timestamp = serverTimestamp();
    queueData.timestamp = nowIso;
  }

  try {
    return await haccpState.writeOrQueueFirestore({
      collectionPath: path,
      docId,
      op: 'set',
      onlineData,
      queueData,
      offlineMessage: "HACCP-Protokoll wird nachträglich synchronisiert.",
    });
  } catch (err) {
    const code = err?.code || '';
    if (code === 'already-exists') {
      console.warn(`[CharcuLogic HACCP] ${code} für ${docId} — bereits vorhanden.`);
      haccpState.showHUD("Bereits erfasst", "Dieser Protokolleintrag existiert bereits auf dem Server.");
      return;
    }
    if (maybeResetOnFirestorePermissionError(err, 'HACCP-Save')) return;
    console.warn('[CharcuLogic HACCP] Speichern fehlgeschlagen:', err);
    throw err;
  }
}

function upsertLocalTemperatureLog(log) {
  const existingIndex = haccpState.logs.findIndex((entry) => entry.id === log.id);
  if (existingIndex >= 0) {
    haccpState.logs[existingIndex] = { ...haccpState.logs[existingIndex], ...log };
  } else {
    haccpState.logs = [...haccpState.logs, log];
  }
  renderHaccpDaily();
}

async function saveTemperatureCheck(stationId) {
  const station = temperatureStationById(stationId);
  if (!station) return;
  if (temperatureCompletionForStation(station)) {
    haccpState.showHUD("Schon eingetragen", "Dieser Wert ist für heute bereits gespeichert.");
    return;
  }
  const value = document.getElementById(`temp-${safeDomId(stationId)}`)?.value;
  const numericValue = Number(value);
  if (value === '' || value == null || !Number.isFinite(numericValue)) {
    haccpState.showHUD("Wert fehlt", "Bitte zuerst die Temperatur eintragen.", "!");
    return;
  }
  const doneBy = requireHaccpDoneBy();
  if (!doneBy) return;
  rememberCleaningPerson(doneBy);
  const status = isTemperatureTooWarm(numericValue, station.warnAbove) ? 'abweichung' : 'ok';
  const docId = temperatureLogDocId(station);
  const nowIso = new Date().toISOString();
  try {
    const result = await saveHaccpLog({
      docId,
      logTyp: 'temperatur',
      type: 'temperature',
      stationId: station.id,
      deviceId: station.id,
      facility: station.name,
      deviceName: station.name,
      doneBy,
      value: numericValue,
      wert: numericValue,
      einheit: station.unit || '°C',
      thresholdMax: station.warnAbove,
      sollMax: station.warnAbove,
      bereich: station.groupTitle,
      status,
      massnahme: '',
    });
    haccpState.onFormSaved([`temp-${safeDomId(stationId)}`]);
    upsertLocalTemperatureLog({
      id: docId,
      logTyp: 'temperatur',
      type: 'temperature',
      stationId: station.id,
      deviceId: station.id,
      facility: station.name,
      deviceName: station.name,
      doneBy,
      value: numericValue,
      wert: numericValue,
      einheit: station.unit || '°C',
      thresholdMax: station.warnAbove,
      sollMax: station.warnAbove,
      bereich: station.groupTitle,
      status,
      tenantId: resolveHaccpTenantId(),
      datum: localDateKey(),
      timestamp: nowIso,
      createdAt: nowIso,
    });
    if (result === 'queued') {
      haccpState.showHUD("Lokal vorgemerkt", "Wird automatisch synchronisiert, sobald WLAN verfügbar ist.");
      return;
    }
    haccpState.showHUD(status === 'ok' ? "Temperatur gespeichert" : "Wert gespeichert", `${station.name}: ${value} ${station.unit || '°C'}`);
  } catch (err) {
    const code = err?.code || '';
    if (code === 'already-exists') {
      haccpState.onFormSaved([`temp-${safeDomId(stationId)}`]);
      haccpState.showHUD("Bereits erfasst", "Dieser Messwert existiert bereits auf dem Server.");
      return;
    }
    if (maybeResetOnFirestorePermissionError(err, 'HACCP-Save')) return;
    console.error('[CharcuLogic HACCP] Temperatur speichern fehlgeschlagen:', err);
    haccpState.showHUD("Hat nicht geklappt", "Temperatur konnte nicht gespeichert werden. Bitte gleich noch einmal versuchen.", "!");
  }
}

async function saveLegacyTemperatureCheck(deviceId) {
  const device = haccpState.devices.find((entry) => entry.id === deviceId);
  if (!device) return;
  const value = document.getElementById(`temp-${safeDomId(deviceId)}`)?.value;
  const note = document.getElementById(`note-${safeDomId(deviceId)}`)?.value || '';
  const doneBy = requireHaccpDoneBy();
  if (!doneBy) return;
  const status = temperatureStatus(device, value);
  try {
    const result = await saveHaccpLog({
      logTyp: 'temperatur',
      deviceId,
      deviceName: device.name,
      doneBy,
      bereich: device.bereich || '',
      wert: Number(value),
      einheit: device.einheit || '°C',
      sollMin: device.sollMin ?? null,
      sollMax: device.sollMax ?? null,
      status: status.ok ? 'ok' : 'abweichung',
      massnahme: note,
    });
    haccpState.onFormSaved([`temp-${safeDomId(deviceId)}`, `note-${safeDomId(deviceId)}`]);
    if (result === 'queued') {
      haccpState.showHUD("Lokal vorgemerkt", "Wird automatisch synchronisiert, sobald WLAN verfügbar ist.");
      return;
    }
    haccpState.showHUD(status.ok ? "Temperatur geprüft" : "Abweichung gespeichert", `${device.name}: ${value} ${device.einheit || '°C'}`);
  } catch (err) {
    const code = err?.code || '';
    if (code === 'already-exists') {
      haccpState.onFormSaved([`temp-${safeDomId(deviceId)}`, `note-${safeDomId(deviceId)}`]);
      haccpState.showHUD("Bereits erfasst", "Dieser Messwert existiert bereits auf dem Server.");
      return;
    }
    if (maybeResetOnFirestorePermissionError(err, 'HACCP-Save')) return;
    console.error('[CharcuLogic HACCP] Temperatur speichern fehlgeschlagen:', err);
    haccpState.showHUD("Hat nicht geklappt", "Temperatur konnte nicht gespeichert werden. Bitte gleich noch einmal versuchen.", "!");
  }
}

function entryMatchesCleaningPeriod(entry, task, group) {
  const periodKey = periodKeyForCleaning(group);
  const sameTask = entry.taskId === task.id || entry.task === task.name || entry.deviceName === task.name;
  const isCleaning = entry.type === 'cleaning' || entry.logTyp === 'reinigung';
  if (!isCleaning || !sameTask) return false;
  if (entry.periodKey) return entry.periodKey === periodKey;

  if (group.period === 'week') {
    const millis = logMomentMillis(entry);
    return millis >= startOfIsoWeek().getTime();
  }
  return (entry.datum || '') === localDateKey();
}

function cleaningCompletionForTask(task, group) {
  return (haccpState.logs || [])
    .filter((entry) => entryMatchesCleaningPeriod(entry, task, group))
    .sort((a, b) => logMomentMillis(b) - logMomentMillis(a))[0] || null;
}

function upsertLocalCleaningLog(log) {
  const existingIndex = haccpState.logs.findIndex((entry) => entry.id === log.id);
  if (existingIndex >= 0) {
    haccpState.logs[existingIndex] = { ...haccpState.logs[existingIndex], ...log };
  } else {
    haccpState.logs = [...haccpState.logs, log];
  }
  if (haccpState.mode === 'reinigung') renderHaccpDaily();
}

async function saveCleaningCheck(taskId) {
  const task = cleaningTaskById(taskId);
  const group = HACCP_CLEANING_GROUPS.find((entry) => entry.id === task?.groupId);
  if (!task || !group) return;
  if (cleaningCompletionForTask(task, group)) {
    haccpState.showHUD("Schon erledigt", "Dieser Punkt ist bereits abgehakt.");
    return;
  }

  const selectedPerson = requireHaccpDoneBy();
  if (!selectedPerson) return;

  rememberCleaningPerson(selectedPerson);
  const periodKey = periodKeyForCleaning(group);
  const docId = cleaningLogDocId(task, periodKey);
  const nowIso = new Date().toISOString();
  const payload = {
    docId,
    logTyp: 'reinigung',
    type: 'cleaning',
    taskId: task.id,
    task: task.name,
    doneBy: selectedPerson,
    periodType: group.period,
    periodKey,
    deviceName: task.name,
    bereich: group.title,
    status: 'erledigt',
    massnahme: selectedPerson,
  };

  try {
    const result = await saveHaccpLog(payload);
    upsertLocalCleaningLog({
      ...payload,
      id: docId,
      tenantId: resolveHaccpTenantId(),
      datum: localDateKey(),
      timestamp: nowIso,
      createdAt: nowIso,
    });
    if (result === 'queued') {
      haccpState.showHUD("Lokal vorgemerkt", "Wird automatisch synchronisiert, sobald WLAN verfÃ¼gbar ist.");
      return;
    }
    haccpState.showHUD("Reinigung erfasst", `${task.name} ist abgehakt.`);
  } catch (err) {
    const code = err?.code || '';
    if (code === 'already-exists') {
      haccpState.showHUD("Bereits erfasst", "Dieses Reinigungsprotokoll existiert bereits auf dem Server.");
      return;
    }
    if (maybeResetOnFirestorePermissionError(err, 'HACCP-Save')) return;
    console.error('[CharcuLogic HACCP] Reinigung speichern fehlgeschlagen:', err);
    haccpState.showHUD("Hat nicht geklappt", "Reinigung konnte nicht gespeichert werden. Bitte gleich noch einmal versuchen.", "!");
  }
}

async function saveLegacyCleaningCheck(deviceId) {
  const device = haccpState.devices.find((entry) => entry.id === deviceId);
  if (!device) return;
  const note = document.getElementById(`clean-note-${safeDomId(deviceId)}`)?.value || '';
  try {
    const result = await saveHaccpLog({
      logTyp: 'reinigung',
      deviceId,
      deviceName: device.name,
      bereich: device.bereich || '',
      status: 'erledigt',
      massnahme: note,
    });
    haccpState.onFormSaved([`clean-note-${safeDomId(deviceId)}`]);
    if (result === 'queued') {
      haccpState.showHUD("Lokal vorgemerkt", "Wird automatisch synchronisiert, sobald WLAN verfügbar ist.");
      return;
    }
    haccpState.showHUD("Reinigung erfasst", `${device.name} wurde dokumentiert.`);
  } catch (err) {
    const code = err?.code || '';
    if (code === 'already-exists') {
      haccpState.onFormSaved([`clean-note-${safeDomId(deviceId)}`]);
      haccpState.showHUD("Bereits erfasst", "Dieses Reinigungsprotokoll existiert bereits auf dem Server.");
      return;
    }
    if (maybeResetOnFirestorePermissionError(err, 'HACCP-Save')) return;
    console.error('[CharcuLogic HACCP] Reinigung speichern fehlgeschlagen:', err);
    haccpState.showHUD("Hat nicht geklappt", "Reinigung konnte nicht gespeichert werden. Bitte gleich noch einmal versuchen.", "!");
  }
}

function deactivateHaccpDevice(deviceId) {
  haccpState.verifyAdminAction(async () => {
    try {
      const path = haccpDevicesCollectionPath();
      if (!path || !haccpState.writeOrQueueFirestore) return;
      const nowIso = new Date().toISOString();
      await haccpState.writeOrQueueFirestore({
        collectionPath: path,
        docId: deviceId,
        onlineData: { aktiv: false, updatedAt: serverTimestamp() },
        queueData: { aktiv: false, updatedAt: nowIso },
        offlineMessage: "Änderung wird nachträglich synchronisiert.",
      });
      haccpState.showHUD("Deaktiviert", "Kühlstelle oder Aufgabe wurde deaktiviert.");
    } catch (err) {
      if (maybeResetOnFirestorePermissionError(err, 'HACCP-Save')) return;
      console.error('[CharcuLogic HACCP] Deaktivieren fehlgeschlagen:', err);
      haccpState.showHUD("Hat nicht geklappt", "Kühlstelle oder Aufgabe konnte nicht deaktiviert werden. Bitte im Büro prüfen.", "!");
    }
  });
}

function addHaccpDeviceFromForm() {
  const path = haccpDevicesCollectionPath();
  if (!path || !haccpState.writeOrQueueFirestore) {
    haccpState.showHUD("Offline", "Einrichten klappt erst wieder mit Verbindung.", "!");
    return;
  }
  const name = document.getElementById('haccp-device-name')?.value.trim();
  if (!name) {
    haccpState.showHUD("Name fehlt", "Bitte Kühlstelle oder Aufgabe eintragen.", "!");
    return;
  }
  haccpState.verifyAdminAction(async () => {
    const protokollTyp = document.getElementById('haccp-device-type')?.value || 'temperatur';
    const bereich = document.getElementById('haccp-device-area')?.value.trim() || 'Hofladen';
    const sollMinRaw = document.getElementById('haccp-device-min')?.value;
    const sollMaxRaw = document.getElementById('haccp-device-max')?.value;
    const payload = {
      name,
      protokollTyp,
      bereich,
      geraeteTyp: protokollTyp === 'temperatur' ? 'kuehlung' : 'geraet',
      sollMin: sollMinRaw === '' ? null : Number(sollMinRaw),
      sollMax: sollMaxRaw === '' ? null : Number(sollMaxRaw),
      einheit: protokollTyp === 'temperatur' ? '°C' : '',
      intervall: protokollTyp === 'temperatur' ? 'taeglich' : 'nach_benutzung',
      aktiv: true,
      tenantId: resolveHaccpTenantId(),
    };
    try {
      await haccpState.writeOrQueueFirestore({
        collectionPath: path,
        docId: haccpDeviceDocId(name),
        op: 'set',
        onlineData: { ...payload, updatedAt: serverTimestamp() },
        queueData: { ...payload, updatedAt: new Date().toISOString() },
        offlineMessage: "Kühlstelle oder Aufgabe wird nachträglich synchronisiert.",
      });
      haccpState.showHUD("Gespeichert", `${name} ist für HACCP eingerichtet.`);
      ['haccp-device-name', 'haccp-device-area', 'haccp-device-min', 'haccp-device-max'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
    } catch (err) {
      if (maybeResetOnFirestorePermissionError(err, 'HACCP-Save')) return;
      console.error('[CharcuLogic HACCP] Gerät anlegen fehlgeschlagen:', err);
      haccpState.showHUD("Hat nicht geklappt", "Kühlstelle oder Aufgabe konnte nicht gespeichert werden.", "!");
    }
  });
}

function restoreHaccpDraftFields() {
  const container = document.getElementById('haccp-daily-container');
  if (!container) return;
  const fieldIds = Array.from(container.querySelectorAll('input, textarea, select'))
    .map((el) => el.id)
    .filter(Boolean);
  fieldIds.push('haccp-ph', 'haccp-temp', 'haccp-batch');
  haccpState.restoreDraftFields(fieldIds);
}

function renderHaccpPersonPicker() {
  const selected = haccpState.cleaningDoneBy;
  return `
    <div class="haccp-cleaning-person">
      <label class="haccp-cleaning-person-label" for="haccp-cleaning-person">Wer trägt gerade ein?</label>
      <select id="haccp-cleaning-person" class="input-text-touch haccp-cleaning-select" aria-label="Name auswählen">
        <option value="">Name auswählen</option>
        ${HACCP_CLEANING_TEAM.map((name) => `<option value="${escapeHtml(name)}"${selected === name ? ' selected' : ''}>${escapeHtml(name)}</option>`).join('')}
      </select>
    </div>
  `;
}

function renderHaccpOperatorSelector() {
  const container = document.getElementById('haccp-operator-container');
  if (!container) return;
  container.innerHTML = renderHaccpPersonPicker();
  bindHaccpPersonPicker(container);
}

function cleaningDoneText(entry) {
  if (!entry) return 'Abhaken';
  return entry.doneBy ? `Erledigt: ${entry.doneBy}` : 'Erledigt';
}

function renderCleaningTaskButton(task, group) {
  const completion = cleaningCompletionForTask(task, group);
  const done = Boolean(completion);
  return `
    <button
      type="button"
      class="haccp-cleaning-check${done ? ' haccp-cleaning-check--done' : ''}"
      data-haccp-save-clean="${escapeHtml(task.id)}"
      aria-pressed="${done ? 'true' : 'false'}"
      ${done ? 'disabled' : ''}>
      <span class="haccp-cleaning-check-icon" aria-hidden="true">${done ? '✓' : ''}</span>
      <span class="haccp-cleaning-check-main">
        <span class="haccp-cleaning-check-title">${escapeHtml(task.name)}</span>
        <span class="haccp-cleaning-check-state">${escapeHtml(cleaningDoneText(completion))}</span>
      </span>
    </button>
  `;
}

function renderCleaningChecks() {
  return `
    <div class="haccp-daily-intro">
      <strong>Reinigung</strong>
      <span>Wir haken nur ab, was heute dran ist oder nach Benutzung erledigt wurde.</span>
    </div>
    <div class="haccp-cleaning-groups">
      ${HACCP_CLEANING_GROUPS.map((group) => `
        <section class="haccp-cleaning-group" aria-label="${escapeHtml(group.title)}">
          <div class="haccp-cleaning-group-title">${escapeHtml(group.title)}</div>
          <div class="haccp-cleaning-group-list">
            ${group.tasks.map((task) => renderCleaningTaskButton(task, group)).join('')}
          </div>
        </section>
      `).join('')}
    </div>
  `;
}

function temperatureDoneText(entry, station) {
  if (!entry) return `Gut bis ${station.warnAbove} ${station.unit || '°C'}`;
  const value = entry.value != null ? entry.value : entry.wert;
  const unit = entry.einheit || station.unit || '°C';
  return `Heute gespeichert: ${value} ${unit}`;
}

function renderTemperatureStationCard(station) {
  const completion = temperatureCompletionForStation(station);
  const done = Boolean(completion);
  const warnId = `temp-warn-${safeDomId(station.id)}`;
  return `
    <div class="haccp-task-card${done ? ' haccp-task-card--done' : ''}">
      <div class="haccp-task-title">${escapeHtml(station.name)}</div>
      <div class="haccp-task-meta">
        ${escapeHtml(temperatureDoneText(completion, station))}
        ${station.optionalHint ? `<span class="haccp-temp-optional">${escapeHtml(station.optionalHint)}</span>` : ''}
      </div>
      <div class="haccp-task-actions">
        <input
          id="temp-${safeDomId(station.id)}"
          type="number"
          inputmode="decimal"
          class="input-text-touch haccp-temp-input"
          step="0.1"
          min="-40"
          placeholder="Messwert in ${escapeHtml(station.unit || '°C')}"
          data-haccp-temp-input="${escapeHtml(station.id)}"
          ${done ? `value="${escapeHtml(completion.value != null ? completion.value : completion.wert)}" disabled` : ''}>
        <button
          class="btn btn-primary haccp-save-wide"
          type="button"
          data-haccp-save-temp="${escapeHtml(station.id)}"
          ${done ? 'disabled' : ''}>${done ? '✓ Gespeichert' : 'Speichern'}</button>
      </div>
      <div class="haccp-team-warn" id="${warnId}" role="status" aria-live="polite" hidden>Wert erhöht. Bitte Kühlung prüfen.</div>
    </div>
  `;
}

function renderTemperatureChecks() {
  return `
    <div class="haccp-daily-intro">
      <strong>Kühlstellen im Verkauf</strong>
      <span>Wir tragen die Werte unserer Kühlstellen ein. Bereits gespeicherte Werte bleiben für heute abgehakt.</span>
    </div>
    <div class="haccp-temp-groups">
      ${HACCP_TEMPERATURE_GROUPS.map((group) => `
        <section class="haccp-temp-group" aria-label="${escapeHtml(group.title)}">
          <div class="haccp-cleaning-group-title">${escapeHtml(group.title)}</div>
          <div class="haccp-task-list">
            ${allTemperatureStations()
              .filter((station) => station.groupId === group.id)
              .map(renderTemperatureStationCard)
              .join('')}
          </div>
        </section>
      `).join('')}
    </div>
  `;
}

function renderHaccpDaily() {
  const container = document.getElementById('haccp-daily-container');
  if (!container) return;

  if (haccpState.mode === 'temperatur') {
    container.innerHTML = renderTemperatureChecks();
    bindRenderedHaccpActions(container);
    restoreHaccpDraftFields();
    return;

    const devices = activeHaccpDevices('temperatur');
    container.innerHTML = `
      <div class="haccp-daily-intro">
        <strong>Kühlstellen</strong>
        <span>Wir tragen nur die fälligen Werte ein. Bei Abweichung notieren wir kurz die Maßnahme.</span>
      </div>
      <div class="haccp-task-list">
        ${devices.length ? devices.map((device) => `
          <div class="haccp-task-card">
            <div class="haccp-task-title">${escapeHtml(device.name)}</div>
            <div class="haccp-task-meta">${escapeHtml(device.bereich || '')} · Soll: ${device.sollMin ?? 'offen'} bis ${device.sollMax ?? 'offen'} ${escapeHtml(device.einheit || '°C')}</div>
            <div class="haccp-task-actions">
              <input id="temp-${safeDomId(device.id)}" type="number" inputmode="decimal" class="input-text-touch" step="0.1" placeholder="Messwert in ${escapeHtml(device.einheit || '°C')}">
              <button class="btn btn-primary haccp-save-wide" type="button" data-haccp-save-temp="${escapeHtml(device.id)}">Speichern</button>
            </div>
            <input id="note-${safeDomId(device.id)}" class="input-text-touch" style="margin-top:8px;height:48px;font-size:14px;" placeholder="Maßnahme bei Abweichung">
          </div>
        `).join('') : '<div class="batch-empty-hint">Noch keine Kühlstellen eingerichtet.</div>'}
      </div>
    `;
    bindRenderedHaccpActions(container);
    restoreHaccpDraftFields();
    return;
  }

  if (haccpState.mode === 'reinigung') {
    container.innerHTML = renderCleaningChecks();
    bindRenderedHaccpActions(container);
    restoreHaccpDraftFields();
    return;
  }

  container.innerHTML = `
    <div class="haccp-device-form">
      <div class="haccp-setup-note">
        <strong>Kühlstellen & Aufgaben einrichten</strong>
        <span>Nur ändern, wenn im Laden oder in der Produktion etwas neu dazukommt. Die Tageskontrolle bleibt vorne.</span>
      </div>
      <input id="haccp-device-name" class="input-text-touch" placeholder="Kühlstelle oder Aufgabe">
      <div class="batch-input-grid">
        <select id="haccp-device-type" class="input-text-touch">
          <option value="temperatur">Temperatur</option>
          <option value="reinigung">Reinigung</option>
        </select>
        <input id="haccp-device-area" class="input-text-touch" placeholder="Bereich">
      </div>
      <div class="batch-input-grid">
        <input id="haccp-device-min" type="number" class="input-text-touch" step="0.1" placeholder="Soll min">
        <input id="haccp-device-max" type="number" class="input-text-touch" step="0.1" placeholder="Soll max">
      </div>
      <button class="btn btn-primary" type="button" id="btn-add-haccp-device">Einrichtung speichern</button>
      <div class="utility-list">
        ${haccpState.devices.map((device) => `
          <div class="utility-row">
            <div class="utility-row-title">${escapeHtml(device.name)}</div>
            <div class="utility-row-meta">${escapeHtml(device.protokollTyp || '')} · ${escapeHtml(device.bereich || '')} · ${device.aktiv === false ? 'inaktiv' : 'aktiv'}</div>
            ${device.aktiv === false ? '' : `<div class="utility-row-actions"><button class="btn-danger-small" type="button" data-haccp-deactivate="${escapeHtml(device.id)}">Deaktivieren</button></div>`}
          </div>
        `).join('')}
      </div>
    </div>
  `;
  document.getElementById('btn-add-haccp-device')?.addEventListener('click', addHaccpDeviceFromForm);
  bindRenderedHaccpActions(container);
}

function bindHaccpPersonPicker(container) {
  container.querySelector('#haccp-cleaning-person')?.addEventListener('change', (event) => {
    rememberCleaningPerson(event.target.value);
    renderHaccpDaily();
  });
}

function updateHaccpTemperatureWarning(stationId) {
  const station = temperatureStationById(stationId);
  const input = document.getElementById(`temp-${safeDomId(stationId)}`);
  const warn = document.getElementById(`temp-warn-${safeDomId(stationId)}`);
  if (!station || !input || !warn) return;
  const hasValue = input.value !== '' && Number.isFinite(Number(input.value));
  const tooWarm = hasValue && isTemperatureTooWarm(input.value, station.warnAbove);
  input.classList.toggle('haccp-input--warn', tooWarm);
  warn.hidden = !tooWarm;
}

function bindRenderedHaccpActions(container) {
  container.querySelectorAll('[data-haccp-save-clean]').forEach((button) => {
    button.addEventListener('click', () => saveCleaningCheck(button.dataset.haccpSaveClean));
  });
  container.querySelectorAll('[data-haccp-temp-input]').forEach((input) => {
    updateHaccpTemperatureWarning(input.dataset.haccpTempInput);
  });
  container.querySelectorAll('[data-haccp-deactivate]').forEach((button) => {
    button.addEventListener('click', () => deactivateHaccpDevice(button.dataset.haccpDeactivate));
  });
}

function bindStaticHaccpControls() {
  const dailyContainer = document.getElementById('haccp-daily-container');
  if (dailyContainer && dailyContainer.dataset.haccpDelegated !== '1') {
    dailyContainer.dataset.haccpDelegated = '1';
    dailyContainer.addEventListener('click', (event) => {
      const saveBtn = event.target.closest('[data-haccp-save-temp]');
      if (saveBtn?.dataset.haccpSaveTemp) {
        saveTemperatureCheck(saveBtn.dataset.haccpSaveTemp);
      }
    });
    dailyContainer.addEventListener('input', (event) => {
      const input = event.target.closest('[data-haccp-temp-input]');
      if (input?.dataset.haccpTempInput) {
        updateHaccpTemperatureWarning(input.dataset.haccpTempInput);
      }
    });
  }

  document.querySelectorAll('.haccp-mode-tab').forEach((button) => {
    button.addEventListener('click', () => {
      haccpState.mode = button.dataset.haccpMode || 'temperatur';
      document.querySelectorAll('.haccp-mode-tab').forEach((entry) => entry.classList.remove('active-haccp-mode'));
      button.classList.add('active-haccp-mode');
      renderHaccpDaily();
    });
  });

  const sliderPh = document.getElementById('haccp-ph');
  const sliderTemp = document.getElementById('haccp-temp');
  sliderPh?.addEventListener('input', () => {
    haccpState.playClickSound(1000 + (parseFloat(sliderPh.value) * 100), 0.015, 0.05);
    updateHACCPAlerts();
    saveHaccpDraft();
  });
  sliderTemp?.addEventListener('input', () => {
    haccpState.playClickSound(800 + (parseFloat(sliderTemp.value) * 4), 0.015, 0.05);
    updateHACCPAlerts();
    saveHaccpDraft();
  });
  document.getElementById('haccp-batch')?.addEventListener('input', saveHaccpDraft);

  const btnBatchGen = document.getElementById('btn-batch-generate');
  const inputBatch = document.getElementById('haccp-batch');
  btnBatchGen?.addEventListener('click', () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const randomChar = chars.charAt(Math.floor(Math.random() * chars.length));
    const now = new Date();
    const dateStr = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
    if (inputBatch) {
      inputBatch.value = `CH-${dateStr}-${randomChar}`;
      haccpState.showHUD("⚡ Generiert", `Kombination: ${inputBatch.value}`);
    }
    haccpState.playClickSound(1300, 0.04, 0.15);
  });

  document.getElementById('btn-submit-haccp')?.addEventListener('click', async () => {
    haccpState.playClickSound(1100, 0.12, 0.25);
    const ph = parseFloat(document.getElementById('haccp-ph')?.value);
    const temperatur = parseFloat(document.getElementById('haccp-temp')?.value);
    const chargenNummer = document.getElementById('haccp-batch')?.value.trim();
    const doneBy = selectedHaccpPerson();
    try {
      const result = await saveHaccpLog({
        logTyp: 'protokoll',
        ph,
        temperatur,
        chargenNummer,
        ...(HACCP_CLEANING_TEAM.includes(doneBy) ? { doneBy } : {}),
      });
      clearHaccpDraft();
      haccpState.onFormSaved(['haccp-ph', 'haccp-temp', 'haccp-batch']);
      if (result === 'queued') {
        haccpState.showHUD("Lokal vorgemerkt", "Wird automatisch synchronisiert, sobald WLAN verfügbar ist.");
        return;
      }
      haccpState.showHUD("📝 HACCP erfasst", `Charge ${chargenNummer} dokumentiert.`);
    } catch (err) {
      if (maybeResetOnFirestorePermissionError(err, 'HACCP-Save')) return;
      console.error('[CharcuLogic HACCP] Protokoll speichern fehlgeschlagen:', err);
      haccpState.showHUD("Hat nicht geklappt", "Protokoll konnte nicht gespeichert werden. Bitte gleich noch einmal versuchen.", "!");
    }
  });

  document.getElementById('btn-haccp-print')?.addEventListener('click', generateHaccpPrintView);
}

function updateHACCPAlerts() {
  const sliderPh = document.getElementById('haccp-ph');
  const sliderTemp = document.getElementById('haccp-temp');
  const badgePh = document.getElementById('ph-badge');
  const badgeTemp = document.getElementById('temp-badge');
  const alertBox = document.getElementById('haccp-alert-box');
  const alertTitle = document.getElementById('haccp-alert-title');
  const alertDesc = document.getElementById('haccp-alert-desc');
  if (!sliderPh || !sliderTemp || !badgePh || !badgeTemp || !alertBox || !alertTitle || !alertDesc) return;

  const ph = parseFloat(sliderPh.value);
  const temp = parseFloat(sliderTemp.value);

  badgePh.textContent = ph.toFixed(2).replace('.', ',');
  badgeTemp.textContent = `${temp.toFixed(1).replace('.', ',')} °C`;

  let hasAlert = false;
  let title = "";
  let desc = "";
  let isDanger = false;

  if (ph < 5.30) {
    hasAlert = true;
    title = "🚨 pH-Wert Warnung (PSE-Fleisch)";
    desc = "PSE-Gefahr! Der pH-Wert ist kritisch sauer. Fleisch verliert extrem viel Saft, wässrige Konsistenz. Ungeeignet für Brühwurst!";
    isDanger = true;
  } else if (ph > 6.20) {
    hasAlert = true;
    title = "🚨 pH-Wert Warnung (DFD-Fleisch)";
    desc = "DFD-Gefahr! Fleisch ist klebrig, dunkel und besitzt verkürzte Haltbarkeit. Erhöhtes Risiko für Keimbildung!";
    isDanger = true;
  } else if (temp > 7.0 && temp < 72.0) {
    hasAlert = true;
    title = "⚠️ Temperatur Warnung (Warmbereich)";
    desc = "Der Temperaturbereich liegt in der mikrobiellen Vermehrungszone. Kerntemperatur muss zügig gekühlt (<7°C) oder durchgegart (>72°C) werden!";
  }

  if (hasAlert) {
    alertBox.classList.add('active');
    alertBox.style.borderColor = isDanger ? 'var(--secondary-color)' : 'var(--warning-color)';
    alertBox.style.backgroundColor = isDanger ? 'rgba(244, 67, 54, 0.08)' : 'rgba(239, 108, 0, 0.08)';
    alertTitle.textContent = title;
    alertTitle.style.color = isDanger ? 'var(--secondary-color)' : 'var(--warning-color)';
    alertDesc.textContent = desc;
  } else {
    alertBox.classList.remove('active');
  }
}

function logMomentMillis(entry) {
  const created = entry?.timestamp || entry?.createdAt;
  if (created) {
    if (typeof created === 'object') {
      if (typeof created.toMillis === 'function') return created.toMillis();
      if (typeof created.seconds === 'number') return created.seconds * 1000;
    }
    const parsed = Date.parse(created);
    if (Number.isFinite(parsed)) return parsed;
  }
  const fromDate = Date.parse(entry?.datum || '');
  return Number.isFinite(fromDate) ? fromDate : 0;
}

function generateHaccpPrintView() {
  const days = 7;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const logs = (haccpState.logs || []).filter((entry) => (entry.datum || '') >= cutoffStr);
  const tempLogs = logs.filter((entry) => entry.logTyp === 'temperatur' || entry.logTyp === 'protokoll');
  const cleanLogs = logs.filter((entry) => entry.logTyp === 'reinigung');

  const formatDate = (date) => {
    if (!date) return '-';
    const parts = String(date).split('-');
    return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : date;
  };

  const tempRows = tempLogs.map((entry) => `
    <tr>
      <td>${formatDate(entry.datum)}</td>
      <td>${escapeHtml(entry.facility || entry.deviceName || entry.chargenNummer || '-')}</td>
      <td>${escapeHtml(entry.bereich || '-')}</td>
      <td>${escapeHtml(entry.value != null ? entry.value : (entry.wert != null ? entry.wert : (entry.temperatur != null ? entry.temperatur : '-')))} ${escapeHtml(entry.einheit || '°C')}</td>
      <td>${escapeHtml(entry.ph != null ? entry.ph : '-')}</td>
      <td class="${entry.status === 'ok' ? 'status-ok' : 'status-warn'}">${escapeHtml(entry.status === 'ok' ? 'OK' : (entry.status || 'Erfasst'))}</td>
      <td>${escapeHtml(entry.massnahme || '-')}</td>
    </tr>`).join('');

  const cleanRows = cleanLogs.map((entry) => `
    <tr>
      <td>${formatDate(entry.datum)}</td>
      <td>${escapeHtml(entry.task || entry.deviceName || '-')}</td>
      <td>${escapeHtml(entry.bereich || '-')}</td>
      <td>${escapeHtml(entry.doneBy || entry.massnahme || '-')}</td>
      <td>${escapeHtml(entry.status || 'Erledigt')}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>HACCP-Protokoll - Druckansicht</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #111; padding: 20mm; }
  h1 { font-size: 16pt; margin-bottom: 4px; }
  .meta { font-size: 10pt; color: #555; margin-bottom: 16px; }
  h2 { font-size: 13pt; margin: 18px 0 6px; border-bottom: 2px solid #2E7D32; padding-bottom: 3px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 10pt; }
  th { background: #E8F5E9; color: #1B5E20; text-align: left; padding: 6px 8px; border: 1px solid #c8e6c9; font-weight: 700; }
  td { padding: 5px 8px; border: 1px solid #ddd; }
  tr:nth-child(even) td { background: #fafafa; }
  .status-ok { color: #2E7D32; font-weight: 700; }
  .status-warn { color: #E65100; font-weight: 700; }
  .footer { margin-top: 30px; font-size: 9pt; color: #888; border-top: 1px solid #ccc; padding-top: 8px; display: flex; justify-content: space-between; }
  .sig-line { margin-top: 40px; display: flex; gap: 60px; }
  .sig-line > div { flex: 1; border-top: 1px solid #333; padding-top: 4px; font-size: 10pt; }
  @media print { body { padding: 15mm; } }
</style>
</head>
<body>
  <h1>HACCP-Protokoll - ${escapeHtml(haccpState.tenantId || 'Betrieb')}</h1>
  <div class="meta">Zeitraum: Letzte ${days} Tage (ab ${formatDate(cutoffStr)}) &middot; Erstellt: ${new Date().toLocaleString('de-DE')}</div>

  <h2>Temperatur- & Messprotokolle (${tempLogs.length} Einträge)</h2>
  ${tempLogs.length ? `<table>
    <thead><tr><th>Datum</th><th>Gerät / Charge</th><th>Bereich</th><th>Temperatur</th><th>pH</th><th>Status</th><th>Maßnahme</th></tr></thead>
    <tbody>${tempRows}</tbody>
  </table>` : '<p style="color:#888;margin:8px 0;">Keine Temperaturprotokolle im Zeitraum.</p>'}

  <h2>Reinigungsprotokolle (${cleanLogs.length} Einträge)</h2>
  ${cleanLogs.length ? `<table>
    <thead><tr><th>Datum</th><th>Aufgabe</th><th>Bereich</th><th>Erledigt von</th><th>Status</th></tr></thead>
    <tbody>${cleanRows}</tbody>
  </table>` : '<p style="color:#888;margin:8px 0;">Keine Reinigungsprotokolle im Zeitraum.</p>'}

  <div class="sig-line">
    <div>Datum / Unterschrift Verantwortlicher</div>
    <div>Datum / Unterschrift Kontrolle</div>
  </div>

  <div class="footer">
    <span>CharcuLogic HACCP-System</span>
    <span>Seite 1</span>
  </div>

  <script>window.onload = () => window.print();</script>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  } else {
    haccpState.showHUD("Popup blockiert", "Bitte Popup-Blocker für diese Seite deaktivieren.", "!");
  }
}
