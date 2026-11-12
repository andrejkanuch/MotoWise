# V2 — Which riders come back? Returners against non-returners (#365)

Validation only, written 2026-11-12. Nothing was changed in the app, PostHog, RevenueCat, GitHub, Supabase or the stores.
PostHog project 155556 (EU), `execute-sql`, read-only. Supabase production was queried read-only (Management API, every
query wrapped in `BEGIN READ ONLY … COMMIT`), and only counts and ids were read: no emails or names. All PostHog figures are
noncanonical one-off numbers (the project has no governed metric catalog, evidence pack §0).

## Bottom line

1. **Starting a ride on day 0 is the strongest sign that a rider will come back.** Among riders who finished onboarding, 31 of 88
   who tapped Start on day 0 came back on day 2 (35%), against 27 of 279 who did not (10%): RR 3.6, Fisher p = 1e-7. Adjusted for
   goal, push permission, platform and day-0 logging, the odds ratio is 4.5 (95% CI 2.4–8.5). The link is not a side effect of a
   forgotten ride: only 2 of the 31 came back by opening a reminder, and only 2 came back just to end a ride left running. 14 of
   the 31 started another ride on day 2. [V2-q2, V2-q3]
2. **Goal `track_rides` works mostly through starting a ride.** On its own, `track_rides` gives OR 2.4 for day-2 return. Once
   day-0 ride start is in the model, it drops to 1.4 (CI 0.7–2.9). On the primary metric S1 (core action in week 1), goal splits
   the cohort sharply: **47 of 197 `track_rides` completers (24%) against 14 of 170 others (8%)**. So 77% of all S1 events come
   from that one stratum. [V2-q1, V2-q2, V2-q5]
3. **Pushes cannot be tested as a reason for return, because almost nobody gets one.** In week 1, 1 of 426 new DB users received
   a server push. Only 6 PostHog persons ever had a local reminder scheduled, and 9 ever opened one (almost all `ride_idle`). Riders
   who granted push permission do come back a little more often (35/171 = 20% vs 23/196 = 12%, p = 0.031). That fades to OR 1.7
   (p = 0.085) after adjustment, so it reads as a trait of the rider. No message is doing the work. **The missing lever is a
   re-engagement message.** Experiment 1's T34 is the first test of one. [V2-q1, V2-s2]
4. **First-session friction and monetisation do not separate returners, now checked on all 367 completers and not only on R6's
   100 replays.** Day-2 return by paywalls seen on day 0: none 26/132 (20%), one 24/178 (13%), two or more 8/57 (14%). By
   sign-in provider: Google 24/123, Apple 3/14, email 2/22 (no difference). By experience level, weekday or continent: no
   difference either. [V2-q1]
5. **Three new things change how Experiment 1 should be read:**
   - The UTC calendar-day definition of "day 2" is biased by install hour. Completers who installed between 00:00 and 05:59 UTC
     come back 5/76 (7%), everyone else 53/291 (18%), p = 0.013.
   - Riders who **signed in to an existing account** (they reinstalled, they are not new) come back 7/21 (33%). They are mixed
     into the "new rider" cohort.
   - October completers come back at half the August–September rate (12/128 = 9% vs 43/224 = 19%, p = 0.015). Season and the
     3.26.0 release cannot be told apart here, and the Experiment 1 window (Dec–Mar) is the low season.

   [V2-q1, V2-q4, V2-q5]

Confidence that the top-5 ranking below is right: **70%**. The ride-start finding is robust (p ≈ 1e-7, adjusted, mechanism
checked). The others are each p ≈ 0.002–0.03 among about 60 comparisons. **None of this is causal:** a rider who rides on day 0
may simply be a rider who rides.

---

## 1. Cohort and definitions

- **Cohort:** every app person (`$lib = posthog-react-native`) whose first event falls in **2026-08-14 → 2026-11-04**, after
  removing test and synthetic persons. **n = 793; 367 finished onboarding.** These counts match the evidence pack exactly
  (793 / 72 day-2 / 747 day-7-eligible / 50 day-7; completers 367 / 58) [V2-q1 `all`, `ob_done:1`; evidence pack §2].
