/**
 * Tab „Team“ – Nachrichten / Team-Infos
 * Packtisch/Bestellungen liegen als eigener Bottom-Nav-Tab (`orders`).
 */

import { activateTeamboardTab, mountComposeForms } from './teamboard.js';

function updateLoginReminder() {
  const banner = document.getElementById('team-login-reminder');
  if (!banner) return;
  banner.classList.add('hidden');
}

export function activateTeamHubTab() {
  updateLoginReminder();
  mountComposeForms();
  activateTeamboardTab();
  const messages = document.getElementById('team-panel-messages');
  if (messages) {
    messages.classList.remove('hidden');
    messages.classList.add('active');
    messages.removeAttribute('hidden');
  }
}

/** @deprecated Packtisch ist eigener Nav-Tab – bleibt als Deep-Link-Helfer */
export function openTeamOrdersPanel() {
  const tab = document.querySelector('.nav-item[data-tab="orders"]');
  if (tab && !tab.hidden && tab.style.display !== 'none') {
    tab.click();
    return;
  }
  window.fallbackShowTab?.('orders');
}
