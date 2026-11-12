---
title: "[#365 TR0] Instrumentation OTA to the live runtimes (activation_fix_level 1)"
labels: [instrumentation, area:mobile, area:analytics, activation-365]
order: 14
task_id: TR0
depends_on: [T01, T03a, T04a, T04b, T04c, T05a, T05b, T05c, T05d]
phase: P0
size: S
release_path: "per-runtime OTA: Android 3.26.0; iOS 3.26.0, 3.27.0, 3.28.0 (Mobile OTA Update workflow, release branches)"
---

## Context
#365, plan §2, §3A.0 rule 1 (review item 1), §6, §9 TR0 row, §10 item 3. Gets post-onboarding events flowing ~3 weeks before Release A for riders already on the live runtimes.

**What TR0 can and cannot measure.** An OTA applies on the next launch, so TR0 only yields data from **later sessions** of riders who already have the app. It serves T14b, T15b and post-onboarding events. A new rider's first session runs the store binary's embedded JS [SOURCE: R3 RC-2], so the first-session onboarding events (`auth_oauth_*`, `onboarding_back`, `bike_setup_summary`, `auth_session_lost` during onboarding) exist only from **3.29.0** (Release A). The gate windows of T36 and T38 and the pre-fix baselines of the FS-OB* onboarding metrics therefore count from 3.29.0 go-live per platform; the R1/R5 proxy SQL (`$screen`-based) is the pre-fix comparison.

## Why
An OTA from `main` reaches only main's runtime (3.28.0): ≈10 of ≈190 riders in 14 d; 3.26.0 holds ≈161 (Android 34, iOS 20, null-platform 107), 3.27.0 ≈21 [SOURCE: plan Q-P1; apps/mobile/app.config.ts:37, :59-61; docs/runbooks/mobile-ota.md:3, 173-176].

## What to change
1. Cut commit on `main`: `ACTIVATION_FIX_LEVEL = 1`; plan §6 rows prepared (§6.1 is the spec-to-level record; no fix ships in TR0).
2. For each runtime R in {3.26.0, 3.27.0, 3.28.0}: cut `release/R-365` from the **git commit of the latest production update group for R**, not the store build commit (the live JS on R is that update, and older OTAs may already carry fixes the binary lacks). Find it with `eas update:list --branch production` (each group lists `runtimeVersion` and `gitCommitHash`); for 3.28.0 that is `fece7a3c` / `5a497a1c` (re-check before cutting). Cherry-pick the TR0 scope and the cut commit's level change; resolve conflicts; run `pnpm verify:mobile`.
   - **TR0 scope = events and properties only:** T01, T04a, T04b, T04c, T05a, T05b, T05d, and T05c's ride-guard event properties. T05c's guard-sheet render change and testIDs ship in Release A only.
   - Check: `git log <live-update-commit>..release/R-365 -- apps/mobile` lists only TR0 commits. Paste the output in the release-log row.
3. Native-diff check per branch (`docs/runbooks/mobile-ota.md:157-188`): no new native module imported by JS.
4. Before each publish: build a preview of `release/R-365` and run `apps/mobile/.maestro/flows/onboarding.yaml` and `log-ride.yaml` on it; put the logs in the release-log row (§6).
5. Owner go-ahead per runtime; publish with the `Mobile OTA Update` workflow, git branch = `release/R-365`, `--environment production`.
6. On publish: PostHog annotation per platform × runtime (T03a format), plan §6 row with update group id and branch.

## How
Follow `docs/runbooks/mobile-ota.md` "Before you publish" (scope + native mismatch) for each branch; Android 3.28.0 only if vc98 is live by then (re-check Play status).

## Acceptance criteria
- [ ] One OTA per live runtime, each with owner go-ahead, workflow run link and annotation.
- [ ] `pnpm verify:mobile` green on every release branch; the `git log <live-update-commit>..release/R-365 -- apps/mobile` output shows only TR0 commits.
- [ ] `onboarding.yaml` and `log-ride.yaml` passed on a preview build of each branch; logs in the release-log row.
- [ ] FS-M OTA share ≥ 90% within 7 days on each targeted runtime.

## Verification
`SELECT toString(properties.runtime_version) rt, lower(coalesce(toString(properties.platform), toString(properties.$os))) plat, uniqIf(person_id, toString(properties.activation_fix_level) = '1') / uniq(person_id) FROM events WHERE event='Application Opened' AND timestamp > now() - INTERVAL 7 DAY AND {EXCL} GROUP BY rt, plat`.

## Friction spec
FS-M / FS-PO3b. Repro: rider on Android 3.26.0 opens the app after a `main` OTA — still no marker. Expected: after TR0 every event from that runtime carries `activation_fix_level = 1`. Automated check: jest (CI) from T01; publish verified by the query above.

## Production metric
FS-M share per runtime (plan §5A.2). Baseline 0% [SOURCE: Q-P4]. Target ≥ 90% (7 d). Dashboard "FS-M — release marker coverage". Annotate each runtime's OTA in PostHog.

## Release
Per-runtime OTA only; no store build.

## Dependencies
- Blocked by: T01, T03a, T04a, T04b, T04c, T05a, T05b, T05c, T05d.
- Blocks: T18, T14b, T15b, T36, T38.

## Out of scope
Shipping any fix by OTA (D14b); T05c's guard-sheet render change and testIDs (Release A); first-session onboarding measurement (needs 3.29.0).

## Constraints
Never a local env file; owner go-ahead for each publish; never India targeting; analytics consent rules unchanged.
