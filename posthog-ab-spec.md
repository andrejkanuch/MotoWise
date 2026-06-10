# PostHog Spec — Onboarding A/B Test (events, flag, funnels)

**Purpose:** the analytics contract for the onboarding A/B test — feature-flag config, identity strategy, event taxonomy, person/super properties, and the funnels/insights to build. Hand this to whoever configures PostHog and use it to verify the app instrumentation.
**Companions:** `onboarding-ab-implementation-prompt.md`, `onboarding-abc-test-plan.md`.
**Date:** 9 June 2026
**Conventions:** event + property names are `snake_case`; booleans prefixed `is_`/`has_`; the variant is on **every** onboarding event AND set as a **person property** (so RevenueCat-sourced revenue events can be broken down by variant too).

---

## 1. Feature flag / experiment

**Flag key:** `onboarding_ab_2026` — multivariate.

| Variant key | Meaning | Rollout |
|---|---|---|
| `lean` | Variant A — "Value-first, lean" | 50% |
| `invested` | Variant B — "Invested & personalized" | 50% |
| `control` *(optional)* | Current V4 flow (holdout) | 0% by default; set e.g. 10% if you want absolute lift |

- **Bucketing:** by `distinct_id`, consistent. Assignment happens **once at first launch, before the welcome screen**, and is persisted on-device (stable across resume/relaunch).
- **Exposure:** ensure `$feature_flag_called` fires when the variant is resolved (PostHog needs this to attribute the experiment). If you read the flag manually, call `posthog.getFeatureFlag('onboarding_ab_2026')` so exposure is logged.
- **Fallback:** if flags can't be fetched (offline / PostHog down), default to `lean`, record the assignment locally, and reconcile when flags resolve. Never leave a user without a flow.
- **Recommended:** set this up as a **PostHog Experiment** on this flag with the primary metric defined in §5, so PostHog computes significance automatically.

---

## 2. Identity strategy

- **Anonymous first.** Users are anonymous through onboarding + paywall. Use PostHog's anonymous `distinct_id`; where possible use the **same id** for the RevenueCat App User ID so events join cleanly.
- **On account create / sign-in:** call `posthog.identify(<supabase_user_uuid>)` and `posthog.alias()` so pre-account anonymous events link to the identified person. Mirror this with `Purchases.logIn(<supabase_user_uuid>)` (see `auth-and-paywall-timing.md`). **Use the Supabase UUID, never email.**
- **Set the variant as a person property** (`ab_variant`) at assignment via `$set`, so it persists and applies to revenue events that arrive later via the RevenueCat→PostHog integration.

---

## 3. Super properties (attach to all client events)

Register once so every client-side event carries them: `ab_variant`, `platform` (`ios`/`android`), `app_version`, `is_onboarding_resumed`.

## 4. Person properties (via $set)

`ab_variant`, `experience_level`, `riding_frequency` (B), `onboarding_focus` (B), `primary_goal`, `has_bike`, `bike_make`, `bike_model`, `bike_year`, `onboarding_completed` (bool), `onboarding_completed_at`.

---

## 5. Event taxonomy

**Common properties on every onboarding event:** `ab_variant`, `step`, `step_index` (+ the super properties). `step` values: `welcome, experience, frequency, focus, last_service, bike, building_plan, reveal, goals, maintenance, commitment, paywall, account, notifications, personalizing`. B includes the extra steps; A omits `frequency/focus/last_service/building_plan`.

