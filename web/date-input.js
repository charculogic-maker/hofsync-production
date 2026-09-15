/**
 * Deutsche Datumsfelder (TT.MM.JJJJ) – einheitlich in der gesamten App.
 * 2-stellige Jahreszahlen (z. B. 29) werden auf das aktuelle Jahrhundert ergänzt (2029).
 */

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const COMPACT_DATE_RE = /^\d{6}$|^\d{8}$/;

function isValidDateParts(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (year < 1900 || year > 2100) return false;
  const probe = new Date(year, month - 1, day);
  return probe.getFullYear() === year
    && probe.getMonth() === month - 1
    && probe.getDate() === day;
}

/**
 * Ergänzt eine genau 2-stellige Jahreszahl auf 20xx.
 * 4-stellige Jahre bleiben unverändert.
 * @param {string|number} yearPart
 * @returns {number|null}
 */
export function expandTwoDigitYear(yearPart) {
  const raw = String(yearPart ?? '').trim();
  if (!/^\d{2}$|^\d{4}$/.test(raw)) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed)) return null;
  if (raw.length === 2) return 2000 + parsed;
  return parsed;
}

export function formatIsoToGerman(iso = '') {
  const raw = String(iso).trim();
  if (!ISO_DATE_RE.test(raw)) return '';
  const [y, m, d] = raw.split('-').map((part) => Number.parseInt(part, 10));
  if (!isValidDateParts(y, m, d)) return '';
  return `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`;
}

/**
 * Parser für MHD-/Datumseingaben: akzeptiert TT.MM.JJJJ, TT.MM.JJ, TT/MM/JJ,
 * ISO (JJJJ-MM-TT) sowie kompakte Ziffernfolgen (TTMMJJ / TTMMJJJJ).
 * @param {string} value
 * @returns {string} ISO-Datum JJJJ-MM-TT oder ''
 */
export function parseMHDInput(value = '') {
  return parseGermanDateToIso(value);
}

export function parseGermanDateToIso(value = '') {
  const raw = String(value).trim();
  if (!raw) return '';
  if (ISO_DATE_RE.test(raw)) {
    const [y, m, d] = raw.split('-').map((part) => Number.parseInt(part, 10));
    return isValidDateParts(y, m, d) ? raw : '';
  }

  const digitsOnly = raw.replace(/\D/g, '');
  if (COMPACT_DATE_RE.test(digitsOnly) && !/[./\-]/.test(raw)) {
    if (digitsOnly.length === 8) {
      return parseGermanDateToIso(`${digitsOnly.slice(0, 2)}.${digitsOnly.slice(2, 4)}.${digitsOnly.slice(4, 8)}`);
    }
    if (digitsOnly.length === 6) {
      return parseGermanDateToIso(`${digitsOnly.slice(0, 2)}.${digitsOnly.slice(2, 4)}.${digitsOnly.slice(4, 6)}`);
    }
  }

  const normalized = raw.replace(/[/\-]/g, '.');
  const match = normalized.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
  if (!match) return '';

  const day = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const year = expandTwoDigitYear(match[3]);
  if (year == null || !isValidDateParts(year, month, day)) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatDateInputWhileTyping(value = '') {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
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

function handleGermanDateInput(el) {
  if (!el) return;
  const formatted = formatDateInputWhileTyping(el.value);
  if (formatted !== el.value) el.value = formatted;
  const iso = parseGermanDateToIso(formatted);
  if (iso) {
    el.dataset.isoValue = iso;
    el.classList.remove('input-date-de--invalid');
  } else {
    delete el.dataset.isoValue;
    el.classList.remove('input-date-de--invalid');
  }
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
    } else if (el.value) {
      normalizeGermanDateField(el);
    }

    el.addEventListener('input', () => handleGermanDateInput(el));
    el.addEventListener('blur', () => normalizeGermanDateField(el));
    el.addEventListener('change', () => normalizeGermanDateField(el));
  });
}
