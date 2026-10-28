/**
 * MHD-Tageslauf-SLA (kritische offene Posten): reine Zähllogik + Badge/Banner.
 * Schwelle Default: Resttage ≤ 1, aktiv, heute noch ohne Check-Stempel.
 */

export const MHD_SLA_DEFAULT_CRITICAL_MAX_RESTTAGE = 1;

export const MHD_SLA_INACTIVE_STATUSES = Object.freeze(new Set([
  'raus',
  'ausverkauft',
  'abgeschrieben',
  'rausgenommen',
  'sold_out',
  'disposed',
]));

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function mhdSlaItemQuantity(item = {}) {
  const qty = Number(item?.menge ?? item?.qty ?? item?.quantity ?? 0);
  return Number.isFinite(qty) ? qty : 0;
}

export function isMhdSlaActiveItem(item = {}) {
  if (mhdSlaItemQuantity(item) <= 0) return false;
  if (item.archived === true) return false;
  if (item.active === false) return false;
  if (item.soldOut === true) return false;
  const status = String(item.status || '').trim().toLowerCase();
  return !MHD_SLA_INACTIVE_STATUSES.has(status);
}

export function normalizeMhdSlaIsoDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const de = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (de) {
    return `${de[3]}-${de[2].padStart(2, '0')}-${de[1].padStart(2, '0')}`;
  }
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) return '';
  const date = new Date(parsed);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Kalendertage zwischen MHD und Bezugstag (beide YYYY-MM-DD). */
export function computeMhdSlaResttage(mhdDateValue, todayIso) {
  const mhdIso = normalizeMhdSlaIsoDate(mhdDateValue);
  const today = normalizeMhdSlaIsoDate(todayIso);
  if (!mhdIso || !today) return null;
  const [my, mm, md] = mhdIso.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  const mhdUtc = Date.UTC(my, mm - 1, md);
  const todayUtc = Date.UTC(ty, tm - 1, td);
  return Math.round((mhdUtc - todayUtc) / 86400000);
}

export function resolveMhdSlaResttage(item = {}, todayIso, getResttage) {
  if (typeof getResttage === 'function') {
    const fromCb = getResttage(item);
    if (Number.isFinite(fromCb)) return fromCb;
  }
  const explicit = item.mhd || item.mhdDate || item.mhdText || '';
  const computed = computeMhdSlaResttage(explicit, todayIso);
  if (Number.isFinite(computed)) return computed;
  const raw = Number(item.tage ?? item.resttage);
  return Number.isFinite(raw) ? raw : Number.POSITIVE_INFINITY;
}

export function resolveMhdSlaLastCheckedDate(item = {}) {
  return String(item.lastCheckedDate || item.lastMhdCheckDate || '').trim();
}

export function isMhdSlaCheckedOnDate(item = {}, todayIso) {
  const checked = resolveMhdSlaLastCheckedDate(item);
  const today = normalizeMhdSlaIsoDate(todayIso);
  return Boolean(checked) && checked === today;
}

/**
 * @param {object} item
 * @param {{ todayIso: string, criticalMaxResttage?: number, getResttage?: Function }} options
 */
export function isMhdSlaCriticalOpen(item = {}, options = {}) {
  const todayIso = options.todayIso;
  if (!todayIso) return false;
  if (!isMhdSlaActiveItem(item)) return false;
  if (isMhdSlaCheckedOnDate(item, todayIso)) return false;
  const maxRest = Number.isFinite(Number(options.criticalMaxResttage))
    ? Number(options.criticalMaxResttage)
    : MHD_SLA_DEFAULT_CRITICAL_MAX_RESTTAGE;
  const resttage = resolveMhdSlaResttage(item, todayIso, options.getResttage);
  if (!Number.isFinite(resttage)) return false;
  return resttage <= maxRest;
}

/**
 * @param {object[]} items
 * @param {{ todayIso: string, criticalMaxResttage?: number, getResttage?: Function, resolveEffective?: Function }} options
 */
export function countMhdSlaCriticalOpen(items = [], options = {}) {
  const list = Array.isArray(items) ? items : [];
  const resolveEffective = typeof options.resolveEffective === 'function'
    ? options.resolveEffective
    : (item) => item;
  let count = 0;
  for (const raw of list) {
    const item = resolveEffective(raw) || raw;
    if (isMhdSlaCriticalOpen(item, options)) count += 1;
  }
  return count;
}

export function formatMhdSlaBannerText(count) {
  const n = Math.max(0, Number(count) || 0);
  if (n <= 0) return '';
  if (n === 1) return '1 kritisches MHD heute noch offen – antippen zum Prüfen';
  return `${n} kritische MHDs heute noch offen – antippen zum Prüfen`;
}

export function updateMhdSlaBadge(count = 0) {
  const tab = document.getElementById('tab-mhd');
  if (!tab) return;
  let badge = tab.querySelector('.nav-unread-badge[data-mhd-sla-badge]');
  const n = Math.max(0, Number(count) || 0);
  if (n > 0) {
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'nav-unread-badge';
      badge.dataset.mhdSlaBadge = '1';
      tab.appendChild(badge);
    }
    badge.textContent = String(n);
    badge.setAttribute('aria-label', `${n} kritische MHDs heute noch offen`);
  } else if (badge) {
    badge.remove();
  }
  tab.classList.toggle('has-mhd-sla-alert', n > 0);
  const label = n > 0 ? `MHD, ${n} kritisch offen` : 'MHD';
  tab.setAttribute('aria-label', label);
}

export function updateMhdSlaBanner(count = 0, { onOpen } = {}) {
  const banner = document.getElementById('mhd-sla-banner');
  if (!banner) return;
  const n = Math.max(0, Number(count) || 0);
  if (n <= 0) {
    banner.hidden = true;
    banner.classList.add('hidden');
    banner.textContent = '';
    return;
  }
  banner.hidden = false;
  banner.classList.remove('hidden');
  banner.innerHTML = `<strong>${escapeHtml(String(n))}</strong> ${escapeHtml(
    n === 1
      ? 'kritisches MHD heute noch offen – antippen zum Prüfen'
      : 'kritische MHDs heute noch offen – antippen zum Prüfen',
  )}`;
  if (typeof onOpen === 'function' && banner.dataset.mhdSlaBound !== '1') {
    banner.dataset.mhdSlaBound = '1';
    banner.addEventListener('click', (event) => {
      event.preventDefault();
      onOpen();
    });
  }
}

/**
 * Aktualisiert Badge + Banner aus der aktuellen MHD-Liste.
 * @param {object[]} products
 * @param {{ todayIso: string, getResttage?: Function, resolveEffective?: Function, onOpen?: Function, criticalMaxResttage?: number }} options
 */
export function refreshMhdSlaUi(products, options = {}) {
  const count = countMhdSlaCriticalOpen(products, options);
  updateMhdSlaBadge(count);
  updateMhdSlaBanner(count, { onOpen: options.onOpen });
  return count;
}
