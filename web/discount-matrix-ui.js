/**
 * MHD-Rabattstaffel in „Mein Betrieb“ — mandantenspezifisch speichern.
 */

import { getAuthContext, getFirebaseAuthUser, isOfficeUser } from './auth.js';
import {
  DISCOUNT_CATEGORY_OPTIONS,
  defaultKuehlwareRules,
  defaultMilkRules,
  defaultTrockenwareRules,
  getActiveDiscountMatrix,
  getDefaultDiscountMatrix,
  loadDiscountMatrix,
  saveDiscountMatrix,
} from './discount-matrix.js';
import { isTenantAdmin } from './tenant-admin-auth.js';
import { getGlobalTenantId } from './tenant-db.js';

let draft = null;
let bound = false;
let activeCategory = '';
let refreshInFlight = null;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function canEditDiscountMatrix() {
  const user = getFirebaseAuthUser();
  const session = getAuthContext();
  return isOfficeUser(session) || isTenantAdmin(user, session);
}

function selectedCategory() {
  return document.getElementById('discount-matrix-category')?.value || '';
}

function defaultRulesForCategory(key = '') {
  if (key === 'Milch') return defaultMilkRules();
  if (key === 'Trockenware') return defaultTrockenwareRules();
  if (key === 'MoPro & Kühlware' || key === 'Fleisch') return defaultKuehlwareRules();
  return defaultKuehlwareRules();
}

function categoryHint(key = '') {
  if (key === 'Milch') {
    return 'Milch Flasche und Tetrapack: eigene Staffel, gewinnt vor Kühlware.';
  }
  if (key === 'Trockenware') {
    return 'Trockenware, Getränke, TK und Gewürze teilen sich diese Staffel.';
  }
  if (key === 'MoPro & Kühlware') {
    return 'Kühlware und MoPro ohne eigene Milch-Staffel.';
  }
  if (key === 'Fleisch') {
    return 'Fleisch und Wurst — sonst gilt die Standard-Staffel.';
  }
  return 'Standard gilt für alle Warengruppen ohne eigene Staffel.';
}

function rulesForSelected() {
  const key = selectedCategory();
  if (!key) return draft.defaultRules || [];
  return draft.categoryOverrides?.[key] || [];
}

function storeRules(rules, key = activeCategory) {
  const next = rules
    .map((rule) => ({
      daysRemainingMax: Number(rule.daysRemainingMax),
      discountPercent: Number(rule.discountPercent),
      badgeText: `🏷️ -${Number(rule.discountPercent) || 0} % Aufkleber`,
    }))
    .filter((rule) => Number.isFinite(rule.daysRemainingMax) && Number.isFinite(rule.discountPercent))
    .sort((left, right) => left.daysRemainingMax - right.daysRemainingMax);
  if (!key) {
    draft.defaultRules = next;
    return;
  }
  draft.categoryOverrides = draft.categoryOverrides || {};
  if (!next.length) delete draft.categoryOverrides[key];
  else draft.categoryOverrides[key] = next;
}

function readRowsFromDom() {
  return [...document.querySelectorAll('#discount-matrix-rules [data-discount-rule]')].map((row) => ({
    daysRemainingMax: row.querySelector('[data-discount-days]')?.value,
    discountPercent: row.querySelector('[data-discount-percent]')?.value,
  }));
}

function commitVisibleRows() {
  if (!draft) return;
  const enabled = document.getElementById('discount-matrix-enabled');
  if (enabled) draft.enabled = enabled.checked;
  storeRules(readRowsFromDom());
}

function syncEnabledToggle() {
  const enabled = document.getElementById('discount-matrix-enabled');
  if (!enabled || !draft) return;
  enabled.checked = draft.enabled !== false;
}

function syncCategoryHint() {
  const hint = document.getElementById('discount-matrix-category-hint');
  if (hint) hint.textContent = categoryHint(selectedCategory());
}

function renderRules() {
  const host = document.getElementById('discount-matrix-rules');
  if (!host || !draft) return;
  syncEnabledToggle();
  syncCategoryHint();
  const rules = rulesForSelected();
  const emptyHint = selectedCategory()
    ? 'Keine eigene Stufe. Tippe „Standard für diese Gruppe“, um die Vorlagenstaffel zu laden — oder „Neue Rabattstufe“.'
    : 'Keine Stufe. Artikel ohne Treffer bleiben ohne Rabatt-Hinweis.';
  host.innerHTML = rules.length
    ? rules.map((rule, index) => `
      <div class="discount-matrix-rule" data-discount-rule="${index}">
        <label>
          <span>Resttage bis MHD (höchstens)</span>
          <input data-discount-days type="number" inputmode="numeric" min="0" max="365" step="1" value="${escapeHtml(rule.daysRemainingMax)}" aria-label="Resttage höchstens">
        </label>
        <label>
          <span>Rabatt in %</span>
          <input data-discount-percent type="number" inputmode="decimal" min="0" max="100" step="1" value="${escapeHtml(rule.discountPercent)}" aria-label="Rabatt in Prozent">
        </label>
        <div class="discount-matrix-preview" aria-label="Badge-Vorschau">🏷️ -${escapeHtml(rule.discountPercent)} % Aufkleber</div>
        <button type="button" class="dev-dashboard-secondary-btn discount-matrix-delete" data-discount-delete="${index}" aria-label="Stufe löschen">Stufe löschen</button>
      </div>
    `).join('')
    : `<p class="dev-dashboard-intro">${emptyHint}</p>`;
}

