import { describe, expect, it } from 'vitest';
import { Currency } from '../../constants/enums';
import {
  compareLegacyCurrencyTotals,
  groupTotalsByCurrency,
  isCurrency,
  legacyPrimaryCurrency,
  pickLegacyPrimary,
  primaryCurrencyTotal,
  resolveCurrency,
  totalInCurrency,
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

describe('legacy primary currency (3.20.0 label rule)', () => {
  it('picks the currency with the largest total, not the most-used one', () => {
    const groups = groupTotalsByCurrency([
      ...Array.from({ length: 10 }, () => ({ amount: 50, currency: Currency.EUR })),
      { amount: 30_000, currency: Currency.JPY },
    ]);
    // Most-used first for the per-currency list...
    expect(groups[0].currency).toBe(Currency.EUR);
    // ...but the legacy single-number fields follow the largest total.
    expect(legacyPrimaryCurrency(groups)).toBe(Currency.JPY);
    expect(totalInCurrency(groups, Currency.JPY)).toBe(30_000);
  });

  it('breaks total ties by count, then by code', () => {
    expect(
      compareLegacyCurrencyTotals(
        { currency: 'USD', total: 100, count: 2 },
        { currency: 'EUR', total: 100, count: 1 },
      ),
    ).toBeLessThan(0);
    expect(
      compareLegacyCurrencyTotals(
        { currency: 'EUR', total: 100, count: 1 },
        { currency: 'USD', total: 100, count: 1 },
      ),
    ).toBeLessThan(0);
  });

  it('is undefined / zero for no items', () => {
    expect(legacyPrimaryCurrency([])).toBeUndefined();
    expect(pickLegacyPrimary([], () => ({ currency: 'USD', total: 0, count: 0 }))).toBeUndefined();
    expect(totalInCurrency([], undefined)).toBe(0);
  });

  it('gives 0 for a currency the groups do not contain', () => {
    const groups = groupTotalsByCurrency([{ amount: 40, currency: Currency.USD }]);
    expect(totalInCurrency(groups, Currency.EUR)).toBe(0);
  });
});
