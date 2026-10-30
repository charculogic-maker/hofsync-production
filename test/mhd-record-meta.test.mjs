import { expect } from 'chai';
import {
  buildMhdCaptureCorrectionMetaParts,
  buildMhdQtyCorrectionFields,
  resolveMhdQtyCorrectedAt,
  resolveMhdRecordCreatedAt,
} from '../web/mhd-record-meta.js';

describe('MHD Erfasst vs. Mengenkorrektur', () => {
  it('nimmt Erstaufnahme nicht aus updatedAt', () => {
    const prod = {
      updatedAt: '2026-10-27T12:00:00.000Z',
      qtyCorrectedAt: '2026-10-27T12:00:00.000Z',
    };
    expect(resolveMhdRecordCreatedAt(prod)).to.equal(null);
    expect(resolveMhdQtyCorrectedAt(prod)?.toISOString()).to.equal('2026-10-27T12:00:00.000Z');
  });

  it('bevorzugt createdAt / Wareneingang vor Korrektur', () => {
    const prod = {
      createdAt: '2026-10-20T08:00:00.000Z',
      wareneingangAt: '2026-10-19T08:00:00.000Z',
      qtyCorrectedAt: '2026-10-27T15:00:00.000Z',
      updatedAt: '2026-10-27T15:00:00.000Z',
    };
    expect(resolveMhdRecordCreatedAt(prod)?.toISOString()).to.equal('2026-10-20T08:00:00.000Z');
  });

  it('zeigt Erfasst und Korrigiert getrennt', () => {
    const parts = buildMhdCaptureCorrectionMetaParts({
      createdAt: '2026-10-20T08:00:00.000Z',
      qtyCorrectedAt: '2026-10-27T15:00:00.000Z',
    });
    expect(parts[0]).to.match(/^Erfasst: 20\.10/);
    expect(parts[1]).to.match(/^Korrigiert: 27\.10/);
  });

  it('zeigt nur Korrektur, wenn keine Erstaufnahme bekannt ist', () => {
    const parts = buildMhdCaptureCorrectionMetaParts({
      qtyCorrectedAt: '2026-10-27T15:00:00.000Z',
    });
    expect(parts).to.have.length(1);
    expect(parts[0]).to.match(/^Korrigiert: 27\.10/);
  });

  it('baut Korrektur-Audit ohne createdAt', () => {
    const fields = buildMhdQtyCorrectionFields({
      previousQuantity: 4,
      actor: 'Paddy',
      at: '2026-10-27T15:00:00.000Z',
    });
    expect(fields.previousQuantity).to.equal(4);
    expect(fields.qtyCorrectedBy).to.equal('Paddy');
    expect(fields.qtyCorrectedAt).to.equal('2026-10-27T15:00:00.000Z');
    expect(fields).to.not.have.property('createdAt');
  });
});
