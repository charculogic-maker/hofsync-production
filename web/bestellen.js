import {
  estimateLinePrice,
  estimateUnitPrice,
  resolvePricingType,
  getPackSizeOptions,
  formatEuro,
  findProductById,
  getVisibleCatalog,
  getCatalogCategories,
  describeProductPrice,
  validateCutSelection,
  isHackfleischProduct,
  applyHackfleischTier,
  isProductActive,
  isProductSoldOut,
  hasPromoPrice,
  readCatalogOverridesFromStorage,
  writeCatalogOverridesToStorage,
  getAvailablePickupSlots,
  catalogOverrideToFirestoreFields,
  PRODUCT_STATE_OPTIONS,
  PRODUCT_STATE_HINT,
} from './orderCatalog.js';
import {
  ensurePreorderFirebase,
  fetchCatalogOverridesFromFirestore,
  mapArtNrOverridesToProductOverrides,
  saveCatalogOverrideToFirestore,
  deleteCatalogOverrideFromFirestore,
  describeOverrideEditorState,
  resolvePreorderTenantId,
} from './catalog-overrides-db.js';

const ADMIN_TEAM_FLAG_KEY = 'sth_team_mode';
const SORTIMENT_SAVE_DEBOUNCE_MS = 450;

function detectAdminMode() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === '1' || params.get('team') === '1') return true;
    return localStorage.getItem(ADMIN_TEAM_FLAG_KEY) === '1';
  } catch (_) {
    return false;
  }
}

const state = {
  cart: /** @type {Array<any>} */ ([]),
  activeProductId: '',
  categoryFilter: 'all',
  channel: /** @type {'counter'|'sb'} */ ('counter'),
  simulatedNow: /** @type {Date|null} */ (null),
  lastSlots: null,
  adminMode: detectAdminMode(),
  overrides: readCatalogOverridesFromStorage(),
  overridesReady: false,
  tenantId: resolvePreorderTenantId(),
  sortimentSaveTimers: /** @type {Record<string, number>} */ ({}),
};

if (state.adminMode) {
  document.body.classList.add('admin-mode');
  const banner = document.querySelector('.admin-banner');
  if (banner) {
    banner.style.display = 'block';
    banner.classList.remove('hidden');
  }
  try { localStorage.setItem(ADMIN_TEAM_FLAG_KEY, '1'); } catch (_) { /* noop */ }
}

const els = {
  catalog: document.getElementById('catalog-root'),
  filters: document.getElementById('category-filters'),
  cutModal: document.getElementById('modal-cut'),
  cartDrawer: document.getElementById('drawer-cart'),
  sortimentDrawer: document.getElementById('drawer-sortiment'),
  checkoutModal: document.getElementById('modal-checkout'),
  confirmModal: document.getElementById('modal-confirm'),
  adminPromoModal: document.getElementById('modal-admin-promo'),
  cartItems: document.getElementById('cart-items'),
  cartSum: document.getElementById('cart-sum'),
  checkoutSum: document.getElementById('checkout-sum'),
  fab: document.getElementById('cart-fab'),
  fabCount: document.getElementById('fab-count'),
  fabLabel: document.getElementById('fab-label'),
  headerCount: document.getElementById('header-cart-count'),
  slotHint: document.getElementById('slot-hint'),
  simPanel: document.getElementById('sim-panel'),
  simDatetime: document.getElementById('sim-datetime'),
  simStatus: document.getElementById('sim-status'),
  pickupDate: document.getElementById('pickup-date'),
  pickupSlot: document.getElementById('pickup-slot'),
  channelHint: document.getElementById('channel-mode-hint'),
  toastHost: document.getElementById('toast-host'),
  sortimentList: document.getElementById('sortiment-list'),
  sortimentStatus: document.getElementById('sortiment-status'),
};

function now() {
  return state.simulatedNow ? new Date(state.simulatedNow.getTime()) : new Date();
}

