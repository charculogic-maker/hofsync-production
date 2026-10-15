/**
 * Abgleich: KI-Lieferschein (Soll) ↔ gescannte Wareneingangs-Posten (Ist).
 */

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function normalizeArticleKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(\d+)[,.](\d+)\b/g, '$1 $2')
    .replace(/\b(\d+)\s*l(?:iter)?\b/g, '$1 l')
    .replace(/\b(\d+)\s*kg\b/g, '$1 kg')
    .replace(/\b(\d+)\s*g\b/g, '$1 g')
    .replace(/\b(\d+)\s*stk\b/g, '$1 stk')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function tokensOf(key) {
  return key.split(' ').filter((t) => t.length > 0);
}

/**
 * Fuzzy-Match: exakt, enthält, oder starke Token-Überlappung.
 */
export function articlesLikelyMatch(a, b) {
  const ka = normalizeArticleKey(a);
  const kb = normalizeArticleKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  if (ka.includes(kb) || kb.includes(ka)) return true;
  const ta = tokensOf(ka);
  const tb = tokensOf(kb);
  if (!ta.length || !tb.length) return false;
  const setB = new Set(tb);
  const hit = ta.filter((t) => setB.has(t)).length;
  const minLen = Math.min(ta.length, tb.length);
  const maxLen = Math.max(ta.length, tb.length);
  if (minLen > 0 && hit / minLen >= 0.6) return true;
  return maxLen > 0 && hit / maxLen >= 0.6;
}

function toSollRows(items) {
  if (!Array.isArray(items)) return [];
  return items.map((entry, index) => {
    const mengeRaw = entry?.menge ?? entry?.quantity ?? 1;
    const menge = Number(mengeRaw);
    return {
      id: `soll-${index}`,
      artikel: String(entry?.artikel || entry?.name || entry?.produkt || '').trim(),
      menge: Number.isFinite(menge) && menge > 0 ? menge : 1,
      kategorie: String(entry?.kategorie || entry?.category || '').trim(),
    };
  }).filter((row) => row.artikel);
}

function toIstRows(items) {
  if (!Array.isArray(items)) return [];
  return items.map((entry, index) => {
    const mengeRaw = entry?.qtyValue ?? entry?.qtyKg ?? entry?.menge ?? entry?.qty ?? 1;
    const menge = Number(mengeRaw);
    return {
      id: String(entry?.id || `ist-${index}`),
      artikel: String(entry?.product || entry?.produkt || entry?.artikel || entry?.name || '').trim(),
      menge: Number.isFinite(menge) && menge > 0 ? menge : 1,
      einheit: String(entry?.qtyUnit || entry?.einheit || '').trim(),
      barcode: String(entry?.barcode || entry?.ean || '').trim(),
    };
  }).filter((row) => row.artikel);
}

/**
 * @returns {{ matched: Array, missingInReceiving: Array, extraInReceiving: Array, qtyMismatch: Array, summary: object }}
 */
export function reconcileDeliveryNote(sollItems, istItems) {
  const soll = toSollRows(sollItems);
  const ist = toIstRows(istItems);
  const matched = [];
  const qtyMismatch = [];
  const missingInReceiving = [];
  const extraInReceiving = [];
  const usedIst = new Set();

  for (const s of soll) {
    let bestIdx = -1;
    for (let i = 0; i < ist.length; i += 1) {
      if (usedIst.has(i)) continue;
      if (articlesLikelyMatch(s.artikel, ist[i].artikel)) {
        bestIdx = i;
        break;
      }
    }
    if (bestIdx < 0) {
      missingInReceiving.push({ ...s, status: 'missing-in-receiving' });
      continue;
    }
    usedIst.add(bestIdx);
    const iRow = ist[bestIdx];
    const qtyOk = Math.abs(Number(s.menge) - Number(iRow.menge)) < 0.011;
    const pair = {
      soll: s,
      ist: iRow,
      status: qtyOk ? 'matched' : 'qty-mismatch',
    };
    if (qtyOk) matched.push(pair);
    else qtyMismatch.push(pair);
  }

  for (let i = 0; i < ist.length; i += 1) {
    if (usedIst.has(i)) continue;
    extraInReceiving.push({ ...ist[i], status: 'extra-in-receiving' });
  }

  return {
    matched,
    qtyMismatch,
    missingInReceiving,
    extraInReceiving,
    summary: {
      sollCount: soll.length,
      istCount: ist.length,
      matchedCount: matched.length,
      qtyMismatchCount: qtyMismatch.length,
      missingCount: missingInReceiving.length,
      extraCount: extraInReceiving.length,
      ok: missingInReceiving.length === 0
        && extraInReceiving.length === 0
        && qtyMismatch.length === 0
        && soll.length > 0,
    },
  };
}

function formatQty(value, unit = '') {
  const n = Number(value);
  const label = Number.isFinite(n) ? String(n) : '–';
  return unit ? `${label} ${unit}` : label;
}

