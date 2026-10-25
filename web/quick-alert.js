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
} from './team-config.js';
import { ACTIVE_EMPLOYEE_STORAGE_KEY, readScopedLocalStorageValue } from './teamboard-storage.js';

const SUPPLY_ALERTS_COLLECTION = 'supply_alerts';
const SUPPLY_CATALOG_COLLECTION = 'supply_catalog';
const OPEN_STATUSES = new Set(['open', 'in_progress', 'ordered']);
/** Ab dieser Nutzungshäufigkeit erscheint ein Stammdaten-Eintrag als Schnell-Button. */
export const QUICK_BUTTON_MIN_USES = 2;

export const SUPPLY_CATEGORY_OPTIONS = [
  { value: 'sonstig', label: 'Sonstiges' },
  { value: 'sb_theke', label: 'SB-Theke' },
  { value: 'metzgerei_bedarf', label: 'Metzgerei' },
  { value: 'verbrauchsmaterial', label: 'Laden / Hygiene' },
];

export const SUPPLY_DEPARTMENT_OPTIONS = [
  { value: 'all', label: 'Alle' },
  { value: 'metzgerei', label: 'Metzgerei' },
  { value: 'laden', label: 'Laden' },
];

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

function categoryLabel(value) {
  const match = SUPPLY_CATEGORY_OPTIONS.find((entry) => entry.value === value);
  return match?.label || value || 'Sonstiges';
}

function alertVisibleForEmployee(alert, employeeName) {
  if (!alert || !OPEN_STATUSES.has(alert.status)) return false;
  const target = String(alert.departmentTarget || 'all').toLowerCase();
  if (target === 'all') return true;
  if (!employeeName) return false;
  const assignment = getEmployeeDepartmentAssignment(employeeName);
  if (assignment.canOrder) return true;
  if (target === 'metzgerei') return assignment.departments.includes('metzgerei');
  if (target === 'laden') {
    return assignment.departments.includes('laden')
      || assignment.departments.includes('einkauf');
  }
  return employeeHasDepartment(employeeName, target);
}

