#!/usr/bin/env node
/**
 * Physikalisch-technologisches Qualitäts-Audit der Wurstküchen-Rezepturen.
 *
 * Prüft die zentrale Masterliste (`web/rezepte.js` → bratwurstRecipes) gegen
 * Leitsatz-Regeln für Kochwurst / Brühwurst / Rohwurst / Frischware.
 *
 * Nutzung:
 *   node tools/audit-recipe-physics.mjs
 *   node tools/audit-recipe-physics.mjs --write-status   # setzt auditStatus in rezepte.js
 *   node tools/audit-recipe-physics.mjs --fix-templates # korrigiert offensichtliche Template-Fehler
 *
 * Report: reports/audit_rezepte_status.md
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REZEPTE_PATH = path.join(ROOT, 'web', 'rezepte.js');
const REPORT_PATH = path.join(ROOT, 'reports', 'audit_rezepte_status.md');

const args = new Set(process.argv.slice(2));
const WRITE_STATUS = args.has('--write-status');
const FIX_TEMPLATES = args.has('--fix-templates');

const FAMILY = {
  KOCHWURST: 'kochwurst',
  BRUEHWURST: 'bruehwurst',
  ROHWURST: 'rohwurst',
  FRISCH: 'frisch',
  OTHER: 'other',
};

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss');
}

function recipeCorpus(recipe) {
  const parts = [
    recipe?.tipp,
    recipe?.hinweis,
    recipe?.haltbar,
    recipe?.anweisung_A,
    recipe?.anweisung_B,
    recipe?.anweisung_C,
    recipe?.anweisung_D,
    recipe?.kaliber,
  ];
  const ings = Array.isArray(recipe?.ingredients)
    ? recipe.ingredients.map((ing) => `${ing?.name || ''} ${ing?.hinweis || ''}`).join(' ')
    : '';
  return normalize([...parts, ings].filter(Boolean).join('\n'));
}

function ingredientNames(recipe) {
  return (Array.isArray(recipe?.ingredients) ? recipe.ingredients : [])
    .map((ing) => normalize(ing?.name || ''))
    .filter(Boolean);
}

/**
 * Klassifikation nach Kategorie + Produktname (Leitsatz-Familien).
 */
export function classifyRecipeFamily(recipe) {
  const kat = normalize(recipe?.kat || recipe?.Kategorie || '');
  const name = normalize(recipe?.name || '');
  const hay = `${kat} ${name}`;

  if (
    /kochwurst|leberwurst|blutwurst|sulze|suelze|presskopf|schwartenmagen|aspik/.test(hay)
  ) {
    return FAMILY.KOCHWURST;
  }
  if (
    /rohwurst|salami|landjager|mett\s*wurst|mettwurst|pfefferbeisser|peitsche|lap\s*cheong|lapcheong/.test(hay)
  ) {
    return FAMILY.ROHWURST;
  }
  if (
    /patties|burger|frische bratwurst|frischware|thekenware|\bmett\b/.test(hay)
    || (kat.includes('frisch') && /bratwurst|griller|salsiccia|merguez|saucisse/.test(hay))
  ) {
    return FAMILY.FRISCH;
  }
  if (
    /bruhwurst|bruehwurst|knacker|jagdwurst|fleischkase|wiener|lyoner|bierwurst|fleischwurst|rostbrat|currywurst/.test(hay)
    || (kat.includes('bruh') || kat.includes('brueh'))
  ) {
    return FAMILY.BRUEHWURST;
  }
  // Chili-Cheese-Griller & ähnliche Brühwurst-Grillprodukte ohne „frisch“
  if (/griller/.test(hay) && !/frisch|gin|rum|stormy|mary|chorizo-griller/.test(hay) && kat.includes('bruh')) {
    return FAMILY.BRUEHWURST;
  }
  if (/bruhwurst|bruehwurst/.test(kat) || kat === 'bruhwurst') {
    return FAMILY.BRUEHWURST;
  }
  if (kat.includes('bruh') || kat.includes('brueh')) {
    return FAMILY.BRUEHWURST;
  }
  return FAMILY.OTHER;
}

