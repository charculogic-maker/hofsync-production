/**
 * MHD-Tageslauf-SLA: Reminder (S1) und Eskalation (S2) als Teamboard-Aufgaben.
 * Schedule: 07:30 / 10:00 Europe/Berlin — siehe index.js.
 */
const admin = require('firebase-admin');
const adminDb = require('./adminDb');
const { ensureAdminApp } = require('./firebaseAdmin');
const { cleanTenantId } = require('./authContext');

const TIME_ZONE = 'Europe/Berlin';
const DEFAULT_CRITICAL_MAX_RESTTAGE = 1;
/** Absurde Tippfehler-MHDs (z. B. −8000 Tage) nicht als Tageslauf-kritisch zählen. */
const DEFAULT_CRITICAL_MIN_RESTTAGE = -90;
const DEFAULT_OPEN_DAYS = Object.freeze([1, 2, 3, 4, 5, 6]); // Mo–Sa (JS getDay)
const DEFAULT_AUDIENCE_GROUP = 'laden';
const INACTIVE_STATUSES = new Set([
  'raus',
  'ausverkauft',
  'abgeschrieben',
  'rausgenommen',
  'sold_out',
  'disposed',
]);

function berlinDateParts(now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  const parts = formatter.formatToParts(now);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  const weekdayShort = String(parts.find((p) => p.type === 'weekday')?.value || '');
  const weekdayMap = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const weekday = weekdayMap[weekdayShort];
  const todayIso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { todayIso, weekday, year, month, day };
}

function normalizeIsoDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const de = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (de) {
    return `${de[3]}-${de[2].padStart(2, '0')}-${de[1].padStart(2, '0')}`;
  }
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) return '';
  const date = new Date(ms);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function computeResttage(mhdDateValue, todayIso) {
  const mhdIso = normalizeIsoDate(mhdDateValue);
  const today = normalizeIsoDate(todayIso);
  if (!mhdIso || !today) return null;
  const [my, mm, md] = mhdIso.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return Math.round((Date.UTC(my, mm - 1, md) - Date.UTC(ty, tm - 1, td)) / 86400000);
}

function itemQuantity(data = {}) {
  const qty = Number(data.menge ?? data.qty ?? data.quantity ?? 0);
  return Number.isFinite(qty) ? qty : 0;
}

function isActiveMhdItem(data = {}) {
  if (itemQuantity(data) <= 0) return false;
  if (data.archived === true) return false;
  if (data.active === false) return false;
  if (data.soldOut === true) return false;
  const status = String(data.status || '').trim().toLowerCase();
  return !INACTIVE_STATUSES.has(status);
}

function resolveResttage(data = {}, todayIso) {
  const explicit = data.mhd || data.mhdDate || data.mhdText || '';
  const computed = computeResttage(explicit, todayIso);
  if (Number.isFinite(computed)) return computed;
  const raw = Number(data.tage ?? data.resttage);
  return Number.isFinite(raw) ? raw : Number.POSITIVE_INFINITY;
}

function lastCheckedDate(data = {}) {
  return String(data.lastCheckedDate || data.lastMhdCheckDate || '').trim();
}

function isCheckedToday(data = {}, todayIso) {
  const checked = lastCheckedDate(data);
  return Boolean(checked) && checked === todayIso;
}

function isCriticalOpen(data = {}, {
  todayIso,
  criticalMaxResttage = DEFAULT_CRITICAL_MAX_RESTTAGE,
  criticalMinResttage = DEFAULT_CRITICAL_MIN_RESTTAGE,
} = {}) {
  if (!todayIso) return false;
  if (!isActiveMhdItem(data)) return false;
  if (isCheckedToday(data, todayIso)) return false;
  const resttage = resolveResttage(data, todayIso);
  if (!Number.isFinite(resttage)) return false;
  return resttage <= criticalMaxResttage && resttage >= criticalMinResttage;
}

function countCriticalOpen(items = [], options = {}) {
  let count = 0;
  for (const item of items) {
    if (isCriticalOpen(item, options)) count += 1;
  }
  return count;
}

function tenantHasMhdModule(tenantData = {}) {
  const modules = tenantData.enabledModules && typeof tenantData.enabledModules === 'object'
    ? tenantData.enabledModules
    : {};
  return modules.mhd === true || modules.mhdMonitor === true;
}

