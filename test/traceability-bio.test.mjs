import { describe, it } from 'mocha';
import { expect } from 'chai';
import {
  hasBioCertification,
  normalizeOrganicAssociationInput,
} from '../web/traceability.js';

describe('traceability Bio certification handling', () => {
  it('keeps blank organic association blank instead of defaulting to EU-Bio', () => {
    expect(normalizeOrganicAssociationInput('')).to.equal('');
    expect(normalizeOrganicAssociationInput('   ')).to.equal('');
    expect(normalizeOrganicAssociationInput('Bioland')).to.equal('Bioland');
  });

  it('does not display legacy EU-Bio as certification without control body', () => {
    expect(hasBioCertification({
      organicControlBody: '',
      organicAssociation: 'EU-Bio',
    })).to.equal(false);
    expect(hasBioCertification({
      organicControlBody: 'DE-ÖKO-006',
      organicAssociation: 'EU-Bio',
    })).to.equal(true);
  });
});
