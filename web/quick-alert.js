/**
 * Schnellmelde- & Bedarfs-Modul.
 * Primär: Freitext → supply_alerts + supply_catalog (Stammdaten).
 * Schnell-Buttons wachsen aus der verwaltbaren Stammdaten-Tabelle.
 */

import { writeFirestoreDocOrQueue } from './sync.js';
import { getTenantCollection } from './tenant-db.js';
import {
  employeeCanResolveSupplyAlerts,
  employeeHasDepartment,
  getEmployeeDepartmentAssignment,
  getTeamEmployees,
} from './team-config.js';
import { ACTIVE_EMPLOYEE_STORAGE_KEY, readScopedLocalStorageValue } from './teamboard-storage.js';

const SUPPLY_ALERTS_COLLECTION = 'supply_alerts';
const SUPPLY_CATALOG_COLLECTION = 'supply_catalog';
const OPEN_STATUSES = new Set(['open', 'in_progress', 'ordered']);
/** Ab dieser Nutzungshäufigkeit erscheint ein Stammdaten-Eintrag als Schnell-Button. */
export const QUICK_BUTTON_MIN_USES = 2;

/**
 * Bedarfs-Art (Herkunft) – steuert auch, wer die Meldung sieht (departmentTarget).
 */
export const SUPPLY_CATEGORY_OPTIONS = [
  { value: 'eigene_produktion', label: 'Eigene Produktion', departmentTarget: 'metzgerei' },
  { value: 'zukauf_fleisch_wurst', label: 'Zukauf Fleisch & Wurst', departmentTarget: 'metzgerei' },
  { value: 'zukauf_laden', label: 'Zukauf Laden', departmentTarget: 'laden' },
  { value: 'verbrauchsmaterial', label: 'Verbrauch / Hygiene', departmentTarget: 'laden' },
  { value: 'sb_theke', label: 'SB-Theke nachfüllen', departmentTarget: 'metzgerei' },
  { value: 'sonstig', label: 'Sonstiges', departmentTarget: 'all' },
];

export const SUPPLY_DEPARTMENT_OPTIONS = [
  { value: 'all', label: 'Alle Bereiche' },
  { value: 'metzgerei', label: 'Metzgerei / Produktion' },
  { value: 'laden', label: 'Laden / Verkauf' },
  { value: 'einkauf', label: 'Einkauf / Büro' },
];

export const SUPPLY_CATEGORY_VALUES = SUPPLY_CATEGORY_OPTIONS.map((entry) => entry.value);
export const SUPPLY_DEPARTMENT_VALUES = SUPPLY_DEPARTMENT_OPTIONS.map((entry) => entry.value);

export function departmentTargetForCategory(category) {
  const match = SUPPLY_CATEGORY_OPTIONS.find((entry) => entry.value === category);
  return match?.departmentTarget || 'all';
}

export function departmentLabel(value) {
  const key = String(value || 'all').trim().toLowerCase();
  const match = SUPPLY_DEPARTMENT_OPTIONS.find((entry) => entry.value === key);
  return match?.label || 'Alle Bereiche';
}

/** Normalisiert departmentTarget aus Select/Katalog. */
export function normalizeDepartmentTarget(value) {
  const key = String(value || '').trim().toLowerCase();
  return SUPPLY_DEPARTMENT_VALUES.includes(key) ? key : 'all';
}

/**
 * Passt der Mitarbeiter zum gewählten Fachbereich (Primär, Mitwirkung oder Bedarfs-Recht)?
 * @param {string} employeeName
 * @param {string} departmentTarget
 */
export function employeeMatchesDepartmentTarget(employeeName, departmentTarget) {
  const target = normalizeDepartmentTarget(departmentTarget);
  if (target === 'all') return true;
  const assignment = getEmployeeDepartmentAssignment(employeeName);
  if (assignment.canOrder) return true;
  if (assignment.primaryDepartment === target) return true;
  return assignment.departments.includes(target);
}

