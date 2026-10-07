# Prompt — orchestrate the bike-detail redesign with a team of agents

Paste everything below the line into Claude Code, opened at the repo root. Re-run the same prompt to resume: it reads `docs/design/app-screens/05-garage/02-bike-detail/redesign/PROGRESS.md` first and continues from the next unfinished step.

---

You are the tech lead for implementing the MotoVault bike-detail redesign in `apps/mobile` (Expo 57, React Native 0.86, React 19) with the API changes it needs in `apps/api` and `supabase/`. You coordinate a team of subagents and stop at defined checkpoints for me, the human, to review. Follow `CLAUDE.md` in every decision (type pipeline, Supabase client rules, naming, Biome, no TypeScript enums, palette tokens only, Reanimated v4, `borderCurve: 'continuous'`, formSheet presentation, haptics).

## Inputs — read these before anything else

- `docs/design/app-screens/05-garage/02-bike-detail/redesign/DESIGN-SPEC.md` — the implementation spec: structure, rules, data-model additions, screen index, today→new mapping. It is the source of truth when a screen and your memory disagree.
- `docs/design/app-screens/05-garage/02-bike-detail/redesign/screens/*.dc.html` — one file per screen. The markup is the design: copy exact sizes, colours, spacing, copy and link targets from the file for the screen you are building. `screens/canvas.json` maps file → title → row. `<a href="X.dc.html">` is the intended navigation.
- `docs/design/app-screens/05-garage/02-bike-detail/redesign/screens/png/` — reference renders, if present (exported from the canvas). If absent, render a `.dc.html` with headless Chromium at 390×844 to get one.
- `docs/design/app-screens/05-garage/02-bike-detail/claude-design-prompt.md`, `code-audit-information-architecture.md`, `visual-audit.md` — the brief and the audits of today's screens; use them to find the current code for each block.
- `docs/design/app-screens/05-garage/02-bike-detail/redesign/PROGRESS.md` — your own log. Create it on the first run with the phase table below; update it after every step. It is the only memory between runs.

## The team

Spawn these as subagents with the Agent tool; give each one the exact file paths it needs and the Definition of Done for its step. Keep them to one phase at a time.

- **Planner** — reads the spec, the screens of the phase and the current code; produces `features/bike-detail-<phase>/EXECUTION_PLAN.md` via the repo's `/feature-plan` skill: tasks with acceptance criteria, files touched, data-model prerequisites, and the list of screens with their states (empty, one-item, many, miles).
- **Data agent** — only when the phase needs a data-model addition from spec §3: migration in `supabase/migrations/`, RLS, `pnpm generate:types`, Zod in `packages/types`, NestJS model/resolver/service, `.graphql` documents, `pnpm generate`. Never service-role for user-scoped writes; soft deletes through `SECURITY DEFINER` RPCs as CLAUDE.md requires.
- **Mobile implementer** — builds the screens and components in `apps/mobile`, using generated types from `@motovault/graphql`, palette tokens from `@motovault/design-system` (add tokens there if a spec colour is missing — never hardcode hex in a component), Reanimated v4, expo-haptics. Mirrors the `.dc.html` structure: one component per screen file, shared pieces (`TaskRow`, `PriorityTag`, `DueLine`, `SegmentBar`, `BikeHeader`, `ActionPill`, `Stat`, `SectionHeader`, `UndoSnackbar`) in `components/bike-hub/ui/`.
- **Test writer** — uses the repo's `/write-tests` skill: unit tests for the pure logic the spec defines (ride-status rules, attention ranking, due-line formatting in km and mi, task grouping and sort, TCO bucketing, YoY same-period comparison, next-due after completion), plus resolver tests for new API fields. Tests must encode the spec's numbers from the Africa Twin example where they exist (e.g. 201 days late, 3,933 km to target, next due Oct 2 2027 / 50,167 km).
- **Code reviewer** — adversarial review of the diff against the spec and CLAUDE.md before the PR: wrong client (user vs admin), `any` on GraphQL data, hardcoded colours, nested pressables, missing `accessibilityLabel`, touch targets under 44 pt, StyleSheet vs inline rule, i18n strings bypassed, missing empty/loading/error states. Reports findings with file:line and a fix; the implementer applies them; the reviewer re-checks.
- **Visual QA** — starts the API and Expo (`pnpm dev`), boots the iOS simulator (iPhone 15 / 390×844 class), seeds or uses the test account (2022 Honda Africa Twin: 10 active tasks, 4 overdue, 10 completed, 22 expenses this year, 2 recalls), navigates to each screen of the phase in each state the spec lists, captures `xcrun simctl io booted screenshot`, and places it side by side with the reference render in `features/bike-detail-<phase>/visual/`. Reports every visible difference (layout, spacing, colour, copy, missing state, clipped text) as a list; the implementer fixes; repeat up to three rounds, then escalate to me with the remaining diffs. Also runs the Android emulator once per phase for the segment bar (Material tabs), sheets and keyboard avoidance.

You, the lead, never write app code yourself; you plan, dispatch, read reports, decide, and keep `PROGRESS.md` true.

## Phases — in this order, one PR each

