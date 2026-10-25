// ARCH-GUARD: initHaccp / Live-Sync dürfen kein showTab / showPreferredStartTab triggern.
import { canonicalTenantId, getGlobalTenantId, getTenantCollectionPath } from './tenant-db.js';
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

/** Fallback nur wenn Cloud noch leer ist (Migration). */
const DEFAULT_CLEANING_TASK_DOCS = [
  { id: 'verkaufstheke-waagen', name: 'Verkaufstheke & Waagen gereinigt', category: 'Täglich', period: 'day', sortOrder: 10, isProductionOnly: false },
  { id: 'wurstkueche', name: 'Wurstküche gereinigt & desinfiziert', category: 'Nach Nutzung', period: 'day', sortOrder: 20, isProductionOnly: true },
  { id: 'messer-werkzeuge', name: 'Messer & Werkzeuge sterilisiert', category: 'Nach Nutzung', period: 'day', sortOrder: 30, isProductionOnly: true },
  { id: 'rauch-kochanlagen', name: 'Rauch- und Kochanlagen gereinigt', category: 'Nach Nutzung', period: 'day', sortOrder: 40, isProductionOnly: true },
  { id: 'kuehlhaus-grundreinigung', name: 'Kühlhaus Grundreinigung', category: 'Wöchentlich', period: 'week', sortOrder: 50, isProductionOnly: false },
];

const CLEANING_CATEGORY_META = {
  Täglich: { id: 'daily-shop', title: 'TÄGLICH (IM LADENBETRIEB)', period: 'day', sort: 10 },
  'Nach Nutzung': { id: 'production-days', title: 'NACH NUTZUNG (PRODUKTION)', period: 'day', sort: 20 },
  Wöchentlich: { id: 'weekly', title: 'WÖCHENTLICH', period: 'week', sort: 30 },
};

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
  cleaningTasks: [],
  logs: [],
  cleaningDoneBy: '',
  /** @type {Set<string>} */
  pendingCleaningTaskIds: new Set(),
  /** @type {Record<string, { value: number|null, note: string, draft: string }>} */
  roundEntries: {},
  devicesUnsubscribe: null,
  cleaningTasksUnsubscribe: null,
  logsUnsubscribe: null,
  initialized: false,
};

function syncCharcuLogicActiveEmployee(name) {
  try {
    window.charculogic = window.charculogic || {};
    if (name) window.charculogic.activeEmployee = name;
  } catch (_) { /* noop */ }
}

function restoreCleaningPerson() {
  if (haccpState.cleaningDoneBy) return;
  const fromSession = readActiveEmployeeName();
  if (fromSession) {
    haccpState.cleaningDoneBy = fromSession;
    syncCharcuLogicActiveEmployee(fromSession);
  }
}

