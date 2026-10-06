import { describe, expect, it } from 'vitest';
import { Currency } from '../../constants/enums';
import {
  groupTotalsByCurrency,
  isCurrency,
  primaryCurrencyTotal,
  resolveCurrency,
} from '../currency-totals';

describe('groupTotalsByCurrency', () => {
  it('returns no groups for no items', () => {
    expect(groupTotalsByCurrency([])).toEqual([]);
    expect(primaryCurrencyTotal([])).toBe(0);
  });

  it('returns one group equal to the plain sum for a single currency', () => {
    const groups = groupTotalsByCurrency([
      { amount: 50, currency: Currency.EUR },
      { amount: '20.10', currency: Currency.EUR },
      { amount: 0.2, currency: Currency.EUR },
    ]);
    expect(groups).toEqual([{ currency: Currency.EUR, total: 70.3, count: 3 }]);
    expect(primaryCurrencyTotal(groups)).toBe(70.3);
  });

  it('never adds two currencies together', () => {
    const groups = groupTotalsByCurrency([
      { amount: 50, currency: Currency.EUR },
      { amount: 40, currency: Currency.USD },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.total)).not.toContain(90);
    expect(groups).toContainEqual({ currency: Currency.EUR, total: 50, count: 1 });
    expect(groups).toContainEqual({ currency: Currency.USD, total: 40, count: 1 });
  });

  it('orders the most-used currency first, then by total, then by code', () => {
    const groups = groupTotalsByCurrency([
      { amount: 10_000, currency: Currency.JPY },
      { amount: 10, currency: Currency.EUR },
      { amount: 20, currency: Currency.EUR },
      { amount: 5, currency: Currency.USD },
      { amount: 5, currency: Currency.GBP },
    ]);
    expect(groups.map((g) => g.currency)).toEqual([
      Currency.EUR, // 2 rows
      Currency.JPY, // 1 row, largest total
      Currency.GBP, // 1 row, tie on total -> code order
      Currency.USD,
    ]);
  });

  it('counts blank or unknown currencies as the fallback and skips non-numeric amounts', () => {
    const groups = groupTotalsByCurrency(
      [
        { amount: 10, currency: null },
        { amount: 5, currency: 'XXX' },
        { amount: 'not-a-number', currency: Currency.USD },
        { amount: 1, currency: Currency.EUR },
      ],
      Currency.EUR,
    );
    expect(groups).toEqual([{ currency: Currency.EUR, total: 16, count: 3 }]);
  });
});

describe('isCurrency / resolveCurrency', () => {
  it('accepts supported codes only', () => {
    expect(isCurrency(Currency.CZK)).toBe(true);
    expect(isCurrency('XXX')).toBe(false);
    expect(isCurrency(undefined)).toBe(false);
    expect(resolveCurrency('', Currency.GBP)).toBe(Currency.GBP);
    expect(resolveCurrency(Currency.PLN, Currency.GBP)).toBe(Currency.PLN);
  });
});
