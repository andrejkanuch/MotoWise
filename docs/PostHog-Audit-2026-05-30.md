# MotoVault — PostHog Implementation Deep Audit

**Date:** 2026-05-30 · **Scope:** mobile (`posthog-react-native`) + web (`posthog-js`) instrumentation, event taxonomy, and all 20 PostHog dashboards · **Method:** 17-agent audit team — 14 per-dashboard tile deep-dives, 1 event-taxonomy pass, 1 feature-flag-dashboard triage, 1 synthesis — cross-referenced against a 90-day event-volume query and verified against source.

---

## 1. Verdict

**PostHog cannot currently be trusted as MotoVault's single source of product truth — not because the data is bad, but because the dashboards on top of it are.**

The mobile event stream is broadly healthy and well-architected at the code level. The failure is a gap between *data quality* (decent for mobile core funnels) and *dashboard quality* (poor): of 14 hand-built dashboards, **only one ("Paywall & Conversion") scores above 3/5**, and several flagship/pinned dashboards are *actively misleading* — they render confident-looking numbers that are instrumentation artifacts, not product reality.

The headline risk: **a decision-maker reading these dashboards today would see false drop-off cliffs, fake 100%/0% conversions, and "dead" features that were simply never instrumented — and would make roadmap calls on noise.** Examples currently on pinned dashboards:

- **Executive "Activation Rate"** funnel is structurally inverted — step 1 (`user_signed_up`, 38 users) is *smaller* than step 2 (`onboarding_completed`, 103 users), because OAuth/Apple/Google sign-ups never fire `user_signed_up`.
- **Onboarding flagship funnel** reports a fake **12% completion** by measuring step names that were *retired* in the mid-May onboarding redesign.
- **Trip Planning Deep Dive** (pinned, tagged "north-star", described as "the dashboard to obsess over") has **8/8 tiles empty/broken/single-user** — `trip_created` = **1 user in 90 days**.
- **All three "Web —" dashboards** are pinned and **100% empty** — ~65 of 72 web custom events never fire, so they imply web is dead when it was never instrumented.

The good news: this is fixable. After patching **2 code bugs**, fixing **~3 funnels**, and deleting **9 dead dashboards**, this becomes a trustworthy ~4–5 dashboard setup.

---

## 2. Event Taxonomy Audit

### 2.1 Architecture (the part that's good)

Both clients are well-structured:
- **Mobile** (`apps/mobile/src/lib/analytics.ts`): one typed `AnalyticsEvent` registry (~130 events) funneled through a single `trackEvent()` wrapper with privacy opt-out, Meta-alias fan-out, and CSAT-survey triggers centralized. 214 call sites.
- **Web** (`apps/web/src/lib/analytics.ts` + `packages/analytics`): typed `WebEvent` registry (~72 events) with Zod-validated properties, DNT respect, dev-time schema validation.

Core mobile funnels — onboarding, paywall/RevenueCat, ride lifecycle, garage/expense/maintenance — all have real multi-user data and are trustworthy.

### 2.2 Instrumentation bugs (verified in source — fix these first)

