/**
 * MHD-Plausibilität fürs Laden-iPhone: erkennt vertauschte Tage/Jahre und absurde Vergangenheit.
 * Reine Logik – ohne DOM.
 */

/**
 * @param {string} isoDate YYYY-MM-DD
 * @param {Date|string} [today]
 * @returns {number|null} Resttage (kalendarisch), negativ = schon abgelaufen
 */
export function resttageFromIsoDate(isoDate, today = new Date()) {
  const iso = String(isoDate || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const mhd = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(mhd.getTime())) return null;
  const base = today instanceof Date ? new Date(today) : new Date(today);
  if (Number.isNaN(base.getTime())) return null;
  base.setHours(0, 0, 0, 0);
  return Math.round((mhd.getTime() - base.getTime()) / 86400000);
}

/**
 * @param {string} isoDate
 * @returns {string} TT.MM.JJJJ oder ''
 */
export function formatIsoDe(isoDate) {
  const iso = String(isoDate || '').trim().slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return '';
  return `${m[3]}.${m[2]}.${m[1]}`;
}

function isFreshCategory(kategorie = '') {
  return /frische|mopro|kühlware|kuehlware|aufschnitt|fleisch|wurst|käse|kaese/i.test(String(kategorie || ''));
}

/**
 * Wenn TT und MM vertauschbar sind und die Alternative deutlich plausibler ist.
 * @param {string} isoDate
 * @param {Date|string} [today]
 * @returns {{ altIso: string, altResttage: number }|null}
 */
export function suggestDayMonthSwap(isoDate, today = new Date()) {
  const iso = String(isoDate || '').trim().slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (day === month) return null;
  if (day < 1 || day > 12 || month < 1 || month > 31) return null;
  const altIso = `${year}-${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}`;
  const probe = new Date(`${altIso}T00:00:00`);
  if (Number.isNaN(probe.getTime())) return null;
  if (probe.getFullYear() !== year || probe.getMonth() + 1 !== day || probe.getDate() !== month) return null;
  const currentRest = resttageFromIsoDate(iso, today);
  const altRest = resttageFromIsoDate(altIso, today);
  if (!Number.isFinite(currentRest) || !Number.isFinite(altRest)) return null;
  // Nur vorschlagen, wenn aktuelles Datum unplausibel weit weg und Alternative im sinnvollen Fenster liegt.
  const currentBad = currentRest < -14 || currentRest > 400;
  const altOk = altRest >= -3 && altRest <= 400;
  if (!currentBad || !altOk) return null;
  return { altIso, altResttage: altRest };
}

/**
 * @typedef {'ok'|'warn'|'block'} MhdDateSeverity
 * @typedef {{
 *   severity: MhdDateSeverity,
 *   resttage: number|null,
 *   title: string,
 *   reason: string,
 *   hint?: string,
 *   code?: string,
 *   altIso?: string,
 * }} MhdDateAssessment
 */

/**
 * Bewertet ein MHD beim Einbuchen / Korrigieren.
 * @param {string} mhdIso
 * @param {{ kategorie?: string, today?: Date|string, historicShelfDays?: number|null }} [options]
 * @returns {MhdDateAssessment}
 */
