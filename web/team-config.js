/**
 * Team-Dashboard Konfiguration (Mitarbeiter, Gruppen) + Push-Vorbereitung
 */

import { writeFirestoreDocOrQueue } from './sync.js';
import { getAuthContext, verifyAdminAction } from './auth.js';
import { getTenantCollection } from './tenant-db.js';
const ACTIVE_EMPLOYEE_STORAGE_KEY = 'charculogic_active_employee';

function getActiveEmployeeNameLocal() {
  try {
    return String(localStorage.getItem(ACTIVE_EMPLOYEE_STORAGE_KEY) || '').trim();
  } catch (_) {
    return '';
  }
}

const TEAM_CONFIG_DOC_ID = 'teamDashboard';
const PUSH_ENABLED_KEY = 'charculogic_push_enabled';
const PUSH_VAPID_KEY = 'charculogic_fcm_vapid_key';

const DEFAULT_EMPLOYEES = ['Stephie', 'Finn', 'Nicole', 'Bettina', 'Heiko', 'Paddy'];
const DEFAULT_GROUPS = {
  finn_stephie: { label: 'Finn & Stephie', members: ['Finn', 'Stephie'] },
  metzgerei: { label: 'Metzgerei', members: ['Nicole', 'Bettina', 'Heiko', 'Paddy'] },
  laden: { label: 'Hofladen / Theke', members: ['Stephie', 'Finn', 'Paddy'] },
};
const DEFAULT_PINS = {
  Stephie: '1122',
  Finn: '2233',
  Nicole: '3344',
  Bettina: '4455',
  Heiko: '5566',
  Paddy: '6677',
};

const TENANT_TEAM_DEFAULTS = {
  torfabrik: {
    employees: ['Stephan', 'Boris', 'Aushilfe'],
    groups: {
      center: { label: 'Center-Team', members: ['Stephan', 'Boris'] },
      aushilfe: { label: 'Aushilfe', members: ['Aushilfe'] },
    },
    pins: {
      Stephan: '1111',
      Boris: '2222',
      Aushilfe: '3333',
    },
  },
};

function getTenantTeamDefaults(tenantId = configState.tenantId) {
  const key = typeof tenantId === 'string' ? tenantId.trim() : '';
  if (TENANT_TEAM_DEFAULTS[key]) {
    const entry = TENANT_TEAM_DEFAULTS[key];
    return {
      employees: [...entry.employees],
      groups: JSON.parse(JSON.stringify(entry.groups)),
      pins: { ...entry.pins },
    };
  }
  return {
    employees: [...DEFAULT_EMPLOYEES],
    groups: JSON.parse(JSON.stringify(DEFAULT_GROUPS)),
    pins: { ...DEFAULT_PINS },
  };
}

function isLegacyStevesHofRoster(employees = []) {
  if (!Array.isArray(employees) || employees.length === 0) return false;
  return employees.every((name) => DEFAULT_EMPLOYEES.includes(name));
}

const configState = {
  db: null,
  tenantId: '',
  getFirebase: () => null,
  unsubscribe: null,
  seedInFlight: false,
  employees: [...DEFAULT_EMPLOYEES],
  groups: JSON.parse(JSON.stringify(DEFAULT_GROUPS)),
};

function needsTorfabrikTeamSeed(data, documentExists) {
  if (configState.tenantId !== 'torfabrik') return false;
  if (!documentExists) return true;
  const employees = Array.isArray(data?.employees)
    ? data.employees.map((n) => String(n).trim()).filter(Boolean)
    : [];
  if (employees.length === 0) return true;
  return isLegacyStevesHofRoster(employees);
}

function buildTorfabrikSeedPayload() {
  const defaults = getTenantTeamDefaults('torfabrik');
  const firebase = configState.getFirebase();
  return {
    employees: defaults.employees,
    groups: defaults.groups,
    tenantId: 'torfabrik',
    updatedAt: firebase?.firestore?.FieldValue?.serverTimestamp?.()
      || new Date().toISOString(),
    updatedBy: getAuthContext()?.email?.split('@')[0] || 'system-seed',
  };
}

