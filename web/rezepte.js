/**
 * Theken-Rezeptur-Nachschlagewerk — Client-seitige Suche & Karten für Kunden-Auskunft.
 * Schwere Produktions-Berechnung bleibt in production.js (Desktop/Tablet).
 */

export const THEKE_MOBILE_MEDIA_QUERY = '(max-width: 768px)';

export const THEKE_QUICK_FILTERS = [
  { id: 'galloway', label: 'Galloway Rind', query: 'galloway' },
  { id: 'bratwurst', label: 'Bratwurst', query: 'bratwurst' },
  { id: 'schinken', label: 'Schinken', query: 'schinken' },
  { id: 'allergenfrei', label: 'Allergenfrei', query: '', allergenFree: true },
];

export function isThekeMobileViewport(win = typeof window !== 'undefined' ? window : null) {
  try {
    return Boolean(win?.matchMedia?.(THEKE_MOBILE_MEDIA_QUERY)?.matches);
  } catch (_) {
    return false;
  }
}

export function normalizeThekeQuery(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function escapeThekeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function recipeCategoryLabel(recipe) {
  return recipe?.kat || recipe?.Kategorie || 'Ohne Kategorie';
}

export function ingredientNameOf(ing) {
  return ing?.name
    || ing?.Name
    || ing?.zutat
    || ing?.Zutat
    || ing?.produkt
    || ing?.Produkt
    || ing?.ingredient
    || ing?.Ingredient
    || ing?.label
    || ing?.Label
    || 'Unbekannte Zutat';
}

export function ingredientTypOf(ing) {
  return String(ing?.typ || ing?.Typ || ing?.type || '').toLowerCase();
}

export function isSpiceIngredient(ing) {
  const typ = ingredientTypOf(ing);
  return typ === 'spice' || typ === 'gewuerz' || typ === 'gewürz' || typ.includes('spice') || typ.includes('gewuerz');
}

export function isBaseIngredient(ing) {
  const typ = ingredientTypOf(ing);
  if (isSpiceIngredient(ing)) return false;
  return !typ || typ === 'base' || typ === 'fleisch' || typ === 'meat' || typ.includes('base');
}

export function recipeAllergensOf(recipe) {
  const fromField = Array.isArray(recipe?.allergene)
    ? recipe.allergene.map((entry) => String(entry || '').trim()).filter(Boolean)
    : [];
  if (fromField.length) {
    return Array.from(new Set(fromField.map((label) => label.toUpperCase())));
  }
  const fromIngredients = (Array.isArray(recipe?.ingredients) ? recipe.ingredients : [])
    .filter((ing) => Boolean(ing?.allergen || ing?.Allergen))
    .map((ing) => String(ing?.hinweis || ing?.Hinweis || ingredientNameOf(ing)).trim())
    .filter(Boolean);
  return Array.from(new Set(fromIngredients.map((label) => label.toUpperCase())));
}

export function isAllergenFreeRecipe(recipe) {
  if (recipeAllergensOf(recipe).length) return false;
  const ingredients = Array.isArray(recipe?.ingredients) ? recipe.ingredients : [];
  return !ingredients.some((ing) => Boolean(ing?.allergen || ing?.Allergen));
}

export function splitRecipeIngredients(recipe) {
  const ingredients = Array.isArray(recipe?.ingredients) ? recipe.ingredients : [];
  const spices = [];
  const bases = [];
  const other = [];
  ingredients.forEach((ing) => {
    if (isSpiceIngredient(ing)) spices.push(ing);
    else if (isBaseIngredient(ing)) bases.push(ing);
    else other.push(ing);
  });
  return { bases: [...bases, ...other], spices };
}

export function formatHaltbarkeitHint(recipe) {
  const raw = String(recipe?.haltbar || '').trim();
  if (!raw) return 'Haltbarkeit bitte im Rezept prüfen';
  const firstLine = raw.split(/\n+/)[0].trim();
  if (/haltbarkeit|lagerung|gekühlt|gekuehlt|max\.?\s*\d/i.test(firstLine) && firstLine.length <= 120) {
    return firstLine;
  }
  if (firstLine.length <= 90) return firstLine;
  return `${firstLine.slice(0, 87).trim()}…`;
}

export function recipeSearchHaystack(recipe) {
  const ingredients = Array.isArray(recipe?.ingredients)
    ? recipe.ingredients.map((ing) => `${ingredientNameOf(ing)} ${ing?.hinweis || ''} ${ing?.Hinweis || ''}`).join(' ')
    : '';
  const allergens = recipeAllergensOf(recipe).join(' ');
  return normalizeThekeQuery([
    recipe?.name || '',
    recipe?.id || '',
    recipeCategoryLabel(recipe),
    recipe?.kaliber || '',
    recipe?.hinweis || '',
    recipe?.haltbar || '',
    recipe?.tipp || '',
    ingredients,
    allergens,
    isAllergenFreeRecipe(recipe) ? 'allergenfrei frei von allergenen ohne allergene' : '',
  ].join(' '));
}

/**
 * @param {object} recipe
 * @param {string} query
 * @param {{ allergenFree?: boolean, query?: string } | null} quickFilter
 */
export function matchesThekeRecipe(recipe, query, quickFilter = null) {
  if (quickFilter?.allergenFree && !isAllergenFreeRecipe(recipe)) return false;
  const needle = normalizeThekeQuery(quickFilter?.query || query);
  if (!needle) return true;
  return recipeSearchHaystack(recipe).includes(needle);
}

function renderAllergenBadges(recipe) {
  const allergens = recipeAllergensOf(recipe);
  if (!allergens.length) {
    return '<span class="recipe-allergen-badge recipe-allergen-badge--free">Frei von Allergenen</span>';
  }
  return allergens
    .map((label) => `<span class="recipe-allergen-badge">${escapeThekeHtml(label)}</span>`)
    .join('');
}

function renderIngredientList(items, emptyLabel) {
  if (!items.length) {
    return `<p class="recipe-ing-empty">${escapeThekeHtml(emptyLabel)}</p>`;
  }
  return `<ul class="recipe-ing-list">${items.map((ing) => {
    const name = ingredientNameOf(ing);
    const allergen = Boolean(ing?.allergen || ing?.Allergen);
    return `<li class="recipe-ing-item${allergen ? ' recipe-ing-item--allergen' : ''}">${escapeThekeHtml(name)}</li>`;
  }).join('')}</ul>`;
}

/**
 * Kompakte Theken-Karte: Name, Art, Allergene, Zutaten/Gewürze, Haltbarkeit.
 */
export function renderThekeRecipeCardHtml(recipe, { selected = false } = {}) {
  const id = String(recipe?.id || '');
  const name = recipe?.name || 'Unbenanntes Rezept';
  const category = recipeCategoryLabel(recipe);
  const { bases, spices } = splitRecipeIngredients(recipe);
  const haltbar = formatHaltbarkeitHint(recipe);
  const safeId = escapeThekeHtml(id).replace(/"/g, '&quot;');

  return `
    <article class="recipe-card recipe-card--theke${selected ? ' active-recipe' : ''}" data-recipe-id="${safeId}" data-theke-card="1">
      <div class="recipe-card-head">
        <h3 class="recipe-title">${escapeThekeHtml(name)}</h3>
        <p class="recipe-subinfo">${escapeThekeHtml(category)}${recipe?.kaliber ? ` · ${escapeThekeHtml(recipe.kaliber)}` : ''}</p>
      </div>
      <div class="recipe-allergen-row" aria-label="Allergene">${renderAllergenBadges(recipe)}</div>
      <div class="recipe-ingredients-block">
        <div class="recipe-ing-section">
          <h4 class="recipe-ing-heading">Zutaten</h4>
          ${renderIngredientList(bases, 'Keine Grundzutaten hinterlegt')}
        </div>
        <div class="recipe-ing-section">
          <h4 class="recipe-ing-heading">Gewürze</h4>
          ${renderIngredientList(spices, 'Keine Gewürze hinterlegt')}
        </div>
      </div>
      <p class="recipe-haltbar-hint">${escapeThekeHtml(haltbar)}</p>
    </article>
  `;
}

export function renderCompactRecipeCardHtml(recipe, { selected = false } = {}) {
  const id = String(recipe?.id || '');
  const name = recipe?.name || 'Unbenanntes Rezept';
  const category = recipeCategoryLabel(recipe);
  const count = Array.isArray(recipe?.ingredients) ? recipe.ingredients.length : 0;
  const safeId = escapeThekeHtml(id).replace(/"/g, '&quot;');
  return `
    <div class="recipe-card${selected ? ' active-recipe' : ''}" data-recipe-id="${safeId}">
      <div class="recipe-meta-group">
        <span class="recipe-title">${escapeThekeHtml(name)}</span>
        <span class="recipe-subinfo">${escapeThekeHtml(category)} - ${count} Zutaten${recipe?.kaliber ? ` - ${escapeThekeHtml(recipe.kaliber)}` : ''}</span>
      </div>
      <div class="recipe-arrow" aria-hidden="true">&gt;</div>
    </div>
  `;
}
