/**
 * HACCP-Admin im Dev-Dashboard („Mein Betrieb“):
 * Temperatur-Messpunkte + Reinigungsaufgaben (tenant-scoped).
 */
import { canonicalTenantId } from './tenant-db.js';

const WEEKDAY_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

const STEVESHOF_STANDARD_TEMP_DEVICES = [
  { name: 'Fleischtheke', bereich: 'Verkauf', tempMin: 0, tempMax: 2, activeDays: [4, 5, 6], sortOrder: 10 },
  { name: 'Käsetheke (SB)', bereich: 'Verkauf', tempMin: 2, tempMax: 7, activeDays: null, sortOrder: 20 },
  { name: 'SB-Theke Fleisch & Wurst', bereich: 'Verkauf', tempMin: 0, tempMax: 4, activeDays: null, sortOrder: 30 },
  { name: 'SB-Kühlschrank Frische & MoPro', bereich: 'Verkauf', tempMin: 2, tempMax: 6, activeDays: null, sortOrder: 40 },
  { name: 'SB-TK Obst & Eis', bereich: 'Verkauf', tempMin: -24, tempMax: -18, activeDays: null, sortOrder: 50 },
  { name: 'SB-TK Gemüse', bereich: 'Verkauf', tempMin: -24, tempMax: -18, activeDays: null, sortOrder: 60 },
  { name: 'SB-TK Fleisch, Pizza & Brot', bereich: 'Verkauf', tempMin: -24, tempMax: -18, activeDays: null, sortOrder: 70 },
  { name: 'Lager-TK-Truhe Aufbackbrötchen', bereich: 'Lager', tempMin: -22, tempMax: -16, activeDays: null, sortOrder: 80 },
];

const DEFAULT_CLEANING_TASKS = [
  { name: 'Verkaufstheke & Waagen gereinigt', category: 'Täglich', sortOrder: 10, isProductionOnly: false },
  { name: 'Wurstküche gereinigt & desinfiziert', category: 'Nach Nutzung', sortOrder: 20, isProductionOnly: true },
  { name: 'Messer & Werkzeuge sterilisiert', category: 'Nach Nutzung', sortOrder: 30, isProductionOnly: true },
  { name: 'Rauch- und Kochanlagen gereinigt', category: 'Nach Nutzung', sortOrder: 40, isProductionOnly: true },
  { name: 'Kühlhaus Grundreinigung', category: 'Wöchentlich', sortOrder: 50, isProductionOnly: false },
];

