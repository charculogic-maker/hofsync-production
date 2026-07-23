import {
  activateAuthLoopBreaker,
  canStartFirestoreLiveListeners,
  clearAuthLoopBreaker,
  enforceAuthLoopBreakerShell,
  ensureFirebaseAuthForTenant,
  getAuthContext,
  getTenantId,
  hideAppShellForAuthLockdown,
  initAuthModule,
  isAuthLoopBreakerActive,
  isFirebaseAuthActiveForTenant,
  isHelperUser,
  isOfficeUser,
  loginTenant,
  logoutTenant,
  registerFirebaseCoreReady,
  shutdownFirestoreClient,
  verifyAdminAction,
  waitForAuthReady,
} from './auth.js';
import {
  addPendingSync,
  flushErrorTelemetry,
  flushPendingSyncs,
  refreshSyncConnectivityUi,
  getDeadPendingSyncs,
  getPendingSyncs,
  initSyncEngine,
  qaState,
  requeueDeadPendingSyncs,
  reportCriticalError,
  savePendingSyncs,
  updateSyncIndicator,
  writeFirestoreDocOrQueue,
} from './sync.js';
import {
  closeScanner,
  initScannerEngine,
  openScanner,
} from './scanner.js';
import {
  activateHaccpTab,
  initHaccpModule,
  startHaccpLiveSync,
} from './haccp.js';
import {
  activateTraceabilityTab,
  initTraceabilityModule,
} from './traceability.js';
import {
  activateMhdTab,
  activateReceivingTab,
  getMhdProducts,
  applyReceivingMetzgereiVisibility,
  handleMhdBarcodeScan,
  handleMhdScannerStatus,
  initMhdModule,
  refreshReceivingTabUiSafe,
  renderMhdList,
  startMhdLiveSync,
  updateMhdAdminSearchVisibility,
} from './mhd.js';
import {
  addRetterBoxCandidate,
  initRetterBoxModule,
  refreshRetterBoxModule,
} from './retter-box.js';
import {
  activateBatchesTab,
  activateKitchenTab,
  disableProductionModule,
  initProductionModule,
  loadProductionBatchesFromCloud,
  loadRecipesFromCloud,
  syncRecipeAdminFormVisibility,
} from './production.js';
import {
  BeffeCalcEngine,
  formatNumber,
  pickLatestFleischpreiseDoc,
} from './beffe_calc.js';
import {
  activateCutGlossaryTab,
  initCutGlossaryModule,
} from './cuts.js';
import {
  activateTeamboardTab,
  initTeamboardModule,
  refreshTeamboardAdminPanel,
} from './teamboard.js';
import {
  initCustomerOrdersModule,
} from './customer-orders.js';
import { activateTeamHubTab } from './team-tab.js';
import {
  getTeamEmployees,
  initTeamConfigModule,
  refreshAdminTeamConfigPanel,
  syncPushRegistration,
} from './team-config.js';
import { initGermanDateInputs } from './date-input.js';
import { initDeliveryNoteScanner } from './delivery-note.js';
import { initDeliveryParser } from './delivery-parser.js';
import {
  getGlobalTenantId,
  getTenantCollection,
  getTenantCollectionPath,
  initTenantDb,
  canonicalTenantId,
  normalizeTenantId,
  setGlobalTenantId,
  tenantIdsMatch,
} from './tenant-db.js';
import { resolveFirebaseConfig, resolveFirebaseProjectKey, toFirebaseSdkConfig } from './firebase-config.js';
import {
  assertFirebaseProjectIsolation,
  ensureFirebaseApp,
  handleEmergencyLogoutParam,
  isEmergencyLogoutRequested,
} from './firebase-init.js';
import {
  createHttpsCallable,
  getRegionalFunctions,
  resolveFunctionsBaseUrl,
} from './firebase-functions.js';
import { initAppCheckModule, waitForAppCheckReady } from './app-check.js';
import { attachLocalFirebaseEmulators, isLocalFirebaseEmulatorHost } from './firebase-emulator.js';
import {
  hasAnyAdminModuleEnabled,
  isTenantModuleEnabled,
  loadTenantEnabledModules,
  subscribeTenantEnabledModules,
} from './tenant-modules.js';
import {
  initDevDashboard,
  isDevDashboardRoute,
} from './dev-dashboard.js';
import { logAndMapOperatorError } from './operator-errors.js';
import {
  ACTIVE_EMPLOYEE_STORAGE_KEY,
  ACTIVE_AREA_STORAGE_KEY,
  clearTeamboardTenantStorage,
  LEGACY_SHIFT_STORAGE_KEY,
  readScopedLocalStorageValue,
  scopedTeamboardStorageKey,
  writeScopedLocalStorageValue,
} from './teamboard-storage.js';

// ⚡ Notausgang: ganz oben vor jedem Auth-/Routing-Check prüfen.
// Bei ?logout=true / ?forceLogout=true sofort abmelden, Cache leeren, sauber neu laden.
const EMERGENCY_LOGOUT_REQUESTED = isEmergencyLogoutRequested();
if (EMERGENCY_LOGOUT_REQUESTED) {
  void handleEmergencyLogoutParam();
}

const STEVESHOF_TENANT_ID = 'StevesHof_Hauptbetrieb';
const STEVESHOF_TERMINAL_EMAIL = 'bestellung@steveshof-hofladen.de';

const PIN_PROTECTED_TABS = new Set(['teamboard', 'team', 'mhd', 'receiving', 'traceability', 'haccp']);
const PROFILE_LAST_ACTION_STORAGE_KEY = 'charculogic_profile_last_action';
const PROFILE_GUEST_NAMES_KEY = 'charculogic_profile_guest_names';
const BULLETIN_ACK_STORAGE_PREFIX = 'charculogic_bulletin_ack';
const BULLETIN_DOC_ID = 'current';
const TERMINAL_DEVICE_TOKEN_KEY = 'charculogic_terminal_device_token';
const CACHED_TENANT_ID_KEY = 'charculogic_cached_tenant_id';
const AUTH_LOCAL_STORAGE_MARKERS = [
  CACHED_TENANT_ID_KEY,
  ACTIVE_EMPLOYEE_STORAGE_KEY,
  TERMINAL_DEVICE_TOKEN_KEY,
  PROFILE_LAST_ACTION_STORAGE_KEY,
  PROFILE_GUEST_NAMES_KEY,
  ACTIVE_AREA_STORAGE_KEY,
  LEGACY_SHIFT_STORAGE_KEY,
];
const PROFILE_SESSION_IDLE_MS = 120 * 60 * 1000;
const PROFILE_OTHER_LABEL = 'Andere';
const INVENTORY_PROFILE_TABS = new Set(['mhd', 'receiving', 'traceability']);
const LEGACY_TEAM_SESSION_MARKERS = ['steveshof-team', 'team steveshof'];

function isEmployeePinRequired(branding = window.BRANDING) {
  if (isFirebaseRoleAuth(branding)) return false;
  return branding?.modules?.employeePin !== false;
}

function isFirebaseRoleAuth(branding = window.BRANDING) {
  return branding?.modules?.employeeAuth === 'firebase';
}

function isProfileEmployeeAuth(branding = window.BRANDING) {
  return branding?.modules?.employeeAuth === 'profile';
}

function resolveFirebaseEmployeeName(authSession = getAuthContext()) {
  const profile = authSession?.profile || {};
  const fromProfile = String(profile.displayName || profile.name || '').trim();
  if (fromProfile) return fromProfile;
  const fromAuth = String(authSession?.user?.displayName || '').trim();
  if (fromAuth) return fromAuth;
  const emailLocal = String(authSession?.email || '').split('@')[0];
  return emailLocal || 'Mitarbeiter';
}

function syncFirebaseEmployeeSession(authSession = getAuthContext()) {
  if (!isFirebaseRoleAuth()) return '';
  const employeeName = resolveFirebaseEmployeeName(authSession);
  if (!employeeName) return '';
  const teamLoginCard = document.getElementById('team-login-card');
  if (teamLoginCard) teamLoginCard.hidden = true;
  updateEmployeeSessionBadge(persistActiveEmployeeSession(employeeName));
  return employeeName;
}

function isTeamSessionName(employeeName, branding = window.BRANDING) {
  const cleanName = String(employeeName || '').trim();
  if (!cleanName) return true;
  const normalized = cleanName.toLowerCase();
  if (LEGACY_TEAM_SESSION_MARKERS.includes(normalized)) return true;
  if (normalized.startsWith('team ')) return true;
  return cleanName === resolveTeamSessionName(branding);
}

function isNamedProfileSession(employeeName, branding = window.BRANDING) {
  const cleanName = String(employeeName || '').trim();
  if (!cleanName) return false;
  return !isTeamSessionName(cleanName, branding);
}

function profileLastActionStorageKey() {
  return scopedTeamboardStorageKey(
    PROFILE_LAST_ACTION_STORAGE_KEY,
    normalizeTenantId(getGlobalTenantId() || getTenantId()),
  );
}

function touchProfileLastActionTime() {
  if (!isProfileEmployeeAuth()) return;
  try {
    localStorage.setItem(profileLastActionStorageKey(), new Date().toISOString());
  } catch (err) {
    console.warn('[CharcuLogic Profile] lastActionTime konnte nicht gespeichert werden:', err);
  }
}

function clearProfileLastActionTime() {
  try {
    localStorage.removeItem(profileLastActionStorageKey());
  } catch (_) { /* noop */ }
}

function clearProfileSession() {
  try {
    localStorage.removeItem(activeEmployeeStorageKey());
    localStorage.removeItem(ACTIVE_EMPLOYEE_STORAGE_KEY);
  } catch (err) {
    console.warn('[CharcuLogic Profile] Session konnte nicht gelöscht werden:', err);
  }
  clearProfileLastActionTime();
  window.dispatchEvent(new CustomEvent('charculogic:active-employee-changed', {
    detail: { employeeName: '' },
  }));
  updateEmployeeSessionBadge('');
}

function clearNamedProfileSession(branding = window.BRANDING) {
  const current = readActiveEmployee();
  if (!current) return false;
  clearProfileSession();
  if (!isProfileEmployeeAuth(branding) && !isEmployeePinRequired(branding)) {
    configureTeamSessionWithoutPin(branding);
  }
  return true;
}

function purgeInvalidProfileSession(branding = window.BRANDING) {
  if (!isProfileEmployeeAuth(branding)) return;
  const current = readActiveEmployee();
  if (!current) return;
  if (!isNamedProfileSession(current, branding)) {
    clearProfileSession();
  }
}

function profileGuestNamesStorageKey() {
  return scopedTeamboardStorageKey(
    PROFILE_GUEST_NAMES_KEY,
    normalizeTenantId(getGlobalTenantId() || getTenantId()),
  );
}

function readProfileGuestNames() {
  try {
    const raw = readScopedLocalStorageValue(
      PROFILE_GUEST_NAMES_KEY,
      normalizeTenantId(getGlobalTenantId() || getTenantId()),
    );
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map((name) => String(name).trim()).filter(Boolean)
      : [];
  } catch (_) {
    return [];
  }
}

function rememberProfileGuestName(name) {
  const cleanName = String(name || '').trim();
  if (!cleanName) return;
  const next = [
    cleanName,
    ...readProfileGuestNames().filter((entry) => entry.toLowerCase() !== cleanName.toLowerCase()),
  ].slice(0, 12);
  try {
    writeScopedLocalStorageValue(
      PROFILE_GUEST_NAMES_KEY,
      resolveInventoryTenantId(),
      JSON.stringify(next),
    );
  } catch (err) {
    console.warn('[CharcuLogic Profile] Gastnamen konnten nicht gespeichert werden:', err);
  }
}

function getSortedProfilePickerEmployees() {
  const blocked = new Set([
    PROFILE_OTHER_LABEL.toLowerCase(),
    ...LEGACY_TEAM_SESSION_MARKERS,
    resolveTeamSessionName().toLowerCase(),
  ]);
  return getTeamEmployees()
    .map((name) => String(name).trim())
    .filter((name) => name && !blocked.has(name.toLowerCase()) && !isTeamSessionName(name))
    .sort((left, right) => left.localeCompare(right, 'de', { sensitivity: 'base' }));
}

function expireProfileSessionIfIdle(branding = window.BRANDING) {
  if (!isProfileEmployeeAuth(branding)) return false;
  const current = readActiveEmployee();
  if (!isNamedProfileSession(current, branding)) return false;

  let lastRaw = '';
  try {
    lastRaw = readScopedLocalStorageValue(
      PROFILE_LAST_ACTION_STORAGE_KEY,
      resolveInventoryStorageTenantKey(),
    ) || '';
  } catch (_) { /* noop */ }

  if (!lastRaw) {
    touchProfileLastActionTime();
    return false;
  }

  const lastMs = Date.parse(lastRaw);
  if (Number.isNaN(lastMs) || (Date.now() - lastMs) <= PROFILE_SESSION_IDLE_MS) {
    return false;
  }

  clearNamedProfileSession(branding);
  return true;
}

function isAdvancedKaeseUpgradeEnabled(branding = window.BRANDING) {
  return branding?.advancedKaeseUpgrade === true;
}

function normalizeProfileCapabilityKey(name = '') {
  return String(name || '').trim().toLowerCase();
}

function resolveProfileCapabilities(employeeName, branding = window.BRANDING) {
  const capabilities = branding?.profileCapabilities;
  if (!capabilities || typeof capabilities !== 'object') return null;
  const target = normalizeProfileCapabilityKey(employeeName);
  if (!target) return null;
  const match = Object.entries(capabilities).find(
    ([profileName]) => normalizeProfileCapabilityKey(profileName) === target,
  );
  return match ? match[1] : null;
}

function bulletinAckStorageBaseKey(employeeName) {
  return `${BULLETIN_ACK_STORAGE_PREFIX}_${normalizeProfileCapabilityKey(employeeName)}`;
}

function readLocalBulletinAck(employeeName) {
  return readScopedLocalStorageValue(
    bulletinAckStorageBaseKey(employeeName),
    resolveInventoryStorageTenantKey(),
  );
}

function writeLocalBulletinAck(employeeName, bulletinFingerprint) {
  writeScopedLocalStorageValue(
    bulletinAckStorageBaseKey(employeeName),
    resolveInventoryStorageTenantKey(),
    bulletinFingerprint,
  );
}

function resolveBulletinFingerprint(bulletin) {
  if (!bulletin) return '';
  const updatedAt = bulletin.updatedAt;
  if (updatedAt && typeof updatedAt.toDate === 'function') {
    return updatedAt.toDate().toISOString();
  }
  const rawUpdated = String(updatedAt || '').trim();
  if (rawUpdated) return rawUpdated;
  return String(bulletin.message || '').trim();
}

function isBulletinUnreadForEmployee(bulletin, employeeName) {
  const message = String(bulletin?.message || '').trim();
  if (!message) return false;
  const fingerprint = resolveBulletinFingerprint(bulletin);
  if (!fingerprint) return false;
  return readLocalBulletinAck(employeeName) !== fingerprint;
}

async function fetchCurrentBulletinDoc() {
  const tenantId = getGlobalTenantId() || getTenantId();
  if (!tenantId || !db) return null;
  try {
    const snap = await getTenantCollection('bulletinBoard').doc(BULLETIN_DOC_ID).get();
    return snap.exists ? snap.data() : null;
  } catch (err) {
    console.warn('[CharcuLogic Bulletin] Nachricht des Tages konnte nicht geladen werden:', err);
    return null;
  }
}

function readTerminalDeviceIdForAudit() {
  return readScopedLocalStorageValue(
    TERMINAL_DEVICE_TOKEN_KEY,
    resolveInventoryStorageTenantKey(),
  ) || 'laden-iphone';
}

