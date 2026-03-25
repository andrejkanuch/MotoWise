import { palette } from '@motovault/design-system';

export const CATEGORY_COLORS: Record<string, string> = {
  fuel: palette.warning500,
  maintenance: palette.primary500,
  parts: palette.success500,
  gear: palette.danger500,
};

export const CATEGORY_LABELS: Record<string, string> = {
  fuel: 'Fuel',
  maintenance: 'Maintenance',
  parts: 'Parts',
  gear: 'Gear',
};

import { CURRENCY_SYMBOLS, type Currency } from '@motovault/types';

// Intl.NumberFormat construction is expensive (~0.5-1ms). Cache instances per currency.
// With max 15 currencies, memory is ~15KB — negligible.
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

/** Format user input for a currency amount, restricting decimals for zero-decimal currencies. */
export function formatCurrencyInput(value: string, currency: Currency = 'USD'): string {
  if (currency === 'JPY') {
    return value.replace(/[^0-9]/g, '');
  }
  const digits = value.replace(/[^0-9.]/g, '');
  const parts = digits.split('.');
  if (parts.length > 2) return `${parts[0]}.${parts.slice(1).join('')}`;
  if (parts[1] && parts[1].length > 2) return `${parts[0]}.${parts[1].slice(0, 2)}`;
  return digits;
}

export function formatExpenseDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