/** Extrahiert Ziel-/Kuttertemperaturen aus SOP-Text (ignoriert Lager-/Rückkühl-Hinweise). */
export function extractCutterTargetTemps(corpus) {
  const temps = [];
  const patterns = [
    /(?:kutter(?:end)?(?:temperatur)?|fertigbraet(?:temperatur)?|braet(?:temperatur)?|ziel(?:temperatur)?|masse(?:\s+moeglichst|\s+moglichst)?\s+(?:unter|max\.?|bis))\s*(?:von\s*)?(?:ca\.?\s*)?(≤|<=|unter|max\.?|bis)?\s*(\d{1,2}(?:[.,]\d+)?)\s*(?:°|grad)/gi,
    /warmemulsion[^\n]{0,40}?(\d{1,2})\s*[–\-bis]+\s*(\d{1,2})\s*(?:°|grad)/gi,
    /kaltkutterung[^\n]{0,30}?(≤|<=)?\s*(\d{1,2})\s*(?:°|grad)/gi,
  ];

  for (const re of patterns) {
    let m;
    while ((m = re.exec(corpus)) !== null) {
      const nums = m.slice(1).map((v) => String(v || '').replace(',', '.')).filter((v) => /^\d/.test(v));
      nums.forEach((n) => {
        const val = Number(n);
        if (Number.isFinite(val) && val <= 60) temps.push(val);
      });
    }
  }
  return temps;
}

function mentionsProhibitedColdCutter(corpus) {
  return /keine\s+kaltkutterung|nicht\s+kalt\s+kuttern|kein\s+kaltkutter|warmemulsion/.test(corpus);
}

function mentionsColdCutterProcess(corpus) {
  // Prozess-Anweisung (nicht Verbot): Eisschüttung / Kaltkutterung als Arbeitsziel
  if (mentionsProhibitedColdCutter(corpus) && !/\beisschuetting\b|\beisschnee\b|\bcrushed ice\b|\bkaltkuttern\b/.test(corpus)) {
    // „KEINE Kaltkutterung“ allein ist kein Fehlerprozess
    if (/kaltkutterung/.test(corpus) && /keine\s+kaltkutterung/.test(corpus)) {
      return false;
    }
  }
  return /\beisschuetting\b|\beisschuttung\b|\beisschnee\b|\bcrushed ice\b|\bkaltkutterung\b|\bkalt\s+kuttern\b|\beis\s+oder\s+schuettung\b|\beiswasser\b.*kuttern/.test(corpus);
}

function mentionsWarmEmulsion(corpus) {
  return /warmemulsion|heissverarbeitung|heiss\s+verarbeiten|warm\s+verarbeiten|42\s*[–\-bis]+\s*46|40\s*[–\-bis]+\s*48|fertigbraettemperatur\s*42/.test(corpus);
}

function mentionsHeatCookProcess(corpus) {
  // Garprozess (nicht bloße Rohstoffvorbereitung „vorgegart“)
  const hasCook =
    /\b(bruehen|bruhen|daempfen|dampfen|garen|erhitzen|pasteurisieren|wasserbad|kerntemperatur\s*(?:≥|>=|bis|=|:)?\s*\d{2})/.test(corpus)
    || /nach dem erhitzen|ueber-nacht-daempfen|über-nacht-dampfen/.test(corpus);
  if (!hasCook) return false;
  // Frischware-Prozessziel „Kerntemperatur 0 °C“ ≠ Garung
  if (/kerntemperatur\s*(?:0|<\s*2|<2)/.test(corpus) && !/(?:≥|>=)\s*7\d|72\s*bis|kerntemperatur\s*≥/.test(corpus)) {
    return false;
  }
  return true;
}

