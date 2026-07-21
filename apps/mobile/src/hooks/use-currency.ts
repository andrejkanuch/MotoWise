import { useCallback } from 'react';
import { formatCurrency, formatMoney, getCurrencySymbol } from '../lib/expense-constants';
import { useAuthStore } from '../stores/auth.store';

/** Returns the user's currency preference and bound formatters.
 *  Only components that call this hook re-render when currency changes. */
export function useCurrency() {
  const currency = useAuthStore((s) => s.currency);

  const format = useCallback((amount: number) => formatCurrency(amount, currency), [currency]);

  // Currency-aware formatter: renders an amount in its OWN stored currency,
  // falling back to the user's display currency for legacy null-currency rows.
  const formatFor = useCallback(
    (amount: number, recordCurrency: string | null | undefined) =>
      formatMoney(amount, recordCurrency, currency),
    [currency],
  );

  const symbol = getCurrencySymbol(currency);

  return { currency, format, formatFor, symbol };
}