/** datetime-local immer als lokale Wanduhrzeit lesen (kein UTC-Drift). */
function parseDatetimeLocal(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return null;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    0,
    0,
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

function showToast(message, type = 'info', durationMs = 3200) {
  const el = document.createElement('div');
  el.className = `toast pointer-events-auto rounded-2xl px-4 py-3 text-sm font-semibold shadow-soft ${
    type === 'error' ? 'bg-red-700 text-white' : type === 'success' ? 'bg-hof-moss text-white' : 'bg-hof-pine text-white'
  }`;
  el.textContent = message;
  els.toastHost.appendChild(el);
  setTimeout(() => el.remove(), durationMs);
}

let lockedScrollY = 0;

function lockBodyScroll() {
  if (document.body.classList.contains('layer-scroll-lock')) return;
  lockedScrollY = window.scrollY || window.pageYOffset || 0;
  // Zuerst nach oben: auf iOS/WebKit werden fixed-Kinder sonst mit body.top mitverschoben
  // und der Drawer-Header liegt außerhalb des Viewports.
  window.scrollTo(0, 0);
  document.body.classList.add('layer-scroll-lock');
  document.body.style.top = '0px';
}

function unlockBodyScroll() {
  if (!document.body.classList.contains('layer-scroll-lock')) return;
  document.body.classList.remove('layer-scroll-lock');
  document.body.style.top = '';
  window.scrollTo(0, lockedScrollY);
}

function openLayer(el) {
  if (!el) return;
  lockBodyScroll();
  el.classList.add('is-open');
  el.style.display = (el.id === 'drawer-cart' || el.id === 'drawer-sortiment') ? 'block' : 'flex';
  el.setAttribute('aria-hidden', 'false');
  if (el.id === 'drawer-cart') {
    const items = document.getElementById('cart-items');
    if (items) items.scrollTop = 0;
  }
  if (el.id === 'drawer-sortiment') {
    const list = document.getElementById('sortiment-list');
    if (list) list.scrollTop = 0;
  }
}

function closeLayer(el) {
  if (!el) return;
  el.classList.remove('is-open');
  el.style.display = 'none';
  el.setAttribute('aria-hidden', 'true');
  const anyOpen = [...document.querySelectorAll('.modal-layer.is-open, .drawer-layer.is-open')].length > 0;
  if (!anyOpen) unlockBodyScroll();
}

function closeAllLayers() {
  [els.cutModal, els.cartDrawer, els.sortimentDrawer, els.checkoutModal, els.confirmModal, els.adminPromoModal]
    .forEach(closeLayer);
}

function setSortimentStatus(message) {
  if (els.sortimentStatus) els.sortimentStatus.textContent = message;
}

/**
 * Overrides aus Firestore laden und mit lokalem Cache mergen (Firestore gewinnt).
 */
async function refreshOverridesFromCloud() {
  ensurePreorderFirebase();
  const byArtNr = await fetchCatalogOverridesFromFirestore({ tenantId: state.tenantId });
  const fromCloud = mapArtNrOverridesToProductOverrides(byArtNr);
  const local = readCatalogOverridesFromStorage();
  state.overrides = { ...local, ...fromCloud };
  writeCatalogOverridesToStorage(state.overrides);
  state.overridesReady = true;
  renderCatalog();
  if (state.adminMode) renderSortimentAdmin();
  const count = Object.keys(fromCloud).length;
  setSortimentStatus(
    count
      ? `${count} Override${count === 1 ? '' : 's'} aus der Cloud · Mandant ${state.tenantId}`
      : `Keine Cloud-Overrides · Mandant ${state.tenantId}`,
  );
  return fromCloud;
}

async function persistOverrideToCloud(productId) {
  const product = findProductById(productId);
  if (!product?.artNr) return;
  const override = state.overrides[productId];
  try {
    if (!override) {
      await deleteCatalogOverrideFromFirestore({ artNr: product.artNr, tenantId: state.tenantId });
      setSortimentStatus(`Standard wiederhergestellt · ArtNr ${product.artNr}`);
      return;
    }
    const fields = catalogOverrideToFirestoreFields(product, override);
    await saveCatalogOverrideToFirestore({
      artNr: product.artNr,
      tenantId: state.tenantId,
      isActive: fields.isActive,
      promoPrice: fields.promoPrice,
      promoText: fields.promoText,
    });
    setSortimentStatus(`Gespeichert · ArtNr ${product.artNr}`);
  } catch (err) {
    console.error('[Bestellen] Override speichern fehlgeschlagen:', err);
    showToast(
      err?.message?.includes('anmelden')
        ? err.message
        : 'Speichern in der Cloud hat nicht geklappt. Bitte Anmeldung prüfen.',
      'error',
      4200,
    );
    setSortimentStatus('Cloud-Speichern fehlgeschlagen – lokal zwischengespeichert');
  }
}

function scheduleCloudSave(productId) {
  const prev = state.sortimentSaveTimers[productId];
  if (prev) window.clearTimeout(prev);
  state.sortimentSaveTimers[productId] = window.setTimeout(() => {
    delete state.sortimentSaveTimers[productId];
    persistOverrideToCloud(productId);
  }, SORTIMENT_SAVE_DEBOUNCE_MS);
}

function cartPositions() {
  return state.cart.length;
}

function cartTotal() {
  return state.cart.reduce((sum, line) => sum + (Number(line.estimatedPrice) || 0), 0);
}

function refreshCartUi() {
  const count = cartPositions();
  const total = cartTotal();
  const positionsLabel = `${count} ${count === 1 ? 'Position' : 'Positionen'} · ${formatEuro(total)}`;
  els.headerCount.textContent = String(count);
  els.fabCount.textContent = String(count);
  if (els.fabLabel) els.fabLabel.textContent = positionsLabel;
  els.cartSum.textContent = formatEuro(total);
  els.checkoutSum.textContent = formatEuro(total);
  els.fab.classList.toggle('hidden', count === 0);
  els.fab.classList.toggle('inline-flex', count > 0);
  document.getElementById('btn-checkout').disabled = count === 0;

  if (!state.cart.length) {
    els.cartItems.innerHTML = '<p class="text-sm text-hof-muted">Dein Warenkorb ist noch leer. Wähle ein Stück aus dem Sortiment.</p>';
    return;
  }

      els.cartItems.innerHTML = state.cart.map((line, index) => {
        const artMeta = line.artNr
          ? `ArtNr ${escapeHtml(line.artNr)}${line.pricePerKg ? ` · ${formatEuro(line.pricePerKg)}/kg` : ''}`
          : '';
        const badge = line.tierBadge
          ? `<span class="badge-pill badge-aktion">${escapeHtml(line.tierBadge)}</span>`
          : '';
        return `
        <article class="mb-3 rounded-2xl border border-hof-sand bg-hof-cream/40 p-3">
          <div class="flex items-start justify-between gap-2">
            <div>
              <div class="mb-1 flex flex-wrap gap-1">${badge}</div>
              <h4 class="font-semibold text-hof-pine">${escapeHtml(line.name)}</h4>
              ${artMeta ? `<p class="mt-0.5 text-[11px] uppercase tracking-wide text-hof-muted">${artMeta}</p>` : ''}
              <p class="mt-1 text-xs text-hof-muted">${escapeHtml(line.summary)}</p>
            </div>
            <button type="button" data-remove="${index}" class="text-xs font-semibold text-red-700 hover:underline">Entfernen</button>
          </div>
          <p class="mt-2 text-sm font-semibold text-hof-ink">${formatEuro(line.estimatedPrice)}</p>
        </article>
      `;
      }).join('');
    }

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function catalogCategories() {
  return getVisibleCatalog(state.overrides, { includeInactive: state.adminMode });
}

function productById(productId) {
  return findProductById(productId, state.overrides);
}

function persistOverrides() {
  writeCatalogOverridesToStorage(state.overrides);
}

function patchOverride(productId, patch, options = {}) {
  const current = options.replacePricing ? {} : { ...(state.overrides[productId] || {}) };
  Object.assign(current, patch);
  if (!current.badge) delete current.badge;
  if (!current.promoText) delete current.promoText;
  if (current.promoPrice == null) delete current.promoPrice;

  const hasPricing = Number.isFinite(Number(current.pricePerKg))
    || Number.isFinite(Number(current.estimatedPiecePrice))
    || Number.isFinite(Number(current.promoPrice));
  const hasBadge = Boolean(current.badge || current.promoText);
  const inactive = current.active === false || current.isActive === false;
  if (!inactive && !hasPricing && !hasBadge && !current.soldOut) {
    delete state.overrides[productId];
  } else {
    state.overrides[productId] = current;
  }
  persistOverrides();
  renderCatalog();
  if (state.adminMode && options.rerenderSortiment !== false) renderSortimentAdmin();
  if (options.cloud !== false) scheduleCloudSave(productId);
}

function renderSortimentAdmin() {
  if (!els.sortimentList || !state.adminMode) return;
  const categories = getCatalogCategories();
  els.sortimentList.innerHTML = categories.map((category) => {
    const rows = category.products.map((baseProduct) => {
      const editor = describeOverrideEditorState(baseProduct, state.overrides[baseProduct.id]);
      if (!editor.artNr) return '';
      return `
        <article class="sortiment-row" data-sortiment-id="${escapeHtml(baseProduct.id)}" data-art-nr="${escapeHtml(editor.artNr)}">
          <div class="min-w-0">
            <p class="text-sm font-bold text-hof-pine">${escapeHtml(baseProduct.name)}</p>
            <p class="text-[11px] uppercase tracking-wide text-hof-muted">ArtNr ${escapeHtml(editor.artNr)} · Basis ${formatEuro(editor.basePrice)} ${escapeHtml(editor.unitLabel)}</p>
          </div>
          <label class="sortiment-switch">
            <input type="checkbox" data-sortiment-active ${editor.isActive ? 'checked' : ''}>
            Im Portal sichtbar
          </label>
          <div>
            <label class="text-[10px] font-semibold uppercase tracking-wide text-hof-muted">Aktionspreis</label>
            <input type="number" min="0" step="0.01" inputmode="decimal" data-sortiment-promo
              class="mt-1 w-full rounded-xl border border-hof-sand px-2.5 py-2 text-sm"
              placeholder="${escapeHtml(String(editor.basePrice))}"
              value="${editor.promoPrice != null ? escapeHtml(String(editor.promoPrice)) : ''}">
          </div>
          <div>
            <label class="text-[10px] font-semibold uppercase tracking-wide text-hof-muted">Aktions-Badge</label>
            <input type="text" maxlength="48" data-sortiment-badge
              class="mt-1 w-full rounded-xl border border-hof-sand px-2.5 py-2 text-sm"
              placeholder="z. B. Wochen-Aktion"
              value="${escapeHtml(editor.promoText || '')}">
          </div>
        </article>
      `;
    }).filter(Boolean).join('');
    if (!rows) return '';
    return `
      <section class="mb-4">
        <h4 class="font-display text-lg text-hof-pine">${escapeHtml(category.name)}</h4>
        <p class="text-xs text-hof-muted">${escapeHtml(category.description || '')}</p>
        <div class="mt-2">${rows}</div>
      </section>
    `;
  }).join('') || '<p class="text-sm text-hof-muted">Keine Artikel mit Artikelnummer.</p>';
}

function readSortimentRowPatch(row) {
  const productId = row.getAttribute('data-sortiment-id');
  const baseProduct = findProductById(productId);
  if (!baseProduct) return null;
  const active = Boolean(row.querySelector('[data-sortiment-active]')?.checked);
  const promoRaw = row.querySelector('[data-sortiment-promo]')?.value;
  const badge = String(row.querySelector('[data-sortiment-badge]')?.value || '').trim();
  const promoPrice = promoRaw === '' || promoRaw == null ? null : Number(promoRaw);
  /** @type {Record<string, any>} */
  const patch = {
    active,
    isActive: active,
    artNr: baseProduct.artNr,
    badge: badge || undefined,
    promoText: badge || null,
  };
  const pricingType = resolvePricingType(baseProduct);
  delete patch.pricePerKg;
  delete patch.originalPricePerKg;
  delete patch.estimatedPiecePrice;
  delete patch.fixedOriginalPrice;
  delete patch.promoPrice;

  if (promoPrice != null && Number.isFinite(promoPrice) && promoPrice >= 0) {
    patch.promoPrice = promoPrice;
    if (pricingType === 'fixed') {
      patch.estimatedPiecePrice = promoPrice;
      const base = Number(baseProduct.estimatedPiecePrice) || 0;
      if (base > promoPrice) patch.fixedOriginalPrice = base;
    } else {
      patch.pricePerKg = promoPrice;
      const base = Number(baseProduct.pricePerKg) || 0;
      if (base > promoPrice) patch.originalPricePerKg = base;
    }
  }
  return { productId, patch, clearPromo: promoPrice == null || !(promoPrice >= 0) };
}

function applySortimentRow(row) {
  const parsed = readSortimentRowPatch(row);
  if (!parsed) return;
  const { productId, patch } = parsed;
  patchOverride(productId, patch, { replacePricing: true, rerenderSortiment: false });
}

function productPriceHtml(product) {
  const price = describeProductPrice(product);
  if (price.isPromo) {
    return `<span class="price-promo">${price.currentHtml}</span><span class="price-original">${price.originalHtml}</span>`;
  }
  return `<span class="text-hof-ink">${price.currentHtml}</span>`;
}

/** CTA auf der Karte: kein „Zuschnitt wählen“ bei reiner Stückware ohne Cuts */
function productCtaLabel(product) {
  const pricingType = resolvePricingType(product);
  if (pricingType === 'slice_pack') return 'Packung wählen';
  const hasCuts = Array.isArray(product.cutOptions) && product.cutOptions.length > 1;
  if (hasCuts) return 'Zuschnitt wählen';
  if (pricingType === 'fixed') return 'Hinzufügen';
  return 'Menge wählen';
}

/** Einzelne Fix-Zuschnitte (z. B. nur „Am Stück“) nicht als Radio-Liste zeigen */
function visibleCutOptions(product) {
  const cuts = product?.cutOptions || [];
  return cuts.length > 1 ? cuts : [];
}

function renderFilters(categories) {
  const chips = [
    { id: 'all', label: 'Alle' },
    ...categories.map((category) => ({
      id: category.id,
      label: category.name,
    })),
  ];
  els.filters.innerHTML = chips.map((chip) => `
    <button type="button" role="tab" data-filter="${escapeHtml(chip.id)}"
      aria-selected="${state.categoryFilter === chip.id ? 'true' : 'false'}"
      class="shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
        state.categoryFilter === chip.id
          ? 'border-hof-pine bg-hof-pine text-white'
          : 'border-hof-sand bg-white text-hof-pine hover:bg-hof-cream'
      }">${escapeHtml(chip.label)}</button>
  `).join('');
}

function adminToolbarHtml(product) {
  if (!state.adminMode) return '';
  const hidden = !isProductActive(product);
  return `
    <div class="admin-toolbar">
      <button type="button" data-admin-toggle-active="${escapeHtml(product.id)}">
        ${hidden ? '👁️ Einblenden' : '👁️ Ausblenden'}
      </button>
      <button type="button" data-admin-promo="${escapeHtml(product.id)}">🔥 Aktion anlegen</button>
    </div>
  `;
}

function renderCatalog() {
  const allCategories = catalogCategories();
  renderFilters(allCategories);
  const categories = state.categoryFilter === 'all'
    ? allCategories
    : allCategories.filter((category) => category.id === state.categoryFilter);

  if (!categories.length) {
    els.catalog.innerHTML = '<p class="text-sm text-hof-muted">Keine Artikel in dieser Kategorie.</p>';
    return;
  }

  els.catalog.innerHTML = categories.map((category) => {
    const products = category.products.map((product) => {
      if (product.comingSoon || category.placeholder) {
        return `
          <article class="rounded-2xl border border-dashed border-hof-sand bg-white/50 p-4 opacity-80">
            <h4 class="font-semibold text-hof-muted">${escapeHtml(product.name)}</h4>
            <p class="mt-1 text-sm text-hof-muted">Demnächst</p>
          </article>
        `;
      }

      const soldOut = isProductSoldOut(product);
      const inactive = !isProductActive(product);
      const priceMeta = describeProductPrice(product);
      const badges = [
        priceMeta.badge ? `<span class="badge-pill badge-aktion">${escapeHtml(priceMeta.badge)}</span>` : '',
        soldOut ? '<span class="badge-pill badge-soldout">Ausverkauft</span>' : '',
        inactive && state.adminMode ? '<span class="badge-pill badge-hidden">Ausgeblendet</span>' : '',
      ].filter(Boolean).join(' ');

      const cta = soldOut ? 'Ausverkauft' : productCtaLabel(product);
      const artMeta = product.artNr
        ? `<p class="mt-1 text-[11px] uppercase tracking-wide text-hof-muted">ArtNr ${escapeHtml(product.artNr)}${product.wg ? ` · WG ${product.wg}` : ''}</p>`
        : '';
      const btnClass = soldOut
        ? 'mt-4 rounded-xl bg-stone-300 px-3 py-2.5 text-sm font-bold text-stone-600 cursor-not-allowed'
        : 'mt-4 rounded-xl bg-hof-pine px-3 py-2.5 text-sm font-bold text-white hover:bg-hof-moss';

      return `
        <article class="product-card flex flex-col rounded-2xl border border-hof-sand bg-white p-4 ${inactive ? 'opacity-70' : ''}" data-category="${escapeHtml(category.id)}" data-product-id="${escapeHtml(product.id)}">
          <div class="flex-1">
            <div class="mb-1 flex flex-wrap gap-1">${badges}</div>
            <h4 class="text-lg font-bold text-hof-pine">${escapeHtml(product.name)}</h4>
            <p class="mt-0.5 text-sm text-hof-muted">${escapeHtml(product.subtitle || '')}</p>
            ${artMeta}
            <p class="mt-3 text-sm font-semibold">${productPriceHtml(product)}</p>
          </div>
          <button type="button" data-add="${escapeHtml(product.id)}" class="${btnClass}" ${soldOut ? 'disabled aria-disabled="true"' : ''}>${cta}</button>
          ${adminToolbarHtml(product)}
        </article>
      `;
    }).join('');

    return `
      <section data-category-section="${escapeHtml(category.id)}">
        <div class="mb-4">
          <h3 class="font-display text-2xl text-hof-pine">${escapeHtml(category.name)}</h3>
          <p class="mt-1 text-sm text-hof-muted">${escapeHtml(category.description || '')}</p>
        </div>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">${products}</div>
      </section>
    `;
  }).join('');
}

function optionButtons(container, options, name, selectedId) {
  if (!options?.length) {
    container.innerHTML = '<p class="text-sm text-hof-muted">Keine Extra-Auswahl nötig.</p>';
    return;
  }
  container.innerHTML = options.map((opt, idx) => `
    <label class="flex cursor-pointer items-start gap-3 rounded-xl border border-hof-sand px-3 py-2.5 hover:bg-hof-cream/70">
      <input type="radio" name="${name}" value="${escapeHtml(opt.id)}" class="mt-1" ${((selectedId && opt.id === selectedId) || (!selectedId && idx === 0)) ? 'checked' : ''}>
      <span>
        <span class="block text-sm font-semibold text-hof-pine">${escapeHtml(opt.label)}</span>
        ${opt.hint ? `<span class="block text-xs text-hof-muted">${escapeHtml(opt.hint)}</span>` : ''}
      </span>
    </label>
  `).join('');
}

function readCutSelection(product) {
  const pricingType = resolvePricingType(product);
  const piecesInput = document.getElementById('cut-pieces');
  const weightInput = document.getElementById('cut-weight');
  const pieces = Math.max(1, Number(piecesInput.value) || product?.defaultPieces || 1);
  const allowWeight = product?.allowWeight !== false && pricingType !== 'slice_pack';
  const weightKg = allowWeight && !weightInput.disabled
    ? (Number(weightInput.value) || 0)
    : 0;
  let packGrams = 0;
  if (pricingType === 'slice_pack') {
    const selected = selectedRadio('packSize');
    packGrams = Number(selected) || Number(product.defaultPackGrams) || 100;
  }
  return { pieces, weightKg, packGrams };
}

function effectiveCutProduct(product, weightKg) {
  if (!product) return product;
  if (isHackfleischProduct(product)) {
    return applyHackfleischTier(product, weightKg);
  }
  return product;
}

function syncCutModalMeta(product) {
  if (!product) return;
  const meta = [
    product.categoryName || '',
    product.artNr ? `ArtNr ${product.artNr}` : '',
  ].filter(Boolean).join(' · ');
  document.getElementById('cut-category').textContent = meta;
  document.getElementById('cut-price-line').innerHTML = productPriceHtml(product);
  const badgeHost = document.getElementById('cut-tier-badge');
  if (badgeHost) {
    if (product.badge) {
      badgeHost.classList.remove('hidden');
      badgeHost.textContent = product.badge;
    } else {
      badgeHost.classList.add('hidden');
      badgeHost.textContent = '';
    }
  }
}

function updateCutEstimate() {
  const product = productById(state.activeProductId);
  if (!product) return;
  const pricingType = resolvePricingType(product);
  const { pieces, weightKg, packGrams } = readCutSelection(product);
  const cutId = resolvedCutId(product);
  const priced = effectiveCutProduct(product, weightKg);
  syncCutModalMeta(priced);
  const estimate = estimateLinePrice(priced, { pieces, weightKg, packGrams });
  let hint = '';
  if (pricingType === 'per_piece') {
    const unit = estimateUnitPrice(priced);
    if (unit > 0) hint = ` (${pieces}× ca. ${formatEuro(unit)})`;
  } else if (pricingType === 'slice_pack') {
    hint = ` (${packGrams} g)`;
  } else if (weightKg > 0) {
    hint = ` (${formatEuro(priced.pricePerKg || 0)}/kg)`;
  }
  if (priced.badge) hint += ` · ${priced.badge}`;
  else if (hasPromoPrice(priced)) hint += ' · Aktion';
  document.getElementById('cut-estimate').textContent =
    `Geschätzter Preis: ${formatEuro(estimate)}${hint} · Abrechnung nach Waage`;

  const validationEl = document.getElementById('cut-validation');
  const submitBtn = document.getElementById('btn-cut-submit');
  const validation = pricingType === 'slice_pack'
    ? { ok: true }
    : validateCutSelection(product, { pieces, weightKg, cutId });
  if (validationEl) {
    if (validation.ok) {
      validationEl.classList.add('hidden');
      validationEl.textContent = '';
    } else {
      validationEl.classList.remove('hidden');
      validationEl.textContent = validation.message || 'Bitte Zuschnitt und Gewicht prüfen.';
    }
  }
  if (submitBtn) submitBtn.disabled = !validation.ok;
}

function openCutModal(productId) {
  const product = productById(productId);
  if (!product || product.comingSoon) return;
  if (isProductSoldOut(product)) {
    showToast('Dieser Artikel ist gerade ausverkauft', 'error');
    return;
  }
  if (!state.adminMode && !isProductActive(product)) return;
      state.activeProductId = product.id;
      const pricingType = resolvePricingType(product);
      document.getElementById('cut-product-id').value = product.id;
      document.getElementById('cut-title').textContent = product.name;
      document.getElementById('cut-note').value = '';
      document.getElementById('cut-note').placeholder = product.notePlaceholder || 'Besonderer Wunsch …';
      syncCutModalMeta(product);

  const piecesWrap = document.getElementById('cut-pieces-wrap');
  const weightWrap = document.getElementById('cut-weight-wrap');
  const packWrap = document.getElementById('pack-size-wrap');
  const piecesInput = document.getElementById('cut-pieces');
  const weightInput = document.getElementById('cut-weight');
  const isSlice = pricingType === 'slice_pack';
  const showPieces = !isSlice && product.allowPieces !== false;
  const showWeight = !isSlice && product.allowWeight !== false;

  piecesWrap.classList.toggle('hidden', !showPieces);
  weightWrap.classList.toggle('hidden', !showWeight);
  packWrap.classList.toggle('hidden', !isSlice);
  piecesInput.disabled = !showPieces;
  weightInput.disabled = !showWeight;
  piecesInput.value = product.defaultPieces || 1;
  weightInput.value = showWeight
    ? (product.defaultWeightKg || (product.typicalWeightKg || 0) * (product.defaultPieces || 1) || '')
    : '';

      if (isSlice) {
        const packs = getPackSizeOptions(product);
        const selected = String(product.defaultPackGrams || packs[0]?.grams || 100);
        optionButtons(
          document.getElementById('pack-size-options'),
          packs.map((pack) => ({ id: pack.id, label: pack.label })),
          'packSize',
          selected,
        );
        document.getElementById('cut-options-label').textContent = 'Schnittstärke';
      } else {
        document.getElementById('pack-size-options').innerHTML = '';
        document.getElementById('cut-options-label').textContent = 'Schnittstärke / Zuschnitt';
      }

      const cutsForUi = isSlice ? (product.cutOptions || []) : visibleCutOptions(product);
      const cutWrap = document.getElementById('cut-options-wrap');
      const vacWrap = document.getElementById('vacuum-options-wrap');
      const stateWrap = document.getElementById('state-options-wrap');
      cutWrap.classList.toggle('hidden', !cutsForUi.length);
      vacWrap.classList.toggle('hidden', !(product.vacuumOptions && product.vacuumOptions.length));
      if (stateWrap) stateWrap.classList.remove('hidden');
      optionButtons(document.getElementById('cut-options'), cutsForUi, 'cutOption', cutsForUi[0]?.id);
      optionButtons(document.getElementById('vacuum-options'), product.vacuumOptions || [], 'vacuumOption', product.vacuumOptions?.[0]?.id);
      optionButtons(
        document.getElementById('state-options'),
        PRODUCT_STATE_OPTIONS,
        'productState',
        PRODUCT_STATE_OPTIONS[0]?.id,
      );
      const stateHint = document.getElementById('state-options-hint');
      if (stateHint) stateHint.textContent = PRODUCT_STATE_HINT;
      updateCutEstimate();
      openLayer(els.cutModal);
    }

    function resolvedCutId(product) {
      const selected = selectedRadio('cutOption');
      if (selected) return selected;
      return product?.cutOptions?.[0]?.id || '';
    }

function selectedRadio(name) {
  const el = document.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : '';
}

function labelForOption(options, id) {
  return options?.find((o) => o.id === id)?.label || '';
}

document.getElementById('cut-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const product = productById(state.activeProductId);
  if (!product) return;
  if (isProductSoldOut(product)) {
    showToast('Dieser Artikel ist gerade ausverkauft', 'error');
    return;
  }

  const pricingType = resolvePricingType(product);
  const { pieces, weightKg, packGrams } = readCutSelection(product);
  if (pricingType !== 'slice_pack' && product.allowPieces !== false && !(pieces >= 1)) {
    showToast('Bitte eine Stückzahl angeben', 'error');
    return;
  }
  if (pricingType !== 'slice_pack' && product.allowWeight !== false && product.allowPieces === false && !(weightKg > 0)) {
    showToast('Bitte ein Gewicht angeben', 'error');
    return;
  }
  if (pricingType === 'slice_pack' && !(packGrams > 0)) {
    showToast('Bitte eine Packungsgröße wählen', 'error');
    return;
  }

      const cutId = resolvedCutId(product);
      if (pricingType !== 'slice_pack') {
        const validation = validateCutSelection(product, { pieces, weightKg, cutId });
        if (!validation.ok) {
          updateCutEstimate();
          showToast(validation.message || 'Bitte Zuschnitt und Gewicht prüfen', 'error');
          return;
        }
      }
      const vacuumId = selectedRadio('vacuumOption');
      const stateId = selectedRadio('productState') || 'frisch';
      const note = String(document.getElementById('cut-note').value || '').trim();
      const estimatedWeightKg = pricingType === 'slice_pack'
        ? roundMoneyLike(packGrams / 1000)
        : (product.allowWeight !== false && weightKg > 0
          ? weightKg
          : roundMoneyLike((Number(product.typicalWeightKg) || 0) * pieces));
      const priced = effectiveCutProduct(product, estimatedWeightKg);
      const estimatedPrice = estimateLinePrice(priced, { pieces, weightKg: estimatedWeightKg, packGrams });

      const parts = [];
      if (pricingType === 'slice_pack') {
        parts.push(`${packGrams} g`);
      } else if (product.allowPieces !== false) {
        parts.push(`${pieces}×`);
      }
      if (estimatedWeightKg > 0 && pricingType !== 'slice_pack') {
        parts.push(`ca. ${String(estimatedWeightKg).replace('.', ',')} kg`);
      }
      const cutLabel = labelForOption(product.cutOptions, cutId);
      const vacLabel = labelForOption(product.vacuumOptions, vacuumId);
      const stateLabel = labelForOption(PRODUCT_STATE_OPTIONS, stateId);
      if (cutLabel) parts.push(cutLabel);
      if (vacLabel) parts.push(vacLabel);
      if (stateLabel) parts.push(stateLabel);
      if (note) parts.push(`Notiz: ${note}`);

      state.cart.push({
        productId: product.id,
        name: product.name,
        artNr: priced.artNr || '',
        pieces: pricingType === 'slice_pack' ? 1 : pieces,
        packGrams: pricingType === 'slice_pack' ? packGrams : 0,
        weightKg: estimatedWeightKg,
        cutId,
        vacuumId,
        stateId,
        stateLabel,
        note,
        summary: parts.join(' · '),
        estimatedPrice,
        pricePerKg: priced.pricePerKg || 0,
        tierBadge: isHackfleischProduct(product) ? (priced.badge || '') : '',
        pricingType,
      });

  closeLayer(els.cutModal);
  refreshCartUi();
  // Kein Auto-Drawer: Kunde bleibt im Sortiment und kann weiter einkaufen.
  showToast(`✓ ${product.name} zum Vorbestellkorb hinzugefügt`, 'success', 2500);
});

