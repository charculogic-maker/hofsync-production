/**
 * Büro-Karte für die mandantenspezifische MHD-Rabatt-Matrix.
 */

import { getFirebaseAuthUser, isOfficeUser } from './auth.js';
import {
  DISCOUNT_CATEGORY_OPTIONS,
  getActiveDiscountMatrix,
  loadDiscountMatrix,
  saveDiscountMatrix,
} from './discount-matrix.js';
import { getGlobalTenantId } from './tenant-db.js';

let draft = null;
let bound = false;
let activeCategory = '';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function selectedCategory() {
  return document.getElementById('discount-matrix-category')?.value || '';
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
  storeRules(readRowsFromDom());
}

function renderRules() {
  const host = document.getElementById('discount-matrix-rules');
  if (!host || !draft) return;
  const rules = rulesForSelected();
  const emptyHint = selectedCategory()
    ? 'Keine eigene Stufe. Diese Warengruppe nutzt die Standard-Staffel.'
    : 'Keine Stufe. Artikel ohne Treffer bleiben ohne Rabatt-Badge.';
  host.innerHTML = rules.length
    ? rules.map((rule, index) => `
      <div class="discount-matrix-rule" data-discount-rule="${index}">
        <label>
          <span>Resttage bis MHD</span>
          <input data-discount-days type="number" inputmode="numeric" min="0" max="365" step="1" value="${escapeHtml(rule.daysRemainingMax)}" aria-label="Resttage höchstens">
        </label>
        <label>
          <span>Rabatt in %</span>
          <input data-discount-percent type="number" inputmode="decimal" min="0" max="100" step="1" value="${escapeHtml(rule.discountPercent)}" aria-label="Rabatt in Prozent">
        </label>
        <div class="discount-matrix-preview" aria-label="Badge-Vorschau">🏷️ -${escapeHtml(rule.discountPercent)} % Aufkleber</div>
        <button type="button" class="discount-matrix-delete" data-discount-delete="${index}" aria-label="Stufe löschen">Löschen</button>
      </div>
    `).join('')
    : `<p class="admin-leitstand-hint">${emptyHint}</p>`;
}

function fillCategorySelect() {
  const select = document.getElementById('discount-matrix-category');
  if (!select || select.dataset.filled === '1') return;
  select.dataset.filled = '1';
  select.innerHTML = DISCOUNT_CATEGORY_OPTIONS
    .map((option) => `<option value="${escapeHtml(option.id)}">${escapeHtml(option.label)}</option>`)
    .join('');
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

async function saveMatrix() {
  commitVisibleRows();
  const tenantId = getGlobalTenantId();
  if (!tenantId) {
    window.showToast?.('Kein Betrieb gewählt.', 'warning');
    return;
  }
  if (!isOfficeUser()) {
    window.showToast?.('Nur das Büro darf die Rabatt-Matrix speichern.', 'warning');
    return;
  }
  const button = document.getElementById('discount-matrix-save');
  if (button) button.disabled = true;
  try {
    const user = getFirebaseAuthUser();
    draft.updatedBy = user?.email || user?.displayName || 'buero';
    draft.enabled = true;
    await saveDiscountMatrix(tenantId, draft);
    draft = getActiveDiscountMatrix(tenantId);
    renderRules();
    setStatus('Rabatt-Matrix für diesen Betrieb gespeichert.');
    window.showToast?.('Rabatt-Matrix gespeichert.', 'success');
    await refreshCardPrices();
  } catch (err) {
    console.error('[CharcuLogic Rabatt] Speichern fehlgeschlagen:', err);
    window.showToast?.('Rabatt-Matrix konnte nicht gespeichert werden.', 'error');
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
    if (event.target.closest('#discount-matrix-save')) saveMatrix();
  });
}

export async function initDiscountMatrixUi() {
  bindMatrixCard();
  const tenantId = getGlobalTenantId();
  draft = getActiveDiscountMatrix(tenantId);
  renderRules();
  if (!tenantId) return;
  draft = await loadDiscountMatrix(tenantId);
  if (document.activeElement?.closest?.('#discount-matrix-card')) return;
  renderRules();
}
