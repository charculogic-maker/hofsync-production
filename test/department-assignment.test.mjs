/**
 * Fachbereich-Zuordnung: Primär + Mitwirkung + canOrder.
 */
import { expect } from 'chai';
import {
  normalizeDepartmentAssignmentEntry,
  normalizeDepartmentAssignments,
  PRIMARY_DEPARTMENT_NONE,
} from '../web/team-config.js';

describe('normalizeDepartmentAssignmentEntry', () => {
  it('adds primary into departments and keeps canOrder separate', () => {
    const next = normalizeDepartmentAssignmentEntry({
      primaryDepartment: 'metzgerei',
      departments: ['laden'],
      canOrder: true,
    });
    expect(next.primaryDepartment).to.equal('metzgerei');
    expect(next.departments).to.deep.equal(['metzgerei', 'laden']);
    expect(next.canOrder).to.equal(true);
  });

  it('migrates legacy entries without primary to first department', () => {
    const next = normalizeDepartmentAssignmentEntry({
      departments: ['einkauf', 'laden'],
      canOrder: false,
    });
    expect(next.primaryDepartment).to.equal('einkauf');
    expect(next.departments).to.deep.equal(['einkauf', 'laden']);
  });

  it('allows canOrder without any Fachbereich', () => {
    const next = normalizeDepartmentAssignmentEntry({ canOrder: true });
    expect(next.primaryDepartment).to.equal(PRIMARY_DEPARTMENT_NONE);
    expect(next.departments).to.deep.equal([]);
    expect(next.canOrder).to.equal(true);
  });
});

describe('normalizeDepartmentAssignments', () => {
  it('normalizes a map of named employees', () => {
    const map = normalizeDepartmentAssignments({
      Paddy: { departments: ['metzgerei'], canOrder: true },
      Stephie: { departments: ['laden', 'einkauf'] },
    });
    expect(map.Paddy.primaryDepartment).to.equal('metzgerei');
    expect(map.Stephie.primaryDepartment).to.equal('laden');
    expect(map.Stephie.departments).to.include('einkauf');
  });
});
