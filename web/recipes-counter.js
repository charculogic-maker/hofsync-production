/**
 * Theken-Auskunft — Kundenberatung zu Allergenen & Zutaten (LMIV).
 * Schlanke Nachschlage-Ansicht, getrennt vom Produktions-/Kutter-Rechner.
 */
import { getGlobalTenantId, getTenantCollection, normalizeTenantId } from './tenant-db.js';

export const COUNTER_CACHE_KEY_BASE = 'charculogic.cachedCounterRecipes';

export const COUNTER_QUICK_FILTERS = [
  { id: 'all', label: 'Alle' },
  { id: 'glutenfrei', label: '🌾 Glutenfrei', tags: ['glutenfrei'] },
  { id: 'laktosefrei', label: '🥛 Laktosefrei', tags: ['laktosefrei'] },
  { id: 'rind', label: '🥩 Rind', tags: ['rind'] },
  { id: 'schwein', label: '🐷 Schwein', tags: ['schwein'] },
  { id: 'feinkost', label: '🥗 Feinkost', tags: ['feinkost'] },
];

/** StevesHof Fallback — kundenkonforme Deklaration, keine Gewürzgrammatur. */
export const STEVESHOF_COUNTER_FALLBACK = [
  {
    id: 'counter-hausmacher-leberwurst',
    name: 'Hausmacher Leberwurst',
    verkehrsbezeichnung: 'Gutsleberwurst fein',
    category: 'Kochwurst',
    tags: ['rind', 'schwein'],
    allergens: ['SENF', 'SELLERIE'],
    glutenFree: true,
    lactoseFree: true,
    ingredientsDeclaration:
      'Schweinefleisch*, Rinderleber*, Speck*, Wasser, Speisesalz, Zwiebeln*, Gewürze (enthält Senf, Sellerie), Dextrose. *aus ökologischer Landwirtschaft',
    meatContent: 'mind. 70 %',
    storageTemp: 'Gekühlt lagern bei max. +7 °C',
    consumptionNotes: 'Nach dem Öffnen zügig verbrauchen. Darm nicht essbar.',
  },
  {
    id: 'counter-blutwurst',
    name: 'Blutwurst',
    verkehrsbezeichnung: 'Blutwurst hausgemacht',
    category: 'Kochwurst',
    tags: ['schwein'],
    allergens: [],
    glutenFree: true,
    lactoseFree: true,
    ingredientsDeclaration:
      'Schweinespeck*, Schweineblut*, Schwarten*, Wasser, Speisesalz, Zwiebeln*, Gewürze, Dextrose. *aus ökologischer Landwirtschaft',
    meatContent: 'mind. 55 %',
    storageTemp: 'Gekühlt lagern bei max. +7 °C',
    consumptionNotes: 'Warm verzehrbar. Darm nicht essbar.',
  },
  {
    id: 'counter-fleischsalat',
    name: 'Fleischsalat',
    verkehrsbezeichnung: 'Fleischsalat mit Mayonnaise',
    category: 'Feinkost',
    tags: ['feinkost', 'schwein'],
    allergens: ['EI', 'SENF'],
    glutenFree: true,
    lactoseFree: true,
    ingredientsDeclaration:
      'Fleischwurst (Schweinefleisch*, Wasser, Speisesalz, Gewürze), Mayonnaise (Rapsöl*, Eigelb*, Senf*, Essig, Speisesalz), Gurken*, Zwiebeln*. *aus ökologischer Landwirtschaft',
    meatContent: 'mind. 30 %',
    storageTemp: 'Gekühlt lagern bei max. +7 °C',
    consumptionNotes: 'Nach dem Öffnen am selben Tag verbrauchen.',
  },
  {
    id: 'counter-galloway-bratwurst',
    name: 'Galloway-Bratwurst',
    verkehrsbezeichnung: 'Frische Bratwurst vom Galloway',
    category: 'Bratwurst',
    tags: ['rind', 'glutenfrei', 'laktosefrei'],
    allergens: [],
    glutenFree: true,
    lactoseFree: true,
    ingredientsDeclaration:
      'Rindfleisch* (Galloway), Speck*, Wasser, Speisesalz, Gewürze, Dextrose. *aus ökologischer Landwirtschaft',
    meatContent: 'mind. 85 %',
    storageTemp: 'Gekühlt lagern bei max. +4 °C',
    consumptionNotes: 'Vor dem Verzehr durcherhitzen. Darm nicht essbar.',
  },
  {
    id: 'counter-rinder-salami',
    name: 'Rinder-Salami',
    verkehrsbezeichnung: 'Salami vom Rind',
    category: 'Rohwurst',
    tags: ['rind', 'glutenfrei', 'laktosefrei'],
    allergens: [],
    glutenFree: true,
    lactoseFree: true,
    ingredientsDeclaration:
      'Rindfleisch*, Schweinespeck*, Speisesalz, Gewürze, Dextrose, Starterkulturen, Konservierungsstoff: Natriumnitrit. *aus ökologischer Landwirtschaft',
    meatContent: 'mind. 90 %',
    storageTemp: 'Kühl und trocken lagern',
    consumptionNotes: 'Essfertig. Haut/Darm vor dem Verzehr entfernen, sofern nicht essbar gekennzeichnet.',
  },
];

