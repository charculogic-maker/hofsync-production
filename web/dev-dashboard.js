/**
 * Enterprise Dev-Dashboard – /dev-dashboard
 * Super-Admin: alle Mandanten | Mandanten-Admin: nur eigener Mandant
 */
import {
  ACCESS_MODULE_KEYS,
  DEFAULT_ROLE_MODULE_DEFAULTS,
  isTenantAccessKeyEnabled,
  isTenantModuleEnabled,
  normalizeAccessModuleMap,
  normalizeRoleModuleDefaults,
  resolveRoleModuleAllowlist,
  TENANT_MODULE_KEYS,
  TENANT_ROLES_FOR_MODULES,
} from './tenant-modules.js';
import { createHttpsCallable, getRegionalFunctions, FUNCTIONS_REGION } from './firebase-functions.js';
import { waitForAppCheckReady } from './app-check.js';
import {
  handleEmergencyLogoutParam,
  installSecretLogoutGestures,
  isEmergencyLogoutRequested,
  signOutAndShowLogin,
} from './firebase-init.js';
import {
  appendTenantAuditEvent,
  AUDIT_STORAGE_SCOPE_HINT,
  AUDIT_STORAGE_SCOPE_LABEL,
  ensureTenantAuditSeed,
  filterTenantUsers,
  formatAuditTime,
  MHD_CARD_UI_SETTING_KEYS,
  MHD_CARD_UI_SETTING_LABELS,
  readMhdCardUiSettings,
  readTenantSettingsDraft,
  summarizeTenantModules,
  summarizeTenantUsers,
  TENANT_MODULE_LABELS,
  writeMhdCardUiSettings,
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
import {
  DEPARTMENT_KEYS,
  DEPARTMENT_LABELS,
  getEmployeeDepartmentAssignment,
  saveEmployeeDepartmentAssignment,
  setTeamConfigTenantId,
} from './team-config.js';
import { renderSupplyCatalogAdminTable } from './quick-alert.js';
import { logAndMapOperatorError } from './operator-errors.js';
import { getNamedTenantCollection, initTenantDb, setGlobalTenantId } from './tenant-db.js';
import { persistProductMasterToFirestore } from './product-master.js';
import { sanitizeProductName } from './utils.js';
import {
  refreshDevDashboardHaccpAdmin,
  syncDevDashboardHaccpAdmin,
} from './dev-dashboard-haccp.js';
import { refreshDiscountMatrixUi } from './discount-matrix-ui.js';
import {
  AUDIT_LOGS_COLLECTION,
  MHD_AUDIT_COLLECTION,
  berlinAddDaysIso,
  berlinDayEndMs,
  berlinDayStartMs,
  berlinTodayIso,
  buildProtokollCorrectionPlan,
  buildShopNameOptions,
  defaultReportFromIso,
  formatBerlinDay,
  csvFilename,
  filterMovements,
  formatMovementTime,
  formatQtyDelta,
  mergeMovementRows,
  movementActionLabel,
  movementFromAuditDoc,
  movementFromMhdListeDoc,
  movementsToCsv,
  normalizeIsoDate,
} from './mhd-audit.js';

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

/**
 * Aktiver Mandant für die Verwaltung: zuerst Claim, dann Branding/Host.
 * Keine globale tenants-Collection nötig.
 * @param {{ tenantId?: string }|null|undefined} authContext
 * @param {{ tenantId?: string, selectedTenantId?: string }} [extras]
 * @returns {string}
 */
export function resolveDashboardTenantId(authContext = {}, extras = {}) {
  const fromClaim = String(authContext?.tenantId || '').trim();
  if (fromClaim) return fromClaim;
  const fromExtra = String(extras.tenantId || extras.selectedTenantId || '').trim();
  if (fromExtra) return fromExtra;
  if (typeof window !== 'undefined' && typeof window.resolveEffectiveTenantId === 'function') {
    return String(window.resolveEffectiveTenantId() || '').trim();
  }
  return '';
}

const DEV_DASHBOARD_TABS = new Set([
  'overview',
  'users',
  'settings',
  'platform',
  'audit',
]);

const GENERIC_BETRIEB_NAME = 'Mein Hofladen / Metzgerei';

const TIER_LABELS = {
  mhd_retter: 'MHD-Retter',
  hofladen_komplett: 'Hofladen komplett',
  metzgerei_pro: 'Metzgerei Pro',
};

/** UI-Labels für Plattform-Tabelle und Read-Only-Badges in „Mein Betrieb“. */
const MODULE_LABELS = {
  ...TENANT_MODULE_LABELS,
  averyLabels: 'Avery Etiketten',
  retterBox: 'Retter-Box',
  rezeptAudit: 'Rezept-Audit',
};

/**
 * Erlaubte Modul-Keys für setTenantModules (freundliche + interne Aliase).
 * Unbekannte Keys (z. B. wissen) werden vor dem Callable verworfen.
 */
const VALID_BACKEND_MODULES = Object.freeze([
  'mhdMonitor',
  'wareneingang',
  'wurstkueche',
  'haccp',
  'teamboard',
  'team',
  'orders',
  'batches',
  'averyLabels',
  'retterBox',
  'rezeptAudit',
  // Interne Keys der Plattform-Tabelle (ebenfalls von applyModulePatch akzeptiert)
  'mhd',
  'receiving',
  'kitchen',
  'start',
  'buero',
  'knowledge',
  'chargenDoku',
]);

const VALID_BACKEND_MODULE_SET = new Set(VALID_BACKEND_MODULES);

/** UI-/Legacy-Key → kanonischer Payload-Key (bevorzugt freundliche Aliase). */
const MODULE_KEY_TO_BACKEND = Object.freeze({
  mhd: 'mhdMonitor',
  mhdMonitor: 'mhdMonitor',
  receiving: 'wareneingang',
  wareneingang: 'wareneingang',
  kitchen: 'wurstkueche',
  wurstkueche: 'wurstkueche',
  start: 'teamboard',
  teamboard: 'teamboard',
  buero: 'batches',
  batches: 'batches',
  haccp: 'haccp',
  team: 'team',
  orders: 'orders',
  averyLabels: 'averyLabels',
  avery: 'averyLabels',
  retterBox: 'retterBox',
  rezeptAudit: 'rezeptAudit',
  knowledge: 'knowledge',
  wissen: 'knowledge',
  chargenDoku: 'chargenDoku',
  traceability: 'chargenDoku',
});

/**
 * Filtert enabledModules auf VALID_BACKEND_MODULES und liefert parallel `modules`.
 * @param {string[]|Record<string, boolean>|null|undefined} enabledModules
 * @returns {{ enabledModules: Record<string, boolean>, modules: Record<string, boolean> }}
 */
function sanitizeEnabledModulesPayload(enabledModules) {
  /** @type {Record<string, boolean>} */
  const modules = {};

  if (Array.isArray(enabledModules)) {
    enabledModules.forEach((rawKey) => {
      const mapped = MODULE_KEY_TO_BACKEND[rawKey] || String(rawKey || '').trim();
      if (!mapped || !VALID_BACKEND_MODULE_SET.has(mapped)) return;
      modules[mapped] = true;
    });
  } else if (enabledModules && typeof enabledModules === 'object') {
    Object.entries(enabledModules).forEach(([rawKey, value]) => {
      if (typeof value !== 'boolean') return;
      const mapped = MODULE_KEY_TO_BACKEND[rawKey] || rawKey;
      if (!VALID_BACKEND_MODULE_SET.has(mapped)) return;
      modules[mapped] = value;
    });
  }

  return {
    enabledModules: { ...modules },
    modules: { ...modules },
  };
}

function formatCallableErrorMessage(error) {
  const parts = [
    error?.message,
    error?.details,
    error?.code,
    typeof error === 'string' ? error : '',
  ]
    .map((part) => String(part || '').trim())
    .filter(Boolean);
  return parts.length ? parts.join(' — ') : 'Unbekannter Fehler';
}

/**
 * Anzeige-Reihenfolge der aktiven Module in „Mein Betrieb“ (nur Lesen).
 * Schalten bleibt exklusiv bei Super-Admin → „Plattform & Mandanten“.
 * `orders` ist eigenständig (nicht an `team` gekoppelt).
 */
const BETRIEB_MODULE_DISPLAY = [
  { key: 'mhd', label: 'MHD-Monitor', readKeys: ['mhd', 'mhdMonitor'] },
  { key: 'receiving', label: 'Wareneingang', readKeys: ['receiving', 'wareneingang'] },
  { key: 'kitchen', label: 'Wurstküche & Rezepte', readKeys: ['kitchen', 'wurstkueche', 'rezepte'] },
  {
    key: 'averyLabels',
    label: 'Avery Etiketten',
    readKeys: ['averyLabels', 'avery'],
  },
  { key: 'haccp', label: 'HACCP', readKeys: ['haccp'] },
  { key: 'start', label: 'Teamboard', readKeys: ['start', 'teamboard'] },
  { key: 'team', label: 'Team', readKeys: ['team'] },
  {
    key: 'orders',
    label: 'Kundenbestellungen & Packtisch',
    readKeys: ['orders'],
  },
  { key: 'buero', label: 'Büro & Chargen', readKeys: ['buero', 'batches', 'chargenDoku'] },
  { key: 'retterBox', label: 'Retter-Box', readKeys: ['retterBox'] },
];

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
  setText('dev-kpi-status-hint', TIER_LABELS[dashboardStateRef.tenantTier] || 'Tarif');
}

function tenantLabelFromData(data = {}, fallbackId = '') {
  return String(data.displayName || data.name || data.betriebsName || fallbackId || '').trim();
}

function preferredBetriebName(dashboardStateRef) {
  const live = String(dashboardStateRef.tenantDisplayName || '').trim();
  const draft = String(readTenantSettingsDraft(dashboardStateRef.selectedTenantId).displayName || '').trim();
  const fallback = String(window.BRANDING?.betriebsName || '').trim();
  if (live && live !== GENERIC_BETRIEB_NAME) return live;
  if (draft && draft !== GENERIC_BETRIEB_NAME) return draft;
  return live || draft || fallback;
}

function betriebModuleActive(enabledModules, control) {
  const mods = enabledModules && typeof enabledModules === 'object' ? enabledModules : {};
  if (!Object.keys(mods).length) return isTenantModuleEnabled(control.key);
  const present = control.readKeys.filter((key) => Object.prototype.hasOwnProperty.call(mods, key));
  if (!present.length) return false;
  return present.some((key) => mods[key] === true);
}

/**
 * Read-only Badges der aktiven Module in „Mein Betrieb“.
 * Keine Checkboxen — Schalten nur unter „Plattform & Mandanten“.
 */
function fillBetriebModuleToggles(dashboardStateRef = dashboardState) {
  const listEl = document.getElementById('dev-dashboard-betrieb-modules-list');
  const hint = document.getElementById('dev-dashboard-betrieb-modules-hint');
  if (hint) {
    hint.textContent = dashboardStateRef.isSuperAdmin
      ? 'Nur Anzeige. Module schaltest du unter „Plattform & Mandanten“.'
      : 'Nur Anzeige. Freischaltungen nimmt die Plattform-Verwaltung vor.';
  }
  if (!listEl) return;

  const active = BETRIEB_MODULE_DISPLAY.filter((control) => (
    betriebModuleActive(dashboardStateRef.tenantModules, control)
  ));

  if (!active.length) {
    listEl.innerHTML = '<p class="dev-dashboard-module-badges-empty">Keine Module freigeschaltet.</p>';
    return;
  }

  listEl.innerHTML = active.map((control) => {
    const label = MODULE_LABELS[control.key] || control.label || control.key;
    return `<span class="dev-dashboard-module-badge" role="listitem">${escapeHtml(label)}</span>`;
  }).join('');
}

function roleLabelForModules(role) {
  if (role === 'admin') return 'Admin';
  if (role === 'helper') return 'Aushilfe';
  return 'Mitarbeiter';
}

function setRoleModulesStatus(message = '', tone = 'info') {
  const statusEl = document.getElementById('dev-dashboard-role-modules-status');
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
}

/**
 * Liest role_modules aus Firestore und füllt die Matrix.
 * @param {object} dashboardStateRef
 */
async function loadAndFillRoleModuleMatrix(dashboardStateRef = dashboardState) {
  const tenantId = dashboardStateRef.selectedTenantId;
  const db = dashboardStateRef.db;
  let defaults = normalizeRoleModuleDefaults(null);
  if (db && tenantId) {
    try {
      const snap = await db.collection('tenants').doc(tenantId)
        .collection('settings').doc('role_modules').get();
      if (snap.exists) {
        defaults = normalizeRoleModuleDefaults(snap.data() || {});
      }
    } catch (err) {
      console.warn('[Dev-Dashboard] role_modules laden fehlgeschlagen:', err);
    }
  }
  dashboardStateRef.roleModuleDefaults = defaults;
  fillRoleModuleMatrix(dashboardStateRef);
}

/**
 * Rendert Checkbox-Matrix: Rollen × Access-Module (Tenant-Decke beachten).
 * @param {object} dashboardStateRef
 */
function fillRoleModuleMatrix(dashboardStateRef = dashboardState) {
  const grid = document.getElementById('dev-dashboard-role-modules-grid');
  if (!grid) return;
  const defaults = dashboardStateRef.roleModuleDefaults
    || normalizeRoleModuleDefaults(null);
  const tenantModules = dashboardStateRef.tenantModules || {};

  grid.innerHTML = TENANT_ROLES_FOR_MODULES.map((role) => {
    const allow = resolveRoleModuleAllowlist(role, defaults);
    const toggles = ACCESS_MODULE_KEYS.map((key) => {
      const tenantOn = isTenantAccessKeyEnabled(key, tenantModules);
      const checked = allow[key] === true;
      const label = MODULE_LABELS[key] || TENANT_MODULE_LABELS[key] || key;
      return `
        <label class="dev-dashboard-toggle ${tenantOn ? '' : 'dev-dashboard-toggle--disabled'}" title="${escapeHtml(label)}">
          <input
            type="checkbox"
            data-role-module-role="${escapeHtml(role)}"
            data-role-module-key="${escapeHtml(key)}"
            ${checked ? 'checked' : ''}
            ${tenantOn ? '' : 'disabled'}
          >
          <span>${escapeHtml(label)}</span>
        </label>
      `;
    }).join('');
    return `
      <div class="dev-dashboard-role-modules-card" data-role="${escapeHtml(role)}">
        <h3 class="dev-dashboard-subsection-title">${escapeHtml(roleLabelForModules(role))}</h3>
        <div class="dev-dashboard-toggles">${toggles}</div>
      </div>
    `;
  }).join('');
}

