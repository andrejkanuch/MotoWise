import { palette } from '@motovault/design-system';
import {
  CURRENCY_SYMBOLS,
  type Currency,
  EXPENSE_CATEGORY_META,
  type ExpenseCategory,
} from '@motovault/types';
import type { TFunction } from 'i18next';

// Colours, labels and the primary chip set all derive from the single source of
// truth (packages/types EXPENSE_CATEGORY_META). `colorToken` is a palette key,
// resolved here so @motovault/types stays free of a design-system dependency.
export const CATEGORY_COLORS: Record<string, string> = Object.fromEntries(
  EXPENSE_CATEGORY_META.map((m) => [
    m.key,
    palette[m.colorToken as keyof typeof palette] ?? palette.neutral500,
  ]),
);

export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  EXPENSE_CATEGORY_META.map((m) => [m.key, m.label]),
);

/** Categories shown as chips in the simple/default form state. */
export const PRIMARY_CATEGORIES: ExpenseCategory[] = EXPENSE_CATEGORY_META.filter(
  (m) => m.primary,
).map((m) => m.key);

// Intl.NumberFormat construction is expensive (~0.5-1ms). Cache instances per currency.
// With max 25 currencies, memory is ~25KB — negligible.
const formatterCache = new Map<string, Intl.NumberFormat>();

/** Format a numeric amount with the correct currency symbol and decimal places.
 *  Locale is hardcoded to en-US (app is English-only for now). */
export function formatCurrency(amount: number, currency: Currency = 'USD'): string {
  let formatter = formatterCache.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    });
    formatterCache.set(currency, formatter);
  }
  return formatter.format(amount);
}

/** Get the currency symbol for display (e.g., input prefix).
 *  Uses a static map because formatToParts() is broken on iOS Hermes. */
export function getCurrencySymbol(currency: Currency): string {
  return CURRENCY_SYMBOLS[currency] ?? currency;
}

/** Currencies with no decimal subdivision — restrict input to whole numbers. */
export const ZERO_DECIMAL_CURRENCIES: Set<Currency> = new Set(['JPY', 'CLP', 'HUF'] as const);

/** Format user input for a currency amount, restricting decimals for zero-decimal currencies. */
export function formatCurrencyInput(value: string, currency: Currency = 'USD'): string {
  if (ZERO_DECIMAL_CURRENCIES.has(currency)) {
    return value.replace(/[^0-9]/g, '');
  }
  const digits = value.replace(/[^0-9.]/g, '');
  const parts = digits.split('.');
  if (parts.length > 2) return `${parts[0]}.${parts.slice(1).join('')}`;
  if (parts[1] && parts[1].length > 2) return `${parts[0]}.${parts[1].slice(0, 2)}`;
  return digits;
}

/** Format a money amount in a SPECIFIC currency (currency-aware display).
 *  Every expense/task stores its own `currency` at creation; render it in that
 *  currency rather than the user's current display currency (no FX conversion —
 *  a stored $120 must never show as €120). Unknown/blank currency (legacy rows
 *  predating the column) falls back to `fallback`, which callers set to the
 *  user's display currency so those rows keep today's behavior.
 *  `formatCurrency` (Intl) already handles ZERO_DECIMAL_CURRENCIES correctly. */
export function formatMoney(
  amount: number,
  currency: string | null | undefined,
  fallback: Currency = 'USD',
): string {
  const resolved: Currency =
    currency && currency in CURRENCY_SYMBOLS ? (currency as Currency) : fallback;
  return formatCurrency(amount, resolved);
}

export interface CurrencyTotal {
  currency: Currency;
  total: number;
}

/** Sum amounts grouped by their stored currency (blank -> `fallback`), sorted by
 *  total desc so the dominant currency comes first. The single-currency case
 *  (the norm) yields exactly one group whose total equals the plain sum. */
export function groupTotalsByCurrency(
  items: ReadonlyArray<{ amount: number; currency?: string | null }>,
  fallback: Currency = 'USD',
): CurrencyTotal[] {
  const totals = new Map<Currency, number>();
  for (const { amount, currency } of items) {
    const key: Currency =
      currency && currency in CURRENCY_SYMBOLS ? (currency as Currency) : fallback;
    totals.set(key, (totals.get(key) ?? 0) + amount);
  }
  return [...totals.entries()]
    .map(([currency, total]) => ({ currency, total }))
    .sort((a, b) => b.total - a.total);
}

/** The currency accounting for the largest summed amount (blank -> `fallback`).
 *  Used to label server-summed aggregates that carry no per-currency dimension
 *  (dashboard totals) — best-effort so the symbol matches the underlying data in
 *  the common single-currency case instead of the user's display currency. */
export function dominantCurrency(
  items: ReadonlyArray<{ amount: number; currency?: string | null }>,
  fallback: Currency = 'USD',
): Currency {
  return groupTotalsByCurrency(items, fallback)[0]?.currency ?? fallback;
}

/** Render one or more per-currency subtotals. Single currency -> the plain
 *  formatted total (unchanged from before). Mixed currencies -> each subtotal
 *  joined by " · " (e.g. "$1,200.00 · €340.00"), since summing across currencies
 *  without FX would be meaningless. */
export function formatCurrencyTotals(groups: CurrencyTotal[], fallback: Currency = 'USD'): string {
  if (groups.length === 0) return formatMoney(0, fallback, fallback);
  return groups.map((g) => formatMoney(g.total, g.currency, fallback)).join(' · ');
}

export function formatExpenseDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Humanize a canonical maintenance service-type key for display
 *  ("oil_change" -> "Oil change"). Shared by the maintenance task card, the
 *  receipt review card and the expense detail's linked service record. */
export function humanizeServiceType(key: string | null | undefined): string {
  if (!key) return '';
  const spaced = key.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Localized display label for a canonical maintenance service-type key
 *  ("oil_change" -> "Oil change" / "Vidange" / …). Display-only: the canonical
 *  KEY is what is persisted and sent to the server, so translating the label is
 *  safe. Falls back to the English `humanizeServiceType` when a locale is missing
 *  the key. `t` is passed in so this module stays free of an i18n-instance import. */
export function serviceTypeLabel(key: string | null | undefined, t: TFunction): string {
  if (!key) return '';
  return t(`serviceType.${key}`, { defaultValue: humanizeServiceType(key) });
}

/** Resolve the display title for an expense: prefer the structured item name,
 *  then the free-text note, then the (already-translated) category label. Single
 *  source of truth for the fallback ORDER so the list row and the detail screen
 *  never diverge. The caller passes the resolved `categoryLabel` (via `t()`) so
 *  this module stays free of an i18n dependency and both surfaces translate. */
export function getExpenseTitle(
  expense: { itemName?: string | null; description?: string | null },
  categoryLabel: string,
): string {
  return expense.itemName?.trim() || expense.description?.trim() || categoryLabel;
}
