import {
  type ExpensesByMotorcycleQuery,
  type MyRidesQuery,
  NotesByMotorcycleDocument,
  type NotesByMotorcycleQuery,
  type ReceiptScanQuotaQuery,
} from '@motovault/graphql';
import {
  type FetchQueryOptions,
  type QueryClient,
  type QueryKey,
  useIsRestoring,
  useQueryClient,
} from '@tanstack/react-query';
import { getLocales } from 'expo-localization';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WHATS_NEW_TIMING } from '@/config/whats-new';
import type { WhatsNewFeature } from '@/data/whats-new-releases';
import {
  deviceTimeZone,
  type RiderInsightsData,
  riderInsightsOptions,
} from '@/features/rider-insights/use-rider-insights';
import { riderInsightsHeadlineOptions } from '@/features/rider-insights/use-rider-insights-headline';
import { categoryLabel } from '@/lib/expense-constants';
import { gqlFetcher } from '@/lib/graphql-client';
import { queryKeys } from '@/lib/query-keys';
import { QUERY_META } from '@/lib/query-meta';
import { EXPENSES_ALL_YEARS, expensesOptions, motorcyclesOptions } from '@/lib/query-options';
import { useAuthStore } from '@/stores/auth.store';
import { useSubscriptionStore } from '@/stores/subscription.store';
import { selectPrimaryBike } from '@/utils/primary-bike';
import {
  type BootData,
  type BootSnapshotInput,
  buildBoot,
  buildBootSnapshot,
  type SourcedRead,
  WHATS_NEW_DATA_SOURCE,
  type WhatsNewPageData,
  type WhatsNewPageDataMap,
} from './build-boot-snapshot';

type Notes = NotesByMotorcycleQuery['notes'];

/** Home's recent-rides entry, as `use-home-data` keys it. */
const HOME_RIDES_LIST = 'home';

const FETCH_STATE = {
  PENDING: 'pending',
  FETCHED: 'fetched',
  /** Failed, or cut off at the time budget. */
  MISSED: 'missed',
  /** Nothing to ask for: no bike, or not a Pro rider for the full insights. */
  SKIPPED: 'skipped',
} as const;

type FetchState = (typeof FETCH_STATE)[keyof typeof FETCH_STATE];

interface Fetched<T> {
  state: FetchState;
  data: T | null;
}

interface CacheReads {
  headline: BootSnapshotInput['headline'];
  insights: RiderInsightsData | null;
  rides: MyRidesQuery | null;
  bikes: BootSnapshotInput['bikes'];
  expenses: ExpensesByMotorcycleQuery | null;
  notes: Notes | null;
  scanQuotaUsed: number | null;
}

interface Fetches {
  expenses: Fetched<ExpensesByMotorcycleQuery>;
  notes: Fetched<Notes>;
  insights: Fetched<RiderInsightsData>;
}

type FetchKey = keyof Fetches;

interface SnapshotSession {
  userId: string;
  cache: CacheReads;
  fetches: Fetches;
}

export interface BootSnapshotHandle {
  /** The cache has been restored and read for the signed-in rider. */
  ready: boolean;
  /** The boot's odometer, from the cache only, so it never changes mid-roll. */
  boot: BootData | null;
  /** Features the rider already uses, as known right now. */
  priorUse: readonly WhatsNewFeature[];
  /**
   * A page's data. The first call for a page freezes it: later fetches no
   * longer change a page the rider has seen. Null until `ready`.
   */
  getPageData: <F extends WhatsNewFeature>(feature: F) => WhatsNewPageDataMap[F] | null;
}

const NO_PRIOR_USE: readonly WhatsNewFeature[] = [];
const SKIPPED = { state: FETCH_STATE.SKIPPED, data: null } as const;
const PENDING = { state: FETCH_STATE.PENDING, data: null } as const;
/** These fetches back a page that falls back to an example: no retry, no alert. */
const QUIET_FETCH = { retry: false, meta: QUERY_META.OWN_ERROR_UI } as const;

function notesOptions(motorcycleId: string) {
  return {
    queryKey: queryKeys.notes.byMotorcycle(motorcycleId),
    queryFn: () => gqlFetcher(NotesByMotorcycleDocument, { motorcycleId }),
  };
}

function readCache(queryClient: QueryClient, timeZone: string): CacheReads {
  const bikes = queryClient.getQueryData(motorcyclesOptions().queryKey)?.myMotorcycles ?? [];
  const primary = selectPrimaryBike(bikes);
  return {
    headline:
      queryClient.getQueryData(riderInsightsHeadlineOptions(timeZone).queryKey)?.riderInsights ??
      null,
    insights:
      queryClient.getQueryData(riderInsightsOptions(timeZone).queryKey)?.riderInsights ?? null,
    rides: queryClient.getQueryData<MyRidesQuery>(queryKeys.rides.list(HOME_RIDES_LIST)) ?? null,
    bikes,
    expenses: primary
      ? (queryClient.getQueryData(expensesOptions(primary.id, EXPENSES_ALL_YEARS).queryKey) ?? null)
      : null,
    notes: primary
      ? (queryClient.getQueryData<NotesByMotorcycleQuery>(notesOptions(primary.id).queryKey)
          ?.notes ?? null)
      : null,
    scanQuotaUsed:
      queryClient.getQueryData<ReceiptScanQuotaQuery>(queryKeys.receiptScans.quota)
        ?.receiptScanQuota.used ?? null,
  };
}

