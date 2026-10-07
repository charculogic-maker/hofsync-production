/******* CHARCULOGIC - WHITE LABEL CONFIGURATION *******/
const DEFAULT_BRANDING = {  appName: 'HofSync',
  betriebsName: 'Mein Hofladen / Metzgerei',
  logoUrl: '/icon-192.png',
  primaryColor: '#0284c7',
  primaryColorHover: '#0369a1',
  darkHeaderBg: '#0c4a6e',
  textOnHeader: '#ffffff',
  accentAlert: '#dc3545',
  lightBg: '#f1f5f9',
  supportEmail: 'support@charculogic.de',
  standardBereich: 'Allgemein',
  modules: {
    teamboard: false,
    team: false,
    mhdMonitor: true,
    wareneingang: true,
    wareneingangMetzgerei: true,
    rezeptAudit: true,
    bratwurstMasterlist: false,
    wurstkueche: true,
    knowledge: false,
    cutGlossary: false,
    haccp: true,
    orders: false,
    retterBox: false,
    chargenDoku: true,
    employeePin: true,
    employeeAuth: 'pin',
    deliveryParser: true,
  },
};

const TENANT_BRANDING = {};

const CACHED_TENANT_ID_KEY = 'charculogic_cached_tenant_id';

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
    return coerceTenantForHosting(localStorage.getItem(CACHED_TENANT_ID_KEY)) || '';
  } catch (_) {
    return '';
  }
}
function isWhitelabelHostingContext() {
  return false;
}

function coerceTenantForHosting(tenantKey) {
  return normalizeTenantKey(tenantKey);
}

function resolveHostingDefaultTenant() {
  return '';
}
/** Reihenfolge: explizit → URL ?tenant= / ?tenantId= → Cache → Hosting-Vorgabe. */
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
  if (!key && hasDistinctTenantBranding(window.BRANDING)) {
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

function applyTenantProfile(profile, terminal) {
  const current = window.BRANDING || resolveBranding();
  const next = { ...current, modules: { ...(current.modules || {}) } };
  if (profile?.betriebsName) next.betriebsName = profile.betriebsName;
  if (profile?.appName) next.appName = profile.appName;
  if (profile?.primaryColor) next.primaryColor = profile.primaryColor;
  if (profile?.primaryColorHover) next.primaryColorHover = profile.primaryColorHover;
  if (profile?.darkHeaderBg) next.darkHeaderBg = profile.darkHeaderBg;
  if (profile?.logoUrl) next.logoUrl = profile.logoUrl;
  if (profile?.standardBereich) next.standardBereich = profile.standardBereich;
  const terminalUser = String(terminal?.terminalUser || profile?.terminalUser || '').trim();
  if (terminalUser) next.terminalAuth = { email: terminalUser };
  if (terminal?.bypassPin === true) next.modules.employeePin = false;
  window.BRANDING = next;
  if (typeof window.applyBranding === 'function') window.applyBranding();
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
window.applyTenantProfile = applyTenantProfile;
window.BRANDING = resolveBranding();
initPwaManifestFromBranding(window.BRANDING);