function renderSection(title, bodyHtml, tone = '') {
  if (!bodyHtml) return '';
  return `
    <section class="delivery-reconcile-section ${tone ? `delivery-reconcile-section--${tone}` : ''}">
      <h3 class="delivery-reconcile-section-title">${escapeHtml(title)}</h3>
      <ul class="delivery-reconcile-list">${bodyHtml}</ul>
    </section>
  `;
}

export function renderReconcileHtml(result) {
  const { matched, qtyMismatch, missingInReceiving, extraInReceiving, summary } = result;
  const headline = summary.ok
    ? 'Alles passt – Wareneingang und Lieferschein stimmen überein.'
    : 'Abgleich: Bitte Differenzen prüfen.';

  const matchedHtml = matched.map((row) => `
    <li class="delivery-reconcile-item delivery-reconcile-item--ok">
      <strong>${escapeHtml(row.ist.artikel)}</strong>
      <span>${escapeHtml(formatQty(row.ist.menge, row.ist.einheit))} · auf Lieferschein ${escapeHtml(formatQty(row.soll.menge))}</span>
    </li>
  `).join('');

  const qtyHtml = qtyMismatch.map((row) => `
    <li class="delivery-reconcile-item delivery-reconcile-item--warn">
      <strong>${escapeHtml(row.ist.artikel || row.soll.artikel)}</strong>
      <span>Erfasst: ${escapeHtml(formatQty(row.ist.menge, row.ist.einheit))} · Lieferschein: ${escapeHtml(formatQty(row.soll.menge))}</span>
    </li>
  `).join('');

  const missingHtml = missingInReceiving.map((row) => `
    <li class="delivery-reconcile-item delivery-reconcile-item--missing">
      <strong>${escapeHtml(row.artikel)}</strong>
      <span>Auf dem Lieferschein (${escapeHtml(formatQty(row.menge))}), noch nicht im Wareneingang</span>
    </li>
  `).join('');

  const extraHtml = extraInReceiving.map((row) => `
    <li class="delivery-reconcile-item delivery-reconcile-item--extra">
      <strong>${escapeHtml(row.artikel)}</strong>
      <span>Im Wareneingang (${escapeHtml(formatQty(row.menge, row.einheit))}), fehlt auf dem Lieferschein</span>
    </li>
  `).join('');

  return `
    <p class="learn-mode-desc delivery-reconcile-lead">${escapeHtml(headline)}</p>
    <p class="delivery-reconcile-meta">
      Lieferschein ${summary.sollCount} · Wareneingang ${summary.istCount}
      · OK ${summary.matchedCount}
      · Menge ${summary.qtyMismatchCount}
      · fehlt WE ${summary.missingCount}
      · extra WE ${summary.extraCount}
    </p>
    ${renderSection('Noch nicht erfasst (steht auf dem Lieferschein)', missingHtml, 'missing')}
    ${renderSection('Extra erfasst (steht nicht auf dem Lieferschein)', extraHtml, 'extra')}
    ${renderSection('Mengenabweichung', qtyHtml, 'warn')}
    ${renderSection('Stimmt überein', matchedHtml, 'ok')}
  `;
}

export function removeReconcileOverlay() {
  document.getElementById('delivery-reconcile-overlay')?.remove();
}

/**
 * @param {object} result reconcileDeliveryNote result
 * @param {{ onRefresh?: Function, onClose?: Function, onBookMissing?: Function }} handlers
 */
export function showReconcileOverlay(result, handlers = {}) {
  removeReconcileOverlay();
  const overlay = document.createElement('div');
  overlay.id = 'delivery-reconcile-overlay';
  overlay.className = 'learn-mode-overlay';
  overlay.innerHTML = `
    <div class="learn-mode-card delivery-note-preview-card delivery-reconcile-card" role="dialog" aria-modal="true" aria-labelledby="delivery-reconcile-title">
      <div class="learn-mode-title" id="delivery-reconcile-title">Lieferschein-Abgleich</div>
      <div class="delivery-note-preview-scroll delivery-reconcile-scroll">
        ${renderReconcileHtml(result)}
      </div>
      <div class="learn-mode-actions" style="display:flex;flex-direction:column;gap:10px;">
        <button type="button" class="btn btn-primary" id="delivery-reconcile-refresh">Abgleich aktualisieren</button>
        ${handlers.onBookMissing && result.missingInReceiving.length
          ? '<button type="button" class="btn btn-secondary" id="delivery-reconcile-book-missing">Fehlende LS-Artikel in den Bestand übernehmen</button>'
          : ''}
        <button type="button" class="btn" id="delivery-reconcile-close" style="background:#E5E5EA;color:#1C1C1E;">Schließen</button>
      </div>
    </div>
  `;
  document.querySelector('.app-container')?.appendChild(overlay);

  overlay.querySelector('#delivery-reconcile-close')?.addEventListener('click', () => {
    removeReconcileOverlay();
    handlers.onClose?.();
  });
  overlay.querySelector('#delivery-reconcile-refresh')?.addEventListener('click', () => {
    handlers.onRefresh?.();
  });
  overlay.querySelector('#delivery-reconcile-book-missing')?.addEventListener('click', () => {
    handlers.onBookMissing?.(result.missingInReceiving);
  });
}
