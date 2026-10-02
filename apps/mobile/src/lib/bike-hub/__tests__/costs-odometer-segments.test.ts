import { TODAY } from '../../../test/bike-hub-fixtures';
import {
  BIKE_LEAF,
  BIKE_ORIGIN,
  BIKE_SEGMENT,
  COSTS_REST_KEY,
  DELTA_DIRECTION,
  HUB_UNIT,
  ODOMETER_CONFIRM,
  ODOMETER_ERROR,
  ODOMETER_KEY,
} from '../constants';
import { type CostsYearInput, summariseCosts } from '../costs-summary';
import { bikeDisplayName, formatOdometer, toHubUnit } from '../format';
import {
  applyKey,
  applyQuickAdd,
  describeDelta,
  parseEntry,
  validateReading,
} from '../odometer-input';
import { ownerSegmentOf, parseOrigin, resolveInitialSegment } from '../segments';

let nextId = 0;
function year(categories: Record<string, Array<[date: string, amount: number]>>): CostsYearInput {
  return {
    categories: Object.entries(categories).map(([category, rows]) => ({
      category,
      total: rows.reduce((acc, [, amount]) => acc + amount, 0),
      expenses: rows.map(([date, amount]) => {
        nextId += 1;
        return { id: `e${nextId}`, amount, category, currency: 'EUR', date, createdAt: date };
      }),
    })),
  };
}

// Bike A, 2026: total 1,960.62 — Insurance ≈ 25 %, then 20 / 13 / 12 / 12, rest 18.
const YEAR_2026 = year({
  insurance: [['2026-01-10', 490.16]],
  fuel: [
    ['2026-03-05', 326.5],
    ['2026-09-12', 65.62],
  ],
  maintenance: [['2026-07-16', 254.88]],
  gear: [['2026-05-02', 235.27]],
  tires: [['2026-04-20', 235.26]],
  parking: [['2026-06-01', 200]],
  tolls: [['2026-08-09', 152.93]],
});

// 2025: 1,748.62 up to Oct 2, plus spend later in the year that must not count.
const YEAR_2025 = year({
  insurance: [['2025-01-10', 480]],
  fuel: [
    ['2025-06-01', 1000],
    ['2025-10-02', 268.62],
    ['2025-10-03', 75],
    ['2025-12-20', 300],
  ],
});

describe('summariseCosts — bike A', () => {
  const summary = summariseCosts({
    currentYearExpenses: YEAR_2026,
    previousYearExpenses: YEAR_2025,
    today: TODAY,
  });

  it('totals €1,960.62', () => {
    expect(summary.total).toBeCloseTo(1960.62, 2);
  });

  it('compares with the same period of 2025: ▲ 12 % (+€212.00)', () => {
    expect(summary.samePeriodLastYear).toBeCloseTo(1748.62, 2);
    expect(summary.yoy?.direction).toBe(DELTA_DIRECTION.UP);
    expect(summary.yoy?.amount).toBeCloseTo(212, 2);
    expect(summary.yoy?.percent).toBe(12);
  });

  it('this month €0.00, September €65.62', () => {
    expect(summary.thisMonth).toBe(0);
    expect(summary.previousMonth).toBeCloseTo(65.62, 2);
  });

  it('per month €218 over 9 completed months', () => {
    expect(summary.monthsCounted).toBe(9);
    expect(Math.round(summary.perMonth)).toBe(218);
  });

  it('top category Insurance 25 %; shares 25 / 20 / 13 / 12 / 12 / rest 18', () => {
    expect(summary.topCategory).toEqual({ key: 'insurance', percent: 25 });
    expect(summary.shares.map((share) => share.percent)).toEqual([25, 20, 13, 12, 12, 18]);
    expect(summary.shares.at(-1)?.key).toBe(COSTS_REST_KEY);
  });
});

