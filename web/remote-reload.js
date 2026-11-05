/**
 * Remote „App neu laden“ für Laden-iPhones.
 * Firestore: tenants/{tenantId}/settings/appReload
 * Admin setzt required + requestId; jedes Gerät zeigt Hinweis bis lokal bestätigt.
 */

import { getTenantCollection, getGlobalTenantId } from './tenant-db.js';

export const APP_RELOAD_DOC_ID = 'appReload';
export const DEFAULT_RELOAD_MESSAGE =
  'Bitte offene Eingaben speichern. Danach „App neu laden“ tippen.';

const ACK_STORAGE_PREFIX = 'charculogic.reloadAck.';
const SNOOZE_MS = 90 * 1000;

/** @type {null | (() => void)} */
let unsubscribe = null;
/** @type {boolean} */
let reloadRequired = false;
/** @type {string} */
let activeRequestId = '';
/** @type {string} */
let activeMessage = DEFAULT_RELOAD_MESSAGE;
/** @type {number} */
let snoozeUntil = 0;
/** @type {ReturnType<typeof setTimeout> | null} */
let snoozeTimer = null;

function ackStorageKey(tenantId = getGlobalTenantId()) {
  const id = String(tenantId || '').trim();
  return id ? `${ACK_STORAGE_PREFIX}${id}` : '';
}

export function readReloadAck(tenantId = getGlobalTenantId()) {
  const key = ackStorageKey(tenantId);
  if (!key) return '';
  try {
    return String(localStorage.getItem(key) || '').trim();
  } catch (_) {
    return '';
  }
}

export function writeReloadAck(requestId, tenantId = getGlobalTenantId()) {
  const key = ackStorageKey(tenantId);
  const id = String(requestId || '').trim();
  if (!key || !id) return false;
  try {
    localStorage.setItem(key, id);
    return true;
  } catch (err) {
    console.warn('[HofSync] Reload-Bestätigung konnte nicht gespeichert werden:', err);
    return false;
  }
}

export function shouldShowReloadPrompt({
  required,
  requestId,
  ackedRequestId = '',
  now = Date.now(),
  snoozedUntil = 0,
} = {}) {
  if (!required) return false;
  const id = String(requestId || '').trim();
  if (!id) return false;
  if (String(ackedRequestId || '').trim() === id) return false;
  if (Number(snoozedUntil) > Number(now)) return false;
  return true;
}

