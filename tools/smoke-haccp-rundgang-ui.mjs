/**
 * Statische HTML-Vorschau des Temperatur-Rundgangs (8 Laden/Lager-Stellen, ohne OG).
 */
import fs from 'node:fs';
import path from 'node:path';
import { STEVESHOF_HACCP_DEVICES, buildStevesHofHaccpPayload } from './seed-steveshof-haccp.mjs';

const WEEKDAY_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const today = new Date().getDay();

const DEVICES = STEVESHOF_HACCP_DEVICES.map((d) => buildStevesHofHaccpPayload(d));

function isRestDay(device) {
  if (!Array.isArray(device.activeDays) || !device.activeDays.length) return false;
  return !device.activeDays.includes(today);
}

function card(device, sampleValue) {
  const inRange = sampleValue == null ? null : sampleValue >= device.tempMin && sampleValue <= device.tempMax;
  const ampel = inRange == null ? '' : (inRange ? 'ok' : 'bad');
  return `
    <article class="card ${ampel}">
      <header>
        <h3>${device.name}</h3>
      </header>
      <p>Soll: ${device.tempMin} bis ${device.tempMax} ${device.unit} · ${device.bereich}
        ${Array.isArray(device.activeDays) ? ` · Aktiv: ${device.activeDays.map((d) => WEEKDAY_LABELS[d]).join(', ')}` : ''}</p>
      <div class="row">
        <button>−</button>
        <input value="${sampleValue ?? ''}" readonly>
        <button>+</button>
      </div>
      ${sampleValue != null ? `<p class="ampel ${ampel}">${inRange ? 'Im Sollbereich' : 'Außerhalb – bitte Kühlung prüfen'}</p>` : ''}
    </article>`;
}

const visible = DEVICES.filter((d) => !isRestDay(d));
const hiddenRest = DEVICES.filter((d) => isRestDay(d));

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
  .card { background: #fff; border: 1px solid #ddd; border-radius: 12px; padding: 12px; margin-bottom: 10px; }
  .card.ok { border-color: #2e7d32; background: #f1f8f2; }
  .card.bad { border-color: #b71c1c; background: #fbe9e7; }
  header { display: flex; justify-content: space-between; gap: 8px; align-items: start; }
  h3 { margin: 0; font-size: 15px; }
  .row { display: grid; grid-template-columns: 48px 1fr 48px; gap: 8px; }
  .row button, .row input { min-height: 44px; font-size: 18px; font-weight: 800; text-align: center; }
  .ampel.ok { color: #1b5e20; font-weight: 800; }
  .ampel.bad { color: #b71c1c; font-weight: 800; }
  .save { width: 100%; min-height: 56px; margin-top: 12px; font-weight: 900; background: #1b5e20; color: #fff; border: 0; border-radius: 10px; }
  .seed { width: 100%; min-height: 52px; margin: 8px 0; font-weight: 800; background: #1565c0; color: #fff; border: 0; border-radius: 10px; }
  .meta { font-size: 12px; color: #666; }
</style>
</head>
<body>
  <div class="shell">
    <h1>Temperatur-Rundgang</h1>
    <div class="chip">Aktiver Mitarbeiter: <strong>Stephie</strong> · Heute: ${WEEKDAY_LABELS[today]}</div>
    <button class="seed" type="button">⚡ StevesHof Standard-Geräte initial anlegen</button>
    <div class="section">
      <h2>VERKAUF &amp; LAGER (${visible.length} heute sichtbar)</h2>
      ${visible.map((d, i) => card(d, i === 0 ? 1.5 : (i === 1 ? 8.5 : (i === 2 ? -19.5 : -18)))).join('')}
    </div>
    ${hiddenRest.length ? `<p class="meta">Ausgeblendet (Ruhetag): ${hiddenRest.map((d) => d.name).join(', ')}</p>` : ''}
    <button class="save" type="button">RUNDGANG ABSPEICHERN &amp; PROTOKOLLIEREN</button>
    <p class="meta">Vorschau · ${DEVICES.length} Geräte · kein OG · ${new Date().toISOString()}</p>
  </div>
</body>
</html>`;

const outDir = '/opt/cursor/artifacts';
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'haccp-rundgang-preview.html');
fs.writeFileSync(outFile, html, 'utf8');
console.log(`[ok] wrote ${outFile}`);
console.log(`[info] today=${WEEKDAY_LABELS[today]} visible=${visible.length} restHidden=${hiddenRest.map((d) => d.name).join('|') || '-'}`);
