/**
 * Digitales Schwarzes Brett + Aufgaben-Tokens (Team-Leitstand)
 */

import { getAuthContext, verifyAdminAction } from './auth.js';
import { writeFirestoreDocOrQueue } from './sync.js';
import { getTeamEmployees, getTeamGroups } from './team-config.js';
import { handleTasksSnapshotForNotify, resetTeamNotifyBootstrap } from './team-notify.js';

export const TEAM_SHIFTS = ['Frühschicht', 'Spätschicht'];
export const TASK_PRIORITIES = ['Rot', 'Gelb', 'Grün'];

export function getTeamEmployeesList() {
  return getTeamEmployees();
}

export function getTeamGroupsMap() {
  return getTeamGroups();
}
const EMPLOYEE_PINS = {
  Stephie: '1122',
  Finn: '2233',
  Nicole: '3344',
  Bettina: '4455',
  Heiko: '5566',
  Paddy: '6677',
};

const ACTIVE_EMPLOYEE_STORAGE_KEY = 'charculogic_active_employee';
const ACTIVE_SHIFT_STORAGE_KEY = 'charculogic_active_shift';
const BULLETIN_DOC_ID = 'current';

const teamboardState = {
  db: null,
  tenantId: '',
  getFirebase: () => null,
  showHUD: () => {},
  playClickSound: () => {},
  bulletinUnsubscribe: null,
  tasksUnsubscribe: null,
  pendingAttachments: [],
  currentBulletin: null,
  openTasks: [],
  completedTasks: [],
  allTasks: [],
  historyFilter: '7d',
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function todayIsoLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Firestore-Regeln erwarten kurze ISO-Datumsstrings (YYYY-MM-DD). */
function normalizeDateField(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const us = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) {
    return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  }
  const de = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (de) {
    return `${de[3]}-${de[2].padStart(2, '0')}-${de[1].padStart(2, '0')}`;
  }
  return null;
}

function isIsoDateInRange(dayIso, fromIso, untilIso) {
  if (!dayIso) return false;
  const from = fromIso || untilIso || dayIso;
  const until = untilIso || fromIso || from;
  return dayIso >= from && dayIso <= until;
}

function toIsoDateString(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'string') return normalizeDateField(value);
  if (typeof value?.toDate === 'function') {
    const d = value.toDate();
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return null;
}

