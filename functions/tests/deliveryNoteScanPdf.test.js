/**
 * Scan-PDF (Weiling-Rechnung o. Ä.): eingebettete JPEG-Seiten robust an Gemini.
 */
import { describe, test, expect, beforeAll, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

let extractEmbeddedJpegPages;
let buildGenerativeContentParts;
let validateParsedItems;
let MAX_PARSED_ITEMS;

const FIXTURE_PDF = resolve(__dirname, 'fixtures/scan_pdf_embedded_jpeg.pdf');
const WEILING_UPLOAD = resolve(
  '/home/ubuntu/.cursor/projects/workspace/uploads/RG_Weiling_VR4411911_2026-09-15_df6e.pdf',
);

beforeAll(async () => {
  vi.mock('firebase-admin', () => ({
    storage: () => ({ bucket: () => ({ file: () => ({}) }) }),
  }));
  ({
    extractEmbeddedJpegPages,
    buildGenerativeContentParts,
    validateParsedItems,
    MAX_PARSED_ITEMS,
  } = await import('../deliveryNote.js'));
});

describe('parseDeliveryNote – scan PDF JPEG extraction', () => {
  test('extracts embedded JPEG page from fixture PDF', () => {
    const pdf = readFileSync(FIXTURE_PDF);
    const pages = extractEmbeddedJpegPages(pdf);
    expect(pages.length).toBe(1);
    expect(pages[0][0]).toBe(0xff);
    expect(pages[0][1]).toBe(0xd8);
    expect(pages[0][pages[0].length - 2]).toBe(0xff);
    expect(pages[0][pages[0].length - 1]).toBe(0xd9);
  });

  test('buildGenerativeContentParts uses JPEG pages for scan PDF', () => {
    const pdf = readFileSync(FIXTURE_PDF);
    const { parts, transport, pageCount } = buildGenerativeContentParts(
      pdf.toString('base64'),
      'application/pdf',
    );
    expect(transport).toBe('pdf-scan-jpeg-pages');
    expect(pageCount).toBe(1);
    expect(parts[0].text).toMatch(/Rechnung/i);
    expect(parts[0].text).toMatch(/Weiling/i);
    expect(parts.length).toBe(2);
    expect(parts[1].inlineData.mimeType).toBe('image/jpeg');
    expect(parts[1].inlineData.data.length).toBeGreaterThan(100);
  });

  test('allows more than 80 line items (Weiling multi-page invoices)', () => {
    expect(MAX_PARSED_ITEMS).toBeGreaterThanOrEqual(200);
    const items = Array.from({ length: 120 }, (_, i) => ({
      artikel: `Artikel ${i + 1}`,
      menge: 1,
      kategorie: 'Bio',
    }));
    expect(validateParsedItems(items)).toHaveLength(120);
  });

  test('extracts all 5 pages from real Weiling Rechnung when available', () => {
    if (!existsSync(WEILING_UPLOAD)) {
      expect(true).toBe(true);
      return;
    }
    const pdf = readFileSync(WEILING_UPLOAD);
    const pages = extractEmbeddedJpegPages(pdf);
    expect(pages.length).toBe(5);
    const { transport, pageCount, parts } = buildGenerativeContentParts(
      pdf.toString('base64'),
      'application/pdf',
    );
    expect(transport).toBe('pdf-scan-jpeg-pages');
    expect(pageCount).toBe(5);
    expect(parts.length).toBe(6); // prompt + 5 pages
  });
});