async function seedTorfabrikTeamConfigToFirestore() {
  if (configState.seedInFlight || configState.tenantId !== 'torfabrik') return false;
  const ctx = getAuthContext();
  if (!ctx?.isAdmin) {
    console.info('[TeamConfig] TorFabrik-Defaults nur lokal – Firestore-Seed erfordert Admin.');
    return false;
  }

  const ref = configRef();
  if (!ref) return false;

  configState.seedInFlight = true;
  const payload = buildTorfabrikSeedPayload();

  try {
    await writeFirestoreDocOrQueue({
      collectionPath: 'settings',
      docId: TEAM_CONFIG_DOC_ID,
      op: 'set',
      onlineData: payload,
      queueData: {
        ...payload,
        updatedAt: new Date().toISOString(),
      },
      offlineMessage: 'TorFabrik Team-Konfiguration wird synchronisiert.',
    });
    console.info('[TeamConfig] teamDashboard fuer torfabrik mit Standard-Team geseedet.');
    return true;
  } catch (err) {
    console.warn('[TeamConfig] TorFabrik-Seed fehlgeschlagen:', err);
    return false;
  } finally {
    configState.seedInFlight = false;
  }
}

export function getTeamEmployees() {
  return [...configState.employees];
}

export function getTeamGroups() {
  return JSON.parse(JSON.stringify(configState.groups));
}

export function getEmployeePinMap() {
  return { ...getTenantTeamDefaults().pins };
}

export function verifyEmployeePin(employeeName, pin) {
  const cleanName = String(employeeName || '').trim();
  const cleanPin = String(pin || '').trim();
  if (!cleanName || cleanPin.length !== 4) return false;
  return getEmployeePinMap()[cleanName] === cleanPin;
}

export function resolveEmployeeByPin(pin) {
  const cleanPin = String(pin || '').trim();
  if (cleanPin.length !== 4) return null;
  const entry = Object.entries(getEmployeePinMap()).find(([, value]) => value === cleanPin);
  return entry ? entry[0] : null;
}

export function isPushEnabledLocally() {
  try {
    return localStorage.getItem(PUSH_ENABLED_KEY) === '1';
  } catch (_) {
    return false;
  }
}

export function setPushEnabledLocally(enabled) {
  try {
    localStorage.setItem(PUSH_ENABLED_KEY, enabled ? '1' : '0');
  } catch (_) { /* noop */ }
}

