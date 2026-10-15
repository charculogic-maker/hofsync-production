/**
 * Wareneingang: Temperaturpflicht nur Metzgerei (Lohnschlachtung / Bio-Schwein).
 * Laden + MoPro müssen ohne Temperatur abschließbar sein.
 */
import { expect } from 'chai';
import {
  isBioSchweinZukaufCategory,
  isMetzMeatTemperatureCategory,
  isStrictHaccpTemperatureRequired,
  getHaccpTempLimitForCategory,
  normalizeMetzReceivingCategory,
  METZ_RECEIVING_CATEGORIES,
} from '../web/receiving.js';

describe('Wareneingang Temperaturpflicht', () => {
  it('erlaubt Laden/MoPro ohne Temperatur auch bei gesetzter Metz-Default-Kategorie', () => {
    expect(isStrictHaccpTemperatureRequired({
      mode: 'schnell',
      warenKategorie: '🥛MoPro',
      warenKategorieMetzgerei: 'Lohnschlachtung Rind',
    })).to.equal(false);

    expect(isStrictHaccpTemperatureRequired({
      mode: 'schnell',
      warenKategorie: '🥗 Kühlware',
      warenKategorieMetzgerei: '',
    })).to.equal(false);

    expect(isStrictHaccpTemperatureRequired({
      mode: 'laden',
      warenKategorie: '🥛MoPro',
    })).to.equal(false);
  });

  it('fordert Temperatur nur in Metzgerei für Rind, Geflügel und Bio-Schwein', () => {
    expect(isStrictHaccpTemperatureRequired({
      mode: 'metzgerei',
      warenKategorieMetzgerei: 'Lohnschlachtung Rind',
    })).to.equal(true);

    expect(isStrictHaccpTemperatureRequired({
      mode: 'metzgerei',
      warenKategorieMetzgerei: 'Lohnschlachtung Geflügel',
    })).to.equal(true);

    expect(isStrictHaccpTemperatureRequired({
      mode: 'metzgerei',
      warenKategorieMetzgerei: 'Bio-Schwein Zukauf',
    })).to.equal(true);

    expect(isStrictHaccpTemperatureRequired({
      mode: 'metzgerei',
      warenKategorieMetzgerei: 'Zukauffleisch Rind/Kalb (Fremdbezug)',
    })).to.equal(false);

    expect(isStrictHaccpTemperatureRequired({
      mode: 'metzgerei',
      warenKategorieMetzgerei: 'Zukauffleisch (Fremdbezug)',
    })).to.equal(false);

    expect(isStrictHaccpTemperatureRequired({
      mode: 'metzgerei',
      warenKategorieMetzgerei: 'Wurst Zukauf',
    })).to.equal(false);

    expect(isStrictHaccpTemperatureRequired({
      mode: 'metzgerei',
      warenKategorieMetzgerei: 'Gewürze & Hilfsstoffe',
    })).to.equal(false);
  });

  it('kennt Bio-Schwein Zukauf und HACCP-Grenzen', () => {
    expect(METZ_RECEIVING_CATEGORIES.some((e) => e.value === 'Bio-Schwein Zukauf')).to.equal(true);
    expect(isBioSchweinZukaufCategory('🐷 Bio-Schwein Zukauf')).to.equal(true);
    expect(isMetzMeatTemperatureCategory('Bio-Schwein Zukauf')).to.equal(true);
    expect(isMetzMeatTemperatureCategory('🥛MoPro')).to.equal(false);
    expect(normalizeMetzReceivingCategory('Bio Schwein')).to.equal('Bio-Schwein Zukauf');
    expect(getHaccpTempLimitForCategory('Lohnschlachtung Geflügel')).to.equal(4.0);
    expect(getHaccpTempLimitForCategory('Bio-Schwein Zukauf')).to.equal(7.0);
    expect(getHaccpTempLimitForCategory('Lohnschlachtung Rind')).to.equal(7.0);
  });

  it('simuliert 7× MoPro (Weiling) ohne Temperatur als abschließbar', () => {
    const moproItems = Array.from({ length: 7 }, (_, i) => ({
      id: `mopro-${i + 1}`,
      product: `MoPro Artikel ${i + 1}`,
      category: '🥛MoPro',
    }));
    const head = {
      supplier: 'Weiling',
      warenKategorie: '🥛MoPro',
      warenKategorieMetzgerei: '',
      temperatur: null,
      receivingMode: 'schnell',
    };

    expect(moproItems).to.have.length(7);
    expect(isStrictHaccpTemperatureRequired({
      mode: head.receivingMode,
      warenKategorie: head.warenKategorie,
      warenKategorieMetzgerei: head.warenKategorieMetzgerei,
    })).to.equal(false);
    // Guard-Äquivalent: ohne Pflicht darf null-Temperatur durchgehen
    const blocked = isStrictHaccpTemperatureRequired({
      mode: head.receivingMode,
      warenKategorie: head.warenKategorie,
      warenKategorieMetzgerei: head.warenKategorieMetzgerei,
    }) && (head.temperatur === null || Number.isNaN(head.temperatur));
    expect(blocked).to.equal(false);
  });
});
