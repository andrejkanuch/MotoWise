# MotoVault product analytics report — 2026-10-01

Timestamped snapshot of usage, retention, monetization, A/B tests and the ASO → active-user link.

**Sources.** PostHog project 155556 (EU), RevenueCat project `proj46e69448`, App Store Connect (`asc web analytics`, the web-dashboard source — do not mix with the Reports API numbers in older docs), iTunes lookup for ratings.

**How the PostHog numbers were built.** All figures are one-off derivations (the PostHog metric catalog is empty). Internal/test filters applied by hand: Slovakia excluded, `internal` persons excluded, test cohort 100593 excluded. "Last 30 days" = 1 Sep – 1 Oct. Platform is not a PostHog property; where a platform split is shown it is inferred from app version (3.19.0 = Play, 3.18.0/3.19.1 = iOS) or from the `platform` property on paywall events.

**Not covered.** Google Play Console data — the local `gplay` CLI is authenticated for a different app (Piel), so Play installs are estimated as PostHog installs minus App Store first-time downloads.

---

## 1. Headline numbers

| Area | Now (Sep 2026) | Reference |
|---|---|---|
| App installs (PostHog) | 314 | Aug 322, Jul 175, Jun 170 |
| Monthly active app users | 380 | Aug 376, Jul 215 |
| Weekly active users (avg, last 4 full weeks) | 113 | 65 in the 6 weeks before the ASO change |
| Returning weekly users (avg, last 4 full weeks) | 37 | 20 before the ASO change |
| Users doing a core action (expense, maintenance log or ride) per week | 18 | 6 before the ASO change |
| Installs still active after 7 days | 9.1% (Aug cohort) | 15.0% (Jul cohort) |
| Installs still active after 30 days | 4.1% (Aug cohort) | 8.1% (Jul cohort) |
| Active paid subscriptions | 11 (8 renewing, 3 set to cancel) | 8 at end of Aug |
| MRR | $55–60 | $35 at end of Aug |
| Revenue, September (gross) | $173 | Aug $82, Jul $27, Jun $120 |
| Web visitors | 3,044 | Aug 2,246, Jul 1,563 |
| App Store rating | US: 1 rating, 2★. DE: 2 ratings, 4.5★ | unchanged since August |

The short version: reach roughly doubled and held, a small base of returning users is growing, revenue had its best month — but about 92% of installs never do a core action in their first week, and retention of the larger August cohort was lower than July's.

---

## 2. Active users and the ASO changes

### Timeline of store changes

