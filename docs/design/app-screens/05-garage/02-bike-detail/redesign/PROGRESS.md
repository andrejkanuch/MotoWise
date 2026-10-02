# Bike-detail redesign — progress log

The lead's only memory between runs. Read this first; continue from the first unfinished step.

## Phases

| # | Phase | Branch | Status | Step | PR | Migration pushed |
|---|---|---|---|---|---|---|
| 1 | Shell + Overview | `feat/bike-detail-shell-overview` | in progress | 5 · Implement | — | no |
| 2 | Service segment | — | not started | — | — | — |
| 3 | Task flows | — | not started | — | — | — |
| 4 | Costs | — | not started | — | — | — |
| 5 | Bike segment + recalls | — | not started | — | — | — |
| 6 | Cleanup + Home card | — | not started | — | — | — |

## First run — 2026-10-02

- Inputs confirmed: `DESIGN-SPEC.md`, 48 `.dc.html` screens, `canvas.json`, `hero.jpg`. No `screens/png/` — Visual QA renders the HTML with headless Chromium at 390×844.
- `screens/*.dc.html` load `./support.js`, which is not in the folder. Styles sit in a plain `<style>` inside `<helmet>`, so the files should still render; Visual QA confirms on its first render.
- Design library committed on the phase 1 branch (`d2ad7e07`, `3626a4d6`). PNG screenshots are not in git: `.gitignore:5` ignores `screenshots/` repo-wide.
- Baseline on `main` @ `965ad1de`:
  - `pnpm install --frozen-lockfile`: ok.
  - `pnpm precheck`: **fails at `pnpm lint`** with 2 Biome format errors, neither in tracked code: `redesign/screens/canvas.json` (fixed in `3626a4d6`) and `outputs/play-release-3.20.0/release-notes-3.20.0.json` (untracked, the owner's file, left alone). 4 `useOptionalChain` warnings in `apps/mobile/src/widgets/*Widget.tsx` are pre-existing.
  - typecheck + test baseline: see "Baseline typecheck/test" below.

## Phase 1 — Shell + Overview

### What changes (step 1)

Today `app/(tabs)/(garage)/bike/[id].tsx` is one `ScrollView` with 13 stacked blocks and a 320 pt hero. Phase 1 replaces the frame and the first segment:

- **Shell**: persistent header (origin-aware back, serif 22 bike name + mono eyebrow "2022 · Honda", one odometer chip → `OdometerSheet`), segment bar (Overview · Service · Costs · Bike; Service badge = overdue Critical/High count; Material tabs on Android), segment container with per-segment scroll and remembered last segment per bike, copper action pill ("Log" on Overview), `UndoSnackbar`, deep-link landing rule. Header name + chip merge into one 44 px row on scroll.
- **Overview** (`Main`, `OverviewScrolled`, `OverviewEmpty`): 150 px photo band (PRIMARY / rides chips) → ride-status card → Needs attention (ranked, max 3 + "N more", count in eyebrow) → Next up → Costs card (year total, YoY vs same period, category bar, This month / Per month / Top category) → Notes block (2 latest + quick add) → Papers & bike rows. Empty bike: dashed "Add a photo", "Nothing tracked yet", "Set this bike up" (import schedule · log past work · add documents), €0.00 costs card.
- **LogSheet**: bottom drawer — Expense · Maintenance task · Work already done · Note · Document.
- **OdometerSheet**: keypad, quick-add chips (+rides distance, +50/+100/+250), date, lower-than-last confirm; replaces iOS-only `Alert.prompt`; writes an `odometer_readings` row.
- **NoteSheet** + **Notes**: per-bike notes (text, odometer stamp, photo, "also make it a task"), list with search, swipe edit/delete with 5 s undo, composer bar.
- **Service / Costs / Bike tabs**: wrap today's `hub/maintenance-section`, `hub/expenses-section`, `hub/documents-section` + `hub/bike-details-card` unchanged.
- **Data**: `notes`, `odometer_readings`, `motorcycles.distance_unit`.

Not removed yet (phase 6): `bike-stats-row`, `mileage-display`, health-report screen and card.

### Lead decisions for phase 1

| # | Decision | Why |
|---|---|---|
| D1 | `distance_unit` is label-only. Backfill each bike from its owner's current measurement system; odometer and interval values stay RAW, nothing is converted. The Edit-bike control for it lands in phase 5; phase 1 adds the column and reads it. | Odometer is stored raw in the user's unit on `main` (PR #164 contract); a km-normalising migration would ship a 1.61× bug. |
| D2 | Ride status in phase 1 uses a constant list of riding-blocking document categories (insurance, inspection, registration) and treats every recall returned for the bike as open. Both are swapped for real data in phase 5 (`document_categories.blocks_riding`, `recall_acknowledgements`). | Those columns belong to phase 5; the rule must still work now. |
| D3 | Links to leaves not built yet go to today's screens: task → Service tab with `highlightTask`; recall → `/(modals)/recalls`; document → `document/[id]`; Log drawer → today's `add-expense`, `add-maintenance-task`, `add-maintenance-task?mode=log`, `add-document`. NoteSheet's "Link a job or expense" chip waits for `LinkJob` (phase 3); the `linked_*` columns are created now. | "Never ship a broken tab"; no new data beyond spec §3. |
| D4 | Create/edit sheets follow the spec: `presentation: 'formSheet'`. | Spec + CLAUDE.md. See open question Q2. |

| D5 | Until phase 5, an interim `users.measurement_system` → `motorcycles.distance_unit` sync trigger keeps the bike unit equal to the profile unit (plan open question 3). Dropped in the phase 5 migration, together with moving the four API conversion sites to the bike's unit. | Four API conversion sites and ~10 screens still read the profile unit; a diverging bike unit before then is the 1.61× bug again. |
| D6 | Geist Mono and Plus Jakarta Sans are registered under hub-only family names. | They are named in ~130 places but never loaded; registering them under the existing names would restyle the whole app inside this PR. |
| D7 | Plan fallbacks 4, 6–20 accepted as written (see `features/bike-detail-shell-overview/EXECUTION_PLAN.md` › Open questions). Notable: recall row has no "already fixed" fragment and no short title until phase 5; "Link a job" chip and the "recognised part numbers" hint are not rendered; `photo_ids[]` is a `note_photos` link table; spec `at`/`text` columns are `recorded_at`/`body`. | No data beyond spec §3; nearest existing pattern. |
| D8 | Verification route before the production push: local Supabase stack (plan Phase 0). If `supabase db reset` cannot replay 00001–00179, stop and ask the owner to pre-push 00180–00182. | Local API and `pnpm generate:types` both point at the production project today. |

### Constraints found by the Planner

- **Deploy order is hard**: the API selects `distance_unit` in `myMotorcycles` and Render auto-deploys on merge. The PR must not be merged before 00180–00182 are on production, or the garage breaks for every user.
- **Never run `pnpm generate:types` / `pnpm generate` before the push** — they read the linked production schema and would drop the new tables from `database.types.ts`. Use `supabase gen types --local` and the per-package codegen scripts.
- 00181 adds a trigger that runs inside every production odometer write (ride end, receipt scan, manual). Its body swallows its own errors so a failed log row cannot fail a ride end.
- The i18n ratchet (`pnpm check:i18n`, pre-push + CI) requires every new key in all 13 locale files.

### Open questions for the owner

- **Q1 — `pnpm precheck` cannot be green locally** while `outputs/play-release-3.20.0/release-notes-3.20.0.json` is unformatted (Biome scans it). Until it is formatted, moved or ignored, step 7 is verified as: every `check:*` script + Biome on everything except that file + typecheck + test.
- **Q2 — formSheet vs fullScreenModal.** An earlier preference was `fullScreenModal` for dark-themed modals (duplicate-content issue with formSheet). The spec says formSheet; phase 1 follows the spec. Visual QA checks the new sheets for the duplicate-content problem.
- **Q3 — per-bike unit vs per-user unit.** After D1 the profile-level unit only seeds new bikes and converts Home totals. Confirm that is the intended end state.
- **Q4 — screenshots are gitignored**, so the audits' image references resolve only on this machine.

### Step log

- 2026-10-02 · step 1 Read — done (spec §1–§5, 7 phase screens, IA code audit).
- 2026-10-02 · step 3 Branch — done early (`feat/bike-detail-shell-overview` from `main` @ `965ad1de`) to carry the design-library commit.
- 2026-10-02 · step 2 Plan — done. `features/bike-detail-shell-overview/EXECUTION_PLAN.md` (plan phases 0–7, 22 open questions with fallbacks). Checked against the 7 screens and spec §1–§3; decisions D5–D8 added.
- 2026-10-02 · step 4 Data — Data agent dispatched for plan phases 0–2 (local stack, migrations 00180–00182, types, Zod, API, `.graphql`).

- 2026-10-02 · step 4 Data — **blocked on a verification database.** The migration folder does not replay on an empty database: `00093` needs `earthdistance` before `00094` creates it (worked around locally with an untracked `supabase/roles.sql`), and `00097` fails for real (`CREATE OR REPLACE VIEW public_profiles` inserts `handle` mid-list, SQLSTATE 42P16). 00098–00179 untested. Host disk has ~2 GB free; the Data agent deleted `apps/web/.next/dev` and `apps/web/.next/cache` (regenerable) and the Supabase studio/logflare/vector/edge-runtime images it had just pulled to make room. Data agent continues with everything that needs no database (migration SQL, Zod, API, `.graphql`); `database.types.ts` and codegen wait. Owner asked to choose the route (see Q5).

- 2026-10-02 · step 4 Data — **STOPPED, machine needs the owner.** Disk is full (296 MB free): Supabase image pulls grew `Docker.raw` to 13 GB, including a second image set pulled by mistake from a scratch workdir. Docker Desktop's VM crashed on the disk-full error and `com.docker.backend` (pid 21652) is hung; not force-killed, because the owner's `iqor-leads-crm-postgres` containers were running when it died. After a Docker restart, `docker rmi $(docker images -q 'public.ecr.aws/supabase/*')` returns ~8–9 GB (all pulled in this session).
  - Committed: `2397f28b` migrations 00180–00182 (hand-reviewed, **no probe run**), `36c8715d` Zod + limits (types tests 136 pass).
  - Uncommitted in the working tree (API typecheck red by exactly 2 errors until `database.types.ts` has `distance_unit`): motorcycles `distanceUnit`, `apps/api/src/modules/{odometer,notes}/`, `app.module.ts`, `schema.graphql`, 10 new + 2 edited mobile `.graphql` documents, `query-keys.ts`, regenerated `packages/graphql`, `features/bike-detail-shell-overview/data-verification.md` (probes, NOT RUN), untracked `supabase/roles.sql`.
  - Tests: api 917 (was 846), web 266, mobile 77 suites, all pass; five `check:*` pass; Biome clean on touched files.
  - Deviations to review in the PR: `note_link_is_own()` helper in 00182 (soft-deleted linked task would otherwise block note edits); 00181 changes `set_mileage_updated_at` so an explicit stamp wins; `createNote` + `alsoCreateTask` returns the note unlinked if task creation fails; task notes cut at 2,000 chars.
  - `.env` files unchanged (still production). **Do not run the API from this branch against production**: `myMotorcycles` selects `distance_unit`, which does not exist there.
  - Resume at: free disk → Docker back → owner's Q5 choice → run the probes in `data-verification.md` → generate `database.types.ts` → commit the API slices → plan Phase 3.

- 2026-10-02 · disk freed to 16 GB (npm cache, pnpm store prune, CocoaPods cache, unavailable simulators, duplicate Supabase images); Docker relaunched, owner's containers healthy.
- 2026-10-02 · owner said "continue with implementation" without picking a Q5 route. Lead chose route 2 (patched scratch copy), the only one that needs no production access, with a fidelity gate: types generated from the scratch DB before 00180–00182 must equal the committed `database.types.ts`. Data agent resumed on that; Mobile implementer dispatched in parallel for plan Phases 3–4 (foundations + shell). Device checks wait for the scratch stack.

- 2026-10-02 · step 4 Data — **done** (plan Phases 1–2 + Task 0.2). Scratch stack `mvscratch` running (one clean replay of 00001–00182; 00097, 00098, 00102 patched in the scratch copy only). Fidelity: identical to the committed types on every table this phase touches; 28 differences elsewhere (11 generator dialect, 17 real production-vs-folder drift, listed in `features/bike-detail-shell-overview/data-verification.md`). All probes for 00180–00182 and the API round-trips pass. One defect found and fixed (`63185755`: initial reading of 0). `database.types.ts` = committed file + scripted delta of 163 lines (`0826a283`); **after the production push `pnpm generate:types` must give a zero diff, else commit the generator output.** Commits `2397f28b`…`41e362b1`. typecheck 4/4, tests green (types 136, web 266, api 75 files, mobile 80 suites / 1,164).
  - Before the push, run the four read-only production queries listed in `data-verification.md` (column grants on `motorcycles`, live `set_mileage_updated_at`, live task/expense policies, `current_mileage` default).
  - Local run: `features/bike-detail-shell-overview/local-stack.md`. Users `qa-metric@local.test` (Africa Twin km + empty Ténéré) and `qa-imperial@local.test` (miles copy). `pnpm dev` cannot start the API here (`node_modules/.bin` not executable); the doc has the node command. The scratch workdir is under `/private/tmp` and does not survive a reboot; rebuild steps are in the doc. `.env` files untouched (production).
  - Recalls cannot be seeded (live NHTSA); seeded documents have no files.

- 2026-10-02 · step 5 Implement — plan Phases 3–4 **done** (`e962d3b9`, `092ec53d`, `49286d83`, `839e2c95`, `246b4b5d`): pure logic + 75 tests, copy in 13 locales, palette tokens, hub fonts, UI primitives, `BikeHeader`, `SegmentBar`, shell, interim segments; `[id].tsx` is now 31 lines. typecheck 4/4, mobile 85 suites / 1,215 tests, all `check:*` + `check:i18n` pass. **No device check run yet.** New dev deps: `@testing-library/react-native@14`, `test-renderer`. Known for the PR: Service/Costs/Bike tabs follow the system scheme (light possible) until their phases; Android tabs are plain RN (no Compose tab row); tab-bar clearance is a constant (custom floating tab bar has no height hook); translations are not native-reviewed.
- 2026-10-02 · step 5 Implement — plan Phases 5–7 dispatched (Overview, Log/Odometer/Note sheets, Notes screen, undo, deep links, Maestro files).

### Q5 — verification database (route 2 in use; routes 1 and 3 remain the owner's call)

1. Schema-only dump of production loaded into a local Postgres (read-only on production; most faithful).
2. Scratch copy of the migrations folder with unreplayable old files patched in the copy only (approximate schema; unknown number of files after 00097).
3. Owner pushes 00180–00182 to production unverified (they are additive, but 00181 adds a trigger on every odometer write).

## Baseline typecheck/test

`main` @ `965ad1de`, 2026-10-02: `pnpm typecheck` green (4/4 tasks). `pnpm test` green — types 111, web 266, api 846, mobile 1,089 tests (77 suites).
