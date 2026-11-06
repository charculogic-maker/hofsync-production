/**
 * HACCP Raum- & Geräteplan (Behörden-Audit) im Dev-Dashboard.
 * Grundriss-Upload, Pin-Editor, Filter-Chips, Audit-Legende, A4-Querformat-Druck.
 */
import { canonicalTenantId } from './tenant-db.js';

const MAX_FLOORPLAN_BYTES = 5 * 1024 * 1024;
const ALLOWED_FLOORPLAN_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
const PRINT_BODY_CLASS = 'print-haccp-audit';
const WEEKDAY_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

const FILTERS = Object.freeze({
  all: { id: 'all', label: 'Alle Prüfpunkte', printLabel: 'Gesamt' },
  cooling: { id: 'cooling', label: '❄️ Kühl- & Tiefkühlkette', printLabel: 'Kühlkette' },
  cleaning: { id: 'cleaning', label: '🧼 Reinigung & Hygiene', printLabel: 'Reinigung & Hygiene' },
  verkauf: { id: 'verkauf', label: '🥩 Verkauf & Theke', printLabel: 'Verkauf & Theke' },
});

const floorplanState = {
  db: null,
  tenantId: '',
  devices: [],
  tasks: [],
  floorplanUrl: '',
  floorplanMetaUnsub: null,
  bound: false,
  activeFilter: 'all',
  pendingPlaceKey: null,
  dragKey: null,
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

function tenantDoc(collectionName, docId) {
  const tenantId = canonicalTenantId(floorplanState.tenantId);
  if (!floorplanState.db || !tenantId) return null;
  return floorplanState.db.collection('tenants').doc(tenantId).collection(collectionName).doc(docId);
}

function tenantCollection(name) {
  const tenantId = canonicalTenantId(floorplanState.tenantId);
  if (!floorplanState.db || !tenantId) return null;
  return floorplanState.db.collection('tenants').doc(tenantId).collection(name);
}

function hasValidPosition(item) {
  // null/undefined bewusst ausschließen — Number(null) === 0 wäre sonst „gültig“.
  if (item?.posX == null || item?.posY == null) return false;
  const x = Number(item.posX);
  const y = Number(item.posY);
  return Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 100 && y >= 0 && y <= 100;
}

function isRetiredDevice(device) {
  return String(device?.status || '') === 'retired'
    || device?.isActive === false
    || device?.aktiv === false;
}

function isActiveTask(task) {
  return task?.isActive !== false;
}

function resolveDeviceFloorCategory(device) {
  const explicit = String(device?.category || device?.floorplanCategory || '').trim().toLowerCase();
  if (explicit === 'cooling' || explicit === 'freezer' || explicit === 'cleaning' || explicit === 'handwash') {
    return explicit;
  }
  const typ = String(device?.geraeteTyp || '').toLowerCase();
  if (typ === 'tk' || typ === 'freezer') return 'freezer';
  if (typ === 'hygiene' || typ === 'cleaning') return 'cleaning';
  const max = Number(device?.tempMax ?? device?.sollMax);
  if (Number.isFinite(max) && max <= -10) return 'freezer';
  return 'cooling';
}

function resolveTaskFloorCategory(task) {
  const explicit = String(task?.floorplanCategory || '').trim().toLowerCase();
  if (explicit === 'handwash' || explicit === 'cleaning') return explicit;
  const name = String(task?.name || '').toLowerCase();
  if (/handwasch|händewasch|haendewasch|hand.?wasch|waschbecken/.test(name)) return 'handwash';
  return 'cleaning';
}

function categoryBadge(category) {
  if (category === 'freezer' || category === 'cooling') return '❄️';
  if (category === 'handwash' || category === 'cleaning') return '🧼';
  return '📍';
}

function itemArea(item) {
  return String(item?.bereich || item?.area || '').trim();
}

function matchesFilter(point, filterId) {
  if (!filterId || filterId === 'all') return true;
  if (filterId === 'cooling') {
    return point.category === 'cooling' || point.category === 'freezer';
  }
  if (filterId === 'cleaning') {
    return point.category === 'cleaning' || point.category === 'handwash';
  }
  if (filterId === 'verkauf') {
    return itemArea(point) === 'Verkauf';
  }
  return true;
}

function formatDeviceSoll(device) {
  const min = device.tempMin ?? device.sollMin;
  const max = device.tempMax ?? device.sollMax;
  if (min == null && max == null) return '—';
  if (min != null && max != null) return `${min} bis ${max} °C`;
  if (min != null) return `min. ${min} °C`;
  return `max. ${max} °C`;
}

function formatDeviceFrequency(device) {
  if (!Array.isArray(device.activeDays) || !device.activeDays.length) {
    return 'CCP / Täglich';
  }
  const days = device.activeDays.map((d) => WEEKDAY_LABELS[d] || d).join('–');
  return `CCP / ${days}`;
}

function formatTaskSoll(task) {
  const category = String(task.category || '').trim();
  if (category === 'Nach Nutzung') return 'Nach jeder Nutzung';
  if (category === 'Wöchentlich') {
    const day = Number(task.targetDay);
    if (Number.isInteger(day) && day >= 0 && day <= 6) {
      return `Wöchentlich (${WEEKDAY_LABELS[day]})`;
    }
    return 'Wöchentlich';
  }
  return 'Täglich nach Betriebsschluss';
}

function formatTaskType(task) {
  if (task.isProductionOnly) return 'Basis-Hygiene (Produktion)';
  return 'Basis-Hygiene';
}

function buildAuditPoints() {
  const devices = (floorplanState.devices || [])
    .filter((device) => !isRetiredDevice(device))
    .map((device) => ({
      key: `device:${device.id}`,
      kind: 'device',
      id: device.id,
      name: device.name || 'Messpunkt',
      category: resolveDeviceFloorCategory(device),
      area: itemArea(device) || '—',
      bereich: itemArea(device),
      posX: device.posX,
      posY: device.posY,
      soll: formatDeviceSoll(device),
      typ: formatDeviceFrequency(device),
      tooltip: `${device.name || 'Messpunkt'} · ${formatDeviceSoll(device)}`,
      raw: device,
    }));

  const tasks = (floorplanState.tasks || [])
    .filter((task) => isActiveTask(task))
    .map((task) => ({
      key: `task:${task.id}`,
      kind: 'task',
      id: task.id,
      name: task.name || 'Reinigung',
      category: resolveTaskFloorCategory(task),
      area: itemArea(task) || '—',
      bereich: itemArea(task),
      posX: task.posX,
      posY: task.posY,
      soll: formatTaskSoll(task),
      typ: formatTaskType(task),
      tooltip: `${task.name || 'Reinigung'} · ${formatTaskSoll(task)}`,
      raw: task,
    }));

  return [...devices, ...tasks].sort((a, b) => String(a.name).localeCompare(String(b.name), 'de'));
}

function resolveBetriebPrintMeta() {
  const name = document.getElementById('dev-dashboard-settings-name')?.value.trim()
    || window.BRANDING?.title
    || window.BRANDING?.name
    || window.__charculogicBootBrandTitle
    || 'Betrieb';
  const oeko = window.BRANDING?.oeko
    || window.BRANDING?.organicControlBody
    || window.BRANDING?.zulassungsnummer
    || localStorage.getItem('charculogic_brand_oeko')
    || '—';
  return { name: String(name).trim(), oeko: String(oeko).trim() || '—' };
}

function setFloorplanStatus(message, tone = 'info') {
  const el = document.getElementById('haccp-floorplan-status');
  if (!el) return;
  el.textContent = message;
  el.dataset.tone = tone;
}

function applyFilterClass() {
  const filterId = floorplanState.activeFilter || 'all';
  document.querySelectorAll('[data-haccp-filter-chip]').forEach((chip) => {
    const active = chip.getAttribute('data-haccp-filter-chip') === filterId;
    chip.classList.toggle('is-active', active);
    chip.setAttribute('aria-pressed', active ? 'true' : 'false');
  });

  document.querySelectorAll('[data-haccp-point-key]').forEach((node) => {
    const category = node.getAttribute('data-category') || '';
    const area = node.getAttribute('data-area') || '';
    const point = { category, area, bereich: area };
    const visible = matchesFilter(point, filterId);
    node.classList.toggle('haccp-filter-hidden', !visible);
  });

  const filterMeta = FILTERS[filterId] || FILTERS.all;
  document.querySelectorAll('[data-haccp-print-filter]').forEach((el) => {
    el.textContent = filterMeta.printLabel;
  });
}

function renderFilterChips() {
  const bar = document.getElementById('haccp-floorplan-filters');
  if (!bar) return;
  bar.innerHTML = Object.values(FILTERS).map((filter) => `
    <button
      type="button"
      class="haccp-floorplan-filter-chip${floorplanState.activeFilter === filter.id ? ' is-active' : ''}"
      data-haccp-filter-chip="${escapeHtml(filter.id)}"
      aria-pressed="${floorplanState.activeFilter === filter.id ? 'true' : 'false'}"
    >${escapeHtml(filter.label)}</button>
  `).join('');
}

function renderDock(points) {
  const dock = document.getElementById('haccp-floorplan-dock');
  if (!dock) return;
  const unassigned = points.filter((point) => !hasValidPosition(point));
  if (!unassigned.length) {
    dock.innerHTML = '<p class="dev-dashboard-intro">Alle aktiven Prüfpunkte sind auf dem Plan verortet.</p>';
    return;
  }
  dock.innerHTML = `
    <ul class="haccp-floorplan-dock-list" aria-label="Nicht zugewiesene Prüfpunkte">
      ${unassigned.map((point) => `
        <li>
          <button
            type="button"
            class="haccp-floorplan-dock-item${floorplanState.pendingPlaceKey === point.key ? ' is-selected' : ''}"
            data-haccp-dock-key="${escapeHtml(point.key)}"
            draggable="true"
            title="Tippen und dann auf den Plan klicken, oder ziehen"
          >
            <span class="haccp-floorplan-dock-badge">${categoryBadge(point.category)}</span>
            <span class="haccp-floorplan-dock-text">
              <strong>${escapeHtml(point.name)}</strong>
              <small>${escapeHtml(point.soll)}</small>
            </span>
          </button>
        </li>
      `).join('')}
    </ul>
  `;
}

function renderPins(points) {
  const layer = document.getElementById('haccp-floorplan-pin-layer');
  if (!layer) return;
  const placed = points.filter((point) => hasValidPosition(point));
  const numbered = placed.map((point, index) => ({ ...point, pinNo: index + 1 }));

  layer.innerHTML = numbered.map((point) => `
    <div
      class="haccp-floorplan-pin"
      data-haccp-point-key="${escapeHtml(point.key)}"
      data-category="${escapeHtml(point.category)}"
      data-area="${escapeHtml(point.bereich || point.area || '')}"
      style="left:${Number(point.posX)}%;top:${Number(point.posY)}%;"
      title="${escapeHtml(point.tooltip)}"
      role="button"
      tabindex="0"
      aria-label="Prüfpunkt ${escapeHtml(point.name)}"
    >
      <span class="haccp-floorplan-pin-marker" data-haccp-drag-handle="${escapeHtml(point.key)}">
        <span class="haccp-floorplan-pin-no">#${point.pinNo}</span>
        <span class="haccp-floorplan-pin-icon">${categoryBadge(point.category)}</span>
      </span>
      <button
        type="button"
        class="haccp-floorplan-pin-remove"
        data-haccp-unpin="${escapeHtml(point.key)}"
        title="Verortung aufheben"
        aria-label="Verortung von ${escapeHtml(point.name)} aufheben"
      >✕</button>
      <span class="haccp-floorplan-pin-tooltip">${escapeHtml(point.name)} · ${escapeHtml(point.soll)}</span>
    </div>
  `).join('');

  return numbered;
}

function renderLegend(numberedPoints) {
  const body = document.getElementById('haccp-floorplan-legend-body');
  if (!body) return;
  if (!numberedPoints.length) {
    body.innerHTML = '<tr><td colspan="4">Noch keine Prüfpunkte auf dem Plan. Links im Dock auswählen und auf den Grundriss tippen.</td></tr>';
    return;
  }
  body.innerHTML = numberedPoints.map((point) => `
    <tr
      data-haccp-point-key="${escapeHtml(point.key)}"
      data-category="${escapeHtml(point.category)}"
      data-area="${escapeHtml(point.bereich || point.area || '')}"
    >
      <td><span class="haccp-legend-badge">#${point.pinNo} [${categoryBadge(point.category)}]</span></td>
      <td>
        <strong>${escapeHtml(point.name)}</strong>
        <div class="dev-dashboard-haccp-meta">Bereich: ${escapeHtml(point.area || '—')}</div>
      </td>
      <td>${escapeHtml(point.soll)}</td>
      <td>${escapeHtml(point.typ)}</td>
    </tr>
  `).join('');
}

function syncPrintHeader() {
  const meta = resolveBetriebPrintMeta();
  const nameEl = document.getElementById('haccp-print-betrieb-name');
  const oekoEl = document.getElementById('haccp-print-oeko');
  const dateEl = document.getElementById('haccp-print-date');
  if (nameEl) nameEl.textContent = meta.name;
  if (oekoEl) oekoEl.textContent = meta.oeko;
  if (dateEl) {
    dateEl.textContent = new Intl.DateTimeFormat('de-DE', {
      timeZone: 'Europe/Berlin',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date());
  }
}

function updateFloorplanImage() {
  const img = document.getElementById('haccp-floorplan-image');
  const empty = document.getElementById('haccp-floorplan-empty');
  const url = floorplanState.floorplanUrl;
  if (img) {
    if (url) {
      img.src = url;
      img.hidden = false;
    } else {
      img.removeAttribute('src');
      img.hidden = true;
    }
  }
  if (empty) empty.hidden = Boolean(url);
}

export function renderHaccpFloorplan() {
  const root = document.getElementById('dev-dashboard-haccp-floorplan');
  if (!root) return;
  const points = buildAuditPoints();
  renderFilterChips();
  renderDock(points);
  const numbered = renderPins(points) || [];
  renderLegend(numbered);
  updateFloorplanImage();
  syncPrintHeader();
  applyFilterClass();

  const placed = points.filter((point) => hasValidPosition(point)).length;
  const open = points.length - placed;
  setFloorplanStatus(
    floorplanState.tenantId
      ? `${points.length} Prüfpunkte · ${placed} verortet · ${open} offen`
      : 'Bitte zuerst einen Betrieb wählen.',
    floorplanState.tenantId ? 'info' : 'error',
  );
}

function patchLocalPoint(kind, id, patch) {
  const list = kind === 'device' ? floorplanState.devices : floorplanState.tasks;
  const idx = list.findIndex((entry) => entry.id === id);
  if (idx < 0) return;
  list[idx] = { ...list[idx], ...patch };
}

async function persistPosition(pointKey, posX, posY) {
  const [kind, id] = String(pointKey || '').split(':');
  if (!kind || !id) return;
  const collection = kind === 'device' ? 'haccp_geraete' : 'haccp_cleaning_tasks';
  const ref = tenantDoc(collection, id);
  if (!ref) {
    window.showToast?.('Bitte zuerst einen Betrieb wählen.', 'error');
    return;
  }
  const nextX = Math.round(Number(posX) * 100) / 100;
  const nextY = Math.round(Number(posY) * 100) / 100;
  const payload = {
    posX: nextX,
    posY: nextY,
    tenantId: canonicalTenantId(floorplanState.tenantId),
    updatedAt: serverTimestamp(),
  };
  // Sofort im UI spiegeln — Snapshot holt den finalen Stand nach.
  patchLocalPoint(kind, id, { posX: nextX, posY: nextY });
  renderHaccpFloorplan();
  try {
    await ref.set(payload, { merge: true });
    floorplanState.recordAudit('settings', `HACCP-Prüfpunkt verortet: ${pointKey}`, 'change');
  } catch (err) {
    console.error('[HACCP-Raumplan] Position speichern:', err);
    window.showToast?.('Position konnte nicht gespeichert werden.', 'error');
  }
}

async function clearPosition(pointKey) {
  const [kind, id] = String(pointKey || '').split(':');
  if (!kind || !id) return;
  const collection = kind === 'device' ? 'haccp_geraete' : 'haccp_cleaning_tasks';
  const ref = tenantDoc(collection, id);
  if (!ref) return;
  patchLocalPoint(kind, id, { posX: null, posY: null });
  renderHaccpFloorplan();
  try {
    await ref.set({
      posX: null,
      posY: null,
      tenantId: canonicalTenantId(floorplanState.tenantId),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    floorplanState.recordAudit('settings', `HACCP-Prüfpunkt vom Plan genommen: ${pointKey}`, 'change');
    window.showToast?.('Prüfpunkt wieder in die Liste gelegt.', 'success');
  } catch (err) {
    console.error('[HACCP-Raumplan] Position löschen:', err);
    window.showToast?.('Verortung konnte nicht aufgehoben werden.', 'error');
  }
}

function percentFromPointer(event, viewport) {
  const rect = viewport.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;
  return {
    posX: Math.min(100, Math.max(0, x)),
    posY: Math.min(100, Math.max(0, y)),
  };
}

async function saveFloorplanMeta(meta) {
  const ref = tenantDoc('haccp_meta', 'floorplan');
  if (!ref) throw new Error('Kein Betrieb gewählt');
  const existing = await ref.get();
  const payload = {
    ...meta,
    tenantId: canonicalTenantId(floorplanState.tenantId),
    updatedAt: serverTimestamp(),
  };
  if (!existing.exists) payload.createdAt = serverTimestamp();
  await ref.set(payload, { merge: true });
}

async function uploadFloorplanFile(file) {
  if (!file) return;
  if (!ALLOWED_FLOORPLAN_TYPES.has(String(file.type || '').toLowerCase())
    && !/\.(png|jpe?g|webp)$/i.test(file.name || '')) {
    window.showToast?.('Bitte PNG, JPG oder WebP wählen.', 'error');
    return;
  }
  if (file.size > MAX_FLOORPLAN_BYTES) {
    window.showToast?.('Die Datei ist größer als 5 MB.', 'error');
    return;
  }
  const tenantId = canonicalTenantId(floorplanState.tenantId);
  if (!tenantId || !floorplanState.db) {
    window.showToast?.('Bitte zuerst einen Betrieb wählen.', 'error');
    return;
  }
  setFloorplanStatus('Grundriss wird gespeichert…', 'info');
  try {
    if (!firebase?.storage) throw new Error('Firebase Storage fehlt');
    const path = `tenants/${tenantId}/haccp_plans/floorplan.png`;
    const ref = firebase.storage().ref(path);
    const snapshot = await ref.put(file, { contentType: file.type || 'image/png' });
    const url = await snapshot.ref.getDownloadURL();
    await saveFloorplanMeta({
      imageUrl: url,
      storagePath: path,
      contentType: file.type || 'image/png',
      fileName: file.name || 'floorplan.png',
      updatedBy: 'dev-dashboard-haccp-floorplan',
    });
    floorplanState.floorplanUrl = url;
    updateFloorplanImage();
    floorplanState.recordAudit('settings', 'HACCP-Grundriss hochgeladen', 'change');
    window.showToast?.('Grundriss gespeichert.', 'success');
    setFloorplanStatus('Grundriss gespeichert.', 'info');
  } catch (err) {
    console.error('[HACCP-Raumplan] Upload:', err);
    // Fallback: kleine Bilder als Data-URL in Firestore (max. ~700 KB)
    if (file.size <= 700 * 1024) {
      try {
        const dataUrl = await readFileAsDataUrl(file);
        await saveFloorplanMeta({
          imageUrl: dataUrl,
          storagePath: null,
          contentType: file.type || 'image/png',
          fileName: file.name || 'floorplan.png',
          updatedBy: 'dev-dashboard-haccp-floorplan-dataurl',
        });
        floorplanState.floorplanUrl = dataUrl;
        updateFloorplanImage();
        window.showToast?.('Grundriss lokal im Betrieb gespeichert.', 'success');
        setFloorplanStatus('Grundriss gespeichert (ohne Storage).', 'info');
        return;
      } catch (fallbackErr) {
        console.error('[HACCP-Raumplan] Data-URL Fallback:', fallbackErr);
      }
    }
    window.showToast?.('Grundriss konnte nicht gespeichert werden.', 'error');
    setFloorplanStatus('Upload fehlgeschlagen.', 'error');
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Lesen fehlgeschlagen'));
    reader.readAsDataURL(file);
  });
}

function stopFloorplanMetaSync() {
  if (typeof floorplanState.floorplanMetaUnsub === 'function') {
    floorplanState.floorplanMetaUnsub();
    floorplanState.floorplanMetaUnsub = null;
  }
}

function startFloorplanMetaSync() {
  stopFloorplanMetaSync();
  const ref = tenantDoc('haccp_meta', 'floorplan');
  if (!ref) {
    floorplanState.floorplanUrl = '';
    updateFloorplanImage();
    return;
  }
  floorplanState.floorplanMetaUnsub = ref.onSnapshot((snap) => {
    const data = snap.exists ? snap.data() : null;
    floorplanState.floorplanUrl = String(data?.imageUrl || '').trim();
    updateFloorplanImage();
  }, (err) => {
    console.error('[HACCP-Raumplan] Meta-Sync:', err);
    setFloorplanStatus('Grundriss-Daten konnten nicht geladen werden.', 'error');
  });
}

function ensurePrintZoneOnBody() {
  const zone = document.getElementById('haccp-audit-print-zone');
  if (!(zone instanceof HTMLElement)) return null;
  if (zone.parentElement !== document.body) {
    if (!zone.dataset.haccpPrintHome) {
      const marker = document.createComment('haccp-audit-print-home');
      zone.parentNode?.insertBefore(marker, zone);
      zone.dataset.haccpPrintHome = '1';
      zone._haccpPrintHomeMarker = marker;
    }
    document.body.appendChild(zone);
  }
  return zone;
}

function restorePrintZoneHome() {
  const zone = document.getElementById('haccp-audit-print-zone');
  if (!(zone instanceof HTMLElement)) return;
  const marker = zone._haccpPrintHomeMarker;
  if (marker?.parentNode) {
    marker.parentNode.insertBefore(zone, marker);
  }
}

function printHaccpAuditPlan() {
  syncPrintHeader();
  applyFilterClass();
  ensurePrintZoneOnBody();
  document.body.classList.add(PRINT_BODY_CLASS);
  const cleanup = () => {
    document.body.classList.remove(PRINT_BODY_CLASS);
    restorePrintZoneHome();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.setTimeout(() => {
    try {
      window.print();
    } catch (err) {
      console.error('[HACCP-Raumplan] Druck:', err);
      cleanup();
    }
  }, 0);
}

function bindFloorplanControls() {
  if (floorplanState.bound) return;
  floorplanState.bound = true;
  const root = document.getElementById('dev-dashboard-haccp-floorplan');
  if (!root) return;

  document.getElementById('haccp-floorplan-upload')
    ?.addEventListener('change', (event) => {
      const input = event.target;
      const file = input?.files?.[0];
      void uploadFloorplanFile(file);
      if (input) input.value = '';
    });

  document.getElementById('haccp-floorplan-print-btn')
    ?.addEventListener('click', () => printHaccpAuditPlan());

  root.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-haccp-filter-chip]');
    if (chip) {
      floorplanState.activeFilter = chip.getAttribute('data-haccp-filter-chip') || 'all';
      applyFilterClass();
      renderFilterChips();
      applyFilterClass();
      return;
    }

    const dockItem = event.target.closest('[data-haccp-dock-key]');
    if (dockItem) {
      const key = dockItem.getAttribute('data-haccp-dock-key');
      floorplanState.pendingPlaceKey = floorplanState.pendingPlaceKey === key ? null : key;
      renderDock(buildAuditPoints());
      return;
    }
  });

  const viewport = document.getElementById('haccp-floorplan-viewport');
  // Unpin bewusst auf pointerdown: verhindert, dass ein nachfolgender
  // Viewport-Klick / Drag die Koordinaten sofort wieder setzt.
  viewport?.addEventListener('pointerdown', (event) => {
    const unpin = event.target.closest('[data-haccp-unpin]');
    if (!unpin) return;
    event.preventDefault();
    event.stopPropagation();
    void clearPosition(unpin.getAttribute('data-haccp-unpin'));
  }, true);

  viewport?.addEventListener('click', (event) => {
    if (event.target.closest('[data-haccp-unpin], [data-haccp-drag-handle]')) return;
    if (!floorplanState.pendingPlaceKey) return;
    const pct = percentFromPointer(event, viewport);
    if (!pct) return;
    const key = floorplanState.pendingPlaceKey;
    floorplanState.pendingPlaceKey = null;
    void persistPosition(key, pct.posX, pct.posY);
  });

  viewport?.addEventListener('dragover', (event) => {
    event.preventDefault();
  });

  viewport?.addEventListener('drop', (event) => {
    event.preventDefault();
    const key = event.dataTransfer?.getData('text/haccp-point')
      || floorplanState.pendingPlaceKey
      || floorplanState.dragKey;
    if (!key) return;
    const pct = percentFromPointer(event, viewport);
    if (!pct) return;
    floorplanState.pendingPlaceKey = null;
    floorplanState.dragKey = null;
    void persistPosition(key, pct.posX, pct.posY);
  });

  root.addEventListener('dragstart', (event) => {
    const dockItem = event.target.closest('[data-haccp-dock-key]');
    const handle = event.target.closest('[data-haccp-drag-handle]');
    const key = dockItem?.getAttribute('data-haccp-dock-key')
      || handle?.getAttribute('data-haccp-drag-handle');
    if (!key || !event.dataTransfer) return;
    floorplanState.dragKey = key;
    floorplanState.pendingPlaceKey = key;
    event.dataTransfer.setData('text/haccp-point', key);
    event.dataTransfer.effectAllowed = 'move';
  });

  // Pins per Pointer verschieben
  let dragging = null;
  viewport?.addEventListener('pointerdown', (event) => {
    const handle = event.target.closest('[data-haccp-drag-handle]');
    if (!handle || !viewport) return;
    const key = handle.getAttribute('data-haccp-drag-handle');
    if (!key) return;
    dragging = { key, pointerId: event.pointerId };
    handle.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });
  viewport?.addEventListener('pointermove', (event) => {
    if (!dragging || dragging.pointerId !== event.pointerId) return;
    const pin = viewport.querySelector(`[data-haccp-point-key="${CSS.escape(dragging.key)}"]`);
    const pct = percentFromPointer(event, viewport);
    if (!pin || !pct) return;
    pin.style.left = `${pct.posX}%`;
    pin.style.top = `${pct.posY}%`;
    dragging.posX = pct.posX;
    dragging.posY = pct.posY;
  });
  const endDrag = (event) => {
    if (!dragging || dragging.pointerId !== event.pointerId) return;
    const { key, posX, posY } = dragging;
    dragging = null;
    if (posX == null || posY == null) return;
    void persistPosition(key, posX, posY);
  };
  viewport?.addEventListener('pointerup', endDrag);
  viewport?.addEventListener('pointercancel', endDrag);
}

/**
 * @param {{
 *   db?: FirebaseFirestore.Firestore|null,
 *   tenantId?: string,
 *   devices?: Array<Record<string, unknown>>,
 *   tasks?: Array<Record<string, unknown>>,
 *   recordAudit?: Function,
 * }} options
 */
export function syncHaccpFloorplan(options = {}) {
  if ('db' in options) floorplanState.db = options.db || null;
  if ('tenantId' in options) floorplanState.tenantId = String(options.tenantId || '').trim();
  if (Array.isArray(options.devices)) floorplanState.devices = options.devices;
  if (Array.isArray(options.tasks)) floorplanState.tasks = options.tasks;
  if (typeof options.recordAudit === 'function') floorplanState.recordAudit = options.recordAudit;
  bindFloorplanControls();
  startFloorplanMetaSync();
  renderHaccpFloorplan();
}

export function refreshHaccpFloorplanFromAdmin(devices, tasks) {
  floorplanState.devices = Array.isArray(devices) ? devices : floorplanState.devices;
  floorplanState.tasks = Array.isArray(tasks) ? tasks : floorplanState.tasks;
  renderHaccpFloorplan();
}
