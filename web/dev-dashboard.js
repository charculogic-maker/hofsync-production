/**
 * Enterprise Dev-Dashboard – /dev-dashboard
 * Super-Admin: alle Mandanten | Mandanten-Admin: nur eigener Mandant
 */
import { TENANT_MODULE_KEYS } from './tenant-modules.js';
import { createHttpsCallable } from './firebase-functions.js';
import { waitForAppCheckReady } from './app-check.js';
import { handleEmergencyLogoutParam, isEmergencyLogoutRequested } from './firebase-init.js';
import {
  appendTenantAuditEvent,
  AUDIT_STORAGE_SCOPE_HINT,
  AUDIT_STORAGE_SCOPE_LABEL,
  ensureTenantAuditSeed,
  filterTenantUsers,
  formatAuditTime,
  readTenantSettingsDraft,
  summarizeTenantModules,
  summarizeTenantUsers,
  TENANT_MODULE_LABELS,
  writeTenantSettingsDraft,
} from './admin-tenant-models.js';
import {
  isPlatformSuperAdmin,
  isTenantAdmin,
  isTenantAdminRoute,
  useTenantAdminAuth,
  clearAdminFallbackUI,
  installTenantAdminBootGuards,
  leaveDevDashboardToPhoneApp,
  renderFallbackUI,
} from './tenant-admin-auth.js';

// Sofortige Boot-Guards (Modul-Crash / fehlende Session → kein weißer Screen).
try {
  installTenantAdminBootGuards();
} catch (err) {
  console.warn('[Dev-Dashboard] Boot-Guards fehlgeschlagen:', err);
}

// ⚡ Notausgang: auch hier ganz oben prüfen, falls /dev-dashboard direkt mit
// ?logout=true / ?forceLogout=true geladen wird (vor jedem Auth-/Routing-Check).
if (isEmergencyLogoutRequested()) {
  void handleEmergencyLogoutParam();
}

export const DEV_DASHBOARD_ADMIN_UIDS = [
  'VYwMy5IAlAR26pj8ZbFfc5PNdou2',
];

export const SUPER_ADMIN_EMAIL = 'patrik@charculogic.de';

export function isDevDashboardRoute() {
  return isTenantAdminRoute();
}

export function isSuperAdmin(user) {
  return isPlatformSuperAdmin(user);
}

export function isDevDashboardAdmin(user, authContext = null) {
  return isTenantAdmin(user, authContext);
}

export { useTenantAdminAuth, isTenantAdmin };

const DEV_DASHBOARD_TABS = new Set([
  'overview',
  'users',
  'settings',
  'audit',
]);

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function recordAudit(action, summary, category = 'change') {
  const tenantId = dashboardState.selectedTenantId;
  if (!tenantId) return;
  appendTenantAuditEvent(tenantId, {
    action,
    summary,
    category,
    actorEmail: dashboardState.actorEmail || '',
  });
  if (dashboardState.activeTab === 'audit') {
    renderAuditTable(tenantId);
  }
}

function renderOverviewCards(dashboardStateRef = dashboardState) {
  const usersSummary = summarizeTenantUsers(dashboardStateRef.employees || []);
  const modulesSummary = summarizeTenantModules(
    dashboardStateRef.tenantModules,
    TENANT_MODULE_KEYS,
  );
  const status = dashboardStateRef.tenantStatus === 'inactive' ? 'Inaktiv' : 'Aktiv';

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  setText('dev-kpi-users', String(usersSummary.total));
  setText(
    'dev-kpi-users-hint',
    `${usersSummary.employees} Mitarbeiter · ${usersSummary.admins} Admin${usersSummary.admins === 1 ? '' : 's'}`,
  );
  setText('dev-kpi-admins', String(usersSummary.admins));
  setText('dev-kpi-modules', `${modulesSummary.enabled}/${modulesSummary.total || TENANT_MODULE_KEYS.length}`);
  setText('dev-kpi-modules-hint', 'Freigeschaltete Bereiche');
  setText('dev-kpi-status', status);
  setText(
    'dev-kpi-status-hint',
    dashboardStateRef.tenantDisplayName || dashboardStateRef.selectedTenantId || 'Betrieb',
  );
}

function renderAuditTable(tenantId = dashboardState.selectedTenantId) {
  const tbody = document.getElementById('dev-dashboard-audit-body');
  if (!tbody) return;
  const badge = document.querySelector('#dev-dashboard-view-audit .dev-dashboard-local-badge');
  if (badge) {
    badge.textContent = AUDIT_STORAGE_SCOPE_LABEL;
    badge.title = AUDIT_STORAGE_SCOPE_HINT;
  }
  const intro = document.querySelector('#dev-dashboard-view-audit .dev-dashboard-intro');
  if (intro && !intro.dataset.scopeBound) {
    intro.dataset.scopeBound = '1';
    intro.textContent = `Nur Lesen: Sicherheits- und Änderungsereignisse für diesen Betrieb. ${AUDIT_STORAGE_SCOPE_HINT}`;
  }
  const betriebsName = dashboardState.tenantDisplayName
    || window.BRANDING?.betriebsName
    || 'Betrieb';
  const events = ensureTenantAuditSeed(tenantId, betriebsName);
  if (!events.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="dev-dashboard-empty-msg dev-dashboard-empty-msg--info">Noch keine Ereignisse.</td></tr>';
    return;
  }
  const categoryLabel = {
    security: 'Sicherheit',
    change: 'Änderung',
    info: 'Info',
  };
  tbody.innerHTML = events.map((event) => {
    const category = String(event.category || 'change');
    const categoryText = categoryLabel[category] || 'Änderung';
    return `
    <tr>
      <td>${escapeHtml(formatAuditTime(event.at))}</td>
      <td><span class="dev-dashboard-audit-pill" data-category="${escapeHtml(category)}">${escapeHtml(categoryText)}</span></td>
      <td>${escapeHtml(event.summary || event.action || '—')}</td>
      <td>${escapeHtml(event.actorEmail || '—')}</td>
    </tr>
  `;
  }).join('');
}

function applySettingsPreview() {
  const nameInput = document.getElementById('dev-dashboard-settings-name');
  const logoInput = document.getElementById('dev-dashboard-settings-logo');
  const previewName = document.getElementById('dev-dashboard-settings-preview-name');
  const previewLogo = document.getElementById('dev-dashboard-settings-logo-preview');
  const name = String(nameInput?.value || '').trim() || 'Betrieb';
  const logoUrl = String(logoInput?.value || '').trim() || '/icon-192.png';
  if (previewName) previewName.textContent = name;
  if (previewLogo) {
    previewLogo.src = logoUrl;
    previewLogo.alt = `Logo ${name}`;
  }
}

function fillSettingsForm(dashboardStateRef = dashboardState) {
  const nameInput = document.getElementById('dev-dashboard-settings-name');
  const logoInput = document.getElementById('dev-dashboard-settings-logo');
  if (!nameInput || !logoInput) return;

  const draft = readTenantSettingsDraft(dashboardStateRef.selectedTenantId);
  const branding = window.BRANDING || {};
  nameInput.value = draft.displayName
    || dashboardStateRef.tenantDisplayName
    || branding.betriebsName
    || '';
  logoInput.value = draft.logoUrl
    || branding.logoUrl
    || branding.logo
    || '/icon-192.png';
  applySettingsPreview();
}

