/**
 * Wet-Finger UX: Header-Entrümpelung, 1-Tap-Bedarf, MHD-Hierarchie,
 * Wareneingang → HACCP/LMIV-Brücke.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from 'chai';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

describe('Wet-Finger UX Bridge', () => {
  const haccpJs = read('web/haccp.js');
  const mhdJs = read('web/mhd.js');
  const styleCss = read('web/style.css');
  const quickAlertJs = read('web/quick-alert.js');
  const traceabilityJs = read('web/traceability.js');
  const swJs = read('web/sw.js');

  it('removes redundant Aktiver-Mitarbeiter content chips from HACCP views', () => {
    expect(haccpJs).to.not.match(/Aktiver Mitarbeiter:\s*<strong>/);
    expect(haccpJs).to.not.match(/class="haccp-employee-chip"/);
    expect(haccpJs).to.match(/function renderHaccpOperatorSelector/);
    expect(haccpJs).to.match(/container\.innerHTML = ''/);
  });

  it('exports Wareneingang temperature → HACCP log helper', () => {
    expect(haccpJs).to.match(/export async function logReceivingTemperatureCheck/);
    expect(haccpJs).to.match(/logTyp:\s*'wareneingangskontrolle'/);
    expect(haccpJs).to.match(/type:\s*'receiving_temperature'/);
  });

  it('bridges Metzgerei delivery to HACCP log and LMIV prefill', () => {
    expect(mhdJs).to.match(/import \{ logReceivingTemperatureCheck \} from '\.\/haccp\.js'/);
    expect(mhdJs).to.match(/import \{ prefillChargenDokuFromReceiving \} from '\.\/traceability\.js'/);
    expect(mhdJs).to.match(/async function bridgeMetzgereiDeliveryToDocs/);
    expect(mhdJs).to.match(/showLmivHerkunftBridgePrompt/);
    expect(mhdJs).to.match(/await bridgeMetzgereiDeliveryToDocs\(/);
    expect(traceabilityJs).to.match(/export function prefillChargenDokuFromReceiving/);
  });

  it('makes MHD OK the dominant primary action (≥48px touch target)', () => {
    expect(styleCss).to.match(/\.btn-mhd-action\s*\{[\s\S]*?min-height:\s*48px/);
    expect(styleCss).to.match(/\.btn-mhd-action--primary\s*\{[\s\S]*?font-size:\s*14px/);
    expect(styleCss).to.match(/\.btn-mhd-action--primary\s*\{[\s\S]*?#15803d/);
    expect(styleCss).to.match(/\.btn-mhd-action\.btn-mhd-soldout\s*\{[\s\S]*?#94a3b8/);
  });

  it('seeds Bedarf 1-Tap standards and bumps SW cache', () => {
    expect(quickAlertJs).to.match(/DEFAULT_QUICK_BUTTONS/);
    expect(quickAlertJs).to.match(/resolveQuickAlertButtons/);
    expect(swJs).to.match(/wet-finger-ux/);
  });
});
