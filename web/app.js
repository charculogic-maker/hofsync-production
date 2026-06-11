import {
  getAuthContext,
  getTenantId,
  initAuthModule,
  isHelperUser,
  isOfficeUser,
  loginTenant,
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
} from './haccp.js';
import {
  activateMhdTab,
  activateReceivingTab,
  getMhdProducts,
  applyReceivingMetzgereiVisibility,
  handleMhdBarcodeScan,
  handleMhdScannerStatus,
  initMhdModule,
  loadMhdFromCloud,
  renderMhdList,
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
  setGlobalTenantId,
} from './tenant-db.js';
import { resolveFirebaseConfig, resolveFirebaseProjectKey } from './firebase-config.js';
import { initAppCheckModule, waitForAppCheckReady } from './app-check.js';
import { logAndMapOperatorError } from './operator-errors.js';
import { ACTIVE_EMPLOYEE_STORAGE_KEY, scopedTeamboardStorageKey } from './teamboard-storage.js';

const STEVESHOF_TENANT_ID = 'StevesHof_Hauptbetrieb';
const STEVESHOF_TERMINAL_EMAIL = 'bestellung@steveshof-hofladen.de';
const STEVESHOF_TERMINAL_EMPLOYEE = 'StevesHof-Team';

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

function applyModuleVisibility(branding = window.BRANDING || {}) {
  const modules = branding.modules || {};
  const kitchenEnabled = isWurstkuecheEnabledForTenant(getTenantId(), branding);
  const tabModuleMap = {
    teamboard: modules.teamboard !== false,
    team: modules.team !== false
      && (modules.team === true || modules.orders !== false || modules.haccp !== false || modules.teamboard !== false),
    mhd: modules.mhdMonitor !== false,
    receiving: modules.wareneingang !== false,
    kitchen: kitchenEnabled,
    haccp: modules.haccp !== false,
    cuts: modules.cutGlossary === true,
    batches: modules.batches !== false,
  };
  document.querySelectorAll('.nav-item[data-tab]').forEach((tab) => {
    const tabId = tab.getAttribute('data-tab');
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

  const rezeptAuditEnabled = modules.rezeptAudit !== false;
  const auditCard = document.getElementById('recipe-cloud-audit-card');
  if (auditCard) {
    auditCard.hidden = !rezeptAuditEnabled;
    auditCard.style.display = rezeptAuditEnabled ? '' : 'none';
  }
}

function applyRoleBasedUi(authSession) {
  const isHelper = authSession?.isHelper || isHelperUser();
  const isOffice = isOfficeUser(authSession);
  const isStevesHof = isSteveshofTenantId(authSession?.tenantId || getTenantId() || getGlobalTenantId());
  document.documentElement.dataset.userRole = authSession?.role || 'user';
  document.body.classList.toggle('role-helper', isHelper);
  document.body.classList.toggle('role-office', isOffice);
  document.body.classList.toggle('role-employee', !isHelper && !isOffice && authSession?.role === 'employee');

  const helperHiddenTabs = new Set(['team', 'receiving', 'kitchen', 'haccp', 'cuts', 'batches']);
  const stevesHofOfficeTabs = new Set(['batches']);

  document.querySelectorAll('.nav-item[data-tab]').forEach((tab) => {
    if (tab.hidden) return;
    const tabId = tab.getAttribute('data-tab');
    const hideForHelper = isHelper && helperHiddenTabs.has(tabId) && !(isStevesHof && tabId === 'haccp');
    const hide =
      hideForHelper
      || (isStevesHof && !isOffice && stevesHofOfficeTabs.has(tabId));
    tab.style.display = hide ? 'none' : '';
  });

  ['btn-master-data', 'btn-delivery-note-ai', 'office-tools-panel'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.hidden = !isOffice;
  });

  const saveMhdBar = document.querySelector('#page-mhd .sticky-action-bar');
  if (saveMhdBar) saveMhdBar.hidden = isHelper;

  const teamHub = document.getElementById('page-team');
  if (teamHub) teamHub.classList.toggle('role-helper-hidden', isHelper);

  refreshWrsMeatPriceAdminButton();
  updateOfficeAccessLock();
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

function initFirebase() {
  if (typeof firebase === 'undefined') {
    console.error('[CharcuLogic Firebase] Firebase SDK nicht geladen. Prüfe die Script-Tags in index.html.');
    return false;
  }
  if (!isFirebaseConfigValid(firebaseConfig)) {
    console.error('[CharcuLogic Firebase] Ungültige firebaseConfig – bitte echte Projekt-Credentials eintragen.');
    return false;
  }
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    db = firebase.firestore();
    initTenantDb(db);
    if (typeof firebase.functions === 'function') {
      firebase.functions();
    }
    db.enablePersistence().catch((err) => {
      console.warn("Firestore Persistence Error:", err.code);
    });
    firebaseReady = true;
    console.log(
      `[CharcuLogic Firebase] Verbunden mit Projekt "${firebaseConfig.projectId}" (${resolveFirebaseProjectKey()}).`,
    );
    return true;
  } catch (err) {
    console.error('[CharcuLogic Firebase] Initialisierung fehlgeschlagen:', err);
    db = null;
    firebaseReady = false;
    return false;
  }
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
  const functionsRegion = firebase.app().functions('europe-west3');
  const callable = functionsRegion.httpsCallable('triggerManualMeatPriceRun', { timeout: 120000 });
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
      console.warn(`[CharcuLogic WRS] Fleischpreise-Listener (${tenantId}) fehlgeschlagen:`, err);
      if (wrsState.priceSource === 'fallback') {
        setWrsStatus('Offline (Fallback)', 'error');
      }
    },
  );
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
  return scopedTeamboardStorageKey(ACTIVE_EMPLOYEE_STORAGE_KEY, getGlobalTenantId() || getTenantId());
}

