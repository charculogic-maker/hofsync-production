import { expect } from 'chai';
import { __traceabilityTestInternals } from '../web/traceability.js';

const {
  hasBioCertification,
  normalizeOrganicAssociationForSave,
} = __traceabilityTestInternals;

describe('traceability Bio certification handling', () => {
  it('does not default blank organic association to EU-Bio', () => {
    expect(normalizeOrganicAssociationForSave('')).to.equal('');
    expect(normalizeOrganicAssociationForSave('   ')).to.equal('');
    expect(normalizeOrganicAssociationForSave('Bioland')).to.equal('Bioland');
  });

  it('does not display stale body-less EU-Bio as certification', () => {
    expect(hasBioCertification({ organicAssociation: 'EU-Bio', organicControlBody: '' })).to.equal(false);
    expect(hasBioCertification({ organicAssociation: 'EU-Bio', organicControlBody: 'DE-OEKO-006' })).to.equal(true);
    expect(hasBioCertification({ organicAssociation: 'Bioland', organicControlBody: '' })).to.equal(true);
    expect(hasBioCertification({ organicAssociation: 'Keine / Konventionell', organicControlBody: '' })).to.equal(false);
  });
});
