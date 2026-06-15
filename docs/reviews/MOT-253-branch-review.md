# Branch Review — MOT-253 Mobile Architecture Review: Maintenance & Hardening

**Branch:** `kanuchandrej/mot-253-mobile-architecture-review-maintenance-hardening` (off `origin/main`)
**Mobile version:** `3.10.1` → `3.10.2`
**Epic:** [MOT-253](https://linear.app/lominic/issue/MOT-253) · 15 sub-tickets (MOT-254 → MOT-268)
**Source report:** `docs/Mobile-Architecture-Review-2026-06-15.md`
**Plan:** `docs/plans/MOT-253-mobile-arch-hardening.md`

## Outcome

**13 of 15 sub-tickets fully delivered + verified; MOT-266 partially (Part A); MOT-267 deferred (multi-PR by design).** Every shipped change keeps `tsc --noEmit`, Biome, and Jest green. Test count grew **397 → 416** (+19; +6 suites). No production behavior regressions introduced.

| Ticket | Status | Summary |
|--------|--------|---------|
| MOT-254 | ✅ Done | Removed global `structuralSharing:false` (v5 default restored) |
| MOT-255 | ✅ Done | `readAsStringAsync` → `new File().base64()`; dropped LogBox suppression |
| MOT-256 | ✅ Done | Dead-code delete + **fully-orphaned social-feed cluster** removed (see note) |
| MOT-257 | ✅ Done | One haversine (+ coord-shape overloads) + one polyline decoder |
| MOT-258 | ✅ Done | Declared phantom `expo-file-system` dep (~56.0.7) |
| MOT-259 | ✅ Done | Resolved by deletion — the kudos bug lived in the dead feed cluster |
| MOT-260 | ✅ Done | `.env.example` made a superset of all `EXPO_PUBLIC_*`/`process.env` keys |
| MOT-261 | ✅ Done | `clean:artifacts` prune script |
| MOT-262 | ✅ Done | **Ride-sync queue hardening** (ordering, transient-break, buffer cleanup, dead-letter Sentry + retry) + 13 tests |
| MOT-263 | ✅ Done | Single in-flight auth refresh; queryCache stops double-refreshing; unsynced rides survive forced sign-out + dedupe test |
| MOT-264 | ✅ Done | 36 `console.*` → `logger`/`captureException` + Biome `noConsole` rule |
| MOT-265 | ✅ Done | Tests for subscription mapping, formatCurrency, auth store, sync queue + shared mock factories |
| MOT-266 | ◐ Part A | Part A (expo-image + recyclingKey) shipped. **Part B deferred** (see below) |
| MOT-267 | ⏸ Deferred | Monolith decomposition — explicitly L/multi-PR; tracked as follow-up |
| MOT-268 | ✅ Done | Registered ad-hoc query keys + `queryOptions()` factories (`me`, maintenance badge) |

## Notable decisions / deviations (all surfaced on the tickets)

1. **Social feed was fully cut.** `RideFeedDocument` was referenced nowhere; `feed-ride-card`/`kudos-button`/`empty-feed-state` only imported each other. Per owner decision, the whole cluster (components + `ride-feed`/`toggle-kudos`/`get-kudos-list` `.graphql` + `queryKeys.feed`/`kudos`) was removed under MOT-256, which made **MOT-259 moot** (the bug was in unreachable code → resolved by deletion).
2. **MOT-256 item 4 was inaccurate.** `config/routes.ts` is NOT dead — `checklist.store.ts` imports `TAB_ROUTE`/`PROFILE_ROUTE`. Kept the file; removed only the unused `RIDER_PROFILE` constant.
3. **MOT-262 server idempotency** (dedupe `uploadWaypoints` by `recordedAt`) is a backend change, out of scope for this mobile branch — recommend a follow-up API ticket. Mobile-side duplicate window is now effectively nil.

## Deferred work (with rationale)

- **MOT-266 Part B — strip `as any`/`as never` navigation casts.** Blocked: `.expo/types/router.d.ts` is stale (still references routes deleted in MOT-256) and regenerating `typedRoutes` requires running the Expo dev server / Metro, which isn't available in this headless environment. Removing the casts against stale route types would give false confidence or false errors. **Action:** regenerate types via `expo start` once, then remove the ~24 casts and type dynamic hrefs as `Href`; add the `router.push(... as any)` grep guard. Part A (the expo-image perf win) shipped independently.
- **MOT-267 — decompose screen monoliths.** The ticket itself scopes this as **L, multi-PR, "chip away incrementally."** Landing a partial decomposition of 1000–2000-line screens into this already-large branch risks visual regressions that need on-device/simulator verification. **Action:** tackle as its own PR series — consolidate to the `editorial.tsx` primitive system first, then decompose `profile/index.tsx`, `edit/add-bike`, `trip-detail.tsx` one screen at a time.

## Verification

- `pnpm typecheck` (mobile) — clean at every commit.
- Biome — clean (`noConsole` rule added, scoped to mobile).
- Jest — **416 tests / 35 suites pass.**
- Browser/feature-video pipeline steps are N/A for a native RN app; substituted with the Jest suite. A simulator smoke test is recommended pre-merge for the ride-sync + auth-refresh paths.

## Commit log

(see `git log origin/main..HEAD`)