| # | Phase | Screens (row in canvas.json) | Data-model prerequisites |
|---|---|---|---|
| 1 | Shell + Overview | `Main`, `OverviewScrolled`, `OverviewEmpty`, `LogSheet`, `OdometerSheet`, `NoteSheet`, `Notes` | `notes`, `odometer_readings`, `motorcycles.distance_unit` |
| 2 | Service segment | `ServiceActive`, `ServiceMiles`, `ServiceReorder`, `ServiceHistory`, `ServiceHistoryLong`, `ServiceDone`, `TaskSelect`, `BulkComplete`, `JobDetail` | `maintenance_tasks.manual_position` |
| 3 | Task flows | `TaskDetail`, `AddTask`, `EditTask`, `CompleteTask`, `LogPastWork`, `LinkJob`, `ImportSchedule` | — |
| 4 | Costs | `Costs`, `CostsScrolled`, `CostsAllTime`, `CostsEmpty`, `AddExpense`, `EditExpense`, `ExpenseDetail`, `AllExpenses`, `CategoryGear`, `MonthAugust`, `ScanReceipt`, `ScanReview`, `CategoryPicker`, `ManageCategories`, `EditCategory`, `TcoExplainer` | `expense_categories.*`, `expenses.odometer/litres/shop/linked_task_id` |
| 5 | Bike segment + recalls | `Bike`, `BikeDetails`, `EditBike`, `DeleteBike`, `AddDocument`, `DocumentDetail`, `Recalls` | `recall_acknowledgements`, `document_categories.blocks_riding` |
| 6 | Cleanup + Home card | `HomeCard`; delete the removed screens and components listed in spec §1 and §5; remove dead code (`health-report`, `HealthScoreRing`, `HealthReportCard`, `bike-stats-row`, `mileage-display`) | — |

Phase 1 also lays the shell every later phase plugs into: header, segment bar, segment container with per-segment scroll and remembered last segment per bike, the labelled action pill, the undo snackbar, origin-aware back label, deep-link landing rule (leaf pushed over its owning segment). Phases 2–5 fill the segments; until a segment is built, its tab shows the existing component wrapped unchanged so the app never ships a broken tab.

## The loop for every phase

1. **Read.** Spec sections for the phase, every screen file listed, the current code for the blocks being replaced (use the audits to find it). Write a short "what changes" summary into `PROGRESS.md`.
2. **Plan.** Planner produces the EXECUTION_PLAN. You check it against the screen list and the spec rules; fix gaps before anyone codes.
3. **Branch.** `git checkout -b feat/bike-detail-<phase-slug>` from an up-to-date `main`.
4. **Data first.** If the phase has prerequisites: Data agent does the migration → types → Zod → NestJS → `pnpm generate`. `pnpm precheck` must be green before the mobile work starts. Push the migration to production only when I say so — until then note it as pending in the PR.
5. **Implement.** Mobile implementer, task by task from the plan, running `pnpm --filter mobile typecheck` as it goes.
6. **Tests.** Test writer adds the tests for the phase; everything passes.
7. **Static verify.** `pnpm precheck` (lint + typecheck + test) green. No `--no-verify`.
8. **Review.** Code reviewer → fixes → re-review until it reports no blockers.
9. **Visual verify.** Visual QA rounds (max three). Attach the final side-by-side PNGs.
10. **PR.** `gh pr create` to `main`, title `feat(mobile): bike detail — <phase>`; body = what changed, screens covered with side-by-side images, data-model changes and whether the migration is pushed, what is deliberately out of scope, how to test on a device. End with the attribution lines the session reminder gives you.
11. **STOP.** Update `PROGRESS.md` (phase = "in review", PR number) and end your turn with a three-line summary and the PR link. Do not start the next phase.
12. **After my review** (I will say "address review on PR N" or just re-run this prompt): read every PR comment and review thread, make the fixes, re-run steps 7–9 for the touched screens, push, reply on each thread with what you did, and stop again. When I say the PR is merged, mark the phase done in `PROGRESS.md`, rebase, and start the next phase from step 1.

## Rules that do not bend

- Scope: only the bike-detail area and the screens reached from it, plus the Home "This month" card in phase 6. Home, Discover, Profile, onboarding and the tab bar are untouched.
- Logging a task, an expense, a note or a document is always free — no paywall, no count gate. The scan quota appears only beside the Scan button inside Add expense.
- No new data beyond spec §3. If a screen seems to need more, note it in `PROGRESS.md` under "Open questions" and build the version that works without it.
- The design files win over the current code's look. When a design file and the spec disagree, the spec wins; when both are silent, follow the nearest existing pattern and note it.
- Never modify generated files, `database.types.ts`, or `.env`. Never commit secrets.
- Every list has empty, loading and error states; every destructive action has undo or a typed confirm as the spec says; every icon-only control has an `accessibilityLabel`; every touch target is ≥ 44 pt.
- One phase per PR. Never carry uncommitted work across phases. Never merge your own PR.
- If a step fails three times (build, simulator, flaky test) stop, write what you tried into `PROGRESS.md`, and ask me.

## First run

If `PROGRESS.md` does not exist: create it with the phase table (status "not started" everywhere), confirm you can open all 48 screen files and the spec, run `pnpm install` and `pnpm precheck` on `main` to record the baseline, and start Phase 1 at step 1.
