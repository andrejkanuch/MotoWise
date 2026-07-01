---
title: "feat: CarPlay panel answers the next-decision question (Sprint 1)"
date: 2026-07-01
branch: feat/carplay-companion
type: feat
status: ready
depth: standard
---

# feat: CarPlay panel answers the next-decision question (Sprint 1)

## Summary

The CarPlay live-ride panel currently shows four fixed rows while recording: Speed, Distance, Moving, and a compound **Climb** row (`↑640 ↓320 m`). That last row is the least glanceable element on the panel — two numbers in one row violates the 2-second glance budget — and it surfaces information no rider is acting on mid-ride.

This plan replaces the 4th row with a **self-prioritizing "heads-up" row** that shows the single most decision-relevant fact for the active bike, chosen by a pure priority function: open recall → service overdue → service due soon → (fallback) climb ascent only. It also splits the Climb row so it never shows two numbers again (ascent-only on the head unit; descent stays in the phone ride-summary).

All data used already exists in the GraphQL schema and is loaded through the same cache-first path the Bike-status list already uses. **No migrations, no new deps, no external APIs, no new CarPlay surfaces.**

---

## Problem Frame

- **Glanceability:** the compound `↑640 ↓320 m` Climb row is the worst offender against Apple's 2-second glance rule (stricter for motorcycles). One label + one value per row is the target.
- **Relevance:** live climb ascent/descent is decorative mid-ride. The rider's actual unanswered questions are safety/maintenance-shaped ("is there an open recall? is service overdue?").
- **We already have the data:** `recallCount` on the bike, and `MaintenanceTask` fields (`targetMileage`, `dueDate`, `priority`, `status`) are already fetched for the Bike-status list. Nothing new is required server-side.

Out of scope (explicitly deferred — see Scope Boundaries): fuel-range/reserve row, weather branch, voice notes, native `CPAlertTemplate` stop confirm, grid/tab-bar surfaces.

---

## Requirements

- **R1** — On the live panel while recording/auto-paused, row 4 is a single "heads-up" row chosen by a pure priority function; rows 1–3 (Speed, Distance, Moving) are unchanged. Speed stays the hero (row 1).
- **R2** — Priority ladder, first match wins: (a) open recall on the active bike → recall row; (b) a pending/in-progress maintenance task past due (by `dueDate` or by `targetMileage` vs `currentMileage`) → overdue row; (c) a pending task due soon (within threshold) → due-soon row; (d) fallback → climb ascent (`↑<gain> m`).
- **R3** — The Climb representation is ascent-only everywhere on the head unit (`↑640 m`, no descent). Descent remains available only in the phone ride-summary (already the case; this plan must not add descent back).
- **R4** — The picker is a **pure function** in `carplay-templates.ts` with no fetching, no store, no native calls. The coordinator threads bike/task data in via `RideInput`.
- **R5** — Bike/task data is loaded **cache-first**, once per connect/ride-active (not per GPS-tick render), never throws into `render()`, and degrades to the climb fallback when data is absent or a fetch fails.
- **R6** — Head-unit copy stays hardcoded English (matches the existing surface); no `t()` churn. No magic strings — new labels/thresholds are typed `as const`. No `any` for GraphQL data — use generated types from `@motovault/graphql`.
- **R7** — The existing throttle (≥10s numeric coalescing), state-transition fast path, `bikeVisible` root-suppression, and stop-guard behavior are preserved. The heads-up row's content changing is treated as numeric churn (row update in place), not a state transition — it must not re-push the root or fight the throttle beyond the existing rules.

---

## Key Technical Decisions

- **KTD1 — Heads-up selection lives in `carplay-templates.ts` as a pure function.** It mirrors the panel's existing pure-builder discipline (`deriveState`/`deriveSnapshot`) and is fully unit-testable without native/store mocks. The coordinator supplies pre-shaped data on `RideInput`; the picker never fetches. *(Rationale: matches the file's stated contract "No React, no native, no store".)*

- **KTD2 — Reuse the Bike-status selection logic, don't duplicate it.** `carplay-bike-status.ts` already has `pickNextService`, `ACTIVE_STATUSES`, `PRIORITY_WEIGHT`, and consumes `getRelativeDueDate` from `src/lib/health-score.ts`. The heads-up picker reuses `getRelativeDueDate` (and the same task-shape) so "overdue"/"due soon" are computed identically to the Bike list and the home screen. Extract shared task-shape/constants if that avoids copy-paste, but do not change Bike-list behavior. *(Rationale: single source of truth for "what counts as overdue"; avoids drift the U8 review already worried about.)*

