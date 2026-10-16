/**
 * Mandanten-Stammdaten aus Firestore.
 * tenants/{tenantId}/settings/terminal
 * tenants/{tenantId}/settings/profile
 * tenants/{tenantId}/settings/suppliers  → { laden: [], metzgerei: [], names: [] }
 * Fehlt ein Dokument, gilt der neutrale Standard (PIN an, kein Kassen-Bypass).
 *
 * Lieferanten-SSOT je Bereich (Laden / Metzgerei). Konzeptionell
 * tenants/{tenantId}.suppliers.{laden|metzgerei} – Persistenz über settings/suppliers
 * (Tenant-Root ist per Rules schreibgeschützt).
 */

import {
  defaultSuppliersForArea,
  LADEN_DEFAULT_SUPPLIERS,
  METZ_DEFAULT_SUPPLIERS,
  normalizeDeliveryArea,
} from './receiving.js';

export const NEUTRAL_SUPPLIERS = Object.freeze([...LADEN_DEFAULT_SUPPLIERS]);

export const NEUTRAL_TEAM = Object.freeze(['Mitarbeiter 1', 'Mitarbeiter 2']);

const EMPTY_TERMINAL = Object.freeze({
  isFixedTerminal: false,
  bypassPin: false,
  defaultOperatorName: '',
  terminalUser: '',
});

let terminalState = { ...EMPTY_TERMINAL };
/** @type {{ laden: string[], metzgerei: string[] }} */
let supplierByArea = {
  laden: [],
  metzgerei: [],
};
/** Ob Firestore für den Bereich schon Daten hatte (nicht nur Client-Defaults). */
let supplierAreaFromFirestore = {
  laden: false,
  metzgerei: false,
};
let defaultTeam = [];
let activeTenantId = '';

export function getTerminalSettings() {
  return terminalState;
}

export function getTenantSupplierNames(area = 'laden') {
  const key = normalizeDeliveryArea(area);
  const stored = supplierByArea[key] || [];
  if (stored.length) return [...stored];
  return defaultSuppliersForArea(key);
}

