/**
 * Task 7b – Sammel-Zuschnittliste Aggregation & Packtisch-Preislogik
 */
import { strict as assert } from 'node:assert';
import {
  generateZuschnittAggregation,
  calculateLinePriceFromWeight,
  normalizeOrderItem,
  nextStatusInPipeline,
  sortOrdersForPacktisch,
  orderRefLabel,
  ORDER_STATUS_LABELS,
  hackfleischPackKind,
  addDaysIso,
  buildPacktischCalendarDays,
  countOrdersByPickupDay,
  formatPickupReadyLabel,
} from '../web/order-packlist.js';

const friday = '2026-10-16';

function sampleOrders() {
  return [
    {
      id: 'o1',
      status: 'open',
      ref: 'SH-ABC1',
      customerName: 'Müller',
      channel: 'counter',
      pickupDate: friday,
      readyAt: `${friday}T10:00`,
      pickupSlot: { id: 'c1', label: '09:00–11:00' },
      items: [
        {
          productId: 'gal-hack',
          name: 'Hackfleisch',
          cutId: 'beutel-500',
          weightKg: 1.0,
          stateId: 'frisch',
          pricePerKg: 26.99,
        },
        {
          productId: 'gal-rump',
          name: 'Rumpsteak',
          cutId: '4cm',
          cutLabel: 'Extra dick (ca. 4 cm)',
          pieces: 4,
          weightKg: 2.2,
          stateId: 'tk',
          pricePerKg: 65.99,
        },
      ],
    },
    {
      id: 'o2',
      status: 'in_progress',
      customerName: 'Schmidt',
      channel: 'sb',
      pickupDate: friday,
      readyAt: `${friday}T16:30`,
      pickupSlot: { id: 'sb1', label: 'ab 16:30' },
      items: [
        {
          productId: 'gal-hack',
          name: 'Hackfleisch',
          cutId: 'gross',
          weightKg: 2.5,
          stateId: 'tk',
          pricePerKg: 24.99,
        },
        {
          productId: 'gal-rouladen',
          name: 'Rouladen',
          cutId: 'stufe-45',
          pieces: 8,
          stateId: 'frisch',
          pricePerKg: 39.99,
        },
        {
          productId: 'gal-rouladen',
          name: 'Rouladen',
          cutId: 'dicker',
          pieces: 4,
          stateId: 'frisch',
          pricePerKg: 39.99,
        },
      ],
    },
    {
      id: 'o3',
      status: 'ready',
      pickupDate: friday,
      items: [{ name: 'Hackfleisch', cutId: 'gross', weightKg: 9, stateId: 'frisch' }],
    },
    {
      id: 'o4',
      status: 'open',
      pickupDate: '2026-10-17',
      channel: 'counter',
      items: [{ name: 'Rumpsteak', cutId: 'klassisch', pieces: 2, stateId: 'frisch' }],
    },
  ];
}

describe('order-packlist Zuschnitt-Aggregation', () => {
  it('summiert Hackfleisch Frischpackung vs Lose/VB und ignoriert ready', () => {
    const agg = generateZuschnittAggregation(sampleOrders(), friday);
    assert.equal(agg.orderCount, 2);
    assert.equal(agg.hackfleisch.frischpackungKg, 1);
    assert.equal(agg.hackfleisch.loseKg, 2.5);
    assert.equal(agg.hackfleisch.totalKg, 3.5);
    assert.equal(agg.hackfleisch.tkPortions, 1);
  });

  it('gruppiert Steaks nach Schnittstärke und zählt TK', () => {
    const agg = generateZuschnittAggregation(sampleOrders(), friday);
    assert.equal(agg.steaks.length, 1);
    assert.equal(agg.steaks[0].pieces, 4);
    assert.equal(agg.steaks[0].tkPieces, 4);
    assert.match(agg.steaks[0].label, /Extra dick|4 cm/i);
  });

  it('differenziert Rouladen Stufe 4,5 vs dicker', () => {
    const agg = generateZuschnittAggregation(sampleOrders(), friday);
    assert.equal(agg.rouladen.length, 2);
    const stufe = agg.rouladen.find((r) => /4,?5|Stufe/i.test(r.label));
    const dicker = agg.rouladen.find((r) => /Dicker/i.test(r.label));
    assert.ok(stufe);
    assert.ok(dicker);
    assert.equal(stufe.pieces, 8);
    assert.equal(dicker.pieces, 4);
  });

  it('filtert nach Abholtag', () => {
    const agg = generateZuschnittAggregation(sampleOrders(), '2026-10-17');
    assert.equal(agg.orderCount, 1);
    assert.equal(agg.steaks[0].pieces, 2);
  });
});