const state = {
  initialized: false,
  items: [],
  query: '',
  filterId: 'all',
  selectedId: null,
  source: 'fallback',
  loading: false,
};

function cacheKeyForTenant(tenantId) {
  const id = normalizeTenantId(tenantId || getGlobalTenantId() || 'default') || 'default';
  return `${COUNTER_CACHE_KEY_BASE}.${id}`;
}

export function normalizeCounterQuery(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function escapeCounterHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function counterAllergensOf(item) {
  const list = Array.isArray(item?.allergens)
    ? item.allergens
    : Array.isArray(item?.allergene)
      ? item.allergene
      : [];
  return Array.from(
    new Set(
      list
        .map((entry) => String(entry || '').trim().toUpperCase())
        .filter(Boolean),
    ),
  );
}

export function isCounterAllergenFree(item) {
  return counterAllergensOf(item).length === 0;
}

export function counterTagsOf(item) {
  const tags = new Set(
    (Array.isArray(item?.tags) ? item.tags : [])
      .map((tag) => normalizeCounterQuery(tag))
      .filter(Boolean),
  );
  if (item?.glutenFree || item?.glutenfrei) tags.add('glutenfrei');
  if (item?.lactoseFree || item?.laktosefrei) tags.add('laktosefrei');
  const hay = normalizeCounterQuery([
    item?.name,
    item?.verkehrsbezeichnung,
    item?.category,
    item?.kat,
    ...(Array.isArray(item?.tags) ? item.tags : []),
  ].join(' '));
  if (/\brind|galloway\b/.test(hay)) tags.add('rind');
  if (/\bschwein|pork\b/.test(hay)) tags.add('schwein');
  if (/\bfeinkost|salat|mayonnaise\b/.test(hay)) tags.add('feinkost');
  if (/\bglutenfrei\b/.test(hay)) tags.add('glutenfrei');
  if (/\blaktosefrei\b/.test(hay)) tags.add('laktosefrei');
  return Array.from(tags);
}

export function normalizeCounterItem(raw, fallbackId = '') {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || raw.sku || fallbackId || '').trim();
  if (!id) return null;

  const name = String(raw.name || raw.produkt || raw.Produkt || raw.title || '').trim();
  if (!name) return null;

  const allergens = counterAllergensOf(raw);
  const declaration = String(
    raw.ingredientsDeclaration
    || raw.zutatenDeklaration
    || raw.zutatenliste
    || raw.ingredientsText
    || '',
  ).trim();

  let ingredientsDeclaration = declaration;
  if (!ingredientsDeclaration && Array.isArray(raw.ingredients) && raw.ingredients.length) {
    // Kundenkonform: nur Namen, keine Prozent-/Grammangaben aus der Produktion.
    ingredientsDeclaration = raw.ingredients
      .map((ing) => String(ing?.name || ing?.Name || ing?.zutat || '').trim())
      .filter(Boolean)
      .join(', ');
  }

  const explicitTags = counterTagsOf(raw);
  const glutenFree = Boolean(
    raw.glutenFree
    || raw.glutenfrei
    || explicitTags.includes('glutenfrei'),
  ) && !allergens.some((a) => a.includes('GLUTEN') || a.includes('WEIZEN'));
  const lactoseFree = Boolean(
    raw.lactoseFree
    || raw.laktosefrei
    || explicitTags.includes('laktosefrei'),
  ) && !allergens.some((a) => a.includes('MILCH') || a.includes('LAKTOSE'));

  const item = {
    id,
    name,
    verkehrsbezeichnung: String(
      raw.verkehrsbezeichnung || raw.Verkehrsbezeichnung || raw.legalName || name,
    ).trim(),
    category: String(raw.category || raw.kat || raw.Kategorie || 'Sonstiges').trim(),
    tags: [],
    allergens,
    glutenFree,
    lactoseFree,
    ingredientsDeclaration: ingredientsDeclaration || 'Zutatenliste folgt – bitte Etikett prüfen.',
    meatContent: String(raw.meatContent || raw.fleischanteil || raw.Fleischanteil || '').trim(),
    storageTemp: String(
      raw.storageTemp || raw.lagerung || raw.haltbar || raw.Lagerung || '',
    ).trim(),
    consumptionNotes: String(
      raw.consumptionNotes || raw.verzehrhinweis || raw.hinweis || raw.Hinweis || '',
    ).trim(),
  };
  item.tags = counterTagsOf({ ...item, tags: raw.tags, glutenFree, lactoseFree });
  return item;
}

