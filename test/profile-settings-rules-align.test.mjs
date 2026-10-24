/**
 * settings/profile Write-Keys müssen zu firebase.rules isProfileSettings passen.
 */
import { expect } from 'chai';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rules = fs.readFileSync(path.join(root, 'firebase.rules'), 'utf8');
const dashboard = fs.readFileSync(path.join(root, 'web/dev-dashboard.js'), 'utf8');

describe('Profile settings rules alignment', () => {
  it('erlaubt SMTP-Felder und prüft Updates über affectedKeys', () => {
    expect(rules).to.match(/function profileSettingsAllowedKeys/);
    expect(rules).to.match(/affectedKeys\(\)\s*\.hasOnly\(profileSettingsAllowedKeys\(\)\)/);
    expect(rules).to.include("'smtpFromEmail'");
    expect(rules).to.include("'smtpHost'");
    expect(rules).to.include("'smtpPort'");
    expect(rules).to.include("'smtpUser'");
    expect(rules).to.include("'smtpPass'");
    expect(rules).to.match(/!\('smtpPass' in request\.resource\.data\)/);
  });

  it('erlaubt Plattform-Super-Admin Lese-/Schreibzugriff auf settings', () => {
    expect(rules).to.match(
      /match \/tenants\/\{tenantId\}\/settings\/\{document\}[\s\S]*?allow read: if isTenantUser\(tenantId\) \|\| isPlatformDevAdmin\(\);/,
    );
    expect(rules).to.match(/\(isAdmin\(tenantId\) \|\| isPlatformDevAdmin\(\)\)/);
    expect(rules).to.match(
      /allow update: if isPlatformDevAdmin\(\)[\s\S]*?\.hasOnly\(\['status', 'displayName', 'updatedAt'\]\)/,
    );
  });

  it('persistTenantBetrieb schreibt nur erlaubte Profil-Keys', () => {
    expect(dashboard).to.match(/betriebsName:\s*displayName/);
    expect(dashboard).to.match(/profilePayload\.smtpFromEmail/);
    expect(dashboard).to.match(/profilePayload\.smtpHost/);
    expect(dashboard).to.match(/profilePayload\.smtpPort/);
    expect(dashboard).to.match(/profilePayload\.smtpUser/);
    expect(dashboard).to.match(/profilePayload\.smtpPass/);
    expect(dashboard).to.match(/if \(smtpPass\) profilePayload\.smtpPass/);
    expect(dashboard).to.not.match(/profilePayload\.smtpPass\s*=\s*null/);
  });

  it('erlaubt settings/discount_matrix für Betriebs-Admins', () => {
    expect(rules).to.match(/function isDiscountMatrixSettings/);
    expect(rules).to.include("'discount_matrix'");
    expect(rules).to.include("'defaultRules'");
    expect(rules).to.include("'categoryOverrides'");
    expect(rules).to.match(/\|\| isDiscountMatrixSettings\(document\)/);
  });
});