function employeeNameMatch(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

function normalizeTaskRecord(task) {
  if (!task) return task;
  return {
    ...task,
    validFrom: toIsoDateString(task.validFrom),
    validUntil: toIsoDateString(task.validUntil),
    targetDate: toIsoDateString(task.targetDate),
    dueDate: toIsoDateString(task.dueDate),
  };
}

function taskVisibleOnDay(task, dayIso) {
  if (!task) return false;
  const today = dayIso || todayIsoLocal();
  const from = toIsoDateString(task.validFrom);
  const until = toIsoDateString(task.validUntil);
  const target = toIsoDateString(task.targetDate);

  if (from || until) {
    return isIsoDateInRange(today, from || target, until || target);
  }
  if (target) return target === today;
  return true;
}

function isTaskOverdue(task) {
  if (!task || task.status !== 'open' || !task.dueDate) return false;
  return task.dueDate < todayIsoLocal();
}

function formatTaskScheduleLabel(task) {
  const parts = [];
  const from = task.validFrom || task.targetDate;
  const until = task.validUntil;
  if (from && until && from !== until) {
    parts.push(`${from} – ${until}`);
  } else if (from) {
    parts.push(from);
  }
  if (task.dueDate) {
    parts.push(`fällig ${task.dueDate}`);
  }
  return parts.join(' · ');
}

function getNextShiftInfo() {
  const now = new Date();
  const hour = now.getHours();
  const today = todayIsoLocal();
  if (hour < 14) {
    return { context: 'Spätschicht', validFrom: today, validUntil: today };
  }
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const y = tomorrow.getFullYear();
  const m = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const d = String(tomorrow.getDate()).padStart(2, '0');
  return { context: 'Frühschicht', validFrom: `${y}-${m}-${d}`, validUntil: `${y}-${m}-${d}` };
}

function resolveAudienceMembers(task) {
  const type = task?.audienceType || null;
  const employees = getTeamEmployees();
  const groups = getTeamGroups();
  if (type === 'all') return [...employees];
  if (type === 'group' && task.audienceGroup && groups[task.audienceGroup]) {
    return [...groups[task.audienceGroup].members];
  }
  if (type === 'persons' && Array.isArray(task.audienceMembers)) {
    return task.audienceMembers.filter((n) => employees.includes(n));
  }
  if (type === 'person' && task.assignedTo) return [task.assignedTo];
  return [];
}

export function formatAudienceLabel(task) {
  const type = task?.audienceType || null;
  if (type === 'all') return 'Alle';
  if (type === 'group' && task.audienceGroup) {
    return getTeamGroups()[task.audienceGroup]?.label || task.audienceGroup;
  }
  if (type === 'persons' && Array.isArray(task.audienceMembers) && task.audienceMembers.length) {
    return task.audienceMembers.join(', ');
  }
  if (type === 'next_shift') return `Nächste Schicht (${task.context || '–'})`;
  if (type === 'shift' || task.context) return task.context || 'Schicht';
  if (task.assignedTo) return task.assignedTo;
  return 'Team';
}

function entryKindOf(task) {
  return task?.entryKind === 'info' ? 'info' : 'task';
}

export function getActiveEmployeeName() {
  try {
    return String(localStorage.getItem(ACTIVE_EMPLOYEE_STORAGE_KEY) || '').trim();
  } catch (_) {
    return '';
  }
}

export function getActiveShift() {
  try {
    const stored = String(localStorage.getItem(ACTIVE_SHIFT_STORAGE_KEY) || '').trim();
    if (TEAM_SHIFTS.includes(stored)) return stored;
  } catch (_) { /* noop */ }
  const hour = new Date().getHours();
  return hour < 14 ? 'Frühschicht' : 'Spätschicht';
}

function setActiveShift(shift) {
  if (!TEAM_SHIFTS.includes(shift)) return;
  try {
    localStorage.setItem(ACTIVE_SHIFT_STORAGE_KEY, shift);
  } catch (_) { /* noop */ }
  window.dispatchEvent(new CustomEvent('charculogic:active-shift-changed', { detail: { shift } }));
}

function bulletinRef() {
  if (!teamboardState.db || !teamboardState.tenantId) return null;
  return teamboardState.db
    .collection('tenants')
    .doc(teamboardState.tenantId)
    .collection('bulletinBoard')
    .doc(BULLETIN_DOC_ID);
}

function tasksCollectionRef() {
  if (!teamboardState.db || !teamboardState.tenantId) return null;
  return teamboardState.db
    .collection('tenants')
    .doc(teamboardState.tenantId)
    .collection('tasks');
}

function resolveAuthorName() {
  const employee = getActiveEmployeeName();
  if (employee) return employee;
  const ctx = getAuthContext();
  if (ctx?.profile?.displayName) return String(ctx.profile.displayName).trim();
  if (ctx?.email) return ctx.email.split('@')[0];
  return 'Leitung';
}

function taskMatchesViewer(task) {
  if (!task || task.status !== 'open') return false;
  const employee = getActiveEmployeeName();
  if (!employee) return false;
  const shift = getActiveShift();
  const today = todayIsoLocal();
  if (!taskVisibleOnDay(task, today)) return false;

  const audienceType = task.audienceType || (task.assignedTo ? 'person' : task.context ? 'shift' : null);

  if (audienceType === 'all') return true;
  if (audienceType === 'group' || audienceType === 'persons') {
    return resolveAudienceMembers(task).some((name) => employeeNameMatch(name, employee));
  }
  if (audienceType === 'next_shift') {
    const next = getNextShiftInfo();
    return task.context === next.context && isIsoDateInRange(today, next.validFrom, next.validUntil);
  }
  if (audienceType === 'shift' || (!audienceType && task.context)) {
    return task.context === shift;
  }
  if (audienceType === 'person' || task.assignedTo) {
    return employeeNameMatch(task.assignedTo, employee);
  }
  return false;
}

function completedTaskMatchesViewer(task) {
  if (!task || task.status !== 'completed') return false;
  const employee = getActiveEmployeeName();
  if (!employee) return false;
  if (employeeNameMatch(task.completedBy, employee)) return true;
  if (employeeNameMatch(task.assignedTo, employee)) return true;
  if (task.audienceType === 'all') return true;
  if (resolveAudienceMembers(task).some((name) => employeeNameMatch(name, employee))) return true;
  if (!task.assignedTo && task.context && task.context === getActiveShift()) return true;
  return false;
}

function toEpochMs(value) {
  if (!value) return 0;
  if (typeof value?.toDate === 'function') {
    const date = value.toDate();
    return date instanceof Date ? date.getTime() : 0;
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  return 0;
}

function isInHistoryRange(task, filterKey) {
  if (filterKey === 'all') return true;
  const ts = toEpochMs(task?.completedAt);
  if (!ts) return false;
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartMs = todayStart.getTime();
  if (filterKey === 'today') return ts >= todayStartMs;
  if (filterKey === '7d') return ts >= now - (7 * 24 * 60 * 60 * 1000);
  if (filterKey === '30d') return ts >= now - (30 * 24 * 60 * 60 * 1000);
  return true;
}

function priorityClass(priority) {
  const p = String(priority || '').toLowerCase();
  if (p === 'rot') return 'task-token--rot';
  if (p === 'gelb') return 'task-token--gelb';
  return 'task-token--gruen';
}

function renderBulletinAttachments(attachments = []) {
  if (!Array.isArray(attachments) || attachments.length === 0) return '';
  return attachments.map((item, index) => {
    const url = item?.url || '';
    const type = String(item?.type || '').toLowerCase();
    if (!url) return '';
    if (type === 'pdf') {
      return `
        <div class="bulletin-attachment bulletin-attachment--pdf">
          <iframe src="${escapeHtml(url)}" title="PDF-Anhang ${index + 1}" loading="lazy"></iframe>
          <a class="bulletin-attachment-link" href="${escapeHtml(url)}" target="_blank" rel="noopener">PDF in neuem Tab öffnen</a>
        </div>`;
    }
    return `
      <div class="bulletin-attachment bulletin-attachment--image">
        <img src="${escapeHtml(url)}" alt="Anhang ${index + 1}" loading="lazy">
      </div>`;
  }).join('');
}

function renderBulletinCard(data) {
  const card = document.getElementById('bulletin-card');
  if (!card) return;

  const message = String(data?.message || '').trim();
  const attachments = Array.isArray(data?.attachments) ? data.attachments : [];
  const hasContent = message || attachments.length > 0;

  if (!hasContent) {
    card.classList.add('hidden');
    card.innerHTML = '';
    return;
  }

  const updatedLabel = data?.updatedAt?.toDate
    ? data.updatedAt.toDate().toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : (data?.updatedAt ? String(data.updatedAt).slice(0, 16) : '');

  card.classList.remove('hidden');
  card.innerHTML = `
    <div class="bulletin-card-header">
      <span class="bulletin-card-kicker">Nachricht des Tages</span>
      ${updatedLabel ? `<span class="bulletin-card-meta">${escapeHtml(updatedLabel)}${data?.author ? ` · ${escapeHtml(data.author)}` : ''}</span>` : ''}
    </div>
    ${message ? `<p class="bulletin-card-message">${escapeHtml(message).replace(/\n/g, '<br>')}</p>` : ''}
    <div class="bulletin-card-attachments">${renderBulletinAttachments(attachments)}</div>
  `;
}

function sortOpenEntries(entries) {
  const prioOrder = { Rot: 0, Gelb: 1, Grün: 2 };
  return [...entries].sort((a, b) => {
    const aOver = isTaskOverdue(a) ? 0 : 1;
    const bOver = isTaskOverdue(b) ? 0 : 1;
    if (aOver !== bOver) return aOver - bOver;
    return (prioOrder[a.priority] ?? 9) - (prioOrder[b.priority] ?? 9);
  });
}

function renderInfoFeed(tasks) {
  const lists = [
    document.getElementById('team-info-feed'),
    document.getElementById('team-info-feed-start'),
  ].filter(Boolean);
  const empties = [
    document.getElementById('team-info-empty'),
    document.getElementById('team-info-empty-start'),
  ].filter(Boolean);
  if (!lists.length) return;

  const visible = sortOpenEntries(
    (tasks || []).filter((t) => entryKindOf(t) === 'info' && taskMatchesViewer(t)),
  );

  if (visible.length === 0) {
    lists.forEach((list) => { list.innerHTML = ''; });
    empties.forEach((el) => el.classList.remove('hidden'));
    updateTeamInboxUi();
    return;
  }
  empties.forEach((el) => el.classList.add('hidden'));
  const html = visible.map((entry) => {
    const schedule = formatTaskScheduleLabel(entry);
    return `
    <article class="team-info-card" data-task-id="${escapeHtml(entry.id)}">
      <div class="team-info-card-body">
        <span class="team-info-kicker">Info · ${escapeHtml(formatAudienceLabel(entry))}${entry.author ? ` · ${escapeHtml(entry.author)}` : ''}</span>
        <strong class="team-info-title">${escapeHtml(entry.title)}</strong>
        ${entry.body ? `<p class="team-info-body">${escapeHtml(entry.body).replace(/\n/g, '<br>')}</p>` : ''}
        ${schedule ? `<span class="team-info-meta">${escapeHtml(schedule)}</span>` : ''}
      </div>
      <button type="button" class="task-token-done team-info-quitt" data-task-complete="${escapeHtml(entry.id)}" aria-label="Gelesen quittieren">✓</button>
    </article>
  `;
  }).join('');
  lists.forEach((list) => { list.innerHTML = html; });
  updateTeamInboxUi();
}

function countOpenTeamInbox() {
  const all = teamboardState.allTasks || [];
  const infoCount = all.filter((t) => entryKindOf(t) === 'info' && taskMatchesViewer(t)).length;
  const taskCount = (teamboardState.openTasks || []).length;
  return { infoCount, taskCount, total: infoCount + taskCount };
}

function updateTeamInboxUi() {
  const { infoCount, taskCount, total } = countOpenTeamInbox();
  const startTab = document.getElementById('tab-teamboard');
  if (startTab) {
    let badge = startTab.querySelector('.nav-unread-badge');
    if (total > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'nav-unread-badge';
        badge.setAttribute('aria-label', `${total} offene Team-Einträge`);
        startTab.appendChild(badge);
      }
      badge.textContent = String(total);
    } else if (badge) {
      badge.remove();
    }
  }

  const banner = document.getElementById('team-inbox-banner-start');
  if (!banner) return;
  if (!getActiveEmployeeName() || total === 0) {
    banner.classList.add('hidden');
    banner.textContent = '';
    return;
  }
  const parts = [];
  if (infoCount > 0) parts.push(`${infoCount} Info${infoCount > 1 ? 's' : ''}`);
  if (taskCount > 0) parts.push(`${taskCount} Aufgabe${taskCount > 1 ? 'n' : ''}`);
  banner.classList.remove('hidden');
  banner.innerHTML = `<strong>${total} offen für dich:</strong> ${parts.join(' · ')} – siehe unten.`;
}

function renderTaskTokens(tasks) {
  const list = document.getElementById('task-token-list');
  const empty = document.getElementById('task-token-empty');
  if (!list) return;

  const visible = sortOpenEntries(
    (tasks || []).filter((t) => entryKindOf(t) === 'task' && taskMatchesViewer(t)),
  );
  teamboardState.openTasks = visible;

  if (visible.length === 0) {
    list.innerHTML = '';
    if (empty) empty.classList.remove('hidden');
    return;
  }

  if (empty) empty.classList.add('hidden');
  list.innerHTML = visible.map((task) => {
    const schedule = formatTaskScheduleLabel(task);
    const overdueClass = isTaskOverdue(task) ? ' task-token--overdue' : '';
    const overdueLabel = isTaskOverdue(task) ? '<span class="task-token-overdue-label">Überfällig</span>' : '';
    return `
    <article class="task-token ${priorityClass(task.priority)}${overdueClass}" data-task-id="${escapeHtml(task.id)}">
      <div class="task-token-body">
        <div class="task-token-prio" aria-hidden="true">${task.priority === 'Rot' ? '🔴' : task.priority === 'Gelb' ? '🟡' : '🟢'}</div>
        <div class="task-token-text">
          <strong class="task-token-title">${escapeHtml(task.title)}</strong>
          <span class="task-token-route">${escapeHtml(formatAudienceLabel(task))}${schedule ? ` · ${escapeHtml(schedule)}` : ''} ${overdueLabel}</span>
        </div>
      </div>
      <button type="button" class="task-token-done" data-task-complete="${escapeHtml(task.id)}" aria-label="Aufgabe erledigt quittieren">
        ✓
      </button>
    </article>
  `;
  }).join('');
  updateTeamInboxUi();
}

function renderTaskHistory(tasks) {
  const list = document.getElementById('task-history-list');
  const empty = document.getElementById('task-history-empty');
  if (!list) return;

  const visible = (tasks || [])
    .filter(completedTaskMatchesViewer)
    .filter((task) => isInHistoryRange(task, teamboardState.historyFilter))
    .sort((a, b) => {
      const aTime = toEpochMs(a?.completedAt);
      const bTime = toEpochMs(b?.completedAt);
      return bTime - aTime;
    })
    .slice(0, 20);

  teamboardState.completedTasks = visible;

  if (visible.length === 0) {
    list.innerHTML = '';
    if (empty) empty.classList.remove('hidden');
    return;
  }

  if (empty) empty.classList.add('hidden');
  list.innerHTML = visible.map((task) => {
    const ts = toEpochMs(task?.completedAt);
    const completedAt = ts
      ? new Date(ts).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      : '';
    return `
      <article class="task-history-row ${priorityClass(task.priority)}">
        <div class="task-history-main">
          <strong>${escapeHtml(task.title)}</strong>
          <span>${escapeHtml(task.completedBy || 'Unbekannt')} · ${escapeHtml(completedAt || 'Zeitpunkt ausstehend')}</span>
        </div>
      </article>
    `;
  }).join('');
}

function renderAdminTaskList(tasks) {
  const container = document.getElementById('admin-task-list');
  if (!container) return;

  const open = (tasks || []).filter((t) => t.status === 'open');
  if (open.length === 0) {
    container.innerHTML = '<p class="admin-leitstand-hint">Keine offenen Aufgaben-Tokens.</p>';
    return;
  }

  container.innerHTML = open.map((task) => `
    <div class="admin-task-row ${priorityClass(task.priority)}">
      <div>
        <strong>${escapeHtml(task.title)}</strong>
        <span>${escapeHtml(formatAudienceLabel(task))} · ${escapeHtml(task.priority)} · ${escapeHtml(formatTaskScheduleLabel(task) || task.targetDate || '–')}</span>
      </div>
    </div>
  `).join('');
}

function bindShiftSelector() {
  const select = document.getElementById('team-shift-select');
  if (!select || select.dataset.teamboardBound === '1') return;
  select.dataset.teamboardBound = '1';
  select.value = getActiveShift();
  select.addEventListener('change', () => {
    setActiveShift(select.value);
    subscribeTasks();
  });
}

function setActiveEmployee(employeeName) {
  const cleanName = String(employeeName || '').trim();
  try {
    if (cleanName) {
      localStorage.setItem(ACTIVE_EMPLOYEE_STORAGE_KEY, cleanName);
    } else {
      localStorage.removeItem(ACTIVE_EMPLOYEE_STORAGE_KEY);
    }
  } catch (_) { /* noop */ }
  window.dispatchEvent(new CustomEvent('charculogic:active-employee-changed', {
    detail: { employeeName: cleanName },
  }));
}

function refreshTeamLoginUi() {
  const select = document.getElementById('team-login-employee');
  const pinInput = document.getElementById('team-login-pin');
  const current = getActiveEmployeeName();
  const status = document.getElementById('team-login-status');
  if (select && current) select.value = current;
  if (select && !current) select.value = '';
  if (pinInput) pinInput.value = '';
  if (status) status.textContent = current ? `Angemeldet als: ${current}` : 'Angemeldet als: —';
}

function bindTeamLogin() {
  const submit = document.getElementById('team-login-submit');
  const logout = document.getElementById('team-login-logout');
  if (!submit || submit.dataset.teamboardBound === '1') return;
  submit.dataset.teamboardBound = '1';

  submit.addEventListener('click', () => {
    const employee = document.getElementById('team-login-employee')?.value?.trim() || '';
    const pin = document.getElementById('team-login-pin')?.value?.trim() || '';
    if (!employee) {
      window.showToast?.('Bitte Mitarbeiter auswählen.', 'warning');
      return;
    }
    if (!pin || pin.length !== 4) {
      window.showToast?.('Bitte 4-stellige PIN eingeben.', 'warning');
      return;
    }
    if (EMPLOYEE_PINS[employee] !== pin) {
      window.showToast?.('Falsche PIN.', 'error');
      return;
    }
    setActiveEmployee(employee);
    window.showToast?.(`Angemeldet als ${employee}`, 'success');
    refreshTeamLoginUi();
    subscribeTasks();
  });

  logout?.addEventListener('click', () => {
    setActiveEmployee('');
    window.showToast?.('Mitarbeiter abgemeldet.', 'warning');
    refreshTeamLoginUi();
    subscribeTasks();
  });
}

function bindHistoryFilter() {
  const select = document.getElementById('task-history-filter');
  if (!select || select.dataset.teamboardBound === '1') return;
  select.dataset.teamboardBound = '1';
  select.value = teamboardState.historyFilter;
  select.addEventListener('change', () => {
    teamboardState.historyFilter = select.value || '7d';
    renderTaskHistory(teamboardState.allTasks);
  });
}

function bindTeamHomeEvents() {
  const onCompleteClick = (event) => {
    const taskId = event.target.closest('[data-task-complete]')?.dataset.taskComplete;
    if (taskId) completeTask(taskId);
  };

  const list = document.getElementById('task-token-list');
  if (list && list.dataset.teamboardBound !== '1') {
    list.dataset.teamboardBound = '1';
    list.addEventListener('click', onCompleteClick);
  }

  ['team-info-feed', 'team-info-feed-start'].forEach((id) => {
    const infoFeed = document.getElementById(id);
    if (infoFeed && infoFeed.dataset.teamboardBound !== '1') {
      infoFeed.dataset.teamboardBound = '1';
      infoFeed.addEventListener('click', onCompleteClick);
    }
  });

  window.addEventListener('charculogic:active-employee-changed', () => {
    resetTeamNotifyBootstrap();
    subscribeTasks();
    renderTaskHistory(teamboardState.completedTasks);
    refreshTeamLoginUi();
  });
  window.addEventListener('charculogic:team-config-changed', () => {
    refreshAudienceGroupOptions();
    document.querySelectorAll('[data-audience-persons-list]').forEach((el) => {
      delete el.dataset.filled;
    });
    document.querySelectorAll('form.team-compose-form').forEach((form) => {
      fillAudiencePersonCheckboxes(form);
    });
    subscribeTasks();
  });
  window.addEventListener('charculogic:active-shift-changed', () => {
    const select = document.getElementById('team-shift-select');
    if (select) select.value = getActiveShift();
    subscribeTasks();
    renderTaskHistory(teamboardState.completedTasks);
  });
}

async function uploadBulletinFile(file) {
  const firebase = teamboardState.getFirebase();
  if (!firebase?.storage) throw new Error('Firebase Storage ist nicht geladen.');
  const tenantId = teamboardState.tenantId;
  if (!tenantId) throw new Error('Mandant fehlt.');

  const safeName = String(file.name || 'anhang').replace(/[^\w.\-]+/g, '_');
  const path = `tenants/${tenantId}/bulletin/${Date.now()}_${safeName}`;
  const ref = firebase.storage().ref(path);
  const snapshot = await ref.put(file);
  const url = await snapshot.ref.getDownloadURL();
  const mime = String(file.type || '').toLowerCase();
  const type = mime.includes('pdf') || safeName.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image';
  return { type, url };
}

function renderPendingAttachments() {
  const preview = document.getElementById('bulletin-upload-preview');
  if (!preview) return;
  if (teamboardState.pendingAttachments.length === 0) {
    preview.innerHTML = '';
    preview.classList.add('hidden');
    return;
  }
  preview.classList.remove('hidden');
  preview.innerHTML = teamboardState.pendingAttachments.map((item, index) => `
    <div class="bulletin-upload-chip">
      <span>${item.type === 'pdf' ? '📄' : '🖼️'} ${escapeHtml(item.name)}</span>
      <button type="button" data-remove-attachment="${index}" aria-label="Anhang entfernen">×</button>
    </div>
  `).join('');
}

function readAudienceFromForm(form) {
  const audienceType = form.querySelector('[name="audience-type"]')?.value || 'all';
  const today = todayIsoLocal();
  const result = {
    audienceType,
    audienceGroup: null,
    audienceMembers: null,
    assignedTo: null,
    context: null,
    targetDate: null,
    validFrom: null,
    validUntil: null,
  };

  if (audienceType === 'group') {
    result.audienceGroup = form.querySelector('[name="audience-group"]')?.value || null;
    if (!result.audienceGroup || !getTeamGroups()[result.audienceGroup]) {
      return { error: 'Bitte Team-Gruppe wählen.' };
    }
  } else if (audienceType === 'persons') {
    const picked = Array.from(form.querySelectorAll('[name="audience-person"]:checked'))
      .map((el) => el.value)
      .filter((n) => getTeamEmployees().includes(n));
    if (picked.length === 0) {
      return { error: 'Bitte mindestens einen Kollegen auswählen.' };
    }
    result.audienceMembers = picked;
  } else if (audienceType === 'shift') {
    result.context = form.querySelector('[name="shift-context"]')?.value || null;
    result.validFrom = normalizeDateField(form.querySelector('[name="valid-from"]')?.value) || today;
    result.validUntil = normalizeDateField(form.querySelector('[name="valid-until"]')?.value) || result.validFrom;
    if (!result.context) return { error: 'Bitte Schicht wählen.' };
    if (result.validFrom > result.validUntil) {
      return { error: 'Zeitraum „bis“ muss am oder nach „von“ liegen.' };
    }
    result.targetDate = result.validFrom;
  } else if (audienceType === 'next_shift') {
    const next = getNextShiftInfo();
    result.context = next.context;
    result.validFrom = next.validFrom;
    result.validUntil = next.validUntil;
    result.targetDate = next.validFrom;
  } else if (audienceType === 'person') {
    result.assignedTo = form.querySelector('[name="audience-person-single"]')?.value || null;
    if (!result.assignedTo) return { error: 'Bitte Kollegen wählen.' };
    result.validFrom = normalizeDateField(form.querySelector('[name="person-valid-from"]')?.value);
    result.validUntil = normalizeDateField(form.querySelector('[name="person-valid-until"]')?.value);
    if (result.validFrom && result.validUntil && result.validFrom > result.validUntil) {
      return { error: '„Anzeigen bis“ muss am oder nach „Anzeigen ab“ liegen.' };
    }
    if (result.validFrom && !result.validUntil) result.validUntil = result.validFrom;
    if (!result.validFrom && result.validUntil) result.validFrom = result.validUntil;
    result.targetDate = result.validFrom;
  }

  return { data: result };
}

function syncAudiencePanels(form) {
  const type = form.querySelector('[name="audience-type"]')?.value || 'all';
  form.querySelectorAll('[data-audience-panel]').forEach((panel) => {
    const show = panel.dataset.audiencePanel === type;
    panel.classList.toggle('hidden', !show);
  });
  const prioWrap = form.querySelector('[data-compose-priority]');
  const entryKind = form.querySelector('[name="entry-kind"]:checked')?.value
    || form.querySelector('[name="entry-kind"]')?.value
    || 'task';
  if (prioWrap) prioWrap.classList.toggle('hidden', entryKind === 'info');
}

function fillAudiencePersonCheckboxes(form) {
  const container = form.querySelector('[data-audience-persons-list]');
  if (!container || container.dataset.filled === '1') return;
  container.dataset.filled = '1';
  container.innerHTML = getTeamEmployees().map((name) => `
    <label class="task-routing-option">
      <input type="checkbox" name="audience-person" value="${escapeHtml(name)}">
      <span>${escapeHtml(name)}</span>
    </label>
  `).join('');
}

function refreshAudienceGroupOptions() {
  const groups = getTeamGroups();
  document.querySelectorAll('select[name="audience-group"]').forEach((select) => {
    const current = select.value;
    select.innerHTML = Object.entries(groups)
      .map(([id, group]) => `<option value="${escapeHtml(id)}">${escapeHtml(group.label)}</option>`)
      .join('');
    if (groups[current]) select.value = current;
  });

  document.querySelectorAll('select[name="audience-person-single"]').forEach((select) => {
    const current = select.value;
    const employees = getTeamEmployees();
    select.innerHTML = `<option value="">Bitte wählen…</option>${employees
      .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
      .join('')}`;
    if (employees.includes(current)) select.value = current;
  });
}

export function mountComposeForms() {
  const tpl = document.getElementById('team-compose-template');
  if (!tpl) return;
  ['team-compose-mount', 'admin-compose-mount'].forEach((mountId) => {
    const mount = document.getElementById(mountId);
    if (!mount || mount.dataset.mounted === '1') return;
    mount.appendChild(tpl.content.cloneNode(true));
    mount.dataset.mounted = '1';
  });
  refreshAudienceGroupOptions();
  bindComposeForms();
}

function bindComposeForm(form) {
  if (!form || form.dataset.composeBound === '1') return;
  form.dataset.composeBound = '1';
  fillAudiencePersonCheckboxes(form);

  const audienceSelect = form.querySelector('[name="audience-type"]');
  audienceSelect?.addEventListener('change', () => syncAudiencePanels(form));
  form.querySelectorAll('[name="entry-kind"]').forEach((radio) => {
    radio.addEventListener('change', () => syncAudiencePanels(form));
  });
  syncAudiencePanels(form);

  const today = todayIsoLocal();
  form.querySelectorAll('[name="valid-from"], [name="valid-until"], [name="due-date"]').forEach((el) => {
    if (el && !el.value) el.value = today;
  });

  form.querySelectorAll('[data-priority-pick]').forEach((btn) => {
    btn.addEventListener('click', () => {
      form.querySelectorAll('[data-priority-pick]').forEach((b) => b.classList.remove('is-selected'));
      btn.classList.add('is-selected');
      const hidden = form.querySelector('[name="priority-value"]');
      if (hidden) hidden.value = btn.dataset.priorityPick || 'Gelb';
      teamboardState.playClickSound(700, 0.04, 0.1);
    });
  });
  const defaultPrio = form.querySelector('[data-priority-pick="Gelb"]');
  defaultPrio?.classList.add('is-selected');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    createTeamEntryFromForm(form);
  });
}

