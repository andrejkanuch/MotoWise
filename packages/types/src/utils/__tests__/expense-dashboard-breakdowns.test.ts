import { describe, expect, it } from 'vitest';
import {
  breakdownTotals,
  dashboardBreakdowns,
  type ExpenseBreakdownLike,
  type ExpenseDashboardLike,
  selectBreakdown,
} from '../expense-dashboard-breakdowns';

function breakdown(currency: string, currentYearTotal: number): ExpenseBreakdownLike {
  return {
    currency,
    currentYearTotal,
    previousYearTotal: 0,
    allTimeTotal: currentYearTotal,
    expenseCount: 1,
    monthlyBuckets: [],
    categoryTotals: [],
  };
}

function dashboard(fields: Partial<ExpenseDashboardLike>): ExpenseDashboardLike {
  return {
    currency: null,
    currencies: [],
    currentYearTotal: 0,
    previousYearTotal: 0,
    allTimeTotal: 0,
    expenseCount: 0,
    monthlyBuckets: [],
    categoryTotals: [],
    ...fields,
  };
}

describe('dashboardBreakdowns', () => {
  it('is empty without a dashboard or without expenses', () => {
    expect(dashboardBreakdowns(undefined, 'USD')).toEqual([]);
    expect(dashboardBreakdowns(dashboard({}), 'USD')).toEqual([]);
  });

  it('returns the single breakdown of a single-currency bike', () => {
    const eur = breakdown('EUR', 320);
    expect(
      dashboardBreakdowns(
        dashboard({ currency: 'EUR', currencies: [eur], expenseCount: 1 }),
        'USD',
      ),
    ).toEqual([eur]);
  });

  it('returns one breakdown per currency for a mixed bike, in served order', () => {
    const result = dashboardBreakdowns(
      dashboard({
        currency: 'EUR',
        currencies: [breakdown('EUR', 50), breakdown('USD', 40)],
        expenseCount: 2,
      }),
      'USD',
    );
    expect(result.map((b) => [b.currency, b.currentYearTotal])).toEqual([
      ['EUR', 50],
      ['USD', 40],
    ]);
  });

  it('wraps a pre-00186 response (no per-currency data) in the legacy currency', () => {
    const result = dashboardBreakdowns(
      dashboard({ currencies: undefined, currentYearTotal: 90, expenseCount: 2 }),
      'GBP',
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ currency: 'GBP', currentYearTotal: 90 });
  });
});

describe('selectBreakdown', () => {
  const breakdowns = [breakdown('EUR', 50), breakdown('USD', 40)];

  it('picks the preferred currency when the bike has it, else the primary one', () => {
    expect(selectBreakdown(breakdowns, 'USD')?.currency).toBe('USD');
    expect(selectBreakdown(breakdowns, 'JPY')?.currency).toBe('EUR');
    expect(selectBreakdown(breakdowns, null)?.currency).toBe('EUR');
    expect(selectBreakdown([], 'EUR')).toBeUndefined();
  });
});

describe('breakdownTotals', () => {
  it('keeps one total per currency and never sums them', () => {
    expect(
      breakdownTotals([breakdown('EUR', 50), breakdown('USD', 40)], (b) => b.currentYearTotal),
    ).toEqual([
      { currency: 'EUR', total: 50 },
      { currency: 'USD', total: 40 },
    ]);
  });

  it('drops currencies with nothing in the period', () => {
    expect(
      breakdownTotals([breakdown('EUR', 50), breakdown('USD', 0)], (b) => b.currentYearTotal),
    ).toEqual([{ currency: 'EUR', total: 50 }]);
    expect(breakdownTotals([], (b) => b.currentYearTotal)).toEqual([]);
  });
});
