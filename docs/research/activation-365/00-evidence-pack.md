# #365 Activation — evidence pack (our own data)

Pulled 2026-11-12. Research input for the activation board. Every number names its source.
`PostHog qNN` = the SQL saved in `queries/qNN-*.sql` (run with `execute-sql` on project 155556, EU).
No PostHog insights were saved (this session makes no PostHog writes), so the SQL file *is* the id.
All PostHog figures are noncanonical one-off derivations (the project's governed metric catalog is empty).

## 0. Cohort and definitions

- **Cohort:** every app person (`$lib = posthog-react-native`) whose *first-ever* event falls in
  **2026-08-14 → 2026-11-04** (a trailing ~12-week window, so day-7 can be observed). **n = 793**
  after excluding 12 test/synthetic persons (`queries/q00-excluded-persons.md`). [SOURCE: PostHog q01]
- **Platform:** the `platform` property (since 3.21.0), else mapped from the first `$app_version/$app_build`
  (iOS: 3.18.0/82, 3.19.1/90, 3.20.0/93, 3.21.0/96 …; Android: 3.19.0/81, 3.19.1/84, 3.26.0/93 …). 6 persons unknown.
- **Day-2 return** = any `Application Opened` / `Application Became Active` / `$screen` on the calendar day after
  first seen (UTC). **Ever returned** = any of those on a later day. **D7** = active on days 7–13 (only
  persons first seen before 2026-10-29, n = 747).
- **Core action** = a saved real ride (`ride_completed` with `below_min_ride` not true), `expense_added`,
  `maintenance_task_created` or `maintenance_task_completed`. `bike_added` (onboarding) is reported separately.

## 1. Event check — does each event fire where we assume? (origin/main 5a497a1c)

| Event | Where it fires | Arrives? | Caveat — measures something else? |
|---|---|---|---|
| `Application Installed` / `Opened` / `Became Active` | PostHog RN SDK lifecycle, `apps/mobile/src/lib/analytics.ts:68` | yes | **Consent-gated** (`before_send`, analytics.ts:55-66). In the EEA/UK/CH (opt-in) nothing is sent until the rider accepts the consent screen shown after Welcome (`lib/analytics-consent.ts` header). So EEA installs that decline are invisible, and `welcome` is under-counted in the EEA. PostHog sees **863** new app users since 08-14 vs RevenueCat **1,037** new customers (83%); last 28 days **217 vs 298 (73%)** [SOURCE: PostHog ad-hoc count 2026-11-12; RevenueCat `customers_new` 2026-08-14..11-10]. Every rate below is "of riders who allowed analytics". |
| `onboarding_step_viewed/completed/skipped` (`properties.step`) | `lib/onboarding-analytics.ts`; steps in `config/onboarding.ts` | yes | `welcome`, `commitment`, `account`, `heard_about`, `personalizing` emit no *completed* — use *viewed* of the next step (memory `feedback_metric_measures_something_else`). Two arms run since 2026-10-07 (`onboarding_paywall_2026q4`: `garage_first` / `commit_first`). |
| `onboarding_completed` | `app/(onboarding)/personalizing.tsx` | yes | — |
| `paywall_viewed`, `paywall_present_requested` (`placement`) | RC paywall wrapper | yes | any placement; in this cohort ≈ onboarding. |
| `$screen` | one place: `hooks/use-screen-tracking.ts` | yes | names changed format across versions (`/experience` vs `/(onboarding)/experience`). |
| `ride_completed` | `lib/ride-analytics.ts` — canonical "ride saved" | yes | `below_min_ride=true` = a Start tap left to auto-end; excluded. Older builds have it null (counted). `ride_started` counts every Start tap incl. tests — never a ride count. |
| `expense_added` | every create path (`lib/expense-analytics.ts`) | yes | — |
| maintenance log | `maintenance_task_created` / `_completed` (analytics.ts:615-628) | yes | `maintenance_log_added` is a Meta alias, still sent by pre-3.21 builds → never use it. |
| bike added | `bike_added` (onboarding), `garage_bike_added` (garage) | yes | **34% of riders who added a bike in onboarding add one again in the garage within a day** (109 of 324) [SOURCE: PostHog q04] — so `garage_bike_added` in week one is mostly a re-add, not a new core action. |
| push permission | `notification_permission_requested/_result {permission_granted}` (`app/(onboarding)/notifications.tsx:195`) | yes | `requested` fires only when the rider taps Enable; "Not now" sends nothing → the grant rate looks ~96% but is "of those who tapped Enable". |
| push opened | `reminder_opened {kind, action}` (`app/_layout.tsx:975`) | yes | Only local reminders (maintenance, document, receipt scan, ride-idle, trial). **There is no day-0→day-7 re-engagement message of any kind** (`lib/notifications.ts`, `lib/trial-reminder.ts`). Server push only for maintenance-due (#154/#155). |
| RevenueCat → PostHog | `rc_*` server events (`apps/api/src/modules/webhooks/revenuecat-posthog.ts`, #263) | from **2026-10-05** | Before 10-05 not captured; declined riders go to `distinct_id = revenuecat-no-consent`. |

## 2. The day-1 funnel (n = 793, first seen 08-14 → 11-04) [SOURCE: PostHog q01]

| Step | All | Android (559) | iOS (228) |
|---|---|---|---|
| onboarding_started | 685 (86%) | 493 | 191 |
| viewed experience | 685 | 493 | 191 |
| viewed bike_setup | 669 | 482 | 186 |
| **completed** bike_setup | 529 | 375 | 153 |
| viewed goals | 578 | 406 | 172 |
| viewed account (sign-up) | 496 | 345 | 151 |
| viewed notifications (after account) | **380** | 252 | 128 |
| viewed personalizing | 370 | 242 | 128 |
| paywall seen (any placement) | 345 (44%) | 268 | 77 |
| **onboarding_completed** | **367 (46%)** | 240 (43%) | 127 (56%) |
| core action on day 0 | 46 (5.8%) | 25 (4.5%) | 21 (9.2%) |
| tapped Start ride on day 0 | 89 (11.2%) | 62 | 27 |
| core action in week 1 | **61 (7.7%)** | 36 (6.4%) | 25 (11.0%) |
| **day-2 return** | **72 (9.1%)** | 43 (7.7%) | 29 (12.7%) |
| ever returned after day 0 | 167 (21.1%) | 107 (19.1%) | 60 (26.3%) |
| D7 (active days 7–13, n=747 eligible) | **50 (6.7%)** | 33/522 (6.3%) | 17/219 (7.8%) |
| purchase_completed (client) | 16 (2.0%) | 10 | 6 |

Biggest conditional losses: **account → notifications 496 → 380 (−23%)**, goals → account 578 → 496 (−14%),
bike_setup viewed → completed 669 → 529 (−21%, many go *back* to `experience`: the path
`/experience > /bike-setup > /experience > /bike-setup` is among the most common [SOURCE: PostHog ad-hoc path query, same cohort]).
Then the cliff: **of 367 who finish onboarding, 58 come back on day 2 (15.8%); of 426 who don't finish, 14 (3.3%)** [SOURCE: PostHog q02 `ob_done`].

**Stability of the baseline** (day-2 return by install week) [SOURCE: PostHog q02 `week:`]:
4/36, 5/83, 6/63, 7/73, 7/75, 11/90, 7/70, 2/63, 8/72, 6/48, 3/53, 3/41, 3/26 → weekly rate swings
**3%–12%** on 26–90 installs a week. Any "it moved" claim smaller than that spread is noise.

## 3. Which first action predicts coming back [SOURCE: PostHog q02]

| First core action (week 1) | n | day-2 return | D7 |
|---|---|---|---|
| ride saved first | 24 | **20 (83%)** | 13/24 (54%) |
| expense first | 22 | 9 (41%) | 4/20 (20%) |
| maintenance first | 15 | **1 (7%)** | 1/13 (8%) |
| no core action in week 1 | 732 | 42 (5.7%) | 32/690 (4.6%) |

Day-0 action only (avoids "came back *to* do it" circularity): ride saved on day 0 → 11/13 back on day 2;
expense on day 0 → 7/23; maintenance on day 0 → 3/22; **no core on day 0 → 55/747 (7.4%)**.
**76 riders tapped Start on day 0 but saved no ride that day** → 20 of them came back on day 2 (26%) — a warm group.
Caveat: the ride–return link is partly selection (people who ride at all are riders) and partly mechanical
(a ride left running sends the forgotten-ride reminder). Maintenance-first logging does **not** predict return.

**Time to first core action** (the 61 who did one in week 1): <1 h after first open **40**, 1–24 h **16**,
1–3 days **4**, 3–7 days **1** [SOURCE: PostHog q02 `ttfc:`]. Activation happens on day 0 or not at all.

**New-rider ride funnel** (cohort, through 11-12) [SOURCE: PostHog q05]: 103 riders tapped Start
(725 times) → 72 tapped Stop → **66 riders saw "ride too short" (221 times)** → ~34 riders ever saved a real ride.
Two thirds of first ride attempts end in "too short" — consistent with testing the button at home.

## 4. Push permission, goal, platform, region [SOURCE: PostHog q02]

- **Push** (tapped Enable and granted vs never asked/answered): Android 20/119 (16.8%) vs 23/437 (5.3%) day-2;
  iOS 15/57 (26%) vs 14/166 (8.4%). Explicit denials: 8 people total. Strong association, **but confounded**:
  only riders who reach the notifications step (after sign-up, 380/793) can grant. No message exists that could
  use the permission in days 1–7 (§1), so the gap is selection, not effect.
- **Onboarding goal → behaviour → return:**

| primary_goal | n | week-1 ride | week-1 expense | day-2 | D7 |
|---|---|---|---|---|---|
| track_rides | 262 | 25 | 20 | 44 (16.8%) | 30/242 (12.4%) |
| maintain_bike | 112 | 1 | 0 | 4 (3.6%) | 8/104 |
| just_exploring | 81 | 0 | 1 | 7 | 3/79 |
| manage_expenses | 62 | 1 | 6 | 7 (11.3%) | 5/61 |
| discover_routes | 23 | 0 | 0 | 3 | 0/23 |
| (never reached goals) | 253 | 0 | 0 | 7 | 4/238 |

  Riders who chose *track_rides* and saved a ride in week 1: 22/25 back on day 2; *track_rides* without a ride: 22/237 (9.3%).
  **maintain_bike riders are the worst-retained group (3.6% day 2) — and maintenance is what the web sells (§6).**
- **Region of first event:** Americas 319 (day-2 7.8%), Europe 149 (9.4%; under-counted by opt-in consent), other 277, India 48.

## 5. What riders see right after onboarding [SOURCE: PostHog q03, q04]

- **112 of 367 (31%) onboarding completers get the "What's New" modal within the hour** — a new-version
  announcement shown to a brand-new rider as their first in-app screen. Day-2 return 19/112 (17%) vs 39/255 (15%):
  no measurable harm, but no help, and it delays the first real screen.
- The most common first five screens: `/whats-new > / > /add-bike > /add-bike > /` (23 riders, 6 back on day 2);
  `/whats-new > /` then nothing (10 riders, 0 back); `/(onboarding)/personalizing > /(tabs)/(home)` then nothing (7, 0 back);
  `/start-ride > /start-ride > /ride-hud > /ride-summary > /` (6). Paths through AI diagnostics: 10 riders, 0 back.
- The home screen offers Start ride first; most riders are not on a bike at install time (§3 ride funnel).

## 6. Money: RevenueCat, and RevenueCat joined to activation

- **Revenue 2026-08-14 → 11-11:** $309.97 over 12 transactions (Sep $172.56/7, Oct $121.19/3) [SOURCE: RevenueCat `revenue`, monthly].
  **MRR $56, 11 active subscriptions, 0 active trials, 298 new customers in the last 28 days** [SOURCE: RevenueCat overview metrics, 2026-11-12].
- **Trials:** 15 started since 08-14, 2 converted (13.3%), 13 expired, 0 pending [SOURCE: RevenueCat `trial_conversion_rate`, total].
- **V5 paywall experiment `expd7c1d56904` (read only, not changed):** customers A/B/C 141/128/140, paywall viewers 49/55/51,
  initial conversions **3/2/1**, trials 2/2/0, paid customers 1/1/1. Chance-to-win "insufficient data" on every metric
  [SOURCE: RevenueCat `get-experiment-results` expd7c1d56904]. Its own plan needs ≥150 viewers/arm (memory `project_paywall_v5_f1_f2`); it is at ~50.
- **Purchase vs activation** [SOURCE: PostHog q06, RC server events since 10-05, consented riders only, n=7 real]:
  every Play trial (4) started **at hour 0 inside onboarding (`onboarding_rides`/`onboarding_default`), before any core action**;
  3 of those 4 were cancelled, and **3 never opened the app again after the purchase day**; 1 converted (V5 Ride Sheet).
  The 1 web Stripe annual ($49.99) also bought in onboarding with no core action and never returned.
  The only purchase after activation was a promotional grant (`feature_gate`). In the PostHog cohort, the 16 client
  `purchase_completed` riders: 1 did a week-1 core action, 4 came back on day 2, 2 at D7 [SOURCE: PostHog q02 `bought:1`].
- **So: does an activated rider convert better?** Not today — purchases happen before activation, and in-app paywalls sold
  nothing (#365). Activated riders buy at 1/61 (1.6%) vs 15/732 (2.0%) for the rest [SOURCE: PostHog q02]. Revenue per install
  ≈ $310 / ~1,037 RevenueCat new customers ≈ **$0.30** over the window (rough; mixes cohorts).
  **What an extra activated rider earns** cannot be measured from our data today; the link would have to come from
  retention (the in-app paywalls, renewals). Treat any $ figure for it as `UNBACKED`.
- **PostHog vs RevenueCat disagree** on purchases: RC 15 trials + 12 revenue transactions; PostHog `rc_*` 8 purchase events
  (server capture only from 10-05; 1 anonymised); client `purchase_completed` 16 in the cohort (includes trial starts and
  pre-10-05). Use RC for money, PostHog only for "what did the buyer do".

## 7. What riders came for: Google Search Console (motovault.app, 2026-08-14 → 11-10)

[SOURCE: GSC page / country / query×country, 2026-08-14..2026-11-10; raw in `queries/gsc_*.json`]

- 6,939 clicks / 700k impressions total; **India 319 clicks excluded**. Europe 2,433 clicks, Americas 2,215
  (US 1,662, UK 624, AU 489, CA 236, NL 189, DE 151, ES 149, SE 136, IT 117, MX 101).
- **Clicks by landing-page intent (all markets):**
  - **model-specific maintenance schedule / service intervals blog posts: 4,340 (62%)** — e.g. `/blog/yamaha-mt-r-series-maintenance-schedule` 350,
    `/blog/honda-cbr-cb-maintenance-schedule` 345, `/blog/mt-09-service-intervals` 289, Z900 280, Rebel 500 224, R7 223
  - diagnose-a-problem posts: 876 (13%) (`check-engine-light-guide` 387); AI-diagnostics feature page 258 (4%)
  - routes/trips pages 260 + trip-planner blog 110 (5%); compare pages 109; home 165; `/pro` 43; expense/cost content ~60 (1%)
- Clicked queries (where Google reveals them) are the same: "honda rebel 500 maintenance schedule", "mt07 service intervals",
  "r7 service intervals", "2021 mt 07 oil capacity". "motovault" brand queries: 65 clicks.
- **Web → app hand-off** (PostHog web, same window, India + TikTok crawler excluded) [SOURCE: PostHog q07]: blog pageviews
  6,865 people → **store_cta_click 387 people (~4%)**; `/get` 11, `/welcome` 8. Which of those installed is unknown (no join).
- **Promise vs first screen:** web visitors arrive wanting *their model's service schedule*. In the app, `maintain_bike`
  riders (112) are the least retained group (3.6% day 2, §4), a maintenance-first action predicts nothing (§3), and the
  post-onboarding home leads with Start ride. The OEM schedule pipeline exists but has model gaps
  (memory `project_oem_schedule_africa_twin`). The match between what the web promises and what the app shows first is weak.

## 8. Optional store cross-check — skipped

App Store Connect / Play install counts not pulled (ASC analytics is rate-limited, see `reference_asc_analytics_pull`).
RevenueCat new customers (1,037) is used as the install cross-check instead (§1).

## 8b. Database cross-check (consent-independent) [SOURCE: Supabase prod, read-only, `queries/q08-db-signup-activation.sql`]

Accounts created 2026-08-14 → 11-04, synthetic/test excluded: **443 sign-ups** (PostHog saw 496 reach the
account screen and 367 finish onboarding; the DB includes riders who declined analytics).
- with a bike: 336 (76%)
- week-1 core action: **67 (15.1% of sign-ups)** — ride ≥500 m 32, expense 30, maintenance marked done 19
- ever a core action: 74; **core action on a later day than sign-up: 36 (8.1%)**
- maintenance tasks *created* on day 0: 151 — schedule tasks are created for the rider (OEM import / defaults), so "task created" is not a rider action in the DB.
- **device push token stored: 57 (12.9%)** while PostHog shows 176 riders granting permission in onboarding.
  **Investigated (see `push-tokens-investigation.md`): all 105 tokens ever stored are iOS — Android has never
  registered one.** The app has no `android.googleServicesFile` (FCM), so `getExpoPushTokenAsync` throws on Android and
  the error is swallowed by a production no-op `logger.warn`. iOS: 57 granted ↔ 57 tokens. **Server push reaches ~30% of
  installs (iOS only) until an Android build with FCM ships; any push experiment must account for that.**

Same order of magnitude as PostHog: ~8% of installs / ~15% of sign-ups do a core action in week one.

## 9. Gaps — what we can't measure today

| Gap | Why | Fix |
|---|---|---|
| EEA riders who decline analytics are invisible; ~17–27% of new users missing | opt-in consent gates all events | none needed for privacy; report rates "of consenting riders"; cross-check volumes with RevenueCat `customers_new` |
| No "first screen after onboarding" event — reconstructed from `$screen` names that changed format | — | add `post_onboarding_landed {screen, variant}` |
| Notification step: "Not now" sends nothing | `notifications.tsx` only tracks the Enable path | `notification_permission_result {granted:false, reason:'declined_soft'}` on Not now |
| Can't tell a home test of Start ride from a real ride attempt | `ride_too_short_shown` has no speed/distance context | add `max_speed_kmh`, `distance_m`, `elapsed_s` to `ride_too_short_shown` |
| Push opens only for local reminders; no re-engagement message exists to measure | — | if a day-1 message ships: `reminder_scheduled/opened {kind:'activation_dN'}` |
| Web visit → install → rider join is missing | no shared id across web and stores | `/get` intent carry (#163) only on Android; accept as qualitative |
| Purchases before 10-05 not in PostHog; consent-declined buyers anonymised | #263 date; consent rule | use RevenueCat for money |
| `garage_bike_added` mixes re-adds of the onboarding bike with new bikes | — | add `is_first_garage_bike`/`source` |
| Synthetic robots that never signed in may remain in the cohort | can't identify pre-signup | small; ignore |
