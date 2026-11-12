import {
  GetExpenseCostTrendDocument,
  type GetExpenseCostTrendQuery,
  type GetExpenseCostTrendQueryVariables,
} from '@motovault/graphql';
import { COST_TREND_MIN_EXPENSES } from '@motovault/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { gqlFetcher } from '@/lib/graphql-client';
import { queryKeys } from '@/lib/query-keys';
import { QUERY_META } from '@/lib/query-meta';

export type CostTrendData = GetExpenseCostTrendQuery['expenseCostTrend'];

function fetchCostTrend(motorcycleId: string, timeZone: string, refreshEntitlement: boolean) {
  const variables: GetExpenseCostTrendQueryVariables = { motorcycleId, timeZone };
  if (refreshEntitlement) variables.refreshEntitlement = true;
  return gqlFetcher(GetExpenseCostTrendDocument, variables);
}

/**
 * The bike's 12-month cost trend, fetched only once the bike has
 * `COST_TREND_MIN_EXPENSES` expenses. `refreshEntitlement` re-reads the tier
 * on the server (after a purchase); it is a request flag, not part of the key.
 */
export function useExpenseCostTrend(motorcycleId: string, expenseCount: number) {
  const queryClient = useQueryClient();
  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const query = useQuery({
    queryKey: queryKeys.expenses.costTrend(motorcycleId, timeZone),
    queryFn: () => fetchCostTrend(motorcycleId, timeZone, false),
    enabled: !!motorcycleId && expenseCount >= COST_TREND_MIN_EXPENSES,
    // The card renders nothing when the trend is absent; pull to refresh retries.
    meta: QUERY_META.OWN_ERROR_UI,
  });

  // A plain fetch still in flight is cancelled first: landing after this
  // answer, it would put the free payload back over the refreshed one.
  const refreshEntitlement = useCallback(async () => {
    const queryKey = queryKeys.expenses.costTrend(motorcycleId, timeZone);
    const data = await fetchCostTrend(motorcycleId, timeZone, true);
    await queryClient.cancelQueries({ queryKey, exact: true });
    queryClient.setQueryData(queryKey, data);
  }, [queryClient, motorcycleId, timeZone]);

  return { trend: query.data?.expenseCostTrend ?? null, refreshEntitlement };
}
