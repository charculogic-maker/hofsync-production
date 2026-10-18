// ARCH-GUARD: initHaccp / Live-Sync dürfen kein showTab / showPreferredStartTab triggern.
import { canonicalTenantId, getGlobalTenantId, getTenantCollectionPath } from './tenant-db.js';
import { getTeamEmployees } from './team-config.js';
import {
  ACTIVE_EMPLOYEE_STORAGE_KEY,
  readScopedLocalStorageValue,
  scopedTeamboardStorageKey,
  writeScopedLocalStorageValue,
} from './teamboard-storage.js';

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
  {
    name: 'Kühlauslage Hofladen',
    bereich: 'Verkauf',
    type: 'manual_temp',
    tempMin: 0,
    tempMax: 7,
    unit: '°C',
    activeDays: null,
    sortOrder: 10,
    isActive: true,
    protokollTyp: 'temperatur',
    geraeteTyp: 'kuehlung',
    sollMin: 0,
    sollMax: 7,
    einheit: '°C',
    intervall: 'taeglich',
    aktiv: true,
  },
  {
    name: 'MoPro-Kühlung',
    bereich: 'Verkauf',
    type: 'manual_temp',
    tempMin: 0,
    tempMax: 7,
    unit: '°C',
    activeDays: null,
    sortOrder: 20,
    isActive: true,
    protokollTyp: 'temperatur',
    geraeteTyp: 'kuehlung',
    sollMin: 0,
    sollMax: 7,
    einheit: '°C',
    intervall: 'taeglich',
    aktiv: true,
  },
  {
    name: 'TK-Truhe',
    bereich: 'Lager',
    type: 'manual_temp',
    tempMin: -24,
    tempMax: -18,
    unit: '°C',
    activeDays: null,
    sortOrder: 30,
    isActive: true,
    protokollTyp: 'temperatur',
    geraeteTyp: 'tk',
    sollMin: -24,
    sollMax: -18,
    einheit: '°C',
    intervall: 'taeglich',
    aktiv: true,
  },
  {
    name: 'Schneidemaschine',
    bereich: 'Produktion',
    type: 'cleaning',
    protokollTyp: 'reinigung',
    geraeteTyp: 'geraet',
    intervall: 'nach_benutzung',
    aktiv: true,
    isActive: true,
    sortOrder: 900,
  },
  {
    name: 'Vakuumierer',
    bereich: 'Produktion',
    type: 'cleaning',
    protokollTyp: 'reinigung',
    geraeteTyp: 'geraet',
    intervall: 'nach_benutzung',
    aktiv: true,
    isActive: true,
    sortOrder: 910,
  },
];

const FLY_PREVENTION_HACCP_DEVICES = [
  {
    name: 'Fliegengitter Verkaufsraum',
    bereich: 'Hofladen',
    type: 'cleaning',
    protokollTyp: 'reinigung',
    geraeteTyp: 'hygiene',
    intervall: 'woechentlich',
    aktiv: true,
    isActive: true,
    sortOrder: 920,
  },
  {
    name: 'UV-Insektenlampe Käse-Theke',
    bereich: 'Hofladen',
    type: 'cleaning',
    protokollTyp: 'reinigung',
    geraeteTyp: 'hygiene',
    intervall: 'woechentlich',
    aktiv: true,
    isActive: true,
    sortOrder: 930,
  },
];

const FLY_PREVENTION_CLEANING_TASK = {
  id: 'fliegengitter-uv-lampen',
  name: 'Fliegengitter & UV-Insektenlampen geprüft',
};

const HACCP_CLEANING_PERSON_KEY = 'charculogic.haccp.cleaning.doneBy';
const WEEKDAY_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const HACCP_BEREICHE = ['Verkauf', 'Lager'];
const HACCP_DEVICE_TYPES = [
  { value: 'manual_temp', label: 'Manuelle Temperatur' },
];

/** StevesHof Pilot: 8 Laden-/Lager-Prüfstellen (kein Obergeschoss). */
const STEVESHOF_STANDARD_TEMP_DEVICES = [
  {
    name: 'Fleischtheke',
    bereich: 'Verkauf',
    type: 'manual_temp',
    tempMin: 0,
    tempMax: 2,
    unit: '°C',
    activeDays: [4, 5, 6],
    sortOrder: 10,
    isActive: true,
  },
  {
    name: 'Käsetheke (SB)',
    bereich: 'Verkauf',
    type: 'manual_temp',
    tempMin: 2,
    tempMax: 7,
    unit: '°C',
    activeDays: null,
    sortOrder: 20,
    isActive: true,
  },
  {
    name: 'SB-Theke Fleisch & Wurst',
    bereich: 'Verkauf',
    type: 'manual_temp',
    tempMin: 0,
    tempMax: 4,
    unit: '°C',
    activeDays: null,
    sortOrder: 30,
    isActive: true,
  },
  {
    name: 'SB-Kühlschrank Frische & MoPro',
    bereich: 'Verkauf',
    type: 'manual_temp',
    tempMin: 2,
    tempMax: 6,
    unit: '°C',
    activeDays: null,
    sortOrder: 40,
    isActive: true,
  },
  {
    name: 'SB-TK Obst & Eis',
    bereich: 'Verkauf',
    type: 'manual_temp',
    tempMin: -24,
    tempMax: -18,
    unit: '°C',
    activeDays: null,
    sortOrder: 50,
    isActive: true,
  },
  {
    name: 'SB-TK Gemüse',
    bereich: 'Verkauf',
    type: 'manual_temp',
    tempMin: -24,
    tempMax: -18,
    unit: '°C',
    activeDays: null,
    sortOrder: 60,
    isActive: true,
  },
  {
    name: 'SB-TK Fleisch, Pizza & Brot',
    bereich: 'Verkauf',
    type: 'manual_temp',
    tempMin: -24,
    tempMax: -18,
    unit: '°C',
    activeDays: null,
    sortOrder: 70,
    isActive: true,
  },
  {
    name: 'Lager-TK-Truhe Aufbackbrötchen',
    bereich: 'Lager',
    type: 'manual_temp',
    tempMin: -22,
    tempMax: -16,
    unit: '°C',
    activeDays: null,
    sortOrder: 80,
    isActive: true,
  },
];

function getCleaningTeam() {
  const fromTeam = getTeamEmployees()
    .map((name) => String(name || '').trim())
    .filter(Boolean);
  return fromTeam.length ? fromTeam : ['Mitarbeiter 1', 'Mitarbeiter 2'];
}

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
  /** @type {Record<string, { value: number|null, note: string }>} */
  roundEntries: {},
  editingDeviceId: '',
  seedingStevesHof: false,
  devicesUnsubscribe: null,
  logsUnsubscribe: null,
  initialized: false,
};