const haccpAdminState = {
  db: null,
  tenantId: '',
  devices: [],
  tasks: [],
  devicesUnsub: null,
  tasksUnsub: null,
  bound: false,
  recordAudit: () => {},
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function serverTimestamp() {
  return typeof firebase !== 'undefined' && firebase.firestore?.FieldValue?.serverTimestamp
    ? firebase.firestore.FieldValue.serverTimestamp()
    : new Date().toISOString();
}

function slugId(name) {
  return String(name || 'eintrag')
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || `eintrag-${Date.now()}`;
}

function periodForCategory(category) {
  return String(category || '') === 'Wöchentlich' ? 'week' : 'day';
}

function tenantCollection(name) {
  const tenantId = canonicalTenantId(haccpAdminState.tenantId);
  if (!haccpAdminState.db || !tenantId) return null;
  return haccpAdminState.db.collection('tenants').doc(tenantId).collection(name);
}

function setStatus(elId, message, tone = 'info') {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = message;
  el.dataset.tone = tone;
}

function readActiveDaysFromAdminForm() {
  const boxes = Array.from(document.querySelectorAll('[data-haccp-admin-day]'));
  const checked = boxes
    .filter((box) => box.checked)
    .map((box) => Number(box.dataset.haccpAdminDay))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    .sort((a, b) => a - b);
  if (checked.length === 0 || checked.length === 7) return null;
  return checked;
}

function setActiveDaysOnAdminForm(activeDays) {
  const days = Array.isArray(activeDays) && activeDays.length ? activeDays : [0, 1, 2, 3, 4, 5, 6];
  document.querySelectorAll('[data-haccp-admin-day]').forEach((box) => {
    box.checked = days.includes(Number(box.dataset.haccpAdminDay));
  });
}

function formatTempRange(device) {
  const min = device.tempMin ?? device.sollMin;
  const max = device.tempMax ?? device.sollMax;
  if (min == null && max == null) return '—';
  return `${min == null ? '—' : min} / ${max == null ? '—' : max}`;
}

function formatActiveDays(device) {
  if (!Array.isArray(device.activeDays) || !device.activeDays.length) return 'täglich';
  return device.activeDays.map((d) => WEEKDAY_LABELS[d] || d).join(', ');
}

function resetDeviceForm() {
  const editId = document.getElementById('dev-dashboard-haccp-device-edit-id');
  const title = document.getElementById('dev-dashboard-haccp-device-form-title');
  const cancel = document.getElementById('dev-dashboard-haccp-device-cancel');
  const submit = document.getElementById('dev-dashboard-haccp-device-submit');
  if (editId) editId.value = '';
  if (title) title.textContent = 'Neuen Messpunkt anlegen';
  if (cancel) cancel.hidden = true;
  if (submit) submit.textContent = 'Messpunkt speichern';
  ['dev-dashboard-haccp-device-name', 'dev-dashboard-haccp-device-min', 'dev-dashboard-haccp-device-max'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const sort = document.getElementById('dev-dashboard-haccp-device-sort');
  if (sort) sort.value = '100';
  const area = document.getElementById('dev-dashboard-haccp-device-area');
  if (area) area.value = 'Verkauf';
  const type = document.getElementById('dev-dashboard-haccp-device-type');
  if (type) type.value = 'manual_temp';
  setActiveDaysOnAdminForm(null);
}

function resetTaskForm() {
  const editId = document.getElementById('dev-dashboard-haccp-task-edit-id');
  const title = document.getElementById('dev-dashboard-haccp-task-form-title');
  const cancel = document.getElementById('dev-dashboard-haccp-task-cancel');
  const submit = document.getElementById('dev-dashboard-haccp-task-submit');
  if (editId) editId.value = '';
  if (title) title.textContent = 'Neue Aufgabe anlegen';
  if (cancel) cancel.hidden = true;
  if (submit) submit.textContent = 'Aufgabe speichern';
  const name = document.getElementById('dev-dashboard-haccp-task-name');
  if (name) name.value = '';
  const category = document.getElementById('dev-dashboard-haccp-task-category');
  if (category) category.value = 'Täglich';
  const sort = document.getElementById('dev-dashboard-haccp-task-sort');
  if (sort) sort.value = '100';
  const production = document.getElementById('dev-dashboard-haccp-task-production');
  if (production) production.checked = false;
}

function renderDevicesTable() {
  const body = document.getElementById('dev-dashboard-haccp-devices-body');
  if (!body) return;
  const rows = [...haccpAdminState.devices]
    .filter((d) => d.isActive !== false && d.aktiv !== false)
    .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0)
      || String(a.name || '').localeCompare(String(b.name || ''), 'de'));

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="5">Noch keine Messpunkte. Unten anlegen oder StevesHof-Standard nutzen.</td></tr>';
    setStatus('dev-dashboard-haccp-devices-status', '0 Messpunkte');
    return;
  }

  body.innerHTML = rows.map((device) => `
    <tr data-device-id="${escapeHtml(device.id)}">
      <td>
        <strong>${escapeHtml(device.name || '—')}</strong>
        <div class="dev-dashboard-haccp-meta">${escapeHtml(formatActiveDays(device))}</div>
      </td>
      <td>${escapeHtml(device.bereich || '—')}</td>
      <td>${escapeHtml(formatTempRange(device))}</td>
      <td>${escapeHtml(device.sortOrder ?? '—')}</td>
      <td class="dev-dashboard-haccp-row-actions">
        <button type="button" class="dev-dashboard-secondary-btn" data-haccp-edit-device="${escapeHtml(device.id)}">Bearbeiten</button>
        <button type="button" class="dev-dashboard-danger-btn" data-haccp-delete-device="${escapeHtml(device.id)}">Löschen</button>
      </td>
    </tr>
  `).join('');
  setStatus('dev-dashboard-haccp-devices-status', `${rows.length} Messpunkt${rows.length === 1 ? '' : 'e'}`);
}

