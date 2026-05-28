/**
 * Team-Benachrichtigungen (In-App + System-Notification via Service Worker)
 */

import { isPushEnabledLocally } from './team-config.js';
function getActiveEmployeeNameLocal() {
  try {
    return String(localStorage.getItem('charculogic_active_employee') || '').trim();
  } catch (_) {
    return '';
  }
}

const notifyState = {
  knownOpenTaskIds: new Set(),
  bootstrapped: false,
};

function entryTitle(entry) {
  return String(entry?.title || 'Team-Nachricht').trim();
}

function entryKindLabel(entry) {
  return entry?.entryKind === 'info' ? 'Info' : 'Aufgabe';
}

export function notifyNewTeamEntry(entry) {
  const employee = getActiveEmployeeNameLocal();
  if (!employee) return;
  if (entry?.author === employee) return;

  const title = `${entryKindLabel(entry)}: ${entryTitle(entry)}`;
  const body = entry?.body
    ? String(entry.body).slice(0, 120)
    : `Von ${entry?.author || 'Team'}`;

  window.showToast?.(title, entry?.priority === 'Rot' ? 'error' : 'warning');

  if (!isPushEnabledLocally()) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const payload = {
    type: 'team-entry',
    title,
    body,
    tag: `team-${entry?.id || Date.now()}`,
    url: '/',
  };

  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'SHOW_NOTIFICATION', payload });
    return;
  }

  try {
    // eslint-disable-next-line no-new
    new Notification(title, { body, tag: payload.tag });
  } catch (_) { /* noop */ }
}

export function handleTasksSnapshotForNotify(openTasks, { matchesViewer }) {
  const visible = (openTasks || []).filter((t) => t.status === 'open' && matchesViewer(t));

  if (!notifyState.bootstrapped) {
    visible.forEach((t) => notifyState.knownOpenTaskIds.add(t.id));
    notifyState.bootstrapped = true;
    return;
  }

  visible.forEach((task) => {
    if (notifyState.knownOpenTaskIds.has(task.id)) return;
    notifyState.knownOpenTaskIds.add(task.id);
    notifyNewTeamEntry(task);
  });

  const visibleIds = new Set(visible.map((t) => t.id));
  notifyState.knownOpenTaskIds.forEach((id) => {
    if (!visibleIds.has(id)) notifyState.knownOpenTaskIds.delete(id);
  });
}

export function resetTeamNotifyBootstrap() {
  notifyState.knownOpenTaskIds.clear();
  notifyState.bootstrapped = false;
}
