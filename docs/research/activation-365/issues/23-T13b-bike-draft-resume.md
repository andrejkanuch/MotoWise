---
title: "[#365 T13b] Persist the bike draft and resume to the last viewed screen"
labels: [bug, area:mobile, activation-365]
order: 23
task_id: T13b
depends_on: [T13a, T04c]
phase: P1
size: M
release_path: "Release A 3.29.0"
---

## Context
#365, plan §3 T13 (split b), spec FS-OB1c, D1.

## Why
bike-setup keeps make/model search in component state; resume targets the screen after the last completed one (`config/onboarding.ts:577-583`). Completion after resume: **bike-setup 7/27 (26%)** [SOURCE: R1 RC-C, Q13].

## What to change
Fill `bikeDraft {makeId, make, modelQuery, year}` (type from T13a's v10) while on bike setup; resume targets the last *viewed* screen (`lastViewedScreen` from T04b) when it has a draft; restore make selection and query.

## How
Files `app/(onboarding)/bike-setup.tsx`, `components/onboarding/bike-setup/make-grid.tsx`, `config/onboarding.ts`. Jest: resume target never earlier than last viewed; draft restored. Maestro `onboarding-bike-resume.yaml` (Android emulator with "Don't keep activities" ON).

## Acceptance criteria
- [ ] Red run on main (make lost after relaunch), then green on Android emu.
- [ ] Jest passes; `pnpm verify:mobile`; ledger date (D1).

## Verification
`pnpm --filter @motovault/mobile test:e2e:onboarding-bike-resume` (local, Android emu).

## Friction spec
FS-OB1c. Repro: Android emulator, bike setup: pick brand, type model → kill → relaunch. Expected: bike setup with the brand selected; never a screen before the one left. Automated check: maestro (local, Android) shared steps to bike setup → select make → `stopApp` → `launchApp` (no clearState) → `assertVisible` the make chip. Red first.

## Production metric
Completion after `onboarding_resumed` by `resume_target` (verbatim `deep-dives/R1-onboarding-reset.md:268-276`) + `{REL}`. Baseline bike-setup 7/27, account 5/15 [SOURCE: R1 Q13]. Target ≥ 50% each after ≥ 15 resumes per target on lvl ≥ 2. Tile "FS-OB1c — completion after resume". Annotate Release A.

## Release
Release A; `FS-OB1c: 2`.

## Dependencies
- Blocked by: T13a, T04c.
- Blocks: T18.

## Out of scope
Search behaviour (T25b).

## Constraints
D1; no paywall change.