function roundMoneyLike(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000;
}

['cut-pieces', 'cut-weight'].forEach((id) => {
  document.getElementById(id).addEventListener('input', updateCutEstimate);
});

document.getElementById('cut-form').addEventListener('change', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
      if (target.name === 'cutOption') {
        const product = productById(state.activeProductId);
        if (product?.allowWeight !== false) {
          const pieces = Math.max(1, Number(document.getElementById('cut-pieces').value) || product.defaultPieces || 1);
          const cut = (product.cutOptions || []).find((option) => option.id === target.value);
          const minPer = Number(cut?.minWeightKgPerPiece) || 0;
          const minTotal = Number(cut?.minTotalWeightKg) || 0;
          const suggested = Number(cut?.suggestedWeightKg) || 0;
          const required = Math.max(minPer * pieces, minTotal, suggested);
          const weightInput = document.getElementById('cut-weight');
          const current = Number(weightInput.value) || 0;
          if (required > 0 && (suggested > 0 || current + 1e-9 < required)) {
            const nextWeight = suggested > 0 ? suggested : required;
            if (Math.abs(current - nextWeight) > 1e-9) {
              weightInput.value = String(Math.round(nextWeight * 100) / 100);
              if (suggested > 0 || current + 1e-9 < required) {
                showToast(`Gewicht auf ca. ${String(nextWeight).replace('.', ',')} kg angepasst (${cut.label})`, 'info', 2800);
              }
            }
          }
        }
  }
  if (target.name === 'packSize' || target.name === 'cutOption' || target.name === 'vacuumOption' || target.name === 'productState') {
    updateCutEstimate();
  }
});

