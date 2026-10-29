import { describe, expect, test } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  berlinDateParts,
  buildSlaTaskPayload,
  computeResttage,
  countCriticalOpen,
  isCriticalOpen,
  resolveMhdSlaSettings,
  slaTaskDocId,
  tenantHasMhdModule,
} = require('../mhdSla');

describe('mhdSla pure helpers', () => {
  test('berlinDateParts liefert YYYY-MM-DD und Wochentag', () => {
    // 2026-10-28 12:00 UTC = 14:00 Berlin (MESZ) → Mittwoch
    const parts = berlinDateParts(new Date('2026-10-28T12:00:00.000Z'));
    expect(parts.todayIso).toBe('2026-10-28');
    expect(parts.weekday).toBe(3);
  });

  test('computeResttage kalendarisch', () => {
    expect(computeResttage('2026-10-28', '2026-10-28')).toBe(0);
    expect(computeResttage('2026-10-27', '2026-10-28')).toBe(-1);
    expect(computeResttage('29.10.2026', '2026-10-28')).toBe(1);
  });

  test('isCriticalOpen nur Resttage ≤ Schwelle und ungeprüft', () => {
    const todayIso = '2026-10-28';
    expect(isCriticalOpen(
      { menge: 2, mhdDate: '2026-10-28', status: 'aktiv' },
      { todayIso },
    )).toBe(true);
    expect(isCriticalOpen(
      { menge: 2, mhdDate: '2026-10-30', status: 'aktiv' },
      { todayIso },
    )).toBe(false);
    expect(isCriticalOpen(
      { menge: 2, mhdDate: '2026-10-28', status: 'aktiv', lastCheckedDate: todayIso },
      { todayIso },
    )).toBe(false);
    expect(isCriticalOpen(
      { menge: 0, mhdDate: '2026-10-28', status: 'aktiv' },
      { todayIso },
    )).toBe(false);
  });

  test('countCriticalOpen aggregiert korrekt', () => {
    const todayIso = '2026-10-28';
    const count = countCriticalOpen([
      { menge: 1, mhdDate: '2026-10-27', status: 'aktiv' },
      { menge: 1, mhdDate: '2026-10-29', status: 'aktiv' },
      { menge: 1, mhdDate: '2026-10-31', status: 'aktiv' },
    ], { todayIso, criticalMaxResttage: 1 });
    expect(count).toBe(2);
  });

  test('tenantHasMhdModule akzeptiert mhd und mhdMonitor', () => {
    expect(tenantHasMhdModule({ enabledModules: { mhd: true } })).toBe(true);
    expect(tenantHasMhdModule({ enabledModules: { mhdMonitor: true } })).toBe(true);
    expect(tenantHasMhdModule({ enabledModules: { orders: true } })).toBe(false);
  });

  test('resolveMhdSlaSettings Defaults', () => {
    const settings = resolveMhdSlaSettings({});
    expect(settings.enabled).toBe(true);
    expect(settings.criticalMaxResttage).toBe(1);
    expect(settings.openDays).toEqual([1, 2, 3, 4, 5, 6]);
    expect(settings.audienceGroup).toBe('laden');
  });

  test('slaTaskDocId ist idempotent je Tag/Stufe', () => {
    expect(slaTaskDocId('2026-10-28', 's1')).toBe('mhd_sla_2026-10-28_s1');
    expect(slaTaskDocId('2026-10-28', 's2')).toBe('mhd_sla_2026-10-28_s2');
  });

  test('buildSlaTaskPayload S1 an Laden-Gruppe, S2 an alle oder Personen', () => {
    const settings = resolveMhdSlaSettings({ audienceGroup: 'laden' });
    const s1 = buildSlaTaskPayload({
      tenantId: 'demo',
      stage: 's1',
      todayIso: '2026-10-28',
      openCriticalCount: 3,
      settings,
    });
    expect(s1.audienceType).toBe('group');
    expect(s1.audienceGroup).toBe('laden');
    expect(s1.priority).toBe('Gelb');
    expect(s1.source).toBe('mhd_sla');
    expect(s1.status).toBe('open');

    const s2All = buildSlaTaskPayload({
      tenantId: 'demo',
      stage: 's2',
      todayIso: '2026-10-28',
      openCriticalCount: 2,
      settings,
    });
    expect(s2All.audienceType).toBe('all');
    expect(s2All.priority).toBe('Rot');

    const s2Persons = buildSlaTaskPayload({
      tenantId: 'demo',
      stage: 's2',
      todayIso: '2026-10-28',
      openCriticalCount: 2,
      settings: resolveMhdSlaSettings({ escalateTo: ['Patrik', 'Stephie'] }),
    });
    expect(s2Persons.audienceType).toBe('persons');
    expect(s2Persons.audienceMembers).toEqual(['Patrik', 'Stephie']);
  });
});