- **KTD3 — Recall row uses `recallCount` only (no extra fetch).** The panel shows a generic `"<n> open recall"` / `"<n> open recalls"` from the bike's `recallCount`. Full recall detail (component/summary) lives behind a separate `MotorcycleRecalls` query and is NOT fetched for the panel — pulling it per ride would add a network hop the glance surface doesn't need. *(Rationale: R5 cost discipline; the count is already on `MyMotorcycles`.)* Documented alternative in Open Questions.

- **KTD4 — Overdue-by-mileage needs `currentMileage` + `targetMileage`.** A task is mileage-overdue when `status ∈ {pending,in_progress}`, `targetMileage != null`, `currentMileage != null`, and `currentMileage >= targetMileage`. Date-overdue reuses `getRelativeDueDate(...).isOverdue`. Either condition qualifies for rung (b). *(Rationale: both signals already exist on the fetched shapes.)*

- **KTD5 — Data loads once and is cached on a coordinator module-level ref, refreshed on connect and when the ride transitions to active; `currentRideInput()` reads the cached snapshot synchronously.** The GPS-tick render path must stay allocation-light and never await. A load failure leaves the last-good (or null) snapshot; the picker falls back to climb. *(Rationale: R5 — no latency added to render; resilient.)*

- **KTD6 — "Due soon" threshold is a typed constant.** Default `DUE_SOON_DAYS = 14` (align with existing reminder cadence if one is canonical; see Open Questions). Expressed `as const`, no magic numbers.

---

## High-Level Technical Design

Priority ladder evaluated once per snapshot (first match wins), producing the single row-4 string:

```
pickHeadsUp(input) -> { label, detail }
  1. recallCount > 0                      -> { "Recall",  "1 open recall" | "N open recalls" }
  2. task is overdue (date OR mileage)    -> { "Overdue", "<title>" }            // ⚠ prefix on label
  3. task due within DUE_SOON_DAYS        -> { "Service", "<title> · in Nd" }
  4. else                                 -> { "Climb",   "↑<gain> m" }          // ascent only
```

Data flow (unchanged transport; new fields in bold):

```
MyMotorcycles (cache)        MaintenanceTasksByMotorcycle (cache)
        \                          /
         v                        v
  coordinator: loadHeadsUpData()  ── caches ──> headsUpSnapshot (module ref)
         |
         v
  currentRideInput() reads snapshot synchronously  ── adds ──>  RideInput.recallCount, RideInput.tasks, RideInput.currentMileage
         |
         v
  deriveSnapshot() -> pickHeadsUp() -> PanelSnapshot.headsUp
         |
         v
  buildPanelItems(): rows = [Speed, Distance, Moving, headsUp]
```

`buildActions`, `deriveState`, the throttle, and `bikeVisible` suppression are untouched.

---

## Implementation Units

### U1. Split the Climb row to ascent-only (pure)

**Goal:** The head-unit Climb representation shows ascent only (`↑640 m`); descent is dropped from the panel (it remains in the phone ride-summary, which this plan does not touch).

**Requirements:** R3, R6.

**Dependencies:** none.

**Files:**
- `apps/mobile/src/features/carplay/carplay-templates.ts` — change `formatClimb` to emit ascent only; drop the `elevationLoss` argument from the panel path. Keep `elevationLoss` on `RideInput` only if still consumed elsewhere; otherwise remove it from the panel input to avoid a dangling field.
- `apps/mobile/src/features/carplay/__tests__/carplay-templates.test.ts` — update Climb assertions.

**Approach:** `formatClimb(gain, system)` → `↑${formatElevationValue(gain, system)} ${elevationUnitLabel(system)}`. This becomes the rung-(d) fallback string that U2 consumes, so keep it exported/available to the picker.

**Patterns to follow:** existing `formatClimb`, `formatElevationValue`, `elevationUnitLabel` usage.

**Test scenarios:**
- Metric ascent renders `↑640 m` (no descent, no `↓`).
- Imperial ascent renders in ft with the imperial unit label.
- Zero ascent renders `↑0 m` (not a dash) — confirms it's a valid fallback value.
- Assert the string contains no `↓` character (guards against descent regressing).

**Verification:** `carplay-templates` tests pass; no `↓` appears in any panel row builder.

---

### U2. Pure heads-up priority picker + panel wiring

**Goal:** Add `pickHeadsUp(...)` and thread its result into `deriveSnapshot`/`buildPanelItems` as row 4 (recording + auto-paused states). Rows 1–3 unchanged.

