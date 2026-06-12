/******* CHARCULOGIC - WHITE LABEL CONFIGURATION *******/

const DEFAULT_BRANDING = {
  appName: 'Betriebs-App',
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
    wurstkueche: true,
    knowledge: false,
    cutGlossary: false,
    haccp: true,
    orders: true,
    retterBox: false,
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
      wurstkueche: true,
      knowledge: true,
      cutGlossary: false,
      haccp: true,
      orders: false,
      batches: true,
      retterBox: true,
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
      employeePin: true,
      employeeAuth: 'pin',
    },
  },
};

const CACHED_TENANT_ID_KEY = 'charculogic_cached_tenant_id';

/** Whitelabel-Test-Hosting → Mandant torfabrik, solange noch kein Login-Cache existiert. */
const WHITELABEL_HOST_MARKERS = [
  'charculogic-whitelabel-test.web.app',
  'charculogic-whitelabel-test.firebaseapp.com',
];

const HOSTING_DEFAULT_TENANT = {
  whitelabel: 'torfabrik',
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

function readDevTenantOverride() {
  if (!isLocalDevHost()) return '';
  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('tenant') || params.get('tenantId');
    if (fromQuery) return String(fromQuery).trim().toLowerCase();
  } catch (_) { /* noop */ }
  return '';
}

function normalizeTenantKey(tenantId) {
  return typeof tenantId === 'string' ? tenantId.trim().toLowerCase() : '';
}

function readCachedTenantId() {
  try {
    return normalizeTenantKey(localStorage.getItem(CACHED_TENANT_ID_KEY));
  } catch (_) {
    return '';
  }
}

function isWhitelabelHostingContext() {
  const override = readDevFirebaseProjectOverride();
  if (override === 'whitelabel') return true;
  if (override === 'production') return false;
  const host = String(window.location?.hostname || '').toLowerCase();
  return WHITELABEL_HOST_MARKERS.some((marker) => host === marker || host.endsWith(`.${marker}`));
}

function resolveHostingDefaultTenant() {
  if (isWhitelabelHostingContext()) return HOSTING_DEFAULT_TENANT.whitelabel || '';
  return '';
}

/** Reihenfolge: explizit → Cache → URL ?tenant= → Hosting-Vorwahl. */
function resolveEffectiveTenantId(explicitTenantId) {
  return (
    normalizeTenantKey(explicitTenantId) ||
    readCachedTenantId() ||
    readDevTenantOverride() ||
    resolveHostingDefaultTenant()
  );
}

function resolveBranding(tenantId) {
  const key = resolveEffectiveTenantId(tenantId);
  const tenantOverrides = key ? TENANT_BRANDING[key] : null;
  if (!key || !tenantOverrides) {
    console.warn(
      '[CharcuLogic Branding] Kein Mandanten-Profil gefunden — neutrale White-Label-Vorlage aktiv. '
      + 'Bitte TENANT_BRANDING konfigurieren oder anmelden.',
    );
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
}

window.TENANT_BRANDING = TENANT_BRANDING;
window.resolveBranding = resolveBranding;
window.resolveEffectiveTenantId = resolveEffectiveTenantId;
window.resolveHostingDefaultTenant = resolveHostingDefaultTenant;
window.applyResolvedBranding = applyResolvedBranding;
window.BRANDING = resolveBranding();
