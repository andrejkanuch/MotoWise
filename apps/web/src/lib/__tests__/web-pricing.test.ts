import { describe, expect, it } from 'vitest';
import {
  annualPerMonthMicros,
  annualSavingsPercent,
  formatMicros,
  STATIC_WEB_PLANS,
  WEB_FALLBACK_PRICES,
  WEB_PLAN_IDS,
} from '../web-pricing';

const usd = (amountMicros: number) => ({ amountMicros, currency: 'USD' });

describe('web-pricing', () => {
  it('computes the annual saving from real prices, rounding down', () => {
    // 49.99 vs 12 × 5.99 = 71.88 → 30.45% → 30
    expect(annualSavingsPercent(usd(5_990_000), usd(49_990_000))).toBe(30);
    // 59.99 vs 12 × 9.99 = 119.88 → 49.96% → 49 (never rounds a saving up)
    expect(annualSavingsPercent(usd(9_990_000), usd(59_990_000))).toBe(49);
  });

  it('never invents a discount', () => {
    expect(annualSavingsPercent(null, usd(49_990_000))).toBeNull();
    expect(annualSavingsPercent(usd(5_990_000), null)).toBeNull();
    expect(annualSavingsPercent(usd(5_000_000), usd(60_000_000))).toBeNull();
    expect(annualSavingsPercent(usd(5_990_000), { amountMicros: 1, currency: 'EUR' })).toBeNull();
    expect(annualSavingsPercent(usd(0), usd(0))).toBeNull();
  });

  it('formats micros and per-month prices', () => {
    expect(formatMicros(5_990_000, 'USD')).toBe('$5.99');
    expect(formatMicros(annualPerMonthMicros(49_990_000), 'USD')).toBe('$4.17');
  });

  it('derives every static /pro price from the one fallback table', () => {
    const { plans, savingsPercent } = STATIC_WEB_PLANS;
    expect(plans[WEB_PLAN_IDS.MONTHLY].price).toBe(
      formatMicros(WEB_FALLBACK_PRICES.monthly.amountMicros, 'USD'),
    );
    expect(plans[WEB_PLAN_IDS.ANNUAL].price).toBe(
      formatMicros(WEB_FALLBACK_PRICES.annual.amountMicros, 'USD'),
    );
    expect(plans[WEB_PLAN_IDS.ANNUAL].crossed).toBe('$71.88');
    expect(savingsPercent).toBe(
      annualSavingsPercent(WEB_FALLBACK_PRICES.monthly, WEB_FALLBACK_PRICES.annual),
    );
  });
});
