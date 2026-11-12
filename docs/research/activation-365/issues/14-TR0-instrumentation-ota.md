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
#365, plan §3A.0 rule 1 (review item 1), §6. Gets T04/T05 data flowing ~3 weeks before Release A so the data gates of T14b, T15b, T36, T38 can be read.

## Why
An OTA from `main` reaches only main's runtime (3.28.0): ≈10 of ≈190 riders in 14 d; 3.26.0 holds ≈161 (Android 34, iOS 20, null-platform 107), 3.27.0 ≈21 [SOURCE: plan Q-P1; apps/mobile/app.config.ts:37, :59-61; docs/runbooks/mobile-ota.md:3, 173-176].

## What to change
1. Cut commit on `main`: `ACTIVATION_FIX_LEVEL = 1`; `ACTIVATION_FIXES` unchanged (no fix yet); plan §6 rows prepared.
2. For each runtime R in {3.26.0, 3.27.0, 3.28.0}: branch `release/R-365` from R's store release commit (find it with `asc builds list` / git tags), cherry-pick T01, T04a–c, T05a–d (and the cut commit's level change); resolve conflicts; run `pnpm verify:mobile`.
3. Native-diff check per branch (`docs/runbooks/mobile-ota.md:157-188`): no new native module imported by JS.
4. Owner go-ahead per runtime; publish with the `Mobile OTA Update` workflow, git branch = `release/R-365`, `--environment production`.
5. On publish: PostHog annotation per platform × runtime (T03a format), plan §6 row with update group id and branch.

## How
Follow `docs/runbooks/mobile-ota.md` "Before you publish" (scope + native mismatch) for each branch; Android 3.28.0 only if vc98 is live by then (re-check Play status).

## Acceptance criteria
- [ ] One OTA per live runtime, each with owner go-ahead, workflow run link and annotation.
- [ ] `pnpm verify:mobile` green on every release branch.
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
Shipping any fix by OTA (D14b).

## Constraints
Never a local env file; owner go-ahead for each publish; never India targeting; analytics consent rules unchanged.
