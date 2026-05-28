const DEFAULT_HACCP_DEVICES = [
  { name: 'Kühlauslage Hofladen', bereich: 'Hofladen', protokollTyp: 'temperatur', geraeteTyp: 'kuehlung', sollMin: 0, sollMax: 7, einheit: '°C', intervall: 'taeglich', aktiv: true },
  { name: 'MoPro-Kühlung', bereich: 'Hofladen', protokollTyp: 'temperatur', geraeteTyp: 'kuehlung', sollMin: 0, sollMax: 7, einheit: '°C', intervall: 'taeglich', aktiv: true },
  { name: 'TK-Truhe', bereich: 'Hofladen', protokollTyp: 'temperatur', geraeteTyp: 'tk', sollMin: null, sollMax: -18, einheit: '°C', intervall: 'taeglich', aktiv: true },
  { name: 'Schneidemaschine', bereich: 'Produktion', protokollTyp: 'reinigung', geraeteTyp: 'geraet', intervall: 'nach_benutzung', aktiv: true },
  { name: 'Vakuumierer', bereich: 'Produktion', protokollTyp: 'reinigung', geraeteTyp: 'geraet', intervall: 'nach_benutzung', aktiv: true },
];

const HACCP_DRAFT_KEY = 'charculogic.draft.haccp';

const haccpState = {
  db: null,
  writeOrQueueFirestore: null,
  showHUD: () => {},
  verifyAdminAction: (callback) => callback(),
  onFormSaved: () => {},
  restoreDraftFields: () => 0,
  tenantId: '',
  getFirebase: () => null,
  playClickSound: () => {},
  mode: 'temperatur',
  devices: [],
  logs: [],
  devicesUnsubscribe: null,
  logsUnsubscribe: null,
  initialized: false,
};

function saveHaccpDraft() {
  try {
    const draft = {
      ph: document.getElementById('haccp-ph')?.value || '',
      temp: document.getElementById('haccp-temp')?.value || '',
      batch: document.getElementById('haccp-batch')?.value || '',
      savedAt: Date.now(),
    };
    localStorage.setItem(HACCP_DRAFT_KEY, JSON.stringify(draft));
  } catch (_) { /* quota exceeded — silent */ }
}

function restoreHaccpDraft() {
  try {
    const raw = localStorage.getItem(HACCP_DRAFT_KEY);
    if (!raw) return;
    const draft = JSON.parse(raw);
    if (Date.now() - (draft.savedAt || 0) > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(HACCP_DRAFT_KEY);
      return;
    }
    const phEl = document.getElementById('haccp-ph');
    const tempEl = document.getElementById('haccp-temp');
    const batchEl = document.getElementById('haccp-batch');
    if (phEl && draft.ph) phEl.value = draft.ph;
    if (tempEl && draft.temp) tempEl.value = draft.temp;
    if (batchEl && draft.batch) batchEl.value = draft.batch;
    updateHACCPAlerts();
  } catch (_) { /* corrupt draft — silent */ }
}

function clearHaccpDraft() {
  try { localStorage.removeItem(HACCP_DRAFT_KEY); } catch (_) { /* noop */ }
}

export function initHaccpModule(databaseInstance, writeOrQueueFirestoreFunction, showHudCallback, verifyAdminActionCallback, options = {}) {
  haccpState.db = databaseInstance || null;
  haccpState.writeOrQueueFirestore = writeOrQueueFirestoreFunction || haccpState.writeOrQueueFirestore;
  haccpState.showHUD = typeof showHudCallback === 'function' ? showHudCallback : haccpState.showHUD;
  haccpState.verifyAdminAction = typeof verifyAdminActionCallback === 'function' ? verifyAdminActionCallback : haccpState.verifyAdminAction;
  haccpState.onFormSaved = typeof options.onFormSaved === 'function' ? options.onFormSaved : haccpState.onFormSaved;
  haccpState.restoreDraftFields = typeof options.restoreDraftFields === 'function' ? options.restoreDraftFields : haccpState.restoreDraftFields;
  haccpState.tenantId = options.tenantId || haccpState.tenantId;
  haccpState.getFirebase = typeof options.getFirebase === 'function' ? options.getFirebase : haccpState.getFirebase;
  haccpState.playClickSound = typeof options.playClickSound === 'function' ? options.playClickSound : haccpState.playClickSound;

  if (!haccpState.initialized) {
    bindStaticHaccpControls();
    haccpState.initialized = true;
  }
  document.documentElement.dataset.haccpModule = 'ready';

  restoreHaccpDraft();
  updateHACCPAlerts();
  renderHaccpDaily();

  if (haccpState.db) {
    loadHaccpDevicesFromCloud();
    loadHaccpLogsFromCloud();
  }
}