function applyBrandingFromSettingsDraft(tenantId, draft) {
  if (!window.BRANDING || typeof window.BRANDING !== 'object') return;
  if (draft.displayName) window.BRANDING.betriebsName = draft.displayName;
  if (draft.logoUrl) window.BRANDING.logoUrl = draft.logoUrl;
  if (typeof window.applyBranding === 'function') {
    window.applyBranding();
  }
}

function setSettingsFormStatus(message = '', tone = 'info') {
  const statusEl = document.getElementById('dev-dashboard-settings-status');
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
}

function bindSettingsForm(dashboardStateRef = dashboardState) {
  const form = document.getElementById('dev-dashboard-settings-form');
  if (!form || form.dataset.bound === '1') return;
  form.dataset.bound = '1';

  form.addEventListener('input', () => applySettingsPreview());

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const tenantId = dashboardStateRef.selectedTenantId;
    if (!tenantId) {
      setSettingsFormStatus('Kein Betrieb ausgewählt.', 'error');
      return;
    }
    const displayName = document.getElementById('dev-dashboard-settings-name')?.value.trim() || '';
    const logoUrl = document.getElementById('dev-dashboard-settings-logo')?.value.trim() || '/icon-192.png';
    if (!displayName) {
      setSettingsFormStatus('Bitte einen Firmennamen eingeben.', 'error');
      return;
    }

    const draft = { displayName, logoUrl };
    writeTenantSettingsDraft(tenantId, draft);
    dashboardStateRef.tenantDisplayName = displayName;
    applyBrandingFromSettingsDraft(tenantId, draft);
    applySettingsPreview();
    renderOverviewCards(dashboardStateRef);
    recordAudit('settings', `Betriebseinstellungen gespeichert (${displayName})`, 'change');
    setSettingsFormStatus('Einstellungen gespeichert (Anzeige auf diesem Gerät).', 'success');
    window.showToast?.('Betriebseinstellungen gespeichert.', 'success');
  });
}

function bindUserFilters(dashboardStateRef = dashboardState) {
  const search = document.getElementById('dev-dashboard-user-search');
  const roleFilter = document.getElementById('dev-dashboard-user-role-filter');
  if (search && search.dataset.bound !== '1') {
    search.dataset.bound = '1';
    search.addEventListener('input', () => {
      dashboardStateRef.userQuery = search.value;
      renderEmployeeTable(dashboardStateRef.employees, dashboardStateRef.currentUserUid);
    });
  }
  if (roleFilter && roleFilter.dataset.bound !== '1') {
    roleFilter.dataset.bound = '1';
    roleFilter.addEventListener('change', () => {
      dashboardStateRef.userRoleFilter = roleFilter.value;
      renderEmployeeTable(dashboardStateRef.employees, dashboardStateRef.currentUserUid);
    });
  }
}

function bindInvitePanel() {
  const openBtn = document.getElementById('dev-dashboard-invite-open-btn');
  const cancelBtn = document.getElementById('dev-dashboard-invite-cancel-btn');
  const panel = document.getElementById('dev-dashboard-employee-create');
  if (openBtn && openBtn.dataset.bound !== '1') {
    openBtn.dataset.bound = '1';
    openBtn.addEventListener('click', () => {
      if (!panel) return;
      panel.hidden = false;
      document.getElementById('dev-dashboard-employee-name')?.focus();
    });
  }
  if (cancelBtn && cancelBtn.dataset.bound !== '1') {
    cancelBtn.dataset.bound = '1';
    cancelBtn.addEventListener('click', () => {
      if (panel) panel.hidden = true;
      setEmployeeFormStatus('');
    });
  }
}

function bindOverviewJumpLinks() {
  const root = document.getElementById('dev-dashboard-view-overview');
  if (!root || root.dataset.bound === '1') return;
  root.dataset.bound = '1';
  root.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-dev-jump]');
    if (!(btn instanceof HTMLButtonElement)) return;
    setDevDashboardTab(btn.getAttribute('data-dev-jump') || 'overview');
  });
}

const MODULE_LABELS = {
  ...TENANT_MODULE_LABELS,
};

const EMPLOYEE_PERMISSION_KEYS = ['mhd', 'kitchen', 'buero'];

const EMPLOYEE_MODULE_LABELS = {
  mhd: 'MHD',
  kitchen: 'Küche',
  buero: 'Büro',
};

async function signOutFromDashboard() {
  try {
    const firebaseApi = typeof firebase !== 'undefined' ? firebase : null;
    if (firebaseApi?.apps?.length && typeof firebaseApi.auth === 'function') {
      await firebaseApi.auth().signOut();
    }
  } catch (err) {
    console.warn('[Dev-Dashboard] SignOut fehlgeschlagen:', err);
  }
}

/**
 * @param {'login'|'forbidden'} reason
 */
function ensureAccessDeniedPanel(reason = 'forbidden') {
  const page = document.getElementById('page-dev-dashboard');
  if (!page) return null;

  let panel = document.getElementById('dev-dashboard-denied');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'dev-dashboard-denied';
    panel.className = 'dev-dashboard-denied';
    panel.hidden = true;
    page.appendChild(panel);
  }

  const needsLogin = reason === 'login';
  panel.dataset.reason = reason;
  panel.innerHTML = `
    <div class="dev-dashboard-denied-card" role="alert">
      <div class="dev-dashboard-denied-icon" aria-hidden="true">🔒</div>
      <h1 class="dev-dashboard-denied-title">${needsLogin ? 'Anmeldung erforderlich' : 'Zugriff verweigert'}</h1>
      <p class="dev-dashboard-denied-text">${
        needsLogin
          ? 'Bitte erst als Betriebs-Admin anmelden.'
          : 'Dieser Bereich ist nur für Betriebs-Admins. Wir leiten dich zur App zurück.'
      }</p>
      ${needsLogin ? `
      <button type="button" class="dev-dashboard-denied-logout" id="dev-dashboard-denied-login">
        Anmelden
      </button>
      ` : ''}
      <button type="button" class="dev-dashboard-denied-logout${needsLogin ? ' dev-dashboard-denied-logout--secondary' : ''}" id="dev-dashboard-denied-back">
        Zurück zur App
      </button>
      ${needsLogin ? '' : `
      <button type="button" class="dev-dashboard-denied-logout dev-dashboard-denied-logout--secondary" id="dev-dashboard-denied-logout">
        Abmelden / Account wechseln
      </button>
      `}
    </div>
  `;

  panel.querySelector('#dev-dashboard-denied-back')?.addEventListener('click', () => {
    leaveDevDashboardToPhoneApp();
  });

  panel.querySelector('#dev-dashboard-denied-login')?.addEventListener('click', async () => {
    try {
      const { promptLogin } = await import('./auth.js');
      promptLogin('Mit Betriebs-Admin- oder Super-Admin-Konto anmelden.');
    } catch (err) {
      console.warn('[Dev-Dashboard] Login-Overlay konnte nicht geöffnet werden:', err);
      leaveDevDashboardToPhoneApp();
    }
  });

  const logoutBtn = panel.querySelector('#dev-dashboard-denied-logout');
  logoutBtn?.addEventListener('click', async () => {
    logoutBtn.disabled = true;
    logoutBtn.textContent = 'Wird abgemeldet…';
    await signOutFromDashboard();
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('logout', 'true');
      window.location.replace(url.toString());
    } catch (_) {
      window.location.reload();
    }
  });

  return panel;
}