- **Exclusions (V2-s1):** 13 PostHog persons. 26 Supabase user ids were collected: `is_synthetic`, `test@test.com`,
  `@motovault.app`, `@cloudtestlabaccounts.com` and `@priorises.com` addresses, and the 7 non-synthetic users soft-deleted on
  2026-11-10. They were mapped through `person_distinct_ids` and joined with the project's test-account filter (persons with
  `internal = true` and the 4 hard-coded person ids). The rule is the same as `queries/q00-excluded-persons.md`. This run found 13
  persons where q00 found 12, and the cohort totals are unchanged.
- **Returner (day 2)** = any `Application Opened` / `Application Became Active` / `$screen` on the UTC calendar day after first
  seen (the evidence-pack definition). **Returner (days 7–13)** = the same events on days +7…+13, counted only for persons first
  seen before 2026-10-29 (n = 747; completers 343).
- **Strata:** all persons, and **completers only**. Completing onboarding is itself a 4.8× split (58/367 = 15.8% vs 14/426 =
  3.3%). Any trait that comes with completion (goal, push step, bike, auth, day-0 screens) looks predictive across all persons
  for that reason alone. **The completer column is the one to read.**
- Each test compares a segment with everyone else in the same stratum: Fisher exact two-sided p and relative risk (RR), computed
  locally with scipy (counts below). With about 60 tests, expect 3 "p < 0.05" by chance. Only p < 0.001, or a result consistent
  with a second source, is read as solid. **Small-n** = fewer than 30 in the segment, or fewer than 5 events.

## 2. Queries

