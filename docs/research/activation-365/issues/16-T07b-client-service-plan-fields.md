---
title: "[#365 T07b] Client: put servicePlanTaskCount/Tier on onboarding_completed; service-plan Maestro flows"
labels: [bug, area:mobile, activation-365]
order: 16
task_id: T07b
depends_on: [T00, T07a]
phase: P1
size: S
release_path: "Release A 3.29.0 (after T07a is live and pnpm generate ran on main)"
---

## Context
#365, plan §3 T07 (split b), §3A.0 rule 3 (API → deploy → generate → client), spec FS-PO1H.

## Why
The per-version PostHog read of Exp 2 needs the new fields on `onboarding_completed` (verbatim `R2…:249-258`), and FS-PO1H needs an end-to-end proof.

## What to change
- Read `servicePlanTaskCount`/`servicePlanTier` in `app/(onboarding)/personalizing.tsx` (`trackOnboardingCompleted`) and add them to `onboarding_completed`.
- Maestro `onboarding-service-plan.yaml` and `onboarding-make-only-service-plan.yaml`; `MAKE_ONLY` and `BIKE_MODEL` branches in `_shared/onboarding-to-account.yaml`; fix the stale comment at `_shared/onboarding-to-account.yaml:85-87` [SOURCE: R2 C15].
- **Reminder-cap client part (doc review 2026-11-12, item 2; server part in T07a):** an imported or backfilled task whose due date or mileage is already past shows as **"due now"** (not a count of days overdue); Home and the bike's Service view show **at most the 3 most urgent** tasks with a "+N more" row. Home already caps rows at `UP_NEXT_MAX_ROWS = 3` (`apps/mobile/src/components/home/up-next.tsx:13, 61`) and the bike hub's attention list already shows three rows plus "N more" (`apps/mobile/src/components/bike-hub/overview/attention-list.tsx:212-257`); add the "+N more" row to Home's up-next list and make the Service segment (`apps/mobile/src/components/bike-hub/segments/service-segment.tsx`, grouping in `components/bike-hub/service/group-tasks.ts`) follow the same rule. The plate copy (`components/home/home-plate.ts`) says "due now" for a past limit.
- `package.json` scripts `test:e2e:service-plan`, `test:e2e:service-plan-make-only`; README lines.

## How
Jest: 10 imported tasks with 4 already past → Home shows 3 rows + "+7 more" and the past ones read "due now" (add to `components/home/__tests__/` and extend `components/bike-hub/__tests__/service-section.test.tsx`).
Generated types from `pnpm generate` on `main` (never hand-edit `packages/graphql/src/generated/`). Flows use T05d ids (`segment-service`, `service-task-card-<n>`).

## Acceptance criteria
- [ ] Red run of both flows on a build from `origin/main` (fails: "No service due"), log in PR.
- [ ] Green on a T00 E2E build with T07a live, iOS sim + Android emu; imperial run asserts "mi".
- [ ] `pnpm verify:mobile` green; light/dark screenshots of the bike Service segment and the Home up-next list.
- [ ] Jest: "due now" for past imported tasks; at most 3 rows + "+N more" on Home and Service.

## Verification
`pnpm --filter @motovault/mobile test:e2e:service-plan` (local); production: `onboarding_completed.servicePlanTaskCount > 0` share by `$app_version` = 3.29.0.

## Friction spec
FS-PO1H. Repro: as T07a (Yamaha MT-09 2019; then Honda chip make-only). Expected: Home plate shows the next item; Service segment lists tasks; make-generic shows tier. Automated check: maestro (local, iOS sim + Android emu) `onboarding-service-plan.yaml`: `runFlow onboarding.yaml` (BIKE_MODEL=MT-09) → `assertNotVisible: "No service due"` → `tapOn: {id: tab-garage}` → bike card → `tapOn: {id: segment-service}` → `extendedWaitUntil: {visible: {id: "service-task-card-0"}, timeout: 10000}`; make-only flow asserts the tier label. Red first on main.

## Production metric
`SELECT toString(properties.$app_version) ver, countIf(toInt(properties.servicePlanTaskCount) > 0) / count() FROM events WHERE event='onboarding_completed' AND timestamp > now() - INTERVAL 28 DAY AND {EXCL} GROUP BY ver`. Baseline: field absent (R2-M1 7%). Target ≥ 95% on 3.29.0. Tile "FS-PO1H — per version". Annotate Release A per T03a.

## Release
Release A (embedded); plan §6.1 records FS-PO1H at level 2 at the cut.

## Dependencies
- Blocked by: T00 (test environment), T07a (deployed + generate).
- Blocks: T18.

## Out of scope
Backfill; plate CTA.

## Constraints
Light/dark; no RevenueCat in test runs (close paywall `optional: true`).
