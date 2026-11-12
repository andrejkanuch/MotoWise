---
title: "[#365 T41] Post-slot candidates and replay re-run per fix level"
labels: [research, area:analytics, activation-365]
order: 56
task_id: T41
depends_on: [T35]
phase: P4
size: S
release_path: "research; any new Replay Vision scan needs owner approval"
---

## Context
#365, plan §3 T41, coverage table (P05.3, P05.2 plate, day-1 nudge slot, P04.3a).

## Why
Friction did not separate returners in 100 replays [SOURCE: R6 §3.1]; after the fixes ship, the comparison should be repeated per `activation_fix_level`.

## What to change
Queue in order: P05.3 install-reason card, P05.2 plate "Set up service plan", day-1 nudge own slot (only if Exp 1 wins), P04.3a iOS provisional. Re-run the R6 returner comparison on ~100 first sessions per level (owner approves any scan).

## How
Existing replays first; new scans only with owner approval.

## Acceptance criteria
- [ ] Ranked queue with evidence; re-run result per level in `experiments.md`.

## Verification
Owner review.

## Friction spec
All PO*/OB* (re-check). Automated check: n/a (research).

## Production metric
Per-level friction counts from replays vs the R6 baseline (paywalls 2/16 vs 10/84; ride attempts 3/16 vs 13/84) [SOURCE: R6-q1/q2].

## Release
Research.

## Dependencies
- Blocked by: T35 (and T40 for candidates).
- Blocks: —

## Out of scope
Building candidates.

## Constraints
No Replay Vision scan without owner approval.
