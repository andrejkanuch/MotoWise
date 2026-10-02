import { ODOMETER_MAX } from '@motovault/types';
import { EXPENSES_2025, EXPENSES_2026, expenseYear, TODAY } from '../../../test/bike-hub-fixtures';
import {
  BIKE_LEAF,
  BIKE_ORIGIN,
  BIKE_SEGMENT,
  BIKE_SEGMENT_ORDER,
  COSTS_REST_KEY,
  COSTS_TOP_SHARES,
  DELTA_DIRECTION,
  ODOMETER_CONFIRM,
  ODOMETER_ERROR,
  ODOMETER_KEY,
  ODOMETER_MAX_DIGITS,
  ODOMETER_QUICK_ADD,
  type OdometerDigit,
} from '../constants';
import { summariseCosts } from '../costs-summary';
import { midSentence } from '../format';
import {
  applyKey,
  applyQuickAdd,
  describeDelta,
  isBackdated,
  parseEntry,
  type ReadingInput,
  readingTimestamp,
  validateReading,
} from '../odometer-input';
import { isBikeSegment, ownerSegmentOf, parseOrigin, resolveInitialSegment } from '../segments';

const LAST_VALUE = 38_167;
const LAST_RECORDED_AT = new Date(2026, 8, 28, 18, 30);

describe('summariseCosts — year over year, same period', () => {
  it('1,960.62 against 1,748.62 is ▲ 12 % (+212.00, 12.1 % before rounding)', () => {
    const { yoy, total, samePeriodLastYear } = summariseCosts({
      currentYearExpenses: EXPENSES_2026,
      previousYearExpenses: EXPENSES_2025,
      today: TODAY,
    });
    expect(total).toBeCloseTo(1960.62, 2);
    expect(samePeriodLastYear).toBeCloseTo(1748.62, 2);
    expect(yoy?.direction).toBe(DELTA_DIRECTION.UP);
    expect(yoy?.amount).toBeCloseTo(212, 2);
    expect(yoy?.percent).toBe(12);
  });

  it.each([
    ['no payload', null],
    ['an undefined payload', undefined],
    ['a year without categories', { categories: [] }],
    ['a category without expenses', expenseYear({ fuel: [] })],
  ])('has no YoY line with %s for the previous year', (_label, previousYearExpenses) => {
    const summary = summariseCosts({
      currentYearExpenses: EXPENSES_2026,
      previousYearExpenses,
      today: TODAY,
    });
    expect(summary.samePeriodLastYear).toBe(0);
    expect(summary.yoy).toBeNull();
  });

  it('counts last year up to and including the same month-day, at any time of day', () => {
    const previousYearExpenses = expenseYear({
      fuel: [
        ['2025-10-02', 100],
        ['2025-10-03', 900],
      ],
    });
    const lateEvening = new Date(2026, 9, 2, 23, 59);
    const earlyMorning = new Date(2026, 9, 2, 0, 1);

    for (const today of [earlyMorning, lateEvening]) {
      const summary = summariseCosts({
        currentYearExpenses: EXPENSES_2026,
        previousYearExpenses,
        today,
      });
      expect(summary.samePeriodLastYear).toBe(100);
    }
  });

  it('the same spend as last year is flat: no amount, 0 %', () => {
    const summary = summariseCosts({
      currentYearExpenses: expenseYear({ fuel: [['2026-02-01', 80]] }),
      previousYearExpenses: expenseYear({ fuel: [['2025-02-01', 80]] }),
      today: TODAY,
    });
    expect(summary.yoy).toEqual({ direction: DELTA_DIRECTION.FLAT, amount: 0, percent: 0 });
  });

  it('nothing spent this year against spend last year is ▼ 100 %', () => {
    const summary = summariseCosts({
      currentYearExpenses: null,
      previousYearExpenses: expenseYear({ fuel: [['2025-02-01', 80]] }),
      today: TODAY,
    });
    expect(summary.yoy).toEqual({ direction: DELTA_DIRECTION.DOWN, amount: 80, percent: 100 });
  });

  it('rounds the percentage to a whole number (12.5 → 13)', () => {
    const summary = summariseCosts({
      currentYearExpenses: expenseYear({ fuel: [['2026-02-01', 225]] }),
      previousYearExpenses: expenseYear({ fuel: [['2025-02-01', 200]] }),
      today: TODAY,
    });
    expect(summary.yoy?.percent).toBe(13);
  });

  it('more than doubling reads above 100 %', () => {
    const summary = summariseCosts({
      currentYearExpenses: expenseYear({ fuel: [['2026-02-01', 500]] }),
      previousYearExpenses: expenseYear({ fuel: [['2025-02-01', 100]] }),
      today: TODAY,
    });
    expect(summary.yoy).toEqual({ direction: DELTA_DIRECTION.UP, amount: 400, percent: 400 });
  });
});

