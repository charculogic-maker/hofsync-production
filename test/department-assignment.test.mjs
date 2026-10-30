/**
 * Fachbereich-Zuordnung: Primär + Mitwirkung + canOrder.
 */
import { expect } from 'chai';
import {
  buildAllDepartmentsAssignment,
  normalizeDepartmentAssignmentEntry,
  normalizeDepartmentAssignments,
  PRIMARY_DEPARTMENT_NONE,
  DEPARTMENT_KEYS,
} from '../web/team-config.js';

describe('normalizeDepartmentAssignmentEntry', () => {
  it('adds primary into departments and keeps canOrder separate', () => {
    const next = normalizeDepartmentAssignmentEntry({
      primaryDepartment: 'zerlegung',
      departments: ['laden'],
      canOrder: true,
    });
    expect(next.primaryDepartment).to.equal('zerlegung');
    expect(next.departments).to.deep.equal(['zerlegung', 'laden']);
    expect(next.canOrder).to.equal(true);
  });

  it('migrates legacy metzgerei to kueche', () => {
    const next = normalizeDepartmentAssignmentEntry({
      primaryDepartment: 'metzgerei',
      departments: ['metzgerei', 'laden'],
      canOrder: true,
    });
    expect(next.primaryDepartment).to.equal('kueche');
    expect(next.departments).to.deep.equal(['kueche', 'laden']);
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

  it('exposes the five operational Fachbereiche', () => {
    expect(DEPARTMENT_KEYS).to.deep.equal([
      'kueche',
      'zerlegung',
      'wurstproduktion',
      'laden',
      'einkauf',
    ]);
  });
});

describe('normalizeDepartmentAssignments', () => {
  it('normalizes a map of named employees', () => {
    const map = normalizeDepartmentAssignments({
      Paddy: { departments: ['metzgerei'], canOrder: true },
      Stephie: { departments: ['laden', 'einkauf'] },
      Heiko: { departments: ['zerlegung', 'wurstproduktion'] },
    });
    expect(map.Paddy.primaryDepartment).to.equal('kueche');
    expect(map.Stephie.primaryDepartment).to.equal('laden');
    expect(map.Stephie.departments).to.include('einkauf');
    expect(map.Heiko.departments).to.deep.equal(['zerlegung', 'wurstproduktion']);
  });
});

describe('buildAllDepartmentsAssignment', () => {
  it('assigns every Fachbereich and keeps the chosen primary', () => {
    const next = buildAllDepartmentsAssignment('laden', { canOrder: true });
    expect(next.primaryDepartment).to.equal('laden');
    expect(next.departments).to.deep.equal([...DEPARTMENT_KEYS]);
    expect(next.canOrder).to.equal(true);
  });

  it('defaults primary to the first Fachbereich when none is set', () => {
    const next = buildAllDepartmentsAssignment('', { canOrder: false });
    expect(next.primaryDepartment).to.equal(DEPARTMENT_KEYS[0]);
    expect(next.departments).to.have.length(DEPARTMENT_KEYS.length);
  });
});
