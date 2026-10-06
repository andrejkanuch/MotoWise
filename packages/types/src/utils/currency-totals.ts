import { CURRENCY_SYMBOLS, type Currency } from '../constants/enums';

/** One currency's share of a money aggregate. */
export interface CurrencyTotal {
  currency: Currency;
  total: number;
  /** How many items were summed into `total`. */
  count: number;
}

/** A money-carrying row: `amount` may arrive as a string (Postgres DECIMAL via
 *  PostgREST), `currency` may be blank on legacy rows. */
export interface CurrencyAmount {
  amount: number | string | null | undefined;
  currency?: string | null;
}

/** True when `value` is a currency code the app supports. */
export function isCurrency(value: unknown): value is Currency {
  return typeof value === 'string' && value in CURRENCY_SYMBOLS;
}

/** Resolve a stored currency code, falling back for blank/unknown values. */
export function resolveCurrency(value: string | null | undefined, fallback: Currency): Currency {
  return isCurrency(value) ? value : fallback;
}

/** Rounds a money value to 2 decimal places. */
function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Orders per-currency totals most-used first: expense count, then total, then
 * code. Comparing totals across currencies is only a tie-break — ¥10,000 and
 * €10,000 are not the same size — which is why count leads. Mirrors the ORDER BY
 * in the expense_dashboard_aggregates RPC (00186) so the API, mobile and web
 * agree on which currency is "primary".
 */
export function compareCurrencyTotals(a: CurrencyTotal, b: CurrencyTotal): number {
  return b.count - a.count || b.total - a.total || a.currency.localeCompare(b.currency);
}

/**
 * Sums amounts per stored currency. Never adds two currencies together: there
 * is no FX source, so €50 + $40 is two totals, not 90.
 *
 * - empty input -> `[]`
 * - one currency (the norm) -> one entry whose total is the plain sum
 * - several -> one entry per currency, primary first (see compareCurrencyTotals)
 *
 * Blank or unknown currency codes (rows predating the column) count as
 * `fallback`. Non-finite amounts are skipped.
 */
export function groupTotalsByCurrency(
  items: ReadonlyArray<CurrencyAmount>,
  fallback: Currency = 'USD',
): CurrencyTotal[] {
  const totals = new Map<Currency, CurrencyTotal>();
  for (const item of items) {
    const amount = Number(item.amount);
    if (!Number.isFinite(amount)) continue;
    const currency = resolveCurrency(item.currency, fallback);
    const entry = totals.get(currency) ?? { currency, total: 0, count: 0 };
    entry.total += amount;
    entry.count += 1;
    totals.set(currency, entry);
  }
  return [...totals.values()]
    .map((entry) => ({ ...entry, total: roundMoney(entry.total) }))
    .sort(compareCurrencyTotals);
}

/** The primary currency's total, or 0 for no items. Only meaningful as a
 *  single number when `groupTotalsByCurrency` returned one entry. */
export function primaryCurrencyTotal(groups: ReadonlyArray<CurrencyTotal>): number {
  return groups[0]?.total ?? 0;
}