/**
 * Liest die Matrix aus dem DOM.
 * @returns {Record<string, Record<string, boolean>>}
 */
function readRoleModuleMatrixFromDom() {
  /** @type {Record<string, Record<string, boolean>>} */
  const result = {};
  TENANT_ROLES_FOR_MODULES.forEach((role) => {
    result[role] = { ...DEFAULT_ROLE_MODULE_DEFAULTS[role] };
  });
  document.querySelectorAll('[data-role-module-role][data-role-module-key]').forEach((input) => {
    if (!(input instanceof HTMLInputElement)) return;
    const role = input.getAttribute('data-role-module-role');
    const key = input.getAttribute('data-role-module-key');
    if (!role || !key || !result[role]) return;
    result[role][key] = input.checked === true;
  });
  return normalizeRoleModuleDefaults(result);
}

async function persistRoleModuleDefaults(db, tenantId, roleModuleDefaults) {
  if (!db || !tenantId) throw new Error('Mandant fehlt.');
  const normalized = normalizeRoleModuleDefaults(roleModuleDefaults);
  const stamp = typeof firebase !== 'undefined' && firebase.firestore?.FieldValue?.serverTimestamp
    ? firebase.firestore.FieldValue.serverTimestamp()
    : new Date().toISOString();
  await db.collection('tenants').doc(tenantId).collection('settings').doc('role_modules').set({
    admin: normalized.admin,
    employee: normalized.employee,
    helper: normalized.helper,
    tenantId,
    updatedAt: stamp,
  }, { merge: true });
  return normalized;
}

function bindRoleModuleSave(dashboardStateRef = dashboardState) {
  const btn = document.getElementById('dev-dashboard-role-modules-save');
  if (!btn || btn.dataset.bound === '1') return;
  btn.dataset.bound = '1';
  btn.addEventListener('click', async () => {
    const tenantId = dashboardStateRef.selectedTenantId;
    if (!tenantId || !dashboardStateRef.db) {
      setRoleModulesStatus('Kein Betrieb ausgewählt.', 'error');
      return;
    }
    btn.disabled = true;
    setRoleModulesStatus('Speichere Rollen-Module…');
    try {
      const next = readRoleModuleMatrixFromDom();
      const saved = await persistRoleModuleDefaults(dashboardStateRef.db, tenantId, next);
      dashboardStateRef.roleModuleDefaults = saved;
      window.__hofsyncRoleModuleDefaults = saved;
      fillRoleModuleMatrix(dashboardStateRef);
      setRoleModulesStatus('Rollen-Module gespeichert.', 'success');
      window.showToast?.('Rollen-Module gespeichert.', 'success');
      recordAudit('role_modules', 'Module je Rolle aktualisiert', 'change');
    } catch (err) {
      console.error('[Dev-Dashboard] Rollen-Module speichern fehlgeschlagen:', err);
      setRoleModulesStatus(logAndMapOperatorError(err, 'admin-role-modules'), 'error');
      window.showToast?.('Rollen-Module konnten nicht gespeichert werden.', 'error');
    } finally {
      btn.disabled = false;
    }
  });
}

/**
 * Kompakte Nutzer-Modul-Checkboxen (nur freigeschaltete Tenant-Module).
 * @param {object} employee
 * @returns {string}
 */
function renderEmployeeModuleToggles(employee) {
  const isProfile = isProfileEmployeeUid(employee.uid) || employee.source === 'profile';
  const isDisabled = employee.disabled === true || employee.status === 'inactive';
  const allowed = normalizeAccessModuleMap(employee.allowedModules, { defaultAllow: true });
  const tenantModules = dashboardState.tenantModules || {};
  const toggles = ACCESS_MODULE_KEYS.map((key) => {
    const tenantOn = isTenantAccessKeyEnabled(key, tenantModules);
    if (!tenantOn) return '';
    const label = MODULE_LABELS[key] || TENANT_MODULE_LABELS[key] || key;
    const checked = allowed[key] !== false;
    return `
      <label class="dev-dashboard-toggle dev-dashboard-toggle--compact" title="${escapeHtml(label)}">
        <input
          type="checkbox"
          data-action="toggle-user-module"
          data-uid="${escapeHtml(employee.uid)}"
          data-tenant-id="${escapeHtml(employee.tenantId)}"
          data-module-key="${escapeHtml(key)}"
          ${checked ? 'checked' : ''}
          ${isProfile || isDisabled ? 'disabled' : ''}
        >
        <span>${escapeHtml(label)}</span>
      </label>
    `;
  }).filter(Boolean).join('');
  if (!toggles) {
    return '<span class="dev-dashboard-tenant-sub">Keine Module freigeschaltet</span>';
  }
  return `<div class="dev-dashboard-toggles dev-dashboard-toggles--user">${toggles}</div>`;
}

/**
 * Fachbereichs-Tags + Bestellrecht für Schnellmelde/Bedarfe (teamDashboard.departmentAssignments).
 * @param {object} employee
 * @returns {string}
 */
function renderEmployeeDepartmentToggles(employee) {
  const isDisabled = employee.disabled === true || employee.status === 'inactive';
  const displayName = String(employee.displayName || '').trim();
  const assignment = displayName
    ? getEmployeeDepartmentAssignment(displayName)
    : { departments: [], canOrder: false };
  const fromEmployee = Array.isArray(employee.departments)
    ? employee.departments
    : assignment.departments;
  const departments = new Set(
    (fromEmployee.length ? fromEmployee : assignment.departments).map((d) => String(d).toLowerCase()),
  );
  const canOrder = employee.canOrder === true || assignment.canOrder === true;
  const safeUid = escapeHtml(employee.uid);
  const safeTenantId = escapeHtml(employee.tenantId);
  const safeName = escapeHtml(displayName);

  const deptToggles = DEPARTMENT_KEYS.map((key) => {
    const label = DEPARTMENT_LABELS[key] || key;
    const checked = departments.has(key);
    return `
      <label class="dev-dashboard-toggle dev-dashboard-toggle--compact" title="${escapeHtml(label)}">
        <input
          type="checkbox"
          data-action="toggle-user-department"
          data-uid="${safeUid}"
          data-tenant-id="${safeTenantId}"
          data-display-name="${safeName}"
          data-department-key="${escapeHtml(key)}"
          ${checked ? 'checked' : ''}
          ${isDisabled || !displayName ? 'disabled' : ''}
        >
        <span>${escapeHtml(label)}</span>
      </label>
    `;
  }).join('');

  return `
    <div class="dev-dashboard-toggles dev-dashboard-toggles--departments" data-employee-departments="${safeUid}">
      ${deptToggles}
      <label class="dev-dashboard-toggle dev-dashboard-toggle--compact" title="Darf Bedarfe als bestellt/erledigt markieren">
        <input
          type="checkbox"
          data-action="toggle-user-can-order"
          data-uid="${safeUid}"
          data-tenant-id="${safeTenantId}"
          data-display-name="${safeName}"
          ${canOrder ? 'checked' : ''}
          ${isDisabled || !displayName ? 'disabled' : ''}
        >
        <span>Darf bestellen</span>
      </label>
    </div>
  `;
}

/**
 * Baut einen Merge-Patch im Field-Path-Stil (`enabledModules.orders: true`).
 * Nicht aufgeführte Module fehlen bewusst — Backend merged ohne Blind-Reset.
 * @param {Record<string, boolean>} modulePatch
 * @returns {Record<string, boolean>}
 */
function buildEnabledModulesFieldPatch(modulePatch) {
  const fieldPatch = {};
  Object.entries(modulePatch || {}).forEach(([key, value]) => {
    if (typeof value !== 'boolean') return;
    fieldPatch[`enabledModules.${key}`] = value;
  });
  return fieldPatch;
}

function renderAuditTable(tenantId = dashboardState.selectedTenantId) {
  const tbody = document.getElementById('dev-dashboard-audit-body');
  if (!tbody) return;
  const badge = document.querySelector('#dev-dashboard-view-audit .dev-dashboard-local-badge');
  if (badge) {
    badge.textContent = AUDIT_STORAGE_SCOPE_LABEL;
    badge.title = AUDIT_STORAGE_SCOPE_HINT;
  }
  const intro = document.getElementById('dev-dashboard-audit-table')
    ?.closest('section')
    ?.querySelector('.dev-dashboard-intro');
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

function reportFilterState() {
  const today = berlinTodayIso();
  const fromEl = document.getElementById('dev-dashboard-report-from');
  const toEl = document.getElementById('dev-dashboard-report-to');
  const from = String(fromEl?.value || today).slice(0, 10);
  const to = String(toEl?.value || today).slice(0, 10);
  return {
    from: from <= to ? from : to,
    to: from <= to ? to : from,
    actorName: String(document.getElementById('dev-dashboard-report-actor')?.value || '').trim(),
    actionType: String(document.getElementById('dev-dashboard-report-action')?.value || '').trim(),
  };
}

function setReportStatus(message = '', tone = 'info') {
  const statusEl = document.getElementById('dev-dashboard-report-status');
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
}

function fillReportActorOptions(extraNames = []) {
  const select = document.getElementById('dev-dashboard-report-actor');
  if (!select) return;
  const current = select.value;
  const names = buildShopNameOptions(extraNames);
  select.innerHTML = ['<option value="">Alle</option>', ...names.map((name) => (
    `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`
  ))].join('');
  if (current && names.some((name) => name === current)) select.value = current;
}

function renderMovementReport(rows) {
  const tbody = document.getElementById('dev-dashboard-report-body');
  if (!tbody) return;
  dashboardState.movementRows = rows;
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="dev-dashboard-empty-msg dev-dashboard-empty-msg--info">Keine Warenbewegungen in diesem Zeitraum.</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map((row) => {
    const name = sanitizeProductName(row.articleName) || 'Artikel';
    const mhdIso = normalizeIsoDate(row.mhdDate);
    const mhdLabel = mhdIso ? `MHD ${formatBerlinDay(mhdIso)}` : '';
    const rowId = escapeHtml(row.id || `${row.ean}|${row.atMs}`);
    return `
    <tr data-report-row-id="${rowId}">
      <td data-col="time">${escapeHtml(formatMovementTime(row.atMs))}</td>
      <td data-col="actor">${escapeHtml(row.actorName || '—')}</td>
      <td data-col="article">
        <div class="dev-dashboard-report-article">
          <strong>${escapeHtml(name)}</strong>
          <span>${escapeHtml(row.ean || 'ohne EAN')}</span>
          ${mhdLabel ? `<span>${escapeHtml(mhdLabel)}</span>` : ''}
        </div>
      </td>
      <td data-col="action"><span class="dev-dashboard-action-badge" data-action="${escapeHtml(row.actionType)}">${escapeHtml(movementActionLabel(row.actionType))}</span></td>
      <td data-col="qty">${escapeHtml(formatQtyDelta(row.qtyFrom, row.qtyTo))}</td>
      <td data-col="edit">
        <button type="button" class="dev-dashboard-report-edit-btn" data-report-edit="${rowId}">Korrigieren</button>
      </td>
    </tr>
  `;
  }).join('');
}

function docsToMovements(docs, mapper) {
  return (docs || [])
    .map((doc) => mapper(doc.id, doc.data() || {}))
    .filter(Boolean);
}

async function getQuerySnapshot(query) {
  return query.get();
}

async function fetchPagedQuery(buildPage, { pageSize = 500, maxPages = 20 } = {}) {
  const docs = [];
  const seen = new Set();
  let cursor = null;
  for (let page = 0; page < maxPages; page += 1) {
    const snap = await getQuerySnapshot(buildPage(cursor, pageSize));
    if (!snap?.docs?.length) break;
    const fresh = snap.docs.filter((doc) => doc?.id && !seen.has(doc.id));
    if (!fresh.length) break;
    fresh.forEach((doc) => seen.add(doc.id));
    docs.push(...fresh);
    cursor = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < pageSize) break;
  }
  return docs;
}

function documentIdOrder(col) {
  const fieldPath = window.firebase?.firestore?.FieldPath?.documentId?.();
  return fieldPath ? col.orderBy(fieldPath) : col;
}

async function fetchAuditCollectionDocs(tenantId, collectionName, startMs, endMs) {
  const col = getNamedTenantCollection(tenantId, collectionName);
  try {
    const docs = await fetchPagedQuery((cursor, pageSize) => {
      let query = col.where('atMs', '>=', startMs).where('atMs', '<=', endMs).orderBy('atMs', 'desc').limit(pageSize);
      if (cursor) query = query.startAfter(cursor);
      return query;
    });
    return docsToMovements(docs, movementFromAuditDoc)
      .filter((row) => row.atMs >= startMs && row.atMs <= endMs);
  } catch (err) {
    console.warn(`[Dev-Dashboard] ${collectionName} Bereichsabfrage nicht möglich, lade Fallback:`, err);
    const docs = await fetchPagedQuery((cursor, pageSize) => {
      let query = documentIdOrder(col).limit(pageSize);
      if (cursor) query = query.startAfter(cursor);
      return query;
    }, { pageSize: 500, maxPages: 30 });
    return docsToMovements(docs, movementFromAuditDoc)
      .filter((row) => row && row.atMs >= startMs && row.atMs <= endMs);
  }
}

async function fetchMhdListeByField(col, field, fromValue, toValue) {
  try {
    const docs = await fetchPagedQuery((cursor, pageSize) => {
      let query = col.where(field, '>=', fromValue).where(field, '<=', toValue).orderBy(field, 'desc').limit(pageSize);
      if (cursor) query = query.startAfter(cursor);
      return query;
    }, { pageSize: 500, maxPages: 10 });
    return docs;
  } catch (err) {
    console.warn(`[Dev-Dashboard] mhd_liste ${field}-Abfrage nicht möglich:`, err);
    return [];
  }
}

