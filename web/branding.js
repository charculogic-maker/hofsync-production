/******* CHARCULOGIC - WHITE LABEL CONFIGURATION *******/
import { isWhitelabelFirebaseHost } from './firebase-config.js';

const DEFAULT_BRANDING = {  appName: 'Betriebs-App',
  betriebsName: 'Ihr Betrieb',
  primaryColor: '#64748b',
  primaryColorHover: '#475569',
  darkHeaderBg: '#334155',
  textOnHeader: '#ffffff',
  accentAlert: '#dc3545',
  lightBg: '#f1f5f9',
  supportEmail: 'support@charculogic.de',
  standardBereich: 'Allgemein',
  modules: {
    mhdMonitor: true,
    wareneingang: true,
    wareneingangMetzgerei: true,
    rezeptAudit: true,
    bratwurstMasterlist: false,
    wurstkueche: true,
    knowledge: false,
    cutGlossary: false,
    haccp: true,
    orders: true,
    retterBox: false,
    traceability: true,
    employeePin: true,
    employeeAuth: 'pin',
  },
};

const TENANT_BRANDING = {
  steveshof_hauptbetrieb: {
    betriebsName: 'StevesHof Hofladen',
    terminalAuth: {
      email: 'bestellung@steveshof-hofladen.de',
    },
    profileCapabilities: {
      Melanie: {
        allowedTabs: ['mhd', 'receiving', 'kitchen', 'traceability'],
        kitchenReadOnly: true,
        email: 'melanie@steveshof-hofladen.de',
      },
      Bettina: {
        allowedTabs: ['mhd', 'receiving', 'kitchen', 'traceability'],
        kitchenReadOnly: true,
        email: 'bettina@steveshof-hofladen.de',
      },
      Heiko: {
        allowedTabs: ['mhd', 'receiving', 'kitchen', 'traceability'],
        kitchenReadOnly: false,
        email: 'heiko@steveshof-hofladen.de',
      },
      Ernst: {
        allowedTabs: ['mhd', 'receiving', 'kitchen', 'traceability'],
        kitchenReadOnly: false,
        email: 'ernst@steveshof-hofladen.de',
      },
      Paddy: {
        allowedTabs: ['mhd', 'receiving', 'kitchen', 'traceability', 'haccp', 'knowledge', 'wissen'],
        kitchenReadOnly: false,
      },
    },
    appName: 'CharcuLogic',
    primaryColor: '#5D4037',
    primaryColorHover: '#4E342E',
    darkHeaderBg: '#3E2723',
    textOnHeader: '#ffffff',
    accentAlert: '#EA580C',
    standardBereich: 'Laden / Verkauf',
    modules: {
      teamboard: false,
      team: false,
      mhdMonitor: true,
      wareneingang: true,
      wareneingangMetzgerei: false,
      rezeptAudit: false,
      bratwurstMasterlist: true,
      wurstkueche: true,
      knowledge: false,
      cutGlossary: false,
      haccp: false,
      orders: false,
      batches: true,
      retterBox: true,
      traceability: true,
      employeePin: false,
      employeeAuth: 'profile',
    },
  },
  torfabrik: {
    betriebsName: 'TorFabrik Krefeld',
    appName: 'CenterLogic',
    primaryColor: '#00A651',
    primaryColorHover: '#008541',
    darkHeaderBg: '#FFC20E',
    textOnHeader: '#000000',
    accentAlert: '#800020',
    standardBereich: 'Theke',
    modules: {
      mhdMonitor: true,
      wareneingang: true,
      wareneingangMetzgerei: false,
      rezeptAudit: false,
      wurstkueche: false,
      knowledge: false,
      cutGlossary: false,
      haccp: true,
      orders: true,
      traceability: true,
      employeePin: true,
      employeeAuth: 'pin',
    },
  },
  whitelabel_test: {
    betriebsName: 'Whitelabel Testbetrieb',
    appName: 'CharcuLogic Test',
    primaryColor: '#2563eb',
    primaryColorHover: '#1d4ed8',
    darkHeaderBg: '#1e3a5f',
    textOnHeader: '#ffffff',
    accentAlert: '#dc2626',
    standardBereich: 'Test-Theke',
    modules: {
      mhdMonitor: true,
      wareneingang: true,
      wareneingangMetzgerei: false,
      rezeptAudit: false,
      wurstkueche: false,
      knowledge: false,
      cutGlossary: false,
      haccp: false,
      orders: false,
      batches: false,
      traceability: true,
      employeePin: false,
      employeeAuth: 'firebase',
    },
  },
  home_leitstand: {
    betriebsName: 'Home Leitstand',
    appName: 'CharcuLogic Home',
    primaryColor: '#7c3aed',
    primaryColorHover: '#6d28d9',
    darkHeaderBg: '#4c1d95',
    textOnHeader: '#ffffff',
    accentAlert: '#dc2626',
    standardBereich: 'Heimküche',
    modules: {
      mhdMonitor: true,
      wareneingang: false,
      wareneingangMetzgerei: false,
      rezeptAudit: false,
      bratwurstMasterlist: false,
      wurstkueche: true,
      knowledge: false,
      cutGlossary: false,
      haccp: false,
      orders: false,
      batches: true,
      retterBox: false,
      traceability: true,
      employeePin: false,
      employeeAuth: 'firebase',
    },
  },
  ap23: {
    betriebsName: 'AP23',
    appName: 'AP23',
    brandingClass: 'theme-blue',
    primaryColor: '#2563eb',
    primaryColorHover: '#1d4ed8',
    darkHeaderBg: '#1e3a5f',
    textOnHeader: '#ffffff',
    accentAlert: '#dc2626',
    standardBereich: 'Heimküche',
    modules: {
      mhdMonitor: true,
      wareneingang: false,
      wareneingangMetzgerei: false,
      rezeptAudit: false,
      bratwurstMasterlist: false,
      wurstkueche: true,
      knowledge: false,
      cutGlossary: false,
      haccp: false,
      orders: false,
      batches: true,
      retterBox: false,
      traceability: true,
      employeePin: false,
      employeeAuth: 'firebase',
    },
  },
};