export function assessMhdDatePlausibility(mhdIso, options = {}) {
  const today = options.today || new Date();
  const resttage = resttageFromIsoDate(mhdIso, today);
  if (!Number.isFinite(resttage)) {
    return {
      severity: 'block',
      resttage: null,
      title: 'MHD ungültig',
      reason: 'Bitte das Datum von der Verpackung als TT.MM.JJJJ eintippen.',
      code: 'invalid',
    };
  }

  const label = formatIsoDe(mhdIso) || mhdIso;
  const fresh = isFreshCategory(options.kategorie);
  const swap = suggestDayMonthSwap(mhdIso, today);

  // Extrem weit in der Vergangenheit (z. B. Jahr 02 statt 26 → 2002, oder TT/MM vertauscht).
  const pastBlockLimit = fresh ? -60 : -90;
  if (resttage <= pastBlockLimit) {
    return {
      severity: 'block',
      resttage,
      title: 'MHD-Jahr prüfen',
      reason: `${label} liegt ${Math.abs(resttage)} Tage in der Vergangenheit – das passt nicht zum heutigen Einbuchen.`,
      hint: swap
        ? `Meintest du ${formatIsoDe(swap.altIso)}? Sonst Jahr prüfen (z. B. 26 statt 02) und von der Verpackung neu tippen.`
        : 'Häufiger Tippfehler: zweistelliges Jahr (z. B. 02 statt 26) oder Tag/Monat vertauscht. Bitte MHD von der Verpackung neu tippen.',
      code: 'past_extreme',
      ...(swap ? { altIso: swap.altIso } : {}),
    };
  }

  // Schon abgelaufen beim Einbuchen – bestätigen lassen.
  if (resttage < 0) {
    return {
      severity: 'warn',
      resttage,
      title: 'MHD schon abgelaufen',
      reason: `${label} ist bereits seit ${Math.abs(resttage)} Tag${Math.abs(resttage) === 1 ? '' : 'en'} abgelaufen.`,
      hint: swap
        ? `Meintest du vielleicht ${formatIsoDe(swap.altIso)} (${swap.altResttage >= 0 ? `noch ${swap.altResttage} Tage` : 'auch abgelaufen'})? Tag und Monat vertauscht?`
        : 'Bitte noch einmal auf der Verpackung prüfen, bevor wir den Posten speichern.',
      code: 'past_soft',
      ...(swap ? { altIso: swap.altIso } : {}),
    };
  }

  // Extrem weit in der Zukunft.
  const futureBlock = fresh ? 400 : 2000;
  if (resttage > futureBlock) {
    return {
      severity: 'block',
      resttage,
      title: 'MHD zu weit in der Zukunft',
      reason: `${label} liegt ${resttage} Tage voraus – bitte Jahr und Datum prüfen.`,
      code: 'future_extreme',
    };
  }

  // Frische mit sehr langem Horizont.
  if (fresh && resttage > 90) {
    return {
      severity: 'warn',
      resttage,
      title: 'Ungewöhnlich langes MHD',
      reason: `${label} · ${resttage} Resttage bei Frische-/Kühlware – bitte Verpackung prüfen.`,
      code: 'fresh_long',
    };
  }

  // Bestehende Kurz-Haltbarkeit (Frische).
  if (fresh && resttage < 4) {
    return {
      severity: 'warn',
      resttage,
      title: 'Ungewöhnlich kurzes MHD',
      reason: `Nur ${resttage} Resttage bei Frische-/Kühlware – extrem kurz!`,
      hint: 'Bitte prüfen: Ist das MHD korrekt abgelesen?',
      code: 'fresh_short',
    };
  }

  const historic = Number(options.historicShelfDays);
  if (Number.isFinite(historic) && historic > 0 && resttage < historic * 0.6) {
    return {
      severity: 'warn',
      resttage,
      title: 'Ungewöhnlich kurzes MHD',
      reason: `Nur ${resttage} Resttage statt üblicher ~${historic} Tage (${Math.round((resttage / historic) * 100)}%).`,
      hint: 'Bitte prüfen: Ist das MHD korrekt abgelesen?',
      code: 'historic_short',
    };
  }

  if (swap && (resttage < -3 || resttage > 120)) {
    return {
      severity: 'warn',
      resttage,
      title: 'Tag und Monat prüfen',
      reason: `${label} wirkt ungewöhnlich. Meintest du ${formatIsoDe(swap.altIso)}?`,
      hint: 'Auf deutschen Verpackungen steht meist TT.MM.JJJJ – Tag zuerst.',
      code: 'day_month_swap',
      altIso: swap.altIso,
    };
  }

  return {
    severity: 'ok',
    resttage,
    title: '',
    reason: '',
    code: 'ok',
  };
}
