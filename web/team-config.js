/**
 * Team-Dashboard Konfiguration (Mitarbeiter, Gruppen) + Push-Vorbereitung
 */

import { writeFirestoreDocOrQueue } from './sync.js';
import { getAuthContext, verifyAdminAction } from './auth.js';
import { waitForAppCheckReady } from './app-check.js';
import { createHttpsCallable } from './firebase-functions.js';
import { getGlobalTenantId, setGlobalTenantId } from './tenant-db.js';
import { ACTIVE_EMPLOYEE_STORAGE_KEY, readScopedLocalStorageValue } from './teamboard-storage.js';

/** Mandant aus Modul-State oder globalem Auth/Dashboard-Kontext. */
function resolveTeamConfigTenantId() {
  const fromState = String(configState.tenantId || '').trim();
  if (fromState) return fromState;
  const fromGlobal = String(getGlobalTenantId() || '').trim();
  if (fromGlobal) {
    configState.tenantId = fromGlobal;
    return fromGlobal;
  }
  return '';
}

function getActiveEmployeeNameLocal() {
  try {
    return readScopedLocalStorageValue(ACTIVE_EMPLOYEE_STORAGE_KEY, configState.tenantId);
  } catch (_) {
    return '';
  }
}

const TEAM_CONFIG_DOC_ID = 'teamDashboard';
const PUSH_ENABLED_KEY = 'charculogic_push_enabled';
const PUSH_VAPID_KEY = 'charculogic_fcm_vapid_key';

const DEFAULT_EMPLOYEES = ['Mitarbeiter 1', 'Mitarbeiter 2'];
const DEFAULT_GROUPS = {
  theke: { label: 'Theke', members: ['Mitarbeiter 1'] },
  produktion: { label: 'Produktion', members: ['Mitarbeiter 2'] },
};

function getTenantTeamDefaults() {
  const fromProfile = window.__tenantDefaultTeam;
  if (Array.isArray(fromProfile) && fromProfile.length) {
    return {
      employees: [...fromProfile],
      groups: {
        team: { label: 'Team', members: [...fromProfile] },
      },
    };
  }
  return {
    employees: [...DEFAULT_EMPLOYEES],
    groups: JSON.parse(JSON.stringify(DEFAULT_GROUPS)),
  };
}

/** Erlaubte Fachbereichs-Tags für Schnellmelde/Bedarfe. */
export const DEPARTMENT_KEYS = [
  'kueche',
  'zerlegung',
  'wurstproduktion',
  'laden',
  'einkauf',
];

export const DEPARTMENT_LABELS = {
  kueche: 'Küche',
  zerlegung: 'Zerlegung',
  wurstproduktion: 'Wurstproduktion',
  laden: 'Laden / Verkauf',
  einkauf: 'Einkauf / Büro',
};

/** Legacy: „Metzgerei / Produktion“ → Küche (Admin kann Feinschliff setzen). */
export const LEGACY_DEPARTMENT_MIGRATIONS = {
  metzgerei: 'kueche',
};

/** Produktions-Bereiche (sehen alte Meldungen mit departmentTarget=metzgerei). */
export const PRODUCTION_DEPARTMENT_KEYS = ['kueche', 'zerlegung', 'wurstproduktion'];

/** Leerer Primärbereich = noch nicht zugeordnet. */
export const PRIMARY_DEPARTMENT_NONE = '';

/**
 * @typedef {{ departments: string[], primaryDepartment: string, canOrder: boolean }} DepartmentAssignment
 */

const configState = {
  db: null,
  tenantId: '',
  getFirebase: () => null,
  unsubscribe: null,
  verifyPinCallable: null,
  employees: [...DEFAULT_EMPLOYEES],
  groups: JSON.parse(JSON.stringify(DEFAULT_GROUPS)),
  /** @type {Record<string, DepartmentAssignment>} */
  departmentAssignments: {},
};

export function getTeamEmployees() {
  return [...configState.employees];
}

export function getTeamGroups() {
  return JSON.parse(JSON.stringify(configState.groups));
}

function departmentLookupKey(name) {
  return String(name || '').trim().toLowerCase();
}

function migrateDepartmentKey(rawKey) {
  const key = String(rawKey || '').trim().toLowerCase();
  if (!key) return '';
  if (LEGACY_DEPARTMENT_MIGRATIONS[key]) return LEGACY_DEPARTMENT_MIGRATIONS[key];
  return key;
}

