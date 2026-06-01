---
title: Mobile Codebase Audit Remediation (P1–P3)
type: refactor
status: active
date: 2026-05-29
---

# ♻️ Mobile Codebase Audit Remediation (P1–P3)

## Enhancement Summary

**Deepened on:** 2026-05-29 (framework-docs research + architecture & simplicity review).

**Plan-changing facts discovered (verified against the repo):**
1. **React Compiler is ENABLED** (`apps/mobile/app.config.ts` → `experiments.reactCompiler: true`,
   `babel-plugin-react-compiler@1.0.0`). Manual `useMemo`/`useCallback`/`React.memo` are largely
   redundant. **Phase 6 trimmed** to: id-stable `onPress` (prop stability, not memo) + the `tint()`
   module cache (compiler can't cache pure module fns) + expo-image. Verify rows are compiler-eligible
   via React DevTools (repo uses Biome, so the react-compiler ESLint rule isn't active).
2. **Metro resolves `@/*` automatically** via default-on `tsconfigPaths` (no babel/metro change needed).
   But the alias codemod is pure churn with zero correctness gain → **Phase 8 alias codemod CUT**;
   `@/*` is simply allowed going forward and migrated organically.
3. **`typedRoutes` is OFF** and `tsconfig.include` lacks `expo-env.d.ts` + `.expo/types/**/*.ts`.
   Enabling typed routes is **config, not new code** → **Phase 3c drops** the `navigate()` wrapper and
   typed-i18n helper; enable `typedRoutes`, fix what it catches, use `as Href` (not `as any`) for the
   genuinely-dynamic remainder.
4. **expo-image is v56.0.9; FlashList is NOT installed** and v2 requires New Architecture + a native
   build (breaks the OTA story) → **Phase 6 stays on FlatList**. FlashList is a separate future native PR.
5. **Motion `>300ms` violations = 343, not 17** (507 `.duration()` calls total) → **Phase 4 does NOT
   do a 343-site sweep**; add `MOTION` token, apply to new code + Phase-7-touched files only.

**Structural changes from architecture review:**
- **Pre-flight** (folded into Phase 1): enable `experiments.typedRoutes`, add `.expo/types` to
  `tsconfig.include`, confirm `tsconfigPaths` default, dev-boot once. Unblocks 3c.
- **Phase 7 split → 7a (trip-detail) + 7b (create-trip)**, each as 2 commits (behavior-preserving
  extraction green, then componentize). Two 2,000-line screens are too big to ship as one unit.
- **Stop pre-styling the two god-screens:** remove `trip-detail.tsx` and `create-trip.tsx` from the
  target lists of Phases 3a, 4, and 5 — adopt formatters/palette/`<QueryBoundary>` for them *inside*
  Phase 7 during the rewrite (avoids editing ~2k-line files that get rewritten).
- **Phase 4 Biome guard split from migration:** enable the guard with the two Phase-7 files
  ignore-listed; Phase 7b removes them from the ignore list as its final step.
- **Move `ride-formatters.test.ts` from Phase 2 → Phase 3** so it pins the *corrected* imperial
  behavior, not the buggy inline version.

**Simplicity verdict:** strong/ship-as-is — Phases 1, 2, 3a/3b, 6; trimmed — Phases 3c, 4, 5;
cut — Phase 8 alias codemod (keep dead-code + widget renames + Zod validation). ~30–40% less churn
for ~95% of the value.

## Overview

A five-lens audit of `apps/mobile/src` (355 files, ~83k LOC, 19 test files) surfaced 10
prioritized findings across architecture, performance, type-safety, duplication, and test
coverage. The foundation is healthy (clean layer boundaries, good query-key registry,
well-scoped Zustand stores, consistent GraphQL naming). The problems cluster in three areas:
**god-screens** (route files up to 2,246 lines), **un-cached list images**, and **`as any`
casts hiding real bugs** — including one live bug where the start-ride mileage label always
renders `NA`.

This plan sequences all 10 fixes into **8 independently-shippable phases**, ordered so the
safety net (tests) and shared primitives (formatters, layout, tokens) land **before** the
large god-screen decomposition that consumes them, with a final cleanup sweep.

## Problem Statement

Audit findings, by severity:

**P1**
1. GraphQL `as any` casts masking real bugs (incl. live mileage-label bug).
2. Two 2,000+ line god-screens mixing data, logic, Mapbox, and presentation.
3. List images use RN `Image` (no disk cache) + `RideCard` memoization defeated.
4. High-risk pure logic (grading, revenue gating, ride auto-pause) untested.
5. Polyline encode/decode triplicated across 3 files (round-trip correctness hazard).

**P2**
6. Distance/duration formatters re-implemented inline in 12+ spots; several ignore imperial
   preference (correctness bug).
7. Only 9 of 31 data screens handle `isError`; no shared layout/error primitives.
8. Magic numbers (motion durations, `staleTime`, stagger delays) + hardcoded hex/rgba.
9. Type-safety holes: 19 `router.push(... as any)`, 13 `t(... as any)`; ungated
   `console.log` in `widget-sync.ts`; no logger util.

**P3**
10. Cleanup: dead code, deep relative imports vs unused `@/*` alias, PascalCase widget
    filenames, unvalidated `JSON.parse` at storage boundaries.

## Proposed Solution

Eight phases, each a self-contained commit/PR. Dependency-aware ordering: correctness quick
wins → test safety net → shared primitives → perf → big decomposition (reuses primitives) →
cleanup.

| Phase | Findings | Effort | Depends on |
|-------|----------|--------|-----------|
| 1. Pre-flight config + correctness quick wins | #1, #5 + typedRoutes/typedpaths setup | S | — |
| 2. Test safety net (pure logic) | #4 (minus formatters test) | M | — |
| 3. Formatters + type-safety/logger | #6, #9 | M | 1 (typedRoutes) |
| 4. Design tokens + palette guard | #8 | M | — |
| 5. `<QueryBoundary>` + error retrofit | #7 (trimmed) | S–M | — |
| 6. List performance | #3 (trimmed for React Compiler) | M | — |
| 7a. Decompose trip-detail.tsx | #2 | M–L | 3, 5, 6 |
| 7b. Decompose create-trip.tsx | #2 | L | 7a |
| 8. Cleanup sweep (no alias codemod) | #10 (trimmed) | S | all (do last) |

> Files slated for Phase 7 rewrite (`trip-detail.tsx`, `create-trip.tsx`) are **excluded** from the
> target lists of Phases 3a, 4, and 5 — they adopt formatters/palette/`<QueryBoundary>` during their
> Phase 7 rewrite. The only Phase-1–6 edit to them is Phase 1b's polyline-copy deletion (removes code).

---

## Technical Approach

### Phase 1 — Pre-flight config + correctness quick wins (P1 #1, #5)

**1.0 Pre-flight config (unblocks Phase 3c; zero runtime risk).**

- `apps/mobile/app.config.ts` `experiments`: add `typedRoutes: true` (keep `reactCompiler: true`).
- `apps/mobile/tsconfig.json` `include`: add `"expo-env.d.ts"` and `".expo/types/**/*.ts"`.
- Run `npx expo start --clear` once to generate `expo-env.d.ts` + `.expo/types/router.d.ts`, then a
  dev-client boot to confirm bundling. Do **not** add `experiments.tsconfigPaths` (default-on; `false`
  would break `@/*`), and do **not** add babel-plugin-module-resolver/metro alias.
- ⚠️ CI note: `.expo/types` is build-generated and gitignored but must exist at typecheck time, or
  `pnpm precheck` typecheck fails to resolve `Href` literals. Ensure the typecheck flow runs an Expo
  step (or commit a one-time `expo customize`) before relying on typed routes in CI.

**1a. Fix GraphQL `as any` casts (and the live mileage bug).**

- `src/app/(modals)/start-ride.tsx:206` — `(selectedBike as any).mileageKm`. The `Motorcycle`
  type has **no `mileageKm`** field, so `mileageLabel` always returns `'NA'` (verified). Use
  `selectedBike.currentMileage` + `selectedBike.mileageUnit`. The bike's own `mileageUnit`
  should drive display (do not force the global `system` conversion if the stored unit
  differs — check `measurement-system-and-ride-feature-design.md` for the canonical rule).
- `src/app/(modals)/start-ride.tsx:78,80` — `(ridesData as any)?.myRides…`. `MyRidesQuery`
  exposes `totalCount` and `edges[].node`. Type the query result and drop both casts +
  biome-ignores.
- `src/components/ride/pre-flight-checklist.tsx:66` — `(tasksData as any)?.maintenanceTasks`.
  `MaintenanceTasksByMotorcycleQuery` is fully typed; remove cast and the redundant inline
  param annotations in the filter callbacks.

**1b. Dedupe polyline codec.**

- Keep `src/utils/polyline.ts` as the single source (`encodePolyline`, `decodePolyline`,
  `decodePolylineLatLng`, `simplifyEncodedPolyline`).
- Delete the copy in `src/utils/ride-heatmap.ts` (`encodePolyline` + `encodeSignedValue` +
  `decodePolyline`) and the inline copy in `src/app/(modals)/trip-detail.tsx`; re-import from
  `utils/polyline`.
- ⚠️ The two copies use subtly different signed-value helpers. Before deleting, add a
  round-trip test (`encode(decode(x)) === x`) for a known Google-encoded sample to prove the
  canonical impl matches both call sites. Point existing `ride-heatmap.test.ts` at the
  canonical functions.

**Acceptance:** `pnpm --filter mobile typecheck` clean with zero new `as any`; mileage label
renders a real value for a bike with mileage; `ride-heatmap.test.ts` passes against canonical
polyline; ~60 duplicated LOC removed.

---

### Phase 2 — Test safety net (P1 #4)

Add Jest unit tests for high-risk pure logic. Where logic is entangled with side effects,
extract the pure core first.

- `src/lib/__tests__/health-score.test.ts` → `computeHealthScore`: empty list, all-completed
  (→100), overdue-only, urgency boundaries (daysUntil 0/3/7), on-time grace, grade boundaries
  (89→B, 90→A), no-date tasks (`hasData:false`).
- `src/hooks/__tests__/use-pro-gate.test.ts` → export & test `checkFeatureAccess`: isPro
  (unlimited), at-limit, over-limit, zero-limit; `featureMap` fallback.
- **Refactor + test** `src/utils/ride-location.ts`: extract pure
  `decideAutoPause(prevState, sample, clock)` from `processLocation` (currently a 115-line
  function nesting auto-pause + GPS filter + 6 store setters). Test transitions: 60s
  zero-speed → pause, 10-min → notify, 30-min → auto-end, `totalAutoPausedMs` accrual, with a
  mockable clock. (See `zero-distance-rides-first-ride-dropout.md` for prior ride-edge cases.)
- *(moved to Phase 3)* `ride-formatters.test.ts` — written there so it pins the corrected imperial
  behavior, not the buggy inline version Phase 3a replaces.
- `src/utils/__tests__/ride-sync-queue.test.ts` → enqueue seq ordering, retry→dead-letter
  after `MAX_RETRIES`, flush with MMKV + network mocked.
- `src/lib/__tests__/pdf-template.test.ts` → `escapeHtml` (XSS guard) for all entities;
  date-range filter at boundaries + tasks missing both dates.

**Acceptance:** `pnpm --filter mobile test` passes; `decideAutoPause` is pure & covered;
`processLocation` behavior unchanged (it now calls the pure fn).

---

### Phase 3 — Formatter adoption + type-safety/logger (P2 #6, #9)

**3a. Adopt formatters (fixes imperial bugs).** `formatDistance`/`formatDuration`/`formatElapsed`
exist in `src/utils/ride-formatters.ts`. Replace inline re-implementations **(excluding
`trip-detail.tsx` and `create-trip.tsx` — done in Phase 7)**:
- Distance (`meters/1000 + ' km'`, ignores imperial — **correctness bug**):
  `heatmap.tsx:41`, `route-map-view.tsx:67`, `focus-history.tsx:30-31`,
  `elevation-chart-mobile.tsx:108`, `discover-trip-card.tsx:45`, + others.
- Duration (inline `HH:MM:SS`): `(tabs)/_layout.tsx:37-41`, `ride-flyover.tsx:74-76`,
  `focus-history.tsx:23-24`, `discover-trip-card.tsx:288`, `near-you-section.tsx:167-169`.
- Add `formatMinutes(min)` to `ride-formatters.ts` for `estimatedDurationMinutes`.
- Export single `toISODateInput(date)` (from `trip-form-dates.ts`); replace copies in
  `add-expense.tsx:52-53`, `add-maintenance-task.tsx:32-33`, `add-ride-expense.tsx:32-33`.
- **Add `src/utils/__tests__/ride-formatters.test.ts`** here (both unit systems, the
  `<10 ? toFixed(1) : round` boundary, m/s→mph 2.237 / km/h 3.6), pinning corrected behavior.

**3b. Logger + console gating.** Create `src/lib/logger.ts` (`__DEV__`-gated `log`/`warn`,
always-on `error` → routes to `captureException`). Replace ungated `console.log` in
`src/lib/widget-sync.ts:51,68,85,219` (see `ios-widget-data-sync-failures.md`).

**3c. Type-safe navigation + i18n (config-first, no wrappers).** Typed routes are enabled in
Phase 1.0, so:
- Remove the `as any` from the 19 `router.push/replace(...)` — static group routes (e.g.
  `'/(modals)/ride-hud'`) become valid `Href` literals. For genuinely **dynamic** routes use the
  object form `router.push({ pathname: '/ride/[id]', params: { id } })`, or `as Href` (the typed
  target) — **never** `as any`, and **no** `navigation.ts` wrapper (typed routes is the first-class fix).
- Remove `as any` on **static** i18n keys. For the handful of dynamic template-literal keys, a single
  narrow cast at the call site with an honest `biome-ignore` is simpler than a typed helper — only
  build a helper if i18next key-union typing isn't already available.
- Fix `hud-layout-a.tsx:49` `liveWaypoints: any[]` → `Waypoint[]`.

**Acceptance:** distance/duration honor user unit system everywhere; zero ungated
`console.log` in shipped paths; `as any` count drops from ~40 to <8 (only unavoidable lib
gaps, each with an accurate `biome-ignore`); typed routes catch any genuinely-wrong route paths.

---

### Phase 4 — Design tokens + palette guard (P2 #8)

- Add `src/theme/motion.ts`: `MOTION = { fast: 200, base: 250, slow: 300, stagger: 50 }`.
  ⚠️ **Scope correction:** there are **343** `.duration() > 300ms` calls (of 507 total), not 17 — a
  full sweep is not justified by finding #8 and would be massive churn. **Apply `MOTION` to new code
  and the files Phase 7 already touches only.** Do not mass-migrate the 500 call sites. (The
  `<300ms` CLAUDE.md guideline being violated 343× is a separate question — flag it, don't auto-"fix".)
- Add `STALE_TIME = { fiveMin, thirtyMin, oneDay, static: Number.POSITIVE_INFINITY }` to
  `src/lib/query-client.ts`; replace the ~28 inline `staleTime` literals (cheap, worth it).
- Migrate hardcoded hex/rgba → `palette` tokens in `ride-summary.tsx`,
  `share-destination-grid.tsx`, `(garage)/index.tsx`, `(diagnose)/index.tsx` & `[id].tsx`,
  `login.tsx`/`register.tsx`, profile `upgrade/privacy/notifications/support.tsx`.
  **Exclude `ride-detail.tsx` and `create-trip.tsx`** (Phase 7 rewrites them).
  For `rgba(white, α)` overlays, use a small **mobile-local** `withAlpha(palette.x, α)` helper or
  inline alpha — do **not** add semantic alpha tokens to the design-system package (speculative
  cross-package abstraction; promote later only if a clear repeated semantic emerges). (See
  `tab-screen-implementation-color-centralization.md` and
  `sf-symbols-to-lucide-migration-oklch-runtime-bug.md` for oklch/palette gotchas — verify colors
  *render*, don't just typecheck.)
- **Exclude** (legitimate): `src/widgets/*` (rendered via `@expo/ui/swift-ui`, can't import JS
  palette), `src/lib/pdf-template.ts` (HTML string), `src/config/brand-dna.ts`, curated
  `onboarding-colors.ts`/`diagnostic-colors.ts`.
- Add a scoped Biome lint rule (hex/rgba banned in `src/components` + `src/app`, excluding the
  above) **with `ride-detail.tsx` + `create-trip.tsx` temporarily ignore-listed** (Phase 7b removes
  them once those files are clean). This lets the guard go green before Phase 7 lands.

**Acceptance:** no raw hex/rgba in `src/components`/`src/app` (minus exclusions + the two
ignore-listed Phase-7 files); `STALE_TIME` adopted; `MOTION` exists and used by new/Phase-7 code;
lint guard fails on a planted violation.

---

### Phase 5 — `<QueryBoundary>` + error retrofit (P2 #7, trimmed)

⚠️ **Simplicity correction:** the finding is "only 9 of 31 data screens handle `isError`." That needs
**one** primitive, not four. Building `<Screen>` (touches ~57 files, solves a non-finding, high
regression surface across scroll/keyboard/formSheet insets) and `<ScreenHeader>` (18 files, headers
vary) is framework-building beyond the audit. **Drop both.**

- Create **`src/components/ui/query-boundary.tsx`** — `<QueryBoundary isLoading isError onRetry
  isEmpty emptyState={...}>` with loading + error+retry + empty states folded in (empty rendered via
  a prop, since empty states are too content-specific to standardize as a separate component). Uses
  existing `palette` (no dependency on Phase 4).
- Retrofit the ~22 data screens missing `isError` handling, starting with `(discover)/index.tsx`.
  **Exclude `trip-detail.tsx`** — it adopts `<QueryBoundary>` during its Phase 7a rewrite.
- `<ScreenHeader>`, if wanted, is built opportunistically *inside* Phase 7 when those screens are
  already being touched — not as a dedicated 18-file retrofit pass.

**Acceptance:** `<QueryBoundary>` exists + used; network-read screens (minus the Phase-7 ones) render
an error+retry state; `isError`-handling screens ≥ 28/31 after Phase 7.

---

### Phase 6 — List performance (P1 #3) — trimmed for React Compiler

⚠️ **React Compiler is ON**, so it already memoizes components/props that follow Rules of React.
Do **not** add `useMemo`/`useCallback`/`React.memo` as the primary fix — they're redundant. The real
list issues are (a) un-cached images and (b) a pure compute the compiler can't cache.

- **expo-image migration (the main win).** `cachePolicy="memory-disk"` (default is `'disk'` — must set
  explicitly for the in-memory decode cache), `contentFit="cover"`, `transition={180}`,
  `priority="low"` (list thumbs), `placeholder={{ blurhash }}`, and **`recyclingKey={item.id}`** (the
  stable entity id — NOT the URL, NOT the index; resets the view to placeholder before the new source
  decodes, killing the scroll flicker). ⚠️ expo-image has **no intrinsic size** — every target must
  have an explicitly sized container. `src/components/ui/avatar.tsx:97-106` is the reference. Targets:
  `discover-trip-card.tsx`, `ride-map-thumbnail.tsx`, `feed-ride-card.tsx`, `comment-item.tsx`,
  `review-list.tsx`, `near-you-section.tsx`, `rider/followers.tsx:145`. Reuse `<Avatar>` for avatars.
- **`RideCard` prop stability** (`rides.tsx:284-318`): the bug is prop *instability*, not missing memo.
  Pass an id-based stable `onPress`. **Skip** the "build `ride` via `useMemo`" step — the compiler
  memoizes the constructed object. Verify `ride-card.tsx` has no `"use no memo"` directive and follows
  Rules of React (else the compiler silently bails). Keep the existing `memo()` as harmless belt-and-suspenders.
- **`tint()` cache (keep — compiler can't do this).** `src/theme/editorial.ts:64` does expensive
  oklch/hex parsing per call, called per-row. Add a module-level `Map` cache keyed by `color|alpha`.
  This is the one genuinely necessary perf item here.
- **Flyover worklet** (`ride-flyover.tsx:309-318`): track cursor as a `useSharedValue` advanced
  incrementally (not O(n) rescan per tick); hoist captured primitives out of the worklet (avoid
  capturing whole `route`/`palette` objects); avoid per-tick `runOnJS`; drive off the UI frame clock
  (`useFrameCallback` gated to ~10fps), not a JS `setInterval`. (Lower priority; include if cheap.)
- **FlatList stays.** Do NOT adopt FlashList in this plan — v2 requires New Architecture + a native
  build (breaks the OTA story; verify `newArchEnabled` first if ever revisited). A FlashList migration
  is a separate future native PR with `getItemType` for the mixed-height feeds.

**Verification (no render-count assertion under the compiler):** use React DevTools' "Memo ✨" badge /
profiler to confirm rows aren't re-rendering on parent state change and aren't silently opting out of
the compiler. Confirm list images persist across app relaunch (disk cache) and don't flicker on scroll.

**Acceptance:** list images cache to disk, no re-download flicker; rows compiler-eligible (verified in
DevTools); `tint()` cached; no behavior change.

---

### Phase 7 — God-screen decomposition (P1 #2) — split into 7a + 7b

Establish the rule **"no `gqlFetcher` in `app/` route files — all GraphQL via a hook in
`src/hooks/`."** Each sub-phase is its own PR, each as **two commits**: (1) behavior-preserving
extraction (hooks + pure helpers, typecheck green), then (2) componentize the JSX. This keeps
`git bisect` diffs small on the riskiest, E2E-uncovered files. Split by **seams that already exist**,
not to hit a number — `<800 LOC` is a smell threshold, not a quota. Don't fragment single-use code
into tiny files; co-locate until it's actually reused.

**Phase 7a — `trip-detail.tsx` (2,246 LOC, read-mostly: query + join/leave/clone/save/share).**
Lower hydration risk — do first to prove the pattern.
- Extract `useTripDetailData(id)` hook (query + mutations; removes all `gqlFetcher` from the route).
- Split into `<TripMap>`, `<TripItinerary>`, `<TripActions>`.
- The inline polyline copy is already gone (Phase 1b).
- Adopt here (deferred from earlier phases for this file): `<QueryBoundary>` (Phase 5), shared
  formatters incl. the `:1367` duration (Phase 3a), palette migration (Phase 4), `expo-image` for any
  list imagery, optional `<ScreenHeader>`.

**Phase 7b — `create-trip.tsx` (2,133 LOC, 22 `useState`, write-heavy).** Highest regression risk —
do second once 7a validates the pattern.
- Extract `useCreateTripForm()` / `useTripRoute()` hooks (route geometry, waypoint CRUD, legs,
  geocoding); removes `gqlFetcher` from the route.
- Collapse the 5 `edit*` states (`editName/editType/editNotes/editPeriod/editingWaypoint`) into a
  `<WaypointEditSheet>` child with a single `editDraft` object.
- Move pure helpers (`getDifficulties`, `formatSegment*`, `tempId`) to `utils/`. Keep form-field block
  + map handlers co-located in the parent unless they gain a second caller.
- Adopt formatters/palette here; **final step: remove `trip-detail.tsx` + `create-trip.tsx` from the
  Phase 4 Biome-guard ignore list** (both files are now palette-clean).
- ⚠️ Preserve create-trip's edit/clone-mode hydration order (partial hydration can orphan the draft).

Target: each route file < 800 LOC. (See `trip-unification-three-entities-to-one.md` for the trip
domain model and `parallel-agent-worktree-epic-execution.md` for executing large refactors.)

**Acceptance:** both files < 800 LOC; no `gqlFetcher` import in either; extracted hooks
unit-testable; Phase 4 guard ignore-list emptied; manual smoke test of create / edit / clone / share /
save / join-leave passes; no regression.

---

### Phase 8 — Cleanup sweep (P3 #10, trimmed)

⚠️ **Alias codemod CUT.** Metro resolves `@/*` automatically, but rewriting 264 working
`../../../` imports is pure churn with zero correctness gain (and a non-zero runtime-resolution
risk). Instead: the alias is already valid — **allow `@/*` for new code and migrate organically**
when files are touched for other reasons. No bulk codemod.

- **Dead code:** delete `src/hooks/use-waypoint-mutations.ts` and `src/hooks/use-lean-angle.ts`
  (both zero importers — verified). Confirm `maxLeanAngle`/`updateMaxLeanAngle` plumbing in
  `ride.store.ts:82` is live (consumed in `ride-hud.tsx`/`ride-detail.tsx`); the store path is
  canonical, so the orphaned hook is safe to remove.
- **Widget filenames:** rename `src/widgets/{RideStatsWidget,LastRideWidget,NextServiceWidget,
  ExpenseTrackerWidget}.tsx` → kebab-case (or document widgets as an intentional exception in
  `apps/mobile/CLAUDE.md`). Update imports.
- **Storage validation (genuine hardening):** add Zod `safeParse` at deserialize boundaries —
  `utils/ride-storage.ts:101,122`, `utils/ride-sync-queue.ts:62,72`, `lib/offline-trips.ts:107,163`,
  `lib/query-persist.ts:16`, `lib/notifications.ts:14`. On parse failure: log + drop, don't
  propagate malformed data.

**Acceptance:** dead files removed; widgets consistent; storage reads validated.

---

## System-Wide Impact

- **Interaction graph:** `processLocation` (Phase 2) feeds `ride.store` setters → `ride-hud` /
  live stats → ride persistence + `ride-sync-queue`. Extracting `decideAutoPause` must keep the
  exact same store-write sequence. Polyline dedup (Phase 1) touches heatmap rendering + trip
  map + ride map — verify all three render identically.
- **Error propagation:** Phase 5's `<QueryBoundary>` standardizes error surfacing; ensure it
  doesn't swallow errors that were previously `captureException`'d.
- **State lifecycle risks:** Phase 7 hook extraction must preserve create-trip's edit/clone-mode
  hydration order (partial hydration → orphaned draft). Phase 8 Zod validation changes what
  happens on corrupt persisted state (drop vs crash) — intended hardening.
- **API surface parity:** distance/duration formatting (Phase 3) — ensure web app isn't
  relying on a divergent mobile-only impl (mobile-only change; web has its own formatters).
- **Integration scenarios:** (1) start a ride offline → auto-pause → kill app → resume; (2)
  create multi-day trip with 30 waypoints, edit one, clone it; (3) imperial-unit user views
  ride card, trip card, and HUD — all must show miles.

## Acceptance Criteria

### Quality Gates (every phase)
- [ ] `pnpm --filter mobile typecheck` clean
- [ ] `pnpm --filter mobile test` green
- [ ] `pnpm lint` clean (Biome)
- [ ] Phase committed independently with conventional message

### Functional
- [ ] Mileage label renders real value (P1 bug fixed)
- [ ] Distance/duration honor imperial preference app-wide
- [ ] All network-read screens have error+retry states
- [ ] List scroll: no image re-download flicker, no all-row re-render on parent state change
- [ ] `create-trip.tsx` & `trip-detail.tsx` each < 800 LOC, no `gqlFetcher`

### Non-Functional
- [ ] `as any` count < 8 (down from ~40), each remaining one justified
- [ ] New tests cover health-score, pro-gate, decideAutoPause, formatters, sync-queue, escapeHtml
- [ ] No raw hex/rgba in `src/components`/`src/app` (minus documented exclusions); lint guard active

## Merge order & granularity (solo dev, green main)

Pre-push runs lint+typecheck+test, so every PR must be independently green. One PR per row:

1. **Phase 1** (incl. 1.0 pre-flight config) — correctness + polyline dedup. Highest value (live
   mileage bug). Gate on the round-trip polyline test before deleting either copy. Commit config-enable
   separately from code fixes.
2. **Phase 2** — pure-logic tests only (health-score, pro-gate, decideAutoPause, sync-queue, escapeHtml).
3. **Phase 3** — formatters (+ formatter test) + logger + typed-nav, **excluding** the two Phase-7 files.
4. **Phase 4** — `STALE_TIME` + palette migration + Biome guard (two Phase-7 files ignore-listed),
   **excluding** the two Phase-7 files; `MOTION` token added but not swept.
5. **Phase 5** — `<QueryBoundary>` + retrofit (excluding trip-detail).
6. **Phase 6** — list perf (expo-image + tint cache; no manual memo).
7. **Phase 7a** — trip-detail decomposition (2 commits: extract green, then componentize).
8. **Phase 7b** — create-trip decomposition (2 commits); final step empties the Phase 4 guard ignore list.
9. **Phase 8** — dead-code + widget renames + Zod validation (no alias codemod).

## Dependencies & Risks

- **Phase 7 is the largest and riskiest** (god-screen refactor), now split 7a/7b. Depends on
  Phases 3/4/5/6. Smoke-test trip flows manually — these screens have no E2E coverage.
- **Polyline dedup (Phase 1):** divergent encoders are a round-trip hazard — gate on the
  round-trip test before deleting copies.
- **Typed routes (Phase 1.0 / 3c):** enabling `typedRoutes` may surface *new* type errors at
  previously-`as any`'d call sites pointing at renamed/nonexistent routes — that's the feature working;
  fix the paths, don't re-cast. `.expo/types` must exist at CI typecheck time (see Phase 1.0 note).
- **Palette migration (Phase 4):** oklch runtime conversion has bitten this repo before
  (`sf-symbols-to-lucide-migration-oklch-runtime-bug.md`) — verify colors render, don't just
  typecheck.
- **OTA note:** runtime version policy is `appVersion` 3.7.0. Phases 2–8 are JS-only and
  OTA-shippable via EAS Update. **Phase 1.0's `typedRoutes` flag is a config/build change** (regenerates
  native types) — land it with a build, not an OTA-only push. `expo-image` is already a native dep
  (used by `avatar.tsx`), so Phase 6 is OTA-safe. (FlashList was rejected partly to preserve this.)

## Sources & References

### Internal — known patterns / learnings (`docs/solutions/`)
- `architecture/measurement-system-and-ride-feature-design.md` — canonical unit rule (Phase 1/3)
- `architecture/trip-unification-three-entities-to-one.md` — trip domain model (Phase 7)
- `integration-issues/monorepo-code-review-multi-category-fixes.md` — prior multi-category fix flow
- `integration-issues/parallel-agent-worktree-epic-execution.md` — executing large refactors
- `integration-issues/ios-widget-data-sync-failures.md` — widget-sync context (Phase 3b)
- `ui-bugs/tab-screen-implementation-color-centralization.md` + `ui-bugs/sf-symbols-to-lucide-migration-oklch-runtime-bug.md` — palette/oklch (Phase 4)
- `ui-bugs/zero-distance-rides-first-ride-dropout.md` — ride edge cases (Phase 2)
- `ui-bugs/stuck-processing-diagnostics-infinite-spinner.md` — error-state handling (Phase 5)

### Key code references
- `src/app/(modals)/start-ride.tsx:78-80,203-213` (bug), `src/components/ride/pre-flight-checklist.tsx:66`
- `src/utils/polyline.ts` (canonical), `src/utils/ride-heatmap.ts`, `src/app/(modals)/trip-detail.tsx`
- `src/lib/health-score.ts`, `src/hooks/use-pro-gate.ts`, `src/utils/ride-location.ts:111-226`
- `src/utils/ride-formatters.ts`, `src/components/ui/avatar.tsx:97` (expo-image reference)
- `src/app/(tabs)/(profile)/rides.tsx:284-318`, `src/theme/editorial.ts:64`
- `src/lib/widget-sync.ts:51,68,85,219`, `src/lib/query-client.ts:30`, `apps/mobile/tsconfig.json` (`@/*`)