function rememberCleaningPerson(name) {
  const clean = String(name || '').trim();
  haccpState.cleaningDoneBy = clean;
  syncCharcuLogicActiveEmployee(clean);
  try {
    if (clean) {
      localStorage.setItem(HACCP_CLEANING_PERSON_KEY, clean);
      writeScopedLocalStorageValue(ACTIVE_EMPLOYEE_STORAGE_KEY, resolveHaccpTenantId(), clean);
    } else {
      localStorage.removeItem(HACCP_CLEANING_PERSON_KEY);
      localStorage.removeItem(scopedTeamboardStorageKey(ACTIVE_EMPLOYEE_STORAGE_KEY, resolveHaccpTenantId()));
    }
  } catch (_) { /* noop */ }
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
  loadHaccpCleaningTasksFromCloud();
  loadHaccpLogsFromCloud();
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

function haccpCleaningTasksCollectionPath() {
  const tenantId = resolveHaccpTenantId();
  if (!tenantId) return null;
  try {
    return getTenantCollectionPath('haccp_cleaning_tasks');
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

function cleaningCategoryMeta(category) {
  const key = String(category || '').trim();
  if (CLEANING_CATEGORY_META[key]) return CLEANING_CATEGORY_META[key];
  return {
    id: slugCategoryId(key || 'weitere'),
    title: key ? key.toUpperCase() : 'WEITERE',
    period: 'day',
    sort: 90,
  };
}

function slugCategoryId(value) {
  return String(value || 'weitere')
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/gi, '-')
    .replace(/^-+|-+$/g, '') || 'weitere';
}

function isCleaningTaskDueToday(task) {
  const category = String(task?.category || '').trim();
  if (category !== 'Wöchentlich') return true;
  // Alte Einträge ohne targetDay bleiben sichtbar (Fallback).
  if (task?.targetDay == null || task.targetDay === '') return true;
  const today = new Date().getDay();
  return Number(task.targetDay) === today;
}

function resolveActiveCleaningTaskDocs() {
  const cloud = (haccpState.cleaningTasks || [])
    .filter((task) => task && task.isActive !== false && String(task.name || '').trim())
    .filter(isCleaningTaskDueToday);
  if (cloud.length) return cloud;
  const fallback = !isAdvancedHaccpFlyUpgradeEnabled()
    ? DEFAULT_CLEANING_TASK_DOCS
    : [
      ...DEFAULT_CLEANING_TASK_DOCS,
      { ...FLY_PREVENTION_CLEANING_TASK, category: 'Wöchentlich', period: 'week', sortOrder: 60, isProductionOnly: false },
    ];
  return fallback.filter(isCleaningTaskDueToday);
}

function resolveHaccpCleaningGroups() {
  const byCategory = new Map();
  resolveActiveCleaningTaskDocs().forEach((task) => {
    const category = String(task.category || 'Täglich').trim() || 'Täglich';
    const meta = cleaningCategoryMeta(category);
    if (!byCategory.has(category)) {
      byCategory.set(category, {
        id: meta.id,
        title: meta.title,
        period: task.period === 'week' || meta.period === 'week' ? 'week' : 'day',
        category,
        sort: meta.sort,
        tasks: [],
      });
    }
    const group = byCategory.get(category);
    group.tasks.push({
      id: String(task.id || haccpDeviceDocId(task.name)),
      name: String(task.name || '').trim(),
      sortOrder: Number(task.sortOrder) || 100,
      isProductionOnly: task.isProductionOnly === true,
    });
  });

  return Array.from(byCategory.values())
    .map((group) => ({
      ...group,
      tasks: group.tasks.sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name, 'de')),
    }))
    .sort((a, b) => (a.sort - b.sort) || a.title.localeCompare(b.title, 'de'));
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
    haccpState.roundEntries[deviceId] = { value: null, note: '', draft: '' };
  } else if (typeof haccpState.roundEntries[deviceId].draft !== 'string') {
    haccpState.roundEntries[deviceId].draft = '';
  }
  return haccpState.roundEntries[deviceId];
}

/**
 * Parst Temperatureingaben inkl. führendem Minus und Komma als Dezimaltrenner.
 * Unvollständige Eingaben wie "-" oder "-," bleiben als Draft erhalten.
 * @param {unknown} raw
 * @returns {{ value: number|null, draft: string, complete: boolean }}
 */
export function parseTempInput(raw) {
  const draft = String(raw ?? '').trim().replace(/\s+/g, '');
  if (!draft) return { value: null, draft: '', complete: true };

  const normalized = draft.replace(',', '.');
  // Erlaubt Zwischenstände: "-", "-.", ".", "-0.", "0,"
  if (/^-?\.?$/.test(normalized) || /^-?\d+[.,]$/.test(draft) || /^-?\d*\.$/.test(normalized)) {
    return { value: null, draft, complete: false };
  }

  if (!/^-?\d+([.,]\d+)?$/.test(draft)) {
    return { value: null, draft, complete: false };
  }

  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) return { value: null, draft, complete: false };
  return { value: numeric, draft, complete: true };
}