export function activateHaccpTab() {
  updateHACCPAlerts();
  renderHaccpDaily();
}

function haccpCollectionPath() {
  return haccpState.tenantId ? `tenants/${haccpState.tenantId}/haccp_logs` : null;
}

function haccpDevicesCollectionPath() {
  return haccpState.tenantId ? `tenants/${haccpState.tenantId}/haccp_geraete` : null;
}

function serverTimestamp() {
  return haccpState.getFirebase()?.firestore?.FieldValue?.serverTimestamp?.() || new Date().toISOString();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeDomId(value) {
  return String(value || '').replace(/[^A-Za-z0-9_-]/g, '_');
}

function haccpDeviceDocId(name) {
  return String(name || 'geraet')
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || `geraet-${Date.now()}`;
}

function activeHaccpDevices(type) {
  return haccpState.devices
    .filter((device) => device.aktiv !== false && device.protokollTyp === type)
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'de'));
}

async function seedDefaultHaccpDevicesIfEmpty() {
  if (!haccpState.db) return;
  const path = haccpDevicesCollectionPath();
  if (!path) return;
  const snap = await haccpState.db.collection(path).limit(1).get();
  if (!snap.empty) return;
  const batch = haccpState.db.batch();
  DEFAULT_HACCP_DEVICES.forEach((device) => {
    const ref = haccpState.db.collection(path).doc(haccpDeviceDocId(device.name));
    batch.set(ref, { ...device, tenantId: haccpState.tenantId, createdAt: serverTimestamp() });
  });
  await batch.commit();
}

function loadHaccpDevicesFromCloud() {
  if (!haccpState.db) return;
  const path = haccpDevicesCollectionPath();
  if (!path) return;
  seedDefaultHaccpDevicesIfEmpty().catch((err) => console.warn('[CharcuLogic HACCP] Default-Geräte konnten nicht angelegt werden:', err));
  if (haccpState.devicesUnsubscribe) {
    haccpState.devicesUnsubscribe();
    haccpState.devicesUnsubscribe = null;
  }
  haccpState.devicesUnsubscribe = haccpState.db.collection(path).onSnapshot((snapshot) => {
    haccpState.devices = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    renderHaccpDaily();
  }, (err) => console.error('[CharcuLogic HACCP] Geräte-Sync Fehler:', err));
}

function loadHaccpLogsFromCloud() {
  if (!haccpState.db) return;
  const path = haccpCollectionPath();
  if (!path) return;
  if (haccpState.logsUnsubscribe) {
    haccpState.logsUnsubscribe();
    haccpState.logsUnsubscribe = null;
  }
  haccpState.logsUnsubscribe = haccpState.db.collection(path).onSnapshot((snapshot) => {
    haccpState.logs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }, (err) => console.error('[CharcuLogic HACCP] Protokoll-Sync Fehler:', err));
}

function temperatureStatus(device, value) {
  const temp = Number(value);
  if (!Number.isFinite(temp)) return { ok: false, label: 'Wert fehlt' };
  const minOk = device.sollMin == null || temp >= Number(device.sollMin);
  const maxOk = device.sollMax == null || temp <= Number(device.sollMax);
  return minOk && maxOk ? { ok: true, label: 'OK' } : { ok: false, label: 'Abweichung' };
}

function createHaccpLogId(entry) {
  const randomPart = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return [
    entry.logTyp || 'log',
    entry.deviceId || entry.chargenNummer || 'haccp',
    Date.now().toString(36),
    randomPart,
  ].filter(Boolean).join('_').replace(/[^A-Za-z0-9_-]/g, '_');
}