**Requirements:** R1, R2, R4, R6, KTD1, KTD2, KTD3, KTD4, KTD6.

**Dependencies:** U1 (fallback string).

**Files:**
- `apps/mobile/src/features/carplay/carplay-templates.ts` — add `HEADS_UP_LABEL` (`as const`), `DUE_SOON_DAYS` (`as const`), `pickHeadsUp(input)`, extend `RideInput` with `recallCount`, `tasks`, `currentMileage`, extend `PanelSnapshot` with the resolved `headsUp` row, wire into `deriveSnapshot` and `buildPanelItems` (live branch row 4). Non-live (idle/acquiring) branch keeps its current Mode/dash rows — do not add heads-up there.
- `apps/mobile/src/features/carplay/carplay-bike-status.ts` — extract the shared task shape / `getRelativeDueDate` usage if it avoids duplication (KTD2); otherwise import the same helper. Do not change Bike-list output.
- `apps/mobile/src/features/carplay/__tests__/carplay-templates.test.ts` — picker + layout tests.

**Approach:** Pure function taking `{ recallCount, tasks, currentMileage }` (already normalized by the coordinator). Ladder per HTD. Overdue = date-overdue (`getRelativeDueDate(dueDate).isOverdue`) OR mileage-overdue (KTD4). Due-soon = `0 <= daysAway <= DUE_SOON_DAYS` on an active task with a `dueDate`. Recall copy pluralizes on `recallCount`. Titles are truncated to a glanceable length if needed (reuse any existing truncation; otherwise a small `as const` max).

**Patterns to follow:** `pickNextService` in `carplay-bike-status.ts`; `getRelativeDueDate` in `src/lib/health-score.ts`; existing `deriveSnapshot`/`buildPanelItems` structure.

**Test scenarios (each rung + tie-breaks + fallbacks):**
- Recall present (`recallCount=2`) AND an overdue task AND a due-soon task → recall row wins; detail `2 open recalls`.
- `recallCount=1` → singular `1 open recall`.
- No recall, date-overdue task present → `Overdue` row with that task's title (⚠ on label).
- No recall, no date-overdue, but `currentMileage >= targetMileage` on an active task → overdue-by-mileage wins (KTD4).
- Overdue task is `status: completed`/`skipped` → ignored (only pending/in_progress qualify).
- No recall, no overdue, task due in 3 days (≤ threshold) → `Service` due-soon row.
- Task due in 90 days (> threshold) → NOT due-soon → falls through to climb fallback.
- No recall, no tasks at all → climb ascent fallback (`↑<gain> m`) from U1.
- Tie-break: two active tasks, one more overdue → the more-overdue title is shown (mirrors `pickNextService` ordering).
- Layout: live `buildPanelItems` returns exactly `[Speed, Distance, Moving, headsUp]` in order; 4-row cap respected; Speed is row 1.
- Non-live (idle) branch unchanged — no heads-up row, still shows Mode/dash rows.

**Verification:** all rungs covered by tests; `buildPanelItems` live layout asserts 4 rows with heads-up last.

---

### U3. Coordinator: cache-first heads-up data load + thread into `currentRideInput`

**Goal:** Load active bike (`recallCount`, `currentMileage`) + its maintenance tasks cache-first, cache the snapshot, and feed it to `currentRideInput()` synchronously. Resilient and off the render hot path.

**Requirements:** R5, R7, KTD5.

**Dependencies:** U2 (the `RideInput` fields it populates).

**Files:**
- `apps/mobile/src/features/carplay/carplay-coordinator.ts` — add a module-level `headsUpSnapshot` ref + `loadHeadsUpData()` (cache-first `queryClient.getQueryData` then `gqlFetcher(MyMotorcyclesDocument)` / `gqlFetcher(MaintenanceTasksByMotorcycleDocument, { motorcycleId })`, mirroring `loadBikeStatus`). Populate the new `RideInput` fields in `currentRideInput()` from the cached snapshot (default to empty/null when absent). Trigger the load in `onConnect` and when the ride becomes active; guard with a token like `bikeLoadToken` so a stale resolve doesn't clobber a newer one. Never throw into `render()`.
- `apps/mobile/src/features/carplay/__tests__/carplay-coordinator.test.ts` — load + fallback + no-per-render-fetch tests.

**Approach:** Reuse the exact `activeBikeFrom` / cache-first pattern already in the file. Load is fire-and-forget with `captureException` on failure (same as `loadBikeStatus`), writing results into `headsUpSnapshot`. `currentRideInput()` stays synchronous and allocation-light — it only reads the ref. Respect `bikeVisible` suppression (no behavior change there) and the throttle (heads-up content change is row churn, coalesced ≥10s like other numerics — it must not count as a state transition).

