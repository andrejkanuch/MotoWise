# Mobile Architecture Review — `apps/mobile`

**Date:** 2026-06-15
**Scope:** Maintainability, performance, reliability, robustness, efficiency, duplication
**Method:** 10-agent parallel deep-dive (9 architecture dimensions + Context7 framework best-practices), each citing concrete `file:line` evidence. Stack: Expo SDK 56, RN 0.85, React 19.2, expo-router v56, TanStack Query v5, Zustand v5, Reanimated v4.
**Surface:** 396 TS/TSX files (~90k LOC); 31 test files; 10 Zustand stores; 40+ `.graphql` ops.

---

## Executive summary

The mobile codebase is **mature and well-architected** — not a rescue job. The query layer has a centralized key registry, the offline ride-sync queue has backoff + dead-letter, error boundaries wrap every tab, Zustand stores hold only client state (no server-state mirroring), and the long lists are already FlatList-tuned. The work ahead is **maintenance and hardening**, not rewrite.

Three problems are **high-confidence because multiple independent agents surfaced them**:

1. **`structuralSharing: false` (global)** silently defeats React Query's re-render minimization across the *entire* app — flagged by the state, performance, **and** Context7 agents independently. One-line fix, app-wide win.
2. **`typedRoutes` is enabled but bypassed** with `as any`/`as never` at 17+ navigation sites — the single biggest refactoring hazard. A route rename ships broken links with no compile error.
3. **`FileSystem.readAsStringAsync`** (diagnose photo upload) is not merely deprecated — SDK 56 docs say it **"will throw in runtime"** — and the only mitigation today is a `LogBox.ignoreLogs` that *hides* the impending break. The rest of the file-system layer is already migrated; this is the lone holdout.

The dominant *maintainability* theme is **"canonical helper exists but is bypassed"**: haversine (4 copies), polyline decoder (3), distance/speed/duration formatters (~10 inline), `formatDateRange` (4), section headers (3 competing systems). The single sources of truth are good — they're just not enforced.

---

## Part 1 — Top 10 tasks (maintainability · speed · reliability · robustness · efficiency)

Ranked by **impact ÷ effort**. Effort: S ≤ half-day, M ≈ 1–2 days, L ≈ multi-day.

| # | Task | Why it matters | Dim | Effort |
|---|------|----------------|-----|--------|
| 1 | **Remove global `structuralSharing: false`** (`query-client.ts:41`); scope per-query only if a specific query needs it | App-wide perf: every refetch/focus/invalidation currently mints new object identities, defeating ~all `React.memo`/`useMemo` on lists & charts. Highest impact ÷ effort in the review. | Perf/State | **S** |
| 2 | **Migrate `diagnose/new.tsx:153` off `readAsStringAsync`** to `new File(uri).base64()`; delete the `LogBox.ignoreLogs` at `_layout.tsx:9` | API documented to **throw** in a future SDK; suppression hides a hard upcoming break on a data-capture path. Pattern already exists in `image-upload.ts:40`. | Reliability | **S** |
| 3 | **Harden the offline ride-sync queue**: make `enqueueOrExecute` respect a non-empty queue, break drain on first transient failure (stop reordering), clear the MMKV waypoint buffer on graceful end, and `captureException` on dead-letter | Headline feature. Today, out-of-order delivery can corrupt ride reconstruction and **permanently-failed rides vanish silently** (dead-letter has no surfacing). | Reliability | **M** |
| 4 | **Strip `as any`/`as never` from navigation** (17+ sites) and let `typedRoutes` validate; type dynamic hrefs as `Href` | Renames/deletes of routes currently ship as silent dead-link crashes. Re-enables the safety net that's already turned on. | Type-safety/Nav | **M** |
| 5 | **Consolidate duplicated geo/format helpers**: 1 haversine (delete 3 copies), 1 polyline decoder (delete the hook copy), route ~10 inline distance/speed/duration sites through `ride-formatters`, 1 `formatDateRange` | The metric↔imperial constants (`1609.34/3.6/2.237`) are scattered and must stay in sync by hand; an imperial user already gets km on `heatmap.tsx:41`. | Duplication | **M** |
| 6 | **Adopt TanStack `queryOptions()` factories** in `query-keys.ts` (carry `queryFn`+`staleTime`); register the 21 ad-hoc inline keys (incl. the literally-duplicated `['rides','heatmap']`) | Kills `queryFn`/key duplication and makes prefetch/consumer key drift (the failure the `oemSchedules` comment warns about) impossible. | State/BP | **M** |
| 7 | **Pick ONE shared-primitive system** (`components/ui/editorial.tsx` is most complete); delete `profile/shared/*` duplicates and the local `SectionHeader`/`SettingsRow` in `profile/index.tsx` | Three competing primitive libraries + local re-defs are the *root cause* of screen bloat; a spacing change needs 3+ hand-edits and already drifts (letterSpacing 2.2 vs 0.5). | Component | **L** |
| 8 | **Route remote list/card images through `expo-image`** (currently RN `Image` in feed/discover/profile cards) with `cachePolicy="memory-disk"` + `recyclingKey` | RN `Image` decodes full-res for small slots → scroll jank + memory bloat on the heaviest surfaces (map thumbnails, cover images). | Perf | **M** |
| 9 | **Replace 36 `console.*` with `logger`/`captureException`**; add a `no-console` lint rule | Production failures in purchase, ride-save, and background GPS log to a console nobody reads and never reach Sentry — lost observability on revenue/data-critical paths. | Reliability | **M** |
| 10 | **Add tests to the revenue/data cores**: `updateStoreFromCustomerInfo` (sole `isPro` truth), sync-queue ordering/re-entrancy, `formatCurrency`, `auth.store` session+partialize | These are the riskiest stateful surfaces and are currently the *least* covered; a regression silently mis-gates payers or drops ride data. | Testing | **S–M** |

