---
title: "feat: Growth do-now subtickets (MOT-269 activation→retention)"
date: 2026-06-29
type: feat
status: ready
origin: docs/Growth-Strategy-2026-06-29.md
linear: MOT-269 (MOT-270, MOT-271, MOT-272, MOT-273)
depth: standard
---

# feat: Growth do-now subtickets — fix the activation→retention leak (MOT-269)

## Summary

Execute the buildable **do-now** subtickets of Linear epic MOT-269 on a **single feature branch**, finishing each properly and marking it Done in Linear as it lands. The work attacks the diagnosed constraint — the "empty-garage cliff" (65% of bike-owners never take a 2nd action; ~80% one-and-done) — plus two cheap cleanups that protect downstream metrics, and it snapshots the current data baseline so we can re-measure in a month.

Scope is the four do-now tickets only. The next/defer tier (MOT-274…282) is intentionally excluded — those are blocked by their own acceptance criteria on data this work produces (e.g. the notification-permission grant rate from MOT-272).

- **MOT-271** — re-gate the iOS review prompt to a real value-moment (mobile code).
- **MOT-273** — close the expense view→log gap: fix a dead deep link + add prefilled quick-add, behind the `onboarding_ab_2026` flag (mobile code).
- **MOT-272** — instrument missing events (referral-skip, notification-permission, reminder lifecycle) + read the referral data already flowing (mobile code + PostHog read).
- **MOT-270** — code half already done (redundant `paywall-modal.tsx` deleted on mobile + web). Remaining is **production RevenueCat dashboard** work — prepared and verified here, then **flagged for the human to apply** (no autonomous archiving of live offerings, no stopping the running price experiment).
- Plus: a baseline snapshot doc and a 1-month re-check reminder.

---

## Problem Frame

The 2026-06-29 growth diagnosis (`docs/Growth-Strategy-2026-06-29.md`) found the constraint is **activation→retention, not acquisition**. Three sources converge: of 161 bike-owners, 105 (65%) never log a single expense/ride/service; ~80% are one-and-done; W4 retention ≈ 0%; WAU fell 5 weeks straight despite steady signups. The sharpest wedge: 29 users viewed the expense dashboard but only 15 ever logged an expense — friction, not intent.

These four tickets are the code-verified, ship-this-week interventions. They are small, target the constraint or unblock the measurement that gates everything after, and were each validated against live code during diagnosis.

---

## Scope Boundaries

**In scope:** MOT-270 (RC verification prep only), MOT-271, MOT-272, MOT-273; a baseline data doc; a 1-month reminder. All mobile changes land on one shared feature branch.

**Out of scope (deferred — blocked by their own acceptance criteria):** MOT-274 (ASO), MOT-275/278/279 (notifications/push — gated on the grant rate MOT-272 measures), MOT-276 (contextual paywall — gated on MOT-273), MOT-277 (content), MOT-280/281/282. These stay in Linear as backlog.

**Explicitly NOT doing autonomously:** stopping the running RC price experiment `prexpe16813d4b3`, archiving live RC offerings, or editing the production RC paywall template. MOT-270's remaining work is prepared + verified here and handed to the human to apply.

### Deferred to Follow-Up Work
- Wiring each new event into a PostHog dashboard tile is included (U5), but building the deferred-tier features that consume them is not.
- Server-side push, demo-garage, repricing — see the deferred Linear tickets.

---

## Branch & Working Model

- **Single branch** off the current `feat/next-work` HEAD, named `feat/growth-mot-269`. Branch from current HEAD so the already-applied `paywall-modal.tsx` deletions (MOT-270 code half) travel with this work.
- One commit per implementation unit (atomic), all on the one branch, opened as a single PR at the end.
- **Parallelization:** U1, U2, U3 touch disjoint files and can be implemented by parallel agents on the shared branch; U4 depends on U3; U5 depends on U2; U6/U7/U8 are docs/config and independent. Agents must stay within their unit's file set to avoid collisions (see each unit's `Files`).
- `pnpm precheck` (Biome + typecheck + test) must pass before the final push. The mobile i18n ratchet (`scripts/check-i18n-new-keys.ts`) blocks new `en.json` keys missing from any of the 13 locales — every new copy string must be added to all locales or the push is blocked.