function bindComposeForms() {
  document.querySelectorAll('form.team-compose-form').forEach(bindComposeForm);
}

async function createTeamEntryFromForm(form) {
  const employee = getActiveEmployeeName();
  if (!employee) {
    window.showToast?.('Bitte zuerst als Mitarbeiter anmelden (Name + PIN).', 'warning');
    return;
  }

  const title = form.querySelector('[name="compose-title"]')?.value?.trim();
  if (!title) {
    window.showToast?.('Bitte einen Titel eingeben.', 'warning');
    return;
  }

  const entryKind = form.querySelector('[name="entry-kind"]:checked')?.value
    || form.querySelector('[name="entry-kind"]')?.value
    || 'task';
  const priority = form.querySelector('[name="priority-value"]')?.value || 'Gelb';
  if (entryKind === 'task' && !TASK_PRIORITIES.includes(priority)) {
    window.showToast?.('Bitte Priorität wählen.', 'warning');
    return;
  }

  const audienceResult = readAudienceFromForm(form);
  if (audienceResult.error) {
    window.showToast?.(audienceResult.error, 'warning');
    return;
  }
  const audience = audienceResult.data;
  const body = form.querySelector('[name="compose-body"]')?.value?.trim() || null;
  const dueDate = normalizeDateField(form.querySelector('[name="due-date"]')?.value);

  const taskId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const firebase = teamboardState.getFirebase();
  const payload = {
    title,
    entryKind,
    audienceType: audience.audienceType,
    priority: entryKind === 'info' ? 'Grün' : priority,
    status: 'open',
    tenantId: teamboardState.tenantId,
    author: employee,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
  if (body) payload.body = body;
  if (audience.audienceGroup) payload.audienceGroup = audience.audienceGroup;
  if (audience.audienceMembers?.length) payload.audienceMembers = audience.audienceMembers;
  if (audience.assignedTo) payload.assignedTo = audience.assignedTo;
  if (audience.context) payload.context = audience.context;
  if (audience.targetDate) payload.targetDate = audience.targetDate;
  if (audience.validFrom) payload.validFrom = audience.validFrom;
  if (audience.validUntil) payload.validUntil = audience.validUntil;
  if (dueDate) payload.dueDate = dueDate;

  const queueData = {
    title: payload.title,
    entryKind: payload.entryKind,
    audienceType: payload.audienceType,
    priority: payload.priority,
    status: payload.status,
    tenantId: payload.tenantId,
    author: payload.author,
    createdAt: new Date().toISOString(),
  };
  if (payload.body) queueData.body = payload.body;
  if (payload.audienceGroup) queueData.audienceGroup = payload.audienceGroup;
  if (payload.audienceMembers) queueData.audienceMembers = payload.audienceMembers;
  if (payload.assignedTo) queueData.assignedTo = payload.assignedTo;
  if (payload.context) queueData.context = payload.context;
  if (payload.targetDate) queueData.targetDate = payload.targetDate;
  if (payload.validFrom) queueData.validFrom = payload.validFrom;
  if (payload.validUntil) queueData.validUntil = payload.validUntil;
  if (payload.dueDate) queueData.dueDate = payload.dueDate;

  try {
    await writeFirestoreDocOrQueue({
      collectionPath: 'tasks',
      docId: taskId,
      op: 'set',
      onlineData: payload,
      queueData,
      offlineMessage: 'Eintrag wird synchronisiert, sobald WLAN verfügbar ist.',
    });
    form.reset();
    syncAudiencePanels(form);
    const resetToday = todayIsoLocal();
    form.querySelectorAll('[name="valid-from"], [name="valid-until"], [name="due-date"]').forEach((el) => {
      if (el) el.value = resetToday;
    });
    form.querySelectorAll('[name="person-valid-from"], [name="person-valid-until"]').forEach((el) => {
      if (el) el.value = '';
    });
    const hiddenPrio = form.querySelector('[name="priority-value"]');
    if (hiddenPrio) hiddenPrio.value = 'Gelb';
    form.querySelectorAll('[data-priority-pick]').forEach((b) => b.classList.remove('is-selected'));
    form.querySelector('[data-priority-pick="Gelb"]')?.classList.add('is-selected');
    const kindTask = form.querySelector('[name="entry-kind"][value="task"]');
    if (kindTask) kindTask.checked = true;
    window.showToast?.(entryKind === 'info' ? 'Info gesendet.' : 'Aufgaben-Token erstellt.', 'success');
  } catch (err) {
    console.error('[Teamboard] Eintrag anlegen fehlgeschlagen:', err);
    const code = String(err?.code || '');
    if (!code.includes('permission-denied')) {
      window.showToast?.('Eintrag konnte nicht gespeichert werden.', 'error');
    }
  }
}

function updateAdminPanelVisibility() {
  const panel = document.getElementById('admin-leitstand-panel');
  if (!panel) return;
  const ctx = getAuthContext();
  panel.classList.toggle('hidden', !ctx?.isAdmin);
}

function bindAdminPanel() {
  const panel = document.getElementById('admin-leitstand-panel');
  if (!panel) return;

  updateAdminPanelVisibility();
  const ctx = getAuthContext();
  if (!ctx?.isAdmin) return;

  if (panel.dataset.teamboardAdminBound === '1') return;
  panel.dataset.teamboardAdminBound = '1';

  const dropzone = document.getElementById('bulletin-dropzone');
  const fileInput = document.getElementById('bulletin-file-input');
  const preview = document.getElementById('bulletin-upload-preview');
  const saveBtn = document.getElementById('bulletin-save-btn');
  if (dropzone && fileInput && dropzone.dataset.teamboardBound !== '1') {
    dropzone.dataset.teamboardBound = '1';
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('is-dragover');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('is-dragover');
      handleBulletinFiles(e.dataTransfer?.files);
    });
    fileInput.addEventListener('change', () => {
      handleBulletinFiles(fileInput.files);
      fileInput.value = '';
    });
  }

  preview?.addEventListener('click', (e) => {
    const index = e.target.closest('[data-remove-attachment]')?.dataset.removeAttachment;
    if (index === undefined) return;
    teamboardState.pendingAttachments.splice(Number(index), 1);
    renderPendingAttachments();
  });

  saveBtn?.addEventListener('click', () => saveBulletin());
}