async function persistBulletinConfirmationAudit(bulletin, employeeName, branding = window.BRANDING) {
  const cleanName = String(employeeName || '').trim();
  const message = String(bulletin?.message || '').trim();
  if (!cleanName || !message) return;

  const profile = resolveProfileCapabilities(cleanName, branding) || {};
  const confirmedAtIso = new Date().toISOString();
  const docId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `ack_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const payload = {
    employeeName: cleanName,
    confirmedAt: confirmedAtIso,
    bulletinMessage: message,
    bulletinUpdatedAt: resolveBulletinFingerprint(bulletin),
    tenantId: getGlobalTenantId() || getTenantId(),
    deviceId: readTerminalDeviceIdForAudit(),
    profileEmail: String(profile.email || '').trim(),
  };

  try {
    const firebaseApi = typeof firebase !== 'undefined' ? firebase : null;
    const onlineData = firebaseApi?.firestore?.FieldValue
      ? { ...payload, confirmedAt: firebaseApi.firestore.FieldValue.serverTimestamp() }
      : payload;
    await writeFirestoreDocOrQueue({
      collectionPath: 'bulletinConfirmations',
      docId,
      op: 'set',
      onlineData,
      queueData: payload,
      offlineMessage: 'Bestätigung wird synchronisiert, sobald WLAN verfügbar ist.',
    });
  } catch (err) {
    console.warn('[CharcuLogic Bulletin] Audit-Bestätigung konnte nicht gespeichert werden:', err);
  }
}

let bulletinAckGatePromise = null;

function showBulletinAckGate(bulletin, employeeName) {
  if (bulletinAckGatePromise) return bulletinAckGatePromise;

  bulletinAckGatePromise = new Promise((resolve) => {
    document.getElementById('bulletin-ack-gate-overlay')?.remove();

    const message = String(bulletin?.message || '').trim();
    const updatedLabel = resolveBulletinFingerprint(bulletin)
      ? new Date(resolveBulletinFingerprint(bulletin)).toLocaleString('de-DE')
      : '';
    const author = String(bulletin?.author || '').trim();

    const body = document.createDocumentFragment();
    const kicker = document.createElement('div');
    kicker.className = 'bulletin-card-kicker';
    kicker.textContent = 'Nachricht des Tages';
    body.appendChild(kicker);

    if (updatedLabel || author) {
      const meta = document.createElement('div');
      meta.className = 'bulletin-card-meta';
      meta.textContent = [updatedLabel, author].filter(Boolean).join(' · ');
      body.appendChild(meta);
    }

    const text = document.createElement('p');
    text.className = 'bulletin-card-message';
    text.textContent = message;
    body.appendChild(text);

    const hint = document.createElement('p');
    hint.className = 'pin-auth-scan';
    hint.textContent = `Bitte als ${employeeName} lesen und bestätigen, bevor wir weiterarbeiten.`;
    body.appendChild(hint);

    const actions = document.createElement('div');
    actions.className = 'profile-gate-actions';

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'btn btn-primary profile-gate-btn';
    confirmBtn.dataset.bulletinAckConfirm = '1';
    confirmBtn.textContent = 'Gelesen & Bestätigt';
    actions.appendChild(confirmBtn);
    body.appendChild(actions);

    const { overlay } = buildProfileSessionOverlayShell(body);
    overlay.id = 'bulletin-ack-gate-overlay';

    const finish = async () => {
      writeLocalBulletinAck(employeeName, resolveBulletinFingerprint(bulletin));
      await persistBulletinConfirmationAudit(bulletin, employeeName);
      overlay.remove();
      bulletinAckGatePromise = null;
      window.showToast?.('Nachricht des Tages bestätigt.', 'success');
      resolve();
    };

    overlay.addEventListener('click', (event) => {
      if (event.target.closest('[data-bulletin-ack-confirm]')) {
        void finish();
      }
    });

    document.body.appendChild(overlay);
    confirmBtn.focus();
  });

  return bulletinAckGatePromise;
}

async function maybeShowBulletinAckInterceptor(employeeName, branding = window.BRANDING) {
  if (!isAdvancedKaeseUpgradeEnabled(branding)) return;
  const cleanName = String(employeeName || '').trim();
  if (!isNamedProfileSession(cleanName, branding)) return;

  const bulletin = await fetchCurrentBulletinDoc();
  if (!isBulletinUnreadForEmployee(bulletin, cleanName)) return;
  await showBulletinAckGate(bulletin, cleanName);
}

const PROFILE_TAB_ALIASES = {
  neu: 'receiving',
  wissen: 'knowledge',
};

const BOTTOM_NAV_TAB_IDS = new Set(['teamboard', 'team', 'mhd', 'receiving', 'traceability', 'kitchen']);
const ADMIN_HEADER_ONLY_TAB_IDS = new Set(['haccp', 'knowledge', 'cuts', 'batches']);

function hasActiveFirebaseAuthUser() {
  try {
    if (typeof firebase === 'undefined' || !firebase.apps?.length) return false;
    return Boolean(firebase.auth().currentUser);
  } catch (_) {
    return false;
  }
}

function hasAuthenticatedTenantContext(authSession = getAuthContext()) {
  try {
    if (!hasActiveFirebaseAuthUser()) return false;
    const tenantId = normalizeTenantId(
      authSession?.tenantId || getTenantId() || getGlobalTenantId() || '',
    );
    return Boolean(tenantId);
  } catch (_) {
    return false;
  }
}

function hasAdminModuleAccess(branding = window.BRANDING, employeeName) {
  try {
    if (!hasAuthenticatedTenantContext()) return false;
    if (isFirebaseRoleAuth(branding)) return isOfficeUser();
    if (isOfficeUser()) return true;

    if (!isProfileEmployeeAuth(branding)) return false;

    const activeProfile = String(
      employeeName !== undefined ? employeeName : readActiveEmployee(),
    ).trim();
    if (!activeProfile) return false;
    if (!isNamedProfileSession(activeProfile, branding)) return false;

    const allowed = resolveProfileAllowedTabIds(
      resolveProfileCapabilities(activeProfile, branding)?.allowedTabs || [],
    );
    return ['haccp', 'knowledge', 'wissen', 'batches', 'buero'].some((tabId) => allowed.has(tabId));
  } catch (err) {
    console.warn('[CharcuLogic Admin] Admin-Modul-Zugriff konnte nicht geprüft werden:', err);
    return false;
  }
}

function resolveProfileAllowedTabsForSession(employeeName, branding = window.BRANDING) {
  const capabilities = resolveProfileCapabilities(employeeName, branding);
  return capabilities?.allowedTabs || [];
}

function resolveProfileAllowedTabIds(allowedTabs = []) {
  return new Set(
    allowedTabs.map((tabId) => PROFILE_TAB_ALIASES[tabId] || tabId),
  );
}

function countVisibleBottomNavTabs() {
  let count = 0;
  document.querySelectorAll('.bottom-nav .nav-item[data-tab]').forEach((tab) => {
    if (tab.hidden || tab.style.display === 'none') return;
    count += 1;
  });
  return count;
}

function scrollActiveNavTabIntoView({ smooth = true } = {}) {
  const scrollEl = document.getElementById('bottom-nav-scroll');
  if (!scrollEl) return;
  const active = scrollEl.querySelector('.nav-item.active');
  if (!active || active.hidden || active.style.display === 'none') return;

  try {
    active.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto',
      block: 'nearest',
      inline: 'center',
    });
  } catch (_) {
    active.scrollIntoView(false);
  }
}

function syncBottomNavTabLayout() {
  const nav = document.getElementById('bottom-nav') || document.querySelector('.bottom-nav');
  if (!nav) return;

  const visibleCount = countVisibleBottomNavTabs();
  const scrollable = visibleCount > 3;

  nav.classList.toggle('bottom-nav--scrollable', scrollable);
  nav.classList.toggle('bottom-nav--compact', !scrollable);
  nav.classList.remove('bottom-nav--three-tabs', 'bottom-nav--five-tabs', 'bottom-nav--six-tabs');

  requestAnimationFrame(() => {
    scrollActiveNavTabIntoView({ smooth: false });
  });
}

window.scrollActiveNavTabIntoView = scrollActiveNavTabIntoView;

function isAdminHeaderModuleActive() {
  return document.body.classList.contains('admin-module-view');
}

function closeAdminHeaderDropdownMenu() {
  try {
    const dropdown = document.getElementById('admin-header-dropdown');
    const menu = document.getElementById('admin-header-dropdown-menu');
    const trigger = document.getElementById('admin-header-dropdown-btn');
    dropdown?.classList.remove('is-open');
    if (menu) menu.hidden = true;
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  } catch (err) {
    console.warn('[CharcuLogic Admin] Dropdown-Menü konnte nicht geschlossen werden:', err);
  }
}

function clearAdminModuleViewState() {
  try {
    document.body?.classList.remove('admin-module-view');
    document.querySelectorAll('.admin-header-dropdown-item').forEach((item) => {
      item.classList.remove('is-active');
    });
    closeAdminHeaderDropdownMenu();
  } catch (err) {
    console.warn('[CharcuLogic Admin] Admin-Modul-Ansicht konnte nicht zurückgesetzt werden:', err);
  }
}

function hideAdminHeaderDropdown() {
  try {
    const dropdown = document.getElementById('admin-header-dropdown');
    if (!dropdown) return;
    dropdown.hidden = true;
    dropdown.style.display = 'none';
    clearAdminModuleViewState();
  } catch (err) {
    console.warn('[CharcuLogic Admin] Admin-Dropdown konnte nicht ausgeblendet werden:', err);
  }
}

function syncAdminHeaderDropdown(branding = window.BRANDING) {
  try {
    const dropdown = document.getElementById('admin-header-dropdown');
    if (!dropdown) return;
    if (!hasAuthenticatedTenantContext()) {
      hideAdminHeaderDropdown();
      return;
    }
    const show = hasAdminModuleAccess(branding) && hasAnyAdminModuleEnabled(branding);
    dropdown.hidden = !show;
    dropdown.style.display = show ? '' : 'none';
    if (!show) {
      clearAdminModuleViewState();
    } else {
      syncAdminHeaderDropdownItems(branding);
    }
  } catch (err) {
    console.warn('[CharcuLogic Admin] Admin-Dropdown-Sichtbarkeit fehlgeschlagen:', err);
    hideAdminHeaderDropdown();
  }
}

function syncAdminHeaderDropdownItems(branding = window.BRANDING) {
  try {
    if (!hasAuthenticatedTenantContext() || !hasAdminModuleAccess(branding)) return;
    const itemModuleMap = {
      haccp: isTenantModuleEnabled('haccp', branding),
      knowledge: isTenantModuleEnabled('knowledge', branding),
      buero: isTenantModuleEnabled('buero', branding),
    };
    document.querySelectorAll('.admin-header-dropdown-item[data-admin-module]').forEach((item) => {
      const moduleKey = item.getAttribute('data-admin-module');
      const enabled = itemModuleMap[moduleKey] !== false;
      item.hidden = !enabled;
      item.style.display = enabled ? '' : 'none';
    });
  } catch (err) {
    console.warn('[CharcuLogic Admin] Admin-Dropdown-Einträge konnten nicht aktualisiert werden:', err);
  }
}

function hideAdminTabsFromBottomNav() {
  document.querySelectorAll('.nav-item[data-tab]').forEach((tab) => {
    const tabId = tab.getAttribute('data-tab');
    if (!ADMIN_HEADER_ONLY_TAB_IDS.has(tabId)) return;
    tab.hidden = true;
    tab.style.display = 'none';
  });
}

function applyProfileCapabilityTabFilter(branding = window.BRANDING) {
  if (!isProfileEmployeeAuth(branding)) return;

  const employeeName = readActiveEmployee();
  const allowedTabs = resolveProfileAllowedTabsForSession(employeeName, branding);
  if (!allowedTabs.length) return;

  const allowed = resolveProfileAllowedTabIds(allowedTabs);
  document.querySelectorAll('.nav-item[data-tab]').forEach((tab) => {
    if (tab.hidden) return;
    const tabId = tab.getAttribute('data-tab');
    if (!BOTTOM_NAV_TAB_IDS.has(tabId)) {
      tab.style.display = 'none';
      return;
    }
    tab.style.display = allowed.has(tabId) ? '' : 'none';
  });
  hideAdminTabsFromBottomNav();
  syncBottomNavTabLayout();
}

function isProfileKitchenReadOnly(branding = window.BRANDING) {
  if (!isProfileEmployeeAuth(branding)) return false;
  const capabilities = resolveProfileCapabilities(readActiveEmployee(), branding);
  return capabilities?.kitchenReadOnly === true;
}

function applyProfileKitchenRestrictions(branding = window.BRANDING) {
  const readOnly = isProfileKitchenReadOnly(branding);
  document.body.classList.toggle('profile-kitchen-readonly', readOnly);

  if (!isProfileEmployeeAuth(branding)) {
    document.body.classList.remove('profile-kitchen-readonly');
    return;
  }

  [
    '#btn-document-recipe-batch',
    '#kitchen-wrs-panel',
    '.production-input-card',
    '.production-log-card',
  ].forEach((selector) => {
    document.querySelectorAll(selector).forEach((element) => {
      element.hidden = readOnly;
    });
  });

  const readOnlyHint = document.getElementById('kitchen-readonly-hint');
  if (readOnly) {
    if (!readOnlyHint) {
      const recipesPanel = document.getElementById('kitchen-recipes-panel');
      if (recipesPanel) {
        const hint = document.createElement('p');
        hint.id = 'kitchen-readonly-hint';
        hint.className = 'kitchen-readonly-hint';
        hint.textContent = 'Rezeptansicht für Kundenberatung — Produktion und Chargen sind für dein Profil gesperrt.';
        recipesPanel.insertAdjacentElement('afterbegin', hint);
      }
    }
  } else {
    readOnlyHint?.remove();
  }
}

window.applyProfileKitchenRestrictions = applyProfileKitchenRestrictions;

function persistNamedProfileSession(employeeName, branding = window.BRANDING) {
  const cleanName = persistActiveEmployeeSession(employeeName);
  if (cleanName && isProfileEmployeeAuth(branding) && isNamedProfileSession(cleanName, branding)) {
    touchProfileLastActionTime();
  }
  if (cleanName && isAdvancedKaeseUpgradeEnabled(branding)) {
    applyRoleBasedUi(getAuthContext());
    void maybeShowBulletinAckInterceptor(cleanName, branding);
  }
  return cleanName;
}

function buildProfileSessionOverlayShell(cardNode) {
  const overlay = document.createElement('div');
  overlay.className = 'profile-session-overlay';
  const card = document.createElement('div');
  card.className = 'pin-auth-card profile-session-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.appendChild(cardNode);
  overlay.appendChild(card);
  return { overlay, card };
}

function mountProfileOtherNameForm(card, { mandatory = true, onBack, onPick }) {
  card.replaceChildren();

  const title = document.createElement('div');
  title.className = 'pin-auth-title';
  title.textContent = PROFILE_OTHER_LABEL;
  card.appendChild(title);

  const hint = document.createElement('p');
  hint.className = 'pin-auth-scan';
  hint.textContent = 'Bitte Namen eintragen – wir merken uns häufige Aushilfen auf diesem Gerät.';
  card.appendChild(hint);

  const guestNames = readProfileGuestNames();
  if (guestNames.length) {
    const guestList = document.createElement('div');
    guestList.className = 'profile-picker-list profile-guest-list';
    guestNames.forEach((name) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-secondary profile-picker-btn';
      btn.dataset.profileGuestName = name;
      btn.textContent = name;
      guestList.appendChild(btn);
    });
    card.appendChild(guestList);
  }

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'input-text-touch profile-other-input';
  input.placeholder = 'Name der Aushilfe';
  input.autocomplete = 'name';
  input.maxLength = 48;
  card.appendChild(input);

  const actions = document.createElement('div');
  actions.className = 'profile-gate-actions';

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = 'btn btn-primary profile-gate-btn';
  confirmBtn.dataset.profileOtherConfirm = '1';
  confirmBtn.textContent = 'Namen übernehmen';
  actions.appendChild(confirmBtn);

  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'btn btn-secondary profile-gate-btn';
  backBtn.dataset.profileOtherBack = '1';
  backBtn.textContent = 'Zurück zur Liste';
  actions.appendChild(backBtn);

  card.appendChild(actions);

  const pickName = (name) => {
    const cleanName = String(name || '').trim();
    if (!cleanName) {
      window.showToast?.('Bitte einen Namen eintragen.', 'warning');
      input.focus();
      return;
    }
    rememberProfileGuestName(cleanName);
    persistNamedProfileSession(cleanName);
    window.showToast?.(`Angemeldet als ${cleanName}`, 'success');
    onPick(cleanName);
  };

  card.onclick = (event) => {
    const guestName = event.target.closest('[data-profile-guest-name]')?.dataset.profileGuestName;
    if (guestName) {
      pickName(guestName);
      return;
    }
    if (event.target.closest('[data-profile-other-confirm]')) {
      pickName(input.value);
      return;
    }
    if (event.target.closest('[data-profile-other-back]')) {
      onBack();
    }
  };

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      pickName(input.value);
    }
  });

  input.focus();
}

function mountProfileEmployeePickerList(card, { mandatory = true, onPick, onOther, onLogout }) {
  card.replaceChildren();
  const employees = getSortedProfilePickerEmployees();

  const title = document.createElement('div');
  title.className = 'pin-auth-title';
  title.textContent = 'Profil wählen';
  card.appendChild(title);

  const hint = document.createElement('p');
  hint.className = 'pin-auth-scan';
  hint.textContent = mandatory
    ? 'Bitte auswählen, wer MHD und Wareneingang bearbeitet.'
    : 'Wer bearbeitet den Wareneingang?';
  card.appendChild(hint);

  const list = document.createElement('div');
  list.className = 'profile-picker-list';
  employees.forEach((name) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-primary profile-picker-btn';
    btn.dataset.profileName = name;
    btn.textContent = name;
    list.appendChild(btn);
  });

  const otherBtn = document.createElement('button');
  otherBtn.type = 'button';
  otherBtn.className = 'btn btn-secondary profile-picker-btn profile-picker-other';
  otherBtn.dataset.profileOther = '1';
  otherBtn.textContent = PROFILE_OTHER_LABEL;
  list.appendChild(otherBtn);
  card.appendChild(list);

  if (!mandatory) {
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-secondary profile-picker-cancel';
    cancelBtn.textContent = 'Abbrechen';
    card.appendChild(cancelBtn);
  }

  const logoutLink = document.createElement('button');
  logoutLink.type = 'button';
  logoutLink.className = 'profile-picker-logout-link';
  logoutLink.dataset.profileLogout = '1';
  logoutLink.textContent = 'Logout / Abmelden';
  card.appendChild(logoutLink);

  card.onclick = (event) => {
    const picked = event.target.closest('[data-profile-name]')?.dataset.profileName;
    if (picked) {
      persistNamedProfileSession(picked);
      window.showToast?.(`Angemeldet als ${picked}`, 'success');
      onPick(picked);
      return;
    }
    if (event.target.closest('[data-profile-other]')) {
      onOther();
      return;
    }
    if (event.target.closest('[data-profile-logout]')) {
      onLogout?.();
      return;
    }
    if (!mandatory && event.target.closest('.profile-picker-cancel')) {
      onPick('');
    }
  };

  list.querySelector('button')?.focus();
}

function openProfileEmployeePicker(options = {}) {
  const mandatory = options.mandatory !== false;

  return new Promise((resolve) => {
    if (!getSortedProfilePickerEmployees().length) {
      window.showToast?.('Keine Mitarbeiterprofile hinterlegt.', 'warning');
      resolve('');
      return;
    }

    document.getElementById('profile-picker-overlay')?.remove();

    const { overlay, card } = buildProfileSessionOverlayShell(document.createDocumentFragment());
    overlay.id = 'profile-picker-overlay';

    const close = (pickedName = '') => {
      overlay.remove();
      resolve(pickedName);
    };

    const showList = () => {
      mountProfileEmployeePickerList(card, {
        mandatory,
        onPick: (pickedName) => close(pickedName),
        onOther: () => {
          mountProfileOtherNameForm(card, {
            mandatory,
            onBack: showList,
            onPick: (pickedName) => close(pickedName),
          });
        },
        onLogout: () => {
          close('');
          clearProfileSession();
          void logoutTenant().catch((err) => {
            console.warn('[CharcuLogic Auth] logoutTenant aus Profil-Modal fehlgeschlagen:', err);
          });
        },
      });
    };

    showList();
    document.body.appendChild(overlay);
  });
}

function resolveTerminalAuthEmail(branding = window.BRANDING) {
  const fromBranding = String(branding?.terminalAuth?.email || '').trim();
  if (fromBranding) return fromBranding;
  const tenantId = getGlobalTenantId() || window.resolveEffectiveTenantId?.() || '';
  if (isSteveshofTenantId(tenantId)) return STEVESHOF_TERMINAL_EMAIL;
  return '';
}

async function ensureTenantFirebaseAuth(branding = window.BRANDING) {
  const tenantId = getGlobalTenantId() || getTenantId() || window.resolveEffectiveTenantId?.() || '';
  if (!tenantId) return false;

  if (isAuthLoopBreakerActive()) {
    enforceAuthLoopBreakerShell();
    await ensureFirebaseAuthForTenant(tenantId, {
      terminalEmail: resolveTerminalAuthEmail(branding),
      skipAutoRestore: true,
    });
    return false;
  }

  return ensureFirebaseAuthForTenant(tenantId, {
    terminalEmail: resolveTerminalAuthEmail(branding),
  });
}

function resolveInventoryTenantId() {
  return canonicalTenantId(
    getGlobalTenantId() || getTenantId() || window.resolveEffectiveTenantId?.() || '',
  );
}

function resolveInventoryStorageTenantKey() {
  return normalizeTenantId(resolveInventoryTenantId());
}

function isInventoryWriteReady(branding = window.BRANDING) {
  const tenantId = resolveInventoryTenantId();
  if (!tenantId || !isFirebaseAuthActiveForTenant(tenantId)) return false;
  if (isFirebaseRoleAuth(branding)) return Boolean(getAuthContext()?.uid);
  if (!isProfileEmployeeAuth(branding)) return true;
  return isNamedProfileSession(readActiveEmployee(), branding);
}

async function ensureInventoryProfileReadyForWrite(branding = window.BRANDING) {
  if (isFirebaseRoleAuth(branding)) {
    const tenantId = resolveInventoryTenantId();
    if (!tenantId) {
      window.showToast?.('Betriebs-Kontext fehlt. Bitte erneut anmelden.', 'warning');
      return false;
    }
    if (!isFirebaseAuthActiveForTenant(tenantId)) {
      window.showToast?.('Bitte zuerst anmelden.', 'warning');
      return false;
    }
    syncFirebaseEmployeeSession(getAuthContext());
    return true;
  }

  if (!isProfileEmployeeAuth(branding)) return true;

  const tenantId = resolveInventoryTenantId();
  if (!tenantId) {
    window.showToast?.('Betriebs-Kontext fehlt. Bitte Geräte-Zugang erneut bestätigen.', 'warning');
    return false;
  }

  let employeeName = readScopedLocalStorageValue(
    ACTIVE_EMPLOYEE_STORAGE_KEY,
    normalizeTenantId(tenantId),
  );
  const firebaseReady = await ensureTenantFirebaseAuth(branding);
  if (!firebaseReady) {
    window.showToast?.(
      'Betriebs-Anmeldung fehlt. Bitte den Geräte-Zugang am Laden-iPhone bestätigen.',
      'warning',
    );
    return false;
  }

  if (!isInventoryWriteReady(branding)) {
    const picked = employeeName || await requireProfileSessionForInventory();
    if (!picked || !isInventoryWriteReady(branding)) {
      window.showToast?.('Bitte zuerst dein Profil für den Wareneingang wählen.', 'warning');
      return false;
    }
    persistActiveEmployeeSession(picked);
    return true;
  }

  if (employeeName) {
    persistActiveEmployeeSession(employeeName);
  }

  expireProfileSessionIfIdle(branding);
  purgeInvalidProfileSession(branding);
  if (!isInventoryWriteReady(branding)) {
    window.showToast?.('Bitte zuerst dein Profil für den Wareneingang wählen.', 'warning');
    return false;
  }
  return true;
}

async function requireProfileSessionForInventory(options = {}) {
  const branding = window.BRANDING || {};
  if (!isProfileEmployeeAuth(branding)) {
    return ensureEmployeeSessionForProtectedArea(branding) || readActiveEmployee();
  }

  const firebaseReady = await ensureTenantFirebaseAuth(branding);
  if (!firebaseReady) {
    window.showToast?.(
      'Betriebs-Anmeldung fehlt. Bitte den Geräte-Zugang am Laden-iPhone bestätigen.',
      'warning',
    );
    return '';
  }

  purgeInvalidProfileSession(branding);
  expireProfileSessionIfIdle(branding);

  const current = readActiveEmployee();
  if (isNamedProfileSession(current, branding) && options.forcePicker !== true) {
    return current;
  }

  const picked = await openProfileEmployeePicker({ mandatory: true });
  return picked || '';
}

function showReceivingProfileGatekeeper(employeeName) {
  return new Promise((resolve) => {
    const cleanName = String(employeeName || '').trim();
    if (!cleanName) {
      resolve('skip');
      return;
    }

    document.getElementById('receiving-profile-gate-overlay')?.remove();

    const body = document.createDocumentFragment();
    const title = document.createElement('div');
    title.className = 'pin-auth-title';
    title.textContent = 'MHD-Wareneingang aktiv';
    body.appendChild(title);

    const hint = document.createElement('p');
    hint.className = 'pin-auth-scan';
    hint.textContent = `Angemeldet als: ${cleanName}`;
    body.appendChild(hint);

    const actions = document.createElement('div');
    actions.className = 'profile-gate-actions';

    const continueBtn = document.createElement('button');
    continueBtn.type = 'button';
    continueBtn.className = 'btn btn-primary profile-gate-btn';
    continueBtn.dataset.gateAction = 'continue';
    continueBtn.textContent = `Weiter als ${cleanName}`;
    actions.appendChild(continueBtn);

    const switchBtn = document.createElement('button');
    switchBtn.type = 'button';
    switchBtn.className = 'btn btn-secondary profile-gate-btn';
    switchBtn.dataset.gateAction = 'switch';
    switchBtn.textContent = 'Neu anmelden / Wechseln';
    actions.appendChild(switchBtn);

    const logoutBtn = document.createElement('button');
    logoutBtn.type = 'button';
    logoutBtn.className = 'btn btn-secondary profile-gate-btn';
    logoutBtn.dataset.gateAction = 'logout';
    logoutBtn.textContent = 'Abmelden';
    actions.appendChild(logoutBtn);

    body.appendChild(actions);

    const { overlay } = buildProfileSessionOverlayShell(body);
    overlay.id = 'receiving-profile-gate-overlay';

    const finish = (action) => {
      overlay.remove();
      resolve(action);
    };

    overlay.addEventListener('click', (event) => {
      const action = event.target.closest('[data-gate-action]')?.dataset.gateAction;
      if (!action) return;
      if (action === 'continue') {
        touchProfileLastActionTime();
        finish('continue');
        return;
      }
      if (action === 'logout') {
        clearProfileSession();
        void (async () => {
          overlay.remove();
          await requireProfileSessionForInventory({ forcePicker: true });
          finish('logout');
        })();
        return;
      }
      if (action === 'switch') {
        void (async () => {
          overlay.remove();
          clearProfileSession();
          await requireProfileSessionForInventory({ forcePicker: true });
          finish('switch');
        })();
      }
    });

    document.body.appendChild(overlay);
    continueBtn.focus();
  });
}

async function showReceivingProfileGatekeeperIfNeeded() {
  try {
    if (!isProfileEmployeeAuth()) return;
    const employeeName = await requireProfileSessionForInventory();
    if (!employeeName) return;
    await showReceivingProfileGatekeeper(employeeName);
  } catch (err) {
    console.warn('[CharcuLogic Profile] Wareneingang-Gatekeeper konnte nicht geöffnet werden:', err);
  }
}

async function ensureEmployeeSessionForProtectedAreaAsync(branding = window.BRANDING) {
  if (isProfileEmployeeAuth(branding)) {
    const firebaseReady = await ensureTenantFirebaseAuth(branding);
    if (!firebaseReady) return '';
    expireProfileSessionIfIdle(branding);
    purgeInvalidProfileSession(branding);
    const teamLoginCard = document.getElementById('team-login-card');
    if (teamLoginCard) teamLoginCard.hidden = true;
    const current = readActiveEmployee();
    return isNamedProfileSession(current, branding) ? current : '';
  }
  return ensureEmployeeSessionForProtectedArea(branding);
}

async function ensureInventoryProfileSessionForTab(tabId = AppState.activeTab) {
  if (!isProfileEmployeeAuth()) return readActiveEmployee();
  if (!INVENTORY_PROFILE_TABS.has(tabId)) {
    await ensureEmployeeSessionForProtectedAreaAsync();
    return readActiveEmployee();
  }
  return requireProfileSessionForInventory();
}

function resolveTeamSessionName(branding = window.BRANDING) {
  const betriebsName = String(branding?.betriebsName || 'Betrieb').trim();
  const shortName = betriebsName.split(/\s+/)[0] || betriebsName;
  return `Team ${shortName}`;
}

function persistActiveEmployeeSession(employeeName) {
  const cleanName = String(employeeName || '').trim();
  if (!cleanName) return '';
  try {
    writeScopedLocalStorageValue(
      ACTIVE_EMPLOYEE_STORAGE_KEY,
      resolveInventoryStorageTenantKey(),
      cleanName,
    );
    localStorage.removeItem(ACTIVE_EMPLOYEE_STORAGE_KEY);
  } catch (err) {
    console.warn('[CharcuLogic Session] Team-Sitzung konnte nicht gespeichert werden:', err);
  }
  window.dispatchEvent(new CustomEvent('charculogic:active-employee-changed', {
    detail: { employeeName: cleanName },
  }));
  updateEmployeeSessionBadge(cleanName);
  return cleanName;
}

function configureTeamSessionWithoutPin(branding = window.BRANDING) {
  const employeeName = resolveTeamSessionName(branding);
  const teamLoginCard = document.getElementById('team-login-card');
  if (teamLoginCard) teamLoginCard.hidden = true;
  return persistActiveEmployeeSession(employeeName);
}

function ensureEmployeeSessionForProtectedArea(branding = window.BRANDING) {
  expireProfileSessionIfIdle(branding);

  const teamLoginCard = document.getElementById('team-login-card');

  if (isProfileEmployeeAuth(branding)) {
    if (teamLoginCard) teamLoginCard.hidden = true;
    purgeInvalidProfileSession(branding);
    const tenantId = getGlobalTenantId() || getTenantId() || window.resolveEffectiveTenantId?.() || '';
    if (!isFirebaseAuthActiveForTenant(tenantId)) {
      void ensureTenantFirebaseAuth(branding);
      return '';
    }
    const current = readActiveEmployee();
    if (isNamedProfileSession(current, branding)) {
      return current;
    }
    return '';
  }

  if (!isEmployeePinRequired(branding)) {
    if (teamLoginCard) teamLoginCard.hidden = true;
    return configureTeamSessionWithoutPin(branding);
  }
  if (teamLoginCard && document.documentElement.dataset.fixedTerminal !== 'steveshof') {
    teamLoginCard.hidden = false;
  }
  return readActiveEmployee();
}

window.isEmployeePinRequired = isEmployeePinRequired;
window.isFirebaseRoleAuth = isFirebaseRoleAuth;
window.isProfileEmployeeAuth = isProfileEmployeeAuth;
window.resolveFirebaseEmployeeName = resolveFirebaseEmployeeName;
window.syncFirebaseEmployeeSession = syncFirebaseEmployeeSession;
window.resolveTeamSessionName = resolveTeamSessionName;
window.ensureEmployeeSessionForProtectedArea = ensureEmployeeSessionForProtectedArea;
window.touchProfileLastActionTime = touchProfileLastActionTime;
window.expireProfileSessionIfIdle = expireProfileSessionIfIdle;
window.showReceivingProfileGatekeeperIfNeeded = showReceivingProfileGatekeeperIfNeeded;
window.openProfileEmployeePicker = openProfileEmployeePicker;
window.requireProfileSessionForInventory = requireProfileSessionForInventory;
window.ensureInventoryProfileSessionForTab = ensureInventoryProfileSessionForTab;
window.ensureEmployeeSessionForProtectedAreaAsync = ensureEmployeeSessionForProtectedAreaAsync;
window.ensureTenantFirebaseAuth = ensureTenantFirebaseAuth;
window.ensureInventoryProfileReadyForWrite = ensureInventoryProfileReadyForWrite;
window.isInventoryWriteReady = isInventoryWriteReady;
window.readActiveEmployee = readActiveEmployee;
window.persistActiveEmployeeSession = persistActiveEmployeeSession;
window.isFirebaseAuthActiveForTenant = isFirebaseAuthActiveForTenant;
window.isNamedProfileSession = isNamedProfileSession;

function isFirestorePermissionDeniedError(err) {
  const code = String(err?.code || '').toLowerCase();
  const raw = String(err?.message || err || '').toLowerCase();
  return code.includes('permission-denied')
    || code === 'permission-denied'
    || raw.includes('missing or insufficient permissions')
    || raw.includes('permission_denied');
}

function isAuthLocalStorageKey(key = '') {
  const cleanKey = String(key || '').trim();
  if (!cleanKey) return false;
  return AUTH_LOCAL_STORAGE_MARKERS.some(
    (marker) => cleanKey === marker || cleanKey.endsWith(`_${marker}`),
  );
}

function clearAllAuthLocalStorage() {
  try {
    const keys = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key) keys.push(key);
    }
    keys.forEach((key) => {
      if (isAuthLocalStorageKey(key)) {
        localStorage.removeItem(key);
      }
    });
  } catch (err) {
    console.warn('[CharcuLogic Auth] Auth-LocalStorage konnte nicht geleert werden:', err);
  }
}

function clearTenantProfileLocalStorage(tenantId = '') {
  const tenant = normalizeTenantId(
    tenantId
    || (typeof getGlobalTenantId === 'function' ? getGlobalTenantId() : '')
    || (typeof getTenantId === 'function' ? getTenantId() : '')
    || resolveEarlyTenantId(),
  );

  if (tenant) {
    clearTeamboardTenantStorage(tenant);
    try {
      localStorage.removeItem(scopedTeamboardStorageKey(PROFILE_LAST_ACTION_STORAGE_KEY, tenant));
      localStorage.removeItem(scopedTeamboardStorageKey(PROFILE_GUEST_NAMES_KEY, tenant));
      localStorage.removeItem(scopedTeamboardStorageKey(TERMINAL_DEVICE_TOKEN_KEY, tenant));
    } catch (_) { /* noop */ }
  }

  try {
    localStorage.removeItem(ACTIVE_EMPLOYEE_STORAGE_KEY);
  } catch (_) { /* noop */ }
}

let authPermissionResetInFlight = false;

async function awaitFirebaseAuthSignOut(options = {}) {
  const shutdownOptions = {
    clearPersistence: options.clearPersistence === true,
  };

  try {
    try {
      await logoutTenant(shutdownOptions);
      return;
    } catch (err) {
      const message = String(err?.message || '');
      if (!message.includes('nicht geladen') && !message.includes('nicht initialisiert')) {
        console.warn('[CharcuLogic Auth] logoutTenant beim SignOut fehlgeschlagen:', err);
      }
    }

    await shutdownFirestoreClient(shutdownOptions);

    if (typeof firebase === 'undefined') return;
    if (!firebase.apps?.length) {
      if (!isFirebaseConfigValid(toFirebaseSdkConfig(firebaseConfig))) return;
      ensureFirebaseApp(firebase);
    }
    await firebase.auth().signOut();
  } catch (err) {
    console.warn('[CharcuLogic Auth] Firebase signOut fehlgeschlagen:', err);
  }
}

let lastPermissionDeniedResetAt = 0;

async function resetAuthStateOnPermissionDenied(err, context = '') {
  if (!isFirestorePermissionDeniedError(err)) return;
  console.warn('[CharcuLogic Auth] Firestore-Zugriff verweigert — kein Auto-Logout', {
    context,
    code: err?.code,
    message: err?.message,
    tenantId: getGlobalTenantId(),
  });
  window.showToast?.('Speichern nicht erlaubt. Bitte im Büro Bescheid geben.', 'error');
}

window.isFirestorePermissionDeniedError = isFirestorePermissionDeniedError;
window.hasActiveFirebaseAuthUser = hasActiveFirebaseAuthUser;
window.resetAuthStateOnPermissionDenied = resetAuthStateOnPermissionDenied;
window.tenantIdsMatch = tenantIdsMatch;

function isSteveshofTenantId(tenantId = '') {
  return String(tenantId || '').trim().toLowerCase() === STEVESHOF_TENANT_ID.toLowerCase();
}

export {
  getGlobalTenantId,
  getTenantCollection,
  getTenantCollectionPath,
  setGlobalTenantId,
} from './tenant-db.js';

// ============================================================================
// GLOBALE UI-HILFSFUNKTIONEN (vor allen Modulen und IIFEs definiert)
// ============================================================================

function showToast(message, type = "success") {
  const toastType = ['success', 'warning', 'error'].includes(type) ? type : 'success';
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${toastType}`;
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('toast-visible'));
  setTimeout(() => {
    toast.classList.remove('toast-visible');
    toast.classList.add('toast-hiding');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    setTimeout(() => toast.remove(), 500);
  }, 3000);
}
window.showToast = showToast;