/** The fetched value when it landed, else the cached one, else why there is none. */
function sourced<T>(fetched: Fetched<T>, cached: T | null): SourcedRead<T> {
  if (fetched.state === FETCH_STATE.FETCHED) {
    return { data: fetched.data, source: WHATS_NEW_DATA_SOURCE.FETCHED };
  }
  if (cached !== null) return { data: cached, source: WHATS_NEW_DATA_SOURCE.CACHE };
  return fetched.state === FETCH_STATE.SKIPPED
    ? { data: null, source: WHATS_NEW_DATA_SOURCE.NONE }
    : { data: null, source: WHATS_NEW_DATA_SOURCE.TIMED_OUT };
}

/**
 * Starts one fetch bounded by the What's New time budget. At the budget the
 * query is cancelled and the fetch counts as missed; whatever settles first wins.
 */
function startBoundedFetch<T, K extends QueryKey>(
  queryClient: QueryClient,
  options: FetchQueryOptions<T, Error, T, K>,
  settle: (result: Fetched<T>) => void,
): void {
  let settled = false;
  const finish = (result: Fetched<T>) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    settle(result);
  };
  const timer = setTimeout(() => {
    finish({ state: FETCH_STATE.MISSED, data: null });
    void queryClient.cancelQueries({ queryKey: options.queryKey });
  }, WHATS_NEW_TIMING.DATA_FETCH_TIMEOUT_MS);
  queryClient.fetchQuery({ ...options, ...QUIET_FETCH }).then(
    (data) => finish({ state: FETCH_STATE.FETCHED, data }),
    () => finish({ state: FETCH_STATE.MISSED, data: null }),
  );
}

/**
 * The data What's New shows, for the signed-in rider. Waits for the persisted
 * cache to restore, reads it once, and fetches the primary bike's expenses (all
 * years) and notes, plus the full Rider insights for a Pro rider, each within
 * the time budget. A failed or late fetch leaves that page on its example.
 * Everything resets when the signed-in rider changes.
 */
export function useBootSnapshot(): BootSnapshotHandle {
  const queryClient = useQueryClient();
  const isRestoring = useIsRestoring();
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const measurementSystem = useAuthStore((s) => s.measurementSystem);
  const currency = useAuthStore((s) => s.currency);
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const region = useMemo(() => getLocales()[0]?.regionCode ?? undefined, []);
  const [session, setSession] = useState<SnapshotSession | null>(null);
  const frozen = useRef<{ userId: string; pages: Map<WhatsNewFeature, WhatsNewPageData> } | null>(
    null,
  );

  useEffect(() => {
    if (isRestoring || !userId) return;
    let live = true;
    const timeZone = deviceTimeZone();
    const cache = readCache(queryClient, timeZone);
    const primary = selectPrimaryBike(cache.bikes);
    const isPro = useSubscriptionStore.getState().isPro;

    const settle =
      <K extends FetchKey>(key: K) =>
      (result: Fetches[K]) => {
        if (!live) return;
        setSession((prev) =>
          prev?.userId === userId ? { ...prev, fetches: { ...prev.fetches, [key]: result } } : prev,
        );
      };

    setSession({
      userId,
      cache,
      fetches: {
        expenses: primary ? PENDING : SKIPPED,
        notes: primary ? PENDING : SKIPPED,
        insights: isPro ? PENDING : SKIPPED,
      },
    });

    if (primary) {
      startBoundedFetch(
        queryClient,
        expensesOptions(primary.id, EXPENSES_ALL_YEARS),
        settle('expenses'),
      );
      startBoundedFetch(queryClient, notesOptions(primary.id), (result) =>
        settle('notes')({ state: result.state, data: result.data?.notes ?? null }),
      );
    }
    if (isPro) {
      startBoundedFetch(queryClient, riderInsightsOptions(timeZone), (result) =>
        settle('insights')({ state: result.state, data: result.data?.riderInsights ?? null }),
      );
    }
    return () => {
      live = false;
    };
  }, [isRestoring, userId, queryClient]);

  const current = session && !isRestoring && session.userId === userId ? session : null;
  const cache = current?.cache ?? null;
  const fetches = current?.fetches ?? null;

  const prefs = useMemo(
    () => ({ measurementSystem, currency, language, region }),
    [measurementSystem, currency, language, region],
  );

  const boot = useMemo(
    () =>
      cache
        ? buildBoot({
            headline: cache.headline,
            insights: { data: cache.insights, source: WHATS_NEW_DATA_SOURCE.CACHE },
            bikes: cache.bikes,
            prefs,
          })
        : null,
    [cache, prefs],
  );

  const snapshot = useMemo(() => {
    if (!cache || !fetches) return null;
    return buildBootSnapshot({
      headline: cache.headline,
      insights: sourced(fetches.insights, cache.insights),
      rides: cache.rides,
      bikes: cache.bikes,
      expenses: sourced(fetches.expenses, cache.expenses),
      notes: sourced(fetches.notes, cache.notes),
      scanQuotaUsed: cache.scanQuotaUsed,
      prefs,
      now: new Date(),
      categoryLabel: (category) => categoryLabel(t, category),
    });
  }, [cache, fetches, prefs, t]);

  const getPageData = useCallback(
    <F extends WhatsNewFeature>(feature: F): WhatsNewPageDataMap[F] | null => {
      if (!snapshot || !userId) return null;
      if (frozen.current?.userId !== userId) frozen.current = { userId, pages: new Map() };
      const pages = frozen.current.pages;
      if (!pages.has(feature)) pages.set(feature, snapshot.pages[feature]);
      return (pages.get(feature) as WhatsNewPageDataMap[F] | undefined) ?? null;
    },
    [snapshot, userId],
  );

  return {
    ready: current !== null,
    boot,
    priorUse: snapshot?.priorUse ?? NO_PRIOR_USE,
    getPageData,
  };
}