function restoreCleaningPerson() {
  if (haccpState.cleaningDoneBy) return;
  try {
    const stored = localStorage.getItem(HACCP_CLEANING_PERSON_KEY)
      || readScopedLocalStorageValue(ACTIVE_EMPLOYEE_STORAGE_KEY, resolveHaccpTenantId())
      || '';
    haccpState.cleaningDoneBy = getCleaningTeam().includes(stored) ? stored : '';
  } catch (_) { /* noop */ }
}

function rememberCleaningPerson(name) {
  haccpState.cleaningDoneBy = getCleaningTeam().includes(name) ? name : '';
  try {
    if (haccpState.cleaningDoneBy) {
      localStorage.setItem(HACCP_CLEANING_PERSON_KEY, haccpState.cleaningDoneBy);
      writeScopedLocalStorageValue(ACTIVE_EMPLOYEE_STORAGE_KEY, resolveHaccpTenantId(), haccpState.cleaningDoneBy);
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
  renderHaccpOperatorSelector();
  renderHaccpDaily();
}

function resolveHaccpTenantId() {
  return canonicalTenantId(getGlobalTenantId() || haccpState.tenantId);
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
  return resolveHaccpCleaningGroups().flatMap((group) =>
    group.tasks.map((task) => ({ ...task, groupId: group.id, groupTitle: group.title, period: group.period }))
  );
}

function resolveCurrentTenantBranding() {
  const tenantId = getGlobalTenantId()
    || String(haccpState.tenantId || '').trim()
    || (typeof window.resolveEffectiveTenantId === 'function' ? window.resolveEffectiveTenantId() : '');
  if (typeof window.resolveBranding === 'function') {
    return window.resolveBranding(tenantId);
  }
  return window.BRANDING || {};
}

function isAdvancedHaccpFlyUpgradeEnabled() {
  return resolveCurrentTenantBranding()?.advancedKaeseUpgrade === true;
}

function resolveHaccpCleaningGroups() {
  if (!isAdvancedHaccpFlyUpgradeEnabled()) return HACCP_CLEANING_GROUPS;
  return HACCP_CLEANING_GROUPS.map((group) => {
    if (group.id !== 'weekly') return group;
    const hasFlyTask = group.tasks.some((task) => task.id === FLY_PREVENTION_CLEANING_TASK.id);
    if (hasFlyTask) return group;
    return {
      ...group,
      tasks: [
        ...group.tasks,
        { ...FLY_PREVENTION_CLEANING_TASK },
      ],
    };
  });
}

function resolveVisibleHaccpDevices() {
  const cloudDevices = Array.isArray(haccpState.devices) ? haccpState.devices : [];
  if (!isAdvancedHaccpFlyUpgradeEnabled()) return cloudDevices;

  const merged = [...cloudDevices];
  FLY_PREVENTION_HACCP_DEVICES.forEach((device) => {
    const docId = haccpDeviceDocId(device.name);
    const exists = merged.some((entry) => entry.id === docId || entry.name === device.name);
    if (!exists) {
      merged.push({ ...device, id: docId, localFlyFallback: true });
    }
  });
  return merged;
}

function cleaningTaskById(taskId) {
  return allCleaningTasks().find((task) => task.id === taskId) || null;
}

function cleaningLogDocId(task, periodKey) {
  return ['cleaning', task.id, periodKey].join('_').replace(/[^A-Za-z0-9_-]/g, '_');
}

/**
 * Normalisiert Geräte-Dokumente (neues Modell + Legacy-Felder).
 * @param {Record<string, unknown>} raw
 */
function normalizeHaccpDevice(raw = {}) {
  const name = String(raw.name || '').trim();
  const id = String(raw.id || haccpDeviceDocId(name));
  const tempMin = raw.tempMin != null ? Number(raw.tempMin)
    : (raw.sollMin != null ? Number(raw.sollMin) : null);
  const tempMax = raw.tempMax != null ? Number(raw.tempMax)
    : (raw.sollMax != null ? Number(raw.sollMax) : null);
  const unit = String(raw.unit || raw.einheit || '°C');
  let type = String(raw.type || '').trim();
  if (!type) {
    if (raw.protokollTyp === 'reinigung') type = 'cleaning';
    else type = 'manual_temp';
  }
  const isActive = raw.isActive !== false && raw.aktiv !== false;
  let activeDays = null;
  if (Array.isArray(raw.activeDays)) {
    activeDays = raw.activeDays.map((day) => Number(day)).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
  } else if (raw.activeDays === null || raw.activeDays === undefined || raw.activeDays === '') {
    activeDays = null;
  }
  const sortOrder = Number.isFinite(Number(raw.sortOrder)) ? Number(raw.sortOrder) : 999;
  const bereich = String(raw.bereich || 'Verkauf').trim() || 'Verkauf';
  return {
    ...raw,
    id,
    name,
    bereich,
    type,
    tempMin: Number.isFinite(tempMin) ? tempMin : null,
    tempMax: Number.isFinite(tempMax) ? tempMax : null,
    unit,
    activeDays,
    sortOrder,
    isActive,
    protokollTyp: raw.protokollTyp || (type === 'cleaning' ? 'reinigung' : 'temperatur'),
    sollMin: Number.isFinite(tempMin) ? tempMin : (raw.sollMin ?? null),
    sollMax: Number.isFinite(tempMax) ? tempMax : (raw.sollMax ?? null),
    einheit: unit,
    aktiv: isActive,
  };
}

function isTemperatureDeviceType(type) {
  return type === 'manual_temp';
}

function isDeviceRequiredToday(device, day = new Date().getDay()) {
  if (!device?.isActive) return false;
  if (!isTemperatureDeviceType(device.type)) return false;
  if (!Array.isArray(device.activeDays) || device.activeDays.length === 0) return true;
  return device.activeDays.includes(day);
}

function isDeviceRestDay(device, day = new Date().getDay()) {
  if (!device?.isActive || !isTemperatureDeviceType(device.type)) return false;
  if (!Array.isArray(device.activeDays) || device.activeDays.length === 0) return false;
  return !device.activeDays.includes(day);
}

function sortedTemperatureDevices() {
  return resolveVisibleHaccpDevices()
    .map((entry) => normalizeHaccpDevice(entry))
    .filter((device) => device.isActive && isTemperatureDeviceType(device.type) && device.name)
    .sort((a, b) => (a.sortOrder - b.sortOrder) || String(a.name).localeCompare(String(b.name), 'de'));
}

function manualTemperatureDevices({ includeRestDays = false } = {}) {
  return sortedTemperatureDevices()
    .filter((device) => device.type === 'manual_temp')
    .filter((device) => includeRestDays || !isDeviceRestDay(device));
}

function ensureRoundEntry(deviceId) {
  if (!haccpState.roundEntries[deviceId]) {
    haccpState.roundEntries[deviceId] = { value: null, note: '' };
  }
  return haccpState.roundEntries[deviceId];
}

function buildStevesHofDevicePayload(device) {
  const tempMin = device.tempMin != null ? Number(device.tempMin) : null;
  const tempMax = device.tempMax != null ? Number(device.tempMax) : null;
  const docId = haccpDeviceDocId(device.name);
  return {
    id: docId,
    name: device.name,
    bereich: device.bereich,
    type: 'manual_temp',
    tempMin,
    tempMax,
    unit: device.unit || '°C',
    activeDays: Array.isArray(device.activeDays) ? device.activeDays : null,
    sortOrder: device.sortOrder ?? 100,
    isActive: true,
    protokollTyp: 'temperatur',
    geraeteTyp: Number(tempMax) <= -10 ? 'tk' : 'kuehlung',
    sollMin: tempMin,
    sollMax: tempMax,
    einheit: device.unit || '°C',
    intervall: 'taeglich',
    aktiv: true,
    tenantId: resolveHaccpTenantId(),
    seedVersion: 3,
    updatedBy: 'haccp-in-app-seed',
  };
}

function temperatureRoundLogDocId(dateKey = localDateKey()) {
  return ['temperature_round', dateKey].join('_').replace(/[^A-Za-z0-9_-]/g, '_');
}

function temperatureLogDocId(device, dateKey = localDateKey()) {
  return ['temperature', device.id, dateKey].join('_').replace(/[^A-Za-z0-9_-]/g, '_');
}

function entryMatchesTemperatureToday(entry, device) {
  const sameStation = entry.facility === device.name
    || entry.deviceName === device.name
    || entry.stationId === device.id
    || entry.deviceId === device.id;
  const isTemperature = entry.type === 'temperature'
    || entry.logTyp === 'temperatur'
    || entry.type === 'temperature_round'
    || entry.logTyp === 'temperatur_rundgang';
  return isTemperature && sameStation && (entry.datum || '') === localDateKey();
}

function temperatureRoundSavedToday() {
  return (haccpState.logs || [])
    .filter((entry) => (
      (entry.type === 'temperature_round' || entry.logTyp === 'temperatur_rundgang')
      && (entry.datum || '') === localDateKey()
    ))
    .sort((a, b) => logMomentMillis(b) - logMomentMillis(a))[0] || null;
}

function temperatureCompletionForDevice(device) {
  const fromRound = temperatureRoundSavedToday();
  if (fromRound && Array.isArray(fromRound.measurements)) {
    const hit = fromRound.measurements.find((row) => row.deviceId === device.id || row.deviceName === device.name);
    if (hit) return { ...fromRound, ...hit, fromRound: true };
  }
  return (haccpState.logs || [])
    .filter((entry) => entryMatchesTemperatureToday(entry, device) && entry.type !== 'temperature_round' && entry.logTyp !== 'temperatur_rundgang')
    .sort((a, b) => logMomentMillis(b) - logMomentMillis(a))[0] || null;
}

function formatSollRange(device) {
  const unit = device.unit || '°C';
  const min = device.tempMin;
  const max = device.tempMax;
  if (min == null && max == null) return `Soll: — ${unit}`;
  if (min == null) return `Soll: bis ${max} ${unit}`;
  if (max == null) return `Soll: ab ${min} ${unit}`;
  return `Soll: ${min} bis ${max} ${unit}`;
}

function formatActiveDaysLabel(device) {
  if (!Array.isArray(device.activeDays) || device.activeDays.length === 0) return 'Jeden Tag';
  return device.activeDays
    .slice()
    .sort((a, b) => a - b)
    .map((day) => WEEKDAY_LABELS[day] || String(day))
    .join(', ');
}

function tempInRange(device, value) {
  const temp = Number(value);
  if (!Number.isFinite(temp)) return null;
  const minOk = device.tempMin == null || temp >= Number(device.tempMin);
  const maxOk = device.tempMax == null || temp <= Number(device.tempMax);
  return minOk && maxOk;
}

function tempPresetsForDevice(device) {
  const min = Number(device.tempMin);
  const max = Number(device.tempMax);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  const mid = Math.round(((min + max) / 2) * 2) / 2;
  const low = Math.round((min + (max - min) * 0.25) * 2) / 2;
  const high = Math.round((min + (max - min) * 0.75) * 2) / 2;
  return [...new Set([low, mid, high])]
    .filter((value) => value >= min && value <= max)
    .slice(0, 3);
}

function defaultStepperValue(device) {
  const presets = tempPresetsForDevice(device);
  if (presets.length) return presets[Math.floor(presets.length / 2)];
  if (Number.isFinite(Number(device.tempMin)) && Number.isFinite(Number(device.tempMax))) {
    return Math.round(((Number(device.tempMin) + Number(device.tempMax)) / 2) * 2) / 2;
  }
  return 0;
}

function isDeviceCapturedInRound(device) {
  if (isDeviceRestDay(device)) return true;
  const saved = temperatureCompletionForDevice(device);
  if (saved) return true;
  const entry = ensureRoundEntry(device.id);
  return entry.value != null && Number.isFinite(Number(entry.value));
}

function allRequiredDevicesCaptured() {
  return sortedTemperatureDevices()
    .filter((device) => isDeviceRequiredToday(device))
    .every((device) => isDeviceCapturedInRound(device));
}

function readActiveEmployeeName() {
  const selected = selectedHaccpPerson();
  if (selected) return selected;
  try {
    const tenantId = resolveHaccpTenantId();
    const scoped = readScopedLocalStorageValue(ACTIVE_EMPLOYEE_STORAGE_KEY, tenantId);
    if (scoped) return scoped;
    return localStorage.getItem(ACTIVE_EMPLOYEE_STORAGE_KEY) || localStorage.getItem('charculogic.activeEmployee') || '';
  } catch (_) {
    return '';
  }
}

function haccpDeviceDocId(name) {
  return String(name || 'geraet')
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || `geraet-${Date.now()}`;
}

function activeHaccpDevices(type) {
  return resolveVisibleHaccpDevices()
    .filter((device) => device.aktiv !== false && device.protokollTyp === type)
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'de'));
}

