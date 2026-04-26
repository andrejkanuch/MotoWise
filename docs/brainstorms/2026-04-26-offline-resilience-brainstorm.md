---
date: 2026-04-26
topic: offline-resilience
---

# Offline Resilience Plan

## What We're Building

Make the app usable when opened without connectivity. Today the app is online-first: cold launch with airplane mode stacks `Alert.alert` errors from failed GraphQL queries, downloaded trips can't actually render offline because the cached payload is never read back, and map styles mismatch between download and render. The goal is graceful degradation — not full offline-first rewrite.

## Current State (Verified)

| Area | Status | Key File |
|------|--------|----------|
| **Offline maps** | Tiles download per-trip, but trip detail never reads `readCachedTripPayload` | `offline-trips.ts` L159, `trip-detail.tsx` L87/403 |
| **Map style mismatch** | Pack downloads `MAP_STYLES.outdoors`, map renders light/dark theme style | `offline-pack-button.tsx`, `trip-detail.tsx` |
| **Startup errors** | `queryCache.onError` fires `Alert.alert` for every failed first-load query | `query-client.ts` L52 |
| **Query persistence** | Only `nhtsa`, `articles`, `motorcycles` persisted | `query-persist.ts` L33-34 |
| **Online manager** | Already wired via `expo-network` listener | `query-native.ts` |
| **Ride sync queue** | Strong — MMKV queue, drains on app resume | `ride-sync-queue.ts` |
| **Home data** | 4 queries (me, bikes, maintenance, rides) — none persisted, none suppress alerts | `use-home-data.ts` |

## Why This Approach

Three approaches were considered:

1. **Full offline-first rewrite** — local DB (WatermelonDB/SQLite), sync engine, conflict resolution. Massive scope, months of work, overkill for a Pro motorcycle app.

2. **Read-cache + graceful degradation (chosen)** — persist key query results in MMKV, suppress network error UI, use already-cached trip payloads. Days of work, covers 90% of real-world offline scenarios (tunnel, countryside ride, airplane).

3. **Do nothing, show "no connection" screen** — cheapest, but terrible UX for Pro users who pay for offline trips and expect the app to work on the road.

Approach 2 wins because it builds on existing infrastructure (MMKV persistence, online manager, ride sync queue) and the biggest bug — trip detail ignoring its own cache — is a one-line fix.

## Key Decisions

- **Trip map style**: Use the pack's `styleURL` when offline-ready rather than forcing light/dark theme. Avoids doubling tile storage. Accept that offline map appearance may differ slightly from online.

- **Query persistence scope**: Add `user/me`, `motorcycles`, `maintenanceTasks`, and `rides/list` to the persist allowlist. These are low-sensitivity (already RLS-protected) and give enough data for home screen to render. Do NOT persist trips/discover broadly — only per-trip payloads via the existing encrypted MMKV store.

- **Error suppression strategy**: Check `onlineManager.isOnline()` in `queryCache.onError` — skip `Alert.alert` and `captureException` for network errors when offline. Preserve alerts for real application errors when online.

- **Ride queue drain**: Add connectivity listener to drain queue when network comes back, not only on app resume. Uses the existing `Network.addNetworkStateListener` that's already in `query-native.ts`.

- **No new write queues yet**: Maintenance/photo/trip mutations require connection. Show disabled UI state rather than queueing complex writes with unclear conflict semantics.

## Implementation Order

### Phase 1: Fix the Bugs (highest impact, lowest effort)

1. **Read cached trip payload** — import `readCachedTripPayload` in `trip-detail.tsx`, use as `initialData` when `getOfflineMeta(tripId)` exists. Add `meta: { showErrorAlert: false }`.

2. **Fix map style mismatch** — when `offline.meta?.styleURL` exists, use it for the `MapView` instead of theme-derived style.

3. **Suppress offline errors** — in `queryCache.onError`, check `onlineManager.isOnline()` and skip alert/Sentry for network errors when offline.

### Phase 2: Improve Cold Start (medium effort)

4. **Expand query persistence** — add `user/me`, `motorcycles`, `maintenanceTasks`, `rides/list` to `shouldDehydratePersistedQuery`.

5. **Home screen offline awareness** — add `meta: { showErrorAlert: false }` to home queries since they can render persisted data or empty states.

### Phase 3: Polish (lower priority)

6. **Drain ride queue on connectivity change** — subscribe to network state in `ride-sync-queue.ts`, drain when connected.

7. **Offline downloads management** — settings screen listing offline trips with size, date, remove action.

8. **Offline indicator** — small banner or badge when `onlineManager.isOnline() === false` so users understand why some actions are disabled.

## Open Questions

- Should we show a global "offline mode" banner (like the ride HUD's `hud-offline-banner.tsx`) on all screens, or only contextually on trip detail?
- When a user tries an action that requires connection (join trip, save trip), should we show a toast or disable the button? Leaning toward disabled button + tooltip.

## Verification Plan

1. Cold launch airplane mode, no cache: no crash, no stacked alerts, shows empty/offline-aware UI
2. Cold launch airplane mode, after online session: home renders persisted bikes/tasks/rides
3. Download trip online, kill app, open offline, open trip: detail + map render from cache
4. Start ride offline, record waypoints, end ride, reconnect: queue drains successfully

## Next Steps

-> `/ce:plan` for file-by-file implementation details