function normalizeDepartmentList(value) {
  const allowed = new Set(DEPARTMENT_KEYS);
  const raw = Array.isArray(value) ? value : [];
  const result = [];
  raw.forEach((entry) => {
    const key = migrateDepartmentKey(entry);
    if (!allowed.has(key) || result.includes(key)) return;
    result.push(key);
  });
  return result;
}

function normalizePrimaryDepartment(value, departments = []) {
  const key = migrateDepartmentKey(value);
  if (key && DEPARTMENT_KEYS.includes(key)) return key;
  // Legacy: erster Eintrag gilt als Primär, wenn keines gesetzt war.
  if (departments.length) return departments[0];
  return PRIMARY_DEPARTMENT_NONE;
}

/**
 * Stellt sicher: Primär ist in departments enthalten (oder beides leer).
 * @param {{ departments?: string[], primaryDepartment?: string, canOrder?: boolean }} input
 * @returns {DepartmentAssignment}
 */
export function normalizeDepartmentAssignmentEntry(input = {}) {
  const canOrder = input?.canOrder === true;
  let departments = normalizeDepartmentList(input?.departments);
  let primaryDepartment = normalizePrimaryDepartment(input?.primaryDepartment, departments);
  if (primaryDepartment && !departments.includes(primaryDepartment)) {
    departments = [primaryDepartment, ...departments];
  }
  if (!primaryDepartment && !departments.length && !canOrder) {
    return { departments: [], primaryDepartment: PRIMARY_DEPARTMENT_NONE, canOrder: false };
  }
  return { departments, primaryDepartment, canOrder };
}

/**
 * Normalisiert departmentAssignments aus Firestore (Keys = Mitarbeiternamen).
 * @param {unknown} raw
 * @returns {Record<string, DepartmentAssignment>}
 */
export function normalizeDepartmentAssignments(raw) {
  const result = {};
  if (!raw || typeof raw !== 'object') return result;
  Object.entries(raw).forEach(([name, entry]) => {
    const cleanName = String(name || '').trim();
    if (!cleanName) return;
    const rawEntry = entry && typeof entry === 'object'
      ? entry
      : { departments: entry };
    result[cleanName] = normalizeDepartmentAssignmentEntry(rawEntry);
  });
  return result;
}

export function getDepartmentAssignments() {
  return JSON.parse(JSON.stringify(configState.departmentAssignments));
}

/**
 * Zuständigkeiten für einen Mitarbeiternamen (Soft-Lock / Anzeigename).
 * @param {string} employeeName
 * @returns {DepartmentAssignment}
 */
export function getEmployeeDepartmentAssignment(employeeName) {
  const empty = {
    departments: [],
    primaryDepartment: PRIMARY_DEPARTMENT_NONE,
    canOrder: false,
  };
  const key = departmentLookupKey(employeeName);
  if (!key) return empty;
  const match = Object.entries(configState.departmentAssignments).find(
    ([name]) => departmentLookupKey(name) === key,
  );
  if (!match) return empty;
  return normalizeDepartmentAssignmentEntry(match[1]);
}

export function employeeHasDepartment(employeeName, department) {
  const raw = String(department || '').trim().toLowerCase();
  if (!raw) return false;
  const assignment = getEmployeeDepartmentAssignment(employeeName);
  if (raw === 'all') return assignment.departments.length > 0;
  // Alte Meldungen „Metzgerei“: jeder Produktions-Fachbereich sieht sie.
  if (raw === 'metzgerei') {
    return PRODUCTION_DEPARTMENT_KEYS.some((key) => assignment.departments.includes(key));
  }
  const dept = migrateDepartmentKey(raw);
  return assignment.departments.includes(dept);
}

/** Hat der Mitarbeiter einen der Produktions-Fachbereiche? */
export function employeeHasProductionDepartment(employeeName) {
  const assignment = getEmployeeDepartmentAssignment(employeeName);
  return PRODUCTION_DEPARTMENT_KEYS.some(
    (key) => assignment.primaryDepartment === key || assignment.departments.includes(key),
  );
}

export function employeeCanResolveSupplyAlerts(employeeName) {
  const assignment = getEmployeeDepartmentAssignment(employeeName);
  return assignment.canOrder === true || assignment.departments.length > 0;
}

/**
 * Speichert Fachbereiche/canOrder für einen Mitarbeiter in teamDashboard.
 * @param {string} employeeName
 * @param {{ departments?: string[], primaryDepartment?: string, canOrder?: boolean }} patch
 */
