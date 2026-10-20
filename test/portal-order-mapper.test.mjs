import { expect } from 'chai';
import {
  buildReadyAt,
  mapPortalCartLine,
  mapPortalOrderToCustomerOrder,
} from '../web/portal-order-mapper.js';

describe('portal-order-mapper', () => {
  it('baut readyAt aus Datum und Slot-Start', () => {
    expect(buildReadyAt('2026-10-24', { start: '14:00', label: '14:00 – 16:00 Uhr' }))
      .to.equal('2026-10-24T14:00');
    expect(buildReadyAt('2026-10-24', { id: '09:00-11:00' })).to.equal('2026-10-24T09:00');
  });

  it('mappt Warenkorbzeilen mit Preis und Gewicht', () => {
    const line = mapPortalCartLine({
      productId: 'gal-filet',
      name: 'Rinderfilet',
      weightKg: 0.8,
      pricePerKg: 49.9,
      estimatedPrice: 39.92,
      cutId: 'tournedo',
      stateId: 'frisch',
      summary: 'Tournedo · Frisch',
    });
    expect(line.product).to.equal('Rinderfilet');
    expect(line.weightKg).to.equal(0.8);
    expect(line.pricePerKg).to.equal(49.9);
    expect(line.unit).to.equal('kg');
  });

  it('erzeugt Packtisch-Payload mit Kontakt und Portal-Metadaten', () => {
    const { orderId, payload } = mapPortalOrderToCustomerOrder({
      ref: 'SH-TEST1',
      channel: 'counter',
      pickupDate: '2026-10-25',
      pickupSlot: { start: '10:00', label: '10:00 – 12:00 Uhr' },
      customer: { name: 'Anna Test', phone: '01761234567', email: 'anna@example.de' },
      items: [{ name: 'Hackfleisch', productId: '503', weightKg: 1, pricePerKg: 18.5, estimatedPrice: 18.5 }],
      estimatedTotal: 18.5,
    }, 'StevesHof_Hauptbetrieb', { orderId: 'order-fixed-1', nowIso: '2026-10-20T12:00:00.000Z' });

    expect(orderId).to.equal('order-fixed-1');
    expect(payload.tenantId).to.equal('StevesHof_Hauptbetrieb');
    expect(payload.status).to.equal('open');
    expect(payload.inputMode).to.equal('portal');
    expect(payload.source).to.equal('portal');
    expect(payload.customerName).to.equal('Anna Test');
    expect(payload.callbackPhone).to.equal('01761234567');
    expect(payload.customerEmail).to.equal('anna@example.de');
    expect(payload.readyAt).to.equal('2026-10-25T10:00');
    expect(payload.items).to.have.length(1);
    expect(payload.acceptedBy).to.equal('Online-Vorbestellung');
    expect(String(payload.additionalWishes)).to.include('Portal-Ref SH-TEST1');
  });

  it('lehnt leeren Warenkorb ab', () => {
    expect(() => mapPortalOrderToCustomerOrder({
      customer: { name: 'X', phone: '1' },
      pickupDate: '2026-10-25',
      pickupSlot: { start: '10:00' },
      items: [],
    }, 'StevesHof_Hauptbetrieb')).to.throw(/Warenkorb/i);
  });
});
