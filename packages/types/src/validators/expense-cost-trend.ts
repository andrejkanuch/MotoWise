import { z } from 'zod';

/**
 * The `expenseCostTrend` contract: monthly spend for one bike, one series per
 * currency, months in the rider's zone.
 *
 * Every object is strict and the API returns the PARSED result, so a key that
 * is not listed here cannot reach a client. A free rider gets the headline
 * (window, counts, the first currency) and the names of the locked sections,
 * and `series` is null: no money figure is in a free response.
 */

/** Months in the trend window, the rider's current month included. */
export const COST_TREND_MONTHS = 12;

/** The Pro sections of the cost trend. A free response lists all of them as locked. */
export const COST_TREND_SECTION = {
  /** Each currency's spend per month (`series[].months`). */
  MONTHLY_TOTALS: 'monthly_totals',
  /** Each currency's spend over the whole window (`series[].total`). */
  PERIOD_TOTALS: 'period_totals',
} as const;
export type CostTrendSection = (typeof COST_TREND_SECTION)[keyof typeof COST_TREND_SECTION];

const MonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Must be YYYY-MM format');

export const CostTrendMonthSchema = z.strictObject({
  month: MonthSchema,
  total: z.number().nonnegative(),
});
export type CostTrendMonth = z.infer<typeof CostTrendMonthSchema>;

export const CostTrendSeriesSchema = z.strictObject({
  currency: z.string(),
  expenseCount: z.number().int().nonnegative(),
  total: z.number().nonnegative(),
  /** Every month of the window, oldest first; 0 for a month with no spend. */
  months: z.array(CostTrendMonthSchema),
});
export type CostTrendSeries = z.infer<typeof CostTrendSeriesSchema>;

export const CostTrendSchema = z.strictObject({
  isPro: z.boolean(),
  /** IANA zone that decides the rider's current month. */
  timeZone: z.string(),
  fromMonth: MonthSchema,
  toMonth: MonthSchema,
  /** Live expenses in the window, every currency. */
  expenseCount: z.number().int().nonnegative(),
  /** Currency of the first series (most expenses in the window); null with no expenses. */
  currency: z.string().nullable(),
  /** Expenses in the window in a currency other than `currency`. */
  otherCurrencyExpenseCount: z.number().int().nonnegative(),
  lockedSections: z.array(z.enum(COST_TREND_SECTION)),
  /** One series per currency, most expenses first. Null when the sections are locked. */
  series: z.array(CostTrendSeriesSchema).nullable(),
});
export type CostTrend = z.infer<typeof CostTrendSchema>;
