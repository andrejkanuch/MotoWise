---
title: "[#365 T19a] Android Back steps once and leaves onboarding instead of rewinding it"
labels: [enhancement, area:mobile, activation-365]
order: 30
task_id: T19a
depends_on: [T04b]
phase: P2
size: M
release_path: "Release B 3.30.0"
---

## Context
#365, plan §3 T19 (split a), spec FS-OB1b, D1, D9.

## Why
No `BackHandler` in `app/(onboarding)` or `components/onboarding`; Back pops one screen per press down to Welcome (`app/(onboarding)/_layout.tsx:42-64`). Android **25/187 (13%)** starters made ≥ 3 back steps ≤ 5 s apart, 2 completed; replays call it "the app reset" [SOURCE: R1 RC-B, Q8, Q9].

## What to change
`BackHandler` per step via `hooks/use-onboarding-flow.ts`: one step back via `getPreviousRoute` (`replace`, param `from:'back'`), debounced 400 ms. Ruling D9 (plan §9): **Back on experience → `router.replace` to Welcome with `from:'back'`** (answers kept); **only Welcome returns `false`**, so the OS backgrounds the app (not `exitApp()`); forward after Back keeps answers; the email code step keeps its handler. testIDs `goal-chip-<id>`, `goal-chip-<id>-selected`.

## How
Jest: extend `src/config/__tests__/onboarding.test.ts` for `getPreviousRoute` per variant with/without bike, incl. experience → Welcome; a handler test: on experience the handler returns `true` and calls `router.replace` to Welcome with `from:'back'`; on Welcome it returns `false`. Maestro `onboarding-back-preserves.yaml` (tag `android`). Test on a Samsung too.

## Acceptance criteria
- [ ] Red run on main (rewinds to Welcome), green after; jest passes.
- [ ] Ledger date (D1); D9 ruling implemented (experience → Welcome; only Welcome leaves the app).

## Verification
`pnpm --filter @motovault/mobile test:e2e:onboarding-back` (local, Android emu).

## Friction spec
FS-OB1b (Android). Repro: Android emulator, gesture nav, preview build; to account; Back ×5. Expected: one step per Back, answers kept, no paywall re-present; Back on experience shows Welcome; Back on Welcome backgrounds the app; warm launch resumes at the saved screen. Automated check: maestro (local, Android) → account → `pressKey: back` → `assertVisible: {id: "goal-chip-track_rides-selected"}` → back ×2 → Continue ×2 → account visible → back until experience → back → `assertVisible: "Let's get started"` (Welcome) → back → `assertNotVisible: "Let's get started"` (app backgrounded) → `launchApp` (warm, no clearState) → `assertVisible: ".*How long have you.*|.*bike.*"` (resume screen). Red first.

## Production metric
Plan §5 FS-OB1b SQL (revised: `ms_on_screen ≤ 5000`, `trigger IN ('hardware','gesture')`, ≥ 3) by `{REL}`, platform android. Baseline 25/187 (13%) [SOURCE: R1 Q8]. Target ≤ 5%; S2 harm check vs trailing 8 weeks. Tile "FS-OB1b — back-walkers". Annotate Release B.

## Release
Release B (lvl 3); the release cut records the level of FS-OB1b in plan §6.1 (no code map).

## Dependencies
- Blocked by: T04b.
- Blocks: T20, T35.

## Out of scope
"Leave setup?" dialog (D9: no dialog).

## Constraints
D1, D9; no paywall change.
