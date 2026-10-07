import { MaintenancePriority, MaintenanceTaskStatus } from '@motovault/graphql';
import { createFormatter } from 'next-intl';
import { describe, expect, it } from 'vitest';
import {
  type Bike,
  distanceUnitFor,
  formatDay,
  formatMoney,
  formatMoneyWhole,
  GarageMode,
  garageMode,
  isoDay,
  localDayOf,
  OverdueKind,
  otherBikes,
  overdueKind,
  pickLeadBike,
  RidesCardState,
  ridesCardState,
  rideTotals,
  serviceSchedule,
  showsAppHandoff,
  type Task,
  yearSpend,
} from '../garage-model';

function bike(overrides: Partial<Bike> = {}): Bike {
  return {
    id: 'b1',
    userId: 'u1',
    make: 'Honda',
    model: 'Africa Twin',
    year: 2022,
    isPrimary: false,
    currentMileage: 38_423,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.title ?? 't',
    motorcycleId: 'b1',
    title: 'Task',
    dueDate: null,
    targetMileage: null,
    priority: MaintenancePriority.Medium,
    status: MaintenanceTaskStatus.Pending,
    remind30d: false,
    remind7d: false,
    remind1d: false,
    ...overrides,
  };
}

const TODAY = '2026-10-06';

describe('garageMode / handoff placement', () => {
  it('is loading until the bike list arrives, error when it fails', () => {
    expect(garageMode({ bikes: undefined, isLoading: true, isError: false })).toBe(
      GarageMode.Loading,
    );
    expect(garageMode({ bikes: undefined, isLoading: false, isError: true })).toBe(
      GarageMode.Error,
    );
  });

  it('is empty with no bike and populated with one', () => {
    expect(garageMode({ bikes: [], isLoading: false, isError: false })).toBe(GarageMode.Empty);
    expect(garageMode({ bikes: [bike()], isLoading: false, isError: false })).toBe(
      GarageMode.Populated,
    );
  });

  it('shows the rail / band / bar only beside a populated garage', () => {
    expect(showsAppHandoff(GarageMode.Populated)).toBe(true);
    expect(showsAppHandoff(GarageMode.Empty)).toBe(false);
    expect(showsAppHandoff(GarageMode.Loading)).toBe(false);
    expect(showsAppHandoff(GarageMode.Error)).toBe(false);
  });
});

describe('lead bike', () => {
  it('leads with the primary bike, else the first', () => {
    const a = bike({ id: 'a' });
    const b = bike({ id: 'b', isPrimary: true });
    expect(pickLeadBike([a, b])?.id).toBe('b');
    expect(pickLeadBike([a])?.id).toBe('a');
    expect(pickLeadBike([])).toBeUndefined();
    expect(otherBikes([a, b], b).map((x) => x.id)).toEqual(['a']);
  });
});

describe('distanceUnitFor', () => {
  it('labels from the rider setting and never from the deprecated per-bike unit', () => {
    expect(distanceUnitFor('imperial')).toBe('mi');
    expect(distanceUnitFor('metric')).toBe('km');
    expect(distanceUnitFor(null)).toBe('km');
  });
});

describe('overdueKind', () => {
  it('is overdue by date when the due day is before today', () => {
    expect(overdueKind(task({ dueDate: '2026-10-05' }), 0, TODAY)).toBe(OverdueKind.Date);
    expect(overdueKind(task({ dueDate: '2026-10-06' }), 0, TODAY)).toBeNull();
    expect(overdueKind(task({ dueDate: '2026-09-15T00:00:00Z' }), 0, TODAY)).toBe(OverdueKind.Date);
  });

  it('is overdue by distance once the odometer reaches the target (raw units)', () => {
    expect(overdueKind(task({ targetMileage: 38_000 }), 38_423, TODAY)).toBe(OverdueKind.Distance);
    expect(overdueKind(task({ targetMileage: 38_423 }), 38_423, TODAY)).toBe(OverdueKind.Distance);
    expect(overdueKind(task({ targetMileage: 42_100 }), 38_423, TODAY)).toBeNull();
    expect(overdueKind(task({ targetMileage: 1 }), null, TODAY)).toBeNull();
  });

  it('prefers date when both are true', () => {
    expect(overdueKind(task({ dueDate: '2026-01-01', targetMileage: 1 }), 5, TODAY)).toBe(
      OverdueKind.Date,
    );
  });
});