export async function saveEmployeeDepartmentAssignment(employeeName, patch = {}) {
  const cleanName = String(employeeName || '').trim();
  if (!cleanName) throw new Error('Mitarbeitername fehlt');
  // Dev-Dashboard setzt oft nur getGlobalTenantId(); team-config.tenantId kann leer sein.
  const tenantId = resolveTeamConfigTenantId();
  if (!tenantId) throw new Error('Mandant fehlt');

  const current = getEmployeeDepartmentAssignment(cleanName);
  const next = normalizeDepartmentAssignmentEntry({
    departments: patch.departments !== undefined ? patch.departments : current.departments,
    primaryDepartment: patch.primaryDepartment !== undefined
      ? patch.primaryDepartment
      : current.primaryDepartment,
    canOrder: patch.canOrder !== undefined ? patch.canOrder === true : current.canOrder,
  });

  const assignments = { ...configState.departmentAssignments };
  // Alten Key mit anderer Schreibweise ersetzen
  Object.keys(assignments).forEach((key) => {
    if (departmentLookupKey(key) === departmentLookupKey(cleanName)) {
      delete assignments[key];
    }
  });
  if (next.departments.length || next.primaryDepartment || next.canOrder) {
    assignments[cleanName] = next;
  }

  const firebase = configState.getFirebase();
  // Merge-Update (kein op:'set'): sync.js injiziert bei set automatisch createdAt,
  // was die teamDashboard-Rules-Allowlist sprengt. Merge lässt Legacy-Felder stehen.
  const payload = {
    departmentAssignments: assignments,
    tenantId,
    updatedAt: firebase?.firestore?.FieldValue?.serverTimestamp?.() || new Date().toISOString(),
    updatedBy: getActiveEmployeeNameLocal() || 'Admin',
  };

  await writeFirestoreDocOrQueue({
    collectionPath: 'settings',
    docId: TEAM_CONFIG_DOC_ID,
    op: 'update',
    onlineData: payload,
    queueData: { ...payload, updatedAt: new Date().toISOString() },
    offlineMessage: 'Zuständigkeiten werden synchronisiert.',
  });

  configState.departmentAssignments = assignments;
  window.dispatchEvent(new CustomEvent('charculogic:team-config-changed', {
    detail: {
      employees: configState.employees,
      groups: configState.groups,
      departmentAssignments: assignments,
    },
  }));
  return next;
}

/** Kanonischer Firestore-Pfad: tenants/{tenantId}/settings/teamDashboard */
export function getTeamConfigDocId() {
  return TEAM_CONFIG_DOC_ID;
}

/**
 * Extrahiert aktive Mitarbeiternamen aus String- oder Objekt-Einträgen.
 * Filtert `active: false` / `disabled: true` / `status: 'inactive'`.
 */
export function extractActiveEmployeeNames(list = []) {
  const names = [];
  (Array.isArray(list) ? list : []).forEach((entry) => {
    if (typeof entry === 'string') {
      const cleanName = entry.trim();
      if (cleanName) names.push(cleanName);
      return;
    }
    if (!entry || typeof entry !== 'object') return;
    if (
      entry.active === false
      || entry.enabled === false
      || entry.disabled === true
      || String(entry.status || '').toLowerCase() === 'inactive'
    ) {
      return;
    }
    const cleanName = String(
      entry.name || entry.displayName || entry.employeeName || entry.label || '',
    ).trim();
    if (cleanName) names.push(cleanName);
  });
  return mergeEmployeeLists(names, []);
}

/**
 * Frische One-Shot-Ladung von settings/teamDashboard (Mitarbeiter + Fachbereiche).
 * Aktualisiert den In-Memory-State — zuverlässiger als auf team-config-changed zu warten
 * (Race: leeres applyConfig(null) oder Snapshot vor dem Event-Listener).
 */
export async function ensureTeamEmployeesLoaded() {
  const loaded = await ensureTeamConfigLoaded();
  return loaded.employees;
}

/**
 * One-Shot-Read von teamDashboard inkl. departmentAssignments.
 * @returns {Promise<{ employees: string[], departmentAssignments: Record<string, DepartmentAssignment>, ok: boolean }>}
 */
export async function ensureTeamConfigLoaded() {
  const ref = configRef();
  if (!ref) {
    return {
      employees: getTeamEmployees(),
      departmentAssignments: getDepartmentAssignments(),
      ok: false,
    };
  }
  try {
    const snap = await ref.get();
    const config = normalizeConfig(snap.exists ? snap.data() : null);
    applyConfig(config);
    return {
      employees: [...configState.employees],
      departmentAssignments: getDepartmentAssignments(),
      ok: true,
    };
  } catch (err) {
    console.warn('[TeamConfig] ensureTeamConfigLoaded fehlgeschlagen:', err);
    return {
      employees: getTeamEmployees(),
      departmentAssignments: getDepartmentAssignments(),
      ok: false,
    };
  }
}

