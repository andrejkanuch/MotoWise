---
title: "[#365 T35] Release B: store 3.30.0 (activation_fix_level 3) and Experiment 1 launch"
labels: [experiment, area:mobile, area:analytics, activation-365]
order: 48
task_id: T35
depends_on: [T18, T19a, T19b, T20, T21, T22, T24, T25b, T26, T27, T28, T29, T30, T31, T32, T34]
phase: P3
size: S
release_path: "store builds both platforms; PostHog flag 50/50 (owner, D2); start at EXP1_START_AT"
---

## Context
#365, plan §3 T35, §3A.0, §6, D2, D13, D14 (target submit 2026-12-08), D16. Latest start 2027-01-06 [SOURCE: board/99 D7].

## Why
Exp 1 assignment happens in the first session, so it must be embedded [SOURCE: R3 RC-2]; P2 fixes reach new riders only in a binary.

## What to change
- Cut commit: `version: '3.30.0'`; `ACTIVATION_FIX_LEVEL = 3`; `ACTIVATION_FIXES` entries for P2 specs at 3; `EXP1_START_AT` per D16; plan §6/§6.1.
- E2E as T18 plus `first-ride-plan-card.yaml`, `ride-standstill-teaching.yaml` in both arms, `onboarding-paywall-verify.yaml` both arms.
- Owner signs the ledger (D13), creates flag `activation_365_first_session` 50/50, no targeting.
- Launch when 3.30.0 serves ≥ 90% of new installs on both platforms and the start date is reached. Ledger: T27/T29 launch-day both-arm rows.

## How
`docs/runbooks/mobile-release.md` + T03a section. If 3.30.0 adoption lags, move `EXP1_START_AT` by OTA to the 3.30.0 runtime (before any local draw happens).

## Acceptance criteria
- [ ] Both binaries live; annotations per platform `#365 fixes: <plat> 3.30.0 lvl 3 — <spec ids>` and `#365 Exp1 launch 3.30.0 lvl 3`.
- [ ] Flag created by the owner; first `activation_exposure` events only after the start date.

## Verification
Daily: Miller counts (ship if T − C ≥ 16; stop no-winner at T + C = 64); weekly SRM per platform × region; crash rate by arm.
`SELECT toString(properties.arm) arm, toString(properties.source) src, uniq(person_id) FROM events WHERE event='activation_exposure' AND timestamp > now() - INTERVAL 7 DAY AND {EXCL} GROUP BY arm, src`.

## Friction spec
FS-EXP1 launch. Repro: new install after start. Expected: arm drawn, exposure once. Automated check: Maestro both arms (local, both) + jest from T30.

## Production metric
S1 by `activation_arm` (primary), S3 engaged (secondary), FS-PO9 by arm. Baseline S1 Oct 16/127 (12.6%), 3.26.0 8/84 [SOURCE: board/99 §4; Q-P5]. Rule: Miller N = 64 + one one-sided z-test at the cap (power 0.76 for ×2 at 12.6%, 2.1 completers/day [SOURCE: board/99 App. B]). Dashboard "#365" + Exp 1 tiles. Annotate in PostHog.

## Release
Store builds + flag; owner go-ahead.

## Dependencies
- Blocked by: T18, T19a, T19b, T20, T21, T22, T24, T25b, T26, T27, T28, T29, T30, T31, T32, T34.
- Blocks: T40, T41.

## Out of scope
Readout (T40).

## Constraints
Paywall A/B and RC experiment untouched; Europe + Americas only; light/dark checked per UI task.
