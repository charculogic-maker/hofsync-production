/**
 * Phase C.4: Büro / Retter-Box / Wissen klar im Admin-Menü (Laden-Wording).
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

  it('nennt Wissen im ⚙️-Menü Theken-Auskunft', () => {
    expect(html).to.match(/data-admin-module="knowledge"[^>]*>🧠 Theken-Auskunft</);
    expect(app).to.match(/title:\s*'Theken-Auskunft'/);
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
    expect(html).to.match(/id="dev-dashboard-jump-retterbox"[^>]*href="\/#retter-box"/);
    expect(html).to.match(/id="dev-dashboard-jump-theken-auskunft"[^>]*href="\/#theken-auskunft"/);
  });

  it('benennt Dev-Dashboard im Desktop-Admin als Verwaltung', () => {
    expect(html).to.match(/id="nav-admin-dashboard"[\s\S]*?🛠️ Verwaltung/);
    expect(html).to.not.match(/id="nav-admin-dashboard"[\s\S]*?Dev-Dashboard/);
  });

  it('bumpt den Service-Worker-Cache', () => {
    expect(sw).to.include("const CACHE_NAME = 'charculogic-v20261026-phase-d-header-v1'");
    expect(app).to.include('sw.js?v=20261026-phase-d-header');
  });
});
