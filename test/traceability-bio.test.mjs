import { describe, it } from 'mocha';
import { expect } from 'chai';
import { __traceabilityTest } from '../web/traceability.js';

describe('traceability organic association handling', () => {
  it('does not default a blank Bio association to EU-Bio on save', () => {
    expect(__traceabilityTest.normalizeOrganicAssociationForSave('')).to.equal('');
    expect(__traceabilityTest.normalizeOrganicAssociationForSave('   ')).to.equal('');
  });

  it('keeps supported Bio associations when explicitly selected', () => {
    expect(__traceabilityTest.normalizeOrganicAssociationForSave('Bioland')).to.equal('Bioland');
    expect(__traceabilityTest.normalizeOrganicAssociationForSave('EU-Bio')).to.equal('EU-Bio');
  });

  it('does not render body-less legacy EU-Bio as a Bio certification', () => {
    expect(__traceabilityTest.hasBioCertification({ organicAssociation: 'EU-Bio' })).to.equal(false);
    expect(__traceabilityTest.hasBioCertification({ organicAssociation: '' })).to.equal(false);
    expect(__traceabilityTest.hasBioCertification({
      organicControlBody: 'DE-OEKO-006',
      organicAssociation: '',
    })).to.equal(true);
  });
});
