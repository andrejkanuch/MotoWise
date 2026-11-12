---
title: "[#365 T19a] Android Back steps once and leaves onboarding instead of rewinding it"
labels: [enhancement, area:mobile, activation-365]
order: 30
task_id: T19a
depends_on: [T00, T04b]
phase: P2
size: M
release_path: "Release B 3.30.0, in the same build as T20 (if T20 misses the freeze, T19a waits too)"
---

## Context
#365, plan §3 T19 (split a), §3A.0 rule 8, spec FS-OB1b, D1, D9. Validated on device 2026-11-12 (`validation/V4-device-repro.md` (a)/(b), plan §11).

## Why
No `BackHandler` in `app/(onboarding)` or `components/onboarding`; Back pops one screen per press down to Welcome (`app/(onboarding)/_layout.tsx:42-64`). Android **28/201 (13.9%)** starters made ≥ 3 back steps ≤ 5 s apart, 4 completed (60 d, `$screen` method) [SOURCE: V1-q15; R1 Q8 had 25/187]; replays call it "the app reset" [SOURCE: R1 RC-B, Q9].
**Reproduced on the store binary 3.28.0 (V4, RC-B ~90%):** one screen per Back down to Welcome, then Back on the root finishes the activity (b1, b2). After a cold resume, the resumed screen (account, bike-setup) is the stack root, so **Android Back closes the app** while the on-screen chevron goes one step back (a4).
**Coupling (V4 b3):** "only Welcome returns `false`" lets the OS background the app; the next warm launch mounts Welcome fresh in the same JS runtime, where today's module flag skips the resume (RC-D). So T19a ships **only in the same build as T20**.

## What to change
`BackHandler` per step via `hooks/use-onboarding-flow.ts`: one step back via `getPreviousRoute` (`replace`, param `from:'back'`), debounced 400 ms. Ruling D9 (plan §9): **Back on experience → `router.replace` to Welcome with `from:'back'`** (answers kept); **only Welcome returns `false`**, so the OS backgrounds the app (not `exitApp()`); forward after Back keeps answers; the email code step keeps its handler. testIDs `goal-chip-<id>`, `goal-chip-<id>-selected`.

## How
Jest: extend `src/config/__tests__/onboarding.test.ts` for `getPreviousRoute` per variant with/without bike, incl. experience → Welcome; a handler test: on experience the handler returns `true` and calls `router.replace` to Welcome with `from:'back'`; on Welcome it returns `false`. Maestro `onboarding-back-preserves.yaml` (tag `android`) incl. the new case "cold resume to account → Android Back → goals, not the launcher" (`getPreviousRoute` + `replace` also handles a resumed root step). Test on a Samsung too.

## Acceptance criteria
- [ ] Red run on main (rewinds to Welcome), green after; jest passes.
- [ ] Ledger date (D1); D9 ruling implemented (experience → Welcome; only Welcome leaves the app).
- [ ] Cold resume to account → Android Back → goals (not the launcher), red on main.
- [ ] Merged for the same store build as T20 (release PR lists both).

## Verification
`pnpm --filter @motovault/mobile test:e2e:onboarding-back` (local, Android emu).

## Friction spec
FS-OB1b (Android). Repro: Android emulator, gesture nav, T00 Android E2E build (a universal APK of the store binary reproduces it too, V4); to account; Back ×5. Expected: one step per Back, answers kept, no paywall re-present; Back on experience shows Welcome; Back on Welcome backgrounds the app; warm launch resumes at the saved screen. Automated check: maestro (local, Android) → account → `pressKey: back` → `assertVisible: {id: "goal-chip-track_rides-selected"}` → back ×2 → Continue ×2 → account visible → back until experience → back → `assertVisible: "Let's get started"` (Welcome) → back → `assertNotVisible: "Let's get started"` (app backgrounded) → `launchApp` (warm, no clearState) → `assertVisible: ".*How long have you.*|.*bike.*"` (resume screen). Second case: to account → `stopApp` → `launchApp` (cold resume to account) → `pressKey: back` → `assertVisible` goals with the chosen chip (`goal-chip-track_rides-selected`; needs T13b's goals seeding) → `assertVisible` the app is still in the foreground. Red first.

## Production metric
Plan §5 FS-OB1b SQL (revised: `ms_on_screen ≤ 5000`, `trigger IN ('hardware','gesture')`, ≥ 3) by `{REL}`, platform android. Baseline Android 28/201 (13.9%) (`$screen` method, `validation/V1-metrics.md` §3.2) [SOURCE: V1-q15]. Target ≤ 5%; S2 harm check vs trailing 8 weeks. Tile "FS-OB1b — back-walkers". Annotate Release B.

## Release
Release B (lvl 3); the release cut records the level of FS-OB1b in plan §6.1 (no code map).

## Dependencies
- Blocked by: T00 (test environment), T04b.
- Blocks: T20, T35 (soft; together with T20).

## Out of scope
"Leave setup?" dialog (D9: no dialog).

## Constraints
D1, D9; no paywall change.