function mentionsCuring(corpus, names) {
  const joined = `${corpus} ${names.join(' ')}`;
  const hasSalt = /\b(nps|nitritpoekelsalz|nitritpokelsalz|meersalz|poekelsalz|pokelsalz|speisesalz)\b/.test(joined);
  const hasStarterOrRipe =
    /\b(starterkultur|starterkulturen|reifen|reifezeit|fermentation|umroeten|umroten|trocknen|pH)\b/.test(joined)
    || names.some((n) => /starter/.test(n));
  return hasSalt && hasStarterOrRipe;
}

function hasLiver(names) {
  // Komposita: Rinderleber, Schweineleber, Leberwurst-Einlage …
  return names.some((n) => /leber/.test(n));
}

function hasBloodOrPlasma(names) {
  return names.some((n) => /(^|[^a-z])(blut|plasma|schweineblut|rinderblut)([^a-z]|$)/.test(n) || /blut|plasma/.test(n));
}

function mentionsIceSchuettung(corpus, names) {
  const joined = `${corpus} ${names.join(' ')}`;
  return /\b(eisschnee|eisschollen|crushed ice|schuettung|schuttung|eiswasser|eiskaltes wasser|flacheisschollen)\b/.test(joined);
}

function mentionsRawSaleHint(corpus) {
  return /\b(rohabgabe|verzehr am kauftag|frischware|hackfleischprodukt|empfindliches|maximal\s*24\s*stunden|3\s*tage\s*bei|kauftag)\b/.test(corpus);
}

/**
 * @returns {{ family: string, errors: string[], warnings: string[], ok: boolean }}
 */
