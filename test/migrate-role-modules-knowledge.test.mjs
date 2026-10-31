import { expect } from 'chai';
import { buildKnowledgeSanitizePatch } from '../tools/migrate-role-modules-knowledge.mjs';

describe('migrate-role-modules-knowledge patch', () => {
  it('hebt employee/admin knowledge:false auf, Helper unberührt', () => {
    const { patch, roles } = buildKnowledgeSanitizePatch({
      employee: { knowledge: false, mhd: true },
      admin: { knowledge: false },
      helper: { knowledge: false },
    });
    expect(roles).to.deep.equal(['admin', 'employee']);
    expect(patch.employee.knowledge).to.equal(true);
    expect(patch.employee.mhd).to.equal(true);
    expect(patch.admin.knowledge).to.equal(true);
    expect(patch).to.not.have.property('helper');
  });

  it('liefert null wenn nichts zu tun ist', () => {
    const { patch, roles } = buildKnowledgeSanitizePatch({
      employee: { knowledge: true },
      helper: { knowledge: false },
    });
    expect(patch).to.equal(null);
    expect(roles).to.deep.equal([]);
  });
});
