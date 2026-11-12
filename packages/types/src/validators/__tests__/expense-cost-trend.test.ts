import { describe, expect, it } from 'vitest';
import { COST_TREND_SECTION, CostTrendSchema } from '../expense-cost-trend';

const FREE = {
  isPro: false,
  timeZone: 'Europe/Madrid',
  fromMonth: '2025-12',
  toMonth: '2026-11',
  expenseCount: 6,
  currency: 'EUR',
  otherCurrencyExpenseCount: 1,
  lockedSections: Object.values(COST_TREND_SECTION),
  series: null,
};

describe('CostTrendSchema', () => {
  it('accepts a free response: headline, locked sections, no series', () => {
    expect(CostTrendSchema.safeParse(FREE).success).toBe(true);
  });

  it('rejects a key outside the contract, so no extra figure reaches a client', () => {
    expect(CostTrendSchema.safeParse({ ...FREE, total: 431.47 }).success).toBe(false);
  });

  it('rejects an unknown section name and a month that is not YYYY-MM', () => {
    expect(CostTrendSchema.safeParse({ ...FREE, lockedSections: ['average'] }).success).toBe(false);
    expect(CostTrendSchema.safeParse({ ...FREE, toMonth: '2026-13' }).success).toBe(false);
  });

  it('accepts a Pro series with every month', () => {
    const series = [
      {
        currency: 'EUR',
        expenseCount: 5,
        total: 120.5,
        months: [
          { month: '2026-10', total: 0 },
          { month: '2026-11', total: 120.5 },
        ],
      },
    ];
    expect(
      CostTrendSchema.safeParse({ ...FREE, isPro: true, lockedSections: [], series }).success,
    ).toBe(true);
  });
});
