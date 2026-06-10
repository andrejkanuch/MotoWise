import { describe, expect, it } from 'vitest';
import { GqlMaintenancePriority } from '../../common/enums/graphql-enums';
import type { OemSchedule } from '../oem-schedules/models/oem-schedule.model';
import { projectFirstYearCostEur } from './cost-projection';

function schedule(partial: Partial<OemSchedule>): OemSchedule {
  return {
    id: 'x',
    make: 'HONDA',
    taskName: 'Oil & Filter Change',
    priority: GqlMaintenancePriority.high,
    sortOrder: 0,
    createdAt: '2026-01-01',
    ...partial,
  } as OemSchedule;
}

describe('projectFirstYearCostEur', () => {
  it('returns null for an empty schedule', () => {
    expect(projectFirstYearCostEur([])).toBeNull();
  });

  it('produces a positive rounded estimate for a typical plan', () => {
    const cost = projectFirstYearCostEur([
      schedule({ taskName: 'Oil & Filter Change', intervalDays: 365 }),
      schedule({ taskName: 'Chain lubrication', intervalDays: 180 }),
      schedule({ taskName: 'Valve clearance', intervalDays: 730 }),
    ]);
    expect(cost).toBeGreaterThan(0);
    expect(cost! % 10).toBe(0); // rounded to nearest €10
  });

  it('counts a frequent (sub-year) task at most once per year', () => {
    const yearly = projectFirstYearCostEur([schedule({ taskName: 'Oil', intervalDays: 365 })]);
    const monthly = projectFirstYearCostEur([schedule({ taskName: 'Oil', intervalDays: 30 })]);
    // The monthly item is capped at one occurrence, so it is not 12x the yearly.
    expect(monthly!).toBeLessThanOrEqual(yearly! * 2);
  });

  it('weights low-priority tasks lower than critical ones', () => {
    const critical = projectFirstYearCostEur([
      schedule({
        taskName: 'Brake fluid',
        priority: GqlMaintenancePriority.critical,
        intervalDays: 365,
      }),
    ]);
    const low = projectFirstYearCostEur([
      schedule({
        taskName: 'Brake fluid',
        priority: GqlMaintenancePriority.low,
        intervalDays: 365,
      }),
    ]);
    expect(low!).toBeLessThan(critical!);
  });
});