| # | Event | Symptom | Root cause | Fix |
|---|-------|---------|-----------|-----|
| **B1** | `ride_viewed` | 190 events / **6 users** (~31×/user) — pollutes a flagship ride metric | `ride-detail.tsx:128` — `useEffect` deps are `[rideLoaded, rideId, ride]`; `ride` is a TanStack Query object whose reference changes on every refetch/re-render, so the effect refires | Depend only on a stable primitive: `[rideLoaded]` (it's already `ride?.id`) or `[rideId]` |
| **B2** | `rides_history_filtered` | 72 events / **2 users** | `rides.tsx:709` & `:925` — `trackEvent` fires *inside* the `setSortNewest` state-updater (double-invoked under StrictMode) with no debounce | Move `trackEvent` out of the updater; debounce sort toggles |
| **B3** | `purchase_started` | **0 data** despite being wired, leaving a permanent hole in the paywall funnel | Wired only in the *unused* custom `paywall-modal.tsx:40` + `upgrade.tsx:260`. The live flow is RevenueCat's native paywall (`subscription.ts`), which never emits it | Either remove the custom modal's funnel dependency, or emit `purchase_started` from the RevenueCat purchase handler; rebuild the funnel without it |
| **B4** | `screen_viewed` vs `$screen` | Duplicate screen tracking — `$screen` 17,651 vs custom `screen_viewed` 28 (0 in 7d) | `trackScreen()` → `posthog.screen()` (`$screen`) is canonical; `SCREEN_VIEWED` is a residual earlier attempt | Standardize on `$screen`; remove `SCREEN_VIEWED` |

> **Note on the apparent alias "mismatch":** `trip_viewed` (312) vs `trip_plan_viewed` (108) and `diagnostic_started` (14) vs `ai_diagnosis_started` (6) look broken but are **NOT bugs** — the Meta-alias code shipped mid-window (2026-04-27); the originals carry pre-alias history. 30d/7d windows confirm exact parity. See §2.5.

### 2.3 Dead events (defined in code, zero data in 90 days — 95 total)

This is the core of the "false information" problem: the schema claims to measure things it doesn't.

**Mobile — remove from code (never wired, no plan):** `quiz_started`, `quiz_completed`, `expense_deleted`, `trip_draft_saved`, `user_followed`, `user_unfollowed`, `tab_changed`

**Mobile — wire up (instrumentation gap on shipped surfaces):** `purchase_started` (B3), `ride_discarded`, `ride_auto_saved`, `ride_gps_readiness`, `ride_zero_distance_shown`, and the Rides Phase-0.5 set if shipped: `overview_viewed`, `rides_tab_scroll_depth`, `rides_overview_refreshed`, `record_badge_viewed/tapped`, `elevation_chart_viewed`

**Mobile — future features not yet shipped (keep defined, document):** `fuel_log_added`, `group_ride_joined/left`, `data_export_requested`, `subscription_restored`, `pb_toast_*`, `lean_angle_tooltip_opened`, `ride_flyover_exited/speed_changed`, `share_card_failed`, `share_result`, `trip_offline_removed`

**Web — ~65 of 72 events never fire.** Web is **autocapture-only today**: `$autocapture` (34,902), `$pageview` (425), `$web_vitals`, `$consent_granted` all flow, and only auth-form events fire (`sign_in_submitted` 10, etc.). Every defined funnel/engagement/checkout/builder/affiliate event was never called at its page/component site. **Decision required: wire them or delete the constants** — right now the web schema is fiction.

### 2.4 Single-user inflation (looks like signal, is one person — usually the developer)

`filterTestAccounts` is **off on every tile**, so the developer's own sessions drive every low-volume feature:

| Event | 90d events | users | Reality |
|-------|-----------|-------|---------|
| `ride_viewed` | 190 | 6 | + bug B1 |
| `rides_history_filtered` | 72 | 2 | + bug B2 |
| `share_card_swiped` | 39 | 1 | 1 person |
| `share_destination_tapped` | 33 | 1 | 1 person |
| `share_completed` | 33 | 1 | 1 person |
| `ride_map_style_changed` | 29 | 1 | 1 person |
| `ride_flyover_started` | 29 | 1 | 1 person |
| `ride_upgrade_cta_tapped` | 1 | 1 | "100% conversion" on Rides dash |

Also: a junk `bike_make = "Skate"` test record leaks into the Recalls breakdown.

### 2.5 Meta-alias double-counting

`META_ALIASES` (`analytics.ts:363`) fires a *second* capture alongside the original for 4 events (→ `ai_diagnosis_started`, `ai_diagnosis_completed`, `maintenance_log_added`, `trip_plan_viewed`). It works correctly, but **duplicates events into the primary PostHog stream** — anyone summing "diagnostic activity" across both names double-counts. These exist only for Meta Conversions API (MOT-211/212). **Route them to Meta's destination only, or tag `_meta_alias: true` and exclude from PostHog insights.** Always analyze on the *original* event name.

### 2.6 Naming inconsistencies

Five conventions coexist: snake_case (`ride_started`), PostHog Title Case (`Application Opened`), `$`-prefixed system (`$screen`), space-delimited survey (`survey shown`), and **dotted** web events (`review_softwall.shown` — the only dotted names). Pick one for custom events (snake_case), document the PostHog built-ins.

### 2.7 Property gaps

- `paywall_result` — confirm a single discriminating outcome property (`purchased/restored/cancelled/error/not_presented`) so the funnel branches without joining `rc_*`.
- `ride_viewed` — add `viewer` (owner vs visitor); the code already knows `isOwnerViewer`, so own-views can be segmented out.
- `share_result`/`share_completed` (when wired) — need `destination` + `success` or "shares" is an undifferentiated blob.
- `survey shown`/`survey sent` — add `survey_id` + trigger action so CSAT segments by `expense_added`/`maintenance_task_created`/etc.

---

## 3. Dashboard Audit

### 3.1 Scorecard

| Dashboard | Score | Verdict | One-liner |
|-----------|:---:|:---:|-----------|
| **Paywall & Conversion** (655463) | 4 | **KEEP** | Real view→purchase funnel (9.09%) + useful breakdowns. Fix mislabeled interval, dedupe 3 `paywall_viewed` slices, enable test-account filter. |
| Onboarding Funnel (636265) | 2 | **FIX** | Healthy events but flagship funnel measures *retired* step names → fake 12%. Rebuild on current steps, widen window. |
| Executive Overview — North Star (651619) | 2 | **FIX** | Activation funnel inverted; trip tiles fake a 98% drop. Rebuild to ~4 trustworthy KPIs. |
| Bike Features Adoption (679456) | 2 | **FIX** | Only `health_report_viewed` (19u) has signal; recalls/OEM (5–7u) padded into 6 redundant tiles + "Skate" junk. Collapse to 1 tile. |
| Rides Deep Dive (680821) | 2 | **FIX** | 8/10 tiles inflated/broken/empty. Keep completion funnel + rides-started trend; fix B1; demote from pinned. |
| Feature Usage Overview (636267) | 2 | **MERGE** | Dead series (`fuel_log_added` never fired). Fold adoption mix into Executive, delete. |
| Discovery & Trip Engagement (636268) | 2 | **MERGE/TRIM** | Discover signals real; trip funnel flat-zero + mislabeled (shared vs joined). Keep discover half. |
| Paywall & Revenue (636266) | 2 | **DELETE** | Duplicate of 655463; funnel permanently broken (`purchase_started` never fires); dismiss tile plots 2 identical series. |
| Retention & Engagement (651620) | 2 | **DELETE** | 4/5 tiles dead trip-based or broken HogQL; fake 100% churn. Salvage `Application Opened` tile → Executive. |
| Trip Planning Deep Dive (651637) | 1 | **DELETE** | Pinned "north star", 8/8 tiles empty/broken/single-user. `trip_created` 1 user/90d. Actively misleading. |
| Growth & Virality (651621) | 1 | **DELETE** | Every tile empty/broken; Web→App entry event never fires; sharers are 2–4 likely-dev users. |
| Web — Community & Auth (636880) | 1 | **DELETE** | Flat-zero; references uninstrumented events; mislabels app-wide events as "Web". |
| Web — Content Engagement (636879) | 1 | **DELETE** | 100% empty; queries web event names that never fire. Pinned. |
| Web — Conversion Funnel (636878) | 1 | **DELETE** | All 3 tiles dead; falsely implies 0% web conversion. Pinned. |
| 6× Generated flag dashboards (651623–27, 673595, 651624) | — | **DELETE** | All query `$feature_flag_called`, which has **0 rows project-wide** (flag-call capture is off in the SDK). Never viewed. |

### 3.2 Redundancy matrix (metrics covered by >1 dashboard)

| Topic | Appears in | Action |
|-------|-----------|--------|
| Paywall view→purchase | 655463, 636266, Executive | Keep 655463's working funnel; delete 636266's broken one. |
| Paywall views by surface/feature | 655463 (×3 tiles), 636266 | Collapse to one breakdown tile with a dimension toggle. |
| Feature adoption mix | Executive, 636267 | One canonical tile on Executive (on events that fire); delete 636267. |
| Trip funnel / unique planners | 636268, 651637, 651620, Executive | 4 dashboards slice the same dormant events. Keep ONE honest "trips adoption (low)" tile. |
| Trip share→join virality | 651621, 651637, 636268 | Same empty funnel ×3. Remove from all until shares clear ~15 users. |
| Onboarding→activation | 636265, Executive | Fix once on 636265 as canonical; Executive references it. |
| App-open / DAU | 651620, Executive | `Application Opened` (516u) is the only healthy retention spine — make it the canonical DAU/WAU/MAU tile. |
| Health-report / garage adoption | 679456, 636267, 636880 | Consolidate onto one garage dashboard. |

### 3.3 Merge plan

1. **Paywall & Conversion (655463) ← Paywall & Revenue (636266)** → "Monetization". Port any unique "Views by Source" tile, enable test-account filter, delete 636266.
2. **Executive (651619) ← Feature Usage Overview (636267)** → rebuilt ~4-KPI Executive (Daily Signups, Paywall→Purchase, App-open DAU/WAU, Feature Adoption Mix on events that fire). Delete 636267.
3. **Discover & Trips (single low-volume monitor) ← 636268 + 651637 + trip tiles of 651620** → keep only `discover_tab_viewed` + `discover_filter_applied` breakdown + ONE honest weekly trip-creator count. Move `Application Opened` DAU/WAU → Executive.
4. **Web dashboards (636878/636879/636880)** → no merge target; delete all three until web is actually instrumented.

### 3.4 Feature-flag dashboards — delete all 6

Decisive finding: **`$feature_flag_called` has zero rows across the entire project** — `send_feature_flag_events` is off in the mobile SDK, so these dashboards can never populate. Five flags still exist (untouched scaffolding); one (`survey-targeting-…`) is fully orphaned. Deleting a dashboard does **not** touch its flag. Going forward: prefer **Experiments** with goal metrics on real events (`paywall_viewed`, `onboarding_completed`) over auto-generated "Usage" dashboards; if you want flag-call analytics, enable `sendFeatureFlagEvents` first.

---

## 4. Coverage gaps (high-value questions nothing answers today)

1. **Activation by feature** — no trustworthy "% of new users reaching first value." The activation funnel is broken (B + OAuth `user_signed_up` gap), and the working downstream events (`expense_added`, `ride_started`, `garage_bike_added`) aren't wired into one.
2. **Real retention/stickiness** — no DAU/WAU/MAU or N-day retention on a reliably-firing event. `Application Opened` (516u) is the obvious spine but is used once and mislabeled.
3. **Expense & maintenance loops** — PostHog-validated as your *top* features (expenses, maintenance) yet no dashboard tracks their adoption / repeat-use / retention as a product loop.
4. **Web→app attribution** — entire web custom layer dark + `app_store_click` 1 user → acquisition funnel completely unobserved.
5. **Notification & permission funnels** — onboarding has a notifications step but nothing tracks prompt→grant/deny or push delivery→open. A core re-engagement lever is unmeasured.
6. **Error/friction** — `paywall_result = error` appears most weeks with no investigation tile; ride `started→ended→completed` ordering is inconsistent (`completed` 83 > `ended` 53) with no instrumentation-integrity monitor.
7. **RevenueCat revenue truth** — `rc_*` events are trustworthy but no dashboard shows MRR / active subs / churn; monetization stops at conversion %.
8. **A single honest feature-adoption leaderboard** — one tile ranking features by *unique users* so the team sees at a glance that expenses/maintenance/rides lead and trips/recalls/OEM lag.

---

## 5. Prioritized action plan

### Phase 1 — Stop the false signal (code, this week)
1. **Fix B1** `ride-detail.tsx:128` — change `useEffect` deps to `[rideLoaded]`.
2. **Fix B2** `rides.tsx:709,925` — move `trackEvent` out of the `setState` updater + debounce.
3. **Resolve B3** `purchase_started` — emit from the RevenueCat handler or drop it from the funnel.
4. **Enable `filterTestAccounts: true`** on all surviving dashboards + exclude the developer `distinct_id`. Clean the `bike_make = "Skate"` record.
5. **Stop showing** the Executive activation number and the 12% onboarding completion to stakeholders until fixed.

### Phase 2 — Cut the clutter (PostHog, this week)
6. **Delete 9 dashboards**: 6 generated flag dashboards + 3 "Web —" dashboards.
7. **Delete/unpin** Trip Planning Deep Dive (651637) and Growth & Virality (651621); strip trip tiles from Retention (651620) and Executive.
8. **Delete** Paywall & Revenue (636266) after porting any unique tile to 655463.

### Phase 3 — Rebuild the trusted core (PostHog)
9. **Fix Onboarding (636265)** — rebuild funnel on current step names (`onboarding_started → experience → goals → bike_setup → maintenance → notifications → paywall → onboarding_completed`), restrict to post-05-14, widen conversion window.
10. **Rebuild Executive (651619)** to ~4 reliable KPIs; add an `Application Opened` DAU/WAU stickiness tile.
11. **Trim Rides (680821)** to 2 trustworthy tiles; fix the start→end→complete ordering so the completion funnel is readable.
12. **Add missing tiles**: expense/maintenance retention loop, a unique-users feature-adoption leaderboard, a `paywall_result = error` investigation tile.

### Phase 4 — Taxonomy hygiene (code)
13. **Remove dead code events** (`quiz_*`, `expense_deleted`, `trip_draft_saved`, `user_followed/unfollowed`, `tab_changed`); document the unshipped future-feature set so the schema stops lying.
14. **Instrument `user_signed_up` across all auth providers** (OAuth/Apple/Google) — unblocks activation analysis.
15. **Decide on web**: wire the ~65 defined web events into their pages, or delete the constants.
16. **Route Meta aliases** to Meta's destination only (or tag + exclude from insights).
17. **Standardize naming**: drop `screen_viewed` (keep `$screen`), fix dotted `review_softwall.*` to snake_case.

---

## 6. Governance — keeping PostHog the source of truth

- **No dead events on dashboards.** Before adding a tile, confirm the event has >15 unique users in 90d; otherwise caption it "emerging — low volume."
- **`filterTestAccounts: true` by default**, and maintain a test-accounts cohort (the dev `distinct_id` at minimum).
- **One canonical dashboard per question.** Cross-dashboard references, not copies.
- **Schema = reality.** A defined event that hasn't fired in 90 days is either wired or deleted at the next touch — same ratchet philosophy as the i18n guard.
- **Prefer Experiments over generated flag dashboards**; enable `sendFeatureFlagEvents` if you want flag-call analytics.
- **Quarterly hygiene pass**: delete dashboards with `last_viewed_at = null` and re-run this volume query to catch new dead events / single-user inflation.

---

## 7. Implementation Log — 2026-05-30

Executed end-to-end on branch `refactor/mobile-audit-remediation` (code changes **uncommitted** in the working tree — review the diff before committing).

### Code (mobile) — typecheck ✓ · Biome ✓ · 332 tests ✓
- **B1** `ride-detail.tsx` — `useEffect` deps changed to `[rideLoaded, rideId]` (was refiring `ride_viewed` ~31×/user).
- **B2** `rides.tsx` — sort `trackEvent` moved out of the `setSortNewest` updater (was double-firing under StrictMode).
- **B3** — confirmed `purchase_started` can't come from the native RC paywall; resolved at the dashboard layer (broken funnel deleted with Paywall & Revenue). `paywall-modal.tsx` is dead code (flagged, not deleted).
- **Dead events removed** from `AnalyticsEvent` (0 call sites): `quiz_started`, `quiz_completed`, `expense_deleted`, `trip_draft_saved`, `user_followed`, `user_unfollowed`, `tab_changed`, `screen_viewed`.
- **Meta aliases** now tagged `_meta_alias: true` so PostHog insights can exclude them.
- **`user_signed_up` attribution fixed** — `oauth.ts` returns `{ isNewUser }` (derived from `created_at` vs `last_sign_in_at`); `login.tsx` + `register.tsx` now fire `user_signed_up` vs `user_signed_in` from the auth result, not which screen the button was on.

### PostHog
- **Deleted 13 dashboards**: 6 generated flag dashboards, 3 "Web —" dashboards, Paywall & Revenue (636266), Trip Planning Deep Dive (651637), Growth & Virality (651621), Retention & Engagement (651620). All soft-deleted (recoverable).
- **Test-account filter**: project `test_account_filters` now excludes the 3 internal distinct_ids (`65b941f3` = kanuchandrej / the 23.5k-event dev device, `4c1e6e05` = maitaiwo, `6fb4b88f` = test@test.com). `default_checked` already true.
- **Onboarding Funnel (636265)** rebuilt on the real current steps (`experience → goals → bike_setup → maintenance → paywall → notifications`). Verified live: **171 started → 30 completed (17.5%)**, real drop-off at Experience→Goals — replaces the fake 12% on retired step names.
- **Executive Overview (651619)** — all 8 tiles fixed: dead `trip_created`/`trip_shared`/`trip_published`/`diagnostic_completed` swapped for live events, activation funnels cleaned, WAU relabeled, all test-account-filtered.
- **`filterTestAccounts: true` + dead-series removal** applied across all remaining survivors: Paywall & Conversion (655463), Rides Deep Dive (680821), Bike Features (679456), Discovery (636268), Feature Usage (636267). The "Skate" junk make is now filtered out (it was the dev's test bike).

### Follow-up items 1–3 (completed 2026-05-30)
1. **Net-new tiles — done.** Created 4 test-account-filtered insights: *Feature Adoption Leaderboard (unique users, 30d)* + *Expense Logging Retention (weekly)* on Executive (651619); *Paywall Errors (weekly)* + *Subscription Activity — New/Renewal/Churn (weekly)* on Paywall & Conversion (655463). All verified to return real data.
2. **Dead web events — done.** Deleted the 28 `WebEvent` constants that had **no call site** (explore/trip/bike page-views, hero CTA, pricing, blog-list, feed/kudos, error/friction, search, second-page/return-visitor). Kept the 37 wired-but-dormant events + `CONSENT_GRANTED`. Web typecheck passes. (The wired events don't fire only because web traffic is low — they were NOT deleted.)
3. **`sendFeatureFlagEvents` — N/A (no action).** Confirmed the app has **zero** `getFeatureFlag`/`isFeatureEnabled`/`useFeatureFlag` calls, so `$feature_flag_called` can never fire and enabling capture is a no-op. The 5 PostHog flags (`onboarding-v2`, `paywall-timing-experiment`, `discover-tab-prominence`, `ride-recording-auto-detect`, `trip-social-features`) are unevaluated experiment scaffolding — **archive them when you confirm those experiments are abandoned, or wire one into code to run a real Experiment.** Left untouched (product decision).
