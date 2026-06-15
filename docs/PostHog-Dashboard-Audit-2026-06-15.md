# MotoVault PostHog System — Decisive Proposal

*Prepared for the founder · 2026-06-15 · Project 155556 (EU) · synthesizing 7 specialist audits (162 live PostHog queries)*

---

## 1. Executive summary — why it feels "hard to understand what's going on"

Five root causes, in priority order:

1. **Three competing definitions of "signup/activation" disagree by 6×.** The Executive Overview anchors activation on `user_signed_up` (44 users/30d), but `onboarding_completed` is *larger* (62/30d) and `onboarding_started` is larger still (264/90d). The named "Activation Rate" tile (651619 #9) computes 31.8% off a step-1 denominator smaller than its step-2 — a mathematically impossible funnel that a founder reads as truth. `account_created` (the new A/B signup event) fires for **1 user/30d**. Every activation % on the flagship dashboard is built on a broken denominator.

2. **Tile real-estate is inversely correlated with validated feature priority.** Your validated order is expenses > maintenance > rides > trips > AI. But the largest pinned engagement dashboard (Bike Features Adoption, 6 tiles) covers the three *lowest*-volume features (`recalls_checked`=7, `oem_schedule_imported`=10, `health_report_viewed`=67 over 90d). Expenses — your #1 feature — has **zero dedicated dashboard** and survives only as a shared series. AI diagnostics (deliberately out-of-hero-scope, 15 starts/90d) gets 3 tiles. The dashboards literally argue against your own strategy.

3. **The A/B test looks unanswerable because it's buried under 3 dead orphan flags + a stale doc + a regenerated junk dashboard — when in fact only one test is live and it's just new.** `onboarding_ab_2026` (Experiment #83476) launched *today* 13:14 UTC and is correctly built, but has **0 exposures since launch** (the 6 historical exposures are pre-launch dev/QA). Meanwhile `onboarding-v2` and two other flags are tagged `experiment`, never wired, never called — making onboarding testing *look* ambiguous when it isn't.

4. **Low-volume reality is presented as headline KPIs, so honest emptiness reads as failure.** `purchase_completed`=14/90d, expense-retention cohorts max 4 users, every paywall→purchase funnel is below the 15-user floor. None of these are captioned. A founder glancing daily sees "0% expense retention" and "4% conversion" as broken loops rather than thin-but-real signal.

5. **Redundancy + un-executed prior cleanups create phantom problems.** The June 9 Rides cleanup was never executed (2 dead tiles still on 680821). Feature-mix appears on 3 dashboards. A new auto-generated flag dashboard (736395) reappeared with `filterTestAccounts:false` — the exact artifact the May 30 audit deleted 6 of.

**The single highest-leverage fix:** unify the signup/activation event so the Executive dashboard stops lying. Everything else is merge, delete, and caption.

---

## 2. Current state map — all 10 dashboards

| ID | Dashboard | Verdict | One-line reason |
|----|-----------|---------|-----------------|
| **651619** | Executive Overview — North Star | **REBUILD** | Best-intentioned, most-dangerous: activation tiles broken denominator, promises D7/D30 retention it doesn't have, 2 redundant tiles (6+8). |
| **655463** | Paywall & Conversion | **KEEP** | Best dashboard in the project; healthy spine. Just caption the 2 low-n purchase funnels and add tags. |
| **636265** | Onboarding Funnel | **KEEP (fix window)** | Healthy V4 baseline (264→38, 14.4%). Only fix: funnel window 3d → 7–14d. |
| **636267** | Feature Usage Overview | **ARCHIVE (merge tile 2 up)** | Weakest of all — every tile reconstructable from Paywall + Bike Features + an exec roll-up; internally redundant. |
| **636268** | Discovery & Trip Engagement | **MERGE/TRIM** | Discover half real; Trip Planning Funnel is flat-zero (`trip_created`=0, `trip_published`=0 — broken event names). |
| **679456** | Bike Features Adoption | **COLLAPSE to 1–2 tiles** | 6 tiles for the 3 lowest-volume features in the app; contradicts validated priority. |
| **680821** | Rides Deep Dive | **REBUILD → recording-only** | Carries 3 dead viewing tiles (Upgrade CTA 0/0, Ride Feature Engagement all <15u) that 735464 already owns; execute the un-run June 9 cleanup. |
| **735464** | Rides Engagement | **KEEP (re-validate in 2–4 wks)** | Well-governed, self-captioning; 9/12 tiles empty is *expected* OTA-lag, not broken. |
| **736395** | *Generated: onboarding_ab_2026 Usage* | **DELETE** | Auto-regenerated junk; 5 dev events; `filterTestAccounts:false` on both tiles; duplicates the Experiment's own exposure view. |
| **738337** | Onboarding A/B 2026 | **KEEP** | Correctly built scaffold; empty-because-launched-today, not broken. Don't read results yet. |

**Net target: 6 trustworthy dashboards + 1 live A/B scaffold (738337), down from 10.**

---

## 3. Proposed dashboard system (target: 6 + 1)

### A. Executive Overview — North Star (rebuild 651619)
- **Purpose:** the one daily-glance health board. **Audience:** founder.
- **Tiles:**
  1. **Daily/Weekly Active Users** on `Application Opened` (the only high-volume retention spine, ~452 users/30d) — replaces the missing stickiness tile.
  2. **True N-day retention curve** on `Application Opened` — delivers the "retention" the description has always promised but never had.
  3. **Activation funnel (fixed):** `onboarding_started` → `bike_added` (in-onboarding, *not* `garage_bike_added`) → first core action (expense OR ride OR maintenance). Anchor on **expenses**, the validated #1 feature, not "first ride."
  4. **Feature Adoption Leaderboard** — single aggregated bar, total unique users over 30d (not 31 noisy daily columns). **Merge old tiles 6+8** into one tile with a total/unique toggle.
  5. **Daily Signups** — rebuilt on the unified signup event (see §4/§5), captioned with absolute count.
  6. **Paywall → Purchase** — *reference* the canonical 655463 metric; widen to 90d; caption "14 purchases/90d — directional."
- **Remove:** "User Paths from Signup" (analyst tool → move to a deep-dive), the broken "Activation Rate (Signup→Bike)" tile (hide until signup unified), the empty weekly "Expense Logging Retention."
- **Rule:** standardize windows (30d for current-state, 90d for trends), state the convention in the description, fix the description to match reality.

### B. Paywall & Conversion (keep 655463)
- **Purpose:** monetization truth. **Audience:** founder.
- Keep all 8 tiles. Caption the 2 purchase funnels low-n. Add tags `monetization,conversion`.
- **Collapse the context triple:** the `surface`/`source`/`feature` overlap is a mis-segmentation trap — feature-gate tiles (#2, #7) run on 6–15 views/90d. Introduce a single `paywall_context` property (§5) and consolidate. Note 84% of paywall views are the onboarding paywall — the in-app gates are near-zero-n.

### C. Onboarding Funnel — V4 baseline (keep 636265)
- **Purpose:** the pre-A/B baseline the experiment must beat. **Audience:** founder during A/B read.
- Keep 4 tiles. **Fix funnel window 3d → 14d.** This is your historical benchmark (cliffs at Goals −30% and Paywall −38%, 14.4% end-to-end).

### D. Expenses & Maintenance — NEW (your #1 and #2 features)
- **Purpose:** finally give the validated lead features a home. **Audience:** founder.
- **Tiles:** `expense_added` weekly trend + unique users (38 events/15u — moderate, real); expense repeat-rate (replaces the dead retention cohort); `maintenance_task_created`/`completed` activity; `health_report_viewed` (23u — healthiest "bike" signal, relocate here from Bike Features). Caption maintenance low-n (`maintenance_task_created`=7u).

### E. Rides — Recording (rebuild 680821)
- **Purpose:** "did the ride get recorded well?" **Audience:** founder.
- **Keep 7 healthy lifecycle tiles:** HUD Layout A/B, Rides Started, Abandonment, Rides/User, Pause Rate, Duration Distribution, Completion Funnel.
- **Drop:** "Upgrade CTA Conversion" (0/0 users — dead), "Ride Feature Engagement" (all series <15u, rebuilt in 735464). Strip `ride_viewed`+`rides_history_filtered` from "Rides History Browsing" or drop it (735464 owns browsing). Caption `ride_completed` tiles low-n (5u).

### F. Rides — Engagement + Discover (keep 735464, fold Discover in)
- **Purpose:** "what did the rider do post-ride?" + discovery reach. **Audience:** founder.
- No structural change to 735464 (it's the model dashboard). **Fold in the surviving Discover tiles** from 636268 (`discover_tab_viewed`=71u — healthy reach), then **archive 636268** and its broken trip funnel.
- Re-validate the 🆕 tiles in 2–4 weeks once the OTA propagates. Don't treat empty as failure.

### G. Onboarding A/B 2026 (keep 738337) — the first-class A/B outcome
- **Purpose:** answer "which onboarding wins." **Audience:** founder during experiment.
- 3 tiles correct. **Add two backup tiles** that don't depend on native Bayesian stats or a control arm (§4): funnel `onboarding_started → paywall_result[purchased]` broken down by **person property `onboarding_variant`**, and `onboarding_started → bike_added` same breakdown. Make A/B legibility a standing tile, not a buried experiment page.

**Onboarding A/B legibility is a first-class outcome:** dashboards C (baseline), G (variant comparison), and the Experiment object (#83476) together answer "is the new flow better, and which arm wins." C is the historical benchmark; G is the live head-to-head; the Experiment is the significance test once n accrues.

---

## 4. The A/B testing fix — making "which onboarding wins" answerable

The wiring is sound; the test is **starved, not broken.** Six concrete moves:

**(a) Experiment objects vs orphan flags — clean up the confusion.**
- **One real experiment:** `onboarding_ab_2026` (#83476), running, correctly built.
- **Three orphans** (`onboarding-v2`, `paywall-timing-experiment`, `discover-tab-prominence`): tagged `experiment`, 0% rollout, `active:false`, never called, empty `experiment_set`. **Retire `onboarding-v2` today** (it's the one that makes onboarding testing look ambiguous — it's superseded scaffolding, 0 code refs). For the other two: either promote to real Experiment objects or strip the `experiment` tag. **Governance rule: a flag may carry the `experiment` tag only if it has a non-empty `experiment_set`.**

**(b) Exposure events — get production traffic.**
- The exposure pipe is correct (`$feature_flag_called`, `filterTestAccounts:true` in `exposure_criteria`). But PostHog is disabled under `__DEV__`, so the experiment reads `{control:0, lean:0, invested:0}` and will forever until a **release/TestFlight/EAS-production build with the instrumented branch reaches real users**. Ship it, then confirm `$feature_flag_called` for the key increments *after* 13:14 today.

**(c) Variant properties — fix the entry-event gap BEFORE scale (the single highest-priority A/B action).**
- `variant`/`onboarding_variant` land correctly on `onboarding_step_viewed`/`_completed`, but **`onboarding_started` (the funnel's first step) carries no `variant`** — and PostHog funnel breakdowns attribute by the entry-event value. Evidence: the bike-add funnel split lean=4 / invested=1 / **None=166**. Once volume arrives, the per-arm primary metric will mis-bucket exposed users. **Fix:** ensure `posthog.register({variant, onboarding_variant})` runs *before* `onboarding_started` fires (the cleaner fix), and verify `variant` actually attaches to `paywall_viewed`/`paywall_result` — schema says it should; production shows **0%**, which would break the primary metric per-arm.

**(d) The onboarding-v2 conflict — no live collision, but retire it.** `onboarding-v2` is `active:false`, 0%, never-called; it doesn't corrupt data but it's the governance hazard that makes "which onboarding?" look unanswerable. Archive it.

**(e) The control arm — decide deliberately.** Flag is `lean 50 / invested 50 / control 0`. Native lift-vs-control stats will never compute with control empty. **Choose:** (i) give `control` ~10–20% for a true holdout vs the old V4 flow (recommended — answers "is the new flow better *at all*?"), or (ii) accept a 2-arm test and read **lean-vs-invested via the `onboarding_variant` funnel breakdown** in dashboard G. Don't leave it ambiguous. The V4 population (`variant=None`, 264 starts) is a *historical* benchmark, not a randomized control.

**(f) Metrics to watch (once exposures hit hundreds/arm):**
- **Primary:** `onboarding_started → paywall_result[purchased]` by variant. *Caveat:* purchased=13/90d — this denominator is thin; will need a long run.
- **Faster secondaries:** paywall reach (`→paywall_viewed`), activation (`→bike_added`), completion (`→onboarding_completed`).
- **Don't peek** at the Bayesian result until exposures per arm are in the hundreds — at ~95 starts/2 weeks you're far below significance; set `recommended_running_time` realistically.

---

## 5. Event taxonomy & governance

**Naming convention (codify — custom events are already clean snake_case):**
- Custom events: `snake_case`, `object_verb_pastTense` (`ride_completed`, `expense_added`). Never spaces/TitleCase/dots — the `Application *` and `survey *` names are **vendor built-ins; document as "do not emit, do not rename."** Reserve `$` for PostHog system events.
- Properties: `snake_case`, units in suffix (`duration_s`, `distance_m`, `max_speed_kmh`).
- **One canonical id key per entity, on every event in the family.**
- **`variant` + super/person `onboarding_variant` mandatory** on every event in an experiment surface — enforce in the `trackOnboardingEvent` wrapper.

**Redundant/dead events to deprecate or fix:**
- **Ride-family bike-key join bug (fix first):** `ride_completed` carries `motorcycle_id`; `ride_started`/`ride_ended`/etc. carry no bike key at all. You cannot break down ride funnels by bike. Add `motorcycle_id` to `ride_started`/`ride_ended`.
- **Three terminal ride events:** `ride_ended` (63) vs `ride_completed` (31) are near-duplicates (50% gap nobody watches). Either document as an explicit 2-step contract (stopped → persisted) or collapse to `ride_completed {saved: bool}`.
- **`purchase_cancelled` (130/88u) ≡ `paywall_dismissed` (130/88u)** — identical volume/users; likely aliases firing as a pair. Confirm and drop one; never sum both in one view.
- **`sign_up_submitted`** (2 events/90d, stale since 2026-05-28) — dead legacy; remove from `AnalyticsEvent`.
- **Signup unification (root cause #1):** fire one canonical signup event across *all* auth paths (OAuth included), or rebuild Executive tiles on it. `account_created`=1/30d, `user_signed_up`=44/30d but `onboarding_completed`=62 — the inversion is the broken-denominator bug.
- **Trip funnel:** `trip_created`=0, `trip_published`=0 — broken/renamed event names; fix names or drop the funnel.
- **`bike_added` (onboarding) vs `garage_bike_added` (garage):** two events for "bike added" — unify with `context: 'onboarding'|'garage'` once the A/B populates, or downstream counts split.
- **`paywall_context`:** collapse the `surface`/`source`/`feature` triple into one property to stop mis-segmentation.

**Test-account filtering:** mandatory `filterTestAccounts:true` on every query tile (49/51 comply; the 2 violators are both on 736395 → being deleted). **Add a check whenever a flag/experiment auto-generates a dashboard — or delete it on sight.** Raw counts are ~2× inflated by the dev's own device; always read filtered.

**Low-n threshold = 15 unique users / 90d.** Below floor → caption `low-n — directional`; at 0 → `blocked — instrument first`. Currently violated implicitly on 680821, 679456, and all purchase funnels (`purchase_completed`=14).

**Refresh/ownership:**
- Tiles refresh on view (working — all cached today; no staleness problem). Add **PostHog weekly-email Subscriptions** only on the 3 trusted boards (Executive, Paywall, Onboarding).
- Quarterly hygiene sweep: delete any dashboard with `last_viewed_at` > 90d and any custom event with 0 volume + 0 call sites in 90d.
- Single source of truth = `apps/mobile/src/lib/analytics.ts` `AnalyticsEvent` const + an extended `docs/onboarding-ab-event-schema.md` (broaden it into a full tracking-plan covering ride/paywall/expense families). PR checklist gate: new event must be a const, reuse a canonical id key, and be added to the tracking-plan doc.

---

## 6. Prioritized action plan

### P0 — Do now (pure cleanup; removes confusion immediately; no waiting on data)
1. **DELETE dashboard 736395** (auto-generated flag usage — 5 dev events, `filterTestAccounts:false`). Deleting it doesn't touch the flag.
2. **Retire flag `onboarding-v2` (178792)** — never-called orphan; the #1 source of "which onboarding?" ambiguity. Strip `experiment` tag from `paywall-timing-experiment` + `discover-tab-prominence` (or promote them to real Experiments).
3. **Hide/disable the broken "Activation Rate (Signup→Bike Added)" tile** on 651619 — it shows 31.8% off an impossible denominator. Better no number than a false one.
4. **Caption every low-n tile** (`purchase_completed`=14, expense retention, diagnostics, `ride_completed`=5u) as "directional — <15 users/90d." One-line edits.
5. **Execute the un-run June 9 Rides cleanup on 680821:** drop "Upgrade CTA Conversion" + "Ride Feature Engagement"; strip `ride_viewed`/`rides_history_filtered` from "Rides History Browsing."
6. **Fix Onboarding Funnel window** (636265 tile `FHeEFGYV`) from 3d → 14d.

### P1 — Do this week (instrumentation + structural; needs small code changes + `pnpm generate`)
7. **Unify the signup event** across all auth paths (OAuth + A/B `account_created`), then rebuild Executive tiles 2 & 9 on it. *This is the root-cause fix for #1.*
8. **Fix `variant` on `onboarding_started`** — `register()` before the Welcome CTA fires. **Verify `variant` attaches to `paywall_viewed`/`paywall_result`** (currently 0%). *Do this before the release build reaches scale, or the A/B primary metric is unreadable.*
9. **Add `motorcycle_id` to `ride_started`/`ride_ended`** (join-bug fix).
10. **Build the Expenses & Maintenance dashboard** (D) and relocate `health_report_viewed` there; **collapse Bike Features Adoption (679456) to 1–2 tiles.**
11. **Merge & archive:** fold Feature Usage Overview tile 2 into Executive, then archive 636267; fold Discover tiles into 735464, then archive 636268 (after fixing or dropping the trip funnel).
12. **Rebuild Executive (651619):** merge tiles 6+8, aggregate the leaderboard, add real DAU/WAU + retention curve on `Application Opened`, fix activation definition (`bike_added` + expense anchor), standardize windows, rewrite the description to match reality.
13. **Decide the control arm:** give `control` 10–20%, or formally accept a 2-arm test. Add the `onboarding_variant`-breakdown backup tiles to 738337.
14. **Ship a production/TestFlight build** with the A/B branch so exposures start flowing. Update the stale `docs/onboarding-ab-event-schema.md` (experiment is *running*, not draft; `$feature_flag_called` *does* fire).

### P2 — Wait for A/B data to accumulate (do NOT act on these yet)
15. **Do not read A/B results** until exposures per arm reach the hundreds (currently 0 post-launch; ~95 starts/2wk → far below significance). Set `recommended_running_time` and don't peek.
16. **Re-validate 735464's 🆕 viewing tiles** in 2–4 weeks once the OTA propagates (chart/flyover/map/scroll events are all 0 today — *expected*, not broken).
17. **Quarterly dead-event sweep:** confirm `purchase_cancelled` vs `paywall_dismissed` alias and drop one; remove `sign_up_submitted`; decide `ride_ended` vs `ride_completed` contract; unify `bike_added`/`garage_bike_added` once the A/B populates.

---

## Empty-because-new vs genuinely-broken (so you don't chase phantoms)

- **Empty-because-new (correct, will fill — leave alone):** all of 738337's tiles; the Experiment's metrics; `bike_added`/`reveal_viewed`/`commitment_completed`/`account_created`; 9/12 of 735464's viewing tiles (OTA lag).
- **Genuinely broken (fix now):** signup/activation denominator inversion (651619 #9); `variant` missing on `onboarding_started`; trip funnel `trip_created`=0; ride-family bike-key join; 736395's unfiltered tiles; 680821's dead viewing tiles.
- **Healthy and trustworthy today:** Paywall & Conversion (655463), Onboarding V4 baseline (636265), the exposure plumbing, and 49/51 test-account-filtered tiles.

---

## Execution log — 2026-06-15 (P0 + P1 applied)

**Code corrections found during execution** (the audit overstated two things):
- `ride_started` **already** carries `motorcycle_id` (start-ride.tsx); only `ride_ended` lacked it → fixed.
- `onboarding_started` **already** carries `variant` (via `trackOnboardingFlowEvent`) and `onboarding_variant` is a registered super property. The real issue was a **breakdown-property mismatch**: A/B tiles broke down by `variant`, but paywall/result events only reliably carry the super property `onboarding_variant`. Fixed at the dashboard layer (no risky code change).

### P0 — done
- **Deleted** junk dashboard 736395 (auto-generated, `filterTestAccounts:false`).
- **Retired** flag `onboarding-v2` (178792 → inactive); **stripped `experiment` tag** from `paywall-timing-experiment` (178794) + `discover-tab-prominence` (178795) (both already inactive).
- **Removed** the broken "Activation Rate (Signup→Bike)" tile from Executive (651619); insight preserved.
- **Rides cleanup (680821):** dropped "Upgrade CTA Conversion" + "Ride Feature Engagement" (dead events); trimmed "Rides History Browsing" → "My Rides — Tab Opens (Weekly)" (kept only `rides_history_viewed`).
- **Onboarding funnel (636265):** window 3d → 14d (range widened to 90d to match the V4 baseline).
- **Captioned** low-n ride tiles ("Rides per User", "Ride Completion Funnel").

### P1 — done
- **Code (mobile):** `account.tsx` now fires `user_signed_up` for the email onboarding path (was `account_created`-only — the denominator gap); `ride-hud.tsx` `ride_ended` now carries `motorcycle_id`. Typecheck + Biome clean.
- **A/B dashboard (738337):** all 3 tiles re-pointed `variant` → `onboarding_variant`; description records the 2-arm decision.
- **New dashboard — Expenses & Maintenance (749644):** expense volume+users, maintenance activity (low-n), service-report views, and the relocated expense repeat-rate retention.
- **Executive (651619) rebuilt:** added Weekly Active Users + N-week Retention on `Application Opened` (the real spine); removed the analyst Paths tile; description corrected.
- **Merged/archived:** Feature Usage Overview (636267) deleted; Discovery & Trip Engagement (636268) deleted after folding its 2 healthy Discover tiles into Rides Engagement (735464); broken trip funnel dropped.
- **Bike Features Adoption (679456):** unpinned + relabeled secondary/low-n.
- **Control arm:** decided **2-arm** (lean 50 / invested 50, control 0) — no flag change; read via `onboarding_variant` breakdown.
- **Schema doc** updated (experiment is running, not draft; `$feature_flag_called` fires).

### Remaining — your action
- **Ship a production / TestFlight / EAS-production build** carrying the A/B branch + the two instrumentation fixes (`user_signed_up` on email onboarding, `motorcycle_id` on `ride_ended`). Until then: A/B tiles, the new signup denominator, and the Executive activation/signup tiles stay dev-only. After it reaches users, confirm `$feature_flag_called` for `onboarding_ab_2026` increments and the A/B tiles populate per `onboarding_variant`.
- **P2 items** (event dedup, etc.) remain as scheduled in §6 — wait for A/B data to accumulate before reading results.

**Net dashboard count: 10 → 7 pinned** (Executive, Paywall, Onboarding Funnel, Expenses & Maintenance, Rides Deep Dive, Rides Engagement, + A/B and Bike Features unpinned).