function ensureOverlayEls() {
  let modal = document.getElementById('remote-reload-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'remote-reload-modal';
    modal.className = 'remote-reload-modal';
    modal.hidden = true;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'remote-reload-title');
    modal.innerHTML = `
      <div class="remote-reload-modal-card">
        <h2 id="remote-reload-title" class="remote-reload-title">App-Update nötig</h2>
        <ol class="remote-reload-steps">
          <li>Offene Eingaben speichern oder abbrechen.</li>
          <li>Danach <strong>App neu laden</strong> tippen.</li>
        </ol>
        <p class="remote-reload-message" id="remote-reload-message"></p>
        <div class="remote-reload-actions">
          <button type="button" class="remote-reload-btn remote-reload-btn--primary" id="remote-reload-confirm">
            App neu laden
          </button>
          <button type="button" class="remote-reload-btn remote-reload-btn--secondary" id="remote-reload-snooze">
            Erst speichern
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  let bar = document.getElementById('remote-reload-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'remote-reload-bar';
    bar.className = 'remote-reload-bar';
    bar.hidden = true;
    bar.setAttribute('role', 'status');
    bar.innerHTML = `
      <div class="remote-reload-bar-body">
        <span class="remote-reload-bar-text">App neu laden nötig — bitte erst speichern.</span>
        <button type="button" class="remote-reload-btn remote-reload-btn--primary remote-reload-btn--compact" id="remote-reload-bar-confirm">
          App neu laden
        </button>
      </div>
    `;
    const host = document.querySelector('.app-container') || document.body;
    host.appendChild(bar);
  }

  return { modal, bar };
}

function bindOverlayOnce() {
  if (window.__hofsyncRemoteReloadBound) return;
  window.__hofsyncRemoteReloadBound = true;
  const { modal } = ensureOverlayEls();

  const runHardReload = () => {
    if (!activeRequestId) return;
    writeReloadAck(activeRequestId);
    hideReloadUi();
    if (typeof window.forceAppUpdate === 'function') {
      window.forceAppUpdate();
      return;
    }
    window.location.reload();
  };

  modal.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('#remote-reload-confirm')) {
      runHardReload();
      return;
    }
    if (target.closest('#remote-reload-snooze')) {
      snoozePrompt();
    }
  });

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('#remote-reload-bar-confirm')) {
      runHardReload();
    }
  });
}

function hideReloadUi() {
  const modal = document.getElementById('remote-reload-modal');
  const bar = document.getElementById('remote-reload-bar');
  if (modal) {
    modal.classList.remove('is-open');
    modal.hidden = true;
  }
  if (bar) {
    bar.classList.remove('is-visible');
    bar.hidden = true;
  }
  document.body.classList.remove('remote-reload-open');
}

function showModal() {
  const { modal, bar } = ensureOverlayEls();
  const messageEl = document.getElementById('remote-reload-message');
  if (messageEl) {
    messageEl.textContent = activeMessage || DEFAULT_RELOAD_MESSAGE;
  }
  if (bar) {
    bar.classList.remove('is-visible');
    bar.hidden = true;
  }
  modal.hidden = false;
  modal.classList.add('is-open');
  document.body.classList.add('remote-reload-open');
}

function showBar() {
  const { modal, bar } = ensureOverlayEls();
  if (modal) {
    modal.classList.remove('is-open');
    modal.hidden = true;
  }
  document.body.classList.remove('remote-reload-open');
  bar.hidden = false;
  bar.classList.add('is-visible');
}

function snoozePrompt() {
  snoozeUntil = Date.now() + SNOOZE_MS;
  showBar();
  if (snoozeTimer) clearTimeout(snoozeTimer);
  snoozeTimer = setTimeout(() => {
    snoozeUntil = 0;
    renderReloadPromptState();
  }, SNOOZE_MS + 50);
}

function renderReloadPromptState() {
  const acked = readReloadAck();
  const pending = shouldShowReloadPrompt({
    required: reloadRequired,
    requestId: activeRequestId,
    ackedRequestId: acked,
    snoozedUntil: 0,
  });
  if (!pending) {
    hideReloadUi();
    return;
  }
  if (snoozeUntil > Date.now()) {
    showBar();
    return;
  }
  showModal();
}

function applyReloadDoc(data) {
  const required = data?.required === true;
  const requestId = String(data?.requestId || '').trim();
  const message = String(data?.message || '').trim() || DEFAULT_RELOAD_MESSAGE;

  reloadRequired = required;
  activeRequestId = required ? requestId : '';
  activeMessage = message;

  if (!required) {
    snoozeUntil = 0;
    if (snoozeTimer) clearTimeout(snoozeTimer);
    hideReloadUi();
    return;
  }

  renderReloadPromptState();
}

/**
 * @param {FirebaseFirestore.Firestore} [db]
 * @param {{ tenantId?: string }} [options]
 */
export function initRemoteReloadWatcher(db, options = {}) {
  bindOverlayOnce();
  stopRemoteReloadWatcher();

  const tenantId = String(options.tenantId || getGlobalTenantId() || '').trim();
  if (!tenantId || !db) return;

  let ref;
  try {
    ref = getTenantCollection('settings').doc(APP_RELOAD_DOC_ID);
  } catch (err) {
    console.warn('[HofSync] Reload-Watcher ohne Tenant-Kontext:', err);
    return;
  }

  unsubscribe = ref.onSnapshot(
    (snap) => {
      applyReloadDoc(snap.exists ? snap.data() : null);
    },
    (err) => {
      console.warn('[HofSync] Reload-Anforderung konnte nicht geladen werden:', err);
    },
  );

  const onVisible = () => {
    if (document.visibilityState === 'visible') renderReloadPromptState();
  };
  document.addEventListener('visibilitychange', onVisible);
  window.__hofsyncRemoteReloadOnVisible = onVisible;
}

export function stopRemoteReloadWatcher() {
  unsubscribe?.();
  unsubscribe = null;
  if (typeof window.__hofsyncRemoteReloadOnVisible === 'function') {
    document.removeEventListener('visibilitychange', window.__hofsyncRemoteReloadOnVisible);
    window.__hofsyncRemoteReloadOnVisible = null;
  }
}

/**
 * Admin: Neu-Laden auf allen Laden-iPhones anfordern.
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} tenantId
 * @param {{ message?: string, notifyPush?: boolean, requestedBy?: string }} [options]
 */
export async function requestRemoteAppReload(db, tenantId, options = {}) {
  const id = String(tenantId || '').trim();
  if (!db || !id) throw new Error('Mandant fehlt für Reload-Anforderung.');

  const requestId = `reload_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const message = String(options.message || '').trim() || DEFAULT_RELOAD_MESSAGE;
  const notifyPush = options.notifyPush !== false;
  const requestedBy = String(options.requestedBy || '').trim();
  const nowIso = new Date().toISOString();

  const payload = {
    required: true,
    requestId,
    message,
    notifyPush,
    tenantId: id,
    requestedAt: nowIso,
    requestedBy,
    updatedAt: nowIso,
    updatedBy: requestedBy,
  };

  await db.collection('tenants').doc(id).collection('settings').doc(APP_RELOAD_DOC_ID).set(payload, { merge: true });
  return payload;
}

/**
 * Admin: Hinweis zurücknehmen (Geräte ohne Ack sehen ihn nicht mehr).
 */
export async function clearRemoteAppReload(db, tenantId, options = {}) {
  const id = String(tenantId || '').trim();
  if (!db || !id) throw new Error('Mandant fehlt.');
  const updatedBy = String(options.updatedBy || '').trim();
  const nowIso = new Date().toISOString();
  await db.collection('tenants').doc(id).collection('settings').doc(APP_RELOAD_DOC_ID).set({
    required: false,
    notifyPush: false,
    tenantId: id,
    updatedAt: nowIso,
    updatedBy,
    clearedAt: nowIso,
  }, { merge: true });
}

/**
 * Admin-Status lesen (One-Shot).
 */
export async function readRemoteAppReload(db, tenantId) {
  const id = String(tenantId || '').trim();
  if (!db || !id) return null;
  const snap = await db.collection('tenants').doc(id).collection('settings').doc(APP_RELOAD_DOC_ID).get();
  return snap.exists ? (snap.data() || null) : null;
}
