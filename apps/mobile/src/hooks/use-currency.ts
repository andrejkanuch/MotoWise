import { useCallback } from 'react';
import { formatCurrency, getCurrencySymbol } from '../lib/expense-constants';
import { useAuthStore } from '../stores/auth.store';

/** Returns the user's currency preference and a bound formatter.
 *  Only components that call this hook re-render when currency changes. */
export function useCurrency() {
  const currency = useAuthStore((s) => s.currency);

  const format = useCallback((amount: number) => formatCurrency(amount, currency), [currency]);

  const symbol = getCurrencySymbol(currency);

  return { currency, format, symbol };
}