export function formatTempInput(value) {
  if (value == null || !Number.isFinite(Number(value))) return '';
  return String(Number(value));
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

function readAuthProfileEmployeeName() {
  try {
    const firebaseApi = haccpState.getFirebase?.() || (typeof firebase !== 'undefined' ? firebase : null);
    const user = firebaseApi?.auth?.()?.currentUser;
    const fromDisplay = String(user?.displayName || '').trim();
    if (fromDisplay) return fromDisplay;
    const emailLocal = String(user?.email || '').split('@')[0].trim();
    return emailLocal || '';
  } catch (_) {
    return '';
  }
}

function readActiveEmployeeName() {
  try {
    const fromGlobal = String(window.charculogic?.activeEmployee || '').trim();
    if (fromGlobal) return fromGlobal;
  } catch (_) { /* noop */ }
  try {
    const tenantId = resolveHaccpTenantId();
    const scoped = readScopedLocalStorageValue(ACTIVE_EMPLOYEE_STORAGE_KEY, tenantId);
    if (scoped) return String(scoped).trim();
  } catch (_) { /* noop */ }
  try {
    const legacy = localStorage.getItem(ACTIVE_EMPLOYEE_STORAGE_KEY)
      || localStorage.getItem('charculogic.activeEmployee')
      || localStorage.getItem(HACCP_CLEANING_PERSON_KEY)
      || '';
    if (legacy) return String(legacy).trim();
  } catch (_) { /* noop */ }
  const fromAuth = readAuthProfileEmployeeName();
  if (fromAuth) return fromAuth;
  return String(haccpState.cleaningDoneBy || '').trim();
}

/**
 * Mitarbeiter-Anzeige nur noch im Header (#btn-team / Status-Pille).
 * Content-Chips „Aktiver Mitarbeiter: …“ wurden entfernt (Wet-Finger UX).
 */
function renderHaccpOperatorSelector() {
  const container = document.getElementById('haccp-operator-container');
  if (container) container.innerHTML = '';
}

/**
 * Wareneingang → HACCP: Liefertemperatur als Wareneingangskontrolle persistieren.
 * Kein zweites Tippen im HACCP-Tab nötig.
 */
export async function logReceivingTemperatureCheck({
  temperature,
  supplier = '',
  category = '',
  deliveryId = '',
  employee = '',
  limitC = 7,
  overrideReason = '',
} = {}) {
  const temp = Number(temperature);
  if (!Number.isFinite(temp)) return null;
  if (!haccpState.writeOrQueueFirestore) return null;

  const doneBy = String(employee || readActiveEmployeeName() || '').trim() || 'Team';
  const limit = Number.isFinite(Number(limitC)) ? Number(limitC) : 7;
  const hasOverride = Boolean(String(overrideReason || '').trim());
  const status = hasOverride
    ? 'abweichung_freigabe'
    : (temp > limit ? 'abweichung' : 'ok');
  const dateKey = localDateKey();
  const safeDelivery = String(deliveryId || Date.now().toString(36))
    .replace(/[^A-Za-z0-9_-]/g, '_')
    .slice(0, 48);
  const docId = ['wareneingang_temp', dateKey, safeDelivery].join('_');
  const massnahme = hasOverride
    ? String(overrideReason).trim()
    : (temp > limit
      ? `Grenzwert ${limit} °C überschritten`
      : 'Wareneingangskontrolle OK');

  try {
    return await saveHaccpLog({
      docId,
      logTyp: 'wareneingangskontrolle',
      type: 'receiving_temperature',
      doneBy,
      user: doneBy,
      deviceName: 'Wareneingangskontrolle',
      facility: 'Wareneingang',
      bereich: 'Wareneingang',
      value: temp,
      wert: temp,
      einheit: '°C',
      unit: '°C',
      tempMax: limit,
      sollMax: limit,
      status,
      lieferant: String(supplier || '').trim(),
      warenKategorie: String(category || '').trim(),
      deliveryId: String(deliveryId || '').trim(),
      massnahme,
      source: 'wareneingang',
    });
  } catch (err) {
    console.warn('[CharcuLogic HACCP] Wareneingangs-Temperatur konnte nicht protokolliert werden:', err);
    return null;
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

function loadHaccpCleaningTasksFromCloud() {
  if (!canStartHaccpFirestoreLiveSync()) return;
  if (!haccpState.db) return;
  const path = haccpCleaningTasksCollectionPath();
  if (!path) return;
  if (haccpState.cleaningTasksUnsubscribe) {
    haccpState.cleaningTasksUnsubscribe();
    haccpState.cleaningTasksUnsubscribe = null;
  }
  haccpState.cleaningTasksUnsubscribe = haccpState.db.collection(path).onSnapshot((snapshot) => {
    haccpState.cleaningTasks = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (haccpState.mode === 'reinigung') renderHaccpDaily();
  }, (err) => {
    if (maybeResetOnFirestorePermissionError(err, 'HACCP-Save')) return;
    console.error('[CharcuLogic HACCP] Reinigungsaufgaben-Sync Fehler:', err);
  });
}

function temperatureStatus(device, value) {
  const normalized = normalizeHaccpDevice(device);
  const inRange = tempInRange(normalized, value);
  if (inRange == null) return { ok: false, label: 'Wert fehlt' };
  return inRange ? { ok: true, label: 'OK' } : { ok: false, label: 'Abweichung' };
}

function requireHaccpDoneBy() {
  const doneBy = String(readActiveEmployeeName() || '').trim();
  if (!doneBy) {
    haccpState.showHUD('Mitarbeiter fehlt', 'Bitte zuerst den aktiven Mitarbeiter in der Session wählen.', '!');
    return '';
  }
  syncCharcuLogicActiveEmployee(doneBy);
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
    entry.draft = '';
    return;
  }
  // Numerische Setter (Stepper/Presets) direkt übernehmen
  if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
    entry.value = rawValue;
    entry.draft = formatTempInput(rawValue);
    return;
  }
  const parsed = parseTempInput(rawValue);
  entry.draft = parsed.draft;
  entry.value = parsed.complete ? parsed.value : null;
}

function toggleRoundTempSign(deviceId) {
  const entry = ensureRoundEntry(deviceId);
  const source = entry.draft !== '' && entry.draft != null
    ? entry.draft
    : formatTempInput(entry.value);
  if (!source) {
    entry.draft = '-';
    entry.value = null;
    renderHaccpDaily();
    return;
  }
  const nextDraft = source.startsWith('-') ? source.slice(1) : `-${source}`;
  setRoundTempValue(deviceId, nextDraft || '');
  renderHaccpDaily();
}

function stepRoundTemp(deviceId, delta) {
  const device = sortedTemperatureDevices().find((entry) => entry.id === deviceId);
  if (!device) return;
  const entry = ensureRoundEntry(deviceId);
  const current = Number.isFinite(Number(entry.value)) ? Number(entry.value) : defaultStepperValue(device);
  const next = Math.round((current + Number(delta)) * 2) / 2;
  entry.value = next;
  entry.draft = formatTempInput(next);
  renderHaccpDaily();
}

async function saveTemperatureRound() {
  if (temperatureRoundSavedToday()) {
    haccpState.showHUD('Schon erledigt', 'Der Temperatur-Rundgang ist für heute bereits gespeichert.');
    return;
  }
  const devices = sortedTemperatureDevices();
  if (!devices.length) {
    haccpState.showHUD('Keine Kühlstellen', 'Bitte im Büro unter „Mein Betrieb“ die Messpunkte einrichten.', '!');
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

function cleaningEntryIncludesTask(entry, task) {
  if (!entry || !task) return false;
  if (entry.taskId === task.id || entry.task === task.name || entry.deviceName === task.name) return true;
  if (!Array.isArray(entry.tasks)) return false;
  return entry.tasks.some((item) => {
    if (typeof item === 'string') return item === task.id || item === task.name;
    return item?.id === task.id || item?.name === task.name;
  });
}

function entryMatchesCleaningPeriod(entry, task, group) {
  const periodKey = periodKeyForCleaning(group);
  const isCleaning = entry.type === 'cleaning' || entry.logTyp === 'reinigung';
  if (!isCleaning || !cleaningEntryIncludesTask(entry, task)) return false;
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

function togglePendingCleaningTask(taskId) {
  const task = cleaningTaskById(taskId);
  const group = resolveHaccpCleaningGroups().find((entry) => entry.id === task?.groupId);
  if (!task || !group) return;
  if (cleaningCompletionForTask(task, group)) {
    haccpState.showHUD('Schon erledigt', 'Dieser Punkt ist bereits abgehakt.');
    return;
  }
  if (!haccpState.pendingCleaningTaskIds) {
    haccpState.pendingCleaningTaskIds = new Set();
  }
  if (haccpState.pendingCleaningTaskIds.has(taskId)) {
    haccpState.pendingCleaningTaskIds.delete(taskId);
  } else {
    haccpState.pendingCleaningTaskIds.add(taskId);
  }
  renderHaccpDaily();
}

async function saveCleaningBatch() {
  const activeName = requireHaccpDoneBy();
  if (!activeName) return;

  const pendingIds = Array.from(haccpState.pendingCleaningTaskIds || []);
  if (!pendingIds.length) {
    haccpState.showHUD('Nichts ausgewählt', 'Bitte zuerst die erledigten Punkte abhaken.', '!');
    return;
  }

  const tasks = pendingIds
    .map((taskId) => cleaningTaskById(taskId))
    .filter(Boolean)
    .map((task) => ({
      id: task.id,
      name: task.name,
      groupId: task.groupId,
      period: task.period,
    }));

  if (!tasks.length) {
    haccpState.showHUD('Nichts ausgewählt', 'Bitte zuerst die erledigten Punkte abhaken.', '!');
    return;
  }

  rememberCleaningPerson(activeName);
  const dateKey = localDateKey();
  const docId = ['cleaning_batch', dateKey, Date.now().toString(36)].join('_');
  const nowIso = new Date().toISOString();
  const payload = {
    docId,
    logTyp: 'reinigung',
    type: 'cleaning',
    tasks,
    user: activeName,
    doneBy: activeName,
    deviceName: 'Reinigungsnachweis',
    bereich: 'Reinigung',
    status: 'erledigt',
    periodType: 'day',
    periodKey: dateKey,
    massnahme: `${tasks.length} Punkte`,
  };

  try {
    const result = await saveHaccpLog(payload);
    upsertLocalCleaningLog({
      ...payload,
      id: docId,
      tenantId: resolveHaccpTenantId(),
      datum: dateKey,
      timestamp: nowIso,
      createdAt: nowIso,
    });
    haccpState.pendingCleaningTaskIds = new Set();
    if (result === 'queued') {
      haccpState.showHUD('Lokal vorgemerkt', 'Wird automatisch synchronisiert, sobald WLAN verfügbar ist.');
      renderHaccpDaily();
      return;
    }
    haccpState.showHUD('Reinigung erfasst', `${tasks.length} Punkte sind abgehakt.`);
    renderHaccpDaily();
  } catch (err) {
    const code = err?.code || '';
    if (code === 'already-exists') {
      haccpState.showHUD('Bereits erfasst', 'Dieses Reinigungsprotokoll existiert bereits auf dem Server.');
      return;
    }
    if (maybeResetOnFirestorePermissionError(err, 'HACCP-Save')) return;
    console.error('[CharcuLogic HACCP] Reinigung speichern fehlgeschlagen:', err);
    haccpState.showHUD('Hat nicht geklappt', 'Reinigung konnte nicht gespeichert werden. Bitte gleich noch einmal versuchen.', '!');
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

function restoreHaccpDraftFields() {
  const container = document.getElementById('haccp-daily-container');
  if (!container) return;
  const fieldIds = Array.from(container.querySelectorAll('input, textarea, select'))
    .map((el) => el.id)
    .filter(Boolean);
  haccpState.restoreDraftFields(fieldIds);
}

function cleaningDoneText(entry, pending) {
  if (entry) {
    const who = entry.user || entry.doneBy;
    return who ? `Erledigt: ${who}` : 'Erledigt';
  }
  if (pending) return 'Zum Speichern markiert';
  return 'Abhaken';
}

function renderCleaningTaskButton(task, group) {
  const completion = cleaningCompletionForTask(task, group);
  const done = Boolean(completion);
  const pending = !done && Boolean(haccpState.pendingCleaningTaskIds?.has(task.id));
  return `
    <button
      type="button"
      class="haccp-cleaning-check${done ? ' haccp-cleaning-check--done' : ''}${pending ? ' haccp-cleaning-check--pending' : ''}"
      data-haccp-toggle-clean="${escapeHtml(task.id)}"
      aria-pressed="${done || pending ? 'true' : 'false'}"
      ${done ? 'disabled' : ''}>
      <span class="haccp-cleaning-check-icon" aria-hidden="true">${done || pending ? '✓' : ''}</span>
      <span class="haccp-cleaning-check-main">
        <span class="haccp-cleaning-check-title">${escapeHtml(task.name)}</span>
        <span class="haccp-cleaning-check-state">${escapeHtml(cleaningDoneText(completion, pending))}</span>
      </span>
    </button>
  `;
}

function renderCleaningChecks() {
  const groups = resolveHaccpCleaningGroups();
  const pendingCount = haccpState.pendingCleaningTaskIds?.size || 0;
  const fromCloud = (haccpState.cleaningTasks || []).some((task) => task?.isActive !== false);
  return `
    <div class="haccp-daily-intro">
      <strong>Reinigung</strong>
      <span>Wir haken nur ab, was heute dran ist oder nach Benutzung erledigt wurde.</span>
    </div>
    ${groups.length ? `
    <div class="haccp-cleaning-groups">
      ${groups.map((group) => `
        <section class="haccp-cleaning-group" aria-label="${escapeHtml(group.title)}">
          <div class="haccp-cleaning-group-title">${escapeHtml(group.title)}</div>
          <div class="haccp-cleaning-group-list">
            ${group.tasks.map((task) => renderCleaningTaskButton(task, group)).join('')}
          </div>
        </section>
      `).join('')}
    </div>
    <div class="haccp-round-footer">
      <div class="haccp-round-progress">${pendingCount} Punkt${pendingCount === 1 ? '' : 'e'} zum Speichern markiert${!fromCloud ? ' · Standardliste (noch nicht im Büro hinterlegt)' : ''}</div>
      <button
        type="button"
        class="btn btn-primary btn-submit-haccp"
        data-haccp-save-cleaning-batch="1"
        ${pendingCount ? '' : 'disabled'}>
        REINIGUNG SPEICHERN
      </button>
    </div>
    ` : `
    <div class="haccp-daily-intro">
      <strong>Keine Aufgaben</strong>
      <span>Bitte im Büro unter „Mein Betrieb → HACCP &amp; Hygiene Setup“ Reinigungsaufgaben anlegen.</span>
    </div>
    `}
  `;
}

function renderAmpelClass(inRange) {
  if (inRange == null) return '';
  return inRange ? ' haccp-task-card--ampel-ok' : ' haccp-task-card--ampel-bad';
}

function renderManualDeviceCard(device, { locked = false } = {}) {
  const completion = temperatureCompletionForDevice(device);
  const entry = ensureRoundEntry(device.id);
  const value = completion
    ? (completion.value != null ? completion.value : completion.wert)
    : entry.value;
  const displayValue = completion
    ? formatTempInput(value)
    : (entry.draft !== '' ? entry.draft : formatTempInput(value));
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
          type="text"
          inputmode="decimal"
          enterkeyhint="done"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          class="input-text-touch haccp-temp-input"
          placeholder="z. B. -18"
          aria-label="Temperatur in Grad Celsius, Minus erlaubt"
          data-haccp-temp-input="${escapeHtml(device.id)}"
          value="${escapeHtml(displayValue)}"
          ${disabled ? 'disabled' : ''}>
        <button type="button" class="btn haccp-stepper-btn" data-haccp-step="${escapeHtml(device.id)}" data-haccp-step-delta="0.5" ${disabled ? 'disabled' : ''} aria-label="0,5 Grad mehr">+</button>
        <button type="button" class="btn haccp-stepper-btn haccp-sign-btn" data-haccp-toggle-sign="${escapeHtml(device.id)}" ${disabled ? 'disabled' : ''} aria-label="Vorzeichen umschalten (Plus/Minus)">±</button>
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
    : 'Noch keine Messpunkte. Im Büro unter „Mein Betrieb → HACCP & Hygiene Setup“ einrichten.'}</span>
      </div>
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
  const ready = allRequiredDevicesCaptured() && !locked && visibleDevices.length > 0;
  const requiredCount = devices.filter((device) => isDeviceRequiredToday(device)).length;
  const capturedCount = devices.filter((device) => isDeviceRequiredToday(device) && isDeviceCapturedInRound(device)).length;

  if (!devices.length) {
    return `
      <div class="haccp-daily-intro">
        <strong>Temperatur-Rundgang</strong>
        <span>Für diesen Betrieb sind noch keine Kühlstellen hinterlegt. Bitte im Büro unter „Mein Betrieb → HACCP &amp; Hygiene Setup“ die Messpunkte anlegen.</span>
      </div>
    `;
  }

  return `
    <div class="haccp-daily-intro">
      <strong>Temperatur-Rundgang</strong>
      <span>Wir tragen die Temperaturen unserer Laden- und Lager-Kühlstellen ein. Ruhetage (z. B. Fleischtheke So–Mi) bleiben ausgeblendet.</span>
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

  if (haccpState.mode === 'reinigung') {
    container.innerHTML = renderCleaningChecks();
    bindRenderedHaccpActions(container);
    restoreHaccpDraftFields();
    return;
  }

  // PWA: nur Temperatur / Reinigung – Geräte-Setup liegt im Dev-Dashboard.
  haccpState.mode = 'temperatur';
  container.innerHTML = renderTemperatureChecks();
  bindRenderedHaccpActions(container);
  restoreHaccpDraftFields();
}

function updateHaccpTemperatureAmpel(deviceId) {
  const device = sortedTemperatureDevices().find((entry) => entry.id === deviceId);
  const input = document.getElementById(`temp-${safeDomId(deviceId)}`);
  const card = document.querySelector(`[data-haccp-device-card="${typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(deviceId) : deviceId}"]`)
    || input?.closest('.haccp-task-card');
  if (!device || !input) return;
  setRoundTempValue(deviceId, input.value);
  const entry = ensureRoundEntry(deviceId);
  const hasValue = entry.value != null && Number.isFinite(Number(entry.value));
  const inRange = hasValue ? tempInRange(device, entry.value) : null;
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
  container.querySelectorAll('[data-haccp-toggle-clean]').forEach((button) => {
    button.addEventListener('click', () => togglePendingCleaningTask(button.dataset.haccpToggleClean));
  });
  container.querySelectorAll('[data-haccp-temp-input]').forEach((input) => {
    updateHaccpTemperatureAmpel(input.dataset.haccpTempInput);
  });
}

function bindStaticHaccpControls() {
  const dailyContainer = document.getElementById('haccp-daily-container');
  if (dailyContainer && dailyContainer.dataset.haccpDelegated !== '1') {
    dailyContainer.dataset.haccpDelegated = '1';
    dailyContainer.addEventListener('click', (event) => {
      const saveRoundBtn = event.target.closest('[data-haccp-save-round]');
      if (saveRoundBtn) {
        void saveTemperatureRound();
        return;
      }
      const saveCleaningBtn = event.target.closest('[data-haccp-save-cleaning-batch]');
      if (saveCleaningBtn) {
        void saveCleaningBatch();
        return;
      }
      const stepBtn = event.target.closest('[data-haccp-step]');
      if (stepBtn?.dataset.haccpStep) {
        stepRoundTemp(stepBtn.dataset.haccpStep, Number(stepBtn.dataset.haccpStepDelta || 0));
        return;
      }
      const signBtn = event.target.closest('[data-haccp-toggle-sign]');
      if (signBtn?.dataset.haccpToggleSign) {
        toggleRoundTempSign(signBtn.dataset.haccpToggleSign);
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
        // Nur Ampel/Save-Button aktualisieren – kein Full-Rerender (sonst weg Fokus/Minus-Draft).
        updateHaccpTemperatureAmpel(input.dataset.haccpTempInput);
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

  document.getElementById('btn-haccp-history')?.addEventListener('click', openHaccpHistoryModal);
  document.querySelectorAll('[data-haccp-history-close]').forEach((el) => {
    el.addEventListener('click', closeHaccpHistoryModal);
  });
  window.addEventListener('charculogic:active-employee-changed', () => {
    renderHaccpOperatorSelector();
    if (document.getElementById('page-haccp') && !document.getElementById('page-haccp').hidden) {
      renderHaccpDaily();
    }
  });
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

function formatHaccpHistoryDate(date) {
  if (!date) return '-';
  const parts = String(date).split('-');
  return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : date;
}

function collectHaccpHistoryRows(days = 7) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const logs = (haccpState.logs || [])
    .filter((entry) => (entry.datum || '') >= cutoffStr)
    .sort((a, b) => logMomentMillis(b) - logMomentMillis(a) || String(b.datum || '').localeCompare(String(a.datum || '')));

  const rows = [];
  logs.forEach((entry) => {
    const isTempRound = entry.type === 'temperature_round' || entry.logTyp === 'temperatur_rundgang';
    const isTemp = entry.type === 'temperature' || entry.logTyp === 'temperatur' || entry.logTyp === 'protokoll' || isTempRound;
    const isClean = entry.type === 'cleaning' || entry.logTyp === 'reinigung';
    const who = entry.user || entry.doneBy || '-';

    if (isTempRound && Array.isArray(entry.measurements)) {
      rows.push({
        datum: entry.datum,
        typ: 'Temperatur-Rundgang',
        mitarbeiter: who,
        status: entry.status === 'abweichung' ? 'Abweichung' : (entry.status || 'OK'),
        detail: `${entry.measurements.length} Kühlstellen`,
      });
      return;
    }
    if (isTemp) {
      const value = entry.value != null ? entry.value : (entry.wert != null ? entry.wert : entry.temperatur);
      rows.push({
        datum: entry.datum,
        typ: 'Temperatur',
        mitarbeiter: who,
        status: entry.status === 'ok' ? 'OK' : (entry.status || 'Erfasst'),
        detail: `${entry.facility || entry.deviceName || '-'} ${value != null ? `${value} ${entry.einheit || entry.unit || '°C'}` : ''}`.trim(),
      });
      return;
    }
    if (isClean) {
      let detail = entry.task || entry.deviceName || 'Reinigung';
      if (Array.isArray(entry.tasks) && entry.tasks.length) {
        detail = entry.tasks
          .map((item) => (typeof item === 'string' ? item : (item?.name || item?.id || '')))
          .filter(Boolean)
          .join(', ');
      }
      rows.push({
        datum: entry.datum,
        typ: 'Reinigung',
        mitarbeiter: who,
        status: entry.status || 'Erledigt',
        detail,
      });
    }
  });
  return rows;
}

function renderHaccpHistoryTable(rows) {
  if (!rows.length) {
    return '<p class="haccp-history-empty">In den letzten 7 Tagen sind noch keine Nachweise gespeichert.</p>';
  }
  return `
    <div class="haccp-history-table-wrap">
      <table class="haccp-history-table" aria-label="HACCP-Historie letzte 7 Tage">
        <thead>
          <tr>
            <th>Datum</th>
            <th>Typ</th>
            <th>Mitarbeiter</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${escapeHtml(formatHaccpHistoryDate(row.datum))}</td>
              <td>
                <div class="haccp-history-type">${escapeHtml(row.typ)}</div>
                <div class="haccp-history-detail">${escapeHtml(row.detail || '')}</div>
              </td>
              <td>${escapeHtml(row.mitarbeiter || '-')}</td>
              <td>${escapeHtml(row.status || '-')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function closeHaccpHistoryModal() {
  const modal = document.getElementById('haccp-history-modal');
  if (!modal) return;
  modal.hidden = true;
  modal.classList.remove('is-open');
}

function openHaccpHistoryModal() {
  const modal = document.getElementById('haccp-history-modal');
  const body = document.getElementById('haccp-history-body');
  if (!modal || !body) {
    haccpState.showHUD('Historie fehlt', 'Die Protokollansicht ist gerade nicht verfügbar.', '!');
    return;
  }
  body.innerHTML = renderHaccpHistoryTable(collectHaccpHistoryRows(7));
  modal.hidden = false;
  modal.classList.add('is-open');
}
