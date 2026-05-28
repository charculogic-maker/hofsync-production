/**
 * Digitales Schwarzes Brett + Aufgaben-Tokens (Team-Leitstand)
 */

import { getAuthContext, verifyAdminAction } from './auth.js';
import { writeFirestoreDocOrQueue } from './sync.js';

export const TEAM_EMPLOYEES = ['Stephie', 'Finn', 'Nicole', 'Bettina', 'Heiko', 'Paddy'];
export const TEAM_SHIFTS = ['Frühschicht', 'Spätschicht'];
export const TASK_PRIORITIES = ['Rot', 'Gelb', 'Grün'];
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
  const shift = getActiveShift();
  const today = todayIsoLocal();

  if (task.assignedTo && employee && task.assignedTo === employee) return true;
  if (!task.assignedTo && task.context === shift) {
    const targetDate = task.targetDate || today;
    return targetDate === today;
  }
  return false;
}

function completedTaskMatchesViewer(task) {
  if (!task || task.status !== 'completed') return false;
  const employee = getActiveEmployeeName();
  const shift = getActiveShift();
  const completedByViewer = employee && task.completedBy === employee;
  const assignedToViewer = employee && task.assignedTo === employee;
  const shiftContextMatch = !task.assignedTo && task.context === shift;
  return !!(completedByViewer || assignedToViewer || shiftContextMatch);
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

function renderTaskTokens(tasks) {
  const list = document.getElementById('task-token-list');
  const empty = document.getElementById('task-token-empty');
  if (!list) return;

  const visible = (tasks || []).filter(taskMatchesViewer);
  teamboardState.openTasks = visible;

  if (visible.length === 0) {
    list.innerHTML = '';
    if (empty) empty.classList.remove('hidden');
    return;
  }

  if (empty) empty.classList.add('hidden');
  list.innerHTML = visible.map((task) => `
    <article class="task-token ${priorityClass(task.priority)}" data-task-id="${escapeHtml(task.id)}">
      <div class="task-token-body">
        <div class="task-token-prio" aria-hidden="true">${task.priority === 'Rot' ? '🔴' : task.priority === 'Gelb' ? '🟡' : '🟢'}</div>
        <div class="task-token-text">
          <strong class="task-token-title">${escapeHtml(task.title)}</strong>
          <span class="task-token-route">${escapeHtml(task.assignedTo || task.context || 'Team')}${task.targetDate ? ` · ${escapeHtml(task.targetDate)}` : ''}</span>
        </div>
      </div>
      <button type="button" class="task-token-done" data-task-complete="${escapeHtml(task.id)}" aria-label="Aufgabe erledigt">
        ✓
      </button>
    </article>
  `).join('');
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
        <span>${escapeHtml(task.assignedTo || task.context || '–')} · ${escapeHtml(task.priority)} · ${escapeHtml(task.targetDate || '–')}</span>
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
  const list = document.getElementById('task-token-list');
  if (list && list.dataset.teamboardBound !== '1') {
    list.dataset.teamboardBound = '1';
    list.addEventListener('click', (event) => {
      const taskId = event.target.closest('[data-task-complete]')?.dataset.taskComplete;
      if (taskId) completeTask(taskId);
    });
  }

  window.addEventListener('charculogic:active-employee-changed', () => {
    subscribeTasks();
    renderTaskHistory(teamboardState.completedTasks);
    refreshTeamLoginUi();
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
  const taskForm = document.getElementById('admin-task-form');
  const routingRadios = document.querySelectorAll('input[name="task-routing"]');
  const personWrap = document.getElementById('task-routing-person');
  const contextWrap = document.getElementById('task-routing-context');

  function syncRoutingVisibility() {
    const mode = document.querySelector('input[name="task-routing"]:checked')?.value || 'person';
    personWrap?.classList.toggle('hidden', mode !== 'person');
    contextWrap?.classList.toggle('hidden', mode !== 'context');
  }

  routingRadios.forEach((radio) => {
    radio.addEventListener('change', syncRoutingVisibility);
  });
  syncRoutingVisibility();

  const dateInput = document.getElementById('task-target-date');
  if (dateInput && !dateInput.value) dateInput.value = todayIsoLocal();

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

  taskForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    createTaskFromForm();
  });

  document.querySelectorAll('[data-priority-pick]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-priority-pick]').forEach((b) => b.classList.remove('is-selected'));
      btn.classList.add('is-selected');
      const hidden = document.getElementById('task-priority-value');
      if (hidden) hidden.value = btn.dataset.priorityPick || 'Gelb';
      teamboardState.playClickSound(700, 0.04, 0.1);
    });
  });

  const defaultPrio = document.querySelector('[data-priority-pick="Gelb"]');
  defaultPrio?.classList.add('is-selected');
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

