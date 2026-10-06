import { breakdownTotals, dashboardBreakdowns } from '@motovault/types';
import { describe, expect, it } from 'vitest';
import {
  currencySymbol,
  formatMoneyShort,
  formatMoneyTotalsShort,
  formatWholeAmount,
} from '../expense-money';

describe('currencySymbol', () => {
  it('resolves known symbols and falls back to the code', () => {
    expect(currencySymbol('USD')).toBe('$');
    expect(currencySymbol('EUR')).toBe('€');
    expect(currencySymbol('not-a-code')).toBe('not-a-code');
  });
});

describe('formatMoneyShort', () => {
  it('keeps the existing USD shapes', () => {
    expect(formatMoneyShort(950.4, 'USD')).toBe('$950');
    expect(formatMoneyShort(12_345, 'USD')).toBe('$12.3k');
    expect(formatWholeAmount(1234.6)).toBe('1,235');
  });

  it('uses the expense currency instead of a hard-coded dollar sign', () => {
    expect(formatMoneyShort(320, 'EUR')).toBe('€320');
  });
});

describe('formatMoneyTotalsShort', () => {
  it('renders a single currency as one plain total', () => {
    expect(formatMoneyTotalsShort([{ currency: 'USD', total: 320 }])).toBe('$320');
  });

  it('renders mixed currencies side by side, never summed', () => {
    expect(
      formatMoneyTotalsShort([
        { currency: 'EUR', total: 50 },
        { currency: 'USD', total: 40 },
      ]),
    ).toBe('€50 · $40');
  });

  it('renders zero in the fallback currency when there is nothing to show', () => {
    expect(formatMoneyTotalsShort([])).toBe('$0');
    expect(formatMoneyTotalsShort([], 'EUR')).toBe('€0');
  });

  it('formats a dashboard response per currency end to end', () => {
    const dashboard = {
      currency: 'EUR',
      currentYearTotal: 50,
      previousYearTotal: 0,
      allTimeTotal: 50,
      expenseCount: 2,
      monthlyBuckets: [],
      categoryTotals: [],
      currencies: [
        {
          currency: 'EUR',
          currentYearTotal: 50,
          previousYearTotal: 0,
          allTimeTotal: 50,
          expenseCount: 1,
          monthlyBuckets: [],
          categoryTotals: [],
        },
        {
          currency: 'USD',
          currentYearTotal: 40,
          previousYearTotal: 0,
          allTimeTotal: 40,
          expenseCount: 1,
          monthlyBuckets: [],
          categoryTotals: [],
        },
      ],
    };
    const totals = breakdownTotals(
      dashboardBreakdowns(dashboard, 'USD'),
      (b) => b.currentYearTotal,
    );
    expect(formatMoneyTotalsShort(totals)).toBe('€50 · $40');
  });
});