function fillCategorySelect() {
  const select = document.getElementById('discount-matrix-category');
  if (!select) return;
  const current = select.value || activeCategory || '';
  select.innerHTML = DISCOUNT_CATEGORY_OPTIONS
    .map((option) => `<option value="${escapeHtml(option.id)}">${escapeHtml(option.label)}</option>`)
    .join('');
  select.value = DISCOUNT_CATEGORY_OPTIONS.some((option) => option.id === current) ? current : '';
  activeCategory = select.value || '';
  select.dataset.filled = '1';
}

function setStatus(message) {
  const status = document.getElementById('discount-matrix-status');
  if (!status) return;
  status.hidden = !message;
  status.textContent = message || '';
}

async function refreshCardPrices() {
  try {
    const { renderMhdList } = await import('./mhd.js');
    renderMhdList();
  } catch (err) {
    console.warn('[CharcuLogic Rabatt] MHD-Liste konnte nicht neu gezeichnet werden:', err);
  }
}

function resetSelectedCategory() {
  if (!draft) return;
  const key = selectedCategory();
  const defaults = defaultRulesForCategory(key);
  storeRules(defaults, key);
  renderRules();
  setStatus(key
    ? `Vorlage für „${key}“ geladen — bitte speichern, damit der Betrieb sie übernimmt.`
    : 'Standard-Vorlage geladen — bitte speichern, damit der Betrieb sie übernimmt.');
}

async function saveMatrix() {
  commitVisibleRows();
  const tenantId = getGlobalTenantId();
  if (!tenantId) {
    window.showToast?.('Kein Betrieb gewählt.', 'warning');
    return;
  }
  if (!canEditDiscountMatrix()) {
    window.showToast?.('Nur die Betriebsverwaltung darf die Rabattstaffel speichern.', 'warning');
    return;
  }
  const button = document.getElementById('discount-matrix-save');
  if (button) button.disabled = true;
  try {
    const user = getFirebaseAuthUser();
    draft.updatedBy = user?.email || user?.displayName || user?.uid || 'admin';
    draft.tenantId = tenantId;
    await saveDiscountMatrix(tenantId, draft);
    draft = getActiveDiscountMatrix(tenantId);
    renderRules();
    setStatus('Rabattstaffel für diesen Betrieb gespeichert.');
    window.showToast?.('Rabattstaffel gespeichert.', 'success');
    window.dispatchEvent(new CustomEvent('charculogic:discount-matrix', {
      detail: { tenantId, matrix: draft },
    }));
    await refreshCardPrices();
  } catch (err) {
    console.error('[CharcuLogic Rabatt] Speichern fehlgeschlagen:', err);
    window.showToast?.('Rabattstaffel konnte nicht gespeichert werden. Bitte erneut versuchen.', 'error');
    setStatus('Speichern fehlgeschlagen. Bitte Verbindung prüfen und erneut versuchen.');
  } finally {
    if (button) button.disabled = false;
  }
}

function bindMatrixCard() {
  const card = document.getElementById('discount-matrix-card');
  if (!card || bound) return;
  bound = true;
  fillCategorySelect();
  card.addEventListener('change', (event) => {
    if (event.target.id === 'discount-matrix-enabled') {
      if (draft) draft.enabled = event.target.checked;
      return;
    }
    if (event.target.id === 'discount-matrix-category') {
      commitVisibleRows();
      activeCategory = event.target.value || '';
      renderRules();
      return;
    }
    if (event.target.matches('[data-discount-percent]')) {
      const preview = event.target.closest('[data-discount-rule]')?.querySelector('.discount-matrix-preview');
      const percent = Math.min(100, Math.max(0, Math.round(Number(event.target.value) || 0)));
      if (preview) preview.textContent = `🏷️ -${percent} % Aufkleber`;
    }
  });
  card.addEventListener('click', (event) => {
    const remove = event.target.closest('[data-discount-delete]');
    if (remove) {
      const rules = readRowsFromDom();
      rules.splice(Number(remove.dataset.discountDelete), 1);
      storeRules(rules);
      renderRules();
      return;
    }
    if (event.target.closest('#discount-matrix-add')) {
      const rules = readRowsFromDom();
      const nextDay = rules.reduce((max, rule) => Math.max(max, Number(rule.daysRemainingMax) || 0), -1) + 1;
      rules.push({ daysRemainingMax: nextDay, discountPercent: 10 });
      storeRules(rules);
      renderRules();
      return;
    }
    if (event.target.closest('#discount-matrix-reset')) {
      resetSelectedCategory();
      return;
    }
    if (event.target.closest('#discount-matrix-save')) saveMatrix();
  });
}

/**
 * Lädt die Staffel des aktuellen (oder übergebenen) Betriebs in die Karte.
 * @param {string} [tenantId]
 */
export async function refreshDiscountMatrixUi(tenantId = getGlobalTenantId()) {
  bindMatrixCard();
  const id = String(tenantId || getGlobalTenantId() || '').trim();
  draft = id ? getActiveDiscountMatrix(id) : getDefaultDiscountMatrix();
  fillCategorySelect();
  renderRules();
  if (!id) {
    setStatus('Kein Betrieb gewählt.');
    return draft;
  }
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      draft = await loadDiscountMatrix(id);
      if (document.activeElement?.closest?.('#discount-matrix-card')) {
        // Keep typing — only refresh enabled toggle / hint when idle.
        syncEnabledToggle();
        return draft;
      }
      fillCategorySelect();
      renderRules();
      setStatus('');
      return draft;
    } catch (err) {
      console.warn('[CharcuLogic Rabatt] Matrix-Karte konnte nicht geladen werden:', err);
      setStatus('Gespeicherte Staffel konnte nicht geladen werden — Vorlage wird angezeigt.');
      return draft;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export async function initDiscountMatrixUi() {
  return refreshDiscountMatrixUi(getGlobalTenantId());
}
