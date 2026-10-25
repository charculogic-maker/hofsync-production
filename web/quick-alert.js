/**
 * Schnellmelde- & Bedarfs-Modul (1-Tap Supply Alerts).
 * Speichert unter tenants/{tenantId}/supply_alerts und filtert nach Fachbereich.
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
const OPEN_STATUSES = new Set(['open', 'in_progress', 'ordered']);

/** @type {{ category: string, label: string, urgency: string, departmentTarget: string, items: Array<{ title: string, label: string }> }[]} */
export const QUICK_ALERT_CATEGORIES = [
  {
    category: 'sb_theke',
    label: '⚡ SB-Theke leer',
    urgency: 'sofort',
    departmentTarget: 'metzgerei',
    items: [
      { title: 'Weißwurst SB-Theke leer', label: 'Weißwurst' },
      { title: 'Hackfleisch SB-Theke leer', label: 'Hackfleisch' },
      { title: 'Rouladen SB-Theke leer', label: 'Rouladen' },
      { title: 'Käsekrainer SB-Theke leer', label: 'Käsekrainer' },
    ],
  },
  {
    category: 'metzgerei_bedarf',
    label: '🔪 Metzgerei-Material',
    urgency: 'nachbestellen',
    departmentTarget: 'metzgerei',
    items: [
      { title: 'Siegelrandbeutel knapp', label: 'Siegelrandbeutel' },
      { title: 'Wurstdärme knapp', label: 'Wurstdärme' },
      { title: 'Pökelsalz/Gewürze knapp', label: 'Pökelsalz/Gewürze' },
      { title: 'Vakuumbeutel groß knapp', label: 'Vakuumbeutel groß' },
    ],
  },
  {
    category: 'verbrauchsmaterial',
    label: '🧻 Laden & Hygiene',
    urgency: 'nachbestellen',
    departmentTarget: 'laden',
    items: [
      { title: 'Handtuchpapier knapp', label: 'Handtuchpapier' },
      { title: 'Bonrollen knapp', label: 'Bonrollen' },
      { title: 'Avery-Etiketten knapp', label: 'Avery-Etiketten' },
      { title: 'Seife/Desinfektion knapp', label: 'Seife/Desinfektion' },
    ],
  },
];

