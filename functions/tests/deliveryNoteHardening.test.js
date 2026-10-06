/**
 * Unit tests for Lieferschein parseDeliveryNote path/MIME hardening.
 */
import { describe, test, expect, beforeAll, vi } from 'vitest';

let assertTenantStoragePath;
let normalizeMimeType;
let ALLOWED_MIME_TYPES;
let expandRetailLine;
let extractJsonArray;

beforeAll(async () => {
  vi.mock('firebase-admin', () => ({
    storage: () => ({ bucket: () => ({ file: () => ({}) }) }),
  }));
  ({
    assertTenantStoragePath,
    normalizeMimeType,
    ALLOWED_MIME_TYPES,
    expandRetailLine,
    extractJsonArray,
  } = await import('../deliveryNote.js'));
});

describe('parseDeliveryNote – storage path isolation', () => {
  test('accepts tenants/{tenantId}/delivery_notes/…', () => {
    expect(
      assertTenantStoragePath('StevesHof_Hauptbetrieb', 'tenants/StevesHof_Hauptbetrieb/delivery_notes/1_ls.jpg'),
    ).toBe('tenants/StevesHof_Hauptbetrieb/delivery_notes/1_ls.jpg');
  });

  test('rejects cross-tenant path', () => {
    expect(() => assertTenantStoragePath(
      'StevesHof_Hauptbetrieb',
      'tenants/TorFabrik/delivery_notes/1_ls.jpg',
    )).toThrow(/nicht zu diesem Mandanten/);
  });

  test('rejects path traversal', () => {
    expect(() => assertTenantStoragePath(
      'StevesHof_Hauptbetrieb',
      'tenants/StevesHof_Hauptbetrieb/delivery_notes/../settings/x.jpg',
    )).toThrow(/Ungültiger Speicherpfad/);
  });

  test('rejects non-delivery_notes folder under tenant', () => {
    expect(() => assertTenantStoragePath(
      'StevesHof_Hauptbetrieb',
      'tenants/StevesHof_Hauptbetrieb/chargendoku/x.jpg',
    )).toThrow(/delivery_notes/);
  });
});

describe('parseDeliveryNote – MIME tolerance', () => {
  test('maps image/jpg and extension fallbacks', () => {
    expect(normalizeMimeType('image/jpg')).toBe('image/jpeg');
    expect(normalizeMimeType('application/octet-stream', 'tenants/t/delivery_notes/a.heic')).toBe('image/heic');
    expect(normalizeMimeType('', 'file.PDF')).toBe('application/pdf');
  });

  test('allows HEIC/HEIF/PDF', () => {
    expect(ALLOWED_MIME_TYPES.has('image/heic')).toBe(true);
    expect(ALLOWED_MIME_TYPES.has('image/heif')).toBe(true);
    expect(ALLOWED_MIME_TYPES.has('application/pdf')).toBe(true);
  });
});

describe('parseDeliveryNote – Gemini JSON fences', () => {
  test('parses a markdown-wrapped JSON array', () => {
    const raw = '```json\n[{"artikel":"Kartoffelknödel 10x230g","menge":1}]\n```';
    expect(extractJsonArray(raw)).toEqual([
      { artikel: 'Kartoffelknödel 10x230g', menge: 1 },
    ]);
  });

  test('parses JSON when prose surrounds the array', () => {
    const raw = 'Hier die Positionen:\n[{"artikel":"Bananen","menge":18.14,"einheit":"kg"}]\nDanke.';
    expect(extractJsonArray(raw)[0].artikel).toBe('Bananen');
  });
});

describe('parseDeliveryNote – VPE multiplier', () => {
  test('turns inner packs into piece quantity and keeps catch weight', () => {
    expect(expandRetailLine({ artikel: 'Kartoffelknödel 10x230g', menge: 1 }).calculatedQuantity).toBe(10);
    expect(expandRetailLine({ artikel: 'Familienhonig', inhalt: '6x500g', menge: 1, einheit: 'VPE' })).toMatchObject({
      calculatedQuantity: 6,
      einheit: 'Stk',
      packMultiplier: 6,
    });
    expect(expandRetailLine({ artikel: 'Fruchtaufstrich 3x175g', menge: 2 }).calculatedQuantity).toBe(6);
    expect(expandRetailLine({ artikel: '18.14 kg Bananen', menge: 1 })).toMatchObject({
      calculatedQuantity: 18.14,
      einheit: 'kg',
      packMultiplier: 1,
    });
    expect(expandRetailLine({ artikel: 'Bananen', menge: 18.14, einheit: 'kg' })).toMatchObject({
      calculatedQuantity: 18.14,
      einheit: 'kg',
    });
  });
});
