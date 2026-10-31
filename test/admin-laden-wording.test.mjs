/**
 * Phase C.4: Büro / Retter-Box klar im Admin-Menü; Theken-Auskunft unter Mehr.
 */
import { expect } from 'chai';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('Admin Laden-Wording (Büro / Retter-Box / Theken-Auskunft)', () => {
  const html = read('web/index.html');
  const app = read('web/app.js');
  const sw = read('web/sw.js');

  it('legt Theken-Auskunft unter Mehr → Auskunft (nicht im ⚙️-Menü)', () => {
    expect(html).to.not.match(/data-admin-module="knowledge"/);
    expect(html).to.match(/data-tab="knowledge"[^>]*data-nav-slot="mehr"|data-nav-slot="mehr"[^>]*data-tab="knowledge"/);
    expect(html).to.match(/id="tab-knowledge"[\s\S]*?<span>Auskunft<\/span>/);
    expect(app).to.match(/headerTitle\.textContent\s*=\s*["']Theken-Auskunft["']/);
  });

  it('nennt Büro im Menü Büro · Chargen', () => {
    expect(html).to.match(/data-admin-module="buero"[^>]*>💼 Büro · Chargen</);
    expect(html).to.match(/id="tab-batches"[\s\S]*?Büro · Chargen/);
    expect(app).to.match(/title:\s*'Büro · Chargen'/);
  });

  it('bietet Retter-Box als eigenen Admin-Shortcut', () => {
    expect(html).to.match(/data-admin-module="retterbox"[^>]*>📦 Retter-Box</);
    expect(html).to.match(/id="tab-retterbox"/);
    expect(app).to.match(/retterbox:\s*\{/);
    expect(app).to.match(/focusRetterBoxPanel/);
    expect(app).to.match(/refreshRetterBoxModule\(\)/);
  });

  it('Deep-Links #retter-box und #theken-auskunft öffnen die Module', () => {
    expect(app).to.match(/function resolveAdminModuleFromHash/);
    expect(app).to.match(/function applyAdminModuleDeepLink/);
    expect(app).to.match(/retter-box/);
    expect(app).to.match(/theken-auskunft/);
    expect(app).to.match(/moduleKey === 'knowledge'/);
    expect(html).to.match(/id="dev-dashboard-jump-retterbox"[^>]*href="\/#retter-box"/);
    expect(html).to.match(/id="dev-dashboard-jump-theken-auskunft"[^>]*href="\/#theken-auskunft"/);
  });

  it('benennt Dev-Dashboard im Desktop-Admin als Verwaltung', () => {
    expect(html).to.match(/id="nav-admin-dashboard"[\s\S]*?🛠️ Verwaltung/);
    expect(html).to.not.match(/id="nav-admin-dashboard"[\s\S]*?Dev-Dashboard/);
  });

  it('versteckt Header-Verwaltung auf Desktop und hält hasAdminModuleAccess office-only', () => {
    const style = read('web/style.css');
    expect(style).to.match(/@media \(min-width:\s*769px\)[\s\S]*?#admin-header-dropdown[\s\S]*?display:\s*none\s*!important/);
    expect(app).to.match(/function hasAdminModuleAccess/);
    expect(app).to.match(/return isOfficeUser\(\)/);
    expect(app).to.match(/if \(!isMobileNavViewport\(\)\) \{\s*hideAdminHeaderDropdown\(\)/);
  });

  it('bumpt den Service-Worker-Cache', () => {
    expect(sw).to.include("const CACHE_NAME = 'charculogic-v20261031-nav-admin-dedupe-v1'");
    expect(app).to.include('sw.js?v=20261031-nav-admin-dedupe-v1');
  });
});
