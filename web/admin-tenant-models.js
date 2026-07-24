/**
 * Tenant-Admin Datenmodelle & lokale Hilfen für /dev-dashboard
 *
 * @typedef {'admin' | 'employee' | 'helper'} TenantRole
 *
 * @typedef {Object} Tenant
 * @property {string} tenantId
 * @property {string} displayName
 * @property {string} [logoUrl]
 * @property {'active'|'inactive'} [status]
 * @property {Record<string, boolean>} [enabledModules]
 *
 * @typedef {Object} TenantUser
 * @property {string} uid
 * @property {string} email
 * @property {string} displayName
 * @property {TenantRole} role
 * @property {string} tenantId
 * @property {Record<string, boolean>} [allowedModules]
 * @property {number|null} [createdAt]
 *
 * @typedef {Object} TenantAuditEvent
 * @property {string} id
 * @property {string} tenantId
 * @property {string} action
 * @property {string} summary
 * @property {string} [actorEmail]
 * @property {number} at
 * @property {'security'|'change'|'info'} [category]
 */

const SETTINGS_STORAGE_PREFIX = 'charculogic_tenant_settings_v1_';
const AUDIT_STORAGE_PREFIX = 'charculogic_tenant_audit_v1_';
const AUDIT_MAX_EVENTS = 80;

/** Kurzhinweis: Audit-Trail liegt nur lokal (Laden-iPhone / Browser), nicht zentral. */
export const AUDIT_STORAGE_SCOPE_LABEL = 'Lokal auf diesem Gerät';
export const AUDIT_STORAGE_SCOPE_HINT =
  'Ereignisse werden nur auf diesem Gerät gespeichert – noch keine zentrale Ablage.';

/** @returns {TenantRole[]} */
export const TENANT_ROLES = Object.freeze(['admin', 'employee', 'helper']);

/**
 * @param {string} tenantId
 * @returns {string}
 */
function settingsKey(tenantId) {
  return `${SETTINGS_STORAGE_PREFIX}${String(tenantId || '').trim()}`;
}

/**
 * @param {string} tenantId
 * @returns {string}
 */
function auditKey(tenantId) {
  return `${AUDIT_STORAGE_PREFIX}${String(tenantId || '').trim()}`;
}

/**
 * @param {string} tenantId
 * @returns {{ displayName?: string, logoUrl?: string }}
 */
export function readTenantSettingsDraft(tenantId) {
  try {
    const raw = localStorage.getItem(settingsKey(tenantId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

/**
 * @param {string} tenantId
 * @param {{ displayName?: string, logoUrl?: string }} draft
 */
export function writeTenantSettingsDraft(tenantId, draft = {}) {
  try {
    localStorage.setItem(
      settingsKey(tenantId),
      JSON.stringify({
        displayName: String(draft.displayName || '').trim(),
        logoUrl: String(draft.logoUrl || '').trim(),
        updatedAt: Date.now(),
      }),
    );
  } catch (err) {
    console.warn('[Tenant-Admin] Einstellungen konnten lokal nicht gespeichert werden:', err);
  }
}

/**
 * @param {string} tenantId
 * @returns {TenantAuditEvent[]}
 */
export function readTenantAuditEvents(tenantId) {
  try {
    const raw = localStorage.getItem(auditKey(tenantId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

/**
 * @param {string} tenantId
 * @param {TenantAuditEvent[]} events
 */
function writeTenantAuditEvents(tenantId, events) {
  try {
    localStorage.setItem(auditKey(tenantId), JSON.stringify(events.slice(0, AUDIT_MAX_EVENTS)));
  } catch (err) {
    console.warn('[Tenant-Admin] Protokoll konnte lokal nicht gespeichert werden:', err);
  }
}

/**
 * @param {string} tenantId
 * @param {Omit<TenantAuditEvent, 'id'|'tenantId'|'at'> & { at?: number }} event
 * @returns {TenantAuditEvent}
 */
export function appendTenantAuditEvent(tenantId, event) {
  const cleanTenant = String(tenantId || '').trim();
  if (!cleanTenant) return null;
  const entry = {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    tenantId: cleanTenant,
    action: String(event.action || 'change').trim(),
    summary: String(event.summary || '').trim() || 'Änderung',
    actorEmail: String(event.actorEmail || '').trim(),
    category: event.category || 'change',
    at: typeof event.at === 'number' ? event.at : Date.now(),
  };
  const next = [entry, ...readTenantAuditEvents(cleanTenant)].slice(0, AUDIT_MAX_EVENTS);
  writeTenantAuditEvents(cleanTenant, next);
  return entry;
}

/**
 * Seed-Beispiele nur wenn noch kein Protokoll existiert (UX-Mock).
 * @param {string} tenantId
 * @param {string} [betriebsName]
 * @returns {TenantAuditEvent[]}
 */
export function ensureTenantAuditSeed(tenantId, betriebsName = 'Betrieb') {
  const cleanTenant = String(tenantId || '').trim();
  if (!cleanTenant) return [];
  const existing = readTenantAuditEvents(cleanTenant);
  if (existing.length) return existing;
  const now = Date.now();
  const seed = [
    {
      id: 'seed_login',
      tenantId: cleanTenant,
      action: 'login',
      summary: `Verwaltung für ${betriebsName} geöffnet`,
      actorEmail: '',
      category: 'security',
      at: now - 60_000,
    },
    {
      id: 'seed_modules',
      tenantId: cleanTenant,
      action: 'modules',
      summary: 'Module für den Betrieb geprüft',
      actorEmail: '',
      category: 'info',
      at: now - 120_000,
    },
  ];
  writeTenantAuditEvents(cleanTenant, seed);
  return seed;
}

/**
 * @param {TenantUser[]} users
 * @returns {{ total: number, admins: number, employees: number }}
 */
export function summarizeTenantUsers(users = []) {
  const list = Array.isArray(users) ? users : [];
  let admins = 0;
  let employees = 0;
  list.forEach((user) => {
    if (user?.role === 'admin') admins += 1;
    else employees += 1;
  });
  return { total: list.length, admins, employees };
}

/**
 * @param {Record<string, boolean>|null|undefined} enabledModules
 * @param {string[]} moduleKeys
 * @returns {{ enabled: number, total: number }}
 */
export function summarizeTenantModules(enabledModules, moduleKeys = []) {
  const keys = Array.isArray(moduleKeys) ? moduleKeys : [];
  let enabled = 0;
  keys.forEach((key) => {
    if (enabledModules && enabledModules[key] === true) enabled += 1;
  });
  return { enabled, total: keys.length };
}

/**
 * @param {TenantUser[]} users
 * @param {{ query?: string, role?: string }} filters
 * @returns {TenantUser[]}
 */
export function filterTenantUsers(users = [], filters = {}) {
  const query = String(filters.query || '').trim().toLowerCase();
  const role = String(filters.role || '').trim();
  return (Array.isArray(users) ? users : []).filter((user) => {
    if (role && role !== 'all' && user.role !== role) return false;
    if (!query) return true;
    const hay = `${user.displayName || ''} ${user.email || ''}`.toLowerCase();
    return hay.includes(query);
  });
}

/**
 * @param {number|null|undefined} millis
 * @returns {string}
 */
export function formatAuditTime(millis) {
  if (!millis) return '—';
  try {
    return new Date(millis).toLocaleString('de-DE', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch (_) {
    return '—';
  }
}
