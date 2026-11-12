# V1 — Production metric validation (#365 activation plan)

Run 2026-11-12, read-only. PostHog project 155556 (EU) via `execute-sql` (HogQL); Supabase production via the Management API, every statement wrapped in
`BEGIN READ ONLY; …; COMMIT;`. No writes anywhere. Only aggregates are reported (no emails, names or per-rider ids).

**Exclusion used everywhere (`{EXCL}` below).** Project test-account filter (4 hard-coded person ids + `person.properties.internal != true`) **plus** the q00 list
re-derived from Supabase: `public.users` where `is_synthetic` OR `e2e-%` OR the three test domains OR soft-deleted on 2026-11-10 = **26 user ids** (19 of them `is_synthetic`),
mapped through `person_distinct_ids` → **11 PostHog persons**; union with the filter = **13 persons** (the plan says 12; 2 of the 4 filter ids are also synthetic users, and
the plan's list lacks one). The id list lives only in the session scratchpad, not in the repo. All PostHog queries add `{RN}` (`$lib = 'posthog-react-native'`) unless stated.

Windows: "60 d" = trailing 60 days to 2026-11-12. Plan baselines were computed on 2026-11-12 or earlier with slightly different windows, so ±1–4 rider drift is expected and is
called "matches".

## Summary of what is wrong in the plan's measurement layer (details in the table and §3)

1. **`{REL}` platform column is broken.** `$os` is **never set** on any mobile event (0 of 332 `Application Opened` in 7 d carry it; `$os_name` also null) [V1-q2, V1-q3].
   `platform` is null on 97/332 opens (29%), and those are exactly the install/first opens (86 riders with 1 null-platform open each on 3.26.0) [V1-q4, V1-q5]. So
   `lower(coalesce(platform, $os))` of the cohort's **first** event is null for most first-session cohorts. Fix in §3.1 (person-level fallback until T01 registers `platform` at init).
2. **Q-P1 is partly wrong.** With a build-number fallback, Android opens exist on 3.27.0 (vc95) and 3.28.0 (vc96–99, **5 non-test riders in 14 d**); Q-P1 saw "no android row"
   only because their `platform` was null [V1-q5]. Android *production* is very likely still 3.26.0 (vc93 = 119 riders); the 3.28.0 Android riders are probably testers or
   the Play review/pre-launch track. Release reads must filter by build, not only by version.
3. **R6 SCOREBOARD-CTE metrics (FS-PO6, FS-PO12, FS-PO13) are wrong as written:** `ob LEFT JOIN events e … WHERE e.…` makes `count() AS completers` count **event rows**
   (3.26.0: 4,047 "completers" for 116 persons) and turns the LEFT JOIN into an inner join [V1-q30]. Rewritten per-completer with arrays (§3.5); baselines re-run.
4. **FS-PO8 baseline is not "n = 1": it is near-universal on Android.** On a rider's first Discover visit, `Application Backgrounded` follows within 2 s for **42 of 43** Android
   riders (median 0 s) vs **1 of 59** on the first Garage view and **0 of 28** on iOS first Discover [V1-q36]. This is the signature of an OS dialog (location) on Discover open.
5. **FS-PO3 denominator** includes explicit upgrade taps (`profile_subscriptions_row`, `profile_pro_banner`) because `trigger` does not exist yet, so 22 "gate sessions" on
   3.26.0 are really **14** automatic-gate sessions, **9 (64%)** with a same-feature repeat, not 9/22 (41%) [V1-q33].
6. Smaller corrections: FS-OB1c counted completions *before* the resume (fixed); FS-OB2b used `minIf` over all views (could pick a view before sign-up) and `any()` for
   platform (fixed); FS-PO4a 3/20 does not reproduce (now 1/14, consistent with the board's 1/13); FS-PO11 is 2/120 on 3.26.0, not 0; FS-OB1e "4 completed twice" is 6;
   FS-OB2a proxy is now 23/111 (20.7%), not 20/124; S4(a) counts rider-created tasks too, which is why the partial week 11-09 jumps to 12/24 (9 bikes with `source='user'`
   tasks vs 4 with `oem`) [V1-db3].
7. **`{RN}` drops `signup_completed`** (server event, `$lib` null, 462 events/90 d) [V1-q1b]. Any metric that needs it (FS-OB2a proxy, FS-OB2b, FS-OB5) must not apply `{RN}` to it.
8. Events/properties the plan's SQL assumes that **do not exist yet** (confirmed against the 90-day mobile event list [V1-q1] and the property-key scan [V1-q1c]):
   `activation_fix_level`, `ota_update_id`, `runtime_version`, `is_embedded_launch`, `e2e_run` (T01); `onboarding_back`, `onboarding_welcome_mounted`, `gate_routed`,
   `auth_session_lost` (T04b); `auth_oauth_started`, `auth_oauth_result`, `auth_error_alert_shown`, `auth_email_submitted`, `auth_post_signin_wait` (T04a);
   `onboarding_resumed.pending_code_step` / `restored_draft`, `email_code_step_restored` (T04/T13); `post_onboarding_landed`, `landing_sheet_shown`, `screen_load_timed`,
   `garage_bike_edited` (T05d); `service_plan_imported`, `onboarding_completed.service_plan_task_count`, `ride_saved`, `onboarding_bike_created` (T05e/T07a/T07b);
   `paywall_viewed.trigger`, `paywall_suppressed`, `limit_sheet_viewed`, `bike_limit_sheet_shown`/`bike_limit_choice` (T21/T22/T24); `diagnostic_failed.reason`/`elapsed_s`
   (T17); `ride_too_short_shown.variant` (T31); `ride_discarded.reason`/`trigger` (T09); `activation_exposure`, `next_ride_plan_set` (T30/T32).
   Present today and usable: `diagnostic_failed.offline`, `paywall_*.surface/feature/limit_key`, `ride_completed.below_min_ride/save_trigger/auto_ended`,
   `checklist_item_completed.item/trigger`, `onboarding_resumed.resume_target`, `bike_added.capture_level`, `signup_completed.auth_method`, `oem_schedule_imported` (client, 28 events/90 d).

## 1. Metric table

Status: **ok** = ran, matches the plan baseline · **fixed** = the plan's SQL was broken or missing and the corrected SQL (§3) ran · **needs-events** = depends on events not shipped
yet (query written, task named) · **wrong-baseline** = ran, the plan's stated baseline does not hold. "Breakdown" = can it be split by `$app_version` / platform today.

| Spec id | Metric | Status | Value now | Plan baseline | Note (source; breakdown) |
|---|---|---|---|---|---|
| S1 | Week-1 core action among completers | ok | q02 cohort (first seen 08-14→11-04): **61/367 (16.6%)**; trailing (first `onboarding_completed` in [−67 d, −7 d)): 3.26.0 **8/84 (9.5%)**, all 37/275 | 61/367; 8/84 (Q-P5 279 total) | [V1-q8, V1-q7]. Definition mismatch: §1.2 says "within 7 d" of `onboarding_completed`, the 61/367 baseline anchors on *first seen*. Pick one (completion) for the tile. Version yes; platform via §3.1 |
| S2 | Onboarding completion | ok | first-seen **367/793 (46.3%)**; starters 3.26.0 **91/154 (59.1%)** | 367/793; 90/153 | [V1-q8, V1-q6]. Version yes |
| S3 | Day-2 engaged return (F14) | ok | completers **37/367**, all **39/793**; raw 72/793, completers 58/367; starters 3.26.0 raw 17/154 | 37/367, 39/793; 72/58; 17/153 | [V1-q9, V1-q6]. Appendix B SQL is hard-dated; for the tile replace the dates with a rolling window and add `ver`. The allow-list matches current `$screen_name` formats [V1-q10]; `/(modals)/start-ride` counts as engaged (known limitation) |
| S4(a) | First bike on sign-up day with a task ≤ 1 d (DB) | ok | weeks 10-12→11-02 **25/111 (23%)**; pre-drop 08-10→10-05 **127/204 (62%)**; partial week 11-09 12/24 | 25/111; 127/204 | [V1-db2]. Counts **any** task source: the 11-09 jump is 9 bikes with rider (`user`) tasks vs 4 with `oem` [V1-db3]. Add a `source='oem'` column or the metric can "recover" without T07. DB only, no version |
| S4(b) / FS-PO1H | Onboarding bike with OEM task ≤ 5 min (R2-M1, DB) | ok | **10/155 (6.5%)** weeks 09-28→11-09 (partial) | 10/151 (7%) | [V1-db4]. PostHog per-version tile **needs T07b** (`service_plan_task_count` absent on `onboarding_completed`) or T07a `service_plan_imported`; interim: client `oem_schedule_imported` |
| S5 | First-hour ≥ 2 paywall requests | ok | 3.26.0 **13/120 any, 8/120 post-onboarding**; all 37/292 any | 13/121, 8/121 | [V1-q11]. "Automatic" (target wording) needs `trigger` (T21/T01); today post-onboarding includes rider taps |
| S6 / FS-OB1 | Starter views an early step after a later one | ok | **44/470 (9.4%)**; 3.26.0 **16/166 (9.6%)** | 44/472; 16/166 | [V1-q12]. Step values confirmed (`welcome`, `experience`, `bike_setup`, `goals`, `account`, …) [V1-q13]. Version yes |
| FS-M | Release marker on opens | ok | **0%** of 332 opens (7 d) carry `activation_fix_level`/`ota_update_id`/`runtime_version` | 0% | [V1-q2]. Platform breakdown broken (`$os` never set; `platform` null on 29% of opens, always the first open) → §3.1 |
| FS-OB1a | Auth on onboarding sign-in, no screen in 10 s | ok | 3.26.0 **10 authed on sign-in, 6 stuck**; 3.21.0 2/2; others 0. Secondary ≥ 2 auths ≤ 2 min: **16/74 authed riders** | 6/10; 2/2; 15/72 | [V1-q14]. Q-P7 SQL runs as written. Version yes; `lvl` after T01 |
| FS-OB1b | ≥ 3 fast backward onboarding moves | fixed + needs-events | `$screen` method: Android **28/201 (13.9%), 4 completed**; iOS **14/72 (19.4%), 2 completed**; platform unknown 7/36 | Android 25/187, iOS 15/70 | [V1-q15]. Plan draft needs `onboarding_back` (**T04b**); R1 Q8's `$screen` SQL was never written down, reconstructed in §3.2. 3.19.x screen names are not mapped |
| FS-OB1c | Completion after resume, by target | fixed | bike-setup **8/31 (26%)**, account **5/13 (38%)**, goals 3/11 | 7/27, 5/15 | [V1-q16, V1-q17]. R1 M-C counted completions before the resume (personalizing 13/13 as written, 6/12 after); fixed ordering in §3.3. `restored_draft` needs **T04b/T13** |
| FS-OB1d | Welcome remount in live runtime | needs-events | pre-event proxy: **12 riders/60 d, 6 on 3.26.0** | 11 / 7 | [V1-q37]. `onboarding_welcome_mounted` needs **T04b** |
| FS-OB1e | Completer sees onboarding again / completes twice | wrong-baseline (minor) | relapse **10/292 (3.4%)**; completed twice **6/292**; DB: 2 users with 2 bikes ≤ 2 min apart (60 d) | 10/291; "4 completed twice" | [V1-q18, V1-db6]. Draft SQL runs as written. "4" → **6** (same as FS-OB6(a) and R6-q3) |
| FS-OB1f | Session lost during onboarding | needs-events | — | unknown | `auth_session_lost` needs **T04b** |
| FS-OB2a | Google OAuth outcome / account-step loss | needs-events + wrong-baseline (proxy) | proxy 10-15→11-12: Android **23/111 (20.7%)** viewed account without sign-up; iOS 6/34; platform-null 5/28 | 20/124 (16.1%) | [V1-q19, V1-q20]. OAuth events need **T04a**; M-OB2 also uses `activation_release` (rename to `activation_fix_level`). Counting sign-ins as success does not change it (88/111) |
| FS-OB2b | Sign-up → next step > 10 s (OAuth) | fixed | since 10-15: **6/124** OAuth sign-ups > 10 s (google-android 3/79, apple-ios 2/17, google-ios 1/10); one gap 98,915 s (overnight) | 6/105, max 141 s | [V1-q21, V1-q22]. Fixed: first step view *after* sign-up, person-level platform; exclude gaps > 10 min as "backgrounded". `auth_post_signin_wait` needs **T04a** |
| FS-OB2c | Alert shown on cancel | needs-events | — | every cancel alerts (code) | `auth_oauth_result`, `auth_error_alert_shown` need **T04a** |
| FS-OB3 | Email code sent → verified | ok | **19 sent, 16 verified (84%)** (3.26.0 18/16) | 16/19 | [V1-q23]. `relaunched_with_code` (`onboarding_resumed.pending_code_step`) and `email_code_step_restored` need **T04b/T13a**; rename `activation_release` |
| FS-OB4 | Bike-setup dwell and model share | ok (drift) | since 10-15: p50 **45 s Android / 43 s iOS**, p90 **229 / 120 s**; model **77/169 (45.6%)**; > 60 s **73/190 (38%)** | p50 44/37, p90 146/109; 44%; 42% (3.26.0) | [V1-q24]. Android p90 is up with the longer window; the target "p90 ≤ 75 s" needs a fixed window definition. Version yes |
| FS-OB5 | Tried vs not at account | needs-events (proxy ok) | proxy "stopped at account, never authed": 3.26.0 **18/166**, all 46/470 | 21/166; 63/472 | [V1-q25]. R6-q8's SQL is not in the repo; mine is in §3.4 and gives fewer. Split needs `auth_oauth_started`/`auth_email_submitted` (**T04a**) |
| FS-OB6 | (a) completed twice; (b) landing latency | ok (a) / needs-events (b) | (a) **6/292 (2.1%)** | 6/282 | [V1-q18]. (b) `post_onboarding_landed` needs **T05d** |
| FS-OB7 | Non-completer whose last step is paywall | ok | 60 d: **13/216 non-completers** (3.26.0 2/70, 3.19.0 10/73) | 3 of 67 (28 d) | [V1-q25]. Record only |
| FS-PO1 | Completers with `unlimited_bikes` request ≤ 1 d | ok | 3.26.0 **7/120 (5.8%)** (all 7 within 1 h) | 7/118 | [V1-q26]. `bike_limit_choice` needs **T22** |
| FS-R2-3 | Model change after make-only bike | needs-events (DB proxy ok) | DB: **116** live blank-model bikes, **7** with a task | 117 / 7 | [V1-db5]. `garage_bike_edited` needs **T05d/T23** |
| FS-R2-4 | Imperial OEM targets | ok (n/a) | 60 d: **86 of 176** onboarding bikes have `mileage_unit='mi'`, 6 of them with OEM tasks | n/a | [V1-db7, V1-db8]. Caveat: `motorcycles.mileage_unit` **defaults to `'mi'`**, so the DB denominator cannot tell real imperial riders; use `onboarding_completed.measurement_system` or the T07a event's `unit` |
| FS-R2-5 | Junk makes saved in onboarding | fixed | 60 d: **6/176** onboarding bikes with make < 3 letters (all-time 10/373); 53/176 makes not in `oem_maintenance_schedules` | 4 of 29 bike-paywall riders | [V1-db6]. Baseline denominator differs from the spec's own definition. "Known/NHTSA make" has no table (T37 closed) → define as < 3 letters, or ship T05e `make_valid` |
| FS-PO2a | ≥ 2 limit events in one session | ok | 3.26.0 **3 of 5 limit riders, 9 events** | 3/5, 9 | [V1-q27]. Version yes |
| FS-PO2b | Diagnosis failures | ok | submit→fail p90 **47 s**, max **141 s** (14 failures); 3.26.0 **10 failures / 3 riders**; `offline=true` **7/14** | 47 s / 141; 10/3; 7/14 | [V1-q28, V1-q29]. `reason`/`elapsed_s` need **T17** |
| FS-PO2c | Upfront diagnose paywalls | ok | **6 requests / 3 riders** (3.26.0 4/2, 3.28.0 2/1) | 6 / 3 | [V1-q31]. `limit_sheet_viewed` needs **T24/T21** |
| FS-PO2d | First-hour `diagnostic_started` | ok | 3.26.0 **29/116 (25%)**; 3.19–3.21 3–12% | 29/117 | [V1-q30a]. `entry` property needs **T05** |
| FS-PO3 | Sessions with ≥ 2 automatic same-feature paywalls | wrong-baseline | as written 3.26.0 9/22; **excluding explicit upgrade surfaces 9/14 (64%), 8/14 within 60 s** | 9/22 (41%), 8/22 | [V1-q32, V1-q33]. `trigger`/`paywall_suppressed` need **T21**; until then exclude `profile_subscriptions_row`, `profile_pro_banner` |
| FS-PO3b | Limit hit on the install launch | ok | 3.26.0 **4 of 5** | 4/5 | [V1-q34]. `is_embedded_launch` needs **T01** |
| FS-PO4a | Standstill-first → real ride ≤ 7 d | wrong-baseline | ≥ 3.21: **1/14** eligible | 3/20 (board 1/13) | [V1-q35]. R4's real_ride_7d had no complete-window guard; now consistent with the board's 1/13. `variant` needs **T31** |
| FS-PO4b | Junk saves (`below_min_ride=true`) | ok | ≥ 3.21: **`summary` 13 saves / 11 riders**; all 15/13 (2 `auto_end`). DB: **26/71** sign-ups' first ride live < 50 m, **+15 live with null distance** | 13/11; 15/13; 26/72 | [V1-q36a, V1-db9]. DB target "< 5%" should treat null distance as sub-floor (or report it) |
| FS-PO5 | HUD without any start | ok | **0 views / 0 riders**; stale > 3 h 9 views | 0 | [V1-q37a]. Version yes |
| FS-PO6 | First-hour `$rageclick` | fixed | **15/281**; 3.26.0 **7/116 (6%)** | 15/282; 7/117 | [V1-q30a, V1-q30]. R6 SQL as written returns event rows (4,047 for 3.26.0) |
| FS-PO7 | Discover time to content | needs-events | — | not measurable | `screen_load_timed` needs **T05d/T29** |
| FS-PO8 | Backgrounded ≤ 2 s after first Discover | wrong-baseline | Android **42/43** (median 0 s); iOS **0/28**; platform-null 54/87. Controls: first Garage view Android 1/59, Profile 3/58 | "run once in T02 (n = 1 seen)" | [V1-q36]. R4's `leadInFrame` SQL replaced by an array form (§3.6). Strong evidence an OS dialog fires on Discover open on Android: raises T29's priority |
| FS-PO9 | Leave < 60 s after completion | ok | 3.26.0 **11/120** | 11/121 | [V1-q38]. Q-P9 runs as written |
| FS-PO10 | `first_ride` checklist tick | ok | tap **16** riders (3 with a real ride), data **20** (12), null trigger 10 (old builds) | 17 (3), 20 (12) | [V1-q39]. "With real ride" is any time in 60 d, not before the tick; order it for the "= 0" target |
| FS-PO11 | What's New ≤ 1 h after completion | wrong-baseline | 3.26.0 **2/120** (completions 10-23 and 11-05); 3.19.1 65/69, 3.22.0 3/3 | 0/90 after 10-12 | [V1-q40, V1-q41]. Cannot tell automatic vs rider-opened; regression tile stays |
| FS-PO12 | Sign-in after completion ≤ 1 h | fixed | **11/292**; 3.26.0 **5/120**, 3.27.0 2/6 | not run | [V1-q40]. R6 SQL join bug fixed; includes `/(auth)…` screens |
| FS-PO13 | Onboarding step ≤ 7 d after completion | fixed | **7/292**; 3.26.0 **5/120** | not run (lower bound 6/282) | [V1-q40]. Excludes `paywall` step views |
| FS-PO14 | Start Ride opened day 0, no ride | ok | **68/132 (52%)**; 3.26.0 30/48 | 67/130 (52%) | [V1-q40] |
| FS-PO15/16 | Receipt fallback; trip missing | needs-events | — | unknown | not doing now; `receipt_scan_manual_fallback` exists (23 events/90 d) if needed |
| FS-PO17 | ≥ 2 landing sheets ≤ 60 s | needs-events | — | unknown | `landing_sheet_shown`, `post_onboarding_landed` need **T05d/T16b** |
| FS-EXP1 | Exposure by arm; S1 by arm | needs-events | S1 baseline as above | 61/367; 8/84 | `activation_exposure`, `activation_arm` need **T30** |

## 2. Query log (ids cited above)

All PostHog queries: `execute-sql`, 2026-11-12, `{RN}` + `{EXCL}` unless noted. DB: Supabase read-only.

| Id | What | Result (abridged) |
|---|---|---|
| V1-q1 | mobile event list 90 d (`$lib` RN) | 176 event names; none of the T01/T04/T05 events listed in summary item 8 |
| V1-q1b | non-RN events 90 d | `signup_completed` 462 (`$lib` null), `store_cta_click_server`, `rc_*`, `get_link_opened` |
| V1-q1c | property keys of 17 events, 30 d | as in summary item 8 |
| V1-q2 | FS-M, opens 7 d by ver × plat | 332 opens; `activation_fix_level`/`ota_update_id`/`runtime_version` 0; `$os` null on 332/332; `platform` null 97 |
| V1-q3 | `$os_name` × `platform` | `$os_name` null on all |
| V1-q4 | keys on null-platform opens | `$app_build`, `$app_namespace`, `$device_type`, no OS key |
| V1-q5 | Q-P1 with build fallback, 14 d | 3.26.0 android 33 + android* 86 (null platform, 1 open each); ios 20 + ios* 20; 3.27.0 ios 10/ios* 11; **3.28.0 android* 5**, ios 4, ios* 6 |
| V1-q6 | S2/S3 starters (Q-P6 shape) | 3.26.0 154 starters, 91 completed, 17 d2 |
| V1-q7 | S1 trailing (Q-P5 shape) | 3.26.0 8/84; 3.19.0 7/59; 3.19.1 14/85; 3.21.0 7/32 |
| V1-q8 | q02 base cohort | all 793 / ob_done 367 / core_w1 61 |
| V1-q9 | S3 Appendix B | ob_done 367 / d2 58 / engaged 37; all 793/72/39 |
| V1-q10 | top `$screen_name` 14 d | current names as in the F14 list |
| V1-q11 | S5 | see table |
| V1-q12 / q13 | S6; step values | 44/470; steps listed |
| V1-q14 | FS-OB1a | see table |
| V1-q15 | FS-OB1b `$screen` method | see table |
| V1-q16 / q17 | FS-OB1c as written / fixed | see table |
| V1-q18 | FS-OB1e draft | 10 relapsed, 6 completed twice of 292 |
| V1-q19 / q20 | FS-OB2a proxy / with sign-ins | Android 88/111 signed up either way |
| V1-q21 / q22 | FS-OB2b as written (60 d) / fixed (since 10-15) | as written mixes in cross-day gaps and drops riders whose first matching view preceded sign-up |
| V1-q23 | FS-OB3 | 19 / 16 |
| V1-q24 | FS-OB4 since 10-15 | see table |
| V1-q25 | FS-OB5 proxy + FS-OB7 | see table |
| V1-q26 | FS-PO1 | see table |
| V1-q27 – q29 | FS-PO2a, FS-PO2b offline split, FS-PO2b latency | see table |
| V1-q30 | FS-PO6 R6 SQL as written | `completers_as_written` 4,047 vs 116 distinct (3.26.0) |
| V1-q30a | FS-PO2d + FS-PO6 fixed (completions 09-13→11-10) | 3.26.0 29/116, rage 7/116 |
| V1-q31 | paywall requests by surface/limit_key | MAX_AI_DIAGNOSTICS 6/3; surfaces listed |
| V1-q32 / q33 | FS-PO3 as written / excl. upgrade surfaces | 3.26.0 9/22 → 9/14 (8 within 60 s) |
| V1-q34 | FS-PO3b | 4/5 |
| V1-q35 | FS-PO4a | ≥ 3.21 1/14 |
| V1-q36 / q36a | FS-PO8 with controls / FS-PO4b junk saves | see table |
| V1-q37 / q37a | FS-OB1d proxy / FS-PO5 | 12 riders (6 on 3.26.0) / 0 |
| V1-q38 | FS-PO9 (Q-P9) | 3.26.0 11/120 |
| V1-q39 | FS-PO10 | tap 16 (3), data 20 (12), null 10 (3) |
| V1-q40 | FS-PO11/12/13/14 per completer | see table |
| V1-q41 | FS-PO11 detail (3.26.0/3.22.0) | 5 completers, all `/(modals)/whats-new`, two on 3.26.0 after 10-12 |
| V1-db1 | `public.users` counts | 1,060 users, 19 `is_synthetic`, 26 in the q00-style exclusion |
| V1-db2 | S4(a) board q99 | as in the table |
| V1-db3 | day-0 task source by week | 11-09: 4 bikes `oem` (44 tasks), 9 bikes `user` (10 tasks) |
| V1-db4 | S4(b) R2-M1 | 10/155 |
| V1-db5 | FS-R2-3 proxy | 116 / 7 |
| V1-db6 | FS-R2-5; FS-OB1e two bikes ≤ 2 min | 6/176 short makes (60 d), 53/176 not in OEM makes; 2 users |
| V1-db7 / db8 | FS-R2-4; unit split + column default | mi 86 / km 90; `mileage_unit` default `'mi'` |
| V1-db9 | FS-PO4b S-R4-01 rerun | 71 riders with a ride / 360 sign-ups; 26 live < 50 m; 15 live null distance; 13 deleted |

## 3. Corrected SQL

`{EXCL}` = `person_id NOT IN (<13 test/synthetic person ids>)` (+ `e2e_run` rule after T01). `{RN}` = `properties.$lib = 'posthog-react-native'`. All ran in the shapes below.

### 3.1 `{REL}` platform (replace in §0)

Until T01 registers `platform` at client init, a cohort's first event usually has no platform and `$os` is never set. Take the platform from **any** event of the person:

```sql
-- inside the per-person aggregate
coalesce(
  argMinIf(lower(toString(properties.platform)), timestamp, properties.platform IS NOT NULL),
  multiIf(toInt(properties.$app_build) >= 100, 'ios?', 'android?')   -- build heuristic, valid only for 3.26.0–3.28.x (Android vc 93–99, iOS b 106–111)
) AS plat
```

Drop `$os` from `{REL}`. The build heuristic breaks once Android versionCode reaches 100; T01's acceptance check should be "`platform` non-null on 100% of `Application Opened`
including the first one".

### 3.2 FS-OB1b back-walk, `$screen` method (R1 Q8 reconstruction; keep beside `onboarding_back` after T04b)

```sql
SELECT plat, ver, count() AS riders, countIf(fast_backs >= 3) AS backwalkers,
       countIf(fast_backs >= 3 AND done) AS backwalkers_completed, countIf(done) AS completed
FROM (
  SELECT person_id,
    argMin(toString(properties.$app_version), timestamp) AS ver,
    coalesce(argMaxIf(lower(toString(properties.platform)), timestamp, properties.platform IS NOT NULL), 'unknown') AS plat,
    countIf(event = 'onboarding_completed') > 0 AS done,
    arraySort(x -> tupleElement(x, 1), groupArrayIf(
      tuple(timestamp, indexOf(['/(onboarding)','/(onboarding)/experience','/(onboarding)/bike-setup','/(onboarding)/reveal',
                                '/(onboarding)/goals','/(onboarding)/account','/(onboarding)/commitment','/(onboarding)/heard-about',
                                '/(onboarding)/notifications','/(onboarding)/personalizing','/(onboarding)/paywall'],
                               toString(properties.$screen_name))),
      event = '$screen' AND startsWith(toString(properties.$screen_name), '/(onboarding)')
        AND toString(properties.$screen_name) NOT IN ('/(onboarding)/sign-in','/(onboarding)/no-bike-value'))) AS s,
    arrayCount(i -> i > 1 AND tupleElement(s[i], 2) > 0 AND tupleElement(s[i], 2) < tupleElement(s[i-1], 2)
               AND dateDiff('second', tupleElement(s[i-1], 1), tupleElement(s[i], 1)) <= 5, arrayEnumerate(s)) AS fast_backs
  FROM events
  WHERE timestamp >= now() - INTERVAL 60 DAY AND {RN} AND {EXCL} AND event IN ('$screen','onboarding_completed')
  GROUP BY person_id HAVING length(s) > 0)
GROUP BY plat, ver ORDER BY plat, ver
```

### 3.3 FS-OB1c completion after resume (fixed ordering)

```sql
SELECT ver, target, count() AS resumed, countIf(t_done > t_res) AS completed_after
FROM (
  SELECT person_id,
    argMinIf(toString(properties.$app_version), timestamp, event = 'onboarding_resumed') AS ver,
    argMinIf(toString(properties.resume_target), timestamp, event = 'onboarding_resumed') AS target,
    minIf(timestamp, event = 'onboarding_resumed') AS t_res,
    maxIf(timestamp, event = 'onboarding_completed') AS t_done
  FROM events
  WHERE timestamp >= now() - INTERVAL 60 DAY AND {RN} AND {EXCL} AND event IN ('onboarding_resumed','onboarding_completed')
  GROUP BY person_id HAVING countIf(event = 'onboarding_resumed') > 0)
GROUP BY ver, target ORDER BY resumed DESC
```

### 3.4 FS-OB5 proxy + FS-OB7 (starters, 60 d)

```sql
SELECT ver, count() AS starters,
  countIf(saw_acct AND NOT later AND NOT authed) AS stopped_at_account,
  countIf(NOT done AND last_step = 'paywall') AS left_after_paywall, countIf(NOT done) AS non_completers
FROM (
  SELECT person_id, argMin(toString(properties.$app_version), timestamp) AS ver,
    countIf(event = 'onboarding_completed') > 0 AS done,
    countIf(event = 'onboarding_step_viewed' AND toString(properties.step) = 'account') > 0 AS saw_acct,
    maxIf(timestamp, event = 'onboarding_step_viewed' AND toString(properties.step) IN ('heard_about','notifications','personalizing','paywall','commitment'))
      > minIf(timestamp, event = 'onboarding_step_viewed' AND toString(properties.step) = 'account') AS later,
    countIf(event IN ('user_signed_up','user_signed_in','signup_completed')) > 0 AS authed,
    argMaxIf(toString(properties.step), timestamp, event = 'onboarding_step_viewed') AS last_step
  FROM events
  WHERE timestamp >= now() - INTERVAL 60 DAY AND ({RN} OR event = 'signup_completed') AND {EXCL}
    AND event IN ('onboarding_started','onboarding_step_viewed','onboarding_completed','user_signed_up','user_signed_in','signup_completed')
  GROUP BY person_id HAVING countIf(event = 'onboarding_started') > 0)
GROUP BY ver ORDER BY ver
```

### 3.5 FS-OB2b (fixed) and the per-completer pattern for FS-PO6/11/12/13/14 (replaces R6 SCOREBOARD joins)

```sql
-- FS-OB2b: seconds from server sign-up to the first later onboarding step
WITH s AS (SELECT person_id, min(timestamp) AS su_at, any(toString(properties.auth_method)) AS method
           FROM events WHERE timestamp >= {start} - INTERVAL 1 DAY AND event = 'signup_completed' GROUP BY person_id),   -- no {RN}: server event
     c AS (SELECT person_id, argMaxIf(lower(toString(properties.platform)), timestamp, properties.platform IS NOT NULL) AS plat,
                  groupArray(timestamp) AS views
           FROM events WHERE timestamp >= {start} AND event = 'onboarding_step_viewed'
             AND toString(properties.step) IN ('heard_about','paywall','notifications','commitment','personalizing') AND {RN} AND {EXCL}
           GROUP BY person_id)
SELECT method, plat, count() AS n, countIf(gap > 10) AS over_10s, countIf(gap > 10 AND gap <= 600) AS over_10s_foreground, max(gap) AS max_s
FROM (SELECT s.method AS method, c.plat AS plat,
             dateDiff('second', s.su_at, arrayMin(arrayFilter(t -> t > s.su_at, c.views))) AS gap
      FROM s INNER JOIN c ON c.person_id = s.person_id WHERE arrayExists(t -> t > s.su_at, c.views))
WHERE method IN ('google','apple')
GROUP BY method, plat
```

```sql
-- FS-PO6 / PO11 / PO12 / PO13 / PO14 (+ FS-PO2d): one row per completer, no join
SELECT ver, count() AS completers,
  countIf(arrayExists(x -> tupleElement(x, 1) >= t0 AND tupleElement(x, 1) < t0 + INTERVAL 1 HOUR AND tupleElement(x, 2) = '$rageclick', ev)) AS po6_rage_1h,
  countIf(arrayExists(x -> tupleElement(x, 1) >= t0 AND tupleElement(x, 1) < t0 + INTERVAL 1 HOUR AND tupleElement(x, 2) = '$screen' AND tupleElement(x, 3) ILIKE '%whats-new%', ev)) AS po11_whatsnew_1h,
  countIf(arrayExists(x -> tupleElement(x, 1) >= t0 + INTERVAL 5 SECOND AND tupleElement(x, 1) < t0 + INTERVAL 1 HOUR
          AND (tupleElement(x, 2) = 'user_signed_in' OR (tupleElement(x, 2) = '$screen' AND (tupleElement(x, 3) ILIKE '%sign-in%' OR tupleElement(x, 3) LIKE '/(auth)%'))), ev)) AS po12_signin_1h,
  countIf(arrayExists(x -> tupleElement(x, 1) > t0 + INTERVAL 10 SECOND AND tupleElement(x, 1) < t0 + INTERVAL 7 DAY
          AND tupleElement(x, 2) = 'onboarding_step_viewed' AND tupleElement(x, 4) != 'paywall', ev)) AS po13_onboarding_after,
  countIf(arrayExists(x -> toDate(tupleElement(x, 1)) = toDate(t0) AND tupleElement(x, 1) >= t0 AND tupleElement(x, 2) = '$screen' AND tupleElement(x, 3) ILIKE '%start-ride%', ev)
          AND NOT arrayExists(x -> toDate(tupleElement(x, 1)) = toDate(t0) AND tupleElement(x, 2) = 'ride_started', ev)) AS po14_opened_no_ride_d0
FROM (
  SELECT person_id,
    argMinIf(toString(properties.$app_version), timestamp, event = 'onboarding_completed') AS ver,
    minIf(timestamp, event = 'onboarding_completed') AS t0,
    groupArray(tuple(timestamp, event, coalesce(toString(properties.$screen_name), ''), coalesce(toString(properties.step), ''))) AS ev
  FROM events
  WHERE timestamp >= now() - INTERVAL 60 DAY AND {RN} AND {EXCL}
    AND event IN ('onboarding_completed','$screen','$rageclick','user_signed_in','onboarding_step_viewed','ride_started')
  GROUP BY person_id HAVING countIf(event = 'onboarding_completed') > 0)
GROUP BY ver ORDER BY ver
```

### 3.6 FS-PO8 first Discover → backgrounded (replaces the `leadInFrame` form; add the Garage control)

```sql
SELECT plat, anchor, count() AS persons, countIf(bg_s BETWEEN 0 AND 2) AS bg_2s, quantile(0.5)(bg_s) AS med_bg_s
FROM (
  SELECT person_id, anchor,
    argMaxIf(lower(toString(properties.platform)), timestamp, properties.platform IS NOT NULL) AS plat,
    minIf(timestamp, (anchor = 'discover' AND event = 'discover_tab_viewed')
                  OR (anchor = 'garage' AND event = '$screen' AND toString(properties.$screen_name) = '/(tabs)/(garage)')) AS t_d,
    arrayMin(arrayFilter(x -> x >= t_d, groupArrayIf(timestamp, event = 'Application Backgrounded'))) AS t_bg,
    if(t_bg > toDateTime('2000-01-01') AND t_d > toDateTime('2000-01-01'), dateDiff('second', t_d, t_bg), -1) AS bg_s
  FROM events ARRAY JOIN ['discover','garage'] AS anchor
  WHERE timestamp >= now() - INTERVAL 60 DAY AND {RN} AND {EXCL}
    AND event IN ('discover_tab_viewed','Application Backgrounded','$screen')
  GROUP BY person_id, anchor HAVING t_d > toDateTime('2000-01-01'))
GROUP BY plat, anchor ORDER BY plat, anchor
```

### 3.7 FS-PO3 until `trigger` exists

R3's SQL with one added filter: `AND coalesce(toString(properties.surface), '') NOT IN ('profile_subscriptions_row','profile_pro_banner')`, and `properties.*` wrapped in
`toString()` (the bare `properties.feature` group key works, but `coalesce(properties.surface,'')` on a JSON field is type-fragile).

### 3.8 DB metrics

```sql
-- S4(a) with a source split (board q99 + oem column); exclusion = is_synthetic, e2e-%, test domains, soft-deleted 2026-11-10
… count(*) filter (where exists (select 1 from maintenance_tasks t where t.motorcycle_id=b.id and t.deleted_at is null
                                  and t.source='oem' and t.created_at < b.created_at + interval '1 day')) as with_oem_tasks_d0 …

-- FS-R2-5: onboarding bikes with a junk make (no NHTSA table exists)
select count(*) bikes, count(*) filter (where length(regexp_replace(coalesce(m.make,''),'[^A-Za-z]','','g')) < 3) short_make
from motorcycles m join public.users u on u.id = m.user_id
where m.created_at = u.onboarding_completed_at and m.created_at >= now() - interval '60 days' and <exclusion on u.>;

-- FS-PO4b DB share: count null distance as sub-floor
… count(*) filter (where status='completed' and not deleted and coalesce(distance_m, 0) < 50) …
```

Supabase gotcha: the plan's exclusion fragment uses bare `deleted_at`/`email`; inside a join with `motorcycles` it fails with "column reference deleted_at is ambiguous".
Qualify it (`u.deleted_at`, `u.email`).

## Effect on plan confidence

**Confirmed (baselines reproduce within window drift):** §1.2 S1 (61/367; 3.26.0 8/84), S2 (367/793; 3.26.0 starters ~59%), S3 (37/367, 39/793), S4(a) 25/111 and 127/204,
S4(b) 10/~155, S5 (3.26.0 13 and 8 of ~120), S6 (16/166); FS-M 0%; FS-OB1a (6 of 10 stuck), FS-OB1e relapse 10/~291, FS-OB3 16/19, FS-OB6(a) 6/~282, FS-PO1 7/~118,
FS-PO1H, FS-R2-3 (116/7), FS-PO2a (3/5, 9), FS-PO2b (p90 47 s, 10/3, 7/14), FS-PO2c (6/3), FS-PO2d (29/~117), FS-PO3b (4/5), FS-PO4b (13/11; 15/13; DB 26/71), FS-PO5 (0),
FS-PO9 (11/~120), FS-PO10, FS-PO14 (~52%). The plan's problem statements behind **T07, T08, T09, T10, T11, T17, T21, T22, T24** rest on numbers that hold today.
Q-P5…Q-P9 and the R3/R4 HogQL run as written in HogQL (with `toString()`).

**Corrected (the plan needs these edits):**
1. **§0 `{REL}`** — remove `$os`; use the person-level `platform` fallback in §3.1. **T01** acceptance: `platform` set on 100% of `Application Opened`, including the first
   open. **T03b** tiles must not group by the first event's `plat` before T01 ships.
2. **§0.1 Q-P1 / §6 row 0** — "No android row on 3.27/3.28" is an artefact of null `platform`: Android vc95 (3.27.0) and vc96–99 (3.28.0) opens exist (5 non-test riders on
   3.28.0 in 14 d). Keep "Android production = 3.26.0 (vc93)", and add `$app_build` to `{REL}` so staged/tester builds are separable (**T18**, **T35** release reads).
3. **§0 conventions** — `{RN}` must not apply to `signup_completed` (server event, `$lib` null) (FS-OB2a, FS-OB2b, FS-OB5).
4. **FS-PO6, FS-PO12, FS-PO13** — replace the R6 SCOREBOARD join SQL with §3.5 (as written it counts event rows). New baselines: FS-PO12 **11/292 (3.26.0 5/120)**,
   FS-PO13 **7/292 (3.26.0 5/120)**. These replace "Baseline: T06 item 1" and lower **T06 item 1** to "confirm with replays", since the numbers now exist. T15/T15b have a
   measurable target: about 4% of completers today.
5. **FS-PO8** — baseline is **42/43 Android first Discover visits backgrounded within 2 s** (iOS 0/28; Garage control 1/59), not "n = 1". Raise **T29** (and D12, the
   Discover location ask) from an Android polish item to a likely first-session friction affecting nearly every Android rider who opens Discover. **T06 item 8** should
   confirm the dialog type on a device (location vs another prompt).
6. **FS-PO3 / S5** — denominator 14 automatic-gate sessions on 3.26.0 (9 with a repeat = 64%), not 22 (41%). Until **T21** adds `trigger`, exclude
   `profile_subscriptions_row`/`profile_pro_banner`.
7. **FS-PO4a** — baseline **1/14** (≥ 3.21; consistent with the board's 1/13), not 3/20. **FS-EXP1/T31** outcome reads are even smaller-n than stated.
8. **FS-OB1e** — "4 completed twice" → **6**. **FS-OB1c** — use the ordered SQL (§3.3); baseline bike-setup 8/31, account 5/13. **FS-OB1b** — commit the `$screen`
   SQL (§3.2) to `queries/fs/`; baseline Android 28/201, iOS 14/72.
9. **FS-OB2a** — proxy baseline **23/111 (20.7%)** for 10-15→11-12, not 20/124 (16.1%); the target "≤ 10%" is now a bigger relative drop. **FS-OB2b** — use §3.5
   (first step after sign-up; ignore > 10 min gaps); baseline 6/124 OAuth > 10 s. Rename `activation_release` → `activation_fix_level` in M-OB2, M-OB3 and M-OB4.
10. **FS-PO11** — 3.26.0 shows **2/120** completers on `/(modals)/whats-new` within 1 h (10-23, 11-05), not 0/90. Check whether these were opened by the rider before
    calling it settled. Keep it as a regression tile.
11. **S4(a)** — add a `source='oem'` column. Rider-created tasks already lift the partial week 11-09 to 12/24, so the "≥ 55% for 4 weeks" target could be met without
    **T07**. Judge **T07** on S4(b)/R2-M1 (OEM only).
12. **FS-R2-4** — `motorcycles.mileage_unit` defaults to `'mi'` (86/176 onboarding bikes are `mi`). The DB denominator must come from `measurement_system` or the T07a
    event's `unit`, not the column.
13. **FS-R2-5** — define the baseline on the spec's own denominator: **6/176 onboarding bikes in 60 d with a make under 3 letters**. No known-make table exists (T37 closed),
    so "not a known make" needs T05e `make_valid` (**T25b**).
14. **FS-PO4b DB** — 15 more first rides are live with **null distance**; count them as sub-floor or report them separately, or "< 5%" is understated.
15. **S1** — align the definition and the baseline anchor (7 d from `onboarding_completed`, as in Q-P5) for the T03 tile and the Exp 1 primary (**T30/T40**).
16. **§0 `{EXCL}`** — the list has 13 persons, not 12 (the 11 synthetic persons plus 2 filter-only ids). The project's own test-account filter is a usable stand-in for the
    hard-coded ids, except for the synthetic users.
17. **Supabase snippets** — qualify `u.deleted_at`/`u.email` in the exclusion (it is ambiguous inside joins).

**Needs events (not failures; the queries are written):** FS-OB1b `onboarding_back` (T04b), FS-OB1d (T04b), FS-OB1f (T04b), FS-OB2a/2c/5 split (T04a), FS-OB2b
`wait_ms` (T04a), FS-OB3 restored (T04b/T13a), FS-OB6(b) and FS-PO17 (T05d/T16b), FS-PO7 (T05d/T29), FS-R2-3 (T05d/T23), S4 PostHog tile (T07a/T07b), FS-PO2b reason
(T17), FS-PO2c limit sheet (T24), FS-PO3 `trigger`/`paywall_suppressed` (T21), FS-PO4a `variant` (T31), FS-PO1 `bike_limit_choice` (T22), FS-PO3b `is_embedded_launch`
and every `lvl`/`ota` breakdown (T01), FS-EXP1 (T30). That is consistent with the plan's own "after T0x" notes. No metric the plan marks *(run)* depends on an event
that does not exist.

**Net confidence effect:** the plan's measurement layer is sound for version-level reads (about 30 of 47 metrics reproduce). The platform breakdown, three R6-derived
tiles, and the FS-PO3/FS-PO8 baselines need the fixes above before **T02** records baselines and **T03** builds tiles. B ("plan well defined") is unchanged or slightly
down until T02 takes these SQL blocks. A ("we know what to do") is slightly **up** for **T29**, now backed by a strong Android signal. Confidence in these conclusions:
high (≥ 85%) for the reproduced baselines and the three SQL bugs (re-run evidence); medium (≈ 70%) that FS-PO8's backgrounding is the location permission dialog and
not another Android lifecycle artefact (the Garage/Profile controls make an artefact unlikely, but the dialog type is not observed); medium for the FS-OB2a proxy
difference (the R5 window and exclusion could not be reconstructed exactly).
