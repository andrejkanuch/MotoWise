---
title: "[#365 T01] Release marker on every event: activation_fix_level, ota_update_id, runtime_version, e2e_run"
labels: [instrumentation, area:mobile, area:analytics, activation-365]
order: 1
task_id: T01
depends_on: [T00]
phase: P0
size: S
release_path: "Release A store build 3.29.0 (T18) only (owner rule D17)"
---

## Context
Part of #365 "Activation: first session and first core action". Plan: `docs/research/activation-365/EXECUTION_PLAN.md` §3 T01, §3A.0 rules 1–2, §10 item 13, §10.1 (D17), §3A.2, §5A.2 (FS-M).
Every other #365 task is read per release through these properties.

## Why
- An OTA keeps `$app_version`; Android has run binary 3.26.0 b93 through every November OTA [SOURCE: R5 Q18; plan Q-P1].
- No event carries an update id or a fix level: 0 of 232 (3.26.0), 0/59 (3.27.0), 0/36 (3.28.0) `Application Opened` in 7 days [SOURCE: plan Q-P4]. Release-marker baseline = **0%**.
- A new rider's first session runs the binary's embedded JS [SOURCE: R3 RC-2], so `is_embedded_launch` is needed to know which code a first session ran.
- `platform` is already a super property but null on **29% of `Application Opened` — exactly the install/first open** (97 of 332 in 7 d), and `$os`/`$os_name` are **never set** on mobile events, so the platform of a cohort's first event is unknown today [SOURCE: validation/V1-metrics.md §3.1, V1-q2…q5; hooks/use-analytics-super-properties.ts:64-71]. Until this ships, queries use a person-level platform with a temporary `$app_build` fallback that breaks at Android versionCode 100 (plan §0 `{REL}`).

## What to change
Register on every event, at PostHog client creation and again on consent grant:
`activation_fix_level` (int), `ota_update_id` (`Updates.updateId ?? 'embedded'`), `ota_channel`, `is_embedded_launch`, `runtime_version`, `platform` (moved earlier), and
`e2e_run: true` only when `process.env.EXPO_PUBLIC_E2E_RUN === '1'`. No spec-to-level map in code: the plan's §6.1 status table is the only record of which level fixes which spec (doc review 2026-11-12).

## How
- New `apps/mobile/src/config/activation.ts`: `ACTIVATION_FIX_LEVEL = 0 as const` (0 = pre-release JS; the Release A cut sets 2; level 1 is not used, D17), nothing else. Header comment: "Bump ONLY in the commit that cuts a store build or a crash/data-loss hotfix OTA publish (plan §3A.0 rule 2). Never in a feature PR."
- `apps/mobile/src/lib/analytics.ts`: `buildReleaseMarker()` reading `expo-updates` (installed, `apps/mobile/package.json:84`); register right after the client is created (`lib/analytics.ts:55`) and in the consent-grant path, because `registerSuperProperties` no-ops while analytics is off (`lib/analytics.ts:490-492`, comment `:388`).
- `apps/mobile/src/hooks/use-analytics-super-properties.ts:64-71`: merge the marker into `buildSuperProperties` so the keyed re-register keeps it.
- Jest `apps/mobile/src/lib/__tests__/analytics-release-marker.test.ts` (mock `expo-updates`).
- `apps/mobile/.maestro/README.md`: E2E builds set `EXPO_PUBLIC_E2E_RUN=1`.

## Acceptance criteria
- [ ] Jest: embedded launch → `ota_update_id: 'embedded'`, `is_embedded_launch: true`; OTA launch → the id; level equals the constant; registered at init and again on consent; `e2e_run` present only with the env flag.
- [ ] `pnpm verify:mobile` green; no PII in any property.
- [ ] On a T00 E2E build (no EAS `preview` build exists) with a consenting test account, PostHog Live events show all properties on `Application Opened`.
- [ ] **`platform` is non-null on 100% of `Application Opened`, including the first open after install** (jest: registered before the first capture; Live events: the install open carries it). Production check after 3.29.0: `countIf(properties.platform IS NULL) = 0` on 3.29.0 opens.

## Verification
- `pnpm --filter @motovault/mobile test -- analytics-release-marker` and `pnpm verify:mobile`.
- Production after 3.29.0 go-live (HogQL, read-only):
  `SELECT toString(properties.runtime_version) rt, toString(properties.ota_update_id) ota, toString(properties.activation_fix_level) lvl, uniq(person_id) FROM events WHERE timestamp > now() - INTERVAL 7 DAY AND event='Application Opened' AND properties.$lib='posthog-react-native' AND {EXCL} GROUP BY rt, ota, lvl`
  Target: FS-M (plan §5A.2) — 100% of `$app_version = '3.29.0'` opens carry level 2 (binary rule); the 7-day OTA share applies only to a crash/data-loss hotfix OTA (D17).

## Friction spec
FS-M — fixes can be read per release.
- Repro (problem fact): an OTA keeps `$app_version` the same [SOURCE: R4 Q-R4-12]; nothing tells which JS ran.
- Expected: every event carries the marker; each release has an annotation (T03a).
- Automated check: jest (CI) `analytics-release-marker.test.ts`. No Maestro: an OTA cannot be installed in order inside a flow [SOURCE: R3 F-R3-2].

## Production metric
- HogQL: FS-M query above by `rt`, `ota`, `lvl`; binary rule: `countIf(toString(properties.activation_fix_level) != '<expected>') = 0` for `$app_version = '<new>'`.
- Baseline 0% [SOURCE: Q-P4]. Target: binary 100%; a crash/data-loss hotfix OTA (D17) ≥ 90% (7 d, targeted runtime).
- Dashboard insight: "FS-M — release marker coverage" (T03b), alert on the binary rule.
- Annotate the release in PostHog when it ships (T03a procedure).

## Release
JS only, no native dependency (`expo-updates` already in the binary). Ships only embedded in Release A 3.29.0 (D17; TR0 removed by D17); riders on older binaries never carry the marker (read null `lvl` as pre-3.29.0 JS).

## Dependencies
- Blocked by: T00 (test environment: an E2E build to check Live events).
- Blocks: T03b, T04a, T04b, T04c, T05a, T05b, T05c, T05d, T18.

## Out of scope
A CI guard forcing a level bump (R4 F-R4-7 idea).

## Constraints
No PII; analytics stays consent-gated (EEA decliners send nothing); `as const`, no `enum`; light/dark n/a.
