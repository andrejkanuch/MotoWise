---
title: "[#365 T05e] API server events onboarding_bike_created {capture_level, make_valid} and ride_saved {below_min, is_first}"
labels: [instrumentation, area:api, area:analytics, activation-365]
order: 12
task_id: T05e
depends_on: [T02, T03a]
phase: P0
size: S
release_path: "API deploy on Render (reaches every app version) + annotation"
---

## Context
#365, plan §3A.0 rule 6 (D2b option B), §5A.4. Makes DB-only metrics FS-R2-5 and FS-PO4b readable in PostHog. The events respect each rider's analytics decision (doc review 2026-11-12, item 1).

## Why
PostHog has no Supabase warehouse source [SOURCE: review W2, W3]. Junk makes ("A", "V") are saved: 6 of 176 onboarding bikes in 60 d have a make under 3 letters [SOURCE: V1-db6]. 26 of 71 sign-ups' first rides are live < 50 m, plus 15 live with null distance [SOURCE: R4 S-R4-01; V1-db9].

## What to change
Server-side capture (same pattern as `signup_completed`, `apps/api/src/modules/analytics/signup-events.service.ts`):
- `onboarding_bike_created {capture_level: 'make'|'model'|'none', make_valid: boolean, mileage_unit}` from `completeOnboarding` (`apps/api/src/modules/users/users.service.ts:235-264`) when the RPC created a bike; `make_valid` = ≥ 3 letters or a known make.
- `ride_saved {below_min, distance_m, duration_s, is_first, save_trigger}` from the ride save mutation (rides module).

**Consent rule (every server event in #365: these two and `service_plan_imported` in T07a):**
- Resolve the rider's decision with `readAnalyticsDecision(preferences, signupMetadata)` from `apps/api/src/modules/analytics/analytics-consent.ts:30`, reading `users.preferences` and the auth sign-up metadata, as `signup-events.service.ts:185-198` does.
- Consent (`decision === true`) → `distinct_id` = the user id.
- Decision `false`, or no decision stored yet (for example an OAuth sign-up still inside `completeOnboarding`) → a constant non-identifying `distinct_id` per event (`'onboarding-bike-no-consent'`, `'ride-saved-no-consent'`, same idea as `ANONYMOUS_DISTINCT_ID = 'signup-no-consent'` at `signup-events.service.ts:24`) plus `NO_CONSENT_PROPERTIES` (`$process_person_profile: false`, `analytics_consent: false`, `analytics-consent.ts:45-48`).
- A missing decision counts as **no consent** here. This is stricter than `hasAnalyticsConsent` (`analytics-consent.ts:18`), which treats NULL as consent; use a small wrapper (e.g. `hasExplicitAnalyticsConsent(decision) = decision === true`) next to it, and do not change `hasAnalyticsConsent` (the signup sweep and RevenueCat webhook rely on it).
- Never send an email or any other personal field.

## How
Jest specs next to each service: event captured once with typed props; capture failure never fails the mutation; **per event, decision `false` and decision missing → the payload contains no user id (constant `distinct_id`, `$process_person_profile: false`); decision `true` → `distinct_id` = user id**. `pnpm verify:api`.

## Acceptance criteria
- [ ] Specs pass incl. the consent cases (false / missing / true) for both events; `pnpm verify:api` green.
- [ ] Deploy only after T02 baselines for FS-R2-5 / FS-PO4b DB share exist; annotation `#365 fixes: api <sha> lvl - — FS-R2-5,FS-PO4b (measure)` on deploy day.

## Verification
`SELECT event, count() FROM events WHERE event IN ('onboarding_bike_created','ride_saved') AND timestamp > now() - INTERVAL 7 DAY GROUP BY event` → both non-zero.

## Friction spec
FS-R2-5 / FS-PO4b (measurement). Repro: onboarding with custom make "A". Expected: `onboarding_bike_created {make_valid:false}`. Automated check: jest (CI) users.service spec.

## Production metric
FS-R2-5: `countIf(properties.make_valid = false)` per week; baseline 6/176 short makes (DB, 60 d) [SOURCE: V1-db6]; target 0 after T25b. FS-PO4b DB share: `ride_saved {is_first:true, below_min:true}` / `ride_saved {is_first:true}`; baseline 26/71 live < 50 m + 15 live null distance (count null as sub-floor) [SOURCE: V1-db9]; target < 5% after T09. Tiles in T03b. Annotate per T03a.

## Release
API deploy (Render). Old clients unaffected.

## Dependencies
- Blocked by: T02, T03a.
- Blocks: T03b tiles for FS-R2-5 / FS-PO4b.

## Out of scope
Any behaviour change.

## Constraints
Server events follow the consent rule above: user id only with a stored "yes"; otherwise a constant `distinct_id` + `NO_CONSENT_PROPERTIES`; never email. Logging stays free.