function updateHeaderLogoutVisibility(activeTab) {
  if (!headerLogoutBtn) return;
  const isFixedTerminal = document.documentElement.dataset.fixedTerminal === 'steveshof';
  headerLogoutBtn.style.display = !isFixedTerminal && activeTab === 'batches' ? 'inline-block' : 'none';
}

function readActiveEmployee() {
  try {
    return String(
      localStorage.getItem(activeEmployeeStorageKey())
      || '',
    ).trim();
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

function showPage(pageId) {
  pages.forEach((page) => {
    const isTarget = page.id === pageId;
    page.classList.toggle('active', isTarget);
    // Defensive inline display handling: avoids rare stale layout states
    // where .active class exists but page still does not paint.
    page.style.display = isTarget ? 'block' : 'none';
  });
}

function showTab(tabId) {
  const tab = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
  if (!tab || tab.hidden || tab.style.display === 'none') return false;
  tab.click();
  return true;
}
window.showTab = showTab;

function resolveEarlyTenantId() {
  try {
    if (typeof window.resolveEffectiveTenantId === 'function') {
      return window.resolveEffectiveTenantId();
    }
    return localStorage.getItem('charculogic_cached_tenant_id') || '';
  } catch (err) {
    console.warn('[CharcuLogic Bootstrap] Gespeicherter Mandant konnte nicht gelesen werden:', err);
    return '';
  }
}

function applyEarlyTenantShell() {
  const tenantId = resolveEarlyTenantId() || STEVESHOF_TENANT_ID;
  if (!isSteveshofTenantId(tenantId)) return;
  if (typeof window.applyResolvedBranding === 'function') {
    window.applyResolvedBranding(STEVESHOF_TENANT_ID);
  } else {
    applyBranding();
  }
  setGlobalTenantId(STEVESHOF_TENANT_ID);
  applyModuleVisibility(window.BRANDING);
  applyRoleBasedUi({
    tenantId: STEVESHOF_TENANT_ID,
    role: 'employee',
    isAdmin: false,
    isHelper: false,
  });
  configureSteveshofTerminalSession({
    tenantId: STEVESHOF_TENANT_ID,
    email: STEVESHOF_TERMINAL_EMAIL,
  });
  showTab('mhd');
}

function isSteveshofTerminalSession(authSession) {
  return authSession?.tenantId === STEVESHOF_TENANT_ID
    && String(authSession?.email || '').trim().toLowerCase() === STEVESHOF_TERMINAL_EMAIL;
}

function configureSteveshofTerminalSession(authSession) {
  if (!isSteveshofTerminalSession(authSession)) return '';
  document.documentElement.dataset.fixedTerminal = 'steveshof';
  updateHeaderLogoutVisibility(AppState.activeTab);
  const teamLoginCard = document.getElementById('team-login-card');
  if (teamLoginCard) teamLoginCard.hidden = true;
  try {
    localStorage.setItem(activeEmployeeStorageKey(), STEVESHOF_TERMINAL_EMPLOYEE);
    localStorage.removeItem(ACTIVE_EMPLOYEE_STORAGE_KEY);
  } catch (err) {
    console.warn('[CharcuLogic Terminal] Neutraler Bearbeiter konnte nicht gespeichert werden:', err);
  }
  window.dispatchEvent(new CustomEvent('charculogic:active-employee-changed', {
    detail: { employeeName: STEVESHOF_TERMINAL_EMPLOYEE },
  }));
  return STEVESHOF_TERMINAL_EMPLOYEE;
}

window.addEventListener('charculogic:active-employee-changed', (event) => {
  updateEmployeeSessionBadge(event.detail?.employeeName || readActiveEmployee());
});

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const targetTab = tab.getAttribute('data-tab');
    if (tab.hidden || tab.style.display === 'none') {
      return;
    }
    if (targetTab === 'kitchen' && !isWurstkuecheEnabledForTenant(getTenantId())) {
      showToast('Das Produktionsmodul ist für diesen Betrieb nicht freigeschaltet.', 'warning');
      return;
    }
    AppState.activeTab = targetTab;

    // Haptischer Klick (tiefere Frequenz für Nav-Tabs)
    playClickSound(800, 0.05, 0.15);

    // Navigationselemente aktualisieren
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

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
    } else if (targetTab === 'kitchen') {
      showPage('page-kitchen');
      headerTitle.textContent = "Wurstküche";
      headerSubtitle.textContent = "Produktion";
    } else if (targetTab === 'haccp') {
      showPage('page-haccp');
      headerTitle.textContent = "HACCP-Protokoll";
      headerSubtitle.textContent = "Tageskontrollen";
    } else if (targetTab === 'cuts') {
      showPage('page-cuts');
      headerTitle.textContent = "Cut-Lexikon";
      headerSubtitle.textContent = "Zuschnitte & Muskelkunde";
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
      if (targetTab === 'mhd') activateMhdTab();
      if (targetTab === 'receiving') activateReceivingTab();
      if (targetTab === 'kitchen') activateKitchenTab();
      if (targetTab === 'haccp') activateHaccpTab();
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

applyEarlyTenantShell();
updateHeaderLogoutVisibility(AppState.activeTab);
updateEmployeeSessionBadge();

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
  if (!btnOpenScanner) return;
  btnOpenScanner.classList.add('hidden');
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
    navigator.serviceWorker.register('./sw.js?v=20260609-120')
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
  applyBranding();

  if (!initFirebase()) {
    setSyncStatus('offline');
    console.error('[CharcuLogic Auth] Firebase ist Pflicht fuer Mandantentrennung. App bleibt im Initialisierungsmodus.');
    showHUD('HofSync wird initialisiert', 'Mandantendaten konnten noch nicht geladen werden.', '!');
    return;
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

  initAuthModule(firebase, db, { showHUD });
  const authSession = await waitForAuthReady();
  if (typeof window.applyResolvedBranding === 'function') {
    window.applyResolvedBranding(authSession.tenantId);
  } else {
    applyBranding();
  }
  setGlobalTenantId(authSession.tenantId);
  applyModuleVisibility(window.BRANDING);
  applyRoleBasedUi(authSession);
  refreshRetterBoxModule();
  bindOfficeAccessLock();
  window.addEventListener('charculogic:auth-changed', (event) => {
    const nextSession = event.detail || getAuthContext();
    if (nextSession?.tenantId) setGlobalTenantId(nextSession.tenantId);
    if (typeof window.applyResolvedBranding === 'function') {
      window.applyResolvedBranding(nextSession?.tenantId);
    }
    applyModuleVisibility(window.BRANDING);
    applyRoleBasedUi(nextSession);
    refreshRetterBoxModule();
  });
  const terminalEmployeeName = configureSteveshofTerminalSession(authSession);
  const tenantId = getGlobalTenantId();

  const recipeModuleEnabled = isWurstkuecheEnabledForTenant(authSession.tenantId);
  if (recipeModuleEnabled) {
    initProductionModule(db, writeFirestoreDocOrQueue, { playClickSound, playFeedbackSound }, showHUD, {
      tenantId,
      getFirebase: () => firebase,
      onFormSaved: (fieldIds) => clearDirty(fieldIds),
      restoreDraftFields,
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

  if (authSession.tenantId === STEVESHOF_TENANT_ID) {
    showTab('mhd');
  }
  updateSyncIndicator();
  loadMhdFromCloud();
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

applyBranding();

initWrsModule();

bootstrapAuthenticatedApp().catch((err) => {
  refreshSyncConnectivityUi();
  console.error('[CharcuLogic Auth] App-Start nach Auth fehlgeschlagen:', err);
  showHUD('HofSync wird initialisiert', 'Mandantendaten konnten noch nicht geladen werden.', '!');
});
