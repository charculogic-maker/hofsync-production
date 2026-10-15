/**
 * Tab „Team“ – Nachrichten / Team-Infos
 * Packtisch/Bestellungen liegen als eigener Bottom-Nav-Tab (`orders`).
 * Keine Umbenennung von Start↔Team — Nav-Identität steuert app.js.
 */

import { activateTeamboardTab, mountComposeForms } from './teamboard.js';

function updateLoginReminder() {
  const banner = document.getElementById('team-login-reminder');
  if (!banner) return;
  banner.classList.add('hidden');
}

/**
 * Team-Hub aktivieren, ohne Bottom-Nav-Labels anzufassen.
 * activateTeamboardTab aktualisiert nur Inbox-Badges auf #tab-teamboard.
 */
export function activateTeamHubTab() {
  updateLoginReminder();
  mountComposeForms();
  try {
    activateTeamboardTab();
  } catch (err) {
    console.warn('[Team] Teamboard-Aktivierung fehlgeschlagen:', err);
  }
  const messages = document.getElementById('team-panel-messages');
  if (messages) {
    messages.classList.remove('hidden');
    messages.classList.add('active');
    messages.removeAttribute('hidden');
  }
  // Sicherstellen: Team-Tab-Label bleibt „Team“, Start bleibt „Start“
  const teamTab = document.getElementById('tab-team');
  const startTab = document.getElementById('tab-teamboard');
  const teamLabel = teamTab?.querySelector('span:not(.nav-unread-badge)');
  const startLabel = startTab?.querySelector('span:not(.nav-unread-badge)');
  if (teamLabel) teamLabel.textContent = 'Team';
  if (startLabel) startLabel.textContent = 'Start';
  const teamIcon = teamTab?.querySelector('i');
  const startIcon = startTab?.querySelector('i');
  if (teamIcon) teamIcon.textContent = '💬';
  if (startIcon) startIcon.textContent = '📌';
}

/** Deep-Link: Packtisch-Nav öffnen und dort bleiben */
export function openTeamOrdersPanel(view = 'packtisch') {
  const tab = document.querySelector('.nav-item[data-tab="orders"]');
  if (tab && !tab.hidden && tab.style.display !== 'none') {
    tab.click();
  } else {
    window.showTab?.('orders') || window.fallbackShowTab?.('orders');
  }
  try {
    if (['packtisch', 'zuschnitt', 'aufnahme'].includes(view)) {
      sessionStorage.setItem('charculogic.ordersView', view);
    }
  } catch (_) { /* noop */ }
  // Nach Tab-Wechsel Sub-View setzen (customer-orders liest sessionStorage)
  window.setTimeout?.(() => {
    document.querySelector(`[data-orders-view="${view}"]`)?.click();
  }, 0);
}