describe('summariseCosts — per month divides by completed months, at least 1', () => {
  it.each([
    ['Jan 1', new Date(2026, 0, 1), 1],
    ['Jan 31 (January: 0 completed months)', new Date(2026, 0, 31), 1],
    ['Feb 1', new Date(2026, 1, 1), 1],
    ['Feb 28', new Date(2026, 1, 28), 1],
    ['Mar 1', new Date(2026, 2, 1), 2],
    ['Oct 2', new Date(2026, 9, 2), 9],
    ['Dec 31', new Date(2026, 11, 31), 11],
  ])('on %s the denominator is %i', (_label, today, months) => {
    expect(
      summariseCosts({ currentYearExpenses: null, previousYearExpenses: null, today })
        .monthsCounted,
    ).toBe(months);
  });

  it('1,960.62 over 9 months is €218 per month', () => {
    const summary = summariseCosts({
      currentYearExpenses: EXPENSES_2026,
      previousYearExpenses: EXPENSES_2025,
      today: TODAY,
    });
    expect(Math.round(summary.perMonth)).toBe(218);
  });

  it('in January the whole spend so far is the monthly figure — never a division by zero', () => {
    const summary = summariseCosts({
      currentYearExpenses: expenseYear({
        insurance: [['2026-01-10', 490.16]],
        fuel: [['2026-01-14', 60]],
      }),
      previousYearExpenses: null,
      today: new Date(2026, 0, 15),
    });
    expect(summary.monthsCounted).toBe(1);
    expect(summary.perMonth).toBeCloseTo(550.16, 2);
    expect(Number.isFinite(summary.perMonth)).toBe(true);
  });
});

describe('summariseCosts — this month', () => {
  it('sums only the expenses dated in the current month', () => {
    const summary = summariseCosts({
      currentYearExpenses: expenseYear({
        fuel: [
          ['2026-10-01', 40],
          ['2026-10-02', 12.5],
          ['2026-09-30', 65.62],
        ],
        tolls: [['2026-10-02', 7.5]],
      }),
      previousYearExpenses: null,
      today: TODAY,
    });
    expect(summary.thisMonth).toBe(60);
  });

  it('October last year is not "this month"', () => {
    const summary = summariseCosts({
      currentYearExpenses: null,
      previousYearExpenses: expenseYear({ fuel: [['2025-10-02', 300]] }),
      today: TODAY,
    });
    expect(summary.thisMonth).toBe(0);
  });

  it('in January only January counts, whatever else the year’s payload holds', () => {
    const summary = summariseCosts({
      currentYearExpenses: expenseYear({
        fuel: [
          ['2026-01-05', 20],
          ['2026-12-05', 999],
        ],
      }),
      previousYearExpenses: null,
      today: new Date(2026, 0, 15),
    });
    expect(summary.thisMonth).toBe(20);
  });
});

