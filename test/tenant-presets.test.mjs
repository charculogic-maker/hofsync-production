/**
 * Branchen-Presets: HACCP-Standardgeräte + Avery 3475 Druckdefaults.
 */
import { expect } from 'chai';
import {
  STANDARD_HACCP_DEVICES,
  STANDARD_PRINTER_SETTINGS,
  presetDeviceDocId,
  buildStandardHaccpDeviceDocs,
  buildStandardPrinterSettings,
} from '../web/tenant-presets.js';

describe('tenant-presets (HACCP + Avery 3475)', () => {
  it('liefert genau 3 manuelle Kühlstellen mit dual schema', () => {
    expect(STANDARD_HACCP_DEVICES).to.have.length(3);
    expect(STANDARD_HACCP_DEVICES.every((d) => d.type === 'manual_temp')).to.equal(true);
    expect(STANDARD_HACCP_DEVICES.map((d) => d.name)).to.deep.equal([
      'Kühlhaus Fleisch / Frische',
      'Verkaufstheke / Kühltheke',
      'Tiefkühllager (TK)',
    ]);
    const kuehlhaus = STANDARD_HACCP_DEVICES[0];
    expect(kuehlhaus.tempMin).to.equal(0);
    expect(kuehlhaus.tempMax).to.equal(2);
    expect(kuehlhaus.sollMin).to.equal(0);
    expect(kuehlhaus.sollMax).to.equal(2);
    expect(kuehlhaus.sortOrder).to.equal(10);
    expect(kuehlhaus.activeDays).to.equal(null);
    expect(kuehlhaus.isActive).to.equal(true);
  });

  it('baut stabile Doc-IDs und Tenant-Payloads', () => {
    const docs = buildStandardHaccpDeviceDocs('demo_betrieb', 'ts');
    expect(docs).to.have.length(3);
    expect(docs[0].id).to.equal(presetDeviceDocId('Kühlhaus Fleisch / Frische'));
    expect(docs[0].id).to.equal('kuehlhaus-fleisch-frische');
    expect(docs[0].data.tenantId).to.equal('demo_betrieb');
    expect(docs[0].data.createdAt).to.equal('ts');
    expect(docs[2].id).to.equal('tiefkuehllager-tk');
  });

  it('liefert Avery 3475 Printer-Defaults', () => {
    expect(STANDARD_PRINTER_SETTINGS.labelType).to.equal('avery_3475');
    expect(STANDARD_PRINTER_SETTINGS.columns).to.equal(3);
    expect(STANDARD_PRINTER_SETTINGS.rows).to.equal(8);
    expect(STANDARD_PRINTER_SETTINGS.labelWidthMm).to.equal(70);
    expect(STANDARD_PRINTER_SETTINGS.labelHeightMm).to.equal(36);
    const payload = buildStandardPrinterSettings('demo_betrieb', { updatedBy: 'test' });
    expect(payload.tenantId).to.equal('demo_betrieb');
    expect(payload.updatedBy).to.equal('test');
    expect(payload.marginTopMm).to.equal(4.5);
    expect(payload.scalePercent).to.equal(100);
  });
});