/**
 * @param {{ reason?: 'login'|'forbidden' }} [options]
 */
function showDevDashboardAccessDenied(options = {}) {
  const reason = options.reason === 'login' ? 'login' : 'forbidden';
  const shell = document.querySelector('#page-dev-dashboard .dev-dashboard-shell');
  if (shell) shell.hidden = true;
  const panel = ensureAccessDeniedPanel(reason);
  if (panel) panel.hidden = false;
}

function hideDevDashboardAccessDenied() {
  const shell = document.querySelector('#page-dev-dashboard .dev-dashboard-shell');
  if (shell) shell.hidden = false;
  const panel = document.getElementById('dev-dashboard-denied');
  if (panel) panel.hidden = true;
}

/**
 * Sofort sichtbares Login-/Denied-Panel auf /dev-dashboard (kein weißer Screen).
 */
export function showDevDashboardLoginRequired() {
  try {
    hideMainAppChrome();
    showDevDashboardPage();
    showDevDashboardAccessDenied({ reason: 'login' });
    renderFallbackUI('Bitte erst als Betriebs-Admin anmelden.');
    const statusEl = document.getElementById('dev-dashboard-status');
    if (statusEl) statusEl.textContent = 'Anmeldung erforderlich';
  } catch (err) {
    console.error('[Dev-Dashboard] Login-Required-Panel fehlgeschlagen:', err);
    renderFallbackUI('Bitte erst als Betriebs-Admin anmelden.');
  }
}

export function navigateBackToMainApp() {
  teardownDevDashboard();
  leaveDevDashboardToPhoneApp();
}

const EMPTY_TENANTS_MESSAGE = 'ℹ️ Keine Mandanten in der Datenbank. Wurde das Seeding-Skript ausgeführt?';
const PERMISSION_DENIED_MESSAGE = 'Kein Zugriff auf diesen Betrieb. Bitte Admin kontaktieren.';

function isPermissionDeniedError(err) {
  const code = String(err?.code || '').toLowerCase();
  return code === 'permission-denied' || code.includes('permission');
}

function normalizeAllowedModules(value) {
  const result = {};
  EMPLOYEE_PERMISSION_KEYS.forEach((key) => {
    if (value && typeof value === 'object' && key in value) {
      result[key] = value[key] !== false;
    } else {
      result[key] = true;
    }
  });
  return result;
}

function hideMainAppChrome() {
  // Layout-Flag am body — NICHT dieselbe Klasse wie Tab-Panels (.dev-dashboard-view).
  document.body?.classList.add('is-dev-dashboard');
  document.body?.classList.remove('app-shell-sidebar', 'dev-dashboard-view');
  document.body && (document.body.hidden = false);
  document.body?.removeAttribute('hidden');
  document.querySelector('.bottom-nav')?.setAttribute('hidden', '');
  document.querySelector('.admin-header-dropdown')?.setAttribute('hidden', '');
  const dropdown = document.getElementById('admin-header-dropdown');
  if (dropdown) dropdown.style.display = 'none';
  window.syncDesktopWideLayout?.('page-dev-dashboard');
  window.syncAppShellLayout?.('page-dev-dashboard');
}

function showDevDashboardPage() {
  document.body && (document.body.hidden = false);
  document.body?.removeAttribute('hidden');
  document.querySelectorAll('.page').forEach((page) => {
    const active = page.id === 'page-dev-dashboard';
    page.classList.toggle('active', active);
    page.hidden = !active;
    page.style.display = active ? 'block' : 'none';
  });
  const titleEl = document.getElementById('header-title');
  const subtitleEl = document.getElementById('header-subtitle');
  if (titleEl) titleEl.textContent = 'Verwaltung';
  if (subtitleEl) subtitleEl.textContent = 'Mandant & Mitarbeiter';
  const appContent = document.getElementById('app-content');
  if (appContent) appContent.scrollTop = 0;
}

function renderTenantRow(tenantId, data = {}, { compact = false } = {}) {
  const enabled = data.enabledModules && typeof data.enabledModules === 'object'
    ? data.enabledModules
    : {};
  const displayName = String(data.displayName || tenantId).trim();
  const isActive = data.status !== 'inactive';
  const statusValue = isActive ? 'active' : 'inactive';
  const toggles = TENANT_MODULE_KEYS.map((key) => {
    let checked = enabled[key] === true;
    // Legacy: enabledModules.traceability → chargenDoku
    if (key === 'chargenDoku' && !('chargenDoku' in enabled) && enabled.traceability === true) {
      checked = true;
    }
    return `
      <label class="dev-dashboard-toggle" title="${MODULE_LABELS[key]}">
        <input
          type="checkbox"
          data-tenant-id="${tenantId}"
          data-module-key="${key}"
          ${checked ? 'checked' : ''}
        >
        <span>${MODULE_LABELS[key]}</span>
      </label>
    `;
  }).join('');

  if (compact) {
    return `
      <div class="dev-dashboard-tenant-compact" data-tenant-row="${tenantId}">
        <div class="dev-dashboard-tenant-id">
          <strong>${displayName}</strong>
          <span class="dev-dashboard-tenant-sub">${tenantId}</span>
        </div>
        <div class="dev-dashboard-toggles">${toggles}</div>
      </div>
    `;
  }

  return `
    <tr data-tenant-row="${tenantId}">
      <td class="dev-dashboard-tenant-id">
        <strong>${displayName}</strong>
        <span class="dev-dashboard-tenant-sub">${tenantId}</span>
      </td>
      <td class="dev-dashboard-toggles">${toggles}</td>
      <td>
        <label class="dev-dashboard-tenant-status" data-status="${statusValue}" title="Aktiv / Inaktiv">
          <input
            type="checkbox"
            data-tenant-id="${tenantId}"
            data-tenant-status="1"
            ${isActive ? 'checked' : ''}
            aria-label="Mandant ${tenantId} aktiv"
          >
          <span>${isActive ? 'Aktiv' : 'Inaktiv'}</span>
        </label>
      </td>
      <td class="dev-dashboard-tenant-actions">
        <button
          type="button"
          class="dev-dashboard-action-btn dev-dashboard-action-btn--danger"
          data-action="delete-tenant"
          data-tenant-id="${tenantId}"
          data-display-name="${displayName.replace(/"/g, '&quot;')}"
        >Löschen</button>
      </td>
    </tr>
  `;
}

