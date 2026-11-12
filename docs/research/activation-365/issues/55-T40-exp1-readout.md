---
title: "[#365 T40] Experiment 1 readout and ship/revert (stratified, pre-registered)"
labels: [experiment, area:analytics, activation-365]
order: 55
task_id: T40
depends_on: [T35]
phase: P4
size: S
release_path: "decision; revert = flag off + server window cleared (no new draws); bundle removed in the next store binary"
---

## Context
#365, plan §3 T40, spec FS-EXP1, D13 [SOURCE: board/99 §4]. Analysis pre-registered after the validation of 2026-11-12 (`validation/V2-returners.md` §5.1, plan §5 FS-EXP1, §11); D13 implementation note in plan §3A.3 / §9.

## Why
Exp 1 is the only randomized read of whether first-session work moves week-1 core action. The returner analysis (V2) shows the target behaviour is right — starting a ride on day 0 separates day-2 returners most (35% vs 10%, adjusted OR 4.5) — but cannot show that causing a ride start causes return; this test can. It also shows S1 is split sharply by goal (`track_rides` 24% vs other goals 8%; 77% of S1 events), that 21 of 367 completers are reinstalls of existing accounts, and that October completers returned at half the Aug–Sep rate.

## What to change
When a Miller boundary fires or at the cap 2027-03-31:
- **Primary (pre-registered):** S1 (core action within 7 d of the first `onboarding_completed`) by `activation_arm`, **one one-sided test at the cap, stratified (Mantel–Haenszel) on goal `track_rides` vs other × platform** (both from T30's `activation_exposure`, set before assignment), with the MH risk difference and its 90% interval. **Keep rule (D13):** keep the bundle if the 90% lower bound of (test − control) is > −3 pts, else revert.
- **`returning_account` riders** (first auth = sign-in to an existing account) are **excluded from the primary** and reported separately.
- **One pre-specified subgroup:** `track_rides` (where an effect should show first). No other subgroup is read as a result.
- **`maintain_bike` riders** are read on S1 and days 7–13 return, never on S3 (they return on days 7–13, 7/65, not day 2, 3/72).
- Secondary: S3 engaged (calendar-day form; randomization cancels the install-hour bias), FS-PO9 by arm, d1-fallback opens (T34). Qualitative signals (replays, revocations, support mail, any install-reason answers) are reported beside the decision but do not gate it.
- Effect is stated as an **absolute lift**. Expected power (normal approximation, one-sided α = 0.05, 2.1 completers/day split 50/50, ≈ 6% removed as `returning_account`): start 2026-12-15 (≈ 104/arm) +8 pts → 0.52 at a 9.5% baseline, 0.46 at 12.6%; +10 pts → 0.66 / 0.60; start 2027-01-06 (≈ 83/arm) +8 pts → 0.45 / 0.40; +10 pts → 0.57 / 0.52. 80%-power MDE ≈ +12.5 to +15.5 pts. A capped no-winner means **"no large lift shown"**, not "no effect". Cut the readout at every both-arm change date in the ledger (incl. T27/T29 rows, Exp 2 deploy, any install-reason card).
- **Follow-up (ledger, plan §10):** after the readout, decide the default week-1 message for all riders (control and post-slot), using the d1-fallback read and the T33 result.

## How
HogQL by `activation_arm` (exposure-based cohort) with `primary_goal`, `returning_account` and person-level platform (plan §0 `{REL}`); MH computed from the 2 × 2 × 4 table (a short script checked into `queries/fs/fs-exp1-readout.sql` + notes); write the readout in `experiments.md`.

## Acceptance criteria
- [ ] Readout with counts per stratum, the MH estimate and 90% interval, the unstratified estimate beside it, SRM checks, `returning_account` reported separately, the `track_rides` subgroup, ledger cuts, the keep rule applied as written, qualitative signals listed separately; decision recorded; PostHog annotation `#365 Exp1 readout`.
- [ ] Ledger line for the week-1 message follow-up updated with the readout's numbers.

## Verification
S1 by arm: `… WHERE event='activation_exposure' …` cohort joined to core actions within 7 d (T02 SQL file); a second agent re-runs the SQL and the MH script and gets the same numbers.

## Friction spec
FS-EXP1 readout. Automated check: none (analysis); the second-agent re-run above.

## Production metric
S1 by arm (primary, stratified), S3 engaged (secondary), FS-PO9 by arm. Baselines: completion-anchored S1 37/275 (13.5%), 3.26.0 8/84; strata 47/197 vs 14/170 [SOURCE: V1-q7; V2-q5]; the control arm is the concurrent baseline. Target: an absolute lift, not a forecast.

## Release
Decision; revert path documented.

## Dependencies
- Blocked by: T35.
- Blocks: T41 (closed; ledger), the week-1 message follow-up (ledger).

## Out of scope
New experiments; any subgroup beyond `track_rides`.

## Constraints
No start after 2027-01-06; stop by 2027-03-31; the analysis is fixed before the first exposure (pre-registration in `experiments.md` by T02).