export function getStevesHofFallbackCatalog() {
  return STEVESHOF_COUNTER_FALLBACK.map((entry) => normalizeCounterItem(entry)).filter(Boolean);
}

export function readCachedCounterRecipes(tenantId, storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem?.(cacheKeyForTenant(tenantId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed?.items)
      ? parsed.items.map((entry, index) => normalizeCounterItem(entry, `cached-${index}`)).filter(Boolean)
      : [];
    if (!items.length) return null;
    return { items, savedAt: parsed.savedAt || null, source: parsed.source || 'cache' };
  } catch (err) {
    console.error('[CharcuLogic Theken-Auskunft] Cache lesen fehlgeschlagen:', err);
    return null;
  }
}

export function writeCachedCounterRecipes(tenantId, items, source = 'firestore', storage = globalThis.localStorage) {
  try {
    const payload = {
      savedAt: new Date().toISOString(),
      source,
      items: Array.isArray(items) ? items : [],
    };
    storage?.setItem?.(cacheKeyForTenant(tenantId), JSON.stringify(payload));
    return true;
  } catch (err) {
    console.error('[CharcuLogic Theken-Auskunft] Cache schreiben fehlgeschlagen:', err);
    return false;
  }
}

function mapFirestoreDoc(doc) {
  const data = typeof doc?.data === 'function' ? doc.data() : (doc || {});
  return normalizeCounterItem({ ...data, id: doc?.id || data?.id }, doc?.id);
}

async function fetchCollectionSafe(collectionName) {
  try {
    const snap = await getTenantCollection(collectionName).limit(200).get();
    return snap.docs.map(mapFirestoreDoc).filter(Boolean);
  } catch (err) {
    console.error(`[CharcuLogic Theken-Auskunft] ${collectionName} laden fehlgeschlagen:`, err);
    return null;
  }
}

/**
 * Lädt Katalog: Firestore (recipes → products → rezepte) → Cache → StevesHof-Fallback.
 */
export async function loadCounterRecipesCatalog(options = {}) {
  const tenantId = options.tenantId || getGlobalTenantId() || '';
  const preferFallback = options.forceFallback === true;

  if (!preferFallback) {
    const collections = ['recipes', 'products', 'rezepte'];
    for (const name of collections) {
      const loaded = await fetchCollectionSafe(name);
      if (loaded && loaded.length) {
        writeCachedCounterRecipes(tenantId, loaded, `firestore:${name}`);
        return { items: loaded, source: `firestore:${name}` };
      }
    }
  }

  const cached = readCachedCounterRecipes(tenantId);
  if (cached?.items?.length) {
    return { items: cached.items, source: 'cache' };
  }

  const fallback = getStevesHofFallbackCatalog();
  writeCachedCounterRecipes(tenantId, fallback, 'fallback');
  return { items: fallback, source: 'fallback' };
}

export function counterSearchHaystack(item) {
  return normalizeCounterQuery([
    item?.name,
    item?.verkehrsbezeichnung,
    item?.category,
    item?.ingredientsDeclaration,
    item?.meatContent,
    item?.storageTemp,
    item?.consumptionNotes,
    counterAllergensOf(item).join(' '),
    counterTagsOf(item).join(' '),
    isCounterAllergenFree(item) ? 'allergenfrei frei von allergenen' : '',
  ].join(' '));
}

export function matchesCounterRecipe(item, query, filterId = 'all') {
  if (!item) return false;
  const filter = COUNTER_QUICK_FILTERS.find((entry) => entry.id === filterId) || COUNTER_QUICK_FILTERS[0];
  if (filter?.tags?.length) {
    const tags = new Set(counterTagsOf(item));
    const ok = filter.tags.every((tag) => tags.has(tag));
    if (!ok) return false;
  }
  const needle = normalizeCounterQuery(query);
  if (!needle) return true;
  return counterSearchHaystack(item).includes(needle);
}

