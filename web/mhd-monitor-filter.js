/**
 * MHD-Monitor: Prüfgruppen-Filter und Sortierung (reine Logik, ohne DOM/State).
 * Allgemeine Ansicht „alle“ = 0–7 Tage, sortiert MoPro → Kühlware → Trockenware.
 */

export const MHD_MONITOR_ALL_HORIZON_DAYS = 7;

export const MHD_MONITOR_CATEGORY_HORIZON_DAYS = Object.freeze({
  alle: MHD_MONITOR_ALL_HORIZON_DAYS,
  mopro: 2,
  kuehlware: 2,
  trockenware: 30,
});

export const MHD_MONITOR_GROUP_LABELS = Object.freeze({
  alle: 'Alle (7 Tage)',
  mopro: '🥛 MoPro',
  kuehlware: '❄️ Kühlware',
  trockenware: '📦 Trockenware',
});

/** Sortierreihenfolge in der allgemeinen Ansicht (niedriger = weiter oben). */
export const MHD_MONITOR_GROUP_SORT_ORDER = Object.freeze({
  mopro: 0,
  kuehlware: 1,
  trockenware: 2,
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
    value: 'kuehlware',
    label: MHD_MONITOR_GROUP_LABELS.kuehlware,
    horizonDays: MHD_MONITOR_CATEGORY_HORIZON_DAYS.kuehlware,
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
 * Stammdaten-Dialog nutzt zwei grobe Eimer: gekühlt (MoPro/Kühlware) vs. Trockenware.
 * @param {'mopro'|'kuehlware'|'trockenware'|string} monitorGroup
 * @returns {'mopro'|'trockenware'}
 */
export function getMhdStammdatenBucket(monitorGroup) {
  return monitorGroup === 'trockenware' ? 'trockenware' : 'mopro';
}

/**
 * @param {string} categoryFilter
 * @param {'mopro'|'kuehlware'|'trockenware'} monitorGroup
 * @returns {number}
 */
export function getMhdMonitorHorizonDays(categoryFilter, monitorGroup) {
  const filter = resolveMhdCategoryFilter(categoryFilter);
  if (filter === 'alle') return MHD_MONITOR_CATEGORY_HORIZON_DAYS.alle;
  if (Object.prototype.hasOwnProperty.call(MHD_MONITOR_CATEGORY_HORIZON_DAYS, filter)) {
    return MHD_MONITOR_CATEGORY_HORIZON_DAYS[filter];
  }
  return MHD_MONITOR_CATEGORY_HORIZON_DAYS[monitorGroup]
    ?? MHD_MONITOR_CATEGORY_HORIZON_DAYS.trockenware;
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
 * Sortierung für die allgemeine Ansicht: MoPro → Kühlware → Trockenware;
 * innerhalb der Gruppe nach Resttagen aufsteigend.
 *
 * @template T
 * @param {T[]} products
 * @param {{
 *   categoryFilter?: string,
 *   getResttage: (prod: T) => number,
 *   getMonitorGroup: (prod: T) => 'mopro'|'kuehlware'|'trockenware',
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
    const orderA = MHD_MONITOR_GROUP_SORT_ORDER[groupA] ?? 99;
    const orderB = MHD_MONITOR_GROUP_SORT_ORDER[groupB] ?? 99;
    if (orderA !== orderB) return orderA - orderB;
    return getResttage(a) - getResttage(b);
  });
}

/**
 * @param {number} resttage
 * @param {string} categoryFilter
 * @param {'mopro'|'kuehlware'|'trockenware'} monitorGroup
 */
export function matchesMhdMonitorHorizonDays(resttage, categoryFilter, monitorGroup) {
  if (!Number.isFinite(resttage)) return false;
  return resttage <= getMhdMonitorHorizonDays(categoryFilter, monitorGroup);
}