async function handleBulletinFiles(fileList) {
  const files = Array.from(fileList || []).filter((f) => f && f.size > 0);
  if (files.length === 0) return;

  for (const file of files) {
    const mime = String(file.type || '').toLowerCase();
    const isPdf = mime.includes('pdf') || file.name.toLowerCase().endsWith('.pdf');
    const isImage = mime.startsWith('image/');
    if (!isPdf && !isImage) {
      window.showToast?.('Nur Bilder und PDFs werden unterstützt.', 'warning');
      continue;
    }
    teamboardState.pendingAttachments.push({
      name: file.name,
      file,
      type: isPdf ? 'pdf' : 'image',
      status: 'pending',
    });
  }
  renderPendingAttachments();
}

async function saveBulletin() {
  verifyAdminAction(async () => {
    const messageEl = document.getElementById('bulletin-message-input');
    const message = messageEl?.value?.trim() || '';
    const saveBtn = document.getElementById('bulletin-save-btn');

    if (!message && teamboardState.pendingAttachments.length === 0) {
      window.showToast?.('Bitte Nachricht oder Anhang eingeben.', 'warning');
      return;
    }

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Wird veröffentlicht…';
    }

    try {
      const uploaded = [];
      for (const item of teamboardState.pendingAttachments) {
        if (item.url) {
          uploaded.push({ type: item.type, url: item.url });
          continue;
        }
        if (!item.file) continue;
        const result = await uploadBulletinFile(item.file);
        uploaded.push(result);
      }

      const existing = teamboardState.currentBulletin?.attachments || [];
      const attachments = [
        ...existing.filter((a) => a?.url),
        ...uploaded,
      ];

      const firebase = teamboardState.getFirebase();
      const payload = {
        message,
        attachments,
        author: resolveAuthorName(),
        tenantId: teamboardState.tenantId,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      };

      await writeFirestoreDocOrQueue({
        collectionPath: 'bulletinBoard',
        docId: BULLETIN_DOC_ID,
        op: 'set',
        onlineData: payload,
        queueData: { ...payload, updatedAt: new Date().toISOString() },
        offlineMessage: 'Nachricht wird synchronisiert, sobald WLAN verfügbar ist.',
      });

      teamboardState.pendingAttachments = [];
      renderPendingAttachments();
      if (messageEl) messageEl.value = '';
      window.showToast?.('Nachricht des Tages veröffentlicht.', 'success');
      teamboardState.showHUD('Veröffentlicht', 'Das Team sieht die Infokarte ab sofort.', '✔️');
    } catch (err) {
      console.error('[Teamboard] Bulletin speichern fehlgeschlagen:', err);
      window.showToast?.('Speichern fehlgeschlagen.', 'error');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Nachricht veröffentlichen';
      }
    }
  });
}