describe('summariseCosts — top category and shares', () => {
  const summaryOf = (categories: Parameters<typeof expenseYear>[0]) =>
    summariseCosts({
      currentYearExpenses: expenseYear(categories),
      previousYearExpenses: null,
      today: TODAY,
    });

  it('Insurance leads the Africa Twin’s year with 25 %', () => {
    const summary = summariseCosts({
      currentYearExpenses: EXPENSES_2026,
      previousYearExpenses: EXPENSES_2025,
      today: TODAY,
    });
    expect(summary.topCategory).toEqual({ key: 'insurance', percent: 25 });
    expect(summary.shares.reduce((acc, share) => acc + share.percent, 0)).toBe(100);
  });

  it('the top category is the largest whatever order the API returns them in', () => {
    const summary = summaryOf({
      tolls: [['2026-02-01', 10]],
      fuel: [['2026-02-01', 70]],
      gear: [['2026-02-01', 20]],
    });
    expect(summary.topCategory).toEqual({ key: 'fuel', percent: 70 });
    expect(summary.shares.map((share) => share.key)).toEqual(['fuel', 'gear', 'tolls']);
  });

  it(`exactly ${COSTS_TOP_SHARES} categories: no "rest" share`, () => {
    const summary = summaryOf({
      a: [['2026-02-01', 50]],
      b: [['2026-02-01', 20]],
      c: [['2026-02-01', 15]],
      d: [['2026-02-01', 10]],
      e: [['2026-02-01', 5]],
    });
    expect(summary.shares.map((share) => share.percent)).toEqual([50, 20, 15, 10, 5]);
    expect(summary.shares.some((share) => share.key === COSTS_REST_KEY)).toBe(false);
  });

  it('a sixth and a seventh category fold into one "rest" share that is never the top one', () => {
    const summary = summaryOf({
      a: [['2026-02-01', 30]],
      b: [['2026-02-01', 20]],
      c: [['2026-02-01', 15]],
      d: [['2026-02-01', 15]],
      e: [['2026-02-01', 10]],
      f: [['2026-02-01', 6]],
      g: [['2026-02-01', 4]],
    });
    expect(summary.shares.at(-1)).toEqual({ key: COSTS_REST_KEY, total: 10, percent: 10 });
    expect(summary.topCategory?.key).toBe('a');
  });

  it('a category with nothing spent is left off the bar', () => {
    const summary = summaryOf({ fuel: [['2026-02-01', 40]], parking: [] });
    expect(summary.shares).toEqual([{ key: 'fuel', total: 40, percent: 100 }]);
  });

  it('there is no top category before the first expense', () => {
    expect(summaryOf({}).topCategory).toBeNull();
  });
});

describe('validateReading — order of the checks', () => {
  const reading = (overrides: Partial<ReadingInput>) =>
    validateReading({
      value: 39_407,
      lastValue: LAST_VALUE,
      recordedAt: TODAY,
      lastRecordedAt: LAST_RECORDED_AT,
      today: TODAY,
      ...overrides,
    });

  it('a value lower than the last reading asks to confirm — it is not an error', () => {
    expect(reading({ value: 38_000 })).toEqual({
      ok: false,
      needsConfirm: ODOMETER_CONFIRM.LOWER_THAN_LAST,
    });
  });

  it('one less than the last reading already asks; one more does not', () => {
    expect(reading({ value: LAST_VALUE - 1 })).toMatchObject({ ok: false });
    expect(reading({ value: LAST_VALUE + 1 })).toEqual({ ok: true, backdated: false });
  });

  it('a value equal to the last reading is UNCHANGED, so Save stays disabled', () => {
    expect(reading({ value: LAST_VALUE })).toEqual({ ok: false, error: ODOMETER_ERROR.UNCHANGED });
  });

  it('a lower reading dated before the latest one is history: accepted without asking', () => {
    expect(reading({ value: 37_000, recordedAt: new Date(2026, 7, 1) })).toEqual({
      ok: true,
      backdated: true,
    });
  });

  it('a reading dated the day before the latest one is back-dated', () => {
    expect(reading({ value: 38_000, recordedAt: new Date(2026, 8, 27, 23, 59) })).toEqual({
      ok: true,
      backdated: true,
    });
  });

  it('back-dated readings are accepted whatever the value: lower, equal or higher', () => {
    const backdatedTo = new Date(2026, 7, 1);
    for (const value of [0, LAST_VALUE, LAST_VALUE + 5_000]) {
      expect(reading({ value, recordedAt: backdatedTo })).toEqual({ ok: true, backdated: true });
    }
  });

  it('a lower reading on the same calendar day as the latest one still asks', () => {
    const sameDayEarlier = new Date(2026, 8, 28, 9);
    expect(reading({ value: 38_000, recordedAt: sameDayEarlier })).toEqual({
      ok: false,
      needsConfirm: ODOMETER_CONFIRM.LOWER_THAN_LAST,
    });
  });

  it('a lower reading dated after the latest one asks', () => {
    expect(reading({ value: 38_000, recordedAt: new Date(2026, 8, 30) })).toEqual({
      ok: false,
      needsConfirm: ODOMETER_CONFIRM.LOWER_THAN_LAST,
    });
  });

  it('a date after today is rejected before the value is looked at', () => {
    const tomorrow = new Date(2026, 9, 3);
    for (const value of [38_000, LAST_VALUE, 39_407]) {
      expect(reading({ value, recordedAt: tomorrow })).toEqual({
        ok: false,
        error: ODOMETER_ERROR.FUTURE_DATE,
      });
    }
  });

  it('later today is not a future date', () => {
    expect(
      reading({ recordedAt: new Date(2026, 9, 2, 23, 59), today: new Date(2026, 9, 2, 8) }),
    ).toEqual({ ok: true, backdated: false });
  });

  it('an empty entry is EMPTY even with a future date', () => {
    expect(reading({ value: null, recordedAt: new Date(2026, 9, 3) })).toEqual({
      ok: false,
      error: ODOMETER_ERROR.EMPTY,
    });
  });

  it('accepts the maximum value', () => {
    expect(reading({ value: ODOMETER_MAX })).toEqual({ ok: true, backdated: false });
  });

  it('a bike with an odometer but no logged reading: lower still asks, equal is unchanged', () => {
    const noLog = { lastRecordedAt: null };
    expect(reading({ ...noLog, value: 38_000 })).toMatchObject({
      needsConfirm: ODOMETER_CONFIRM.LOWER_THAN_LAST,
    });
    expect(reading({ ...noLog, value: LAST_VALUE })).toMatchObject({
      error: ODOMETER_ERROR.UNCHANGED,
    });
    // Without a latest reading there is nothing to be dated before.
    expect(reading({ ...noLog, value: 37_000, recordedAt: new Date(2020, 0, 1) })).toMatchObject({
      needsConfirm: ODOMETER_CONFIRM.LOWER_THAN_LAST,
    });
  });
});