async function saveHaccpLog(entry) {
  const path = haccpCollectionPath();
  if (!path || !haccpState.writeOrQueueFirestore) return;

  const fullEntry = {
    ...entry,
    tenantId: haccpState.tenantId,
    datum: new Date().toISOString().slice(0, 10),
  };
  const docId = createHaccpLogId(fullEntry);

  try {
    await haccpState.writeOrQueueFirestore({
      collectionPath: path,
      docId,
      op: 'set',
      onlineData: { ...fullEntry, createdAt: serverTimestamp() },
      queueData: { ...fullEntry, createdAt: new Date().toISOString() },
      offlineMessage: "HACCP-Protokoll wird nachträglich synchronisiert.",
    });
  } catch (err) {
    const code = err?.code || '';
    if (code === 'permission-denied' || code === 'already-exists') {
      console.warn(`[CharcuLogic HACCP] ${code} für ${docId} — Retry-Konflikt, wird als erledigt behandelt.`);
      haccpState.showHUD("Bereits erfasst", "Dieser Protokolleintrag existiert bereits auf dem Server.");
      return;
    }
    console.warn('[CharcuLogic HACCP] Speichern fehlgeschlagen:', err);
    throw err;
  }
}

async function saveTemperatureCheck(deviceId) {
  const device = haccpState.devices.find((entry) => entry.id === deviceId);
  if (!device) return;
  const value = document.getElementById(`temp-${safeDomId(deviceId)}`)?.value;
  const note = document.getElementById(`note-${safeDomId(deviceId)}`)?.value || '';
  const status = temperatureStatus(device, value);
  try {
    await saveHaccpLog({
      logTyp: 'temperatur',
      deviceId,
      deviceName: device.name,
      bereich: device.bereich || '',
      wert: Number(value),
      einheit: device.einheit || '°C',
      sollMin: device.sollMin ?? null,
      sollMax: device.sollMax ?? null,
      status: status.ok ? 'ok' : 'abweichung',
      massnahme: note,
    });
    haccpState.onFormSaved([`temp-${safeDomId(deviceId)}`, `note-${safeDomId(deviceId)}`]);
    haccpState.showHUD(status.ok ? "Temperatur OK" : "Abweichung gespeichert", `${device.name}: ${value} ${device.einheit || '°C'}`);
  } catch (err) {
    const code = err?.code || '';
    if (code === 'permission-denied' || code === 'already-exists') {
      haccpState.onFormSaved([`temp-${safeDomId(deviceId)}`, `note-${safeDomId(deviceId)}`]);
      haccpState.showHUD("Bereits erfasst", "Dieser Messwert existiert bereits auf dem Server.");
      return;
    }
    console.error('[CharcuLogic HACCP] Temperatur speichern fehlgeschlagen:', err);
    haccpState.showHUD("Fehler", "Temperatur konnte nicht gespeichert werden.", "!");
  }
}

async function saveCleaningCheck(deviceId) {
  const device = haccpState.devices.find((entry) => entry.id === deviceId);
  if (!device) return;
  const note = document.getElementById(`clean-note-${safeDomId(deviceId)}`)?.value || '';
  try {
    await saveHaccpLog({
      logTyp: 'reinigung',
      deviceId,
      deviceName: device.name,
      bereich: device.bereich || '',
      status: 'erledigt',
      massnahme: note,
    });
    haccpState.onFormSaved([`clean-note-${safeDomId(deviceId)}`]);
    haccpState.showHUD("Reinigung erfasst", `${device.name} wurde dokumentiert.`);
  } catch (err) {
    const code = err?.code || '';
    if (code === 'permission-denied' || code === 'already-exists') {
      haccpState.onFormSaved([`clean-note-${safeDomId(deviceId)}`]);
      haccpState.showHUD("Bereits erfasst", "Dieses Reinigungsprotokoll existiert bereits auf dem Server.");
      return;
    }
    console.error('[CharcuLogic HACCP] Reinigung speichern fehlgeschlagen:', err);
    haccpState.showHUD("Fehler", "Reinigung konnte nicht gespeichert werden.", "!");
  }
}

function deactivateHaccpDevice(deviceId) {
  haccpState.verifyAdminAction(async () => {
    try {
      const path = haccpDevicesCollectionPath();
      if (!path || !haccpState.writeOrQueueFirestore) return;
      const nowIso = new Date().toISOString();
      await haccpState.writeOrQueueFirestore({
        collectionPath: path,
        docId: deviceId,
        onlineData: { aktiv: false, updatedAt: serverTimestamp() },
        queueData: { aktiv: false, updatedAt: nowIso },
        offlineMessage: "Geräteänderung wird nachträglich synchronisiert.",
      });
      haccpState.showHUD("Deaktiviert", "Gerät/Aufgabe wurde deaktiviert oder vorgemerkt.");
    } catch (err) {
      console.error('[CharcuLogic HACCP] Deaktivieren fehlgeschlagen:', err);
      haccpState.showHUD("Fehler", "Gerät konnte nicht deaktiviert werden.", "!");
    }
  });
}

