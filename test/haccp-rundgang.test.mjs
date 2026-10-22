/**
 * Unit tests for StevesHof HACCP seed + weekday / Ampel helpers (Laden & Lager only).
 */
import { expect } from 'chai';
import {
  STEVESHOF_HACCP_DEVICES,
  buildStevesHofHaccpPayload,
  haccpDeviceDocId,
} from '../tools/seed-steveshof-haccp.mjs';
import { formatTempInput, parseTempInput } from '../web/haccp.js';

function isDeviceRequiredToday(device, day) {
  if (!device?.isActive) return false;
  if (device.type !== 'manual_temp') return false;
  if (!Array.isArray(device.activeDays) || device.activeDays.length === 0) return true;
  return device.activeDays.includes(day);
}

function isDeviceRestDay(device, day) {
  if (!device?.isActive || device.type !== 'manual_temp') return false;
  if (!Array.isArray(device.activeDays) || device.activeDays.length === 0) return false;
  return !device.activeDays.includes(day);
}

function tempInRange(device, value) {
  const temp = Number(value);
  if (!Number.isFinite(temp)) return null;
  const minOk = device.tempMin == null || temp >= Number(device.tempMin);
  const maxOk = device.tempMax == null || temp <= Number(device.tempMax);
  return minOk && maxOk;
}

describe('StevesHof HACCP seed (Laden & Lager)', () => {
  it('enthält genau 8 Prüfstellen ohne Obergeschoss', () => {
    expect(STEVESHOF_HACCP_DEVICES).to.have.length(8);
    expect(STEVESHOF_HACCP_DEVICES.every((d) => d.type === 'manual_temp')).to.equal(true);
    expect(STEVESHOF_HACCP_DEVICES.some((d) => /OG|Obergeschoss|digital_verbund/i.test(`${d.name}${d.bereich}${d.type}`))).to.equal(false);
  });

  it('baut deterministische IDs und das neue Datenmodell', () => {
    const payload = buildStevesHofHaccpPayload({
      name: 'Fleischtheke',
      bereich: 'Verkauf',
      type: 'manual_temp',
      tempMin: 0,
      tempMax: 2,
      unit: '°C',
      activeDays: [4, 5, 6],
      sortOrder: 10,
      isActive: true,
    });
    expect(payload.id).to.equal(haccpDeviceDocId('Fleischtheke'));
    expect(payload.id).to.equal('fleischtheke');
    expect(payload.type).to.equal('manual_temp');
    expect(payload.activeDays).to.deep.equal([4, 5, 6]);
    expect(payload.tempMin).to.equal(0);
    expect(payload.tempMax).to.equal(2);
    expect(payload.tenantId).to.equal('StevesHof_Hauptbetrieb');
  });

  it('Fleischtheke ist nur Do–Sa aktiv (So–Mi Ruhetag / ausgeblendet)', () => {
    const fleisch = buildStevesHofHaccpPayload(STEVESHOF_HACCP_DEVICES[0]);
    expect(isDeviceRequiredToday(fleisch, 0)).to.equal(false); // So
    expect(isDeviceRequiredToday(fleisch, 2)).to.equal(false); // Di
    expect(isDeviceRestDay(fleisch, 0)).to.equal(true);
    expect(isDeviceRequiredToday(fleisch, 4)).to.equal(true); // Do
    expect(isDeviceRequiredToday(fleisch, 6)).to.equal(true); // Sa
  });

  it('Ampel: Wert im/außerhalb Sollbereich', () => {
    const device = { tempMin: 0, tempMax: 4 };
    expect(tempInRange(device, 2)).to.equal(true);
    expect(tempInRange(device, 0)).to.equal(true);
    expect(tempInRange(device, 4)).to.equal(true);
    expect(tempInRange(device, 5)).to.equal(false);
    expect(tempInRange(device, -1)).to.equal(false);
  });

  it('Ampel: TK-Bereich mit negativen Temperaturen', () => {
    const device = { tempMin: -24, tempMax: -18 };
    expect(tempInRange(device, -21)).to.equal(true);
    expect(tempInRange(device, -18)).to.equal(true);
    expect(tempInRange(device, -24)).to.equal(true);
    expect(tempInRange(device, -17)).to.equal(false);
    expect(tempInRange(device, 0)).to.equal(false);
  });
});

describe('HACCP Temperatur-Eingabe (Minuszeichen)', () => {
  it('parst führendes Minus und Komma', () => {
    expect(parseTempInput('-18')).to.deep.equal({ value: -18, draft: '-18', complete: true });
    expect(parseTempInput('-18,5')).to.deep.equal({ value: -18.5, draft: '-18,5', complete: true });
    expect(parseTempInput('3,5')).to.deep.equal({ value: 3.5, draft: '3,5', complete: true });
  });

  it('behält unvollständiges Minus als Draft', () => {
    expect(parseTempInput('-')).to.deep.equal({ value: null, draft: '-', complete: false });
    expect(parseTempInput('-.')).to.deep.equal({ value: null, draft: '-.', complete: false });
    expect(parseTempInput('')).to.deep.equal({ value: null, draft: '', complete: true });
  });

  it('formatiert gespeicherte Werte ohne Locale-Fallen', () => {
    expect(formatTempInput(-18)).to.equal('-18');
    expect(formatTempInput(-18.5)).to.equal('-18.5');
    expect(formatTempInput(null)).to.equal('');
  });
});
