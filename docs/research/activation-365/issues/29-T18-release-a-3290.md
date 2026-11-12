---
title: "[#365 T18] Release A: store binary 3.29.0 \"#365 fixes A\" (iOS + Android), activation_fix_level 2"
labels: [enhancement, area:mobile, area:analytics, activation-365]
order: 29
task_id: T18
depends_on: [TR0, T07b, T08, T09, T10, T11, T12, T13a, T13b, T14, T15, T16a, T16b, T17]
phase: P1
size: S
release_path: "store builds per docs/runbooks/mobile-release.md (both platforms), owner go-ahead; Android also promotes the FCM config (PR #393)"
---

## Context
#365, plan §3 T18, §3A.0 rules 1–2, §6, §6.1, D14 (target submit 2026-11-30).

## Why
A new rider's first session runs the embedded JS [SOURCE: R3 RC-2]; every first-session fix must be in the binary. 4 of 5 3.26.0 limit riders hit the bug on their install launch [SOURCE: R3 Q13].

## What to change
- Cut commit: `version: '3.29.0'` in `apps/mobile/app.config.ts:37`; `ACTIVATION_FIX_LEVEL = 2`; `ACTIVATION_FIXES` gets every spec fixed by T07b–T17 at 2; plan §6 and §6.1 rows (status `shipped` on go-live).
- Pre-promotion E2E (local, both platforms): `onboarding-paywall-verify.yaml` both arms (runbook), `onboarding.yaml`, and every flow from T07b–T17; links in the release PR.
- Release notes list task and spec ids.

## How
Follow `docs/runbooks/mobile-release.md` and the #365 section (T03a). After this bump, OTAs from `main` reach only 3.29.0 (older runtimes per D14b).

## Acceptance criteria
- [ ] Both binaries in production; per-platform annotations `#365 fixes: ios 3.29.0 lvl 2 — <spec ids>` and `android …` on their go-live days.
- [ ] FS-M binary rule: 100% of 3.29.0 opens carry level 2; first `is_embedded_launch=true` events with level 2.
- [ ] Ledger: both-arm changes of this binary dated.

## Verification
`SELECT lower(coalesce(toString(properties.platform), toString(properties.$os))) plat, toString(properties.activation_fix_level) lvl, count() FROM events WHERE event='Application Opened' AND toString(properties.$app_version)='3.29.0' AND timestamp > now() - INTERVAL 7 DAY AND {EXCL} GROUP BY plat, lvl`.

## Friction spec
FS-PO3b. Repro: install a binary built before a JS fix, publish the fix as OTA, complete onboarding in one launch → fix absent. Expected: first-hour fixes embedded. Automated check: E2E suite on the release build (local, both) + manual release-checklist line "first-session fixes are embedded".

## Production metric
FS-PO3b (verbatim `R3…:425-435` + `is_embedded_launch`) baseline 4 of 5 [SOURCE: R3 Q13] → 0. Every friction tile read at 2/4/8 weeks by `lvl` 2 vs 1 (same calendar weeks, per platform), recorded in `experiments.md` and §6.1. Annotate per platform in PostHog.

## Release
Store builds, staged rollout per runbook; owner go-ahead.

## Dependencies
- Blocked by: TR0, T07b, T08, T09, T10, T11, T12, T13a, T13b, T14, T15, T16a, T16b, T17.
- Blocks: T35, T14b, T15b.

## Out of scope
P2 tasks (Release B).

## Constraints
Onboarding paywall E2E both arms before promotion; no India targeting in store settings; light/dark verified per UI task.