function canResolveAlert(alert, employeeName) {
  if (!employeeName || !alert) return false;
  if (!employeeCanResolveSupplyAlerts(employeeName)) return false;
  const assignment = getEmployeeDepartmentAssignment(employeeName);
  if (assignment.canOrder) return true;
  const target = String(alert.departmentTarget || '').toLowerCase();
  if (target === 'metzgerei') return assignment.departments.includes('metzgerei');
  if (target === 'laden') {
    return assignment.departments.includes('laden')
      || assignment.departments.includes('einkauf');
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

/** Einträge, die als Schnell-Buttons erscheinen dürfen. */
export function getQuickButtonCatalogItems(catalog = alertState.catalog) {
  return (Array.isArray(catalog) ? catalog : [])
    .filter((item) => item.active !== false && item.quickEnabled === true && item.label)
    .sort((a, b) => {
      if (b.useCount !== a.useCount) return b.useCount - a.useCount;
      return a.label.localeCompare(b.label, 'de', { sensitivity: 'base' });
    });
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
  let resolvedDepartment = String(departmentTarget || 'all');
  let resolvedUrgency = String(urgency || 'nachbestellen');

  if (seedCatalog) {
    const catalogItem = await upsertSupplyCatalogFromReport({
      label: cleanTitle,
      category: resolvedCategory,
      departmentTarget: resolvedDepartment,
      urgency: resolvedUrgency,
      employee,
    });
    catalogId = catalogItem.id;
    resolvedCategory = catalogItem.category;
    resolvedDepartment = catalogItem.departmentTarget;
    resolvedUrgency = catalogItem.urgencyDefault;
  }

  const firebase = alertState.getFirebase();
  const payload = {
    title: cleanTitle.slice(0, 160),
    category: resolvedCategory,
    departmentTarget: resolvedDepartment,
    urgency: resolvedUrgency,
    status: 'open',
    createdBy: employee,
    createdAt: firebase?.firestore?.FieldValue?.serverTimestamp?.() || new Date().toISOString(),
    resolvedBy: null,
    resolvedAt: null,
    catalogItemId: catalogId || null,
    tenantId: alertState.tenantId,
  };

  const docId = `sa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  await writeFirestoreDocOrQueue({
    collectionPath: SUPPLY_ALERTS_COLLECTION,
    docId,
    op: 'set',
    onlineData: payload,
    queueData: { ...payload, createdAt: new Date().toISOString() },
    offlineMessage: 'Bedarf wird synchronisiert, sobald WLAN verfügbar ist.',
  });
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

function openQuickAlertModal() {
  const modal = document.getElementById('modal-quick-alert');
  if (!modal) return;
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  modal.classList.add('is-open');
  document.body.classList.add('quick-alert-open');
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
}

function renderQuickButtonGrid() {
  const host = document.getElementById('quick-alert-grid');
  const empty = document.getElementById('quick-alert-empty');
  const hint = document.getElementById('quick-alert-buttons-hint');
  if (!host) return;

  const items = getQuickButtonCatalogItems();
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
    await createSupplyAlert({
      title,
      category: button.getAttribute('data-category') || 'sonstig',
      departmentTarget: button.getAttribute('data-department') || 'all',
      urgency: button.getAttribute('data-urgency') || 'nachbestellen',
      catalogItemId: button.getAttribute('data-catalog-id') || '',
      seedCatalog: true,
    });
    window.showToast?.('Bedarf gemeldet!', 'success');
    closeQuickAlertModal();
  } catch (err) {
    console.error('[QuickAlert] Melden fehlgeschlagen:', err);
    if (!String(err?.message || '').includes('Kein aktiver')) {
      window.showToast?.('Bedarf konnte nicht gemeldet werden. Bitte noch einmal tippen.', 'error');
    }
  } finally {
    button.disabled = false;
  }
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
  const department = document.getElementById('quick-alert-department')?.value || 'all';
  const btn = document.getElementById('quick-alert-freetext-submit');
  if (btn) btn.disabled = true;
  try {
    await createSupplyAlert({
      title,
      category: 'sonstig',
      departmentTarget: department,
      urgency,
      seedCatalog: true,
    });
    window.showToast?.('Bedarf gemeldet!', 'success');
    closeQuickAlertModal();
  } catch (err) {
    console.error('[QuickAlert] Freitext fehlgeschlagen:', err);
    if (!String(err?.message || '').includes('Kein aktiver')) {
      window.showToast?.('Bedarf konnte nicht gemeldet werden. Bitte noch einmal tippen.', 'error');
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

function renderAlertBanner() {
  const banner = document.getElementById('supply-alert-banner');
  const badge = document.getElementById('btn-quick-alert-badge');
  if (!banner) return;

  const employee = getActiveEmployeeName();
  const visible = alertState.alerts.filter((alert) => alertVisibleForEmployee(alert, employee));
  const count = visible.length;

  if (badge) {
    badge.hidden = count === 0;
    badge.textContent = String(count);
  }

  const btn = document.getElementById('btn-quick-alert');
  if (btn) {
    btn.setAttribute('aria-label', count
      ? `Bedarf melden – ${count} offene Bedarfe`
      : 'Bedarf melden');
    btn.classList.toggle('has-open-alerts', count > 0);
  }

  if (!count || !employee) {
    banner.hidden = true;
    banner.innerHTML = '';
    return;
  }

  const canResolve = visible.some((alert) => canResolveAlert(alert, employee));
  const preview = visible.slice(0, 3).map((alert) => {
    const actions = canResolveAlert(alert, employee)
      ? `
        <span class="supply-alert-actions">
          <button type="button" class="supply-alert-action" data-supply-alert-status="ordered" data-alert-id="${escapeHtml(alert.id)}">Bestellt</button>
          <button type="button" class="supply-alert-action supply-alert-action--done" data-supply-alert-status="done" data-alert-id="${escapeHtml(alert.id)}">Erledigt</button>
        </span>
      `
      : '';
    return `
      <li class="supply-alert-item supply-alert-item--${escapeHtml(alert.urgency)}">
        <div class="supply-alert-item-main">
          <strong>${escapeHtml(alert.title)}</strong>
          <span class="supply-alert-meta">von ${escapeHtml(alert.createdBy)} · ${escapeHtml(statusLabel(alert.status))}</span>
        </div>
        ${actions}
      </li>
    `;
  }).join('');

  banner.hidden = false;
  banner.innerHTML = `
    <div class="supply-alert-banner-head">
      <strong>${count} offene ${count === 1 ? 'Bedarfsmeldung' : 'Bedarfsmeldungen'}</strong>
      ${canResolve ? '<span class="supply-alert-banner-hint">Tippe Bestellt oder Erledigt</span>' : ''}
    </div>
    <ul class="supply-alert-list">${preview}</ul>
  `;
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
        renderAlertBanner();
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

function bindQuickAlertUi() {
  if (alertState.bound) return;
  alertState.bound = true;

  document.getElementById('btn-quick-alert')?.addEventListener('click', () => {
    openQuickAlertModal();
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

  document.getElementById('supply-alert-banner')?.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-supply-alert-status]');
    if (!(btn instanceof HTMLButtonElement)) return;
    const alertId = btn.getAttribute('data-alert-id');
    const status = btn.getAttribute('data-supply-alert-status');
    btn.disabled = true;
    try {
      await updateSupplyAlertStatus(alertId, status);
      window.showToast?.(
        status === 'ordered' ? 'Als bestellt markiert.' : 'Als erledigt markiert.',
        'success',
      );
    } catch (err) {
      console.error('[QuickAlert] Status aktualisieren fehlgeschlagen:', err);
      window.showToast?.('Status konnte nicht gespeichert werden.', 'error');
    } finally {
      btn.disabled = false;
    }
  });

  window.addEventListener('charculogic:active-employee-changed', () => {
    renderAlertBanner();
  });
  window.addEventListener('charculogic:team-config-changed', () => {
    renderAlertBanner();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.body.classList.contains('quick-alert-open')) {
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
  renderAlertBanner();
}

export function getOpenSupplyAlertsForTest() {
  return [...alertState.alerts];
}

export function categoryLabelForTest(value) {
  return categoryLabel(value);
}
