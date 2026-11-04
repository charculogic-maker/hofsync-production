import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  resolveImportDocument,
  mapCampusToHofSyncDoc,
} = require('../campusRecipeImport.js');

const campusExport = {
  schema: 'campus.recipe.export',
  schemaVersion: '1.0.0',
  exportedAt: '2026-11-04T00:00:00.000Z',
  disclaimer: 'Lehrhinweis',
  recipe: {
    id: 'salami',
    name: 'Salami',
    productFamily: 'rohwurst',
    basisKg: 100,
    lines: [
      {
        materialId: 'S_II',
        code: 'S II',
        name: 'Magerfleisch',
        amountKg: 45,
        role: 'lead',
        percentOfBatch: 45,
      },
      {
        materialId: 'S_IV',
        code: 'S IV',
        name: 'Wammen / Bauch',
        amountKg: 55,
        role: 'scaled',
        percentOfBatch: 55,
      },
    ],
  },
  process: {
    productFamily: 'rohwurst',
    lossPct: 28,
    saltAsNaclPct: 2.8,
    safetyMarginBeffePct: 0.5,
    minBeffePct: 12,
  },
  computed: {
    finished: { beffePct: 18.2 },
    aw: { aw: 0.945 },
  },
};

describe('campusRecipeImport resolveImportDocument', () => {
  it('maps campus.recipe.export@1.0.0', () => {
    const doc = resolveImportDocument(campusExport);
    expect(doc.firestoreId).toBe('salami');
    expect(doc.kat).toBe('Rohwurst');
    expect(doc.basis_g).toBe(100000);
    expect(doc.ingredients).toHaveLength(2);
    expect(doc.importedFrom).toBe('campus.recipe.export@1.0.0');
    expect(doc.anweisung_A).toMatch(/Lehr/);
  });

  it('maps envelope and hofSync stub', () => {
    const mapped = mapCampusToHofSyncDoc(campusExport);
    const fromEnvelope = resolveImportDocument({
      schema: 'campus.recipe.export.envelope',
      schemaVersion: '1.0.0',
      campus: campusExport,
      hofSync: mapped,
    });
    expect(fromEnvelope.id).toBe('salami');

    const fromHof = resolveImportDocument({ hofSync: mapped });
    expect(fromHof.name).toBe('Salami');
  });

  it('rejects unknown payload', () => {
    expect(() => resolveImportDocument({ foo: 1 })).toThrow(/Unbekanntes Format/);
  });
});
