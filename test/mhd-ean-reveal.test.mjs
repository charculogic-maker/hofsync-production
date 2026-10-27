/**
 * MHD-Karten: EAN tippen → komplette Nummer, Menü → kopieren.
 */
import { expect } from 'chai';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mhdSrc = readFileSync(path.join(root, 'web/mhd.js'), 'utf8');
const cssSrc = readFileSync(path.join(root, 'web/style.css'), 'utf8');

describe('MHD EAN reveal', () => {
  it('keeps short EAN default and exposes full value on toggle attributes', () => {
    expect(mhdSrc).to.match(/EAN: …\$\{barcode\.slice\(-4\)\}/);
    expect(mhdSrc).to.include('data-mhd-ean-toggle="1"');
    expect(mhdSrc).to.include('data-mhd-ean-value="${escapeHtml(clean)}"');
    expect(mhdSrc).to.include('data-mhd-ean-mode="short"');
    expect(mhdSrc).to.include('function toggleMhdEanReveal(button)');
    expect(mhdSrc).to.include('mhd-ean-toggle--full');
  });

  it('wires click handler and copy-ean menu action', () => {
    expect(mhdSrc).to.include("closest('[data-mhd-ean-toggle]')");
    expect(mhdSrc).to.include('toggleMhdEanReveal(eanToggle)');
    expect(mhdSrc).to.include('data-mhd-command="copy-ean"');
    expect(mhdSrc).to.include("command === 'copy-ean'");
    expect(mhdSrc).to.include('function copyMhdProductEan(');
    expect(mhdSrc).to.include('navigator.clipboard?.writeText');
    expect(mhdSrc).to.include('EAN ${barcode} kopiert.');
  });

  it('styles the tappable EAN chip for Laden-iPhone', () => {
    expect(cssSrc).to.match(/button\.mhd-ean-toggle\s*\{/);
    expect(cssSrc).to.include('mhd-ean-toggle--full');
    expect(cssSrc).to.include('font-variant-numeric: tabular-nums');
    expect(cssSrc).to.include('touch-action: manipulation');
  });
});