export function filterCounterRecipes(items, query, filterId = 'all') {
  return (Array.isArray(items) ? items : []).filter((item) => matchesCounterRecipe(item, query, filterId));
}

/** LMIV: Allergene in der Zutatenliste fett + unterstrichen hervorheben. */
export function highlightAllergensInDeclaration(declaration, allergens) {
  const text = escapeCounterHtml(declaration || '');
  const labels = (allergens || [])
    .map((label) => String(label || '').trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  if (!labels.length) return text;

  const pattern = new RegExp(
    `(${labels.map((label) => escapeCounterHtml(label).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
    'gi',
  );
  return text.replace(pattern, '<strong class="counter-allergen-mark"><u>$1</u></strong>');
}

function renderAllergenBadges(item) {
  const allergens = counterAllergensOf(item);
  if (!allergens.length) {
    return '<span class="counter-allergen-badge counter-allergen-badge--free">Frei von Allergenen</span>';
  }
  return allergens
    .map((label) => `<span class="counter-allergen-badge">${escapeCounterHtml(label)}</span>`)
    .join('');
}

export function renderCounterResultCardHtml(item) {
  const id = escapeCounterHtml(item.id);
  const name = escapeCounterHtml(item.name);
  const category = escapeCounterHtml(item.category || 'Sonstiges');
  return `
    <button type="button" class="counter-recipe-card" data-counter-id="${id}" aria-label="${name} öffnen">
      <span class="counter-recipe-card-main">
        <span class="counter-recipe-name">${name}</span>
        <span class="counter-recipe-category">${category}</span>
      </span>
      <span class="counter-recipe-badges" aria-label="Allergene">${renderAllergenBadges(item)}</span>
    </button>
  `;
}

export function renderCounterDetailHtml(item) {
  const allergens = counterAllergensOf(item);
  const allergenBox = allergens.length
    ? `<div class="counter-allergen-box" role="status">
         <p class="counter-allergen-box-label">Enthält</p>
         <p class="counter-allergen-box-values">${escapeCounterHtml(allergens.join(', '))}</p>
         <p class="counter-allergen-box-hint">Angaben gemäß LMIV (EU) Nr. 1169/2011</p>
       </div>`
    : `<div class="counter-allergen-box counter-allergen-box--free" role="status">
         <p class="counter-allergen-box-values">Frei von den 14 Hauptallergenen</p>
         <p class="counter-allergen-box-hint">Keine deklarationspflichtigen Allergene laut Rezeptur</p>
       </div>`;

  const extras = [
    item.meatContent ? `<li><strong>Fleischanteil:</strong> ${escapeCounterHtml(item.meatContent)}</li>` : '',
    item.storageTemp ? `<li><strong>Lagerung:</strong> ${escapeCounterHtml(item.storageTemp)}</li>` : '',
    item.consumptionNotes ? `<li><strong>Verzehr:</strong> ${escapeCounterHtml(item.consumptionNotes)}</li>` : '',
  ].filter(Boolean).join('');

  return `
    <div class="counter-detail-body">
      <p class="counter-detail-kicker">${escapeCounterHtml(item.category || '')}</p>
      <h3 class="counter-detail-title" id="counter-recipe-detail-title">${escapeCounterHtml(item.name)}</h3>
      <p class="counter-detail-legal">${escapeCounterHtml(item.verkehrsbezeichnung || item.name)}</p>
      ${allergenBox}
      <section class="counter-ingredients-block" aria-label="Zutatenliste">
        <h4 class="counter-section-heading">Zutatenliste</h4>
        <p class="counter-ingredients-text">${highlightAllergensInDeclaration(item.ingredientsDeclaration, allergens)}</p>
      </section>
      ${extras ? `<ul class="counter-extra-list">${extras}</ul>` : ''}
    </div>
  `;
}

function getEls() {
  return {
    root: document.getElementById('counter-recipes-shell'),
    search: document.getElementById('counter-recipes-search'),
    clear: document.getElementById('counter-recipes-clear'),
    filters: document.getElementById('counter-recipes-filters'),
    list: document.getElementById('counter-recipes-list'),
    empty: document.getElementById('counter-recipes-empty'),
    status: document.getElementById('counter-recipes-status'),
    count: document.getElementById('counter-recipes-count'),
    backdrop: document.getElementById('counter-recipe-backdrop'),
    sheet: document.getElementById('counter-recipe-detail-sheet'),
    detail: document.getElementById('counter-recipe-detail'),
    closeBtn: document.getElementById('counter-recipe-detail-close'),
  };
}

function syncSearchUi() {
  const { search, clear } = getEls();
  if (search && search.value !== state.query) search.value = state.query;
  if (clear) clear.hidden = !String(state.query || '').trim();
}

function syncFilterChips() {
  const { filters } = getEls();
  if (!filters) return;
  filters.querySelectorAll('[data-counter-filter]').forEach((chip) => {
    const active = chip.getAttribute('data-counter-filter') === state.filterId;
    chip.classList.toggle('active-category', active);
    chip.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function updateStatus() {
  const { status, count } = getEls();
  const total = state.items.length;
  const visible = filterCounterRecipes(state.items, state.query, state.filterId).length;
  if (count) count.textContent = `${visible} von ${total}`;
  if (!status) return;
  if (state.loading) {
    status.textContent = 'Katalog wird geladen…';
    return;
  }
  const sourceLabel = {
    fallback: 'Offline-Fallback StevesHof',
    cache: 'Zwischengespeicherter Katalog',
  }[state.source] || (String(state.source).startsWith('firestore') ? 'Aktueller Katalog' : 'Katalog');
  status.textContent = sourceLabel;
}

export function renderCounterRecipesList() {
  const { list, empty } = getEls();
  if (!list) return;
  const matches = filterCounterRecipes(state.items, state.query, state.filterId);
  list.innerHTML = matches.map(renderCounterResultCardHtml).join('');
  if (empty) empty.hidden = matches.length > 0;
  syncSearchUi();
  syncFilterChips();
  updateStatus();
}

function openDetail(item) {
  const { backdrop, sheet, detail } = getEls();
  if (!sheet || !detail || !item) return;
  state.selectedId = item.id;
  detail.innerHTML = renderCounterDetailHtml(item);
  backdrop?.classList.remove('hidden');
  if (backdrop) backdrop.hidden = false;
  sheet.classList.remove('hidden', 'closed');
  sheet.hidden = false;
  sheet.setAttribute('aria-hidden', 'false');
}

function closeDetail() {
  const { backdrop, sheet } = getEls();
  state.selectedId = null;
  sheet?.classList.add('closed');
  window.setTimeout(() => {
    sheet?.classList.add('hidden');
    if (sheet) {
      sheet.hidden = true;
      sheet.setAttribute('aria-hidden', 'true');
    }
    backdrop?.classList.add('hidden');
    if (backdrop) backdrop.hidden = true;
  }, 180);
}

function bindEvents() {
  const { search, clear, filters, list, backdrop, closeBtn } = getEls();

  search?.addEventListener('input', () => {
    state.query = search.value || '';
    renderCounterRecipesList();
  });

  clear?.addEventListener('click', () => {
    state.query = '';
    renderCounterRecipesList();
    search?.focus();
  });

  filters?.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-counter-filter]');
    if (!chip) return;
    state.filterId = chip.getAttribute('data-counter-filter') || 'all';
    renderCounterRecipesList();
  });

  list?.addEventListener('click', (event) => {
    const card = event.target.closest('[data-counter-id]');
    if (!card) return;
    const id = card.getAttribute('data-counter-id');
    const item = state.items.find((entry) => entry.id === id);
    if (item) openDetail(item);
  });

  closeBtn?.addEventListener('click', closeDetail);
  backdrop?.addEventListener('click', closeDetail);
}

async function refreshCatalog() {
  state.loading = true;
  updateStatus();
  try {
    const result = await loadCounterRecipesCatalog();
    state.items = result.items;
    state.source = result.source;
  } catch (err) {
    console.error('[CharcuLogic Theken-Auskunft] Katalogfehler:', err);
    state.items = getStevesHofFallbackCatalog();
    state.source = 'fallback';
  } finally {
    state.loading = false;
    renderCounterRecipesList();
  }
}

export function initCounterRecipesModule() {
  if (state.initialized) return;
  const { root } = getEls();
  if (!root) return;
  state.initialized = true;

  // Sofort Fallback zeigen, dann Hintergrund-Refresh.
  const cached = readCachedCounterRecipes(getGlobalTenantId());
  state.items = cached?.items?.length ? cached.items : getStevesHofFallbackCatalog();
  state.source = cached?.items?.length ? 'cache' : 'fallback';
  bindEvents();
  renderCounterRecipesList();
  refreshCatalog();
}

export function activateCounterRecipesTab() {
  if (!state.initialized) {
    initCounterRecipesModule();
    return;
  }
  renderCounterRecipesList();
  refreshCatalog();
}

export function getCounterRecipesState() {
  return {
    items: state.items.slice(),
    query: state.query,
    filterId: state.filterId,
    source: state.source,
    selectedId: state.selectedId,
  };
}
