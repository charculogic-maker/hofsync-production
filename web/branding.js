/******* CHARCULOGIC - WHITE LABEL CONFIGURATION *******/
/**
 * Neutrales Boot-/Fallback-Label für unbekannte Mandanten.
 * StevesHof bleibt über TENANT_BRANDING.steveshof_hauptbetrieb geschützt.
 */
export const DEFAULT_BRAND_TITLE = 'Mein Betrieb';
export const STEVESHOF_BRAND_TITLE = 'StevesHof Hofladen';
export const BRAND_TITLE_STORAGE_KEY = 'charculogic_brand_title';

const DEFAULT_BRANDING = {
  appName: 'HofSync',
  betriebsName: DEFAULT_BRAND_TITLE,
  logoUrl: '/icon-192.png',
  primaryColor: '#0284c7',
  primaryColorHover: '#0369a1',
  darkHeaderBg: '#2b1810',
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
    averyLabels: false,
    knowledge: false,
    cutGlossary: false,
    haccp: true,
    orders: false,
    batches: true,
    retterBox: false,
    chargenDoku: true,
    employeePin: true,
    employeeAuth: 'pin',
    deliveryParser: false,
  },
};

const TENANT_BRANDING = {
  /**
   * Soft-Launch StevesHof – Offline-/Boot-Fallback.
   * Firestore enabledModules bleibt führend; team und orders sind unabhängig.
   */
  steveshof_hauptbetrieb: {
    betriebsName: STEVESHOF_BRAND_TITLE,
    appName: 'HofSync',
    darkHeaderBg: '#2b1810',
    modules: {
      orders: true,
      team: true,
      teamboard: true,
      mhdMonitor: true,
      wareneingang: true,
      wareneingangMetzgerei: true,
      wurstkueche: true,
      averyLabels: true,
      haccp: true,
      batches: true,
      retterBox: false,
    },
  },
};

const CACHED_TENANT_ID_KEY = 'charculogic_cached_tenant_id';

function isStevesHofTenantKey(tenantKey) {
  const key = normalizeTenantKey(tenantKey);
  return key === 'steveshof_hauptbetrieb' || key === 'steveshof';
}

function readCachedBrandTitle() {
  try {
    const cached = String(localStorage.getItem(BRAND_TITLE_STORAGE_KEY) || '').trim();
    if (cached) return cached;
  } catch (_) { /* private mode */ }
  return '';
}

/**
 * Titel nur wiederverwenden, wenn er zum aktuellen Mandanten passt —
 * verhindert Sticky „StevesHof Hofladen“ nach Login in einen anderen Betrieb.
 */
function readCachedBrandTitleForTenant(tenantKey) {
  const cachedTitle = readCachedBrandTitle();
  if (!cachedTitle) return '';
  const normalizedTenant = normalizeTenantKey(tenantKey);
  const cachedTenant = readCachedTenantId();
  if (normalizedTenant && cachedTenant && normalizedTenant !== cachedTenant) {
    return '';
  }
  // Alter Soft-Launch-Cache: StevesHof-Titel nur für StevesHof-Mandanten behalten.
  if (
    cachedTitle === STEVESHOF_BRAND_TITLE
    && normalizedTenant
    && !isStevesHofTenantKey(normalizedTenant)
  ) {
    return '';
  }
  return cachedTitle;
}

function persistBrandTitle(title) {
  const clean = String(title || '').trim() || DEFAULT_BRAND_TITLE;
  try {
    localStorage.setItem(BRAND_TITLE_STORAGE_KEY, clean);
  } catch (_) { /* private mode */ }
  return clean;
}

function syncCurrentTenantConfig(tenantId, displayName) {
  const id = String(tenantId || '').trim();
  const name = String(displayName || '').trim();
  const previous = (typeof window !== 'undefined' && window.currentTenantConfig
    && typeof window.currentTenantConfig === 'object')
    ? window.currentTenantConfig
    : {};
  const next = {
    ...previous,
    tenantId: id || String(previous.tenantId || '').trim(),
    displayName: name || String(previous.displayName || '').trim(),
    name: name || String(previous.name || previous.displayName || '').trim(),
  };
  if (typeof window !== 'undefined') {
    window.currentTenantConfig = next;
  }
  return next;
}

/**
 * Sichtbarer Betriebsname für Header, Skeletons, Etiketten.
 * StevesHof_Hauptbetrieb → „StevesHof Hofladen“; sonst Firestore-/Config-Name.
 */
function getTenantDisplayName() {
  const cfg = (typeof window !== 'undefined' && window.currentTenantConfig) || {};
  const fromConfig = String(cfg.displayName || cfg.name || '').trim();
  if (fromConfig) return fromConfig;

  const fromBranding = String(window.BRANDING?.betriebsName || '').trim();
  if (fromBranding && fromBranding !== DEFAULT_BRAND_TITLE) return fromBranding;

  const tenantKey = resolveEffectiveTenantId(cfg.tenantId || '');
  const override = lookupTenantBranding(tenantKey);
  if (override?.betriebsName) return String(override.betriebsName).trim();
  if (isStevesHofTenantKey(tenantKey)) return STEVESHOF_BRAND_TITLE;

  if (fromBranding) return fromBranding;
  return DEFAULT_BRAND_TITLE;
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
  const cachedTitle = readCachedBrandTitleForTenant(key);
  const merged = {
    ...DEFAULT_BRANDING,
    betriebsName: DEFAULT_BRANDING.betriebsName,
    ...(tenantOverrides || {}),
    modules: {
      ...DEFAULT_BRANDING.modules,
      ...(tenantOverrides?.modules || {}),
    },
  };
  // Tenant-Override gewinnt; sonst nur passenden Cache-Titel (kein Cross-Tenant-Leak).
  if (tenantOverrides?.betriebsName) {
    merged.betriebsName = tenantOverrides.betriebsName;
  } else if (cachedTitle) {
    merged.betriebsName = cachedTitle;
  } else if (isStevesHofTenantKey(key)) {
    merged.betriebsName = STEVESHOF_BRAND_TITLE;
  }
  return merged;
}

