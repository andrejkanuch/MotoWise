import { expenseYear, TODAY } from '../../../test/bike-hub-fixtures';
import { DELTA_DIRECTION } from '../constants';
import { summariseCosts } from '../costs-summary';

// Amounts in different currencies are never added together (#275): the card
// works in the year's most-used currency and lists the others beside it.
describe('summariseCosts — currencies', () => {
  it('keeps every figure in the most-used currency and lists the rest separately', () => {
    const summary = summariseCosts({
      currentYearExpenses: expenseYear({
        fuel: [
          ['2026-10-01', 40, 'EUR'],
          ['2026-09-01', 60, 'EUR'],
        ],
        parts: [['2026-10-01', 500, 'USD']],
      }),
      previousYearExpenses: expenseYear({
        fuel: [['2025-02-01', 80, 'EUR']],
        parts: [['2025-02-01', 900, 'USD']],
      }),
      today: TODAY,
      fallbackCurrency: 'USD',
    });

    expect(summary.currency).toBe('EUR');
    expect(summary.total).toBe(100);
    expect(summary.thisMonth).toBe(40);
    expect(summary.samePeriodLastYear).toBe(80);
    expect(summary.yoy).toEqual({ direction: DELTA_DIRECTION.UP, amount: 20, percent: 25 });
    expect(summary.shares).toEqual([{ key: 'fuel', total: 100, percent: 100 }]);
    expect(summary.otherCurrencyTotals).toEqual([{ currency: 'USD', total: 500, count: 1 }]);
  });

  it('counts a legacy row with no currency as the fallback currency', () => {
    const summary = summariseCosts({
      currentYearExpenses: expenseYear({ fuel: [['2026-02-01', 30, null]] }),
      previousYearExpenses: null,
      today: TODAY,
      fallbackCurrency: 'GBP',
    });
    expect(summary.currency).toBe('GBP');
    expect(summary.total).toBe(30);
    expect(summary.otherCurrencyTotals).toEqual([]);
  });

  it("uses last year's currency when this year has no spend", () => {
    const summary = summariseCosts({
      currentYearExpenses: null,
      previousYearExpenses: expenseYear({ fuel: [['2025-02-01', 80, 'CZK']] }),
      today: TODAY,
      fallbackCurrency: 'USD',
    });
    expect(summary.currency).toBe('CZK');
    expect(summary.yoy).toEqual({ direction: DELTA_DIRECTION.DOWN, amount: 80, percent: 100 });
  });

  it('falls back to the rider currency for a bike with no spend', () => {
    const summary = summariseCosts({
      currentYearExpenses: null,
      previousYearExpenses: null,
      today: TODAY,
      fallbackCurrency: 'USD',
    });
    expect(summary).toMatchObject({ currency: 'USD', total: 0, otherCurrencyTotals: [] });
  });
});