export function auditRecipePhysics(recipe) {
  const family = classifyRecipeFamily(recipe);
  const corpus = recipeCorpus(recipe);
  const names = ingredientNames(recipe);
  const errors = [];
  const warnings = [];
  const cutterTemps = extractCutterTargetTemps(corpus);
  const nameN = normalize(recipe?.name || '');

  if (family === FAMILY.KOCHWURST) {
    // Kaltkutter-Template in Kochwurst = physikalischer Fehler
    const coldProcess = mentionsColdCutterProcess(corpus);
    const lowCutter = cutterTemps.some((t) => t <= 15) && !mentionsProhibitedColdCutter(corpus);
    if (coldProcess && !mentionsProhibitedColdCutter(corpus)) {
      errors.push('Kochwurst: Kaltkutterung/Eisschüttung als Prozess — Warmemulsion (40–48 °C) erforderlich');
    }
    if (lowCutter) {
      errors.push(`Kochwurst: Kutter-Zieltemperatur ≤ 15 °C (${cutterTemps.filter((t) => t <= 15).join(', ')} °C) — Fettabscheidung/Grieseln`);
    }
    if (/leberwurst/.test(nameN) || /leberwurst/.test(normalize(recipe?.kat || ''))) {
      if (!hasLiver(names)) {
        errors.push('Leberwurst ohne Leber-Zutat');
      }
      if (!mentionsWarmEmulsion(corpus)) {
        warnings.push('Leberwurst: Warmemulsion 40–48 °C / 42–46 °C nicht explizit dokumentiert');
      }
    }
    if (/blutwurst/.test(nameN)) {
      if (!hasBloodOrPlasma(names)) {
        errors.push('Blutwurst ohne Blut/Plasma-Zutat');
      }
    }
    if (!mentionsHeatCookProcess(corpus) && !/aspik|konserve/.test(normalize(recipe?.kat || ''))) {
      warnings.push('Kochwurst: Gar-/Erhitzungsschritt in SOP unklar');
    }
  }

  if (family === FAMILY.BRUEHWURST) {
    const highCutter = cutterTemps.filter((t) => t > 16 && t < 40);
    if (highCutter.length) {
      errors.push(`Brühwurst: Kutter-Zieltemperatur > 16 °C (${highCutter.join(', ')} °C) — Eiweißdenaturierung vor dem Brühen`);
    }
    if (!mentionsIceSchuettung(corpus, names)) {
      warnings.push('Brühwurst: Eisschüttung/Schüttungswasser nicht erkennbar (Soll: kalt, typ. 10–14 °C)');
    }
    if (!mentionsHeatCookProcess(corpus)) {
      errors.push('Brühwurst: Garung (Brühen/Dämpfen bis ≥ 70–72 °C Kerntemperatur) fehlt in der SOP');
    } else if (!/(?:kern(?:temperatur)?)[^\n]{0,20}(?:≥|>=|min\.?|mindestens)?\s*(?:7[0-9]|8\d)/.test(corpus)
      && !/72\s*bis\s*78|70\s*[–\-]\s*72|kerntemperatur\s*72|ccp:\s*kerntemp/.test(corpus)) {
      warnings.push('Brühwurst: Kerntemperatur ≥ 70–72 °C nicht klar ausgewiesen');
    }
  }

  if (family === FAMILY.ROHWURST) {
    // Garprozess in Rohwurst verboten (kalt räuchern / reifen ist ok)
    if (/\b(bruehen|bruhen|daempfen|dampfen|pasteurisieren)\b/.test(corpus)
      || (/\bgaren\b/.test(corpus) && !/vorgegart|rohstoffe/.test(corpus))) {
      errors.push('Rohwurst: Erhitzen/Dämpfen/Brühen im Garprozess — Rohwürste dürfen nicht gegart werden');
    }
    const warmCutter = cutterTemps.filter((t) => t > 8 && t < 30);
    if (warmCutter.length && !/reife|rauch|lager/.test(corpus)) {
      // nur wenn klar als Kutter-/Verarbeitungstemperatur > 8 °C
      if (/kutter|braet|wolfen|verarbeiten/.test(corpus)) {
        errors.push(`Rohwurst: warme Kutterung/Verarbeitung > 8 °C (${warmCutter.join(', ')} °C) — frostkalt (−2 bis +2 °C) erforderlich`);
      }
    }
    if (!mentionsCuring(corpus, names)) {
      errors.push('Rohwurst: Pökelung fehlt (NPS oder Meersalz + Starterkultur/Reifezeit)');
    }
  }

  if (family === FAMILY.FRISCH) {
    if (/\b(bruehen|bruhen|daempfen|dampfen|pasteurisieren)\b/.test(corpus)) {
      errors.push('Frisch-/Thekenware: Wärmebehandlung in der Rezeptur — Rohabgabe ohne Garung vorgesehen');
    }
    if (!mentionsRawSaleHint(corpus) && !/haltbarkeit:\s*3\s*tage|empfindliches hackfleischprodukt|sofort kuehlen/.test(corpus)) {
      warnings.push('Frischware: Hinweis auf Rohabgabe / Verzehr am Kauftag bzw. kurze Kühlhaltung fehlt');
    }
  }

  return {
    family,
    errors,
    warnings,
    ok: errors.length === 0,
    cutterTemps,
  };
}