async function fetchMhdListeFallback(tenantId, startMs, endMs, fromIso, toIso) {
  const col = getNamedTenantCollection(tenantId, 'mhd_liste');
  const startDate = new Date(startMs);
  const endDate = new Date(endMs);
  const groups = await Promise.all([
    fetchMhdListeByField(col, 'lastCheckedDate', fromIso, toIso),
    fetchMhdListeByField(col, 'lastMhdCheckDate', fromIso, toIso),
    fetchMhdListeByField(col, 'updatedAt', startDate, endDate),
    fetchMhdListeByField(col, 'lastMhdCheckAt', startMs, endMs),
    fetchMhdListeByField(col, 'lastMhdCheckAt', startDate.toISOString(), endDate.toISOString()),
    fetchMhdListeByField(col, 'wareneingangAt', startDate.toISOString(), endDate.toISOString()),
  ]);
  const byId = new Map();
  groups.flat().forEach((doc) => {
    if (doc?.id && !byId.has(doc.id)) byId.set(doc.id, doc);
  });
  if (!byId.size) {
    const fallbackDocs = await fetchPagedQuery((cursor, pageSize) => {
      let query = documentIdOrder(col).limit(pageSize);
      if (cursor) query = query.startAfter(cursor);
      return query;
    }, { pageSize: 500, maxPages: 20 });
    fallbackDocs.forEach((doc) => {
      if (doc?.id && !byId.has(doc.id)) byId.set(doc.id, doc);
    });
  }
  return docsToMovements([...byId.values()], movementFromMhdListeDoc)
    .filter((row) => row && row.atMs >= startMs && row.atMs <= endMs);
}

async function loadMovementReport() {
  const tenantId = dashboardState.selectedTenantId;
  const tbody = document.getElementById('dev-dashboard-report-body');
  if (!tenantId || !dashboardState.db || !tbody) return;
  const filters = reportFilterState();
  const startMs = berlinDayStartMs(filters.from);
  const endMs = berlinDayEndMs(filters.to);
  setReportStatus('Bericht wird geladen…', 'info');
  tbody.innerHTML = '<tr><td colspan="6" class="dev-dashboard-empty-msg dev-dashboard-empty-msg--loading">Bericht wird geladen…</td></tr>';
  try {
    const [auditRows, logRows, listeRows] = await Promise.all([
      fetchAuditCollectionDocs(tenantId, MHD_AUDIT_COLLECTION, startMs, endMs).catch((err) => {
        console.error('[Dev-Dashboard] mhd_audit lesen fehlgeschlagen:', err);
        return [];
      }),
      fetchAuditCollectionDocs(tenantId, AUDIT_LOGS_COLLECTION, startMs, endMs).catch((err) => {
        console.error('[Dev-Dashboard] audit_logs lesen fehlgeschlagen:', err);
        return [];
      }),
      fetchMhdListeFallback(tenantId, startMs, endMs, filters.from, filters.to).catch((err) => {
        console.error('[Dev-Dashboard] mhd_liste-Fallback fehlgeschlagen:', err);
        return [];
      }),
    ]);
    const merged = mergeMovementRows([auditRows, logRows, listeRows]);
    const visible = filterMovements(merged, filters);
    fillReportActorOptions(merged.map((row) => row.actorName).filter((name) => name && name !== '—'));
    const actorSelect = document.getElementById('dev-dashboard-report-actor');
    if (actorSelect && filters.actorName) actorSelect.value = filters.actorName;
    renderMovementReport(visible);
    setReportStatus(
      visible.length
        ? `${visible.length} Bewegung${visible.length === 1 ? '' : 'en'} vom ${formatBerlinDay(filters.from)} bis ${formatBerlinDay(filters.to)}`
        : 'Keine Warenbewegungen in diesem Zeitraum.',
      'info',
    );
  } catch (err) {
    console.error('[Dev-Dashboard] Warenbericht fehlgeschlagen:', err);
    renderMovementReport([]);
    setReportStatus(logAndMapOperatorError(err, 'admin'), 'error');
  }
}

function downloadMovementCsv() {
  const rows = Array.isArray(dashboardState.movementRows) ? dashboardState.movementRows : [];
  if (!rows.length) {
    window.showToast?.('Kein Bericht zum Exportieren. Bitte zuerst einen Zeitraum mit Einträgen wählen.', 'warning');
    return;
  }
  const filters = reportFilterState();
  const csv = movementsToCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = csvFilename(filters.to || berlinTodayIso());
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  window.showToast?.('Warenbericht gespeichert. Datei liegt in den Downloads.', 'success');
}

function getReportEditorLabel() {
  const email = String(dashboardState.actorEmail || '').trim();
  if (email) return email.includes('@') ? email.slice(0, email.indexOf('@')) : email;
  try {
    const userEmail = window.firebase?.auth?.()?.currentUser?.email || '';
    if (userEmail) return userEmail.split('@')[0];
  } catch (_) { /* ignore */ }
  return 'Verwaltung';
}

function getReportEditModal() {
  return document.getElementById('dev-dashboard-report-edit-modal');
}

function setReportEditStatus(message = '', tone = 'info') {
  const statusEl = document.getElementById('dev-dashboard-report-edit-status');
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
}

function closeReportEditModal() {
  const modal = getReportEditModal();
  if (modal) {
    modal.hidden = true;
    modal.classList.remove('is-open');
  }
  dashboardState.editingMovement = null;
  setReportEditStatus('');
}

function findMovementByRowId(rowId) {
  const id = String(rowId || '');
  return (dashboardState.movementRows || []).find((row) => String(row.id) === id) || null;
}

function openReportEditModal(rowId) {
  const row = findMovementByRowId(rowId);
  const modal = getReportEditModal();
  if (!row || !modal) {
    window.showToast?.('Diesen Eintrag können wir gerade nicht öffnen.', 'warning');
    return;
  }
  dashboardState.editingMovement = row;
  const nameInput = document.getElementById('dev-dashboard-report-edit-name');
  const mhdInput = document.getElementById('dev-dashboard-report-edit-mhd');
  const qtyInput = document.getElementById('dev-dashboard-report-edit-qty');
  const metaEl = document.getElementById('dev-dashboard-report-edit-meta');
  if (nameInput) nameInput.value = sanitizeProductName(row.articleName) || '';
  if (mhdInput) mhdInput.value = normalizeIsoDate(row.mhdDate);
  if (qtyInput) {
    const qty = Number(row.qtyTo);
    qtyInput.value = Number.isFinite(qty) ? String(qty) : '';
  }
  if (metaEl) {
    const ean = row.ean || 'ohne EAN';
    metaEl.textContent = `${row.actorName || '—'} · ${ean} · ${formatMovementTime(row.atMs)}`;
  }
  setReportEditStatus('');
  modal.hidden = false;
  modal.classList.add('is-open');
  requestAnimationFrame(() => nameInput?.focus());
}

async function queryDocsByField(col, field, value, limitCount = 400) {
  if (!col || !value) return [];
  try {
    let query = col.where(field, '==', value);
    if (typeof query.limit === 'function') query = query.limit(limitCount);
    const snap = await query.get();
    return snap.docs || [];
  } catch (err) {
    console.warn(`[Dev-Dashboard] Abfrage ${field} nicht möglich:`, err);
    return [];
  }
}

function uniqueDocsById(docLists) {
  const byId = new Map();
  (docLists || []).flat().forEach((doc) => {
    if (doc?.id && !byId.has(doc.id)) byId.set(doc.id, doc);
  });
  return [...byId.values()];
}

async function updateNamedDoc(col, collectionName, docId, patch) {
  if (!col || !docId || !patch) return;
  await col.doc(docId).update(patch);
  dashboardState.correctionWrites.push({
    collection: collectionName,
    docId,
    patch,
  });
}

async function saveReportCorrection() {
  const tenantId = dashboardState.selectedTenantId;
  const row = dashboardState.editingMovement;
  const saveBtn = document.getElementById('dev-dashboard-report-edit-save');
  if (!tenantId || !row) {
    window.showToast?.('Korrektur konnte nicht gespeichert werden.', 'error');
    return;
  }
  const plan = buildProtokollCorrectionPlan({
    row,
    articleName: document.getElementById('dev-dashboard-report-edit-name')?.value,
    qty: document.getElementById('dev-dashboard-report-edit-qty')?.value,
    mhdDate: document.getElementById('dev-dashboard-report-edit-mhd')?.value,
    editorLabel: getReportEditorLabel(),
  });
  if (plan.error === 'name-missing') {
    setReportEditStatus('Bitte eine Produktbezeichnung eintragen.', 'error');
    window.showToast?.('Bitte eine Produktbezeichnung eintragen.', 'warning');
    document.getElementById('dev-dashboard-report-edit-name')?.focus();
    return;
  }
  if (plan.error === 'qty-invalid') {
    setReportEditStatus('Bitte eine Menge als ganze Zahl eintragen.', 'error');
    window.showToast?.('Bitte eine Menge als ganze Zahl eintragen.', 'warning');
    document.getElementById('dev-dashboard-report-edit-qty')?.focus();
    return;
  }

  dashboardState.correctionWrites = [];
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Speichern…';
  }
  setReportEditStatus('Korrektur wird gespeichert…', 'info');

  try {
    const listeCol = getNamedTenantCollection(tenantId, 'mhd_liste');
    const auditCol = getNamedTenantCollection(tenantId, MHD_AUDIT_COLLECTION);
    const logsCol = getNamedTenantCollection(tenantId, AUDIT_LOGS_COLLECTION);
    const writes = [];
    const listeIds = new Set();
    const auditIds = new Set();

    if (plan.ean) {
      const listeDocs = uniqueDocsById(await Promise.all([
        queryDocsByField(listeCol, 'ean', plan.ean),
        queryDocsByField(listeCol, 'barcode', plan.ean),
      ]));
      listeDocs.forEach((doc) => {
        listeIds.add(doc.id);
        const patch = doc.id === plan.mhdListeId
          ? { ...plan.listeNamePatch, ...plan.listeQtyMhdPatch }
          : { ...plan.listeNamePatch };
        writes.push(updateNamedDoc(listeCol, 'mhd_liste', doc.id, patch));
      });
    }
    if (plan.mhdListeId && !listeIds.has(plan.mhdListeId)) {
      writes.push(updateNamedDoc(listeCol, 'mhd_liste', plan.mhdListeId, {
        ...plan.listeNamePatch,
        ...plan.listeQtyMhdPatch,
      }));
    }

    const auditTargets = [
      [auditCol, MHD_AUDIT_COLLECTION],
      [logsCol, AUDIT_LOGS_COLLECTION],
    ];
    if (plan.ean) {
      for (const [col, name] of auditTargets) {
        const docs = await queryDocsByField(col, 'ean', plan.ean);
        docs.forEach((doc) => {
          const key = `${name}:${doc.id}`;
          auditIds.add(key);
          const patch = doc.id === plan.auditId
            ? { ...plan.auditNamePatch, ...plan.auditQtyMhdPatch }
            : { ...plan.auditNamePatch };
          writes.push(updateNamedDoc(col, name, doc.id, patch));
        });
      }
    }
    if (plan.auditId && !auditIds.has(`${MHD_AUDIT_COLLECTION}:${plan.auditId}`)) {
      writes.push(updateNamedDoc(auditCol, MHD_AUDIT_COLLECTION, plan.auditId, {
        ...plan.auditNamePatch,
        ...plan.auditQtyMhdPatch,
      }));
    }

    const results = await Promise.allSettled(writes);
    const failed = results.filter((entry) => entry.status === 'rejected');
    failed.forEach((entry) => {
      console.error('[Dev-Dashboard] Protokoll-Korrektur Schreiben fehlgeschlagen:', entry.reason);
    });

    if (plan.ean) {
      try {
        await persistProductMasterToFirestore(tenantId, {
          ean: plan.ean,
          name: plan.articleName,
        }, getReportEditorLabel());
      } catch (err) {
        console.warn('[Dev-Dashboard] Artikelname für künftige Eingänge nicht zentral gespeichert:', err);
      }
    }

    if (!dashboardState.correctionWrites.length && failed.length) {
      throw failed[0].reason || new Error('correction-failed');
    }

    dashboardState.lastCorrection = plan;
    closeReportEditModal();
    window.showToast?.(
      plan.ean
        ? 'Korrektur gespeichert. Den Namen merken wir uns für alle Posten mit dieser EAN und für den nächsten Wareneingang. Menge und MHD gelten nur für diesen Posten.'
        : 'Korrektur gespeichert. Menge und MHD gelten nur für diesen Posten.',
      'success',
    );
    await loadMovementReport();
  } catch (err) {
    console.error('[Dev-Dashboard] Protokoll-Korrektur fehlgeschlagen:', err);
    setReportEditStatus(logAndMapOperatorError(err, 'admin'), 'error');
    window.showToast?.(logAndMapOperatorError(err, 'admin'), 'error');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Speichern';
    }
  }
}

function applyReportRangeDays(daysBack) {
  const today = berlinTodayIso();
  const fromEl = document.getElementById('dev-dashboard-report-from');
  const toEl = document.getElementById('dev-dashboard-report-to');
  const from = berlinAddDaysIso(today, -Math.max(0, Number(daysBack) || 0));
  if (fromEl) fromEl.value = from;
  if (toEl) toEl.value = today;
  void loadMovementReport();
}

/** Aktiver Soft-Lock- / Session-Name für Protokoll „Meine Schicht“. */
function resolveReportSessionActorName() {
  try {
    const fromApi = String(window.readActiveEmployee?.() || '').trim();
    if (fromApi) return fromApi;
  } catch (_) { /* noop */ }
  return String(document.getElementById('employee-session-name')?.textContent || '').trim();
}

