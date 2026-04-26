---
title: "feat: Perfect Offline Ride Recording"
type: feat
status: completed
date: 2026-04-26
---

# Perfect Offline Ride Recording

## Enhancement Summary

**Deepened on:** 2026-04-26
**Sections enhanced:** 4 (all proposed solution sections)
**Research agents used:** architecture-strategist, security-sentinel, performance-oracle, code-simplicity-reviewer, best-practices-researcher, framework-docs-researcher, learnings-researcher

### Key Improvements
1. Simplified JWT handling to a single try/catch in `materializeSession()` — no network check in headers
2. Replaced polling-based `subscribeToQueueLength` with one-time `getQueueLength()` check at ride-end
3. Use `onlineManager.isOnline()` (synchronous, zero bridge cost) for the offline banner instead of separate Network listener
4. Documented the full auth retry chain: expired JWT → 401 → `gqlFetcher` UNAUTHENTICATED catch → `refreshSession()` → retry

### New Considerations Discovered
- The existing `gqlFetcher` already handles expired tokens with a single-retry-after-refresh pattern — the JWT fix is simpler than originally planned
- Ride HUD learning: use refs for interval callbacks to avoid re-renders (from `docs/solutions/integration-issues/ride-hud-reanimated-charts-mileage-patterns.md`)
- `onlineManager.isOnline()` from TanStack Query is already wired to `expo-network` — no need for a second listener
- Network state listener debouncing recommended (500ms) to avoid UI flicker on transient connectivity changes

---

## Overview

Make ride recording work flawlessly offline so riders never lose data when they lose signal mid-ride. The core GPS recording infrastructure already works offline (MMKV storage, sync queue, device GPS). This plan closes the remaining gaps: motorcycle list unavailable offline, no offline feedback in the UI, JWT expiry during long rides, and limited query persistence.

## Problem Statement / Motivation

Motorcyclists frequently ride through areas with no cell signal (mountain passes, rural roads, tunnels). While the GPS recording itself continues offline, several UX gaps create anxiety and friction:

1. **Start-ride modal shows a loading spinner** if the motorcycle list hasn't been fetched yet (no cached data)
2. **No visual indication** that the app is offline during a ride — rider doesn't know if data is being saved
3. **JWT tokens expire after ~1 hour** — if `materializeSession()` is called offline, it fails silently and `cachedAccess` becomes `null` — all subsequent queued mutations lose their auth header
4. **Sync queue drains silently** — rider has no visibility into whether their ride data uploaded successfully after reconnecting

## Proposed Solution

Four targeted changes, each independently shippable:

### 1. Cache motorcycle list for offline start-ride

**File:** `apps/mobile/src/lib/query-persist.ts`

Add `'motorcycles'` to the dehydration filter so the motorcycle list survives app restarts offline:

```typescript
// query-persist.ts:32-34
export function shouldDehydratePersistedQuery(query: Query): boolean {
  const root = query.queryKey[0];
  return root === 'nhtsa' || root === 'articles' || root === 'motorcycles';
}
```

**File:** `apps/mobile/src/app/(modals)/start-ride.tsx`

When `isLoading` and the query has no cached data, show the existing Quick Ride UI directly instead of a spinner. No new component needed — just change the conditional:

```typescript
// start-ride.tsx:300-312 — replace isLoading spinner block
{isLoading && motorcycles.length === 0 ? (
  // Offline with no cache — show Quick Ride as default, don't block
  <View style={{ /* same card style as single-bike display */ }}>
    <Zap size={20} color={palette.signature500} />
    <Text>Quick Ride</Text>
    <Text style={{ color: palette.neutral400 }}>No bikes cached — ride without one</Text>
  </View>
) : hasSingleBike ? (
  // ... existing single-bike UI
```

#### Research Insights

**Best Practice:** The `shouldDehydratePersistedQuery` filter is the right mechanism — TanStack Query v5 docs explicitly recommend selective dehydration for offline persistence. Only persist data the user needs offline; avoid persisting user-specific session data.

**Edge Case:** If the user adds a new bike online, the persisted cache will be stale until the next successful refetch. This is acceptable — `staleTime: 2min` + `offlineFirst` means TanStack will serve cached data immediately and refetch in the background when online.

**From learnings (ride-hud-reanimated patterns):** When caching motorcycle data, the query is already scoped by user via the GraphQL auth context (RLS), so no additional user_id filtering is needed on the persistence layer.