els.filters.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-filter]');
  if (!btn) return;
  state.categoryFilter = btn.getAttribute('data-filter') || 'all';
  renderCatalog();
});

function openAdminPromoModal(productId) {
  const product = productById(productId);
  if (!product) return;
  document.getElementById('admin-promo-product-id').value = product.id;
  document.getElementById('admin-promo-product').textContent = `${product.name}${product.artNr ? ` · ArtNr ${product.artNr}` : ''}`;
  const pricingType = resolvePricingType(product);
  const priceInput = document.getElementById('admin-promo-price');
  const hint = document.getElementById('admin-promo-hint');
  if (pricingType === 'fixed') {
    priceInput.value = String(product.estimatedPiecePrice || '');
    hint.textContent = `Festpreis aktuell ${formatEuro(product.estimatedPiecePrice || 0)}${product.fixedOriginalPrice ? ` · vorher ${formatEuro(product.fixedOriginalPrice)}` : ''}`;
  } else {
    priceInput.value = String(product.pricePerKg || '');
    hint.textContent = `€/kg aktuell ${formatEuro(product.pricePerKg || 0)}${product.originalPricePerKg ? ` · Streichpreis ${formatEuro(product.originalPricePerKg)}` : ''}`;
  }
  document.getElementById('admin-promo-badge').value = product.badge || 'Aktion';
  document.getElementById('admin-promo-soldout').checked = isProductSoldOut(product);
  openLayer(els.adminPromoModal);
}