function toastTypeFromMessage(title = '', desc = '', icon = '') {
  const text = `${title} ${desc} ${icon}`.toLowerCase();
  if (text.includes('fehler') || text.includes('gesperrt') || text.includes('nicht gesichert') || text.includes('blockiert')) return 'error';
  if (text.includes('offline') || text.includes('warn') || text.includes('warteschlange') || text.includes('pr?fen') || text.includes('pruefen')) return 'warning';
  return 'success';
}

function showHUD(title, desc, icon) {
  const parts = [title, desc].filter(Boolean);
  showToast(parts.join(': '), toastTypeFromMessage(title, desc, icon));
}
window.showHUD = showHUD;

function showAdminDevHint(title, desc = '') {
  let hint = document.getElementById('admin-dev-hint');
  if (!hint) {
    hint = document.createElement('div');
    hint.id = 'admin-dev-hint';
    hint.className = 'admin-dev-hint';
    document.body.appendChild(hint);
  }
  hint.textContent = title;
  hint.title = desc || title;
  hint.setAttribute('role', 'status');
  hint.setAttribute('aria-label', desc ? `${title}: ${desc}` : title);
}

function applyBrandingCssVars(branding) {
  const root = document.documentElement;
  const setVar = (name, value) => {
    if (value) root.style.setProperty(name, value);
  };
  setVar('--primary-color', branding.primaryColor);
  setVar('--primary-color-hover', branding.primaryColorHover);
  setVar('--dark-header-bg', branding.darkHeaderBg);
  setVar('--accent-alert', branding.accentAlert);
  const headerText = branding.textOnHeader || '#ffffff';
  setVar('--header-text', headerText);
  const isLightHeader = headerText.toLowerCase() === '#000000' || headerText.toLowerCase() === '#000';
  setVar('--header-text-muted', isLightHeader ? 'rgba(0, 0, 0, 0.62)' : 'rgba(255, 255, 255, 0.72)');
  setVar('--nav-text', isLightHeader ? 'rgba(0, 0, 0, 0.55)' : 'rgba(255, 255, 255, 0.65)');
}

