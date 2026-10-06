/**
 * Deutsche Datumsfelder (TT.MM.JJJJ) – einheitlich in der gesamten App.
 * Monats-MHD (LMIV Ultimo): MMJJ / MM-YYYY → letzter Kalendertag.
 */

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DOTTED_DATE_RE = /^\d{2}\.\d{2}\.\d{4}$/;
const COMPACT_DATE_RE = /^\d{8}$/;

function isValidDateParts(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  const probe = new Date(year, month - 1, day);
  return probe.getFullYear() === year
    && probe.getMonth() === month - 1
    && probe.getDate() === day;
}

/** „0328“, „03-2028“, „03/2027“, „06.2027“ → ISO Monatsende. */
export function resolveMonthEndMhd(inputStr = '') {
  const trimmed = String(inputStr || '').trim();
  if (!trimmed) return '';
  let month = null;
  let year = null;
  const digits = trimmed.replace(/\D/g, '');
  const mmYyyy = /^(\d{1,2})[.\-/](\d{4})$/.exec(trimmed);
  const mmYy = /^(\d{1,2})[.\-/](\d{2})$/.exec(trimmed);
  if (mmYyyy) {
    month = Number.parseInt(mmYyyy[1], 10);
    year = Number.parseInt(mmYyyy[2], 10);
  } else if (mmYy) {
    month = Number.parseInt(mmYy[1], 10);
    year = 2000 + Number.parseInt(mmYy[2], 10);
  } else if (digits.length === 4) {
    month = Number.parseInt(digits.slice(0, 2), 10);
    year = 2000 + Number.parseInt(digits.slice(2, 4), 10);
  } else if (digits.length === 6) {
    const maybeMonth = Number.parseInt(digits.slice(0, 2), 10);
    const maybeYear = Number.parseInt(digits.slice(2, 6), 10);
    if (maybeMonth >= 1 && maybeMonth <= 12 && maybeYear >= 2000 && maybeYear <= 2099) {
      month = maybeMonth;
      year = maybeYear;
    }
  }
  if (!month || !year || month < 1 || month > 12 || year < 2000 || year > 2099) return '';
  const lastDay = new Date(year, month, 0).getDate();
  if (!isValidDateParts(year, month, lastDay)) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
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
  if (COMPACT_DATE_RE.test(raw)) {
    return parseGermanDateToIso(`${raw.slice(0, 2)}.${raw.slice(2, 4)}.${raw.slice(4, 8)}`);
  }
  // Tippfehler der Zifferntastatur: 052028 wird zu 05.20.28 → Mai 2028, Ultimo.
  const keypadTypo = /^(\d{1,2})[.\-/]20[.\-/](\d{2})$/.exec(raw);
  if (keypadTypo) {
    const monthEnd = resolveMonthEndMhd(`${keypadTypo[1].padStart(2, '0')}20${keypadTypo[2]}`);
    if (monthEnd) return monthEnd;
  }
  // Ultimo nur bei reinem Monatsformat, nicht bei „31.03.2028“.
  const digitsOnly = raw.replace(/\D/g, '');
  if (digitsOnly.length === 4 || /^(\d{1,2})[.\-/](\d{2,4})$/.test(raw) || (digitsOnly.length === 6 && raw === digitsOnly)) {
    const monthEnd = resolveMonthEndMhd(raw);
    if (monthEnd) return monthEnd;
  }
  const shortYear = /^(\d{2})[.\-/](\d{2})[.\-/](\d{2})$/.exec(raw);
  if (shortYear) {
    const day = Number.parseInt(shortYear[1], 10);
    const month = Number.parseInt(shortYear[2], 10);
    const year = 2000 + Number.parseInt(shortYear[3], 10);
    if (!isValidDateParts(year, month, day)) return '';
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  if (digitsOnly.length === 6 && raw === digitsOnly) {
    const day = Number.parseInt(digitsOnly.slice(0, 2), 10);
    const month = Number.parseInt(digitsOnly.slice(2, 4), 10);
    const year = 2000 + Number.parseInt(digitsOnly.slice(4, 6), 10);
    if (!isValidDateParts(year, month, day)) return '';
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  if (!DOTTED_DATE_RE.test(raw)) return '';
  const [dayStr, monthStr, yearStr] = raw.split('.');
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  const day = Number.parseInt(dayStr, 10);
  if (!isValidDateParts(year, month, day)) return '';
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
  const digitsOnly = trimmed.replace(/\D/g, '');
  // Ultimo bei MMJJ, MM-YYYY und dem Tippfehler MM.20.JJ. Nicht bei TT.MM…-Zwischenständen.
  const monthEndCandidate = digitsOnly.length === 4
    || (digitsOnly.length === 6 && trimmed === digitsOnly)
    || /^(\d{1,2})[.\-/]20[.\-/](\d{2})$/.test(trimmed)
    || /^(\d{1,2})[.\-/](\d{2,4})$/.test(trimmed);
  const monthEnd = monthEndCandidate ? resolveMonthEndMhd(trimmed) : '';
  const iso = monthEnd || parseGermanDateToIso(trimmed);
  if (!iso) {
    el.classList.add('input-date-de--invalid');
    return;
  }
  el.dataset.isoValue = iso;
  el.value = formatIsoToGerman(iso);
  el.classList.remove('input-date-de--invalid');
  if (monthEnd) {
    window.showToast?.(`MHD zum Monatsende gesetzt: ${formatIsoToGerman(iso)}`, 'info');
  }
}

function handleGermanDateInput(el) {
  if (!el) return;
  const formatted = formatDateInputWhileTyping(el.value);
  if (formatted !== el.value) el.value = formatted;
  const digitsOnly = String(el.value || '').replace(/\D/g, '');
  // Während Tippens kein Ultimo – sonst blockiert „0310…“ die TTMMJJ-Eingabe.
  if (digitsOnly.length === 4) {
    delete el.dataset.isoValue;
    el.classList.remove('input-date-de--invalid');
    return;
  }
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
    if (!el.getAttribute('placeholder')) el.setAttribute('placeholder', 'TT.MM.JJJJ oder MMJJ');
    el.setAttribute('pattern', '[0-9./\\-]{4,10}');

    if (el.dataset.isoValue) {
      el.value = formatIsoToGerman(el.dataset.isoValue);
    } else if (el.value && ISO_DATE_RE.test(el.value.trim())) {
      setGermanDateField(el, el.value.trim());
    } else if (el.value && DOTTED_DATE_RE.test(el.value.trim())) {
      normalizeGermanDateField(el);
    }

    el.addEventListener('input', () => handleGermanDateInput(el));
    el.addEventListener('blur', () => normalizeGermanDateField(el));
    el.addEventListener('change', () => normalizeGermanDateField(el));
  });
}