function getVerifyPinCallable() {
  const firebase = configState.getFirebase();
  if (!firebase?.functions) return null;
  if (!configState.verifyPinCallable) {
    configState.verifyPinCallable = createHttpsCallable('verifyTerminalPin', undefined, firebase);
  }
  return configState.verifyPinCallable;
}

export async function verifyEmployeePin(employeeName, pin) {
  const cleanName = String(employeeName || '').trim();
  const cleanPin = String(pin || '').trim();
  if (!cleanName || cleanPin.length !== 4) return false;

  const callable = getVerifyPinCallable();
  if (!callable) {
    console.warn('[TeamConfig] PIN-Verifikation nicht verfügbar (Functions nicht geladen).');
    return false;
  }
  try {
    await waitForAppCheckReady();
    const result = await callable({ mode: 'employee', employeeName: cleanName, pin: cleanPin });
    return result?.data?.ok === true;
  } catch (err) {
    console.warn('[TeamConfig] PIN-Verifikation fehlgeschlagen:', err);
    return false;
  }
}

export async function resolveEmployeeByPin(pin) {
  const cleanPin = String(pin || '').trim();
  if (cleanPin.length !== 4) return null;

  const callable = getVerifyPinCallable();
  if (!callable) return null;
  try {
    await waitForAppCheckReady();
    const result = await callable({ mode: 'resolve', pin: cleanPin });
    return result?.data?.ok ? result.data.employeeName : null;
  } catch (err) {
    console.warn('[TeamConfig] PIN-Auflösung fehlgeschlagen:', err);
    return null;
  }
}

export async function verifyMeisterPin(pin) {
  const cleanPin = String(pin || '').trim();
  if (cleanPin.length !== 4) return null;

  const callable = getVerifyPinCallable();
  if (!callable) return null;
  try {
    await waitForAppCheckReady();
    const result = await callable({ mode: 'meister', pin: cleanPin });
    return result?.data?.ok ? result.data.meisterName : null;
  } catch (err) {
    console.warn('[TeamConfig] Meister-PIN-Verifikation fehlgeschlagen:', err);
    return null;
  }
}

export function isPushEnabledLocally() {
  try {
    return localStorage.getItem(PUSH_ENABLED_KEY) === '1';
  } catch (_) {
    return false;
  }
}

export function setPushEnabledLocally(enabled) {
  try {
    localStorage.setItem(PUSH_ENABLED_KEY, enabled ? '1' : '0');
  } catch (_) { /* noop */ }
}