/** Offensichtliche Brühwurst-Kaltkutter-Templates in Kochwurst korrigieren. */
export function fixKochwurstColdTemplate(recipe) {
  const family = classifyRecipeFamily(recipe);
  if (family !== FAMILY.KOCHWURST) return { recipe, changed: false, notes: [] };
  const notes = [];
  const next = { ...recipe };

  const coldInB = /unter\s*12\s*grad|eissch|kalt\s+einarbeiten|schuettung\s+kalt|moeglichst\s+unter\s*12/i.test(
    String(recipe.anweisung_B || ''),
  );
  const coldBruehTemplate = /bruehen oder daempfen|bei\s*72\s*bis\s*78\s*grad\s*c\s*bruehen/i.test(
    String(recipe.anweisung_D || ''),
  ) && /eis oder schuettung auf 0 bis 2/i.test(String(recipe.anweisung_A || ''));

  const isLeber = /leberwurst/i.test(String(recipe.name || ''));

  if (coldInB || coldBruehTemplate || (isLeber && !mentionsWarmEmulsion(recipeCorpus(recipe)))) {
    if (isLeber) {
      next.tipp = String(recipe.tipp || '').trim()
        || 'SOP Kochwurst: Warmemulsion Fertigbrätemperatur 42–46 °C — keine Kaltkutterung. Leberzugabe erst bei Kuttergut ≤ 48 °C.';
      if (!/warmemulsion|42/i.test(next.tipp)) {
        next.tipp = `SOP Kochwurst Leitsatz 2.232: Warmemulsion Fertigbrätemperatur 42–46 °C — KEINE Kaltkutterung auf ≤4 °C. ${next.tipp}`;
        notes.push('tipp: Warmemulsion-Hinweis ergänzt');
      }
      next.anweisung_A = 'Fleisch, Fett, Leber und Schüttung getrennt vorbereiten. Gegarte Rohstoffe warm verarbeiten (Warmemulsion), rohe Leber kalt halten. Allergenstatus vor Produktionsbeginn prüfen.';
      next.anweisung_B = 'Warmemulsion: Gegarte Rohstoffe und Schüttung zur Warmemulsion kuttern. Ziel Fertigbrätemperatur 42–46 °C — KEINE Kaltkutterung auf ≤4 °C. Leber mit Salz erst einarbeiten, wenn das Kuttergut ≤48 °C hat.';
      next.anweisung_C = String(recipe.anweisung_C || '')
        || 'Gewürze und weitere Zutaten gleichmäßig einarbeiten. In Glas, Darm oder Form füllen; Lufteinschlüsse vermeiden.';
      next.anweisung_D = 'Dämpfen/Garen bis Kerntemperatur ≥72 °C. Danach zügig abkühlen, kalt lagern und Charge dokumentieren.';
      notes.push('SOP A–D: Brühwurst-Kaltkutter-Template → Kochwurst-Warmemulsion');
    } else {
      next.anweisung_A = 'Fleisch, Fett und Schüttung getrennt vorbereiten. Gegarte Rohstoffe warm/heiß verarbeiten. Allergenstatus vor Produktionsbeginn prüfen.';
      next.anweisung_B = 'Vorgegarte Anteile heiß wolfen oder kuttern (Heißverarbeitung). Keine Kaltkutterung/Eisschüttung als Brätziel.';
      notes.push('SOP: Heißverarbeitung für Nicht-Leber-Kochwurst gesetzt');
    }
  }

  return { recipe: next, changed: notes.length > 0, notes };
}

function familyLabel(family) {
  return {
    [FAMILY.KOCHWURST]: 'Kochwurst',
    [FAMILY.BRUEHWURST]: 'Brühwurst',
    [FAMILY.ROHWURST]: 'Rohwurst',
    [FAMILY.FRISCH]: 'Frisch-/Thekenware',
    [FAMILY.OTHER]: 'Sonstige',
  }[family] || family;
}