describe('summariseCosts — edges', () => {
  it('has no YoY when last year has no spend in the same period', () => {
    const summary = summariseCosts({
      currentYearExpenses: YEAR_2026,
      previousYearExpenses: year({ fuel: [['2025-11-01', 90]] }),
      today: TODAY,
    });
    expect(summary.samePeriodLastYear).toBe(0);
    expect(summary.yoy).toBeNull();
  });

  it('reports a decrease as DOWN', () => {
    const summary = summariseCosts({
      currentYearExpenses: year({ fuel: [['2026-02-01', 50]] }),
      previousYearExpenses: year({ fuel: [['2025-02-01', 200]] }),
      today: TODAY,
    });
    expect(summary.yoy).toEqual({ direction: DELTA_DIRECTION.DOWN, amount: 150, percent: 75 });
  });

  it('is all zeroes with no expenses, and divides by at least one month', () => {
    const summary = summariseCosts({
      currentYearExpenses: null,
      previousYearExpenses: undefined,
      today: new Date(2026, 0, 15),
    });
    expect(summary).toMatchObject({
      total: 0,
      yoy: null,
      perMonth: 0,
      monthsCounted: 1,
      shares: [],
      topCategory: null,
    });
  });

  it('one category: a single share and no rest', () => {
    const summary = summariseCosts({
      currentYearExpenses: year({ fuel: [['2026-02-01', 50]] }),
      previousYearExpenses: null,
      today: TODAY,
    });
    expect(summary.shares).toEqual([{ key: 'fuel', total: 50, percent: 100 }]);
  });

  it('clamps Feb 29 to Feb 28 of the previous year', () => {
    const summary = summariseCosts({
      currentYearExpenses: year({ fuel: [['2028-02-10', 10]] }),
      previousYearExpenses: year({
        fuel: [
          ['2027-02-28', 40],
          ['2027-03-01', 500],
        ],
      }),
      today: new Date(2028, 1, 29),
    });
    expect(summary.samePeriodLastYear).toBe(40);
  });
});

describe('odometer input', () => {
  const type = (keys: string): string =>
    keys.split('').reduce((digits, key) => applyKey(digits, key as '0'), '');

  it('typing 3-9-4-0-7 gives 39407', () => {
    expect(parseEntry(type('39407'))).toBe(39_407);
  });

  it('caps at 7 digits and never keeps a leading zero', () => {
    expect(type('123456789')).toBe('1234567');
    expect(type('05')).toBe('5');
    expect(type('0')).toBe('0');
  });

  it('delete removes the last digit; clear empties the entry', () => {
    expect(applyKey('394', ODOMETER_KEY.DELETE)).toBe('39');
    expect(applyKey('', ODOMETER_KEY.DELETE)).toBe('');
    expect(applyKey('394', ODOMETER_KEY.CLEAR)).toBe('');
    expect(parseEntry('')).toBeNull();
  });

  it('+50 from an empty entry yields last + 50; chips add to the current entry', () => {
    expect(applyQuickAdd(null, 38_167, 50)).toBe(38_217);
    expect(applyQuickAdd(null, 38_167, 100)).toBe(38_267);
    expect(applyQuickAdd(39_000, 38_167, 250)).toBe(39_250);
    expect(applyQuickAdd(null, null, 50)).toBe(50);
    expect(applyQuickAdd(9_999_990, null, 250)).toBe(9_999_999);
  });

  const lastRecordedAt = new Date(2026, 8, 28);
  const reading = (value: number | null, recordedAt: Date = TODAY) =>
    validateReading({ value, lastValue: 38_167, recordedAt, lastRecordedAt, today: TODAY });

  it('accepts 39,407 and describes it as +1,240', () => {
    expect(reading(39_407)).toEqual({ ok: true, backdated: false });
    expect(describeDelta(39_407, 38_167)).toEqual({ direction: DELTA_DIRECTION.UP, amount: 1240 });
  });

  it('38,000 needs confirmation — a lower reading is a correctable typo, not an error', () => {
    expect(reading(38_000)).toEqual({ ok: false, needsConfirm: ODOMETER_CONFIRM.LOWER_THAN_LAST });
    expect(describeDelta(38_000, 38_167)).toEqual({ direction: DELTA_DIRECTION.DOWN, amount: 167 });
  });

  it('38,167 today is unchanged', () => {
    expect(reading(38_167)).toEqual({ ok: false, error: ODOMETER_ERROR.UNCHANGED });
  });

  it('rejects an empty entry and a future date', () => {
    expect(reading(null)).toEqual({ ok: false, error: ODOMETER_ERROR.EMPTY });
    expect(reading(40_000, new Date(2026, 9, 3))).toEqual({
      ok: false,
      error: ODOMETER_ERROR.FUTURE_DATE,
    });
  });

  it('accepts a lower reading dated before the latest one without asking', () => {
    expect(reading(37_000, new Date(2026, 7, 1))).toEqual({ ok: true, backdated: true });
  });

  it('accepts any first reading on a bike without one', () => {
    expect(
      validateReading({
        value: 0,
        lastValue: null,
        recordedAt: TODAY,
        lastRecordedAt: null,
        today: TODAY,
      }),
    ).toEqual({ ok: true, backdated: false });
    expect(describeDelta(1240, null)).toBeNull();
  });
});

