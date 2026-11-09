import {
  GetRiderInsightsDocument,
  type GetRiderInsightsQuery,
  type GetRiderInsightsQueryVariables,
} from '@motovault/graphql';
import { type MeasurementSystem, metersToUnit, mileageUnitLabel } from '@motovault/types';
import {
  type FetchStatus,
  onlineManager,
  queryOptions,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { gqlFetcher } from '@/lib/graphql-client';
import { queryKeys } from '@/lib/query-keys';
import { useSubscriptionStore } from '@/stores/subscription.store';

export type RiderInsightsData = GetRiderInsightsQuery['riderInsights'];
export type RiderInsightsRegion = RiderInsightsData['regions'][number];

/** How long after a purchase the store's Pro state stands in for a server that has not caught up. */
export const PURCHASE_TRUST_WINDOW_MS = 2 * 60 * 1000;
/** How often the server is asked again while it still reads the rider as free after a purchase. */
export const PURCHASE_REFRESH_INTERVAL_MS = 10 * 1000;

/** The device's IANA zone; the API places the season and each day in it. */
export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Rider insights for the season the API picks. `refreshEntitlement` asks the
 * API to re-read the rider's tier from RevenueCat first; it is a one-off
 * request flag, not part of the payload's identity, so it is not in the key.
 */
export function riderInsightsOptions(timeZone: string) {
  return queryOptions({
    queryKey: queryKeys.rides.insights(timeZone),
    queryFn: () => fetchRiderInsights(timeZone, false),
  });
}

/** A season's dates, both ends included, as `YYYY-MM-DD`. */
export interface SeasonWindow {
  from: string;
  to: string;
}

const YEAR_LENGTH = 4;

/** The calendar-year season a local date (`YYYY-MM-DD`) falls in, as the API counts seasons. */
export function seasonWindowOf(localDate: string): SeasonWindow {
  const year = localDate.slice(0, YEAR_LENGTH);
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

/** Whether a local date (`YYYY-MM-DD`) is inside a season; ISO dates compare as strings. */
export function isInSeason(season: SeasonWindow, localDate: string): boolean {
  return season.from <= localDate && localDate <= season.to;
}

/** Rider insights for an explicit window, under its own key so it never replaces the shown season. */
export function riderInsightsWindowOptions(timeZone: string, window: SeasonWindow) {
  return queryOptions({
    queryKey: queryKeys.rides.insightsWindow(timeZone, window.from, window.to),
    queryFn: () => gqlFetcher(GetRiderInsightsDocument, { timeZone, ...window }),
  });
}

function fetchRiderInsights(timeZone: string, refreshEntitlement: boolean) {
  const variables: GetRiderInsightsQueryVariables = { timeZone };
  if (refreshEntitlement) variables.refreshEntitlement = true;
  return gqlFetcher(GetRiderInsightsDocument, variables);
}

/** A distance in the rider's unit, grouped for their language: `{ value: '2,507', unit: 'km' }`. */
export function distanceParts(
  meters: number,
  system: MeasurementSystem,
  language: string,
): { value: string; unit: string } {
  const unit = mileageUnitLabel(system);
  const amount = metersToUnit(meters, unit);
  const value = new Intl.NumberFormat(language, {
    maximumFractionDigits: amount > 0 && amount < 10 ? 1 : 0,
  }).format(amount);
  return { value, unit };
}

/** `2,507 km` */
export function formatInsightDistance(
  meters: number,
  system: MeasurementSystem,
  language: string,
): string {
  const { value, unit } = distanceParts(meters, system, language);
  return `${value} ${unit}`;
}

export const INSIGHTS_VIEW = {
  LOADING: 'loading',
  OFFLINE: 'offline',
  ERROR: 'error',
  READY: 'ready',
} as const;
export type InsightsView = (typeof INSIGHTS_VIEW)[keyof typeof INSIGHTS_VIEW];

interface ViewInput {
  hasData: boolean;
  isError: boolean;
  fetchStatus: FetchStatus;
  isOnline: boolean;
}

/**
 * What the screen shows. A saved copy is shown whenever there is one, marked
 * stale while the latest request is paused or failed. Without one, an offline
 * device gets the offline state and a failed request the error state: never a
 * placeholder number.
 */
export function insightsViewState({ hasData, isError, fetchStatus, isOnline }: ViewInput): {
  view: InsightsView;
  stale: boolean;
} {
  const paused = fetchStatus === 'paused';
  if (hasData) return { view: INSIGHTS_VIEW.READY, stale: paused || isError };
  if (paused || (isError && !isOnline)) return { view: INSIGHTS_VIEW.OFFLINE, stale: false };
  if (isError) return { view: INSIGHTS_VIEW.ERROR, stale: false };
  return { view: INSIGHTS_VIEW.LOADING, stale: false };
}

/**
 * Whether a region's routes are in hand. A region with bounds always has at
 * least one route in a server response, so bounds without routes means the
 * entry came from the offline cache, which is written without geometry.
 */
export function hasRegionGeometry(region: RiderInsightsRegion): boolean {
  return region.bounds === null || region.routes.length > 0;
}

/**
 * Locked rows read "unlocking" instead of opening the paywall while the store
 * says Pro, the server still says free, and the purchase was under two minutes
 * ago. After that the server's answer stands.
 */
export function isUnlocking(input: {
  serverPro: boolean;
  storePro: boolean;
  trustUntil: number | null;
  now: number;
}): boolean {
  return (
    input.trustUntil !== null && input.now < input.trustUntil && input.storePro && !input.serverPro
  );
}

export function useRiderInsights() {
  const queryClient = useQueryClient();
  const timeZone = useMemo(deviceTimeZone, []);
  const options = useMemo(() => riderInsightsOptions(timeZone), [timeZone]);
  const query = useQuery(options);
  const storePro = useSubscriptionStore((s) => s.isPro);
  const [trustUntil, setTrustUntil] = useState<number | null>(null);
  /** When the last ask failed: like a new answer, it schedules the next ask. */
  const [failedAt, setFailedAt] = useState(0);

  const insights = query.data?.riderInsights ?? null;
  const { view, stale } = insightsViewState({
    hasData: insights !== null,
    isError: query.isError,
    fetchStatus: query.fetchStatus,
    isOnline: onlineManager.isOnline(),
  });

  // A plain fetch still in flight is cancelled first: landing after this answer,
  // it would put the free payload back over the refreshed one.
  const refreshEntitlement = useCallback(async () => {
    try {
      const data = await fetchRiderInsights(timeZone, true);
      await queryClient.cancelQueries({ queryKey: options.queryKey, exact: true });
      queryClient.setQueryData(options.queryKey, data);
    } catch {
      setFailedAt(Date.now());
    }
  }, [queryClient, timeZone, options.queryKey]);

  /** After a purchase or restore: re-read the tier on the server and show what it returns. */
  const onPurchased = useCallback(async () => {
    setTrustUntil(Date.now() + PURCHASE_TRUST_WINDOW_MS);
    await refreshEntitlement();
  }, [refreshEntitlement]);

  const unlocking = isUnlocking({
    serverPro: insights?.isPro ?? false,
    storePro,
    trustUntil,
    now: Date.now(),
  });

  // While the server lags the store, ask it again until it agrees or the window
  // closes. Each answer moves `answeredAt` and each failed ask moves `failedAt`;
  // either schedules the next ask one interval after it.
  const answeredAt = query.dataUpdatedAt;
  useEffect(() => {
    if (!unlocking || trustUntil === null) return;
    const nextAsk = Math.max(answeredAt, failedAt) + PURCHASE_REFRESH_INTERVAL_MS;
    if (nextAsk >= trustUntil) return;
    const timer = setTimeout(() => void refreshEntitlement(), Math.max(0, nextAsk - Date.now()));
    return () => clearTimeout(timer);
  }, [unlocking, trustUntil, refreshEntitlement, answeredAt, failedAt]);

  // The window closes on its own: `unlocking` is read from the clock at render,
  // so without this nothing would render it false while the server stays silent.
  useEffect(() => {
    if (trustUntil === null) return;
    const timer = setTimeout(() => setTrustUntil(null), Math.max(0, trustUntil - Date.now()));
    return () => clearTimeout(timer);
  }, [trustUntil]);

  return {
    insights,
    view,
    stale,
    mapAvailable: insights ? insights.regions.every(hasRegionGeometry) : false,
    unlocking,
    onPurchased,
    retry: query.refetch,
    isRefetching: query.isRefetching,
  };
}