---

### 2. Offline indicator banner in ride HUD

**New file:** `apps/mobile/src/components/ride/hud-offline-banner.tsx`

A slim, animated banner at the top of the ride HUD that appears when connectivity drops and disappears when it returns.

**Key architectural decision:** Use `onlineManager.isOnline()` from TanStack Query instead of adding a second `expo-network` listener. The online manager is already wired to the same `Network.addNetworkStateListener` in `query-native.ts`, so this shares the single source of truth with zero additional bridge cost.

```typescript
// hud-offline-banner.tsx
import { onlineManager } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { WifiOff } from 'lucide-react-native';
import { palette } from '@motovault/design-system';

export function HudOfflineBanner() {
  const [isOffline, setIsOffline] = useState(!onlineManager.isOnline());
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    // Subscribe to TanStack's online manager — single source of truth
    const unsub = onlineManager.subscribe((isOnline) => {
      // Debounce 500ms to avoid flicker on transient connectivity changes
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => setIsOffline(!isOnline), 500);
    });
    return () => {
      unsub();
      clearTimeout(debounceRef.current);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <Animated.View
      entering={FadeInUp.duration(250)}
      exiting={FadeOutUp.duration(200)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: palette.warningBgDark,
        borderRadius: 12,
        borderCurve: 'continuous',
        marginHorizontal: 16,
        marginBottom: 8,
      }}
    >
      <WifiOff size={14} color={palette.warning500} />
      <Text style={{ fontSize: 13, fontWeight: '600', color: palette.warning500 }}>
        Offline — ride is still recording
      </Text>
    </Animated.View>
  );
}
```

Mount in `ride-hud.tsx` below the top safe area inset.

#### Research Insights

**Architecture (from review):** Using `onlineManager.subscribe()` instead of a separate `Network.addNetworkStateListener` avoids multiple native bridge listeners for the same OS event. `onlineManager.isOnline()` is synchronous (reads an in-memory boolean), so there's zero overhead.

**Performance:** The 500ms debounce prevents UI flicker when the device rapidly toggles between connected/disconnected states (common in tunnels, parking garages). Without debounce, the banner would flash on/off rapidly.

**From learnings (ride HUD patterns):** Use a ref for the debounce timer to avoid cleanup issues. Don't put `isOffline` in any interval/timer dependency arrays.

---

### 3. Graceful JWT handling during long offline rides

**File:** `apps/mobile/src/lib/gql-auth-session.ts`

**Simplified approach (from architecture + simplicity reviews):** Only one code change needed — add a try/catch around the `refreshSession()` call in `materializeSession()`. Do NOT add a network check to `buildGqlRequestHeaders()` — that violates separation of concerns.

The full auth retry chain already handles expired tokens:
1. Offline: `materializeSession()` tries to refresh → fails → **keeps existing session** (via try/catch)
2. `cachedAccess` retains the (expired) token instead of being nulled
3. Sync queue's `drainQueue()` eventually calls `gqlFetcher` with the expired token
4. Server rejects with 401 UNAUTHENTICATED
5. `gqlFetcher`'s existing retry logic (in `graphql-client.ts`) catches UNAUTHENTICATED, calls `invalidateGqlAccessTokenCache()`, refreshes session (now online), retries with fresh token

```typescript
// gql-auth-session.ts — materializeSession() — the ONLY change needed
async function materializeSession(): Promise<CachedAccess | null> {
  let {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.expires_at) {
    const expiresAt = session.expires_at * 1000;
    if (expiresAt - Date.now() < 60_000) {
      try {
        const { data } = await supabase.auth.refreshSession();
        session = data.session;
      } catch {
        // Offline or transient failure — keep using current session.
        // The token may be expired, but gqlFetcher's UNAUTHENTICATED
        // retry in graphql-client.ts handles refresh-and-retry on drain.
      }
    }
  }

  if (!session?.access_token) {
    cachedAccess = null;
    return null;
  }

  const expiresAtMs = (session.expires_at ?? 0) * 1000;
  cachedAccess = { accessToken: session.access_token, expiresAtMs };
  return cachedAccess;
}
```

No changes to `buildGqlRequestHeaders()` needed.

#### Research Insights

**Security (from review):** Expired JWT reuse is safe. The server's `GqlAuthGuard` validates the `exp` claim via `jose.jwtVerify()` and rejects expired tokens with 401. The `gqlFetcher` catches this, refreshes the session, and retries. No mutation is ever accepted with an expired token.