const alertState = {
  db: null,
  tenantId: '',
  getFirebase: () => null,
  unsubscribeAlerts: null,
  unsubscribeCatalog: null,
  alerts: [],
  catalog: [],
  bound: false,
  adminBound: false,
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getActiveEmployeeName() {
  try {
    const fromGlobal = String(window.charculogic?.activeEmployee || '').trim();
    if (fromGlobal) return fromGlobal;
    if (typeof window.readActiveEmployee === 'function') {
      const fromApi = String(window.readActiveEmployee() || '').trim();
      if (fromApi) return fromApi;
    }
    const softLock = String(localStorage.getItem('charculogic.activeEmployee') || '').trim();
    if (softLock) return softLock;
    return readScopedLocalStorageValue(ACTIVE_EMPLOYEE_STORAGE_KEY, alertState.tenantId) || '';
  } catch (_) {
    return '';
  }
}

/** Normalisierter Schlüssel für Stammdaten-Deduplizierung. */
export function catalogKeyFromLabel(label) {
  const cleaned = String(label || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
  return cleaned || `item_${Date.now().toString(36)}`;
}

function alertsCollectionRef() {
  if (!alertState.db || !alertState.tenantId) return null;
  try {
    return getTenantCollection(SUPPLY_ALERTS_COLLECTION);
  } catch {
    return null;
  }
}

function catalogCollectionRef() {
  if (!alertState.db || !alertState.tenantId) return null;
  try {
    return getTenantCollection(SUPPLY_CATALOG_COLLECTION);
  } catch {
    return null;
  }
}

function statusLabel(status) {
  if (status === 'in_progress') return 'In Arbeit';
  if (status === 'ordered') return 'Bestellt';
  if (status === 'done') return 'Erledigt';
  return 'Offen';
}

/** CSS-/aria-Statusklasse für Inbox-Karten (open | in_progress | ordered | done). */
export function supplyAlertStatusClass(status) {
  const normalized = String(status || 'open').toLowerCase();
  if (OPEN_STATUSES.has(normalized) || normalized === 'done') return normalized;
  return 'open';
}

function categoryLabel(value) {
  const match = SUPPLY_CATEGORY_OPTIONS.find((entry) => entry.value === value);
  return match?.label || value || 'Sonstiges';
}

function namesMatch(left, right) {
  return String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase();
}

function alertVisibleForEmployee(alert, employeeName) {
  if (!alert || !OPEN_STATUSES.has(alert.status)) return false;
  if (!employeeName) return false;
  // Zugewiesene Person sieht die Meldung immer.
  if (alert.assignedTo && namesMatch(alert.assignedTo, employeeName)) return true;
  // Melder behält die Zeile auch nach Fachbereichs-Zuordnung (sonst „verschwindet“ sie).
  if (alert.createdBy && namesMatch(alert.createdBy, employeeName)) return true;
  const target = String(alert.departmentTarget || 'all').toLowerCase();
  if (target === 'all') return true;
  const assignment = getEmployeeDepartmentAssignment(employeeName);
  if (assignment.canOrder) return true;
  if (target === 'metzgerei') return assignment.departments.includes('metzgerei');
  if (target === 'laden') {
    return assignment.departments.includes('laden')
      || assignment.departments.includes('einkauf');
  }
  if (target === 'einkauf') {
    return assignment.departments.includes('einkauf')
      || assignment.departments.includes('laden');
  }
  return employeeHasDepartment(employeeName, target);
}

function canResolveAlert(alert, employeeName) {
  if (!employeeName || !alert) return false;
  if (alert.assignedTo && namesMatch(alert.assignedTo, employeeName)) return true;
  // Melder darf die eigene Meldung weiter bearbeiten/abhaken.
  if (alert.createdBy && namesMatch(alert.createdBy, employeeName)) return true;
  const target = String(alert.departmentTarget || 'all').toLowerCase();
  // Freie Bedarfsliste (all): jeder, der die Zeile sieht, darf abhaken – wie BRING!
  if (target === 'all' || target === '') {
    return alertVisibleForEmployee(alert, employeeName);
  }
  if (!employeeCanResolveSupplyAlerts(employeeName)) return false;
  const assignment = getEmployeeDepartmentAssignment(employeeName);
  if (assignment.canOrder) return true;
  if (target === 'metzgerei') return assignment.departments.includes('metzgerei');
  if (target === 'laden') {
    return assignment.departments.includes('laden')
      || assignment.departments.includes('einkauf');
  }
  if (target === 'einkauf') {
    return assignment.departments.includes('einkauf')
      || assignment.departments.includes('laden');
  }
  return true;
}

function normalizeAlertDoc(docSnap) {
  const data = docSnap.data() || {};
  return {
    id: docSnap.id,
    title: String(data.title || '').trim(),
    category: String(data.category || 'sonstig').trim(),
    departmentTarget: String(data.departmentTarget || 'all').trim(),
    urgency: String(data.urgency || 'nachbestellen').trim(),
    status: String(data.status || 'open').trim(),
    createdBy: String(data.createdBy || '').trim(),
    assignedTo: String(data.assignedTo || '').trim(),
    createdAt: data.createdAt || null,
    resolvedBy: data.resolvedBy || null,
    resolvedAt: data.resolvedAt || null,
    catalogItemId: String(data.catalogItemId || '').trim(),
    tenantId: String(data.tenantId || alertState.tenantId).trim(),
  };
}

function normalizeCatalogDoc(docSnap) {
  const data = typeof docSnap?.data === 'function' ? (docSnap.data() || {}) : (docSnap || {});
  const id = docSnap?.id || data.normalizedKey || catalogKeyFromLabel(data.label);
  const useCount = Number(data.useCount) || 0;
  const quickEnabled = data.quickEnabled === true
    || (data.quickEnabled !== false && useCount >= QUICK_BUTTON_MIN_USES);
  return {
    id: String(id),
    label: String(data.label || '').trim(),
    normalizedKey: String(data.normalizedKey || id).trim(),
    category: String(data.category || 'sonstig').trim(),
    departmentTarget: String(data.departmentTarget || 'all').trim(),
    urgencyDefault: String(data.urgencyDefault || 'nachbestellen').trim(),
    useCount,
    quickEnabled: data.quickEnabled === true ? true : (data.quickEnabled === false ? false : quickEnabled),
    active: data.active !== false,
    createdBy: String(data.createdBy || '').trim(),
    lastUsedBy: String(data.lastUsedBy || '').trim(),
    tenantId: String(data.tenantId || alertState.tenantId).trim(),
  };
}

/** Einträge, die als Schnell-Buttons erscheinen dürfen (nur Stammdaten). */
export function getQuickButtonCatalogItems(catalog = alertState.catalog) {
  return (Array.isArray(catalog) ? catalog : [])
    .filter((item) => item.active !== false && item.quickEnabled === true && item.label)
    .sort((a, b) => {
      if (b.useCount !== a.useCount) return b.useCount - a.useCount;
      return a.label.localeCompare(b.label, 'de', { sensitivity: 'base' });
    });
}

/**
 * Nur Schnell-Buttons aus Stammdaten (keine vorgefertigten Standardchips).
 * Alias zu getQuickButtonCatalogItems für bestehende Aufrufer.
 */
export function resolveQuickAlertButtons(catalog = alertState.catalog) {
  return getQuickButtonCatalogItems(catalog);
}

export function getSupplyCatalogItems() {
  return [...alertState.catalog].sort((a, b) => a.label.localeCompare(b.label, 'de', { sensitivity: 'base' }));
}

async function readCatalogItem(docId) {
  const ref = catalogCollectionRef();
  if (!ref || !docId) return null;
  try {
    const snap = await ref.doc(docId).get();
    return snap.exists ? normalizeCatalogDoc(snap) : null;
  } catch (err) {
    console.warn('[QuickAlert] Stammdaten lesen:', err);
    return null;
  }
}

/**
 * Schreibt/erhöht Stammdaten aus einer Freitext- oder Button-Meldung.
 * @returns {Promise<object>} aktualisierter Katalog-Eintrag
 */
export async function upsertSupplyCatalogFromReport({
  label,
  category = 'sonstig',
  departmentTarget = 'all',
  urgency = 'nachbestellen',
  employee,
  forceQuickEnabled = false,
} = {}) {
  const cleanLabel = String(label || '').trim().slice(0, 120);
  if (!cleanLabel) throw new Error('Bezeichnung fehlt');
  if (!alertState.tenantId) throw new Error('Mandant fehlt');

  const key = catalogKeyFromLabel(cleanLabel);
  const existing = await readCatalogItem(key);
  const firebase = alertState.getFirebase();
  const nextUseCount = (existing?.useCount || 0) + 1;
  let quickEnabled = existing?.quickEnabled === true;
  if (existing?.quickEnabled === false) {
    quickEnabled = false;
  } else if (forceQuickEnabled || nextUseCount >= QUICK_BUTTON_MIN_USES) {
    quickEnabled = true;
  }

  const actor = String(employee || getActiveEmployeeName() || 'Team').trim() || 'Team';
  const timestamp = firebase?.firestore?.FieldValue?.serverTimestamp?.() || new Date().toISOString();
  const payload = {
    label: existing?.label || cleanLabel,
    normalizedKey: key,
    category: existing?.category || String(category || 'sonstig'),
    departmentTarget: existing?.departmentTarget || String(departmentTarget || 'all'),
    urgencyDefault: existing?.urgencyDefault || String(urgency || 'nachbestellen'),
    useCount: nextUseCount,
    quickEnabled,
    active: existing?.active !== false,
    tenantId: alertState.tenantId,
    updatedAt: timestamp,
    lastUsedAt: timestamp,
    lastUsedBy: actor,
    createdAt: existing?.createdAt || timestamp,
    createdBy: existing?.createdBy || actor,
  };

  await writeFirestoreDocOrQueue({
    collectionPath: SUPPLY_CATALOG_COLLECTION,
    docId: key,
    op: 'set',
    onlineData: payload,
    queueData: {
      ...payload,
      updatedAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
      createdAt: existing?.createdAt || new Date().toISOString(),
    },
    offlineMessage: 'Stammdaten werden synchronisiert, sobald WLAN verfügbar ist.',
  });

  const next = normalizeCatalogDoc({ id: key, data: () => payload });
  const idx = alertState.catalog.findIndex((entry) => entry.id === key);
  if (idx >= 0) alertState.catalog[idx] = next;
  else alertState.catalog.push(next);
  renderQuickButtonGrid();
  renderSupplyCatalogAdminTable();
  window.dispatchEvent(new CustomEvent('charculogic:supply-catalog-changed', { detail: { items: getSupplyCatalogItems() } }));
  return next;
}

export async function updateSupplyCatalogItem(itemId, patch = {}) {
  const id = String(itemId || '').trim();
  if (!id) throw new Error('Stammdaten-ID fehlt');
  const existing = alertState.catalog.find((entry) => entry.id === id) || await readCatalogItem(id);
  if (!existing) throw new Error('Eintrag nicht gefunden');

  const firebase = alertState.getFirebase();
  const nextLabel = patch.label !== undefined
    ? String(patch.label || '').trim().slice(0, 120)
    : existing.label;
  if (!nextLabel) throw new Error('Bezeichnung fehlt');

  const payload = {
    label: nextLabel,
    normalizedKey: existing.normalizedKey || id,
    category: patch.category !== undefined ? String(patch.category) : existing.category,
    departmentTarget: patch.departmentTarget !== undefined
      ? String(patch.departmentTarget)
      : existing.departmentTarget,
    urgencyDefault: patch.urgencyDefault !== undefined
      ? String(patch.urgencyDefault)
      : existing.urgencyDefault,
    useCount: existing.useCount,
    quickEnabled: patch.quickEnabled !== undefined ? patch.quickEnabled === true : existing.quickEnabled,
    active: patch.active !== undefined ? patch.active !== false : existing.active,
    tenantId: alertState.tenantId,
    updatedAt: firebase?.firestore?.FieldValue?.serverTimestamp?.() || new Date().toISOString(),
    lastUsedAt: existing.lastUsedAt || null,
    lastUsedBy: existing.lastUsedBy || '',
    createdAt: existing.createdAt || null,
    createdBy: existing.createdBy || '',
  };

  await writeFirestoreDocOrQueue({
    collectionPath: SUPPLY_CATALOG_COLLECTION,
    docId: id,
    op: 'set',
    onlineData: payload,
    queueData: { ...payload, updatedAt: new Date().toISOString() },
    offlineMessage: 'Stammdaten werden synchronisiert, sobald WLAN verfügbar ist.',
  });

  const next = normalizeCatalogDoc({ id, data: () => payload });
  const idx = alertState.catalog.findIndex((entry) => entry.id === id);
  if (idx >= 0) alertState.catalog[idx] = next;
  else alertState.catalog.push(next);
  renderQuickButtonGrid();
  renderSupplyCatalogAdminTable();
  window.dispatchEvent(new CustomEvent('charculogic:supply-catalog-changed', { detail: { items: getSupplyCatalogItems() } }));
  return next;
}

export async function deleteSupplyCatalogItem(itemId) {
  const id = String(itemId || '').trim();
  if (!id) throw new Error('Stammdaten-ID fehlt');
  await writeFirestoreDocOrQueue({
    collectionPath: SUPPLY_CATALOG_COLLECTION,
    docId: id,
    op: 'delete',
    onlineData: {},
    queueData: {},
    offlineMessage: 'Löschen wird synchronisiert, sobald WLAN verfügbar ist.',
  });
  alertState.catalog = alertState.catalog.filter((entry) => entry.id !== id);
  renderQuickButtonGrid();
  renderSupplyCatalogAdminTable();
  window.dispatchEvent(new CustomEvent('charculogic:supply-catalog-changed', { detail: { items: getSupplyCatalogItems() } }));
}

export async function createSupplyAlert({
  title,
  category,
  departmentTarget,
  urgency,
  createdBy,
  assignedTo,
  catalogItemId,
  seedCatalog = true,
} = {}) {
  const cleanTitle = String(title || '').trim();
  if (!cleanTitle) throw new Error('Titel fehlt');
  const employee = String(createdBy || getActiveEmployeeName() || '').trim();
  if (!employee) {
    window.showToast?.('Bitte zuerst dein Profil wählen.', 'warning');
    throw new Error('Kein aktiver Mitarbeiter');
  }
  if (!alertState.tenantId) throw new Error('Mandant fehlt');

  let catalogId = String(catalogItemId || '').trim();
  let resolvedCategory = String(category || 'sonstig');
  if (!SUPPLY_CATEGORY_VALUES.includes(resolvedCategory)) {
    resolvedCategory = 'sonstig';
  }
  let resolvedDepartment = normalizeDepartmentTarget(
    departmentTarget || departmentTargetForCategory(resolvedCategory) || 'all',
  );
  let resolvedUrgency = String(urgency || 'nachbestellen');
  const resolvedAssignee = String(assignedTo || '').trim().slice(0, 80);

  const firebase = alertState.getFirebase();
  const docId = `sa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  // Zuerst Bedarf speichern – Stammdaten danach (darf die Meldung nicht blockieren).
  if (seedCatalog && !catalogId) {
    catalogId = catalogKeyFromLabel(cleanTitle);
  }

  const payload = {
    title: cleanTitle.slice(0, 160),
    category: resolvedCategory,
    departmentTarget: resolvedDepartment,
    urgency: resolvedUrgency,
    status: 'open',
    createdBy: employee,
    assignedTo: resolvedAssignee,
    createdAt: firebase?.firestore?.FieldValue?.serverTimestamp?.() || new Date().toISOString(),
    resolvedBy: null,
    resolvedAt: null,
    catalogItemId: catalogId || null,
    tenantId: alertState.tenantId,
  };

  await writeFirestoreDocOrQueue({
    collectionPath: SUPPLY_ALERTS_COLLECTION,
    docId,
    op: 'set',
    onlineData: payload,
    queueData: { ...payload, createdAt: new Date().toISOString() },
    offlineMessage: 'Bedarf wird synchronisiert, sobald WLAN verfügbar ist.',
  });

  if (seedCatalog) {
    try {
      const catalogItem = await upsertSupplyCatalogFromReport({
        label: cleanTitle,
        category: resolvedCategory,
        departmentTarget: resolvedDepartment,
        urgency: resolvedUrgency,
        employee,
      });
      catalogId = catalogItem.id;
    } catch (catalogErr) {
      console.warn('[QuickAlert] Stammdaten nachziehen fehlgeschlagen:', catalogErr);
    }
  }

  return { alertId: docId, catalogItemId: catalogId };
}

export async function updateSupplyAlertStatus(alertId, status, resolvedBy) {
  const id = String(alertId || '').trim();
  const nextStatus = String(status || '').trim();
  const allowed = new Set(['open', 'in_progress', 'ordered', 'done']);
  if (!id || !allowed.has(nextStatus)) {
    throw new Error('Status ungültig');
  }
  const employee = String(resolvedBy || getActiveEmployeeName() || '').trim();
  if (!employee) {
    window.showToast?.('Bitte zuerst dein Profil wählen.', 'warning');
    throw new Error('Kein aktiver Mitarbeiter');
  }
  const firebase = alertState.getFirebase();
  const payload = {
    status: nextStatus,
    resolvedBy: nextStatus === 'open' ? null : employee,
    resolvedAt: nextStatus === 'open'
      ? null
      : (firebase?.firestore?.FieldValue?.serverTimestamp?.() || new Date().toISOString()),
    updatedAt: firebase?.firestore?.FieldValue?.serverTimestamp?.() || new Date().toISOString(),
  };
  await writeFirestoreDocOrQueue({
    collectionPath: SUPPLY_ALERTS_COLLECTION,
    docId: id,
    op: 'update',
    onlineData: payload,
    queueData: {
      ...payload,
      resolvedAt: nextStatus === 'open' ? null : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    offlineMessage: 'Status wird synchronisiert, sobald WLAN verfügbar ist.',
  });
}

/** Nachträgliche Zuordnung: Person und/oder Fachbereich. */
export async function updateSupplyAlertAssignment(alertId, {
  assignedTo,
  departmentTarget,
  updatedBy,
} = {}) {
  const id = String(alertId || '').trim();
  if (!id) throw new Error('Meldung fehlt');
  const employee = String(updatedBy || getActiveEmployeeName() || '').trim();
  if (!employee) {
    window.showToast?.('Bitte zuerst dein Profil wählen.', 'warning');
    throw new Error('Kein aktiver Mitarbeiter');
  }
  const nextDepartment = normalizeDepartmentTarget(departmentTarget);
  const nextAssignee = String(assignedTo || '').trim().slice(0, 80);
  const firebase = alertState.getFirebase();
  const payload = {
    departmentTarget: nextDepartment,
    assignedTo: nextAssignee,
    updatedBy: employee,
    updatedAt: firebase?.firestore?.FieldValue?.serverTimestamp?.() || new Date().toISOString(),
  };
  await writeFirestoreDocOrQueue({
    collectionPath: SUPPLY_ALERTS_COLLECTION,
    docId: id,
    op: 'update',
    onlineData: payload,
    queueData: {
      ...payload,
      updatedAt: new Date().toISOString(),
    },
    offlineMessage: 'Zuordnung wird synchronisiert, sobald WLAN verfügbar ist.',
  });
  const local = alertState.alerts.find((entry) => entry.id === id);
  if (local) {
    local.departmentTarget = nextDepartment;
    local.assignedTo = nextAssignee;
  }
  renderSupplyAlertInbox();
}

function readSelectedDepartmentTarget() {
  const select = document.getElementById('quick-alert-department');
  if (select instanceof HTMLSelectElement) {
    return normalizeDepartmentTarget(select.value);
  }
  const category = document.getElementById('quick-alert-category')?.value || 'sonstig';
  return departmentTargetForCategory(category);
}

function syncDepartmentSelectFromCategory() {
  const categorySelect = document.getElementById('quick-alert-category');
  const deptSelect = document.getElementById('quick-alert-department');
  if (!(categorySelect instanceof HTMLSelectElement)) return;
  if (!(deptSelect instanceof HTMLSelectElement)) return;
  deptSelect.value = departmentTargetForCategory(categorySelect.value);
}

function populateAssigneeSelect(departmentTarget = readSelectedDepartmentTarget()) {
  const select = document.getElementById('quick-alert-assignee');
  if (!(select instanceof HTMLSelectElement)) return;
  const target = normalizeDepartmentTarget(departmentTarget);
  const previous = select.value;
  const names = getTeamEmployees()
    .map((name) => String(name || '').trim())
    .filter(Boolean)
    .filter((name) => employeeMatchesDepartmentTarget(name, target))
    .sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }));
  const niemandLabel = target === 'all'
    ? 'Niemand (alle Bereiche)'
    : `Niemand (${departmentLabel(target)})`;
  const options = [`<option value="">${escapeHtml(niemandLabel)}</option>`]
    .concat(names.map((name) => (
      `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`
    )));
  select.innerHTML = options.join('');
  if (previous && names.some((name) => namesMatch(name, previous))) {
    select.value = names.find((name) => namesMatch(name, previous)) || '';
  } else {
    select.value = '';
  }
}

function onQuickAlertCategoryChange() {
  syncDepartmentSelectFromCategory();
  populateAssigneeSelect(readSelectedDepartmentTarget());
}

function onQuickAlertDepartmentChange() {
  populateAssigneeSelect(readSelectedDepartmentTarget());
}

export function openQuickAlertModal() {
  const modal = document.getElementById('modal-quick-alert');
  if (!modal) return;
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  modal.classList.add('is-open');
  document.body.classList.add('quick-alert-open');
  syncDepartmentSelectFromCategory();
  populateAssigneeSelect(readSelectedDepartmentTarget());
  renderQuickButtonGrid();
  const input = document.getElementById('quick-alert-freetext');
  if (input) {
    input.value = '';
    setTimeout(() => input.focus(), 50);
  }
}

function closeQuickAlertModal() {
  const modal = document.getElementById('modal-quick-alert');
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  modal.classList.remove('is-open');
  document.body.classList.remove('quick-alert-open');
  const freetext = document.getElementById('quick-alert-freetext');
  if (freetext) freetext.value = '';
  const assignee = document.getElementById('quick-alert-assignee');
  if (assignee instanceof HTMLSelectElement) assignee.value = '';
  const category = document.getElementById('quick-alert-category');
  if (category instanceof HTMLSelectElement) category.value = 'sonstig';
  syncDepartmentSelectFromCategory();
}

function renderQuickButtonGrid() {
  const host = document.getElementById('quick-alert-grid');
  const empty = document.getElementById('quick-alert-empty');
  const hint = document.getElementById('quick-alert-buttons-hint');
  if (!host) return;

  const items = resolveQuickAlertButtons();
  if (!items.length) {
    host.innerHTML = '';
    if (empty) empty.hidden = false;
    if (hint) hint.hidden = true;
    return;
  }

  if (empty) empty.hidden = true;
  if (hint) {
    hint.hidden = false;
    hint.textContent = `${items.length} Schnell-Button${items.length === 1 ? '' : 's'} aus Stammdaten`;
  }
  host.innerHTML = items.map((item) => `
    <button
      type="button"
      class="quick-alert-tile"
      data-quick-alert-item="1"
      data-catalog-id="${escapeHtml(item.id)}"
      data-title="${escapeHtml(item.label)}"
      data-category="${escapeHtml(item.category)}"
      data-department="${escapeHtml(item.departmentTarget)}"
      data-urgency="${escapeHtml(item.urgencyDefault)}"
    >${escapeHtml(item.label)}</button>
  `).join('');
}

async function handleQuickAlertTap(button) {
  const title = String(button.getAttribute('data-title') || '').trim();
  if (!title) return;
  button.disabled = true;
  try {
    const category = button.getAttribute('data-category') || 'sonstig';
    const departmentTarget = normalizeDepartmentTarget(
      button.getAttribute('data-department') || departmentTargetForCategory(category),
    );
    const categorySelect = document.getElementById('quick-alert-category');
    const deptSelect = document.getElementById('quick-alert-department');
    if (categorySelect instanceof HTMLSelectElement && SUPPLY_CATEGORY_VALUES.includes(category)) {
      categorySelect.value = category;
    }
    if (deptSelect instanceof HTMLSelectElement) {
      deptSelect.value = departmentTarget;
    }
    populateAssigneeSelect(departmentTarget);
    await createSupplyAlert({
      title,
      category,
      departmentTarget,
      urgency: button.getAttribute('data-urgency') || 'nachbestellen',
      assignedTo: document.getElementById('quick-alert-assignee')?.value || '',
      catalogItemId: button.getAttribute('data-catalog-id') || '',
      seedCatalog: true,
    });
    window.showToast?.('Bedarf gemeldet!', 'success');
    closeQuickAlertModal();
  } catch (err) {
    console.error('[QuickAlert] Melden fehlgeschlagen:', err);
    if (!String(err?.message || '').includes('Kein aktiver')) {
      window.showToast?.(mapSupplyWriteError(err), 'error');
    }
  } finally {
    button.disabled = false;
  }
}

function mapSupplyWriteError(err) {
  const raw = `${err?.code || ''} ${err?.message || ''}`.toLowerCase();
  if (raw.includes('permission') || raw.includes('insufficient')) {
    return 'Speichern noch nicht freigeschaltet. Bitte App aktualisieren oder kurz im Büro Bescheid geben.';
  }
  return 'Bedarf konnte nicht gemeldet werden. Bitte noch einmal tippen.';
}

async function handleFreetextSubmit() {
  const input = document.getElementById('quick-alert-freetext');
  const title = String(input?.value || '').trim();
  if (!title) {
    window.showToast?.('Bitte kurz beschreiben, was fehlt.', 'warning');
    input?.focus();
    return;
  }
  const urgency = document.getElementById('quick-alert-urgency')?.value || 'nachbestellen';
  const category = document.getElementById('quick-alert-category')?.value || 'sonstig';
  const departmentTarget = readSelectedDepartmentTarget();
  const assignedTo = document.getElementById('quick-alert-assignee')?.value || '';
  const btn = document.getElementById('quick-alert-freetext-submit');
  if (btn) btn.disabled = true;
  try {
    await createSupplyAlert({
      title,
      category,
      departmentTarget,
      urgency,
      assignedTo,
      seedCatalog: true,
    });
    window.showToast?.('Bedarf gemeldet!', 'success');
    closeQuickAlertModal();
  } catch (err) {
    console.error('[QuickAlert] Freitext fehlgeschlagen:', err);
    if (!String(err?.message || '').includes('Kein aktiver')) {
      window.showToast?.(mapSupplyWriteError(err), 'error');
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

function updateSupplyAlertBadge(count = 0) {
  const badge = document.getElementById('btn-quick-alert-badge');
  if (badge) {
    badge.hidden = count === 0;
    badge.textContent = String(count);
  }
  const btn = document.getElementById('btn-quick-alert');
  if (btn) {
    btn.setAttribute('aria-label', count
      ? `Bedarf – ${count} offene Meldungen`
      : 'Bedarf öffnen');
    btn.classList.toggle('has-open-alerts', count > 0);
  }
}

function groupAlertsByCategory(alerts) {
  const groups = new Map();
  (Array.isArray(alerts) ? alerts : []).forEach((alert) => {
    const key = String(alert.category || 'sonstig');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(alert);
  });
  const order = SUPPLY_CATEGORY_OPTIONS.map((opt) => opt.value);
  return order
    .filter((key) => groups.has(key))
    .concat([...groups.keys()].filter((key) => !order.includes(key)))
    .map((key) => ({
      category: key,
      label: categoryLabel(key),
      items: groups.get(key) || [],
    }));
}

/** BRING!-ähnliche Checklistenzeile: Tippen = Erledigt, optional Bestellt + Zuordnen. */
function buildSupplyAlertListItem(alert, employeeName) {
  const status = supplyAlertStatusClass(alert.status);
  const isOrdered = status === 'ordered';
  const canResolve = canResolveAlert(alert, employeeName);
  const canAssign = Boolean(employeeName);
  const dept = normalizeDepartmentTarget(alert.departmentTarget);
  const metaParts = [];
  if (alert.createdBy) metaParts.push(`von ${alert.createdBy}`);
  if (alert.assignedTo) metaParts.push(`für ${alert.assignedTo}`);
  if (dept && dept !== 'all') metaParts.push(departmentLabel(dept));
  if (isOrdered) metaParts.push('bestellt');
  if (alert.urgency === 'sofort') metaParts.push('sofort');
  const orderedBtn = canResolve && !isOrdered
    ? `<button type="button" class="bedarf-check-ordered" data-supply-alert-status="ordered" data-alert-id="${escapeHtml(alert.id)}" aria-label="Als bestellt markieren">Bestellt</button>`
    : '';
  const assignBtn = canAssign
    ? `<button
        type="button"
        class="bedarf-check-assign"
        data-supply-alert-assign="${escapeHtml(alert.id)}"
        aria-label="Person oder Fachbereich zuordnen"
      >Zuordnen</button>`
    : '';
  const checkLabel = canResolve
    ? (isOrdered ? 'Als erledigt abhaken' : 'Abhaken / erledigen')
    : 'Nur Ansicht';
  return `
    <div
      class="bedarf-check-item bedarf-check-item--${escapeHtml(status)}${alert.urgency === 'sofort' ? ' bedarf-check-item--urgent' : ''}${canResolve ? ' is-interactive' : ''}"
      role="listitem"
      data-alert-id="${escapeHtml(alert.id)}"
      data-supply-status="${escapeHtml(status)}"
    >
      <button
        type="button"
        class="bedarf-check-toggle"
        data-supply-alert-status="done"
        data-alert-id="${escapeHtml(alert.id)}"
        aria-label="${escapeHtml(checkLabel)}"
        ${canResolve ? '' : 'disabled'}
      >
        <span class="bedarf-check-box" aria-hidden="true">${isOrdered ? '◐' : '○'}</span>
      </button>
      <div class="bedarf-check-body">
        <strong class="bedarf-check-title">${escapeHtml(alert.title)}</strong>
        ${metaParts.length ? `<span class="bedarf-check-meta">${escapeHtml(metaParts.join(' · '))}</span>` : ''}
      </div>
      <div class="bedarf-check-actions">
        ${assignBtn}
        ${orderedBtn}
      </div>
    </div>
  `;
}

/** Offene Meldungen als gruppierte Checkliste (kein Overlay-Banner). */
function renderSupplyAlertInbox() {
  const inbox = document.getElementById('supply-alert-inbox');
  const statusEl = document.getElementById('bedarf-module-status');
  const employee = getActiveEmployeeName();
  const visible = alertState.alerts.filter((alert) => alertVisibleForEmployee(alert, employee));
  const count = visible.length;

  updateSupplyAlertBadge(count);

  const banner = document.getElementById('supply-alert-banner');
  if (banner) {
    banner.hidden = true;
    banner.innerHTML = '';
  }

  if (!inbox) return;

  if (!employee) {
    if (statusEl) statusEl.textContent = 'Bitte Mitarbeiter wählen, dann siehst du die Liste.';
    inbox.innerHTML = '';
    return;
  }

  if (!count) {
    if (statusEl) statusEl.textContent = 'Liste leer – oben etwas eintragen.';
    inbox.innerHTML = '';
    return;
  }

  if (statusEl) {
    const canResolve = visible.some((alert) => canResolveAlert(alert, employee));
    const orderedCount = visible.filter((alert) => alert.status === 'ordered').length;
    const openCount = count - orderedCount;
    const parts = [];
    if (openCount > 0) parts.push(`${openCount} offen`);
    if (orderedCount > 0) parts.push(`${orderedCount} bestellt`);
    const summary = parts.join(' · ') || `${count} Einträge`;
    statusEl.textContent = canResolve
      ? `${summary} – Zeile tippen = erledigt`
      : summary;
  }

  const groups = groupAlertsByCategory(visible);
  inbox.innerHTML = groups.map((group) => `
    <section class="bedarf-check-group" aria-label="${escapeHtml(group.label)}">
      <h3 class="bedarf-check-group-title">${escapeHtml(group.label)}</h3>
      <div class="bedarf-check-group-items">
        ${group.items.map((alert) => buildSupplyAlertListItem(alert, employee)).join('')}
      </div>
    </section>
  `).join('');
}

/** Eigenes Modul öffnen (ohne Bottom-Nav-Tab – Einstieg über ⚡ / Start-CTA). */
export function openSupplyAlertModule() {
  document.querySelectorAll('#app-content .page').forEach((page) => {
    const active = page.id === 'page-bedarf';
    page.classList.toggle('active', active);
    page.style.display = active ? 'block' : 'none';
  });
  document.querySelectorAll('.nav-item[data-tab]').forEach((tab) => {
    tab.classList.remove('active');
  });
  document.body.classList.remove('admin-module-view');
  const headerTitle = document.getElementById('header-title');
  if (headerTitle) headerTitle.textContent = 'Bedarf';
  document.getElementById('app-content')?.scrollTo?.(0, 0);
  renderSupplyAlertInbox();
  const quickInput = document.getElementById('bedarf-quick-add-input');
  if (quickInput) setTimeout(() => quickInput.focus(), 40);
}

export function renderSupplyCatalogAdminTable() {
  const tbody = document.getElementById('dev-dashboard-supply-catalog-body');
  const statusEl = document.getElementById('dev-dashboard-supply-catalog-status');
  if (!tbody) return;

  const items = getSupplyCatalogItems();
  if (statusEl) {
    statusEl.textContent = items.length
      ? `${items.length} Stammdaten-Einträge · Schnell-Buttons ab ${QUICK_BUTTON_MIN_USES}× Nutzung oder manuell`
      : 'Noch keine Einträge – Meldungen per Freitext füllen die Liste.';
  }

  if (!items.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="dev-dashboard-empty-msg dev-dashboard-empty-msg--info">
          Noch keine Bedarfs-Stammdaten. Sobald jemand per Text meldet, erscheinen die Einträge hier.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = items.map((item) => `
    <tr data-catalog-row="${escapeHtml(item.id)}">
      <td>
        <input
          type="text"
          class="input-text-touch dev-dashboard-catalog-label"
          data-catalog-field="label"
          data-catalog-id="${escapeHtml(item.id)}"
          value="${escapeHtml(item.label)}"
          maxlength="120"
          aria-label="Bezeichnung"
        >
      </td>
      <td>
        <select
          class="dev-dashboard-catalog-select"
          data-catalog-field="category"
          data-catalog-id="${escapeHtml(item.id)}"
          aria-label="Kategorie"
        >
          ${SUPPLY_CATEGORY_OPTIONS.map((opt) => `
            <option value="${escapeHtml(opt.value)}" ${item.category === opt.value ? 'selected' : ''}>
              ${escapeHtml(opt.label)}
            </option>
          `).join('')}
        </select>
      </td>
      <td>
        <select
          class="dev-dashboard-catalog-select"
          data-catalog-field="departmentTarget"
          data-catalog-id="${escapeHtml(item.id)}"
          aria-label="Zuständigkeit"
        >
          ${SUPPLY_DEPARTMENT_OPTIONS.map((opt) => `
            <option value="${escapeHtml(opt.value)}" ${item.departmentTarget === opt.value ? 'selected' : ''}>
              ${escapeHtml(opt.label)}
            </option>
          `).join('')}
        </select>
      </td>
      <td class="dev-dashboard-catalog-count">${escapeHtml(String(item.useCount))}</td>
      <td>
        <label class="dev-dashboard-toggle dev-dashboard-toggle--compact">
          <input
            type="checkbox"
            data-catalog-field="quickEnabled"
            data-catalog-id="${escapeHtml(item.id)}"
            ${item.quickEnabled ? 'checked' : ''}
          >
          <span>Schnell-Button</span>
        </label>
        <label class="dev-dashboard-toggle dev-dashboard-toggle--compact">
          <input
            type="checkbox"
            data-catalog-field="active"
            data-catalog-id="${escapeHtml(item.id)}"
            ${item.active ? 'checked' : ''}
          >
          <span>Aktiv</span>
        </label>
      </td>
      <td>
        <button
          type="button"
          class="dev-dashboard-action-btn"
          data-catalog-save="${escapeHtml(item.id)}"
        >Speichern</button>
        <button
          type="button"
          class="dev-dashboard-action-btn dev-dashboard-action-btn--danger"
          data-catalog-delete="${escapeHtml(item.id)}"
          data-catalog-label="${escapeHtml(item.label)}"
        >Löschen</button>
      </td>
    </tr>
  `).join('');
}

function bindSupplyCatalogAdminUi() {
  const section = document.getElementById('dev-dashboard-supply-catalog');
  if (!section || alertState.adminBound) return;
  alertState.adminBound = true;

  section.addEventListener('click', async (event) => {
    const saveBtn = event.target.closest('[data-catalog-save]');
    if (saveBtn instanceof HTMLButtonElement) {
      const id = saveBtn.getAttribute('data-catalog-save');
      const row = section.querySelector(`[data-catalog-row="${String(id).replace(/"/g, '')}"]`);
      if (!row) return;
      const label = row.querySelector('[data-catalog-field="label"]')?.value;
      const category = row.querySelector('[data-catalog-field="category"]')?.value;
      const departmentTarget = row.querySelector('[data-catalog-field="departmentTarget"]')?.value;
      const quickEnabled = row.querySelector('[data-catalog-field="quickEnabled"]')?.checked === true;
      const active = row.querySelector('[data-catalog-field="active"]')?.checked === true;
      saveBtn.disabled = true;
      try {
        await updateSupplyCatalogItem(id, {
          label,
          category,
          departmentTarget,
          quickEnabled,
          active,
        });
        window.showToast?.('Stammdaten gespeichert.', 'success');
      } catch (err) {
        console.error('[QuickAlert] Stammdaten speichern:', err);
        window.showToast?.('Stammdaten konnten nicht gespeichert werden.', 'error');
      } finally {
        saveBtn.disabled = false;
      }
      return;
    }

    const deleteBtn = event.target.closest('[data-catalog-delete]');
    if (deleteBtn instanceof HTMLButtonElement) {
      const id = deleteBtn.getAttribute('data-catalog-delete');
      const label = deleteBtn.getAttribute('data-catalog-label') || 'Eintrag';
      if (!window.confirm(`„${label}“ aus den Stammdaten löschen?`)) return;
      deleteBtn.disabled = true;
      try {
        await deleteSupplyCatalogItem(id);
        window.showToast?.('Stammdaten-Eintrag gelöscht.', 'success');
      } catch (err) {
        console.error('[QuickAlert] Stammdaten löschen:', err);
        window.showToast?.('Löschen fehlgeschlagen.', 'error');
        deleteBtn.disabled = false;
      }
    }
  });
}

