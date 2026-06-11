/**
 * Tab „Team“ – Umschalter Nachrichten / Bestellungen
 */

import { activateTeamboardTab, mountComposeForms } from './teamboard.js';
import { activateCustomerOrdersTab } from './customer-orders.js';

const TEAM_PANEL_STORAGE_KEY = 'charculogic_team_panel';

/** Sichtbare Team-Reiter je Mandant (richtet sich nach den freigeschalteten Bereichen). */
function visibleTeamPanels() {
  const modules = (window.BRANDING && window.BRANDING.modules) || {};
  const panels = [];
  if (modules.teamboard !== false || modules.orders !== false) panels.push('messages');
  if (modules.orders !== false) panels.push('orders');
  return panels.length ? panels : ['messages'];
}

function applyTeamSubnavVisibility(panels) {
  document.querySelectorAll('.team-subnav-btn').forEach((btn) => {
    const show = panels.includes(btn.dataset.teamPanel);
    btn.hidden = !show;
    btn.style.display = show ? '' : 'none';
  });
}

function updateLoginReminder() {
  const banner = document.getElementById('team-login-reminder');
  if (!banner) return;
  banner.classList.add('hidden');
}

function setTeamPanel(panelId) {
  const panels = visibleTeamPanels();
  const valid = panels.includes(panelId) ? panelId : panels[0];
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

  const panels = visibleTeamPanels();
  applyTeamSubnavVisibility(panels);

  let panel = panels[0];
  try {
    const stored = localStorage.getItem(TEAM_PANEL_STORAGE_KEY);
    if (stored === 'tempcheck') {
      localStorage.removeItem(TEAM_PANEL_STORAGE_KEY);
    } else if (panels.includes(stored)) {
      panel = stored;
    }
  } catch (_) { /* noop */ }
  setTeamPanel(panel);

  if (panels.includes('messages')) {
    mountComposeForms();
    activateTeamboardTab();
  }
  if (panels.includes('orders')) {
    activateCustomerOrdersTab();
  }
}

/** Direkt den Bestellungen-Bereich öffnen (z. B. Deep-Link später). */
export function openTeamOrdersPanel() {
  setTeamPanel('orders');
}