function applyBranding() {
  const branding = window.BRANDING || {};
  const appName = branding.appName || 'CharcuLogic';
  const betriebsName = branding.betriebsName || 'Betriebs-Leitstand';
  const primaryColor = branding.primaryColor || '#28a745';

  applyBrandingCssVars(branding);

  document.querySelectorAll('.brand-app-name').forEach((el) => { el.textContent = appName; });
  document.querySelectorAll('.brand-betriebs-name').forEach((el) => { el.textContent = betriebsName; });
  document.querySelectorAll('.auth-lock-brand').forEach((el) => { el.textContent = appName; });

  const authTagline = `Betriebs-Login · ${appName} lädt die Mandantendaten für dieses Gerät.`;
  document.querySelectorAll('.auth-lock-tagline').forEach((el) => { el.textContent = authTagline; });

  const titleEl = document.querySelector('title');
  const titleSuffix = titleEl?.dataset?.brandTitleSuffix ?? '';
  document.title = `${appName}${titleSuffix}`;

  const appleTitleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (appleTitleMeta) appleTitleMeta.setAttribute('content', appName);

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.setAttribute('content', primaryColor);
}
window.applyBranding = applyBranding;

function isWurstkuecheEnabledForTenant(tenantId = '', branding = window.BRANDING || {}) {
  const normalizedTenantId = String(tenantId || '').trim().toLowerCase();
  return normalizedTenantId !== 'torfabrik' && branding.modules?.wurstkueche !== false;
}

window.applyModuleVisibility = applyModuleVisibility;

function applyModuleVisibility(branding = window.BRANDING || {}) {
  const modules = branding.modules || {};
  const kitchenEnabled = isTenantModuleEnabled('kitchen', branding);
  const tabModuleMap = {
    teamboard: modules.teamboard !== false,
    team: modules.team !== false
      && (modules.team === true || modules.orders !== false || modules.haccp !== false || modules.teamboard !== false),
    mhd: isTenantModuleEnabled('mhd', branding),
    receiving: isTenantModuleEnabled('receiving', branding),
    traceability: isTenantModuleEnabled('traceability', branding),
    kitchen: kitchenEnabled,
    haccp: isTenantModuleEnabled('haccp', branding),
    knowledge: isTenantModuleEnabled('knowledge', branding),
    cuts: modules.cutGlossary === true,
    batches: isTenantModuleEnabled('buero', branding),
  };
  document.querySelectorAll('.nav-item[data-tab]').forEach((tab) => {
    const tabId = tab.getAttribute('data-tab');
    if (ADMIN_HEADER_ONLY_TAB_IDS.has(tabId)) {
      tab.hidden = true;
      tab.style.display = 'none';
      return;
    }
    const enabled = tabModuleMap[tabId] !== false;
    tab.hidden = !enabled;
    tab.style.display = enabled ? '' : 'none';
  });

  const kitchenPage = document.getElementById('page-kitchen');
  if (kitchenPage) {
    kitchenPage.hidden = !kitchenEnabled;
    if (!kitchenEnabled) {
      kitchenPage.classList.remove('active');
      kitchenPage.style.display = 'none';
    }
  }

  if (typeof applyReceivingMetzgereiVisibility === 'function') {
    applyReceivingMetzgereiVisibility(branding);
  }

  syncBottomNavTabLayout();
  try {
    syncAdminHeaderDropdown(branding);
  } catch (err) {
    console.warn('[CharcuLogic Admin] Admin-Dropdown nach Modul-Sichtbarkeit fehlgeschlagen:', err);
    hideAdminHeaderDropdown();
  }

  const rezeptAuditEnabled = modules.rezeptAudit !== false;
  const auditCard = document.getElementById('recipe-cloud-audit-card');
  if (auditCard) {
    auditCard.hidden = !rezeptAuditEnabled;
    auditCard.style.display = rezeptAuditEnabled ? '' : 'none';
  }
}

function resolveFirebaseEmployeeAllowedTabs(authSession) {
  const allowed = authSession?.profile?.allowedModules
    || authSession?.claims?.allowedModules
    || null;
  if (!allowed || typeof allowed !== 'object') {
    return new Set(['mhd', 'receiving', 'traceability']);
  }
  const tabs = new Set(['traceability']);
  if (allowed.mhd !== false) tabs.add('mhd');
  if (allowed.kitchen !== false) tabs.add('kitchen');
  if (allowed.buero !== false) tabs.add('batches');
  return tabs;
}

function applyRoleBasedUi(authSession) {
  const isHelper = authSession?.isHelper || isHelperUser();
  const isOffice = isOfficeUser(authSession);
  const firebaseRoleAuth = isFirebaseRoleAuth(window.BRANDING || {});
  document.documentElement.dataset.userRole = authSession?.role || 'user';
  document.body.classList.toggle('role-helper', isHelper);
  document.body.classList.toggle('role-office', isOffice);
  document.body.classList.toggle('role-employee', !isHelper && !isOffice && authSession?.role === 'employee');
  document.body.classList.toggle('role-firebase-auth', firebaseRoleAuth);
  document.body.classList.toggle('role-admin', authSession?.role === 'admin');

  const helperHiddenTabs = new Set(['team', 'receiving', 'kitchen', 'haccp', 'knowledge', 'cuts', 'batches']);
  const firebaseEmployeeTabs = resolveFirebaseEmployeeAllowedTabs(authSession);

  document.querySelectorAll('.nav-item[data-tab]').forEach((tab) => {
    if (tab.hidden) return;
    const tabId = tab.getAttribute('data-tab');
    if (!BOTTOM_NAV_TAB_IDS.has(tabId)) {
      tab.style.display = 'none';
      return;
    }
    if (firebaseRoleAuth && authSession?.role === 'employee' && !isOffice) {
      tab.style.display = firebaseEmployeeTabs.has(tabId) ? '' : 'none';
      return;
    }
    const hideForHelper = isHelper && helperHiddenTabs.has(tabId);
    tab.style.display = hideForHelper ? 'none' : '';
  });

  if (firebaseRoleAuth) {
    const teamLoginCard = document.getElementById('team-login-card');
    if (teamLoginCard) teamLoginCard.hidden = true;
  }

  ['btn-master-data', 'btn-delivery-note-ai', 'office-tools-panel'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.hidden = !isOffice;
  });

  const saveMhdBar = document.querySelector('#page-mhd .sticky-action-bar');
  if (saveMhdBar) saveMhdBar.hidden = isHelper;

  const teamHub = document.getElementById('page-team');
  if (teamHub) teamHub.classList.toggle('role-helper-hidden', isHelper);

  applyModuleVisibility(window.BRANDING || {});
  applyProfileCapabilityTabFilter();
  applyProfileKitchenRestrictions();
  syncBottomNavTabLayout();
  try {
    if (hasAuthenticatedTenantContext(authSession)) {
      syncAdminHeaderDropdown(window.BRANDING || {});
    } else {
      hideAdminHeaderDropdown();
    }
  } catch (err) {
    console.warn('[CharcuLogic Admin] Admin-Dropdown während Rollen-UI fehlgeschlagen:', err);
    hideAdminHeaderDropdown();
  }
  refreshWrsMeatPriceAdminButton();
  updateMhdAdminSearchVisibility(isOffice);
  updateOfficeAccessLock();
  syncRecipeAdminFormVisibility();
}

function setOfficeLoginError(message = '') {
  const errorEl = document.getElementById('office-login-error');
  if (!errorEl) return;
  const text = String(message || '').trim();
  errorEl.textContent = text;
  errorEl.hidden = !text;
}

function updateOfficeAccessLock() {
  const lock = document.getElementById('office-access-lock');
  const content = document.getElementById('office-access-content');
  const onBatchesTab = AppState.activeTab === 'batches';
  const showLock = onBatchesTab && !isOfficeUser() && !isHelperUser();

  if (lock) {
    lock.hidden = !showLock;
    lock.classList.toggle('hidden', !showLock);
    lock.setAttribute('aria-hidden', showLock ? 'false' : 'true');
  }
  if (content) {
    content.hidden = showLock;
    content.setAttribute('aria-hidden', showLock ? 'true' : 'false');
  }
  if (!showLock) setOfficeLoginError('');
}

