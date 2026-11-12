---
title: "[#365 T35] Release B: store 3.30.0 (activation_fix_level 3) and Experiment 1 launch"
labels: [experiment, area:mobile, area:analytics, activation-365]
order: 48
task_id: T35
depends_on: [T02, T05c, T05d, T09, T10, T18, T30, T31, T32, T33, T34]
phase: P3
size: S
release_path: "store builds both platforms; PostHog flag 50/50 (D2); start = server window set on the D16 day"
---

## Context
#365, plan §3 T35, §3A.0, §6, D2, D13, D14 (target submit 2026-12-08), D16. Latest start 2027-01-06 [SOURCE: board/99 D7].

## Why
Exp 1 assignment happens in the first session, so it must be embedded [SOURCE: R3 RC-2]; P2 fixes reach new riders only in a binary.

## What to change
- **Scope.** Hard dependencies are the Exp 1 minimum set only: T02, T05c, T05d, T09, T10, T18, T30, T31, T32, T33, T34. **Code freeze 2026-12-05.** P2 tasks (T19a, T19b, T20, T21, T22, T24, T25b, T26, T28) that are merged by the freeze ship in 3.30.0; any that miss it go into the next store build (D17). T27 and T29 ship in 3.30.0 if merged by the freeze, otherwise in the first binary after the slot, so D12 ("before the slot", never inside it) holds. The dates need about 2 merged PRs per day (parallel agents).
- The T30 API part (`activationExperimentWindow` on the `completeOnboarding` result) is deployed and live before the 3.30.0 cut.
- Cut commit: `version: '3.30.0'`; `ACTIVATION_FIX_LEVEL = 3`; plan §6/§6.1 (§6.1 is the only record of which spec ships at which level).
- E2E as T18 plus `first-ride-plan-card.yaml`, `ride-standstill-teaching.yaml` in both arms, `onboarding-paywall-verify.yaml` both arms.
- Ledger signed (D13); the implementing agent creates flag `activation_365_first_session` 50/50, no targeting, from the named PostHog write list (D2), id recorded in §6.
- Launch on the D16 day (3.30.0 serves ≥ 90% of new installs on both platforms, not later than 2027-01-06): set the start server-side (`activationExperimentWindow` start value + Render deploy) and flip the PostHog flag the same day. No other step is needed for pre-consent riders. Ledger: T27/T29 both-arm rows with their dates.

## How
`docs/runbooks/mobile-release.md` + T03a section. If 3.30.0 adoption lags, leave the server window unset; if it is not reached by 2027-01-06, the slot does not start this season (D16) and the embedded ceiling blocks any later start.

## Acceptance criteria
- [ ] Both binaries live; annotations per platform `#365 fixes: <plat> 3.30.0 lvl 3 — <spec ids>` and `#365 Exp1 launch 3.30.0 lvl 3`.
- [ ] Flag created (id in §6); server window set on the D16 day; first `activation_exposure` events only after that start.
- [ ] FS-M binary rule: 100% of 3.30.0 opens carry level 3, checked 3 days after go-live per platform.

## Verification
Daily: Miller counts (ship if T − C ≥ 16; stop no-winner at T + C = 64); weekly SRM per platform × region; crash rate by arm.
`SELECT toString(properties.arm) arm, toString(properties.source) src, uniq(person_id) FROM events WHERE event='activation_exposure' AND timestamp > now() - INTERVAL 7 DAY AND {EXCL} GROUP BY arm, src`.

## Friction spec
FS-EXP1 launch. Repro: new install after start. Expected: arm drawn, exposure once. Automated check: Maestro both arms (local, both) + jest from T30.

## Production metric
S1 by `activation_arm` (primary), S3 engaged (secondary), FS-PO9 by arm. Baseline S1 Oct 16/127 (12.6%), 3.26.0 8/84 [SOURCE: board/99 §4; Q-P5]. Rule: Miller N = 64 + one one-sided z-test at the cap 2027-03-31 (board power 0.76 for ×2 at 12.6%, 2.1 completers/day [SOURCE: board/99 App. B]).
Power by start date (approximate: two-proportion one-sided z-test at the cap, α = 0.05, 2.1 completers/day split 50/50, ×2 effect; the Appendix B simulation was not rerun):
| Start | Days to cap | Per arm | Power at 12.6% | Power at 9.5% |
|---|---|---|---|---|
| 2026-12-15 | 106 | ≈ 111 | 0.78 | 0.65 |
| 2027-01-06 | 84 | ≈ 88 | 0.69 | 0.56 |
A capped no-winner means "no doubling shown", not "no effect".
Reading rule for the P2 fixes in this binary (plan §0): iOS same-weeks version comparison is n/a for first-session cohorts (new App Store installs always get the newest version); harm checks in November–March are judged against a concurrent comparison, which after the start is the Exp 1 control arm (Android staged-rollout cohort before it); a trailing-8-week drop alone is recorded "no verdict (season)" and never triggers a revert. Dashboard "#365" + Exp 1 tiles. Annotate in PostHog.

## Release
Store builds (owner go-ahead per runbook) + flag + server window on the D16 day.

## Dependencies
- Blocked by: T02, T05c, T05d, T09, T10, T18, T30, T31, T32, T33, T34 (Exp 1 minimum set). P2 tasks join if merged by the 2026-12-05 freeze; they never block the cut.
- Blocks: T40, T41.

## Out of scope
Readout (T40).

## Constraints
Paywall A/B and RC experiment untouched; Europe + Americas only; light/dark checked per UI task.
