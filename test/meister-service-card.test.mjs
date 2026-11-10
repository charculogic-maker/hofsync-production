/**
 * Meister-Service-Karte in „Mein Betrieb“.
 */
import { expect } from 'chai';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('Meister-Service-Karte (Mein Betrieb)', () => {
  it('liegt im Settings-/Betrieb-View mit Stripe-Buchungslink', () => {
    const html = readFileSync(join(root, 'web/index.html'), 'utf8');
    const settingsIdx = html.indexOf('id="dev-dashboard-view-settings"');
    const cardIdx = html.indexOf('class="service-upsell-card"');
    const geraeteIdx = html.indexOf('id="betrieb-panel-geraete"');
    expect(settingsIdx).to.be.greaterThan(-1);
    expect(cardIdx).to.be.greaterThan(settingsIdx);
    expect(geraeteIdx).to.be.greaterThan(cardIdx);
    expect(html).to.match(/Fleischermeister Patrik Rehm/);
    expect(html).to.match(/buy\.stripe\.com\/test_4gM5kw2jAeyI1A1ar20VO04/);
    expect(html).to.match(/Jetzt Service buchen/);
  });

  it('hat responsive CSS ohne Inline-Hover-Hack', () => {
    const css = readFileSync(join(root, 'web/style.css'), 'utf8');
    expect(css).to.match(/\.service-upsell-card\s*\{/);
    expect(css).to.match(/\.service-upsell-card__button:hover/);
    expect(css).to.match(/min-height:\s*48px/);
    expect(css).to.match(/@media \(max-width: 720px\)/);
  });
});