/** Heute + aktiver Mitarbeiter (Soft-Lock). */
function applyMeineSchichtFilter() {
  const today = berlinTodayIso();
  const fromEl = document.getElementById('dev-dashboard-report-from');
  const toEl = document.getElementById('dev-dashboard-report-to');
  if (fromEl) fromEl.value = today;
  if (toEl) toEl.value = today;
  const actor = resolveReportSessionActorName();
  fillReportActorOptions(actor ? [actor] : []);
  const select = document.getElementById('dev-dashboard-report-actor');
  if (select) {
    if (actor) {
      if (![...select.options].some((opt) => opt.value === actor)) {
        select.appendChild(new Option(actor, actor));
      }
      select.value = actor;
    } else {
      select.value = '';
      setReportStatus('Kein aktives Profil — Zeitraum heute, alle Mitarbeiter.', 'info');
    }
  }
  void loadMovementReport();
}

function bindMovementReportControls() {
  const form = document.getElementById('dev-dashboard-report-filters');
  const exportBtn = document.getElementById('dev-dashboard-report-export-btn');
  const presets = document.getElementById('dev-dashboard-report-presets');
  const today = berlinTodayIso();
  const fromEl = document.getElementById('dev-dashboard-report-from');
  const toEl = document.getElementById('dev-dashboard-report-to');
  if (fromEl && !fromEl.value) fromEl.value = defaultReportFromIso();
  if (toEl && !toEl.value) toEl.value = today;
  const sessionActor = resolveReportSessionActorName();
  fillReportActorOptions(sessionActor ? [sessionActor] : []);
  if (form && form.dataset.bound !== '1') {
    form.dataset.bound = '1';
    form.addEventListener('change', () => {
      void loadMovementReport();
    });
  }
  if (presets && presets.dataset.bound !== '1') {
    presets.dataset.bound = '1';
    presets.addEventListener('click', (event) => {
      const shiftBtn = event.target.closest('[data-report-shift="mine"]');
      if (shiftBtn instanceof HTMLButtonElement) {
        applyMeineSchichtFilter();
        return;
      }
      const btn = event.target.closest('[data-report-days]');
      if (!(btn instanceof HTMLButtonElement)) return;
      applyReportRangeDays(btn.getAttribute('data-report-days'));
    });
  }
  if (exportBtn && exportBtn.dataset.bound !== '1') {
    exportBtn.dataset.bound = '1';
    exportBtn.addEventListener('click', () => downloadMovementCsv());
  }
  const tbody = document.getElementById('dev-dashboard-report-body');
  if (tbody && tbody.dataset.editBound !== '1') {
    tbody.dataset.editBound = '1';
    tbody.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-report-edit]');
      if (!(btn instanceof HTMLButtonElement)) return;
      openReportEditModal(btn.getAttribute('data-report-edit'));
    });
  }
  const modal = getReportEditModal();
  if (modal && modal.dataset.bound !== '1') {
    modal.dataset.bound = '1';
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeReportEditModal();
    });
    document.getElementById('dev-dashboard-report-edit-cancel')?.addEventListener('click', () => {
      closeReportEditModal();
    });
    document.getElementById('dev-dashboard-report-edit-save')?.addEventListener('click', () => {
      void saveReportCorrection();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (modal.hidden) return;
      closeReportEditModal();
    });
  }
  exposeMovementReportApi();
}

function exposeMovementReportApi() {
  if (typeof window === 'undefined') return;
  window.__hofsyncMovementReport = {
    injectDb(db) {
      initTenantDb(db);
      dashboardState.db = db;
    },
    setTenant(tenantId) {
      dashboardState.selectedTenantId = String(tenantId || '').trim();
    },
    bind: bindMovementReportControls,
    load: loadMovementReport,
    download: downloadMovementCsv,
    applyMeineSchicht: applyMeineSchichtFilter,
    resolveSessionActor: resolveReportSessionActorName,
    getRows: () => dashboardState.movementRows,
    openEdit: openReportEditModal,
    saveEdit: saveReportCorrection,
    closeEdit: closeReportEditModal,
    getLastCorrection: () => dashboardState.lastCorrection || null,
    getWrites: () => dashboardState.correctionWrites || [],
  };
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

function syncMhdCardUiToggleInputs(tenantId) {
  const settings = readMhdCardUiSettings(tenantId);
  document.querySelectorAll('[data-mhd-ui-key]').forEach((input) => {
    if (!(input instanceof HTMLInputElement)) return;
    const key = input.getAttribute('data-mhd-ui-key');
    if (!MHD_CARD_UI_SETTING_KEYS.includes(key)) return;
    input.checked = settings[key] === true;
  });
}

function readSmtpFieldsFromForm() {
  return {
    smtpFromEmail: document.getElementById('dev-dashboard-smtp-from')?.value.trim() || '',
    smtpHost: document.getElementById('dev-dashboard-smtp-host')?.value.trim() || '',
    smtpPort: document.getElementById('dev-dashboard-smtp-port')?.value.trim() || '',
    smtpUser: document.getElementById('dev-dashboard-smtp-user')?.value.trim() || '',
    smtpPass: document.getElementById('dev-dashboard-smtp-pass')?.value || '',
  };
}

function fillSmtpFieldsInForm(smtp = {}) {
  const fromEl = document.getElementById('dev-dashboard-smtp-from');
  const hostEl = document.getElementById('dev-dashboard-smtp-host');
  const portEl = document.getElementById('dev-dashboard-smtp-port');
  const userEl = document.getElementById('dev-dashboard-smtp-user');
  const passEl = document.getElementById('dev-dashboard-smtp-pass');
  if (fromEl) fromEl.value = String(smtp.smtpFromEmail || '').trim();
  if (hostEl) hostEl.value = String(smtp.smtpHost || '').trim();
  if (portEl) portEl.value = String(smtp.smtpPort || '').trim();
  if (userEl) userEl.value = String(smtp.smtpUser || '').trim();
  // Passwort nur vorfüllen, wenn vorhanden – sonst Placeholder „behalten“
  if (passEl) passEl.value = '';
  if (passEl && smtp.smtpPass) {
    passEl.placeholder = 'Gespeichert – neu eingeben zum Ändern';
  } else if (passEl) {
    passEl.placeholder = 'Leer = bestehendes Passwort behalten';
  }
}

async function loadTenantSmtpSettings(db, tenantId) {
  if (!db || !tenantId) return {};
  try {
    const snap = await db.collection('tenants').doc(tenantId).collection('settings').doc('profile').get();
    if (!snap.exists) return {};
    const data = snap.data() || {};
    return {
      smtpFromEmail: String(data.smtpFromEmail || '').trim(),
      smtpHost: String(data.smtpHost || '').trim(),
      smtpPort: String(data.smtpPort || '').trim(),
      smtpUser: String(data.smtpUser || '').trim(),
      smtpPass: String(data.smtpPass || '').trim(),
    };
  } catch (err) {
    console.error('[Dev-Dashboard] SMTP-Settings laden fehlgeschlagen:', err);
    return {};
  }
}

function fillSettingsForm(dashboardStateRef = dashboardState) {
  const nameInput = document.getElementById('dev-dashboard-settings-name');
  const logoInput = document.getElementById('dev-dashboard-settings-logo');
  if (!nameInput || !logoInput) return;

  const draft = readTenantSettingsDraft(dashboardStateRef.selectedTenantId);
  const branding = window.BRANDING || {};
  nameInput.value = preferredBetriebName(dashboardStateRef);
  logoInput.value = draft.logoUrl
    || branding.logoUrl
    || branding.logo
    || '/icon-192.png';
  syncMhdCardUiToggleInputs(dashboardStateRef.selectedTenantId);
  fillBetriebModuleToggles(dashboardStateRef);
  void loadAndFillRoleModuleMatrix(dashboardStateRef);
  applySettingsPreview();

  const tenantId = dashboardStateRef.selectedTenantId;
  if (tenantId && dashboardStateRef.db) {
    void loadTenantSmtpSettings(dashboardStateRef.db, tenantId).then((smtp) => {
      if (dashboardStateRef.selectedTenantId !== tenantId) return;
      fillSmtpFieldsInForm(smtp);
    });
  } else {
    fillSmtpFieldsInForm({});
  }
}

/**
 * Speichert Firmenname, Logo und optionale SMTP-Daten unter settings/profile.
 * Module bleiben unberührt (Schalten nur über Plattform-Tabelle / setTenantModules).
 */
async function persistTenantBetrieb(db, tenantId, displayName, logoUrl, smtp = {}) {
  if (!db || !tenantId) return;
  const tenantRef = db.collection('tenants').doc(tenantId);
  const payload = { displayName };
  const stamp = typeof firebase !== 'undefined' && firebase.firestore?.FieldValue?.serverTimestamp
    ? firebase.firestore.FieldValue.serverTimestamp()
    : null;
  if (stamp) payload.updatedAt = stamp;
  if (typeof tenantRef.update === 'function') {
    await tenantRef.update(payload);
  }
  const settingsCollection = typeof tenantRef.collection === 'function'
    ? tenantRef.collection('settings')
    : null;
  if (settingsCollection && typeof settingsCollection.doc === 'function') {
    // Muss zu firebase.rules profileSettingsAllowedKeys / isProfileSettings passen.
    const profilePayload = {
      betriebsName: displayName,
      logoUrl,
      tenantId,
    };
    const smtpFromEmail = String(smtp.smtpFromEmail || '').trim();
    const smtpHost = String(smtp.smtpHost || '').trim();
    const smtpPort = String(smtp.smtpPort || '').trim();
    const smtpUser = String(smtp.smtpUser || '').trim();
    const smtpPass = String(smtp.smtpPass || '');
    // Leere SMTP-Felder weglassen (kein null) – bestehendes Passwort bleibt erhalten.
    if (smtpFromEmail) profilePayload.smtpFromEmail = smtpFromEmail;
    if (smtpHost) profilePayload.smtpHost = smtpHost;
    if (smtpPort) profilePayload.smtpPort = smtpPort;
    if (smtpUser) profilePayload.smtpUser = smtpUser;
    if (smtpPass) profilePayload.smtpPass = smtpPass;
    if (stamp) profilePayload.updatedAt = stamp;
    await settingsCollection.doc('profile').set(profilePayload, { merge: true });
  }
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

function setSmtpFormStatus(message = '', tone = 'info') {
  const statusEl = document.getElementById('dev-dashboard-smtp-status');
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
}

const BETRIEB_SECTIONS = new Set(['stammdaten', 'module', 'hygiene', 'geraete', 'smtp']);

/**
 * Unterseiten in „Mein Betrieb“: Stammdaten | Module & Rollen | Hygiene | Geräte | SMTP.
 */
function setBetriebSection(sectionKey = 'stammdaten', { updateHash = false } = {}) {
  const next = BETRIEB_SECTIONS.has(sectionKey) ? sectionKey : 'stammdaten';
  dashboardState.betriebSection = next;

  document.querySelectorAll('[data-betrieb-section]').forEach((btn) => {
    const active = btn.getAttribute('data-betrieb-section') === next;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  document.querySelectorAll('[data-betrieb-panel]').forEach((panel) => {
    const match = panel.getAttribute('data-betrieb-panel') === next;
    panel.hidden = !match;
  });

  if (updateHash) {
    const hash = next === 'geraete' ? 'haccp-setup' : `betrieb-${next}`;
    try {
      if (window.history?.replaceState) {
        const url = new URL(window.location.href);
        url.hash = hash;
        window.history.replaceState(null, '', `${url.pathname}${url.search}#${hash}`);
      } else {
        window.location.hash = hash;
      }
    } catch (_) { /* noop */ }
  }

  if (next === 'geraete' || next === 'hygiene') {
    try {
      syncDevDashboardHaccpAdmin({
        db: dashboardState.db,
        tenantId: dashboardState.selectedTenantId,
        recordAudit,
      });
    } catch (err) {
      console.warn('[Dev-Dashboard] HACCP-Admin Sync fehlgeschlagen:', err);
    }
  }
  if (next === 'stammdaten') {
    void refreshDiscountMatrixUi(dashboardState.selectedTenantId);
    renderSupplyCatalogAdminTable();
  }
}

function bindBetriebSubnav() {
  const nav = document.querySelector('.dev-dashboard-subnav');
  if (!nav || nav.dataset.bound === '1') return;
  nav.dataset.bound = '1';
  nav.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-betrieb-section]');
    if (!(btn instanceof HTMLButtonElement)) return;
    setBetriebSection(btn.getAttribute('data-betrieb-section') || 'stammdaten', { updateHash: true });
  });
}

function bindSmtpForm(dashboardStateRef = dashboardState) {
  const form = document.getElementById('dev-dashboard-smtp-form');
  if (!form || form.dataset.bound === '1') return;
  form.dataset.bound = '1';

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const tenantId = dashboardStateRef.selectedTenantId;
    if (!tenantId) {
      setSmtpFormStatus('Kein Betrieb ausgewählt.', 'error');
      return;
    }
    const displayName = document.getElementById('dev-dashboard-settings-name')?.value.trim()
      || preferredBetriebName(dashboardStateRef)
      || 'Betrieb';
    const logoUrl = document.getElementById('dev-dashboard-settings-logo')?.value.trim()
      || window.BRANDING?.logoUrl
      || '/icon-192.png';
    const smtp = readSmtpFieldsFromForm();
    setSmtpFormStatus('SMTP wird gespeichert…', 'info');
    void persistTenantBetrieb(dashboardStateRef.db, tenantId, displayName, logoUrl, smtp)
      .then(() => {
        setSmtpFormStatus('SMTP gespeichert.', 'success');
        fillSmtpFieldsInForm({
          ...smtp,
          smtpPass: smtp.smtpPass || '***',
        });
        recordAudit('settings', 'SMTP-Einstellungen gespeichert', 'change');
        window.showToast?.('SMTP gespeichert.', 'success');
      })
      .catch((err) => {
        console.error('[Dev-Dashboard] SMTP speichern fehlgeschlagen:', err);
        setSmtpFormStatus('SMTP konnte nicht gespeichert werden.', 'error');
        window.showToast?.('SMTP konnte nicht gespeichert werden.', 'error');
      });
  });
}

