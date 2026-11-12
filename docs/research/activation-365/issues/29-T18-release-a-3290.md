---
title: "[#365 T18] Release A: store binary 3.29.0 \"#365 fixes A\" (iOS + Android), activation_fix_level 2"
labels: [enhancement, area:mobile, area:analytics, activation-365]
order: 29
task_id: T18
depends_on: [T01, T04a, T04b, T04c, T05a, T05b, T05c, T05d, T07b, T08, T09, T10, T11, T12, T13a, T13b, T14, T15, T16a, T16b, T17]
phase: P1
size: S
release_path: "store builds 3.29.0 per docs/runbooks/mobile-release.md (both platforms), owner go-ahead; Android also promotes the FCM config (PR #393); first release of the P0 instrumentation (D17)"
---

## Context
#365, plan §3 T18, §3A.0 rules 1–2, §6, §6.1, D14 (target submit 2026-11-30), D17 (owner rule 2026-11-12: new functionality ships only in store builds; TR0 removed).

## Why
A new rider's first session runs the embedded JS [SOURCE: R3 RC-2]; every first-session fix must be in the binary. 4 of 5 3.26.0 limit riders hit the bug on their install launch [SOURCE: R3 Q13].

## What to change
- Cut commit: `version: '3.29.0'` in `apps/mobile/app.config.ts:37`; `ACTIVATION_FIX_LEVEL = 2`; plan §6 and §6.1 rows (§6.1 is the only record of which spec ships at which level; status `shipped` on go-live).
- Release A is the **first release of the P0 instrumentation** (D17; TR0 removed by D17): T01 release marker, T04a–c, T05a–d events and properties, incl. T05c's ride-guard event properties, guard-sheet render change (buttons in the a11y tree) and its testIDs.
- Pre-promotion E2E (local, both platforms): `onboarding-paywall-verify.yaml` both arms (runbook), `onboarding.yaml`, and every flow from T07b–T17; links in the release PR.
- Release notes list task and spec ids.

## How
Follow `docs/runbooks/mobile-release.md` and the #365 section (T03a). Nothing in this release ships by OTA (D17). A later fix ships in the next store build; an OTA only for an urgent crash or data-loss hotfix per `docs/runbooks/mobile-ota.md` (D14b, D17).

## Acceptance criteria
- [ ] Both binaries in production; per-platform annotations `#365 fixes: ios 3.29.0 lvl 2 — <spec ids>` and `android …` on their go-live days.
- [ ] FS-M binary rule: 100% of 3.29.0 opens carry level 2 (checked 3 days after go-live per platform; any mismatch = wrong cut); first `is_embedded_launch=true` events with level 2.
- [ ] Go-live date per platform recorded in plan §6: it is the start of every client-event baseline (FS-OB* first-session and post-onboarding) and of the T14b, T15b, T36 and T38 gate windows, because the P0 instrumentation first ships in 3.29.0 (D17).
- [ ] Ledger: both-arm changes of this binary dated.

## Verification
`SELECT lower(coalesce(toString(properties.platform), toString(properties.$os))) plat, toString(properties.activation_fix_level) lvl, count() FROM events WHERE event='Application Opened' AND toString(properties.$app_version)='3.29.0' AND timestamp > now() - INTERVAL 7 DAY AND {EXCL} GROUP BY plat, lvl`.

## Friction spec
FS-PO3b. Repro: install a binary built before a JS fix, publish the fix as OTA, complete onboarding in one launch → fix absent. Expected: first-hour fixes embedded. Automated check: E2E suite on the release build (local, both) + manual release-checklist line "first-session fixes are embedded".

## Production metric
FS-PO3b (verbatim `R3…:425-435` + `is_embedded_launch`) baseline 4 of 5 [SOURCE: R3 Q13] → 0. Every friction tile read at 2/4/8 weeks: level 2 vs earlier versions (`lvl` null, read by `ver`; level 1 is not used, D17), per platform, recorded in `experiments.md` and §6.1. Annotate per platform in PostHog.
- **Reading rule (plan §0, §1.2).** Mechanical metrics: counts on level 2. Harm checks: on iOS the same-weeks version comparison is n/a for first-session cohorts (new App Store installs always get the newest version); on Android compare with the staged-rollout cohort still on the older binary in the same weeks. Because this release's 2/4/8-week windows fall in November–March, a harm check is judged only against that concurrent comparison (before the Exp 1 slot) or the Exp 1 control arm (after it starts); a drop against the trailing 8 weeks alone is recorded "no verdict (season)" and never triggers a revert.
- FS-OB* and post-onboarding metrics: the new events exist from 3.29.0 go-live per platform; the pre-fix comparison is the R1/R5 proxy SQL on earlier versions.

## Release
Store builds 3.29.0, staged rollout per runbook; owner go-ahead. No OTA (D17).

## Dependencies
- Blocked by: T01, T04a, T04b, T04c, T05a, T05b, T05c, T05d, T07b, T08, T09, T10, T11, T12, T13a, T13b, T14, T15, T16a, T16b, T17.
- Blocks: T35, T14b, T15b, T36, T38.

## Out of scope
P2 tasks (Release B).

## Constraints
Onboarding paywall E2E both arms before promotion; no India targeting in store settings; light/dark verified per UI task.