function renderReport(results) {
  const green = results.filter((r) => r.ok && r.warnings.length === 0);
  const yellow = results.filter((r) => r.ok && r.warnings.length > 0);
  const red = results.filter((r) => !r.ok);
  const lines = [];
  lines.push('# Audit-Status Wurstrezepte (physikalisch-technologisch)');
  lines.push('');
  lines.push(`Stand: ${new Date().toISOString().slice(0, 10)}`);
  lines.push('');
  lines.push('## Kurzüberblick');
  lines.push('');
  lines.push(`| Status | Anzahl |`);
  lines.push(`|--------|--------|`);
  lines.push(`| Grün (fehlerfrei, ohne Warnung) | ${green.length} |`);
  lines.push(`| Gelb (ok, mit Warnungen) | ${yellow.length} |`);
  lines.push(`| Rot (Widersprüche / Fehler) | ${red.length} |`);
  lines.push(`| **Gesamt** | **${results.length}** |`);
  lines.push('');
  lines.push('Klassifikation: Kochwurst · Brühwurst · Rohwurst · Frisch-/Thekenware · Sonstige (Rubs, Aufschnitt, …).');
  lines.push('');
  lines.push('## Fehlerhafte / widersprüchliche Rezepte');
  lines.push('');
  if (!red.length) {
    lines.push('_Keine Fehler-Flags. Alle geprüften Kernregeln sind erfüllt._');
    lines.push('');
  } else {
    for (const r of red) {
      lines.push(`### ${r.id} — ${r.name}`);
      lines.push('');
      lines.push(`- Familie: **${familyLabel(r.family)}** (\`${r.kat}\`)`);
      lines.push(`- \`auditStatus\`: \`${r.auditStatus}\``);
      r.errors.forEach((e) => lines.push(`- ❌ ${e}`));
      r.warnings.forEach((w) => lines.push(`- ⚠️ ${w}`));
      lines.push('');
    }
  }
  lines.push('## Warnungen (ohne Fehler)');
  lines.push('');
  if (!yellow.length) {
    lines.push('_Keine offenen Warnungen._');
    lines.push('');
  } else {
    for (const r of yellow) {
      lines.push(`- **${r.id}** (${familyLabel(r.family)}): ${r.warnings.join('; ')}`);
    }
    lines.push('');
  }
  lines.push('## Alle Rezepte');
  lines.push('');
  lines.push('| ID | Name | Familie | Status | Fehler | Warnungen |');
  lines.push('|----|------|---------|--------|--------|-----------|');
  for (const r of results) {
    const st = r.ok ? (r.warnings.length ? 'gelb' : 'grün') : 'rot';
    lines.push(
      `| ${r.id} | ${r.name.replace(/\|/g, '/')} | ${familyLabel(r.family)} | ${st} / \`${r.auditStatus}\` | ${r.errors.length} | ${r.warnings.length} |`,
    );
  }
  lines.push('');
  lines.push('## Regeln (Kurz)');
  lines.push('');
  lines.push('1. **Kochwurst:** keine Kaltkutterung ≤ 15 °C / keine Eisschüttung als Brätziel; Leberwurst mit Leber + Warmemulsion 40–48 °C; Blutwurst mit Blut/Plasma.');
  lines.push('2. **Brühwurst:** Kutter ≤ 16 °C, Eisschüttung, Brühen/Dämpfen Kerntemp. ≥ 70–72 °C.');
  lines.push('3. **Rohwurst:** kein Brühen/Dämpfen; frostkalt; Pökelung (Salz + Starter/Reife).');
  lines.push('4. **Frisch-/Thekenware:** keine Wärmebehandlung; Hinweis Rohabgabe/kurze Haltbarkeit.');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function applyTemplateFixes(recipes) {
  let changed = 0;
  const notes = [];
  const nextRecipes = recipes.map((recipe) => {
    const { recipe: fixed, changed: did, notes: n } = fixKochwurstColdTemplate(recipe);
    if (did) {
      changed += 1;
      notes.push(`${fixed.id}: ${n.join('; ')}`);
      return fixed;
    }
    return recipe;
  });
  return { recipes: nextRecipes, changed, notes };
}

function writeRecipesArray(recipes) {
  let src = fs.readFileSync(REZEPTE_PATH, 'utf8');
  const start = src.indexOf('export const bratwurstRecipes = ');
  if (start < 0) throw new Error('bratwurstRecipes Export nicht gefunden');
  const arrStart = src.indexOf('[', start);
  let i = arrStart;
  let depth = 0;
  let inStr = false;
  let esc = false;
  let quote = null;
  while (i < src.length) {
    const c = src[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === quote) inStr = false;
    } else if (c === '"' || c === "'") {
      inStr = true;
      quote = c;
    } else if (c === '[') depth += 1;
    else if (c === ']') {
      depth -= 1;
      if (depth === 0) {
        const arrEnd = i + 1;
        const json = JSON.stringify(recipes, null, 2);
        src = `${src.slice(0, arrStart)}${json}${src.slice(arrEnd)}`;
        fs.writeFileSync(REZEPTE_PATH, src, 'utf8');
        return;
      }
    }
    i += 1;
  }
  throw new Error('Rezept-Array konnte nicht geschrieben werden');
}

