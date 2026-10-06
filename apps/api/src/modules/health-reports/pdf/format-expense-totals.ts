import { CURRENCY_TOTALS_SEPARATOR } from '@motovault/types';

/** Locale for the PDF's money formatting (the report is English-only). */
const REPORT_LOCALE = 'en-US';

/**
 * Renders per-currency expense totals for the health report. One currency
 * gives the plain formatted total; several are joined, never summed (there is
 * no FX source). Empty input gives an empty string.
 */
export function formatExpenseTotals(
  totals: ReadonlyArray<{ currency: string; total: number }>,
): string {
  return totals
    .map(({ currency, total }) =>
      new Intl.NumberFormat(REPORT_LOCALE, { style: 'currency', currency }).format(total),
    )
    .join(CURRENCY_TOTALS_SEPARATOR);
}
