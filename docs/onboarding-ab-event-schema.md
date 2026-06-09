# Onboarding A/B (2026) — Event Schema

**Experiment:** PostHog flag [`onboarding_ab_2026`](https://eu.posthog.com/project/155556/feature_flags/202343) — variants `lean` (A) / `invested` (B) / `control` (V4 holdout, 0% by default).
**Source of truth in code:** `apps/mobile/src/lib/onboarding-analytics.ts` + `apps/mobile/src/config/onboarding.ts`.

## Contract

Every onboarding event carries:

| Property | Type | Notes |
|---|---|---|
| `variant` | `lean \| invested \| control` | Attached explicitly by `trackOnboardingEvent`/`trackOnboardingFlowEvent` AND registered as super property `onboarding_variant` + person property. |
| `step` | string | Stable snake_case step name from `OB_STEP_NAME` (e.g. `bike_setup`). Step-scoped events only. |
| `step_index` | number | Zero-based position **within the variant's flow** (B has more steps → higher indices). Step-scoped events only. |

Event names are identical across arms (parity); variant B simply emits the same `onboarding_step_viewed/completed` events for its extra steps (`frequency`, `stay_on_top`, `last_service`, `building_plan`).

## Funnel events

| Event | When | Extra properties |
|---|---|---|
| `onboarding_started` | Welcome CTA tapped | — |
| `onboarding_step_viewed` | each step mount | — |
| `onboarding_step_completed` | each step advanced | step-specific (below) |
| `onboarding_step_skipped` | demoted skip used | `skipped_section` |
| `bike_added` | bike captured during onboarding (**activation metric**, fires for full AND partial capture) | `capture_level: 'model' \| 'make'`, `bike_make`, `bike_year` |
| `reveal_viewed` | Bike Dossier shown | `recall_count`, `has_projection`, `has_known_issues` |
| `commitment_completed` | pledge done | `commitment_style: 'tap' \| 'hold'` |
| `paywall_viewed` / `paywall_result` | RC paywall lifecycle (fired by `subscription.ts`) | `paywall_result: purchased \| restored \| cancelled \| …`, `placement` |
| `account_created` | post-purchase/post-paywall account created or signed in | `context: 'post_purchase' \| 'post_paywall_free'`, `method: apple \| google \| email` |
| `onboarding_completed` | personalizing finished | `has_bike`, `primary_goal`, `variant`, `goals`, `experience_level`, … |
| `onboarding_resumed` | resume-after-kill | `last_completed`, `resume_target` |

Step-specific `onboarding_step_completed` properties (pre-existing, unchanged): experience → `experience_level`; goals → `goals`, `goals_count`, `primary_goal`; bike_setup → `bike_year/make/model`, `is_custom_make`; maintenance → `accepted_count`, `skipped_count`, `total_tasks`; paywall → `paywall_result`, `goals`, `primary_goal`, `placement`; notifications → `permission_granted`, `skipped`.

## Metrics → PostHog definitions

- **Primary — install → trial start:** funnel `onboarding_started` → `paywall_result` where `paywall_result = purchased`, broken down by `variant`. (Trial = purchase of the trial-bearing package; refine with RC webhook events if needed.)
- **Activation guardrail — bike-add rate:** funnel `onboarding_started` → `bike_added`, by `variant`.
- **Per-step drop-off:** funnel over `onboarding_step_viewed` filtered per `step`, by `variant` (use `step` property values in flow order per variant).
- **Trial→paid / retention / LTV:** RevenueCat events + PostHog cohorts on person property `onboarding_variant` (set at assignment, persists post-signup).
- **Exposure:** `$feature_flag_called` with `$feature_flag = onboarding_ab_2026`; offline-defaulted users carry `locally_defaulted: true`.

## Hygiene

- Exclude internal users/Expo Go (paywall step emits `paywall_result: skipped_expo_go` — exclude from primary metric).
- `filterTestAccounts` per PostHog audit 2026-05-30.
- The variant is assigned pre-auth on the anonymous distinct_id; `identifyUser(supabaseUUID)` at account creation merges the anonymous person into the identified person, so pre- and post-auth events join.
