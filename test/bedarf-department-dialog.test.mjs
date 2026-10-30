/**
 * Bedarf-Melden: Fachbereich-Select und Zuweisen-Filter (Quell-Guardrails).
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from 'chai';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

describe('Bedarf Melden-Dialog Fachbereich', () => {
  const indexHtml = read('web/index.html');
  const quickAlertJs = read('web/quick-alert.js');

  it('exposes Fachbereich select with clear department labels', () => {
    expect(indexHtml).to.match(/id="quick-alert-department"/);
    expect(indexHtml).to.match(/Küche/);
    expect(indexHtml).to.match(/Zerlegung/);
    expect(indexHtml).to.match(/Wurstproduktion/);
    expect(indexHtml).to.match(/Laden \/ Verkauf/);
    expect(indexHtml).to.match(/Einkauf \/ Büro/);
    expect(indexHtml).to.match(/Alle Bereiche/);
    expect(indexHtml).not.to.match(/value="metzgerei"/);
    expect(quickAlertJs).to.match(/SUPPLY_DEPARTMENT_OPTIONS/);
    expect(quickAlertJs).to.match(/value: 'kueche'/);
    expect(quickAlertJs).to.match(/value: 'zerlegung'/);
    expect(quickAlertJs).to.match(/value: 'wurstproduktion'/);
    expect(quickAlertJs).to.match(/Alle Bereiche/);
  });

  it('syncs Art → Fachbereich and filters assignees by department', () => {
    expect(quickAlertJs).to.match(/function syncDepartmentSelectFromCategory/);
    expect(quickAlertJs).to.match(/function onQuickAlertCategoryChange/);
    expect(quickAlertJs).to.match(/function onQuickAlertDepartmentChange/);
    expect(quickAlertJs).to.match(/employeeMatchesDepartmentTarget/);
    expect(quickAlertJs).to.match(/primaryDepartment === target/);
    expect(quickAlertJs).to.match(/Niemand \(alle Bereiche\)/);
    expect(quickAlertJs).to.match(/fillDepartmentSelectOptions/);
    expect(quickAlertJs).to.match(/handleFreetextSubmit[\s\S]*?readSelectedDepartmentTarget/);
  });
});