function bindOfficeAccessLock() {
  const form = document.getElementById('office-login-form');
  const backBtn = document.getElementById('office-lock-back-btn');
  if (form && form.dataset.officeLockBound !== '1') {
    form.dataset.officeLockBound = '1';
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      setOfficeLoginError('');
      const email = document.getElementById('office-login-email')?.value.trim();
      const password = document.getElementById('office-login-password')?.value || '';
      const submitBtn = form.querySelector('.office-access-lock-submit');
      if (submitBtn) submitBtn.disabled = true;
      try {
        await loginTenant(email, password);
        const ctx = getAuthContext();
        if (!isOfficeUser(ctx)) {
          setOfficeLoginError('Dieses Konto hat keinen Büro-Zugang. Bitte Admin-Zugangsdaten verwenden.');
          return;
        }
        applyRoleBasedUi(ctx);
        refreshTeamboardAdminPanel();
        refreshAdminTeamConfigPanel();
        activateBatchesTab();
        window.showToast?.('Büro-Bereich freigeschaltet.', 'success');
        form.reset();
      } catch (err) {
        console.warn('[CharcuLogic Büro] Admin-Anmeldung fehlgeschlagen:', err);
        const code = String(err?.code || '');
        if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
          setOfficeLoginError('Anmeldung fehlgeschlagen. E-Mail oder Passwort prüfen.');
        } else {
          setOfficeLoginError('Anmeldung fehlgeschlagen. Bitte Zugangsdaten prüfen.');
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }
  if (backBtn && backBtn.dataset.officeLockBound !== '1') {
    backBtn.dataset.officeLockBound = '1';
    backBtn.addEventListener('click', () => {
      setOfficeLoginError('');
      document.getElementById('tab-mhd')?.click();
    });
  }
}

// --- DARK MODE ---
(function initTheme() {
  const THEME_KEY = 'charculogic.theme';
  const saved = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = saved ? saved === 'dark' : prefersDark;

  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  const btn = document.getElementById('btn-theme-toggle');
  if (btn) btn.textContent = isDark ? '☀️' : '🌙';

  btn?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(THEME_KEY, next);
    btn.textContent = next === 'dark' ? '☀️' : '🌙';
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (localStorage.getItem(THEME_KEY)) return;
    const theme = e.matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
  });
})();

// ============================================================================
// FIREBASE / FIRESTORE (White-Label Mandanten-Architektur)
// ============================================================================

const appsScriptWebAppUrl = 'https://script.google.com/macros/s/AKfycbzzSzR4isL2meZGxsA5tMJ7ShPko47T6I7n_izcAWQ3FgIdajKaMUE2Nw_H9fu9H3RI/exec';


const firebaseConfig = resolveFirebaseConfig();

let db = null;
let firebaseReady = false;

initSyncEngine({
  getDatabase: () => db,
  isFirebaseReady: () => firebaseReady,
  getFirebase: () => firebase,
  getTenantId: () => getGlobalTenantId() || getTenantId(),
  appsScriptWebAppUrl,
  showHUD,
});

function isFirebaseConfigValid(config) {
  if (!config || typeof config !== 'object') return false;
  const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
  const placeholderPatterns = [/^YOUR_/i, /^\.\.\.$/, /^$/, /^undefined$/i, /^null$/i];
  return requiredKeys.every((key) => {
    const value = config[key];
    if (typeof value !== 'string') {
      console.error(`[CharcuLogic Firebase] Config-Feld "${key}" fehlt oder ist kein String.`);
      return false;
    }
    if (placeholderPatterns.some((pattern) => pattern.test(value.trim()))) {
      console.error(`[CharcuLogic Firebase] Config-Feld "${key}" enthält noch Platzhalter-Wert: "${value}"`);
      return false;
    }
    return true;
  });
}

async function handleAuthUrlResetIfRequested() {
  const params = new URLSearchParams(window.location.search);
  const shouldLogout = params.get('logout') === 'true';
  const shouldReset = params.get('reset') === 'true';
  if (!shouldLogout && !shouldReset) return false;

  console.warn('[CharcuLogic Auth] URL-Reset ausgelöst — Auth-Daten werden bereinigt.', {
    logout: shouldLogout,
    reset: shouldReset,
  });
  activateAuthLoopBreaker();
  clearAllAuthLocalStorage();
  await awaitFirebaseAuthSignOut({ clearPersistence: shouldReset });

  const cleanUrl = `${window.location.origin}${window.location.pathname}${window.location.hash || ''}`;
  window.location.replace(cleanUrl);
  return true;
}

function initFirebase() {
  if (firebaseReady && db) return true;
  if (typeof firebase === 'undefined') {
    console.error('[CharcuLogic Firebase] Firebase SDK nicht geladen. Prüfe die Script-Tags in index.html.');
    return false;
  }
  if (!isFirebaseConfigValid(toFirebaseSdkConfig(firebaseConfig))) {
    console.error('[CharcuLogic Firebase] Ungültige firebaseConfig – bitte echte Projekt-Credentials eintragen.');
    return false;
  }
  try {
    ensureFirebaseApp(firebase);
    assertFirebaseProjectIsolation(firebase);
    if (isLocalFirebaseEmulatorHost()) {
      attachLocalFirebaseEmulators(firebase);
    }
    db = firebase.firestore();
    initTenantDb(db);
    if (typeof firebase.auth === 'function') {
      firebase.auth();
    }
    if (typeof firebase.functions === 'function') {
      getRegionalFunctions(firebase);
      console.log(`[CharcuLogic Functions] Base-URL: ${resolveFunctionsBaseUrl()}`);
    }
    db.enablePersistence().catch((err) => {
      console.warn('Firestore Persistence Error:', err.code);
    });
    firebaseReady = true;
    const modeLabel = isLocalFirebaseEmulatorHost() ? 'Emulator' : 'Cloud';
    console.log(
      `[CharcuLogic Firebase] Verbunden mit Projekt "${firebaseConfig.projectId}" `
      + `(${resolveFirebaseProjectKey()}, ${modeLabel}).`,
    );
    return true;
  } catch (err) {
    console.error('[CharcuLogic Firebase] Initialisierung fehlgeschlagen:', err);
    db = null;
    firebaseReady = false;
    return false;
  }
}

function bootstrapFirebaseCore() {
  const ok = initFirebase();
  if (!ok) {
    throw new Error('Firebase-Core konnte nicht initialisiert werden.');
  }
  return true;
}

const firebaseCoreReadyPromise = Promise.resolve().then(() => bootstrapFirebaseCore());
registerFirebaseCoreReady(firebaseCoreReadyPromise);

async function waitForFirebaseCore() {
  await firebaseCoreReadyPromise;
}







// State-Management für den Web-Prototypen
const AppState = {
  activeTab: 'mhd',
  wetHandsMode: false,
};

const wrsState = {
  engine: null,
  initialized: false,
  baseData: null,
  fleischpreiseUnsubscribe: null,
  priceSource: 'fallback',
};

const wrsMeatPriceState = {
  inFlight: false,
  bound: false,
};

function canAdminTriggerMeatPrices() {
  const ctx = getAuthContext();
  return ctx?.role === 'admin';
}

function refreshWrsMeatPriceAdminButton() {
  const btn = document.getElementById('wrs-meat-price-update-btn');
  if (!btn) return;
  btn.style.display = canAdminTriggerMeatPrices() ? 'inline-block' : 'none';
}

function setWrsMeatPriceButtonLoading(loading) {
  const btn = document.getElementById('wrs-meat-price-update-btn');
  if (!btn) return;

  wrsMeatPriceState.inFlight = loading;
  btn.disabled = loading;
  btn.classList.toggle('is-loading', loading);

  const label = btn.querySelector('.wrs-meat-price-update-label');
  if (!label) return;

  if (!btn.dataset.defaultLabel) {
    btn.dataset.defaultLabel = label.textContent.trim();
  }
  label.textContent = loading ? 'Lädt Preise...' : btn.dataset.defaultLabel;
}

function formatMeatPriceRunError(error) {
  return logAndMapOperatorError(error, 'meat-prices');
}

async function callTriggerManualMeatPriceRun() {
  if (!firebaseReady || typeof firebase === 'undefined') {
    throw new Error('Firebase ist nicht bereit.');
  }
  if (typeof firebase.functions !== 'function') {
    throw new Error('Firebase Functions SDK nicht geladen.');
  }

  await waitForAppCheckReady();
  const callable = createHttpsCallable('triggerManualMeatPriceRun', { timeout: 120000 }, firebase);
  const result = await callable({});
  return result?.data;
}

function bindWrsMeatPriceUpdateButton() {
  const btn = document.getElementById('wrs-meat-price-update-btn');
  if (!btn || wrsMeatPriceState.bound) return;
  wrsMeatPriceState.bound = true;

  btn.addEventListener('click', async () => {
    if (wrsMeatPriceState.inFlight) return;
    if (!canAdminTriggerMeatPrices()) {
      showToast('Nur Admins dürfen Fleischpreise manuell aktualisieren.', 'error');
      return;
    }

    const confirmed = confirm(
      'Möchtest du die Marktpreise für Fleisch wirklich JETZT live abfragen und die aktuellen Wochenwerte überschreiben?',
    );
    if (!confirmed) return;

    playClickSound(700, 0.04, 0.1);
    setWrsMeatPriceButtonLoading(true);
    setWrsStatus('Preise…', 'ok');

    try {
      await callTriggerManualMeatPriceRun();
      showToast('Marktpreise erfolgreich aktualisiert!', 'success');
      subscribeFleischpreise();
      setWrsStatus('Bereit', 'ok');
    } catch (err) {
      console.error('[CharcuLogic WRS] Fleischpreis-Lauf fehlgeschlagen:', err);
      showToast(formatMeatPriceRunError(err), 'error');
      setWrsStatus('Fehler', 'error');
    } finally {
      setWrsMeatPriceButtonLoading(false);
    }
  });
}

async function loadWrsFallbackData() {
  const response = await fetch('/data/beffe_data.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

function resolveFleischpreiseTenantId() {
  return getGlobalTenantId() || getTenantId();
}

function applyFleischpreiseSnapshot(snapshot, sourceLabel = 'cloud') {
  if (!wrsState.engine) return false;
  const docs = snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    data: docSnap.data(),
  }));
  const latest = pickLatestFleischpreiseDoc(docs);
  const prices = latest?.data?.prices || latest?.data?.preise;
  if (!Array.isArray(prices) || prices.length === 0) return false;

  wrsState.engine.applyLiveMeatPrices(prices, {
    docId: latest.id,
    kw: latest.data?.kw || latest.id,
    fetchedAt: latest.data?.fetchedAt,
    source: sourceLabel,
  });
  wrsState.priceSource = sourceLabel;
  setWrsStatus(`KW ${latest.data?.kw || latest.id}`, 'ok');
  calculateAndRenderWrs();
  return true;
}

function subscribeFleischpreise() {
  void (async () => {
    try {
      await waitForFirebaseCore();
    } catch (err) {
      console.warn('[CharcuLogic WRS] Firebase-Core nicht bereit — Fleischpreise-Listener übersprungen:', err);
      return;
    }
    if (!firebaseReady || !db) return;
    const tenantId = resolveFleischpreiseTenantId();
    if (!tenantId) return;

    wrsState.fleischpreiseUnsubscribe?.();
    wrsState.fleischpreiseUnsubscribe = null;

    let collectionRef;
    try {
      collectionRef = getTenantCollection('fleischpreise');
    } catch (err) {
      console.warn('[CharcuLogic WRS] Fleischpreise-Listener ohne Mandant:', err);
      return;
    }

    wrsState.fleischpreiseUnsubscribe = collectionRef.onSnapshot(
    (snapshot) => {
      if (snapshot.empty) return;
      applyFleischpreiseSnapshot(snapshot, `cloud:${tenantId}`);
    },
    (err) => {
      if (isFirestorePermissionDeniedError(err)) {
        void resetAuthStateOnPermissionDenied(err, 'subscribeFleischpreise');
        return;
      }
      console.warn(`[CharcuLogic WRS] Fleischpreise-Listener (${tenantId}) fehlgeschlagen:`, err);
      if (wrsState.priceSource === 'fallback') {
        setWrsStatus('Offline (Fallback)', 'error');
      }
    },
  );
  })();
}

function setWrsStatus(text, type = 'ok') {
  const status = document.getElementById('wrs-status-pill');
  if (!status) return;
  status.textContent = text;
  status.classList.toggle('is-error', type === 'error');
}

function setWrsWarning(warnings) {
  const warningBox = document.getElementById('wrs-warning-box');
  if (!warningBox) return;
  if (!warnings?.length) {
    warningBox.hidden = true;
    warningBox.textContent = '';
    return;
  }
  warningBox.hidden = false;
  warningBox.textContent = warnings.join(' ');
}

function renderWrsMetrics(result) {
  const totals = result?.totals || {};
  const values = {
    'wrs-total-cost': `${formatNumber(totals.totalCost)} EUR`,
    'wrs-cost-per-kg': `${formatNumber(totals.costPerKg)} EUR`,
    'wrs-beffe-percent': `${formatNumber(totals.beffeProzent)} %`,
    'wrs-fat-percent': `${formatNumber(totals.fettProzent)} %`,
    'wrs-water-percent': `${formatNumber(totals.wasserProzent)} %`,
  };

  Object.entries(values).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  });
}

function renderWrsPacklist(result) {
  const body = document.getElementById('wrs-packlist-body');
  if (!body) return;
  body.innerHTML = '';

  result.ingredients.forEach((ingredient) => {
    const row = document.createElement('tr');
    const material = document.createElement('td');
    const kg = document.createElement('td');
    const gram = document.createElement('td');
    const cost = document.createElement('td');

    material.textContent = ingredient.material;
    kg.textContent = formatNumber(ingredient.amountKg, 3);
    gram.textContent = formatNumber(ingredient.amountG, 0);
    cost.textContent = formatNumber(ingredient.cost);

    row.append(material, kg, gram, cost);
    body.appendChild(row);
  });
}

function calculateAndRenderWrs() {
  if (!wrsState.engine) return;
  const select = document.getElementById('recipe-select');
  const targetWeight = document.getElementById('target-weight');
  const recipeName = select?.value || '';
  const targetKg = targetWeight?.value || 0;
  if (!recipeName) return;

  try {
    const result = wrsState.engine.calculateCharge(recipeName, targetKg);
    renderWrsMetrics(result);
    renderWrsPacklist(result);
    setWrsWarning(result.warnings);
    setWrsStatus(result.warnings.length ? 'Warnung' : 'Bereit', result.warnings.length ? 'error' : 'ok');
  } catch (err) {
    setWrsStatus('Fehler', 'error');
    setWrsWarning([err?.message || 'Berechnung fehlgeschlagen.']);
  }
}

function populateWrsRecipeSelect() {
  const select = document.getElementById('recipe-select');
  if (!select || !wrsState.engine) return;
  const names = wrsState.engine.getRecipeNames();
  select.innerHTML = '';

  if (names.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Keine aktiven Rezepte';
    select.appendChild(option);
    setWrsStatus('Leer', 'error');
    return;
  }

  names.forEach((name) => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  });
}

async function initWrsModule() {
  if (wrsState.initialized) return;
  wrsState.initialized = true;
  try {
    const beffeData = await loadWrsFallbackData();
    wrsState.baseData = beffeData;
    wrsState.engine = new BeffeCalcEngine(beffeData);
    wrsState.priceSource = 'fallback';
    populateWrsRecipeSelect();

    document.getElementById('recipe-select')?.addEventListener('change', calculateAndRenderWrs);
    document.getElementById('target-weight')?.addEventListener('input', calculateAndRenderWrs);
    document.getElementById('btn-calculate-wrs')?.addEventListener('click', () => {
      playClickSound(900, 0.04, 0.12);
      calculateAndRenderWrs();
    });

    bindWrsMeatPriceUpdateButton();
    refreshWrsMeatPriceAdminButton();

    calculateAndRenderWrs();
    setWrsStatus('Fallback', 'ok');

    if (firebaseReady && db) {
      subscribeFleischpreise();
    }
  } catch (err) {
    console.error('[CharcuLogic WRS] BEFFE-Daten konnten nicht geladen werden:', err);
    setWrsStatus('Offline', 'error');
    setWrsWarning(['BEFFE-Daten konnten nicht geladen werden.']);
  }
}