els.catalog.addEventListener('click', (event) => {
  const toggleBtn = event.target.closest('[data-admin-toggle-active]');
  if (toggleBtn) {
    const id = toggleBtn.getAttribute('data-admin-toggle-active');
    const product = productById(id);
    if (!product) return;
    const nextActive = !isProductActive(product);
    patchOverride(id, { active: nextActive });
    showToast(nextActive ? `${product.name} wieder sichtbar` : `${product.name} ausgeblendet`, 'success');
    return;
  }

  const promoBtn = event.target.closest('[data-admin-promo]');
  if (promoBtn) {
    openAdminPromoModal(promoBtn.getAttribute('data-admin-promo'));
    return;
  }

  const btn = event.target.closest('[data-add]');
  if (!btn || btn.disabled) return;
  openCutModal(btn.getAttribute('data-add'));
});

document.getElementById('admin-promo-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const productId = document.getElementById('admin-promo-product-id').value;
  const product = productById(productId);
  const baseProduct = findProductById(productId);
  if (!product || !baseProduct) return;
  const price = Number(document.getElementById('admin-promo-price').value);
  if (!(price > 0)) {
    showToast('Bitte einen gültigen Aktionspreis eingeben', 'error');
    return;
  }
  const badge = String(document.getElementById('admin-promo-badge').value || 'Aktion').trim() || 'Aktion';
  const soldOut = document.getElementById('admin-promo-soldout').checked;
  const pricingType = resolvePricingType(product);
  /** @type {Record<string, any>} */
  const patch = { badge, soldOut, active: true };
  if (pricingType === 'fixed') {
    const catalogOriginal = Number(baseProduct.fixedOriginalPrice) || Number(baseProduct.estimatedPiecePrice) || 0;
    const original = Math.max(catalogOriginal, Number(baseProduct.estimatedPiecePrice) || 0, price);
    patch.estimatedPiecePrice = price;
    patch.fixedOriginalPrice = original > price ? original : roundMoneyAdmin(price / 0.85);
  } else {
    const catalogOriginal = Number(baseProduct.originalPricePerKg) || Number(baseProduct.pricePerKg) || 0;
    const original = Math.max(catalogOriginal, Number(baseProduct.pricePerKg) || 0);
    patch.pricePerKg = price;
    patch.originalPricePerKg = original > price ? original : roundMoneyAdmin(price / 0.85);
  }
  patchOverride(productId, patch);
  closeLayer(els.adminPromoModal);
  showToast(`Aktion für ${product.name} gespeichert`, 'success');
});

