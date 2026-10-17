/**
 * Avery 3475 Etiketten-Druckstation (PROD.-Tab).
 * Nutzt natives window.print() mit #print-avery-container.
 */

export const AVERY_LABELS_PER_SHEET = 24;
const PRINT_BODY_CLASS = 'print-avery-3475';

export const DEFAULT_ARTICLE_OPTIONS = [
  'Galloway-Entrecôte',
  'Galloway-Roastbeef',
  'Roastbeef',
  'Hüfte',
  'Filet',
  'Beiried',
  'Tafelspitz',
  'Brust',
  'Bug',
  'Wade',
];

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** @param {string} isoDate YYYY-MM-DD */
export function formatSlaughterDateDe(isoDate) {
  const raw = String(isoDate || '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return raw;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

/**
 * Berechnet leere Offset-Zellen und befüllte Etiketten für Avery 3475.
 * @param {{ startPosition: number, count: number }} input
 */
export function planAverySheet(input = {}) {
  const startPosition = clampInt(input.startPosition, 1, AVERY_LABELS_PER_SHEET, 1);
  const count = clampInt(input.count, 1, AVERY_LABELS_PER_SHEET, 1);
  return {
    startPosition,
    count,
    emptyCount: startPosition - 1,
    filledCount: count,
    lastPosition: startPosition + count - 1,
    fitsOnSheet: startPosition + count - 1 <= AVERY_LABELS_PER_SHEET,
  };
}

function readAveryForm() {
  const articleEl = document.getElementById('avery-article');
  const lotEl = document.getElementById('avery-lot');
  const dateEl = document.getElementById('avery-slaughter-date');
  const countEl = document.getElementById('avery-label-count');
  const startEl = document.getElementById('avery-start-position');

  return {
    article: String(articleEl?.value || '').trim(),
    lot: String(lotEl?.value || '').trim(),
    slaughterDateIso: String(dateEl?.value || '').trim(),
    count: clampInt(countEl?.value, 1, AVERY_LABELS_PER_SHEET, 1),
    startPosition: clampInt(startEl?.value, 1, AVERY_LABELS_PER_SHEET, 1),
  };
}

export function validateAveryForm(form) {
  if (!form.article) {
    return 'Bitte Artikel / Teilstück eintragen.';
  }
  if (!form.lot) {
    return 'Bitte LOT / Charge eintragen.';
  }
  if (!form.slaughterDateIso) {
    return 'Bitte Schlachtdatum wählen.';
  }
  const plan = planAverySheet(form);
  if (!plan.fitsOnSheet) {
    return `Ab Position ${plan.startPosition} passen nur noch ${AVERY_LABELS_PER_SHEET - plan.startPosition + 1} Etiketten auf diesen Bogen.`;
  }
  return '';
}

function buildFilledLabel(form) {
  const dateDe = formatSlaughterDateDe(form.slaughterDateIso);
  const label = document.createElement('div');
  label.className = 'avery-label';
  label.innerHTML = `
    <div class="avery-label-article">${escapeHtml(form.article)}</div>
    <div class="avery-label-lot">LOT: ${escapeHtml(form.lot)}</div>
    <div class="avery-label-date">Schlachtdatum: ${escapeHtml(dateDe)}</div>
  `;
  return label;
}

function buildEmptyLabel() {
  const label = document.createElement('div');
  label.className = 'avery-label empty';
  label.setAttribute('aria-hidden', 'true');
  return label;
}

/**
 * Füllt #print-avery-container und öffnet den Browser-Druckdialog.
 * @returns {boolean} true wenn Druck gestartet
 */
export function printAvery3475Labels() {
  const container = document.getElementById('print-avery-container');
  if (!container) {
    console.error('[Avery3475] #print-avery-container fehlt');
    window.showToast?.('Etikettendruck ist gerade nicht bereit.', 'error');
    return false;
  }

  const form = readAveryForm();
  const error = validateAveryForm(form);
  if (error) {
    window.showToast?.(error, 'warning');
    return false;
  }

  // Formularwerte zurückschreiben (Clamping sichtbar machen)
  const countEl = document.getElementById('avery-label-count');
  const startEl = document.getElementById('avery-start-position');
  if (countEl) countEl.value = String(form.count);
  if (startEl) startEl.value = String(form.startPosition);

  container.replaceChildren();

  const plan = planAverySheet(form);
  for (let i = 0; i < plan.emptyCount; i += 1) {
    container.appendChild(buildEmptyLabel());
  }
  for (let i = 0; i < plan.filledCount; i += 1) {
    container.appendChild(buildFilledLabel(form));
  }

  document.body.classList.add(PRINT_BODY_CLASS);
  document.body.classList.remove('print-avery', 'print-zuschnittliste');

  const cleanup = () => {
    document.body.classList.remove(PRINT_BODY_CLASS);
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
  setTimeout(cleanup, 1500);
  return true;
}

function fillArticleDatalist() {
  const list = document.getElementById('avery-article-options');
  if (!list || list.dataset.filled === '1') return;
  list.dataset.filled = '1';
  list.replaceChildren(
    ...DEFAULT_ARTICLE_OPTIONS.map((name) => {
      const option = document.createElement('option');
      option.value = name;
      return option;
    }),
  );
}

export function initAveryPrintStation() {
  fillArticleDatalist();

  const printBtn = document.getElementById('btn-avery-print');
  if (printBtn && printBtn.dataset.averyBound !== '1') {
    printBtn.dataset.averyBound = '1';
    printBtn.addEventListener('click', () => {
      printAvery3475Labels();
    });
  }

  const form = document.getElementById('avery-print-form');
  if (form && form.dataset.averyBound !== '1') {
    form.dataset.averyBound = '1';
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      printAvery3475Labels();
    });
  }
}