**Architecture (from review):** Keeping `buildGqlRequestHeaders()` as a pure auth-to-headers mapper is the right abstraction. The retry-after-refresh logic belongs in `gqlFetcher` (where it already exists), not in header construction.

**From learnings (dead-jwks-path):** Ensure any JWT-related async operations are properly awaited. The existing `materializeSession` code correctly awaits all calls — the try/catch doesn't change this.

**Edge Case — Supabase refresh token expiry:** Supabase refresh tokens last 7 days by default. A single ride will never exhaust this. If somehow the refresh token expires (phone unused for a week), `supabase.auth.getSession()` returns null, `cachedAccess` becomes null, and the sync queue's dead-letter mechanism catches the permanent failure after 5 retries.

---

### 4. Post-ride sync status indicator

**File:** `apps/mobile/src/app/(modals)/ride-hud.tsx` (end-ride flow)

After ending a ride, if the sync queue has pending operations, show a brief toast: "Ride saved locally. Will upload when back online." with a cloud-upload icon.

**Simplified approach (from simplicity review):** No `subscribeToQueueLength` polling needed. A one-time `getQueueLength()` check at ride-end is sufficient — the queue length doesn't change while the user reads the toast.

```typescript
// In ride-hud.tsx end-ride handler (after endRide mutation is queued):
import { getQueueLength } from '../../utils/ride-sync-queue';
import { CloudUpload } from 'lucide-react-native';

// ... after enqueueOrExecute('endRide', ...)
const pending = getQueueLength();
if (pending > 0) {
  // Show inline toast in the ride summary / navigation back
  setSyncToast({ pending });
}
```

The toast UI is a simple animated view in the ride summary or the screen the user navigates to after ending:

```typescript
{syncToast && (
  <Animated.View
    entering={FadeInUp.delay(300).duration(250)}
    style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 14,
      backgroundColor: palette.accentTint,
      borderRadius: 14,
      borderCurve: 'continuous',
      marginTop: 12,
    }}
  >
    <CloudUpload size={18} color={palette.accent500} />
    <Text style={{ fontSize: 14, color: palette.accent500, fontWeight: '600' }}>
      Ride saved locally. Will upload when back online.
    </Text>
  </Animated.View>
)}
```

#### Research Insights

**Simplicity (from review):** The original plan proposed a `subscribeToQueueLength` function with `setInterval` polling every 2s. This is YAGNI — the queue length only matters at the moment the ride ends. A one-time synchronous call to the existing `getQueueLength()` eliminates the interval, cleanup logic, and reactive subscription entirely.

**UX:** The toast should auto-dismiss after ~5 seconds or when the user navigates away. No need for a persistent indicator — once the user knows data is safe, anxiety is relieved.

---

## Technical Considerations

### Architecture impacts
- No new dependencies — uses existing `expo-network`, MMKV, TanStack Query persistence
- All changes are additive — no breaking changes to existing flows
- Sync queue architecture already handles ordered operation replay
- Single source of truth for network state: `onlineManager` from TanStack Query

### Performance implications
- Adding `'motorcycles'` to query persistence adds ~1-5KB to MMKV cache (negligible)
- Offline banner uses `onlineManager.subscribe()` — synchronous in-memory boolean, zero bridge cost
- JWT fix is a try/catch around an existing call — no additional async operations
- No polling or intervals added (original `subscribeToQueueLength` was removed in favor of one-time check)

### Security considerations
- Expired JWT reuse is safe: tokens trigger 401 → `gqlFetcher` retries with fresh token (documented chain: `materializeSession` catch → `cachedAccess` retained → `drainQueue` → `gqlFetcher` → 401 → `invalidateGqlAccessTokenCache` → `refreshSession` → retry)
- No sensitive data added to persistence — motorcycle list contains only make/model/year/nickname
- Sync queue dead-letter entries contain mutation payloads (ride IDs, timestamps) — these are not PII and are already stored in MMKV

## System-Wide Impact

