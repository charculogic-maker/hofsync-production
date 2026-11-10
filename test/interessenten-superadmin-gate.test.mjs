/**
 * Interessenten-/Test-Mandant-Anlage nur Super-Admin im Dev-Dashboard.
 */
import { expect } from 'chai';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('Interessenten-Zugang Super-Admin Gate', () => {
  it('entfernt das Formular aus dem Büro-/Schicht-Tab (#page-batches)', () => {
    const html = readFileSync(join(root, 'web/index.html'), 'utf8');
    const batchesStart = html.indexOf('id="page-batches"');
    const batchesEnd = html.indexOf('id="page-', batchesStart + 1);
    expect(batchesStart).to.be.greaterThan(-1);
    const batchesChunk = html.slice(
      batchesStart,
      batchesEnd > batchesStart ? batchesEnd : html.length,
    );
    expect(batchesChunk).to.not.match(/data-fast-onboarding-card/);
    expect(batchesChunk).to.not.match(/Interessenten-Zugang/);
    expect(batchesChunk).to.not.match(/id="fast-onboarding-card"/);
  });

  it('hält das Formular nur unter Plattform & Mandanten', () => {
    const html = readFileSync(join(root, 'web/index.html'), 'utf8');
    const platformStart = html.indexOf('id="dev-dashboard-view-platform"');
    const platformEnd = html.indexOf('id="page-batches"', platformStart);
    expect(platformStart).to.be.greaterThan(-1);
    const platformChunk = html.slice(
      platformStart,
      platformEnd > platformStart ? platformEnd : html.length,
    );
    expect(platformChunk).to.match(/id="dev-dashboard-fast-onboarding-card"/);
    expect(platformChunk).to.match(/data-fast-onboarding-card/);
    expect(html.match(/data-fast-onboarding-card/g) || []).to.have.length(1);
  });

  it('gated Sichtbarkeit auf isPlatformSuperAdmin', () => {
    const js = readFileSync(join(root, 'web/fast-onboarding.js'), 'utf8');
    expect(js).to.match(/isPlatformSuperAdmin/);
    expect(js).to.match(/dev-dashboard-view-platform/);
    expect(js).not.to.match(/isOfficeUser/);
  });
});
