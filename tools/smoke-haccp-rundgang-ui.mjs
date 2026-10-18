/**
 * Erzeugt eine statische HTML-Vorschau des Temperatur-Rundgangs (ohne Firebase)
 * und speichert sie unter /opt/cursor/artifacts für Walkthrough-Evidence.
 */
import fs from 'node:fs';
import path from 'node:path';
import { buildStevesHofHaccpPayload } from './seed-steveshof-haccp.mjs';

const WEEKDAY_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const today = new Date().getDay();

const DEVICES = [
  { name: 'Fleischtheke', bereich: 'Verkauf', type: 'manual_temp', tempMin: 0, tempMax: 2, unit: '°C', activeDays: [4, 5, 6], sortOrder: 10, isActive: true },
  { name: 'Käsetheke (SB)', bereich: 'Verkauf', type: 'manual_temp', tempMin: 2, tempMax: 7, unit: '°C', activeDays: null, sortOrder: 20, isActive: true },
  { name: 'SB-TK Obst & Eis', bereich: 'Verkauf', type: 'manual_temp', tempMin: -24, tempMax: -18, unit: '°C', activeDays: null, sortOrder: 50, isActive: true },
  { name: 'Lager-TK-Truhe Aufbackbrötchen', bereich: 'Lager', type: 'manual_temp', tempMin: -22, tempMax: -16, unit: '°C', activeDays: null, sortOrder: 80, isActive: true },
  { name: 'Tiefkühlhaus OG', bereich: 'Obergeschoss', type: 'digital_verbund', tempMin: -24, tempMax: -18, unit: '°C', activeDays: null, sortOrder: 100, isActive: true },
  { name: 'Kühlhaus MoPro OG', bereich: 'Obergeschoss', type: 'digital_verbund', tempMin: 2, tempMax: 6, unit: '°C', activeDays: null, sortOrder: 110, isActive: true },
  { name: 'Gemüsekühlhaus OG', bereich: 'Obergeschoss', type: 'digital_verbund', tempMin: 4, tempMax: 8, unit: '°C', activeDays: null, sortOrder: 120, isActive: true },
  { name: 'Zerlegeraum OG', bereich: 'Obergeschoss', type: 'digital_verbund', tempMin: 2, tempMax: 6, unit: '°C', activeDays: null, sortOrder: 130, isActive: true },
  { name: 'Fleischkühlhaus OG', bereich: 'Obergeschoss', type: 'digital_verbund', tempMin: 0, tempMax: 2, unit: '°C', activeDays: null, sortOrder: 140, isActive: true },
  { name: 'Galloway-Reiferaum OG', bereich: 'Obergeschoss', type: 'digital_verbund', tempMin: 0, tempMax: 2, unit: '°C', activeDays: null, sortOrder: 150, isActive: true },
].map((d) => buildStevesHofHaccpPayload(d));

function isRestDay(device) {
  if (!Array.isArray(device.activeDays) || !device.activeDays.length) return false;
  return !device.activeDays.includes(today);
}

function card(device, sampleValue) {
  const rest = isRestDay(device);
  const inRange = sampleValue == null ? null : sampleValue >= device.tempMin && sampleValue <= device.tempMax;
  const ampel = inRange == null ? '' : (inRange ? 'ok' : 'bad');
  return `
    <article class="card ${ampel}${rest ? ' rest' : ''}">
      <header>
        <h3>${device.name}</h3>
        ${rest ? '<span class="badge">Ruhetag / Ausgeschaltet</span>' : ''}
      </header>
      <p>Soll: ${device.tempMin} bis ${device.tempMax} ${device.unit} · ${device.bereich}
        ${Array.isArray(device.activeDays) ? ` · Aktiv: ${device.activeDays.map((d) => WEEKDAY_LABELS[d]).join(', ')}` : ''}</p>
      ${rest ? '<p class="note">Heute keine Prüfung nötig.</p>' : `
        <div class="row">
          <button>−</button>
          <input value="${sampleValue ?? ''}" readonly>
          <button>+</button>
        </div>
        ${sampleValue != null ? `<p class="ampel ${ampel}">${inRange ? 'Im Sollbereich' : 'Außerhalb – bitte Kühlung prüfen'}</p>` : ''}
      `}
    </article>`;
}