---

## Part 2 — Duplication map (consolidated)

The codebase's single-sources-of-truth are good; the problem is **bypass**. Each row = delete the copies, import the canonical.

| What | Copies | Canonical / fix |
|------|--------|-----------------|
| **Haversine distance** | `geo-utils.ts:2`, `ride-location.ts:40`, `ride-gps-filter.ts:310`, `ride-flyover.tsx:59` | Keep `geo-utils`; add `{lat,lng}`/`{latitude,longitude}` overloads; delete 3. |
| **Polyline decoder** | `polyline.ts:53` (canonical), `use-ride-heatmap-data.ts:16` (rogue), `ride-heatmap.ts` (correct re-export) | Import from `polyline.ts` in the hook; delete inline copy. |
| **Distance/speed/duration/elapsed + constants** | `ride-formatters.ts` (canonical) vs ~10 inline (`_layout.tsx:36`, `ride-flyover.tsx:77`, `create-trip.tsx:119/126`, `heatmap.tsx:41`, `rides.tsx:642`, `ride-summary.tsx:180`, `ride-hud.tsx:254`, `ride-elevation-chart.tsx:91`, `focus-history.tsx:116`, `hud-sparkline.tsx:30`) | Route all through `ride-formatters`; export `METERS_PER_MILE` etc. as named constants. |
| **`formatDateRange`** | `trips.tsx:78`, `t/[token]/index.tsx:27`, `trip-detail.tsx:118`, `draft-trip-strip.tsx:38` | Single `formatTripDateRange` util. |
| **Section header / settings row** | `editorial.tsx` ESectionHeader, `profile/shared/section-header.tsx`, local in `profile/index.tsx:92`/`:111` | One primitive (`editorial.tsx`); delete the rest. |
| **Inline iOS haptic guard** | ~50 sites + local `haptic()` in `profile/index.tsx`, despite `utils/haptics.ts` | Use `triggerImpact`/`triggerSelection` everywhere. |
| **Deep-link redirect screens** | `ride/[id]`, `trip/[id]`, `routes/[id]` (byte-identical), `route/.../[slug]` | `useDeepLinkRedirect(param, buildTarget)` hook + `firstParam()` util. |
| **Mapbox token+fetch+parse skeleton** | `mapbox-geocoding.ts` (×4, incl. 3 near-identical `reverseGeocode*`), `mapbox-directions.ts:67`, `mapbox-static.ts:36` | `mapboxFetch(path,params)` helper; collapse reverse-geocode into one parametrized fn. |
| **Relay `getNextPageParam`** | 7+ sites, inconsistent `null` vs `undefined` sentinel | `makeNextPageParam(connectionSelector)`; standardize on `undefined`. |
| **`isNetworkError`/`isNotFoundError`** | `ride-sync-queue.ts`, `query-client.ts`, `graphql-errors.ts`, `analytics.ts` — divergent string sets | One `lib/network-errors.ts` predicate; sync-queue should use structured `hasGraphQLCode`. |
| **Fuel-range safety factor** | `fuel-range.ts:3` (0.8 literal) vs `@motovault/types` `FUEL_RANGE_SAFETY_FACTOR` | Import the types-package constant so badge & readiness agree. |
| **End-ride finalize logic** | `ride-hud.tsx:191` (graceful) vs `ride-location.ts:329` (auto-end) | One `finalizeRide(...)` helper. |
| **Garage `Stack.Screen` option blocks** | `(garage)/_layout.tsx` formSheet ×4, card ×4 | `makeSheetOptions(detents)` + `cardOptions`. |
| **Per-tab ErrorBoundary wrapper** | 4 identical copies | `makeTabErrorBoundary(tag)` factory. |

**Dead code to delete:** `components/feed/feed-ride-card.tsx` (never imported), `components/route-map-view.tsx` (115-line placeholder), `app/(tabs)/(profile)/rider-profile.tsx` (657 lines — superseded by `rider/[username].tsx`), `config/routes.ts` (never imported; competes with `typedRoutes`). The `(learn)/_layout.tsx:15` `quiz/[id]` Stack.Screen references a non-existent route.

---

## Part 3 — Top 15 actionable tasks to start now (prioritized backlog)

Grouped into a sequence you can pick up immediately. **Quick wins (Q)** are S-effort, high-confidence; tackle the whole Q block first — it's ~1–2 days and clears the highest-leverage debt.

