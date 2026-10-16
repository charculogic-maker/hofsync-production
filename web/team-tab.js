/**
 * Tab „Team“ – Nachrichten / Team-Infos
 * Kundenbestellungen & Packtisch leben unter data-tab="orders" (#page-orders).
 */

import { activateTeamboardTab, mountComposeForms } from './teamboard.js';
import { activateCustomerOrdersTab } from './customer-orders.js';

function updateLoginReminder() {
  const banner = document.getElementById('team-login-reminder');
  if (!banner) return;
  banner.classList.add('hidden');
}

export function activateTeamHubTab() {
  updateLoginReminder();
  mountComposeForms();
  activateTeamboardTab();
}

/** Öffnet den Packtisch-Tab (kein Nested-Panel mehr unter Team). */
export function openTeamOrdersPanel() {
  if (typeof window.showTab === 'function') {
    window.showTab('orders');
    return;
  }
  window.fallbackShowTab?.('orders');
}

export function activateOrdersHubTab() {
  activateCustomerOrdersTab();
}
