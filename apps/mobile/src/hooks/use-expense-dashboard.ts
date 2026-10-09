import { ExpenseDashboardDocument, type ExpenseDashboardQuery } from '@motovault/graphql';
import { breakdownTotals, dashboardBreakdowns, selectBreakdown } from '@motovault/types';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  categoryTotalsFromBuckets,
  filterBucketsForPeriod,
  PERIOD_OPTIONS,
  type Period,
  periodTotalOf,
} from '../lib/expense-dashboard-period';
import { gqlFetcher } from '../lib/graphql-client';
import { queryKeys } from '../lib/query-keys';

export type { Period };
export { PERIOD_OPTIONS };

type ExpenseDashboard = ExpenseDashboardQuery['expenseDashboard'];

const EXPENSE_DASHBOARD_STALE_MS = 5 * 60 * 1000;

/**
 * The expense dashboard query for one bike: key, fetcher and staleTime. Shared
 * with the Get Started checklist's "first expense" signal so both read one cache
 * entry under one freshness rule.
 */
export function expenseDashboardQueryOptions(motorcycleId: string) {
  return queryOptions({
    queryKey: [...queryKeys.expenses.byMotorcycle(motorcycleId), 'dashboard'] as const,
    queryFn: () => gqlFetcher(ExpenseDashboardDocument, { motorcycleId }),
    staleTime: EXPENSE_DASHBOARD_STALE_MS,
  });
}

export function useExpenseDashboard(motorcycleId: string | undefined) {
  const { data, isPending, isError, refetch } = useQuery({
    ...expenseDashboardQueryOptions(motorcycleId ?? ''),
    enabled: !!motorcycleId,
  });

  const dashboard = data?.expenseDashboard;

  return {
    dashboard,
    isPending,
    isError,
    refetch,
  };
}

/**
 * Period view of the expense dashboard. Amounts are never summed across
 * currencies: `periodTotals` has one entry per currency (render with
 * formatCurrencyTotals), while the charts and derived stats (`filteredBuckets`,
 * `periodTotal`, `categoryTotals`) are for ONE currency, `selected`.
 *
 * `currency` picks that breakdown (falls back to the most-used one).
 * `legacyCurrency` labels a dashboard from an API that predates per-currency
 * aggregates.
 */
export function useDashboardData(
  dashboard: ExpenseDashboard | undefined,
  period: Period,
  options: { currency?: string | null; legacyCurrency: string },
) {
  const { currency, legacyCurrency } = options;
  const currentYear = new Date().getFullYear();

  const breakdowns = useMemo(
    () => dashboardBreakdowns(dashboard, legacyCurrency),
    [dashboard, legacyCurrency],
  );
  const selected = useMemo(() => selectBreakdown(breakdowns, currency), [breakdowns, currency]);

  const filteredBuckets = useMemo(
    () => filterBucketsForPeriod(selected?.monthlyBuckets ?? [], period, currentYear),
    [selected, period, currentYear],
  );

  const periodTotal = selected ? periodTotalOf(selected, period) : 0;

  const periodTotals = useMemo(
    () => breakdownTotals(breakdowns, (b) => periodTotalOf(b, period)),
    [breakdowns, period],
  );

  const categoryTotals = useMemo(
    () => categoryTotalsFromBuckets(filteredBuckets),
    [filteredBuckets],
  );

  return {
    breakdowns,
    selected,
    filteredBuckets,
    periodTotal,
    periodTotals,
    categoryTotals,
  };
}