async function loadRecipes() {
  const mod = await import(pathToFileURL(REZEPTE_PATH).href + `?t=${Date.now()}`);
  const recipes = mod.bratwurstRecipes || mod.getBratwurstRecipes?.();
  if (!Array.isArray(recipes) || !recipes.length) {
    throw new Error('Keine Rezepte in web/rezepte.js gefunden');
  }
  return recipes;
}

function printConsoleReport(results) {
  const green = results.filter((r) => r.ok && !r.warnings.length).length;
  const yellow = results.filter((r) => r.ok && r.warnings.length).length;
  const red = results.filter((r) => !r.ok).length;
  console.log('');
  console.log('══════════════════════════════════════════════════');
  console.log('  Rezept-Physik-Audit (Leitsatz-Regeln)');
  console.log('══════════════════════════════════════════════════');
  console.log(`  Rezepte gesamt : ${results.length}`);
  console.log(`  Grün           : ${green}`);
  console.log(`  Gelb (Warnung) : ${yellow}`);
  console.log(`  Rot (Fehler)   : ${red}`);
  console.log('──────────────────────────────────────────────────');
  for (const r of results) {
    const icon = !r.ok ? '✗' : r.warnings.length ? '!' : '✓';
    console.log(`${icon} ${r.id.padEnd(36)} ${familyLabel(r.family).padEnd(18)} ${r.auditStatus}`);
    r.errors.forEach((e) => console.log(`    ERROR   ${e}`));
    r.warnings.forEach((w) => console.log(`    WARN    ${w}`));
  }
  console.log('──────────────────────────────────────────────────');
  console.log(`Report: ${path.relative(ROOT, REPORT_PATH)}`);
  console.log('');
}

async function main() {
  let recipes = await loadRecipes();

  if (FIX_TEMPLATES) {
    const { recipes: fixed, changed, notes } = applyTemplateFixes(recipes);
    if (changed) {
      writeRecipesArray(fixed);
      console.log(`[fix-templates] ${changed} Rezept(e) korrigiert:`);
      notes.forEach((n) => console.log(`  - ${n}`));
      recipes = fixed;
    } else {
      console.log('[fix-templates] Keine Brühwurst-Template-Kopierfehler in Kochwurst gefunden.');
    }
  }

  const results = recipes.map((recipe) => {
    const audit = auditRecipePhysics(recipe);
    return {
      id: recipe.id,
      name: recipe.name,
      kat: recipe.kat || '',
      auditStatus: recipe.auditStatus || (audit.ok ? 'verified' : 'review_needed'),
      ...audit,
    };
  });

  // G-LW gilt nach SOP-Korrektur als Referenz-verified, sofern keine Fehler
  for (const r of results) {
    if (r.id === 'G-LW' && r.ok) r.auditStatus = 'verified';
    else if (!r.ok) r.auditStatus = 'review_needed';
    else r.auditStatus = 'verified';
  }

  if (WRITE_STATUS || FIX_TEMPLATES) {
    // Sync auditStatus back into file based on latest results
    const byId = new Map(results.map((r) => [r.id, r.auditStatus]));
    const updated = recipes.map((recipe) => ({
      ...recipe,
      auditStatus: byId.get(recipe.id) || recipe.auditStatus || 'review_needed',
    }));
    writeRecipesArray(updated);
    console.log(`[write-status] auditStatus für ${updated.length} Rezepte geschrieben.`);
  }

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, renderReport(results), 'utf8');
  printConsoleReport(results);

  const hardFails = results.filter((r) => !r.ok);
  if (hardFails.length) {
    console.error(`[audit] ${hardFails.length} Rezept(e) mit Fehler-Flags — siehe Report.`);
    process.exitCode = 1;
  }
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