describe('odometer entry — maximum value and deltas', () => {
  const type = (keys: string, from = ''): string =>
    keys.split('').reduce((digits, key) => applyKey(digits, key as OdometerDigit), from);

  it('the keypad cannot go past the maximum: seven nines, and an eighth digit is ignored', () => {
    const entry = type('9'.repeat(ODOMETER_MAX_DIGITS + 1));
    expect(entry).toHaveLength(ODOMETER_MAX_DIGITS);
    expect(parseEntry(entry)).toBe(ODOMETER_MAX);
  });

  it('a full entry can still be corrected with delete', () => {
    const full = type('1234567');
    expect(type('8', applyKey(full, ODOMETER_KEY.DELETE))).toBe('1234568');
  });

  it.each(ODOMETER_QUICK_ADD)('"+%i" never pushes the entry past the maximum', (delta) => {
    expect(applyQuickAdd(ODOMETER_MAX, LAST_VALUE, delta)).toBe(ODOMETER_MAX);
    expect(applyQuickAdd(ODOMETER_MAX - 1, LAST_VALUE, delta)).toBe(ODOMETER_MAX);
  });

  it('the tracked-ride distance adds to the entry like any other amount', () => {
    expect(applyQuickAdd(null, LAST_VALUE, 1_240)).toBe(39_407);
    expect(applyQuickAdd(38_217, LAST_VALUE, 1_240)).toBe(39_457);
  });

  it('describes "+1,240 … was 38,167" as up by 1,240', () => {
    expect(describeDelta(39_407, LAST_VALUE)).toEqual({
      direction: DELTA_DIRECTION.UP,
      amount: 1_240,
    });
  });

  it('describes an equal entry as flat and an empty one as nothing', () => {
    expect(describeDelta(LAST_VALUE, LAST_VALUE)).toEqual({
      direction: DELTA_DIRECTION.FLAT,
      amount: 0,
    });
    expect(describeDelta(null, LAST_VALUE)).toBeNull();
  });
});

