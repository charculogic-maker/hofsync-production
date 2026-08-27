import { describe, it } from 'mocha';
import { expect } from 'chai';
import { hasBioCertification } from '../web/traceability.js';

describe('traceability Bio certification fields', () => {
  it('does not treat blank Bio fields as certification', () => {
    expect(hasBioCertification({
      organicControlBody: '',
      organicAssociation: '',
    })).to.equal(false);
  });

  it('does not treat legacy EU-Bio without a control body as certification', () => {
    expect(hasBioCertification({
      organicControlBody: '',
      organicAssociation: 'EU-Bio',
    })).to.equal(false);
  });

  it('keeps explicit Bio control-body records certified', () => {
    expect(hasBioCertification({
      organicControlBody: 'DE-OEKO-006',
      organicAssociation: 'EU-Bio',
    })).to.equal(true);
  });
});
