// Wurstkueche-, Rezept- und Chargen-Modul

import {
  getGlobalTenantId,
  getTenantCollection,
  getTenantCollectionPath,
} from './tenant-db.js';
import {
  DEFAULT_MACHINE_PARK,
  MACHINE_BATCH_PROFILES,
  STANDARD_BATCH_PROFILE_ID,
  buildProductionDatasheetData,
  formatDeNumber,
  formatPercent,
  getMachineBatchProfile,
  openProductionDatasheetPrint,
} from './production-datasheet.js';
import { generateIngredientDeclaration } from './domain-core.js';
import { flushPendingSyncs } from './sync.js';
import {
  THEKE_QUICK_FILTERS,
  bratwurstRecipes,
  isThekeMobileViewport,
  matchesThekeRecipe,
  normalizeThekeQuery,
  recipeCategoryLabel,
  recipeSearchHaystack,
  renderCompactRecipeCardHtml,
  renderThekeRecipeCardHtml,
} from './rezepte.js';

const EIGENPRODUKTION_SUPPLIER = 'Eigenproduktion';
const EIGENPRODUKTION_SOURCE = 'eigenproduktion';

const productionState = {
  db: null,
  tenantId: '',
  recipes: [],
  recipeSearchQuery: '',
  recipeQuickFilterId: '',
  recipeCategoryFilter: 'all',
  kitchenProductionMode: false,
  selectedRecipeId: null,
  activeRecipeDetail: null,
  activeRecipeDataSource: 'local',
  productionTargetKg: 10.0,
  productionBatches: [],
  batchSearchQuery: '',
  recipeCloudAudit: null,
  activeTab: 'kitchen',
  recipesUnsubscribe: null,
  productionBatchesUnsubscribe: null,
  writeOrQueueFirestore: async () => { throw new Error('Production Sync-Engine ist nicht initialisiert.'); },
  playClickSound: () => {},
  showHUD: () => {},
  getFirebase: () => null,
  onFormSaved: () => {},
  restoreDraftFields: () => 0,
  initialized: false,
  batchDocumentInFlight: false,
  getAuditActorName: () => '',
  machineProfileId: STANDARD_BATCH_PROFILE_ID,
  datasheet: null,
};

function shouldUseBratwurstMasterlist() {
  return window.BRANDING?.modules?.bratwurstMasterlist === true;
}

function isProductionAdmin() {
  return document.documentElement?.dataset?.userRole === 'admin';
}

function mhdListeCollectionPath() {
  try {
    return getTenantCollectionPath('mhd_liste');
  } catch {
    return null;
  }
}

function formatIsoDateLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDaysToToday(days) {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  base.setDate(base.getDate() + days);
  return base;
}

function slugRecipeIdFromName(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return '';
  const slug = trimmed
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9ÄÖÜäöüß\-]+/g, '')
    .slice(0, 80);
  return getSafeFirestoreId(slug || trimmed);
}

function getFirebase() { return productionState.getFirebase?.() || null; }
function isFirebaseReady() { return Boolean(productionState.db && getFirebase()); }
function requireProductionTenantId() {
  const tenantId = getGlobalTenantId() || String(productionState.tenantId || '').trim();
  if (!tenantId) {
    console.error('[CharcuLogic Firebase] Production-Modul ohne Mandanten-ID initialisiert.');
    return null;
  }
  return tenantId;
}
function productionBatchesCollectionPath() {
  try {
    return getTenantCollectionPath('produktion_chargen');
  } catch {
    return null;
  }
}
function rezepteCollectionPath() {
  try {
    return getTenantCollectionPath('rezepte');
  } catch {
    return null;
  }
}
function rezepteCollectionRef() {
  if (!productionState.db) return null;
  try {
    return getTenantCollection('rezepte');
  } catch {
    return null;
  }
}
function serverTimestampFallback() {
  const firebaseInstance = getFirebase();
  return firebaseInstance?.firestore?.FieldValue?.serverTimestamp
    ? firebaseInstance.firestore.FieldValue.serverTimestamp()
    : new Date().toISOString();
}


function recipeLookupKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function getSafeFirestoreId(id) {
  return String(id || '')
    .replace(/\//g, '-')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const localRecipeIndex = new Map(bratwurstRecipes.map((recipe) => [String(recipe.id), recipe]));
const localRecipeLookup = new Map();
bratwurstRecipes.forEach((recipe) => {
  localRecipeIndex.set(getSafeFirestoreId(recipe.id), recipe);
  localRecipeLookup.set(recipeLookupKey(recipe.id), recipe);
  localRecipeLookup.set(recipeLookupKey(getSafeFirestoreId(recipe.id)), recipe);
  localRecipeLookup.set(recipeLookupKey(recipe.name), recipe);
});

function recipeIdsMatch(a, b) {
  if (a == null || b == null) return false;
  return String(a) === String(b)
    || getSafeFirestoreId(a) === getSafeFirestoreId(b)
    || recipeLookupKey(a) === recipeLookupKey(b);
}

function findLocalRecipe(recipe, fallbackId = '') {
  if (!shouldUseBratwurstMasterlist()) return null;
  return localRecipeIndex.get(String(recipe?.id))
    || localRecipeIndex.get(String(fallbackId))
    || localRecipeLookup.get(recipeLookupKey(recipe?.id))
    || localRecipeLookup.get(recipeLookupKey(recipe?.name))
    || localRecipeLookup.get(recipeLookupKey(fallbackId))
    || bratwurstRecipes.find((entry) => recipeIdsMatch(entry.id, recipe?.id) || recipeIdsMatch(entry.id, fallbackId))
    || null;
}

function ingredientsFromBratwurstSeed(recipeId) {
  if (!shouldUseBratwurstMasterlist()) return [];
  if (recipeId == null || recipeId === '') return [];
  const seedRecipe = bratwurstRecipes.find((entry) => recipeIdsMatch(entry.id, recipeId));
  if (seedRecipe?.ingredients?.length) {
    return seedRecipe.ingredients;
  }
  const localRecipe = findLocalRecipe({ id: recipeId }, recipeId);
  return Array.isArray(localRecipe?.ingredients) ? localRecipe.ingredients : [];
}

function ensureRecipeIngredients(recipe, recipeId = recipe?.id) {
  if (!recipe) return null;

  let ingredients = recipe.ingredients;
  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    const fallbackIngredients = ingredientsFromBratwurstSeed(recipeId || recipe.id);
    if (fallbackIngredients.length) {
      console.warn('[CharcuLogic Wurstküche] Cloud ohne Zutaten – Fallback aus bratwurstRecipes:', recipeId || recipe.id);
      ingredients = fallbackIngredients;
    } else {
      ingredients = [];
    }
  }

  return { ...recipe, ingredients };
}

function recipesForKitchenList() {
  const recipesById = new Map();

  if (shouldUseBratwurstMasterlist()) {
    bratwurstRecipes.forEach((recipe) => {
      recipesById.set(String(recipe.id), ensureRecipeIngredients(recipe, recipe.id));
    });
  }

  productionState.recipes.forEach((cloudRecipe) => {
    const localRecipe = findLocalRecipe(cloudRecipe, cloudRecipe.id || cloudRecipe.docId);
    const mergedId = String(localRecipe?.id || cloudRecipe.id || cloudRecipe.docId);
    const mergedRecipe = localRecipe
      ? {
          ...localRecipe,
          ...cloudRecipe,
          id: mergedId,
          ingredients: localRecipe.ingredients?.length
            ? localRecipe.ingredients
            : cloudRecipe.ingredients,
        }
      : cloudRecipe;

    recipesById.set(mergedId, ensureRecipeIngredients(mergedRecipe, mergedId));
  });

  return Array.from(recipesById.values()).filter(Boolean);
}

function getRecipeWithLocalFallback(recipeId) {
  const cloudRecipe = productionState.recipes.find(
    (recipe) => recipeIdsMatch(recipe.id, recipeId) || recipeIdsMatch(recipe.docId, recipeId)
  );
  const localRecipe = findLocalRecipe(cloudRecipe, recipeId);

  if (!cloudRecipe) {
    return ensureRecipeIngredients(localRecipe, recipeId);
  }

  const merged = localRecipe
    ? { ...localRecipe, ...cloudRecipe, ingredients: localRecipe.ingredients ?? cloudRecipe.ingredients }
    : cloudRecipe;

  return ensureRecipeIngredients(merged, recipeId);
}

function normalizeRecipeDoc(doc) {
  const cloudRecipe = { docId: doc.id, id: doc.id, ...doc.data() };
  const localRecipe = findLocalRecipe(cloudRecipe, doc.id);
  if (!localRecipe) {
    return ensureRecipeIngredients(cloudRecipe, doc.id);
  }
  return ensureRecipeIngredients({
    ...localRecipe,
    ...cloudRecipe,
    ingredients: localRecipe.ingredients?.length
      ? localRecipe.ingredients
      : cloudRecipe.ingredients,
  }, doc.id);
}


async function importBratwurstRecipesToCloud() {
  if (!shouldUseBratwurstMasterlist()) {
    console.warn('[CharcuLogic Firebase] Rezept-Seed nur für Mandanten mit Bratwurst-Masterliste.');
    return;
  }

  const tenantId = requireProductionTenantId();

  if (!tenantId) {
    console.error('[CharcuLogic Firebase] importBratwurstRecipesToCloud(): Seed abgebrochen - productionState.tenantId fehlt.');
    return;
  }

  if (!isFirebaseReady() || !productionState.db) {
    console.error('[CharcuLogic Firebase] importBratwurstRecipesToCloud(): Firebase nicht initialisiert.');
    return;
  }

  validateBratwurstMasterlist();

  try {
    const collectionRef = rezepteCollectionRef();
    if (!collectionRef) {
      console.error('[CharcuLogic Firebase] importBratwurstRecipesToCloud(): Keine gültige Rezept-Collection.');
      return;
    }

    let successCount = 0;
    let failureCount = 0;

    for (const recipe of bratwurstRecipes) {
      const docId = String(recipe.id);
      const safeId = getSafeFirestoreId(docId);
      const recipePayload = {
        ...recipe,
        id: docId,
        firestoreId: safeId,
        ingredients: Array.isArray(recipe.ingredients) ? [...recipe.ingredients] : [],
      };

      try {
        await collectionRef.doc(safeId).set(recipePayload);
        successCount += 1;
      } catch (error) {
        failureCount += 1;
        console.warn('[CharcuLogic Firebase] Rezept-Seed fehlgeschlagen:', recipe.id, error.message);
      }
    }

    console.info(`[CharcuLogic Firebase] ${successCount} Rezepte erfolgreich im Firestore validiert.${failureCount ? ` Blockiert: ${failureCount}.` : ''}`);
  } catch (error) {
    console.error('[CharcuLogic Firebase] Rezept-Seed blockiert:', error.message);
  }
}

function mapRecipeDoc(doc) {
  return normalizeRecipeDoc(doc);
}

function loadRecipesFromCloud() {
  if (!isFirebaseReady() || !productionState.db) {
    console.error('[CharcuLogic Firebase] loadRecipesFromCloud(): Firebase nicht initialisiert.');
    return;
  }
  const collectionRef = rezepteCollectionRef();
  if (!collectionRef) {
    console.error('[CharcuLogic Firebase] loadRecipesFromCloud(): Keine gültige Rezept-Collection – Tenant prüfen.');
    return;
  }
  if (productionState.recipesUnsubscribe) {
    productionState.recipesUnsubscribe();
    productionState.recipesUnsubscribe = null;
  }
  productionState.recipesUnsubscribe = collectionRef.onSnapshot(
    (snapshot) => {
      productionState.recipes = snapshot.docs.map(mapRecipeDoc);
      validateCloudRecipesAgainstMasterlist(productionState.recipes);
      if (productionState.activeTab === 'kitchen') {
        renderRecipes();
      } else if (productionState.activeTab === 'batches') {
        renderRecipeCloudAudit();
      }
    },
    (err) => {
      console.error('[CharcuLogic Firebase] Rezept Live-Sync Fehler:', err);
    }
  );
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function mapProductionBatchDoc(doc) {
  const data = doc.data() || {};
  return {
    ...data,
    id: doc.id,
    chargenNummer: data.chargenNummer || doc.id,
  };
}

function formatBatchTimestamp(value) {
  if (!value) return 'Noch ohne Serverzeit';
  const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Noch ohne Serverzeit';
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function filteredProductionBatches() {
  const query = productionState.batchSearchQuery.trim().toLowerCase();
  const batches = Array.isArray(productionState.productionBatches) ? productionState.productionBatches : [];
  if (!query) return batches;
  return batches.filter((batch) => {
    const haystack = `${batch.chargenNummer || ''} ${batch.rezeptName || ''} ${batch.macher || ''} ${batch.abweichungen || ''}`.toLowerCase();
    return haystack.includes(query);
  });
}

function renderProductionBatches() {
  const container = document.getElementById('batch-list-container');
  if (!container) return;

  const visibleBatches = filteredProductionBatches();
  if (!visibleBatches.length) {
    container.innerHTML = `
      <div class="batch-empty-hint">
        ${productionState.productionBatches.length ? 'Keine Charge für diese Suche gefunden.' : 'Noch keine Produktionscharge dokumentiert.'}
      </div>`;
    return;
  }

  container.innerHTML = visibleBatches.map((batch) => {
    const deviations = String(batch.abweichungen || '').trim();
    const ingredientCount = Array.isArray(batch.zutatenBerechnet) ? batch.zutatenBerechnet.length : 0;
    const labelStatus = batch.etikettBasis?.status || 'vorbereitet';
    const unitTotal = batch.verkaufsEinheiten?.gesamt ?? batch.etikettBasis?.etikettenAnzahl ?? '-';
    return `
      <article class="batch-card">
        <div class="batch-card-title">${escapeHtml(batch.rezeptName || 'Unbekanntes Rezept')}</div>
        <div class="recipe-subinfo">${escapeHtml(batch.chargenNummer)} · ${escapeHtml(formatBatchTimestamp(batch.zeitstempel))}</div>
        <div class="batch-card-meta">
          <div>
            <span class="batch-card-label">Menge</span>
            <span class="batch-card-value">${escapeHtml(batch.produktionsmengeKg ?? '-')} kg</span>
          </div>
          <div>
            <span class="batch-card-label">Macher</span>
            <span class="batch-card-value">${escapeHtml(batch.macher || '-')}</span>
          </div>
          <div>
            <span class="batch-card-label">pH / Kern</span>
            <span class="batch-card-value">${escapeHtml(batch.phWert ?? '-')} / ${escapeHtml(batch.kerntemperatur ?? '-')} °C</span>
          </div>
          <div>
            <span class="batch-card-label">Etikettenbasis</span>
            <span class="batch-card-value">${escapeHtml(labelStatus)} · ${ingredientCount} Zutaten</span>
          </div>
          <div>
            <span class="batch-card-label">Verkaufseinheiten</span>
            <span class="batch-card-value">${escapeHtml(unitTotal)}</span>
          </div>
        </div>
        ${deviations ? `<div class="batch-card-deviation">Abweichungen: ${escapeHtml(deviations)}</div>` : ''}
      </article>
    `;
  }).join('');
}

function initBatchArchiveSearch() {
  const searchInput = document.getElementById('batch-search-input');
  if (!searchInput || searchInput.dataset.eventsBound === '1') return;
  searchInput.dataset.eventsBound = '1';
  searchInput.addEventListener('input', (event) => {
    productionState.batchSearchQuery = event.target.value || '';
    renderProductionBatches();
  });
}

function loadProductionBatchesFromCloud() {
  if (!isFirebaseReady() || !productionState.db) {
    console.error('[CharcuLogic Firebase] loadProductionBatchesFromCloud(): Firebase nicht initialisiert.');
    return;
  }

  const collectionPath = productionBatchesCollectionPath();
  if (!collectionPath) {
    console.error('[CharcuLogic Firebase] loadProductionBatchesFromCloud(): Kein gültiger Chargen-Pfad.');
    return;
  }

  if (productionState.productionBatchesUnsubscribe) {
    productionState.productionBatchesUnsubscribe();
    productionState.productionBatchesUnsubscribe = null;
  }

  productionState.productionBatchesUnsubscribe = productionState.db.collection(collectionPath)
    .orderBy('zeitstempel', 'desc')
    .limit(50)
    .onSnapshot(
      (snapshot) => {
        productionState.productionBatches = snapshot.docs.map(mapProductionBatchDoc);
        if (productionState.activeTab === 'batches') {
          renderProductionBatches();
        }
      },
      (err) => {
        console.error('[CharcuLogic Firebase] Chargen Live-Sync Fehler:', err);
      }
    );
}


// --- SCREEN 2: WURSTKUECHE LOGIC ---
function setRecipeDetailText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value || '';
}

function populateRecipeDetailView(recipe) {
  if (!recipe) return;

  setRecipeDetailText('detail-recipe-title', recipe.name);
  setRecipeDetailText('detail-recipe-warning', recipe.hinweis);
  setRecipeDetailText('recipe-phase-a-text', recipe.anweisung_A);
  setRecipeDetailText('recipe-phase-b-text', recipe.anweisung_B);
  setRecipeDetailText('recipe-phase-c-text', recipe.anweisung_C);
  setRecipeDetailText('recipe-phase-d-text', recipe.anweisung_D);
  setRecipeDetailText('recipe-meister-tipp-text', recipe.tipp);
  setRecipeDetailText('recipe-haltbarkeit-text', recipe.haltbar);

  const tippRow = document.getElementById('recipe-meister-tipp');
  if (tippRow) tippRow.hidden = !recipe.tipp;

  const haltbarRow = document.getElementById('recipe-haltbarkeit');
  if (haltbarRow) haltbarRow.hidden = !recipe.haltbar;
}

function recipeCategoryOf(recipe) {
  return recipeCategoryLabel(recipe);
}

function recipeSearchText(recipe) {
  return recipeSearchHaystack(recipe);
}

function activeRecipeQuickFilter() {
  return THEKE_QUICK_FILTERS.find((entry) => entry.id === productionState.recipeQuickFilterId) || null;
}

function syncRecipeSearchUi() {
  const searchInput = document.getElementById('recipe-search-input');
  const clearBtn = document.getElementById('recipe-search-clear');
  if (searchInput && searchInput.value !== productionState.recipeSearchQuery) {
    searchInput.value = productionState.recipeSearchQuery;
  }
  if (clearBtn) {
    clearBtn.hidden = !String(productionState.recipeSearchQuery || '').trim()
      && !productionState.recipeQuickFilterId;
  }
  document.querySelectorAll('.recipe-quick-chip').forEach((chip) => {
    const id = chip.getAttribute('data-recipe-quick') || '';
    const active = id && id === productionState.recipeQuickFilterId;
    chip.classList.toggle('active-category', active);
    chip.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function applyRecipeSearch(query, { keepQuickFilter = false } = {}) {
  productionState.recipeSearchQuery = query || '';
  if (!keepQuickFilter) {
    const quick = activeRecipeQuickFilter();
    if (quick && !quick.allergenFree) {
      const expected = normalizeThekeQuery(quick.query);
      if (normalizeThekeQuery(productionState.recipeSearchQuery) !== expected) {
        productionState.recipeQuickFilterId = '';
      }
    } else if (quick?.allergenFree && productionState.recipeSearchQuery.trim()) {
      productionState.recipeQuickFilterId = '';
    }
  }
  renderRecipes();
}

function clearRecipeSearch() {
  productionState.recipeSearchQuery = '';
  productionState.recipeQuickFilterId = '';
  applyRecipeSearch('', { keepQuickFilter: true });
  document.getElementById('recipe-search-input')?.focus();
}

function syncKitchenProductionModeUi() {
  const page = document.getElementById('page-kitchen');
  const toggle = document.getElementById('btn-kitchen-production-mode');
  const mobileTheke = isThekeMobileViewport();
  const showProduction = !mobileTheke || productionState.kitchenProductionMode;

  if (page) {
    page.classList.toggle('kitchen-theke-mode', mobileTheke && !productionState.kitchenProductionMode);
    page.classList.toggle('kitchen-show-production', showProduction);
  }
  document.body.classList.toggle('kitchen-theke-mobile', mobileTheke && !productionState.kitchenProductionMode);

  if (toggle) {
    toggle.setAttribute('aria-pressed', productionState.kitchenProductionMode ? 'true' : 'false');
    toggle.textContent = productionState.kitchenProductionMode
      ? 'Produktions-Modus ausblenden'
      : 'Produktions-Modus einblenden';
  }

  const wrsPanel = document.getElementById('kitchen-wrs-panel');
  if (wrsPanel && mobileTheke && !productionState.kitchenProductionMode) {
    wrsPanel.open = false;
  }
}

function initKitchenProductionModeToggle() {
  const toggle = document.getElementById('btn-kitchen-production-mode');
  if (toggle && toggle.dataset.eventsBound !== '1') {
    toggle.dataset.eventsBound = '1';
    toggle.addEventListener('click', () => {
      productionState.kitchenProductionMode = !productionState.kitchenProductionMode;
      syncKitchenProductionModeUi();
      renderRecipes();
      productionState.playClickSound?.(800, 0.04, 0.12);
    });
  }

  if (typeof window !== 'undefined' && window.__kitchenThekeViewportBound !== '1') {
    window.__kitchenThekeViewportBound = '1';
    try {
      const media = window.matchMedia('(max-width: 768px)');
      const onChange = () => {
        if (!isThekeMobileViewport()) {
          productionState.kitchenProductionMode = false;
        }
        syncKitchenProductionModeUi();
        renderRecipes();
      };
      if (typeof media.addEventListener === 'function') media.addEventListener('change', onChange);
      else if (typeof media.addListener === 'function') media.addListener(onChange);
    } catch (_) {
      /* ignore */
    }
  }

  syncKitchenProductionModeUi();
}

function renderRecipeCategoryFilters(recipes) {
  const filter = document.getElementById('recipe-category-filter');
  if (!filter) return;

  const categories = Array.from(new Set(recipes.map(recipeCategoryOf))).sort((a, b) => a.localeCompare(b, 'de'));
  const buttons = [
    { id: 'all', label: `Alle (${recipes.length})` },
    ...categories.map((category) => ({
      id: category,
      label: `${category} (${recipes.filter((recipe) => recipeCategoryOf(recipe) === category).length})`,
    })),
  ];
  const activeButton = buttons.find((button) => button.id === productionState.recipeCategoryFilter) || buttons[0];
  const filterLabel = document.getElementById('recipe-category-filter-label');
  if (filterLabel) filterLabel.textContent = activeButton?.label || 'Alle Kategorien';

  filter.innerHTML = buttons.map((button) => `
    <button type="button" class="recipe-category-chip ${productionState.recipeCategoryFilter === button.id ? 'active-category' : ''}" data-category="${button.id}">
      ${button.label}
    </button>
  `).join('');
}

function filteredRecipesForKitchen(recipes) {
  const query = productionState.recipeSearchQuery;
  const category = productionState.recipeCategoryFilter;
  const quick = activeRecipeQuickFilter();
  return recipes.filter((recipe) => {
    const categoryMatches = category === 'all' || recipeCategoryOf(recipe) === category;
    const queryMatches = matchesThekeRecipe(recipe, query, quick);
    return categoryMatches && queryMatches;
  });
}

function initRecipeSearchAndFilters() {
  const searchInput = document.getElementById('recipe-search-input');
  const clearBtn = document.getElementById('recipe-search-clear');
  const quickFilter = document.getElementById('recipe-quick-filter');
  const categoryFilter = document.getElementById('recipe-category-filter');
  const categoryButton = document.getElementById('recipe-category-filter-button');
  const categorySheet = document.getElementById('recipe-category-sheet');
  const categoryBackdrop = document.getElementById('recipe-category-backdrop');
  const categoryClose = document.getElementById('recipe-category-sheet-close');

  const closeCategorySheet = () => {
    if (!categorySheet || !categoryBackdrop || !categoryButton) return;
    categorySheet.classList.add('hidden');
    categoryBackdrop.classList.add('hidden');
    categorySheet.hidden = true;
    categoryBackdrop.hidden = true;
    categoryButton.setAttribute('aria-expanded', 'false');
  };

  const openCategorySheet = () => {
    if (!categorySheet || !categoryBackdrop || !categoryButton) return;
    categorySheet.hidden = false;
    categoryBackdrop.hidden = false;
    categorySheet.classList.remove('hidden', 'closed');
    categoryBackdrop.classList.remove('hidden');
    categoryButton.setAttribute('aria-expanded', 'true');
  };

  if (searchInput && searchInput.dataset.eventsBound !== '1') {
    searchInput.dataset.eventsBound = '1';
    searchInput.addEventListener('input', (event) => {
      applyRecipeSearch(event.target.value || '');
    });
  }

  if (clearBtn && clearBtn.dataset.eventsBound !== '1') {
    clearBtn.dataset.eventsBound = '1';
    clearBtn.addEventListener('click', () => {
      clearRecipeSearch();
    });
  }

  if (quickFilter && quickFilter.dataset.eventsBound !== '1') {
    quickFilter.dataset.eventsBound = '1';
    quickFilter.addEventListener('click', (event) => {
      const chip = event.target.closest('.recipe-quick-chip');
      if (!chip) return;
      const id = chip.getAttribute('data-recipe-quick') || '';
      const next = THEKE_QUICK_FILTERS.find((entry) => entry.id === id);
      if (!next) return;
      if (productionState.recipeQuickFilterId === next.id) {
        clearRecipeSearch();
        return;
      }
      productionState.recipeQuickFilterId = next.id;
      productionState.recipeSearchQuery = next.allergenFree ? '' : (next.query || '');
      applyRecipeSearch(productionState.recipeSearchQuery, { keepQuickFilter: true });
      searchInput?.focus();
    });
  }

  if (categoryButton && categoryButton.dataset.eventsBound !== '1') {
    categoryButton.dataset.eventsBound = '1';
    categoryButton.addEventListener('click', openCategorySheet);
  }

  if (categoryBackdrop && categoryBackdrop.dataset.eventsBound !== '1') {
    categoryBackdrop.dataset.eventsBound = '1';
    categoryBackdrop.addEventListener('click', closeCategorySheet);
  }

  if (categoryClose && categoryClose.dataset.eventsBound !== '1') {
    categoryClose.dataset.eventsBound = '1';
    categoryClose.addEventListener('click', closeCategorySheet);
  }

  if (categoryFilter && categoryFilter.dataset.eventsBound !== '1') {
    categoryFilter.dataset.eventsBound = '1';
    categoryFilter.addEventListener('click', (event) => {
      const button = event.target.closest('.recipe-category-chip');
      if (!button) return;
      productionState.recipeCategoryFilter = button.dataset.category || 'all';
      renderRecipes();
      closeCategorySheet();
    });
  }

  initKitchenProductionModeToggle();
}

function renderRecipes() {
  const container = document.getElementById('recipe-list-container');
  if (!container) return;
  initRecipeSearchAndFilters();
  syncKitchenProductionModeUi();

  const recipes = recipesForKitchenList();
  syncRecipeSearchUi();
  renderRecipeCategoryFilters(recipes);
  const visibleRecipes = filteredRecipesForKitchen(recipes);
  const thekeCards = isThekeMobileViewport() && !productionState.kitchenProductionMode;

  if (!recipes.length) {
    const emptyHint = shouldUseBratwurstMasterlist()
      ? (isFirebaseReady() ? 'Keine Rezepte in der Cloud. Seed läuft?' : 'Firebase nicht konfiguriert – Rezepte können nicht geladen werden.')
      : (isProductionAdmin()
        ? 'Noch keine Rezepte. Als Admin unten „Neues Rezept anlegen“ nutzen.'
        : 'Noch keine Rezepte hinterlegt. Bitte einen Admin bitten, Rezepte anzulegen.');
    container.innerHTML = `
      <div class="recipe-empty-hint" style="text-align:center;padding:32px 16px;color:#666;">
        ${emptyHint}
      </div>`;
    return;
  }

  if (!visibleRecipes.length) {
    container.innerHTML = `
      <div class="recipe-empty-hint" style="text-align:center;padding:32px 16px;color:#666;">
        Keine Rezepte für diese Suche/Kategorie gefunden.
      </div>`;
    return;
  }

  container.innerHTML = visibleRecipes.map((recipe) => {
    const selected = recipeIdsMatch(productionState.selectedRecipeId, recipe.id);
    return thekeCards
      ? renderThekeRecipeCardHtml(recipe, { selected })
      : renderCompactRecipeCardHtml(recipe, { selected });
  }).join('');
}
function resolveActiveRecipeForDetail(recipeId) {
  const resolvedId = String(recipeId);
  let recipe = getRecipeWithLocalFallback(resolvedId);
  if (!recipe) return null;

  if (shouldUseBratwurstMasterlist() && (!recipe.ingredients || recipe.ingredients.length === 0)) {
    const seedRecipe = bratwurstRecipes.find((entry) => recipeIdsMatch(entry.id, resolvedId));
    if (seedRecipe?.ingredients?.length) {
      recipe = { ...recipe, ingredients: [...seedRecipe.ingredients] };
    }
  }

  return ensureRecipeIngredients(recipe, resolvedId);
}

function closeRecipeDetailPanel() {
  const panel = document.getElementById('recipe-detail-panel');
  if (!panel) return;
  panel.classList.remove('active');
  panel.style.display = '';
}

function initRecipeDetailPanelEvents() {
  const panel = document.getElementById('recipe-detail-panel');
  if (!panel || panel.dataset.eventsBound === '1') return;
  panel.dataset.eventsBound = '1';

  panel.addEventListener('click', (event) => {
    if (event.target.closest('#btn-recipe-back')) {
      productionState.playClickSound(700, 0.05, 0.15);
      closeRecipeDetailPanel();
    }
  });
}

function openRecipeDetail(recipeId) {
  initRecipeDetailPanelEvents();

  productionState.selectedRecipeId = String(recipeId);

  const recipe = resolveActiveRecipeForDetail(productionState.selectedRecipeId);
  if (recipe) {
    productionState.activeRecipeDetail = recipe;
    populateRecipeDetailView(recipe);
    productionState.playClickSound(1000, 0.06, 0.15);
  }

  const panel = document.getElementById('recipe-detail-panel');
  if (panel) {
    panel.classList.add('active');
    panel.style.display = 'flex';
  }

  calculateIngredients();
};

// Zutaten-Berechnung
const inputProdTarget = document.getElementById('production-target');
const btnProdMinus = document.getElementById('btn-prod-minus');
const btnProdPlus = document.getElementById('btn-prod-plus');

function roundToButcherPrecision(gramm) {
  if (!Number.isFinite(gramm)) return 0;
  if (gramm >= 1000) return Math.round(gramm / 50) * 50;
  if (gramm >= 100) return Math.round(gramm / 5) * 5;
  return Math.round(gramm);
}

function formatButcherAmount(gramm) {
  if (!Number.isFinite(gramm)) return '0 g';
  if (gramm >= 1000) {
    const kg = gramm / 1000;
    return Number(kg.toFixed(2)).toString().replace('.', ',') + ' kg';
  }
  return Math.round(gramm).toString() + ' g';
}

function ingredientNameOf(ing) {
  return ing?.name
    || ing?.Name
    || ing?.zutat
    || ing?.Zutat
    || ing?.produkt
    || ing?.Produkt
    || ing?.Producto
    || ing?.ingredient
    || ing?.Ingredient
    || ing?.label
    || ing?.Label
    || 'Unbekannte Zutat';
}

function ingredientPctOf(ing) {
  const raw = ing?.pct
    ?? ing?.Pct
    ?? ing?.Prozent
    ?? ing?.prozent
    ?? ing?.percent
    ?? ing?.Percent
    ?? ing?.Prozentwert
    ?? ing?.anteil
    ?? ing?.Anteil
    ?? ing?.['Anteil %']
    ?? ing?.['Anteil%'];
  if (raw === undefined || raw === null || raw === '') return NaN;
  const normalized = String(raw).replace('%', '').replace(',', '.').trim();
  const pct = parseFloat(normalized);
  return Number.isFinite(pct) ? pct : NaN;
}

function renderableIngredientCount(recipe) {
  const rows = Array.isArray(recipe?.ingredients) ? recipe.ingredients : [];
  return rows.filter((ing) => ingredientNameOf(ing) && Number.isFinite(ingredientPctOf(ing))).length;
}

function validateBratwurstMasterlist() {
  const invalidRecipes = bratwurstRecipes
    .map((recipe) => ({
      id: recipe?.id,
      name: recipe?.name,
      ingredientCount: Array.isArray(recipe?.ingredients) ? recipe.ingredients.length : 0,
      renderableCount: renderableIngredientCount(recipe),
    }))
    .filter((recipe) => !recipe.id || !recipe.name || recipe.ingredientCount === 0 || recipe.renderableCount !== recipe.ingredientCount);

  if (invalidRecipes.length) {
    console.error('[CharcuLogic Wurstküche] MASTERLISTE UNVOLLSTÄNDIG:', invalidRecipes);
    return false;
  }

  console.info(`[CharcuLogic Wurstkueche] ${bratwurstRecipes.length} Rezepte lokal validiert.`);
  return true;
}

function isRezeptAuditEnabled() {
  return window.BRANDING?.modules?.rezeptAudit !== false;
}

function validateCloudRecipesAgainstMasterlist(cloudRecipes = productionState.recipes) {
  if (!shouldUseBratwurstMasterlist() || !isRezeptAuditEnabled()) return null;

  const missing = [];
  const incomplete = [];
  const cloudCount = Array.isArray(cloudRecipes) ? cloudRecipes.length : 0;

  bratwurstRecipes.forEach((localRecipe) => {
    const cloudRecipe = cloudRecipes.find((entry) =>
      recipeIdsMatch(entry.id, localRecipe.id) || recipeIdsMatch(entry.docId, localRecipe.id) || recipeIdsMatch(entry.firestoreId, localRecipe.id)
    );
    const localCount = renderableIngredientCount(localRecipe);
    const cloudRenderable = renderableIngredientCount(cloudRecipe);

    if (!cloudRecipe) {
      missing.push(localRecipe.id);
    } else if (cloudRenderable < localCount) {
      incomplete.push({
        id: localRecipe.id,
        cloud: cloudRenderable,
        master: localCount,
      });
    }
  });

  const audit = {
    masterCount: bratwurstRecipes.length,
    cloudCount,
    missing,
    incomplete,
    ok: missing.length === 0 && incomplete.length === 0 && cloudCount >= bratwurstRecipes.length,
  };
  productionState.recipeCloudAudit = audit;
  renderRecipeCloudAudit();
  return audit;
}

function renderRecipeCloudAudit() {
  const card = document.getElementById('recipe-cloud-audit-card');
  if (!isRezeptAuditEnabled() || card?.hidden) return;

  const masterEl = document.getElementById('audit-master-count');
  const cloudEl = document.getElementById('audit-cloud-count');
  const statusEl = document.getElementById('audit-cloud-status');
  const detailEl = document.getElementById('audit-cloud-detail');
  if (!masterEl || !cloudEl || !statusEl || !detailEl) return;

  const audit = productionState.recipeCloudAudit;
  if (!audit) {
    masterEl.textContent = String(bratwurstRecipes.length);
    cloudEl.textContent = '-';
    statusEl.textContent = 'Warte auf Daten';
    detailEl.textContent = 'Die Rezeptdaten werden automatisch geprüft, sobald Firestore antwortet.';
    return;
  }

  masterEl.textContent = String(audit.masterCount);
  cloudEl.textContent = String(audit.cloudCount);
  statusEl.textContent = audit.ok ? 'Vollständig' : 'Prüfen';
  statusEl.style.color = audit.ok ? '#1B5E20' : '#B71C1C';

  if (audit.ok) {
    detailEl.textContent = 'Alle Master-Rezepte sind in der Cloud vorhanden und besitzen vollständige Zutatenlisten.';
    return;
  }

  const missingText = audit.missing.length ? `Fehlt: ${audit.missing.slice(0, 4).join(', ')}${audit.missing.length > 4 ? ' ...' : ''}.` : '';
  const incompleteText = audit.incomplete.length ? `Unvollständig: ${audit.incomplete.map((item) => `${item.id} (${item.cloud}/${item.master})`).slice(0, 3).join(', ')}${audit.incomplete.length > 3 ? ' ...' : ''}.` : '';
  detailEl.textContent = `${missingText} ${incompleteText}`.trim() || 'Cloud-Bestand weicht von der Masterliste ab.';
}

function updateRecipeDataSourceBadge(source) {
  const badge = document.getElementById('recipe-data-source-badge');
  if (!badge) return;

  const isCloud = source === 'cloud';
  badge.textContent = isCloud ? '🟢 Live-Cloud' : '🟡 Lokaler Speicher (Sicherheitsgurt)';
  badge.style.background = isCloud ? '#E8F5E9' : '#FFF8E1';
  badge.style.color = isCloud ? '#1B5E20' : '#8A5A00';
  badge.style.border = isCloud ? '1px solid #A5D6A7' : '1px solid #FFE082';
}

const LMIV_ALLERGEN_LABEL = {
  gluten: 'Gluten',
  crustaceans: 'Krebstiere',
  eggs: 'Eier',
  fish: 'Fisch',
  peanuts: 'Erdnüsse',
  soy: 'Soja',
  milk: 'Milch',
  nuts: 'Schalenfrüchte',
  celery: 'Sellerie',
  mustard: 'Senf',
  sesame: 'Sesam',
  sulphites: 'Sulfite',
  lupin: 'Lupinen',
  molluscs: 'Weichtiere',
};

const LMIV_ALLERGEN_RULES = [
  ['sulphites', /sulfit|sulfite|schwefel|rotwein|wei[sß]wein/i],
  ['mustard', /senf/i],
  ['celery', /sellerie/i],
  ['milk', /milch|laktose|sahne|k[äa]se|molke|butter/i],
  ['gluten', /gluten|weizen|roggen|gerste|dinkel/i],
  ['soy', /soja/i],
  ['eggs', /eier|eigelb|eiklar|h[üu]hnerei/i],
  ['sesame', /sesam/i],
  ['lupin', /lupine/i],
  ['peanuts', /erdn[uü]ss/i],
  ['fish', /fisch|sardelle|anchovis/i],
  ['crustaceans', /krebs|garnele|shrimp/i],
  ['molluscs', /muschel|weichtier|tintenfisch/i],
  ['nuts', /schalenfr[uü]cht|haselnuss|mandel|walnuss|pistazie|cashew/i],
];

const LMIV_ROMAN = 'VIII|VII|VI|IV|IX|V|III|II|X|I|LEBER';
const LMIV_FAT_CUTS = new Set(['S_VII', 'S_VIII', 'R_V']);

function lmivCutFromName(name) {
  const upper = String(name || '').toUpperCase();
  const compact = upper.replace(/[^A-Z0-9]/g, '');
  const lead = compact.match(new RegExp(`^([SR])(${LMIV_ROMAN})`));
  if (lead) return `${lead[1]}_${lead[2]}`;
  const beef = upper.match(new RegExp(`RIND(?:FLEISCH)?\\s*(${LMIV_ROMAN})\\b`));
  if (beef) return `R_${beef[1]}`;
  const pork = upper.match(new RegExp(`SCHWEIN(?:EFLEISCH)?\\s*(${LMIV_ROMAN})\\b`));
  if (pork) return `S_${pork[1]}`;
  return '';
}

function lmivSpecies(cutId, name) {
  if (String(cutId).startsWith('R_') || /rind/i.test(name)) return 'beef';
  if (String(cutId).startsWith('S_') || /schwein/i.test(name)) return 'pork';
  return undefined;
}

function lmivAllergenKey(name, hint) {
  const blob = `${name} ${hint || ''}`;
  const rule = LMIV_ALLERGEN_RULES.find(([, pattern]) => pattern.test(blob));
  return rule ? rule[0] : undefined;
}

function lmivComponentType(name, cutId, ing) {
  if ((cutId && LMIV_FAT_CUTS.has(cutId)) || /speck|kutterfett|fettgewebe|rinderfett/i.test(name)) return 'fat';
  if (/(^|[^a-zäöüß])(wasser|eis|brühe|bruehe)([^a-zäöüß]|$)/i.test(name)) return 'water';
  if (cutId || /^(schweinefleisch|rindfleisch)$/i.test(String(name).trim())) return 'meat';
  if (/khm|diphosphat|ascorbin|erythorbat|nitrit|glucono|citrat|\be\s*\d{3}\b/i.test(name)) return 'additive';
  if (/gew[üu]rz|spice/i.test(ing?.typ || ing?.Typ || '')) return 'spice';
  return 'other';
}

function lmivAdditiveToken(name) {
  const upper = String(name).toUpperCase();
  if (/KHM|DIPHOSPHAT/.test(upper)) return 'KHM';
  if (/ASCORBIN/.test(upper)) return 'ASCORBIN';
  if (/ERYTHORBAT/.test(upper)) return 'ERYTHORBAT';
  if (/CITRAT/.test(upper)) return 'CITRAT';
  if (/GDL|GLUCONO/.test(upper)) return 'GDL';
  return name;
}

function lmivProductType(recipe) {
  const category = String(recipe?.kat || recipe?.Kategorie || '').toLowerCase();
  if (category.includes('roh')) return 'rohwurst';
  if (category.includes('koch')) return 'kochwurst';
  return 'bruehwurst';
}

function recipeToDeclarationInput(recipe, targetKg) {
  const components = (Array.isArray(recipe?.ingredients) ? recipe.ingredients : []).flatMap((ing) => {
    const name = ingredientNameOf(ing);
    const pct = ingredientPctOf(ing);
    if (!name || !Number.isFinite(pct)) return [];
    const weightKg = targetKg * (pct / 100);
    const cutId = lmivCutFromName(name);
    const type = lmivComponentType(name, cutId, ing);
    const hint = ing?.hinweis || ing?.Hinweis || '';
    const allergenKey = lmivAllergenKey(name, hint);
    const component = {
      name: type === 'additive' ? lmivAdditiveToken(name) : name,
      weightKg,
      type,
    };
    if (cutId) component.gevoCutId = cutId;
    const species = lmivSpecies(cutId, name);
    if (species) component.species = species;
    if (allergenKey) component.allergenKey = allergenKey;
    return [component];
  });
  const dryingRaw = recipe?.dryingLossPct ?? recipe?.reifeverlustPct ?? recipe?.trocknungsverlustPct;
  const dryingLossPct = Number(dryingRaw);
  return {
    name: recipe?.name || 'Erzeugnis',
    productType: lmivProductType(recipe),
    components,
    ...(Number.isFinite(dryingLossPct) && dryingLossPct > 0 ? { dryingLossPct } : {}),
  };
}

function lmivPlainFragment(item) {
  const label = item.allergenKey ? LMIV_ALLERGEN_LABEL[item.allergenKey] : '';
  let name = item.name;
  if (item.isAllergen && label && name.toLowerCase().includes(label.toLowerCase())) {
    name = name.replace(new RegExp(label, 'i'), label.toUpperCase());
  } else if (item.isAllergen && label) {
    name = `${name} (${label.toUpperCase()})`;
  }
  if (item.additiveClass) name = `${item.additiveClass}: ${name}`;
  if (item.eNumber) name += ` (${item.eNumber})`;
  if (item.isMeat && item.percentage != null) name += ` (${item.percentage} %)`;
  if (item.subIngredients?.length) {
    name += ` (${item.subIngredients.map(lmivPlainFragment).join(', ')})`;
  }
  return name;
}

function lmivHtmlFragment(item) {
  const label = item.allergenKey ? LMIV_ALLERGEN_LABEL[item.allergenKey] : '';
  const containsLabel = label && item.name.toLowerCase().includes(label.toLowerCase());
  let nameHtml = escapeHtml(item.name);
  if (item.isAllergen && label && containsLabel) nameHtml = `<strong>${nameHtml}</strong>`;
  else if (item.isAllergen && label) nameHtml += ` (<strong>${escapeHtml(label)}</strong>)`;
  if (item.additiveClass) nameHtml = `${escapeHtml(item.additiveClass)}: ${nameHtml}`;
  if (item.eNumber) nameHtml += ` (${escapeHtml(item.eNumber)})`;
  if (item.isMeat && item.percentage != null) nameHtml += ` (${item.percentage} %)`;
  if (item.subIngredients?.length) {
    nameHtml += ` (${item.subIngredients.map(lmivHtmlFragment).join(', ')})`;
  }
  return nameHtml;
}

function ensureLmivCard() {
  const existing = document.getElementById('lmiv-declaration-card');
  if (existing) return existing;
  const anchor = document.getElementById('ingredients-card');
  if (!anchor || !document.getElementById('lmiv-declaration-style')) {
    if (!document.getElementById('lmiv-declaration-style')) {
      const style = document.createElement('style');
      style.id = 'lmiv-declaration-style';
      style.textContent = `
        #lmiv-declaration-card { margin-top: 8px; }
        #lmiv-declaration-line { font-size: 16px; line-height: 1.45; color: #1c1c1e; }
        #lmiv-declaration-quid { margin-top: 10px; font-weight: 800; color: #1b5e20; }
        #lmiv-declaration-badges { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
        .lmiv-allergen-badge { background: #b71c1c; color: #fff; border-radius: 999px; padding: 4px 10px; font-size: 13px; font-weight: 700; }
        .lmiv-declaration-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
        .lmiv-declaration-actions button { border: 0; border-radius: 10px; padding: 12px 14px; font-weight: 700; background: #2e7d32; color: #fff; }
        #lmiv-print-btn { background: #455a64; }
      `;
      document.head.appendChild(style);
    }
  }
  if (!anchor) return null;
  const title = document.createElement('div');
  title.className = 'section-title';
  title.id = 'lmiv-declaration-heading';
  title.textContent = 'LMIV-Deklaration & Kennzeichnung';
  const card = document.createElement('div');
  card.className = 'ingredients-card';
  card.id = 'lmiv-declaration-card';
  card.innerHTML = `
    <div id="lmiv-declaration-line"></div>
    <div id="lmiv-declaration-quid"></div>
    <div id="lmiv-declaration-badges"></div>
    <div class="lmiv-declaration-actions">
      <button type="button" id="lmiv-copy-btn">In die Zwischenablage kopieren</button>
      <button type="button" id="lmiv-print-btn">Druckansicht / Thekenschild</button>
    </div>
  `;
  anchor.insertAdjacentElement('afterend', card);
  anchor.insertAdjacentElement('afterend', title);
  card.querySelector('#lmiv-copy-btn')?.addEventListener('click', copyLmivDeclaration);
  card.querySelector('#lmiv-print-btn')?.addEventListener('click', printLmivDeclaration);
  return card;
}

function renderLmivDeclaration(recipe, targetKg) {
  const card = ensureLmivCard();
  if (!card) return;
  const lineEl = document.getElementById('lmiv-declaration-line');
  const quidEl = document.getElementById('lmiv-declaration-quid');
  const badgesEl = document.getElementById('lmiv-declaration-badges');
  if (!recipe || !Number.isFinite(targetKg) || targetKg <= 0) {
    productionState.lmivPlainText = '';
    if (lineEl) lineEl.textContent = 'Keine Zutaten für eine LMIV-Deklaration.';
    if (quidEl) quidEl.textContent = '';
    if (badgesEl) badgesEl.innerHTML = '';
    return;
  }
  let result;
  try {
    result = generateIngredientDeclaration(recipeToDeclarationInput(recipe, targetKg));
  } catch (error) {
    console.error('[CharcuLogic LMIV] Deklaration fehlgeschlagen:', error);
    productionState.lmivPlainText = '';
    if (lineEl) lineEl.textContent = 'Zutatenverzeichnis konnte nicht berechnet werden.';
    if (quidEl) quidEl.textContent = '';
    if (badgesEl) badgesEl.innerHTML = '';
    return;
  }
  const plainLine = `Zutaten: ${result.items.map(lmivPlainFragment).join(', ')}.`;
  const htmlLine = `Zutaten: ${result.items.map(lmivHtmlFragment).join(', ')}.`;
  const quidLines = [];
  if (result.productionStatement) quidLines.push(result.productionStatement);
  else if (result.quidMeatPct != null) quidLines.push(`Fleischanteil QUID: ${result.quidMeatPct} %`);
  const allergenLines = result.allergensPresent.map((key) => LMIV_ALLERGEN_LABEL[key] || key);
  productionState.lmivPlainText = [recipe.name || '', plainLine, ...quidLines, allergenLines.length ? `Allergene: ${allergenLines.join(', ')}` : '']
    .filter(Boolean)
    .join('\n');
  productionState.lmivProductName = recipe.name || 'Erzeugnis';
  if (lineEl) lineEl.innerHTML = htmlLine;
  if (quidEl) quidEl.textContent = quidLines.join(' ');
  if (badgesEl) {
    badgesEl.innerHTML = allergenLines.map((label) => `<span class="lmiv-allergen-badge">${escapeHtml(label)}</span>`).join('');
  }
}

async function copyLmivDeclaration() {
  const text = productionState.lmivPlainText || '';
  if (!text) {
    window.showToast?.('Keine Deklaration zum Kopieren.', 'warning');
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    window.showToast?.('Zutatenverzeichnis kopiert.', 'success');
  } catch (_) {
    const area = document.createElement('textarea');
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
    window.showToast?.('Zutatenverzeichnis kopiert.', 'success');
  }
}

function printLmivDeclaration() {
  const text = productionState.lmivPlainText || '';
  if (!text) return;
  const popup = window.open('', 'lmiv-schild', 'width=420,height=640');
  if (!popup) {
    window.showToast?.('Druckfenster wurde blockiert.', 'warning');
    return;
  }
  const title = escapeHtml(productionState.lmivProductName || 'Thekenschild');
  const body = escapeHtml(text).replace(/\n/g, '<br>');
  popup.document.write(`<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>${title}</title>
    <style>body{font-family:sans-serif;margin:24px;color:#111}h1{font-size:22px}p{font-size:16px;line-height:1.4}</style>
    </head><body><h1>${title}</h1><p>${body}</p><script>window.print()<\/script></body></html>`);
  popup.document.close();
}

function calculateIngredients() {
  const listContainer = document.getElementById('recipe-ingredients-list');
  if (!listContainer) {
    console.error('Kritisch: #recipe-ingredients-list fehlt im statischen HTML.');
    return;
  }

  if (!productionState.selectedRecipeId) {
    console.error('[CharcuLogic Wurstkueche] calculateIngredients(): Keine selectedRecipeId gesetzt.');
    return;
  }

  const cloudRecipe = productionState.recipes.find(r => recipeIdsMatch(r.id, productionState.selectedRecipeId));
  const localRecipe = shouldUseBratwurstMasterlist()
    ? bratwurstRecipes.find(r => recipeIdsMatch(r.id, productionState.selectedRecipeId))
    : null;
  const cloudRenderableCount = renderableIngredientCount(cloudRecipe);
  const localRenderableCount = renderableIngredientCount(localRecipe);
  let activeRecipe = cloudRecipe;
  let dataSource = 'cloud';

  // SKELETT-FALLE: lokale Masterliste nur, wenn das Modul bratwurstMasterlist aktiv ist.
  // Wenn Cloud fehlt oder weniger renderbare Zutaten als die Masterliste hat -> lokale Vollversion nutzen.
  if (shouldUseBratwurstMasterlist()
    && (!activeRecipe || cloudRenderableCount === 0 || localRenderableCount > cloudRenderableCount)) {
    activeRecipe = localRecipe;
    dataSource = 'local';
  }

  const ingredients = Array.isArray(activeRecipe?.ingredients) ? activeRecipe.ingredients : [];
  productionState.activeRecipeDetail = activeRecipe || productionState.activeRecipeDetail;
  productionState.activeRecipeDataSource = dataSource;
  updateRecipeDataSourceBadge(dataSource);

  listContainer.innerHTML = '';

  if (!ingredients.length) {
    listContainer.innerHTML = "<div style='color:red; padding:15px; font-weight:bold;'>&#9888;&#65039; Keine Zutaten in den Daten gefunden!</div>";
    refreshProductionDatasheetState();

    renderLmivDeclaration(null, 0);
    return;
  }

  const inputEl = document.getElementById('production-target');
  const rawInput = (inputEl?.value ?? '').toString().replace(',', '.');
  let targetKg = parseFloat(rawInput);
  if (!Number.isFinite(targetKg) || targetKg <= 0) {
    targetKg = productionState.productionTargetKg || 10;
  }
  productionState.productionTargetKg = targetKg;

  ingredients.forEach((ing) => {
    try {
      const zutatName = ingredientNameOf(ing);
      const zutatPct = ingredientPctOf(ing);
      if (!Number.isFinite(zutatPct)) return;

      const amountG = (targetKg * 1000) * (zutatPct / 100);
      const roundedG = roundToButcherPrecision(amountG);
      const amountStr = formatButcherAmount(roundedG);
      const pctText = `${zutatPct.toFixed(2).replace('.', ',')}%`;
      /* Zutatenzeile bleibt unabhängig vom Datenblatt-State. */
      const rowHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px; border-bottom: 2px solid #eee; background: #fff; font-size: 18px;">
          <div style="font-weight: bold; flex: 2; color: #333;">${zutatName}</div>
          <div style="flex: 1; text-align: center; color: #666;">${pctText}</div>
          <div style="flex: 1; text-align: right; font-weight: 900; color: #2E7D32; font-size: 20px;">${amountStr}</div>
        </div>
      `;

      listContainer.insertAdjacentHTML('beforeend', rowHTML);
    } catch (e) {
      console.error('Fehler bei Zutat:', ing, e);
    }
  });

  refreshProductionDatasheetState();

  renderLmivDeclaration(activeRecipe, targetKg);
}

function currentProductionTargetKg() {
  const inputEl = document.getElementById('production-target');
  const rawInput = (inputEl?.value ?? '').toString().replace(',', '.');
  const targetKg = parseFloat(rawInput);
  return Number.isFinite(targetKg) && targetKg > 0 ? targetKg : productionState.productionTargetKg || 10;
}

function scaledIngredientsForRecipe(recipe, targetKg) {
  const ingredients = Array.isArray(recipe?.ingredients) ? recipe.ingredients : [];
  return ingredients
    .map((ing) => {
      const pct = ingredientPctOf(ing);
      if (!Number.isFinite(pct)) return null;
      const amountG = (targetKg * 1000) * (pct / 100);
      const roundedG = roundToButcherPrecision(amountG);
      return {
        name: ingredientNameOf(ing),
        pct,
        amountG: roundedG,
        amountText: formatButcherAmount(roundedG),
        typ: ing.typ || ing.Typ || '',
        allergen: Boolean(ing.allergen || ing.Allergen),
        hinweis: ing.hinweis || ing.Hinweis || '',
      };
    })
    .filter(Boolean);
}

function generateRecipeBatchNumber(recipeId) {
  const now = new Date();
  const dateStr = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
  const cleanId = String(recipeId || 'REZEPT').replace(/[^A-Za-z0-9]+/g, '').slice(0, 8).toUpperCase() || 'REZEPT';
  const suffix = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0') + String(now.getSeconds()).padStart(2, '0');
  return `CH-${dateStr}-${cleanId}-${suffix}`;
}

function buildLabelBasis(recipe, scaledIngredients, targetKg) {
  const allergene = Array.isArray(recipe?.allergene)
    ? recipe.allergene.filter(Boolean)
    : scaledIngredients.filter((ing) => ing.allergen).map((ing) => ing.name);
  const sortedIngredients = [...scaledIngredients].sort((a, b) => (b.amountG || 0) - (a.amountG || 0));

  return {
    status: 'vorbereitet',
    druckSchnittstelle: 'Ausbaustufe 2',
    etikettenAnzahl: null,
    produktname: recipe?.name || '',
    nettoFuellmengeKg: targetKg,
    zutatenlisteVorbereitet: sortedIngredients.map((ing) => ing.name).join(', '),
    quidBasis: sortedIngredients.map((ing) => ({
      name: ing.name,
      pct: ing.pct,
      amountG: ing.amountG,
    })),
    allergene,
    preisBasis: {
      status: 'offen',
      ziel: 'Preis je Etikett/Packung in Ausbaustufe 2 berechnen',
    },
    barcodeBasis: {
      status: 'offen',
      ziel: 'Barcode-Drucker und Etikettenanzahl in Ausbaustufe 2 anbinden',
    },
  };
}

function readProductionUnits() {
  const readNumber = (id) => {
    const value = parseInt(document.getElementById(id)?.value || '0', 10);
    return Number.isFinite(value) && value > 0 ? value : 0;
  };
  const units = {
    grosskaliber: readNumber('recipe-unit-large'),
    sbPackungen: readNumber('recipe-unit-sb'),
    loseStueck: readNumber('recipe-unit-loose'),
    glaeserDosen: readNumber('recipe-unit-glass'),
    notiz: document.getElementById('recipe-unit-note')?.value.trim() || '',
  };
  units.gesamt = units.grosskaliber + units.sbPackungen + units.loseStueck + units.glaeserDosen;
  return units;
}

const PRODUCTION_FORM_FIELDS = [
  'recipe-batch-maker', 'recipe-batch-ph', 'recipe-batch-core-temp',
  'recipe-batch-deviations', 'recipe-unit-large', 'recipe-unit-sb',
  'recipe-unit-loose', 'recipe-unit-glass', 'recipe-unit-note',
];

const RECIPE_CREATE_FORM_FIELDS = [
  'recipe-create-name', 'recipe-create-category', 'recipe-create-haltbar',
  'recipe-create-mhd-days',
];

function buildMhdRecordFromProductionBatch({ recipe, batchNumber, targetKg, maker }) {
  const standardMhdTage = parseInt(recipe?.standardMhdTage, 10);
  if (!Number.isFinite(standardMhdTage) || standardMhdTage < 0) return null;

  const mhdPath = mhdListeCollectionPath();
  if (!mhdPath) return null;

  const mhdDateObj = addDaysToToday(standardMhdTage);
  const mhdDateIso = formatIsoDateLocal(mhdDateObj);
  const postenId = `${getSafeFirestoreId(batchNumber)}_${Date.now().toString(36)}`;
  const qty = Math.max(1, Math.round(targetKg) || 1);
  const actor = maker || productionState.getAuditActorName?.() || '';

  return {
    collectionPath: mhdPath,
    docId: postenId,
    onlineData: {
      id: postenId,
      postenId,
      produkt: recipe.name,
      name: recipe.name,
      marke: '',
      brand: '',
      mhd: mhdDateIso,
      mhdDate: mhdDateIso,
      mhdText: `${standardMhdTage} Resttage`,
      mhdTimestamp: mhdDateObj,
      date: mhdDateObj.toLocaleDateString('de-DE'),
      tage: standardMhdTage,
      resttage: standardMhdTage,
      status: 'aktiv',
      qty,
      menge: targetKg,
      eingangMenge: targetKg,
      mengeEinheit: 'kg',
      einheit: 'kg',
      kategorie: recipe.kat || 'Eigenproduktion',
      warenKategorie: recipe.kat || 'Eigenproduktion',
      soldOut: false,
      lot: batchNumber,
      chargenNummer: batchNumber,
      lieferant: EIGENPRODUKTION_SUPPLIER,
      source: EIGENPRODUKTION_SOURCE,
      postentyp: EIGENPRODUKTION_SOURCE,
      wareneingangAt: new Date().toISOString(),
      scannedBy: actor,
      tenantId: productionState.tenantId || getGlobalTenantId(),
      updatedAt: serverTimestampFallback(),
    },
    queueData: null,
  };
}

async function syncMhdEntryFromProductionBatch(context) {
  const mhdWrite = buildMhdRecordFromProductionBatch(context);
  if (!mhdWrite) return null;

  const queuePayload = {
    ...mhdWrite.onlineData,
    mhdTimestamp: mhdWrite.onlineData.mhdDate,
    updatedAt: new Date().toISOString(),
  };

  await productionState.writeOrQueueFirestore({
    collectionPath: mhdWrite.collectionPath,
    docId: mhdWrite.docId,
    op: 'set',
    onlineData: mhdWrite.onlineData,
    queueData: queuePayload,
    offlineMessage: 'MHD-Posten wird nachträglich synchronisiert.',
  });

  return mhdWrite.docId;
}

async function createRecipeFromForm() {
  if (!isProductionAdmin()) {
    productionState.showHUD('Keine Berechtigung', 'Nur Admins können Rezepte anlegen.', '!');
    return;
  }

  const name = document.getElementById('recipe-create-name')?.value.trim() || '';
  const kat = document.getElementById('recipe-create-category')?.value.trim() || 'Hauptgericht';
  const haltbar = document.getElementById('recipe-create-haltbar')?.value.trim() || '';
  const mhdDaysRaw = document.getElementById('recipe-create-mhd-days')?.value;
  const standardMhdTage = parseInt(String(mhdDaysRaw ?? '').trim(), 10);

  if (!name) {
    productionState.showHUD('Name fehlt', 'Bitte einen Rezeptnamen eintragen.', '!');
    return;
  }
  if (!Number.isFinite(standardMhdTage) || standardMhdTage < 0) {
    productionState.showHUD('MHD-Tage fehlen', 'Bitte gültige Haltbarkeit in Tagen eintragen (z. B. 3).', '!');
    return;
  }

  const collectionPath = rezepteCollectionPath();
  if (!collectionPath) {
    productionState.showHUD('Mandant fehlt', 'Rezept konnte keinem Betrieb zugeordnet werden.', '!');
    return;
  }

  const logicalId = slugRecipeIdFromName(name);
  if (!logicalId) {
    productionState.showHUD('Ungültiger Name', 'Der Rezeptname ergibt keine gültige ID.', '!');
    return;
  }

  const existing = productionState.recipes.find(
    (entry) => recipeIdsMatch(entry.id, logicalId) || recipeIdsMatch(entry.docId, logicalId),
  );
  if (existing) {
    productionState.showHUD('Rezept existiert', `„${name}" ist bereits hinterlegt.`, '!');
    return;
  }

  const tenantId = requireProductionTenantId();
  const recipePayload = {
    id: logicalId,
    firestoreId: logicalId,
    name,
    kat,
    haltbar: haltbar || `${standardMhdTage} Tage bei < 4°C`,
    standardMhdTage,
    kaliber: '',
    basis_g: '1.000,00',
    allergene: [],
    ingredients: [],
    hinweis: '',
    tipp: '',
    anweisung_A: '',
    anweisung_B: '',
    anweisung_C: '',
    anweisung_D: '',
    tenantId,
    createdAt: serverTimestampFallback(),
  };

  const saveBtn = document.getElementById('btn-recipe-create-save');
  try {
    if (saveBtn) saveBtn.disabled = true;
    await productionState.writeOrQueueFirestore({
      collectionPath,
      docId: logicalId,
      op: 'set',
      onlineData: recipePayload,
      queueData: { ...recipePayload, createdAt: new Date().toISOString() },
      offlineMessage: 'Rezept wird nachträglich synchronisiert.',
    });

    RECIPE_CREATE_FORM_FIELDS.forEach((fieldId) => {
      const field = document.getElementById(fieldId);
      if (field) field.value = '';
    });

    productionState.showHUD('Rezept gespeichert', `„${name}" wurde angelegt.`);
    productionState.playClickSound(1200, 0.06, 0.15);
    renderRecipes();
  } catch (error) {
    console.error('[CharcuLogic Firebase] Rezept anlegen fehlgeschlagen:', error);
    productionState.showHUD('Fehler', 'Rezept konnte nicht gespeichert werden.', '!');
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

function initRecipeCreateForm() {
  const formPanel = document.getElementById('kitchen-recipe-create-panel');
  const saveBtn = document.getElementById('btn-recipe-create-save');
  if (!formPanel || !saveBtn || saveBtn.dataset.productionBound === '1') return;
  saveBtn.dataset.productionBound = '1';
  saveBtn.addEventListener('click', async () => {
    productionState.playClickSound(1100, 0.05, 0.12);
    await createRecipeFromForm();
  });
}

async function documentRecipeBatch() {
  if (productionState.batchDocumentInFlight) return;
  if (!productionState.selectedRecipeId) {
    productionState.showHUD("⚠️ Kein Rezept", "Bitte zuerst ein Rezept öffnen.", "⚠️");
    return;
  }

  const recipe = productionState.activeRecipeDetail || resolveActiveRecipeForDetail(productionState.selectedRecipeId);
  if (!recipe) {
    productionState.showHUD("⚠️ Rezept fehlt", "Die Charge konnte keinem Rezept zugeordnet werden.", "⚠️");
    return;
  }

  const maker = document.getElementById('recipe-batch-maker')?.value.trim() || '';
  if (!maker) {
    productionState.showHUD("⚠️ Macher fehlt", "Bitte eintragen, wer die Charge hergestellt hat.", "⚠️");
    return;
  }


  const targetKg = currentProductionTargetKg();
  const scaledIngredients = scaledIngredientsForRecipe(recipe, targetKg);
  const labelBasis = buildLabelBasis(recipe, scaledIngredients, targetKg);
  const verkaufsEinheiten = readProductionUnits();
  labelBasis.etikettenAnzahl = verkaufsEinheiten.gesamt || null;
  const phRaw = document.getElementById('recipe-batch-ph')?.value;
  const tempRaw = document.getElementById('recipe-batch-core-temp')?.value;
  const phValue = phRaw ? parseFloat(String(phRaw).replace(',', '.')) : null;
  const coreTempValue = tempRaw ? parseFloat(String(tempRaw).replace(',', '.')) : null;
  const batchNumber = generateRecipeBatchNumber(recipe.id);

  const batchEntry = {
    chargenNummer: batchNumber,
    rezeptId: recipe.id,
    rezeptName: recipe.name,
    kategorie: recipe.kat || '',
    produktionsmengeKg: targetKg,
    macher: maker,
    phWert: Number.isFinite(phValue) ? phValue : null,
    kerntemperatur: Number.isFinite(coreTempValue) ? coreTempValue : null,
    abweichungen: document.getElementById('recipe-batch-deviations')?.value.trim() || '',
    datenquelle: productionState.activeRecipeDataSource,
    zutatenBerechnet: scaledIngredients,
    verkaufsEinheiten,
    etikettBasis: labelBasis,
    verarbeitungsfleisch: selectedGallowayYieldLots(),
    tenantId: productionState.tenantId,
    zeitstempel: serverTimestampFallback(),
  };

  const batchBtn = document.getElementById('btn-document-recipe-batch');

  try {
    productionState.batchDocumentInFlight = true;
    if (batchBtn) batchBtn.disabled = true;
        const collectionPath = productionBatchesCollectionPath();
        if (!collectionPath) {
            productionState.showHUD("Mandant fehlt", "Die Charge konnte keinem Betrieb zugeordnet werden.");
            return;
        }

        await productionState.writeOrQueueFirestore({
          collectionPath,
          docId: batchNumber,
          op: 'set',
          onlineData: batchEntry,
          queueData: { ...batchEntry, zeitstempel: new Date().toISOString() },
          offlineMessage: 'Charge wird nachträglich synchronisiert.',
        });

    let mhdPostenId = null;
    let mhdSyncFailed = false;
    try {
      mhdPostenId = await syncMhdEntryFromProductionBatch({
        recipe,
        batchNumber,
        targetKg,
        maker,
      });
    } catch (mhdError) {
      mhdSyncFailed = true;
      console.error('[CharcuLogic Firebase] MHD-Posten aus Charge fehlgeschlagen:', mhdError);
      productionState.showHUD(
        'Charge gespeichert',
        `${batchNumber} wurde dokumentiert, aber der MHD-Posten konnte nicht angelegt werden.`,
        '!',
      );
    }

    productionState.onFormSaved(PRODUCTION_FORM_FIELDS);
    if (!mhdSyncFailed) {
      if (mhdPostenId) {
        productionState.showHUD(
          'Charge dokumentiert',
          `${batchNumber} gespeichert – MHD-Posten „${recipe.name}" angelegt.`,
        );
      } else {
        productionState.showHUD('Charge dokumentiert', `${batchNumber} wurde gespeichert.`);
      }
    }
    productionState.productionBatches = [{ ...batchEntry, id: batchNumber, zeitstempel: new Date() }, ...productionState.productionBatches]
      .filter((batch, index, self) => self.findIndex((entry) => entry.id === batch.id) === index)
      .slice(0, 50);
    renderProductionBatches();
    const deviations = document.getElementById('recipe-batch-deviations');
    if (deviations) deviations.value = '';
    ['recipe-unit-large', 'recipe-unit-sb', 'recipe-unit-loose', 'recipe-unit-glass', 'recipe-unit-note'].forEach((id) => {
      const field = document.getElementById(id);
      if (field) field.value = '';
    });
  } catch (error) {
    console.error('[CharcuLogic Firebase] Charge speichern fehlgeschlagen:', error);
    productionState.showHUD("⚠️ Fehler", "Charge konnte nicht gespeichert werden.", "⚠️");
  } finally {
    productionState.batchDocumentInFlight = false;
    if (batchBtn) batchBtn.disabled = false;
  }
}

function currentDatasheetRecipe() {
  if (productionState.activeRecipeDetail) return productionState.activeRecipeDetail;
  if (!productionState.selectedRecipeId) return null;
  return resolveActiveRecipeForDetail(productionState.selectedRecipeId);
}

function syncBatchProfileButtons() {
  const activeId = productionState.machineProfileId;
  const targetKg = currentProductionTargetKg();
  document.querySelectorAll('[data-batch-profile]').forEach((button) => {
    const profile = getMachineBatchProfile(button.getAttribute('data-batch-profile'));
    const isActive = Boolean(
      profile
      && profile.id === activeId
      && Math.abs(targetKg - profile.targetKg) < 0.05,
    );
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function renderDatasheetQuidPreview(datasheet) {
  const host = document.getElementById('production-datasheet-quid');
  if (!host) return;
  if (!datasheet?.lmiv?.quid?.length) {
    host.innerHTML = `<span class="production-datasheet-quid-empty">QUID erscheint hier, sobald Fleischanteile berechnet sind.</span>`;
    return;
  }
  host.innerHTML = datasheet.lmiv.quid.map((item) => (
    `<span class="production-datasheet-quid-chip">${item.label}* ${formatPercent(item.percentage)}</span>`
  )).join('');
}

function refreshProductionDatasheetState() {
  const recipe = currentDatasheetRecipe();
  const printBtn = document.getElementById('btn-print-production-datasheet');
  if (!recipe) {
    productionState.datasheet = null;
    renderDatasheetQuidPreview(null);
    if (printBtn) printBtn.disabled = true;
    syncBatchProfileButtons();
    return;
  }

  const targetKg = currentProductionTargetKg();
  const profile = getMachineBatchProfile(productionState.machineProfileId);
  const units = readProductionUnits();
  const recipePieceWeight = Number(recipe.pieceWeightG ?? recipe.stueckgewicht_g ?? recipe.stueckgewichtG);
  const pieceWeightG = Number.isFinite(recipePieceWeight) && recipePieceWeight > 0
    ? recipePieceWeight
    : (profile?.pieceWeightG || DEFAULT_MACHINE_PARK.pieceWeightG);
  const measuredPh = parseFloat(String(document.getElementById('recipe-batch-ph')?.value || '').replace(',', '.'));
  const measuredCoreTemp = parseFloat(String(document.getElementById('recipe-batch-core-temp')?.value || '').replace(',', '.'));

  try {
    productionState.datasheet = buildProductionDatasheetData(recipe, {
      targetKg,
      profileId: productionState.machineProfileId,
      machineProfile: profile || { id: 'custom', ...DEFAULT_MACHINE_PARK, targetKg },
      pieceCount: units.gesamt || undefined,
      pieceWeightG,
      cutterType: recipe.cutterType || recipe.maschinen?.kutter,
      fillerType: recipe.fillerType || recipe.maschinen?.fueller,
      kpis: recipe.kpis || undefined,
      createdBy: window.BRANDING?.betriebsName || 'Mein Hofladen / Metzgerei',
      accentColor: window.BRANDING?.primaryColor,
      logoUrl: window.BRANDING?.logoUrl,
      measuredPh: Number.isFinite(measuredPh) ? measuredPh : undefined,
      measuredCoreTemp: Number.isFinite(measuredCoreTemp) ? measuredCoreTemp : undefined,
    });
  } catch (error) {
    console.error('[CharcuLogic Produktionsdatenblatt] Aufbau fehlgeschlagen:', error);
    productionState.datasheet = null;
  }

  renderDatasheetQuidPreview(productionState.datasheet);
  if (printBtn) printBtn.disabled = !productionState.datasheet;
  syncBatchProfileButtons();
}

function applyMachineBatchProfile(profileId) {
  const profile = getMachineBatchProfile(profileId) || MACHINE_BATCH_PROFILES[0];
  if (!profile) return;
  productionState.machineProfileId = profile.id;
  productionState.productionTargetKg = profile.targetKg;
  if (inputProdTarget) {
    inputProdTarget.value = profile.targetKg.toFixed(1);
  }
  const wrsTarget = document.getElementById('target-weight');
  if (wrsTarget) {
    wrsTarget.value = String(profile.targetKg);
    wrsTarget.dispatchEvent(new Event('input', { bubbles: true }));
  }
  productionState.playClickSound(1250, 0.04, 0.14);
  calculateIngredients();
  refreshProductionDatasheetState();
  productionState.showHUD(
    'Standard-Charge',
    `${formatDeNumber(profile.targetKg, 1)} kg eingestellt – Fleisch, Schüttung und Gewürze sind skaliert.`,
  );
}

function printProductionDatasheet() {
  refreshProductionDatasheetState();
  if (!productionState.datasheet) {
    productionState.showHUD('Rezept fehlt', 'Bitte zuerst ein Rezept öffnen, dann das Datenblatt drucken.', '!');
    return;
  }
  productionState.playClickSound(900, 0.05, 0.12);
  const result = openProductionDatasheetPrint(productionState.datasheet, {
    onBlocked: () => {
      productionState.showHUD(
        'Druckfenster blockiert',
        'Bitte das Druckfenster in Safari zulassen und erneut tippen.',
        '!',
      );
    },
  });
  if (result?.mode === 'blocked') {
    productionState.showHUD(
      'Druckfenster blockiert',
      'Bitte das Druckfenster in Safari zulassen und erneut tippen.',
      '!',
    );
  }
}

function initProductionControls() {
  if (inputProdTarget) {
    inputProdTarget.addEventListener('input', (e) => {
      let val = parseFloat(String(e.target.value).replace(',', '.'));
      if (isNaN(val) || val <= 0) val = 0.5;
      productionState.productionTargetKg = val;
      const matching = MACHINE_BATCH_PROFILES.find((profile) => Math.abs(profile.targetKg - val) < 0.05);
      if (matching) productionState.machineProfileId = matching.id;
      calculateIngredients();
    });
  }

  if (btnProdMinus) {
    btnProdMinus.addEventListener('click', () => {
      productionState.productionTargetKg = Math.max(0.5, productionState.productionTargetKg - 0.5);
      inputProdTarget.value = productionState.productionTargetKg.toFixed(1);
      productionState.playClickSound(1100, 0.03, 0.12);
      inputProdTarget.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  if (btnProdPlus) {
    btnProdPlus.addEventListener('click', () => {
      productionState.productionTargetKg = Math.min(500, productionState.productionTargetKg + 0.5);
      inputProdTarget.value = productionState.productionTargetKg.toFixed(1);
      productionState.playClickSound(1400, 0.03, 0.12);
      inputProdTarget.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  const btnDocumentRecipeBatch = document.getElementById('btn-document-recipe-batch');
  if (btnDocumentRecipeBatch) {
    btnDocumentRecipeBatch.addEventListener('click', async () => {
      productionState.playClickSound(1150, 0.08, 0.18);
      await documentRecipeBatch();
    });
  }

  const profileHost = document.getElementById('production-batch-profiles');
  if (profileHost && profileHost.dataset.datasheetBound !== '1') {
    profileHost.dataset.datasheetBound = '1';
    profileHost.addEventListener('click', (event) => {
      const button = event.target.closest('[data-batch-profile]');
      if (!button) return;
      applyMachineBatchProfile(button.getAttribute('data-batch-profile'));
    });
  }

  const printBtn = document.getElementById('btn-print-production-datasheet');
  if (printBtn && printBtn.dataset.datasheetBound !== '1') {
    printBtn.dataset.datasheetBound = '1';
    printBtn.addEventListener('click', () => printProductionDatasheet());
  }

  ['recipe-batch-ph', 'recipe-batch-core-temp', 'recipe-unit-large', 'recipe-unit-sb', 'recipe-unit-loose', 'recipe-unit-glass']
    .forEach((fieldId) => {
      const field = document.getElementById(fieldId);
      if (!field || field.dataset.datasheetBound === '1') return;
      field.dataset.datasheetBound = '1';
      field.addEventListener('input', () => refreshProductionDatasheetState());
    });

  syncBatchProfileButtons();
}

function bindRecipeListEvents() {
  const container = document.getElementById('recipe-list-container');
  if (!container || container.dataset.productionBound === '1') return;
  container.dataset.productionBound = '1';
  container.addEventListener('click', (event) => {
    const card = event.target.closest('[data-recipe-id]');
    if (!card) return;
    openRecipeDetail(card.dataset.recipeId);
  });
}

export function initProductionModule(databaseInstance, writeOrQueueFirestoreFunction, soundAPI = {}, showHudCallback, options = {}) {
  productionState.db = databaseInstance || productionState.db;
  productionState.writeOrQueueFirestore = writeOrQueueFirestoreFunction || productionState.writeOrQueueFirestore;
  productionState.playClickSound = soundAPI.playClickSound || soundAPI.playFeedbackSound || productionState.playClickSound;
  productionState.showHUD = showHudCallback || productionState.showHUD;
  productionState.tenantId = options.tenantId || productionState.tenantId;
  productionState.getFirebase = options.getFirebase || productionState.getFirebase;
  productionState.onFormSaved = typeof options.onFormSaved === 'function' ? options.onFormSaved : productionState.onFormSaved;
  productionState.restoreDraftFields = typeof options.restoreDraftFields === 'function'
    ? options.restoreDraftFields
    : productionState.restoreDraftFields;
  productionState.getAuditActorName = typeof options.getAuditActorName === 'function'
    ? options.getAuditActorName
    : productionState.getAuditActorName;

  if (!productionState.initialized) {
    initRecipeSearchAndFilters();
    initBatchArchiveSearch();
    initRecipeDetailPanelEvents();
    bindRecipeListEvents();
    initRecipeCreateForm();
    initProductionControls();
    productionState.initialized = true;
  }

  syncRecipeAdminFormVisibility();
  renderRecipeCloudAudit();
  renderRecipes();
  renderProductionBatches();
  restoreProductionDraftFields();
  refreshGallowayProcessingStockPanel();
}

export function disableProductionModule() {
  if (productionState.recipesUnsubscribe) {
    productionState.recipesUnsubscribe();
    productionState.recipesUnsubscribe = null;
  }
  if (productionState.productionBatchesUnsubscribe) {
    productionState.productionBatchesUnsubscribe();
    productionState.productionBatchesUnsubscribe = null;
  }
  productionState.recipes = [];
  productionState.productionBatches = [];
  productionState.tenantId = '';
}

function restoreProductionDraftFields() {
  productionState.restoreDraftFields(PRODUCTION_FORM_FIELDS);
}

function syncRecipeAdminFormVisibility() {
  const panel = document.getElementById('kitchen-recipe-create-panel');
  if (!panel) return;
  const visible = isProductionAdmin();
  panel.hidden = !visible;
  panel.classList.toggle('hidden', !visible);
}

export function activateKitchenTab() {
  productionState.activeTab = 'kitchen';
  syncRecipeAdminFormVisibility();
  initKitchenProductionModeToggle();
  syncKitchenProductionModeUi();
  renderRecipes();
  restoreProductionDraftFields();
  refreshGallowayProcessingStockPanel();
  window.applyProfileKitchenRestrictions?.();
}

const YIELD_STOCK_KEY = 'hofsync.gallowayYieldStock.v1';

function rememberYieldStock(lots) {
  try {
    localStorage.setItem(YIELD_STOCK_KEY, JSON.stringify(lots));
  } catch {
    /* private mode */
  }
}

function readYieldStock() {
  try {
    const parsed = JSON.parse(localStorage.getItem(YIELD_STOCK_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function selectedGallowayYieldLots() {
  return [...document.querySelectorAll('#galloway-yield-stock [data-yield-lot]:checked')].map((el) => ({
    id: el.getAttribute('data-yield-lot') || '',
    gevoClass: el.getAttribute('data-gevo-class') || '',
    mengeKg: Number(el.getAttribute('data-menge-kg')) || 0,
    chargenNummer: el.getAttribute('data-charge') || '',
    artikel: el.getAttribute('data-artikel') || '',
  })).filter((lot) => lot.id && lot.mengeKg > 0);
}

function yieldInventoryDocId(chargeId, suffix) {
  return getSafeFirestoreId(`galloway-${chargeId}-${suffix}`).slice(0, 140);
}

function renderYieldStockLots(lots) {
  const panel = document.getElementById('galloway-yield-stock');
  if (!panel) return;
  const available = lots.filter((lot) => Number(lot.menge) > 0);
  if (!available.length) {
    panel.innerHTML = '<p class="galloway-yield-stock-empty">Noch kein Verarbeitungsfleisch aus der Zerlegung im Magazin.</p>';
    return;
  }
  panel.innerHTML = `
    <p class="galloway-yield-stock-title">Verarbeitungsfleisch aus der Zerlegung</p>
    ${available.map((lot) => `
      <label class="galloway-yield-stock-row">
        <input type="checkbox" data-yield-lot="${escapeHtml(lot.id)}" data-gevo-class="${escapeHtml(lot.kategorie)}" data-menge-kg="${Number(lot.menge) || 0}" data-charge="${escapeHtml(lot.batchId || '')}" data-artikel="${escapeHtml(lot.artikel || '')}">
        <span>${escapeHtml(lot.kategorie)} · ${escapeHtml(String(lot.menge))} kg · ${escapeHtml(lot.artikel || lot.batchId || '')}</span>
      </label>
    `).join('')}
  `;
}

function ensureYieldStockPanel() {
  let panel = document.getElementById('galloway-yield-stock');
  if (panel) return panel;
  const host = document.querySelector('.production-log-card');
  if (!host) return null;
  panel = document.createElement('div');
  panel.id = 'galloway-yield-stock';
  panel.className = 'galloway-yield-stock';
  host.prepend(panel);
  return panel;
}

async function refreshGallowayProcessingStockPanel() {
  const panel = ensureYieldStockPanel();
  if (!panel) return;
  const localLots = readYieldStock();
  renderYieldStockLots(localLots);
  if (!productionState.db) return;
  try {
    const snap = await getTenantCollection('inventory').where('source', '==', 'zerlegung_ausbeute').limit(40).get();
    const remote = snap.docs.map((doc) => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        artikel: data.artikel || '',
        menge: Number(data.menge) || 0,
        kategorie: data.kategorie || '',
        batchId: data.batchId || '',
      };
    }).filter((lot) => ['R I', 'R II', 'R III'].includes(lot.kategorie));
    if (remote.length) {
      rememberYieldStock(remote);
      renderYieldStockLots(remote);
    }
  } catch (err) {
    console.warn('[Galloway Ausbeute] Bestand konnte nicht geladen werden.', err);
  }
}

async function writeTenantDocOnlineOrQueue({
  collectionName,
  docId,
  onlineData,
  queueData,
  offlineMessage,
}) {
  const collectionPath = getTenantCollectionPath(collectionName);
  const online = typeof navigator === 'undefined' || navigator.onLine;
  if (online && productionState.db && docId) {
    try {
      await getTenantCollection(collectionName).doc(docId).set(onlineData, { merge: true });
      return 'written';
    } catch (err) {
      console.warn(`[Galloway] Direktes Schreiben in ${collectionName} fehlgeschlagen, Queue wird genutzt:`, err);
    }
  }
  const result = await productionState.writeOrQueueFirestore({
    collectionPath,
    docId,
    op: 'set',
    onlineData,
    queueData,
    offlineMessage,
  });
  return result === 'written' ? 'written' : 'queued';
}

async function upsertYieldInventoryLot(docId, payload) {
  return writeTenantDocOnlineOrQueue({
    collectionName: 'inventory',
    docId,
    onlineData: { ...payload, updatedAt: serverTimestampFallback() },
    queueData: { ...payload, createdAt: new Date().toISOString() },
    offlineMessage: 'Verarbeitungsfleisch wird nachträglich ins Magazin gebucht.',
  });
}

async function upsertYieldProductionLot(docId, payload) {
  const ref = getTenantCollection('produktion_chargen').doc(docId);
  let exists = false;
  try {
    const snap = await ref.get();
    exists = Boolean(snap.exists);
  } catch {
    exists = false;
  }
  if (!exists) {
    await productionState.writeOrQueueFirestore({
      collectionPath: getTenantCollectionPath('produktion_chargen'),
      docId,
      op: 'set',
      onlineData: payload,
      queueData: { ...payload, zeitstempel: new Date().toISOString() },
      offlineMessage: 'Rohstoffcharge wird nachträglich synchronisiert.',
    });
    return;
  }
  try {
    await ref.update({
      produktionsmengeKg: payload.produktionsmengeKg,
      status: 'verfuegbar',
      zeitstempel: serverTimestampFallback(),
    });
  } catch (err) {
    const code = String(err?.code || '');
    if (!code.includes('permission-denied')) throw err;
  }
}

export async function saveGallowayYieldToLogbook(report) {
  const tenantId = requireProductionTenantId();
  if (!tenantId) throw new Error('Mandant fehlt');
  const charge = String(report?.chargenNummer || '').trim();
  if (!charge) throw new Error('Charge fehlt');
  const chargeId = getSafeFirestoreId(charge).slice(0, 120);
  const totals = report.totals || {};
  const yieldDoc = {
    id: chargeId,
    chargenNummer: charge,
    ohrmarke: String(report.ohrmarke || ''),
    passNr: String(report.ohrmarke || ''),
    schlachtDatum: String(report.schlachtDatum || ''),
    zerlegeDatum: String(report.zerlegeDatum || ''),
    herkunft: String(report.herkunft || ''),
    betriebsNummer: String(report.betriebsNummer || ''),
    schlachtgewichtKaltKg: Number(report.schlachtgewichtKaltKg) || 0,
    schlachtgewichtWarmKg: Number(report.schlachtgewichtWarmKg) || 0,
    haelfteLinksKg: Number(report.haelfteLinksKg) || 0,
    haelfteRechtsKg: Number(report.haelfteRechtsKg) || 0,
    basisKg: Number(totals.basisKg) || 0,
    kategorien: {
      edelKg: Number(totals.edelKg) || 0,
      bratenKg: Number(totals.bratenKg) || 0,
      verarbeitungKg: Number(totals.verarbeitungKg) || 0,
      knochenKg: Number(totals.knochenKg) || 0,
      innereienKg: Number(totals.innereienKg) || 0,
      fettKg: Number(totals.fettKg) || 0,
      r1Kg: Number(totals.r1Kg) || 0,
      r2Kg: Number(totals.r2Kg) || 0,
      r3Kg: Number(totals.r3Kg) || 0,
    },
    quoten: {
      edelPct: Number(totals.edelPct) || 0,
      bratenPct: Number(totals.bratenPct) || 0,
      verarbeitungPct: Number(totals.verarbeitungPct) || 0,
      knochenAbfallPct: Number(totals.knochenAbfallPct) || 0,
      verlustPct: Number(totals.verlustPct) || 0,
      gesamtAusbeuteKg: Number(totals.gesamtKg) || 0,
      verlustKg: Number(totals.verlustKg) || 0,
    },
    positionen: Array.isArray(report.positionen) ? report.positionen : [],
    tenantId,
    quelle: 'galloway-zerlegung',
  };
  const yieldWrite = await writeTenantDocOnlineOrQueue({
    collectionName: 'zerlegung_ausbeute',
    docId: chargeId,
    onlineData: { ...yieldDoc, updatedAt: serverTimestampFallback() },
    queueData: { ...yieldDoc, updatedAt: new Date().toISOString() },
    offlineMessage: 'Ausbeute-Protokoll wird nachträglich ins Chargenbuch geschrieben.',
  });

  const grades = [
    { key: 'r1Kg', grade: 'R I', suffix: 'ri', label: 'Galloway R I Gulasch' },
    { key: 'r2Kg', grade: 'R II', suffix: 'rii', label: 'Galloway R II Hackfleisch' },
    { key: 'r3Kg', grade: 'R III', suffix: 'riii', label: 'Galloway R III Wurstfleisch' },
  ];
  const actor = productionState.getAuditActorName?.() || 'zerlegung';
  const stockLots = [];
  for (const grade of grades) {
    const menge = Number(totals[grade.key]) || 0;
    if (!(menge > 0)) continue;
    const docId = yieldInventoryDocId(chargeId, grade.suffix);
    const artikel = `${grade.label} · ${charge}`;
    await upsertYieldInventoryLot(docId, {
      artikel,
      menge,
      kategorie: grade.grade,
      tenantId,
      source: 'zerlegung_ausbeute',
      batchId: chargeId,
      createdBy: actor,
    });
    await upsertYieldProductionLot(docId, {
      id: docId,
      chargenNummer: docId,
      rezeptId: 'galloway-zerlegung',
      rezeptName: grade.label,
      kategorie: 'Rohstoff',
      produktionsmengeKg: menge,
      gevoClass: grade.grade,
      quelle: 'zerlegung_ausbeute',
      elternCharge: chargeId,
      ohrmarke: String(report.ohrmarke || ''),
      status: 'verfuegbar',
      tenantId,
      zeitstempel: serverTimestampFallback(),
    });
    stockLots.push({ id: docId, artikel, menge, kategorie: grade.grade, batchId: chargeId });
  }
  rememberYieldStock(stockLots);
  await refreshGallowayProcessingStockPanel();
  if (typeof navigator === 'undefined' || navigator.onLine) {
    try {
      await flushPendingSyncs();
    } catch (err) {
      console.warn('[Galloway] Warteschlange konnte nicht geleert werden:', err);
    }
  }
  return {
    chargeId,
    lots: stockLots.map((lot) => lot.id),
    queued: yieldWrite !== 'written',
  };
}

window.saveGallowayYieldToLogbook = saveGallowayYieldToLogbook;

export function activateBatchesTab() {
  productionState.activeTab = 'batches';
  if (isRezeptAuditEnabled()) renderRecipeCloudAudit();
  renderProductionBatches();
  restoreProductionDraftFields();
}

export {
  applyMachineBatchProfile,
  calculateIngredients,
  createRecipeFromForm,
  documentRecipeBatch as saveCharge,
  filteredProductionBatches as searchChargen,
  filteredRecipesForKitchen as searchRecipes,
  importBratwurstRecipesToCloud,
  loadProductionBatchesFromCloud,
  loadRecipesFromCloud,
  printProductionDatasheet,
  refreshProductionDatasheetState,
  renderProductionBatches as renderChargenList,
  renderProductionBatches,
  renderRecipes,
  syncKitchenProductionModeUi,
  syncRecipeAdminFormVisibility,
};