describe('readingTimestamp / isBackdated — what the server will do with the reading', () => {
  const morning = new Date(2026, 9, 2, 8);

  it('a reading for today carries no timestamp: the server stamps it', () => {
    expect(readingTimestamp(new Date(2026, 9, 2, 23, 59), morning)).toBeNull();
    expect(readingTimestamp(morning, morning)).toBeNull();
  });

  it('a reading for an earlier day is stamped at the end of that local day', () => {
    const sentAt = readingTimestamp(new Date(2026, 8, 28, 9), TODAY);
    expect(sentAt).toEqual(new Date(2026, 8, 28, 23, 59, 59, 999));
  });

  it('the day of the latest reading, logged that evening, is not back-dated: it sorts after it', () => {
    expect(isBackdated(new Date(2026, 8, 28), LAST_RECORDED_AT, TODAY)).toBe(false);
    const sentAt = readingTimestamp(new Date(2026, 8, 28), TODAY);
    expect(sentAt?.getTime()).toBeGreaterThan(LAST_RECORDED_AT.getTime());
  });

  it('the day before the latest reading is back-dated', () => {
    expect(isBackdated(new Date(2026, 8, 27), LAST_RECORDED_AT, TODAY)).toBe(true);
  });

  it('yesterday is back-dated when a reading was already logged this morning', () => {
    const today = new Date(2026, 9, 2, 12);
    expect(isBackdated(new Date(2026, 9, 1), morning, today)).toBe(true);
  });

  it('today is never back-dated, even with a reading logged later today', () => {
    const laterToday = new Date(2026, 9, 2, 20);
    expect(isBackdated(morning, laterToday, morning)).toBe(false);
  });

  it('nothing is back-dated on a bike without a logged reading', () => {
    expect(isBackdated(new Date(2020, 0, 1), null, TODAY)).toBe(false);
    expect(isBackdated(new Date(2020, 0, 1), undefined, TODAY)).toBe(false);
  });

  it('agrees with validateReading: back-dated exactly when the sent timestamp is older', () => {
    for (const day of [26, 27, 28, 29, 30]) {
      const picked = new Date(2026, 8, day);
      const result = validateReading({
        value: LAST_VALUE + 100,
        lastValue: LAST_VALUE,
        recordedAt: picked,
        lastRecordedAt: LAST_RECORDED_AT,
        today: TODAY,
      });
      expect(result).toEqual({ ok: true, backdated: isBackdated(picked, LAST_RECORDED_AT, TODAY) });
    }
  });
});

describe('segment resolution — the plan’s cases', () => {
  it.each([
    ['segment=costs', { segmentParam: 'costs' }, BIKE_SEGMENT.COSTS],
    ['highlightTask set', { highlightTask: 'task-1' }, BIKE_SEGMENT.SERVICE],
    ['remembered BIKE', { remembered: 'bike' }, BIKE_SEGMENT.BIKE],
    [
      'segment=nonsense + remembered SERVICE',
      { segmentParam: 'nonsense', remembered: 'service' },
      BIKE_SEGMENT.SERVICE,
    ],
    ['nothing', {}, BIKE_SEGMENT.OVERVIEW],
  ])('%s → %s', (_label, input, expected) => {
    expect(resolveInitialSegment(input)).toBe(expected);
  });

  it.each([
    [
      'an explicit segment beats a highlighted task',
      { segmentParam: 'bike', highlightTask: 'task-1', remembered: 'costs' },
      BIKE_SEGMENT.BIKE,
    ],
    [
      'a highlighted task beats the remembered segment',
      { highlightTask: 'task-1', remembered: 'costs' },
      BIKE_SEGMENT.SERVICE,
    ],
    [
      'segment=nonsense with a highlighted task',
      { segmentParam: 'nonsense', highlightTask: 'task-1', remembered: 'costs' },
      BIKE_SEGMENT.SERVICE,
    ],
    [
      'an empty highlightTask is no task',
      { highlightTask: '', remembered: 'costs' },
      BIKE_SEGMENT.COSTS,
    ],
    ['an empty segment param', { segmentParam: '', remembered: 'bike' }, BIKE_SEGMENT.BIKE],
    [
      'null params',
      { segmentParam: null, highlightTask: null, remembered: null },
      BIKE_SEGMENT.OVERVIEW,
    ],
    ['a segment in another case', { segmentParam: 'COSTS' }, BIKE_SEGMENT.OVERVIEW],
    ['a segment with stray spaces', { segmentParam: ' costs ' }, BIKE_SEGMENT.OVERVIEW],
    ['an unknown remembered value', { remembered: 'insights' }, BIKE_SEGMENT.OVERVIEW],
    [
      'an inherited object key as the segment',
      { segmentParam: 'constructor' },
      BIKE_SEGMENT.OVERVIEW,
    ],
  ])('%s → %s', (_label, input, expected) => {
    expect(resolveInitialSegment(input)).toBe(expected);
  });

  it.each(BIKE_SEGMENT_ORDER)('"%s" is a segment the param can name', (segment) => {
    expect(isBikeSegment(segment)).toBe(true);
    expect(resolveInitialSegment({ segmentParam: segment, remembered: 'overview' })).toBe(segment);
  });

  it.each([undefined, null, 3, {}, ['costs']])('%p is not a segment', (value) => {
    expect(isBikeSegment(value)).toBe(false);
  });
});