function resolveDefaultHaccpDevicesForSeed() {
  if (!isAdvancedHaccpFlyUpgradeEnabled()) return DEFAULT_HACCP_DEVICES;
  return [...DEFAULT_HACCP_DEVICES, ...FLY_PREVENTION_HACCP_DEVICES];
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
    resolveDefaultHaccpDevicesForSeed().forEach((device) => {
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
  const normalized = normalizeHaccpDevice(device);
  const inRange = tempInRange(normalized, value);
  if (inRange == null) return { ok: false, label: 'Wert fehlt' };
  return inRange ? { ok: true, label: 'OK' } : { ok: false, label: 'Abweichung' };
}

function selectedHaccpPerson() {
  return document.getElementById('haccp-cleaning-person')?.value || haccpState.cleaningDoneBy || '';
}

function requireHaccpDoneBy() {
  const doneBy = String(selectedHaccpPerson() || '').trim();
  if (!doneBy || doneBy === 'Name auswählen' || !getCleaningTeam().includes(doneBy)) {
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

function buildMeasurementPayload(device) {
  const restDay = isDeviceRestDay(device);
  const entry = ensureRoundEntry(device.id);
  if (restDay) {
    return {
      deviceId: device.id,
      deviceName: device.name,
      bereich: device.bereich,
      type: device.type,
      wert: null,
      value: null,
      status: 'ruhetag',
      source: 'rest_day',
      tempMin: device.tempMin,
      tempMax: device.tempMax,
      einheit: device.unit || '°C',
      massnahme: 'Ruhetag / Ausgeschaltet',
    };
  }
  const numericValue = Number(entry.value);
  const inRange = tempInRange(device, numericValue);
  return {
    deviceId: device.id,
    deviceName: device.name,
    bereich: device.bereich,
    type: device.type,
    wert: numericValue,
    value: numericValue,
    status: inRange ? 'ok' : 'abweichung',
    source: 'manual',
    tempMin: device.tempMin,
    tempMax: device.tempMax,
    einheit: device.unit || '°C',
    massnahme: entry.note || '',
  };
}

function setRoundTempValue(deviceId, rawValue) {
  const entry = ensureRoundEntry(deviceId);
  if (rawValue === '' || rawValue == null) {
    entry.value = null;
  } else {
    const numeric = Number(rawValue);
    entry.value = Number.isFinite(numeric) ? numeric : null;
  }
}

function stepRoundTemp(deviceId, delta) {
  const device = sortedTemperatureDevices().find((entry) => entry.id === deviceId);
  if (!device) return;
  const entry = ensureRoundEntry(deviceId);
  const current = Number.isFinite(Number(entry.value)) ? Number(entry.value) : defaultStepperValue(device);
  const next = Math.round((current + Number(delta)) * 2) / 2;
  entry.value = next;
  renderHaccpDaily();
}

async function seedStevesHofStandardDevices() {
  const path = haccpDevicesCollectionPath();
  if (!path || !haccpState.writeOrQueueFirestore) {
    haccpState.showHUD('Offline', 'Einrichten klappt erst wieder mit Verbindung.', '!');
    return;
  }
  if (haccpState.seedingStevesHof) return;

  haccpState.verifyAdminAction(async () => {
    haccpState.seedingStevesHof = true;
    try {
      const tenantId = resolveHaccpTenantId();
      if (!tenantId) {
        haccpState.showHUD('Mandant fehlt', 'Bitte zuerst anmelden und den Betrieb wählen.', '!');
        return;
      }
      for (const device of STEVESHOF_STANDARD_TEMP_DEVICES) {
        const payload = buildStevesHofDevicePayload(device);
        await haccpState.writeOrQueueFirestore({
          collectionPath: path,
          docId: payload.id,
          op: 'set',
          onlineData: { ...payload, updatedAt: serverTimestamp(), createdAt: serverTimestamp() },
          queueData: {
            ...payload,
            updatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          },
          offlineMessage: 'StevesHof-Kühlstellen werden nachträglich synchronisiert.',
        });
      }
      haccpState.playClickSound?.();
      haccpState.showHUD(
        'Geräte angelegt',
        `${STEVESHOF_STANDARD_TEMP_DEVICES.length} Laden- und Lager-Kühlstellen sind bereit.`,
      );
      renderHaccpDaily();
    } catch (err) {
      if (maybeResetOnFirestorePermissionError(err, 'HACCP-Save')) return;
      console.error('[CharcuLogic HACCP] StevesHof-Seed fehlgeschlagen:', err);
      haccpState.showHUD('Hat nicht geklappt', 'Standard-Geräte konnten nicht angelegt werden. Bitte Rechte prüfen.', '!');
    } finally {
      haccpState.seedingStevesHof = false;
    }
  });
}

async function saveTemperatureRound() {
  if (temperatureRoundSavedToday()) {
    haccpState.showHUD('Schon erledigt', 'Der Temperatur-Rundgang ist für heute bereits gespeichert.');
    return;
  }
  const devices = sortedTemperatureDevices();
  if (!devices.length) {
    haccpState.showHUD('Keine Kühlstellen', 'Bitte zuerst unter „+“ die Messpunkte einrichten.', '!');
    return;
  }
  if (!allRequiredDevicesCaptured()) {
    haccpState.showHUD('Noch nicht fertig', 'Bitte alle heute aktiven Kühlstellen erfassen.', '!');
    return;
  }
  const doneBy = requireHaccpDoneBy();
  if (!doneBy) return;
  rememberCleaningPerson(doneBy);

  const measurements = devices.map((device) => buildMeasurementPayload(device));

  const dateKey = localDateKey();
  const roundDocId = temperatureRoundLogDocId(dateKey);
  const nowIso = new Date().toISOString();

  try {
    const result = await saveHaccpLog({
      docId: roundDocId,
      logTyp: 'temperatur_rundgang',
      type: 'temperature_round',
      doneBy,
      bereich: 'Tageskontrolle',
      deviceName: 'Temperatur-Rundgang',
      status: measurements.some((row) => row.status === 'abweichung') ? 'abweichung' : 'ok',
      centralControlVerified: false,
      measurements,
      massnahme: '',
    });

    // Einzelwerte für Druckansicht / Tagesübersicht (unveränderlich)
    for (const row of measurements) {
      if (row.source === 'rest_day') continue;
      const device = devices.find((entry) => entry.id === row.deviceId);
      if (!device) continue;
      try {
        await saveHaccpLog({
          docId: temperatureLogDocId(device, dateKey),
          logTyp: 'temperatur',
          type: 'temperature',
          stationId: device.id,
          deviceId: device.id,
          facility: device.name,
          deviceName: device.name,
          doneBy,
          value: row.value,
          wert: row.wert,
          einheit: row.einheit,
          unit: row.einheit,
          tempMin: row.tempMin,
          tempMax: row.tempMax,
          sollMin: row.tempMin,
          sollMax: row.tempMax,
          bereich: device.bereich,
          status: row.status,
          source: row.source,
          massnahme: row.massnahme || '',
        });
      } catch (detailErr) {
        if (detailErr?.code === 'already-exists') continue;
        console.warn('[CharcuLogic HACCP] Einzelwert-Protokoll:', detailErr);
      }
    }

    upsertLocalTemperatureLog({
      id: roundDocId,
      logTyp: 'temperatur_rundgang',
      type: 'temperature_round',
      doneBy,
      bereich: 'Tageskontrolle',
      deviceName: 'Temperatur-Rundgang',
      status: measurements.some((row) => row.status === 'abweichung') ? 'abweichung' : 'ok',
      centralControlVerified: false,
      measurements,
      tenantId: resolveHaccpTenantId(),
      datum: dateKey,
      timestamp: nowIso,
      createdAt: nowIso,
    });
    haccpState.roundEntries = {};

    if (result === 'queued') {
      haccpState.showHUD('Lokal vorgemerkt', 'Wird automatisch synchronisiert, sobald WLAN verfügbar ist.');
      return;
    }
    haccpState.showHUD('Rundgang gespeichert', `${doneBy} hat den Temperatur-Rundgang protokolliert.`);
  } catch (err) {
    const code = err?.code || '';
    if (code === 'already-exists') {
      haccpState.showHUD('Bereits erfasst', 'Dieser Rundgang existiert bereits auf dem Server.');
      return;
    }
    if (maybeResetOnFirestorePermissionError(err, 'HACCP-Save')) return;
    console.error('[CharcuLogic HACCP] Rundgang speichern fehlgeschlagen:', err);
    haccpState.showHUD('Hat nicht geklappt', 'Rundgang konnte nicht gespeichert werden. Bitte gleich noch einmal versuchen.', '!');
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
  const group = resolveHaccpCleaningGroups().find((entry) => entry.id === task?.groupId);
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
  deactivateHaccpDeviceNormalized(deviceId);
}

function readActiveDaysFromForm() {
  const boxes = Array.from(document.querySelectorAll('[data-haccp-active-day]'));
  if (!boxes.length) return null;
  const checked = boxes
    .filter((box) => box.checked)
    .map((box) => Number(box.dataset.haccpActiveDay))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    .sort((a, b) => a - b);
  // Alle oder keine Haken = jeden Tag aktiv
  if (checked.length === 0 || checked.length === 7) return null;
  return checked;
}

function addHaccpDeviceFromForm() {
  const path = haccpDevicesCollectionPath();
  if (!path || !haccpState.writeOrQueueFirestore) {
    haccpState.showHUD('Offline', 'Einrichten klappt erst wieder mit Verbindung.', '!');
    return;
  }
  const name = document.getElementById('haccp-device-name')?.value.trim();
  if (!name) {
    haccpState.showHUD('Name fehlt', 'Bitte Kühlstelle eintragen.', '!');
    return;
  }
  haccpState.verifyAdminAction(async () => {
    const type = document.getElementById('haccp-device-type')?.value || 'manual_temp';
    const bereich = document.getElementById('haccp-device-area')?.value.trim() || 'Verkauf';
    const tempMinRaw = document.getElementById('haccp-device-min')?.value;
    const tempMaxRaw = document.getElementById('haccp-device-max')?.value;
    const sortRaw = document.getElementById('haccp-device-sort')?.value;
    const editingId = haccpState.editingDeviceId || haccpDeviceDocId(name);
    const tempMin = tempMinRaw === '' ? null : Number(tempMinRaw);
    const tempMax = tempMaxRaw === '' ? null : Number(tempMaxRaw);
    const activeDays = readActiveDaysFromForm();
    const payload = {
      id: editingId,
      name,
      bereich,
      type,
      tempMin,
      tempMax,
      unit: '°C',
      activeDays,
      sortOrder: sortRaw === '' || sortRaw == null ? 100 : Number(sortRaw),
      isActive: true,
      protokollTyp: 'temperatur',
      geraeteTyp: Number(tempMax) <= -10 ? 'tk' : 'kuehlung',
      sollMin: tempMin,
      sollMax: tempMax,
      einheit: '°C',
      intervall: 'taeglich',
      aktiv: true,
      tenantId: resolveHaccpTenantId(),
    };
    try {
      await haccpState.writeOrQueueFirestore({
        collectionPath: path,
        docId: editingId,
        op: 'set',
        onlineData: { ...payload, updatedAt: serverTimestamp() },
        queueData: { ...payload, updatedAt: new Date().toISOString() },
        offlineMessage: 'Kühlstelle wird nachträglich synchronisiert.',
      });
      haccpState.showHUD('Gespeichert', `${name} ist für den Temperatur-Rundgang eingerichtet.`);
      haccpState.editingDeviceId = '';
      ['haccp-device-name', 'haccp-device-min', 'haccp-device-max', 'haccp-device-sort'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      document.querySelectorAll('[data-haccp-active-day]').forEach((box) => {
        box.checked = true;
      });
      renderHaccpDaily();
    } catch (err) {
      if (maybeResetOnFirestorePermissionError(err, 'HACCP-Save')) return;
      console.error('[CharcuLogic HACCP] Gerät anlegen fehlgeschlagen:', err);
      haccpState.showHUD('Hat nicht geklappt', 'Kühlstelle konnte nicht gespeichert werden.', '!');
    }
  });
}

function editHaccpDevice(deviceId) {
  const device = resolveVisibleHaccpDevices()
    .map((entry) => normalizeHaccpDevice(entry))
    .find((entry) => entry.id === deviceId);
  if (!device) return;
  haccpState.editingDeviceId = device.id;
  haccpState.mode = 'geraete';
  document.querySelectorAll('.haccp-mode-tab').forEach((entry) => {
    entry.classList.toggle('active-haccp-mode', entry.dataset.haccpMode === 'geraete');
  });
  renderHaccpDaily();
  requestAnimationFrame(() => {
    const nameEl = document.getElementById('haccp-device-name');
    const typeEl = document.getElementById('haccp-device-type');
    const areaEl = document.getElementById('haccp-device-area');
    const minEl = document.getElementById('haccp-device-min');
    const maxEl = document.getElementById('haccp-device-max');
    const sortEl = document.getElementById('haccp-device-sort');
    if (nameEl) nameEl.value = device.name || '';
    if (typeEl) typeEl.value = 'manual_temp';
    if (areaEl) areaEl.value = device.bereich || 'Verkauf';
    if (minEl) minEl.value = device.tempMin == null ? '' : String(device.tempMin);
    if (maxEl) maxEl.value = device.tempMax == null ? '' : String(device.tempMax);
    if (sortEl) sortEl.value = String(device.sortOrder ?? 100);
    const days = Array.isArray(device.activeDays) && device.activeDays.length
      ? device.activeDays
      : [0, 1, 2, 3, 4, 5, 6];
    document.querySelectorAll('[data-haccp-active-day]').forEach((box) => {
      box.checked = days.includes(Number(box.dataset.haccpActiveDay));
    });
  });
}

function deactivateHaccpDeviceNormalized(deviceId) {
  haccpState.verifyAdminAction(async () => {
    try {
      const path = haccpDevicesCollectionPath();
      if (!path || !haccpState.writeOrQueueFirestore) return;
      const nowIso = new Date().toISOString();
      await haccpState.writeOrQueueFirestore({
        collectionPath: path,
        docId: deviceId,
        onlineData: {
          aktiv: false,
          isActive: false,
          updatedAt: serverTimestamp(),
        },
        queueData: {
          aktiv: false,
          isActive: false,
          updatedAt: nowIso,
        },
        offlineMessage: 'Änderung wird nachträglich synchronisiert.',
      });
      haccpState.showHUD('Deaktiviert', 'Kühlstelle wurde deaktiviert.');
    } catch (err) {
      if (maybeResetOnFirestorePermissionError(err, 'HACCP-Save')) return;
      console.error('[CharcuLogic HACCP] Deaktivieren fehlgeschlagen:', err);
      haccpState.showHUD('Hat nicht geklappt', 'Kühlstelle konnte nicht deaktiviert werden. Bitte im Büro prüfen.', '!');
    }
  });
}

function restoreHaccpDraftFields() {
  const container = document.getElementById('haccp-daily-container');
  if (!container) return;
  const fieldIds = Array.from(container.querySelectorAll('input, textarea, select'))
    .map((el) => el.id)
    .filter(Boolean);
  haccpState.restoreDraftFields(fieldIds);
}

function renderHaccpPersonPicker() {
  const selected = haccpState.cleaningDoneBy;
  return `
    <div class="haccp-cleaning-person">
      <label class="haccp-cleaning-person-label" for="haccp-cleaning-person">Wer trägt gerade ein?</label>
      <select id="haccp-cleaning-person" class="input-text-touch haccp-cleaning-select" aria-label="Name auswählen">
        <option value="">Name auswählen</option>
        ${getCleaningTeam().map((name) => `<option value="${escapeHtml(name)}"${selected === name ? ' selected' : ''}>${escapeHtml(name)}</option>`).join('')}
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
      ${resolveHaccpCleaningGroups().map((group) => `
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

function renderAmpelClass(inRange) {
  if (inRange == null) return '';
  return inRange ? ' haccp-task-card--ampel-ok' : ' haccp-task-card--ampel-bad';
}

function renderStevesHofSeedButton({ prominent = false } = {}) {
  const busy = haccpState.seedingStevesHof;
  return `
    <button
      type="button"
      class="btn btn-primary haccp-seed-btn${prominent ? ' haccp-seed-btn--prominent' : ''}"
      data-haccp-seed-steveshof="1"
      ${busy ? 'disabled' : ''}>
      ${busy ? 'Wird angelegt…' : '⚡ StevesHof Standard-Geräte initial anlegen'}
    </button>
  `;
}

function renderManualDeviceCard(device, { locked = false } = {}) {
  const completion = temperatureCompletionForDevice(device);
  const entry = ensureRoundEntry(device.id);
  const value = completion
    ? (completion.value != null ? completion.value : completion.wert)
    : entry.value;
  const hasValue = value != null && value !== '' && Number.isFinite(Number(value));
  const inRange = hasValue ? tempInRange(device, value) : null;
  const done = Boolean(completion);
  const presets = tempPresetsForDevice(device);
  const disabled = locked || Boolean(completion);

  return `
    <div class="haccp-task-card${done ? ' haccp-task-card--done' : ''}${renderAmpelClass(inRange)}" data-haccp-device-card="${escapeHtml(device.id)}">
      <div class="haccp-task-title-row">
        <div class="haccp-task-title">${escapeHtml(device.name)}</div>
      </div>
      <div class="haccp-task-meta">
        ${escapeHtml(formatSollRange(device))}
        · ${escapeHtml(device.bereich)}
        ${Array.isArray(device.activeDays) && device.activeDays.length ? ` · Aktiv: ${escapeHtml(formatActiveDaysLabel(device))}` : ''}
      </div>
      <div class="haccp-stepper-row">
        <button type="button" class="btn haccp-stepper-btn" data-haccp-step="${escapeHtml(device.id)}" data-haccp-step-delta="-0.5" ${disabled ? 'disabled' : ''} aria-label="0,5 Grad weniger">−</button>
        <input
          id="temp-${safeDomId(device.id)}"
          type="number"
          inputmode="decimal"
          class="input-text-touch haccp-temp-input"
          step="0.5"
          min="-40"
          max="40"
          placeholder="°C"
          data-haccp-temp-input="${escapeHtml(device.id)}"
          value="${hasValue ? escapeHtml(value) : ''}"
          ${disabled ? 'disabled' : ''}>
        <button type="button" class="btn haccp-stepper-btn" data-haccp-step="${escapeHtml(device.id)}" data-haccp-step-delta="0.5" ${disabled ? 'disabled' : ''} aria-label="0,5 Grad mehr">+</button>
      </div>
      ${presets.length && !disabled ? `
        <div class="haccp-preset-row" role="group" aria-label="Schnellwerte">
          ${presets.map((preset) => `
            <button type="button" class="btn haccp-preset-btn" data-haccp-preset="${escapeHtml(device.id)}" data-haccp-preset-value="${preset}">
              ${String(preset).replace('.', ',')} ${escapeHtml(device.unit || '°C')}
            </button>
          `).join('')}
        </div>
      ` : ''}
      ${hasValue ? `
        <div class="haccp-ampel-label ${inRange ? 'haccp-ampel-label--ok' : 'haccp-ampel-label--bad'}" role="status">
          ${inRange ? 'Im Sollbereich' : 'Außerhalb – bitte Kühlung prüfen'}
        </div>
      ` : ''}
      ${completion ? `<div class="haccp-task-meta">Heute gespeichert${completion.doneBy ? ` · ${escapeHtml(completion.doneBy)}` : ''}</div>` : ''}
    </div>
  `;
}

function renderManualSections(locked) {
  const devices = manualTemperatureDevices({ includeRestDays: false });
  if (!devices.length) {
    const anyConfigured = sortedTemperatureDevices().length > 0;
    return `
      <div class="haccp-daily-intro">
        <strong>Laden &amp; Lager</strong>
        <span>${anyConfigured
    ? 'Heute sind laut Plan keine Kühlstellen aktiv (z. B. Fleischtheke nur Do–Sa).'
    : 'Noch keine Messpunkte. Unter „+“ oder mit dem StevesHof-Button legen wir sie an.'}</span>
      </div>
      ${anyConfigured ? '' : `
        <div class="haccp-seed-panel">
          ${renderStevesHofSeedButton({ prominent: true })}
          <p class="haccp-seed-hint">Legt die 8 Laden- und Lager-Kühlstellen mit Sollwerten und Wochentagen an (nur Admin).</p>
        </div>
      `}
    `;
  }
  const byArea = HACCP_BEREICHE
    .map((bereich) => ({
      bereich,
      devices: devices.filter((device) => device.bereich === bereich),
    }))
    .filter((group) => group.devices.length);
  const other = devices.filter((device) => !HACCP_BEREICHE.includes(device.bereich));
  if (other.length) byArea.push({ bereich: 'Weitere', devices: other });

  return byArea.map((group) => `
    <section class="haccp-temp-group" aria-label="${escapeHtml(group.bereich)}">
      <div class="haccp-cleaning-group-title">${escapeHtml(group.bereich === 'Verkauf' || group.bereich === 'Lager' ? `${group.bereich} · Manuelle Messpunkte` : group.bereich)}</div>
      <div class="haccp-task-list">
        ${group.devices.map((device) => renderManualDeviceCard(device, { locked })).join('')}
      </div>
    </section>
  `).join('');
}

function renderTemperatureChecks() {
  const devices = sortedTemperatureDevices();
  const visibleDevices = manualTemperatureDevices({ includeRestDays: false });
  const savedRound = temperatureRoundSavedToday();
  const locked = Boolean(savedRound);
  const employee = readActiveEmployeeName();
  const ready = allRequiredDevicesCaptured() && !locked && visibleDevices.length > 0;
  const requiredCount = devices.filter((device) => isDeviceRequiredToday(device)).length;
  const capturedCount = devices.filter((device) => isDeviceRequiredToday(device) && isDeviceCapturedInRound(device)).length;

  if (!devices.length) {
    return `
      <div class="haccp-daily-intro">
        <strong>Temperatur-Rundgang</strong>
        <span>Für diesen Betrieb sind noch keine Kühlstellen hinterlegt. Mit dem Button unten legen wir die StevesHof-Standardstellen an – oder unter „+“ einzeln.</span>
      </div>
      <div class="haccp-seed-panel">
        ${renderStevesHofSeedButton({ prominent: true })}
        <p class="haccp-seed-hint">8 Laden- und Lager-Kühlstellen inkl. Fleischtheke (Do–Sa). Nur mit Admin-Recht.</p>
      </div>
    `;
  }

  return `
    <div class="haccp-daily-intro">
      <strong>Temperatur-Rundgang</strong>
      <span>Wir tragen die Temperaturen unserer Laden- und Lager-Kühlstellen ein. Ruhetage (z. B. Fleischtheke So–Mi) bleiben ausgeblendet.</span>
    </div>
    <div class="haccp-employee-chip" aria-live="polite">
      Aktiver Mitarbeiter: <strong>${escapeHtml(employee || 'Noch nicht gewählt')}</strong>
    </div>
    <div class="haccp-temp-groups">
      ${renderManualSections(locked)}
    </div>
    ${visibleDevices.length ? `
    <div class="haccp-round-footer">
      <div class="haccp-round-progress">${capturedCount} von ${requiredCount} heute aktiven Stellen erfasst</div>
      <button
        type="button"
        class="btn btn-primary btn-submit-haccp"
        data-haccp-save-round="1"
        ${ready ? '' : 'disabled'}>
        RUNDGANG ABSPEICHERN &amp; PROTOKOLLIEREN
      </button>
      ${locked ? `<div class="haccp-task-meta">Heute bereits gespeichert${savedRound.doneBy ? ` von ${escapeHtml(savedRound.doneBy)}` : ''}.</div>` : ''}
    </div>
    ` : ''}
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
  }

  if (haccpState.mode === 'reinigung') {
    container.innerHTML = renderCleaningChecks();
    bindRenderedHaccpActions(container);
    restoreHaccpDraftFields();
    return;
  }

  const setupDevices = resolveVisibleHaccpDevices()
    .map((entry) => normalizeHaccpDevice(entry))
    .sort((a, b) => (a.sortOrder - b.sortOrder) || String(a.name).localeCompare(String(b.name), 'de'));

  container.innerHTML = `
    <div class="haccp-device-form">
      <div class="haccp-setup-note">
        <strong>Kühlstellen einrichten</strong>
        <span>${haccpState.editingDeviceId ? 'Bestehende Kühlstelle bearbeiten.' : 'Neue Messpunkte für den Temperatur-Rundgang anlegen. Nur ändern, wenn im Laden etwas neu dazukommt.'}</span>
      </div>
      <div class="haccp-seed-panel">
        ${renderStevesHofSeedButton({ prominent: true })}
        <p class="haccp-seed-hint">Schreibt die 8 StevesHof-Prüfstellen (Laden &amp; Lager) mit Sollwerten und Wochentagen in diesen Betrieb.</p>
      </div>
      <input id="haccp-device-name" class="input-text-touch" placeholder="Name der Kühlstelle" autocomplete="off">
      <div class="batch-input-grid">
        <select id="haccp-device-type" class="input-text-touch" aria-label="Gerätetyp">
          ${HACCP_DEVICE_TYPES.map((entry) => `<option value="${escapeHtml(entry.value)}">${escapeHtml(entry.label)}</option>`).join('')}
        </select>
        <select id="haccp-device-area" class="input-text-touch" aria-label="Bereich">
          ${HACCP_BEREICHE.map((bereich) => `<option value="${escapeHtml(bereich)}">${escapeHtml(bereich)}</option>`).join('')}
        </select>
      </div>
      <div class="batch-input-grid">
        <input id="haccp-device-min" type="number" inputmode="decimal" class="input-text-touch" step="0.5" placeholder="Min °C">
        <input id="haccp-device-max" type="number" inputmode="decimal" class="input-text-touch" step="0.5" placeholder="Max °C">
      </div>
      <input id="haccp-device-sort" type="number" inputmode="numeric" class="input-text-touch" step="1" placeholder="Reihenfolge (z. B. 10)">
      <div class="haccp-weekday-grid" role="group" aria-label="Aktive Wochentage">
        <div class="haccp-weekday-label">Aktive Tage (leer/alle = jeden Tag)</div>
        <div class="haccp-weekday-checks">
          ${WEEKDAY_LABELS.map((label, day) => `
            <label class="haccp-weekday-check">
              <input type="checkbox" data-haccp-active-day="${day}" checked>
              <span>${escapeHtml(label)}</span>
            </label>
          `).join('')}
        </div>
      </div>
      <button class="btn btn-primary" type="button" id="btn-add-haccp-device">
        ${haccpState.editingDeviceId ? 'Änderung speichern' : 'Einrichtung speichern'}
      </button>
      ${haccpState.editingDeviceId ? '<button class="btn" type="button" id="btn-cancel-haccp-edit">Abbrechen</button>' : ''}
      <div class="utility-list">
        ${setupDevices.map((device) => `
          <div class="utility-row">
            <div class="utility-row-title">${escapeHtml(device.name)}</div>
            <div class="utility-row-meta">
              ${escapeHtml(device.type || device.protokollTyp || '')}
              · ${escapeHtml(device.bereich || '')}
              · ${escapeHtml(formatSollRange(device))}
              · ${escapeHtml(formatActiveDaysLabel(device))}
              · ${device.localFlyFallback ? 'lokal (Upgrade)' : (device.isActive === false ? 'inaktiv' : 'aktiv')}
            </div>
            ${device.isActive === false ? '' : `
              <div class="utility-row-actions">
                ${isTemperatureDeviceType(device.type) ? `<button class="btn-danger-small" type="button" data-haccp-edit="${escapeHtml(device.id)}">Bearbeiten</button>` : ''}
                <button class="btn-danger-small" type="button" data-haccp-deactivate="${escapeHtml(device.id)}">Deaktivieren</button>
              </div>
            `}
          </div>
        `).join('')}
      </div>
    </div>
  `;
  document.getElementById('btn-add-haccp-device')?.addEventListener('click', addHaccpDeviceFromForm);
  document.getElementById('btn-cancel-haccp-edit')?.addEventListener('click', () => {
    haccpState.editingDeviceId = '';
    renderHaccpDaily();
  });
  bindRenderedHaccpActions(container);
}

function bindHaccpPersonPicker(container) {
  container.querySelector('#haccp-cleaning-person')?.addEventListener('change', (event) => {
    rememberCleaningPerson(event.target.value);
    renderHaccpDaily();
  });
}

function updateHaccpTemperatureAmpel(deviceId) {
  const device = sortedTemperatureDevices().find((entry) => entry.id === deviceId);
  const input = document.getElementById(`temp-${safeDomId(deviceId)}`);
  const card = document.querySelector(`[data-haccp-device-card="${typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(deviceId) : deviceId}"]`)
    || input?.closest('.haccp-task-card');
  if (!device || !input) return;
  setRoundTempValue(deviceId, input.value);
  const hasValue = input.value !== '' && Number.isFinite(Number(input.value));
  const inRange = hasValue ? tempInRange(device, input.value) : null;
  input.classList.toggle('haccp-input--warn', inRange === false);
  input.classList.toggle('haccp-input--ok', inRange === true);
  if (card) {
    card.classList.toggle('haccp-task-card--ampel-ok', inRange === true);
    card.classList.toggle('haccp-task-card--ampel-bad', inRange === false);
  }
  const saveBtn = document.querySelector('[data-haccp-save-round]');
  if (saveBtn) {
    const locked = Boolean(temperatureRoundSavedToday());
    saveBtn.disabled = locked || !allRequiredDevicesCaptured();
  }
  const progress = document.querySelector('.haccp-round-progress');
  if (progress) {
    const devices = sortedTemperatureDevices();
    const requiredCount = devices.filter((entry) => isDeviceRequiredToday(entry)).length;
    const capturedCount = devices.filter((entry) => isDeviceRequiredToday(entry) && isDeviceCapturedInRound(entry)).length;
    progress.textContent = `${capturedCount} von ${requiredCount} heute aktiven Stellen erfasst`;
  }
}

function bindRenderedHaccpActions(container) {
  container.querySelectorAll('[data-haccp-save-clean]').forEach((button) => {
    button.addEventListener('click', () => saveCleaningCheck(button.dataset.haccpSaveClean));
  });
  container.querySelectorAll('[data-haccp-temp-input]').forEach((input) => {
    updateHaccpTemperatureAmpel(input.dataset.haccpTempInput);
  });
  container.querySelectorAll('[data-haccp-deactivate]').forEach((button) => {
    button.addEventListener('click', () => deactivateHaccpDevice(button.dataset.haccpDeactivate));
  });
  container.querySelectorAll('[data-haccp-edit]').forEach((button) => {
    button.addEventListener('click', () => editHaccpDevice(button.dataset.haccpEdit));
  });
}

function bindStaticHaccpControls() {
  const dailyContainer = document.getElementById('haccp-daily-container');
  if (dailyContainer && dailyContainer.dataset.haccpDelegated !== '1') {
    dailyContainer.dataset.haccpDelegated = '1';
    dailyContainer.addEventListener('click', (event) => {
      const seedBtn = event.target.closest('[data-haccp-seed-steveshof]');
      if (seedBtn) {
        void seedStevesHofStandardDevices();
        return;
      }
      const saveRoundBtn = event.target.closest('[data-haccp-save-round]');
      if (saveRoundBtn) {
        void saveTemperatureRound();
        return;
      }
      const stepBtn = event.target.closest('[data-haccp-step]');
      if (stepBtn?.dataset.haccpStep) {
        stepRoundTemp(stepBtn.dataset.haccpStep, Number(stepBtn.dataset.haccpStepDelta || 0));
        return;
      }
      const presetBtn = event.target.closest('[data-haccp-preset]');
      if (presetBtn?.dataset.haccpPreset) {
        setRoundTempValue(presetBtn.dataset.haccpPreset, Number(presetBtn.dataset.haccpPresetValue));
        renderHaccpDaily();
      }
    });
    dailyContainer.addEventListener('input', (event) => {
      const input = event.target.closest('[data-haccp-temp-input]');
      if (input?.dataset.haccpTempInput) {
        updateHaccpTemperatureAmpel(input.dataset.haccpTempInput);
      }
    });
    dailyContainer.addEventListener('change', (event) => {
      const input = event.target.closest('[data-haccp-temp-input]');
      if (input?.dataset.haccpTempInput) {
        updateHaccpTemperatureAmpel(input.dataset.haccpTempInput);
        renderHaccpDaily();
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

  document.getElementById('btn-haccp-print')?.addEventListener('click', generateHaccpPrintView);
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
  const tempLogs = logs.filter((entry) => (
    entry.logTyp === 'temperatur'
    || entry.logTyp === 'temperatur_rundgang'
    || entry.logTyp === 'protokoll'
    || entry.type === 'temperature'
    || entry.type === 'temperature_round'
  ));
  const cleanLogs = logs.filter((entry) => entry.logTyp === 'reinigung' || entry.type === 'cleaning');

  const formatDate = (date) => {
    if (!date) return '-';
    const parts = String(date).split('-');
    return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : date;
  };

  const tempRows = tempLogs.flatMap((entry) => {
    if ((entry.type === 'temperature_round' || entry.logTyp === 'temperatur_rundgang') && Array.isArray(entry.measurements)) {
      return entry.measurements.map((row) => `
        <tr>
          <td>${formatDate(entry.datum)}</td>
          <td>${escapeHtml(row.deviceName || '-')}</td>
          <td>${escapeHtml(row.bereich || entry.bereich || '-')}</td>
          <td>${escapeHtml(row.value != null ? row.value : (row.wert != null ? row.wert : '-'))} ${escapeHtml(row.einheit || '°C')}</td>
          <td>${escapeHtml(entry.doneBy || '-')}</td>
          <td class="${row.status === 'ok' || row.status === 'ruhetag' ? 'status-ok' : 'status-warn'}">${escapeHtml(row.status === 'ok' ? 'OK' : (row.status || 'Erfasst'))}</td>
          <td>${escapeHtml(row.massnahme || '-')}</td>
        </tr>`);
    }
    return [`
    <tr>
      <td>${formatDate(entry.datum)}</td>
      <td>${escapeHtml(entry.facility || entry.deviceName || entry.chargenNummer || '-')}</td>
      <td>${escapeHtml(entry.bereich || '-')}</td>
      <td>${escapeHtml(entry.value != null ? entry.value : (entry.wert != null ? entry.wert : (entry.temperatur != null ? entry.temperatur : '-')))} ${escapeHtml(entry.einheit || entry.unit || '°C')}</td>
      <td>${escapeHtml(entry.doneBy || (entry.ph != null ? entry.ph : '-'))}</td>
      <td class="${entry.status === 'ok' ? 'status-ok' : 'status-warn'}">${escapeHtml(entry.status === 'ok' ? 'OK' : (entry.status || 'Erfasst'))}</td>
      <td>${escapeHtml(entry.massnahme || '-')}</td>
    </tr>`];
  }).join('');

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
    <thead><tr><th>Datum</th><th>Gerät / Charge</th><th>Bereich</th><th>Temperatur</th><th>Bearbeiter</th><th>Status</th><th>Maßnahme</th></tr></thead>
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