const CACHED_TENANT_ID_KEY = 'charculogic_cached_tenant_id';
const TORFABRIK_TENANT_KEY = 'torfabrik';
const WHITELABEL_DEFAULT_TENANT = 'whitelabel_test';

/** Whitelabel-Test-Hosting → Mandant whitelabel_test, solange noch kein Login-Cache existiert. */
const HOSTING_DEFAULT_TENANT = {
  whitelabel: WHITELABEL_DEFAULT_TENANT,
};
function isLocalDevHost() {
  const host = String(window.location?.hostname || '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1';
}

function readDevFirebaseProjectOverride() {
  if (!isLocalDevHost()) return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('firebase') || params.get('project');
    if (fromQuery === 'whitelabel' || fromQuery === 'production') return fromQuery;
    const fromStorage = localStorage.getItem('charculogic_firebase_project');
    if (fromStorage === 'whitelabel' || fromStorage === 'production') return fromStorage;
  } catch (_) { /* noop */ }
  return null;
}

function readTenantFromQueryString() {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('tenant') || params.get('tenantId');
    if (fromQuery) return normalizeTenantKey(fromQuery);
  } catch (_) { /* noop */ }
  return '';
}

function readDevTenantOverride() {
  return readTenantFromQueryString();
}

function normalizeTenantKey(tenantId) {
  return typeof tenantId === 'string' ? tenantId.trim().toLowerCase() : '';
}

function buildTenantBrandingIndex(source = TENANT_BRANDING) {
  const index = Object.create(null);
  Object.entries(source).forEach(([rawKey, config]) => {
    const normalizedKey = normalizeTenantKey(rawKey);
    if (!normalizedKey || index[normalizedKey]) return;
    index[normalizedKey] = config;
  });
  return index;
}

const TENANT_BRANDING_INDEX = buildTenantBrandingIndex(TENANT_BRANDING);

function lookupTenantBranding(tenantKey) {
  const normalizedKey = normalizeTenantKey(tenantKey);
  if (!normalizedKey) return null;
  return TENANT_BRANDING_INDEX[normalizedKey] || null;
}

function hasDistinctTenantBranding(branding) {
  if (!branding) return false;
  return branding.betriebsName !== DEFAULT_BRANDING.betriebsName
    || branding.appName !== DEFAULT_BRANDING.appName
    || branding.primaryColor !== DEFAULT_BRANDING.primaryColor;
}

function readCachedTenantId() {
  try {
    const cached = coerceTenantForHosting(localStorage.getItem(CACHED_TENANT_ID_KEY));
    if (!cached) return '';
    if (lookupTenantBranding(cached)) return cached;
    console.warn(
      `[CharcuLogic Branding] Unbekannte gecachte tenantId="${cached}" ignoriert — nutze URL- oder Hosting-Vorgabe.`,
    );
    return '';
  } catch (_) {
    return '';
  }
}
function isWhitelabelHostingContext() {
  const override = readDevFirebaseProjectOverride();
  if (override === 'whitelabel') return true;
  if (override === 'production') return false;
  return isWhitelabelFirebaseHost();
}