export function getStoredVapidKey() {
  try {
    return String(localStorage.getItem(PUSH_VAPID_KEY) || '').trim();
  } catch (_) {
    return '';
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function configRef() {
  const tenantId = resolveTeamConfigTenantId();
  if (!configState.db || !tenantId) return null;
  try {
    // Direkt über configState.db + tenantId — nicht getTenantCollection()
    // (requireGlobalTenantId) und nicht getNamedTenantCollection() (eigenes
    // firestoreDb aus initTenantDb, das im Dev-Dashboard-Pfad leer sein kann).
    return configState.db
      .collection('tenants')
      .doc(tenantId)
      .collection('settings')
      .doc(TEAM_CONFIG_DOC_ID);
  } catch (err) {
    console.warn('[TeamConfig] configRef fehlgeschlagen:', err?.message || err);
    return null;
  }
}

function mergeEmployeeLists(primary = [], secondary = []) {
  const merged = [];
  [...primary, ...secondary].forEach((name) => {
    const cleanName = String(name).trim();
    if (!cleanName) return;
    if (merged.some((entry) => entry.toLowerCase() === cleanName.toLowerCase())) return;
    merged.push(cleanName);
  });
  return merged.sort((left, right) => left.localeCompare(right, 'de', { sensitivity: 'base' }));
}

function normalizeConfig(data) {
  const tenantDefaults = getTenantTeamDefaults();
  const storedEmployees = extractActiveEmployeeNames(data?.employees);
  let employees = storedEmployees.length
    ? mergeEmployeeLists(storedEmployees, [])
    : [...tenantDefaults.employees];
  const rawGroups = data?.groups && typeof data.groups === 'object' ? data.groups : {};
  const groups = {};
  Object.entries(rawGroups).forEach(([id, group]) => {
    const key = String(id).trim();
    if (!key) return;
    const label = String(group?.label || key).trim() || key;
    const members = extractActiveEmployeeNames(group?.members);
    groups[key] = { label, members };
  });
  if (Object.keys(groups).length === 0) {
    Object.assign(groups, JSON.parse(JSON.stringify(tenantDefaults.groups)));
  }

  return {
    employees: employees.length ? employees : [...tenantDefaults.employees],
    groups,
    departmentAssignments: normalizeDepartmentAssignments(data?.departmentAssignments),
  };
}

function applyConfig(config) {
  configState.employees = config.employees;
  configState.groups = config.groups;
  configState.departmentAssignments = normalizeDepartmentAssignments(config.departmentAssignments);
  syncEmployeeDatalist();
  window.dispatchEvent(new CustomEvent('charculogic:team-config-changed', {
    detail: {
      employees: configState.employees,
      groups: configState.groups,
      departmentAssignments: configState.departmentAssignments,
    },
  }));
}

function syncEmployeeDatalist() {
  const datalist = document.getElementById('employee-suggestions');
  if (!datalist) return;
  datalist.innerHTML = configState.employees
    .map((name) => `<option value="${escapeHtml(name)}"></option>`)
    .join('');
}

async function handleTeamConfigSnapshot(snap) {
  const raw = snap.exists ? snap.data() : null;
  const config = normalizeConfig(raw);
  applyConfig(config);
  renderAdminTeamConfigForm(config);
}

function subscribeTeamConfig() {
  const ref = configRef();
  if (!ref) {
    console.warn('[TeamConfig] Kein settings/teamDashboard-Ref — Listener bleibt unverändert.');
    return;
  }
  // Alten Listener erst ersetzen, wenn neuer Ref steht (sonst Fenster ohne Zuordnungen).
  configState.unsubscribe?.();
  configState.unsubscribe = ref.onSnapshot(
    (snap) => {
      handleTeamConfigSnapshot(snap).catch((err) => {
        console.warn('[TeamConfig] Snapshot-Verarbeitung:', err);
        applyConfig(normalizeConfig(snap.exists ? snap.data() : null));
      });
    },
    (err) => {
      console.warn('[TeamConfig] Stream:', err);
      // permission-denied / Netz: Listener freigeben, damit setTeamConfigTenantId erneut abonnieren kann.
      try {
        configState.unsubscribe?.();
      } catch (_) { /* noop */ }
      configState.unsubscribe = null;
    },
  );
}

function readAdminConfigFromForm() {
  const employeesRaw = document.getElementById('team-config-employees')?.value || '';
  const employees = employeesRaw
    .split(/[\n,;]+/)
    .map((n) => n.trim())
    .filter(Boolean);

  const groups = {};
  document.querySelectorAll('[data-group-row]').forEach((row) => {
    const id = row.querySelector('[name="group-id"]')?.value?.trim();
    const label = row.querySelector('[name="group-label"]')?.value?.trim();
    const membersRaw = row.querySelector('[name="group-members"]')?.value || '';
    if (!id) return;
    const members = membersRaw
      .split(/[\n,;]+/)
      .map((n) => n.trim())
      .filter(Boolean);
    groups[id] = { label: label || id, members };
  });

  return { employees, groups };
}

function buildGroupRowHtml(id, group = { label: '', members: [] }) {
  return `
    <div class="team-config-group-row" data-group-row>
      <label class="form-label">Gruppen-ID</label>
      <input type="text" name="group-id" class="input-text-touch" value="${escapeHtml(id)}" placeholder="z. B. metzgerei">
      <label class="form-label">Anzeigename</label>
      <input type="text" name="group-label" class="input-text-touch" value="${escapeHtml(group.label || '')}" placeholder="Metzgerei">
      <label class="form-label">Mitglieder (kommagetrennt)</label>
      <input type="text" name="group-members" class="input-text-touch" value="${escapeHtml((group.members || []).join(', '))}" placeholder="Mitarbeiter 1, Mitarbeiter 2">
      <button type="button" class="btn btn-secondary btn-compact" data-remove-group-row>Gruppe entfernen</button>
    </div>
  `;
}

function renderAdminTeamConfigForm(config = null) {
  const panel = document.getElementById('admin-team-config-panel');
  if (!panel || panel.classList.contains('hidden')) return;

  const rawCfg = config || {
    employees: configState.employees,
    groups: configState.groups,
    departmentAssignments: configState.departmentAssignments,
  };
  const cfg = normalizeConfig({
    employees: rawCfg.employees,
    groups: rawCfg.groups,
    departmentAssignments: rawCfg.departmentAssignments,
  });
  const employeesEl = document.getElementById('team-config-employees');
  if (employeesEl && document.activeElement !== employeesEl) {
    employeesEl.value = cfg.employees.join(', ');
  }

  const groupsHost = document.getElementById('team-config-groups');
  if (!groupsHost || groupsHost.dataset.editing === '1') return;
  groupsHost.innerHTML = Object.entries(cfg.groups)
    .map(([id, group]) => buildGroupRowHtml(id, group))
    .join('');
}

function saveVapidFromAdminInput() {
  const input = document.getElementById('team-config-vapid');
  const value = input?.value?.trim() || '';
  try {
    if (value) localStorage.setItem(PUSH_VAPID_KEY, value);
    else localStorage.removeItem(PUSH_VAPID_KEY);
  } catch (_) { /* noop */ }
}

function loadVapidToAdminInput() {
  const input = document.getElementById('team-config-vapid');
  if (input && !input.value) input.value = getStoredVapidKey();
}

function parseSupplierAdminLines(raw = '') {
  return String(raw || '')
    .split(/[\n,;]+/)
    .map((name) => name.trim())
    .filter((name) => name && !/^sonstig/i.test(name));
}

function fillSupplierAdminField() {
  const ladenInput = document.getElementById('tenant-suppliers-laden');
  const metzInput = document.getElementById('tenant-suppliers-metzgerei');
  if (!ladenInput && !metzInput) return;
  if (ladenInput?.dataset.editing === '1' || metzInput?.dataset.editing === '1') return;
  const getNames = typeof window.getTenantSupplierNames === 'function'
    ? window.getTenantSupplierNames
    : null;
  if (!getNames) return;
  if (ladenInput) ladenInput.value = getNames('laden').join('\n');
  if (metzInput) metzInput.value = getNames('metzgerei').join('\n');
}

async function saveSuppliersFromAdmin() {
  if (!configState.tenantId) return;
  const ladenInput = document.getElementById('tenant-suppliers-laden');
  const metzInput = document.getElementById('tenant-suppliers-metzgerei');
  if (!ladenInput && !metzInput) return;
  const laden = parseSupplierAdminLines(ladenInput?.value || '');
  const metzgerei = parseSupplierAdminLines(metzInput?.value || '');
  if (!laden.length && !metzgerei.length) return;
  const names = [...new Set([...laden, ...metzgerei])];
  const firebase = configState.getFirebase();
  const payload = {
    laden,
    metzgerei,
    names,
    tenantId: configState.tenantId,
    updatedAt: firebase?.firestore?.FieldValue?.serverTimestamp?.() || new Date().toISOString(),
    updatedBy: getActiveEmployeeNameLocal() || 'Admin',
  };
  await writeFirestoreDocOrQueue({
    collectionPath: 'settings',
    docId: 'suppliers',
    op: 'set',
    onlineData: payload,
    queueData: { ...payload, updatedAt: new Date().toISOString() },
    offlineMessage: 'Lieferanten werden synchronisiert.',
  });
  if (typeof window.applyLocalSupplierLists === 'function') {
    window.applyLocalSupplierLists({
      laden,
      metzgerei,
      tenantId: configState.tenantId,
    });
  } else {
    window.dispatchEvent(new CustomEvent('charculogic:tenant-settings', {
      detail: {
        suppliers: laden,
        suppliersByArea: { laden, metzgerei },
      },
    }));
  }
}

async function saveTeamConfigFromAdmin() {
  verifyAdminAction(async () => {
    saveVapidFromAdminInput();
    const config = readAdminConfigFromForm();
    if (config.employees.length === 0) {
      window.showToast?.('Mindestens ein Mitarbeitername nötig.', 'warning');
      return;
    }
    if (Object.keys(config.groups).length === 0) {
      window.showToast?.('Mindestens eine Team-Gruppe anlegen.', 'warning');
      return;
    }

    const firebase = configState.getFirebase();
    const payload = {
      employees: config.employees,
      groups: config.groups,
      departmentAssignments: configState.departmentAssignments,
      tenantId: configState.tenantId,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: getActiveEmployeeNameLocal() || 'Admin',
    };

    try {
      await writeFirestoreDocOrQueue({
        collectionPath: 'settings',
        docId: TEAM_CONFIG_DOC_ID,
        op: 'set',
        onlineData: payload,
        queueData: { ...payload, updatedAt: new Date().toISOString() },
        offlineMessage: 'Team-Konfiguration wird synchronisiert.',
      });
      await saveSuppliersFromAdmin();
      window.showToast?.('Team-Konfiguration gespeichert.', 'success');
    } catch (err) {
      console.error('[TeamConfig] Speichern fehlgeschlagen:', err);
      window.showToast?.('Konfiguration konnte nicht gespeichert werden.', 'error');
    }
  });
}

function bindAdminTeamConfigPanel() {
  const panel = document.getElementById('admin-team-config-panel');
  if (!panel) return;

  const ctx = getAuthContext();
  const canAdmin = ctx?.isAdmin && !ctx?.isHelper;
  panel.classList.toggle('hidden', !canAdmin);
  if (!canAdmin) return;

  if (panel.dataset.bound === '1') return;
  panel.dataset.bound = '1';

  document.getElementById('team-config-add-group')?.addEventListener('click', () => {
    const host = document.getElementById('team-config-groups');
    if (!host) return;
    host.dataset.editing = '1';
    host.insertAdjacentHTML('beforeend', buildGroupRowHtml(`gruppe_${Date.now().toString(36).slice(2, 6)}`, { label: '', members: [] }));
    delete host.dataset.editing;
  });

  document.getElementById('team-config-groups')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove-group-row]');
    if (!btn) return;
    const row = btn.closest('[data-group-row]');
    const host = document.getElementById('team-config-groups');
    if (row && host && host.querySelectorAll('[data-group-row]').length > 1) {
      row.remove();
    } else {
      window.showToast?.('Mindestens eine Gruppe behalten.', 'warning');
    }
  });

  document.getElementById('team-config-save-btn')?.addEventListener('click', () => saveTeamConfigFromAdmin());
  ['tenant-suppliers-laden', 'tenant-suppliers-metzgerei'].forEach((id) => {
    const supplierInput = document.getElementById(id);
    supplierInput?.addEventListener('focusin', () => { supplierInput.dataset.editing = '1'; });
    supplierInput?.addEventListener('focusout', () => { delete supplierInput.dataset.editing; });
  });
  fillSupplierAdminField();
  window.addEventListener('charculogic:tenant-settings', fillSupplierAdminField);
  loadVapidToAdminInput();

  const groupsHost = document.getElementById('team-config-groups');
  if (groupsHost) {
    groupsHost.addEventListener('focusin', () => { groupsHost.dataset.editing = '1'; });
    groupsHost.addEventListener('focusout', () => {
      setTimeout(() => { delete groupsHost.dataset.editing; }, 200);
    });
  }
}

