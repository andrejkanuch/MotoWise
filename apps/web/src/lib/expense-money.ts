import { CURRENCY_TOTALS_SEPARATOR } from '@motovault/types';

/**
 * Money formatting for the garage expense dashboard. Expenses are stored in the
 * currency they were logged in and there is no FX source, so totals that span
 * currencies are shown side by side ("€320 · $45"), never added together.
 *
 * Pinned to 'en-US' so server HTML and client hydration agree regardless of the
 * browser locale (avoids React #418 hydration mismatches).
 */

/** Amounts from this size up are shortened to thousands ("$12.3k"). */
const SHORT_THOUSANDS_FROM = 10_000;

/** Fallback when a dashboard has no currency at all (no expenses). */
export const DEFAULT_MONEY_CURRENCY = 'USD';

export interface MoneyTotal {
  currency: string;
  total: number;
}

/** The currency's display symbol ("$", "€", "CHF"); the code itself if the
 *  runtime does not know it. */
export function currencySymbol(currency: string): string {
  try {
    const parts = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).formatToParts(0);
    return parts.find((p) => p.type === 'currency')?.value ?? currency;
  } catch {
    return currency;
  }
}

/** Whole-unit amount without a symbol ("1,235"). */
export function formatWholeAmount(amount: number): string {
  return amount.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

/** Compact money for stat tiles: "$950", "$12.3k", "€1,200". */
export function formatMoneyShort(amount: number, currency: string): string {
  const symbol = currencySymbol(currency);
  if (amount >= SHORT_THOUSANDS_FROM) return `${symbol}${(amount / 1000).toFixed(1)}k`;
  return `${symbol}${formatWholeAmount(amount)}`;
}

/** Compact per-currency totals: one currency gives its plain total, several are
 *  joined, none gives zero in `fallbackCurrency`. */
export function formatMoneyTotalsShort(
  totals: ReadonlyArray<MoneyTotal>,
  fallbackCurrency: string = DEFAULT_MONEY_CURRENCY,
): string {
  if (totals.length === 0) return formatMoneyShort(0, fallbackCurrency);
  return totals
    .map(({ currency, total }) => formatMoneyShort(total, currency))
    .join(CURRENCY_TOTALS_SEPARATOR);
}

/**
 * The breakdown the year-to-date panel draws its trend, YoY line and category
 * list from: the first breakdown (most-used first) with spend this year, else
 * the first one. Picking `breakdowns[0]` alone fails a rider whose most-used
 * currency has only prior-year spend: the headline would show this year's
 * other currency while the chart, categories and "down 100% vs last year"
 * described the idle one.
 */
export function ytdPanelBreakdown<B extends { currentYearTotal: number }>(
  breakdowns: ReadonlyArray<B>,
): B | undefined {
  return breakdowns.find((breakdown) => breakdown.currentYearTotal > 0) ?? breakdowns[0];
}