describe('order-packlist Packtisch', () => {
  it('berechnet Endpreis aus actualWeightGrams und Kilopreis', () => {
    const item = { name: 'Rumpsteak', pricePerKg: 65.99, weightKg: 0.5 };
    const priced = calculateLinePriceFromWeight(item, 485);
    assert.equal(priced.weightGrams, 485);
    assert.equal(priced.lineTotal, 32.01);
    assert.equal(priced.hasActualWeight, true);
  });

  it('Status-Pipeline open → in_progress → ready → picked_up', () => {
    assert.equal(nextStatusInPipeline('open'), 'in_progress');
    assert.equal(nextStatusInPipeline('in_progress'), 'ready');
    assert.equal(nextStatusInPipeline('ready'), 'picked_up');
    assert.equal(nextStatusInPipeline('picked_up'), null);
    assert.equal(ORDER_STATUS_LABELS.open, 'Eingegangen');
    assert.equal(ORDER_STATUS_LABELS.in_progress, 'In Bearbeitung');
    assert.equal(ORDER_STATUS_LABELS.ready, 'Abholbereit');
  });

  it('sortiert Packtisch: Tag, dann Theke vor SB', () => {
    const sorted = sortOrdersForPacktisch(sampleOrders().filter((o) => o.pickupDate === friday && o.status !== 'ready'));
    assert.equal(sorted[0].channel, 'counter');
    assert.equal(sorted[1].channel, 'sb');
  });

  it('formatiert Auftragsnummer #SH-…', () => {
    assert.equal(orderRefLabel({ ref: 'SH-ABC1' }), '#SH-ABC1');
    assert.match(orderRefLabel({ id: 'abcd-efgh' }), /^#SH-/);
  });

  it('erkennt Hackfleisch-Packart', () => {
    assert.equal(hackfleischPackKind({ cutId: 'beutel-500', weightKg: 0.5 }), 'frischpackung');
    assert.equal(hackfleischPackKind({ cutId: 'gross', weightKg: 2 }), 'lose');
  });

  it('normalisiert Portal- und manuelle Positionen', () => {
    const portal = normalizeOrderItem({
      name: 'Filet-Steaks',
      pieces: 2,
      weightKg: 0.4,
      cutId: 'extra-dick',
      stateId: 'tk',
      pricePerKg: 139.99,
    });
    assert.equal(portal.product, 'Filet-Steaks');
    assert.equal(portal.isTk, true);
    assert.equal(portal.pieces, 2);

    const manual = normalizeOrderItem({
      product: 'Bratwurst',
      quantity: '3',
      unit: 'Stück',
      lineNotes: 'TK bitte',
    });
    assert.equal(manual.pieces, 3);
    assert.equal(manual.isTk, true);
  });

  it('zählt Bestellungen je Abholtag für den Packtisch-Kalender', () => {
    const counts = countOrdersByPickupDay(sampleOrders());
    // open + in_progress + ready (nicht picked_up/cancelled)
    assert.equal(counts.get(friday), 3);
    assert.equal(counts.get('2026-10-17'), 1);
    assert.equal(counts.has('2099-01-01'), false);
  });

  it('baut 14-Tage- und Monatsraster', () => {
    const twoWeeks = buildPacktischCalendarDays('2weeks', '2026-10-21', new Date('2026-10-21T12:00:00'));
    assert.equal(twoWeeks.length, 14);
    assert.equal(twoWeeks[0].iso, '2026-10-21');
    assert.equal(twoWeeks[13].iso, addDaysIso('2026-10-21', 13));

    const month = buildPacktischCalendarDays('month', '2026-10-15', new Date('2026-10-21T12:00:00'));
    assert.ok(month.length >= 28);
    assert.ok(month.some((cell) => cell.iso === '2026-10-01' && cell.inMonth));
    assert.ok(month.some((cell) => cell.isToday && cell.iso === '2026-10-21'));
  });

  it('formatiert Abholung mit „ab“ statt „um“', () => {
    const label = formatPickupReadyLabel('2026-10-24T14:30:00');
    assert.match(label, /ab 14:30/);
    assert.doesNotMatch(label, /\bum\b/);
  });
});