export function getStoredVapidKey() {
  try {
    return String(localStorage.getItem(PUSH_VAPID_KEY) || '').trim();
  } catch (_) {
    return '';
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function configRef() {
  if (!configState.db || !configState.tenantId) return null;
  try {
    return getTenantCollection('settings').doc(TEAM_CONFIG_DOC_ID);
  } catch {
    return null;
  }
}

function normalizeConfig(data) {
  const tenantDefaults = getTenantTeamDefaults();
  let employees = Array.isArray(data?.employees)
    ? data.employees.map((n) => String(n).trim()).filter(Boolean)
    : [...tenantDefaults.employees];
  const rawGroups = data?.groups && typeof data.groups === 'object' ? data.groups : {};
  const groups = {};
  Object.entries(rawGroups).forEach(([id, group]) => {
    const key = String(id).trim();
    if (!key) return;
    const label = String(group?.label || key).trim() || key;
    const members = Array.isArray(group?.members)
      ? group.members.map((n) => String(n).trim()).filter(Boolean)
      : [];
    groups[key] = { label, members };
  });
  if (Object.keys(groups).length === 0) {
    Object.assign(groups, JSON.parse(JSON.stringify(tenantDefaults.groups)));
  }

  if (configState.tenantId === 'torfabrik' && data && isLegacyStevesHofRoster(employees)) {
    employees = [...tenantDefaults.employees];
    Object.assign(groups, JSON.parse(JSON.stringify(tenantDefaults.groups)));
  }

  return {
    employees: employees.length ? employees : [...tenantDefaults.employees],
    groups,
  };
}

function applyConfig(config) {
  configState.employees = config.employees;
  configState.groups = config.groups;
  syncEmployeeDatalist();
  window.dispatchEvent(new CustomEvent('charculogic:team-config-changed', { detail: config }));
}

function syncEmployeeDatalist() {
  const datalist = document.getElementById('employee-suggestions');
  if (!datalist) return;
  datalist.innerHTML = configState.employees
    .map((name) => `<option value="${escapeHtml(name)}"></option>`)
    .join('');
}

async function handleTeamConfigSnapshot(snap) {
  const raw = snap.exists ? snap.data() : null;
  if (needsTorfabrikTeamSeed(raw, snap.exists)) {
    const seeded = await seedTorfabrikTeamConfigToFirestore();
    if (seeded) return;
  }
  const config = normalizeConfig(raw);
  applyConfig(config);
  renderAdminTeamConfigForm(config);
}

function subscribeTeamConfig() {
  configState.unsubscribe?.();
  const ref = configRef();
  if (!ref) return;
  configState.unsubscribe = ref.onSnapshot(
    (snap) => {
      handleTeamConfigSnapshot(snap).catch((err) => {
        console.warn('[TeamConfig] Snapshot-Verarbeitung:', err);
        applyConfig(normalizeConfig(snap.exists ? snap.data() : null));
      });
    },
    (err) => console.warn('[TeamConfig] Stream:', err),
  );
}

function readAdminConfigFromForm() {
  const employeesRaw = document.getElementById('team-config-employees')?.value || '';
  const employees = employeesRaw
    .split(/[\n,;]+/)
    .map((n) => n.trim())
    .filter(Boolean);

  const groups = {};
  document.querySelectorAll('[data-group-row]').forEach((row) => {
    const id = row.querySelector('[name="group-id"]')?.value?.trim();
    const label = row.querySelector('[name="group-label"]')?.value?.trim();
    const membersRaw = row.querySelector('[name="group-members"]')?.value || '';
    if (!id) return;
    const members = membersRaw
      .split(/[\n,;]+/)
      .map((n) => n.trim())
      .filter(Boolean);
    groups[id] = { label: label || id, members };
  });

  return { employees, groups };
}

function buildGroupRowHtml(id, group = { label: '', members: [] }) {
  return `
    <div class="team-config-group-row" data-group-row>
      <label class="form-label">Gruppen-ID</label>
      <input type="text" name="group-id" class="input-text-touch" value="${escapeHtml(id)}" placeholder="z. B. metzgerei">
      <label class="form-label">Anzeigename</label>
      <input type="text" name="group-label" class="input-text-touch" value="${escapeHtml(group.label || '')}" placeholder="Metzgerei">
      <label class="form-label">Mitglieder (kommagetrennt)</label>
      <input type="text" name="group-members" class="input-text-touch" value="${escapeHtml((group.members || []).join(', '))}" placeholder="Nicole, Bettina, …">
      <button type="button" class="btn btn-secondary btn-compact" data-remove-group-row>Gruppe entfernen</button>
    </div>
  `;
}

function renderAdminTeamConfigForm(config = null) {
  const panel = document.getElementById('admin-team-config-panel');
  if (!panel || panel.classList.contains('hidden')) return;

  const cfg = config || { employees: configState.employees, groups: configState.groups };
  const employeesEl = document.getElementById('team-config-employees');
  if (employeesEl && document.activeElement !== employeesEl) {
    employeesEl.value = cfg.employees.join(', ');
  }

  const groupsHost = document.getElementById('team-config-groups');
  if (!groupsHost || groupsHost.dataset.editing === '1') return;
  groupsHost.innerHTML = Object.entries(cfg.groups)
    .map(([id, group]) => buildGroupRowHtml(id, group))
    .join('');
}

function saveVapidFromAdminInput() {
  const input = document.getElementById('team-config-vapid');
  const value = input?.value?.trim() || '';
  try {
    if (value) localStorage.setItem(PUSH_VAPID_KEY, value);
    else localStorage.removeItem(PUSH_VAPID_KEY);
  } catch (_) { /* noop */ }
}

function loadVapidToAdminInput() {
  const input = document.getElementById('team-config-vapid');
  if (input && !input.value) input.value = getStoredVapidKey();
}

async function saveTeamConfigFromAdmin() {
  verifyAdminAction(async () => {
    saveVapidFromAdminInput();
    const config = readAdminConfigFromForm();
    if (config.employees.length === 0) {
      window.showToast?.('Mindestens ein Mitarbeitername nötig.', 'warning');
      return;
    }
    if (Object.keys(config.groups).length === 0) {
      window.showToast?.('Mindestens eine Team-Gruppe anlegen.', 'warning');
      return;
    }

    const firebase = configState.getFirebase();
    const payload = {
      employees: config.employees,
      groups: config.groups,
      tenantId: configState.tenantId,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: getActiveEmployeeNameLocal() || 'Admin',
    };

    try {
      await writeFirestoreDocOrQueue({
        collectionPath: 'settings',
        docId: TEAM_CONFIG_DOC_ID,
        op: 'set',
        onlineData: payload,
        queueData: { ...payload, updatedAt: new Date().toISOString() },
        offlineMessage: 'Team-Konfiguration wird synchronisiert.',
      });
      window.showToast?.('Team-Konfiguration gespeichert.', 'success');
    } catch (err) {
      console.error('[TeamConfig] Speichern fehlgeschlagen:', err);
      window.showToast?.('Konfiguration konnte nicht gespeichert werden.', 'error');
    }
  });
}

function bindAdminTeamConfigPanel() {
  const panel = document.getElementById('admin-team-config-panel');
  if (!panel) return;

  const ctx = getAuthContext();
  const canAdmin = ctx?.isAdmin && !ctx?.isHelper;
  panel.classList.toggle('hidden', !canAdmin);
  if (!canAdmin) return;

  if (panel.dataset.bound === '1') return;
  panel.dataset.bound = '1';

  document.getElementById('team-config-add-group')?.addEventListener('click', () => {
    const host = document.getElementById('team-config-groups');
    if (!host) return;
    host.dataset.editing = '1';
    host.insertAdjacentHTML('beforeend', buildGroupRowHtml(`gruppe_${Date.now().toString(36).slice(2, 6)}`, { label: '', members: [] }));
    delete host.dataset.editing;
  });

  document.getElementById('team-config-groups')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove-group-row]');
    if (!btn) return;
    const row = btn.closest('[data-group-row]');
    const host = document.getElementById('team-config-groups');
    if (row && host && host.querySelectorAll('[data-group-row]').length > 1) {
      row.remove();
    } else {
      window.showToast?.('Mindestens eine Gruppe behalten.', 'warning');
    }
  });

  document.getElementById('team-config-save-btn')?.addEventListener('click', () => saveTeamConfigFromAdmin());
  loadVapidToAdminInput();

  const groupsHost = document.getElementById('team-config-groups');
  if (groupsHost) {
    groupsHost.addEventListener('focusin', () => { groupsHost.dataset.editing = '1'; });
    groupsHost.addEventListener('focusout', () => {
      setTimeout(() => { delete groupsHost.dataset.editing; }, 200);
    });
  }
}