describe('segment resolution', () => {
  it('segment=costs → COSTS', () => {
    expect(resolveInitialSegment({ segmentParam: 'costs', remembered: 'bike' })).toBe(
      BIKE_SEGMENT.COSTS,
    );
  });

  it('highlightTask → SERVICE, ahead of the remembered segment', () => {
    expect(resolveInitialSegment({ highlightTask: 'task-1', remembered: 'bike' })).toBe(
      BIKE_SEGMENT.SERVICE,
    );
  });

  it('remembered BIKE → BIKE', () => {
    expect(resolveInitialSegment({ remembered: 'bike' })).toBe(BIKE_SEGMENT.BIKE);
  });

  it('segment=nonsense + remembered SERVICE → SERVICE', () => {
    expect(resolveInitialSegment({ segmentParam: 'nonsense', remembered: 'service' })).toBe(
      BIKE_SEGMENT.SERVICE,
    );
  });

  it('nothing, or a persisted unknown string → OVERVIEW', () => {
    expect(resolveInitialSegment({})).toBe(BIKE_SEGMENT.OVERVIEW);
    expect(resolveInitialSegment({ remembered: 'insights' })).toBe(BIKE_SEGMENT.OVERVIEW);
  });

  it('origin: home → HOME, profile → PROFILE, absent or unknown → GARAGE', () => {
    expect(parseOrigin('home')).toBe(BIKE_ORIGIN.HOME);
    expect(parseOrigin('profile')).toBe(BIKE_ORIGIN.PROFILE);
    expect(parseOrigin(undefined)).toBe(BIKE_ORIGIN.GARAGE);
    expect(parseOrigin('notification')).toBe(BIKE_ORIGIN.GARAGE);
  });

  it('leaves return to their owning segment; notes keep the segment they came from', () => {
    expect(ownerSegmentOf(BIKE_LEAF.EDIT_TASK)).toBe(BIKE_SEGMENT.SERVICE);
    expect(ownerSegmentOf(BIKE_LEAF.EXPENSE_DETAIL)).toBe(BIKE_SEGMENT.COSTS);
    expect(ownerSegmentOf(BIKE_LEAF.DOCUMENT)).toBe(BIKE_SEGMENT.BIKE);
    expect(ownerSegmentOf(BIKE_LEAF.RECALLS)).toBe(BIKE_SEGMENT.OVERVIEW);
    expect(ownerSegmentOf(BIKE_LEAF.NOTES)).toBeNull();
  });
});

describe('format', () => {
  it('groups thousands without converting', () => {
    expect(formatOdometer(38_167)).toBe('38,167');
    expect(formatOdometer(0)).toBe('0');
  });

  it('shows the nickname in typographic quotes, else the model', () => {
    expect(bikeDisplayName({ nickname: 'Big Red', model: 'Africa Twin' })).toBe('“Big Red”');
    expect(bikeDisplayName({ nickname: '  ', model: 'Africa Twin' })).toBe('Africa Twin');
    expect(bikeDisplayName({ nickname: null, model: 'Ténéré 700' })).toBe('Ténéré 700');
  });

  it('reads the bike unit, defaulting to km', () => {
    expect(toHubUnit('mi')).toBe(HUB_UNIT.MI);
    expect(toHubUnit('km')).toBe(HUB_UNIT.KM);
    expect(toHubUnit(undefined)).toBe(HUB_UNIT.KM);
  });
});