### 🟢 Quick wins (do this week)
1. **Remove `structuralSharing: false`** — `query-client.ts:41`. Re-test lists/charts. *(S)*
2. **Migrate `readAsStringAsync` → `File().base64()`** + remove the LogBox suppression. *(S)*
3. **Delete dead code**: `feed-ride-card.tsx`, `route-map-view.tsx`, `rider-profile.tsx`, `config/routes.ts`, the phantom `quiz/[id]` screen decl. *(S)*
4. **Centralize haversine + polyline decoder** (delete 3+1 copies). *(S–M)*
5. **Declare `expo-file-system`** in `package.json` (phantom dep, version floats); run `npx expo-doctor`. *(S)*
6. **Fix the kudos optimistic rollback** — make snapshot/rollback symmetric with `setQueriesData` (`kudos-button.tsx`). *(S)*
7. **Sync `.env.example`** to a superset of all `EXPO_PUBLIC_*` keys (Google client IDs + `WEB_URL` missing → broken sign-in for new devs). *(S)*
8. **Add a local cleanup task** for the ~3 GB of `build-*.{aab,ipa}` + 88 MB `dist/` in the working tree (gitignored, but never pruned). *(S)*

### 🟡 Reliability hardening (next)
9. **Ride-sync queue ordering + dead-letter surfacing** (Top-10 #3). Break drain on first transient failure; `captureException` + user banner on dead-letter; clear MMKV buffer on graceful end; make `uploadWaypoints` idempotent server-side. *(M)*
10. **Unify auth token-refresh** behind one in-flight promise in `gql-auth-session`; remove the redundant `refreshSession()` in `queryCache.onError`; **don't clear the sync queue on forced sign-out while a ride is unsynced**. *(M)*
11. **`console.*` → `logger`/`captureException`** + `no-console` lint rule (Top-10 #9). *(M)*
12. **Add the high-risk tests** (Top-10 #10): `updateStoreFromCustomerInfo`, sync-queue concurrency/ordering, `formatCurrency`, `auth.store`. Add shared jest mock factories while here. *(S–M)*

### 🟠 Maintainability & perf (then)
13. **`queryOptions()` factory migration** + register the 21 ad-hoc keys (Top-10 #6). *(M)*
14. **`expo-image` for list/card images** with `cachePolicy`+`recyclingKey`; strip the remaining `as any` navigation casts as you touch each screen (Top-10 #4, #8). *(M)*
15. **Decompose the worst monoliths** behind the now-canonical primitives: `profile/index.tsx` (1467 → section components + `use-profile-data`), `edit-bike`/`add-bike` (shared `use-nhtsa-make-model` + form hook), `trip-detail.tsx` (extract `TripReviewsSection`/`TemplateStatsGrid`/`TripItinerary`). *(L — chip away)*

---

## Part 4 — Framework best-practices gaps (Context7, version-cited)

- **TanStack Query v5:** `queryOptions()` factories (co-locate key+fn) ✅ recommended; `structuralSharing` default-on (see #1); v5 callback-removal — **already compliant**; `useSuspenseQuery` could retire ~25 hand-rolled `isLoading`/`ActivityIndicator` branches (lower priority).
- **Expo Router v56:** `typedRoutes` bypassed (#4). `CLAUDE.md` claims **NativeTabs** but the code uses a custom JS `IslandTabBar` — the floating-island + center-FAB design can't move to `NativeTabs`, so this is a deliberate tradeoff; **fix the doc** either way.
- **RN 0.85 / New Arch:** `@shopify/flash-list` not installed; the data-dense infinite lists (profile/rides, profile/trips, discover) are the migration candidates (pair with `expo-image` `recyclingKey`).
- **React 19.2:** No `useTransition`/`useDeferredValue`/`<Activity>` — opportunistic only (reactCompiler is on).
- **Reanimated v4:** Setup correct (`react-native-worklets` present). CSS-animations API unused — optional cleanup for simple looping effects (the FAB pulse).
- **Expo SDK 56:** `readAsStringAsync` throw-risk (#2, highest reliability item); `expo-image` `cachePolicy`/`recyclingKey` set in only 2 of 21 files.

---

## What's already good (don't touch)

- Single typed `gqlFetcher` choke-point; 107 files use generated types; **zero non-null assertions**; no raw GraphQL clients bypassing the fetcher.
- Declarative `Stack.Protected` auth guards (no back-stack-collapsing imperative redirects); robust deep-link cold/warm-start queue with UUID validation.
- Zustand stores hold only client/UI state — no server-state mirroring; clean boundaries.
- The long lists already use FlatList with `keyExtractor`/`windowSize`/`removeClippedSubviews` + memoized `renderItem`; charts downsample.
- Test *quality* (where it exists) is genuinely good — TZ-safe math, risk-aware assertions encoding known Sentry defects.
- The ESLint+Biome coexistence is **intentional and correct** (i18n-only `no-literal-string` rule Biome can't cover) — *not* debt. Only fix: add a carve-out note to root `CLAUDE.md` so the blanket "no ESLint" line doesn't mislead someone into deleting it.