function persistMhdCardUiSetting(tenantId, key, enabled, { notify = true } = {}) {
  if (!tenantId || !MHD_CARD_UI_SETTING_KEYS.includes(key)) return;
  const current = readMhdCardUiSettings(tenantId);
  const next = { ...current, [key]: enabled === true };
  writeMhdCardUiSettings(tenantId, next);
  syncMhdCardUiToggleInputs(tenantId);
  if (typeof window.refreshMhdMonitorCards === 'function') {
    window.refreshMhdMonitorCards();
  }
  if (notify) {
    const label = MHD_CARD_UI_SETTING_LABELS[key] || key;
    recordAudit(
      'settings',
      `MHD-Karten: ${label} ${enabled ? 'eingeblendet' : 'ausgeblendet'}`,
      'change',
    );
    window.showToast?.(
      `${label} ${enabled ? 'eingeblendet' : 'ausgeblendet'}.`,
      'success',
    );
  }
}

function bindSettingsForm(dashboardStateRef = dashboardState) {
  const form = document.getElementById('dev-dashboard-settings-form');
  if (!form || form.dataset.bound === '1') return;
  form.dataset.bound = '1';

  form.addEventListener('input', (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.getAttribute('data-mhd-ui-key')) {
      return;
    }
    applySettingsPreview();
  });

  form.addEventListener('change', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'checkbox') return;
    const key = input.getAttribute('data-mhd-ui-key');
    if (!key) return;
    const tenantId = dashboardStateRef.selectedTenantId;
    if (!tenantId) {
      input.checked = false;
      setSettingsFormStatus('Kein Betrieb ausgewählt.', 'error');
      return;
    }
    persistMhdCardUiSetting(tenantId, key, input.checked);
  });

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

    const mhdUi = readMhdCardUiSettings(tenantId);
    const kitchenInput = document.getElementById('dev-dashboard-mhd-show-kitchen');
    const boxInput = document.getElementById('dev-dashboard-mhd-show-box');
    if (kitchenInput instanceof HTMLInputElement) {
      mhdUi.mhd_show_kitchen = kitchenInput.checked;
    }
    if (boxInput instanceof HTMLInputElement) {
      mhdUi.mhd_show_box = boxInput.checked;
    }

    const smtp = readSmtpFieldsFromForm();
    const draft = {
      displayName,
      logoUrl,
      mhd_show_kitchen: mhdUi.mhd_show_kitchen,
      mhd_show_box: mhdUi.mhd_show_box,
    };
    writeTenantSettingsDraft(tenantId, draft);
    dashboardStateRef.tenantDisplayName = displayName;
    applyBrandingFromSettingsDraft(tenantId, draft);
    syncMhdCardUiToggleInputs(tenantId);
    applySettingsPreview();
    renderOverviewCards(dashboardStateRef);
    if (typeof window.refreshMhdMonitorCards === 'function') {
      window.refreshMhdMonitorCards();
    }
    recordAudit('settings', `Betriebseinstellungen gespeichert (${displayName})`, 'change');
    setSettingsFormStatus('Einstellungen gespeichert.', 'success');
    window.showToast?.('Betriebseinstellungen gespeichert.', 'success');
    void persistTenantBetrieb(dashboardStateRef.db, tenantId, displayName, logoUrl, smtp)
      .then(() => {
        setSettingsFormStatus('Betrieb gespeichert.', 'success');
        fillSmtpFieldsInForm({
          ...smtp,
          smtpPass: smtp.smtpPass || '***',
        });
      })
      .catch((err) => {
        console.error('[Dev-Dashboard] Betrieb speichern fehlgeschlagen:', err);
        setSettingsFormStatus('Lokal gespeichert. Übernahme in den Betrieb fehlgeschlagen.', 'error');
        window.showToast?.('Der Betrieb konnte nicht vollständig gespeichert werden.', 'error');
      });
  });
}

