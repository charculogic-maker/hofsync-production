/**
 * Deutsche Datumsfelder (TT.MM.JJJJ) – einheitlich in der gesamten App.
 */

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DOTTED_DATE_RE = /^\d{2}\.\d{2}\.\d{4}$/;

function isValidDateParts(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  const probe = new Date(year, month - 1, day);
  return probe.getFullYear() === year
    && probe.getMonth() === month - 1
    && probe.getDate() === day;
}

export function formatIsoToGerman(iso = '') {
  const raw = String(iso).trim();
  if (!ISO_DATE_RE.test(raw)) return '';
  const [y, m, d] = raw.split('-').map((part) => Number.parseInt(part, 10));
  if (!isValidDateParts(y, m, d)) return '';
  return `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`;
}

export function parseGermanDateToIso(value = '') {
  const raw = String(value).trim();
  if (!raw) return '';
  if (ISO_DATE_RE.test(raw)) return raw;
  if (!DOTTED_DATE_RE.test(raw)) return '';
  const [dayStr, monthStr, yearStr] = raw.split('.');
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  const day = Number.parseInt(dayStr, 10);
  if (!isValidDateParts(year, month, day)) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function readGermanDateField(el) {
  if (!el) return null;
  const iso = el.dataset.isoValue || parseGermanDateToIso(el.value);
  return iso || null;
}

export function setGermanDateField(el, iso = '') {
  if (!el) return;
  const normalized = parseGermanDateToIso(iso);
  if (!normalized) {
    el.value = '';
    delete el.dataset.isoValue;
    el.classList.remove('input-date-de--invalid');
    return;
  }
  el.dataset.isoValue = normalized;
  el.value = formatIsoToGerman(normalized);
  el.classList.remove('input-date-de--invalid');
}

function normalizeGermanDateField(el) {
  if (!el) return;
  const trimmed = String(el.value || '').trim();
  if (!trimmed) {
    delete el.dataset.isoValue;
    el.classList.remove('input-date-de--invalid');
    return;
  }
  const iso = parseGermanDateToIso(trimmed);
  if (!iso) {
    el.classList.add('input-date-de--invalid');
    return;
  }
  el.dataset.isoValue = iso;
  el.value = formatIsoToGerman(iso);
  el.classList.remove('input-date-de--invalid');
}

export function initGermanDateInputs(root = document) {
  const scope = root && root.querySelectorAll ? root : document;
  scope.querySelectorAll('input.input-date-de, input[type="date"].input-date-de').forEach((el) => {
    if (el.dataset.dateDeBound === '1') return;
    el.dataset.dateDeBound = '1';
    el.type = 'text';
    el.setAttribute('inputmode', 'numeric');
    el.setAttribute('autocomplete', 'off');
    el.setAttribute('maxlength', '10');
    if (!el.getAttribute('placeholder')) el.setAttribute('placeholder', 'TT.MM.JJJJ');
    if (!el.getAttribute('pattern')) el.setAttribute('pattern', '[0-9]{2}\\.[0-9]{2}\\.[0-9]{4}');

    if (el.dataset.isoValue) {
      el.value = formatIsoToGerman(el.dataset.isoValue);
    } else if (el.value && ISO_DATE_RE.test(el.value.trim())) {
      setGermanDateField(el, el.value.trim());
    } else if (el.value && DOTTED_DATE_RE.test(el.value.trim())) {
      normalizeGermanDateField(el);
    }

    el.addEventListener('blur', () => normalizeGermanDateField(el));
    el.addEventListener('change', () => normalizeGermanDateField(el));
  });
}