async function createTaskFromForm() {
  verifyAdminAction(async () => {
    const title = document.getElementById('task-title-input')?.value?.trim();
    if (!title) {
      window.showToast?.('Bitte einen Aufgabentitel eingeben.', 'warning');
      return;
    }

    const routing = document.querySelector('input[name="task-routing"]:checked')?.value || 'person';
    const priority = document.getElementById('task-priority-value')?.value || 'Gelb';
    if (!TASK_PRIORITIES.includes(priority)) {
      window.showToast?.('Bitte Priorität wählen.', 'warning');
      return;
    }

    let assignedTo = null;
    let context = null;
    let targetDate = todayIsoLocal();

    if (routing === 'person') {
      assignedTo = document.getElementById('task-assignee-select')?.value || null;
      if (!assignedTo) {
        window.showToast?.('Bitte Kollegen auswählen.', 'warning');
        return;
      }
    } else {
      context = document.getElementById('task-context-select')?.value || null;
      targetDate = document.getElementById('task-target-date')?.value || todayIsoLocal();
      if (!context) {
        window.showToast?.('Bitte Schicht-Kontext wählen.', 'warning');
        return;
      }
    }

    const taskId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const firebase = teamboardState.getFirebase();
    const payload = {
      title,
      assignedTo,
      context,
      targetDate,
      priority,
      status: 'open',
      completedBy: null,
      completedAt: null,
      tenantId: teamboardState.tenantId,
      author: resolveAuthorName(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    try {
      await writeFirestoreDocOrQueue({
        collectionPath: 'tasks',
        docId: taskId,
        op: 'set',
        onlineData: payload,
        queueData: { ...payload, createdAt: new Date().toISOString() },
        offlineMessage: 'Aufgabe wird synchronisiert, sobald WLAN verfügbar ist.',
      });
      document.getElementById('admin-task-form')?.reset();
      document.getElementById('task-target-date').value = todayIsoLocal();
      document.querySelectorAll('[data-priority-pick]').forEach((b) => b.classList.remove('is-selected'));
      document.querySelector('[data-priority-pick="Gelb"]')?.classList.add('is-selected');
      document.getElementById('task-priority-value').value = 'Gelb';
      window.showToast?.('Aufgaben-Token erstellt.', 'success');
    } catch (err) {
      console.error('[Teamboard] Task anlegen fehlgeschlagen:', err);
      window.showToast?.('Aufgabe konnte nicht gespeichert werden.', 'error');
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
    window.showToast?.(`Erledigt – ${employee}`, 'success');
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
      const all = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      teamboardState.allTasks = all;
      const open = all.filter((t) => t.status === 'open');
      open.sort((a, b) => {
        const prioOrder = { Rot: 0, Gelb: 1, Grün: 2 };
        return (prioOrder[a.priority] ?? 9) - (prioOrder[b.priority] ?? 9);
      });
      renderTaskTokens(open);
      renderTaskHistory(all);
      renderAdminTaskList(open);
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
  refreshTeamLoginUi();
  renderBulletinCard(teamboardState.currentBulletin);
  renderTaskTokens(teamboardState.openTasks);
  renderTaskHistory(teamboardState.allTasks);

  // Ensure streams are alive after tab switches/backgrounding.
  if (!teamboardState.bulletinUnsubscribe) subscribeBulletin();
  if (!teamboardState.tasksUnsubscribe) subscribeTasks();
}

export function refreshTeamboardAdminPanel() {
  updateAdminPanelVisibility();
  bindAdminPanel();
}
