/**
 * Client helpers for the per-currency expense dashboard (API `expenseDashboard`,
 * RPC 00186). Shapes are structural so mobile and web can pass their generated
 * GraphQL types straight in without this package depending on @motovault/graphql.
 */

export interface CategoryTotalLike {
  category: string;
  total: number;
}

export interface MonthlyBucketLike {
  year: number;
  month: number;
  total: number;
  categories: ReadonlyArray<CategoryTotalLike>;
}

/** Every money figure in a breakdown is in its `currency`. */
export interface ExpenseBreakdownLike {
  currency: string;
  currentYearTotal: number;
  previousYearTotal: number;
  allTimeTotal: number;
  expenseCount: number;
  monthlyBuckets: ReadonlyArray<MonthlyBucketLike>;
  categoryTotals: ReadonlyArray<CategoryTotalLike>;
}

export interface ExpenseDashboardLike extends Omit<ExpenseBreakdownLike, 'currency'> {
  currency?: string | null;
  /** Absent on cached responses from before the field existed. */
  currencies?: ReadonlyArray<ExpenseBreakdownLike> | null;
}

/**
 * The dashboard as one breakdown per currency, most-used first.
 *
 * - no dashboard, or no expenses -> `[]`
 * - API with per-currency aggregates -> `dashboard.currencies` as served
 * - API before 00186 (no `currencies`) -> the legacy top-level figures as one
 *   breakdown in `legacyCurrency` (callers pass their best guess, e.g. the
 *   currency most of the bike's expense rows use) so the screen still renders
 */
export function dashboardBreakdowns(
  dashboard: ExpenseDashboardLike | null | undefined,
  legacyCurrency: string,
): ExpenseBreakdownLike[] {
  if (!dashboard || dashboard.expenseCount === 0) return [];
  if (dashboard.currencies && dashboard.currencies.length > 0) return [...dashboard.currencies];
  return [
    {
      currency: dashboard.currency ?? legacyCurrency,
      currentYearTotal: dashboard.currentYearTotal,
      previousYearTotal: dashboard.previousYearTotal,
      allTimeTotal: dashboard.allTimeTotal,
      expenseCount: dashboard.expenseCount,
      monthlyBuckets: dashboard.monthlyBuckets,
      categoryTotals: dashboard.categoryTotals,
    },
  ];
}

/** The breakdown in `preferred` when the bike has one, else the primary
 *  (most-used) breakdown; `undefined` when there are none. */
export function selectBreakdown<B extends { currency: string }>(
  breakdowns: ReadonlyArray<B>,
  preferred: string | null | undefined,
): B | undefined {
  return breakdowns.find((b) => b.currency === preferred) ?? breakdowns[0];
}

/**
 * One figure per currency, for rendering as "€320 · $45". Currencies whose
 * figure is zero are dropped (a currency with no spend this year should not
 * print "$0.00" beside the real total); an all-zero result is `[]`.
 */
export function breakdownTotals<B extends { currency: string }>(
  breakdowns: ReadonlyArray<B>,
  pick: (breakdown: B) => number,
): { currency: string; total: number }[] {
  return breakdowns
    .map((breakdown) => ({ currency: breakdown.currency, total: pick(breakdown) }))
    .filter(({ total }) => total !== 0);
}
