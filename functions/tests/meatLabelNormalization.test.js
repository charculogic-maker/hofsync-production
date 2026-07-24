/**
 * Unit tests for LMIV meat-label normalization / validation failsafe.
 * Ensures the pipeline never invents EU-Bio or Deutschland.
 */
import { describe, test, expect, beforeAll } from 'vitest';

let normalizeMeatLabelPayload;
let validateMeatLabelPayload;

beforeAll(async () => {
  ({ normalizeMeatLabelPayload, validateMeatLabelPayload } = await import('../meatLabel.js'));
});

describe('meatLabel normalization – compliance failsafe', () => {
  test('empty organicAssociation stays empty (no EU-Bio default)', () => {
    const payload = normalizeMeatLabelPayload({
      lotNumber: 'LOT-1',
      healthMark: 'DE-NW-123',
      organicAssociation: '',
      animalType: 'rind',
      isSingleOrigin: true,
      slaughteredIn: 'Niederlande',
    });
    expect(payload.organicAssociation).toBe('');
    expect(payload.organicAssociation).not.toBe('EU-Bio');
  });

  test('unrecognized organicAssociation yields empty string', () => {
    const payload = normalizeMeatLabelPayload({
      lotNumber: 'LOT-2',
      organicAssociation: 'Mystery-Label-XYZ',
      animalType: 'schwein',
      raisedIn: 'Polen',
    });
    expect(payload.organicAssociation).toBe('');
  });

  test('known associations still map correctly', () => {
    expect(normalizeMeatLabelPayload({
      lotNumber: 'L',
      organicAssociation: 'bioland zertifiziert',
    }).organicAssociation).toBe('Bioland');
    expect(normalizeMeatLabelPayload({
      lotNumber: 'L',
      organicAssociation: 'Demeter',
    }).organicAssociation).toBe('Demeter');
    expect(normalizeMeatLabelPayload({
      lotNumber: 'L',
      organicAssociation: 'konventionell',
    }).organicAssociation).toBe('Keine / Konventionell');
    expect(normalizeMeatLabelPayload({
      lotNumber: 'L',
      organicAssociation: 'EU-Bio',
    }).organicAssociation).toBe('EU-Bio');
  });

  test('single origin without country does not inject Deutschland', () => {
    const payload = normalizeMeatLabelPayload({
      lotNumber: 'LOT-DE-CHECK',
      isSingleOrigin: true,
      singleOriginCountry: '',
      slaughteredIn: '',
      raisedIn: '',
      animalType: 'rind',
    });
    expect(payload.singleOriginCountry).toBe('');
    expect(payload.singleOriginCountry).not.toBe('Deutschland');
  });

  test('single origin infers country from slaughteredIn / raisedIn only', () => {
    expect(normalizeMeatLabelPayload({
      lotNumber: 'LOT-INF',
      isSingleOrigin: true,
      slaughteredIn: 'Frankreich',
    }).singleOriginCountry).toBe('Frankreich');

    expect(normalizeMeatLabelPayload({
      lotNumber: 'LOT-INF2',
      isSingleOrigin: true,
      raisedIn: 'Österreich',
    }).singleOriginCountry).toBe('Österreich');
  });

  test('string truncation respects max lengths', () => {
    const longLot = `LOT-${'X'.repeat(200)}`;
    const payload = normalizeMeatLabelPayload({
      lotNumber: longLot,
      healthMark: `HM-${'Y'.repeat(200)}`,
      organicControlBody: `DE-ÖKO-${'Z'.repeat(80)}`,
    });
    expect(payload.lotNumber.length).toBeLessThanOrEqual(80);
    expect(payload.healthMark.length).toBeLessThanOrEqual(80);
    expect(payload.organicControlBody.length).toBeLessThanOrEqual(40);
  });

  test('missing fields normalize safely without inventing compliance data', () => {
    const payload = normalizeMeatLabelPayload({});
    expect(payload.lotNumber).toBe('');
    expect(payload.healthMark).toBe('');
    expect(payload.organicAssociation).toBe('');
    expect(payload.isSingleOrigin).toBe(false);
    expect(payload.singleOriginCountry).toBe('');
    expect(payload.animalType).toBe('rind');
  });

  test('validateMeatLabelPayload allows empty organicAssociation when signal exists', () => {
    const normalized = normalizeMeatLabelPayload({
      lotNumber: 'LOT-OK',
      organicAssociation: '',
      animalType: 'schwein',
    });
    expect(() => validateMeatLabelPayload(normalized)).not.toThrow();
    expect(normalized.organicAssociation).toBe('');
  });

  test('validateMeatLabelPayload rejects empty payload without LMIV signal', () => {
    const normalized = normalizeMeatLabelPayload({
      animalType: 'rind',
      organicAssociation: '',
    });
    expect(() => validateMeatLabelPayload(normalized)).toThrow(/keine LMIV-Daten/i);
  });

  test('validateMeatLabelPayload rejects invalid animal type', () => {
    expect(() => validateMeatLabelPayload({
      animalType: 'alien',
      organicAssociation: '',
      lotNumber: 'LOT-1',
    })).toThrow(/Tierart/i);
  });

  test('country aliases normalize; empty stays empty', () => {
    expect(normalizeMeatLabelPayload({
      lotNumber: 'L',
      slaughteredIn: 'germany',
    }).slaughteredIn).toBe('Deutschland');
    expect(normalizeMeatLabelPayload({
      lotNumber: 'L',
      slaughteredIn: '',
    }).slaughteredIn).toBe('');
  });
});