// Globaler Entwurfs-Schutz: verhindert Datenverlust bei Idle-Reload
const GLOBAL_DRAFT_KEY = 'charculogic.global.ui_draft';
const SENSITIVE_CONTAINERS = ['pin-auth-modal', 'meister-override-modal', 'login-overlay', 'auth-login-overlay'];
let isUiDirty = false;

function markDirty() {
  isUiDirty = true;
}

function readDraftStore() {
  try {
    const raw = localStorage.getItem(GLOBAL_DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (!draft?.fields || Date.now() - (draft.ts || 0) > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(GLOBAL_DRAFT_KEY);
      return null;
    }
    return draft;
  } catch (_) { return null; }
}

function writeDraftStore(fields) {
  try {
    if (!fields || Object.keys(fields).length === 0) {
      localStorage.removeItem(GLOBAL_DRAFT_KEY);
      return;
    }
    localStorage.setItem(GLOBAL_DRAFT_KEY, JSON.stringify({ ts: Date.now(), fields }));
  } catch (_) { /* quota exceeded */ }
}

function clearDirty(consumedFieldIds) {
  isUiDirty = false;
  if (!consumedFieldIds || consumedFieldIds.length === 0) {
    try { localStorage.removeItem(GLOBAL_DRAFT_KEY); } catch (_) { /* noop */ }
    return;
  }
  const draft = readDraftStore();
  if (!draft) return;
  for (const id of consumedFieldIds) delete draft.fields[id];
  writeDraftStore(draft.fields);
}

function isSensitiveElement(el) {
  if (el.type === 'password') return true;
  for (const containerId of SENSITIVE_CONTAINERS) {
    if (el.closest(`#${containerId}`)) return true;
  }
  return false;
}

function snapshotFormFields() {
  const container = document.getElementById('app-content');
  if (!container) return;
  const snapshot = {};
  container.querySelectorAll('input, textarea, select').forEach((el) => {
    const key = el.id || el.name;
    if (!key) return;
    if (isSensitiveElement(el)) return;
    if (el.type === 'checkbox' || el.type === 'radio') {
      snapshot[key] = { v: el.checked, t: el.type };
    } else {
      if (!el.value && el.value !== '0') return;
      snapshot[key] = { v: el.value, t: el.type || el.tagName.toLowerCase() };
    }
  });
  if (Object.keys(snapshot).length === 0) return;
  writeDraftStore(snapshot);
}

function restoreDraftFields(fieldIds) {
  const draft = readDraftStore();
  if (!draft) return 0;
  let restored = 0;
  const idsToCheck = fieldIds || Object.keys(draft.fields);
  for (const key of idsToCheck) {
    const entry = draft.fields[key];
    if (!entry) continue;
    const el = document.getElementById(key) || document.querySelector(`[name="${key}"]`);
    if (!el) continue;
    if (entry.t === 'checkbox' || entry.t === 'radio') {
      el.checked = !!entry.v;
    } else {
      el.value = entry.v ?? '';
    }
    restored++;
  }
  if (restored > 0) {
    isUiDirty = true;
    console.info(`[CharcuLogic Draft] ${restored} Formularfeld(er) aus Entwurf wiederhergestellt.`);
  }
  return restored;
}

document.getElementById('app-content')?.addEventListener('input', (e) => {
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') markDirty();
}, { passive: true });

// Web Audio API für Taktiles Feedback (Haptik)
let audioCtx = null;

function playClickSound(frequency = 1200, duration = 0.04, volume = 0.12) {
  try {
    // Initialisiere AudioContext beim ersten Klick
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    // Kurzer, knackiger "Klick"-Ton
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + duration + 0.02);
  } catch (e) {
    console.warn("Audio Haptik fehlgeschlagen: ", e);
  }
}

function ensureAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

// iOS/Safari: AudioContext nach erster User-Interaktion freischalten
document.addEventListener('click', function unlockAudio() {
  ensureAudioContext();
  document.removeEventListener('click', unlockAudio);
}, { once: true });

async function unlockAudioForIos() {
  try {
    const ctx = ensureAudioContext();
    if (ctx?.state === 'suspended') await ctx.resume();
  } catch (err) {
    console.warn('[CharcuLogic Audio] Unlock fehlgeschlagen:', err);
  }
}

['pointerdown', 'touchstart'].forEach((eventName) => {
  document.addEventListener(eventName, unlockAudioForIos, { once: true, passive: true });
});

function playFeedbackSound(type) {
  try {
    const ctx = ensureAudioContext();
    const now = ctx.currentTime;

    if (type === 'success') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(1100, now + 0.06);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.17);
    } else if (type === 'unknown') {
      [0, 0.2].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, now + offset);
        gain.gain.setValueAtTime(0, now + offset);
        gain.gain.linearRampToValueAtTime(0.2, now + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.18);
        osc.start(now + offset);
        osc.stop(now + offset + 0.2);
      });
    } else if (type === 'alarm') {
      [0, 0.18, 0.36].forEach((offset, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'square';
        const freq = i === 2 ? 900 : 700;
        osc.frequency.setValueAtTime(freq, now + offset);
        gain.gain.setValueAtTime(0, now + offset);
        gain.gain.linearRampToValueAtTime(0.15, now + offset + 0.02);
        gain.gain.setValueAtTime(0.15, now + offset + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.15);
        osc.start(now + offset);
        osc.stop(now + offset + 0.17);
      });
    }
  } catch (e) {
    console.warn('[CharcuLogic Audio] Feedback-Sound fehlgeschlagen:', e);
  }
}

// Zeitaktualisierung in der Statusleiste
function updateStatusTime() {
  const timeEl = document.getElementById('status-time');
  if (timeEl) {
    const now = new Date();
    const hrs = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    timeEl.textContent = `${hrs}:${mins}`;
  }
}
setInterval(updateStatusTime, 10000);
updateStatusTime();

// Tab-Umschaltung
const tabs = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');
const appContent = document.getElementById('app-content');
const headerTitle = document.getElementById('header-title');
const headerSubtitle = document.getElementById('header-subtitle');
const headerLogoutBtn = document.getElementById('header-logout-btn');
const employeeSessionBadge = document.getElementById('employee-session-badge');
const employeeSessionName = document.getElementById('employee-session-name');

function activeEmployeeStorageKey() {
  return scopedTeamboardStorageKey(
    ACTIVE_EMPLOYEE_STORAGE_KEY,
    normalizeTenantId(getGlobalTenantId() || getTenantId()),
  );
}

function updateHeaderLogoutVisibility(activeTab) {
  if (!headerLogoutBtn) return;
  const isFixedTerminal = document.documentElement.dataset.fixedTerminal === 'steveshof';
  if (isFirebaseRoleAuth()) {
    headerLogoutBtn.style.display = !isFixedTerminal ? 'inline-block' : 'none';
    return;
  }
  headerLogoutBtn.style.display = !isFixedTerminal && activeTab === 'batches' ? 'inline-block' : 'none';
}

function readActiveEmployee() {
  try {
    return readScopedLocalStorageValue(
      ACTIVE_EMPLOYEE_STORAGE_KEY,
      resolveInventoryStorageTenantKey(),
    );
  } catch (_) {
    return '';
  }
}

function updateEmployeeSessionBadge(employeeName = readActiveEmployee()) {
  if (!employeeSessionBadge || !employeeSessionName) return;
  if (!employeeName) {
    employeeSessionBadge.style.display = 'none';
    employeeSessionName.textContent = '';
    return;
  }
  const firstName = String(employeeName).trim().split(/\s+/)[0] || employeeName;
  employeeSessionName.textContent = `👤 ${firstName}`;
  employeeSessionBadge.style.display = 'inline-flex';
}

const DESKTOP_WIDE_PAGES = new Set(['page-knowledge', 'page-batches', 'page-buero', 'page-dev-dashboard']);

function syncDesktopWideLayout(pageId) {
  const activeId = pageId || document.querySelector('.page.active')?.id || '';
  const isDevDashboard = activeId === 'page-dev-dashboard' || document.body.classList.contains('dev-dashboard-view');
  document.body.classList.toggle(
    'desktop-wide-layout',
    (DESKTOP_WIDE_PAGES.has(activeId) || isDevDashboard) && window.matchMedia('(min-width: 1024px)').matches,
  );
}

window.syncDesktopWideLayout = syncDesktopWideLayout;

function showPage(pageId) {
  pages.forEach((page) => {
    const isTarget = page.id === pageId;
    page.classList.toggle('active', isTarget);
    // Defensive inline display handling: avoids rare stale layout states
    // where .active class exists but page still does not paint.
    page.style.display = isTarget ? 'block' : 'none';
  });
  syncDesktopWideLayout(pageId);
}

window.addEventListener('resize', () => syncDesktopWideLayout());

const ADMIN_DROPDOWN_MODULES = {
  haccp: {
    tabId: 'haccp',
    pageId: 'page-haccp',
    title: 'HACCP-Protokoll',
    subtitle: 'Tageskontrollen',
    activate: () => activateHaccpTab(),
  },
  knowledge: {
    tabId: 'knowledge',
    pageId: 'page-knowledge',
    title: 'Wissen',
    subtitle: 'Handbücher & Fleisch-Lexikon',
    activate: () => activateCutGlossaryTab(),
  },
  buero: {
    tabId: 'batches',
    pageId: 'page-batches',
    title: 'Chargen-Archiv',
    subtitle: 'Büro & Rückverfolgung',
    activate: () => {
      activateBatchesTab();
      refreshTeamboardAdminPanel();
      refreshAdminTeamConfigPanel();
    },
  },
};

function setAdminDropdownActiveItem(moduleKey = '') {
  document.querySelectorAll('.admin-header-dropdown-item').forEach((item) => {
    item.classList.toggle('is-active', item.getAttribute('data-admin-module') === moduleKey);
  });
}

async function openAdminDropdownModule(moduleKey) {
  try {
    if (!hasAuthenticatedTenantContext() || !hasAdminModuleAccess()) return false;
    const moduleConfig = ADMIN_DROPDOWN_MODULES[moduleKey];
    if (!moduleConfig) return false;

    const targetTab = moduleConfig.tabId;
    expireProfileSessionIfIdle();
    if (PIN_PROTECTED_TABS.has(targetTab) && !isFirebaseRoleAuth()) {
      await ensureEmployeeSessionForProtectedAreaAsync();
    }

    playClickSound(800, 0.05, 0.15);
    clearAdminModuleViewState();
    document.body.classList.add('admin-module-view');
    setAdminDropdownActiveItem(moduleKey);

    tabs.forEach((navTab) => navTab.classList.remove('active'));
    AppState.activeTab = targetTab;

    showPage(moduleConfig.pageId);
    if (headerTitle) headerTitle.textContent = moduleConfig.title;
    if (headerSubtitle) headerSubtitle.textContent = moduleConfig.subtitle;

    try {
      moduleConfig.activate();
    } catch (err) {
      console.error(`[CharcuLogic Admin] Aktivierung fehlgeschlagen für "${moduleKey}":`, err);
      window.showToast?.(`Bereich "${moduleConfig.title}" wurde geöffnet, Teilfunktionen konnten nicht geladen werden.`, 'warning');
    }

    if (appContent) {
      appContent.scrollTop = 0;
      requestAnimationFrame(() => { appContent.scrollTop = 0; });
    }
    updateScannerButtonVisibility();
    updateHeaderLogoutVisibility(targetTab);
    updateOfficeAccessLock();
    return true;
  } catch (err) {
    console.warn(`[CharcuLogic Admin] Modul "${moduleKey}" konnte nicht geöffnet werden:`, err);
    return false;
  }
}

function bindAdminHeaderDropdown() {
  try {
    const dropdown = document.getElementById('admin-header-dropdown');
    const trigger = document.getElementById('admin-header-dropdown-btn');
    const menu = document.getElementById('admin-header-dropdown-menu');
    if (!dropdown || !trigger || !menu) return;
    hideAdminHeaderDropdown();
    if (dropdown.dataset.bound === '1') return;
    dropdown.dataset.bound = '1';

    trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      if (!hasAuthenticatedTenantContext() || !hasAdminModuleAccess()) {
        hideAdminHeaderDropdown();
        return;
      }
      const willOpen = menu.hidden;
      closeAdminHeaderDropdownMenu();
      if (!willOpen) return;
      dropdown.classList.add('is-open');
      menu.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
    });

    menu.querySelectorAll('.admin-header-dropdown-item').forEach((item) => {
      item.addEventListener('click', async (event) => {
        event.stopPropagation();
        if (!hasAuthenticatedTenantContext() || !hasAdminModuleAccess()) {
          hideAdminHeaderDropdown();
          return;
        }
        const moduleKey = item.getAttribute('data-admin-module');
        if (!moduleKey) return;
        await openAdminDropdownModule(moduleKey);
        closeAdminHeaderDropdownMenu();
      });
    });

    document.addEventListener('click', (event) => {
      if (!dropdown.contains(event.target)) {
        closeAdminHeaderDropdownMenu();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeAdminHeaderDropdownMenu();
    });
  } catch (err) {
    console.warn('[CharcuLogic Admin] Dropdown-Bindung fehlgeschlagen:', err);
    hideAdminHeaderDropdown();
  }
}
bindAdminHeaderDropdown();

function showTab(tabId) {
  const adminModuleKey = {
    haccp: 'haccp',
    knowledge: 'knowledge',
    cuts: 'knowledge',
    batches: 'buero',
    buero: 'buero',
  }[tabId] || '';
  if (adminModuleKey && hasAdminModuleAccess()) {
    void openAdminDropdownModule(adminModuleKey);
    return true;
  }
  const tab = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
  if (!tab || tab.hidden || tab.style.display === 'none') return false;
  tab.click();
  return true;
}
window.showTab = showTab;

function resolveEarlyTenantId() {
  try {
    if (typeof window.resolveEffectiveTenantId === 'function') {
      return normalizeTenantId(window.resolveEffectiveTenantId());
    }
    return normalizeTenantId(localStorage.getItem('charculogic_cached_tenant_id') || '');
  } catch (err) {
    console.warn('[CharcuLogic Bootstrap] Gespeicherter Mandant konnte nicht gelesen werden:', err);
    return '';
  }
}

function applyEarlyTenantShell() {
  const tenantKey = resolveEarlyTenantId() || normalizeTenantId(STEVESHOF_TENANT_ID);
  if (!isSteveshofTenantId(tenantKey)) return;
  const firestoreTenantId = STEVESHOF_TENANT_ID;
  if (typeof window.applyResolvedBranding === 'function') {
    window.applyResolvedBranding(firestoreTenantId);
  } else {
    applyBranding();
  }
  setGlobalTenantId(firestoreTenantId);
  applyModuleVisibility(window.BRANDING);
  applyRoleBasedUi({
    tenantId: firestoreTenantId,
    role: 'employee',
    isAdmin: false,
    isHelper: false,
  });
  configureSteveshofTerminalSession({
    tenantId: firestoreTenantId,
    email: STEVESHOF_TERMINAL_EMAIL,
  });
  purgeInvalidProfileSession(window.BRANDING);
  showTab('mhd');
}

function isSteveshofTerminalSession(authSession) {
  return tenantIdsMatch(authSession?.tenantId, STEVESHOF_TENANT_ID)
    && String(authSession?.email || '').trim().toLowerCase() === STEVESHOF_TERMINAL_EMAIL;
}

function configureSteveshofTerminalSession(authSession) {
  if (!isSteveshofTerminalSession(authSession)) return '';
  document.documentElement.dataset.fixedTerminal = 'steveshof';
  updateHeaderLogoutVisibility(AppState.activeTab);
  purgeInvalidProfileSession(window.BRANDING);
  return readActiveEmployee();
}

window.addEventListener('charculogic:active-employee-changed', (event) => {
  const employeeName = event.detail?.employeeName || readActiveEmployee();
  updateEmployeeSessionBadge(employeeName);
  if (isProfileEmployeeAuth() && isNamedProfileSession(employeeName)) {
    touchProfileLastActionTime();
    applyRoleBasedUi(getAuthContext());
    applyProfileKitchenRestrictions();
    if (isAdvancedKaeseUpgradeEnabled()) {
      void maybeShowBulletinAckInterceptor(employeeName);
    }
  }
  if (AppState.activeTab === 'receiving') {
    refreshReceivingTabUiSafe();
  }
});