function renderTenantTable(tenants, { emptyMessage = '', targetBodyId = 'dev-dashboard-tenant-body' } = {}) {
  const tbody = document.getElementById(targetBodyId);
  if (!tbody) return;
  if (!tenants.length) {
    const message = emptyMessage || EMPTY_TENANTS_MESSAGE;
    const tone = message.startsWith('⚠️') ? 'error' : 'info';
    tbody.innerHTML = `<tr><td colspan="4" class="dev-dashboard-empty-msg dev-dashboard-empty-msg--${tone}">${message}</td></tr>`;
    return;
  }
  const rows = tenants
    .slice()
    .sort((a, b) => String(a.id).localeCompare(String(b.id), 'de'))
    .map(({ id, data }) => renderTenantRow(id, data))
    .join('');
  tbody.innerHTML = rows;
}

function renderSingleTenantPanel(tenantId, data = {}) {
  const container = document.getElementById('dev-dashboard-single-tenant');
  if (!container) return;
  container.innerHTML = renderTenantRow(tenantId, data, { compact: true });
}

async function toggleTenantModule(db, tenantId, moduleKey, enabled) {
  const ref = db.collection('tenants').doc(tenantId);
  const snap = await ref.get();
  const current = snap.data()?.enabledModules && typeof snap.data().enabledModules === 'object'
    ? { ...snap.data().enabledModules }
    : {};
  current[moduleKey] = enabled;
  if (moduleKey === 'chargenDoku') {
    // Legacy-Key bereinigen, damit Plattform-Metriken nur chargenDoku zählen
    delete current.traceability;
  }
  await ref.update({
    enabledModules: current,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

async function updateTenantStatus(db, tenantId, status) {
  await db.collection('tenants').doc(tenantId).update({
    status,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

async function deleteTenantRoot(db, tenantId) {
  await db.collection('tenants').doc(tenantId).delete();
}

function confirmTenantDelete(tenantId, displayName) {
  const label = displayName || tenantId;
  const firstOk = window.confirm(
    `Mandant „${label}“ (${tenantId}) wirklich löschen?\n\n`
    + 'Es wird nur das Root-Dokument gelöscht. Untergeordnete Daten bleiben ggf. bestehen.\n'
    + 'Dieser Schritt kann nicht rückgängig gemacht werden.',
  );
  if (!firstOk) return false;

  const typed = window.prompt(
    `Bitte tippe die Tenant-ID (${tenantId}) ein, um das Löschen zu bestätigen.`,
  );
  if (typed === null) return false;
  if (String(typed).trim() !== tenantId) {
    window.showToast?.('Löschen abgebrochen: Tenant-ID stimmt nicht überein.', 'error');
    return false;
  }
  return true;
}

function bindTenantToggleHandlers(db, statusEl) {
  const page = document.getElementById('page-dev-dashboard');
  if (!page || page.dataset.togglesBound === '1') return;
  page.dataset.togglesBound = '1';

  page.addEventListener('change', async (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'checkbox') return;
    const tenantId = input.getAttribute('data-tenant-id');
    if (!tenantId) return;

    if (input.getAttribute('data-tenant-status') === '1') {
      const previous = !input.checked;
      const nextStatus = input.checked ? 'active' : 'inactive';
      input.disabled = true;
      if (statusEl) statusEl.textContent = `Speichere Status ${tenantId}…`;

      try {
        await updateTenantStatus(db, tenantId, nextStatus);
        const label = input.closest('.dev-dashboard-tenant-status');
        if (label) {
          label.dataset.status = nextStatus;
          const span = label.querySelector('span');
          if (span) span.textContent = nextStatus === 'active' ? 'Aktiv' : 'Inaktiv';
        }
        if (statusEl) {
          statusEl.textContent = `Status gespeichert: ${tenantId} · ${nextStatus === 'active' ? 'Aktiv' : 'Inaktiv'}`;
        }
        window.showToast?.(
          nextStatus === 'active' ? `Mandant ${tenantId} aktiviert.` : `Mandant ${tenantId} deaktiviert.`,
          'success',
        );
      } catch (err) {
        input.checked = previous;
        console.error('[Dev-Dashboard] Status-Toggle fehlgeschlagen:', err);
        if (statusEl) statusEl.textContent = `Fehler: ${err?.message || 'Status speichern fehlgeschlagen'}`;
        window.showToast?.('Status konnte nicht gespeichert werden.', 'error');
      } finally {
        input.disabled = false;
      }
      return;
    }

    const moduleKey = input.getAttribute('data-module-key');
    if (!moduleKey) return;

    const previous = !input.checked;
    input.disabled = true;
    if (statusEl) statusEl.textContent = `Speichere ${tenantId} · ${moduleKey}…`;

    try {
      await toggleTenantModule(db, tenantId, moduleKey, input.checked);
      if (tenantId === dashboardState.selectedTenantId) {
        dashboardState.tenantModules = {
          ...(dashboardState.tenantModules || {}),
          [moduleKey]: input.checked,
        };
        renderOverviewCards(dashboardState);
      }
      recordAudit(
        'modules',
        `Modul ${MODULE_LABELS[moduleKey] || moduleKey} ${input.checked ? 'aktiviert' : 'deaktiviert'}`,
        'change',
      );
      if (statusEl) statusEl.textContent = `Gespeichert: ${tenantId} · ${MODULE_LABELS[moduleKey] || moduleKey}`;
    } catch (err) {
      input.checked = previous;
      console.error('[Dev-Dashboard] Modul-Toggle fehlgeschlagen:', err);
      if (statusEl) statusEl.textContent = `Fehler: ${err?.message || 'Speichern fehlgeschlagen'}`;
      window.showToast?.('Modul konnte nicht gespeichert werden.', 'error');
    } finally {
      input.disabled = false;
    }
  });

  page.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-action="delete-tenant"]');
    if (!(btn instanceof HTMLButtonElement)) return;

    const tenantId = btn.getAttribute('data-tenant-id');
    if (!tenantId) return;
    const displayName = btn.getAttribute('data-display-name') || tenantId;

    if (!confirmTenantDelete(tenantId, displayName)) return;

    btn.disabled = true;
    if (statusEl) statusEl.textContent = `Lösche Mandant ${tenantId}…`;

    try {
      await deleteTenantRoot(db, tenantId);
      if (statusEl) statusEl.textContent = `Mandant ${tenantId} gelöscht`;
      window.showToast?.(`Mandant ${displayName} wurde gelöscht.`, 'success');
      // Tabelle aktualisiert sich über den onSnapshot-Listener.
    } catch (err) {
      console.error('[Dev-Dashboard] Mandanten-Löschen fehlgeschlagen:', err);
      if (statusEl) statusEl.textContent = `Fehler: ${err?.message || 'Löschen fehlgeschlagen'}`;
      window.showToast?.(
        isPermissionDeniedError(err)
          ? 'Löschen nicht erlaubt (Firestore-Regeln).'
          : 'Mandant konnte nicht gelöscht werden.',
        'error',
      );
      btn.disabled = false;
    }
  });
}

/** Anzeigename → Document-ID: Kleinbuchstaben, Umlaute aufgelöst, ohne Leer-/Sonderzeichen. */
export function slugifyTenantId(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9_-]+/g, '')
    .replace(/^[_-]+|[_-]+$/g, '')
    .slice(0, 64);
}