describe('origin resolution', () => {
  it.each([
    ['home', BIKE_ORIGIN.HOME],
    ['profile', BIKE_ORIGIN.PROFILE],
    ['garage', BIKE_ORIGIN.GARAGE],
    [undefined, BIKE_ORIGIN.GARAGE],
    [null, BIKE_ORIGIN.GARAGE],
    ['', BIKE_ORIGIN.GARAGE],
    ['Home', BIKE_ORIGIN.GARAGE],
    ['notification', BIKE_ORIGIN.GARAGE],
  ])('from=%p → %s', (param, expected) => {
    expect(parseOrigin(param)).toBe(expected);
  });
});

describe('ownerSegmentOf', () => {
  it('every leaf has a decided owner: a segment, or none', () => {
    const valid: Array<string | null> = [...BIKE_SEGMENT_ORDER, null];
    for (const leaf of Object.values(BIKE_LEAF)) {
      expect(valid).toContain(ownerSegmentOf(leaf));
    }
  });

  it.each([
    BIKE_LEAF.NOTES,
    BIKE_LEAF.NOTE_SHEET,
    BIKE_LEAF.LOG_SHEET,
    BIKE_LEAF.ODOMETER_SHEET,
  ])('%s keeps the segment it was opened from', (leaf) => {
    expect(ownerSegmentOf(leaf)).toBeNull();
  });
});

describe('midSentence — lower-casing with the German exception', () => {
  it.each([
    ['en', 'Insurance', 'insurance'],
    ['en-GB', 'Insurance', 'insurance'],
    ['es', 'Seguro', 'seguro'],
    ['fr', 'Assurance', 'assurance'],
    ['it', 'Assicurazione', 'assicurazione'],
    ['pt-BR', 'Seguro', 'seguro'],
    ['pl', 'Ubezpieczenie', 'ubezpieczenie'],
    ['sk', 'Poistenie', 'poistenie'],
    ['tr', 'Ruhsat', 'ruhsat'],
  ])('%s lower-cases "%s" to "%s"', (locale, name, expected) => {
    expect(midSentence(name, locale)).toBe(expected);
  });

  it.each([
    'de',
    'de-DE',
    'de-AT',
    'de-CH',
    'DE',
    'De-de',
  ])('%s keeps the noun’s capital', (locale) => {
    expect(midSentence('Versicherung', locale)).toBe('Versicherung');
  });

  it('German keeps a rider’s own category exactly as written', () => {
    expect(midSentence('TÜV Bericht', 'de')).toBe('TÜV Bericht');
    expect(midSentence('kleinkram', 'de')).toBe('kleinkram');
  });

  it('a language that merely starts with "de" is not German', () => {
    // "den" is not a real app locale; the point is that the match is on the language subtag.
    expect(midSentence('Insurance', 'den')).toBe('insurance');
  });

  it('lower-cases every word of a custom name and leaves digits alone', () => {
    expect(midSentence('My Papers 2026', 'en')).toBe('my papers 2026');
  });

  it('is a no-op on a name that is already lower-case, and on an empty one', () => {
    expect(midSentence('insurance', 'en')).toBe('insurance');
    expect(midSentence('', 'en')).toBe('');
  });

  it('follows the locale’s casing rules: Turkish dotted and dotless I', () => {
    expect(midSentence('SİGORTA', 'tr')).toBe('sigorta');
    expect(midSentence('ISI', 'tr')).toBe('ısı');
    expect(midSentence('ISI', 'en')).toBe('isi');
  });
});
