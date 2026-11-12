---
title: "[#365 T40] Experiment 1 readout and ship/revert"
labels: [experiment, area:analytics, activation-365]
order: 55
task_id: T40
depends_on: [T35]
phase: P4
size: S
release_path: "decision; revert = flag off + OTA disabling local draws (EXP1_STOP_AT)"
---

## Context
#365, plan §3 T40, spec FS-EXP1, D13 [SOURCE: board/99 §4].

## Why
Exp 1 is the only randomized read of whether first-session work moves week-1 core action.

## What to change
When a Miller boundary fires or at 2027-03-31: one-sided two-proportion z-test on everyone enrolled + 90% interval; keep if lower bound > −3 pts and qualitative signals are not negative, else revert. Cut the readout at every both-arm change date in the ledger (incl. T27/T29 launch-day rows, Exp 2 deploy).

## How
HogQL by `activation_arm` (exposure-based cohort); write the readout in `experiments.md`.

## Acceptance criteria
- [ ] Readout with counts, interval, SRM checks, ledger cuts; owner decision recorded; PostHog annotation `#365 Exp1 readout`.

## Verification
S1 by arm: `… WHERE event='activation_exposure' …` cohort joined to core actions within 7 d (T02 SQL file).

## Friction spec
FS-EXP1 readout. Automated check: none (analysis); a second agent re-runs the SQL file and gets the same counts.

## Production metric
S1 by arm (primary), S3 engaged (secondary), FS-PO9 by arm. Baseline control trend; target ×2 is the detectable effect, not a forecast.

## Release
Decision; revert path documented.

## Dependencies
- Blocked by: T35.
- Blocks: T41.

## Out of scope
New experiments.

## Constraints
No start after 2027-01-06; stop by 2027-03-31.