| Event | When | Key properties (besides common) |
|---|---|---|
| `app_first_open` | first launch (defines "install" denominator) | `ab_variant` |
| `experiment_assigned` | variant resolved | `ab_variant`, `assignment_source` (`flag`/`fallback`) |
| `onboarding_started` | welcome CTA tapped | — |
| `onboarding_step_viewed` | each step shown | — |
| `onboarding_step_completed` | each step finished | step-specific (below) |
| `onboarding_step_skipped` | a step skipped | `skipped_section` |
| `onboarding_resumed` | resume-after-kill | `last_completed`, `resume_target` |
| `experience_selected` | Experience tap | `experience_level` (`beginner/intermediate/advanced`) |
| `profiling_frequency_selected` *(B)* | 03a | `riding_frequency` |
| `profiling_focus_selected` *(B)* | 03b | `focus` (array), `focus_count` |
| `profiling_last_service_set` *(B)* | 03c | `last_service_bucket`, `mileage`, `mileage_unit` |
| `bike_search_started` | bike search focused | — |
| **`bike_added`** ⭐ activation | bike saved (make-level+) | `bike_make`, `bike_model`, `bike_year`, `is_custom_make`, `capture_path` (`full`/`partial`), `is_type_auto_detected` |
| `bike_skipped` | left bike step w/o a bike | — (should be ~0 by design) |
| `building_plan_shown` *(B)* | 04L loader | `ai_status` (`cached`/`generated`/`fallback`/`timeout`), `duration_ms` |
| `reveal_viewed` | Reveal/Dossier shown | `reveal_lead` (`recall`/`projection`), `recall_count`, `projected_year_cost`, `is_known_issues_shown` |
| `goals_selected` | Goals continue | `goals` (array), `goals_count`, `primary_goal` |
| `maintenance_summary_viewed` | plan summary | `accepted_count`, `skipped_count`, `total_tasks` |
| `commitment_completed` | pledge done | `commitment_style` (`tap`/`hold`/`signature`) |
| `paywall_viewed` | paywall presented | `placement`, `primary_goal`, `projected_year_cost` |
| `paywall_result` | paywall closed | `result` (`purchased`/`cancelled`/`closed`/`skipped_expo_go`), `product_id`, `price` |
| `account_prompt_viewed` | account screen shown | `context` (`post_purchase`/`contextual`/`signin`) |
| `account_created` | account made | `method` (`apple`/`google`/`email`), `context` |
| `signed_in` | returning sign-in | `method` |
| `purchases_restored` | restore tapped | `is_restored` |
| `onboarding_completed` | flow done | `has_bike`, `primary_goal`, `goals_count`, `total_screens`, `time_to_complete_ms`, `accepted_maintenance_count` |

**Step-specific props on `onboarding_step_completed`:** mirror the dedicated event (e.g. `experience` → `experience_level`; `bike` → bike fields; `goals` → goals/primary_goal).

### Revenue events (RevenueCat → PostHog integration)
Enable the RevenueCat PostHog integration so subscription lifecycle events flow in, joined by the App User ID (= Supabase UUID). Expected events: `rc_trial_started`, `rc_initial_purchase`, `rc_renewal`, `rc_cancellation`, `rc_conversion` (names per the integration). These won't carry `ab_variant` as an event prop — **break them down by the `ab_variant` person property** instead (set in §2/§4).

---

## 6. Funnels & insights to build

**Primary metric (Experiment goal): install → trial start.**
Funnel: `app_first_open` → `bike_added` → `paywall_viewed` → `rc_trial_started`. Breakdown by `ab_variant`. (If hard-paywall, use `rc_initial_purchase` as the final step.)

**Activation (the thing the redesign targets): bike-add rate.**
Funnel: `onboarding_started` → `bike_added`, breakdown by `ab_variant`. Watch `bike_skipped` (target ~0).

**Step drop-off:** ordered funnel on `onboarding_step_completed` by `step_index`, breakdown by `ab_variant` — shows exactly where each arm leaks (and whether B's extra steps cause fatigue).

**Trial → paid (guardrail):** funnel `rc_trial_started` → `rc_conversion`, breakdown by `ab_variant`.

**Retention (guardrail):** PostHog Retention on a returning event (e.g. `app_opened`) for D1/D7/D30, cohorted by `ab_variant`.

**Realized value / LTV (decisive guardrail):** revenue per cohort (PostHog revenue or, better, the RevenueCat dashboard) by `ab_variant` — so a longer flow (B) can't "win" trial starts while monetizing worse.

**Secondary dashboards:** `building_plan_shown.ai_status` distribution (AI cache hit/fallback rate), `reveal_viewed.reveal_lead` performance, `commitment_completed.commitment_style`, `account_created.context` mix, time-to-complete by variant.

---

## 7. QA / launch checklist

- `experiment_assigned` fires once per install; `ab_variant` present on every onboarding event and set as a person property.
- Both arms emit parity events (A omits only the B-specific steps); names match this spec exactly.
- `$feature_flag_called` exposure logged; PostHog Experiment shows both arms receiving traffic ~50/50.
- `bike_added` fires for the partial-capture path (`capture_path: partial`) so activation isn't undercounted.
- `identify` + `alias` on account create/sign-in link anonymous → identified; RevenueCat events appear on the same person and break down by `ab_variant`.
- Offline/PostHog-down path still assigns a variant (`assignment_source: fallback`) and the user completes onboarding.
- Exclude internal / Expo Go builds (`paywall_result: skipped_expo_go`) from conversion metrics.

---

*Decision rule (from `onboarding-abc-test-plan.md`): win on install→trial start without regressing bike-add rate, trial→paid, retention, or LTV beyond a pre-set tolerance. Run ≥2–4 whole weeks; don't peek-and-stop.*