function bindPushSettings() {
  const toggle = document.getElementById('team-push-toggle');
  const status = document.getElementById('team-push-status');
  if (!toggle || toggle.dataset.bound === '1') return;
  toggle.dataset.bound = '1';

  toggle.checked = isPushEnabledLocally();
  updatePushStatusLabel(status, toggle.checked);

  toggle.addEventListener('change', async () => {
    const enabled = toggle.checked;
    setPushEnabledLocally(enabled);
    updatePushStatusLabel(status, enabled);
    if (enabled) {
      const ok = await requestPushPermission();
      if (!ok) {
        toggle.checked = false;
        setPushEnabledLocally(false);
        updatePushStatusLabel(status, false);
      }
    }
  });
}

function updatePushStatusLabel(el, enabled) {
  if (!el) return;
  if (!('Notification' in window)) {
    el.textContent = 'Browser unterstützt keine System-Benachrichtigungen.';
    return;
  }
  if (Notification.permission === 'denied') {
    el.textContent = 'Benachrichtigungen sind im Browser blockiert.';
    return;
  }
  el.textContent = enabled
    ? 'Push aktiv: neue Team-Infos & Aufgaben für dich.'
    : 'Push aus – nur Anzeige in der App.';
}

async function requestPushPermission() {
  if (!('Notification' in window)) {
    window.showToast?.('Benachrichtigungen werden von diesem Browser nicht unterstützt.', 'warning');
    return false;
  }
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') {
    window.showToast?.('Bitte Benachrichtigungen in den Browser-Einstellungen erlauben.', 'warning');
    return false;
  }
  const result = await Notification.requestPermission();
  if (result !== 'granted') {
    window.showToast?.('Benachrichtigungen nicht erlaubt.', 'warning');
    return false;
  }
  return true;
}

