---
title: "[#365 T18] Release A: store binary 3.29.0 \"#365 fixes A\" (iOS + Android), activation_fix_level 2"
labels: [enhancement, area:mobile, area:analytics, activation-365]
order: 29
task_id: T18
depends_on: [T00, T01, T04a, T04b, T04c, T05a, T05b, T05c, T05d, T07b, T08, T09, T10, T11, T12, T13a, T13b, T14, T15, T16a, T16b, T17]
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
- **T29 (Discover first open) targets this release** (validation V1 FS-PO8: 42/43 Android first Discover visits background within 2 s). If it is merged by the cut it ships here; T18 does not wait for it.
- **Android FCM / vc99 (validation V3 §2, D14):** vc98 (3.28.0) is in Play production, so D14's condition is met, but vc99 is a **draft on the internal track named "3.26.0"** (bundle versionName 3.28.0, commit `52d281e9`, adds only #388 and #393 over vc98) and is not delivered even to internal testers. Steps: (a) rename the release to "3.28.0 (99)"; (b) roll it out to internal and verify on a test device that a push token registers (`push_token_registered` with `platform='android'` and a new `device_push_tokens` row); (c) promote to production **with the owner's go-ahead**. If vc99 is not promoted before the 3.29.0 cut, drop it: FCM ships in 3.29.0 (it is on `main`). FCM itself works: 3 Android tokens already registered from test devices in the last 7 days.

## How
Follow `docs/runbooks/mobile-release.md` and the #365 section (T03a). Nothing in this release ships by OTA (D17). A later fix ships in the next store build; an OTA only for an urgent crash or data-loss hotfix per `docs/runbooks/mobile-ota.md` (D14b, D17). **Hotfix note (V3 §1):** runtime 3.27.0 has never received an OTA; a 3.27.0 crash/data-loss hotfix branches from the store-build commit `2ce57d1d` (iOS b108 / Android vc95), per memory `reference_ota_hotfix_older_runtime`.
**Test environment (T00):** the runbook's pre-promotion `test:e2e:onboarding-paywall` needs a booted iOS simulator (`docs/runbooks/mobile-release.md:12-16`); no iOS runtime was installed on 2026-11-12, and Android flows need T00's `e2e-android` build. The cut cannot be promoted without T00.

## Acceptance criteria
- [ ] Both binaries in production; per-platform annotations `#365 fixes: ios 3.29.0 lvl 2 — <spec ids>` and `android …` on their go-live days.
- [ ] FS-M binary rule: 100% of 3.29.0 opens carry level 2 (checked 3 days after go-live per platform; any mismatch = wrong cut); first `is_embedded_launch=true` events with level 2.
- [ ] Go-live date per platform recorded in plan §6: it is the start of every client-event baseline (FS-OB* first-session and post-onboarding) and of the T14b, T15b, T36 and T38 gate windows, because the P0 instrumentation first ships in 3.29.0 (D17).
- [ ] Ledger: both-arm changes of this binary dated (incl. T29 if it made the cut).
- [ ] vc99 resolved before the cut: promoted (steps a–c above, owner go-ahead, token check logged) or dropped with FCM in 3.29.0; the decision recorded in plan §6.
- [ ] Pre-promotion E2E ran on the T00 iOS simulator and Android E2E build; logs linked.

## Verification
`SELECT lower(toString(properties.platform)) plat, toString(properties.activation_fix_level) lvl, countIf(properties.platform IS NULL) no_plat, count() FROM events WHERE event='Application Opened' AND toString(properties.$app_version)='3.29.0' AND timestamp > now() - INTERVAL 7 DAY AND {EXCL} GROUP BY plat, lvl` (`$os` is never set; T01 makes `platform` non-null on every 3.29.0 open, so `no_plat` must be 0).

## Friction spec
FS-PO3b. Repro: install a binary built before a JS fix, publish the fix as OTA, complete onboarding in one launch → fix absent. Expected: first-hour fixes embedded. Automated check: E2E suite on the release build (local, both) + manual release-checklist line "first-session fixes are embedded".

## Production metric
FS-PO3b (verbatim `R3…:425-435` + `is_embedded_launch`) baseline 4 of 5 [SOURCE: R3 Q13] → 0. Every friction tile read at 2/4/8 weeks: level 2 vs earlier versions (`lvl` null, read by `ver`; level 1 is not used, D17), per platform, recorded in `experiments.md` and §6.1. Annotate per platform in PostHog.
- **Reading rule (plan §0, §1.2).** Mechanical metrics: counts on level 2. Harm checks: on iOS the same-weeks version comparison is n/a for first-session cohorts (new App Store installs always get the newest version); on Android compare with the staged-rollout cohort still on the older binary in the same weeks. Because this release's 2/4/8-week windows fall in November–March, a harm check is judged only against that concurrent comparison (before the Exp 1 slot) or the Exp 1 control arm (after it starts); a drop against the trailing 8 weeks alone is recorded "no verdict (season)" and never triggers a revert.
- FS-OB* and post-onboarding metrics: the new events exist from 3.29.0 go-live per platform; the pre-fix comparison is the R1/R5 proxy SQL on earlier versions (corrected forms in `validation/V1-metrics.md` §3).
- **Slow Android adoption (V3 §4):** 108 of 113 Android riders seen in 14 d last ran 3.26.0, only 32 of them active in the last 3 days. For the first 2–4 weeks `lvl = 2` returning-rider reads are mostly iOS and FS-OB* first-session reads grow only with new installs. **A thin Android `lvl = 2` cohort at the 2-week read (< 30 riders) is recorded "no verdict", never as a regression.** S3 per-release reads use the 24–48 h form (V2 §5.3).

## Release
Store builds 3.29.0, staged rollout per runbook; owner go-ahead. No OTA (D17).

## Dependencies
- Blocked by: T00 (test environment: iOS simulator for the runbook E2E, `e2e-android` build), T01, T04a, T04b, T04c, T05a, T05b, T05c, T05d, T07b, T08, T09, T10, T11, T12, T13a, T13b, T14, T15, T16a, T16b, T17.
- Blocks: T35, T14b, T15b, T36, T38.

## Out of scope
P2 tasks (Release B).

## Constraints
Onboarding paywall E2E both arms before promotion; no India targeting in store settings; light/dark verified per UI task.