document.getElementById('admin-promo-clear').addEventListener('click', () => {
  const productId = document.getElementById('admin-promo-product-id').value;
  const product = productById(productId);
  if (!product) return;
  const current = { ...(state.overrides[productId] || {}) };
  delete current.pricePerKg;
  delete current.originalPricePerKg;
  delete current.estimatedPiecePrice;
  delete current.fixedOriginalPrice;
  delete current.badge;
  current.soldOut = false;
  if (typeof current.active !== 'boolean') {
    delete state.overrides[productId];
  } else {
    state.overrides[productId] = { active: current.active, soldOut: false };
  }
  persistOverrides();
  renderCatalog();
  closeLayer(els.adminPromoModal);
  showToast(`Aktion für ${product.name} entfernt`, 'success');
});

function roundMoneyAdmin(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

els.cartItems.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-remove]');
  if (!btn) return;
  const idx = Number(btn.getAttribute('data-remove'));
  if (!Number.isInteger(idx)) return;
  state.cart.splice(idx, 1);
  refreshCartUi();
});

function currentChannelDays() {
  const slots = getAvailablePickupSlots(now());
  state.lastSlots = slots;
  return state.channel === 'sb' ? slots.sb : slots.counter;
}

function refreshPickupSelects() {
  const days = currentChannelDays();
  els.pickupDate.innerHTML = '';
  if (!days.length) {
    els.pickupDate.innerHTML = '<option value="">Keine Termine verfügbar</option>';
    els.pickupSlot.innerHTML = '<option value="">—</option>';
    els.channelHint.textContent = state.channel === 'sb'
      ? 'Für den SB-Kühlschrank sind gerade keine passenden Fenster frei (z. B. Bestellung nach 11:00 ohne Folgetag im Fenster).'
      : 'Für die Bedientheke sind gerade keine Freitag-/Samstag-Fenster frei.';
    return;
  }

  days.forEach((day, index) => {
    const opt = document.createElement('option');
    opt.value = day.date;
    opt.textContent = `${day.label} · ${day.weekday}`;
    if (index === 0) opt.selected = true;
    els.pickupDate.appendChild(opt);
  });
  fillSlotsForSelectedDate();
}

