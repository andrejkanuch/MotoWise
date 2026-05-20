# PRD: Onboarding Redesign v2

**Author:** Andrej (with Claude)
**Status:** Draft v1 — derived from brainstorm, ready for review
**Date:** 2026-05-11
**Companion docs:**
- Source brainstorm: `docs/brainstorms/2026-05-11-onboarding-redesign-brainstorm.md`
- Adversarial brainstorm pass: `docs/brainstorms/2026-05-11-onboarding-redesign-brainstorm-v2.md`
**Surfaces in scope:** `apps/mobile/src/app/(onboarding)/*`, Home tab post-onboarding checklist, RevenueCat dashboard configuration

---

## TL;DR

Mobile onboarding is a 13-screen funnel that was scoped for the original AI-diagnostics product, but the app has pivoted to ride tracking, expense management, and route discovery. PostHog data (Slovakia, last 30 days) shows 59.5% drop-off through the flow and a 44% cliff at the Experience step — the very first content screen. We replace the flow with a 6-screen, research-backed redesign that adds a multi-select Goals step (Headspace pattern), defers non-essential bike data to a post-onboarding checklist, auto-detects currency and measurement units from device locale, and personalizes the RevenueCat paywall offering by goal. The paywall stays inside onboarding because it converts at 25%. Target: lift onboarding completion from 40.5% to 70% and D1 retention from 8.1% to 15% without sacrificing paywall conversion.

---

## Problem Statement

The current onboarding flow asks new riders 13 sequential questions before they can use the app. Only 40.5% of users who start finish it (PostHog, 30d). The Experience step alone — the second screen, before any bike data — drops 44% of users. By the time we reach the paywall, only 22% of starters remain.

Three concrete failures drive this:

1. **The flow is mis-scoped for the current product.** It collects motorcycle make, model, type, photo, maintenance preferences, and learning formats — fields the pivoted product (rides / expenses / routes) does not depend on. `bikeModel`, `bikeType`, and `bikePhotoUrl` are already nullable in `CompleteOnboardingInput` and have zero downstream references in the expense or maintenance modules.
2. **There is no goals signal, so the paywall is generic.** Every user sees the same offering even though feature usage data shows three distinct intent clusters (rides-first 28.7 events/user, expenses-first 9.1 events/user, routes-first 2.2 events/user with widest reach). Generic paywalls underperform goal-matched ones by 10–20% in published case studies (Grammarly).
3. **The cost of friction here compounds downstream.** Of 142 installs, only 32 complete onboarding and only 14 return on Day 1. Onboarding is the single largest leak between install and active rider; every screen we keep that isn't earning its place costs us roughly 4–6% of cohort retention.