| Id | What | Source |
|---|---|---|
| V2-s1 | Synthetic, test and junk user ids → PostHog persons. Supabase: `SELECT id FROM public.users WHERE is_synthetic OR email ILIKE <test domains> OR email='test@test.com'` (21) ∪ `deleted_at::date='2026-11-10' AND NOT is_synthetic` (7) = 26 ids. PostHog: `SELECT DISTINCT person_id FROM person_distinct_ids WHERE distinct_id IN (<26>) UNION DISTINCT SELECT id FROM persons WHERE properties.internal = true` → 13 persons, including all 4 ids in the project test-account filter (`project-get`). | Supabase + PostHog |
| V2-q1 | Per-person feature build plus segment table. `f` = first event per person (window 04-01 → 11-13, HAVING first seen 08-14 → 11-04). `s` = sessions on day 0 (count, and the sum of each session's max−min seconds). `b` = per-person goal, experience, bike make/year/model, push result, reminder scheduled/opened, `referral_source`, first auth method and kind, completion, day-0 `$screen` count and distinct app areas (screen-name regex), day-0 ride/expense/maintenance/ride-start/garage-bike/diagnosis, day-0 paywall counts (any, and non-`onboarding%` placement), purchase. Then `ARRAY JOIN` segments → n, day-2, day-7-eligible, day-7, the same for completers. Platform fallback is the q02 build map. | PostHog |
| V2-q2 | Completers and non-completers, grouped by goal=`track_rides`, push granted, iOS, ≥3 sessions started on day 0, day-0 core action, day-0 ride start → n, day-2, day-2 in a new session, session started 24–48 h after first seen, day-2 with install ≥ 22:00 UTC, day-7. Logistic regression (statsmodels GLM, frequency-weighted) on the 59 cells. | PostHog + local |
| V2-q3 | Completers: how they came back on day 2. First non-lifecycle event on day +1, `reminder_opened` on day +1, ride ended or started on day +1, and same-day reopen (a session on day 0 that was not among the first-hour sessions and had activity more than 1 h after first seen). | PostHog |
| V2-q4 | Approximate local install hour: offset from `$geoip_time_zone` by region (Europe/Africa +1, US East −5 … Asia +4…+9, AU +10). DST is ignored, so this is ±1 h. | PostHog |
| V2-q5 | Completers: S1 (week-1 core action) by goal, platform and first auth kind. | PostHog |
| V2-s2 | Supabase: users created 08-14 → 11-04 (non-synthetic, not deleted) = 426. Distinct users in `maintenance_push_log` = 23 ever, **1 with a send within 7 days of sign-up**. Users with a `device_push_tokens` row = 55. | Supabase |
| V2-s3 | Supabase: first-day bikes by `motorcycles.type`: standard 130 users, other 129, dual_sport 13, cruiser 8, sportbike 7, touring 2, dirt 2, scooter 1. `engine_cc` is never set. **Bike segment is unusable** (98% are "standard"/"other"), so only make, year and model-picked are analysed. | Supabase |

## 3. Results: completers (n = 367, 58 back on day 2 = 15.8%; days 7–13: 44/343 = 12.8%)

Columns: segment n / day-2 returners / rate · Fisher p · RR against the rest of completers · days-7–13 n / k / rate · p.
Source V2-q1 unless marked otherwise.

### 3.1 Who they are (known by the end of onboarding)

| Segment | n | d2 | % | p | RR | d7 n | d7 | % | p |
|---|---|---|---|---|---|---|---|---|---|
| goal `track_rides` | 197 | 42 | 21% | **0.002** | 2.27 | 181 | 30 | 17% | 0.035 |
| goal `maintain_bike` | 72 | 3 | **4%** | **0.002** | 0.22 | 65 | 7 | 11% | 0.68 |
| goal `manage_expenses` | 44 | 7 | 16% | 1.0 | 1.01 | 44 | 5 | 11% | 1.0 |
| goal `just_exploring` | 42 | 4 | 10% | 0.37 | 0.57 | 41 | 2 | 5% | 0.14 |
| goal `discover_routes` (small-n) | 12 | 2 | 17% | 1.0 | — | 12 | 0 | 0% | 0.38 |
| experience beginner / intermediate / advanced | 153 / 128 / 86 | 27 / 19 / 12 | 18% / 15% / 14% | 0.47 / 0.77 / 0.74 | — | 144/120/79 | 20/16/8 | 14/13/10% | n.s. |
| push **granted** (onboarding) | 171 | 35 | 20% | 0.031 | 1.74 | 163 | 23 | 14% | 0.52 |
| push step seen, "Not now" | 188 | 23 | 12% | 0.063 | 0.63 | 172 | 19 | 11% | 0.34 |
| push denied (small-n) | 8 | 0 | 0% | 0.37 | — | 8 | 2 | 25% | — |
| iOS / Android | 127 / 240 | 26 / 32 | 20% / 13% | 0.097 | 1.54 | 119/224 | 17/27 | 14/12% | 0.61 |
| bike made < 2010 | 45 | 12 | 27% | 0.047 | 1.87 | 42 | 8 | 19% | 0.22 |
| bike 2023+ / 2018–22 / 2010–17 | 189 / 49 / 41 | 25 / 10 / 3 | 13% / 20% / 7% | n.s. | — | | | | n.s. |
| onboarding bike make+model / make only / no bike | 120 / 199 / 48 | 18 / 32 / 8 | 15% / 16% / 17% | 0.88 / 0.89 / 0.83 | ≈1 | 110/186/47 | 17/20/7 | 15/11/15% | n.s. |
| make HONDA | 59 | 15 | 25% | 0.033 | 1.82 | 57 | 9 | 16% | 0.51 |
| make KAWASAKI (small-n) | 22 | 0 | 0% | 0.033 | 0 | 20 | 2 | 10% | 1.0 |
| make BMW (small-n) | 16 | 0 | 0% | 0.087 | 0 | 15 | 2 | 13% | 1.0 |
| make group EU/US premium (BMW, KTM, Triumph, Ducati, Harley, …) | 48 | 2 | **4%** | 0.018 | 0.24 | 45 | 4 | 9% | 0.48 |
| make group Japanese big four | 155 | 27 | 17% | 0.47 | 1.19 | 144 | 23 | 16% | 0.15 |
| referral **`ai_chat`** | 62 | 18 | **29%** | **0.004** | 2.21 | 59 | 8 | 14% | 0.83 |
| referral `app_store_search` | 39 | 7 | 18% | 0.65 | 1.15 | 35 | 5 | 14% | 0.79 |
| referral `google_search` | 74 | 7 | 9% | 0.11 | 0.54 | 68 | 6 | 9% | 0.32 |
| referral Facebook + Instagram + TikTok | 41 | 2 | 5% | 0.041 | 0.28 | 40 | 5 | 12% | 1.0 |
| referral skipped | 92 | 18 | 20% | 0.25 | 1.35 | 83 | 11 | 13% | 0.85 |
| first auth = Google / Apple / email | 123 / 14 / 22 | 24 / 3 / 2 | 20% / 21% / 9% | 0.18 / 0.47 / 0.55 | — | 121/13/20 | 15/2/4 | 12/15/20% | n.s. |
| first auth event **`user_signed_in`** (an existing account) | 21 | 7 | **33%** | 0.033 | 2.26 | 21 | 6 | 29% | 0.039 |
| no auth event captured | 208 | 29 | 14% | 0.31 | 0.76 | | | | |

Two of these are new and need a word:

- **Install attribution:** `install_attribution_captured` carries no usable source. Its `$set_once.install_source` is null for
  341 and `organic_unknown` for 46 (V2 ad-hoc query). So the self-reported `referral_source` (the heard-about step) is the only
  attribution signal in the cohort.
- **`auth_kind`:** 208 of 367 completers have no auth event at all. The method split is therefore partial. The 21 sign-ins are
  riders reopening an account they already had, so they are not new riders.

### 3.2 When and where they installed

| Segment | n | d2 | % | p | note |
|---|---|---|---|---|---|
| install 00–05 UTC | 76 | 5 | 7% | **0.013** | the UTC "day 2" starts only 18–24 h later; see §5.3 |
| install 18–23 UTC | 102 | 23 | 23% | 0.037 | |
| local install hour 21–23 (approx., V2-q4) | 55 | 14 | 25% | 0.044 | other local buckets 10–18% (00–05: 5/41, 06–11: 16/91, 12–16: 10/100, 17–20: 13/80) |
| weekend install (Sat/Sun) | 105 | 15 | 14% | 0.75 | no weekday effect (Mon 9/56 … Sun 9/52) |
| month Aug / Sep / **Oct** / Nov (weather proxy) | 61 / 163 / **128** / 15 | 11 / 32 / **12** / 3 | 18% / 20% / **9%** / 20% | Oct vs Aug–Sep **p = 0.015** | October is also the 3.26.0 month (R6-q3: 3.26.0 completers 14/117 back), so season and version are confounded |
| continent EU / NA / AS / SA / AF | 81 / 98 / 84 / 72 / 24 | 13 / 14 / 14 / 11 / 5 | 16% / 14% / 17% / 15% / 21% | all > 0.5 | days 7–13: **South America 3/69 (4%), p = 0.016**; the others 12–19% |
| country US / BR / ES / IT | 58 / 15 / 10 / 9 | 7 / 2 / 0 / 3 | 12% / 13% / 0% / 33% | n.s. | all small-n except US |

### 3.3 What they did on day 0

| Segment | n | d2 | % | p | RR | d7 n | d7 | % | p |
|---|---|---|---|---|---|---|---|---|---|
| **started a ride** (`ride_started`) | 88 | 31 | **35%** | **1e-7** | 3.64 | 82 | 17 | 21% | 0.022 |
| saved a real ride (small-n) | 13 | 11 | 85% | <0.001 | 6.4 | 12 | 6 | 50% | 0.002 |
| added an expense (small-n) | 23 | 7 | 30% | 0.070 | 2.05 | 20 | 3 | 15% | 0.73 |
| logged maintenance (small-n) | 22 | 3 | 14% | 1.0 | 0.86 | 20 | 2 | 10% | 1.0 |
| any core action (ride/expense/maintenance) | 46 | 17 | 37% | **1e-4** | 2.89 | 42 | 10 | 24% | 0.044 |
| added a garage bike (mostly a re-add, evidence pack §1) | 120 | 27 | 22% | 0.021 | 1.79 | 119 | 17 | 14% | 0.61 |
| started a diagnosis | 47 | 6 | 13% | 0.67 | 0.79 | 39 | 4 | 10% | 0.80 |
| **≥ 3 sessions on day 0** | 55 | 25 | **45%** | **<0.001** | 4.30 | 53 | 14 | 26% | 0.003 |
| 1 session on day 0 | 256 | 26 | 10% | <0.001 | 0.35 | 239 | 26 | 11% | 0.12 |
| time on day 0 ≥ 15 min | 70 | 21 | 30% | 0.001 | 2.41 | 67 | 11 | 16% | 0.32 |
| time 2–5 min / 5–15 min | 119 / 163 | 11 / 25 | 9% / 15% | 0.021 / 0.89 | | | | | |
| ≥ 50 `$screen` on day 0 | 35 | 13 | 37% | 0.001 | 2.74 | 31 | 11 | 35% | 0.001 |
| 10–24 screens | 178 | 13 | 7% | <0.001 | 0.31 | 165 | 11 | 7% | 0.001 |
| ≥ 5 app areas visited (home, garage, rides, discover, profile, diagnose, expense, maintenance) | 159 | 34 | 21% | 0.014 | 1.85 | 149 | 25 | 17% | 0.072 |
| paywalls viewed on day 0: 0 / 1 / ≥ 2 | 132 / 178 / 57 | 26 / 24 / 8 | 20% / 13% / 14% | 0.14 / 0.26 / 0.84 | — | 131/159/53 | 19/17/8 | 15/11/15% | n.s. |
| non-onboarding paywalls on day 0: 1 / ≥ 2 | 33 / 32 | 2 / 7 | 6% / 22% | 0.14 / 0.32 | — | | | | n.s. |
| purchase in week 1 (small-n) | 15 | 4 | 27% | 0.27 | 1.74 | 15 | 2 | 13% | 1.0 |
| reminder opened, ever (small-n) | 8 | 6 | 75% | <0.001 | — | 8 | 4 | 50% | 0.011 |
| reminder opened on day 0 or 1 (small-n) | 5 | 3 | 60% | 0.030 | — | | | | |

Two of these rows depend on how they are defined. "Sessions" and "time" count every PostHog `$session_id` on day 0, onboarding
included, and time is the sum of each session's last event minus its first. "Areas" excludes onboarding and auth screens. Every
reminder open is a `ride_idle` (39), `END_RIDE` (1) or maintenance (1) open, so it marks a ride in progress, not a re-engagement
message (V2 ad-hoc value query).

### 3.4 Across all 793 persons (for completeness)

The all-person column repeats the completer results, made larger by completion: `auth:google` 25/142 vs `auth:none` 42/611,
`push:granted` 35/176 vs never saw the step 13/413, ride started 31/89 vs 41/704, and so on (V2-q1). One all-person-only result
is worth noting: persons with no bike year (mostly non-completers) return 14/264 (5%). Nothing in the all-person view changes the
ranking.

## 4. Which predictors hold up together (completers, V2-q2 logistic regression, n = 367)

| Model | track_rides | push granted | iOS | day-0 core | day-0 ride start | ≥3 day-0 sessions |
|---|---|---|---|---|---|---|
| traits only | **OR 2.38** [1.27, 4.46] p = 0.007 | 1.72 [0.95, 3.10] p = 0.071 | 1.73 [0.96, 3.09] p = 0.066 | | | |
| + day-0 actions | 1.44 [0.73, 2.85] p = 0.29 | 1.73 [0.93, 3.22] p = 0.085 | 1.88 [1.00, 3.53] p = 0.050 | **2.79** [1.31, 5.93] p = 0.008 | **4.48** [2.35, 8.53] p < 0.001 | |
| + sessions | 1.33 p = 0.42 | 1.74 p = 0.094 | 1.76 p = 0.091 | 2.14 p = 0.064 | **3.44** [1.75, 6.76] p < 0.001 | **4.03** [1.97, 8.24] p < 0.001 |
| days 7–13 (n = 343), traits + day-0 actions | 1.67 p = 0.16 | 1.05 p = 0.89 | 1.20 p = 0.60 | 1.93 p = 0.13 | 1.85 p = 0.089 | |

Cross-tabs from the same cells:

| | ride started on day 0 | no ride start |
|---|---|---|
| goal `track_rides` | **27/68 (40%)** | 15/129 (12%) |
| other goals | 4/20 (20%) | 12/150 (8%) |

| | push granted | not granted |
|---|---|---|
| `track_rides` | 24/109 (22%) | 18/88 (20%) |
| other goals | 11/62 (18%) | **5/108 (5%)** |

Push grant only matters for riders whose goal is not `track_rides`. Among `track_rides` riders it adds nothing (22% vs 20%), so
it reads as a sign of intent in the less-engaged goals.

**How riders who started a ride came back (V2-q3).** Of the 31 completers who started a ride on day 0 and came back on day 2:

| What happened on day 2 | Riders |
|---|---|
| opened a reminder | 2 |
| ended a leftover ride without starting a new one | 2 |
| started another ride | 14 |

Same-day reopen (a separate session more than 1 h after install): 17 of 28 ride starters who reopened came back (61%), against
14 of 60 who did not (23%), p = 0.0015. Among non-starters, same-day reopen makes no difference (3/27 vs 24/252, p = 0.73).
**The return is driven by riding, not by a notification or a ride left running.**

**Is "day 2" counting a continuation of the first session?** No. All 72 day-2 returners have a session that *starts* on day +1
(`d2_new` = `d2` in every cell of V2-q2). But only 42 of the 72 started a session 24–48 h after install. The rest came back
within 24 h, which matters for §5.3.

## 5. Top 5 predictors (ranked) and what they mean

Ranked by effect × robustness (n, p, survives adjustment) × how much the app can act on it.

| # | Predictor (completers) | Returners vs non-returners | Survives adjustment? | Lever? | Confidence |
|---|---|---|---|---|---|
| 1 | **Started a ride on day 0** | d2 31/88 (35%) vs 27/279 (10%); d7 17/82 vs 27/261; RR 3.6, p = 1e-7 | yes, OR 4.5 [2.4, 8.5] | **yes**: Exp 1 (T31, T32), T27 Start Ride first open (FS-PO14: 52% open Start Ride and never start, R6-q9) | 85% that the link is real; causality unknown (40%) |
| 2 | **Came back again on day 0** (≥ 3 sessions; reopen > 1 h after install) | ≥3 sessions 25/55 (45%) vs 33/312 (11%); reopen after a ride start 17/28 (61%) | yes, OR 4.0 | partly: the "Later today" chip (T32, D13) targets exactly this | 80% real; it is mostly the ride loop again (no effect without a ride start) |
| 3 | **Goal `track_rides`** (and its mirror, `maintain_bike`) | 42/197 (21%) vs 16/170 (9%); `maintain_bike` 3/72 (4%) on day 2 but **7/65 (11%) on days 7–13, at baseline** | no: OR 2.4 → 1.4 once ride start is in; it runs through riding | targeting and strata: S1 is 47/197 (24%) vs 14/170 (8%) | 85% |
| 4 | **Logged something on day 0** | any core 17/46 (37%) vs 41/321 (13%); by type: ride 11/13, expense 7/23 (30%), **maintenance 3/22 (14%, no effect)** | yes, OR 2.8 (p = 0.008), weaker once sessions are in | yes, but only rides (and weakly expenses) separate riders; maintenance logging does not | 75% |
| 5 | **Heard about MotoVault from an AI chat** | 18/62 (29%) vs 40/305 (13%), p = 0.004; social (FB/IG/TikTok) 2/41 (5%), p = 0.041 | not tested jointly (cell count) | acquisition, not product: outside this plan | 55% (one of about 60 tests; plausible as intent) |

Close behind, and **not** in the top 5:

- Push granted (OR 1.7, p ≈ 0.03 raw, 0.085 adjusted, no day-7 effect) and iOS (OR 1.9, p ≈ 0.05). Both look like traits.
- Old bike (< 2010: 12/45).
- Existing-account sign-in (7/21): this is a cohort-purity issue, not a predictor.
- Premium EU/US makes (2/48) and South America on days 7–13 (3/69): low hints, small n, multiple testing.

**Not predictive:** experience level, weekday/weekend, continent (day 2), onboarding bike completeness, paywalls seen (0, 1 or
2+), non-onboarding paywalls, diagnosis started, sign-in provider, purchase (small n). **Cannot be tested:** received
notification (no one gets one, V2-s2), bike segment (V2-s3), install attribution (no data).

### 5.1 What this means for Experiment 1

1. **The bet is aimed at the right behaviour.** The one thing returners do that non-returners don't is start a ride on day 0, and
   start another on day 2. The first-ride plan (plan card + teaching sheet + day-1 nudge) targets exactly that, and nothing in the
   first-session friction list does (§4 of R6 confirmed on 367). The data cannot show that *causing* a ride start causes return.
   That is what the randomized test is for.
2. **Pre-register the analysis by stratum.** S1 is 24% in `track_rides` and 8% in the other goals, and `track_rides` completers
   produce 77% of S1 events. With simple randomization, a stratified primary analysis keeps the plan's single primary metric (S1)
   and reduces variance: Cochran–Mantel–Haenszel, or logistic regression with goal (`track_rides` vs other) × platform as
   covariates, which are pre-treatment because both are set before assignment. Also pre-specify one subgroup, `track_rides`, as
   the place the effect should show first. The "×2" detectable effect also needs restating per stratum: ×2 on 24% is 48%, which is
   not plausible, while ×2 on 8% is +8 pts. State it as an absolute lift (for example +8 pts overall) and redo the power table with
   the stratum baselines.
3. **Expect a lower baseline during the slot.** October completers came back half as often as August–September ones (9% vs 19%),
   and the slot runs Dec–Mar. The plan's 9.5% column (power 0.56–0.65) is the realistic one, and may still be too high.
4. **Keep reinstalling riders out of the new-rider read.** Riders whose first auth event is `user_signed_in` (21 of 367
   completers, 33% back) are reinstalls of existing accounts. T30 already excludes riders with a real ride. Add a
   `returning_account` flag to `activation_exposure` and exclude or stratify these riders in S1/S3.
5. **The missing lever: nothing invites a rider back.** In week 1, 1 of 426 new users got a server push, 6 persons had a local
   reminder scheduled, and only 55 of 426 new users have a push token at all. The push-grant correlation (OR 1.7) is a trait, not the
   effect of a message. T34 (the d1 fallback) is therefore the plan's only test of a re-engagement message, which makes T33 (the
   Android delivery check) and the push-token gap (`push-tokens-investigation.md`, T18) more important than "gates". If T34 is cut
   for time, Experiment 1 no longer tests a notification at all.