function setTenantFormStatus(message = '', tone = 'info') {
  const statusEl = document.getElementById('dev-dashboard-tenant-form-status');
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
}

function readCreateTenantEnabledModules() {
  const enabledModules = {};
  TENANT_MODULE_KEYS.forEach((key) => {
    const input = document.getElementById(`dev-dashboard-tenant-mod-${key}`);
    enabledModules[key] = input instanceof HTMLInputElement ? input.checked : false;
  });
  return enabledModules;
}

function resetTenantCreateForm() {
  const form = document.getElementById('dev-dashboard-tenant-form');
  if (form) form.reset();
  TENANT_MODULE_KEYS.forEach((key) => {
    const input = document.getElementById(`dev-dashboard-tenant-mod-${key}`);
    if (input instanceof HTMLInputElement) {
      input.checked = key === 'chargenDoku';
    }
  });
  const idInput = document.getElementById('dev-dashboard-tenant-id');
  if (idInput) idInput.dataset.manual = '0';
}

function bindTenantCreateForm(db) {
  const form = document.getElementById('dev-dashboard-tenant-form');
  const nameInput = document.getElementById('dev-dashboard-tenant-name');
  const idInput = document.getElementById('dev-dashboard-tenant-id');
  if (!form || !nameInput || !idInput || form.dataset.bound === '1') return;
  form.dataset.bound = '1';
  idInput.dataset.manual = idInput.dataset.manual || '0';

  nameInput.addEventListener('input', () => {
    if (idInput.dataset.manual === '1') return;
    idInput.value = slugifyTenantId(nameInput.value);
  });

  idInput.addEventListener('input', () => {
    idInput.dataset.manual = '1';
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitBtn = form.querySelector('[type="submit"]');
    const displayName = nameInput.value.trim();
    const tenantId = String(idInput.value || '').trim();

    if (!displayName) {
      setTenantFormStatus('Bitte einen Anzeigenamen eingeben.', 'error');
      return;
    }
    if (!tenantId || !/^[a-zA-Z0-9_-]+$/.test(tenantId)) {
      setTenantFormStatus('Tenant-ID: nur Buchstaben, Zahlen, Unterstrich und Bindestrich.', 'error');
      return;
    }
    if (!db) {
      setTenantFormStatus('Firestore nicht verfügbar.', 'error');
      return;
    }

    if (submitBtn) submitBtn.disabled = true;
    setTenantFormStatus('Lege Mandant an…');

    try {
      const ref = db.collection('tenants').doc(tenantId);
      const existing = await ref.get();
      if (existing.exists) {
        setTenantFormStatus(`Mandant „${tenantId}“ existiert bereits.`, 'error');
        window.showToast?.('Mandant existiert bereits.', 'error');
        return;
      }

      const enabledModules = readCreateTenantEnabledModules();
      await ref.set({
        displayName,
        status: 'active',
        enabledModules,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      resetTenantCreateForm();
      setTenantFormStatus(`Mandant „${displayName}“ (${tenantId}) angelegt.`, 'success');
      window.showToast?.(`Mandant ${displayName} wurde angelegt.`, 'success');
      // Liste aktualisiert sich über den onSnapshot-Listener von subscribeAllTenants.
    } catch (err) {
      console.error('[Dev-Dashboard] Mandanten-Anlage fehlgeschlagen:', err);
      const message = isPermissionDeniedError(err)
        ? PERMISSION_DENIED_MESSAGE
        : `Fehler: ${err?.message || 'Anlage fehlgeschlagen.'}`;
      setTenantFormStatus(message, 'error');
      window.showToast?.('Mandant konnte nicht angelegt werden.', 'error');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

function bindDevDashboardBackButton() {
  const backBtn = document.getElementById('dev-dashboard-back-btn');
  if (!backBtn || backBtn.dataset.bound === '1') return;
  backBtn.dataset.bound = '1';
  backBtn.addEventListener('click', () => {
    navigateBackToMainApp();
  });
}

let createEmployeeCallable = null;
let manageEmployeesCallable = null;

function getCreateEmployeeCallable() {
  if (createEmployeeCallable) return createEmployeeCallable;
  const firebaseApi = typeof firebase !== 'undefined' ? firebase : null;
  if (!firebaseApi?.apps?.length) return null;
  createEmployeeCallable = createHttpsCallable('createTenantEmployee', undefined, firebaseApi);
  return createEmployeeCallable;
}

function getManageEmployeesCallable() {
  if (manageEmployeesCallable) return manageEmployeesCallable;
  const firebaseApi = typeof firebase !== 'undefined' ? firebase : null;
  if (!firebaseApi?.apps?.length) return null;
  manageEmployeesCallable = createHttpsCallable('manageTenantEmployees', undefined, firebaseApi);
  return manageEmployeesCallable;
}

function setEmployeeFormStatus(message = '', tone = 'info') {
  const statusEl = document.getElementById('dev-dashboard-employee-status');
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
}

function readCreateFormAllowedModules() {
  const allowedModules = {};
  EMPLOYEE_PERMISSION_KEYS.forEach((key) => {
    const input = document.getElementById(`dev-dashboard-create-mod-${key}`);
    allowedModules[key] = input instanceof HTMLInputElement ? input.checked : true;
  });
  return allowedModules;
}

function bindEmployeeCreateForm(dashboardState) {
  const form = document.getElementById('dev-dashboard-employee-form');
  if (!form || form.dataset.bound === '1') return;
  form.dataset.bound = '1';

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitBtn = form.querySelector('[type="submit"]');
    const name = document.getElementById('dev-dashboard-employee-name')?.value.trim() || '';
    const email = document.getElementById('dev-dashboard-employee-email')?.value.trim() || '';
    const password = document.getElementById('dev-dashboard-employee-password')?.value || '';
    const tenantId = dashboardState.selectedTenantId;

    if (!name || !email || !password) {
      setEmployeeFormStatus('Bitte Name, E-Mail und Passwort ausfüllen.', 'error');
      return;
    }
    if (!tenantId) {
      setEmployeeFormStatus('Kein Mandant ausgewählt.', 'error');
      return;
    }

    const callable = getCreateEmployeeCallable();
    if (!callable) {
      setEmployeeFormStatus('Cloud Function nicht verfügbar.', 'error');
      return;
    }

    if (submitBtn) submitBtn.disabled = true;
    setEmployeeFormStatus('Erstelle Mitarbeiter-Konto…');

    try {
      await waitForAppCheckReady();
      const result = await callable({
        name,
        email,
        password,
        tenantId,
        allowedModules: readCreateFormAllowedModules(),
      });
      const createdEmail = result?.data?.email || email;
      setEmployeeFormStatus(`Nutzer ${createdEmail} angelegt.`, 'success');
      window.showToast?.(`Nutzer ${name} wurde angelegt.`, 'success');
      recordAudit('user_create', `Nutzer angelegt: ${name} (${createdEmail})`, 'security');
      form.reset();
      EMPLOYEE_PERMISSION_KEYS.forEach((key) => {
        const input = document.getElementById(`dev-dashboard-create-mod-${key}`);
        if (input instanceof HTMLInputElement) input.checked = true;
      });
      const createPanel = document.getElementById('dev-dashboard-employee-create');
      if (createPanel) createPanel.hidden = true;
      await refreshEmployeeTable(dashboardState);
    } catch (err) {
      console.error('[Dev-Dashboard] Mitarbeiter-Anlage fehlgeschlagen:', err);
      const message = String(err?.message || 'Anlage fehlgeschlagen.');
      setEmployeeFormStatus(message, 'error');
      window.showToast?.('Mitarbeiter konnte nicht angelegt werden.', 'error');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

function renderEmployeePermissionToggles(uid, allowedModules = {}, tenantId) {
  const safeUid = escapeHtml(uid);
  const safeTenantId = escapeHtml(tenantId);
  return EMPLOYEE_PERMISSION_KEYS.map((key) => {
    const checked = allowedModules[key] !== false;
    const safeKey = escapeHtml(key);
    return `
      <label class="dev-dashboard-toggle dev-dashboard-toggle--compact" title="${escapeHtml(EMPLOYEE_MODULE_LABELS[key])}">
        <input
          type="checkbox"
          data-employee-uid="${safeUid}"
          data-employee-tenant="${safeTenantId}"
          data-permission-key="${safeKey}"
          ${checked ? 'checked' : ''}
        >
        <span>${escapeHtml(EMPLOYEE_MODULE_LABELS[key])}</span>
      </label>
    `;
  }).join('');
}

function renderEmployeeRow(employee, currentUserUid) {
  const role = String(employee.role || 'employee');
  const roleLabel = role === 'admin' ? 'Admin' : role === 'helper' ? 'Aushilfe' : 'Mitarbeiter';
  const isSelf = employee.uid === currentUserUid;
  const roleBtnLabel = role === 'admin' ? '→ Mitarbeiter' : '→ Admin';
  const nextRole = role === 'admin' ? 'employee' : 'admin';
  const safeUid = escapeHtml(employee.uid);
  const safeTenantId = escapeHtml(employee.tenantId);
  const safeDisplayName = escapeHtml(employee.displayName || '—');
  const safeEmail = escapeHtml(employee.email || '');
  const safeDisplayAttr = escapeHtml(employee.displayName || employee.email || '');

  return `
    <tr data-employee-row="${safeUid}">
      <td class="dev-dashboard-employee-name">
        <strong>${safeDisplayName}</strong>
        <span class="dev-dashboard-tenant-sub">${safeEmail}</span>
      </td>
      <td>
        <span class="dev-dashboard-role-badge dev-dashboard-role-badge--${escapeHtml(role)}">${escapeHtml(roleLabel)}</span>
      </td>
      <td class="dev-dashboard-employee-perms">
        ${renderEmployeePermissionToggles(employee.uid, employee.allowedModules, employee.tenantId)}
      </td>
      <td class="dev-dashboard-employee-actions">
        <button
          type="button"
          class="dev-dashboard-action-btn"
          data-action="toggle-role"
          data-uid="${safeUid}"
          data-tenant-id="${safeTenantId}"
          data-next-role="${escapeHtml(nextRole)}"
          ${isSelf ? 'disabled title="Eigene Rolle kann hier nicht geändert werden"' : ''}
        >${escapeHtml(roleBtnLabel)}</button>
        <button
          type="button"
          class="dev-dashboard-action-btn dev-dashboard-action-btn--danger"
          data-action="remove"
          data-uid="${safeUid}"
          data-tenant-id="${safeTenantId}"
          data-display-name="${safeDisplayAttr}"
          ${isSelf ? 'disabled title="Du kannst dich nicht selbst entfernen"' : ''}
        >Entfernen</button>
      </td>
    </tr>
  `;
}

function renderEmployeeTable(employees, currentUserUid) {
  const tbody = document.getElementById('dev-dashboard-employee-body');
  if (!tbody) return;
  const filtered = filterTenantUsers(employees, {
    query: dashboardState.userQuery,
    role: dashboardState.userRoleFilter,
  });
  if (!employees.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="dev-dashboard-empty-msg dev-dashboard-empty-msg--info">Noch keine Nutzer für diesen Betrieb.</td></tr>';
    return;
  }
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="dev-dashboard-empty-msg dev-dashboard-empty-msg--info">Keine Nutzer für diese Suche/Filter.</td></tr>';
    return;
  }
  tbody.innerHTML = filtered.map((emp) => renderEmployeeRow(emp, currentUserUid)).join('');
}

async function refreshEmployeeTable(dashboardState) {
  const callable = getManageEmployeesCallable();
  const statusEl = document.getElementById('dev-dashboard-employee-list-status');
  const tenantId = dashboardState.selectedTenantId;
  if (!callable || !tenantId) {
    renderEmployeeTable([], dashboardState.currentUserUid);
    renderOverviewCards(dashboardState);
    return;
  }

  if (statusEl) statusEl.textContent = 'Lade Nutzer…';
  try {
    await waitForAppCheckReady();
    const result = await callable({ action: 'list', tenantId });
    const employees = Array.isArray(result?.data?.employees) ? result.data.employees : [];
    dashboardState.employees = employees;
    renderEmployeeTable(employees, dashboardState.currentUserUid);
    renderOverviewCards(dashboardState);
    if (statusEl) statusEl.textContent = `${employees.length} Nutzer`;
  } catch (err) {
    console.error('[Dev-Dashboard] Mitarbeiter-Liste fehlgeschlagen:', err);
    renderEmployeeTable([], dashboardState.currentUserUid);
    renderOverviewCards(dashboardState);
    if (statusEl) statusEl.textContent = 'Liste konnte nicht geladen werden. Bitte später erneut versuchen.';
  }
}

function bindEmployeeTableActions(dashboardState) {
  const section = document.getElementById('dev-dashboard-employee-list');
  if (!section || section.dataset.bound === '1') return;
  section.dataset.bound = '1';

  section.addEventListener('change', async (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'checkbox') return;
    const uid = input.getAttribute('data-employee-uid');
    const tenantId = input.getAttribute('data-employee-tenant');
    const permissionKey = input.getAttribute('data-permission-key');
    if (!uid || !tenantId || !permissionKey) return;

    const employee = dashboardState.employees?.find((e) => e.uid === uid);
    const allowedModules = normalizeAllowedModules(employee?.allowedModules);
    allowedModules[permissionKey] = input.checked;

    const callable = getManageEmployeesCallable();
    if (!callable) return;

    const previous = !input.checked;
    input.disabled = true;
    try {
      await waitForAppCheckReady();
      await callable({ action: 'update', uid, tenantId, allowedModules });
      if (employee) employee.allowedModules = allowedModules;
      window.showToast?.('Berechtigung gespeichert.', 'success');
    } catch (err) {
      input.checked = previous;
      console.error('[Dev-Dashboard] Berechtigung speichern fehlgeschlagen:', err);
      window.showToast?.('Berechtigung konnte nicht gespeichert werden.', 'error');
    } finally {
      input.disabled = false;
    }
  });

  section.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-action]');
    if (!(btn instanceof HTMLButtonElement)) return;

    const action = btn.getAttribute('data-action');
    const uid = btn.getAttribute('data-uid');
    const tenantId = btn.getAttribute('data-tenant-id');
    if (!uid || !tenantId) return;

    const callable = getManageEmployeesCallable();
    if (!callable) return;

    if (action === 'toggle-role') {
      const nextRole = btn.getAttribute('data-next-role');
      if (!nextRole) return;
      btn.disabled = true;
      try {
        await waitForAppCheckReady();
        await callable({ action: 'update', uid, tenantId, role: nextRole });
        window.showToast?.('Rolle aktualisiert.', 'success');
        recordAudit(
          'role_change',
          `Rolle geändert zu ${nextRole === 'admin' ? 'Admin' : 'Mitarbeiter'}`,
          'security',
        );
        await refreshEmployeeTable(dashboardState);
      } catch (err) {
        console.error('[Dev-Dashboard] Rolle ändern fehlgeschlagen:', err);
        window.showToast?.(err?.message || 'Rolle konnte nicht geändert werden.', 'error');
        btn.disabled = false;
      }
      return;
    }

    if (action === 'remove') {
      const displayName = btn.getAttribute('data-display-name') || 'Mitarbeiter';
      if (!window.confirm(`${displayName} wirklich entfernen? Das Konto wird gelöscht.`)) return;
      btn.disabled = true;
      try {
        await waitForAppCheckReady();
        await callable({ action: 'remove', uid, tenantId });
        window.showToast?.(`${displayName} entfernt.`, 'success');
        recordAudit('user_remove', `Nutzer entfernt: ${displayName}`, 'security');
        await refreshEmployeeTable(dashboardState);
      } catch (err) {
        console.error('[Dev-Dashboard] Mitarbeiter entfernen fehlgeschlagen:', err);
        window.showToast?.(err?.message || 'Entfernen fehlgeschlagen.', 'error');
        btn.disabled = false;
      }
    }
  });
}

function bindTenantSelector(dashboardState, tenants) {
  const select = document.getElementById('dev-dashboard-tenant-select');
  if (!select) return;

  select.innerHTML = tenants
    .slice()
    .sort((a, b) => String(a.id).localeCompare(String(b.id), 'de'))
    .map(({ id, data }) => {
      const label = String(data?.displayName || id).trim();
      return `<option value="${id}">${label} (${id})</option>`;
    })
    .join('');

  const initial = dashboardState.selectedTenantId || tenants[0]?.id || '';
  select.value = initial;
  dashboardState.selectedTenantId = select.value;

  if (select.dataset.bound === '1') {
    void refreshEmployeeTable(dashboardState);
    return;
  }
  select.dataset.bound = '1';
  select.addEventListener('change', () => {
    dashboardState.selectedTenantId = select.value;
    const selected = tenants.find((item) => item.id === select.value);
    dashboardState.tenantDisplayName = String(selected?.data?.displayName || select.value).trim();
    dashboardState.tenantStatus = selected?.data?.status === 'inactive' ? 'inactive' : 'active';
    dashboardState.tenantModules = selected?.data?.enabledModules && typeof selected.data.enabledModules === 'object'
      ? { ...selected.data.enabledModules }
      : {};
    fillSettingsForm(dashboardState);
    renderOverviewCards(dashboardState);
    renderAuditTable(dashboardState.selectedTenantId);
    void refreshEmployeeTable(dashboardState);
  });
}

function applyDashboardVisibility(dashboardState) {
  const globalPanel = document.getElementById('dev-dashboard-global-panel');
  const singlePanel = document.getElementById('dev-dashboard-single-panel');
  const tenantSelectWrap = document.getElementById('dev-dashboard-tenant-select-wrap');
  const roleBadge = document.getElementById('dev-dashboard-role-badge');

  if (roleBadge) {
    roleBadge.textContent = dashboardState.isSuperAdmin ? 'Super-Admin' : 'Betriebs-Admin';
    roleBadge.dataset.role = dashboardState.isSuperAdmin ? 'super' : 'tenant';
  }

  if (globalPanel) {
    globalPanel.hidden = !dashboardState.isSuperAdmin;
  }
  if (singlePanel) {
    singlePanel.hidden = dashboardState.isSuperAdmin;
  }
  if (tenantSelectWrap) {
    tenantSelectWrap.hidden = !dashboardState.isSuperAdmin;
  }
}

let tenantsUnsubscribe = null;
let singleTenantUnsubscribe = null;
const dashboardState = {
  isSuperAdmin: false,
  selectedTenantId: '',
  currentUserUid: '',
  actorEmail: '',
  employees: [],
  tenantModules: {},
  tenantDisplayName: '',
  tenantStatus: 'active',
  userQuery: '',
  userRoleFilter: 'all',
  activeTab: 'overview',
  db: null,
};

function setDevDashboardTab(tabKey = 'overview') {
  const nextTab = DEV_DASHBOARD_TABS.has(tabKey) ? tabKey : 'overview';
  dashboardState.activeTab = nextTab;

  document.querySelectorAll('.dev-dashboard-tab').forEach((btn) => {
    const active = btn.getAttribute('data-dev-tab') === nextTab;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  // Nur Tab-Panels — nie body (früher: body hatte dieselbe Klasse → body.hidden = true → Weißfläche).
  document.querySelectorAll('#page-dev-dashboard .dev-dashboard-view[role="tabpanel"]').forEach((view) => {
    const viewTab = String(view.id || '').replace(/^dev-dashboard-view-/, '');
    view.hidden = viewTab !== nextTab;
  });
  document.body && (document.body.hidden = false);
  document.body?.removeAttribute('hidden');

  if (nextTab === 'overview') {
    renderOverviewCards(dashboardState);
  }
  if (nextTab === 'settings') {
    fillSettingsForm(dashboardState);
  }
  if (nextTab === 'audit') {
    renderAuditTable(dashboardState.selectedTenantId);
  }
  if (nextTab === 'users') {
    renderEmployeeTable(dashboardState.employees, dashboardState.currentUserUid);
  }
}

function bindDevDashboardTabs() {
  const tabs = document.querySelector('.dev-dashboard-tabs');
  if (!tabs || tabs.dataset.bound === '1') return;
  tabs.dataset.bound = '1';
  tabs.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-dev-tab]');
    if (!(btn instanceof HTMLButtonElement)) return;
    setDevDashboardTab(btn.getAttribute('data-dev-tab') || 'overview');
  });
}

function subscribeAllTenants(db, statusEl) {
  if (tenantsUnsubscribe) tenantsUnsubscribe();
  tenantsUnsubscribe = db.collection('tenants').onSnapshot(
    (snap) => {
      const tenants = snap.docs.map((doc) => ({ id: doc.id, data: doc.data() || {} }));
      renderTenantTable(tenants, {
        emptyMessage: tenants.length ? '' : EMPTY_TENANTS_MESSAGE,
      });
      bindTenantSelector(dashboardState, tenants);
      if (statusEl && tenants.length) {
        statusEl.textContent = `${tenants.length} Mandant${tenants.length === 1 ? '' : 'en'} geladen`;
      }
    },
    (err) => {
      console.error('[Dev-Dashboard] Mandanten-Listener fehlgeschlagen:', err);
      const emptyMessage = isPermissionDeniedError(err)
        ? PERMISSION_DENIED_MESSAGE
        : `⚠️ Fehler beim Laden: ${err?.message || 'Unbekannt'}`;
      renderTenantTable([], { emptyMessage });
      if (statusEl) {
        statusEl.textContent = isPermissionDeniedError(err)
          ? 'Firestore-Zugriff verweigert'
          : `Fehler beim Laden: ${err?.message || 'Unbekannt'}`;
      }
    },
  );
  return tenantsUnsubscribe;
}

function subscribeSingleTenant(db, tenantId, statusEl) {
  if (singleTenantUnsubscribe) singleTenantUnsubscribe();
  if (!tenantId) return null;

  singleTenantUnsubscribe = db.collection('tenants').doc(tenantId).onSnapshot(
    (snap) => {
      const data = snap.data() || {};
      dashboardState.tenantDisplayName = String(data.displayName || tenantId).trim();
      dashboardState.tenantStatus = data.status === 'inactive' ? 'inactive' : 'active';
      dashboardState.tenantModules = data.enabledModules && typeof data.enabledModules === 'object'
        ? { ...data.enabledModules }
        : {};
      renderSingleTenantPanel(tenantId, data);
      renderOverviewCards(dashboardState);
      if (dashboardState.activeTab === 'settings') fillSettingsForm(dashboardState);
      if (statusEl) statusEl.textContent = `Betrieb: ${dashboardState.tenantDisplayName}`;
    },
    (err) => {
      console.error('[Dev-Dashboard] Mandanten-Dokument fehlgeschlagen:', err);
      const container = document.getElementById('dev-dashboard-single-tenant');
      if (container) {
        container.innerHTML = `<p class="dev-dashboard-empty-msg dev-dashboard-empty-msg--error">${PERMISSION_DENIED_MESSAGE}</p>`;
      }
    },
  );
  return singleTenantUnsubscribe;
}

export async function initDevDashboard(db, { currentUser, authContext } = {}) {
  try {
    const statusEl = document.getElementById('dev-dashboard-status');

    // Desktop-Layout immer aktivieren — auch im Fehlerfall, damit weder
    // Fehlermeldung noch Login-Overlay im Smartphone-Simulator landen.
    hideMainAppChrome();
    showDevDashboardPage();

    // Unauthentifiziert / Auth noch leer → Login-Panel (kein Redirect, keine weiße Seite).
    if (!currentUser?.uid) {
      showDevDashboardAccessDenied({ reason: 'login' });
      renderFallbackUI('Bitte erst als Betriebs-Admin anmelden.');
      if (statusEl) statusEl.textContent = 'Anmeldung erforderlich';
      return false;
    }

    // RBAC: eingeloggt, aber kein Betriebs-Admin → Denied.
    const authGate = useTenantAdminAuth({
      user: currentUser,
      authContext,
      redirect: false,
      renderFallback: true,
    });
    if (!authGate.allowed) {
      showDevDashboardAccessDenied({
        reason: authGate.needsLogin ? 'login' : 'forbidden',
      });
      if (authGate.needsLogin) {
        renderFallbackUI('Bitte erst als Betriebs-Admin anmelden.');
      }
      if (statusEl) {
        statusEl.textContent = authGate.needsLogin ? 'Anmeldung erforderlich' : 'Zugriff verweigert';
      }
      return false;
    }
    hideDevDashboardAccessDenied();

    dashboardState.isSuperAdmin = authGate.isSuperAdmin || isSuperAdmin(currentUser);
    dashboardState.selectedTenantId = authContext?.tenantId || '';
    dashboardState.currentUserUid = currentUser?.uid || '';
    dashboardState.actorEmail = String(currentUser?.email || '').trim();
    dashboardState.db = db;

    applyDashboardVisibility(dashboardState);

    if (typeof window.applyResolvedBranding === 'function') {
      window.applyResolvedBranding(authContext?.tenantId || window.resolveEffectiveTenantId?.());
    }
    const settingsDraft = readTenantSettingsDraft(dashboardState.selectedTenantId);
    if (settingsDraft.displayName || settingsDraft.logoUrl) {
      applyBrandingFromSettingsDraft(dashboardState.selectedTenantId, settingsDraft);
      if (settingsDraft.displayName) dashboardState.tenantDisplayName = settingsDraft.displayName;
    }

    bindDevDashboardBackButton();
    bindDevDashboardTabs();
    bindOverviewJumpLinks();
    bindSettingsForm(dashboardState);
    bindUserFilters(dashboardState);
    bindInvitePanel();
    bindTenantToggleHandlers(db, statusEl);
    bindTenantCreateForm(db);
    bindEmployeeCreateForm(dashboardState);
    bindEmployeeTableActions(dashboardState);

    if (dashboardState.isSuperAdmin) {
      subscribeAllTenants(db, statusEl);
    } else {
      subscribeSingleTenant(db, dashboardState.selectedTenantId, statusEl);
      bindTenantSelector(dashboardState, [{ id: dashboardState.selectedTenantId, data: {} }]);
    }

    recordAudit('login', 'Verwaltung geöffnet', 'security');
    setDevDashboardTab(dashboardState.activeTab || 'overview');
    await refreshEmployeeTable(dashboardState);
    renderOverviewCards(dashboardState);

    if (statusEl && dashboardState.isSuperAdmin) {
      statusEl.textContent = `Angemeldet als ${currentUser?.email || 'Super-Admin'} · Lade Betriebe…`;
    } else if (statusEl) {
      statusEl.textContent = `Angemeldet als ${currentUser?.email || 'Admin'} · ${dashboardState.selectedTenantId}`;
    }
    document.body && (document.body.hidden = false);
    document.body?.removeAttribute('hidden');
    window.__charculogicDevDashboardReady = true;
    clearAdminFallbackUI({ force: true });
    return true;
  } catch (err) {
    console.error('[Dev-Dashboard] initDevDashboard fehlgeschlagen:', err);
    window.__charculogicDevDashboardReady = false;
    renderFallbackUI('Bitte erst als Betriebs-Admin anmelden.');
    return false;
  }
}

export function teardownDevDashboard() {
  if (tenantsUnsubscribe) {
    tenantsUnsubscribe();
    tenantsUnsubscribe = null;
  }
  if (singleTenantUnsubscribe) {
    singleTenantUnsubscribe();
    singleTenantUnsubscribe = null;
  }
}