function subscribeSupplyAlerts() {
  alertState.unsubscribeAlerts?.();
  alertState.unsubscribeAlerts = null;
  const ref = alertsCollectionRef();
  if (!ref) return;

  alertState.unsubscribeAlerts = ref
    .where('status', 'in', ['open', 'in_progress', 'ordered'])
    .limit(40)
    .onSnapshot(
      (snap) => {
        alertState.alerts = snap.docs.map(normalizeAlertDoc)
          .sort((a, b) => {
            const aUrgency = a.urgency === 'sofort' ? 0 : 1;
            const bUrgency = b.urgency === 'sofort' ? 0 : 1;
            if (aUrgency !== bUrgency) return aUrgency - bUrgency;
            return String(b.id).localeCompare(String(a.id));
          });
        renderSupplyAlertInbox();
      },
      (err) => {
        console.warn('[QuickAlert] Alerts-Snapshot:', err);
      },
    );
}

function subscribeSupplyCatalog() {
  alertState.unsubscribeCatalog?.();
  alertState.unsubscribeCatalog = null;
  const ref = catalogCollectionRef();
  if (!ref) return;

  alertState.unsubscribeCatalog = ref
    .limit(200)
    .onSnapshot(
      (snap) => {
        alertState.catalog = snap.docs.map(normalizeCatalogDoc);
        renderQuickButtonGrid();
        renderSupplyCatalogAdminTable();
      },
      (err) => {
        console.warn('[QuickAlert] Catalog-Snapshot:', err);
      },
    );
}

