/**
 * MHD-Monitor: Prüfgruppen-Filter und Sortierung (reine Logik, ohne DOM/State).
 * Allgemeine Ansicht „alle“ = 0–7 Tage, sortiert MoPro/Kühlware → Trockenware.
 */

export const MHD_MONITOR_ALL_HORIZON_DAYS = 7;

export const MHD_MONITOR_CATEGORY_HORIZON_DAYS = Object.freeze({
  alle: MHD_MONITOR_ALL_HORIZON_DAYS,
  mopro: 2,
  trockenware: 30,
});

export const MHD_MONITOR_GROUP_LABELS = Object.freeze({
  alle: 'Alle (7 Tage)',
  mopro: '🥛 MoPro & Kühlware',
  trockenware: '📦 Trockenware',
});

export const MHD_CATEGORY_FILTER_OPTIONS = Object.freeze([
  {
    value: 'alle',
    label: MHD_MONITOR_GROUP_LABELS.alle,
    horizonDays: MHD_MONITOR_CATEGORY_HORIZON_DAYS.alle,
  },
  {
    value: 'mopro',
    label: MHD_MONITOR_GROUP_LABELS.mopro,
    horizonDays: MHD_MONITOR_CATEGORY_HORIZON_DAYS.mopro,
  },
  {
    value: 'trockenware',
    label: MHD_MONITOR_GROUP_LABELS.trockenware,
    horizonDays: MHD_MONITOR_CATEGORY_HORIZON_DAYS.trockenware,
  },
]);

export function resolveMhdCategoryFilter(filterKey = 'alle') {
  return MHD_CATEGORY_FILTER_OPTIONS.some((option) => option.value === filterKey)
    ? filterKey
    : 'alle';
}

export function getMhdCategoryFilterLabel(filterKey = 'alle') {
  const resolved = resolveMhdCategoryFilter(filterKey);
  const option = MHD_CATEGORY_FILTER_OPTIONS.find((entry) => entry.value === resolved);
  return option?.label || MHD_MONITOR_GROUP_LABELS.alle;
}

/**
 * @param {string} categoryFilter
 * @param {'mopro'|'trockenware'} monitorGroup
 * @returns {number}
 */
export function getMhdMonitorHorizonDays(categoryFilter, monitorGroup) {
  const filter = resolveMhdCategoryFilter(categoryFilter);
  if (filter === 'alle') return MHD_MONITOR_CATEGORY_HORIZON_DAYS.alle;
  if (monitorGroup === 'mopro') return MHD_MONITOR_CATEGORY_HORIZON_DAYS.mopro;
  return MHD_MONITOR_CATEGORY_HORIZON_DAYS.trockenware;
}

/**
 * @param {string} monitorGroup
 * @param {string} categoryFilter
 */
export function matchesMhdMonitorGroupFilter(monitorGroup, categoryFilter) {
  const filter = resolveMhdCategoryFilter(categoryFilter);
  if (filter === 'alle') return true;
  return monitorGroup === filter;
}

/**
 * Sortierung für die allgemeine Ansicht: MoPro/Kühlware zuerst, dann Trockenware;
 * innerhalb der Gruppe nach Resttagen aufsteigend.
 *
 * @template T
 * @param {T[]} products
 * @param {{
 *   categoryFilter?: string,
 *   getResttage: (prod: T) => number,
 *   getMonitorGroup: (prod: T) => 'mopro'|'trockenware',
 * }} options
 * @returns {T[]}
 */
export function sortMhdProductsForMonitor(products, {
  categoryFilter = 'alle',
  getResttage,
  getMonitorGroup,
}) {
  const filter = resolveMhdCategoryFilter(categoryFilter);
  const list = [...products];
  if (filter !== 'alle') {
    return list.sort((a, b) => getResttage(a) - getResttage(b));
  }
  return list.sort((a, b) => {
    const groupA = getMonitorGroup(a);
    const groupB = getMonitorGroup(b);
    if (groupA !== groupB) {
      return groupA === 'mopro' ? -1 : 1;
    }
    return getResttage(a) - getResttage(b);
  });
}

/**
 * @param {number} resttage
 * @param {string} categoryFilter
 * @param {'mopro'|'trockenware'} monitorGroup
 */
export function matchesMhdMonitorHorizonDays(resttage, categoryFilter, monitorGroup) {
  if (!Number.isFinite(resttage)) return false;
  return resttage <= getMhdMonitorHorizonDays(categoryFilter, monitorGroup);
}