describe('serviceSchedule', () => {
  // The test account's real schedule: with today = 6 Oct 2026, every task whose
  // date has passed is overdue, not just the one the design frames marked.
  const tasks = [
    task({ title: 'Brake Pads Inspection', dueDate: '2026-03-15', targetMileage: 42_100 }),
    task({ title: 'Coolant', dueDate: '2026-05-11', targetMileage: 48_300 }),
    task({ title: 'Chain Clean & Lube', dueDate: '2026-09-15', targetMileage: 38_900 }),
    task({ title: 'Valve check', dueDate: '2027-02-01' }),
    task({ title: 'Other bike', motorcycleId: 'b2', dueDate: '2020-01-01' }),
  ];

  it('filters to the bike, counts every active and every overdue task', () => {
    const s = serviceSchedule(tasks, bike(), TODAY);
    expect(s.scheduledCount).toBe(4);
    expect(s.overdueCount).toBe(3);
  });

  it('puts overdue first, keeps at most three rows', () => {
    const s = serviceSchedule(tasks, bike(), TODAY);
    expect(s.rows.map((r) => r.task.title)).toEqual([
      'Brake Pads Inspection',
      'Coolant',
      'Chain Clean & Lube',
    ]);
    expect(s.rows.every((r) => r.overdue === OverdueKind.Date)).toBe(true);
  });

  it('orders upcoming by date, then by distance left, then the rest', () => {
    const s = serviceSchedule(
      [
        task({ title: 'No target' }),
        task({ title: 'Far', targetMileage: 50_000 }),
        task({ title: 'Near', targetMileage: 39_000 }),
        task({ title: 'Dated', dueDate: '2026-12-01' }),
      ],
      bike(),
      TODAY,
    );
    expect(s.rows.map((r) => r.task.title)).toEqual(['Dated', 'Near', 'Far']);
    expect(s.overdueCount).toBe(0);
  });

  it('is empty for a bike with no schedule', () => {
    expect(serviceSchedule([], bike(), TODAY)).toEqual({
      rows: [],
      scheduledCount: 0,
      overdueCount: 0,
    });
  });
});

describe('yearSpend', () => {
  const bucket = (year: number, month: number, categories: [string, number][]) => ({
    year,
    month,
    total: categories.reduce((sum, [, t]) => sum + t, 0),
    categories: categories.map(([category, total]) => ({ category, total })),
  });
  const breakdown = (
    currency: string,
    currentYearTotal: number,
    buckets: ReturnType<typeof bucket>[],
  ) => ({
    currency,
    currentYearTotal,
    previousYearTotal: 0,
    allTimeTotal: currentYearTotal,
    expenseCount: 1,
    monthlyBuckets: buckets,
    categoryTotals: [{ category: 'ALL_TIME_ONLY', total: 99_999 }],
  });

  it('keeps one entry per currency and never sums across them', () => {
    const dashboard = {
      currency: 'EUR',
      currentYearTotal: 0,
      previousYearTotal: 0,
      allTimeTotal: 0,
      expenseCount: 3,
      monthlyBuckets: [],
      categoryTotals: [],
      currencies: [
        breakdown('EUR', 1960.62, [
          bucket(2026, 3, [
            ['insurance', 492],
            ['fuel', 100],
          ]),
          bucket(2026, 9, [['fuel', 155]]),
          bucket(2025, 12, [['parts', 700]]),
        ]),
        breakdown('USD', 45, [bucket(2026, 7, [['tolls', 45]])]),
        breakdown('GBP', 0, [bucket(2025, 7, [['tolls', 10]])]),
      ],
    };
    const spend = yearSpend(dashboard, 2026, 'USD');
    expect(spend.map((s) => [s.currency, s.total])).toEqual([
      ['EUR', 1960.62],
      ['USD', 45],
    ]);
    // This year's buckets only (not all-time categoryTotals, not 2025).
    expect(spend[0].categories).toEqual([
      { category: 'insurance', total: 492 },
      { category: 'fuel', total: 255 },
    ]);
    expect(spend[1].categories).toEqual([{ category: 'tolls', total: 45 }]);
  });

  it('is empty when nothing is logged this year', () => {
    expect(yearSpend(null, 2026, 'USD')).toEqual([]);
  });
});