function resolveMhdSlaSettings(raw = {}) {
  const openDays = Array.isArray(raw.openDays)
    ? raw.openDays.map((d) => Number(d)).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    : [...DEFAULT_OPEN_DAYS];
  const critical = Number(raw.criticalMaxResttage);
  return {
    enabled: raw.enabled !== false,
    criticalMaxResttage: Number.isFinite(critical) ? critical : DEFAULT_CRITICAL_MAX_RESTTAGE,
    openDays: openDays.length ? openDays : [...DEFAULT_OPEN_DAYS],
    audienceGroup: String(raw.audienceGroup || DEFAULT_AUDIENCE_GROUP).trim() || DEFAULT_AUDIENCE_GROUP,
    escalateGroup: String(raw.escalateGroup || '').trim(),
    escalateTo: Array.isArray(raw.escalateTo)
      ? raw.escalateTo.map((name) => String(name || '').trim()).filter(Boolean)
      : [],
  };
}

function slaTaskDocId(todayIso, stage) {
  return `mhd_sla_${todayIso}_${stage}`;
}

function buildSlaTaskPayload({
  tenantId,
  stage,
  todayIso,
  openCriticalCount,
  settings,
}) {
  const isEscalate = stage === 's2';
  const title = isEscalate
    ? 'MHD-Check eskaliert – noch kritisch offen'
    : 'MHD-Morgencheck noch offen';
  const body = isEscalate
    ? `Noch ${openCriticalCount} kritische Posten (Überfällig / Heute / Morgen) ohne heutigen Check. Bitte sofort im MHD-Tab abarbeiten.`
    : `Noch ${openCriticalCount} kritische Posten (Überfällig / Heute / Morgen) ohne heutigen Check. Bitte MHD-Tab abarbeiten.`;

  const payload = {
    title,
    body,
    entryKind: 'task',
    priority: isEscalate ? 'Rot' : 'Gelb',
    status: 'open',
    tenantId,
    author: 'HofSync MHD',
    source: 'mhd_sla',
    slaStage: stage,
    slaDate: todayIso,
    openCriticalCount,
    dueDate: todayIso,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (isEscalate) {
    if (settings.escalateTo.length) {
      payload.audienceType = 'persons';
      payload.audienceMembers = settings.escalateTo;
    } else if (settings.escalateGroup) {
      payload.audienceType = 'group';
      payload.audienceGroup = settings.escalateGroup;
    } else {
      payload.audienceType = 'all';
    }
  } else {
    payload.audienceType = 'group';
    payload.audienceGroup = settings.audienceGroup;
  }

  return payload;
}

async function listActiveTenantIds() {
  const db = adminDb.firestore();
  const tenantsRef = db.collection('tenants');
  let snap;
  try {
    snap = await tenantsRef.where('status', '==', 'active').get();
  } catch (_) {
    snap = await tenantsRef.get();
  }
  let ids = snap.docs
    .map((doc) => doc.id)
    .filter((id) => Boolean(cleanTenantId(id)));
  if (ids.length) return ids;
  const all = await tenantsRef.limit(200).get();
  return all.docs.map((doc) => doc.id).filter(Boolean);
}

async function loadTenantContext(tenantId) {
  const db = adminDb.firestore();
  const tenantSnap = await db.doc(`tenants/${tenantId}`).get();
  const tenantData = tenantSnap.exists ? (tenantSnap.data() || {}) : {};
  const settingsSnap = await db.doc(`tenants/${tenantId}/settings/mhdSla`).get();
  const settings = resolveMhdSlaSettings(settingsSnap.exists ? (settingsSnap.data() || {}) : {});
  return { tenantData, settings };
}

async function loadMhdListeItems(tenantId) {
  const snap = await adminDb.firestore()
    .collection(`tenants/${tenantId}/mhd_liste`)
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
}

async function createSlaTaskIfMissing(tenantId, stage, todayIso, openCriticalCount, settings) {
  const db = adminDb.firestore();
  const taskId = slaTaskDocId(todayIso, stage);
  const ref = db.doc(`tenants/${tenantId}/tasks/${taskId}`);
  const payload = buildSlaTaskPayload({
    tenantId,
    stage,
    todayIso,
    openCriticalCount,
    settings,
  });
  try {
    await ref.create(payload);
    return { created: true, taskId, skipped: false };
  } catch (err) {
    const code = err?.code;
    const already = code === 6
      || code === 'already-exists'
      || /ALREADY_EXISTS/i.test(String(err?.message || ''));
    if (already) {
      return { created: false, taskId, skipped: true };
    }
    throw err;
  }
}

/**
 * @param {'s1'|'s2'} stage
 * @param {{ now?: Date }} [options]
 */
async function runMhdSlaForTenant(tenantId, stage, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const { todayIso, weekday } = berlinDateParts(now);
  const { tenantData, settings } = await loadTenantContext(tenantId);

  if (!tenantHasMhdModule(tenantData)) {
    return { tenantId, stage, skipped: true, reason: 'no_mhd_module' };
  }
  if (!settings.enabled) {
    return { tenantId, stage, skipped: true, reason: 'disabled' };
  }
  if (!settings.openDays.includes(weekday)) {
    return { tenantId, stage, skipped: true, reason: 'closed_day', weekday, todayIso };
  }

  const items = await loadMhdListeItems(tenantId);
  const openCriticalCount = countCriticalOpen(items, {
    todayIso,
    criticalMaxResttage: settings.criticalMaxResttage,
  });

  if (openCriticalCount <= 0) {
    return {
      tenantId,
      stage,
      skipped: true,
      reason: 'all_clear',
      todayIso,
      openCriticalCount: 0,
    };
  }

  const taskResult = await createSlaTaskIfMissing(
    tenantId,
    stage,
    todayIso,
    openCriticalCount,
    settings,
  );

  return {
    tenantId,
    stage,
    skipped: Boolean(taskResult.skipped),
    reason: taskResult.skipped ? 'already_exists' : 'created',
    todayIso,
    openCriticalCount,
    taskId: taskResult.taskId,
    created: taskResult.created,
  };
}

/**
 * @param {'s1'|'s2'} stage
 * @param {{ now?: Date }} [options]
 */
async function handleMhdSlaScheduled(stage, options = {}) {
  ensureAdminApp();
  const normalizedStage = stage === 's2' ? 's2' : 's1';
  const tenantIds = await listActiveTenantIds();
  const results = [];
  for (const tenantId of tenantIds) {
    try {
      const result = await runMhdSlaForTenant(tenantId, normalizedStage, options);
      results.push(result);
      console.log('[mhdSla] tenant result', result);
    } catch (err) {
      console.error('[mhdSla] tenant failed', {
        tenantId,
        stage: normalizedStage,
        message: err?.message || String(err),
      });
      results.push({
        tenantId,
        stage: normalizedStage,
        skipped: false,
        reason: 'error',
        error: String(err?.message || err),
      });
    }
  }
  return {
    success: true,
    stage: normalizedStage,
    tenantCount: tenantIds.length,
    createdCount: results.filter((row) => row.created).length,
    results,
  };
}

exports.TIME_ZONE = TIME_ZONE;
exports.DEFAULT_CRITICAL_MAX_RESTTAGE = DEFAULT_CRITICAL_MAX_RESTTAGE;
exports.berlinDateParts = berlinDateParts;
exports.normalizeIsoDate = normalizeIsoDate;
exports.computeResttage = computeResttage;
exports.isActiveMhdItem = isActiveMhdItem;
exports.isCriticalOpen = isCriticalOpen;
exports.countCriticalOpen = countCriticalOpen;
exports.tenantHasMhdModule = tenantHasMhdModule;
exports.resolveMhdSlaSettings = resolveMhdSlaSettings;
exports.slaTaskDocId = slaTaskDocId;
exports.buildSlaTaskPayload = buildSlaTaskPayload;
exports.runMhdSlaForTenant = runMhdSlaForTenant;
exports.handleMhdSlaScheduled = handleMhdSlaScheduled;
exports.handleMhdSlaReminderScheduled = (event) => handleMhdSlaScheduled('s1', { now: event?.scheduleTime ? new Date(event.scheduleTime) : undefined });
exports.handleMhdSlaEscalateScheduled = (event) => handleMhdSlaScheduled('s2', { now: event?.scheduleTime ? new Date(event.scheduleTime) : undefined });
