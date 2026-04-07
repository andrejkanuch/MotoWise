import { ExpenseDashboardDocument } from '@motovault/graphql';
import { EXPENSE_CATEGORIES } from '@motovault/types/validators';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { gqlFetcher } from '../lib/graphql-client';
import { queryKeys } from '../lib/query-keys';

const PERIOD_OPTIONS = ['thisYear', 'lastYear', 'allTime'] as const;
type Period = (typeof PERIOD_OPTIONS)[number];

export { PERIOD_OPTIONS };
export type { Period };

export function useExpenseDashboard(motorcycleId: string) {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: [...queryKeys.expenses.byMotorcycle(motorcycleId), 'dashboard'],
    queryFn: () => gqlFetcher(ExpenseDashboardDocument, { motorcycleId }),
    staleTime: 5 * 60 * 1000,
  });

  const dashboard = data?.expenseDashboard;

  return {
    dashboard,
    isPending,
    isError,
    refetch,
  };
}

export function useDashboardData(
  dashboard: NonNullable<ReturnType<typeof useExpenseDashboard>['dashboard']> | undefined,
  period: Period,
) {
  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;

  const filteredBuckets = useMemo(() => {
    if (!dashboard) return [];
    const { monthlyBuckets } = dashboard;

    switch (period) {
      case 'thisYear':
        return monthlyBuckets.filter((b) => b.year === currentYear);
      case 'lastYear':
        return monthlyBuckets.filter((b) => b.year === previousYear);
      case 'allTime': {
        // Most recent 12 months
        const sorted = [...monthlyBuckets].sort(
          (a, b) => b.year * 12 + b.month - (a.year * 12 + a.month),
        );
        return sorted.slice(0, 12).reverse();
      }
    }
  }, [dashboard, period, currentYear, previousYear]);

  const periodTotal = useMemo(() => {
    if (!dashboard) return 0;
    switch (period) {
      case 'thisYear':
        return dashboard.currentYearTotal;
      case 'lastYear':
        return dashboard.previousYearTotal;
      case 'allTime':
        return dashboard.allTimeTotal;
    }
  }, [dashboard, period]);

  const categoryTotals = useMemo(() => {
    if (!dashboard || !filteredBuckets.length) return [];

    const totals: Record<string, number> = {};
    for (const bucket of filteredBuckets) {
      for (const cat of EXPENSE_CATEGORIES) {
        totals[cat] = (totals[cat] ?? 0) + (bucket[cat] ?? 0);
      }
    }

    return Object.entries(totals)
      .filter(([, total]) => total > 0)
      .map(([category, total]) => ({ category, total: Math.round(total * 100) / 100 }));
  }, [dashboard, filteredBuckets]);

  return {
    filteredBuckets,
    periodTotal,
    categoryTotals,
  };
}
