import { expect } from 'chai';
import {
  expandTwoDigitYear,
  formatIsoToGerman,
  parseGermanDateToIso,
  parseMHDInput,
} from '../web/date-input.js';

describe('parseMHDInput / 2-stellige Jahreszahl', () => {
  it('ergänzt TT.MM.JJ auf 20JJ', () => {
    expect(parseMHDInput('12.09.29')).to.equal('2029-09-12');
    expect(formatIsoToGerman(parseMHDInput('12.09.29'))).to.equal('12.09.2029');
  });

  it('akzeptiert Schrägstriche und 2-stelliges Jahr', () => {
    expect(parseMHDInput('15/05/27')).to.equal('2027-05-15');
    expect(formatIsoToGerman(parseMHDInput('15/05/27'))).to.equal('15.05.2027');
  });

  it('lässt 4-stellige Jahre unverändert', () => {
    expect(parseMHDInput('12.09.2029')).to.equal('2029-09-12');
    expect(parseMHDInput('2029-09-12')).to.equal('2029-09-12');
  });

  it('akzeptiert kompakte 6- und 8-stellige Eingaben', () => {
    expect(parseMHDInput('120929')).to.equal('2029-09-12');
    expect(parseMHDInput('12092029')).to.equal('2029-09-12');
  });

  it('weist ungültige Daten zurück', () => {
    expect(parseMHDInput('31.02.29')).to.equal('');
    expect(parseMHDInput('abc')).to.equal('');
  });

  it('expandTwoDigitYear ergänzt nur genau 2 Stellen', () => {
    expect(expandTwoDigitYear('29')).to.equal(2029);
    expect(expandTwoDigitYear('2029')).to.equal(2029);
    expect(expandTwoDigitYear('9')).to.equal(null);
  });

  it('parseGermanDateToIso bleibt Alias-kompatibel', () => {
    expect(parseGermanDateToIso('01.01.30')).to.equal(parseMHDInput('01.01.30'));
  });
});