Underneath all three, the flow ignores a structural truth about new motorcycle apps: riders install with a *job in mind* (track this trip, log this fuel stop, find this weekend's route) and disengage when the app insists on a 13-step setup before that job can be done.

---

## Goals

1. **Lift onboarding completion from 40.5% → 70%** within 30 days of launch (stretch: 80%). Measured: `onboarding_completed / onboarding_started` in PostHog.
2. **Cut the Experience-step drop-off from 44% → under 15%** by reframing copy, fixing UX, and accepting that some portion is natural install-and-bounce.
3. **Lift D1 retention from 8.1% → 15%** by getting users to a usable Home state faster and adding a contextual post-onboarding checklist.
4. **Maintain paywall-to-purchase at 25%** (stretch: 30%) by keeping the paywall in-flow, personalizing the offering by goal, and unbundling benefits.
5. **Lift install-to-signup from 9.2% → 20%** by removing pre-signup friction the funnel doesn't need.
6. **Capture an explicit `ridingGoals` signal for ≥90% of new users** to power downstream personalization (paywall, checklist, Home tab ordering, future email).

---

## Non-Goals

1. **Not moving the paywall out of onboarding.** Progressive Reveal was considered and rejected — the existing 25% conversion rate is high enough that displacing it is an unacceptable risk for this redesign. Post-onboarding paywall placement is a future experiment, not a v1 change.
2. **Not refactoring the `CompleteOnboarding` mutation.** All bike fields are already nullable; we can ship the redesigned flow with zero API changes. Optimizing the mutation is out of scope.
3. **Not adding social or community signup (Facebook/Apple/Google) in this scope.** Auth provider work is independent and stays in its current state.
4. **Not localizing copy.** All onboarding copy ships in English; localization is a future workstream.
5. **Not changing the paywall product (RevenueCat remote paywalls).** We use the existing `react-native-purchases-ui` v9.12.0 integration. Personalization happens via multiple RC offerings mapped to goals, configured in the RC dashboard — no native paywall rebuild.
6. **Not redesigning the Garage / bike-detail screens.** Deferred bike fields (model, type, photo) are collected post-onboarding via the existing Garage flow; we wire deep-links into it but don't redesign it.
7. **Not building an email re-engagement loop.** Lifecycle email for onboarding drop-offs is a separate initiative.
8. **Not adding A/B test infrastructure in this PRD.** We ship the redesign as a hard rollout to the next app version, gated by `EXPO_PUBLIC_*` feature flag if needed for quick rollback, but not as a parallel A/B test. A/B tooling is a separate spec.

---

## User Stories

### New rider — first-session goal
- As a new rider who installed the app to track this weekend's ride, I want to skip detailed bike setup so that I can start recording within 30 seconds.
- As a new rider, I want to be asked *what I want from the app* in plain language so that the rest of the experience feels relevant to me.
- As a new rider, I want my currency and units inferred from my phone so that I don't have to make trivial choices.

### New rider — paywall surface
- As a rider who selected "Track my rides" as my goal, I want to see paywall benefits ordered around tracking so that the offer matches my intent.
- As a rider, I want to read what I'm getting before I see the price so that I'm evaluating value, not just sticker shock.
- As a rider who isn't ready to pay, I want a non-judgmental "Maybe later" path so that I'm not punished for entering the free tier.

### Returning rider — post-onboarding momentum
- As a rider who just finished onboarding, I want a checklist on Home so that I have a clear next step (record a ride, add a fuel expense, browse a route).
- As a rider, I want the checklist items ordered by the goals I picked so that the first item is the most likely to convert me into a Day-1 active user.
- As a rider, I want to dismiss the checklist when I'm done with it and still find it in Profile so that the Home tab stays clean.

### Power user / paid user — bike profile completion
- As a Pro subscriber, I want to be prompted to add my bike's model, type, and photo when I open the Garage so that my profile is complete without slowing down day-one usage.
- As a paid user, I want maintenance reminders to work without me having entered model/type at onboarding so that the value I'm paying for isn't blocked by deferred fields.

### Edge cases
- As a rider with a phone set to en-US, I want the app to default to USD and miles. As a rider with a phone set to en-GB, I want GBP and miles. As a rider elsewhere, I want the local currency and km.
- As a rider who lands on the paywall and force-quits the app, I want to come back to the same paywall (not restart the flow) so that I don't have to re-answer goals.
- As a rider who completes onboarding offline, I want my answers to be queued and submitted when the device reconnects so that I don't get stuck on the Personalizing screen.

---

## Requirements

### Must-Have (P0) — the redesign cannot ship without these

**P0-1. Reduce onboarding to 6 screens in the exact order: Welcome → Experience → Goals → Bike Setup → Paywall → Personalizing.**

Acceptance criteria:
- `ONBOARDING_SCREENS` in `apps/mobile/src/config/onboarding.ts` has exactly 6 entries.
- Removed screens (`bike-model`, `bike-type`, `bike-photo`, `currency`, `smart-maintenance`, `insights`) are deleted from the array and their route files removed.
- Step indicator shows "Step N of 6" everywhere.
- Back-navigation never re-enters a removed screen.

**P0-2. Add a Goals multi-select screen (new screen, position 3).**

Acceptance criteria:
- Heading copy: "What do you want from MotoVault?" — not "Select your goals."
- Options (multi-select, ≥1 required to continue):
  - Track my rides
  - Manage expenses
  - Discover routes
  - Maintain my bike
  - Just exploring
- Selection state persists via the existing `onboarding.store.ts` (Zustand + AsyncStorage) under a new `ridingGoals: string[]` field.
- Selected goals are sent to `CompleteOnboarding` mutation as `ridingGoals` (already accepted by `CompleteOnboardingInputSchema`).
- Multi-select UI matches existing pill-style component used elsewhere (see `apps/mobile/src/components/onboarding/`) — no new component library.

**P0-3. Reframe the Experience screen with conversational copy and three options.**

Acceptance criteria:
- Heading: "How long have you been riding?" — not "Select experience level."
- Three options with icons: "Just getting started" / "A few seasons in" / "Lifelong rider" (or the closest existing enum match in `ExperienceLevel`).
- Single-tap progression — no Continue button required after selection. Haptic feedback on tap (`expo-haptics`).
- Drop-off at this step is logged as a PostHog event `onboarding_experience_skipped` if a user backs out.

**P0-4. Consolidate Bike Setup to one screen with year + searchable make + prominent skip.**

Acceptance criteria:
- One scrollable screen contains: Year picker (defaults to current year), searchable Make input (existing component, NHTSA-backed), and "I'll add my bike later" link below the primary CTA.
- The skip link is visible without scrolling on a 5.4"-class device.
- Skip submits `bikeYear: null, bikeMake: null` and proceeds to the next screen.
- Continue submits the entered values; both `bikeYear` and `bikeMake` are independently optional at this step (the user can enter just a year, just a make, both, or neither).
- Model, type, photo are not collected here.

**P0-5. Auto-detect currency and measurement units from device locale; remove the Currency screen.**

Acceptance criteria:
- Currency derived from `Intl.NumberFormat().resolvedOptions().currency` with a hardcoded fallback to `USD` if unavailable.
- Mileage unit derived from locale region: `US`, `GB`, `LR`, `MM` → `mi`, all others → `km`.
- Both values are written to the onboarding store at app launch (not during onboarding) and submitted with `CompleteOnboarding`.
- A new Settings → Region row lets the user override both. Default override copy: "Auto-detected from your device."
- The previous Currency screen and its route file are deleted.

**P0-6. Paywall offering selected dynamically based on Goals (2 offerings at launch).**

Per the adversarial brainstorm pass: at current paywall volume (~28 views/30d), detecting a +10% lift across 4 offerings is statistically unreliable for months. Launch with the two highest-confidence goal clusters; promote the others on evidence.

Acceptance criteria:
- RevenueCat dashboard has **two** offerings at launch:
  - `motovault_pro_rides` — benefits ordered around ride tracking, GPS recording, ride history
  - `motovault_pro_routes` — benefits ordered around route discovery, offline routes, GPX
- Mapping logic in `apps/mobile/src/lib/subscription.ts` (or a new helper) selects the offering:
  - If `Track my rides` is in goals → `motovault_pro_rides`
  - Else if `Discover routes` is in goals → `motovault_pro_routes`
  - Else if `Maintain my bike` or `Manage expenses` is in goals → `motovault_pro_rides` (interim — most maintenance/expense users also track rides)
  - Else (only `Just exploring`) → `motovault_pro_rides` as default
  - Tiebreaker order when multiple match: rides > routes
- Paywall is invoked via `presentPaywall({ offering: <selected> })` using `react-native-purchases-ui`.
- Each offering on the RC dashboard lists benefits as individual rows (unbundled), benefits before price.
- If RC fetch fails, fall back to the existing default offering — never block the user on a failed paywall fetch.
- **Kill-switch:** if any offering's paywall→purchase rate drops below 15% for 50+ exposures, the mapping reverts that goal cluster to the highest-converting offering. Implementation: a remote-config flag per offering.
- A **maintenance** offering and a **general/exploring** offering are P1 — added once `motovault_pro_rides` and `motovault_pro_routes` each have ≥100 exposures and a measurable conversion delta.

**P0-7. Shorten Personalizing screen to 2.5s and remove photo upload.**

Acceptance criteria:
- Animation duration capped at 2,500ms total.
- `CompleteOnboarding` mutation fires on mount.
- No photo upload step — photo capture is deferred to the post-onboarding checklist.
- Meta attribution event still fires.
- If the mutation takes longer than 2.5s, the animation holds the final frame until it resolves, then progresses.
- If the mutation fails, surface a "Tap to retry" state — never silently strand the user.

**P0-8. Post-onboarding checklist on the Home tab.**

Acceptance criteria:
- A new persistent card appears on Home for users who just completed onboarding.
- Card displays 4–5 items, ordered by the user's `ridingGoals`:
  - If `Track my rides` → "Start your first ride" is item 1.
  - If `Manage expenses` → "Add your first expense" is in top 2.
  - If `Discover routes` → "Browse routes near you" is in top 2.
  - If `Maintain my bike` → "Complete your bike profile" is in top 2.
  - Always include: "Invite a riding buddy" as the last item.
- Each item deep-links into the relevant feature.
- Tapping an item that completes its prerequisite fires `checklist_item_completed` PostHog event.
- The card has a dismiss action ("Hide checklist").
- Dismissed checklist is re-accessible from Profile → "Resume onboarding checklist."
- Checklist visibility state is persisted on the user record (via a `home_checklist_state` JSONB column on `public.users`) so it survives reinstalls when the same account logs back in.

**P0-9. Analytics: track every step transition.**

Acceptance criteria:
- PostHog events emitted: `onboarding_started`, `onboarding_step_viewed` (with `step` property), `onboarding_step_completed` (with `step` and `duration_ms`), `onboarding_step_skipped`, `onboarding_completed`, `onboarding_abandoned` (fired on app close mid-flow), `paywall_offering_shown` (with `offering_id` and `goals`), `paywall_purchased`, `paywall_dismissed`, `checklist_item_completed`.
- All events include `experiment_variant: 'onboarding_v2'` for cohort comparison against pre-redesign data.

**P0-10. Feature-flag rollback path.**

Acceptance criteria:
- A single env-based flag (`EXPO_PUBLIC_ONBOARDING_V2_ENABLED`) gates the entry point. If false, the previous 13-screen flow runs.
- The flag is checked once at app launch; flips do not interrupt an in-progress onboarding session.
- The flag default is `true` in production builds shipped after launch; the previous flow code remains in the repo for one app version, then is removed.

### Nice-to-Have (P1) — improve experience but not required for launch

**P1-1. Goals → Home tab feed personalization.** Beyond the checklist, reorder the Home tab modules so the user's primary goal sits above the fold (e.g., ride-goal users see "Start a ride" CTA above "Discover routes").

**P1-2. Conversational error states.** If the user backs out of the Experience step or sits on a screen >45s, show a soft prompt: "Take your time — there's no rush." Source: Dollar Shave Club tone case study.

**P1-3. Subtle progress milestones.** At the Goals step, show "You're halfway there." At the Paywall, "Last step before we set things up for you." Pacing copy from Headspace.

**P1-4. Smart back-navigation.** If a user navigates back to Goals after the paywall, do not re-show the paywall after they re-confirm — jump straight to Personalizing. Saves a redundant decision.

**P1-5. Contextual bike-data prompts.** Promoted from P2 per the adversarial brainstorm. When a user starts their first ride, surface a one-tap prompt: "What bike are you on?" — pre-filled with their entered Make if present, allowing them to pick Model and Type without leaving the ride-start flow. When a user adds their first expense, similar prompt. Published research (Duolingo) shows contextual prompts convert at 2–3× the rate of persistent checklist items for profile-completion tasks. Acceptance: prompts fire once per missing field, dismissible, tracked via `contextual_prompt_shown` / `contextual_prompt_completed` events.

**P1-6. Expand RC offerings to 4 once volume supports.** Once `motovault_pro_rides` and `motovault_pro_routes` each clear 100 paywall exposures, add `motovault_pro_maintenance` and `motovault_pro_general` per the original brainstorm spec. Goal mapping updates to the four-way split.

### Future Considerations (P2) — out of scope but design with them in mind

**P2-1. Progressive Reveal experiment.** A future experiment may test moving the paywall out of onboarding and onto a contextual surface (e.g., on the third ride, on the first export, in the Home checklist). The current architecture should not preclude this — keep paywall invocation logic centralized in `subscription.ts`.

**P2-2. Lifecycle email for onboarding drop-offs.** Once we have email capture in onboarding (currently captured only at signup), trigger a drop-off recovery email to users who left at Experience or Bike Setup.

**P2-3. Goals editing in Profile.** Today, goals are write-once at onboarding. A future Profile screen should let users update goals, which would re-rank the Home feed and (optionally) re-evaluate paywall offering at next prompt.

**P2-4. Photo upload moved to bike-detail screen.** A "Take a photo of your bike" prompt should land in the Garage flow with a subtle reward (badge, completion confetti). Out of scope here but the post-onboarding checklist already includes "Complete your bike profile" as the deep-link target.

**P2-5. Localized copy.** All copy is English-only for v1. Architecture should not block i18n — strings in a single file, no inline strings in JSX where avoidable.

---

## Success Metrics

### Primary outcome metric

**Active riders per 100 installs goes from 5 → 8 within 90 days** (stretch: 10). Onboarding completion is a *means*; active riders is the *end*. If completion lifts but this metric stays flat, the redesign optimized a vanity metric and we revisit assumptions, not iterate copy. Measurement: PostHog cohort, count distinct users with ≥1 ride or expense or route view in days 1–30 post-install, divided by installs in the same cohort.

### Leading indicators (1–4 weeks post-launch)
| Metric | Baseline | Target | Stretch | Measurement |
|---|---|---|---|---|
| Onboarding started → completed | 40.5% | 70% | 80% | PostHog `onboarding_completed / onboarding_started` |
| Experience step drop-off | 44% | <15% | <10% | PostHog `onboarding_step_completed[experience] / onboarding_step_viewed[experience]` |
| Median time-to-complete | ~3.2 min | <90s | <60s | PostHog session duration over onboarding events |
| Goals captured per new user | N/A | ≥90% | ≥98% | Server-side: rows in `public.users` with `riding_goals != '{}'` |
| Bike setup completion rate (non-skip) | ~70% (across multi-screen) | ≥55% on single screen | ≥70% | PostHog `bike_setup_completed_non_skip / bike_setup_viewed` |

### Lagging indicators (4–12 weeks post-launch)
| Metric | Baseline | Target | Stretch | Measurement |
|---|---|---|---|---|
| D1 retention | 8.1% | 15% | 20% | PostHog cohort, day 1 active |
| D7 retention | (capture before launch) | +30% vs baseline | +50% | PostHog cohort, day 7 active |
| Install-to-signup | 9.2% | 20% | 25% | PostHog funnel |
| Paywall-to-purchase | 25% | 25% (maintain) | 30% | RC `subscriptions_started / paywall_shown` |
| Checklist 3+ items completed | N/A | 40% | 60% | PostHog `count_distinct(checklist_item_completed) >= 3` |
| Pro MRR from onboarding cohort | (capture) | maintain $/install | +20% $/install | RC × PostHog cohort |

### Counter-metrics — watch for regressions
| Metric | Threshold |
|---|---|
| Garage completion rate (users who eventually add model/type/photo) | Must not drop below current. Deferring fields without follow-through means we never collect them. |
| AI diagnostics weekly active users | Must not drop. Removing Smart Maintenance + Insights screens loses an awareness surface — watch usage. |
| Support tickets mentioning "wrong currency" / "wrong units" | Should not increase above pre-launch baseline. Locale-detection edge cases are a real risk. |
| Refund rate within 14 days of purchase | Must not exceed current rate. Goal-matched paywalls could oversell if the offering doesn't match delivered value. |

### Decision points
- **Week 1**: Verify analytics are firing correctly. No business decisions yet.
- **Week 2**: First read on completion rate. If <55%, run a 2-day investigation before declaring failure.
- **Week 4**: Full leading-indicator read. Go/no-go on shipping P1 items. Apply decision rules below.
- **Week 12**: Lagging-indicator read. Decide whether to expand (more goal-specific offerings, paid lifecycle email) or revert (if MRR per install drops despite completion gains).

### Week-4 decision rules

| Outcome at week 4 | Decision |
|---|---|
| Completion ≥70% AND active-riders/install ≥7 | Ship P1 items. Promote redesign to default. Begin P1-6 (expand to 4 offerings). |
| Completion ≥70% BUT active-riders/install <6 | We optimized the wrong thing. Pause expansion. Investigate retention, not onboarding. |
| Completion 55–70% AND active-riders/install ≥7 | Partial win. Investigate Experience-step drop in detail. Iterate copy. |
| Completion <55% | Major miss. Revert `EXPO_PUBLIC_ONBOARDING_V2_ENABLED` to `false` for new installs. Diagnose. |
| Paywall conversion <20% on any single offering | Pause that offering, route to highest-converting one. Don't tweak copy — collapse first, redesign later. |
| Garage completion (full bike data) <50% within 14 days of onboarding | Promote P1-5 (contextual bike-data prompts) to P0 for the next release. |
| Locale-override rate >10% | Auto-detection isn't working. Add a one-tap confirm step in onboarding ("Looks like you're in Canada — kilometers, right?"). |

---

## Open Questions

The brainstorm closed the four open questions it surfaced. These remaining ones are flagged for resolution before or during implementation.

| # | Question | Owner | Blocking? |
|---|---|---|---|
| OQ-1 | Should `ridingGoals` rewrite be allowed in Profile in v1, or strictly post-launch? | Product | Non-blocking — default to v1 read-only, future-proof the schema. |
| OQ-2 | Does the post-onboarding checklist live in the existing `home/` route as a new card component, or as a dedicated `home/checklist.tsx` modal? | Mobile eng | Blocking. Card pattern preferred for visibility; confirm in design. |
| OQ-3 | How long do we keep the legacy 13-screen flow code in the repo after launch? | Eng lead | Non-blocking. Default: one app version (~6 weeks), then delete. |
| OQ-4 | Is `home_checklist_state` JSONB on `public.users` the right place to store checklist progress, or should it be its own `home_checklists` table? | Backend eng | Non-blocking. Single-row JSONB is fine for v1; promote to table if we add multi-checklist features. |
| OQ-5 | The brainstorm assumes Slovakia-filtered PostHog data is representative of global behavior. Is the 44% Experience cliff a Slovak-cohort artifact (e.g., translation/cultural fit) or universal? | Data | Non-blocking but informative — pull a global cut before week-4 review to validate the redesign generalizes. |
| OQ-6 | If we deep-link to the Garage to complete bike profile, the Garage currently expects more flow context than a deep-link will carry. Does it need a "completion mode" entry point? | Mobile eng | Blocking for P0-8. Resolve in design pass. |
| OQ-7 | Locale auto-detection treats `en-IE` (Ireland) as metric — correct. But it treats `en-CA` (Canada) as metric by default, while many Canadian riders use mi. Do we accept that or hand-add `CA` to the imperial list? | Product | Non-blocking. Default: metric (matches federal regulation); add a 1-tap toggle on first ride. |
| OQ-8 | Do we need a confirmation step before submitting `CompleteOnboarding` if the user enters partial bike data, or do we silently accept? | UX | Non-blocking. Default: silently accept; the post-onboarding checklist will re-prompt. |

---

## Timeline Considerations

**Hard deadlines / dependencies**
- RevenueCat dashboard offerings must be configured *before* the build that contains P0-6 is submitted to TestFlight. Owner: monetization. Lead time: ~1 day.
- Supabase migration for `riding_goals` storage (column already exists on `public.users` per migration `00021_onboarding_revamp_schema.sql` and `00023_onboarding_redesign_preferences.sql` — verify column type matches `text[]`) and `home_checklist_state` JSONB column. Owner: backend. Lead time: 1 day, plus push via `npx supabase db push`.
- PostHog event taxonomy update — confirm dashboard events aren't renamed in a way that breaks historical funnels. Owner: data.

**Suggested phasing**
- **Phase 1 (Week 1):** Backend prep — verify `riding_goals` column, add `home_checklist_state` JSONB, deploy migration. Configure RC offerings in dashboard.
- **Phase 2 (Week 2):** Mobile — implement 6-screen flow behind `EXPO_PUBLIC_ONBOARDING_V2_ENABLED` flag. Wire Goals → RC offering selection. Wire analytics events.
- **Phase 3 (Week 3):** Mobile — implement post-onboarding checklist on Home tab. QA on iOS + Android. Locale auto-detect edge-case testing.
- **Phase 4 (Week 4):** Internal dogfood. Submit to TestFlight. Enable flag for 10% of new installs via remote config (if available) or via app version gating.
- **Phase 5 (Weeks 5–6):** Full rollout if metrics hold; remove legacy flow code after one app version.

**OTA vs binary**
- The redesign is large enough that we ship it as a binary release (App Store / Play Store), not an OTA update. Onboarding bundling cost and new dependencies make OTA risky. Subsequent copy tweaks and checklist content changes can ship via OTA.

---

## Implementation Notes (for the planner, not the spec consumer)

These are pointers the implementing engineer will need; not requirements.

- **Files to delete:** `apps/mobile/src/app/(onboarding)/bike-model.tsx`, `bike-type.tsx`, `bike-photo.tsx`, `currency.tsx`, `smart-maintenance.tsx`, `insights.tsx`.
- **Files to add:** `apps/mobile/src/app/(onboarding)/goals.tsx`, `apps/mobile/src/lib/locale.ts` (currency + unit detection), `apps/mobile/src/components/home/onboarding-checklist-card.tsx`, `apps/mobile/src/lib/checklist.ts` (item ordering by goals).
- **Files to edit:** `apps/mobile/src/config/onboarding.ts` (collapse `ONBOARDING_SCREENS`), `apps/mobile/src/stores/onboarding.store.ts` (add `ridingGoals: string[]`, remove deprecated fields), `apps/mobile/src/lib/subscription.ts` (goal → offering mapping), `apps/mobile/src/app/(onboarding)/personalizing.tsx` (shorten to 2.5s, remove photo upload).
- **Mutation:** No change to `CompleteOnboarding` — `ridingGoals` is already on the input schema (`packages/types/src/validators/onboarding-input.ts:29`). All bike fields are already nullable.
- **Migration:** Add `home_checklist_state jsonb` to `public.users`, default `'{}'::jsonb`. RLS policy: owner read/write only.
- **Codegen:** No `.graphql` changes — the mutation signature does not change. Run `pnpm generate` only if downstream models add fields.

---

## Companion Brainstorm

A sharpened adversarial review of the source brainstorm — surfacing risks, alternative paths, and weak assumptions — is available at `docs/brainstorms/2026-05-11-onboarding-redesign-brainstorm-v2.md`. Resolved risks from that pass are folded into this PRD's Open Questions and Counter-metrics.

---

## Next Steps

→ `/ce:plan` for engineering breakdown (Linear epic + sub-issues, sequenced by phase above)
→ Design: confirm Home checklist card pattern vs modal (OQ-2)
→ Monetization: configure four RC offerings before TestFlight cut
