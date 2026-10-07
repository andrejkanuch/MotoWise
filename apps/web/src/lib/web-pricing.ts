/**
 * Web (RevenueCat Web Billing / Stripe) plan pricing.
 *
 * The checkout page renders prices from the RevenueCat package
 * (`webBillingProduct.currentPrice`) — that is what Stripe actually charges.
 * The static /pro marketing page cannot load the SDK at render time, so it
 * shows WEB_FALLBACK_PRICES. Keep these equal to the `default-web` offering's
 * products in RevenueCat; they are the only hardcoded web prices.
 */

export const WEB_PLAN_IDS = {
  MONTHLY: 'monthly',
  ANNUAL: 'annual',
} as const;

export type WebPlanId = (typeof WEB_PLAN_IDS)[keyof typeof WEB_PLAN_IDS];

export interface WebPrice {
  /** Price in micro-units of the currency ($9.99 = 9_990_000), as purchases-js reports it. */
  amountMicros: number;
  /** ISO 4217 code. */
  currency: string;
}

const MICROS_PER_UNIT = 1_000_000;
const MONTHS_PER_YEAR = 12;

export const WEB_FALLBACK_PRICES: Record<WebPlanId, WebPrice> = {
  [WEB_PLAN_IDS.MONTHLY]: { amountMicros: 5_990_000, currency: 'USD' },
  [WEB_PLAN_IDS.ANNUAL]: { amountMicros: 49_990_000, currency: 'USD' },
};

/** Formats a micro-unit amount. The locale is a literal on purpose (see intl-locale-contract). */
export function formatMicros(amountMicros: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(
    amountMicros / MICROS_PER_UNIT,
  );
}

/** Annual price expressed per month, in micros (rounded to the cent). */
export function annualPerMonthMicros(annualMicros: number): number {
  const perMonthCents = Math.round(annualMicros / MONTHS_PER_YEAR / 10_000);
  return perMonthCents * 10_000;
}

/**
 * Whole-percent saving of the annual plan against twelve monthly payments.
 * Returns null when the prices are missing, in different currencies, or the
 * annual plan is not actually cheaper — the badge must never invent a discount.
 */
export function annualSavingsPercent(
  monthly: WebPrice | null,
  annual: WebPrice | null,
): number | null {
  if (!monthly || !annual) return null;
  if (monthly.currency !== annual.currency) return null;
  const yearOfMonthly = monthly.amountMicros * MONTHS_PER_YEAR;
  if (!(yearOfMonthly > 0) || !(annual.amountMicros > 0)) return null;
  const percent = Math.floor((1 - annual.amountMicros / yearOfMonthly) * 100);
  return percent > 0 ? percent : null;
}

export interface StaticPlanDisplay {
  price: string;
  period: string;
  sub: string;
  /** Twelve monthly payments, struck through next to the annual price. */
  crossed: string | null;
}

/** Display strings for the static /pro page, derived from a typed price table. */
export function staticPlanDisplay(prices: Record<WebPlanId, WebPrice>): {
  plans: Record<WebPlanId, StaticPlanDisplay>;
  savingsPercent: number | null;
} {
  const monthly = prices[WEB_PLAN_IDS.MONTHLY];
  const annual = prices[WEB_PLAN_IDS.ANNUAL];
  const monthlyPrice = formatMicros(monthly.amountMicros, monthly.currency);
  return {
    plans: {
      [WEB_PLAN_IDS.MONTHLY]: {
        price: monthlyPrice,
        period: '/mo',
        sub: `${monthlyPrice} / month`,
        crossed: null,
      },
      [WEB_PLAN_IDS.ANNUAL]: {
        price: formatMicros(annual.amountMicros, annual.currency),
        period: '/yr',
        sub: `${formatMicros(annualPerMonthMicros(annual.amountMicros), annual.currency)} / month · billed yearly`,
        crossed:
          monthly.currency === annual.currency
            ? formatMicros(monthly.amountMicros * MONTHS_PER_YEAR, monthly.currency)
            : null,
      },
    },
    savingsPercent: annualSavingsPercent(monthly, annual),
  };
}

export const STATIC_WEB_PLANS = staticPlanDisplay(WEB_FALLBACK_PRICES);