**Patterns to follow:** `loadBikeStatus`, `activeBikeFrom`, `syncBikeInput`, `bikeLoadToken` in `carplay-coordinator.ts`.

**Test scenarios:**
- `currentRideInput()` does NOT call `gqlFetcher` on every render (fetch happens on connect/activation only) — assert fetch call count stays flat across multiple `fireStore()` renders.
- Cache hit: `queryClient.getQueryData` populated → snapshot uses it without a network fetch.
- Load failure (gqlFetcher rejects) → `captureException` called, `render()` still runs, panel falls back to climb (no throw).
- No active bike → snapshot yields `recallCount:0`, empty tasks → climb fallback.
- Recall present in cache → panel row 4 becomes the recall row after load (state/rows update via existing render path).
- Stale-load guard: a resolve arriving after a newer load/disconnect does not overwrite the current snapshot.
- `bikeVisible` true → no root rebuild from a heads-up data arrival (existing suppression honored).

**Verification:** coordinator tests pass; no fetch on the render hot path; failures degrade gracefully.

---

## Scope Boundaries

**In scope:** the three changes above (climb split, heads-up picker, coordinator data-wiring) and their tests, on the existing `InformationTemplate` live-ride panel.

### Deferred to Follow-Up Work
- **Fuel-range / reserve row** — needs a per-bike tank/range field (migration + resolver + phone input); no live fuel signal exists. Separate vertical-slice PR.
- **Weather-ahead branch** of the heads-up ladder — the `use-weather-forecast.ts` hook exists but is React/location-bound; feeding CarPlay needs a coordinator-side fetch. Separate PR.
- **Full recall detail** (component/summary in the row) — behind `MotorcycleRecalls`; would add a network hop (KTD3). Revisit if riders want the component name.
- **Native `CPAlertTemplate` stop confirm**, **voice ride-note**, **Grid/Tab-bar surfaces** — out of this sprint.

### Not doing (identity)
- No turn-by-turn / nav parity. No write actions on the head unit — CarPlay stays read-only and glanceable.
- No CarPlay localization in this PR (head-unit copy stays hardcoded English to match the existing surface).

---

## Risks & Dependencies

- **R-risk1 — Render hot-path latency.** If data loading leaks into `currentRideInput()`, GPS-tick renders would stall. Mitigation: KTD5 (synchronous ref read only) + explicit test that no fetch fires per render.
- **R-risk2 — Behavior drift vs Bike list / home screen.** Two definitions of "overdue"/"due soon" would confuse riders. Mitigation: KTD2 reuse of `getRelativeDueDate` + shared task shape.
- **R-risk3 — Throttle/state-machine interaction.** The heads-up row can change while `deriveState` stays `recording`; if mis-modeled it could either re-push the root or never update. Mitigation: treat as row churn (same as speed/distance) so the existing ≥10s coalescing + trailing flush apply; add a test that a heads-up change with unchanged state updates rows in place, not a re-push.
- **R-risk4 — Truncation on narrow head units.** Long task titles could clip. Mitigation: cap title length with a typed constant; test the cap.
- **Dependency:** none external. Uses `MyMotorcyclesDocument` + `MaintenanceTasksByMotorcycleDocument` already imported in the coordinator. No `pnpm generate` needed (no `.graphql`/resolver change).

---

## Verification Strategy

- `pnpm --filter mobile test -- carplay` — all carplay suites green, including new picker + coordinator tests.
- `pnpm --filter mobile exec tsc --noEmit` — clean.
- `pnpm exec biome check <changed files>` — clean.
- Manual (optional, CarPlay simulator): with a bike that has an open recall, row 4 shows the recall; clear it and force an overdue task → row 4 shows Overdue; neither → row shows `↑<gain> m`. Confirm rows never show two numbers.

---

## Open Questions (planning-time resolved; execution notes)

- **Due-soon threshold value** — default `DUE_SOON_DAYS = 14`. If the app has a canonical reminder window (e.g., `remind7d`/`remind30d` flags on tasks, or a home-screen "due soon" constant), align to it at implementation time. Resolve by grepping for an existing threshold before introducing a new one.
- **Recall copy** — generic count (`N open recalls`) per KTD3. If product wants the component name, that's the deferred full-recall-detail item, not this PR.
- **`elevationLoss` on `RideInput`** — remove from the panel input if U1 leaves it unused; keep only if another consumer reads it. Decide when editing the type.