function fillSlotsForSelectedDate() {
  const days = currentChannelDays();
  const day = days.find((d) => d.date === els.pickupDate.value) || days[0];
  els.pickupSlot.innerHTML = '';
  if (!day) return;
  els.channelHint.textContent = day.modeLabel;
  day.slots.forEach((slot, index) => {
    const opt = document.createElement('option');
    opt.value = slot.id;
    opt.textContent = slot.label;
    if (index === 0) opt.selected = true;
    els.pickupSlot.appendChild(opt);
  });
}

function setChannel(channel) {
  state.channel = channel;
  document.getElementById('channel-counter').setAttribute('aria-pressed', channel === 'counter' ? 'true' : 'false');
  document.getElementById('channel-sb').setAttribute('aria-pressed', channel === 'sb' ? 'true' : 'false');
  refreshPickupSelects();
}

function updateSlotHint() {
  const slots = getAvailablePickupSlots(now());
  const nextCounter = slots.counter[0];
  const nextSb = slots.sb[0];
  const bits = [];
  if (nextCounter) bits.push(`Nächste Bedientheke: ${nextCounter.label}`);
  if (nextSb) bits.push(`Nächster SB-Slot: ${nextSb.label} (${nextSb.modeLabel})`);
  els.slotHint.textContent = bits.join(' · ') || 'Zeitfenster werden im Checkout berechnet.';
}