async function completeTask(taskId) {
  const employee = getActiveEmployeeName();
  if (!employee) {
    window.showToast?.('Bitte zuerst per PIN als Mitarbeiter anmelden (Scan).', 'warning');
    return;
  }

  const firebase = teamboardState.getFirebase();
  const payload = {
    status: 'completed',
    completedBy: employee,
    completedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };

  try {
    teamboardState.playClickSound(520, 0.05, 0.18);
    await writeFirestoreDocOrQueue({
      collectionPath: 'tasks',
      docId: taskId,
      op: 'update',
      onlineData: payload,
      queueData: { ...payload, completedAt: new Date().toISOString() },
      offlineMessage: 'Erledigt-Markierung wird synchronisiert.',
    });
    const kind = entryKindOf(teamboardState.allTasks.find((t) => t.id === taskId));
    window.showToast?.(
      kind === 'info' ? `Quittiert – ${employee}` : `Erledigt & quittiert – ${employee}`,
      'success',
    );
  } catch (err) {
    console.error('[Teamboard] Task abschließen fehlgeschlagen:', err);
    window.showToast?.('Konnte nicht als erledigt markiert werden.', 'error');
  }
}

function subscribeBulletin() {
  teamboardState.bulletinUnsubscribe?.();
  const ref = bulletinRef();
  if (!ref) return;

  teamboardState.bulletinUnsubscribe = ref.onSnapshot(
    (snap) => {
      const data = snap.exists ? snap.data() : null;
      teamboardState.currentBulletin = data;
      renderBulletinCard(data);

      const adminMessage = document.getElementById('bulletin-message-input');
      if (adminMessage && document.activeElement !== adminMessage && data?.message) {
        adminMessage.value = data.message;
      }
    },
    (err) => console.warn('[Teamboard] Bulletin-Stream:', err)
  );
}

