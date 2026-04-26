---
title: "feat: Offline Resilience — Graceful Degradation for Cold Start and Trip Detail"
type: feat
status: completed
date: 2026-04-26
origin: docs/brainstorms/2026-04-26-offline-resilience-brainstorm.md
---

# Offline Resilience — Graceful Degradation for Cold Start and Trip Detail

## Deepening Notes

- `PersistQueryClientProvider` restores cache exactly once on mount — buster MUST be correct on first render
- `expo-network` `getNetworkStateAsync()` can return `isInternetReachable: null` on first iOS cold-start call (expo/expo#33012)
- MMKV encryption can be added retroactively via `storage.encrypt(key)` with ~5-10% overhead
- Mapbox offline styleURL MUST match between pack creation and MapView render — mismatched style = blank map offline
- Ride sync queue mileage updates can race when multiple queued rides drain simultaneously

---

## Overview

Make the app usable when opened without connectivity. Today, cold launch with airplane mode stacks `Alert.alert` errors from failed GraphQL queries, downloaded trips fail to render offline because the cached payload is never read back, and map styles mismatch between download and render. The goal is graceful degradation — not a full offline-first rewrite.

Builds on the completed [Perfect Offline Ride Recording](../plans/2026-04-26-001-feat-perfect-offline-ride-recording-plan.md) plan which established the patterns: `offlineFirst` network mode, `shouldDehydratePersistedQuery`, ride sync queue, and `onlineManager` integration.

## Problem Statement / Motivation

Motorcyclists ride through areas with no cell signal (mountain passes, rural roads). Pro users pay for offline trip downloads and expect the app to work on the road. Currently:

1. **Trip detail ignores its own cached payload** — `cacheTripPayload()` writes to MMKV but `readCachedTripPayload()` is never imported or called (`trip-detail.tsx:87` only imports `cacheTripPayload`)
2. **Map style mismatch** — pack downloads `MAP_STYLES.outdoors` (`use-offline-trip.ts:51`) but map renders `MAP_STYLES[isDark ? 'dark' : 'light']` (`trip-detail.tsx:857`). Mapbox requires an exact styleURL match — mismatched style renders blank offline.
3. **Offline startup stacks alerts** — `queryCache.onError` at `query-client.ts:52` fires `Alert.alert` for every first-load failure with no network check
4. **Only 3 query families persisted** — `shouldDehydratePersistedQuery` at `query-persist.ts:32-34` only allows `nhtsa`, `articles`, `motorcycles`
5. **Home shows full-screen error offline** — `use-home-data.ts:55-56` treats query errors as critical with no offline awareness
6. **Ride queue drain misses connectivity restoration** — `_layout.tsx:348-355` only drains on mount and AppState change, not on network reconnect
7. **gcTime/maxAge mismatch** — `gcTime: 30min` but `maxAge: 7 days` means queries GC'd from memory after 30 minutes are never re-restored from the persister (restore happens once on mount)

## Proposed Solution

Five phases plus a prerequisite, each independently shippable. Phase 0 is security hardening, Phase 1-3 are bugs, Phase 4-5 are enhancements.

---

### Phase 0: Prerequisites (Security & Infrastructure)

**Files:**
- `apps/mobile/app.config.ts`
- `apps/mobile/src/app/_layout.tsx`
- `apps/mobile/src/lib/query-client.ts`

#### 0a. Disable Android backup

Android `allowBackup` defaults to `true`. All MMKV files (including unencrypted `tanstack-query-persist` and `ride-sync-queue`) are included in Android Auto Backup to Google Drive and extractable via ADB. The referenced backup rule XML files (`@xml/secure_store_backup_rules`) do not exist on disk, so the backup silently includes everything.

```typescript
// app.config.ts — android block (~line 117)
android: {
  package: 'com.motovault.app',
  allowBackup: false,  // <-- add this
  // ...
},
```

> **Research insight (framework-docs):** expo-secure-store's `configureAndroidBackup: true` default creates exclusion rules for SecureStore data only — it does NOT exclude MMKV databases. Setting `allowBackup: false` is the stronger measure.

#### 0b. Clear sync queue on sign-out

The ride sync queue has no user-scoping. If user A queues mutations offline, logs out, and user B logs in, `drainQueue()` fires with B's JWT. Server RLS rejects, mutations dead-letter, and A's ride data is permanently lost.

```typescript
// _layout.tsx — in onAuthStateChange, extend the !session block (line 323-327):
import { clearAll as clearSyncQueue } from '../utils/ride-sync-queue';
import { clearRideData, rideMMKV } from '../utils/ride-storage';

if (!session) {
  queryClient.clear();
  clearPersistedQueryCache();
  clearSyncQueue();         // <-- add: wipe queued ride mutations
  const activeRideId = rideMMKV.getCurrentId();
  if (activeRideId) clearRideData(activeRideId); // <-- add: wipe in-progress ride waypoints
  cancelAllNotifications();
}
```

> **Security finding (critical):** Without this, cross-user data loss is possible on shared devices. This is the minimum fix; binding user ID to queue entries is tracked separately.

#### 0c. Broaden isNetworkError pattern matching

The current string matching (`'Network request failed'`, `'Failed to fetch'`) misses iOS native errors like `'The Internet connection appears to be offline'` and `'ECONNREFUSED'`.

```typescript
// query-client.ts — shared network error detection
const NETWORK_ERROR_RE = /network.*(fail|error)|failed to fetch|internet.*offline|econnrefused|timeout/i;

function isNetworkError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return NETWORK_ERROR_RE.test(msg);
}
```

> **TypeScript review insight:** The original `includes` check was too narrow for iOS native layer errors, undermining the offline resilience this plan provides.

---

### Phase 1: Fix Offline Trip Detail

**Files:**
- `apps/mobile/src/app/(modals)/trip-detail.tsx`

#### 1a. Read cached trip payload as fallback

Import `readCachedTripPayload` and `getOfflineMeta` from `offline-trips.ts`. When the trip detail query has no data and an offline pack exists, render from the cached payload.

```typescript
// trip-detail.tsx — add import
import { cacheTripPayload, readCachedTripPayload, getOfflineMeta } from '../../lib/offline-trips';

// After the existing useQuery (line 333-337):
const offlineMeta = tripId ? getOfflineMeta(tripId) : null;
const cachedPayload = useMemo(() => {
  if (data?.tripDetail || !tripId || !offlineMeta) return null;
  return readCachedTripPayload<TripDetailQuery>(tripId);
}, [data?.tripDetail, tripId, offlineMeta]);

const hasServerData = data?.tripDetail != null;
const trip = data?.tripDetail ?? cachedPayload?.tripDetail ?? null;
const isOfflineCopy = !hasServerData && !!cachedPayload;
```

Add `meta: { showErrorAlert: false }` to the trip detail query since the screen can render cached data:

```typescript
const { data, isLoading } = useQuery({
  queryKey: queryKeys.trips.detail(tripId),
  queryFn: () => gqlFetcher(TripDetailDocument, { tripId }),
  enabled: !!tripId,
  meta: { showErrorAlert: false },
});
```

> **Performance insight:** `readCachedTripPayload` reads from encrypted MMKV + JSON.parse (~1ms for a 5-20KB payload). Inside `useMemo` is correct — `useEffect` + `useState` would cause a flash of empty content. The deps include only stable values (`tripId`, `offlineMeta` from MMKV registry read).

> **TypeScript insight:** Use `data?.tripDetail != null` instead of `data?.tripDetail` for the truthiness check — prevents edge case where API returns empty object `{}`.

#### 1b. Show "offline copy" state and disable live-only actions

When `isOfflineCopy` is true:
- Show a small inline banner below the header: "Offline copy · Downloaded {date}" using `offlineMeta.downloadedAt`. Inline this (~10 lines) rather than creating a shared component — the trip detail banner, home banner, and ride HUD banner have different data sources and placement.
- Disable buttons that require live GraphQL: Join, Leave, Save, Unsave, Clone, Publish, Review, Trip Assistant. Show a small `WifiOff` icon on disabled buttons; if tapped, show a brief toast: "Connect to the internet to use this feature."
- Short-circuit `getRouteSegments` fetch (`trip-detail.tsx:505`) with `onlineManager.isOnline()` check — avoid the wasted HTTP request that will fail offline

```typescript
// Before the getRouteSegments effect (line 497):
import { onlineManager } from '@tanstack/react-query';

useEffect(() => {
  if (waypointCoords.length < 2 || !onlineManager.isOnline()) {
    setRoutedGeometry(null);
    return;
  }
  // ... existing fetch logic
}, [waypointCoords]);
```

> **Simplicity insight:** Don't create a shared `offline-banner.tsx` component. The ride HUD banner has HUD-specific copy + debounce, the home banner needs `dataUpdatedAt`, and the trip banner needs `downloadedAt`. Two consumers with different data is not enough to justify abstraction. Inline ~10 lines of banner UI in each location.

#### 1c. Fix map style mismatch

Use the pack's stored `styleURL` when an offline pack exists. The `OfflinePackMeta` already stores `styleURL`, and the `useOfflineTrip` hook caches the meta in `useState` — consume it from the hook rather than calling `getOfflineMeta` again:

```typescript
// trip-detail.tsx — use meta from the existing hook (line 389-392):
const offline = useOfflineTrip({ tripId, waypoints: waypoints.map(wp => ({ lat: wp.lat, lng: wp.lng })) });

// MapView (line 855-857):
<MapboxGL.MapView
  style={{ flex: 1 }}
  styleURL={offline.meta?.styleURL ?? MAP_STYLES[isDark ? 'dark' : 'light']}
  compassEnabled={false}
  logoEnabled={false}
```

**Design decision (see brainstorm):** Accept the visual mismatch — dark mode users see `outdoors` tiles in the offline map. Downloading both styles doubles tile storage and risks hitting `MAX_TILES_PER_PACK`.

---

### Phase 2: Suppress Offline Startup Errors

**Files:**
- `apps/mobile/src/lib/query-client.ts`
- `apps/mobile/src/lib/query-native.ts`
- `apps/mobile/src/lib/query-persist.ts`
- `apps/mobile/src/app/(tabs)/_layout.tsx`

#### 2a. Seed onlineManager on cold start using official pattern

**Critical edge case:** `onlineManager.isOnline()` defaults to `true` until the first `expo-network` listener callback fires. On cold start offline, queries fire, fail, and error suppression doesn't work.

Use the official TanStack Query pattern with `initialised` flag to prevent race between listener and async seed:

```typescript
// query-native.ts — replace setupOnlineManager
import { focusManager, onlineManager } from '@tanstack/react-query';
import * as Network from 'expo-network';
import type { AppStateStatus } from 'react-native';
import { AppState } from 'react-native';

export function setupOnlineManager() {
  onlineManager.setEventListener((setOnline) => {
    let initialised = false;

    const subscription = Network.addNetworkStateListener((state) => {
      initialised = true;
      setOnline(state.isConnected ?? true);
    });

    // Seed initial state before first query fires
    Network.getNetworkStateAsync()
      .then((state) => {
        if (!initialised) {
          setOnline(state.isConnected ?? true);
        }
      })
      .catch(() => {
        // getNetworkStateAsync can reject on some platforms
      });

    return () => subscription.remove();
  });
}

export function setupFocusManager() {
  const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
    focusManager.setFocused(status === 'active');
  });
  return () => subscription.remove();
}
```

> **Best practices insight:** This is the exact pattern from the official TanStack Query React Native docs. The function stays synchronous at the call site — no change needed to `_layout.tsx:95`. The `initialised` flag prevents the async seed from overwriting a more recent listener value.

> **Framework docs caveat:** On iOS, the first `getNetworkStateAsync()` call can return `isInternetReachable: null` (expo/expo#33012). Using `isConnected` (not `isInternetReachable`) for the seed avoids this. The `?? true` fallback handles the null case.

#### 2b. Suppress network errors in queryCache.onError when offline

```typescript
// query-client.ts — queryCache.onError (replace lines 40-53)
import { onlineManager } from '@tanstack/react-query';

queryCache: new QueryCache({
  onError: (error, query) => {
    const isAuthError = hasGraphQLCode(error, 'UNAUTHENTICATED');
    if (isAuthError) {
      supabase.auth.refreshSession();
      return;
    }
    // Don't alert or report to Sentry for expected offline failures
    if (!onlineManager.isOnline() && isNetworkError(error)) return;

    captureException(error, {
      queryKey: JSON.stringify(query?.queryKey),
      source: 'queryCache.onError',
    });
    if (query?.meta?.showErrorAlert === false) return;
    if (query?.state.data !== undefined) return;
    Alert.alert('Error', extractGraphQLMessage(error));
  },
}),
```

> **Security insight:** Only suppress when `!onlineManager.isOnline()` AND `isNetworkError()`. If the device reports online but requests fail (possible MITM, captive portal), errors still reach Sentry. This preserves security observability.

#### 2c. Add `showErrorAlert: false` to tab layout badge query

```typescript
// (tabs)/_layout.tsx (line 132-135)
const { data: maintenanceData } = useQuery({
  queryKey: queryKeys.maintenanceTasks.allUser,
  queryFn: () => gqlFetcher(AllMaintenanceTasksDocument),
  meta: { showErrorAlert: false },
});
```

#### 2d. Fix gcTime/maxAge mismatch

**New finding from research.** Current `gcTime: 30 * 60 * 1000` (30 min) but `maxAge: 7 days`. TanStack Query's `PersistQueryClientProvider` restores cache once on mount into the in-memory QueryClient. After 30 minutes of no subscribers, queries are garbage-collected from memory. They are NOT re-restored from the persister — restore happens only once. This means persisted queries vanish after 30 minutes of inactivity.

```typescript
// query-client.ts — update gcTime (line 24)
queries: {
  staleTime: 2 * 60 * 1000,        // 2 min (unchanged)
  gcTime: 24 * 60 * 60 * 1000,     // 24 hours (was 30 min) — match persistence intent
  retry: 3,
  retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),
  networkMode: 'offlineFirst',
  structuralSharing: false,
},
```

> **Best practices insight:** With the whole-client persister, `gcTime >= maxAge` is the recommendation. 24 hours is a pragmatic middle ground — queries survive a day of intermittent use, memory usage stays bounded, and stale data is still refreshed when online via `staleTime`.

---

### Phase 3: Expand Query Persistence

**Files:**
- `apps/mobile/src/lib/query-persist.ts`
- `apps/mobile/src/lib/persisted-query-provider.tsx`
- `apps/mobile/src/app/_layout.tsx`

#### 3a. Add user-data query roots to persistence allowlist

Scope rides to list queries only — exclude `rides.detail` and `rides.waypoints` to prevent cache bloat (each ride with embedded waypoints can be 50-100KB).

```typescript
// query-persist.ts — shouldDehydratePersistedQuery (replace lines 31-35)
/** User-data roots safe for offline persistence. RLS still applies on live refetch. */
const PERSISTED_ROOTS = new Set([
  'nhtsa',             // public reference data
  'articles',          // editorial content
  'motorcycles',       // user's bike list (low sensitivity)
  'user',              // display name + preferences
  'maintenance-tasks', // service schedule
  'rides',             // recent ride list (NOT detail/waypoints)
]);

export function shouldDehydratePersistedQuery(query: Query): boolean {
  if (query.state.status !== 'success') return false;
  const root = query.queryKey[0];
  if (typeof root !== 'string' || !PERSISTED_ROOTS.has(root)) return false;
  // Only persist ride lists, not individual ride detail/waypoints (can be 50-100KB each)
  if (root === 'rides' && query.queryKey[1] !== 'list') return false;
  // Only persist the all-user maintenance aggregation, not per-motorcycle breakdowns
  if (root === 'maintenance-tasks' && query.queryKey[1] !== 'all-user') return false;
  return true;
}
```

> **Performance insight:** Without scoping, ride detail/waypoint queries could push the cache to 5MB+, causing 50-100ms `JSON.parse` on cold start. The list queries are ~1-3KB per ride × 10 rides = ~30KB. The `status !== 'success'` check prevents persisting errored queries (TanStack best practice).

> **Learning (measurement-system-and-ride-feature-design.md):** TanStack Query v5 stores `useQuery` data as flat objects and `useInfiniteQuery` as `{ pages: [...] }`. Sharing a key between them causes rehydration crashes. Verified: no `useInfiniteQuery` uses `user`, `maintenance-tasks`, or `rides` root keys.

#### 3b. Fix buster mismatch on offline cold start

**Critical finding:** `PersistQueryClientProvider` restores from the persister exactly once on mount. If the `buster` prop changes after mount (e.g., session resolves), the provider re-renders but does NOT trigger a second restore from storage. If buster is `''` on first mount (no session yet) and the stored cache has a different buster, the cache is permanently discarded.

Fix: read last-known user ID from SecureStore (sync) as fallback buster. Simplified to inline code (no separate hook):

```typescript
// persisted-query-provider.tsx
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import * as SecureStore from 'expo-secure-store';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useAuthStore } from '../stores/auth.store';
import { queryClient } from './query-client';
import { queryPersister, shouldDehydratePersistedQuery } from './query-persist';

const MAX_PERSIST_AGE_MS = 1000 * 60 * 60 * 24 * 7;
export const LAST_USER_KEY = 'motovault.last-user-id';

export function PersistedQueryClientBoundary({ children }: { children: ReactNode }) {
  const sessionUserId = useAuthStore((s) => s.session?.user?.id);
  const buster = sessionUserId ?? SecureStore.getItem(LAST_USER_KEY) ?? '';

  // Persist user ID for next cold start
  useEffect(() => {
    if (sessionUserId) SecureStore.setItem(LAST_USER_KEY, sessionUserId);
  }, [sessionUserId]);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister,
        maxAge: MAX_PERSIST_AGE_MS,
        buster,
        dehydrateOptions: {
          shouldDehydrateQuery: shouldDehydratePersistedQuery,
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
```

> **Simplicity insight:** Eliminated the `useBuster()` hook — no `useState` needed. `SecureStore.getItem()` is truly synchronous on Expo 13+ (JSI-based, no bridge crossing). The buster value is stable on first render because SecureStore returns the last user's ID immediately, matching the persisted cache.

> **Architecture insight:** User-scoped buster is correct for this app (vs app-version buster recommended by TanStack for single-user apps). Multi-user on shared device is a real scenario; app-version buster would expose previous user's cached rides/tasks.

On logout, clear the SecureStore key and sync queue:

```typescript
// _layout.tsx — in onAuthStateChange (covered in Phase 0b, adds SecureStore clear):
if (!session) {
  queryClient.clear();
  clearPersistedQueryCache();
  SecureStore.deleteItemAsync(LAST_USER_KEY);
  clearSyncQueue();
  const activeRideId = rideMMKV.getCurrentId();
  if (activeRideId) clearRideData(activeRideId);
  cancelAllNotifications();
}
```

---

### Phase 4: Home Screen Offline Awareness

**Files:**
- `apps/mobile/src/components/home/use-home-data.ts`
- `apps/mobile/src/app/(tabs)/(home)/index.tsx`

#### 4a. Add `showErrorAlert: false` to home queries

All 4 home queries should suppress alerts since the home screen can render persisted data or graceful empty states:

```typescript
// use-home-data.ts — add meta to each query
const meQuery = useQuery({
  queryKey: queryKeys.user.me,
  queryFn: () => gqlFetcher(MeDocument),
  meta: { showErrorAlert: false },
});
const bikesQuery = useQuery({
  queryKey: queryKeys.motorcycles.all,
  queryFn: () => gqlFetcher(MyMotorcyclesDocument),
  meta: { showErrorAlert: false },
});
const maintenanceQuery = useQuery({
  queryKey: queryKeys.maintenanceTasks.allUser,
  queryFn: () => gqlFetcher(AllMaintenanceTasksDocument),
  meta: { showErrorAlert: false },
});
const ridesQuery = useQuery({
  queryKey: queryKeys.rides.list('home'),
  queryFn: () => gqlFetcher(MyRidesDocument, { first: 10 }),
  meta: { showErrorAlert: false },
});
```

#### 4b. Distinguish "offline with stale data" from "online error"

```typescript
// use-home-data.ts
import { onlineManager } from '@tanstack/react-query';

const isOffline = !onlineManager.isOnline();
const hasCriticalError = !isOffline && (meQuery.isError || bikesQuery.isError);
const isOfflineEmpty = isOffline && !user && motorcycles.length === 0;
```

The home screen component uses `isOfflineEmpty` to render an offline-aware empty state (WifiOff icon + "Open the app online to load your data") instead of the error retry screen.

#### 4c. Contextual offline banner on home

When `isOffline` is true and home has stale data, show a small inline banner: "Offline · Last updated {time}" using `meQuery.dataUpdatedAt`. Inline ~10 lines with WifiOff icon, warning color, FadeInUp animation. Do not share with the ride HUD banner — different data sources and placement.

---

### Phase 5: Drain Ride Queue on Connectivity Restore

**Files:**
- `apps/mobile/src/utils/ride-sync-queue.ts`
- `apps/mobile/src/app/_layout.tsx`

#### 5a. Add drain mutex

No `isDraining` guard exists. Adding network-restore drain + AppState drain creates concurrent drain risk.

```typescript
// ride-sync-queue.ts — add at module scope
let isDraining = false;

export async function drainQueue(): Promise<void> {
  if (isDraining) return;
  isDraining = true;
  try {
    const networkState = await Network.getNetworkStateAsync();
    if (!networkState.isConnected || !networkState.isInternetReachable) return;

    const queue = getQueue();
    if (queue.length === 0) return;

    // ... existing drain logic unchanged ...
  } finally {
    isDraining = false;
  }
}
```

> **Architecture insight:** A boolean mutex IS sufficient here. JavaScript is single-threaded — `if (isDraining) return; isDraining = true;` is atomic because no `await` exists between the check and the set. The first `await` (`getNetworkStateAsync`) comes after the flag is set. A Promise-based lock is an alternative that lets callers await completion, but the boolean is simpler and correct.

> **Learning (ride-hud-reanimated-charts-mileage-patterns.md):** When multiple queued rides drain simultaneously, mileage updates can race. The existing sequential `for` loop in `drainQueue` prevents this within a single drain — the mutex prevents concurrent drains.

#### 5b. Subscribe to connectivity restoration with debounce

Add a debounced network listener in `_layout.tsx` that drains when connectivity returns. Debounce prevents drain storms from rapid WiFi/cellular toggling.

```typescript
// _layout.tsx — replace the existing drain useEffect (lines 347-355)
useEffect(() => {
  drainQueue();
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  const appSub = AppState.addEventListener('change', (state: string) => {
    if (state === 'active') drainQueue();
  });
  const netSub = Network.addNetworkStateListener((state) => {
    if (state.isConnected && state.isInternetReachable) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => drainQueue(), 2000);
    }
  });
  return () => {
    appSub.remove();
    netSub.remove();
    clearTimeout(debounceTimer);
  };
}, []);
```

> **Performance insight:** `Network.addNetworkStateListener` fires on every WiFi/cellular transition, band change, and VPN connect — 5-20 times during a typical ride. Each `drainQueue()` call does ~2-6ms of work (one network check + one MMKV read). The 2-second debounce collapses rapid transitions into one drain attempt.

---

## System-Wide Impact

### Error Propagation

- `queryCache.onError` now silently drops network errors when `onlineManager.isOnline()` is false. Offline failures are never reported to Sentry — they are expected, not bugs.
- `mutationCache.onError` is NOT changed. Mutations that require connection still show alerts — users should know their action didn't go through.
- When online but requests fail (possible MITM, captive portal), errors still reach Sentry — the `!onlineManager.isOnline()` guard preserves security observability.

### State Lifecycle Risks

- **Buster mismatch (mitigated in Phase 3b):** SecureStore provides the last-known user ID synchronously on cold start. Since PersistQueryClientProvider evaluates buster once on mount, the cache matches immediately.
- **Stale data:** Persisted data up to 7 days old renders on the home screen. Maintenance tasks may show outdated due dates. Acceptable for offline — stale data is better than error screens.
- **User switch:** On logout, `queryClient.clear()` + `clearPersistedQueryCache()` + `SecureStore.deleteItemAsync(LAST_USER_KEY)` + `clearSyncQueue()` + `clearRideData()` wipe all user-scoped state.

### Known Issues NOT Addressed (Tracked Separately)

| Issue | Severity | Why Deferred |
|-------|----------|--------------|
| Ride sync queue not user-scoped (bind userId to entries) | Medium | Phase 0b clears queue on sign-out. Full user-scoping requires schema change to queue entries. Separate ticket. |
| Silent ride data loss on JWT expiry after days offline | Medium | Requires UNAUTHENTICATED-aware queue pausing instead of countdown-to-dead-letter. Separate ticket. |
| `stripPii` uses spread (allowlist would be safer) | Low | Current spread + participant sanitization is adequate. Convert to allowlist when adding new cached entities. |
| Encrypt `tanstack-query-persist` MMKV store | Low | Phase 0a disables Android backup. App sandbox provides OS-level protection. Encrypt when storing higher-sensitivity data. MMKV encryption can be added retroactively via `storage.encrypt(key)` with ~5-10% overhead. |
| Downloads management UX (dropped Phase 6) | Low | YAGNI — users have 1-3 offline trips, manageable via existing OfflinePackButton on trip detail. Build when users request it. |

## Acceptance Criteria

### Phase 0: Prerequisites
- [x] `android.allowBackup` is `false` in app.config.ts
- [x] Sign-out clears ride sync queue and ride storage
- [x] `isNetworkError` matches iOS native error messages (case-insensitive regex)

### Phase 1: Offline Trip Detail
- [x] Open a previously downloaded trip offline → detail renders from cached payload
- [x] Map tiles render correctly using the pack's downloaded style (no blank map)
- [x] "Offline copy" banner visible below header with download date
- [x] Join/Leave/Save/Clone/Publish/Assistant buttons disabled with WifiOff icon; tap shows toast
- [x] `getRouteSegments` does not fire HTTP request when offline

### Phase 2: Suppress Offline Errors
- [x] Cold launch airplane mode → no `Alert.alert` popups, no Sentry noise
- [x] `onlineManager.isOnline()` returns `false` on cold start offline (seeded before first query)
- [x] Online errors still show alerts and report to Sentry as before
- [x] Garage tab badge query silently fails without alert
- [x] Persisted queries survive 30+ minutes of inactivity (gcTime increased)

### Phase 3: Query Persistence
- [x] Cold launch offline after a successful online session → home renders bikes, tasks, rides from cache
- [x] User switch → old user's cache is not visible to new user
- [x] `user`, `maintenance-tasks` (all-user only), `rides` (list only) data persists across app restarts
- [x] Ride detail/waypoint queries are NOT persisted (cache stays under ~100KB for rides)
- [x] No crash from `useQuery`/`useInfiniteQuery` key collision on rehydration

### Phase 4: Home Offline Awareness
- [x] Offline with cached data → home renders stale data + inline offline banner
- [x] Offline with no cached data → friendly empty state (not error screen)
- [x] Pull-to-refresh while offline → no error popup

### Phase 5: Sync Queue Drain
- [x] Record ride offline → queue drains within 2 seconds of connectivity restoration
- [x] Concurrent drain calls don't cause duplicate mutations (`isDraining` guard)
- [x] Rapid network flapping (WiFi/cellular) doesn't trigger drain storms (2s debounce)

## Verification Plan

1. **Cold launch airplane mode, no cache:** App does not crash or stack alerts. Shows offline-aware empty states.
2. **Cold launch airplane mode, after online session:** Home renders persisted bikes/tasks/rides from MMKV cache.
3. **Download trip online → kill app → open offline → open trip:** Trip detail + map render from cached payload and Mapbox tile pack. Map is NOT blank.
4. **Start ride offline → record waypoints → end ride → reconnect:** Queue drains successfully, ride appears in ride list.
5. **Logout → login as different user → open offline:** New user sees their own cached data, not previous user's. Sync queue is empty.
6. **Captive portal (connected but no internet):** Queries fail but don't stack alerts. Ride queue correctly refuses to drain.
7. **Leave app idle 2+ hours → reopen offline:** Persisted queries still render (gcTime increased).
8. **Sign out while offline with queued rides:** Queue is cleared. No orphaned mutations.

## Sources & References

- **Origin brainstorm:** [docs/brainstorms/2026-04-26-offline-resilience-brainstorm.md](../brainstorms/2026-04-26-offline-resilience-brainstorm.md) — key decisions: contextual banner not global, disabled buttons with tap-to-explain, use pack's styleURL for offline map
- **Foundation plan:** [docs/plans/2026-04-26-001-feat-perfect-offline-ride-recording-plan.md](2026-04-26-001-feat-perfect-offline-ride-recording-plan.md) — established `offlineFirst`, ride sync queue, `onlineManager` patterns
- **TanStack Query docs:** persistQueryClient, onlineManager seeding pattern, network mode
- **Mapbox offline docs:** styleURL must match between pack creation and MapView render (rnmapbox/maps)
- **expo-network:** getNetworkStateAsync cold-start timing (expo/expo#33012), isInternetReachable null on first call
- **expo-secure-store:** getItem() is truly synchronous on Expo 13+ (JSI-based)
- **react-native-mmkv:** encrypt() available retroactively, ~5-10% overhead
- **Learning (measurement-system-and-ride-feature-design.md):** TanStack Query cache collision between useQuery/useInfiniteQuery — verified no collision for newly persisted roots
- **Learning (ride-hud-reanimated-charts-mileage-patterns.md):** Mileage update race when multiple rides drain — sequential drain loop prevents this
- **Learning (stuck-processing-diagnostics-infinite-spinner.md):** Timeout-based stuck detection — applicable to future sync queue visibility UI