const alertState = {
  db: null,
  tenantId: '',
  getFirebase: () => null,
  unsubscribe: null,
  alerts: [],
  activeCategory: 'sb_theke',
  bound: false,
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

function alertsCollectionRef() {
  if (!alertState.db || !alertState.tenantId) return null;
  try {
    return getTenantCollection(SUPPLY_ALERTS_COLLECTION);
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

function alertVisibleForEmployee(alert, employeeName) {
  if (!alert || !OPEN_STATUSES.has(alert.status)) return false;
  const target = String(alert.departmentTarget || 'all').toLowerCase();
  if (target === 'all') return true;
  if (!employeeName) return false;
  const assignment = getEmployeeDepartmentAssignment(employeeName);
  if (assignment.canOrder) return true;
  if (target === 'metzgerei') {
    return assignment.departments.includes('metzgerei');
  }
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
    category: String(data.category || '').trim(),
    departmentTarget: String(data.departmentTarget || 'all').trim(),
    urgency: String(data.urgency || 'nachbestellen').trim(),
    status: String(data.status || 'open').trim(),
    createdBy: String(data.createdBy || '').trim(),
    createdAt: data.createdAt || null,
    resolvedBy: data.resolvedBy || null,
    resolvedAt: data.resolvedAt || null,
    tenantId: String(data.tenantId || alertState.tenantId).trim(),
  };
}

export async function createSupplyAlert({
  title,
  category,
  departmentTarget,
  urgency,
  createdBy,
} = {}) {
  const cleanTitle = String(title || '').trim();
  if (!cleanTitle) throw new Error('Titel fehlt');
  const employee = String(createdBy || getActiveEmployeeName() || '').trim();
  if (!employee) {
    window.showToast?.('Bitte zuerst dein Profil wählen.', 'warning');
    throw new Error('Kein aktiver Mitarbeiter');
  }
  if (!alertState.tenantId) throw new Error('Mandant fehlt');

  const firebase = alertState.getFirebase();
  const payload = {
    title: cleanTitle.slice(0, 160),
    category: String(category || 'verbrauchsmaterial'),
    departmentTarget: String(departmentTarget || 'all'),
    urgency: String(urgency || 'nachbestellen'),
    status: 'open',
    createdBy: employee,
    createdAt: firebase?.firestore?.FieldValue?.serverTimestamp?.() || new Date().toISOString(),
    resolvedBy: null,
    resolvedAt: null,
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
  return docId;
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
  renderQuickAlertGrid();
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

function renderQuickAlertTabs() {
  const host = document.getElementById('quick-alert-tabs');
  if (!host) return;
  host.innerHTML = QUICK_ALERT_CATEGORIES.map((cat) => `
    <button
      type="button"
      class="quick-alert-tab ${alertState.activeCategory === cat.category ? 'is-active' : ''}"
      data-quick-alert-tab="${escapeHtml(cat.category)}"
      aria-pressed="${alertState.activeCategory === cat.category ? 'true' : 'false'}"
    >${escapeHtml(cat.label)}</button>
  `).join('');
}

function renderQuickAlertGrid() {
  renderQuickAlertTabs();
  const host = document.getElementById('quick-alert-grid');
  if (!host) return;
  const cat = QUICK_ALERT_CATEGORIES.find((c) => c.category === alertState.activeCategory)
    || QUICK_ALERT_CATEGORIES[0];
  host.innerHTML = `
    ${cat.items.map((item) => `
      <button
        type="button"
        class="quick-alert-tile"
        data-quick-alert-item="1"
        data-title="${escapeHtml(item.title)}"
        data-category="${escapeHtml(cat.category)}"
        data-department="${escapeHtml(cat.departmentTarget)}"
        data-urgency="${escapeHtml(cat.urgency)}"
      >${escapeHtml(item.label)}</button>
    `).join('')}
    <button
      type="button"
      class="quick-alert-tile quick-alert-tile--freetext"
      data-quick-alert-freetext-focus="1"
    >+ Freitext</button>
  `;
  const freetextWrap = document.getElementById('quick-alert-freetext-wrap');
  if (freetextWrap) {
    freetextWrap.hidden = false;
    freetextWrap.dataset.category = cat.category;
    freetextWrap.dataset.department = cat.departmentTarget;
    freetextWrap.dataset.urgency = cat.urgency;
  }
}

async function handleQuickAlertTap(button) {
  const title = String(button.getAttribute('data-title') || '').trim();
  if (!title) return;
  button.disabled = true;
  try {
    await createSupplyAlert({
      title,
      category: button.getAttribute('data-category'),
      departmentTarget: button.getAttribute('data-department'),
      urgency: button.getAttribute('data-urgency'),
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
  const wrap = document.getElementById('quick-alert-freetext-wrap');
  const title = String(input?.value || '').trim();
  if (!title) {
    window.showToast?.('Bitte kurz beschreiben, was fehlt.', 'warning');
    input?.focus();
    return;
  }
  const btn = document.getElementById('quick-alert-freetext-submit');
  if (btn) btn.disabled = true;
  try {
    await createSupplyAlert({
      title,
      category: wrap?.dataset.category || alertState.activeCategory,
      departmentTarget: wrap?.dataset.department || 'all',
      urgency: wrap?.dataset.urgency || 'nachbestellen',
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
      ? `Schnellmeldung – ${count} offene Bedarfe`
      : 'Schnellmeldung – Bedarf melden');
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

function subscribeSupplyAlerts() {
  alertState.unsubscribe?.();
  alertState.unsubscribe = null;
  const ref = alertsCollectionRef();
  if (!ref) return;

  alertState.unsubscribe = ref
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
        console.warn('[QuickAlert] Snapshot:', err);
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

  document.getElementById('quick-alert-tabs')?.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-quick-alert-tab]');
    if (!tab) return;
    alertState.activeCategory = tab.getAttribute('data-quick-alert-tab') || 'sb_theke';
    renderQuickAlertGrid();
  });

  document.getElementById('quick-alert-grid')?.addEventListener('click', (event) => {
    const tile = event.target.closest('[data-quick-alert-item]');
    if (tile) {
      handleQuickAlertTap(tile);
      return;
    }
    if (event.target.closest('[data-quick-alert-freetext-focus]')) {
      document.getElementById('quick-alert-freetext')?.focus();
    }
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
  renderQuickAlertGrid();
  subscribeSupplyAlerts();
  renderAlertBanner();
}

export function getOpenSupplyAlertsForTest() {
  return [...alertState.alerts];
}