function addHaccpDeviceFromForm() {
  const path = haccpDevicesCollectionPath();
  if (!path || !haccpState.writeOrQueueFirestore) {
    haccpState.showHUD("Offline", "Gerät kann ohne Cloud-Verbindung nicht gespeichert werden.", "!");
    return;
  }
  const name = document.getElementById('haccp-device-name')?.value.trim();
  if (!name) {
    haccpState.showHUD("Name fehlt", "Bitte Gerätenamen eintragen.", "!");
    return;
  }
  haccpState.verifyAdminAction(async () => {
    const protokollTyp = document.getElementById('haccp-device-type')?.value || 'temperatur';
    const bereich = document.getElementById('haccp-device-area')?.value.trim() || 'Hofladen';
    const sollMinRaw = document.getElementById('haccp-device-min')?.value;
    const sollMaxRaw = document.getElementById('haccp-device-max')?.value;
    const payload = {
      name,
      protokollTyp,
      bereich,
      geraeteTyp: protokollTyp === 'temperatur' ? 'kuehlung' : 'geraet',
      sollMin: sollMinRaw === '' ? null : Number(sollMinRaw),
      sollMax: sollMaxRaw === '' ? null : Number(sollMaxRaw),
      einheit: protokollTyp === 'temperatur' ? '°C' : '',
      intervall: protokollTyp === 'temperatur' ? 'taeglich' : 'nach_benutzung',
      aktiv: true,
      tenantId: haccpState.tenantId,
    };
    await haccpState.writeOrQueueFirestore({
      collectionPath: path,
      docId: haccpDeviceDocId(name),
      op: 'set',
      onlineData: { ...payload, updatedAt: serverTimestamp() },
      queueData: { ...payload, updatedAt: new Date().toISOString() },
      offlineMessage: "Gerät/Aufgabe wird nachträglich synchronisiert.",
    });
    haccpState.showHUD("Gerät gespeichert", `${name} ist in den HACCP-Stammdaten.`);
    ['haccp-device-name', 'haccp-device-area', 'haccp-device-min', 'haccp-device-max'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  });
}

function restoreHaccpDraftFields() {
  const container = document.getElementById('haccp-daily-container');
  if (!container) return;
  const fieldIds = Array.from(container.querySelectorAll('input, textarea, select'))
    .map((el) => el.id)
    .filter(Boolean);
  fieldIds.push('haccp-ph', 'haccp-temp', 'haccp-batch');
  haccpState.restoreDraftFields(fieldIds);
}

function renderHaccpDaily() {
  const container = document.getElementById('haccp-daily-container');
  if (!container) return;

  if (haccpState.mode === 'temperatur') {
    const devices = activeHaccpDevices('temperatur');
    container.innerHTML = `
      <div class="haccp-task-list">
        ${devices.length ? devices.map((device) => `
          <div class="haccp-task-card">
            <div class="haccp-task-title">${escapeHtml(device.name)}</div>
            <div class="haccp-task-meta">${escapeHtml(device.bereich || '')} · Soll: ${device.sollMin ?? 'offen'} bis ${device.sollMax ?? 'offen'} ${escapeHtml(device.einheit || '°C')}</div>
            <div class="haccp-task-actions">
              <input id="temp-${safeDomId(device.id)}" type="number" class="input-text-touch" step="0.1" placeholder="Messwert">
              <button class="btn btn-primary" type="button" data-haccp-save-temp="${escapeHtml(device.id)}">OK</button>
            </div>
            <input id="note-${safeDomId(device.id)}" class="input-text-touch" style="margin-top:8px;height:48px;font-size:14px;" placeholder="Maßnahme bei Abweichung">
          </div>
        `).join('') : '<div class="batch-empty-hint">Noch keine Temperatur-Geräte angelegt.</div>'}
      </div>
    `;
    bindRenderedHaccpActions(container);
    restoreHaccpDraftFields();
    return;
  }

  if (haccpState.mode === 'reinigung') {
    const devices = activeHaccpDevices('reinigung');
    container.innerHTML = `
      <div class="haccp-task-list">
        ${devices.length ? devices.map((device) => `
          <div class="haccp-task-card">
            <div class="haccp-task-title">${escapeHtml(device.name)}</div>
            <div class="haccp-task-meta">${escapeHtml(device.bereich || '')} · Intervall: ${escapeHtml(device.intervall || 'nach Benutzung')}</div>
            <input id="clean-note-${safeDomId(device.id)}" class="input-text-touch" style="height:48px;font-size:14px;" placeholder="Notiz optional">
            <button class="btn btn-primary" style="width:100%;margin-top:8px;min-height:48px;" type="button" data-haccp-save-clean="${escapeHtml(device.id)}">Reinigung erledigt</button>
          </div>
        `).join('') : '<div class="batch-empty-hint">Noch keine Reinigungsaufgaben angelegt.</div>'}
      </div>
    `;
    bindRenderedHaccpActions(container);
    restoreHaccpDraftFields();
    return;
  }

  container.innerHTML = `
    <div class="haccp-device-form">
      <input id="haccp-device-name" class="input-text-touch" placeholder="Gerät / Aufgabe">
      <div class="batch-input-grid">
        <select id="haccp-device-type" class="input-text-touch">
          <option value="temperatur">Temperatur</option>
          <option value="reinigung">Reinigung</option>
        </select>
        <input id="haccp-device-area" class="input-text-touch" placeholder="Bereich">
      </div>
      <div class="batch-input-grid">
        <input id="haccp-device-min" type="number" class="input-text-touch" step="0.1" placeholder="Soll min">
        <input id="haccp-device-max" type="number" class="input-text-touch" step="0.1" placeholder="Soll max">
      </div>
      <button class="btn btn-primary" type="button" id="btn-add-haccp-device">Gerät / Aufgabe speichern</button>
      <div class="utility-list">
        ${haccpState.devices.map((device) => `
          <div class="utility-row">
            <div class="utility-row-title">${escapeHtml(device.name)}</div>
            <div class="utility-row-meta">${escapeHtml(device.protokollTyp || '')} · ${escapeHtml(device.bereich || '')} · ${device.aktiv === false ? 'inaktiv' : 'aktiv'}</div>
            ${device.aktiv === false ? '' : `<div class="utility-row-actions"><button class="btn-danger-small" type="button" data-haccp-deactivate="${escapeHtml(device.id)}">Deaktivieren</button></div>`}
          </div>
        `).join('')}
      </div>
    </div>
  `;
  document.getElementById('btn-add-haccp-device')?.addEventListener('click', addHaccpDeviceFromForm);
  bindRenderedHaccpActions(container);
}

function bindRenderedHaccpActions(container) {
  container.querySelectorAll('[data-haccp-save-temp]').forEach((button) => {
    button.addEventListener('click', () => saveTemperatureCheck(button.dataset.haccpSaveTemp));
  });
  container.querySelectorAll('[data-haccp-save-clean]').forEach((button) => {
    button.addEventListener('click', () => saveCleaningCheck(button.dataset.haccpSaveClean));
  });
  container.querySelectorAll('[data-haccp-deactivate]').forEach((button) => {
    button.addEventListener('click', () => deactivateHaccpDevice(button.dataset.haccpDeactivate));
  });
}

function bindStaticHaccpControls() {
  document.querySelectorAll('.haccp-mode-tab').forEach((button) => {
    button.addEventListener('click', () => {
      haccpState.mode = button.dataset.haccpMode || 'temperatur';
      document.querySelectorAll('.haccp-mode-tab').forEach((entry) => entry.classList.remove('active-haccp-mode'));
      button.classList.add('active-haccp-mode');
      renderHaccpDaily();
    });
  });

  const sliderPh = document.getElementById('haccp-ph');
  const sliderTemp = document.getElementById('haccp-temp');
  sliderPh?.addEventListener('input', () => {
    haccpState.playClickSound(1000 + (parseFloat(sliderPh.value) * 100), 0.015, 0.05);
    updateHACCPAlerts();
    saveHaccpDraft();
  });
  sliderTemp?.addEventListener('input', () => {
    haccpState.playClickSound(800 + (parseFloat(sliderTemp.value) * 4), 0.015, 0.05);
    updateHACCPAlerts();
    saveHaccpDraft();
  });
  document.getElementById('haccp-batch')?.addEventListener('input', saveHaccpDraft);

  const btnBatchGen = document.getElementById('btn-batch-generate');
  const inputBatch = document.getElementById('haccp-batch');
  btnBatchGen?.addEventListener('click', () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const randomChar = chars.charAt(Math.floor(Math.random() * chars.length));
    const now = new Date();
    const dateStr = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
    if (inputBatch) {
      inputBatch.value = `CH-${dateStr}-${randomChar}`;
      haccpState.showHUD("⚡ Generiert", `Kombination: ${inputBatch.value}`);
    }
    haccpState.playClickSound(1300, 0.04, 0.15);
  });

  document.getElementById('btn-submit-haccp')?.addEventListener('click', async () => {
    haccpState.playClickSound(1100, 0.12, 0.25);
    const ph = parseFloat(document.getElementById('haccp-ph')?.value);
    const temperatur = parseFloat(document.getElementById('haccp-temp')?.value);
    const chargenNummer = document.getElementById('haccp-batch')?.value.trim();
    try {
      await saveHaccpLog({
        logTyp: 'protokoll',
        ph,
        temperatur,
        chargenNummer,
      });
      clearHaccpDraft();
      haccpState.onFormSaved(['haccp-ph', 'haccp-temp', 'haccp-batch']);
      haccpState.showHUD("📝 HACCP erfasst", `Charge ${chargenNummer} dokumentiert.`);
    } catch (err) {
      console.error('[CharcuLogic HACCP] Protokoll speichern fehlgeschlagen:', err);
      haccpState.showHUD("Fehler", "HACCP-Protokoll konnte nicht gespeichert werden.", "!");
    }
  });

  document.getElementById('btn-haccp-print')?.addEventListener('click', generateHaccpPrintView);
}

