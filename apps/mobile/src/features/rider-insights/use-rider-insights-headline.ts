import {
  GetRiderInsightsHeadlineDocument,
  type GetRiderInsightsHeadlineQuery,
} from '@motovault/graphql';
import { onlineManager, queryOptions, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { gqlFetcher } from '@/lib/graphql-client';
import { queryKeys } from '@/lib/query-keys';
import { deviceTimeZone, insightsViewState } from './use-rider-insights';

export type RiderInsightsHeadline = GetRiderInsightsHeadlineQuery['riderInsights'];

const HEADLINE_KEY = 'headline';

/**
 * The season's free headline numbers for Home: totals, coverage, the latest ride
 * and country names, without regions, routes or Pro groups. Cached under the
 * full query's key plus `headline`, so a ride save that refreshes Rider insights
 * refreshes this too, while the two payloads never overwrite each other.
 */
export function riderInsightsHeadlineOptions(timeZone: string) {
  return queryOptions({
    queryKey: [...queryKeys.rides.insights(timeZone), HEADLINE_KEY] as const,
    queryFn: () => gqlFetcher(GetRiderInsightsHeadlineDocument, { timeZone }),
    // The Home card draws its own failed state.
    meta: { showErrorAlert: false },
  });
}

export function useRiderInsightsHeadline() {
  const timeZone = useMemo(deviceTimeZone, []);
  const query = useQuery(riderInsightsHeadlineOptions(timeZone));
  const headline = query.data?.riderInsights ?? null;
  const { view } = insightsViewState({
    hasData: headline !== null,
    isError: query.isError,
    fetchStatus: query.fetchStatus,
    isOnline: onlineManager.isOnline(),
  });
  return { headline, view };
}
