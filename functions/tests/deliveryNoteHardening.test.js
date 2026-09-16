/**
 * Unit tests for Lieferschein parseDeliveryNote path/MIME hardening.
 */
import { describe, test, expect, beforeAll, vi } from 'vitest';

let assertTenantStoragePath;
let normalizeMimeType;
let ALLOWED_MIME_TYPES;

beforeAll(async () => {
  vi.mock('firebase-admin', () => ({
    storage: () => ({ bucket: () => ({ file: () => ({}) }) }),
  }));
  ({
    assertTenantStoragePath,
    normalizeMimeType,
    ALLOWED_MIME_TYPES,
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