---

## Key Technical Decisions

1. **StoreReview re-gate = milestone gating, not a rewrite.** Keep the existing `apps/mobile/src/lib/store-review.ts` MMKV counter + per-version suppression + `hasAction()`→`requestReview()` order (no `setTimeout` — a prior race was removed). Add a typed `milestone` argument and a real threshold; remove only the pre-value call sites. (origin learning: `docs/plans/2026-03-25-003-feat-mobile-ux-quick-wins-plan.md`.)

2. **Checklist deep link → route through a screen that owns `motorcycleId`.** `add-expense` *requires* a `motorcycleId` param; the checklist item is a param-less string pushed via `router.push(deepLink as Href)`. So the fix routes `first_expense` to the **expense-dashboard** route (which resolves the bike and whose empty-state CTA already pushes `add-expense` with `motorcycleId`), rather than to the bare `GARAGE` tab or directly to `add-expense` (which would submit with an undefined id). Changing a persisted checklist `deepLink` requires a **store version bump + migrate branch** to re-seed existing users.

3. **Quick-add is the real lever; the form is already minimal.** Research confirms `add-expense` already requires only amount + valid date (category defaults to `fuel`). So "shorten the form" is not heavy surgery — the lever is **prefilled quick-add chips** on the empty state (category + today's date prefilled, user types only an amount) plus the deep-link fix. Add-expense reads a new optional `category` param to prefill.

4. **A/B gate via the existing experiment module, not a new flag hook.** There is no generic `useFeatureFlag` util. Gate the quick-add variant with the synchronous `getOnboardingVariant()` from `apps/mobile/src/lib/onboarding-experiment.ts` (flag key `onboarding_ab_2026`, `EXPERIMENT_FLAG_KEY`). Enable `sendFeatureFlagEvents`/`$feature_flag_called` so exposures are analyzable.

5. **New events go in the `AnalyticsEvent as const` map and fire via `trackEvent`/`trackOnboardingEvent`** — never `posthogClient.capture` directly. Onboarding-screen events use `trackOnboardingEvent` so `{variant, step, step_index}` is preserved. Names are `snake_case`, siblings of existing keys. The derived `AnalyticsEventName` union needs no manual edit. (origin: `docs/onboarding-ab-event-schema.md`.)

6. **Data only lands in release builds.** PostHog is disabled under `__DEV__`. New events produce zero data from Metro/Expo Go — validate wiring via PostHog **Live Events** on a release/TestFlight build; do not read aggregates until production exposures accumulate. Every insight uses `filterTestAccounts: true`. The cold-start `posthog.reset()` identity guard (`prevUserIdRef` in `_layout.tsx`) must remain intact — referral-skip fires pre-auth and depends on it. (origin: `docs/solutions/integration-issues/posthog-onboarding-funnel-instrumentation.md`.)

7. **MOT-270 production RC changes are human-applied.** This plan produces a verification read (offerings, experiment arms, paywall trial copy) + an explicit "apply in dashboard" checklist. No tool autonomously stops the experiment or archives offerings.

---

## Implementation Units

### U1. Re-gate the iOS review prompt to a value-moment (MOT-271)

**Goal:** Stop the one-per-version review prompt from being spent during onboarding/add-bike; fire it only after a genuine value-moment, and make the dead threshold guard real. Slowly buries the visible 2.0★ US rating.

**Requirements:** MOT-271 acceptance criteria.

**Dependencies:** none.

**Files:**
- `apps/mobile/src/lib/store-review.ts` (modify)
- `apps/mobile/src/lib/__tests__/store-review.test.ts` (create — first test for this module)
- `apps/mobile/src/app/(onboarding)/personalizing.tsx` (remove call site ~line 259)
- `apps/mobile/src/app/(tabs)/(garage)/add-bike.tsx` (remove call site ~line 136)

**Approach:**
- Add a typed milestone param: `REVIEW_MILESTONE = { FIRST_EXPENSE, FIRST_MAINTENANCE_DONE, SECOND_CORE_ACTION, … } as const` (no magic strings). `maybeRequestReview(milestone: ReviewMilestone)` records the milestone on the `REVIEW_PROMPTED` event alongside the existing `{action_count, app_version}`.
- Replace the dead `count < 1` guard (line 33) with a real threshold (e.g. `count < 2` → return) so the prompt waits for a minimally-engaged user. Keep the increment, the per-version suppression (`review:version`), the in-flight guard, and the `hasAction()`→`requestReview()` order. Do **not** introduce `setTimeout`.
- **Remove** the two pre-value call sites (`personalizing.tsx`, `add-bike.tsx`). **Keep** the value-moment call sites (`add-expense.tsx:105`, `add-maintenance-task.tsx:103`, `complete-task.tsx`, `ride-summary.tsx`, etc.), updating each to pass the appropriate milestone.

**Patterns to follow:** existing MMKV counter + lazy `require('expo-store-review')` try/catch in `store-review.ts`; jest mock template in `apps/mobile/src/lib/__tests__/analytics.test.ts`.

**Test scenarios** (`store-review.test.ts`; mock `react-native-mmkv`, `expo-store-review`, `expo-constants`, `./analytics`):
- Below threshold (count 1) → does **not** call `requestReview`, does **not** emit `REVIEW_PROMPTED`.
- At/above threshold (count ≥ 2), fresh version, `hasAction()` true → calls `requestReview` once, emits `REVIEW_PROMPTED` with the passed milestone.
- Same app version already prompted → early return, no prompt.
- `hasAction()` false (e.g. Expo Go / null module) → no throw, no prompt.
- Concurrent calls → in-flight guard prevents a double prompt.

**Verification:** Fresh sim → complete onboarding + add a bike → **no** review prompt. Log first expense at threshold → prompt fires once. `pnpm --filter mobile test` green.

---

### U2. Instrument the missing lifecycle events (MOT-272 code)

**Goal:** Capture the events that are silent today so acquisition and the notification loop become measurable.

**Requirements:** MOT-272 acceptance criteria (events).

**Dependencies:** none (independent files from U1/U3).

**Files:**
- `apps/mobile/src/lib/analytics.ts` (add event constants to `AnalyticsEvent`)
- `apps/mobile/src/app/(onboarding)/heard-about.tsx` (`handleSkip` ~lines 88-93)
- `apps/mobile/src/app/(onboarding)/notifications.tsx` (`handleEnable` ~line 200)
- `apps/mobile/src/app/(tabs)/(garage)/add-maintenance-task.tsx` (onSuccess ~line 81)
- `apps/mobile/src/app/_layout.tsx` (notification response handler — `reminder_opened`)
- `apps/mobile/src/i18n/locales/*.json` (only if any new user-facing copy — none expected)

**Approach:** Add to `AnalyticsEvent as const`: `REFERRAL_SOURCE_SKIPPED: 'referral_source_skipped'`, `NOTIFICATION_PERMISSION_REQUESTED: 'notification_permission_requested'`, `NOTIFICATION_PERMISSION_RESULT: 'notification_permission_result'`, `REMINDER_SCHEDULED: 'reminder_scheduled'`, `REMINDER_OPENED: 'reminder_opened'`.
- `heard-about.tsx handleSkip` → `trackOnboardingEvent(REFERRAL_SOURCE_SKIPPED, OB_SCREEN.HEARD_ABOUT)` (keeps variant/step). Do not set `heard_from` (preserves first-touch semantics).
- `notifications.tsx handleEnable` → emit `NOTIFICATION_PERMISSION_REQUESTED` immediately before `requestPermissionsAsync`, and `NOTIFICATION_PERMISSION_RESULT` after with `{ permission_granted: boolean }` (mirror the existing `permission_granted` property shape) — via `trackOnboardingEvent`.
- `add-maintenance-task.tsx` onSuccess → `trackEvent(REMINDER_SCHEDULED, { stage_count, … })` after `scheduleMaintenanceReminder`.
- `_layout.tsx` notification response handler → `trackEvent(REMINDER_OPENED, { kind, stage })` from the payload (`{ motorcycleId, taskId, stage }` / `{ kind: 'document', … }`). Confirm the cold-start `posthog.reset()` `prevUserIdRef` guard is untouched.

**Patterns to follow:** `AnalyticsEvent` snake_case map; `trackOnboardingEvent` wrapper in `apps/mobile/src/lib/onboarding-analytics.ts`.

**Test scenarios:** lightweight — these are event emissions. If a store/util seam exists, unit-test that skip emits `REFERRAL_SOURCE_SKIPPED` and the permission flow emits requested→result with the right `permission_granted`. Otherwise `Test expectation: none — event-wiring on existing screens; verified via PostHog Live Events on a release build.`

**Verification:** Release/QA build → PostHog Live Events shows each new event firing with expected properties; identity stitching intact (events join the person post-signup).

---

### U3. Fix the checklist first-expense deep link + store migration (MOT-273a)

**Goal:** Tapping "log your first expense" lands on a screen that can actually log an expense, instead of the bare Garage tab.

**Requirements:** MOT-273 (deep-link fix).

**Dependencies:** none.

**Files:**
- `apps/mobile/src/stores/checklist.store.ts` (change `first_expense.deepLink`; bump `version`; add migrate branch)
- `apps/mobile/src/config/routes.ts` (add an expense-dashboard route constant if one doesn't exist)

**Approach:** Change `first_expense.deepLink` from `TAB_ROUTE.GARAGE` to the **expense-dashboard** route (`/(tabs)/(garage)/expense-dashboard`), whose empty-state CTA already resolves `motorcycleId` and pushes `add-expense` correctly. Do not point it directly at `add-expense` (it would submit with an undefined `motorcycleId`). Add a `TAB_ROUTE`/route constant for the destination (no magic route string). Bump the checklist store `version` (2→3) and add a `migrate` branch that re-seeds items so already-persisted users pick up the corrected deep link (mirror the existing v2 migrate that rebuilt items when "deep links changed").

**Patterns to follow:** existing `migrate` branch in `checklist.store.ts` (lines ~119-128); `as Href` typing in `onboarding-checklist.tsx:127` (never `as any`).

**Test scenarios** (`apps/mobile/src/stores/__tests__/checklist.store.test.ts` if present, else add):
- A persisted v2 store with the old `GARAGE` deep link migrates to v3 with the corrected deep link.
- Fresh store seeds `first_expense` with the corrected deep link.
- `Covers` the MOT-273 deep-link acceptance criterion.

**Verification:** Fresh sim → add bike → tap checklist "first expense" → lands on the expense screen with an add path (not the tab root). Existing user (persisted checklist) gets the corrected link after migration.

---

### U4. Prefilled quick-add chips on the expense empty state, behind `onboarding_ab_2026` (MOT-273b)

**Goal:** Cut taps between "I see value" and "first expense logged" by prefilling category + date so the user only types an amount. Gated for measurement.

**Requirements:** MOT-273 (quick-add + flag gating).

**Dependencies:** U3 (same expense flow; build on the corrected routing).

**Files:**
- `apps/mobile/src/app/(tabs)/(garage)/expense-dashboard.tsx` (empty-state `EmptyState`, ~lines 46-148)
- `apps/mobile/src/app/(tabs)/(garage)/add-expense.tsx` (read optional `category` param to prefill)
- `apps/mobile/src/lib/onboarding-experiment.ts` (reuse `getOnboardingVariant()`; no change expected)
- `apps/mobile/src/i18n/locales/*.json` (new chip labels — add to all 13 locales)

**Approach:** On the expense-dashboard empty state, render 2–3 quick-add chips (`QUICK_ADD_CATEGORIES = ['fuel','service','insurance'] as const`, reusing `EXPENSE_CATEGORIES`/`CATEGORY_LABELS` from `apps/mobile/src/lib/expense-constants.ts`) that push `add-expense` with `{ motorcycleId, category }` and today's date implied. `add-expense` reads the new optional `category` param (`useLocalSearchParams`) and prefills its `category` state; amount stays the only required input. Gate the chips behind `getOnboardingVariant()` (treatment shows chips; control keeps the single CTA) so lift is measurable. Use palette tokens, `borderCurve: 'continuous'`, reanimated enter < 300ms, copy via `t()`.

**Patterns to follow:** existing category chip row in `add-expense.tsx` (lines ~254-288); empty-state CTA push in `expense-dashboard.tsx` (lines ~101-109); variant read in `onboarding-experiment.ts`.

**Test scenarios:**
- `add-expense` with a `category` param prefills that category; without it, defaults to `fuel`.
- Treatment variant renders the chips; control renders the original single CTA.
- Chip tap navigates to `add-expense` with `{ motorcycleId, category }`.
- Edge: empty state with no bike → chips route through the bike-resolution path (no undefined `motorcycleId` submit).

**Verification:** Treatment build → empty state shows chips → "Fuel" → amount-only entry → save → `EXPENSE_ADDED` fires; `$feature_flag_called` recorded for `onboarding_ab_2026`. Control unchanged.

---

### U5. Read the referral data + wire dashboard tiles (MOT-272 read)

**Goal:** Produce the decision output MOT-272 exists for — which channel sends *activated* users — and wire the new events so they don't rot.

**Requirements:** MOT-272 (read + decision output).

**Dependencies:** U2 (events must exist; `referral_source_selected` already flows).

**Files:**
- `docs/Growth-Baseline-2026-06-29.md` (append the referral read + the exact query) — see U7
- PostHog (insights/dashboard tiles — external, via PostHog MCP)

**Approach:** Run a PostHog read (project 155556): `referral_source` (from `referral_source_selected`) bucketed by ISO week over 90d, cross-tabbed against `onboarding_completed` and `bike_added`, `filterTestAccounts: true`, EU+Americas, excluding `test@test.com` + Slovakia. Capture: referral-source coverage %, the skip rate (`referral_source_skipped`), and which channel leads activated users >2×. Wire one dashboard tile per new event so the schema-vs-reality ratchet holds. **Caveat:** new events only accumulate on release builds — record current `referral_source_selected` distribution now and note the new events are pending production data.

**Test scenarios:** `Test expectation: none — analysis + dashboard config, no app code.`

**Verification:** A saved PostHog insight + a 3-line written takeaway in the baseline doc (coverage %, leading channel, skip rate). If coverage < 50%, flag the post-paywall placement of `heard-about` for a follow-up.

---

### U6. RevenueCat paywall verification prep — human-applied (MOT-270 remaining)

**Goal:** Prepare and verify the production RC changes without executing destructive ones; hand the human an exact apply-checklist.

**Requirements:** MOT-270 remaining acceptance criteria.

**Dependencies:** none.

**Files:**
- `docs/Growth-Baseline-2026-06-29.md` (append an "RC apply-checklist" section) or a short note in the PR body.

**Approach:** Via the RevenueCat MCP (project `proj46e69448`, read-only): (a) enumerate the arms of running experiment `prexpe16813d4b3` and the current placement/offering; (b) list all offerings and mark which are arms/current (OFF-LIMITS) vs. clearly stale archive-candidates; (c) inspect the paywall template's trial copy vs. each product's `trial_duration`. Output a written checklist: "verify intro-offer-aware variable so 'free trial' only shows when a product has an intro offer; archive ONLY these unused offerings: […]; do not touch […]; experiment stays running." Do **not** stop the experiment, archive offerings, or edit the live paywall. Note the durable RC config facts from learnings (paywall unavailable in Expo Go → `paywall_result: skipped_expo_go`; `isAnonymous()` before `logOut()`; restore behavior = "Transfer to new App User ID").

**Test scenarios:** `Test expectation: none — production config verification, human-applied.`

**Verification:** Checklist present and unambiguous; experiment confirmed still running; code half (modal deletions) already done.

---

### U7. Baseline data snapshot + 1-month re-check reminder

**Goal:** Freeze today's funnel numbers + the exact queries so a re-measure in a month is apples-to-apples; schedule the reminder.

**Requirements:** "save current state" + "remind in one month" from the request.

**Dependencies:** none (U5 appends to the same doc).

**Files:**
- `docs/Growth-Baseline-2026-06-29.md` (create)

**Approach:** Capture the baseline: ~112 signups/30d; 400 accounts; bike-add 161/400 (40%); 2nd-action 56/161 (~35%); expense 29 view / 15 log; W4 ≈ 0%; WAU 166→54; trials 14/90d; trial→paid ~36%; 6 active subs / $29 MRR. For each metric, record the **exact source query** (PostHog HogQL / RC metric / Supabase SQL) used during diagnosis so re-running in a month is mechanical. Add a "Re-check on 2026-07-29" section listing what to compare and the success signals (W1 retention off the floor; 2nd-action rate > 35%). Then schedule a one-time reminder for **2026-07-29** to re-pull and compare (via the `schedule` skill / cron routine).

**Test scenarios:** `Test expectation: none — documentation + scheduled reminder.`

**Verification:** Doc exists with metrics + reproducible queries; a scheduled reminder for 2026-07-29 is confirmed created.

---

## Linear Status Updates (process, applied as units land)

As each ticket's units complete and verify, mark it Done in Linear:
- **MOT-271** → Done when U1 lands + tests green.
- **MOT-273** → Done when U3 + U4 land.
- **MOT-272** → Done when U2 lands + U5 read is captured (note: aggregate read pending production data).
- **MOT-270** → leave open / move to "In Review" with the U6 checklist attached (human applies the production RC step); the code half is done.

---

## System-Wide Impact

- **Analytics schema:** five new `AnalyticsEvent` keys; all must be wired to a dashboard tile (ratchet) and will only populate on release builds.
- **Persisted state:** checklist store version bump triggers a one-time migrate for existing users — verify no data loss on upgrade.
- **i18n:** new chip labels must exist in all 13 locales or the pre-push ratchet blocks the push.
- **Onboarding A/B:** U4 adds a treatment arm read off `onboarding_ab_2026`; confirm it doesn't collide with the existing onboarding variant assignment.

---

## Risks & Mitigations

- **Checklist deep link still can't carry `motorcycleId`** → mitigated by routing to expense-dashboard (owns the bike) rather than `add-expense` directly (KTD-2). Verify the dashboard resolves a bike when the user has exactly one and when they have several.
- **Reading data too early** → events only land on release builds (KTD-6); U5 explicitly records "pending production data" and reads only the already-flowing `referral_source_selected` now.
- **Identity stitching regression** → U2 must not touch the `posthog.reset()` cold-start guard; add a checklist line to confirm.
- **Parallel agents colliding on the branch** → unit file sets are disjoint (U1/U2/U3); U4 sequenced after U3. `add-maintenance-task.tsx` is touched only by U2.
- **Production RC mistake** → eliminated by making U6 verification-only + human-applied.

---

## Verification (overall)

`pnpm precheck` green; fresh-sim manual walkthroughs per unit; PostHog Live Events confirms new events on a release build; baseline doc + reminder in place; Linear tickets updated. Final: single PR from `feat/growth-mot-269`.