if (employeeSessionBadge) {
  employeeSessionBadge.style.cursor = 'pointer';
  employeeSessionBadge.setAttribute('role', 'button');
  employeeSessionBadge.setAttribute('tabindex', '0');
  employeeSessionBadge.setAttribute('aria-label', 'Profil wechseln');
  employeeSessionBadge.addEventListener('click', () => {
    if (!isProfileEmployeeAuth()) return;
    void openProfileEmployeePicker({ mandatory: false });
  });
  employeeSessionBadge.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    employeeSessionBadge.click();
  });
}

tabs.forEach(tab => {
  tab.addEventListener('click', async () => {
    const targetTab = tab.getAttribute('data-tab');
    if (tab.hidden || tab.style.display === 'none') {
      return;
    }
    if (isAdminHeaderModuleActive()) {
      clearAdminModuleViewState();
    }
    if (targetTab === 'kitchen' && !isTenantModuleEnabled('kitchen')) {
      showToast('Das Produktionsmodul ist für diesen Betrieb nicht freigeschaltet.', 'warning');
      return;
    }
    expireProfileSessionIfIdle();
    if (!isFirebaseRoleAuth()) {
      if (PIN_PROTECTED_TABS.has(targetTab) || INVENTORY_PROFILE_TABS.has(targetTab)) {
        await ensureEmployeeSessionForProtectedAreaAsync();
      }
      if (INVENTORY_PROFILE_TABS.has(targetTab)) {
        await ensureInventoryProfileSessionForTab(targetTab);
      }
    }
    AppState.activeTab = targetTab;

    // Haptischer Klick (tiefere Frequenz für Nav-Tabs)
    playClickSound(800, 0.05, 0.15);

    // Navigationselemente aktualisieren
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    scrollActiveNavTabIntoView({ smooth: true });

    // Seite + Header immer zuerst stabil umschalten
    if (targetTab === 'teamboard') {
      showPage('page-teamboard');
      headerTitle.textContent = "Start";
      headerSubtitle.textContent = "Aufgaben & Tagesinfo";
    } else if (targetTab === 'team') {
      showPage('page-team');
      headerTitle.textContent = "Team";
      headerSubtitle.textContent = "Nachrichten & Bestellungen";
    } else if (targetTab === 'mhd') {
      showPage('page-mhd');
      headerTitle.textContent = "MHD-Monitor";
      headerSubtitle.textContent = "Qualitätssicherung";
    } else if (targetTab === 'receiving') {
      showPage('page-receiving');
      headerTitle.textContent = "Wareneingang";
      headerSubtitle.textContent = "Lieferung erfassen";
    } else if (targetTab === 'traceability') {
      showPage('page-traceability');
      headerTitle.textContent = "Herkunft";
      headerSubtitle.textContent = "LMIV-Erfassung";
    } else if (targetTab === 'kitchen') {
      showPage('page-kitchen');
      headerTitle.textContent = "Wurstküche";
      headerSubtitle.textContent = "Produktion";
    } else if (targetTab === 'haccp') {
      showPage('page-haccp');
      headerTitle.textContent = "HACCP-Protokoll";
      headerSubtitle.textContent = "Tageskontrollen";
    } else if (targetTab === 'knowledge') {
      showPage('page-knowledge');
      headerTitle.textContent = "Wissen";
      headerSubtitle.textContent = "Handbücher & Fleisch-Lexikon";
    } else if (targetTab === 'cuts') {
      showPage('page-knowledge');
      headerTitle.textContent = "Wissen";
      headerSubtitle.textContent = "Handbücher & Fleisch-Lexikon";
    } else if (targetTab === 'batches') {
      showPage('page-batches');
      headerTitle.textContent = "Chargen-Archiv";
      headerSubtitle.textContent = "Büro & Rückverfolgung";
    } else {
      showPage('page-teamboard');
      headerTitle.textContent = "Schwarzes Brett";
      headerSubtitle.textContent = "Team & Aufgaben";
    }

    // Modul-Aktivierung defensiv: bei Fehler nicht auf Start zurückspringen.
    try {
      if (targetTab === 'teamboard') activateTeamboardTab();
      if (targetTab === 'team') activateTeamHubTab();
      if (targetTab === 'mhd') await activateMhdTab();
      if (targetTab === 'receiving') await activateReceivingTab();
      if (targetTab === 'traceability') activateTraceabilityTab();
      if (targetTab === 'kitchen') activateKitchenTab();
      if (targetTab === 'haccp') activateHaccpTab();
      if (targetTab === 'knowledge') activateCutGlossaryTab();
      if (targetTab === 'cuts') activateCutGlossaryTab();
      if (targetTab === 'batches') {
        activateBatchesTab();
        refreshTeamboardAdminPanel();
        refreshAdminTeamConfigPanel();
      }
    } catch (err) {
      console.error(`[CharcuLogic Tabs] Aktivierung fehlgeschlagen für "${targetTab}":`, err);
      window.showToast?.(`Tab "${targetTab}" wurde geöffnet, Teilfunktionen konnten nicht geladen werden.`, 'warning');
    }

    // Shared scroll container retains old offset between tabs.
    // Reset both immediately and next frame for iOS momentum edge-cases.
    if (appContent) {
      appContent.scrollTop = 0;
      requestAnimationFrame(() => { appContent.scrollTop = 0; });
    }
    updateScannerButtonVisibility();
    updateHeaderLogoutVisibility(targetTab);
    updateOfficeAccessLock();
  });
});

let tenantModulesUnsubscribe = null;

function bindTenantModuleConfigListener(tenantId) {
  if (!tenantId || isDevDashboardRoute()) return;
  if (tenantModulesUnsubscribe) tenantModulesUnsubscribe();
  tenantModulesUnsubscribe = subscribeTenantEnabledModules(db, tenantId, () => {
    applyModuleVisibility(window.BRANDING);
    try {
      syncAdminHeaderDropdown(window.BRANDING);
    } catch (_) {
      hideAdminHeaderDropdown();
    }
    refreshRetterBoxModule();
  });
}

window.addEventListener('popstate', () => {
  if (!isDevDashboardRoute()) return;
  // initDevDashboard prüft die Admin-Rolle selbst und zeigt ggf. die
  // Desktop-Fehlermeldung — kein Redirect mehr in die mobile Ansicht.
  const user = firebase?.auth?.()?.currentUser;
  void initDevDashboard(db, { currentUser: user, authContext: getAuthContext() });
});

function startTenantLiveDataListeners() {
  void (async () => {
    try {
      await waitForFirebaseCore();
    } catch (err) {
      console.warn('[CharcuLogic Sync] Live-Listener ohne Firebase-Core übersprungen:', err);
      return;
    }
    if (!canStartFirestoreLiveListeners(firebase)) return;
    startMhdLiveSync();
    startHaccpLiveSync();
  })();
}

window.canStartFirestoreLiveListeners = () => canStartFirestoreLiveListeners(firebase);
window.startTenantLiveDataListeners = startTenantLiveDataListeners;

async function startAppShell() {
  try {
    await waitForFirebaseCore();
  } catch (err) {
    console.error('[CharcuLogic Bootstrap] Firebase-Core nicht bereit — UI-Shell wartet:', err);
    return;
  }
  if (await handleAuthUrlResetIfRequested()) return;
  applyEarlyTenantShell();
  if (typeof window.applyResolvedBranding === 'function') {
    window.applyResolvedBranding(window.resolveEffectiveTenantId?.());
  } else if (typeof window.applyBranding === 'function') {
    window.applyBranding();
  }
  syncBottomNavTabLayout();
  updateHeaderLogoutVisibility(AppState.activeTab);
  purgeInvalidProfileSession(window.BRANDING);
  expireProfileSessionIfIdle(window.BRANDING);
  updateEmployeeSessionBadge();
  if (isAuthLoopBreakerActive()) {
    hideAppShellForAuthLockdown();
  }
}

if (!EMERGENCY_LOGOUT_REQUESTED) void startAppShell();

const SYNC_STATUS = {
  online: 'ONLINE',
  saving: 'SPEICHERT',
  saved: 'GESPEICHERT',
  offline: 'OFFLINE',
  error: 'SYNC-FEHLER',
};

function updateOnlineStatusUi(isOnline) {
  const badge = document.querySelector('.app-badge');
  if (badge) {
    badge.textContent = isOnline ? SYNC_STATUS.online : SYNC_STATUS.offline;
    badge.classList.toggle('sync-error', !isOnline);
  }
  updateSyncIndicator();
}
window.updateOnlineStatusUi = updateOnlineStatusUi;

window.addEventListener('online', () => {
  refreshSyncConnectivityUi();
  flushPendingSyncs();
  flushErrorTelemetry();
});
window.addEventListener('offline', () => {
  refreshSyncConnectivityUi();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    closeScanner();
    audioCtx?.suspend?.();
    if (isUiDirty) {
      snapshotFormFields();
      console.info('[CharcuLogic Draft] Globaler Formular-Snapshot gespeichert (App geht in den Hintergrund).');
    }
    if (updateAvailable && !isUiDirty) {
      console.info('[CharcuLogic SW] Idle-Reload: App im Hintergrund, keine Eingaben offen.');
      window.location.reload();
    } else if (updateAvailable && isUiDirty) {
      console.info('[CharcuLogic SW] Idle-Reload blockiert: Formulardaten offen (isUiDirty).');
    }
    return;
  }
  refreshSyncConnectivityUi();
  flushPendingSyncs();
  flushErrorTelemetry();
});

window.addEventListener('pagehide', () => {
  closeScanner();
  if (isUiDirty) snapshotFormFields();
});

function setSyncStatus(statusKey) {
  const badge = document.querySelector('.app-badge');
  if (!badge) return;
  badge.textContent = SYNC_STATUS[statusKey] || 'METZGEREI PRO';
  badge.classList.toggle('sync-error', statusKey === 'error' || statusKey === 'offline');
  updateSyncIndicator();
}

function formatQueueAge(ts) {
  const ageMs = Math.max(0, Date.now() - Number(ts || 0));
  const min = Math.floor(ageMs / 60000);
  if (min < 1) return '<1 min';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m}m`;
}

function showSyncQueueDialog() {
  const pending = getPendingSyncs();
  const dead = getDeadPendingSyncs();
  document.getElementById('sync-queue-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'sync-queue-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1200;display:flex;align-items:flex-end;justify-content:center;padding:12px;';

  const pendingRows = pending.length
    ? pending.map((item) => `
      <div style="padding:8px 0;border-bottom:1px solid #e5e7eb;">
        <div style="font-weight:700;font-size:12px;">${item._op || 'update'} · ${item._docId || 'ohne-id'}</div>
        <div style="font-size:11px;color:#4b5563;">${item._collectionPath || 'ohne-pfad'} · Alter ${formatQueueAge(item._queuedAt)} · Versuche ${item._attempts || 0}</div>
        ${item._lastError ? `<div style="font-size:11px;color:#7f1d1d;margin-top:2px;">${item._lastError}${item._errorCode ? ` (${item._errorCode})` : ''}</div>` : ''}
      </div>
    `).join('')
    : '<div style="font-size:12px;color:#4b5563;padding:8px 0;">Keine wartenden Einträge.</div>';

  const deadRows = dead.length
    ? dead.slice(-8).reverse().map((item) => `
      <div style="padding:8px 0;border-bottom:1px solid #e5e7eb;">
        <div style="font-weight:700;font-size:12px;">${item._op || 'update'} · ${item._docId || 'ohne-id'}</div>
        <div style="font-size:11px;color:#7f1d1d;">${item._collectionPath || 'ohne-pfad'} · ${(item._errorCode || item._lastError || 'unbekannter Fehler')}</div>
      </div>
    `).join('')
    : '<div style="font-size:12px;color:#4b5563;padding:8px 0;">Keine Einträge, die Hilfe brauchen.</div>';

  overlay.innerHTML = `
    <div style="width:min(560px,100%);max-height:80vh;overflow:auto;background:#fff;border-radius:16px;padding:14px;box-shadow:0 -4px 22px rgba(0,0,0,.2);">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;">
        <h3 style="margin:0;font-size:16px;">Wartende Änderungen</h3>
        <button type="button" id="sync-queue-close" class="btn btn-secondary" style="min-height:36px;">Schließen</button>
      </div>
      <div style="margin-bottom:10px;">
        <div style="font-weight:800;font-size:12px;text-transform:uppercase;color:#374151;">Wartend (${pending.length})</div>
        ${pendingRows}
      </div>
      <div style="margin-bottom:12px;">
        <div style="font-weight:800;font-size:12px;text-transform:uppercase;color:#374151;">Nicht automatisch übertragen (${dead.length})</div>
        ${deadRows}
      </div>
      <div style="display:flex;gap:8px;">
        <button type="button" class="btn btn-primary" id="sync-queue-retry">Jetzt synchronisieren</button>
        <button type="button" class="btn btn-secondary" id="sync-queue-clear">Liste leeren</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  document.getElementById('sync-queue-close')?.addEventListener('click', close);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });
  document.getElementById('sync-queue-retry')?.addEventListener('click', async () => {
    const requeued = requeueDeadPendingSyncs();
    await flushPendingSyncs();
    updateSyncIndicator();
    close();
    showToast(
      requeued > 0
        ? `${requeued} Einträge erneut eingeplant, Übertragung läuft.`
        : 'Übertragung erneut angestoßen.',
      'success',
    );
  });
  document.getElementById('sync-queue-clear')?.addEventListener('click', () => {
    savePendingSyncs([]);
    updateSyncIndicator();
    close();
    showToast('Liste lokal geleert.', 'warning');
  });
}

document.getElementById('sync-indicator')?.addEventListener('click', showSyncQueueDialog);

// --- BARCODE-SCANNER// --- BARCODE-SCANNER (Kamera + Lernmodus) ---
const scannerOverlay = document.getElementById('scanner-overlay');
const previewVideo = document.getElementById('preview-video');
const quaggaReader = document.getElementById('quagga-reader');
const html5Reader = document.getElementById('html5-reader');
const btnOpenScanner = document.getElementById('btn-open-scanner');
const btnCloseScanner = document.getElementById('close-scanner-btn');
const btnReceivingScan = document.getElementById('btn-receiving-scan');
const btnManualBarcode = document.getElementById('btn-manual-barcode');
const btnManualBarcodeSubmit = document.getElementById('btn-manual-barcode-submit');
const manualBarcodeInput = document.getElementById('scanner-manual-barcode-input');
const scannerManualEntry = document.getElementById('scanner-manual-entry');
const scannerStatusText = document.getElementById('scanner-status-text');
function updateScannerButtonVisibility() {
  const scannerButton = document.getElementById('btn-open-scanner');
  if (!scannerButton) return;
  scannerButton.classList.add('hidden');
}

function setScannerStatus(message) {
  if (scannerStatusText) scannerStatusText.textContent = message;
}

try {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
    window.isCameraAvailable = false;
  }

  initScannerEngine({
    onScanSuccess: handleMhdBarcodeScan,
    onScanError: ({ title, message, icon }) => showHUD(title, message, icon),
    onStatusChange: ({ message, status }) => {
      if (message) setScannerStatus(message);
      if (status) handleMhdScannerStatus({ status });
    },
    onSound: playClickSound,
    elements: {
      scannerOverlay,
      previewVideo,
      quaggaReader,
      html5Reader,
      scannerManualEntry,
      btnManualBarcode,
      manualBarcodeInput,
    },
  });
} catch (err) {
  window.isCameraAvailable = false;
  console.warn('[CharcuLogic Scanner] Scanner-Initialisierung beim Boot abgefangen:', err);
}
// --- SERVICE WORKER REGISTRIERUNG (PWA) ---
let updateAvailable = false;
let serviceWorkerRegistration = null;

function showUpdateToast() {
  const toast = document.getElementById('update-toast');
  if (toast) toast.classList.add('is-visible');
}

function hideUpdateToast() {
  const toast = document.getElementById('update-toast');
  if (toast) toast.classList.remove('is-visible');
}