function bindMhdCardUiModuleToggles(dashboardStateRef = dashboardState) {
  const root = document.getElementById('dev-dashboard-mhd-card-toggles-modules');
  if (!root || root.dataset.bound === '1') return;
  root.dataset.bound = '1';
  root.addEventListener('change', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'checkbox') return;
    const key = input.getAttribute('data-mhd-ui-key');
    if (!key) return;
    const tenantId = dashboardStateRef.selectedTenantId;
    if (!tenantId) {
      input.checked = false;
      window.showToast?.('Kein Betrieb ausgewählt.', 'error');
      return;
    }
    persistMhdCardUiSetting(tenantId, key, input.checked);
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

async function signOutFromDashboard() {
  await signOutAndShowLogin();
}

function bindDashboardStatusSignOut() {
  const statusEl = document.getElementById('dev-dashboard-status');
  if (!statusEl || statusEl.dataset.secretSignOut === '1') return;
  statusEl.dataset.secretSignOut = '1';
  statusEl.title = 'Angemeldet';
  statusEl.addEventListener('click', () => {
    const email = String(
      dashboardState.actorEmail
      || (typeof firebase !== 'undefined' && firebase.auth?.().currentUser?.email)
      || '',
    ).trim();
    const question = email ? `Abmelden von ${email}?` : 'Möchtest du dich wirklich abmelden?';
    if (!window.confirm(question)) return;
    void signOutAndShowLogin();
  });
}

installSecretLogoutGestures();
bindDashboardStatusSignOut();

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

const EMPTY_TENANTS_MESSAGE = 'Keine weiteren Betriebe geladen. Der aktuelle Betrieb bleibt ausgewählt.';
const PERMISSION_DENIED_MESSAGE = 'Kein Zugriff auf diesen Betrieb. Bitte Admin kontaktieren.';

function isPermissionDeniedError(err) {
  const code = String(err?.code || '').toLowerCase();
  return code === 'permission-denied' || code.includes('permission');
}

function hideMainAppChrome() {
  // Layout-Flag am body — NICHT dieselbe Klasse wie Tab-Panels (.dev-dashboard-view).
  document.documentElement?.classList.add('is-dev-dashboard-html');
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
  const displayName = tenantLabelFromData(data, tenantId);
  const isActive = data.status !== 'inactive';
  const statusValue = isActive ? 'active' : 'inactive';
  const toggles = TENANT_MODULE_KEYS.map((key) => {
    let checked = enabled[key] === true;
    // Legacy: enabledModules.traceability → chargenDoku
    if (key === 'chargenDoku' && !('chargenDoku' in enabled) && enabled.traceability === true) {
      checked = true;
    }
    const label = MODULE_LABELS[key] || key;
    return `
      <label class="dev-dashboard-toggle" title="${escapeHtml(label)}">
        <input
          type="checkbox"
          data-tenant-id="${tenantId}"
          data-module-key="${key}"
          ${checked ? 'checked' : ''}
        >
        <span>${escapeHtml(label)}</span>
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
  syncMhdCardUiToggleInputs(tenantId);
}

let setTenantModulesCallable = null;
let listPlatformTenantsCallable = null;

function getListPlatformTenantsCallable() {
  if (listPlatformTenantsCallable) return listPlatformTenantsCallable;
  const firebaseApi = typeof firebase !== 'undefined' ? firebase : null;
  if (!firebaseApi?.apps?.length) return null;
  listPlatformTenantsCallable = createHttpsCallable('listPlatformTenants', undefined, firebaseApi, FUNCTIONS_REGION);
  return listPlatformTenantsCallable;
}

function getSetTenantModulesCallable() {
  if (setTenantModulesCallable) return setTenantModulesCallable;
  const firebaseApi = typeof firebase !== 'undefined' ? firebase : null;
  if (!firebaseApi?.apps?.length) return null;
  setTenantModulesCallable = createHttpsCallable('setTenantModules', undefined, firebaseApi, FUNCTIONS_REGION);
  return setTenantModulesCallable;
}

async function toggleTenantModule(db, tenantId, moduleKey, enabled) {
  const callable = getSetTenantModulesCallable();
  if (!callable) {
    throw new Error('Cloud Function setTenantModules ist nicht erreichbar.');
  }
  const mappedKey = MODULE_KEY_TO_BACKEND[moduleKey] || moduleKey;
  if (!VALID_BACKEND_MODULE_SET.has(mappedKey)) {
    throw new Error(`Modul „${moduleKey}“ ist für setTenantModules nicht freigegeben.`);
  }
  // Nur den einen Schalter patchen — kein Full-Replace von enabledModules.
  const modulePatch = { [mappedKey]: enabled === true };
  const sanitized = sanitizeEnabledModulesPayload(modulePatch);
  if (!Object.keys(sanitized.enabledModules).length) {
    throw new Error(`Modul „${moduleKey}“ wurde beim Sanitizing verworfen.`);
  }
  const fieldPatch = buildEnabledModulesFieldPatch(sanitized.enabledModules);
  await callable({
    targetTenantId: tenantId,
    enabledModules: sanitized.enabledModules,
    modules: sanitized.modules,
    ...fieldPatch,
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
      window.showToast?.('Module für Mandant erfolgreich aktualisiert.', 'success');
    } catch (error) {
      input.checked = previous;
      console.error('[Dev-Dashboard] Modul Toggle fehlgeschlagen:', error);
      const detail = formatCallableErrorMessage(error);
      if (statusEl) statusEl.textContent = `Fehler: ${detail}`;
      // Volle Fehlermeldung — nicht kürzen (Debug von 400/invalid-argument).
      window.showToast?.(`Speichern fehlgeschlagen: ${detail}`, 'error');
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
  const raw = {};
  TENANT_MODULE_KEYS.forEach((key) => {
    const input = document.getElementById(`dev-dashboard-tenant-mod-${key}`);
    raw[key] = input instanceof HTMLInputElement ? input.checked : false;
  });
  return sanitizeEnabledModulesPayload(raw).enabledModules;
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
        modules: { ...enabledModules },
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
const GENERIC_PROFILE_FALLBACK_NAMES = ['Mitarbeiter 1', 'Mitarbeiter 2'];

function getCreateEmployeeCallable() {
  if (createEmployeeCallable) return createEmployeeCallable;
  const firebaseApi = typeof firebase !== 'undefined' ? firebase : null;
  if (!firebaseApi?.apps?.length) return null;
  createEmployeeCallable = createHttpsCallable('createTenantEmployee', undefined, firebaseApi, FUNCTIONS_REGION);
  return createEmployeeCallable;
}

function getManageEmployeesCallable() {
  if (manageEmployeesCallable) return manageEmployeesCallable;
  const firebaseApi = typeof firebase !== 'undefined' ? firebase : null;
  if (!firebaseApi?.apps?.length) return null;
  // getFunctions(getApp(), 'europe-west3') — Compat: app.functions('europe-west3')
  const functions = getRegionalFunctions(firebaseApi, 'europe-west3');
  manageEmployeesCallable = functions.httpsCallable('manageTenantEmployees');
  console.info('[Dev-Dashboard] Callable manageTenantEmployees', { region: 'europe-west3' });
  return manageEmployeesCallable;
}

function isProfileEmployeeUid(uid) {
  return String(uid || '').startsWith('profile:');
}

function namesToProfileEmployees(names, tenantId) {
  return (Array.isArray(names) ? names : [])
    .map((name) => String(name || '').trim())
    .filter(Boolean)
    .map((displayName) => ({
      uid: `profile:${tenantId}:${displayName.toLowerCase()}`,
      email: '',
      displayName,
      role: 'employee',
      tenantId,
      status: 'active',
      disabled: false,
      source: 'profile',
    }));
}

async function loadEmployeeProfileFallback(tenantId, db) {
  const collected = [];
  if (db && tenantId) {
    try {
      const nestedSnap = await db.collection('tenants').doc(tenantId).collection('employees').get();
      nestedSnap.docs.forEach((doc) => {
        const data = doc.data() || {};
        collected.push({
          uid: doc.id,
          email: String(data.email || '').trim(),
          displayName: String(data.displayName || data.name || '').trim(),
          role: String(data.role || 'employee').trim() || 'employee',
          tenantId,
          status: data.disabled === true ? 'inactive' : 'active',
          disabled: data.disabled === true,
          source: 'employees',
        });
      });
    } catch (err) {
      console.warn('[Dev-Dashboard] Fallback tenants/.../employees:', err);
    }
    try {
      const settingsSnap = await db.collection('tenants').doc(tenantId).collection('settings').doc('teamDashboard').get();
      const names = settingsSnap.exists ? settingsSnap.data()?.employees : null;
      if (Array.isArray(names) && names.length) {
        collected.push(...namesToProfileEmployees(names, tenantId));
      }
    } catch (err) {
      console.warn('[Dev-Dashboard] Fallback Team-Profil-Store:', err);
    }
  }
  if (!collected.length && tenantId) {
    collected.push(...namesToProfileEmployees(GENERIC_PROFILE_FALLBACK_NAMES, tenantId));
  }
  const byName = new Map();
  collected.forEach((entry) => {
    const key = String(entry.uid || '').startsWith('profile:')
      ? `name:${String(entry.displayName || '').toLowerCase()}`
      : `uid:${entry.uid}`;
    if (!byName.has(key)) byName.set(key, entry);
  });
  return [...byName.values()];
}

function setEmployeeFormStatus(message = '', tone = 'info') {
  const statusEl = document.getElementById('dev-dashboard-employee-status');
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
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
      // Neue Nutzer starten mit Rolle employee und Default-allowedModules (alles an).
      const result = await callable({
        name,
        email,
        password,
        tenantId,
      });
      const createdEmail = result?.data?.email || email;
      setEmployeeFormStatus(`Nutzer ${createdEmail} angelegt.`, 'success');
      window.showToast?.(`Nutzer ${name} wurde angelegt.`, 'success');
      recordAudit('user_create', `Nutzer angelegt: ${name} (${createdEmail})`, 'security');
      form.reset();
      const createPanel = document.getElementById('dev-dashboard-employee-create');
      if (createPanel) createPanel.hidden = true;
      await refreshEmployeeTable(dashboardState);
    } catch (err) {
      console.error('[Dev-Dashboard] Mitarbeiter-Anlage fehlgeschlagen:', err);
      const detailsReason = String(err?.details?.reason || err?.customData?.reason || '').trim();
      const rawMessage = String(err?.message || 'Anlage fehlgeschlagen.');
      const message = detailsReason && !rawMessage.includes(detailsReason)
        ? `${rawMessage} (${detailsReason})`
        : rawMessage;
      setEmployeeFormStatus(message, 'error');
      window.showToast?.('Mitarbeiter konnte nicht angelegt werden.', 'error');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

function employeeRowRoleLabel(role) {
  if (role === 'admin') return 'Admin';
  if (role === 'helper') return 'Aushilfe';
  return 'Mitarbeiter';
}

/**
 * Dedupliziert Nutzer für die Tabelle: Auth-UID vor Profil-Stub,
 * sonst E-Mail / Anzeigename. Verhindert Doppelzeilen wie 2× „Paddy“.
 * @param {Array<object>} employees
 * @returns {Array<object>}
 */
function dedupeEmployeesForDisplay(employees) {
  const list = Array.isArray(employees) ? employees : [];
  const byKey = new Map();
  const preferScore = (entry) => {
    const uid = String(entry?.uid || '');
    if (uid && !isProfileEmployeeUid(uid) && entry?.source !== 'profile') return 3;
    if (String(entry?.email || '').trim()) return 2;
    return 1;
  };
  list.forEach((entry) => {
    if (!entry) return;
    const uid = String(entry.uid || '').trim();
    const email = String(entry.email || '').trim().toLowerCase();
    const name = String(entry.displayName || '').trim().toLowerCase();
    let key = '';
    if (uid && !isProfileEmployeeUid(uid)) key = `uid:${uid}`;
    else if (email) key = `email:${email}`;
    else if (name) key = `name:${name}`;
    else if (uid) key = `uid:${uid}`;
    else return;
    const existing = byKey.get(key);
    if (!existing || preferScore(entry) > preferScore(existing)) {
      byKey.set(key, entry);
      return;
    }
    // Zweiter Treffer unter gleichem Namen/E-Mail: Auth-Konto gewinnt.
    if (preferScore(entry) === preferScore(existing) && email && !String(existing.email || '').trim()) {
      byKey.set(key, entry);
    }
  });
  // Zweiter Pass: Profil-Stubs entfernen, wenn gleicher Name schon als Auth-User da ist.
  const authNames = new Set();
  const authEmails = new Set();
  byKey.forEach((entry) => {
    if (isProfileEmployeeUid(entry.uid) || entry.source === 'profile') return;
    const name = String(entry.displayName || '').trim().toLowerCase();
    const email = String(entry.email || '').trim().toLowerCase();
    if (name) authNames.add(name);
    if (email) authEmails.add(email);
  });
  [...byKey.entries()].forEach(([key, entry]) => {
    if (!(isProfileEmployeeUid(entry.uid) || entry.source === 'profile')) return;
    const name = String(entry.displayName || '').trim().toLowerCase();
    const email = String(entry.email || '').trim().toLowerCase();
    if ((name && authNames.has(name)) || (email && authEmails.has(email))) {
      byKey.delete(key);
    }
  });
  return [...byKey.values()];
}

function renderEmployeeRow(employee, currentUserUid) {
  const role = String(employee.role || 'employee');
  const roleLabel = employeeRowRoleLabel(role);
  const isSelf = employee.uid === currentUserUid;
  const isDisabled = employee.disabled === true || employee.status === 'inactive';
  const isProfile = isProfileEmployeeUid(employee.uid) || employee.source === 'profile';
  // Admin ↔ Mitarbeiter ↔ Aushilfe rotieren
  const nextRole = role === 'admin' ? 'employee' : (role === 'employee' ? 'helper' : 'admin');
  const safeUid = escapeHtml(employee.uid);
  const safeTenantId = escapeHtml(employee.tenantId);
  const safeDisplayName = escapeHtml(employee.displayName || '—');
  const safeEmail = escapeHtml(employee.email || '');
  const safeDisplayAttr = escapeHtml(employee.displayName || employee.email || '');
  const disableAction = isDisabled ? 'enable' : 'disable';
  const disableLabel = isDisabled ? 'Aktivieren' : 'Deaktivieren';

  return `
    <tr data-employee-row="${safeUid}" ${isDisabled ? 'data-employee-inactive="1"' : ''}>
      <td class="dev-dashboard-employee-name" data-label="Person">
        <strong>${safeDisplayName}</strong>
        <span class="dev-dashboard-tenant-sub">${safeEmail || '—'}</span>
      </td>
      <td data-label="Rolle">
        <span class="dev-dashboard-role-badge dev-dashboard-role-badge--${escapeHtml(role)}">${escapeHtml(roleLabel)}</span>
        ${isDisabled ? '<span class="dev-dashboard-role-badge dev-dashboard-role-badge--inactive">Deaktiviert</span>' : ''}
      </td>
      <td class="dev-dashboard-employee-modules" data-label="Module">
        ${renderEmployeeModuleToggles(employee)}
      </td>
      <td class="dev-dashboard-employee-departments" data-label="Bereiche">
        ${renderEmployeeDepartmentToggles(employee)}
      </td>
      <td class="dev-dashboard-employee-actions" data-label="Aktionen">
        <div class="dev-dashboard-employee-actions-bar">
          <button
            type="button"
            class="dev-dashboard-employee-more-btn"
            data-action="toggle-employee-menu"
            aria-expanded="false"
            aria-haspopup="menu"
            aria-label="Aktionen für ${safeDisplayAttr}"
          >⋯</button>
          <div class="dev-dashboard-employee-more-menu" hidden role="menu">
            <button
              type="button"
              class="dev-dashboard-action-btn"
              role="menuitem"
              data-action="toggle-role"
              data-uid="${safeUid}"
              data-tenant-id="${safeTenantId}"
              data-next-role="${escapeHtml(nextRole)}"
              data-display-name="${safeDisplayAttr}"
              ${isSelf || isDisabled || isProfile ? 'disabled title="Rolle kann jetzt nicht geändert werden"' : ''}
            >Rolle ändern</button>
            <button
              type="button"
              class="dev-dashboard-action-btn"
              role="menuitem"
              data-action="reset-password"
              data-uid="${safeUid}"
              data-tenant-id="${safeTenantId}"
              data-display-name="${safeDisplayAttr}"
              ${isDisabled || isProfile ? 'disabled title="Konto ist deaktiviert"' : ''}
            >Passwort zurücksetzen</button>
            <button
              type="button"
              class="dev-dashboard-action-btn ${isDisabled ? '' : 'dev-dashboard-action-btn--danger'}"
              role="menuitem"
              data-action="${disableAction}"
              data-uid="${safeUid}"
              data-tenant-id="${safeTenantId}"
              data-display-name="${safeDisplayAttr}"
              ${isSelf || isProfile ? 'disabled' : ''}
              title="${isProfile
                ? 'Team-Profil — Konto in der Anmeldung anlegen, um zu sperren'
                : (isSelf ? 'Eigenes Konto bleibt aktiv' : 'Konto vorübergehend sperren')}"
            >${escapeHtml(disableLabel)}</button>
          </div>
        </div>
      </td>
    </tr>
  `;
}

function renderEmployeeTableLoading() {
  const tbody = document.getElementById('dev-dashboard-employee-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  tbody.innerHTML = `
    <tr>
      <td colspan="5" class="dev-dashboard-empty-msg dev-dashboard-empty-msg--loading">
        <span class="dev-dashboard-table-spinner" aria-hidden="true"></span>
        Nutzer werden geladen…
      </td>
    </tr>
  `;
}

function renderEmployeeTable(employees, currentUserUid) {
  const tbody = document.getElementById('dev-dashboard-employee-body');
  if (!tbody) return;
  // Immer zuerst leeren — verhindert Doppelzeilen bei erneutem Render.
  tbody.innerHTML = '';
  const deduped = dedupeEmployeesForDisplay(employees);
  const filtered = filterTenantUsers(deduped, {
    query: dashboardState.userQuery,
    role: dashboardState.userRoleFilter,
  });
  if (!deduped.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="dev-dashboard-empty-msg dev-dashboard-empty-msg--info">Noch keine Nutzer für diesen Betrieb.</td></tr>';
    return;
  }
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="dev-dashboard-empty-msg dev-dashboard-empty-msg--info">Keine Nutzer für diese Suche/Filter.</td></tr>';
    return;
  }
  tbody.innerHTML = filtered.map((emp) => renderEmployeeRow(emp, currentUserUid)).join('');
}

function renderEmployeeTableError(message) {
  const tbody = document.getElementById('dev-dashboard-employee-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  tbody.innerHTML = `<tr><td colspan="5" class="dev-dashboard-empty-msg dev-dashboard-empty-msg--error">${escapeHtml(message)}</td></tr>`;
}

async function refreshEmployeeTable(dashboardStateRef) {
  const statusEl = document.getElementById('dev-dashboard-employee-list-status');
  const tenantId = dashboardStateRef.selectedTenantId;
  if (!tenantId) {
    renderEmployeeTable([], dashboardStateRef.currentUserUid);
    renderOverviewCards(dashboardStateRef);
    if (statusEl) statusEl.textContent = 'Kein Betrieb ausgewählt.';
    return;
  }

  const callable = getManageEmployeesCallable();
  if (!callable) {
    console.error('[Dev-Dashboard] manageTenantEmployees Callable fehlt', {
      region: FUNCTIONS_REGION,
      tenantId,
    });
    const fallback = dedupeEmployeesForDisplay(
      await loadEmployeeProfileFallback(tenantId, dashboardStateRef.db),
    );
    dashboardStateRef.employees = fallback;
    renderEmployeeTable(fallback, dashboardStateRef.currentUserUid);
    renderOverviewCards(dashboardStateRef);
    if (statusEl) {
      statusEl.textContent = fallback.length
        ? `Team-Profile (${fallback.length}) — Kontenliste nicht erreichbar`
        : 'Nutzerliste ist gerade nicht erreichbar.';
    }
    if (!fallback.length) {
      renderEmployeeTableError('Die Nutzerliste ist gerade nicht erreichbar. Bitte die Seite neu laden.');
    }
    return;
  }

  if (statusEl) statusEl.textContent = 'Lade Nutzer…';
  renderEmployeeTableLoading();
  try {
    await waitForAppCheckReady();
    const result = await callable({ action: 'list', tenantId });
    let employees = Array.isArray(result?.data?.employees) ? result.data.employees : [];
    if (!employees.length) {
      console.warn('[Dev-Dashboard] Callable list leer — Profil-Fallback', { tenantId, region: FUNCTIONS_REGION });
      employees = await loadEmployeeProfileFallback(tenantId, dashboardStateRef.db);
    }
    const deduped = dedupeEmployeesForDisplay(employees);
    dashboardStateRef.employees = deduped;
    renderEmployeeTable(deduped, dashboardStateRef.currentUserUid);
    renderOverviewCards(dashboardStateRef);
    if (statusEl) statusEl.textContent = `${deduped.length} Nutzer`;
  } catch (err) {
    console.error('[Dev-Dashboard] Mitarbeiter-Liste fehlgeschlagen', {
      code: err?.code || '',
      message: err?.message || String(err),
      details: err?.details || null,
      region: FUNCTIONS_REGION,
      tenantId,
      error: err,
    });
    const message = logAndMapOperatorError(err, 'admin-users');
    let fallback = [];
    try {
      fallback = await loadEmployeeProfileFallback(tenantId, dashboardStateRef.db);
    } catch (fallbackErr) {
      console.error('[Dev-Dashboard] Profil-Fallback fehlgeschlagen', fallbackErr);
    }
    const dedupedFallback = dedupeEmployeesForDisplay(fallback);
    dashboardStateRef.employees = dedupedFallback;
    if (dedupedFallback.length) {
      renderEmployeeTable(dedupedFallback, dashboardStateRef.currentUserUid);
      if (statusEl) statusEl.textContent = `${dedupedFallback.length} Team-Profile — ${message}`;
    } else {
      renderEmployeeTableError(message);
      if (statusEl) statusEl.textContent = message;
    }
    renderOverviewCards(dashboardStateRef);
    window.showToast?.(message, 'error');
  }
}

function bindEmployeeTableActions(dashboardState) {
  const section = document.getElementById('dev-dashboard-employee-list');
  if (!section || section.dataset.bound === '1') return;
  section.dataset.bound = '1';

  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('.dev-dashboard-employee-actions-bar')) return;
    section.querySelectorAll('.dev-dashboard-employee-more-menu').forEach((menu) => {
      menu.hidden = true;
      const trigger = menu.closest('.dev-dashboard-employee-actions-bar')
        ?.querySelector('[data-action="toggle-employee-menu"]');
      trigger?.setAttribute('aria-expanded', 'false');
    });
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    section.querySelectorAll('.dev-dashboard-employee-more-menu').forEach((menu) => {
      menu.hidden = true;
      const trigger = menu.closest('.dev-dashboard-employee-actions-bar')
        ?.querySelector('[data-action="toggle-employee-menu"]');
      trigger?.setAttribute('aria-expanded', 'false');
    });
  });

  section.addEventListener('change', async (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const action = String(input.getAttribute('data-action') || '').trim();

    if (action === 'toggle-user-department' || action === 'toggle-user-can-order') {
      const displayName = String(input.getAttribute('data-display-name') || '').trim();
      const uid = String(input.getAttribute('data-uid') || '').trim();
      if (!displayName) {
        input.checked = !input.checked;
        window.showToast?.('Name fehlt — Zuständigkeit kann nicht gespeichert werden.', 'warning');
        return;
      }
      const employee = (dashboardState.employees || []).find((entry) => entry.uid === uid);
      const current = getEmployeeDepartmentAssignment(displayName);
      const row = input.closest('[data-employee-departments]');
      const nextDepartments = DEPARTMENT_KEYS.filter((key) => {
        const box = row?.querySelector(`[data-department-key="${key}"]`);
        return box instanceof HTMLInputElement ? box.checked : current.departments.includes(key);
      });
      const canOrderBox = row?.querySelector('[data-action="toggle-user-can-order"]');
      const nextCanOrder = canOrderBox instanceof HTMLInputElement
        ? canOrderBox.checked
        : current.canOrder;
      input.disabled = true;
      try {
        const saved = await saveEmployeeDepartmentAssignment(displayName, {
          departments: nextDepartments,
          canOrder: nextCanOrder,
        });
        if (employee) {
          employee.departments = saved.departments;
          employee.canOrder = saved.canOrder;
        }
        window.showToast?.(
          action === 'toggle-user-can-order'
            ? (nextCanOrder ? 'Bestellrecht gesetzt.' : 'Bestellrecht entfernt.')
            : 'Fachbereich gespeichert.',
          'success',
        );
        recordAudit(
          'user_departments',
          `Zuständigkeit ${displayName}: ${saved.departments.join(', ') || 'keine'}${saved.canOrder ? ' · Bestellung' : ''}`,
          'change',
        );
      } catch (err) {
        console.error('[Dev-Dashboard] Fachbereich speichern fehlgeschlagen:', err);
        input.checked = !input.checked;
        window.showToast?.(logAndMapOperatorError(err, 'admin-user-action'), 'error');
      } finally {
        input.disabled = false;
      }
      return;
    }

    if (action !== 'toggle-user-module') return;

    const uid = String(input.getAttribute('data-uid') || '').trim();
    const tenantId = String(input.getAttribute('data-tenant-id') || '').trim();
    const moduleKey = String(input.getAttribute('data-module-key') || '').trim();
    if (!uid || !tenantId || !moduleKey) return;
    if (isProfileEmployeeUid(uid)) {
      input.checked = !input.checked;
      window.showToast?.('Team-Profil — bitte zuerst ein Anmeldekonto anlegen.', 'error');
      return;
    }

    const callable = getManageEmployeesCallable();
    if (!callable) {
      input.checked = !input.checked;
      window.showToast?.('Nutzerverwaltung ist gerade nicht erreichbar.', 'error');
      return;
    }

    const employee = (dashboardState.employees || []).find((entry) => entry.uid === uid);
    const nextAllowed = normalizeAccessModuleMap(employee?.allowedModules, { defaultAllow: true });
    nextAllowed[moduleKey] = input.checked === true;
    input.disabled = true;
    try {
      await waitForAppCheckReady();
      await callable({ action: 'update', uid, tenantId, allowedModules: nextAllowed });
      if (employee) employee.allowedModules = nextAllowed;
      const label = MODULE_LABELS[moduleKey] || moduleKey;
      window.showToast?.(
        input.checked ? `${label} freigegeben.` : `${label} für diese Person aus.`,
        'success',
      );
      recordAudit(
        'user_modules',
        `Nutzer-Modul ${label} ${input.checked ? 'an' : 'aus'}`,
        'change',
      );
    } catch (err) {
      console.error('[Dev-Dashboard] Nutzer-Modul speichern fehlgeschlagen:', err);
      input.checked = !input.checked;
      window.showToast?.(logAndMapOperatorError(err, 'admin-user-action'), 'error');
    } finally {
      input.disabled = false;
    }
  });

  const closeAllEmployeeMenus = (exceptMenu = null) => {
    section.querySelectorAll('.dev-dashboard-employee-more-menu').forEach((menu) => {
      if (exceptMenu && menu === exceptMenu) return;
      menu.hidden = true;
      const trigger = menu.closest('.dev-dashboard-employee-actions-bar')
        ?.querySelector('[data-action="toggle-employee-menu"]');
      trigger?.setAttribute('aria-expanded', 'false');
    });
  };

  section.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-action]');
    if (!(btn instanceof HTMLButtonElement) || btn.disabled) return;

    const action = btn.getAttribute('data-action');
    if (
      action === 'toggle-user-module'
      || action === 'toggle-user-department'
      || action === 'toggle-user-can-order'
    ) return;

    if (action === 'toggle-employee-menu') {
      event.preventDefault();
      event.stopPropagation();
      const bar = btn.closest('.dev-dashboard-employee-actions-bar');
      const menu = bar?.querySelector('.dev-dashboard-employee-more-menu');
      if (!menu) return;
      const willOpen = menu.hidden;
      closeAllEmployeeMenus(willOpen ? menu : null);
      menu.hidden = !willOpen;
      btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      return;
    }

    const uid = String(btn.getAttribute('data-uid') || '').trim();
    const tenantId = String(btn.getAttribute('data-tenant-id') || '').trim();
    if (!uid || !tenantId) {
      console.error('[Dev-Dashboard] Nutzer-Aktion ohne uid/tenantId', { action, uid, tenantId });
      window.showToast?.('Aktion nicht möglich: Nutzer oder Betrieb fehlt.', 'error');
      return;
    }
    closeAllEmployeeMenus();
    if (isProfileEmployeeUid(uid)) {
      window.showToast?.('Team-Profil — bitte zuerst ein Anmeldekonto anlegen.', 'error');
      return;
    }

    const callable = getManageEmployeesCallable();
    if (!callable) {
      window.showToast?.('Nutzerverwaltung ist gerade nicht erreichbar.', 'error');
      return;
    }

    if (action === 'toggle-role') {
      const nextRole = String(btn.getAttribute('data-next-role') || '').trim();
      if (!nextRole) return;
      const nextLabel = employeeRowRoleLabel(nextRole);
      btn.disabled = true;
      try {
        await waitForAppCheckReady();
        await callable({ action: 'update', uid, tenantId, role: nextRole });
        window.showToast?.('Rolle aktualisiert.', 'success');
        recordAudit(
          'role_change',
          `Rolle geändert zu ${nextLabel}`,
          'security',
        );
        await refreshEmployeeTable(dashboardState);
      } catch (err) {
        console.error('[Dev-Dashboard] Rolle ändern fehlgeschlagen:', err);
        window.showToast?.(logAndMapOperatorError(err, 'admin-user-action'), 'error');
        btn.disabled = false;
      }
      return;
    }

    if (action === 'reset-password') {
      const displayName = btn.getAttribute('data-display-name') || 'Nutzer';
      if (!window.confirm(`Neues Startpasswort für ${displayName} vergeben?`)) return;
      btn.disabled = true;
      try {
        await waitForAppCheckReady();
        const result = await callable({ action: 'resetPassword', uid, tenantId });
        const temporaryPassword = String(result?.data?.temporaryPassword || '').trim();
        window.showToast?.(
          temporaryPassword
            ? `Neues Startpasswort für ${displayName}: ${temporaryPassword}`
            : `Passwort für ${displayName} wurde zurückgesetzt.`,
          'success',
        );
        if (temporaryPassword) {
          window.alert(`Neues Startpasswort für ${displayName}:\n\n${temporaryPassword}\n\nBitte weitergeben.`);
        }
        recordAudit('password_reset', `Passwort zurückgesetzt: ${displayName}`, 'security');
      } catch (err) {
        console.error('[Dev-Dashboard] Passwort zurücksetzen fehlgeschlagen:', err);
        window.showToast?.(logAndMapOperatorError(err, 'admin-user-action'), 'error');
      } finally {
        btn.disabled = false;
      }
      return;
    }

    if (action === 'disable' || action === 'enable') {
      const displayName = btn.getAttribute('data-display-name') || 'Nutzer';
      const disabling = action === 'disable';
      const confirmText = disabling
        ? `${displayName} deaktivieren? Die Anmeldung ist danach gesperrt.`
        : `${displayName} wieder aktivieren?`;
      if (!window.confirm(confirmText)) return;
      btn.disabled = true;
      try {
        await waitForAppCheckReady();
        await callable({ action, uid, tenantId });
        window.showToast?.(
          disabling ? `${displayName} ist deaktiviert.` : `${displayName} ist wieder aktiv.`,
          'success',
        );
        recordAudit(
          disabling ? 'user_disable' : 'user_enable',
          disabling ? `Nutzer deaktiviert: ${displayName}` : `Nutzer aktiviert: ${displayName}`,
          'security',
        );
        await refreshEmployeeTable(dashboardState);
      } catch (err) {
        console.error('[Dev-Dashboard] Konto-Status fehlgeschlagen:', err);
        window.showToast?.(logAndMapOperatorError(err, 'admin-user-action'), 'error');
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
        window.showToast?.(logAndMapOperatorError(err, 'admin-user-action'), 'error');
        btn.disabled = false;
      }
    }
  });
}

function bindTenantSelector(dashboardStateRef, tenants) {
  const select = document.getElementById('dev-dashboard-tenant-select');
  const wrap = document.getElementById('dev-dashboard-tenant-select-wrap');
  if (!select) return;

  const merged = [];
  const seen = new Set();
  const activeId = String(dashboardStateRef.selectedTenantId || '').trim();
  const pushTenant = (item) => {
    const id = String(item?.id || '').trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    merged.push({
      id,
      data: item?.data && typeof item.data === 'object' ? item.data : {},
    });
  };

  (Array.isArray(tenants) ? tenants : []).forEach(pushTenant);
  if (activeId && !seen.has(activeId)) {
    pushTenant({
      id: activeId,
      data: {
        displayName: dashboardStateRef.tenantDisplayName
          || (typeof window !== 'undefined' ? window.BRANDING?.betriebsName : '')
          || activeId,
        status: dashboardStateRef.tenantStatus,
        enabledModules: dashboardStateRef.tenantModules,
      },
    });
  }

  select.innerHTML = merged
    .slice()
    .sort((a, b) => String(a.id).localeCompare(String(b.id), 'de'))
    .map(({ id, data }) => {
      const label = String(data?.displayName || id).trim();
      const safeId = escapeHtml(id);
      const safeLabel = escapeHtml(label);
      return `<option value="${safeId}">${safeLabel}</option>`;
    })
    .join('');

  if (activeId && [...select.options].some((option) => option.value === activeId)) {
    select.value = activeId;
  } else if (select.options.length) {
    select.value = select.options[0].value;
  }
  dashboardStateRef.tenantCatalog = merged;
  dashboardStateRef.selectedTenantId = String(select.value || activeId || '').trim();
  const selectedNow = merged.find((item) => item.id === dashboardStateRef.selectedTenantId);
  if (selectedNow?.data) {
    dashboardStateRef.tenantDisplayName = tenantLabelFromData(
      selectedNow.data,
      selectedNow.id,
    ) || dashboardStateRef.tenantDisplayName;
    dashboardStateRef.tenantTier = String(selectedNow.data.tier || dashboardStateRef.tenantTier || '').trim();
    dashboardStateRef.tenantStatus = selectedNow.data.status === 'inactive' ? 'inactive' : 'active';
    if (selectedNow.data.enabledModules && typeof selectedNow.data.enabledModules === 'object') {
      dashboardStateRef.tenantModules = { ...selectedNow.data.enabledModules };
    }
  }

  if (wrap) {
    wrap.hidden = dashboardStateRef.isSuperAdmin ? false : !dashboardStateRef.selectedTenantId;
  }
  select.disabled = !dashboardStateRef.isSuperAdmin && Boolean(dashboardStateRef.selectedTenantId);

  if (select.dataset.bound === '1') {
    void refreshEmployeeTable(dashboardStateRef);
    return;
  }
  select.dataset.bound = '1';
  select.addEventListener('change', () => {
    dashboardStateRef.selectedTenantId = select.value;
    const selected = (dashboardStateRef.tenantCatalog || []).find((item) => item.id === select.value);
    dashboardStateRef.tenantDisplayName = tenantLabelFromData(selected?.data, select.value);
    dashboardStateRef.tenantTier = String(selected?.data?.tier || '').trim();
    dashboardStateRef.tenantStatus = selected?.data?.status === 'inactive' ? 'inactive' : 'active';
    dashboardStateRef.tenantModules = selected?.data?.enabledModules && typeof selected.data.enabledModules === 'object'
      ? { ...selected.data.enabledModules }
      : {};
    fillSettingsForm(dashboardStateRef);
    renderOverviewCards(dashboardStateRef);
    renderAuditTable(dashboardStateRef.selectedTenantId);
    if (dashboardStateRef.selectedTenantId) {
      setGlobalTenantId(dashboardStateRef.selectedTenantId);
      setTeamConfigTenantId(dashboardStateRef.selectedTenantId);
    }
    void refreshEmployeeTable(dashboardStateRef);
    applyDashboardVisibility(dashboardStateRef);
    if (dashboardStateRef.activeTab === 'settings') {
      syncDevDashboardHaccpAdmin({
        db: dashboardStateRef.db,
        tenantId: dashboardStateRef.selectedTenantId,
        recordAudit,
      });
      void refreshDiscountMatrixUi(dashboardStateRef.selectedTenantId);
    } else {
      refreshDevDashboardHaccpAdmin();
    }
  });
}

/**
 * Progressive Disclosure: Hygiene/Geräte nur mit HACCP-Modul,
 * Rabattstaffel nur mit MHD-Modul (Super-Admin sieht alles).
 */
function syncBetriebProgressivePanels(dashboardStateRef = dashboardState) {
  const modules = dashboardStateRef.tenantModules || {};
  const modulesLoaded = Object.keys(modules).length > 0;
  const isSuper = Boolean(dashboardStateRef.isSuperAdmin);
  const haccpOn = !modulesLoaded || isSuper || modules.haccp === true;
  const mhdOn = !modulesLoaded || isSuper
    || modules.mhd === true
    || modules.mhdMonitor === true;

  const hygieneTab = document.getElementById('betrieb-tab-hygiene');
  const geraeteTab = document.getElementById('betrieb-tab-geraete');
  if (hygieneTab) hygieneTab.hidden = !haccpOn;
  if (geraeteTab) geraeteTab.hidden = !haccpOn;

  const discount = document.getElementById('dev-dashboard-discount-matrix');
  if (discount) discount.hidden = !mhdOn;

  const section = dashboardStateRef.betriebSection || 'stammdaten';
  if ((section === 'hygiene' || section === 'geraete') && !haccpOn) {
    setBetriebSection('stammdaten');
  }
}

function applyDashboardVisibility(dashboardStateRef) {
  const globalPanel = document.getElementById('dev-dashboard-global-panel');
  const platformTab = document.getElementById('dev-dashboard-tab-platform');
  const tenantSelectWrap = document.getElementById('dev-dashboard-tenant-select-wrap');
  const tenantSelect = document.getElementById('dev-dashboard-tenant-select');
  const roleBadge = document.getElementById('dev-dashboard-role-badge');
  const needsTenantPick = dashboardStateRef.isSuperAdmin && !dashboardStateRef.selectedTenantId;

  if (typeof document !== 'undefined') {
    document.body.classList.toggle('role-super-admin', Boolean(dashboardStateRef.isSuperAdmin));
    document.body.classList.toggle('role-betriebs-admin', !dashboardStateRef.isSuperAdmin);
  }

  if (roleBadge) {
    const isBetriebs = !dashboardStateRef.isSuperAdmin;
    roleBadge.textContent = dashboardStateRef.isSuperAdmin ? 'Super-Admin' : 'Betriebs-Admin';
    roleBadge.dataset.role = dashboardStateRef.isSuperAdmin ? 'super' : 'tenant';
    roleBadge.dataset.betriebsAdmin = isBetriebs ? '1' : '0';
  }

  if (platformTab) {
    platformTab.hidden = !dashboardStateRef.isSuperAdmin;
  }
  if (globalPanel) {
    globalPanel.hidden = !dashboardStateRef.isSuperAdmin;
  }
  if (!dashboardStateRef.isSuperAdmin && dashboardStateRef.activeTab === 'platform') {
    dashboardStateRef.activeTab = 'overview';
  }
  if (dashboardStateRef.isSuperAdmin && needsTenantPick && dashboardStateRef.activeTab !== 'platform') {
    dashboardStateRef.activeTab = 'platform';
  }
  // Super-Admin braucht den Selector immer, um einen Betrieb zu wählen.
  if (tenantSelectWrap) {
    tenantSelectWrap.hidden = dashboardStateRef.isSuperAdmin
      ? false
      : !dashboardStateRef.selectedTenantId;
  }
  if (tenantSelect) {
    tenantSelect.disabled = !dashboardStateRef.isSuperAdmin && Boolean(dashboardStateRef.selectedTenantId);
  }
  document.querySelectorAll('.dev-dashboard-tab[data-dev-tab]').forEach((btn) => {
    const tab = btn.getAttribute('data-dev-tab');
    if (tab === 'platform') {
      btn.disabled = false;
      btn.removeAttribute('title');
      return;
    }
    if (needsTenantPick) {
      btn.disabled = true;
      btn.title = 'Zuerst Betrieb in Plattform wählen';
    } else {
      btn.disabled = false;
      btn.removeAttribute('title');
    }
  });
  fillBetriebModuleToggles(dashboardStateRef);
  syncBetriebProgressivePanels(dashboardStateRef);
}

let tenantsUnsubscribe = null;
let singleTenantUnsubscribe = null;
const dashboardState = {
  isSuperAdmin: false,
  selectedTenantId: '',
  currentUserUid: '',
  actorEmail: '',
  employees: [],
  tenantCatalog: [],
  tenantModules: {},
  roleModuleDefaults: null,
  tenantDisplayName: '',
  tenantTier: '',
  tenantStatus: 'active',
  userQuery: '',
  userRoleFilter: 'all',
  activeTab: 'overview',
  /** Unterseite in Mein Betrieb: stammdaten | module | hygiene | geraete | smtp */
  betriebSection: 'stammdaten',
  db: null,
  movementRows: [],
  editingMovement: null,
  lastCorrection: null,
  correctionWrites: [],
};

if (typeof window !== 'undefined') {
  exposeMovementReportApi();
}

function setDevDashboardTab(tabKey = 'overview') {
  let nextTab = DEV_DASHBOARD_TABS.has(tabKey) ? tabKey : 'overview';
  if (nextTab === 'platform' && !dashboardState.isSuperAdmin) nextTab = 'overview';
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
    setBetriebSection(dashboardState.betriebSection || 'stammdaten');
    syncDevDashboardHaccpAdmin({
      db: dashboardState.db,
      tenantId: dashboardState.selectedTenantId,
      recordAudit,
    });
    if (dashboardState.selectedTenantId) {
      setGlobalTenantId(dashboardState.selectedTenantId);
    }
    void refreshDiscountMatrixUi(dashboardState.selectedTenantId);
    renderSupplyCatalogAdminTable();
  }
  if (nextTab === 'audit') {
    bindMovementReportControls();
    renderAuditTable(dashboardState.selectedTenantId);
    void loadMovementReport();
  }
  if (nextTab === 'users') {
    if (dashboardState.selectedTenantId) {
      setGlobalTenantId(dashboardState.selectedTenantId);
      setTeamConfigTenantId(dashboardState.selectedTenantId);
    }
    renderEmployeeTable(dashboardState.employees, dashboardState.currentUserUid);
  }
}

/**
 * Deep-Links in Mein Betrieb:
 * #haccp-setup / #betrieb-geraete → Geräte (Messpunkte)
 * #betrieb-hygiene / #hygiene → Hygiene
 * #betrieb-smtp / #smtp → SMTP
 * #betrieb-module → Module & Rollen
 * #betrieb-stammdaten → Stammdaten
 */
function resolveBetriebSectionFromHash(hash = '') {
  const clean = String(hash || '').replace(/^#/, '').trim().toLowerCase();
  if (!clean) return '';
  if (clean === 'haccp-setup' || clean === 'dev-dashboard-haccp-setup' || clean === 'betrieb-geraete' || clean === 'geraete') {
    return 'geraete';
  }
  if (clean === 'betrieb-hygiene' || clean === 'hygiene') return 'hygiene';
  if (clean === 'betrieb-smtp' || clean === 'smtp') return 'smtp';
  if (clean === 'betrieb-module' || clean === 'module' || clean === 'module-rollen') return 'module';
  if (clean === 'betrieb-stammdaten' || clean === 'stammdaten') return 'stammdaten';
  return '';
}

function applyDevDashboardDeepLink() {
  const hash = String(window.location.hash || '').replace(/^#/, '').trim().toLowerCase();
  const section = resolveBetriebSectionFromHash(hash);
  if (!section) return;
  setDevDashboardTab('settings');
  setBetriebSection(section);
  window.setTimeout(() => {
    const targetId = section === 'geraete'
      ? 'dev-dashboard-haccp-setup'
      : section === 'hygiene'
        ? 'dev-dashboard-hygiene-setup'
        : `betrieb-panel-${section}`;
    const target = document.getElementById(targetId);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try {
      target.classList.add('is-deep-link-focus');
      window.setTimeout(() => target.classList.remove('is-deep-link-focus'), 2400);
    } catch (_) { /* noop */ }
  }, 80);
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

function platformTenantRows(entries) {
  return (Array.isArray(entries) ? entries : []).map((entry) => ({
    id: String(entry?.id || '').trim(),
    data: {
      displayName: tenantLabelFromData(
        { displayName: entry?.name, name: entry?.betriebsName },
        entry?.id,
      ),
      tier: String(entry?.tier || ''),
      status: entry?.status === 'inactive' ? 'inactive' : 'active',
      enabledModules: entry?.enabledModules && typeof entry.enabledModules === 'object'
        ? entry.enabledModules
        : {},
    },
  })).filter((entry) => entry.id);
}

async function loadTenantsList(statusEl) {
  const unavailable = 'Die Betriebsliste ist für diesen Zugang nicht verfügbar. Der aktuelle Betrieb bleibt ausgewählt.';
  const callable = getListPlatformTenantsCallable();
  if (!callable) {
    renderTenantTable([], { emptyMessage: unavailable });
    bindTenantSelector(dashboardState, []);
    return;
  }
  try {
    await waitForAppCheckReady();
    const result = await callable({});
    const tenants = platformTenantRows(result?.data?.tenants);
    renderTenantTable(tenants, {
      emptyMessage: tenants.length ? '' : EMPTY_TENANTS_MESSAGE,
    });
    bindTenantSelector(dashboardState, tenants);
    fillSettingsForm(dashboardState);
    renderOverviewCards(dashboardState);
    void refreshEmployeeTable(dashboardState);
    if (statusEl && tenants.length && dashboardState.isSuperAdmin) {
      const currentLabel = dashboardState.tenantDisplayName || dashboardState.selectedTenantId;
      statusEl.textContent = currentLabel
        ? `Angemeldet · ${currentLabel}`
        : `${tenants.length} Betrieb${tenants.length === 1 ? '' : 'e'} geladen`;
    }
  } catch (err) {
    console.error('[Dev-Dashboard] Mandanten-Liste (Plattform) fehlgeschlagen:', err);
    const emptyMessage = isPermissionDeniedError(err)
      ? unavailable
      : 'Betriebe konnten gerade nicht geladen werden.';
    renderTenantTable([], { emptyMessage });
    bindTenantSelector(dashboardState, []);
    if (statusEl && dashboardState.selectedTenantId) {
      statusEl.textContent = `Angemeldet als ${dashboardState.actorEmail || 'Admin'} · ${
        dashboardState.tenantDisplayName || dashboardState.selectedTenantId
      }`;
    }
  }
}

function subscribeAllTenants(db, statusEl) {
  if (tenantsUnsubscribe) tenantsUnsubscribe();
  tenantsUnsubscribe = null;
  void loadTenantsList(statusEl);
  return () => {};
}

function subscribeSingleTenant(db, tenantId, statusEl) {
  if (singleTenantUnsubscribe) singleTenantUnsubscribe();
  if (!tenantId) return null;

  singleTenantUnsubscribe = db.collection('tenants').doc(tenantId).onSnapshot(
    (snap) => {
      const data = snap.data() || {};
      dashboardState.tenantDisplayName = tenantLabelFromData(data, tenantId);
      dashboardState.tenantTier = String(data.tier || '').trim();
      dashboardState.tenantStatus = data.status === 'inactive' ? 'inactive' : 'active';
      dashboardState.tenantModules = data.enabledModules && typeof data.enabledModules === 'object'
        ? { ...data.enabledModules }
        : {};
      renderOverviewCards(dashboardState);
      if (dashboardState.activeTab === 'settings') {
        fillSettingsForm(dashboardState);
        syncDevDashboardHaccpAdmin({
          db: dashboardState.db,
          tenantId: dashboardState.selectedTenantId,
          recordAudit,
        });
      }
      if (statusEl) statusEl.textContent = `Betrieb: ${dashboardState.tenantDisplayName}`;
    },
    (err) => {
      console.error('[Dev-Dashboard] Mandanten-Dokument fehlgeschlagen:', err);
      const container = document.getElementById('dev-dashboard-single-tenant');
      if (container && !dashboardState.selectedTenantId) {
        container.innerHTML = `<p class="dev-dashboard-empty-msg dev-dashboard-empty-msg--error">${PERMISSION_DENIED_MESSAGE}</p>`;
      }
      if (statusEl && dashboardState.selectedTenantId) {
        statusEl.textContent = `Angemeldet als ${dashboardState.actorEmail || 'Admin'} · ${
          dashboardState.tenantDisplayName || dashboardState.selectedTenantId
        }`;
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
    dashboardState.selectedTenantId = resolveDashboardTenantId(authContext);
    dashboardState.currentUserUid = currentUser?.uid || '';
    dashboardState.actorEmail = String(currentUser?.email || '').trim();
    dashboardState.db = db;
    initTenantDb(db);
    dashboardState.tenantDisplayName = String(
      window.BRANDING?.betriebsName || dashboardState.selectedTenantId || '',
    ).trim();
    // Super-Admin startet auf Plattform, bis ein Betrieb gewählt ist.
    if (dashboardState.isSuperAdmin && !dashboardState.selectedTenantId) {
      dashboardState.activeTab = 'platform';
    }

    applyDashboardVisibility(dashboardState);

    if (typeof window.applyResolvedBranding === 'function') {
      window.applyResolvedBranding(dashboardState.selectedTenantId || window.resolveEffectiveTenantId?.());
    }
    const settingsDraft = readTenantSettingsDraft(dashboardState.selectedTenantId);
    if (settingsDraft.displayName || settingsDraft.logoUrl) {
      applyBrandingFromSettingsDraft(dashboardState.selectedTenantId, settingsDraft);
      if (settingsDraft.displayName) dashboardState.tenantDisplayName = settingsDraft.displayName;
    }

    bindDashboardStatusSignOut();
    bindDevDashboardBackButton();
    bindDevDashboardTabs();
    bindBetriebSubnav();
    bindOverviewJumpLinks();
    bindSettingsForm(dashboardState);
    bindSmtpForm(dashboardState);
    syncDevDashboardHaccpAdmin({
      db,
      tenantId: dashboardState.selectedTenantId,
      recordAudit,
    });
    bindMhdCardUiModuleToggles(dashboardState);
    bindUserFilters(dashboardState);
    bindMovementReportControls();
    bindInvitePanel();
    bindTenantToggleHandlers(db, statusEl);
    bindTenantCreateForm(db);
    bindEmployeeCreateForm(dashboardState);
    bindEmployeeTableActions(dashboardState);
    bindRoleModuleSave(dashboardState);

    if (!window.__hofsyncDeptAssignmentListener) {
      window.__hofsyncDeptAssignmentListener = true;
      window.addEventListener('charculogic:team-config-changed', () => {
        if (!dashboardState.employees?.length) return;
        renderEmployeeTable(dashboardState.employees, dashboardState.currentUserUid);
      });
    }

    bindTenantSelector(dashboardState, [{
      id: dashboardState.selectedTenantId,
      data: { displayName: dashboardState.tenantDisplayName },
    }]);

    if (dashboardState.isSuperAdmin) {
      subscribeAllTenants(db, statusEl);
    } else if (dashboardState.selectedTenantId) {
      subscribeSingleTenant(db, dashboardState.selectedTenantId, statusEl);
    }

    recordAudit('login', 'Verwaltung geöffnet', 'security');
    setDevDashboardTab(dashboardState.activeTab || 'overview');
    applyDevDashboardDeepLink();
    await refreshEmployeeTable(dashboardState);
    renderOverviewCards(dashboardState);

    if (statusEl) {
      const who = currentUser?.email || (dashboardState.isSuperAdmin ? 'Super-Admin' : 'Admin');
      const where = dashboardState.tenantDisplayName || dashboardState.selectedTenantId;
      statusEl.textContent = where ? `Angemeldet als ${who} · ${where}` : `Angemeldet als ${who}`;
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
