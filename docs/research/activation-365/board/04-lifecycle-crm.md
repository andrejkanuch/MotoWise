# 04 Lifecycle / CRM marketer

Board member 04, first draft 2026-11-12, revised the same day after the Skeptic's rounds 1 and 2 (see "Answers to review" at the end). Research and planning only. No code, flags or external services were changed.
The code was read at `origin/main` 5a497a1c. The local checkout (63e98d17) is behind it, and the files cited below differ only slightly between the two.
I ran read-only queries against production Supabase through the Management API, because the push-token gap in the pack (§8b) needed an explanation, two read-only PostHog `execute-sql` queries for the first revision (queries E and F) and two more for the second (queries G and H). The SQL is at the end of this file.

## Diagnosis

1. **No message ever reaches a new rider between day 0 and day 7, and on Android most messages could not reach them at all.**
   - The pack confirms there is no re-engagement message [SOURCE: evidence pack §1].
   - I followed up on the gap the pack flagged (57 stored tokens against 176 grants, §8b). **All 105 push tokens ever stored in production are iOS. There are 0 Android tokens, ever** [SOURCE: Supabase prod `device_push_tokens`, query A below]. In the cohort the 57 tokens are exactly the iOS grants: iOS 57 granted [SOURCE: evidence pack §4] against 57 iOS tokens [SOURCE: query B].
   - The cause: Android has no Firebase (FCM) configuration. `app.config.ts` declares no `googleServicesFile` and the repo has no `google-services.json` [SOURCE: apps/mobile/app.config.ts:371-391 on origin/main; `git ls-files` finds none]. Expo says that file "is required for your Android app to be registered with FCM" [SOURCE: https://docs.expo.dev/push-notifications/fcm-credentials/ — "This file is required for your Android app to be registered with FCM." (Expo docs, opened 2026-11-12)].
   - The failure is silent. `registerForPushNotifications` catches the error and calls `logger.warn` [SOURCE: apps/mobile/src/lib/push-token.ts:78-80], and `logger.warn` does nothing in production builds [SOURCE: apps/mobile/src/lib/logger.ts:4-5].
   - So the server-sent pushes that exist today (the ride-idle sweep and maintenance-due push) have never reached the Android riders, who are 70% of installs (559/793) [SOURCE: evidence pack §2].
   - **Local notifications are a separate path.** They are scheduled on the device and do not use FCM. On Android, only *immediate* local notifications are shown to reach riders today: `reminder_opened{kind:'ride_idle'}` has 5 opens from Android builds [SOURCE: PostHog query F]. A *date-scheduled* local notification on Android is unobserved: one `maintenance` open ever, from an Android build (3.19.0) [SOURCE: PostHog query F]. The app deliberately has no exact-alarm permission, so Android delivers scheduled notifications late by design [SOURCE: apps/mobile/app.config.ts:379-389 on origin/main; F16]. A local day-1 message is still the only channel we can ship this month, but its Android delivery must be checked before launch (P04.1).

2. **The permission screen itself is not the leak. Its reach is.**
   - The notifications step comes after account (and after the paywall in `commit_first`) [SOURCE: apps/mobile/src/config/onboarding.ts:157-203].
   - 380 riders view it and 370 move on to personalizing [SOURCE: evidence pack §2], so the screen loses about 10 people.
   - 176 grant, which is about 46% of viewers but only 22% of installs [SOURCE: evidence pack §4 (119 Android + 57 iOS); viewers from §2].
   - The 23% drop before it (account 496 → notifications 380) is sign-up friction, not the permission ask.
   - Of every 100 installs, about 22 could receive a local nudge today, and about 7 (iOS grants only) could receive a server push.

3. **The window for a message is the first 24 hours.**
   - 56 of the 61 riders who did a week-1 core action did it within 24 h of first open (40 within the first hour, 16 in hours 1–24). Only 5 did it on days 1–7 [SOURCE: evidence pack §3 `ttfc`].
   - Riders who don't act on day 0 almost never come back on their own: 7.4% day-2 return with no day-0 core action [SOURCE: evidence pack §3].
   - A message at day 3 or day 7 arrives after most of the cohort has already gone.

4. **There are two warm groups, and today we say nothing to either.**
   - 76 riders tapped Start on day 0 but saved no ride; 26% of them came back on day 2 [SOURCE: evidence pack §3].
   - Two thirds of first ride attempts end in "ride too short", which fits testing the button at home [SOURCE: evidence pack §3, q05].
   - The *track_rides* riders who did not save a ride: 22/237 returned on day 2 (9.3%) [SOURCE: evidence pack §4].
   - These riders have told us what they want, and their next ride is usually not today.

5. **What to say on a non-riding day has to come from the garage, not the road.**
   - It is November, off-season in most of Europe and the northern US [UNBACKED — own idea; no seasonality data pulled].
   - Riders came from the web for their model's service schedule: 62% of search clicks [SOURCE: evidence pack §7].
   - The garage content that riders act on is expenses: expense-first riders returned on day 2 at 41% (9/22) [SOURCE: evidence pack §3]. Maintenance-first riders returned at 7%.

## Findings

**Benchmarks (all from vendors, and none from motorcycle or seasonal apps)**

- **F1. Day-2 benchmark.** Airship's "Day 2 Activation Rate" (return on the 2nd day after download) has a cross-category average of 16%. Category medians: Sports 18%, Travel & Local 14%, Tools 13%. Low performers (10th percentile) are at 7–8% [SOURCE: https://growth.airship.com/rs/313-QPJ-195/images/Airship-Mobile-LifecyleBenchmarks-Activation-en.pdf — "The average Day 2 Activation Rate across categories is 16%"; Sports median 18%, Tools 13%, Travel & Local 14%, 10th pct 7–8% (Airship, vendor; PDF metadata 2023-12)].
  - Our 9.1% (72/793) [SOURCE: evidence pack §2] sits between the low performers and the median.
  - Transfer: partial. Airship's customers are large consumer apps, and none of the categories is a seasonal motorcycle utility. Treat it as an order of magnitude, not a target.
- **F2. Message cadence of high performers.** Airship says the high performers' "pattern of repeat visits is typically connected with welcome series messaging delivered via push notifications or email". The days with "the highest potential impact on activation rate" are days 3, 7, 13, 14, 20, 21, 27, 28 and 29 [SOURCE: same Airship PDF, p.10–11 (vendor, 2023)].
  - This is a correlation reported by a vendor that sells welcome series. It is not an experiment.
  - Transfer: weak for day 3+. Our activation is concentrated in the first 24 h (Diagnosis 3).
- **F3. Effect of a first-week onboarding push.** Braze says one onboarding push in the first week "can increase retention by 71% over two months", and push plus a second channel 130% [SOURCE: https://www.braze.com/resources/articles/app-engagement-6-stats — "can increase retention by 71% over two months" / "130%" (Braze, vendor; article dated 2016-07-20)].
  - These are 2016 figures from Appboy (Braze's former name), with no stated sample, and they compare apps that message against apps that don't. They are not a lift you can apply to us.
  - I cite them only to show that the direction is widely claimed. **I do not use them as the expected effect.**
- **F4. OneSignal retention baselines.** Average day-1 / day-7 / day-30 retention is 28.29% / 17.86% / 7.88%. Utilities are at 28.18% / 16.75% / 9.2% and Lifestyle at 25% / 13.13% / 5.94%. Apps that send onboarding messages earn "higher 30-day retention rates and 24% higher install-to-purchase conversion rates" [SOURCE: https://onesignal.com/mobile-app-benchmarks-2024 — figures as quoted (OneSignal, vendor, 2024; no methodology on page)].
  - Their "day-1" is not our "day-2 calendar return", so the definitions differ. Don't compare directly.
- **F5. Push opt-in rates.** Airship medians for 2025 are Android 53.3% and iOS 48.85% [SOURCE: https://www.airship.com/mobile-app-push-notification-benchmarks-for-2026/ — "Android: 53.3%", "iOS: 48.85%" (Airship, vendor; data Jan–Dec 2025, apps with ≥1,000 active users)]. Batch reports Android falling "from 85% to 67%" after Android 13, and iOS "from 58% last year to 56% now" [SOURCE: https://batch.com/blog/case-studies/benchmark-notifications-push-crm-mobile — quotes as given (Batch, vendor; data Jul 2024–Jul 2025, 10,000 apps)]. OneSignal's Utilities figures are Android 51.5% and iOS 51.6% [SOURCE: OneSignal 2024 page above].
  - Our grant rate is about 46% of the riders who see the screen, or 22% of installs.
  - The vendors' denominators are "users", not "users who saw the ask", so we are in the same range as the median **for those we ask**. **The gap is in how many riders we ask, not in how many say yes.**
- **F6. Airship on onboarding campaigns (corrected in revision).** Airship: "Our data shows that apps running onboarding campaigns see lifted opt-in rates, as high as 40% above their category average." The page gives no sample, period or method for this sentence, so treat it as an unspecified internal vendor figure. On re-asking: "Simply ask once, and if they say no, set the stage to ask again", and time prompts "to match high-intent moments in the customer journey" [SOURCE: https://www.airship.com/mobile-app-push-notification-benchmarks-for-2026/ — quotes as given (Airship, vendor; re-opened 2026-11-12)]. My first draft put a sentence in quotation marks that is not on the page; it is withdrawn.

**Platform rules and permission timing**

- **F7. Android timing guidance.** Google: "Before you ask users to grant any permissions, let them familiarize themselves with your app", and "request notification permissions … in the correct context" [SOURCE: https://developer.android.com/develop/ui/views/notifications/notification-permission — quotes as given (Google, Android docs, opened 2026-11-12)].
  - On Android 13+ new installs, "notifications are off by default", and a swipe-away leaves the state unchanged, so the rider can be asked again.
  - Our app already asks in context at ride start, when the status is still `undetermined` [SOURCE: apps/mobile/src/features/ride/ride-controller.ts:110-123]. That path fires no analytics event and does not register a push token until the next launch [SOURCE: same lines; registration only at apps/mobile/src/app/_layout.tsx:949 and onboarding notifications.tsx:185].
- **F8. iOS provisional authorization.** Expo exposes iOS provisional authorization (`allowProvisional`): "The ability to post noninterrupting notifications provisionally to the Notification Center" [SOURCE: https://docs.expo.dev/versions/latest/sdk/notifications/ — quote as given (Expo docs, opened 2026-11-12)].
  - Our app never requests it [SOURCE: `git grep allowProvisional` on origin/main → no hits].
  - Apple's own pages did not render through my fetch tool, so I cite only Expo's description.
- **F9. Apple's rule on marketing pushes.** Apple guideline 4.5.4: pushes "should not be used for promotions or direct marketing purposes unless customers have explicitly opted in … and you provide a method in your app for a user to opt out" [SOURCE: https://developer.apple.com/app-store/review/guidelines/ — 4.5.4 as quoted (Apple, opened 2026-11-12)].
  - So the copy must be about the rider's own bike and data (a service message), never a Pro upsell.

**Email and consent**

- **F10. Consent for email to free sign-ups.** The UK soft opt-in example rests on a purchase: "When making a purchase, customers gave their email address and were offered a clear opt-out" [SOURCE: https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-direct-marketing-using-electronic-mail/what-else-do-we-need-to-consider/ — quote as given (ICO, opened 2026-11-12)].
  - The page does not say whether a free sign-up qualifies. A legal summary of the ICO's draft code says it treats in-app messages and push as electronic marketing too (search snippet only; I did not open it, so it is not relied on).
  - Our DB stores **no marketing-email consent**. The only contact flag is `feedbackContact`, set by 22 cohort riders [SOURCE: Supabase prod `users.preferences` keys, query C]. The API's email service sends transactional mail only (data export, deletion, feedback) [SOURCE: apps/api/src/modules/email/email.service.ts:92-209].
  - A day-1 email to EU riders would therefore need a new consent step. [UNBACKED — own inference, not legal advice.]
- **F11. `seasonalTips` is a silent default, not an opt-in (corrected in revision).** `seasonalTips: true` is stored for 354 cohort riders [SOURCE: query C]. But the onboarding store initialises it to `true` [SOURCE: apps/mobile/src/stores/onboarding.store.ts:159, origin/main], its setter is never called from any screen (`git grep setSeasonalTips` finds only the store, lines 136/190/226), and the `seasonalTipsLabel` strings exist in the locales but nothing renders them. personalizing.tsx then sends the default to the API [SOURCE: apps/mobile/src/app/(onboarding)/personalizing.tsx:126, 260].
  - So no rider saw or chose this value. It is **not** consent for anything and must not be used as a contact basis. My first draft's "an opt-in we have never used" is withdrawn.

**Behaviour-triggered sequences (vendor case studies)**

- **F12. Monarch Money.** It replaced "a time-based sequence of four generic emails" with behaviour-triggered prompts and reported a "3.36% drop in trial cancellations" and a "2.5% lift in users updating categories" [SOURCE: https://customer.io/learn/case-studies/monarch-money — figures as quoted (Customer.io, vendor case study)].
  - Transfer: the mechanism transfers (trigger on what the rider did or didn't do). The size of the lift doesn't, because Monarch is a fintech app.
- **F13. PostHog's onboarding emails.** Open rates were 50–68% and CTR 2.4–16%. The best email was a personal one tied to the role the user chose at sign-up (68% open, 16% CTR) [SOURCE: https://posthog.com/blog/how-we-built-email-onboarding — figures as quoted (PostHog, own-product blog; published 2024-02-19, updated 2025-02-18)].
  - Transfer: B2B SaaS, so weak. What carries over is that **messages keyed to the goal the user chose beat generic ones**. That supports branching our message on `primary_goal`.
  - Airship says personalized pushes have "a 22% average lift in direct open rates" [SOURCE: Airship Activation PDF p.13 (vendor, 2023)].

**Measuring at our scale**

- **F14. A simple sequential test.** "If T−C reaches 2√N, stop the test. Declare the treatment to be the winner"; "If T+C reaches N … Declare no winner". N is a cap on total conversions [SOURCE: https://www.evanmiller.org/sequential-ab-testing.html — rules as quoted (Evan Miller, statistician's blog)].
  - With about 1.5 eligible riders a day and single-digit conversions a month, even this test won't decide within a quarter. See the measurement notes per proposal.

**Android delivery of a scheduled local notification (added in revision)**

- **F16. Inexact alarms can arrive late.** For `set()`/`setAndAllowWhileIdle()`, "the alarm never goes off before the supplied trigger time", and "On Android 12 (API level 31) and higher, the system invokes the alarm within one hour of the supplied trigger time, unless any battery-saving restrictions are in effect such as battery saver or Doze". Also: "Alarms don't fire when the device is in Doze mode … Any scheduled alarms are deferred until the device exits Doze" [SOURCE: https://developer.android.com/develop/background-work/services/alarms/schedule — quotes as given (Google, Android docs, opened 2026-11-12)].
  - Our app relies on exactly this path: the config comment says expo-notifications "degrades to AlarmManagerCompat.setAndAllowWhileIdle when the permission is absent" and that no exact-alarm permission is declared [SOURCE: apps/mobile/app.config.ts:379-389, origin/main].
  - Expo says the same from its side: "Without this permission, scheduled notifications arrive at an approximate time", and "Android 14 (API level 34) and later deny the permission by default for newly installed apps" [SOURCE: https://docs.expo.dev/versions/latest/sdk/notifications/ — quotes as given (Expo docs, opened 2026-11-12)].
  - So an 18:00 nudge on Android is "18:00 to about 19:00 if the phone is awake, later if it dozes". OEM battery savers on top of this are [UNBACKED — not researched here].
- **F17. Delivery can be observed on the next open.** Expo's `getPresentedNotificationsAsync` "Fetches information about all notifications present in the notification tray (Notification Center)" [SOURCE: same Expo page, opened 2026-11-12]. That lets the app see, on the next open, a nudge that was delivered but not tapped.

**Our own baseline for the nudge test (added in revision)**

- **F18. Day-2 engaged return for granted completers (definition replaced in round 2).** Riders who completed onboarding and granted permission: **171**, raw day-2 return **35 (20.5%)**, *engaged* day-2 return **23 (13.5%)**. By platform: Android 115, raw 20, engaged **11 (9.6%)**; iOS 56, raw 15, engaged **12 (21.4%)** [SOURCE: PostHog query H, re-run with 06's definition; query E gave the same counts with my old list]. Day-2 core action: 12/171. Day-2 `reminder_opened`: 2 [SOURCE: PostHog query E].
  - "Engaged" is **board 06's F14 definition, word for word, and no other**: day-2 return as in the pack, and on that day a core action or a `$screen` whose `$screen_name` is not in 06's exclusion list (home, What's New, every onboarding and sign-in route, and any name starting with `/(onboarding)` or `/(auth)`) [SOURCE: board/06-experimentation-analyst.md:71-73]. My own shorter list from round 1 is withdrawn. Query H applies 06's list exactly; it gives the same 23/171 as 06 [SOURCE: board/06-experimentation-analyst.md:73], so the baseline in P04.1 is unchanged.
  - The raw figures match board 06's 35/171 [SOURCE: board/06-experimentation-analyst.md R2], so the population is the same one 06 used.
- **F19. Winter enrolment (added in round 2).** Granted onboarding completers per install week (Monday start), same exclusions: Aug–Sep weeks 10–23; the last four full weeks (12 Oct – 8 Nov) 10, 13, 7, 14, so **44 in 4 weeks, about 11 a week or 1.6 a day** [SOURCE: PostHog query G]. That is below the ~14 a week of the full cohort window and close to 06's winter assumption (×1.4 slower, about 1.4 a day) [SOURCE: board/06-experimentation-analyst.md Diagnosis 4; review-06 R2.1].

**Non-riding-day content (not backed)**

- **F15.** Search results show apps whose main feature is a "good day to ride" alert, such as rider weather and riding-window apps. I could not open their store pages (404), so I cite none of them. A "riding window" message as a non-riding-day hook is [UNBACKED — own idea], and it doesn't fit November in the target markets anyway.

## Proposals

### P04.1 — A local day-1 "next step" notification, branched on the rider's goal, cancelled by any core action

- **Hypothesis.**
  - Riders who finish onboarding and grant permission, but do no core action on day 0, will come back *and do something* on day 1 more often if a single local notification names the one next step that fits the goal they chose.
  - The local path needs no FCM, so it can reach granting riders on both platforms. On Android, date-scheduled delivery is late by design and so far unobserved in our data (Diagnosis 1, F16), so step 7 below checks it before the test starts.
- **The exact change.**
  1. In `apps/mobile/src/lib/notifications.ts` add `NOTIFICATION_KIND.ACTIVATION: 'activation'` and a function `scheduleActivationNudge({ goal, bikeName, make, sawTooShort, gpsFix, scheduleTier })`. `gpsFix` is `true | false | null` (null when the sheet event has no `gps_fix` property, see step 6). `scheduleTier` is `'model' | 'make' | 'generic' | 'none'` (definition in step 6). It uses the existing DATE trigger pattern [SOURCE: apps/mobile/src/lib/notifications.ts:174-177].
  2. Schedule it once, from `personalizing.tsx` when onboarding completes, only if permission is granted at that moment and only for riders in the `test` arm (see measurement, step 1, for who is assigned). The copy branch is re-chosen when the rider leaves day 0 without a core action (the app's last background on day 0), so a too-short sheet seen after onboarding is taken into account [UNBACKED — own design; if re-scheduling on background proves unreliable, choose the branch at schedule time and accept that late sheets are missed]. It targets the **next calendar day at 18:00 local time**. Every other reminder uses 09:00 local [SOURCE: apps/mobile/src/lib/notifications.ts:140-162]; 18:00 is chosen as after-work, garage or ride time [UNBACKED — own idea]. On Android, expect delivery up to about an hour later, or after Doze ends (F16).
  3. Cancel it the moment any core action fires: `ride_completed` with no `below_min_ride`, `expense_added`, or `maintenance_task_completed`.
  4. One notification only. No day-3 or day-7 follow-ups. This is the board's merged "one `activation` message per rider in days 0–7" (Responses item 2).
  5. **Opt-out (corrected).** The real off-switch is the OS setting. The Profile → Notifications toggles are account preferences that the screen itself says do not silence device reminders [SOURCE: apps/mobile/src/app/(tabs)/(profile)/notifications.tsx:122-123, 133], and none of them is tied to this message. I drop my claim that a Profile toggle is an opt-out. Because only one message is ever sent, no new toggle is proposed.
  6. **Copy (revised to the board's merged copy; all shipped locales via `t()`, keys `notifications.activation.*`; no Pro, price or "free" wording, per Apple 4.5.4, F9).**
     - *track_rides*, saw the short-ride sheet on day 0, **branched on `gps_fix`** (R2.2). The board's sheet copy uses the affirming title only when a GPS fix arrived [SOURCE: board/03-behavioural-scientist.md:250-258, 339]. The nudge follows the same rule, reading `gps_fix` from the rider's last day-0 `ride_too_short_shown` (the property 03 P03.2 adds [SOURCE: board/03-behavioural-scientist.md:261]):
       - `gps_fix = true`: title "Test ride: all good", body "GPS and recording work. Your first real ride is saved once you're riding. Tap Start as you set off."
       - `gps_fix = false`, **or no `gps_fix` property** (P03.2 not shipped, or an older build): the neutral version, title "Testing it out?" (P05.1's and 03's wording), body "Your first real ride is saved once you're actually riding. Tap Start as you set off." It makes no claim that GPS works.
       - Neither body states the 50 m figure: the guard also needs 30 s, so a number alone would be wrong [SOURCE: board/review-02-onboarding-ux.md R1.5; apps/mobile/src/utils/ride-constants.ts:25-26 on origin/main, `MIN_RIDE_ELAPSED_S = 30`, `MIN_RIDE_DISTANCE_M = 50`]. Tap opens home with Start.
     - *track_rides*, no Start tap: title "Riding today?", body "Open MotoVault and tap Start when you're on the bike, so your first route gets saved." This is 03's P03.1 message text verbatim [SOURCE: board/03-behavioural-scientist.md:170-171]. Tap opens home.
     - *maintain_bike*, **branched on the schedule tier of the bike's tasks** (R2.1). "The bike has tasks" alone is not enough: about 5% of cohort bikes have a model-level schedule, 62–63% only make-generic and 32% only GENERIC [SOURCE: board/05-rider-voice.md:99-104; board/01-activation-pm.md F13], and since October most day-0 bikes have no tasks at all (45/127; maintain_bike 7/34) [SOURCE: board/05-rider-voice.md:27].
       - **Tier definition.** `scheduleTier` comes from the OEM rows the bike's tasks were imported from, using the service's own waterfall [SOURCE: apps/api/src/modules/oem-schedules/oem-schedules.service.ts:95-100, 148-151 on origin/main]: a row with a non-null `model` → `'model'`; `make = 'GENERIC'` → `'generic'`; any other make row with a null `model` → `'make'`; the bike has no maintenance task → `'none'`. The `OemSchedule` GraphQL type already exposes `make` and `model` [SOURCE: apps/api/src/modules/oem-schedules/models/oem-schedule.model.ts:13, 20 on origin/main], but the mobile preview query does not select them [SOURCE: apps/mobile/src/graphql/queries/oem-schedules-preview.graphql on origin/main], so one client query change (add `make model`) is needed. Tasks also carry `oem_schedule_id` [SOURCE: supabase/migrations/00022_oem_schedules_and_task_extensions.sql:39], which allows the same lookup server-side.
       - `'model'`: 05's "Next up for your {bikeModel}: {task}. When did you last do it?" [SOURCE: board/05-rider-voice.md:206-209]. Tap opens the bike's Service segment.
       - `'make'`: the tier is named, as 05 labels it: "A typical {make} service plan starts with {task}. When did you last do it?" [SOURCE: board/05-rider-voice.md:148-152, "Typical {{make}} intervals"]. No interval or due date is stated, because make-level intervals are known to be wrong for at least one model (the Honda 2× case) [SOURCE: board/05-rider-voice.md:104]. Tap opens the Service segment.
       - `'generic'` or `'none'`: the expense copy below. 05's "Set up your {make}'s service plan: 2 taps" needs P05.2's sheet [SOURCE: board/05-rider-voice.md:217]; it replaces the expense copy only if P05.2 has shipped before the test starts, never mid-test.
       - Expected volume, so nobody reads much into this branch: of 90 maintain_bike riders' first bikes, 2 were model-level and 52 make-level [SOURCE: board/05-rider-voice.md:103], before the October drop in imports. The model branch will reach about zero riders in the test.
     - *manage_expenses*, *just_exploring*, *discover_routes*: title "What has your {bikeName} cost you this year?", body "Log fuel, a part or a service in a few seconds." Tap opens the add-expense sheet for that bike. "It's free, always." is removed: it is a permanent pricing promise and would need the owner's sign-off.
     - **The `maintain_bike` branch is an owner-chosen bet, not a data-backed choice (R1.6).** No branch has evidence that its copy *causes* a return. The 41% expense-first return is selection (riders who chose to log an expense), and `maintain_bike` riders logged 0 week-1 expenses [SOURCE: evidence pack §3, §4]. I recommend 05's "when did you last" copy because it matches the goal the rider stated and states no due date, with the tier named for make-level bikes and the expense fallback for generic or no schedule [UNBACKED — own judgement]. The owner picks; the copy is then frozen for the test, and results are reported per branch as description only (no per-branch test: the branches hold a handful of riders each).
  7. **Android delivery check before launch (R1.8).** On one Android 13+ and one Android 14+ device (a stock Pixel and, if available, a Samsung with its default battery settings): schedule the nudge, lock the phone overnight, and record the actual delivery time against 18:00. Record the same on iOS. If Android delivery misses the evening entirely, move the Android trigger earlier rather than add an exact-alarm permission, which the app chose not to declare [SOURCE: apps/mobile/app.config.ts:384-389].
  8. New events:
     - `activation_nudge_scheduled {arm, goal_branch, gps_fix, schedule_tier, fire_at_local_hour, platform}` (fired for the control arm too, with `arm:'control'`, as the "would have been sent" marker)
     - `activation_nudge_cancelled {reason: 'core_action'}`
     - `activation_nudge_presented {platform}`: on the next app open, if `getPresentedNotificationsAsync()` still shows the nudge in the tray, log it (F17). Delivered = opened + presented-but-unopened; scheduled minus delivered = a delivery failure or a cleared tray, read per platform.
     - `reminder_opened {kind: 'activation', action}`, reusing the existing event at apps/mobile/src/app/_layout.tsx:977 and filling the gap the pack names in §9.
     - `notification_permission_status {granted, previous, platform}`: see the stop rule.
- **Target metric and baseline (corrected, R1.5).**
  - Primary: **day-2 engaged return** among riders who completed onboarding with permission granted at that moment (06 F14's definition, see F18). Baseline **23/171 (13.5%)**: Android 11/115 (9.6%), iOS 12/56 (21.4%) [SOURCE: PostHog query E]. Stratify by platform; the gap between platforms is larger than any plausible effect.
  - Secondary: raw day-2 return (baseline 35/171, 20.5%) [SOURCE: PostHog query E], and week-1 core-action rate in the same group.
  - Diagnostic: delivered/scheduled per platform, opens/delivered, and core action within 2 h of an open.
  - My first draft's baselines (Android 20/119, iOS 15/57) were the pack's "tapped Enable and granted vs never asked" groups, not completers [SOURCE: evidence pack §4]. Withdrawn.
- **Expected effect.** UNBACKED, and I am not inventing a number.
  - The vendor figures (F3, F4) say the direction is positive but give no transferable size.
  - The test below is sized to detect a doubling (13.5% → 27%), and even that only about 7 times in 10 by the 2026-03-31 cap (measurement step 3). A smaller real effect will most likely end the test with "no winner", and that outcome should be read as "not shown", not "no effect".
- **Effort.** S. One scheduler, four copy branches in all locales, five events, one device check.
- **Risk to the onboarding paywall.** None. Scheduling and arm assignment happen at `onboarding_completed`, after the paywall was shown or skipped, both onboarding arms are eligible identically, and no RevenueCat placement changes.
- **How to measure at ~7 installs/day (revised in rounds 1 and 2): 50/50 on 06's flag, a fixed one-sided test at the calendar cap, and Miller's rule only as an early stop.**
  1. **Design (revised, R2.3).** 06's flag `activation_365_first_session` (arms `control` / `test`, 50/50) [SOURCE: board/06-experimentation-analyst.md P06.2, R2]. Control is scheduled nothing. My 80/20 "report, don't test" holdout stays withdrawn: Miller's rule assumes equal assignment [SOURCE: https://www.evanmiller.org/sequential-ab-testing.html (Evan Miller, 2015-10-13)].
     - **Who is assigned.** The board files disagree: 06's ledger enrols granted completers [SOURCE: board/06-experimentation-analyst.md:92], 02 assigns all completers with the nudge as an in-arm fallback [SOURCE: board/02-onboarding-ux.md:64, 162]. No decision is recorded in 06's ledger yet (review-06 R2.2 is still open), and 06 owns it. P04.1 is written so it fits either choice: **assign at `onboarding_completed` for all completers, and analyse the nudge's primary only in the pre-registered subgroup "permission granted at the moment of `onboarding_completed`"**. That status is fixed before the arm is drawn, so it is the same in both arms and nothing that happens later (an in-context ask, provisional authorization) can change the subgroup's size in one arm only [UNBACKED — own design; the general point that a changing denominator breaks a ratio metric is SOURCE: board/06-experimentation-analyst.md F10, Dmitriev et al.]. For the nudge, this subgroup is exactly 06's enrolled population (171 in the window, F18), so 06's baseline and the numbers below stand.
     - **What P04.1 does under each of the three options in review-06 R2.2.** (a) *Nudge in the slot, package bundled in the test arm*: the read is the bundle's effect on the granted subgroup, not the nudge's alone; P02.1's ask may ship, but only in the test arm, and it cannot change the subgroup. (b) *Nudge in the slot, package waits* (06's current recommendation [SOURCE: board/06-experimentation-analyst.md:104, 176]): P04.1 as written; the package, P03.2's `gps_fix` and P02.1's ask ship after the test stops, so the short-sheet branch always uses the neutral copy. (c) *Package in the slot (02's design)*: P04.1 is the in-arm fallback; its own primary becomes a descriptive count, and the package's primary (06 ledger: week-1 core action among completers) decides. **I support (b)**, for 06's reason: the nudge has the largest eligible group with a clean baseline [SOURCE: board/06-experimentation-analyst.md:176]. P04.1 will match whatever 06 records.
  2. **Rule (pre-registered, revised R2.4).**
     - Early stop: Miller with N = 64 successes on day-2 engaged return; ship if T − C ≥ 16; stop with no winner at T + C = 64 [SOURCE: same Evan Miller page — "If T−C reaches 2√N, stop the test"].
     - At the cap (06's 2026-03-31 [SOURCE: board/06-experimentation-analyst.md:109]): if neither Miller boundary was hit, **one** one-sided two-proportion z-test at α = 0.05 on everyone enrolled, plus the observed difference with a 90% interval, as 06 asks. No other looks count.
  3. **What the cap allows (R2.4).** A December launch is realistic: the nudge needs a build and the Android device check (step 7) first. The two launch dates below are assumptions for the simulation, not a plan [UNBACKED — own assumption]. Winter enrolment is about 1.4–1.6 granted completers a day (F19). Simulation, Miller's code from 06 Appendix A plus a cap; script inline below [UNBACKED — own simulation; 4,000 runs for the Miller-only rows, 20,000 for the cap-test rows]:

     | Launch | Rate / day | Enrolled at cap | Miller N = 64 alone: power ×2 | Miller N = 36 alone: power ×2 | **Cap z-test (+ Miller early stop): power ×2** | power ×1.5 | false positives, no effect |
     |---|---|---|---|---|---|---|---|
     | 2026-12-07 | 1.4 | 160 | 0.23 | 0.50 | **0.69** | 0.31 | 5.0% |
     | 2026-12-07 | 1.57 | 179 | 0.32 | 0.56 | **0.74** | 0.34 | 4.9% |
     | 2027-01-06 | 1.4 | 118 | 0.06 | 0.26 | **0.57** | 0.25 | 5.1% |

     - My round-1 "0.83 power in ~16 weeks" (and 06's 0.83) ignored the cap. **At the cap, Miller's rule alone almost never decides** (power 0.06–0.32 at N = 64), so the decision comes from the single cap test. The ~16-week figure came from an unchecked-in script and is withdrawn. 06's own figure for the same inputs is 198 riders, ~14 weeks [SOURCE: board/06-experimentation-analyst.md:168]; neither fits before the cap.
     - What a cap result can say: with ~80 riders per arm, the 90% interval on the difference is about ±10 points [my arithmetic: √(0.135·0.865/80 + 0.27·0.73/80) ≈ 0.063, × 1.645]. A "ship" means a doubling-sized effect is likely; "no winner" cannot rule out a +50% effect (power about 0.3). A January launch drops power for ×2 to 0.57; **if launch slips past early January, I would not start the test this season** and would ship to everyone on 06's no-harm path instead [UNBACKED — own judgement].
     - The z-test is a large-sample approximation; with about 11–22 successes per arm it is rough, and the simulated false-positive rate (about 5%) is the check on it.

     ```python
     # Cap simulation (Python 3 stdlib, fixed seeds). Miller as in 06 Appendix A, stopped at the enrolment cap,
     # then one one-sided two-proportion z-test if no Miller boundary was hit.
     import random, math
     def z(t, nt, c, nc):
         p = (t + c) / (nt + nc)
         return 0.0 if p in (0, 1) else (t/nt - c/nc) / math.sqrt(p*(1-p)*(1/nt + 1/nc))
     def run(pc, pt, n_cap, crit=1.645, N=64, use_cap_test=True, reps=20000, seed=7):
         rnd = random.Random(seed); d = math.ceil(2*math.sqrt(N)); hits = 0
         for _ in range(reps):
             T = C = nt = nc = 0; shipped = stopped = False
             for _ in range(n_cap):
                 if rnd.random() < 0.5: nt += 1; T += rnd.random() < pt
                 else: nc += 1; C += rnd.random() < pc
                 if T - C >= d: shipped = True; break
                 if T + C >= N: stopped = True; break
             if use_cap_test and not shipped and not stopped and nt and nc and z(T, nt, C, nc) >= crit: shipped = True
             hits += shipped
         return hits / reps
     for n_cap in (160, 179, 118):   # 114 d x 1.4, 114 d x 1.57, 84 d x 1.4
         print(n_cap, "miller64", run(.135, .27, n_cap, use_cap_test=False, reps=4000, seed=1),
               "miller36", run(.135, .27, n_cap, N=36, use_cap_test=False, reps=4000, seed=1),
               "cap x2", run(.135, .27, n_cap), "x1.5", run(.135, .2025, n_cap, seed=8),
               "FPR", run(.135, .135, n_cap, seed=9))
     ```
     (Re-run of exactly this code, 2026-11-12, with `python3 -I`: 160 → 0.229 / 0.501 / 0.692 / 0.309 / 0.050; 179 → 0.322 / 0.564 / 0.738 / 0.335 / 0.049; 118 → 0.063 / 0.262 / 0.572 / 0.251 / 0.051. The table rounds these.)
  4. **Read alongside, not instead.** Per week: scheduled / delivered / opened / core action within 2 h, per platform and per copy branch (including `gps_fix` and `schedule_tier`). These are counts, not tests.
  5. **One change in flight.** Under option (b), nothing that changes who is granted at `onboarding_completed` ships during the test (P04.3a, P04.3b). P02.1's in-context ask happens after onboarding, so with the subgroup defined at assignment it no longer threatens the primary's denominator; it still waits under (b) because 06's P06.3 rule allows no other change while P06.2 runs unless it is behind the flag [SOURCE: board/06-experimentation-analyst.md:130].
  6. **Stop rule for harm (made measurable, R1.9).**
     - Detection: on every app foreground (the existing `AppState` 'active' listener [SOURCE: apps/mobile/src/app/_layout.tsx:861-862]), call `Notifications.getPermissionsAsync()`, compare with the last status stored on the device, and when it changes emit `notification_permission_status {granted, previous, platform}`. That catches OS-level revocation the next time the rider opens the app. A rider who revokes and never reopens is invisible; that is a known blind spot [UNBACKED — own design].
     - Rule: because the test has a control arm, compare revocations between arms rather than against the open rate. If after 4 weeks the test arm has at least 3 more observed revocations than control, pause and look [UNBACKED — own threshold, chosen as "more than noise at these counts", not derived].
- **Light and dark mode.** No new screen. The OS draws the notification; the add-expense sheet, home and the bike Service segment are existing screens.

### P04.2 — Make Android push real (FCM), and make every permission grant visible

- **Hypothesis.** The server push we already built (ride-idle sweep, maintenance-due) never reaches 70% of riders, and it fails silently. Fixing the plumbing does not activate anyone directly. It is the precondition for any server-sent day-1 to day-7 message, and for the ride-idle reminder that keeps a first real ride from turning into a 6-hour ghost.
- **The exact change.**
  1. Create a Firebase project and add `google-services.json`, with `android.googleServicesFile` in `app.config.ts`. Upload the FCM V1 service-account key to EAS [SOURCE: https://docs.expo.dev/push-notifications/fcm-credentials/]. This needs a new native build: an OTA cannot carry it.
  2. In `push-token.ts`, replace the silent `logger.warn` with `captureException(err, { source: 'push-token.register' })`. Also fire `push_token_registered {platform}` / `push_token_failed {platform, code}`.
  3. In `ride-controller.ts` `ensureNotificationPermission`, when a request is granted: call `registerForPushNotifications()`, and fire `notification_permission_result {permission_granted, source: 'ride_start'}`.
  4. ~~On the onboarding notifications screen, make "Maybe later" fire a decline event.~~ Withdrawn (Responses item 1): "Not now" is already tracked through `onboarding_step_completed {skipped:true}`.
- **Target metric and baseline.**
  - Riders with a stored token, as a share of riders granting permission. Today it is 57/176 overall, iOS 57/57 and Android 0/119 [SOURCE: query B; evidence pack §4]. Target: Android at the iOS ratio.
  - Downstream: `reminder_opened{kind:'ride_idle'}` on Android rises from 0.
  - Activation metrics are not the target here.
- **Expected effect.** Mechanical. If the token is stored, the push can be delivered. No activation effect is claimed [UNBACKED].
- **Effort.** M. Firebase setup, EAS credentials, a store build for Android, a Play release, and four events.
- **Risk to the onboarding paywall.** None. With step 4 withdrawn, nothing touches onboarding.
- **How to measure at ~7 installs/day.** This needs no statistics. One query a week: `select platform, count(*) from device_push_tokens where created_at > <release>` against the PostHog grant count for the same days. Android tokens should appear within days of the release. If they don't, `push_token_failed.code` says why.
- **Light and dark mode.** No UI change.

### P04.3 — Widen who can be reached: iOS provisional authorization on "Maybe later" (P04.3a), and honest copy on the ask (P04.3b, deferred)

Revised after R1.3: the proposal is split in two. P04.3a changes nothing visible on the onboarding screen. P04.3b changes the screen's copy and is **deferred until the onboarding paywall A/B ends**.

- **Hypothesis.** The yes-rate (about 46% of viewers) is near the vendor median (F5). The reach is low because only 380/793 see the screen, and the ones who tap "Maybe later" are lost for good.
  - (a) On iOS, provisional authorization (F8) lets riders who tapped "Maybe later" receive notifications quietly in Notification Center, without a second prompt.
  - (b) Copy on the ask that names what the rider will actually get should lift the yes-rate. The current sample card reads "Oil change due in 200 km — book it this week." [SOURCE: apps/mobile/src/i18n/locales/en.json:739], and maintenance is the goal of the worst-retained group [SOURCE: evidence pack §4].
- **P04.3a — the exact change (no visible change).**
  1. `app/(onboarding)/notifications.tsx` `handleSkip` [SOURCE: line 207, origin/main]: on iOS only, call `Notifications.requestPermissionsAsync({ ios: { allowProvisional: true, allowAlert: true, allowBadge: true, allowSound: true } })`, then fire `notification_permission_result {permission_granted: false, provisional: true}`. Expo describes provisional as "noninterrupting notifications provisionally to the Notification Center" [SOURCE: https://docs.expo.dev/versions/latest/sdk/notifications/ (Expo docs, opened 2026-11-12)]. That it shows **no** system prompt and adds no visible step must be confirmed on a device before shipping [UNBACKED — needs a device check]. If a prompt does appear, P04.3a is dropped until the A/B ends.
  2. Fix the ride-start ask so a provisional rider still gets the full prompt. Today it checks only `status === 'undetermined'` [SOURCE: apps/mobile/src/features/ride/ride-controller.ts:120]. It needs `|| ios.status === PROVISIONAL`. [UNBACKED — whether iOS shows the full prompt to a provisionally authorized app must be verified on a device.]
  3. **Timing.** P04.3a enlarges the group eligible for P04.1, so ship it either before P04.1's test starts or after it ends, never during it (P04.1 measurement step 5).
- **P04.3b — the copy (deferred).** After the onboarding A/B ends, or earlier only with the owner's explicit sign-off and a dated annotation on RevenueCat experiment `expd7c1d56904` and the `onboarding_paywall_2026q4` flag:
  - Subtitle names the reminders the rider gets, with no promise that depends on another proposal shipping. My first draft's "the day after you sign up, one tip" is dropped: it tied this screen to P04.1 and would be false in P04.1's control arm.
  - Sample card chosen by `primary_goal` (*track_rides* gets a ride card, the rest the existing card).
  - Buttons unchanged.
- **Target metric and baseline.**
  - P04.3a: count of provisional authorizations (new event), and the share of iOS onboarding completers who can receive a notification. Today about 176/367 (48%) for both platforms combined [SOURCE: evidence pack §2, §4].
  - P04.3b: share of viewers who tap Enable, about 46% today (176/380).
- **Expected effect.**
  - Airship's "as high as 40% above their category average" for onboarding campaigns (F6) is an unspecified vendor figure, not a number to plan on.
  - The provisional gain is iOS only (228 of 793 installs). Quiet delivery shows no banner, so opens will be lower than for a full grant [UNBACKED].
- **Effort.** S for each part.
- **Risk to the onboarding paywall.**
  - P04.3a: none if the device check confirms nothing visible changes; the call happens after the rider taps "Maybe later".
  - P04.3b: this screen is shared by both `onboarding_paywall_2026q4` arms, and in `garage_first` the paywall opens after it [SOURCE: apps/mobile/src/config/onboarding.ts:157-203]. Changing it during the A/B could change who reaches the paywall in one arm more than the other. Hence the deferral. This is the same argument as my Responses 3(iii).
- **How to measure at ~7 installs/day.**
  - P04.3a: a direct count; no statistics needed.
  - P04.3b: Enable-rate per viewer as a pre/post read on the trailing 8 weeks. The screen gets about 32 viewers a week (380 in 12 weeks). A move from 46% to above 60% would show within about 6 weeks; a smaller move is noise [UNBACKED — rough judgement, not a power calculation].
- **Light and dark mode.** P04.3a has no UI. P04.3b changes copy only; the sample card already uses the `useOnboardingColors` tokens (`oc.surface`, `oc.textPrimary`), so check both modes, especially line-wrapping in German and Spanish.

## What I'd NOT do, and why

- **No day-1 email now.** We store no marketing-email consent (F10), most EU sign-ups are free accounts (so the purchase-based soft opt-in is doubtful), and Resend is wired for transactional mail only. Revisit once a plainly worded consent checkbox exists. `seasonalTips` cannot stand in for one: it is a default no rider saw (F11).
- **No 5-message welcome series (days 1/3/7/14/30) yet.** Airship's spike days (F2) come from big apps with daily habits. Our activation happens within 24 h or not at all [§3]. More messages to about 1.5 reachable riders a day would teach us nothing at this volume, and revoked permissions hurt the maintenance reminders that are the product.
- **No upsell, trial or pricing promise in the nudge.** Apple 4.5.4 needs explicit marketing opt-in (F9). Purchases happen at hour 0 in onboarding, and in-app paywalls sold nothing [§6]. A Pro push would cost permissions and not earn revenue.
- **Don't move the permission ask earlier into onboarding.** Google's guidance is to ask after the rider knows the app, and in context (F7). The screen isn't the leak (Diagnosis 2), and onboarding is revenue-critical with two paywall arms running.
- **Don't lead with a maintenance-due message on day 1.** Maintenance-first riders come back at 7% [§3], and the OEM schedule has model gaps (memory `project_oem_schedule_africa_twin`). A wrong "service due" message to a new rider costs trust.
- **No weather-based "good day to ride" alerts this season.** They are unbacked (F15), it is off-season in the target markets, and they would need location and server push, which is not working on Android (P04.2).
- **Don't read the push-permission association in §4 as an effect.** Grant riders return 3x more, but they also got further in onboarding, and until now no message existed to cause it [§4].

---

### Read-only SQL used (Supabase prod, 2026-11-12)

```sql
-- A: token platforms, all time
select platform, count(*), min(created_at)::date, max(created_at)::date from device_push_tokens group by 1;
-- → ios 105 (2026-07-22..2026-11-12); no android rows

-- B: cohort sign-ups (same filter as q08) by month, with token and platform
-- → 08: 75/8 ios; 09: 184/29 ios; 10: 164/18 ios; 11: 20/2 ios; android 0 in every month; 55/57 tokens created <1h after sign-up

-- C: preference keys and values for cohort users
select k, count(*) from public.users, jsonb_object_keys(coalesce(preferences,'{}'::jsonb)) k
 where created_at >= '2026-08-14' and created_at < '2026-11-05' and coalesce(is_synthetic,false)=false group by 1;
-- → weeklySummary false / seasonalTips true for 354 riders; feedbackContact present for 22
```

### Read-only PostHog SQL added in the revision (project 155556, 2026-11-12)

```sql
-- E: day-2 raw and engaged return by group and platform. Base CTE = q02's (same cohort 08-14..11-04,
--    same 12 excluded persons, same platform mapping), plus:
--    engaged_screen_days = groupUniqArrayIf(toDate(timestamp), event = '$screen' AND properties.$screen_name
--        NOT IN ('/', '/(tabs)/(home)', '/whats-new', '/(auth)', '/login', '/paywall'))
--    core_days = groupUniqArrayIf(toDate(timestamp), (event = 'ride_completed' AND coalesce(properties.below_min_ride,false) = false)
--        OR event IN ('expense_added','maintenance_task_created','maintenance_task_completed'))
--    reminder_days = groupUniqArrayIf(toDate(timestamp), event = 'reminder_opened')
--    grp = granted_completer if onboarding_completed AND last notification_permission_result.permission_granted = 'true'
-- SELECT grp, platform, count(), countIf(has(adays, d0+1)) raw, countIf(has(core_days, d0+1) OR has(engaged_screen_days, d0+1)) engaged, ...
-- → granted_completer android 115 / raw 20 / engaged 11 / core 6 / reminder 1
--   granted_completer ios      56 / raw 15 / engaged 12 / core 6 / reminder 1
--   completer_not_granted android 125 / 12 / 9;  ios 71 / 11 / 7
--   not_completed android 319 / 11 / 9;  ios 101 / 3 / 3;  unknown 6 / 0 / 0
-- Full text: scratchpad q_engaged.sql (not checked in). The screen list above is SUPERSEDED by 06 F14's list (query H).

-- F: reminder opens by kind, platform and app version, 2026-04-01..11-12
SELECT properties.kind, toString(properties.platform), toString(properties.$app_version), count(), uniq(person_id)
FROM events WHERE event = 'reminder_opened' AND timestamp >= '2026-04-01' AND timestamp < '2026-11-13' GROUP BY 1,2,3
-- → ride_idle: android 5 opens (3 people), ios 25, platform-null 10; maintenance: 2 opens, versions 3.18.0 (iOS) and 3.19.0 (Android build)
```

### Read-only PostHog SQL added in round 2 (project 155556, 2026-11-12)

```sql
-- G: granted onboarding completers per install week (q00 exclusions, posthog-react-native only)
SELECT toStartOfWeek(fs, 1) AS week_start, count() AS installs, countIf(ob_done = 1) AS completers,
       countIf(ob_done = 1 AND push = 'true') AS granted_completers
FROM (SELECT person_id AS pid, min(timestamp) AS fs, maxIf(1, event = 'onboarding_completed') AS ob_done,
             argMaxIf(toString(properties.permission_granted), timestamp, event = 'notification_permission_result') AS push
      FROM events WHERE timestamp >= '2026-04-01' AND properties.$lib = 'posthog-react-native' AND person_id NOT IN (<q00 list>)
      GROUP BY pid HAVING fs >= '2026-08-11' AND fs < '2026-11-10')
GROUP BY week_start ORDER BY week_start
-- → granted completers per week from 08-10: 10, 14, 10, 21, 13, 23, 18, 12, 20, 10, 13, 7, 14, (11-09 partial: 3)
--   installs per week from 08-10: 68, 83, 63, 73, 75, 90, 70, 63, 72, 48, 53, 41, 69, (9)

-- H: day-2 raw and engaged return for granted completers, by platform, with 06 F14's exclusion list exactly:
--    NOT IN ('/', '/(tabs)/(home)', '/(tabs)', '/whats-new', '/(modals)/whats-new', '/login', '/account', '/commitment',
--            '/goals', '/reveal', '/bike-setup', '/personalizing', '/notifications', '/paywall', '/heard-about',
--            '/experience', '/welcome', '/consent', '/no-bike-value')
--    AND NOT startsWith(name, '/(onboarding)') AND NOT startsWith(name, '/(auth)');
--    cohort, exclusions and platform mapping as q02; engaged = day-2 return AND (day-2 core action OR day-2 engaged screen)
-- → android 115 / raw 20 / engaged 11;  ios 56 / raw 15 / engaged 12   (total 171 / 35 / 23, same as 06)
```

## Responses

Added 2026-11-12 after reading drafts 01, 02, 03, 05 and 06. I ran one more read-only production query for item 3. Its SQL is at the end of this section.

1. **On P06.1 / F14 (Experimentation) and the matching "no server push until the token gap is explained" lines in P01, P03 and P06: agree, and the gap is now explained, so that blocker should be lifted for local notifications.**
   - The 57 vs 176 gap is not an analytics or sync bug. Android has never stored a token because the app has no FCM configuration. All 105 tokens ever stored are iOS [SOURCE: Supabase prod `device_push_tokens`, query A above; apps/mobile/app.config.ts:371-391 on origin/main]. So the gap does not invalidate a **local** day-1 notification (P01.2, P02.1, P03.1, P04.1, P05.1). Local notifications need only the OS permission [SOURCE: apps/mobile/src/lib/notifications.ts:124-127]. It does invalidate any **server** push experiment until P04.2 ships, and that part of P06's rule should stay.
   - I adopt P06's "day-2 engaged return" as P04.1's primary metric in place of plain day-2 return. Taps on the nudge would otherwise count as returns [SOURCE: board/06-experimentation-analyst.md F14; evidence pack §0].
   - P06 is right that "Not now" is already tracked through `onboarding_step_completed {skipped:true}` [SOURCE: apps/mobile/src/app/(onboarding)/notifications.tsx:207-213 via board/06 F14]. I withdraw step 4 of P04.2: no new decline event is needed. Steps 1–3 (FCM, the token-failure event, registration after the ride-start grant) stand.

2. **On P01.2 (Activation PM), P02.1 (Onboarding UX), P03.1 / P03.3 (Behavioural) and P05.1 (Rider voice): combine them into one week-1 notification budget, and do not open with maintenance.**
   - Five proposals each schedule their own local notification in week 1: `activation_d1`, `activation_first_ride`, `activation_next_ride`, the P05.1 picker, plus two messages in P03.3. Shipped side by side, one rider could get three or four. That is the multi-message drip that P01 and I both advise against, and it would make every result unreadable. The FTC lists asking "repeatedly and disruptively" as nagging [SOURCE: board/03-behavioural-scientist.md F8, FTC 2022 staff report]. [UNBACKED — own design for the merge below.]
   - The merged design is one `activation` kind with **at most one message per rider in days 0–7**, cancelled by any core action:
     - (a) If the rider sets a time (P02.1/P03.1 card, or P05.1/P03.2 too-short sheet), that time wins.
     - (b) Otherwise, the P01.2/P04.1 default fires the next day at 18:00 local.
     - (c) P03.3's weekend message is used only when (a) and (b) did not fire.
     - With one shared kind, P06.2's single flag `activation_365_first_session` can hold the whole thing, as P06.3's "one change in flight" rule requires [SOURCE: board/06-experimentation-analyst.md P06.2, P06.3].
   - *(Revised after R1.6: the 41% argument below is selection, not effect. P04.1 now treats the `maintain_bike` branch as an owner-chosen bet and recommends 05's "when did you last" copy with an expense fallback. The paragraph is kept as the record of the round. After R2.1, "a schedule row exists" is replaced by the tier rule in P04.1 step 6.)*
   - **Challenge to the `maintain_bike` copy** in P01.2 ("Here's what's due next on your {model}") and to P03.3 message (2) ("Your [model] service schedule is ready"). Maintenance-first riders return on day 2 at 7% (1/15) [SOURCE: evidence pack §3]. The OEM pipeline also has model gaps (memory `project_oem_schedule_africa_twin`: "pipeline built but ZERO model rows"). Until P01.3/P05.2 can show a dated, correct due item for the rider's actual model, those riders should get the expense message. Expense-first riders return at 41% (9/22) [SOURCE: evidence pack §3]. Switch to the schedule copy only for bikes where a schedule row exists [UNBACKED — own rule].

3. **On P05.3 (Rider voice): agree with talking to riders, but the email list is much smaller than "consenting sign-ups", and the consent wording does not cover this email.**
   - The only stored contact consent is the checkbox on the onboarding notifications screen. Its label is "The developer may contact me about my feedback" [SOURCE: apps/mobile/src/app/(onboarding)/notifications.tsx:224-231 and apps/mobile/src/i18n/locales/en.json:1627, origin/main]. A rider who never sent feedback has agreed to replies about feedback, not to a research question about why they stopped. [UNBACKED — own reading, not legal advice; the ICO's soft opt-in example rests on a purchase, see F10.]
   - Even read loosely, the pool is small. The checkbox went live on 2026-10-14 (first `decidedAt`). Since then 33 of 171 non-synthetic sign-ups ticked it (19%), and 22 of 445 cohort sign-ups (2026-08-14..11-04) did. No row stores an explicit "no": the field is either enabled or absent [SOURCE: Supabase prod `public.users.preferences->'feedbackContact'`, query D below]. P05.3 asks for ~20 riders who also logged nothing in the last 14 days, so it may reach well under 20.
   - What I'd do instead [UNBACKED — own idea]:
     - (i) Email only riders who ticked the box **and** sent feedback, which fits the wording.
     - (ii) For everyone else, ask the same one question **in the app**, on the second app open, as a dismissible card using the theme tokens (light and dark). No consent question arises there.
     - (iii) If the owner wants email research later, add a separate, plainly worded "you may email me with questions about the app" opt-in after the onboarding A/B ends. Putting it inside the running arms would change the notifications screen that both `onboarding_paywall_2026q4` arms share.

```sql
-- D: feedback-contact consent (Supabase prod, read-only, 2026-11-12)
select min(preferences->'feedbackContact'->>'decidedAt'), max(preferences->'feedbackContact'->>'decidedAt'),
       count(*) filter (where created_at >= '2026-10-14'),
       count(*) filter (where created_at >= '2026-10-14' and preferences->'feedbackContact'->>'enabled' = 'true')
from public.users where coalesce(is_synthetic,false)=false and created_at >= '2026-08-14';
-- → first 2026-10-14T03:23Z, last 2026-11-12T05:19Z; 171 sign-ups since 10-14, 33 enabled
-- by window: cohort 08-14..11-04 = 22 enabled / 445; since 10-29 = 17 enabled / 101; no 'false' values stored
```

## Answers to review

Round 1 (Skeptic, 2026-11-12). Nine items, all answered. One more round of research for this: two read-only PostHog queries (E, F), the Airship page re-opened, the Android alarm docs and the Expo notifications docs opened, and the code re-read at origin/main 5a497a1c. No proposal was dropped. P04.3 is split into P04.3a and P04.3b, and the ids are kept.

- **R1.1 — fixed.** F11 now says `seasonalTips` is a silent default: initialised to `true` in the store, setter never called from a screen, label never rendered [SOURCE: apps/mobile/src/stores/onboarding.store.ts:159, 190; personalizing.tsx:126, 260]. "An opt-in we have never used" and "possibly reuse the `seasonalTips` opt-in" are deleted. The email bullet in "What I'd NOT do" now says it cannot stand in for consent.
- **R1.2 — fixed.** F6 now quotes the page as it is: "as high as 40% above their category average", tagged as an unspecified vendor figure with no sample, period or method, plus "Simply ask once, and if they say no, set the stage to ask again" and "high-intent moments" [SOURCE: https://www.airship.com/mobile-app-push-notification-benchmarks-for-2026/ (Airship, vendor; re-opened 2026-11-12)]. The invented quotation is withdrawn, and P04.3's expected-effect line uses the corrected wording.
- **R1.3 — fixed.** P04.3 is split. P04.3b (subtitle and sample card on the shared onboarding screen) is deferred until the onboarding A/B ends, or needs the owner's explicit sign-off plus a dated annotation on `expd7c1d56904` and `onboarding_paywall_2026q4`. The "one tip the day after you sign up" promise is dropped, so the copy no longer depends on P04.1 (and would not be false in P04.1's control arm). P04.3a (`allowProvisional` on "Maybe later") ships separately only if a device check confirms it shows nothing. It is also timed outside P04.1's test window because it grows the eligible group.
- **R1.4 — fixed, with one correction to the figures.** I adopt 06's 50/50 design (flag `activation_365_first_session`, assigned at `onboarding_completed`, Miller N = 64, ship at T − C ≥ 16) and withdraw the 80/20 "report, don't test" holdout. But 06's "0.83 power in about 10 weeks" was simulated at the *raw* 20.5% baseline. At the *engaged* baseline that R1.5 asked for (13.5%), my re-run gives the same 0.83 power for ×2 but a median of ~218 enrolled riders, **about 16 weeks** at 14 a week, and 5.1% false positives with no effect [UNBACKED — own simulation, `scratchpad/miller.py`, not checked in; rule from SOURCE: https://www.evanmiller.org/sequential-ab-testing.html]. P04.1 now states that timeline and the 0.43 power for a +50% effect.
- **R1.5 — fixed.** The primary baseline is now computed on the right population: granted onboarding completers, n = 171, day-2 engaged return 23 (13.5%): Android 11/115 (9.6%), iOS 12/56 (21.4%); raw 35/171 (20.5%), matching 06 [SOURCE: PostHog query E]. The engaged definition (screen exclusion list) is written out in F18 and the SQL section so it can be pre-registered. The pack-§4 baselines I used before are withdrawn.
- **R1.6 — fixed.** The `maintain_bike` branch is now written as an explicit owner-chosen bet. The 41% figure is no longer used as a reason, and the text says it is selection. I recommend 05's "when did you last…" copy (it matches the stated goal and can't state a wrong due date), with the expense copy as fallback where no schedule row exists. The owner picks, the copy stays frozen for the test, and branches are reported descriptively only. I did not make copy a second varying factor inside the test arm: at ~7 eligible riders a week per arm, splitting the arm again would leave each branch with too few riders to read [UNBACKED — own judgement]. The Responses item 2 paragraph is annotated to point here.
- **R1.7 — fixed.** "It's free, always." is removed from the notification. The pricing promise is gone from the nudge, and "What I'd NOT do" now rules out pricing promises too. "That test didn't count" is replaced by 03's "Test ride: all good", and the no-Start branch uses 03's P03.1 message text verbatim, so P04.1 now carries the board's merged copy [SOURCE: board/03-behavioural-scientist.md:170-171, P03.2].
- **R1.8 — fixed.** Diagnosis 1 now says only *immediate* Android local notifications are shown to work (5 `ride_idle` opens from Android). Date-scheduled Android delivery is unobserved: one maintenance open ever [SOURCE: PostHog query F]. F16 adds why: without an exact-alarm permission, which the app deliberately does not declare [SOURCE: apps/mobile/app.config.ts:379-389], Android delivers within an hour of the trigger, or after Doze ends [SOURCE: https://developer.android.com/develop/background-work/services/alarms/schedule (Google, opened 2026-11-12)]. P04.1 step 7 adds a pre-launch device check on Android 13+ and 14+ (stock and Samsung). Step 8 adds `activation_nudge_scheduled` against `reminder_opened` plus `activation_nudge_presented` (from `getPresentedNotificationsAsync` on the next open, F17), so failed deliveries show up per platform.
- **R1.9 — fixed.** Revocation is now detected: on each app foreground, through the existing `AppState` listener [SOURCE: apps/mobile/src/app/_layout.tsx:861-862], compare `getPermissionsAsync()` with the last stored status and emit `notification_permission_status {granted, previous, platform}` on a change. I also corrected a wrong premise: the Profile toggles are account preferences that don't silence device reminders, and none covers this message [SOURCE: apps/mobile/src/app/(tabs)/(profile)/notifications.tsx:122-123], so the OS switch is the only opt-out and there is no toggle event to read. The stop rule now compares observed revocations between the test and control arms (pause if the test arm leads by 3 or more after 4 weeks), not against the open rate [UNBACKED — own threshold]. Its blind spot is stated: a rider who revokes and never reopens is not seen.


Round 2 (Skeptic, 2026-11-12). Five items, all answered. Research for this round: two read-only PostHog queries (G, H), the cap simulation inline in P04.1, and the code re-read at origin/main (OEM tier waterfall, `OemSchedule` fields, the preview query, the ride guard constants). No proposal was dropped or merged; ids are unchanged. The R1.4 answer above is superseded where it quotes "about 16 weeks" and `scratchpad/miller.py`.

- **R2.1 — fixed.** "Bike has a schedule row" is replaced by a defined `scheduleTier` (P04.1 step 6), read from the OEM rows the bike's tasks came from, using the service's own waterfall: non-null `model` → model; `make = 'GENERIC'` → generic; other make row → make; no tasks → none [SOURCE: apps/api/src/modules/oem-schedules/oem-schedules.service.ts:95-100, 148-151; models/oem-schedule.model.ts:13, 20 on origin/main]. Only the model tier gets "Next up for your {bikeModel}". The make tier names itself ("A typical {make} service plan starts with {task}") and states no interval or due date, following 05's tier labels [SOURCE: board/05-rider-voice.md:148-152]. Generic and no-task bikes get the expense fallback, or 05's "Set up your {make}'s service plan" if P05.2 shipped before the test. The step also says the model branch will reach about zero riders (2 of 90 maintain_bike first bikes were model-level) [SOURCE: board/05-rider-voice.md:103], and that the client needs one query change to read the tier [SOURCE: apps/mobile/src/graphql/queries/oem-schedules-preview.graphql on origin/main].
- **R2.2 — fixed.** The short-sheet branch now reads `gps_fix` from the rider's last day-0 `ride_too_short_shown`. Only `true` gets "Test ride: all good". `false` or a missing property (P03.2 not shipped, which is always the case under option (b)) gets the neutral "Testing it out?" [SOURCE: board/03-behavioural-scientist.md:250-261, 339]. Both bodies also drop the 50 m figure, because the guard needs 30 s as well [SOURCE: apps/mobile/src/utils/ride-constants.ts:25-26 on origin/main]. `gps_fix` is logged on `activation_nudge_scheduled`.
- **R2.3 — fixed as far as my file can go. The decision belongs to 06, and none is recorded yet.** P04.1 now assigns the flag at `onboarding_completed` for **all** completers, as 02 does, and pre-registers the nudge's primary on the subgroup "granted at the moment of assignment". That status is fixed before randomization, so P02.1's later in-context ask cannot change the subgroup in one arm only, and it is the same population and baseline as 06's ledger row (171, 23/171) [SOURCE: board/06-experimentation-analyst.md:92; PostHog query H]. So one flag design serves both files. P04.1 step 1 spells out what it does under each of review-06 R2.2's options (a) bundle, (b) nudge alone with the package waiting, (c) package in the slot. I support (b), 06's current recommendation [SOURCE: board/06-experimentation-analyst.md:104, 176], and P04.1 will follow what 06 records. Step 5 ("one change in flight") is reworded to match: under (b) the package waits because of 06's P06.3 rule, not because of the denominator.
- **R2.4 — fixed, and the answer changes the test design.** The unchecked-in `scratchpad/miller.py` and its "~16 weeks" are withdrawn. I now cite 06's 198 riders / ~14 weeks for the uncapped figure [SOURCE: board/06-experimentation-analyst.md:168], and the new simulation is pasted inline in P04.1 and re-run from the file. Winter enrolment is measured, not assumed: 44 granted completers in the last 4 full weeks, about 1.6 a day [SOURCE: PostHog query G], close to 06's ×1.4 slowdown. **At the 2026-03-31 cap with a 2026-12-07 launch, Miller N = 64 alone has power 0.23–0.32 for a doubling**, and N = 36 alone 0.50–0.56. So P04.1 now pre-registers Miller only as an early stop, plus **one one-sided z-test at α = 0.05 at the cap**: power 0.69–0.74 for ×2, 0.31–0.34 for ×1.5, about 5% false positives, all simulated [UNBACKED — own simulation, inline]. A January launch gives 0.57. If launch slips past early January, I recommend not starting the test this season [UNBACKED — own judgement]. This is a proposal to 06, who owns the ledger.
- **R2.5 — fixed.** F18 now uses 06 F14's definition word for word, and my list is withdrawn. Query H re-ran the per-platform split with 06's exact list: Android 11/115, iOS 12/56, total 23/171, the same counts as before and as 06 [SOURCE: PostHog query H; board/06-experimentation-analyst.md:73]. Query E's SQL is marked superseded.