function renderTasksTable() {
  const body = document.getElementById('dev-dashboard-haccp-tasks-body');
  if (!body) return;
  const rows = [...haccpAdminState.tasks]
    .filter((t) => t.isActive !== false)
    .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0)
      || String(a.name || '').localeCompare(String(b.name || ''), 'de'));

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="5">Noch keine Reinigungsaufgaben. Unten anlegen oder Standard übernehmen.</td></tr>';
    setStatus('dev-dashboard-haccp-tasks-status', '0 Aufgaben');
    return;
  }

  body.innerHTML = rows.map((task) => `
    <tr data-task-id="${escapeHtml(task.id)}">
      <td><strong>${escapeHtml(task.name || '—')}</strong></td>
      <td>${escapeHtml(task.category || '—')}</td>
      <td>${escapeHtml(task.sortOrder ?? '—')}</td>
      <td>${task.isProductionOnly ? 'Ja' : 'Nein'}</td>
      <td class="dev-dashboard-haccp-row-actions">
        <button type="button" class="dev-dashboard-secondary-btn" data-haccp-edit-task="${escapeHtml(task.id)}">Bearbeiten</button>
        <button type="button" class="dev-dashboard-danger-btn" data-haccp-delete-task="${escapeHtml(task.id)}">Löschen</button>
      </td>
    </tr>
  `).join('');
  setStatus('dev-dashboard-haccp-tasks-status', `${rows.length} Aufgabe${rows.length === 1 ? '' : 'n'}`);
}

function stopHaccpAdminLiveSync() {
  if (typeof haccpAdminState.devicesUnsub === 'function') {
    haccpAdminState.devicesUnsub();
    haccpAdminState.devicesUnsub = null;
  }
  if (typeof haccpAdminState.tasksUnsub === 'function') {
    haccpAdminState.tasksUnsub();
    haccpAdminState.tasksUnsub = null;
  }
}

function startHaccpAdminLiveSync() {
  stopHaccpAdminLiveSync();
  const devicesCol = tenantCollection('haccp_geraete');
  const tasksCol = tenantCollection('haccp_cleaning_tasks');
  if (!devicesCol || !tasksCol) {
    setStatus('dev-dashboard-haccp-devices-status', 'Bitte zuerst einen Betrieb wählen.', 'error');
    setStatus('dev-dashboard-haccp-tasks-status', 'Bitte zuerst einen Betrieb wählen.', 'error');
    haccpAdminState.devices = [];
    haccpAdminState.tasks = [];
    renderDevicesTable();
    renderTasksTable();
    return;
  }

  haccpAdminState.devicesUnsub = devicesCol.onSnapshot((snap) => {
    haccpAdminState.devices = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    renderDevicesTable();
  }, (err) => {
    console.error('[Dev-Dashboard HACCP] Geräte-Sync:', err);
    setStatus('dev-dashboard-haccp-devices-status', 'Messpunkte konnten nicht geladen werden.', 'error');
  });

  haccpAdminState.tasksUnsub = tasksCol.onSnapshot((snap) => {
    haccpAdminState.tasks = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    renderTasksTable();
  }, (err) => {
    console.error('[Dev-Dashboard HACCP] Aufgaben-Sync:', err);
    setStatus('dev-dashboard-haccp-tasks-status', 'Reinigungsaufgaben konnten nicht geladen werden.', 'error');
  });
}

function buildDevicePayload(formValues, editingId) {
  const tempMin = formValues.tempMin === '' || formValues.tempMin == null ? null : Number(formValues.tempMin);
  const tempMax = formValues.tempMax === '' || formValues.tempMax == null ? null : Number(formValues.tempMax);
  const sortOrder = formValues.sortOrder === '' || formValues.sortOrder == null
    ? 100
    : Number(formValues.sortOrder);
  const id = editingId || slugId(formValues.name);
  return {
    id,
    name: formValues.name,
    bereich: formValues.bereich || 'Verkauf',
    type: 'manual_temp',
    tempMin,
    tempMax,
    unit: '°C',
    activeDays: formValues.activeDays,
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : 100,
    isActive: true,
    aktiv: true,
    protokollTyp: 'temperatur',
    geraeteTyp: Number(tempMax) <= -10 ? 'tk' : 'kuehlung',
    sollMin: tempMin,
    sollMax: tempMax,
    einheit: '°C',
    intervall: 'taeglich',
    tenantId: canonicalTenantId(haccpAdminState.tenantId),
    updatedAt: serverTimestamp(),
  };
}

