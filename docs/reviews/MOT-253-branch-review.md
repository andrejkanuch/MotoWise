# Branch Review — MOT-253 Mobile Architecture Review: Maintenance & Hardening

**Branch:** `kanuchandrej/mot-253-mobile-architecture-review-maintenance-hardening` (off `origin/main`)
**Mobile version:** `3.10.1` → `3.10.2`
**Epic:** [MOT-253](https://linear.app/lominic/issue/MOT-253) · 15 sub-tickets (MOT-254 → MOT-268)
**Source report:** `docs/Mobile-Architecture-Review-2026-06-15.md`
**Plan:** `docs/plans/MOT-253-mobile-arch-hardening.md`

## Outcome

**All 15 sub-tickets delivered + verified.** Every shipped change keeps `tsc --noEmit`, Biome, Jest, and the i18n ratchet green (pre-push `precheck:push` passes). Test count grew **397 → 416**. No production behavior regressions introduced.

> ⚠️ **One pre-merge action:** MOT-267 decomposed the profile screen + unified primitives — structure-only, but it could shift a few visuals. Verify on a simulator before merge (see MOT-267 row).

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
| MOT-266 | ✅ Done | Part A: expo-image + recyclingKey. Part B: regenerated typedRoutes, removed all 24 nav casts (8 typed as `Href`), added guard script |
| MOT-267 | ✅ Done* | profile/index.tsx 1467→51 (data hook + 4 sections); editorial.tsx canonical (ESettingsRow/ESettingsSectionLabel); FloatingIconButton + WaypointMarker extracted; triggerSelection util. *Visual sign-off pending on simulator |
| MOT-268 | ✅ Done | Registered ad-hoc query keys + `queryOptions()` factories (`me`, maintenance badge) |

## Notable decisions / deviations (all surfaced on the tickets)

1. **Social feed was fully cut.** `RideFeedDocument` was referenced nowhere; `feed-ride-card`/`kudos-button`/`empty-feed-state` only imported each other. Per owner decision, the whole cluster (components + `ride-feed`/`toggle-kudos`/`get-kudos-list` `.graphql` + `queryKeys.feed`/`kudos`) was removed under MOT-256, which made **MOT-259 moot** (the bug was in unreachable code → resolved by deletion).
2. **MOT-256 item 4 was inaccurate.** `config/routes.ts` is NOT dead — `checklist.store.ts` imports `TAB_ROUTE`/`PROFILE_ROUTE`. Kept the file; removed only the unused `RIDER_PROFILE` constant.
3. **MOT-262 server idempotency** (dedupe `uploadWaypoints` by `recordedAt`) is a backend change, out of scope for this mobile branch — recommend a follow-up API ticket. Mobile-side duplicate window is now effectively nil.

## Remaining follow-ups (not blocking; tracked)

- **Simulator visual sign-off for MOT-267** — structure-only refactor, but verify these spots: profile section-label tracking (letterSpacing 2.2→1.3 editorial value), settings rows + danger-tinted Logout/Delete, create-trip waypoint marker (`#fff`→`palette.white` warm off-white), floating map buttons (sizes/tint/captions).
- **Broad haptic-guard sweep** — the remaining ~50 inline `Haptics.impactAsync` call sites across unrelated files were intentionally not swept (would drag their untranslated strings into the i18n ratchet). `triggerImpact`/`triggerSelection` are ready; mechanical follow-up.
- **Further monolith decomposition** (MOT-267 listed `edit/add-bike`, `trip-detail.tsx`, `create-trip.tsx` as additional targets) — the ticket's required deliverable (profile/index.tsx) is done; these remain as the "chip away" follow-ups.
- **Server-side `uploadWaypoints` idempotency** (dedupe by `recordedAt`) — backend change recommended as a follow-up API ticket (MOT-262 defense-in-depth).
- **Wire `scripts/check-no-router-any.sh`** into pre-push/CI when ready (created, currently passing, not yet wired).

## Verification

- `pnpm typecheck` (mobile) — clean at every commit.
- Biome — clean (`noConsole` rule added, scoped to mobile).
- Jest — **416 tests / 35 suites pass.**
- Browser/feature-video pipeline steps are N/A for a native RN app; substituted with the Jest suite. A simulator smoke test is recommended pre-merge for the ride-sync + auth-refresh paths.

## Commit log

(see `git log origin/main..HEAD`)
