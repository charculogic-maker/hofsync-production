import { describe, it } from 'mocha';
import { expect } from 'chai';
import {
  EMPLOYEE_MODULES,
  HELPER_MODULES,
  TENANT_ID,
  USERS,
  buildClaims,
} from '../tools/provision-showcase-users.mjs';

describe('provision-showcase-users', () => {
  it('defines admin + 3 employees + 2 helpers for test_auto_seed', () => {
    expect(TENANT_ID).to.equal('test_auto_seed');
    expect(USERS.filter((u) => u.role === 'admin')).to.have.length(1);
    expect(USERS.filter((u) => u.role === 'employee')).to.have.length(3);
    expect(USERS.filter((u) => u.role === 'helper')).to.have.length(2);
  });

  it('sets admin claims with isAdmin true', () => {
    const adminUser = USERS.find((u) => u.role === 'admin');
    const claims = buildClaims(adminUser);
    expect(claims).to.deep.include({
      tenantId: 'test_auto_seed',
      role: 'admin',
      isAdmin: true,
    });
  });

  it('gives helpers a reduced module set', () => {
    expect(HELPER_MODULES.mhd).to.equal(true);
    expect(HELPER_MODULES.receiving).to.equal(true);
    expect(HELPER_MODULES.buero).to.equal(false);
    expect(HELPER_MODULES.kitchen).to.equal(false);
    expect(EMPLOYEE_MODULES.kitchen).to.equal(true);
    expect(EMPLOYEE_MODULES.buero).to.equal(true);
  });
});
