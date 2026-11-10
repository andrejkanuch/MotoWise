import type { Mutation, Query } from '@tanstack/react-query';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';
import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({ id: 'tanstack-query-persist' });
const CACHE_KEY = 'offline-cache-v1';

export const queryPersister: Persister = {
  persistClient: async (persistedClient) => {
    storage.set(CACHE_KEY, JSON.stringify(withoutInsightsGeometry(persistedClient)));
  },
  restoreClient: async (): Promise<PersistedClient | undefined> => {
    const raw = storage.getString(CACHE_KEY);
    if (!raw) return undefined;
    try {
      return withoutPersistedMutations(JSON.parse(raw) as PersistedClient);
    } catch {
      storage.remove(CACHE_KEY);
      return undefined;
    }
  },
  removeClient: async () => {
    storage.remove(CACHE_KEY);
  },
};

/**
 * Mutations are never persisted, and never restored.
 *
 * TanStack Query dehydrates every PAUSED mutation by default
 * (`defaultShouldDehydrateMutation`), and mutations here run `offlineFirst`, so
 * a write made offline was paused, written to MMKV and hydrated on the next
 * launch. A hydrated mutation is state only — its `mutationFn` lived in the
 * component that created it — so the moment the device came back online
 * `resumePausedMutations` rejected it with "No mutationFn found", which the
 * global handler reported and showed the rider as an error alert for an action
 * from a previous session. The write was never replayed either way.
 * (Sentry MOTO-VAULT-REACT-NATIVE-3T)
 *
 * Replaying writes across a restart needs `setMutationDefaults` per
 * `mutationKey` plus the cache updates each call site does in `onSuccess`; no
 * mutation is set up for that. A paused mutation still resumes while the app
 * stays alive — only the cross-restart copy goes.
 */
export function shouldDehydratePersistedMutation(_mutation: Mutation): boolean {
  return false;
}

/**
 * Drops the mutations from a restored cache. `shouldDehydratePersistedMutation`
 * stops new ones being written; this covers the caches written before it, which
 * live for up to the persister's `maxAge`.
 */
export function withoutPersistedMutations(persistedClient: PersistedClient): PersistedClient {
  if (!persistedClient.clientState?.mutations?.length) return persistedClient;
  return {
    ...persistedClient,
    clientState: { ...persistedClient.clientState, mutations: [] },
  };
}

export function clearPersistedQueryCache(): void {
  storage.remove(CACHE_KEY);
}

/** Roots safe for offline persistence. RLS still applies on live refetch. */
const PERSISTED_ROOTS = new Set([
  'nhtsa', // public reference data
  'articles', // editorial content
  'motorcycles', // user's bike list
  'user', // display name + preferences
  'maintenance-tasks', // service schedule
  'rides', // recent ride list
]);

const INSIGHTS_KEY = 'insights';
/** "Never fetched": a restored entry with this time is stale whatever its `staleTime`. */
const STRIPPED_DATA_UPDATED_AT = 0;
const PERSISTED_RIDE_KEYS: ReadonlySet<unknown> = new Set(['list', 'overview', INSIGHTS_KEY]);

export function shouldDehydratePersistedQuery(query: Query): boolean {
  if (query.state.status !== 'success') return false;
  const root = query.queryKey[0];
  if (typeof root !== 'string' || !PERSISTED_ROOTS.has(root)) return false;
  // Only persist ride lists, overview and Rider insights, not individual ride
  // detail/waypoints (can be 50-100KB each)
  if (root === 'rides' && !PERSISTED_RIDE_KEYS.has(query.queryKey[1])) return false;
  // Only persist the all-user maintenance aggregation, not per-motorcycle breakdowns
  if (root === 'maintenance-tasks' && query.queryKey[1] !== 'all-user') return false;
  return true;
}

interface InsightsRegionLike {
  routes?: unknown;
}

function stripRegionRoutes(data: unknown): unknown {
  const insights = (data as { riderInsights?: { regions?: InsightsRegionLike[] } } | undefined)
    ?.riderInsights;
  if (!insights?.regions) return data;
  return {
    ...(data as object),
    riderInsights: {
      ...insights,
      regions: insights.regions.map((region) => ({ ...region, routes: [] })),
    },
  };
}

/**
 * The Rider insights entry is written without its region routes. The free
 * totals, statuses and headlines are what an offline cold start needs; the
 * encoded routes are the bulk of the payload and are the rider's own tracks, so
 * they stay off disk. A restored entry keeps each region's bounds with no
 * routes, which the screen reads as "map offline" until a request succeeds.
 *
 * The stripped entry is written as never fetched (`dataUpdatedAt: 0`): it is
 * not the answer the server gave, so a relaunch inside the stale window must
 * not restore it as fresh — it refetches, and online the map and Share return.
 */
export function withoutInsightsGeometry(persistedClient: PersistedClient): PersistedClient {
  const queries = persistedClient.clientState?.queries;
  if (!queries?.some((query) => isInsightsKey(query.queryKey))) return persistedClient;
  return {
    ...persistedClient,
    clientState: {
      ...persistedClient.clientState,
      queries: queries.map((query) =>
        isInsightsKey(query.queryKey)
          ? {
              ...query,
              state: {
                ...query.state,
                data: stripRegionRoutes(query.state.data),
                dataUpdatedAt: STRIPPED_DATA_UPDATED_AT,
              },
            }
          : query,
      ),
    },
  };
}

function isInsightsKey(queryKey: readonly unknown[]): boolean {
  return queryKey[0] === 'rides' && queryKey[1] === INSIGHTS_KEY;
}
