/**
 * Unit tests for Lieferschein parseDeliveryNote path/MIME hardening.
 */
import { describe, test, expect, beforeAll, vi } from 'vitest';

let assertTenantStoragePath;
let normalizeMimeType;
let ALLOWED_MIME_TYPES;
let expandRetailLine;
let extractJsonArray;
let parseSafeJsonArray;
let splitDeliveryDate;
let isNonStockLine;
let applyPriceQuantity;
let normalizeDeliveryLine;
let planReconciledWrites;

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
    parseSafeJsonArray,
    splitDeliveryDate,
    isNonStockLine,
    applyPriceQuantity,
    normalizeDeliveryLine,
  } = await import('../deliveryNote.js'));
  ({ planReconciledWrites } = await import('../parseDeliveryNoteCallable.js'));
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

describe('parseDeliveryNote – delivery date header', () => {
  test('keeps the invoice date and the line items', () => {
    const split = splitDeliveryDate([
      { d: '2026-10-06' },
      { n: 'Honig', q: 6 },
    ]);
    expect(split.deliveryDate).toBe('2026-10-06');
    expect(split.items).toEqual([{ n: 'Honig', q: 6 }]);
  });
});

describe('parseDeliveryNote – truncated JSON', () => {
  test('keeps complete objects when the array is cut off', () => {
    const raw = '[{"n":"Honig","q":6},{"n":"Joghurt","q":12},{"n":"Unvollstaend';
    const parsed = parseSafeJsonArray(raw);
    expect(parsed).toEqual([
      { n: 'Honig', q: 6 },
      { n: 'Joghurt', q: 12 },
    ]);
    expect(extractJsonArray(raw)).toHaveLength(2);
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

describe('saveReconciledItems – tenant writes', () => {
  test('plans mhd and master data only for the caller tenant', () => {
    const writes = planReconciledWrites([
      {
        createMasterData: true,
        mhdData: { id: 'ls_joghurt_1', name: 'Weidemilchjoghurt', menge: 12, einheit: 'Stk' },
        masterData: { id: 'joghurt', name: 'Weidemilchjoghurt', einheit: 'Stk', unitPrice: 1.52 },
      },
      { excluded: true, mhdData: { id: 'ls_pfand', name: 'IFCO', menge: 2 } },
    ], 'Hof_A');
    expect(writes.map((write) => write.collection)).toEqual(['mhd_liste', 'stammdaten']);
    expect(writes.every((write) => write.data.tenantId === 'Hof_A')).toBe(true);
    expect(() => planReconciledWrites([
      { mhdData: { id: '../other', name: 'X', menge: 1 } },
    ], 'Hof_A')).toThrow(/Dokument-ID/);
  });
});

describe('parseDeliveryNote – VPE multiplier', () => {
  test('turns inner packs into piece quantity and keeps catch weight', () => {
    expect(expandRetailLine({ artikel: 'Kartoffelknödel 10x230g', menge: 1 }).calculatedQuantity).toBe(10);
    expect(expandRetailLine({ artikel: 'Familienhonig', inhalt: '6x500g', menge: 1, einheit: 'VPE' })).toMatchObject({
      calculatedQuantity: 6,
      einheit: 'Stk',
    });
    expect(expandRetailLine({ artikel: 'Fruchtaufstrich', inhalt: '3 x 175 g', menge: 3 }).calculatedQuantity).toBe(3);
    expect(expandRetailLine({ artikel: 'Fruchtaufstrich 3x175g', menge: 3, packMultiplier: 3 }).calculatedQuantity).toBe(3);
    expect(expandRetailLine({ artikel: 'Apfelsaft', inhalt: '20 x 1 l', menge: 2 }).calculatedQuantity).toBe(20);
    expect(expandRetailLine({ artikel: '18.14 kg Bananen', menge: 1 })).toMatchObject({
      calculatedQuantity: 18.14,
      einheit: 'kg',
      packMultiplier: 1,
    });
    expect(expandRetailLine({ artikel: 'Bananen', menge: 18.14, einheit: 'kg' })).toMatchObject({
      calculatedQuantity: 18.14,
      einheit: 'kg',
    });
    expect(isNonStockLine({ artikel: 'IFCO Klappbox', artikelnummer: '99166' })).toBe(true);
    expect(isNonStockLine({ artikel: 'Rollwagen' })).toBe(true);
    expect(isNonStockLine({ artikel: 'Buttercroissant' })).toBe(true);
    expect(isNonStockLine({ artikel: 'Kartoffelknödel 10x230g' })).toBe(false);
    expect(applyPriceQuantity({
      artikel: 'Rohrohrzucker', einheit: 'kg', unitPrice: 2.06, totalPrice: 12.36, menge: 1,
    }).quantity).toBe(6);
    expect(applyPriceQuantity({
      artikel: 'Weidemilchjoghurt', einheit: 'Stk', einzelpreis: 1.52, gesamtpreis: 18.24, menge: 1,
    }).quantity).toBe(12);
    expect(applyPriceQuantity({
      artikel: 'Strauchtomaten', einheit: 'kg', unitPrice: 5.34, totalPrice: 29.37, menge: 1,
    }).quantity).toBe(5.5);
    const compact = normalizeDeliveryLine({ n: 'Rohrohrzucker', q: 1, u: 'kg', p: 2.06, t: 12.36, ean: '400' }, 0);
    expect(compact.artikel).toBe('Rohrohrzucker');
    expect(compact.einheit).toBe('kg');
    expect(compact.ean).toBe('400');
    expect(applyPriceQuantity(compact).quantity).toBe(6);
  });
});