6. **`maintain_bike` riders need a later read, not a d1 push.** They almost never come back on day 2 (3/72) but come back in
   days 7–13 at the baseline rate (7/65 = 11% vs 12.8% overall), and their week-1 S1 is 5/72. The d1 copy "When did you last
   service your {model}?" (D13) is a reasonable bet. But S3 (day-2) will always read it as a failure. Read `maintain_bike` on S1
   and days 7–13, and say so in the ledger.

### 5.2 What this means for the friction work (P1/P2)

- The friction fixes stay hygiene. Paywall count, diagnosis and sign-in provider show no association on all 367 completers, which
  confirms §1.1 on four times R6's sample.
- **One exception is T27 (Start Ride first open, FS-PO14).** Day-0 ride start is the strongest predictor, and 67 of 130 riders
  who opened Start Ride on day 0 never started (R6-q9). T27 is the P2 task most likely to move return, not just hygiene. Keep it
  as a both-arm change before the slot (D12), and give it its own read: day-0 ride-start rate among Start Ride openers.

### 5.3 What this means for the metrics

- **S3 / day-2 return on the UTC calendar day** gives a rider who installs at 23:00 UTC a window that opens 1 h later. One who
  installs at 00:30 UTC waits 23.5 h. Installs between 00:00 and 05:59 UTC come back 7% vs 18% (p = 0.013), and only 42 of 72
  day-2 returners started a session 24–48 h after install.