function populateAssignModalAssigneeSelect(departmentTarget, selectedName = '') {
  const select = document.getElementById('bedarf-assign-assignee');
  if (!(select instanceof HTMLSelectElement)) return;
  const target = normalizeDepartmentTarget(departmentTarget);
  const names = getTeamEmployees()
    .map((name) => String(name || '').trim())
    .filter(Boolean)
    .filter((name) => employeeMatchesDepartmentTarget(name, target))
    .sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }));
  const niemandLabel = target === 'all'
    ? 'Niemand (alle Bereiche)'
    : `Niemand (${departmentLabel(target)})`;
  select.innerHTML = [`<option value="">${escapeHtml(niemandLabel)}</option>`]
    .concat(names.map((name) => (
      `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`
    )))
    .join('');
  if (selectedName && names.some((name) => namesMatch(name, selectedName))) {
    select.value = names.find((name) => namesMatch(name, selectedName)) || '';
  } else {
    select.value = '';
  }
}

export function openBedarfAssignModal(alertId) {
  const id = String(alertId || '').trim();
  const alert = alertState.alerts.find((entry) => entry.id === id);
  const modal = document.getElementById('modal-bedarf-assign');
  if (!alert || !modal) return;
  const employee = getActiveEmployeeName();
  if (!employee) {
    window.showToast?.('Bitte zuerst dein Profil wählen.', 'warning');
    return;
  }
  const idInput = document.getElementById('bedarf-assign-alert-id');
  const titleEl = document.getElementById('bedarf-assign-item-title');
  const deptSelect = document.getElementById('bedarf-assign-department');
  if (idInput) idInput.value = alert.id;
  if (titleEl) titleEl.textContent = alert.title || 'Bedarf';
  const dept = normalizeDepartmentTarget(alert.departmentTarget);
  if (deptSelect instanceof HTMLSelectElement) deptSelect.value = dept;
  populateAssignModalAssigneeSelect(dept, alert.assignedTo || '');
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  modal.classList.add('is-open');
  document.body.classList.add('bedarf-assign-open');
}