- **Interaction graph**: `enqueueOrExecute` → checks network → queues to MMKV → `drainQueue` on app resume → `gqlFetcher` with cached JWT → server 401 if expired → `gqlFetcher` refreshes token → retries with fresh JWT → server mutation succeeds. The offline banner observes `onlineManager.subscribe()` (shared source of truth with TanStack Query).
- **Error propagation**: Expired JWT during offline → `materializeSession` catch keeps session → queued operation → drain attempt → 401 UNAUTHENTICATED → `gqlFetcher` catches → `invalidateGqlAccessTokenCache()` → `refreshSession()` → retry with fresh token. Dead letter queue catches permanent failures (5 retries).
- **State lifecycle risks**: Partial ride upload (some waypoint chunks sent, others not) is already handled — server accepts incremental waypoint uploads and the endRide mutation finalizes.
- **API surface parity**: No new API endpoints. All mutations already exist.

## Acceptance Criteria

### Functional Requirements

- [x] **Motorcycle list cached offline** — `shouldDehydratePersistedQuery` includes `'motorcycles'` key
- [x] **Start-ride works offline** — shows cached bikes or Quick Ride fallback, never blocks on network
- [x] **Offline banner in HUD** — appears within ~500ms (debounced) of losing connection, disappears on reconnect
- [x] **Banner text**: "Offline — ride is still recording" with `WifiOff` icon
- [x] **JWT survives offline** — `materializeSession()` try/catch prevents `cachedAccess` from being nulled
- [x] **Sync status after ride** — if `getQueueLength() > 0` when ride ends, show "Saved locally" toast
- [x] **No data loss** — ride waypoints, start, and end mutations all queue correctly during full offline ride

### Non-Functional Requirements

- [x] Offline banner uses `FadeInUp`/`FadeOutUp` animation (under 300ms per CLAUDE.md)
- [x] Offline banner debounced 500ms to prevent flicker
- [x] No new dependencies added
- [x] No new `expo-network` listeners (reuses `onlineManager`)
- [x] All changes pass existing tests + typecheck

## Success Metrics

- Zero reported data loss during rides through dead zones
- Ride recording start-to-end works with airplane mode on (after initial bike cache)
- Sync queue successfully drains all operations when connectivity returns

## Dependencies & Risks

| Risk | Mitigation |
|------|------------|
| JWT expiry > refresh token expiry (7 days) | Extremely unlikely for a single ride. Sync queue drain triggers fresh auth. |
| MMKV storage full on very long rides | MMKV has no practical size limit. 4hr ride at 1 waypoint/sec = ~2MB. |
| Network state flicker (tunnel in/out) | 500ms debounce on offline banner prevents UI thrashing |
| Stale motorcycle cache after adding new bike | TanStack `staleTime: 2min` + `offlineFirst` refetches in background when online |

## Implementation Plan

### Phase 1: Query persistence + start-ride fallback
- `query-persist.ts` — add `'motorcycles'` to dehydration filter
- `start-ride.tsx` — graceful fallback when offline with no cache

### Phase 2: JWT offline resilience
- `gql-auth-session.ts` — add try/catch in `materializeSession()` around `refreshSession()` call

### Phase 3: HUD offline banner
- New `hud-offline-banner.tsx` component using `onlineManager.subscribe()`
- Mount in `ride-hud.tsx`

### Phase 4: Post-ride sync indicator
- Ride end flow — one-time `getQueueLength()` check, show toast if > 0

## Sources & References

### Internal References
- Sync queue: `apps/mobile/src/utils/ride-sync-queue.ts`
- Ride storage: `apps/mobile/src/utils/ride-storage.ts`
- GPS recording: `apps/mobile/src/utils/ride-location.ts`
- Query persistence: `apps/mobile/src/lib/query-persist.ts`
- JWT caching: `apps/mobile/src/lib/gql-auth-session.ts`
- Online manager: `apps/mobile/src/lib/query-native.ts`
- GraphQL client (retry logic): `apps/mobile/src/lib/graphql-client.ts`
- Start ride modal: `apps/mobile/src/app/(modals)/start-ride.tsx`
- Ride HUD: `apps/mobile/src/app/(modals)/ride-hud.tsx`

### Institutional Learnings Applied
- `docs/solutions/integration-issues/ride-hud-reanimated-charts-mileage-patterns.md` — use refs for interval callbacks, avoid fast-changing values in useEffect deps
- `docs/solutions/security-issues/dead-jwks-path-missing-await.md` — ensure all JWT-related async operations are properly awaited

### External References
- TanStack Query v5 offline docs: `networkMode: 'offlineFirst'` + `persistQueryClient` with selective dehydration
- TanStack Query `onlineManager.subscribe()` for reactive network state
- expo-network: `addNetworkStateListener` reliability on iOS/Android