async function clearLocalAppCaches() {
  navigator.serviceWorker?.controller?.postMessage?.({ type: 'CLEAR_APP_CACHES' });
  if (!('caches' in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys.map((key) => caches.delete(key)));
}

async function activateWaitingServiceWorker() {
  const registration = serviceWorkerRegistration
    || await navigator.serviceWorker?.getRegistration?.();
  const waitingWorker = registration?.waiting;
  if (!waitingWorker) return false;
  return new Promise((resolve) => {
    let resolved = false;
    const finish = () => {
      if (resolved) return;
      resolved = true;
      resolve(true);
    };
    navigator.serviceWorker.addEventListener('controllerchange', finish, { once: true });
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    setTimeout(finish, 1500);
  });
}

async function refreshAppFromNetwork() {
  try {
    const registration = serviceWorkerRegistration
      || await navigator.serviceWorker?.getRegistration?.();
    await registration?.update?.();
    await activateWaitingServiceWorker();
    await clearLocalAppCaches();
  } catch (err) {
    console.warn('[CharcuLogic SW] Manuelle Aktualisierung konnte Cache/Worker nicht vollstaendig erneuern:', err);
  }
  window.location.reload();
}

function applyUpdate(force) {
  if (!force && isUiDirty) {
    const confirmOverlay = document.createElement('div');
    confirmOverlay.className = 'pin-modal-overlay active';
    confirmOverlay.innerHTML = `
      <div class="pin-modal" style="max-width:340px;text-align:center;padding:28px 20px;">
        <h3 style="margin:0 0 10px;">Ungespeicherte Änderungen</h3>
        <p style="font-size:14px;color:var(--text-secondary);margin:0 0 20px;">
          Wenn du jetzt aktualisierst, gehen deine offenen Eingaben verloren.
        </p>
        <div style="display:flex;gap:10px;justify-content:center;">
          <button type="button" class="btn" id="update-confirm-cancel"
            style="flex:1;min-height:44px;">Abbrechen</button>
          <button type="button" class="btn btn-primary" id="update-confirm-ok"
            style="flex:1;min-height:44px;background:var(--danger);">Trotzdem aktualisieren</button>
        </div>
      </div>`;
    document.body.appendChild(confirmOverlay);
    document.getElementById('update-confirm-cancel')?.addEventListener('click', () => confirmOverlay.remove());
    document.getElementById('update-confirm-ok')?.addEventListener('click', () => {
      confirmOverlay.remove();
      applyUpdate(true);
    });
    return;
  }
  hideUpdateToast();
  refreshAppFromNetwork();
}

document.getElementById('update-toast-btn')?.addEventListener('click', () => {
  if (typeof window.forceAppUpdate === 'function') {
    window.forceAppUpdate();
    return;
  }
  applyUpdate(false);
});
document.getElementById('update-toast-dismiss')?.addEventListener('click', hideUpdateToast);
document.getElementById('app-refresh-btn')?.addEventListener('click', () => applyUpdate(false));

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js?v=20260612-1405')
      .then((reg) => {
        serviceWorkerRegistration = reg;
        console.log('[CharcuLogic SW] Registriert, Scope:', reg.scope);

        if (reg.installing) {
          console.info('[CharcuLogic SW] Neuer SW wird installiert...');
          if (qaState.active) qaState.log('SW: Neuer Worker wird installiert');
        }

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          console.info('[CharcuLogic SW] Update gefunden, neuer Worker installiert sich.');
          if (qaState.active) qaState.log('SW: Update erkannt, Installation läuft');

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              updateAvailable = true;
              console.info('[CharcuLogic SW] Neuer Worker bereit — Update-Banner wird angezeigt.');
              if (qaState.active) qaState.log('SW: Update bereit, Banner sichtbar');
              showUpdateToast();
            }
          });
        });
      })
      .catch((err) => console.warn('[CharcuLogic SW] Registrierung fehlgeschlagen:', err));
  });
}

// Initialer Render & Firebase-Start
async function bootstrapAuthenticatedApp() {
  try {
    await waitForFirebaseCore();
  } catch (err) {
    setSyncStatus('offline');
    console.error('[CharcuLogic Auth] Firebase-Core nicht bereit:', err);
    showHUD('HofSync wird initialisiert', 'Mandantendaten konnten noch nicht geladen werden.', '!');
    return;
  }

  if (await handleAuthUrlResetIfRequested()) return;

  if (typeof window.applyResolvedBranding === 'function') {
    window.applyResolvedBranding(window.resolveEffectiveTenantId?.());
  } else {
    applyBranding();
  }

  try {
    await initAppCheckModule();
  } catch (err) {
    console.error('[CharcuLogic AppCheck] Initialisierung fehlgeschlagen:', err);
    showAdminDevHint(
      'Admin-Hinweis: App Check fehlt',
      'KI-Scanner und PIN-Pruefung sind erst nach App-Check-Konfiguration aktiv.',
    );
  }

  await initAuthModule(firebase, db, { showHUD });
  if (isAuthLoopBreakerActive()) {
    hideAppShellForAuthLockdown();
  }
  // Auf /dev-dashboard schon vor dem Login das Desktop-Layout aktivieren,
  // damit das (von auth.js gezeigte) Login-Overlay zentriert im Desktop liegt
  // statt im schmalen Smartphone-Simulator.
  if (isDevDashboardRoute()) {
    document.body.classList.add('dev-dashboard-view');
    window.syncDesktopWideLayout?.('page-dev-dashboard');
  }
  const authSession = await waitForAuthReady();
  if (typeof window.applyResolvedBranding === 'function') {
    window.applyResolvedBranding(authSession.tenantId);
  } else {
    applyBranding();
  }
  setGlobalTenantId(authSession.tenantId);
  await loadTenantEnabledModules(db, authSession.tenantId);
  applyModuleVisibility(window.BRANDING);

  const currentUser = firebase.auth().currentUser;
  if (isDevDashboardRoute()) {
    // Kein Simulator-Redirect mehr: initDevDashboard zeigt bei fehlenden
    // Admin-Rechten eine saubere Desktop-Fehlermeldung inkl. Logout-Button.
    await initDevDashboard(db, { currentUser, authContext: authSession });
    updateSyncIndicator();
    return;
  }

  bindTenantModuleConfigListener(authSession.tenantId);
  syncFirebaseEmployeeSession(authSession);
  applyRoleBasedUi(authSession);
  if (isFirebaseRoleAuth(window.BRANDING) && authSession.role === 'employee') {
    showTab('mhd');
  }
  refreshRetterBoxModule();
  bindOfficeAccessLock();
  bindAdminHeaderDropdown();
  window.addEventListener('charculogic:auth-changed', (event) => {
    const nextSession = event.detail || getAuthContext();
    if (nextSession?.tenantId) {
      setGlobalTenantId(nextSession.tenantId);
      void loadTenantEnabledModules(db, nextSession.tenantId).then(() => {
        applyModuleVisibility(window.BRANDING);
        bindTenantModuleConfigListener(nextSession.tenantId);
      });
    }
    if (typeof window.applyResolvedBranding === 'function') {
      window.applyResolvedBranding(nextSession?.tenantId);
    }
    applyModuleVisibility(window.BRANDING);
    applyRoleBasedUi(nextSession);
    syncFirebaseEmployeeSession(nextSession);
    refreshRetterBoxModule();
    purgeInvalidProfileSession(window.BRANDING);
    startTenantLiveDataListeners();
  });
  configureSteveshofTerminalSession(authSession);
  purgeInvalidProfileSession(window.BRANDING);
  expireProfileSessionIfIdle(window.BRANDING);
  const terminalEmployeeName = readActiveEmployee();
  const tenantId = getGlobalTenantId();

  const recipeModuleEnabled = isTenantModuleEnabled('kitchen', window.BRANDING);
  if (recipeModuleEnabled) {
    initProductionModule(db, writeFirestoreDocOrQueue, { playClickSound, playFeedbackSound }, showHUD, {
      tenantId,
      getFirebase: () => firebase,
      onFormSaved: (fieldIds) => clearDirty(fieldIds),
      restoreDraftFields,
      getAuditActorName: () => readActiveEmployee() || resolveFirebaseEmployeeName(authSession),
    });
  } else {
    disableProductionModule();
  }

  initMhdModule(db, { writeOrQueueFirestore: writeFirestoreDocOrQueue, addPendingSync }, { playFeedbackSound, playClickSound }, {
    showHUD,
    verifyAdminAction,
    tenantId,
    appsScriptWebAppUrl,
    getFirebase: () => firebase,
    isFirebaseReady: () => firebaseReady,
    scannerAPI: { openScanner, closeScanner },
    terminalEmployeeName,
    addRetterBoxCandidate,
    onFormSaved: (fieldIds) => clearDirty(fieldIds),
    restoreDraftFields,
  });
  initRetterBoxModule(db, {
    tenantId,
    getFirebase: () => firebase,
    writeOrQueueFirestore: writeFirestoreDocOrQueue,
    showHUD,
    getMhdProducts,
  });
  initDeliveryNoteScanner({
    tenantId,
    getFirebase: () => firebase,
    showHUD,
    writeOrQueueFirestore: writeFirestoreDocOrQueue,
  });
  initDeliveryParser({
    tenantId,
    email: authSession?.email || getAuthContext()?.email || '',
    getFirebase: () => firebase,
    showHUD,
    writeOrQueueFirestore: writeFirestoreDocOrQueue,
    getHistory: getMhdProducts,
  });

  initHaccpModule(db, writeFirestoreDocOrQueue, showHUD, verifyAdminAction, {
    tenantId,
    getFirebase: () => firebase,
    playClickSound,
    onFormSaved: (fieldIds) => clearDirty(fieldIds),
    restoreDraftFields,
  });

  initTraceabilityModule(db, writeFirestoreDocOrQueue, showHUD, {
    tenantId,
    getFirebase: () => firebase,
    getCurrentUserId: () => firebase.auth?.().currentUser?.uid || getAuthContext()?.uid || '',
  });

  initTeamboardModule(db, {
    tenantId,
    getFirebase: () => firebase,
    showHUD,
    playClickSound,
  });
  initCustomerOrdersModule(db, {
    tenantId,
    getFirebase: () => firebase,
  });
  initTeamConfigModule(db, {
    tenantId,
    getFirebase: () => firebase,
  });
  initCutGlossaryModule();
  refreshTeamboardAdminPanel();
  refreshAdminTeamConfigPanel();
  syncPushRegistration();
  initGermanDateInputs(document);

  purgeInvalidProfileSession(window.BRANDING);
  expireProfileSessionIfIdle(window.BRANDING);
  if (!isFirebaseRoleAuth(window.BRANDING)) {
    if (isProfileEmployeeAuth(window.BRANDING)) {
      await ensureTenantFirebaseAuth(window.BRANDING);
      if (INVENTORY_PROFILE_TABS.has(AppState.activeTab)) {
        await requireProfileSessionForInventory();
      }
      const activeProfile = readActiveEmployee();
      if (activeProfile) {
        applyRoleBasedUi(authSession);
        applyProfileKitchenRestrictions();
        if (isAdvancedKaeseUpgradeEnabled(window.BRANDING)) {
          await maybeShowBulletinAckInterceptor(activeProfile, window.BRANDING);
        }
      }
    }
  } else {
    syncFirebaseEmployeeSession(authSession);
  }

  if (tenantIdsMatch(authSession.tenantId, STEVESHOF_TENANT_ID)) {
    showTab('mhd');
  }
  updateSyncIndicator();
  startTenantLiveDataListeners();
  if (recipeModuleEnabled) {
    loadRecipesFromCloud();
    loadProductionBatchesFromCloud();
  }
  await flushPendingSyncs();
  flushErrorTelemetry();
  subscribeFleischpreise();
  refreshWrsMeatPriceAdminButton();
  refreshSyncConnectivityUi();
}

// ============================================================================
// QA STRESS-TEST PANEL (localhost / 127.0.0.1 only — zero overhead in prod)
// ============================================================================

function initQaPanel() {
  const host = window.location.hostname;
  if (host !== 'localhost' && host !== '127.0.0.1') return;

  const panel = document.getElementById('qa-test-panel');
  if (!panel) return;
  panel.style.display = '';

  const toggle = document.getElementById('qa-panel-toggle');
  const logEl = document.getElementById('qa-log');
  const toggleLatency = document.getElementById('qa-toggle-latency');
  const toggleTeardown = document.getElementById('qa-toggle-teardown');
  const btnInjectStale = document.getElementById('qa-btn-inject-stale');
  const btnInjectBadSchema = document.getElementById('qa-btn-inject-bad-schema');

  qaState.active = true;
  qaState.log = (msg) => {
    if (logEl) {
      const ts = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      logEl.textContent = `[${ts}] ${msg}`;
    }
    console.info(msg);
  };

  toggle?.addEventListener('click', () => panel.classList.toggle('is-open'));

  toggleLatency?.addEventListener('change', () => {
    qaState.latency = toggleLatency.checked;
    qaState.log(qaState.latency ? 'Latenz (5s) aktiviert' : 'Latenz deaktiviert');
  });

  toggleTeardown?.addEventListener('change', () => {
    qaState.teardown = toggleTeardown.checked;
    qaState.log(qaState.teardown ? 'Netzwerk-Abreißer aktiv' : 'Netzwerk-Abreißer deaktiviert');
  });

  btnInjectStale?.addEventListener('click', () => {
    const staleTimestamp = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
    const tenantId = getGlobalTenantId() || 'qa-tenant';
    const staleEntry = {
      _syncType: 'firestore-doc',
      _collectionPath: `tenants/${tenantId}/haccp_logs`,
      _docId: `qa-stale-haccp-${Date.now().toString(36)}`,
      _op: 'set',
      _queuedAt: Date.now() - 72 * 60 * 60 * 1000,
      _id: `qa-${crypto.randomUUID?.() || Date.now()}`,
      data: {
        logTyp: 'temperatur',
        deviceId: 'qa-test-device',
        deviceName: 'QA Stale Device',
        bereich: 'QA',
        wert: 4.2,
        einheit: '°C',
        status: 'ok',
        tenantId,
        datum: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString().slice(0, 10),
        createdAt: staleTimestamp,
      },
    };
    addPendingSync(staleEntry);
    qaState.log(`Stale HACCP-Payload injiziert (createdAt: ${staleTimestamp.slice(0, 19)})`);
  });

  btnInjectBadSchema?.addEventListener('click', () => {
    const tenantId = getGlobalTenantId() || 'qa-tenant';
    const badEntry = {
      _syncType: 'firestore-doc',
      _collectionPath: `tenants/${tenantId}/mhd_liste`,
      _docId: `qa-bad-schema-${Date.now().toString(36)}`,
      _op: 'set',
      _queuedAt: Date.now(),
      _id: `qa-${crypto.randomUUID?.() || Date.now()}`,
      data: {
        name: '',
        produkt: '',
        qty: -5,
        mhd: '2026-06-15',
        kategorie: '🥛MoPro',
        tenantId,
        illegalField: 'should-be-blocked-by-rules',
        createdAt: new Date().toISOString(),
      },
    };
    addPendingSync(badEntry);
    qaState.log('Bad-Schema MHD-Payload injiziert (leerer Name, negativer qty, illegales Feld)');
  });

  qaState.log('QA-Panel bereit');
}
initQaPanel();

if (typeof window.applyResolvedBranding === 'function') {
  window.applyResolvedBranding(window.resolveEffectiveTenantId?.());
} else {
  applyBranding();
}

if (!EMERGENCY_LOGOUT_REQUESTED) {
  void firebaseCoreReadyPromise.then(() => initWrsModule()).catch((err) => {
    console.warn('[CharcuLogic WRS] Modul-Start nach Firebase-Core fehlgeschlagen:', err);
  });

  bootstrapAuthenticatedApp().catch((err) => {
    refreshSyncConnectivityUi();
    console.error('[CharcuLogic Auth] App-Start nach Auth fehlgeschlagen:', err);
    showHUD('HofSync wird initialisiert', 'Mandantendaten konnten noch nicht geladen werden.', '!');
  });
}