/** Strikt getrennte Bereichs-Listen (ohne Cross-Area-Fallback). */
export function getTenantSuppliersByArea() {
  return {
    laden: getTenantSupplierNames('laden'),
    metzgerei: getTenantSupplierNames('metzgerei'),
  };
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
    if (/^sonstig/i.test(name)) return;
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

function applySupplierDoc(supplierDoc, rootSuppliers = null) {
  const nested = rootSuppliers && typeof rootSuppliers === 'object' ? rootSuppliers : null;
  const ladenFromRoot = cleanNameList(nested?.laden);
  const metzFromRoot = cleanNameList(nested?.metzgerei);
  const ladenFromSettings = cleanNameList(supplierDoc?.laden);
  const metzFromSettings = cleanNameList(supplierDoc?.metzgerei);

  // Strikte Trennung: nur area-spezifische Felder laden/metzgerei.
  // Legacy `names`/`suppliers` wird NICHT mehr in beide Bereiche kopiert —
  // das mischte Laden- und Metzgerei-Lieferanten im Dropdown.
  const laden = ladenFromSettings.length
    ? ladenFromSettings
    : (ladenFromRoot.length ? ladenFromRoot : []);
  const metzgerei = metzFromSettings.length
    ? metzFromSettings
    : (metzFromRoot.length ? metzFromRoot : []);

  supplierByArea = {
    laden,
    metzgerei,
  };
  supplierAreaFromFirestore = {
    laden: Boolean(laden.length),
    metzgerei: Boolean(metzgerei.length),
  };
}

function publish(tenantId) {
  activeTenantId = String(tenantId || '').trim();
  window.__tenantDefaultTeam = getTenantDefaultTeam();
  window.getTenantSupplierNames = getTenantSupplierNames;
  window.getTenantSuppliersByArea = getTenantSuppliersByArea;
  window.getTerminalSettings = getTerminalSettings;
  window.addTenantSupplierName = addTenantSupplierName;
  window.applyLocalSupplierLists = applyLocalSupplierLists;
  const byArea = getTenantSuppliersByArea();
  window.dispatchEvent(new CustomEvent('charculogic:tenant-settings', {
    detail: {
      tenantId: activeTenantId,
      terminal: getTerminalSettings(),
      suppliers: byArea.laden,
      suppliersByArea: byArea,
      suppliersLaden: byArea.laden,
      suppliersMetzgerei: byArea.metzgerei,
      defaultTeam: getTenantDefaultTeam(),
    },
  }));
}

/**
 * Lädt Terminal, Profil und Lieferanten. Wirft nicht — bei Fehler bleiben die Defaults.
 */
export async function loadTenantShopSettings(db, tenantId) {
  const id = String(tenantId || '').trim();
  terminalState = { ...EMPTY_TERMINAL };
  supplierByArea = { laden: [], metzgerei: [] };
  supplierAreaFromFirestore = { laden: false, metzgerei: false };
  defaultTeam = [];
  if (!db || !id) {
    publish(id);
    return {
      terminal: terminalState,
      suppliers: getTenantSupplierNames('laden'),
      suppliersByArea: {
        laden: getTenantSupplierNames('laden'),
        metzgerei: getTenantSupplierNames('metzgerei'),
      },
      profile: null,
    };
  }

  let profile = null;
  try {
    const [terminalDoc, profileDoc, supplierDoc, tenantSnap] = await Promise.all([
      readSettingsDoc(db, id, 'terminal'),
      readSettingsDoc(db, id, 'profile'),
      readSettingsDoc(db, id, 'suppliers'),
      db.collection('tenants').doc(id).get().catch(() => null),
    ]);
    terminalState = readTerminal(terminalDoc);
    profile = readProfile(profileDoc);
    const rootSuppliers = tenantSnap?.exists ? (tenantSnap.data()?.suppliers || null) : null;
    applySupplierDoc(supplierDoc, rootSuppliers);
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
    supplierByArea = { laden: [], metzgerei: [] };
    supplierAreaFromFirestore = { laden: false, metzgerei: false };
    defaultTeam = [];
  }

  publish(id);
  return {
    terminal: getTerminalSettings(),
    suppliers: getTenantSupplierNames('laden'),
    suppliersByArea: {
      laden: getTenantSupplierNames('laden'),
      metzgerei: getTenantSupplierNames('metzgerei'),
    },
    profile,
  };
}

/**
 * Admin-UI: Bereichs-Listen lokal setzen (nach Speichern in settings/suppliers).
 * @param {{ laden?: string[], metzgerei?: string[], tenantId?: string }} lists
 */
export function applyLocalSupplierLists(lists = {}) {
  const laden = cleanNameList(lists.laden);
  const metzgerei = cleanNameList(lists.metzgerei);
  supplierByArea = { laden, metzgerei };
  supplierAreaFromFirestore = {
    laden: laden.length > 0,
    metzgerei: metzgerei.length > 0,
  };
  publish(lists.tenantId || activeTenantId);
  return {
    laden: getTenantSupplierNames('laden'),
    metzgerei: getTenantSupplierNames('metzgerei'),
  };
}

/**
 * Neuen Lieferanten für den Bereich speichern (Firestore settings/suppliers + lokaler Cache).
 * @param {'laden'|'metzgerei'} area
 * @param {string} name
 * @param {{ db?: any, tenantId?: string, actor?: string }} [options]
 */
export async function addTenantSupplierName(area, name, options = {}) {
  const key = normalizeDeliveryArea(area);
  const cleaned = String(name || '').trim();
  if (!cleaned || /^sonstig/i.test(cleaned)) {
    return { ok: false, reason: 'invalid' };
  }

  const hadFirestoreData = supplierAreaFromFirestore[key] === true;
  const current = getTenantSupplierNames(key);
  if (current.some((entry) => entry.toLowerCase() === cleaned.toLowerCase())) {
    supplierByArea[key] = current;
    publish(options.tenantId || activeTenantId);
    return { ok: true, name: cleaned, alreadyExisted: true };
  }

  const nextList = cleanNameList([...current, cleaned]);
  supplierByArea[key] = nextList;
  supplierAreaFromFirestore[key] = true;
  publish(options.tenantId || activeTenantId);

  const db = options.db;
  const tenantId = String(options.tenantId || activeTenantId || '').trim();
  if (!db || !tenantId) {
    return { ok: true, name: cleaned, queued: false, offline: true };
  }

  try {
    const firebaseApi = typeof firebase !== 'undefined' ? firebase : null;
    const arrayUnion = firebaseApi?.firestore?.FieldValue?.arrayUnion;
    const serverTimestamp = firebaseApi?.firestore?.FieldValue?.serverTimestamp;
    const ref = db.collection('tenants').doc(tenantId).collection('settings').doc('suppliers');
    const payload = {
      tenantId,
      updatedAt: serverTimestamp ? serverTimestamp() : new Date().toISOString(),
      updatedBy: String(options.actor || 'Team').trim() || 'Team',
    };
    // Erste Persistenz: Defaults + neuer Name; danach arrayUnion.
    if (!hadFirestoreData || typeof arrayUnion !== 'function') {
      payload[key] = nextList;
    } else {
      payload[key] = arrayUnion(cleaned);
    }
    if (typeof arrayUnion === 'function') {
      payload.names = arrayUnion(cleaned);
    } else {
      payload.names = cleanNameList([
        ...getTenantSupplierNames('laden'),
        ...getTenantSupplierNames('metzgerei'),
        cleaned,
      ]);
    }
    await ref.set(payload, { merge: true });
    return { ok: true, name: cleaned, persisted: true };
  } catch (err) {
    console.error('[CharcuLogic] Lieferant konnte nicht gespeichert werden:', err);
    return { ok: true, name: cleaned, persisted: false, error: err };
  }
}

export { LADEN_DEFAULT_SUPPLIERS, METZ_DEFAULT_SUPPLIERS };