function bindPushSettings() {
  const toggle = document.getElementById('team-push-toggle');
  const status = document.getElementById('team-push-status');
  if (!toggle || toggle.dataset.bound === '1') return;
  toggle.dataset.bound = '1';

  toggle.checked = isPushEnabledLocally();
  updatePushStatusLabel(status, toggle.checked);

  toggle.addEventListener('change', async () => {
    const enabled = toggle.checked;
    setPushEnabledLocally(enabled);
    updatePushStatusLabel(status, enabled);
    if (enabled) {
      const ok = await requestPushPermission();
      if (!ok) {
        toggle.checked = false;
        setPushEnabledLocally(false);
        updatePushStatusLabel(status, false);
      }
    }
  });
}

function updatePushStatusLabel(el, enabled) {
  if (!el) return;
  if (!('Notification' in window)) {
    el.textContent = 'Browser unterstützt keine System-Benachrichtigungen.';
    return;
  }
  if (Notification.permission === 'denied') {
    el.textContent = 'Benachrichtigungen sind im Browser blockiert.';
    return;
  }
  el.textContent = enabled
    ? 'Push aktiv: neue Team-Infos & Aufgaben für dich.'
    : 'Push aus – nur Anzeige in der App.';
}

async function requestPushPermission() {
  if (!('Notification' in window)) {
    window.showToast?.('Benachrichtigungen werden von diesem Browser nicht unterstützt.', 'warning');
    return false;
  }
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') {
    window.showToast?.('Bitte Benachrichtigungen in den Browser-Einstellungen erlauben.', 'warning');
    return false;
  }
  const result = await Notification.requestPermission();
  if (result !== 'granted') {
    window.showToast?.('Benachrichtigungen nicht erlaubt.', 'warning');
    return false;
  }
  return true;
}

