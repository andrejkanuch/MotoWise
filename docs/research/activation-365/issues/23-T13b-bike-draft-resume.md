---
title: "[#365 T13b] Persist the bike draft, seed goals from the store, and resume to the furthest screen reached"
labels: [bug, area:mobile, activation-365]
order: 23
task_id: T13b
depends_on: [T00, T13a, T04c]
phase: P1
size: M
release_path: "Release A 3.29.0"
---

## Context
#365, plan §3 T13 (split b), spec FS-OB1c, D1. Scope widened by the device repro of 2026-11-12 (`validation/V4-device-repro.md` (a), plan §11).

## Why
- bike-setup keeps the make and the model query in component state; resume targets the screen after the last completed one (`config/onboarding.ts:577-583`). Completion after resume: **bike-setup 8/31 (26%), account 5/13 (38%), goals 3/11** (60 d, ordered SQL) [SOURCE: V1-q17; R1 RC-C, Q13 had 7/27 and 5/15].
- **Reproduced on the store binary 3.28.0 (V4, RC-C ~85%):**
  - a1: HONDA picked, "Africa" typed → kill → cold launch lands on bike-setup but on the empty make picker: make and query lost.
  - a3: after a cold resume to account, the on-screen Back to goals shows **"0 of 5 picked"** with Continue disabled. `app/(onboarding)/goals.tsx:77` initializes `selected` to an empty `Set` and never reads the persisted `ridingGoals`; any remount (resume, `replace`, back via `getPreviousRoute`) loses the picks. The picks survive only a back-pop while goals is still mounted.
  - a5: a rider who reached account, walked back to experience and forward to bike-setup resumes at **bike-setup**, not account: moving forward again overwrites `lastCompletedScreen` with an earlier screen, so the furthest point reached is lost.

## What to change
- Fill `bikeDraft {makeId, make, modelQuery, year}` (type from T13a's v10) while on bike setup; restore make selection and query on mount.
- **Goals seeds from the store:** `goals.tsx` initializes `selected` from the persisted `ridingGoals` (and primary goal) instead of `new Set()`, so every remount shows the rider's picks.
- **Resume target = a monotonic `furthestScreen`:** persist `furthestScreen` in the onboarding store, raised on every step view by flow index and **never lowered** by a back-walk; resume goes to `furthestScreen` (screens before it stay reachable by Back, T19a), not to the screen after `lastCompletedScreen`. `lastViewedScreen` (T04b) stays for analytics (`onboarding_resumed.resumed_from_screen`). Fold the new field into T13a's v10 migration if T13a has not merged; otherwise a v11 step with a migration test.

## How
Files `app/(onboarding)/bike-setup.tsx`, `components/onboarding/bike-setup/make-grid.tsx`, `app/(onboarding)/goals.tsx`, `stores/onboarding.store.ts`, `config/onboarding.ts`.
Jest: draft restored; **goals seeds from `ridingGoals`** (render goals with a store holding two goals → both chips selected, Continue enabled); **`furthestScreen` is monotonic** (view account, then experience, then bike-setup → `furthestScreen` = account; resume target = account); resume target never earlier than `furthestScreen`.
Maestro `onboarding-bike-resume.yaml` (Android emulator with "Don't keep activities" ON), two cases: make chip after relaunch; goals chip after a cold resume to account + Back.

## Acceptance criteria
- [ ] Red run on main (make lost after relaunch; goals "0 of 5 picked" after resume + Back), then green on Android emu.
- [ ] Jest passes incl. the goals-seeding and monotonic-`furthestScreen` cases; `pnpm verify:mobile`; ledger date (D1).

## Verification
`pnpm --filter @motovault/mobile test:e2e:onboarding-bike-resume` (local, Android emu; T00 Android E2E build or a universal APK of the main build).

## Friction spec
FS-OB1c. Repro: Android emulator, (a) bike setup: pick brand, type model → kill → relaunch; (c) reach account with 2 goals → kill → relaunch → Back chevron; (d) reach account, walk back to experience, forward to bike-setup → kill → relaunch. Expected: bike setup with the brand selected; goals shows both picks; (d) resumes at account; never a screen before the one left. Automated check: maestro (local, Android) shared steps to bike setup → select make → `stopApp` → `launchApp` (no clearState) → `assertVisible` the make chip; second case → account → `stopApp` → `launchApp` → back chevron → `assertVisible: {id: "goal-chip-track_rides-selected"}` (testID from T19a; if T19a is not merged, assert the "2 of 5 picked" text). Red first.

## Production metric
Completion **after** `onboarding_resumed` by `resume_target` — ordered SQL `validation/V1-metrics.md` §3.3 (R1's SQL at `deep-dives/R1-onboarding-reset.md:268-276` counted completions before the resume) + `{REL}`. Baseline bike-setup 8/31, account 5/13, goals 3/11 [SOURCE: V1-q17]. Target ≥ 50% each after ≥ 15 resumes per target on lvl ≥ 2. Tile "FS-OB1c — completion after resume". Annotate Release A.

## Release
Release A; `FS-OB1c: 2`.

## Dependencies
- Blocked by: T00 (test environment), T13a, T04c.
- Blocks: T18.

## Out of scope
Search behaviour (T25b); Android Back handling (T19a).

## Constraints
D1; no paywall change; never persist the password or the code.