function applyResolvedBranding(tenantId) {
  const key = resolveEffectiveTenantId(tenantId);
  window.BRANDING = resolveBranding(key);
  syncCurrentTenantConfig(key, window.BRANDING?.betriebsName);
  // Nach Rebuild: gecachte enabledModules wieder einspielen (verhindert FOUC Branding-Defaults).
  try {
    const cached = typeof window.readCachedEffectiveModules === 'function'
      ? window.readCachedEffectiveModules()
      : null;
    if (cached && typeof window.applyEffectiveModulesToBranding === 'function') {
      window.applyEffectiveModulesToBranding(cached, window.BRANDING);
    }
  } catch (_) { /* Cache optional beim Branding-Boot */ }
  if (typeof window.applyBranding === 'function') {
    window.applyBranding();
  }
  initPwaManifestFromBranding(window.BRANDING);
}

function applyTenantProfile(profile, terminal, tenantId = '') {
  const current = window.BRANDING || resolveBranding(tenantId);
  const next = { ...current, modules: { ...(current.modules || {}) } };
  const profileName = String(
    profile?.betriebsName || profile?.displayName || profile?.name || profile?.companyName || '',
  ).trim();
  if (profileName) {
    next.betriebsName = persistBrandTitle(profileName);
  }
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
  const resolvedTenantId = String(tenantId || resolveEffectiveTenantId() || '').trim();
  syncCurrentTenantConfig(resolvedTenantId, next.betriebsName);
  if (typeof window.applyBranding === 'function') window.applyBranding();
  initPwaManifestFromBranding(window.BRANDING);
}

function initPwaManifestFromBranding(branding = window.BRANDING) {
  if (!branding || typeof document === 'undefined') return;
  try {
    const manifestEl = document.getElementById('pwa-manifest');
    if (!manifestEl) return;
    const splashColor = branding.darkHeaderBg || '#2b1810';
    const manifestData = {
      name: branding.betriebsName || 'Betriebs-Leitstand',
      short_name: branding.appName || 'CharcuLogic',
      start_url: '.',
      display: 'standalone',
      background_color: splashColor,
      theme_color: splashColor,
      icons: [
        { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    };
    const blob = new Blob([JSON.stringify(manifestData)], { type: 'application/json' });
    const manifestURL = URL.createObjectURL(blob);
    manifestEl.setAttribute('href', manifestURL);
    document.querySelectorAll('meta[name="theme-color"]').forEach((themeMeta) => {
      themeMeta.setAttribute('content', splashColor);
    });
    try {
      if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(splashColor)) {
        localStorage.setItem('charculogic_brand_bg', splashColor);
      }
      if (branding.primaryColor && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(branding.primaryColor)) {
        localStorage.setItem('charculogic_brand_primary', branding.primaryColor);
      }
      if (branding.betriebsName) persistBrandTitle(branding.betriebsName);
    } catch (_) { /* private mode / blocked storage */ }
  } catch (err) {
    console.warn('[CharcuLogic Branding] PWA-Manifest konnte nicht gesetzt werden:', err);
  }
}

window.TENANT_BRANDING = TENANT_BRANDING;
window.TENANT_BRANDING_INDEX = TENANT_BRANDING_INDEX;
window.DEFAULT_BRAND_TITLE = DEFAULT_BRAND_TITLE;
window.STEVESHOF_BRAND_TITLE = STEVESHOF_BRAND_TITLE;
window.BRAND_TITLE_STORAGE_KEY = BRAND_TITLE_STORAGE_KEY;
window.currentTenantConfig = window.currentTenantConfig || {
  tenantId: '',
  displayName: '',
  name: '',
};
window.readCachedBrandTitle = readCachedBrandTitle;
window.persistBrandTitle = persistBrandTitle;
window.resolveBranding = resolveBranding;
window.resolveEffectiveTenantId = resolveEffectiveTenantId;
window.resolveHostingDefaultTenant = resolveHostingDefaultTenant;
window.isWhitelabelHostingContext = isWhitelabelHostingContext;
window.applyResolvedBranding = applyResolvedBranding;
window.applyTenantProfile = applyTenantProfile;
window.syncCurrentTenantConfig = syncCurrentTenantConfig;
window.getTenantDisplayName = getTenantDisplayName;
window.BRANDING = resolveBranding();
syncCurrentTenantConfig(resolveEffectiveTenantId(), window.BRANDING?.betriebsName || DEFAULT_BRAND_TITLE);
if (window.BRANDING?.betriebsName) persistBrandTitle(window.BRANDING.betriebsName);
initPwaManifestFromBranding(window.BRANDING);