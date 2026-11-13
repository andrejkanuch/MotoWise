# Onboarding A/B (2026) — Event Schema

> ## RETIRED 2026-08-24 — one flow ships
>
> [Experiment #83476](https://eu.posthog.com/project/155556/experiments/83476) is
> **stopped**. `lean` won on both readable metrics — onboarding completion
> **40.5% (90/222) vs 29.4% (59/201)** and bike-add **75.2% (167/222) vs 64.7%
> (130/201)**, each at roughly **p≈0.02**. The expense-logged (20 vs 12) and
> purchase (12 vs 6) differences are directional only at that volume.
>
> The primary metric — install → trial start — never had the volume to reach
> significance at 6–12 purchases, and choosing it is what put a paywall at step 5
> of onboarding. Its replacement measures **first-value-logged** instead; see
> `docs/plans/2026-08-24-1622-feat-activation-and-store-truth-plan.md` (U7).
>
> **What shipped instead:** one flow of **11 screens**, descended from `lean` with
> the `paywall`, `maintenance` and `scan_receipt` steps removed (14 → 11), plus a
> new variant value `shipped`. `lean` / `invested` / `control` survive as
> **read-only** legacy values for the ~423 installs that persisted one; all four
> resolve to the same flow, and `onboarding_variant` is deliberately **never
> cleared** — it is the only record of which flow a user went through.
>
> **A PostHog annotation marks the cutover.** Do not build a funnel that spans it:
> before and after are different flows, and averaging them is exactly the error the
> annotation exists to prevent.
>
> Everything below documents the experiment as it ran, and remains accurate for
> reading historical data. It is **not** a description of the current flow — for
> that, read `ONBOARDING_FLOWS` in `apps/mobile/src/config/onboarding.ts`.

## As it ran (historical)

**Experiment:** PostHog [Experiment #83476](https://eu.posthog.com/project/155556/experiments/83476) on flag [`onboarding_ab_2026`](https://eu.posthog.com/project/155556/feature_flags/202343) — variants `lean` (A) / `invested` (B) / `control` (V4 holdout, 0% by default).
**Source of truth in code:** `apps/mobile/src/lib/onboarding-analytics.ts` + `apps/mobile/src/config/onboarding.ts`.
**Property naming:** the variant is `variant` on every onboarding event AND `onboarding_variant` as a super + person property. (The earlier planning doc `docs/archive/onboarding-2026-06/posthog-ab-spec.md` proposed `ab_variant`; that name was **not** adopted — this schema is authoritative.)

## Contract

Every onboarding event carries:

| Property | Type | Notes |
|---|---|---|
| `variant` | `lean \| invested \| control` | Attached explicitly by `trackOnboardingEvent`/`trackOnboardingFlowEvent` AND registered as super property `onboarding_variant` + person property. |
| `step` | string | Stable snake_case step name from `OB_STEP_NAME` (e.g. `bike_setup`). Step-scoped events only. |
| `step_index` | number | Zero-based position **within the variant's flow** (B has more steps → higher indices). Step-scoped events only. |

Event names are identical across arms (parity); variant B simply emits the same `onboarding_step_viewed/completed` events for its extra steps (`frequency`, `stay_on_top`, `last_service`, `building_plan`).

**Event names were kept stable through the retirement.** `onboarding_step_viewed/completed/skipped` still fire for the surviving steps, and `OB_STEP_NAME` still resolves every retired step (`paywall`, `maintenance`, `scan_receipt`, `frequency`, `stay_on_top`, `last_service`, `building_plan`) so historical funnels continue to resolve. Removing a step from the flow is not deleting its event.

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
| `account_created` | **RETIRED 2026-08-24 — no longer emitted.** Fired from the account screen only, so it measured screen traversal, not signup (154 events against 320 real signups). Superseded by the server-side `signup_completed` (migration 00174). Historical events remain queryable. | `context`, `method` |
| `onboarding_completed` | personalizing finished | `has_bike`, `primary_goal`, `variant`, `goals`, `experience_level`, … |
| `onboarding_resumed` | resume-after-kill | `last_completed`, `resume_target` |

Step-specific `onboarding_step_completed` properties (pre-existing, unchanged): experience → `experience_level`; goals → `goals`, `goals_count`, `primary_goal`; bike_setup → `bike_year/make/model`, `is_custom_make`; maintenance → `accepted_count`, `skipped_count`, `total_tasks`; paywall → `paywall_result`, `goals`, `primary_goal`, `placement`; notifications → `permission_granted`, `skipped`.

Variant B's extra steps: frequency → `riding_frequency`; stay_on_top → `concerns`, `concerns_count`, `primary_concern` (derived via `CONCERN_PRIORITY`/`getPrimaryConcern`, biases the Reveal's lead card + paywall framing); last_service → `last_service`, `has_mileage`, `unit`; building_plan → loader, no extra props.

### #365 T04a — auth events (from app 3.29.0)

Current flow, not the retired experiment. Fired by the app on every sign-in surface (`surface`: `onboarding_account`, `onboarding_sign_in`, `login`, `register` = `AUTH_SURFACE` in `apps/mobile/src/config/auth.ts`). Names and Zod shapes are also in `packages/analytics/src/events.ts` (`MOBILE_AUTH_EVENTS`). Consent-gated like every app event. No email and no error message ever: `error_code` is the error's code (`ERR_REQUEST_CANCELED`, `PLAY_SERVICES_NOT_AVAILABLE`, a Supabase code), else its class name (`AuthRetryableFetchError`, `GoogleSignInInProgressError`), else `null`.

| Event | When | Properties |
|---|---|---|
| `auth_oauth_started` | Apple/Google tapped, before the provider is called (`hooks/use-oauth-sign-in.ts`) | `provider: apple \| google`, `surface` |
| `auth_oauth_result` | the same tap ended — exactly one per `auth_oauth_started`, double taps included | `provider`, `surface`, `outcome: success \| cancelled \| in_progress \| no_play_services \| cannot_present \| error`, `stage: sheet \| token_exchange` (`sheet` = the provider never handed back a token; `token_exchange` = the Supabase `signInWithIdToken` call was reached), `duration_ms` (tap → end), `is_new_user` (`null` unless success), `error_code` (`null` on success) |
| `auth_error_alert_shown` | `presentOAuthError` showed an alert (`lib/oauth-error-alert.ts`). Never on `in_progress` (silent). Until T12, a cancel still alerts: FS-OB2c = alerts with `outcome = cancelled` ÷ results with `outcome = cancelled` | `provider`, `outcome`, `error_code` |
| `auth_email_submitted` | an email form was submitted (account, onboarding sign-in, login, register) | `surface`, `mode: signup \| signin` |
| `auth_post_signin_wait` | the onboarding account step decided where to go after the session landed (`components/onboarding/use-account-advance.ts`), once | `wait_ms` (session seen → decision), `outcome: advanced \| already_onboarded \| me_error` (the way it went: `me_error` = the server state failed to load and the step advanced anyway; `timeout` is reserved for T12's bounded wait) |

`user_signed_up` / `user_signed_in` also carry `surface` from 3.29.0 (OAuth, email and the email code step); `auth_method` is unchanged.

"Started, no result" (FS-OB2a) = `auth_oauth_started` − `auth_oauth_result` per `provider` × platform: the app was killed or the sheet never returned. Do not read `Application Backgrounded` on the account step as "left the app": the Google sheet backgrounds the app on Android.

### #365 T04b — onboarding navigation, resume and gate events

Current (not historical). Sent from `apps/mobile/src/lib/onboarding-nav-analytics.ts`, behind the
analytics consent gate like every `trackEvent`. Step names come from `OB_STEP_NAME`; no free text,
email or ids. `onboarding_back`, `onboarding_welcome_mounted` and `onboarding_resumed` also carry
`variant`. All five carry the release marker super properties (T01).

| Event | When | Properties |
|---|---|---|
| `onboarding_back` | A Back between onboarding steps: the stack's `beforeRemove` on a `GO_BACK`/`POP`, the chevron's replace fallback, or Android Back on the stack root (`to: 'exit'`, the app leaves). Forward replaces never count. | `from`, `to` (step names; `to` may be `exit`), `trigger: hardware \| gesture \| button` (chevron marks itself; else `GO_BACK` = hardware, `POP` = iOS swipe), `ms_on_screen` (since the step's focus; null if unknown) |
| `onboarding_welcome_mounted` | Every Welcome mount | `reason: initial` (first mount in this JS runtime) `\| back` (≤ 2 s after a Back to Welcome) `\| remount` (anything else — RC-D), `had_progress` (a completed step, or a viewed step past Welcome, on record) |
| `onboarding_resumed` (extended) | resume-after-kill | adds `resumed_from_screen` (last step on screen, persisted on every focus as `lastViewedScreen`), `away_s` (since `lastViewedAt`), `cold_start` (always `true` today), `pending_code_step: 0 \| 1` (the account email code step was open), `had_session: 0 \| 1` |
| `gate_routed` | Once per cold start, when the root NavigationGate first settles | `group: restoring \| auth \| onboarding \| tabs \| none`, `onboarding_completed_source: local \| me_cache \| me_network \| none` (which input decided: the auth store flag, `me` restored from the persisted cache, `me` fetched this launch, or nothing; `me_network` means `me`'s `dataUpdatedAt` is at or after this JS runtime's start), `me_age_s` (age of `me` data; null without it) |
| `auth_session_lost` | A null session after a signed-in one, right before local data is cleared (fired before `resetUser()`, so it lands on the rider's person). Includes ordinary sign-outs. | `during_onboarding` (a step on record; the gate clears it whenever it opens (tabs), so a rider who signed in from the onboarding sign-in step does not count), `last_step`, `auth_event` (Supabase event: `SIGNED_OUT` or `INITIAL_SESSION`) |

`lastViewedScreen`, `lastViewedAt` and `codeStepPending` are new optional fields of the persisted
onboarding store with defaults, so a v9 state loads unchanged (no version bump; T13a owns v10).

### #365 T04c — `bike_setup_summary`

One event per visit to the bike-setup step (`trackOnboardingEvent`, so it also carries `variant`, `step: bike_setup`, `step_index`). A visit starts when the screen gains focus (first mount, or coming Back to it after Continue) and ends exactly once. Fired by `components/onboarding/bike-setup/use-bike-setup-telemetry.ts`; counters come from `make-grid.tsx` and `model-picker.tsx`. Counts and enums only: the typed search text is never sent. `bike_added` is unchanged.

| Property | Type | Notes |
|---|---|---|
| `outcome` | `completed \| skipped \| back \| left` | `completed` = Continue or a make-only quick chip; `skipped` = Skip; `back` = Back button, Android hardware Back or iOS swipe; `left` = the screen went away another way (stack replaced), the app sat in the background > 30 min (counted up to the moment it went away), or the process died during the visit (reported on the next mount of the step) |
| `duration_ms` | int | Visit start → leave, wall clock (a background under 30 min is included) |
| `make_queries` / `model_queries` | int | Searches started in the make / model search field: counted when the field goes from empty to non-empty, not per keystroke |
| `make_picked_via` / `model_picked_via` | `list \| search \| custom \| chip \| intent \| restored \| none` | How the selection on screen at leave was made: `list` = default list row (no query), `search` = a row of typed results, `custom` = "Other make" / "Use '<typed>'", `chip` = make-only quick chip (make only), `intent` = web→app pending intent, `restored` = bike draft from an earlier visit, `none` = nothing picked. Changing the make resets the model to `none` |
| `model_list_size` | int | Models loaded for the current make/year at leave (0 for a custom make or before a make is picked) |
| `model_fetch_ms` | int \| null | Duration of the last models fetch cycle that finished during the visit: from the first attempt to the final success or failure, so retries, the backoff between them and any offline pause are included (read from the query's `fetchStatus`); `null` when the list came from cache or no fetch finished |
| `year_changed` | bool | The year at leave differs from the year at visit start |

### #365 T05a

From 3.29.0, `paywall_present_requested`, `paywall_viewed` and `paywall_result` (and the `purchase_*` / `paywall_dismissed` / `subscription_restored` events built from them) also carry, on every surface including the onboarding paywall (props only; its behaviour is unchanged):

| Property | Values |
|---|---|
| `trigger` | `auto` (the app presented it: gates, limits, onboarding) \| `rider_tap` (an explicit Upgrade surface; today `profile_subscriptions_row`) |
| `gate_policy` | `none` until the T21 cap ships, then `capped_v1` |
| `session_paywall_index` | 1-based count of presents in the session; in memory, reset on cold start or after > 30 min in the background. A request that joins one already in flight is not counted |
| `minutes_since_onboarding_completed` | whole minutes since `onboarding_completed` in this app run; `null` if onboarding was not completed in this run |

These events are fired only by `apps/mobile/src/lib/subscription.ts` (guarded by `src/__tests__/paywall-event-call-sites-contract.test.ts`). The receipt-scan gate no longer fires its own `paywall_present_requested`; its paywall events carry `entry_surface` (the scan's launch surface, or `null`) next to `surface: use_pro_gate` and `limit_key: MAX_RECEIPT_SCANS_PER_MONTH`.

New event names, fired by T21 (constants only until then: `PAYWALL_GATE_EVENTS` in `packages/analytics`, `PAYWALL_GATE_EVENT` in `apps/mobile/src/lib/paywall-session.ts`; T21 (issue 430) moves them into `AnalyticsEvent` with their call sites and deletes the mobile map, since that catalog admits only constants that are fired):

| Event | Properties |
|---|---|
| `paywall_suppressed` | `feature`, `surface`, `reason: feature_cap \| session_cap \| error_cooldown` |
| `limit_sheet_viewed` | `feature`, `surface` |

## Metrics → PostHog definitions

- **Primary — install → trial start:** funnel `onboarding_started` → `paywall_result` where `paywall_result = purchased`. (Trial = purchase of the trial-bearing package; refine with RC webhook events if needed.)
- **Activation guardrail — bike-add rate:** funnel `onboarding_started` → `bike_added`.
- **Per-step drop-off:** funnel over `onboarding_step_viewed` filtered per `step` (use `step` property values in flow order per variant).
- **Trial→paid / retention / LTV:** RevenueCat events + PostHog cohorts on person property `onboarding_variant` (set at assignment, persists post-signup).
- **Exposure:** `$feature_flag_called` with `$feature_flag = onboarding_ab_2026`; offline-defaulted users carry `locally_defaulted: true`.

## PostHog Experiment (configured 2026-06-11, launched 2026-06-15)

[Experiment #83476](https://eu.posthog.com/project/155556/experiments/83476) — **running** (launched 2026-06-15 13:14 UTC), `filterTestAccounts: true`, exposure = `$feature_flag_called`. Metrics:

| Slot | Metric | Funnel |
|---|---|---|
| Primary | Install → trial start (purchase) | `onboarding_started` → `paywall_result` [`paywall_result = purchased`] |
| Secondary | Activation — bike added | `onboarding_started` → `bike_added` |
| Secondary | Paywall reach | `onboarding_started` → `paywall_viewed` |
| Secondary | Onboarding completion | `onboarding_started` → `onboarding_completed` |

**Native experiment caveats (read before launching):**

1. **`control` is at 0% rollout — 2-arm by decision (2026-06-15).** No holdout traffic, so PostHog's native lift-vs-control stats have no baseline; this is a `lean`-vs-`invested` test read via funnels **broken down by `onboarding_variant`** (the super property — attaches to every event, including `paywall_viewed`/`paywall_result`, which the wrapper-added `variant` does not). The dashboard [Onboarding A/B 2026 (738337)](https://eu.posthog.com/project/155556/dashboard/738337) tiles now all break down by `onboarding_variant`. Revisit `control` traffic only if absolute lift vs the old V4 flow is later needed.
2. **No real data until a release build ships.** PostHog is `disabled` under `__DEV__`, so production exposures are 0 until a release/TestFlight/EAS-production build carrying this branch reaches users. As of 2026-06-15 the flag's `last_called_at` IS populated and `$feature_flag_called` fires, but only from dev/QA devices — the A/B events (`variant`/`onboarding_variant`, `bike_added`, `account_created`) are in the taxonomy with dev-only volume. Don't read results until exposures per arm reach the hundreds.
3. **Already launched** (2026-06-15 13:14 UTC). `start_date` predates first real exposure because it was launched ahead of the release build — discount pre-release exposures when reading.

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