function subscribeTasks() {
  teamboardState.tasksUnsubscribe?.();
  const col = tasksCollectionRef();
  if (!col) return;

  teamboardState.tasksUnsubscribe = col.onSnapshot(
    (snap) => {
      const all = snap.docs.map((doc) => normalizeTaskRecord({ id: doc.id, ...doc.data() }));
      teamboardState.allTasks = all;
      const open = all.filter((t) => t.status === 'open');
      open.sort((a, b) => {
        const prioOrder = { Rot: 0, Gelb: 1, Grün: 2 };
        return (prioOrder[a.priority] ?? 9) - (prioOrder[b.priority] ?? 9);
      });
      renderInfoFeed(all);
      renderTaskTokens(open);
      renderTaskHistory(all);
      renderAdminTaskList(open);
      handleTasksSnapshotForNotify(all, { matchesViewer: taskMatchesViewer });
    },
    (err) => console.warn('[Teamboard] Tasks-Stream:', err)
  );
}

export function initTeamboardModule(databaseInstance, options = {}) {
  teamboardState.db = databaseInstance;
  teamboardState.tenantId = options.tenantId || '';
  teamboardState.getFirebase = typeof options.getFirebase === 'function' ? options.getFirebase : teamboardState.getFirebase;
  teamboardState.showHUD = typeof options.showHUD === 'function' ? options.showHUD : teamboardState.showHUD;
  teamboardState.playClickSound = typeof options.playClickSound === 'function' ? options.playClickSound : teamboardState.playClickSound;

  bindShiftSelector();
  bindTeamLogin();
  bindHistoryFilter();
  bindTeamHomeEvents();
  mountComposeForms();
  bindAdminPanel();
  subscribeBulletin();
  subscribeTasks();
  refreshTeamLoginUi();
}

export function activateTeamboardTab() {
  // Re-bind lightweight UI hooks and re-render from latest local state
  // whenever the tab becomes visible again.
  bindShiftSelector();
  bindHistoryFilter();
  mountComposeForms();
  refreshTeamLoginUi();
  renderBulletinCard(teamboardState.currentBulletin);
  renderInfoFeed(teamboardState.allTasks);
  renderTaskTokens(teamboardState.openTasks);
  renderTaskHistory(teamboardState.allTasks);

  // Ensure streams are alive after tab switches/backgrounding.
  if (!teamboardState.bulletinUnsubscribe) subscribeBulletin();
  if (!teamboardState.tasksUnsubscribe) subscribeTasks();
}

export function refreshTeamboardAdminPanel() {
  updateAdminPanelVisibility();
  mountComposeForms();
  bindAdminPanel();
}
