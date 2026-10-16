/**
 * Tab „Team“ – Nachrichten / Team-Infos
 * Kundenbestellungen & Packtisch leben unter data-tab="orders" (#page-orders).
 *
 * ARCH-GUARD: Keine Daten-Loader hier — activate* rendert nur den View.
 * showTab nur in openTeamOrdersPanel (explizite User-/Deep-Link-Navigation).
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

/** Explizite Navigation zum Packtisch (User/Deep-Link) — kein Daten-Loader. */
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
