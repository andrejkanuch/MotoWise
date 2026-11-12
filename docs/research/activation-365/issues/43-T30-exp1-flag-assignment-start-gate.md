---
title: "[#365 T30] Exp 1: flag activation_365_first_session, sticky assignment after the paywall, embedded start/stop gate"
labels: [experiment, area:mobile, area:analytics, activation-365]
order: 43
task_id: T30
depends_on: [T05d, T02]
phase: P3
size: M
release_path: "Release B 3.30.0 (embedded; inactive until EXP1_START_AT and the flag)"
---

## Context
#365, plan §3 T30, §3A.2 (review item 6), spec FS-EXP1, D1 (hooks into `handleContinue`), D13, D16. Board Experiment 1 [SOURCE: board/99-synthesis.md §4].

## Why
`isFeatureFlagOn` is false whenever analytics is off (`lib/feature-flags.ts:18-25`), so pre-consent EEA/UK/CH installs would all be control; the onboarding experiment solves it with a local draw (`lib/onboarding-experiment.ts` header) — which ignores the flag, so "launch = flag flip" is false for pre-consent installs unless a start gate exists. For `garage_first`, `onboarding_completed` fires before the paywall; the cold-start branch completes without `handleContinue` (`app/(onboarding)/personalizing.tsx:366-371` vs `:389-393`) [SOURCE: R4 §3.4].

## What to change
`lib/activation-experiment.ts` mirroring `lib/onboarding-experiment.ts:13-40, 67-71`, plus `config/activation.ts` constants `EXP1_START_AT` (D16) and `EXP1_STOP_AT = '2027-03-31'`:
- outside [start, stop) → `control`, `source:'pre_start'|'post_stop'`, **no exposure event, no local draw**;
- inside: PostHog multivariate if it answers (`posthog`); flag off/unknown → `control` (kill switch); cannot ask → uniform local draw (`local`).
Sticky `activationArm/AssignedAt/Source/ExposurePending` in `stores/experiment.store.ts:20-68` (version 1 → 2). Assign in one `completeOnboardingAndAssign()` called from `handleContinue` **and** the cold-start branch, only for riders with no real ride; `activation_exposure {experiment, arm, source, onboarding_variant, notifications_granted}` + super property `activation_arm`; pending exposure flushed on consent. Ledger: "local-draw riders can only be stopped by an OTA".

## How
Jest `lib/__tests__/activation-experiment.test.ts`: each source path; before start → control, no exposure; after stop → control; stickiness across relaunch and sign-out; no re-roll; exposure once; pre-consent flush; assignment after the garage_first paywall; 10,000-draw SRM simulation.

## Acceptance criteria
- [ ] Jest passes; `onboarding-paywall-verify.yaml` both arms green; ledger date (D1) and D13/D16 signed.
- [ ] Crossed (factorial) with `onboarding_paywall_2026q4` and `expd7c1d56904`, never nested (test).

## Verification
`pnpm --filter @motovault/mobile test -- activation-experiment`.

## Friction spec
FS-EXP1 (assignment). Repro: pre-consent EEA install of Release B before `EXP1_START_AT`. Expected: control, no exposure. Automated check: jest (CI) (fake clock before/after start); maestro `first-ride-plan-card.yaml` in T32.

## Production metric
Exposure by arm × `onboarding_variant` × platform (verbatim `R4…:455-461`); SRM χ² weekly per platform × region; exposure count ≈ completers after start. Tile "FS-EXP1 — exposure and SRM". Annotate the launch (T35).

## Release
Embedded in Release B; active only after start date + flag (T35).

## Dependencies
- Blocked by: T05d, T02.
- Blocks: T31, T32, T34, T35.

## Out of scope
Arm content (T31, T32, T34).

## Constraints
Paywall A/B untouched; D1, D13, D16; no start after 2027-01-06.