function buildTaskPayload(formValues, editingId) {
  const sortOrder = formValues.sortOrder === '' || formValues.sortOrder == null
    ? 100
    : Number(formValues.sortOrder);
  const category = formValues.category || 'Täglich';
  const id = editingId || slugId(formValues.name);
  return {
    id,
    name: formValues.name,
    category,
    period: periodForCategory(category),
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : 100,
    isProductionOnly: formValues.isProductionOnly === true,
    isActive: true,
    tenantId: canonicalTenantId(haccpAdminState.tenantId),
    updatedAt: serverTimestamp(),
  };
}

async function saveDeviceFromForm(event) {
  event.preventDefault();
  const col = tenantCollection('haccp_geraete');
  if (!col) {
    window.showToast?.('Bitte zuerst einen Betrieb wählen.', 'error');
    return;
  }
  const name = document.getElementById('dev-dashboard-haccp-device-name')?.value.trim();
  if (!name) {
    window.showToast?.('Bitte einen Namen für den Messpunkt eintragen.', 'error');
    return;
  }
  const editingId = document.getElementById('dev-dashboard-haccp-device-edit-id')?.value.trim();
  const payload = buildDevicePayload({
    name,
    bereich: document.getElementById('dev-dashboard-haccp-device-area')?.value,
    tempMin: document.getElementById('dev-dashboard-haccp-device-min')?.value,
    tempMax: document.getElementById('dev-dashboard-haccp-device-max')?.value,
    sortOrder: document.getElementById('dev-dashboard-haccp-device-sort')?.value,
    activeDays: readActiveDaysFromAdminForm(),
  }, editingId);
  const { id, ...data } = payload;
  try {
    const ref = col.doc(id);
    const existing = await ref.get();
    if (!existing.exists) data.createdAt = serverTimestamp();
    await ref.set(data, { merge: true });
    haccpAdminState.recordAudit('settings', `HACCP-Messpunkt gespeichert: ${name}`, 'change');
    window.showToast?.(`Messpunkt „${name}“ gespeichert.`, 'success');
    resetDeviceForm();
  } catch (err) {
    console.error('[Dev-Dashboard HACCP] Gerät speichern:', err);
    window.showToast?.('Messpunkt konnte nicht gespeichert werden.', 'error');
  }
}

async function saveTaskFromForm(event) {
  event.preventDefault();
  const col = tenantCollection('haccp_cleaning_tasks');
  if (!col) {
    window.showToast?.('Bitte zuerst einen Betrieb wählen.', 'error');
    return;
  }
  const name = document.getElementById('dev-dashboard-haccp-task-name')?.value.trim();
  if (!name) {
    window.showToast?.('Bitte eine Aufgabenbeschreibung eintragen.', 'error');
    return;
  }
  const editingId = document.getElementById('dev-dashboard-haccp-task-edit-id')?.value.trim();
  const payload = buildTaskPayload({
    name,
    category: document.getElementById('dev-dashboard-haccp-task-category')?.value,
    sortOrder: document.getElementById('dev-dashboard-haccp-task-sort')?.value,
    isProductionOnly: Boolean(document.getElementById('dev-dashboard-haccp-task-production')?.checked),
  }, editingId);
  const { id, ...data } = payload;
  try {
    const ref = col.doc(id);
    const existing = await ref.get();
    if (!existing.exists) data.createdAt = serverTimestamp();
    await ref.set(data, { merge: true });
    haccpAdminState.recordAudit('settings', `HACCP-Reinigungsaufgabe gespeichert: ${name}`, 'change');
    window.showToast?.(`Aufgabe „${name}“ gespeichert.`, 'success');
    resetTaskForm();
  } catch (err) {
    console.error('[Dev-Dashboard HACCP] Aufgabe speichern:', err);
    window.showToast?.('Aufgabe konnte nicht gespeichert werden.', 'error');
  }
}

