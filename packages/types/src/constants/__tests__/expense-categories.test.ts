import { describe, expect, it } from 'vitest';
import {
  CONSUMABLE_EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_META,
  isInvestmentCategory,
  splitExpenseTotals,
} from '../expense-categories';

describe('expense category investment split', () => {
  it('treats fuel as consumed by riding, not retained by the bike', () => {
    // The whole reason this flag exists — a rider pricing a bike for sale does
    // not get their petrol back.
    expect(isInvestmentCategory('fuel')).toBe(false);
  });

  it('keeps everything a buyer would not pay for out of the investment side', () => {
    // Pinned deliberately. Re-bucketing a category silently moves money between
    // the two figures a rider reads when deciding an asking price, so that
    // decision should have to change this list on purpose.
    //
    // insurance/registration are ownership costs, training buys rider skill,
    // and gear leaves with the rider — none of them reach the next owner, so
    // none of them belong in the number that argues for an asking price.
    expect([...CONSUMABLE_EXPENSE_CATEGORIES].sort()).toEqual([
      'fuel',
      'gear',
      'insurance',
      'parking',
      'registration',
      'taxes_fees',
      'tolls',
      'training',
    ]);
  });

  it('keeps the categories that physically stay with the bike on the investment side', () => {
    // The other half of the pin: a careless edit that flipped everything to
    // consumable would still satisfy the assertion above.
    for (const key of ['maintenance', 'parts', 'tires', 'accessories', 'modifications']) {
      expect(isInvestmentCategory(key)).toBe(true);
    }
  });

  it('counts an unknown category as investment rather than dropping it', () => {
    // A category retired from the meta table still has rows in the DB. Dropping
    // them would make invested + consumed stop reconciling with the total cost
    // of ownership printed directly above the split.
    expect(isInvestmentCategory('some_retired_category')).toBe(true);
  });

  it('splits totals and adds the purchase price to the investment side', () => {
    const { invested, consumed } = splitExpenseTotals(
      [
        { category: 'parts', total: 200 },
        { category: 'tires', total: 300 },
        { category: 'fuel', total: 150 },
        { category: 'tolls', total: 50 },
      ],
      5000,
    );

    expect(invested).toBe(5500);
    expect(consumed).toBe(200);
  });

  it('reconciles: invested + consumed equals purchase price plus every total', () => {
    // The invariant the UI depends on. The split sits under a headline that
    // reads purchasePrice + allTimeTotal; if these drift the card contradicts
    // itself on screen.
    const totals = EXPENSE_CATEGORY_META.map((m, i) => ({
      category: m.key,
      total: (i + 1) * 10,
    }));
    const allTime = totals.reduce((sum, t) => sum + t.total, 0);

    const { invested, consumed } = splitExpenseTotals(totals, 1234.56);

    expect(invested + consumed).toBeCloseTo(1234.56 + allTime, 10);
  });

  it('handles an empty dashboard without inventing spend', () => {
    expect(splitExpenseTotals([], 0)).toEqual({ invested: 0, consumed: 0 });
    expect(splitExpenseTotals([])).toEqual({ invested: 0, consumed: 0 });
  });
});