| Date | Change |
|---|---|
| 2026-07-29 | iOS 3.18.0 live: rebuilt keyword fields, expense-first subtitle, first promo text |
| 2026-08-10 | Play 3.19.0 live: store listing expanded from 13 to 46 locales |
| 2026-08-24 | Store-copy corrections merged (#212); onboarding A/B officially ended |
| 2026-08-31 | iOS 3.19.1 live: new promo text (CarPlay + receipt scanning), new "shipped" onboarding |

### Weekly series (week starting Monday)

| Week | iOS impressions | iOS page views | iOS first-time downloads | PostHog installs (both stores) | WAU | Returning | Core-action users |
|---|---|---|---|---|---|---|---|
| 06-15 | 508 | 29 | 16 | 38 | 83 | 18 | 8 |
| 06-22 | 395 | 33 | 9 | 33 | 60 | 21 | 5 |
| 06-29 | 361 | 30 | 10 | 46 | 70 | 23 | 6 |
| 07-06 | 343 | 33 | 6 | 35 | 56 | 20 | 4 |
| 07-13 | 546 | 61 | 12 | 44 | 64 | 18 | 7 |
| 07-20 | 430 | 25 | 8 | 34 | 57 | 21 | 6 |
| **07-27** (3.18.0) | 921 | 67 | 18 | 49 | 70 | 21 | 9 |
| 08-03 | 959 | 67 | 27 | 58 | 80 | 21 | 13 |
| **08-10** (Play 46 locales) | 1,274 | 114 | 39 | 92 | 122 | 27 | 15 |
| 08-17 | 1,028 | 65 | 23 | 79 | 111 | 28 | 13 |
| 08-24 | 1,045 | 67 | 17 | 65 | 92 | 29 | 14 |
| **08-31** (3.19.1) | 962 | 63 | 21 | 70 | 106 | 34 | 16 |
| 09-07 | 982 | 58 | 22 | 74 | 117 | 43 | 16 |
| 09-14 | 950 | 50 | 19 | 86 | 128 | 38 | 22 |
| 09-21 | 920 | 65 | 23 | 67 | 101 | 32 | 18 |

### Before vs after (trailing 6 weeks before 07-27 vs the 9 weeks after)

| Metric (per week) | Before | After | Change |
|---|---|---|---|
| iOS impressions | 431 | 1,005 | ×2.3 |
| iOS product page views | 35 | 68 | ×1.9 |
| iOS first-time downloads | 10.2 | 23.2 | ×2.3 |
| PostHog installs (both stores) | 38 | 71 | ×1.9 |
| Estimated Android installs (PostHog minus iOS downloads) | ~28 | ~48 | ×1.7 |
| WAU | 65 | 103 | ×1.6 |
| Returning users | 20 | 30 | ×1.5 |
| Core-action users | 6 | 15 | ×2.5 |

### Reading

1. **The 3.18.0 store update (keywords, subtitle, promo text) coincided with the iOS step-up.** Impressions doubled in the release week and never went back; the pre-change weeks ranged 343–546, the post-change weeks 920–1,274, so the ranges do not overlap.
2. **The Play 46-locale listing coincides with a second step in total installs** (58 → 92 in its release week; 3.19.0 installs have run 34–53 per week since). This is an estimate — there is no Play Console data in this report.
3. **3.19.1 did not add reach.** The four weeks after it average 954 impressions / 59 page views / 21 downloads against 1,045 / 76 / 25 in the five weeks before. That is inside normal week-to-week variation, so call it a plateau, not a drop. Impression→page-view rate slipped from 8.2% to 6.8% over the whole period.
4. **Active users follow installs, not retention.** In an average week ~70% of WAU are brand-new installs. WAU rose ×1.6 because installs rose ×1.9.
5. **The returning base is growing, slowly**: 20 → 37 per week over three months. This is the number that reflects product value; it is the one to watch.
6. **Retention of the larger cohorts is lower.** July installs: 15.0% alive after 7 days, 8.1% after 30. August installs: 9.1% and 4.1%. The extra reach (more locales, broader keywords) brought users who stay less. Numbers are small (26 of 173 vs 29 of 318), so treat as likely rather than proven.
7. **The May spike** (60 and 51 iOS downloads in the weeks of 05-18 and 05-25, WAU 213) left almost nothing: 5 of 254 May installs were seen after day one.

### Install cohort survival ("still seen N days or more after install")

| Install month | Installs | After 1 day | After 7 days | After 30 days |
|---|---|---|---|---|
| Jun | 170 | 8.8% | 7.6% | 5.3% |
| Jul | 173 | 20.8% | 15.0% | 8.1% |
| Aug | 318 | 16.0% | 9.1% | 4.1% |
| Sep | 312 | 15.1% | 6.4% (incomplete) | — |

PostHog's standard weekly retention (install → app opened) agrees: 8.4% of installs open the app in the following week, 4.0% in week 4.

---

## 3. Feature usage (last 30 days, distinct users)

| Feature | Users | Events | Notes |
|---|---|---|---|
| Add a bike | 223 | 266 | mostly inside onboarding |
| Discover tab | 114 | 189 | |
| Documents section | 95 | 340 | viewed often; only 3 users added a document |
| Ride recording started | 64 | 544 | 43 of them hit "ride too short" (122 times) |
| Ride completed | 26 | 434 | ~17 rides per user — the heaviest-use feature |
| Rides history / overview | 49 | 183 | |
| Review soft-ask shown | 41 | 42 | 24 positive, 17 negative |
| Diagnostics list viewed | 35 | 46 | |
| Expense dashboard | 31 | 57 | |
| Health report viewed | 31 | 90 | 10 generated |
| Receipt scan started | 27 | 43 | 7 completed, 3 saved |
| Expense added | 16 | 59 | flat vs prior 30 days (20) |
| AI diagnosis started | 14 | 22 | only 2 completed |
| Trips viewed | 14 | 25 | 5 created, 4 published |
| Recalls checked | 12 | 14 | |
| Maintenance log added | 11 | 31 | up from 5 |
| GPX download | 5 | 5 | |
| CarPlay nav hand-off | 0 | 0 | 5 users in 90 days |

Monthly users per core feature:

| Month | Expense | Maintenance log | Ride completed (rides) | AI diagnosis | Trip created |
|---|---|---|---|---|---|
| Jun | 9 | 8 | 3 (19) | 8 | 0 |
| Jul | 14 | 5 | 8 (80) | 6 | 0 |
| Aug | 21 | 5 | 18 (223) | 7 | 4 |
| Sep | 16 | 11 | 26 (432) | 14 | 5 |

Reading:

- **Ride recording is now the most-used and fastest-growing feature** (3 → 26 users, 19 → 432 rides in three months). This matches onboarding goals (track rides ~60%).
- **Expenses did not grow with installs** — 16 users in a month with 314 installs.
- **Three features lose most people mid-flow**: ride recording (64 start, 26 complete, 43 see "too short"), receipt scan (27 start, 3 save), AI diagnosis (14 start, 2 complete). These are completion problems, not discovery problems.
- **The features the 3.19.1 store copy leads with are the least used**: CarPlay 0 users, receipt scan 3 saves.

---

## 4. Which features go with users who stay

Installs from 1 Jun to 15 Sep (821 users). "Stayed" = still seen 14 or more days after install. Overall: 65 of 821 (7.9%).

| Did this in the first 7 days | Users | Stayed | Rate |
|---|---|---|---|
| Completed a ride | 28 | 17 | 61% |
| Added an expense | 30 | 13 | 43% |
| Started an AI diagnosis | 19 | 6 | 32% |
| Started a receipt scan | 31 | 10 | 32% |
| Viewed health report | 52 | 16 | 31% |
| Started a ride | 81 | 24 | 30% |
| Logged maintenance | 28 | 8 | 29% |
| Opened documents | 126 | 33 | 26% |
| Opened Discover | 169 | 35 | 21% |
| Completed onboarding | 251 | 42 | 17% |
| Created an account | 257 | 41 | 16% |
| Added a bike | 461 | 51 | 11% |
| **No expense, maintenance or ride** | **756** | **38** | **5%** |

- Users who complete a ride or log an expense in week one stay at 8–12× the rate of users who do neither.
- Only 65 of 821 installs (8%) do any core action in week one. That gap, not reach, is the ceiling on active users.
- This is correlation: people who intended to stay are also more likely to log something. It shows where value is felt, not that pushing everyone into a ride would produce 61%.

---

## 5. Onboarding and A/B tests

### State of experiments

| Item | State |
|---|---|
| `onboarding_ab_2026` (lean vs invested) | Started 2026-06-15, **ended in PostHog 2026-08-24**, but the flag is still at 100% and Android 3.19.0 users are still being split 50/50 (192 exposures since 31 Aug) |
| "shipped" onboarding | Live since 2026-08-25 on iOS 3.19.1; no onboarding paywall |
| `paywall-timing-experiment`, `onboarding-v2`, `discover-tab-prominence`, `ride-recording-auto-detect`, `trip-social-features` | Created 2026-04-29, all at 0% rollout, never run |

### Result of lean vs invested (official window, 15 Jun – 24 Aug)

| | Lean | Invested |
|---|---|---|
| Started onboarding | 220 | 201 |
| Completed onboarding | 89 (40%) | 57 (28%) |
| Purchased or started trial | 12 (5.5%) | 6 (3.0%) |
| Did a core action | 28 (12.7%) | 14 (7.0%) |
| Still active after 7 days | 31 (14.1%) | 25 (12.4%) |
| Still active after 30 days | 15 (6.8%) | 15 (7.5%) |

Lean is ahead on completion, purchase and core action; retention is a tie. Samples are small — the purchase difference (12 vs 6) is not conclusive on its own.

### Since 25 Aug: three flows side by side

| | Shipped (iOS 3.19.1) | Lean (Android) | Invested (Android) |
|---|---|---|---|
| Started | 134 | 121 | 96 |
| Completed onboarding | 93 (69%) | 52 (43%) | 36 (38%) |
| Created account | 93 (69%) | 58 (48%) | 40 (42%) |
| Saw a paywall | 21 (16%) | 84 (69%) | 62 (65%) |
| Purchased | 3 (2.2%) | 4 (3.3%) | 1 (1.0%) |
| Did a core action | 19 (14%) | 7 (5.8%) | 6 (6.3%) |
| Active after 7 days (of those eligible) | 11 of 115 (9.6%) | 9 of 94 (9.6%) | 6 of 82 (7.3%) |

This is not a controlled comparison — the flows differ by platform as well as design. With that caveat: the shipped flow completes far more often and produces more than twice the core-action rate, with a similar purchase rate despite showing a paywall to a quarter as many users. Seven-day retention is the same.

### Step-level friction (last 30 days, all flows)

- Onboarding completion: 163 of 300 starters (54%), up from 105 of 282 (37%) in the prior 30 days — driven by the shipped iOS flow.
- `maintenance` step: skipped by 103 of 111 who see it.
- `scan_receipt` step: skipped by 74 of 77.
- Android paywall results show **errors**: 14 users on the onboarding paywall and repeated errors on the AI gate (98 error events from 3 users) and bike-limit gate over 90 days.

---

## 6. Monetization

### RevenueCat

| Month | Gross revenue | Transactions | Active subs (end) | MRR (end) |
|---|---|---|---|---|
| Jun | $120 | 6 | 6 | $30 |
| Jul | $27 | 4 | 7 | $35 |
| Aug | $82 | 5 | 8 | $35 |
| Sep | $173 | 7 | 12 | $60 |

- Lifetime gross revenue: **$401** (App Store $266 / 18 transactions, Play $135 / 6). Proceeds Jun–Sep: $282.
- September was the best month, but it is two annual purchases ($79.99 iOS, $56.89 Play) plus monthlies. One sale moves the month.
- Active now: 11 subscriptions (8 set to renew, 3 set to cancel), 1 trial.
- Trials May–Sep: 33 started, 9 converted (27%). August: 0 of 8. September: 1 of 6.
- New customers paying within 7 days: 5 of 1,170 (0.43%) for Jun–Sep.
- Churn: 2 of 7 in August, 0 in September.
- Proceeds by country (Jun–Sep): US $179 (63%), Germany $41, Brazil $24, Italy $20, Denmark $8, India $6, El Salvador $6.
- Proceeds per install over the period: roughly $0.29.

App Store Connect (iOS only) agrees in shape: September proceeds $78 vs $28 in August; download-to-paid 1.2% at day 7.

### Where purchases come from (PostHog, 90 days, 26 purchase events incl. trial starts)

| Paywall | Users who saw it | Purchases |
|---|---|---|
| Onboarding paywalls (rides / default / routes / maintenance) | ~415 | 18 |
| AI diagnostics gate | 18 | 3 (all iOS, all in last 30 days) |
| Bike-limit gate (`MAX_BIKES`) | 36 | 2 |
| Profile / garage upgrade | ~60 | 3 |

- 69% of purchases happen inside onboarding, before the user has used anything.
- The AI gate converted 3 of 7 iOS users who hit it — the best rate of any surface, on a tiny sample.
- Overall paywall view → purchase: 25 of 429 users (5.8%), trials included.

### What paying users do (43 purchasers since April, trials included)

| | Users |
|---|---|
| Never did a core action | 23 (53%) |
| Not seen again after the purchase day | 21 (49%) |
| Active in the last 30 days | 16 |
| Added 2+ bikes | 17 |
| Used expenses | 14 |
| Used maintenance | 12 |
| Used AI diagnosis | 12 |
| Completed a ride | 10 |

Half of purchasers buy at the onboarding paywall and never return — that is where trial expiries and the August churn come from. The purchasers who stay are multi-bike owners using expenses, maintenance and AI.

---

## 7. Geography

| Country | Installs (90d) | Completed onboarding | Core-action users | Purchasers | Web visitors |
|---|---|---|---|---|---|
| US | 133 | 51 | 12 | 12 | 3,859 |
| India | 54 | 21 | 4 | 0 | 146 |
| Brazil | 48 | 12 | 0 | 0 | 106 |
| Mexico | 38 | 14 | 8 | 2 | 60 |
| Colombia | 37 | 16 | 4 | 0 | 67 |
| Spain | 31 | 9 | 3 | 0 | 64 |
| UK | 21 | 8 | 3 | 2 | 49 |
| Philippines | 21 | 11 | 1 | 0 | 104 |
| Canada | 19 | 8 | 0 | 1 | 374 |
| Italy | 19 | 9 | 3 | 1 | 10 |
| Germany | 18 | 11 | 2 | 1 | 13 |

The US is 17% of installs, about half of purchasers and 63% of proceeds. Brazil is the #3 install country with zero core-action users in 90 days. Mexico is the strongest non-US market by engagement (8 of 38).

---

## 8. Web → app

- Web visitors: 280 (May) → 3,044 (Sep). The US is the bulk of traffic.
- Store-button clicks: 143 users in September (4.7% of visitors). By page: home 91, blog 39, compare 12, feature 10. Android clicks outnumber iOS about 2.5 to 1.
- App Store sources for September page views: search 90, web referrer 40, app referrer 37, browse 23.
- `install_attribution_captured` fired for only 5 users in 30 days, so web-driven installs are still mostly unattributed.

---

## 9. Ratings

- US storefront: 1 rating, 2★. Germany: 2 ratings, 4.5★. Eight other checked storefronts: none.
- The in-app soft-ask now reaches users (41 in 30 days: 24 positive, 17 negative) and the native prompt fired for 25 — but storefront rating counts have barely moved since August.
- 17 of 41 answering negative is itself a signal worth reading.

---

## 10. What this adds up to

1. **Reach is no longer the constraint.** The ASO work doubled iOS reach and the gain held for nine weeks. More reach now adds mostly users who leave: August retention was lower than July's.
2. **First-week core action is the constraint.** 8% of installs log a ride, expense or maintenance in week one; those users stay at 30–60%, everyone else at 5%.
3. **Rides are the feature carrying engagement**; expenses are flat. Store positioning leads with expenses, CarPlay and receipt scanning.
4. **Android is still running an ended experiment with an onboarding paywall.** The shipped iOS flow completes at 69% vs ~41% and doubles core-action rate. Getting it onto Play is the largest available change.
5. **Monetization is real but tiny and fragile**: $55–60 MRR, 11 subscribers, 63% US. Most purchases happen in onboarding and half of those buyers never come back.
6. **Three flows leak after the user has already shown intent**: ride too short, receipt scan, AI diagnosis completion. Android paywall errors belong on the same list.

### Follow-up the same day (what the investigation changed)

The first draft of this report inferred platform from app version and treated 3.19.1 as iOS-only. That was wrong, and so was step 1 below as first written.

- **Android 3.19.1 already existed** on Play (version code 84) at a 20% staged rollout since 2026-08-25, never widened. The other 80% of Android users, including new installs, kept getting 3.19.0 with the lean/invested split and the onboarding paywall. The "shipped vs Android" table in section 5 therefore includes some Android users on the shipped side. **Rollout completed to 100% on 2026-10-01.**
- **Do not turn `onboarding_ab_2026` off yet.** In 3.19.0 a disabled flag sends users to `control`, an older flow that also has a paywall. Leave it until 3.19.0's share is negligible.
- **CarPlay is close to invisible in PostHog by construction.** `nav_handoff` is a phone event, not a CarPlay one. CarPlay rides are `ride_started` / `ride_ended` with `source = 'carplay'`, and only 4 such starts exist in 60 days. Nothing else on the head unit was instrumented, and before #247 a Start pressed on CarPlay could hang on the location prompt and never emit `ride_started`.
- **The Google Play "target API 36" warning** came from version code 8 (1.0.0, targets API 35) still active on the closed-testing track. Every production build since May targets 36. The track now carries version code 81; Google is reviewing that change.
- **Causes found for the three leaking flows** (fixed in the PR that carries this note):
  - AI diagnosis: the app blocked free users at submit, although the server and the store listing give one free diagnosis a month.
  - Rides: the summary sheet could be swiped away, which skipped `ride_completed` and stranded the ride; Discard never deleted the ride on the server. The "too short" sheet itself blocks nobody — its event fired twice and mislabelled the first.
  - Receipt scan: `receipt_scan_started` fires when the modal opens, before any photo, so most of the drop is people who never took one; scans that threw (timeout, network) left no trace.
  - Android paywall errors: a failed paywall showed nothing, so users tapped again (98 events from 3 users), and the cause was discarded.

### Second follow-up (same day)

- **Android paywall errors are mostly a country effect, not a configuration fault.** 104 of the ~140 Android error events in 90 days come from Madagascar (one rider produced 97 by re-tapping), with single cases from Russia and Iran; Google Play cannot sell there. Every active RevenueCat offering has its Play products attached. The alert added in #250 is the right response; nothing to fix in RevenueCat.
- **Receipt scan:** Retry after a failed upload now restarts the upload. It used to run the analyze step on a photo that was never stored and dead-end.
- **The 90 s client timeout on a scan stays.** It is deliberately shorter than the server's worst case (3 × 60 s); a retry is deduplicated server-side. Thrown scans are now measured (#250), so the number can be revisited with data.
- **Discarded or deleted rides** are also removed from the parked-sync store, so a later redrive cannot bring them back.
- **The five April flags that never ran are archived** in PostHog (`onboarding-v2`, `trip-social-features`, `paywall-timing-experiment`, `discover-tab-prominence`, `ride-recording-auto-detect`). No code referenced them.

### Suggested next steps, in order

1. ~~Ship the "shipped" onboarding to Android and turn off `onboarding_ab_2026`.~~ Done by completing the 3.19.1 Play rollout; keep the flag on (see above).
2. ~~Investigate "ride too short" and the Android paywall `error` results.~~ Done (#250 and above).
3. ~~Fix the receipt-scan and AI-diagnosis drop-offs.~~ Done in code; ships with the 3.20.0 store build.
4. Decide whether store positioning should lead with ride tracking.
5. ~~Delete the five April flags that never ran.~~ Archived.
6. ~~Authenticate `gplay` for MotoVault.~~ Not needed: the existing service account already reaches `com.motovault.app`. Play vitals return nothing at this install volume.

### Caveats to carry forward

- Every count here is small. Differences of a few users are noise; only the large gaps (reach ×2, core-action users 5% vs 30–60%, onboarding 69% vs 41%) are safe to act on.
- `signup_completed` jumped from 29 to 184 users because the event was added in late August, not because signups grew sixfold.
- `purchase_completed` in PostHog includes trial starts; RevenueCat is the source for money.
- ASC numbers here are from the web-dashboard endpoints and run ~8% above the Reports API figures in `docs/ASO-Snapshot-2026-08-24.md`.
