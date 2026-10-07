/**
 * Mandanten-Stammdaten aus Firestore.
 * tenants/{tenantId}/settings/terminal
 * tenants/{tenantId}/settings/profile
 * tenants/{tenantId}/settings/suppliers
 * Fehlt ein Dokument, gilt der neutrale Standard (PIN an, kein Kassen-Bypass).
 */

export const NEUTRAL_SUPPLIERS = Object.freeze([
  'Eigener Wareneingang',
  'Großhandel',
  'Lieferant 1',
]);

export const NEUTRAL_TEAM = Object.freeze(['Mitarbeiter 1', 'Mitarbeiter 2']);

const EMPTY_TERMINAL = Object.freeze({
  isFixedTerminal: false,
  bypassPin: false,
  defaultOperatorName: '',
  terminalUser: '',
});

let terminalState = { ...EMPTY_TERMINAL };
let supplierNames = [];
let defaultTeam = [];

export function getTerminalSettings() {
  return terminalState;
}

export function getTenantSupplierNames() {
  return supplierNames.length ? [...supplierNames] : [...NEUTRAL_SUPPLIERS];
}

export function getTenantDefaultTeam() {
  return defaultTeam.length ? [...defaultTeam] : [...NEUTRAL_TEAM];
}

function cleanNameList(value) {
  const source = Array.isArray(value) ? value : [];
  const names = [];
  source.forEach((entry) => {
    const name = String(entry || '').trim();
    if (!name) return;
    if (names.some((existing) => existing.toLowerCase() === name.toLowerCase())) return;
    names.push(name);
  });
  return names.slice(0, 40);
}

function readTerminal(data) {
  if (!data || typeof data !== 'object') return { ...EMPTY_TERMINAL };
  const isFixedTerminal = data.isFixedTerminal === true || data.fixedTerminalEnabled === true;
  const bypassPin = data.bypassPin === true || data.requirePin === false;
  return {
    isFixedTerminal,
    bypassPin,
    defaultOperatorName: String(data.defaultOperatorName || '').trim(),
    terminalUser: String(data.terminalUser || data.email || '').trim(),
  };
}

function readProfile(data) {
  if (!data || typeof data !== 'object') return null;
  return {
    betriebsName: String(data.betriebsName || data.companyName || data.displayName || '').trim(),
    appName: String(data.appName || '').trim(),
    primaryColor: String(data.primaryColor || '').trim(),
    primaryColorHover: String(data.primaryColorHover || '').trim(),
    darkHeaderBg: String(data.darkHeaderBg || '').trim(),
    logoUrl: String(data.logoUrl || '').trim(),
    standardBereich: String(data.standardBereich || '').trim(),
    defaultTeam: cleanNameList(data.defaultTeam || data.employees),
    terminalUser: String(data.terminalUser || '').trim(),
  };
}

async function readSettingsDoc(db, tenantId, docId) {
  const snap = await db.collection('tenants').doc(tenantId).collection('settings').doc(docId).get();
  return snap.exists ? (snap.data() || null) : null;
}

function publish(tenantId) {
  window.__tenantDefaultTeam = getTenantDefaultTeam();
  window.getTenantSupplierNames = getTenantSupplierNames;
  window.getTerminalSettings = getTerminalSettings;
  window.dispatchEvent(new CustomEvent('charculogic:tenant-settings', {
    detail: {
      tenantId,
      terminal: getTerminalSettings(),
      suppliers: getTenantSupplierNames(),
      defaultTeam: getTenantDefaultTeam(),
    },
  }));
}

/**
 * Lädt Terminal, Profil und Lieferanten. Wirft nicht — bei Fehler bleiben die neutralen Defaults.
 */
export async function loadTenantShopSettings(db, tenantId) {
  const id = String(tenantId || '').trim();
  terminalState = { ...EMPTY_TERMINAL };
  supplierNames = [];
  defaultTeam = [];
  if (!db || !id) {
    publish(id);
    return { terminal: terminalState, suppliers: getTenantSupplierNames(), profile: null };
  }

  let profile = null;
  try {
    const [terminalDoc, profileDoc, supplierDoc] = await Promise.all([
      readSettingsDoc(db, id, 'terminal'),
      readSettingsDoc(db, id, 'profile'),
      readSettingsDoc(db, id, 'suppliers'),
    ]);
    terminalState = readTerminal(terminalDoc);
    profile = readProfile(profileDoc);
    supplierNames = cleanNameList(supplierDoc?.names || supplierDoc?.suppliers);
    defaultTeam = profile?.defaultTeam || [];
    if (profile?.terminalUser && !terminalState.terminalUser) {
      terminalState = { ...terminalState, terminalUser: profile.terminalUser };
    }
    if (typeof window.applyTenantProfile === 'function') {
      window.applyTenantProfile(profile, terminalState);
    }
  } catch (err) {
    console.warn('[CharcuLogic] Betriebs-Settings konnten nicht geladen werden:', err);
    terminalState = { ...EMPTY_TERMINAL };
    supplierNames = [];
    defaultTeam = [];
  }

  publish(id);
  return {
    terminal: getTerminalSettings(),
    suppliers: getTenantSupplierNames(),
    profile,
  };
}
