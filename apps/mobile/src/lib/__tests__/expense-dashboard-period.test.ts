import {
  breakdownTotals,
  dashboardBreakdowns,
  type ExpenseBreakdownLike,
  selectBreakdown,
} from '@motovault/types';
import { formatCostPerDistance, formatCurrencyTotals } from '../expense-constants';
import {
  categoryTotalsFromBuckets,
  filterBucketsForPeriod,
  monthTotalOf,
  periodTotalOf,
} from '../expense-dashboard-period';

const YEAR = 2026;

function breakdown(
  currency: string,
  fields: Partial<ExpenseBreakdownLike> = {},
): ExpenseBreakdownLike {
  return {
    currency,
    currentYearTotal: 0,
    previousYearTotal: 0,
    allTimeTotal: 0,
    expenseCount: 1,
    monthlyBuckets: [],
    categoryTotals: [],
    ...fields,
  };
}

const eur = breakdown('EUR', {
  currentYearTotal: 320,
  previousYearTotal: 100,
  allTimeTotal: 420,
  expenseCount: 3,
  monthlyBuckets: [
    { year: YEAR, month: 3, total: 300, categories: [{ category: 'fuel', total: 300 }] },
    { year: YEAR, month: 1, total: 20, categories: [{ category: 'parts', total: 20 }] },
    { year: YEAR - 1, month: 12, total: 100, categories: [{ category: 'fuel', total: 100 }] },
  ],
});
const usd = breakdown('USD', {
  currentYearTotal: 45,
  allTimeTotal: 45,
  monthlyBuckets: [
    { year: YEAR, month: 3, total: 45, categories: [{ category: 'fuel', total: 45 }] },
  ],
});

describe('expense dashboard period view', () => {
  it('shows a single-currency dashboard exactly as before', () => {
    const totals = breakdownTotals([eur], (b) => periodTotalOf(b, 'thisYear'));
    expect(formatCurrencyTotals(totals)).toBe('€320.00');
  });

  it('shows one total per currency for a mixed bike (never €50 + $40 = 90)', () => {
    const totals = breakdownTotals([eur, usd], (b) => periodTotalOf(b, 'thisYear'));
    expect(formatCurrencyTotals(totals)).toBe('€320.00 · $45.00');

    const march = breakdownTotals([eur, usd], (b) => monthTotalOf(b, YEAR, 3));
    expect(march).toEqual([
      { currency: 'EUR', total: 300 },
      { currency: 'USD', total: 45 },
    ]);
  });

  it('shows zero and no charts for an empty dashboard', () => {
    const breakdowns = dashboardBreakdowns(
      {
        currency: null,
        currencies: [],
        currentYearTotal: 0,
        previousYearTotal: 0,
        allTimeTotal: 0,
        expenseCount: 0,
        monthlyBuckets: [],
        categoryTotals: [],
      },
      'EUR',
    );
    expect(breakdowns).toEqual([]);
    expect(selectBreakdown(breakdowns, 'EUR')).toBeUndefined();
    expect(
      formatCurrencyTotals(
        breakdownTotals(breakdowns, (b) => b.allTimeTotal),
        'EUR',
      ),
    ).toBe('€0.00');
    expect(categoryTotalsFromBuckets([])).toEqual([]);
  });

  it('draws the charts for one selected currency only', () => {
    const selected = selectBreakdown([eur, usd], 'USD');
    expect(selected?.currency).toBe('USD');
    const buckets = filterBucketsForPeriod(selected?.monthlyBuckets ?? [], 'thisYear', YEAR);
    expect(categoryTotalsFromBuckets(buckets)).toEqual([{ category: 'fuel', total: 45 }]);
  });

  it('filters buckets per period', () => {
    expect(filterBucketsForPeriod(eur.monthlyBuckets, 'thisYear', YEAR)).toHaveLength(2);
    expect(filterBucketsForPeriod(eur.monthlyBuckets, 'lastYear', YEAR)).toHaveLength(1);
    // All time: most recent 12 months, oldest first.
    expect(
      filterBucketsForPeriod(eur.monthlyBuckets, 'allTime', YEAR).map((b) => [b.year, b.month]),
    ).toEqual([
      [YEAR - 1, 12],
      [YEAR, 1],
      [YEAR, 3],
    ]);
    expect(periodTotalOf(eur, 'lastYear')).toBe(100);
    expect(periodTotalOf(eur, 'allTime')).toBe(420);
  });
});

describe('formatCostPerDistance', () => {
  it('divides a single currency', () => {
    expect(formatCostPerDistance([{ currency: 'EUR', total: 1200 }], 10_000)).toBe('€0.12');
  });

  it('keeps currencies apart', () => {
    expect(
      formatCostPerDistance(
        [
          { currency: 'EUR', total: 1200 },
          { currency: 'USD', total: 300 },
        ],
        10_000,
      ),
    ).toBe('€0.12 · $0.03');
  });

  it('returns null without spend or distance', () => {
    expect(formatCostPerDistance([], 10_000)).toBeNull();
    expect(formatCostPerDistance([{ currency: 'EUR', total: 100 }], 0)).toBeNull();
    expect(formatCostPerDistance([{ currency: 'EUR', total: 100 }], null)).toBeNull();
  });
});