function coerceTenantForHosting(tenantKey) {
  const normalized = normalizeTenantKey(tenantKey);
  if (!normalized) return '';
  if (isWhitelabelHostingContext() && normalized === TORFABRIK_TENANT_KEY) {
    console.warn(
      '[CharcuLogic Branding] torfabrik auf Whitelabel-Host blockiert — fallback whitelabel_test.',
    );
    return WHITELABEL_DEFAULT_TENANT;
  }
  return normalized;
}

function resolveHostingDefaultTenant() {
  if (isWhitelabelHostingContext()) {
    return HOSTING_DEFAULT_TENANT.whitelabel || WHITELABEL_DEFAULT_TENANT;
  }
  if (isLocalDevHost() && readDevFirebaseProjectOverride() === 'whitelabel') {
    return HOSTING_DEFAULT_TENANT.whitelabel || WHITELABEL_DEFAULT_TENANT;
  }
  return '';
}
/** Reihenfolge: explizit → URL ?tenant= / ?tenantId= → Cache (nur bekannte) → Hosting-Vorgabe. */
function resolveEffectiveTenantId(explicitTenantId) {
  const resolved = (
    normalizeTenantKey(explicitTenantId) ||
    readTenantFromQueryString() ||
    readCachedTenantId() ||
    resolveHostingDefaultTenant()
  );
  return coerceTenantForHosting(resolved);
}

function resolveBranding(tenantId) {
  const key = resolveEffectiveTenantId(tenantId);
  const tenantOverrides = lookupTenantBranding(key);
  if (key && !tenantOverrides) {
    console.warn(
      '[CharcuLogic Branding] Kein Mandanten-Profil gefunden — neutrale White-Label-Vorlage aktiv. '
      + `tenantId="${key}". Bitte TENANT_BRANDING konfigurieren oder anmelden.`,
    );
  }
  if (!key && isWhitelabelHostingContext()) {
    const whitelabelFallback = lookupTenantBranding(WHITELABEL_DEFAULT_TENANT) || {};
    return {
      ...DEFAULT_BRANDING,
      ...whitelabelFallback,
      modules: {
        ...DEFAULT_BRANDING.modules,
        ...(whitelabelFallback.modules || {}),
      },
    };
  }  if (!key && hasDistinctTenantBranding(window.BRANDING)) {
    return window.BRANDING;
  }
  return {
    ...DEFAULT_BRANDING,
    ...(tenantOverrides || {}),
    modules: {
      ...DEFAULT_BRANDING.modules,
      ...(tenantOverrides?.modules || {}),
    },
  };
}

function applyResolvedBranding(tenantId) {
  window.BRANDING = resolveBranding(tenantId);
  if (typeof window.applyBranding === 'function') {
    window.applyBranding();
  }
  initPwaManifestFromBranding(window.BRANDING);
}

function initPwaManifestFromBranding(branding = window.BRANDING) {
  if (!branding || typeof document === 'undefined') return;
  try {
    const manifestEl = document.getElementById('pwa-manifest');
    if (!manifestEl) return;
    const manifestData = {
      name: branding.betriebsName || 'Betriebs-Leitstand',
      short_name: branding.appName || 'CharcuLogic',
      start_url: '.',
      display: 'standalone',
      background_color: branding.lightBg || '#f8f9fa',
      theme_color: branding.primaryColor || '#28a745',
      icons: [
        { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    };
    const blob = new Blob([JSON.stringify(manifestData)], { type: 'application/json' });
    const manifestURL = URL.createObjectURL(blob);
    manifestEl.setAttribute('href', manifestURL);
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute('content', branding.primaryColor || '#28a745');
  } catch (err) {
    console.warn('[CharcuLogic Branding] PWA-Manifest konnte nicht gesetzt werden:', err);
  }
}

window.TENANT_BRANDING = TENANT_BRANDING;
window.TENANT_BRANDING_INDEX = TENANT_BRANDING_INDEX;
window.resolveBranding = resolveBranding;
window.resolveEffectiveTenantId = resolveEffectiveTenantId;
window.resolveHostingDefaultTenant = resolveHostingDefaultTenant;
window.isWhitelabelHostingContext = isWhitelabelHostingContext;
window.applyResolvedBranding = applyResolvedBranding;
window.BRANDING = resolveBranding();
initPwaManifestFromBranding(window.BRANDING);