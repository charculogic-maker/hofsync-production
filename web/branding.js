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
    haccp: true,
    orders: true,
  },
};

const TENANT_BRANDING = {
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
      haccp: true,
      orders: true,
    },
  },
};

import { readDevFirebaseProjectOverride, readDevTenantOverride } from './dev-guards.js';

const CACHED_TENANT_ID_KEY = 'charculogic_cached_tenant_id';

/** Whitelabel-Test-Hosting → Mandant torfabrik, solange noch kein Login-Cache existiert. */
const WHITELABEL_HOST_MARKERS = [
  'charculogic-whitelabel-test.web.app',
  'charculogic-whitelabel-test.firebaseapp.com',
];

const HOSTING_DEFAULT_TENANT = {
  whitelabel: 'torfabrik',
};

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
