import type { CategoryTotalLike, ExpenseBreakdownLike, MonthlyBucketLike } from '@motovault/types';

export const PERIOD_OPTIONS = ['thisYear', 'lastYear', 'allTime'] as const;
export type Period = (typeof PERIOD_OPTIONS)[number];

/** Months of history the "all time" trend chart shows. */
const ALL_TIME_TREND_MONTHS = 12;

/** A breakdown's total for the period. Every breakdown is one currency. */
export function periodTotalOf(breakdown: ExpenseBreakdownLike, period: Period): number {
  const byPeriod: Record<Period, number> = {
    thisYear: breakdown.currentYearTotal,
    lastYear: breakdown.previousYearTotal,
    allTime: breakdown.allTimeTotal,
  };
  return byPeriod[period];
}

/** The month buckets that fall in the period. "All time" is the most recent
 *  12 months with spend, oldest first, which is what the trend chart plots. */
export function filterBucketsForPeriod<B extends MonthlyBucketLike>(
  buckets: ReadonlyArray<B>,
  period: Period,
  currentYear: number,
): B[] {
  switch (period) {
    case 'thisYear':
      return buckets.filter((b) => b.year === currentYear);
    case 'lastYear':
      return buckets.filter((b) => b.year === currentYear - 1);
    case 'allTime':
      return [...buckets]
        .sort((a, b) => b.year * 12 + b.month - (a.year * 12 + a.month))
        .slice(0, ALL_TIME_TREND_MONTHS)
        .reverse();
  }
}

/** A breakdown's spend in one calendar month (0 when it has no bucket). */
export function monthTotalOf(breakdown: ExpenseBreakdownLike, year: number, month: number): number {
  return breakdown.monthlyBuckets.find((b) => b.year === year && b.month === month)?.total ?? 0;
}

/** Per-category totals across the given buckets (zero categories dropped). */
export function categoryTotalsFromBuckets(
  buckets: ReadonlyArray<MonthlyBucketLike>,
): CategoryTotalLike[] {
  const totals: Record<string, number> = {};
  for (const bucket of buckets) {
    for (const { category, total } of bucket.categories) {
      totals[category] = (totals[category] ?? 0) + total;
    }
  }
  return Object.entries(totals)
    .filter(([, total]) => total > 0)
    .map(([category, total]) => ({ category, total: Math.round(total * 100) / 100 }));
}