function fillDeviceForm(device) {
  document.getElementById('dev-dashboard-haccp-device-edit-id').value = device.id || '';
  document.getElementById('dev-dashboard-haccp-device-form-title').textContent = 'Messpunkt bearbeiten';
  document.getElementById('dev-dashboard-haccp-device-cancel').hidden = false;
  document.getElementById('dev-dashboard-haccp-device-submit').textContent = 'Änderung speichern';
  document.getElementById('dev-dashboard-haccp-device-name').value = device.name || '';
  document.getElementById('dev-dashboard-haccp-device-area').value = device.bereich || 'Verkauf';
  document.getElementById('dev-dashboard-haccp-device-type').value = 'manual_temp';
  document.getElementById('dev-dashboard-haccp-device-min').value = device.tempMin ?? device.sollMin ?? '';
  document.getElementById('dev-dashboard-haccp-device-max').value = device.tempMax ?? device.sollMax ?? '';
  document.getElementById('dev-dashboard-haccp-device-sort').value = String(device.sortOrder ?? 100);
  setActiveDaysOnAdminForm(device.activeDays);
  document.getElementById('dev-dashboard-haccp-device-form')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function fillTaskForm(task) {
  document.getElementById('dev-dashboard-haccp-task-edit-id').value = task.id || '';
  document.getElementById('dev-dashboard-haccp-task-form-title').textContent = 'Aufgabe bearbeiten';
  document.getElementById('dev-dashboard-haccp-task-cancel').hidden = false;
  document.getElementById('dev-dashboard-haccp-task-submit').textContent = 'Änderung speichern';
  document.getElementById('dev-dashboard-haccp-task-name').value = task.name || '';
  document.getElementById('dev-dashboard-haccp-task-category').value = task.category || 'Täglich';
  document.getElementById('dev-dashboard-haccp-task-sort').value = String(task.sortOrder ?? 100);
  document.getElementById('dev-dashboard-haccp-task-production').checked = task.isProductionOnly === true;
  document.getElementById('dev-dashboard-haccp-task-form')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function deleteDevice(deviceId) {
  const device = haccpAdminState.devices.find((entry) => entry.id === deviceId);
  if (!device) return;
  if (!window.confirm(`Messpunkt „${device.name}“ wirklich löschen?`)) return;
  const col = tenantCollection('haccp_geraete');
  if (!col) return;
  try {
    await col.doc(deviceId).delete();
    haccpAdminState.recordAudit('settings', `HACCP-Messpunkt gelöscht: ${device.name}`, 'change');
    window.showToast?.(`Messpunkt „${device.name}“ gelöscht.`, 'success');
    if (document.getElementById('dev-dashboard-haccp-device-edit-id')?.value === deviceId) {
      resetDeviceForm();
    }
  } catch (err) {
    console.error('[Dev-Dashboard HACCP] Gerät löschen:', err);
    window.showToast?.('Messpunkt konnte nicht gelöscht werden.', 'error');
  }
}

async function deleteTask(taskId) {
  const task = haccpAdminState.tasks.find((entry) => entry.id === taskId);
  if (!task) return;
  if (!window.confirm(`Aufgabe „${task.name}“ wirklich löschen?`)) return;
  const col = tenantCollection('haccp_cleaning_tasks');
  if (!col) return;
  try {
    await col.doc(taskId).delete();
    haccpAdminState.recordAudit('settings', `HACCP-Reinigungsaufgabe gelöscht: ${task.name}`, 'change');
    window.showToast?.(`Aufgabe „${task.name}“ gelöscht.`, 'success');
    if (document.getElementById('dev-dashboard-haccp-task-edit-id')?.value === taskId) {
      resetTaskForm();
    }
  } catch (err) {
    console.error('[Dev-Dashboard HACCP] Aufgabe löschen:', err);
    window.showToast?.('Aufgabe konnte nicht gelöscht werden.', 'error');
  }
}

async function seedStevesHofDevices() {
  const col = tenantCollection('haccp_geraete');
  if (!col || !haccpAdminState.db) {
    window.showToast?.('Bitte zuerst einen Betrieb wählen.', 'error');
    return;
  }
  try {
    const batch = haccpAdminState.db.batch();
    const tenantId = canonicalTenantId(haccpAdminState.tenantId);
    STEVESHOF_STANDARD_TEMP_DEVICES.forEach((device) => {
      const payload = buildDevicePayload({
        name: device.name,
        bereich: device.bereich,
        tempMin: device.tempMin,
        tempMax: device.tempMax,
        sortOrder: device.sortOrder,
        activeDays: device.activeDays,
      }, slugId(device.name));
      const { id, ...data } = payload;
      data.tenantId = tenantId;
      data.seedVersion = 3;
      data.updatedBy = 'dev-dashboard-haccp-seed';
      data.createdAt = serverTimestamp();
      batch.set(col.doc(id), data, { merge: true });
    });
    await batch.commit();
    haccpAdminState.recordAudit('settings', 'StevesHof HACCP-Standardgeräte angelegt', 'change');
    window.showToast?.('8 StevesHof-Messpunkte angelegt.', 'success');
  } catch (err) {
    console.error('[Dev-Dashboard HACCP] Geräte-Seed:', err);
    window.showToast?.('Standard-Geräte konnten nicht angelegt werden.', 'error');
  }
}

async function seedDefaultCleaningTasks() {
  const col = tenantCollection('haccp_cleaning_tasks');
  if (!col || !haccpAdminState.db) {
    window.showToast?.('Bitte zuerst einen Betrieb wählen.', 'error');
    return;
  }
  try {
    const batch = haccpAdminState.db.batch();
    const tenantId = canonicalTenantId(haccpAdminState.tenantId);
    DEFAULT_CLEANING_TASKS.forEach((task) => {
      const payload = buildTaskPayload(task, slugId(task.name));
      const { id, ...data } = payload;
      data.tenantId = tenantId;
      data.createdAt = serverTimestamp();
      batch.set(col.doc(id), data, { merge: true });
    });
    await batch.commit();
    haccpAdminState.recordAudit('settings', 'HACCP-Standard-Reinigungsaufgaben angelegt', 'change');
    window.showToast?.('5 Standard-Reinigungsaufgaben angelegt.', 'success');
  } catch (err) {
    console.error('[Dev-Dashboard HACCP] Aufgaben-Seed:', err);
    window.showToast?.('Standard-Aufgaben konnten nicht angelegt werden.', 'error');
  }
}

function bindHaccpAdminControls() {
  if (haccpAdminState.bound) return;
  haccpAdminState.bound = true;

  document.getElementById('dev-dashboard-haccp-device-form')
    ?.addEventListener('submit', (event) => { void saveDeviceFromForm(event); });
  document.getElementById('dev-dashboard-haccp-task-form')
    ?.addEventListener('submit', (event) => { void saveTaskFromForm(event); });
  document.getElementById('dev-dashboard-haccp-device-cancel')
    ?.addEventListener('click', () => resetDeviceForm());
  document.getElementById('dev-dashboard-haccp-task-cancel')
    ?.addEventListener('click', () => resetTaskForm());
  document.getElementById('dev-dashboard-haccp-seed-devices')
    ?.addEventListener('click', () => { void seedStevesHofDevices(); });
  document.getElementById('dev-dashboard-haccp-seed-tasks')
    ?.addEventListener('click', () => { void seedDefaultCleaningTasks(); });

  document.getElementById('dev-dashboard-haccp-devices-body')
    ?.addEventListener('click', (event) => {
      const editBtn = event.target.closest('[data-haccp-edit-device]');
      if (editBtn) {
        const device = haccpAdminState.devices.find((entry) => entry.id === editBtn.dataset.haccpEditDevice);
        if (device) fillDeviceForm(device);
        return;
      }
      const deleteBtn = event.target.closest('[data-haccp-delete-device]');
      if (deleteBtn) void deleteDevice(deleteBtn.dataset.haccpDeleteDevice);
    });

  document.getElementById('dev-dashboard-haccp-tasks-body')
    ?.addEventListener('click', (event) => {
      const editBtn = event.target.closest('[data-haccp-edit-task]');
      if (editBtn) {
        const task = haccpAdminState.tasks.find((entry) => entry.id === editBtn.dataset.haccpEditTask);
        if (task) fillTaskForm(task);
        return;
      }
      const deleteBtn = event.target.closest('[data-haccp-delete-task]');
      if (deleteBtn) void deleteTask(deleteBtn.dataset.haccpDeleteTask);
    });
}

/**
 * @param {{ db: FirebaseFirestore.Firestore|null, tenantId: string, recordAudit?: Function }} options
 */
export function syncDevDashboardHaccpAdmin(options = {}) {
  haccpAdminState.db = options.db || null;
  haccpAdminState.tenantId = String(options.tenantId || '').trim();
  if (typeof options.recordAudit === 'function') {
    haccpAdminState.recordAudit = options.recordAudit;
  }
  bindHaccpAdminControls();
  startHaccpAdminLiveSync();
}

export function refreshDevDashboardHaccpAdmin() {
  if (!haccpAdminState.db || !haccpAdminState.tenantId) return;
  startHaccpAdminLiveSync();
}