async function registerFcmTokenIfPossible(employeeName) {
  const vapidKey = getStoredVapidKey();
  const firebase = configState.getFirebase();
  if (!vapidKey || !firebase?.messaging || !employeeName || !configState.tenantId) return;

  try {
    const messaging = firebase.messaging();
    const registration = await navigator.serviceWorker.ready;
    const token = await messaging.getToken({ vapidKey, serviceWorkerRegistration: registration });
    if (!token) return;

    const tokenId = token.slice(0, 48).replace(/[^a-zA-Z0-9]/g, '_');
    await writeFirestoreDocOrQueue({
      collectionPath: 'pushTokens',
      docId: tokenId,
      op: 'set',
      onlineData: {
        token,
        employeeName,
        tenantId: configState.tenantId,
        platform: 'web',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      queueData: {
        token,
        employeeName,
        tenantId: configState.tenantId,
        platform: 'web',
        updatedAt: new Date().toISOString(),
      },
      offlineMessage: 'Push-Token wird synchronisiert.',
    });
  } catch (err) {
    console.warn('[TeamConfig] FCM-Token Registrierung:', err);
  }
}

export async function syncPushRegistration() {
  if (!isPushEnabledLocally()) return;
  const employee = getActiveEmployeeNameLocal();
  if (!employee) return;
  const granted = await requestPushPermission();
  if (!granted) return;
  await registerFcmTokenIfPossible(employee);
}

/**
 * Setzt den Mandanten für Team-Config. Bei Wechsel (oder wenn noch kein
 * Snapshot-Listener läuft) wird teamDashboard neu abonniert — sonst bleiben
 * departmentAssignments leer und die Nutzerverwaltung zeigt keine Fachbereiche.
 * @param {string} tenantId
 * @returns {string}
 */
export function setTeamConfigTenantId(tenantId) {
  const next = String(tenantId || '').trim();
  if (!next) return configState.tenantId;

  const tenantChanged = next !== configState.tenantId;
  if (tenantChanged) {
    configState.tenantId = next;
    // Nicht die Zuordnung des vorherigen Mandanten anzeigen.
    configState.departmentAssignments = {};
  }
  // Globalen Tenant-Kontext mitziehen (andere Module + Rules-Pfade).
  if (next && getGlobalTenantId() !== next) {
    setGlobalTenantId(next);
  }

  // Neu abonnieren wenn: Mandant gewechselt, Listener fehlt, oder Zuordnungen noch leer
  // (z. B. früherer Stream mit permission-denied bevor Auth fertig war).
  const needsSubscribe = tenantChanged
    || (configState.db && !configState.unsubscribe)
    || (configState.db && !Object.keys(configState.departmentAssignments).length);
  if (needsSubscribe) {
    subscribeTeamConfig();
  }
  return configState.tenantId;
}

/**
 * Alle Fachbereiche als Mitwirkung (optional mit Primär).
 * @param {string} [primaryDepartment]
 * @param {{ canOrder?: boolean }} [options]
 * @returns {DepartmentAssignment}
 */
export function buildAllDepartmentsAssignment(primaryDepartment = PRIMARY_DEPARTMENT_NONE, options = {}) {
  const primary = normalizePrimaryDepartment(primaryDepartment, [...DEPARTMENT_KEYS]);
  return normalizeDepartmentAssignmentEntry({
    primaryDepartment: primary || PRIMARY_DEPARTMENT_NONE,
    departments: [...DEPARTMENT_KEYS],
    canOrder: options.canOrder === true,
  });
}

export function initTeamConfigModule(databaseInstance, options = {}) {
  configState.db = databaseInstance;
  configState.tenantId = options.tenantId || getGlobalTenantId() || '';
  configState.verifyPinCallable = null;
  configState.getFirebase = typeof options.getFirebase === 'function' ? options.getFirebase : configState.getFirebase;

  applyConfig(normalizeConfig(null));
  subscribeTeamConfig();
  bindAdminTeamConfigPanel();
  bindPushSettings();

  window.addEventListener('charculogic:active-employee-changed', () => {
    syncPushRegistration();
  });
}

export function refreshAdminTeamConfigPanel() {
  bindAdminTeamConfigPanel();
  const cfg = normalizeConfig({
    employees: configState.employees,
    groups: configState.groups,
    departmentAssignments: configState.departmentAssignments,
  });
  applyConfig(cfg);
  renderAdminTeamConfigForm(cfg);
}