- Inside Experiment 1 this bias cancels out, because arms are randomized. For per-release comparisons (§1.2 "per-release success
  reading") it does not cancel when install-hour or region mix moves between releases. Make the "24–48 h variant" the primary
  per-release form of S3-raw, or use the rider's local calendar day.

## Effect on plan confidence

**Confirms**

- §1.1 / §1.3 A "friction does not separate returners" (R6 §3.1). Confirmed on all 367 completers. Day-0 paywalls: 0 → 20%,
  1 → 13%, ≥2 → 14%. Non-onboarding paywalls, diagnosis and sign-in provider: no difference. The P1/P2 "hygiene, judged
  mechanically" framing (§1.1) stands. Confidence 80% (up from R6's 60%).
- §1.1 "the levers for return remain Experiment 1 and Experiment 2" and the Exp 1 design (T31, T32, FS-EXP1). Day-0 ride start
  (OR 4.5 adjusted) and riding again on day 2 are what separate returners. The "Later today" first chip (D13, T32) matches the
  same-day-reopen signal (17/28 = 61% back).
- S1 as the Exp 1 primary (D13). It counts week-1 activity, and that is the read where `maintain_bike` riders are not
  automatically failures.
- T33/T34 and §1.4 D13 "notification kind `activation`". No other week-1 message exists today (V2-s2), so this is the only
  notification lever in the plan.

**Corrects**

- §1.1 sentence "goal, push grant and early logging do [separate returners]". The correct reading:
  - Starting a ride on day 0 separates them most.
  - Goal works mainly through it.
  - Push grant is a weak trait (OR 1.7, CI includes 1 after adjustment, nothing at days 7–13) that is not tied to any message.
  - Early logging separates only for rides (and weakly expenses). Maintenance does not (3/22).

  Proposed text: "Starting a ride on day 0 separates day-2 returners (35% vs 10% of completers, OR 4.5 adjusted, V2 §4). Goal
  `track_rides` works mostly through it, push grant is a weak trait, and maintenance logging does not separate riders."
- FS-EXP1 power table and "×2 detectable effect". Restate it as an absolute lift. Add a stratified analysis (goal `track_rides` vs
  other × platform, CMH or covariate-adjusted logistic) as the pre-registered primary test of S1 (D13 amendment). Add
  `track_rides` as the one pre-specified subgroup. Recompute power with the stratum baselines (24% / 8%) and the Oct-level
  baseline (9.5% column, maybe lower).
- T30 `activation_exposure`. Add:
  - `primary_goal` (it is already a super property: `onboarding_goal_primary` exists on events)
  - `returning_account` (first auth = sign-in to a pre-existing account)

  These come on top of the existing `notifications_granted` and `onboarding_variant`. T40 then excludes or stratifies
  `returning_account` riders.
- S3 (§1.2) and FS-M per-release reads. The UTC calendar-day definition is biased by install hour (7% vs 18%). For per-release
  comparisons, make the 24–48 h variant (or local calendar day) the read, not a side note. Exp 1 is unaffected because it is
  randomized.
- D13 `maintain_bike` d1 copy. Keep it, but record in the ledger that `maintain_bike` riders' natural return is days 7–13
  (7/65, at baseline) and not day 2 (3/72). Judge them on S1 and days 7–13, never on S3.
- T27 / FS-PO14. Raise it from "friction hygiene" to "the P2 task most likely to move return" (still not causal). Add a per-release
  metric: day-0 `ride_started` among riders who opened Start Ride on day 0 (baseline 63/130, R6-q9). Keep D12 (both arms, before
  the slot).

**Invalidates**

- Nothing in the task list. One reading is invalid: any plan or ledger statement that uses the push-grant correlation (R6:
  12/45 vs 4/55) as evidence that *notifications* bring riders back. No rider in this cohort got a re-engagement notification
  (V2-s2), so that correlation cannot support a notification lever.

**Missing lever (not in the plan)**

- A re-engagement message for riders who are **not** in the Exp 1 test arm, and for after the slot. Today 0 of 426 new users get
  any message in their first week except the maintenance push (1). Exp 1 tests this only inside the slot. A follow-up task after
  T40 should decide the default for everyone.
- Acquisition quality. AI-chat referrals return 2× (18/62) and social referrals return at 5% (2/41). This is outside #365, but
  should be passed to growth as a hypothesis (one of about 60 tests, confidence 55%).
- Bike segment and install source are not captured in usable form (V2-s3: 98% of first-day bikes are type standard/other;
  `install_source` null or `organic_unknown`). T05 instrumentation could carry the onboarding bike category, if the owner wants
  segment targeting later.

**Net effect on §1.3 confidence:** A (we know what to do) **75% → 77%**. The friction-is-hygiene reading is confirmed on 4× the
sample, and the Exp 1 target behaviour is confirmed. B (the plan is well defined) stays at **70–78%** until the FS-EXP1 analysis
amendment (stratified test, absolute effect, `returning_account`) is written into D13 and T30.
