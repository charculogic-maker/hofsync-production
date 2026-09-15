/**
 * HofSync App-Version & Release-Hinweise (PWA).
 * Zentrale Konstanten für Badge, einmaligen Update-Toast und Changelog-Popover.
 */

export const APP_VERSION = '1.4.0';
export const APP_VERSION_LABEL = `v${APP_VERSION}`;
export const APP_VERSION_TAG = `v${APP_VERSION}-20260915`;
export const APP_RELEASE_DATE = '2026-09-15';

export const RELEASE_TOAST_MESSAGE =
  'HofSync aktualisiert: VPE-Lernlogik, LIFO-Scan & MHD-Parser geladen.';

export const RELEASE_HIGHLIGHTS = [
  'Gebindegrößen-Erkennung (Auto-VPE)',
  'LIFO-Reihenfolge im Wareneingang (neuester Scan oben)',
  'Flexible 2-stellige MHD-Eingabe (29 → 2029)',
  'Auto-Kategorienerkennung',
  'Fixes für Lieferantenauswahl & PDF-Upload',
];

const SEEN_RELEASE_STORAGE_KEY = 'hofsync_seen_release_version';
const RELEASE_TOAST_MS = 4000;

function readSeenReleaseVersion() {
  try {
    return String(localStorage.getItem(SEEN_RELEASE_STORAGE_KEY) || '').trim();
  } catch (_) {
    return '';
  }
}

export function hasSeenReleaseToast(version = APP_VERSION) {
  return readSeenReleaseVersion() === String(version);
}

export function markReleaseToastSeen(version = APP_VERSION) {
  try {
    localStorage.setItem(SEEN_RELEASE_STORAGE_KEY, String(version));
  } catch (err) {
    console.warn('[HofSync] Release-Hinweis konnte nicht gespeichert werden:', err);
  }
}

function ensureReleaseToastEl() {
  let toast = document.getElementById('release-toast');
  if (toast) return toast;

  toast = document.createElement('div');
  toast.id = 'release-toast';
  toast.className = 'release-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.hidden = true;
  toast.innerHTML = `
    <div class="release-toast-body">
      <p class="release-toast-text" id="release-toast-text"></p>
      <button type="button" class="release-toast-dismiss" id="release-toast-dismiss" aria-label="Hinweis schließen">×</button>
    </div>
  `;
  const host = document.querySelector('.app-container') || document.body;
  host.appendChild(toast);
  return toast;
}

function hideReleaseToast() {
  const toast = document.getElementById('release-toast');
  if (!toast) return;
  toast.classList.remove('is-visible');
  window.setTimeout(() => {
    toast.hidden = true;
  }, 280);
}

/**
 * Einmaliger Hinweis nach App-Update (pro Version, localStorage).
 */
export function maybeShowReleaseToast({
  version = APP_VERSION,
  message = RELEASE_TOAST_MESSAGE,
  durationMs = RELEASE_TOAST_MS,
} = {}) {
  if (hasSeenReleaseToast(version)) return false;

  const toast = ensureReleaseToastEl();
  const textEl = document.getElementById('release-toast-text');
  if (textEl) textEl.textContent = message;

  markReleaseToastSeen(version);
  toast.hidden = false;
  requestAnimationFrame(() => toast.classList.add('is-visible'));

  const dismissBtn = document.getElementById('release-toast-dismiss');
  const onDismiss = () => {
    window.clearTimeout(autoHide);
    hideReleaseToast();
    dismissBtn?.removeEventListener('click', onDismiss);
    toast.removeEventListener('click', onBodyDismiss);
  };
  const onBodyDismiss = (event) => {
    if (event.target === dismissBtn) return;
    onDismiss();
  };

  dismissBtn?.addEventListener('click', onDismiss);
  toast.addEventListener('click', onBodyDismiss);

  const autoHide = window.setTimeout(onDismiss, durationMs);
  return true;
}

function ensureChangelogModalEl() {
  let modal = document.getElementById('version-changelog-modal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'version-changelog-modal';
  modal.className = 'version-changelog-modal';
  modal.hidden = true;
  modal.innerHTML = `
    <div class="version-changelog-backdrop" data-changelog-dismiss="1"></div>
    <div class="version-changelog-card" role="dialog" aria-modal="true" aria-labelledby="version-changelog-title">
      <div class="version-changelog-header">
        <div>
          <p class="version-changelog-kicker">HofSync</p>
          <h2 id="version-changelog-title" class="version-changelog-title">Was ist neu</h2>
        </div>
        <button type="button" class="version-changelog-close" data-changelog-dismiss="1" aria-label="Schließen">×</button>
      </div>
      <p class="version-changelog-meta" id="version-changelog-meta"></p>
      <ul class="version-changelog-list" id="version-changelog-list"></ul>
      <button type="button" class="btn btn-primary version-changelog-ok" data-changelog-dismiss="1">Verstanden</button>
    </div>
  `;
  const host = document.querySelector('.app-container') || document.body;
  host.appendChild(modal);

  modal.addEventListener('click', (event) => {
    const target = event.target;
    if (target?.closest?.('[data-changelog-dismiss]')) {
      closeChangelogModal();
    }
  });

  return modal;
}

export function openChangelogModal({
  versionLabel = APP_VERSION_LABEL,
  highlights = RELEASE_HIGHLIGHTS,
  releaseDate = APP_RELEASE_DATE,
} = {}) {
  const modal = ensureChangelogModalEl();
  const meta = document.getElementById('version-changelog-meta');
  const list = document.getElementById('version-changelog-list');
  if (meta) {
    meta.textContent = `${versionLabel} · ${releaseDate}`;
  }
  if (list) {
    list.innerHTML = highlights
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join('');
  }
  modal.hidden = false;
  requestAnimationFrame(() => modal.classList.add('is-open'));
}

export function closeChangelogModal() {
  const modal = document.getElementById('version-changelog-modal');
  if (!modal) return;
  modal.classList.remove('is-open');
  window.setTimeout(() => {
    modal.hidden = true;
  }, 200);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Dezentes Versions-Badge (Header/Fußzeile) + Changelog-Popover.
 */
export function initAppVersionUi({
  versionLabel = APP_VERSION_LABEL,
  statusLabel = 'System aktuell',
} = {}) {
  const badgeNodes = document.querySelectorAll('[data-app-version-badge]');
  badgeNodes.forEach((badge) => {
    const versionEl = badge.querySelector('[data-app-version-label]');
    const statusEl = badge.querySelector('[data-app-version-status]');
    if (versionEl) versionEl.textContent = versionLabel;
    if (statusEl) statusEl.textContent = statusLabel;
    badge.setAttribute('aria-label', `${versionLabel}, ${statusLabel}. Tippen für Neuigkeiten.`);
    badge.addEventListener('click', (event) => {
      event.preventDefault();
      openChangelogModal();
    });
  });

  window.HofSyncVersion = {
    version: APP_VERSION,
    label: versionLabel,
    tag: APP_VERSION_TAG,
    openChangelog: openChangelogModal,
  };

  // Nach erstem Paint einmaligen Release-Hinweis zeigen.
  window.setTimeout(() => {
    maybeShowReleaseToast();
  }, 900);
}
