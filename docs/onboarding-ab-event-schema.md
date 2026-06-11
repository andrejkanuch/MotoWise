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
| `commitment_completed` | pledge done | `commitment_style: 'tap' \| 'hold' \| 'signature'` (A = `hold`; B = `signature`, a drawn signature) |
| `paywall_viewed` / `paywall_result` | RC paywall lifecycle (fired by `subscription.ts`) | `paywall_result: purchased \| restored \| cancelled \| …`, `placement` |
| `account_created` | post-purchase/post-paywall account created or signed in | `context: 'post_purchase' \| 'post_paywall_free'`, `method: apple \| google \| email` |
| `onboarding_completed` | personalizing finished | `has_bike`, `primary_goal`, `variant`, `goals`, `experience_level`, … |
| `onboarding_resumed` | resume-after-kill | `last_completed`, `resume_target` |

Step-specific `onboarding_step_completed` properties (pre-existing, unchanged): experience → `experience_level`; goals → `goals`, `goals_count`, `primary_goal`; bike_setup → `bike_year/make/model`, `is_custom_make`; maintenance → `accepted_count`, `skipped_count`, `total_tasks`; paywall → `paywall_result`, `goals`, `primary_goal`, `placement`; notifications → `permission_granted`, `skipped`.

Variant B's extra steps: frequency → `riding_frequency`; stay_on_top → `concerns`, `concerns_count`, `primary_concern` (derived via `CONCERN_PRIORITY`/`getPrimaryConcern`, biases the Reveal's lead card + paywall framing); last_service → `last_service`, `has_mileage`, `unit`; building_plan → loader, no extra props.

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


---

## Manual QA checklist (both arms)

Run on a dev build (not Expo Go — RC paywall is unavailable there). Toggle the
variant by forcing the flag in PostHog (or clear the `experiment-store` MMKV to
re-roll). Verify in PostHog Live Events that `variant` is on every event.

**Variant A (lean) — happy path**
- [ ] Fresh install → Welcome renders only after the variant resolves (no flash)
- [ ] Flow order: Experience → Bike → Reveal → Goals → Maintenance → Commitment → Paywall → Account → Notifications → Personalizing
- [ ] Reveal leads with the recall check; AI known-issues card shows when ready, hides otherwise
- [ ] Commitment: press-and-hold fills (~0.85s) + success haptic
- [ ] Paywall presents anonymously (no account yet); purchase unlocks Pro
- [ ] Account screen shows "You're Pro / Secure your subscription"; Apple/Google/email create account → advances
- [ ] `onboarding_completed` fires with `variant=lean`, `has_bike=true`, `primary_goal`

**Variant B (invested) — happy path**
- [ ] Flow adds Frequency → Stay-on-top → Last service before Bike, and Building-plan before Reveal
- [ ] Building-plan advances at data-ready or the 2.5s cap (never spins)
- [ ] Reveal leads with the cost projection (EUR) + recall check + AI known-issues
- [ ] Commitment is a drawn signature: Seal enables only after a minimal stroke (a dot does not count); Clear resets; seal fires success haptic → `commitment_completed` with `commitment_style=signature`
- [ ] Progress bar shows more segments than A

**Bike activation (both)**
- [ ] Full make+model capture → `bike_added` with `capture_level=model`
- [ ] Demoted skip / partial capture → still sets a make-level bike → `bike_added` with `capture_level=make`; `has_bike=true` at completion
- [ ] Maintenance never dead-ends (bike always present in lean/invested)

**Auth / RevenueCat**
- [ ] Free path: dismiss paywall → Account framed "Save your setup" → account still required to enter app
- [ ] Restore purchases (native RC paywall button) → entitlement restored → Account/continue
- [ ] "Already have an account? Sign in" (account screen) → sign-in → returning, already-onboarded user lands in tabs
- [ ] Purchase made anonymously then account created → entitlement persists (RC logIn(uuid) aliased)

**Degradation**
- [ ] Airplane mode at first launch → variant defaults to `lean` (fallback), flow still runs
- [ ] API/AI down → Reveal shows facts (recalls/cost/community) with the AI card hidden; never blocks
- [ ] `control` variant (or flag disabled) → unchanged V4 flow (auth-first)

**Config tasks (out of code)**
- [ ] RevenueCat: Restore Behavior = "Transfer to new App User ID"
- [ ] API env: `GOOGLE_GENERATIVE_AI_API_KEY` (Gemini primary; OpenAI fallback via existing `OPENAI_API_KEY`), `AI_INSIGHTS_ENABLED=true`, `AI_INSIGHTS_TIMEOUT_MS=2000`
- [ ] PostHog flag `onboarding_ab_2026` rollout set (lean/invested 50/50, control 0)