function closeBedarfAssignModal() {
  const modal = document.getElementById('modal-bedarf-assign');
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  modal.classList.remove('is-open');
  document.body.classList.remove('bedarf-assign-open');
  const idInput = document.getElementById('bedarf-assign-alert-id');
  if (idInput) idInput.value = '';
}

async function handleBedarfAssignSave() {
  const id = String(document.getElementById('bedarf-assign-alert-id')?.value || '').trim();
  const departmentTarget = normalizeDepartmentTarget(
    document.getElementById('bedarf-assign-department')?.value,
  );
  const assignedTo = document.getElementById('bedarf-assign-assignee')?.value || '';
  const btn = document.getElementById('bedarf-assign-save');
  if (!id) return;
  if (btn) btn.disabled = true;
  try {
    await updateSupplyAlertAssignment(id, { departmentTarget, assignedTo });
    window.showToast?.('Zuordnung gespeichert.', 'success');
    closeBedarfAssignModal();
  } catch (err) {
    console.error('[QuickAlert] Zuordnung speichern fehlgeschlagen:', err);
    window.showToast?.(mapSupplyWriteError(err), 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function handleSupplyAlertStatusClick(event) {
  if (event.target.closest('[data-supply-alert-assign]')) return;

  const statusBtn = event.target.closest('[data-supply-alert-status]');
  const row = event.target.closest('.bedarf-check-item.is-interactive');
  let alertId = null;
  let status = null;
  let control = null;

  if (statusBtn instanceof HTMLButtonElement) {
    if (statusBtn.disabled) return;
    alertId = statusBtn.getAttribute('data-alert-id');
    status = statusBtn.getAttribute('data-supply-alert-status');
    control = statusBtn;
  } else if (row) {
    // Zeile tippen (Titel/Meta) = erledigen – wie BRING!
    alertId = row.getAttribute('data-alert-id');
    status = 'done';
    control = row.querySelector('.bedarf-check-toggle');
    if (control?.disabled) return;
  } else {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  if (control) control.disabled = true;
  try {
    await updateSupplyAlertStatus(alertId, status);
    window.showToast?.(
      status === 'ordered' ? 'Als bestellt markiert.' : 'Erledigt – von der Liste genommen.',
      'success',
    );
  } catch (err) {
    console.error('[QuickAlert] Status aktualisieren fehlgeschlagen:', err);
    window.showToast?.('Status konnte nicht gespeichert werden.', 'error');
    if (control) control.disabled = false;
  }
}

async function handleBedarfQuickAdd(event) {
  event?.preventDefault?.();
  const input = document.getElementById('bedarf-quick-add-input');
  const title = String(input?.value || '').trim();
  if (!title) {
    window.showToast?.('Bitte kurz beschreiben, was fehlt.', 'warning');
    input?.focus();
    return;
  }
  const btn = document.getElementById('bedarf-quick-add-btn');
  if (btn) btn.disabled = true;
  try {
    await createSupplyAlert({
      title,
      category: 'sonstig',
      departmentTarget: 'all',
      urgency: 'nachbestellen',
      seedCatalog: true,
    });
    if (input) input.value = '';
    window.showToast?.('Zur Liste hinzugefügt.', 'success');
    input?.focus();
  } catch (err) {
    console.error('[QuickAlert] Schnell-Hinzufügen fehlgeschlagen:', err);
    if (!String(err?.message || '').includes('Kein aktiver')) {
      window.showToast?.(mapSupplyWriteError(err), 'error');
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

function bindQuickAlertUi() {
  if (alertState.bound) return;
  alertState.bound = true;

  document.getElementById('btn-quick-alert')?.addEventListener('click', () => {
    openSupplyAlertModule();
  });

  document.getElementById('btn-supply-alert-start')?.addEventListener('click', () => {
    openSupplyAlertModule();
  });

  document.getElementById('btn-bedarf-melden')?.addEventListener('click', () => {
    openQuickAlertModal();
  });

  document.getElementById('bedarf-quick-add')?.addEventListener('submit', (event) => {
    void handleBedarfQuickAdd(event);
  });

  document.getElementById('quick-alert-close')?.addEventListener('click', () => {
    closeQuickAlertModal();
  });

  document.getElementById('modal-quick-alert')?.addEventListener('click', (event) => {
    if (event.target?.id === 'modal-quick-alert' || event.target?.dataset?.quickAlertDismiss === '1') {
      closeQuickAlertModal();
    }
  });

  document.getElementById('quick-alert-grid')?.addEventListener('click', (event) => {
    const tile = event.target.closest('[data-quick-alert-item]');
    if (tile) handleQuickAlertTap(tile);
  });

  document.getElementById('quick-alert-freetext-submit')?.addEventListener('click', () => {
    handleFreetextSubmit();
  });

  document.getElementById('quick-alert-freetext')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleFreetextSubmit();
    }
  });

  document.getElementById('quick-alert-category')?.addEventListener('change', () => {
    onQuickAlertCategoryChange();
  });

  document.getElementById('quick-alert-department')?.addEventListener('change', () => {
    onQuickAlertDepartmentChange();
  });

  document.getElementById('supply-alert-inbox')?.addEventListener('click', (event) => {
    const assignBtn = event.target.closest('[data-supply-alert-assign]');
    if (assignBtn instanceof HTMLButtonElement) {
      event.preventDefault();
      event.stopPropagation();
      openBedarfAssignModal(assignBtn.getAttribute('data-supply-alert-assign'));
      return;
    }
    void handleSupplyAlertStatusClick(event);
  });

  document.getElementById('bedarf-assign-close')?.addEventListener('click', () => {
    closeBedarfAssignModal();
  });
  document.getElementById('bedarf-assign-cancel')?.addEventListener('click', () => {
    closeBedarfAssignModal();
  });
  document.getElementById('bedarf-assign-save')?.addEventListener('click', () => {
    void handleBedarfAssignSave();
  });
  document.getElementById('bedarf-assign-department')?.addEventListener('change', () => {
    const dept = normalizeDepartmentTarget(
      document.getElementById('bedarf-assign-department')?.value,
    );
    const previous = document.getElementById('bedarf-assign-assignee')?.value || '';
    populateAssignModalAssigneeSelect(dept, previous);
  });
  document.getElementById('modal-bedarf-assign')?.addEventListener('click', (event) => {
    if (
      event.target?.id === 'modal-bedarf-assign'
      || event.target?.dataset?.bedarfAssignDismiss === '1'
    ) {
      closeBedarfAssignModal();
    }
  });

  window.addEventListener('charculogic:active-employee-changed', () => {
    renderSupplyAlertInbox();
  });
  window.addEventListener('charculogic:team-config-changed', () => {
    renderSupplyAlertInbox();
    if (document.body.classList.contains('quick-alert-open')) {
      populateAssigneeSelect(readSelectedDepartmentTarget());
    }
    if (document.body.classList.contains('bedarf-assign-open')) {
      const dept = normalizeDepartmentTarget(
        document.getElementById('bedarf-assign-department')?.value,
      );
      const previous = document.getElementById('bedarf-assign-assignee')?.value || '';
      populateAssignModalAssigneeSelect(dept, previous);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (document.body.classList.contains('bedarf-assign-open')) {
      closeBedarfAssignModal();
      return;
    }
    if (document.body.classList.contains('quick-alert-open')) {
      closeQuickAlertModal();
    }
  });
}

export function initQuickAlertModule(databaseInstance, options = {}) {
  alertState.db = databaseInstance;
  alertState.tenantId = options.tenantId || '';
  alertState.getFirebase = typeof options.getFirebase === 'function'
    ? options.getFirebase
    : () => null;

  bindQuickAlertUi();
  bindSupplyCatalogAdminUi();
  renderQuickButtonGrid();
  renderSupplyCatalogAdminTable();
  subscribeSupplyAlerts();
  subscribeSupplyCatalog();
  renderSupplyAlertInbox();
}

export function getOpenSupplyAlertsForTest() {
  return [...alertState.alerts];
}

export function categoryLabelForTest(value) {
  return categoryLabel(value);
}
