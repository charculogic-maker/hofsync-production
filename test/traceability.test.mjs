import { describe, it } from 'mocha';
import { expect } from 'chai';
import { __traceabilityTest } from '../web/traceability.js';

describe('traceability organic association normalization', () => {
  it('does not default empty conventional labels to EU-Bio', () => {
    expect(__traceabilityTest.normalizeOrganicAssociation('')).to.equal('');
    expect(__traceabilityTest.normalizeOrganicAssociation('  ')).to.equal('');
    expect(__traceabilityTest.normalizeOrganicAssociation('Unbekannt')).to.equal('');
  });

  it('preserves selected organic and conventional association values', () => {
    expect(__traceabilityTest.normalizeOrganicAssociation('EU-Bio')).to.equal('EU-Bio');
    expect(__traceabilityTest.normalizeOrganicAssociation('Bioland')).to.equal('Bioland');
    expect(__traceabilityTest.normalizeOrganicAssociation('Keine / Konventionell')).to.equal('Keine / Konventionell');
  });
});