const verbund = DEVICES.filter((d) => d.type === 'digital_verbund');
const manual = DEVICES.filter((d) => d.type === 'manual_temp');

const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>HACCP Temperatur-Rundgang – Vorschau</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 0; background: #f4f6f4; color: #1a1a1a; }
  .shell { max-width: 420px; margin: 0 auto; padding: 16px; }
  h1 { font-size: 20px; margin: 0 0 8px; }
  .chip { background: #e8f5e9; padding: 10px 12px; border-radius: 10px; font-weight: 700; margin-bottom: 12px; }
  .section { margin: 16px 0; }
  .section h2 { font-size: 13px; letter-spacing: .04em; color: #555; margin: 0 0 8px; }
  .central { background: #fff; border: 1px solid #ddd; border-radius: 12px; padding: 14px; }
  .central button { width: 100%; min-height: 56px; font-weight: 800; background: #2e7d32; color: #fff; border: 0; border-radius: 10px; }
  .card { background: #fff; border: 1px solid #ddd; border-radius: 12px; padding: 12px; margin-bottom: 10px; }
  .card.ok { border-color: #2e7d32; background: #f1f8f2; }
  .card.bad { border-color: #b71c1c; background: #fbe9e7; }
  .card.rest { opacity: .85; }
  header { display: flex; justify-content: space-between; gap: 8px; align-items: start; }
  h3 { margin: 0; font-size: 15px; }
  .badge { background: #e0e0e0; border-radius: 6px; padding: 4px 8px; font-size: 11px; font-weight: 800; }
  .row { display: grid; grid-template-columns: 48px 1fr 48px; gap: 8px; }
  .row button, .row input { min-height: 44px; font-size: 18px; font-weight: 800; text-align: center; }
  .ampel.ok { color: #1b5e20; font-weight: 800; }
  .ampel.bad { color: #b71c1c; font-weight: 800; }
  .save { width: 100%; min-height: 56px; margin-top: 12px; font-weight: 900; background: #1b5e20; color: #fff; border: 0; border-radius: 10px; }
  .meta { font-size: 12px; color: #666; }
</style>
</head>
<body>
  <div class="shell">
    <h1>Temperatur-Rundgang</h1>
    <div class="chip">Aktiver Mitarbeiter: <strong>Stephie</strong> · Heute: ${WEEKDAY_LABELS[today]}</div>
    <div class="section">
      <h2>OBERGESCHOSS · VERBUNDANLAGE</h2>
      <div class="central">
        <strong>Zentralsteuerung Verbundanlage OG (${verbund.length} Kühlstellen)</strong>
        <p class="meta">Ein Tipp quittiert alle OG-Stellen als geprüft und normgerecht.</p>
        <button type="button">✅ Zentraldisplay geprüft &amp; alle Werte normgerecht</button>
      </div>
    </div>
    <div class="section">
      <h2>VERKAUF &amp; LAGER · MANUELLE MESSPUNKTE</h2>
      ${manual.map((d, i) => card(d, i === 0 && !isRestDay(d) ? 1.5 : (i === 1 ? 8.5 : (i === 2 ? -19.5 : -18)))).join('')}
    </div>
    <button class="save" type="button">RUNDGANG ABSPEICHERN &amp; PROTOKOLLIEREN</button>
    <p class="meta">Vorschau aus Seed-Daten · ${DEVICES.length} Geräte · ${new Date().toISOString()}</p>
  </div>
</body>
</html>`;

const outDir = '/opt/cursor/artifacts';
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'haccp-rundgang-preview.html');
fs.writeFileSync(outFile, html, 'utf8');
console.log(`[ok] wrote ${outFile}`);
console.log(`[info] today=${WEEKDAY_LABELS[today]} fleischthekeRest=${isRestDay(DEVICES[0])}`);
