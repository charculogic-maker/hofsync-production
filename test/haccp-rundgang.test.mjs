/**
 * Unit tests for StevesHof HACCP seed + weekday / Ampel helpers.
 */
import { expect } from 'chai';
import {
  buildStevesHofHaccpPayload,
  haccpDeviceDocId,
} from '../tools/seed-steveshof-haccp.mjs';

function isDeviceRequiredToday(device, day) {
  if (!device?.isActive) return false;
  if (device.type !== 'manual_temp' && device.type !== 'digital_verbund') return false;
  if (!Array.isArray(device.activeDays) || device.activeDays.length === 0) return true;
  return device.activeDays.includes(day);
}

function tempInRange(device, value) {
  const temp = Number(value);
  if (!Number.isFinite(temp)) return null;
  const minOk = device.tempMin == null || temp >= Number(device.tempMin);
  const maxOk = device.tempMax == null || temp <= Number(device.tempMax);
  return minOk && maxOk;
}

describe('StevesHof HACCP seed', () => {
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

  it('Fleischtheke ist nur Do–Sa aktiv', () => {
    const fleisch = buildStevesHofHaccpPayload({
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
    expect(isDeviceRequiredToday(fleisch, 2)).to.equal(false); // Di
    expect(isDeviceRequiredToday(fleisch, 4)).to.equal(true); // Do
    expect(isDeviceRequiredToday(fleisch, 6)).to.equal(true); // Sa
  });

  it('OG-Verbund ohne activeDays ist jeden Tag aktiv', () => {
    const og = buildStevesHofHaccpPayload({
      name: 'Tiefkühlhaus OG',
      bereich: 'Obergeschoss',
      type: 'digital_verbund',
      tempMin: -24,
      tempMax: -18,
      unit: '°C',
      activeDays: null,
      sortOrder: 100,
      isActive: true,
    });
    expect(og.type).to.equal('digital_verbund');
    expect(isDeviceRequiredToday(og, 0)).to.equal(true);
    expect(isDeviceRequiredToday(og, 3)).to.equal(true);
  });

  it('Ampel: Wert im/außerhalb Sollbereich', () => {
    const device = { tempMin: 0, tempMax: 4 };
    expect(tempInRange(device, 2)).to.equal(true);
    expect(tempInRange(device, 0)).to.equal(true);
    expect(tempInRange(device, 4)).to.equal(true);
    expect(tempInRange(device, 5)).to.equal(false);
    expect(tempInRange(device, -1)).to.equal(false);
  });
});
