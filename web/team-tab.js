/**
 * Tab „Team“ – Umschalter Nachrichten / Bestellungen
 */

import { activateTeamboardTab, mountComposeForms } from './teamboard.js';
import { activateCustomerOrdersTab } from './customer-orders.js';

const TEAM_PANEL_STORAGE_KEY = 'charculogic_team_panel';

function getActiveEmployeeNameLocal() {
  try {
    return String(localStorage.getItem('charculogic_active_employee') || '').trim();
  } catch (_) {
    return '';
  }
}

function updateLoginReminder() {
  const banner = document.getElementById('team-login-reminder');
  if (!banner) return;
  banner.classList.toggle('hidden', !!getActiveEmployeeNameLocal());
}

function setTeamPanel(panelId) {
  const valid = panelId === 'orders' ? 'orders' : 'messages';
  document.querySelectorAll('.team-subnav-btn').forEach((btn) => {
    const active = btn.dataset.teamPanel === valid;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  document.querySelectorAll('.team-panel').forEach((panel) => {
    const show = panel.dataset.teamPanel === valid;
    panel.classList.toggle('hidden', !show);
    panel.classList.toggle('active', show);
    if (show) panel.removeAttribute('hidden');
    else panel.setAttribute('hidden', '');
  });
  try {
    localStorage.setItem(TEAM_PANEL_STORAGE_KEY, valid);
  } catch (_) { /* noop */ }
}

function bindTeamSubnav() {
  const subnav = document.querySelector('.team-subnav');
  if (!subnav || subnav.dataset.bound === '1') return;
  subnav.dataset.bound = '1';

  subnav.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-team-panel]');
    if (!btn || !btn.classList.contains('team-subnav-btn')) return;
    setTeamPanel(btn.dataset.teamPanel);
  });

  window.addEventListener('charculogic:active-employee-changed', updateLoginReminder);
}

export function activateTeamHubTab() {
  bindTeamSubnav();
  updateLoginReminder();

  let panel = 'messages';
  try {
    const stored = localStorage.getItem(TEAM_PANEL_STORAGE_KEY);
    if (stored === 'orders' || stored === 'messages') panel = stored;
  } catch (_) { /* noop */ }
  setTeamPanel(panel);

  mountComposeForms();
  activateTeamboardTab();
  activateCustomerOrdersTab();
}

/** Direkt den Bestellungen-Bereich öffnen (z. B. Deep-Link später). */
export function openTeamOrdersPanel() {
  setTeamPanel('orders');
}