function updateHACCPAlerts() {
  const sliderPh = document.getElementById('haccp-ph');
  const sliderTemp = document.getElementById('haccp-temp');
  const badgePh = document.getElementById('ph-badge');
  const badgeTemp = document.getElementById('temp-badge');
  const alertBox = document.getElementById('haccp-alert-box');
  const alertTitle = document.getElementById('haccp-alert-title');
  const alertDesc = document.getElementById('haccp-alert-desc');
  if (!sliderPh || !sliderTemp || !badgePh || !badgeTemp || !alertBox || !alertTitle || !alertDesc) return;

  const ph = parseFloat(sliderPh.value);
  const temp = parseFloat(sliderTemp.value);

  badgePh.textContent = ph.toFixed(2).replace('.', ',');
  badgeTemp.textContent = `${temp.toFixed(1).replace('.', ',')} °C`;

  let hasAlert = false;
  let title = "";
  let desc = "";
  let isDanger = false;

  if (ph < 5.30) {
    hasAlert = true;
    title = "🚨 pH-Wert Warnung (PSE-Fleisch)";
    desc = "PSE-Gefahr! Der pH-Wert ist kritisch sauer. Fleisch verliert extrem viel Saft, wässrige Konsistenz. Ungeeignet für Brühwurst!";
    isDanger = true;
  } else if (ph > 6.20) {
    hasAlert = true;
    title = "🚨 pH-Wert Warnung (DFD-Fleisch)";
    desc = "DFD-Gefahr! Fleisch ist klebrig, dunkel und besitzt verkürzte Haltbarkeit. Erhöhtes Risiko für Keimbildung!";
    isDanger = true;
  } else if (temp > 7.0 && temp < 72.0) {
    hasAlert = true;
    title = "⚠️ Temperatur Warnung (Warmbereich)";
    desc = "Der Temperaturbereich liegt in der mikrobiellen Vermehrungszone. Kerntemperatur muss zügig gekühlt (<7°C) oder durchgegart (>72°C) werden!";
  }

  if (hasAlert) {
    alertBox.classList.add('active');
    alertBox.style.borderColor = isDanger ? 'var(--secondary-color)' : 'var(--warning-color)';
    alertBox.style.backgroundColor = isDanger ? 'rgba(244, 67, 54, 0.08)' : 'rgba(239, 108, 0, 0.08)';
    alertTitle.textContent = title;
    alertTitle.style.color = isDanger ? 'var(--secondary-color)' : 'var(--warning-color)';
    alertDesc.textContent = desc;
  } else {
    alertBox.classList.remove('active');
  }
}