async function registerFcmTokenIfPossible(employeeName) {
  const vapidKey = getStoredVapidKey();
  const firebase = configState.getFirebase();
  if (!vapidKey || !firebase?.messaging || !employeeName || !configState.tenantId) return;

  try {
    const messaging = firebase.messaging();
    const registration = await navigator.serviceWorker.ready;
    const token = await messaging.getToken({ vapidKey, serviceWorkerRegistration: registration });
    if (!token) return;

    const tokenId = token.slice(0, 48).replace(/[^a-zA-Z0-9]/g, '_');
    await writeFirestoreDocOrQueue({
      collectionPath: 'pushTokens',
      docId: tokenId,
      op: 'set',
      onlineData: {
        token,
        employeeName,
        tenantId: configState.tenantId,
        platform: 'web',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      queueData: {
        token,
        employeeName,
        tenantId: configState.tenantId,
        platform: 'web',
        updatedAt: new Date().toISOString(),
      },
      offlineMessage: 'Push-Token wird synchronisiert.',
    });
  } catch (err) {
    console.warn('[TeamConfig] FCM-Token Registrierung:', err);
  }
}

export async function syncPushRegistration() {
  if (!isPushEnabledLocally()) return;
  const employee = getActiveEmployeeNameLocal();
  if (!employee) return;
  const granted = await requestPushPermission();
  if (!granted) return;
  await registerFcmTokenIfPossible(employee);
}

export async function ensureTenantTeamConfigSeeded() {
  if (configState.tenantId !== 'torfabrik') return;
  const ref = configRef();
  if (!ref) return;
  try {
    const snap = await ref.get();
    const raw = snap.exists ? snap.data() : null;
    if (needsTorfabrikTeamSeed(raw, snap.exists)) {
      await seedTorfabrikTeamConfigToFirestore();
    }
  } catch (err) {
    console.warn('[TeamConfig] Seed-Pruefung fehlgeschlagen:', err);
  }
}

export function initTeamConfigModule(databaseInstance, options = {}) {
  configState.db = databaseInstance;
  configState.tenantId = options.tenantId || '';
  configState.getFirebase = typeof options.getFirebase === 'function' ? options.getFirebase : configState.getFirebase;

  applyConfig(normalizeConfig(null));
  subscribeTeamConfig();
  ensureTenantTeamConfigSeeded().catch((err) => {
    console.warn('[TeamConfig] Initiales Seeding:', err);
  });
  bindAdminTeamConfigPanel();
  bindPushSettings();

  window.addEventListener('charculogic:active-employee-changed', () => {
    syncPushRegistration();
  });
}

export function refreshAdminTeamConfigPanel() {
  bindAdminTeamConfigPanel();
  renderAdminTeamConfigForm();
}