describe('rideTotals', () => {
  const base = {
    profileStats: null,
    rideCount: null,
    lastRideDate: null,
    lastRideKnown: false,
    unit: 'km' as const,
  };

  it('is unknown until the queries answer (never promotes on unknown)', () => {
    expect(rideTotals(base).hasRides).toBeNull();
  });

  it('knows there are no rides only when both answered empty', () => {
    expect(rideTotals({ ...base, rideCount: 0, lastRideKnown: true }).hasRides).toBe(false);
    expect(rideTotals({ ...base, rideCount: 0, lastRideKnown: false }).hasRides).toBeNull();
  });

  it('uses the profile for count and distance, converting meters to the rider unit', () => {
    const t = rideTotals({
      ...base,
      profileStats: { totalRides: 19, totalDistance: 366_000 },
      rideCount: 20,
      lastRideDate: '2026-10-03',
      lastRideKnown: true,
      unit: 'km',
    });
    expect(t).toEqual({ count: 19, distance: 366, lastRideDate: '2026-10-03', hasRides: true });
  });

  it('falls back to myRides.totalCount and hides distance without a profile', () => {
    const t = rideTotals({ ...base, rideCount: 7, lastRideKnown: true });
    expect(t.count).toBe(7);
    expect(t.distance).toBeNull();
    expect(t.hasRides).toBe(true);
  });
});

describe('ridesCardState', () => {
  const base = {
    countSucceeded: false,
    countFailed: false,
    profileSucceeded: false,
    profileFailed: false,
    profileEnabled: false,
    lastRidePending: false,
  };

  it('is ready once a count source answered and the last ride is known', () => {
    expect(ridesCardState({ ...base, countSucceeded: true })).toBe(RidesCardState.Ready);
    expect(
      ridesCardState({ ...base, countFailed: true, profileEnabled: true, profileSucceeded: true }),
    ).toBe(RidesCardState.Ready);
    expect(ridesCardState({ ...base, countSucceeded: true, lastRidePending: true })).toBe(
      RidesCardState.Loading,
    );
  });

  it('fails (never a skeleton forever) when the count fails and no profile can answer', () => {
    expect(ridesCardState({ ...base, countFailed: true })).toBe(RidesCardState.Failed);
    expect(
      ridesCardState({ ...base, countFailed: true, profileEnabled: true, profileFailed: true }),
    ).toBe(RidesCardState.Failed);
  });

  it('keeps loading while the profile can still answer', () => {
    expect(ridesCardState({ ...base, countFailed: true, profileEnabled: true })).toBe(
      RidesCardState.Loading,
    );
    expect(ridesCardState(base)).toBe(RidesCardState.Loading);
  });
});

describe('formatting', () => {
  const en = { format: createFormatter({ locale: 'en', timeZone: 'UTC' }), locale: 'en' };
  it('writes days as D Mon YYYY in English, in UTC', () => {
    expect(formatDay('2026-10-03', en)).toBe('3 Oct 2026');
    expect(formatDay('2026-03-15T00:00:00Z', en)).toBe('15 Mar 2026');
  });

  it('keeps cents on totals and whole units on categories', () => {
    expect(formatMoney(1960.62, 'EUR', en)).toBe('€1,960.62');
    expect(formatMoneyWhole(491.6, 'EUR', en)).toBe('€492');
    expect(formatMoney(45, 'USD', en)).toBe('$45.00');
  });

  it('localDayOf keeps date-only values and reads timestamps in the local zone', () => {
    expect(localDayOf('2026-10-03')).toBe('2026-10-03');
    const endedAt = new Date(2026, 9, 3, 20, 30);
    expect(localDayOf(endedAt.toISOString())).toBe('2026-10-03');
    expect(localDayOf('not a date')).toBe('not a date');
  });

  it('isoDay is the local calendar day', () => {
    expect(isoDay(new Date(2026, 0, 2, 23, 59))).toBe('2026-01-02');
  });
});