function generateHaccpPrintView() {
  const days = 7;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const logs = (haccpState.logs || []).filter((entry) => (entry.datum || '') >= cutoffStr);
  const tempLogs = logs.filter((entry) => entry.logTyp === 'temperatur' || entry.logTyp === 'protokoll');
  const cleanLogs = logs.filter((entry) => entry.logTyp === 'reinigung');

  const formatDate = (date) => {
    if (!date) return '-';
    const parts = String(date).split('-');
    return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : date;
  };

  const tempRows = tempLogs.map((entry) => `
    <tr>
      <td>${formatDate(entry.datum)}</td>
      <td>${escapeHtml(entry.deviceName || entry.chargenNummer || '-')}</td>
      <td>${escapeHtml(entry.bereich || '-')}</td>
      <td>${escapeHtml(entry.wert != null ? entry.wert : (entry.temperatur != null ? entry.temperatur : '-'))} ${escapeHtml(entry.einheit || '°C')}</td>
      <td>${escapeHtml(entry.ph != null ? entry.ph : '-')}</td>
      <td class="${entry.status === 'ok' ? 'status-ok' : 'status-warn'}">${escapeHtml(entry.status === 'ok' ? 'OK' : (entry.status || 'Erfasst'))}</td>
      <td>${escapeHtml(entry.massnahme || '-')}</td>
    </tr>`).join('');

  const cleanRows = cleanLogs.map((entry) => `
    <tr>
      <td>${formatDate(entry.datum)}</td>
      <td>${escapeHtml(entry.deviceName || '-')}</td>
      <td>${escapeHtml(entry.bereich || '-')}</td>
      <td>${escapeHtml(entry.status || 'Erledigt')}</td>
      <td>${escapeHtml(entry.massnahme || '-')}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>HACCP-Protokoll - Druckansicht</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #111; padding: 20mm; }
  h1 { font-size: 16pt; margin-bottom: 4px; }
  .meta { font-size: 10pt; color: #555; margin-bottom: 16px; }
  h2 { font-size: 13pt; margin: 18px 0 6px; border-bottom: 2px solid #2E7D32; padding-bottom: 3px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 10pt; }
  th { background: #E8F5E9; color: #1B5E20; text-align: left; padding: 6px 8px; border: 1px solid #c8e6c9; font-weight: 700; }
  td { padding: 5px 8px; border: 1px solid #ddd; }
  tr:nth-child(even) td { background: #fafafa; }
  .status-ok { color: #2E7D32; font-weight: 700; }
  .status-warn { color: #E65100; font-weight: 700; }
  .footer { margin-top: 30px; font-size: 9pt; color: #888; border-top: 1px solid #ccc; padding-top: 8px; display: flex; justify-content: space-between; }
  .sig-line { margin-top: 40px; display: flex; gap: 60px; }
  .sig-line > div { flex: 1; border-top: 1px solid #333; padding-top: 4px; font-size: 10pt; }
  @media print { body { padding: 15mm; } }
</style>
</head>
<body>
  <h1>HACCP-Protokoll - ${escapeHtml(haccpState.tenantId || 'Betrieb')}</h1>
  <div class="meta">Zeitraum: Letzte ${days} Tage (ab ${formatDate(cutoffStr)}) &middot; Erstellt: ${new Date().toLocaleString('de-DE')}</div>

  <h2>Temperatur- & Messprotokolle (${tempLogs.length} Einträge)</h2>
  ${tempLogs.length ? `<table>
    <thead><tr><th>Datum</th><th>Gerät / Charge</th><th>Bereich</th><th>Temperatur</th><th>pH</th><th>Status</th><th>Maßnahme</th></tr></thead>
    <tbody>${tempRows}</tbody>
  </table>` : '<p style="color:#888;margin:8px 0;">Keine Temperaturprotokolle im Zeitraum.</p>'}

  <h2>Reinigungsprotokolle (${cleanLogs.length} Einträge)</h2>
  ${cleanLogs.length ? `<table>
    <thead><tr><th>Datum</th><th>Gerät</th><th>Bereich</th><th>Status</th><th>Anmerkung</th></tr></thead>
    <tbody>${cleanRows}</tbody>
  </table>` : '<p style="color:#888;margin:8px 0;">Keine Reinigungsprotokolle im Zeitraum.</p>'}

  <div class="sig-line">
    <div>Datum / Unterschrift Verantwortlicher</div>
    <div>Datum / Unterschrift Kontrolle</div>
  </div>

  <div class="footer">
    <span>CharcuLogic HACCP-System</span>
    <span>Seite 1</span>
  </div>

  <script>window.onload = () => window.print();</script>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  } else {
    haccpState.showHUD("Popup blockiert", "Bitte Popup-Blocker für diese Seite deaktivieren.", "!");
  }
}