function toDatetimeLocalValue(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function applySimulator(dateOrNull) {
  state.simulatedNow = dateOrNull;
  if (dateOrNull) {
    els.simStatus.textContent = `Simulation aktiv: ${dateOrNull.toLocaleString('de-DE')}`;
    els.simDatetime.value = toDatetimeLocalValue(dateOrNull);
  } else {
    els.simStatus.textContent = 'Aktuell: echte Uhrzeit';
    els.simDatetime.value = toDatetimeLocalValue(new Date());
  }
  updateSlotHint();
  if (els.checkoutModal.classList.contains('is-open')) refreshPickupSelects();
}

document.getElementById('btn-open-sim').addEventListener('click', () => {
  els.simPanel.classList.toggle('hidden');
  if (!els.simDatetime.value) els.simDatetime.value = toDatetimeLocalValue(now());
});
document.getElementById('btn-sim-apply').addEventListener('click', () => {
  const value = els.simDatetime.value;
  if (!value) return;
  const parsed = parseDatetimeLocal(value);
  if (!parsed) {
    showToast('Bitte gültigen Zeitpunkt wählen', 'error');
    return;
  }
  applySimulator(parsed);
  showToast('Zeit-Simulator angewendet', 'success');
});
document.getElementById('btn-sim-reset').addEventListener('click', () => {
  applySimulator(null);
  showToast('Echte Uhrzeit wieder aktiv');
});

document.getElementById('channel-counter').addEventListener('click', () => setChannel('counter'));
document.getElementById('channel-sb').addEventListener('click', () => setChannel('sb'));
els.pickupDate.addEventListener('change', fillSlotsForSelectedDate);

document.getElementById('btn-header-cart').addEventListener('click', () => openLayer(els.cartDrawer));
els.fab.addEventListener('click', () => openLayer(els.cartDrawer));
document.getElementById('btn-open-sortiment')?.addEventListener('click', () => {
  if (!state.adminMode) return;
  renderSortimentAdmin();
  openLayer(els.sortimentDrawer);
});
els.sortimentList?.addEventListener('change', (event) => {
  const row = event.target.closest?.('[data-sortiment-id]');
  if (!row) return;
  applySortimentRow(row);
});
els.sortimentList?.addEventListener('input', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (!target.matches('[data-sortiment-promo], [data-sortiment-badge]')) return;
  const row = target.closest('[data-sortiment-id]');
  if (!row) return;
  applySortimentRow(row);
});
document.getElementById('btn-checkout').addEventListener('click', () => {
  if (!state.cart.length) return;
  closeLayer(els.cartDrawer);
  setChannel(state.channel);
  openLayer(els.checkoutModal);
});

document.querySelectorAll('[data-close]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const id = btn.getAttribute('data-close');
    closeLayer(document.getElementById(id));
  });
});

document.getElementById('checkout-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!state.cart.length) {
    showToast('Warenkorb ist leer', 'error');
    return;
  }
  if (!document.getElementById('nature-accept').checked) {
    showToast('Bitte die Naturprodukt-Toleranz bestätigen', 'error');
    return;
  }

  const days = currentChannelDays();
  const day = days.find((d) => d.date === els.pickupDate.value);
  const slot = day?.slots.find((s) => s.id === els.pickupSlot.value);
  if (!day || !slot) {
    showToast('Bitte Datum und Zeitfenster wählen', 'error');
    return;
  }

  const name = String(document.getElementById('customer-name').value || '').trim();
  const phone = String(document.getElementById('customer-phone').value || '').trim();
  const email = String(document.getElementById('customer-email').value || '').trim();
  if (!name || !phone || !email) {
    showToast('Bitte Kontaktdaten ausfüllen', 'error');
    return;
  }

  const ref = `SH-${Date.now().toString(36).toUpperCase()}`;
  const order = {
    ref,
    createdAt: now().toISOString(),
    channel: state.channel,
    pickupDate: day.date,
    pickupSlot: slot,
    mode: day.mode,
    customer: { name, phone, email },
    items: state.cart.slice(),
    estimatedTotal: cartTotal(),
  };

  try {
    const key = 'steveshof.preorders.v1';
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    existing.push(order);
    localStorage.setItem(key, JSON.stringify(existing));
  } catch (err) {
    console.error('[Bestellen] Speichern lokal fehlgeschlagen:', err);
  }

  state.cart = [];
  refreshCartUi();
  closeLayer(els.checkoutModal);

  const channelLabel = state.channel === 'sb' ? 'SB-Kühlschrank' : 'Bedientheke';
  document.getElementById('confirm-body').textContent =
    `${name}, deine Vorbestellung für ${day.label}, ${slot.label} (${channelLabel}) ist bei uns eingegangen. `
    + `Bereitstellungs-Info kommt per SMS an ${phone}. `
    + `Eine automatische Bestätigungs-E-Mail ist im Soft-Launch noch nicht aktiv – bitte die Referenz notieren.`;
  document.getElementById('confirm-ref').textContent = `Referenz: ${ref}`;
  openLayer(els.confirmModal);
  document.getElementById('checkout-form').reset();
  document.getElementById('nature-accept').checked = false;
});

document.getElementById('btn-confirm-done').addEventListener('click', () => {
  closeLayer(els.confirmModal);
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Escape schließt oberste Schicht
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (els.adminPromoModal.classList.contains('is-open')) return closeLayer(els.adminPromoModal);
  if (els.confirmModal.classList.contains('is-open')) return closeLayer(els.confirmModal);
  if (els.checkoutModal.classList.contains('is-open')) return closeLayer(els.checkoutModal);
  if (els.cutModal.classList.contains('is-open')) return closeLayer(els.cutModal);
  if (els.sortimentDrawer?.classList.contains('is-open')) return closeLayer(els.sortimentDrawer);
  if (els.cartDrawer.classList.contains('is-open')) return closeLayer(els.cartDrawer);
});

// Initial: alle Overlay-Layer hart verstecken (FOUC-Schutz)
closeAllLayers();
renderCatalog();
refreshCartUi();
applySimulator(null);
setChannel('counter');
if (state.adminMode) renderSortimentAdmin();

refreshOverridesFromCloud().catch((err) => {
  console.error('[Bestellen] Cloud-Overrides nicht geladen:', err);
  setSortimentStatus('Cloud-Overrides nicht erreichbar – zeige lokalen Stand');
});
