# 01 Activation / Growth PM

Draft 3, 2026-11-12 (revised after the Skeptic's rounds 1 and 2). Issue #365. Research and planning only: no code, flags, PostHog, RevenueCat or GitHub changes were made.
Sources opened: 12 web pages in draft 1, 5 more in draft 2 (listed at the end), plus repo files, read-only PostHog queries (q01-r3-a added in draft 3), one read-only Supabase query and one local simulation (q01-r3-sim) (SQL and script at the end). Every claim has a tag.

## Diagnosis

**1. We have a real aha moment: a saved real ride, on day 0.** Riders whose first core action is a saved ride come back on day 2 at 83% (20/24) and at D7 at 54% (13/24). Riders with no core action come back at 5.7% [SOURCE: evidence pack §3]. Lenny's working definition is "the earliest onboarding point that shows product value and predicts long-term retention", and he asks for a causal test, not only a correlation [SOURCE: https://www.lennysnewsletter.com/p/how-to-determine-your-activation — "A good activation metric is causal for your retention, not just correlative" (Lenny's Newsletter, 2022-11-08)]. A ride passes the correlation step easily. Maintenance-first does not: 1/15 back on day 2 [SOURCE: evidence pack §3]. Selection explains part of the ride link, because people who ride at all are riders [SOURCE: evidence pack §3 caveat]. So the honest reading is: "a ride is the aha moment for riders who are riding this week". Nothing here proves that pushing more people into a ride will cause retention.

**2. Activation happens in the first hour or not at all.** 40 of the 61 week-1 activators acted within an hour of first open, and only 5 acted after day 1 [SOURCE: evidence pack §3 "Time to first core action"]. That matches Andrew Chen's finding that the first visit matters most [SOURCE: https://andrewchen.com/new-data-shows-why-losing-80-of-your-mobile-users-is-normal-and-that-the-best-apps-do-much-better/ — "Target the first few days of usage, and in particular the first visit" (andrewchen.com, ~June 2015)]. Nothing reaches riders after day 0 today: there is no day-0 to day-7 re-engagement message of any kind [SOURCE: evidence pack §1; apps/mobile/src/lib/notifications.ts:9-27 — the only notification kinds are document, maintenance, receiptScan, ride_idle and trial_reminder]. A rider who leaves day 0 without the aha moment has no path back.

**3. The aha moment is out of reach for most riders at install time.** 66 of the 103 riders who tapped Start got "ride too short", most likely from testing at home [SOURCE: evidence pack §3 ride funnel]. 76 tapped Start on day 0 but saved no ride, and 26% of them still came back on day 2 [SOURCE: evidence pack §3]. That is the warmest group we have, and today the too-short sheet sends them nowhere. The guard is tiny (30 s / 50 m) [SOURCE: apps/mobile/src/utils/ride-constants.ts:12-13], so the fix is not to lower the threshold. These riders are not on a bike.

**4. Riding is seasonal in much of Europe; our own data does not yet show it.** The cohort covers 2026-08-14 to 11-04. Day-2 return in the last three install weeks was 3/53, 3/41 and 3/26, together 9/120 (7.5%) [SOURCE: evidence pack §2 stability]. That is inside the 3–12% weekly band [SOURCE: evidence pack §2], and weekly variance is *below* what binomial noise alone predicts (ratio 0.60) [SOURCE: 06-experimentation-analyst.md F3, PostHog q06-board-weekly]. **The late-cohort dip cannot be told apart from noise**, so I no longer read it as seasonal. The only outside evidence on seasonality I found is a 2014 self-selected survey run with a tyre retailer (Delticom), 8 European countries, no US data: 52% of riders said they ride year-round, about 11% in Austria [SOURCE: https://ultimatemotorcycling.com/2014/12/04/biker-summer-2014-survey-europeans-ride-10-million-miles — "52 percent said they ride year-round, overall"; n=1,964 (Ultimate Motorcycling / Delticom survey, 2014-12-04)]. It supports "a large share of European riders ride less in winter", nothing more. Planning consequence, still an inference [UNBACKED — own idea]: a ride-only activation plan is exposed to winter in Europe, so the board should also have an off-bike first action (P05.2). Any pre/post read that spans Nov–Mar must say the season changed alongside the product.

**5. The second biggest intent group has no aha moment.** 112 riders chose `maintain_bike` and returned on day 2 at 3.6% [SOURCE: evidence pack §4]. 62% of web search clicks land on model-specific maintenance-schedule posts [SOURCE: evidence pack §7; GSC page, 2026-08-14..11-10]. These riders want "what is due on *my* bike next". The app lets them create a log entry, but logging maintenance does not bring them back [SOURCE: evidence pack §3, §7 "Promise vs first screen"].

**6. Where we stand against benchmarks.** Our day-2 return is 9.1% of installs and D7 (active on days 7–13) is 6.7% [SOURCE: evidence pack §2]. Category D1 is about 20% for Health & Fitness, about 16% for Travel and about 17% for Productivity, with D7 at about 7–8% [SOURCE: https://phiture.com/mobilegrowthstack/managing-retention-rate-benchmarks-and-expectations/ — "Health & Fitness ~20% / ~8%", "Travel ~16% / ~7%" (Phiture, 2022, updated 2026-03; blends Statista, AppsFlyer, Adjust and Business of Apps)]. *Transfer:* these are worldwide blends with no Europe/US split and no motorcycle or seasonal category, and the vendors' D1 definitions are not stated. Our day-2 return is a calendar-day, consent-gated measure. **So both the D1 and the D7 comparison are order-of-magnitude only**: "our D1 looks low next to category blends, our D7 looks ordinary". The first-day loss is better shown by our own funnel (point 2) than by this benchmark. Two further caveats: our D7 is a 7-day *window*, which is looser than "exactly day 7", and every one of our rates counts only riders who consented to analytics [SOURCE: evidence pack §0, §1].

**7. Money is not part of activation today.** All purchases happen at hour 0 inside onboarding, before any core action. In-app paywalls sold nothing [SOURCE: evidence pack §6]. Activation work can therefore leave the onboarding paywall alone, and must, under the hard constraint.

## Findings

F1. **Activation-rate benchmark.** Across 500+ products, activation averaged 34% with a median of 25%; for SaaS only, 36% and 30%. Activation rate = users who reach the milestone ÷ users who completed sign-up [SOURCE: https://www.lennysnewsletter.com/p/what-is-a-good-activation-rate — "average activation rate 34%, median 25%" (Lenny's Newsletter, Lenny Rachitsky & Yuriy Timen, 2022-10-25)]. Our equivalent is 15.1% of sign-ups doing a core action in week 1 [SOURCE: evidence pack §8b]. *Transfer:* this is a self-reported survey that is mostly SaaS, and every product defines its own milestone. Use it only as a rough reference.

F2. **What moves activation, as practitioners report it.** In order: simpler onboarding UI, less onboarding friction, "emails and follow-up communications", copy, top-of-funnel targeting, sales outreach, incentives, and "showing value earlier" [SOURCE: https://www.lennysnewsletter.com/p/what-is-a-good-activation-rate — survey list (Lenny's Newsletter, 2022-10-25)]. Follow-up messages rank third. We have none (Diagnosis 2).

F3. **Setup → aha → habit (weak secondary sources; no primary found).** The three-moment framework is usually credited to Reforge, but the Reforge pages I opened (guide, program preview, artifact) render no text without JavaScript, so I cannot quote Reforge itself [SOURCE: https://www.reforge.com/guides/enable-plg-led-activation — page returned no readable content (Reforge, opened 2026-11-12)]. A named-author secondary source describes the same sequence: setup is "Users setup the feature so they can use it", aha is "Users achieve the magic moment", followed by habit [SOURCE: https://www.news.aakashg.com/p/ultimate-guide-activation (Aakash Gupta, Product Growth newsletter, 2023-12-06)]. That page does not attribute it to Reforge. My draft-1 quotes ("most drop-off happens here", "most teams cut activation off too early") came from a third party's private notes [SOURCE: https://hq-raydata-co.pages.dev/vault/06-reference/2026-04-03-activations-three-moments/ — personal notes, weak secondary, not attributable to Reforge]; treat them as an unverified paraphrase. The framing is therefore a *lens*, not evidence. Applied to us: bike + account + onboarding is *setup* (46% complete it) [SOURCE: evidence pack §2]. A saved ride, or "I know what is due next", is the *aha*. A weekly ride or log is the *habit*. Treating `onboarding_completed` as activation would call setup "activated" [UNBACKED — own application of the lens]. Our own data is the stronger argument: onboarding completers return on day 2 at 15.8%, saved-ride-first riders at 83% [SOURCE: evidence pack §2, §3].

F4. **Day-7 benchmark from an analytics vendor (vendor).** "7% of your original cohort returning on day seven places you in the top 25% for activation." "69% of top day seven performers were also top three-month performers." The base is 2,600+ companies [SOURCE: https://amplitude.com/blog/7-percent-retention-rule (Amplitude (vendor), 2025-09-30)]. The same post advises "tailor onboarding to intent", "lead with doing, not touring" and "limit early choices". *Transfer:* the base mixes web, SaaS and apps, and the post does not define "active". Our 6.7% D7 sits near that line on paper, but the definitions differ. Do not celebrate it.

F5. **Mobile decay curve.** The average Android app loses 77% of DAUs within 3 days (23.42% remain on day 3), with 9.55% left on day 30. This is from Quettra data on 125M+ Android devices, 2015 [SOURCE: https://andrewchen.com/new-data-shows-why-losing-80-of-your-mobile-users-is-normal-and-that-the-best-apps-do-much-better/ (andrewchen.com, ~2015)]. Chen is sceptical that "We miss you" campaigns move the curve. *Transfer:* the data is old and covers all categories, but the shape (loss front-loaded into days 0–3) matches our time-to-first-core-action data.

F6. **Category day-30 benchmarks (vendor).** Transportation 4.8% iOS / 4.4% Android; Health & Fitness 3.9% / 3.4%; Travel 3.1% / 2.8% [SOURCE: https://www.braze.com/resources/articles/mobile-app-retention — AppsFlyer data via Business of Apps (Braze (vendor), 2026-07-24)]. No D1 or D7 figures are given. Utility and navigation have no category in any source I opened, so Health & Fitness, Travel and Transportation are the nearest proxies for a ride tracker.

F7. **Push in the first 90 days (vendor).** "95% of new, opt-in app users churn within the first 90 days if they don't receive any push notifications." Users who got at least one push showed "190% higher average retention". Data from 63M users [SOURCE: https://airship.com/blog/predict-and-prevent-customer-churn-and-increase-app-retention (Airship (vendor), 2017-02-16)]. Airship calls this "a very strong correlation". It is not causal, and Airship sells push. *Transfer:* the direction supports sending *something* in week 1. The size of the effect does not transfer.

F8. **Best-documented causal effect of reminders.** In a live experiment at Duolingo, choosing reminder content with a bandit gave "a 0.5% increase in total DAUs and a 2% increase in new user retention over a strong baseline". Fresh templates beat repeated ones [SOURCE: https://research.duolingo.com/papers/yancey.kdd20.pdf — abstract (Yancey & Settles, KDD 2020)]. *Transfer:* this is a daily-habit language app, not a seasonal utility, and the baseline already sent reminders. The lesson is that content optimisation gives small gains *on top of* reminders that already exist. We have none, so our first gain would come from the first useful message, not from tuning it.

F9. **Small-sample testing.** Evan Miller's simple sequential test: fix N, split 50/50, stop for the treatment when T − C reaches 2√N, and stop with no winner when T + C reaches N. "The procedure works extremely well with low conversion rates." [SOURCE: https://www.evanmiller.org/sequential-ab-testing.html (Evan Miller, 2015-10-13)]. It fits our ~7 installs a day better than a fixed-horizon 50/50 test, because a large effect can stop early.

F10. **Seasonality.** See Diagnosis 4 [SOURCE: https://ultimatemotorcycling.com/2014/12/04/biker-summer-2014-survey-europeans-ride-10-million-miles — 2014 data, 8 European countries, self-selected, retailer-run]. This is the only European figure I found, it is 12 years old and has no US data. Our own weekly data does not show a seasonal dip yet (Diagnosis 4).

F12. **Android delivery of a next-day local notification is not guaranteed to the minute, and not proven for us.** Our date-triggered local notifications use inexact alarms: the app declares no `SCHEDULE_EXACT_ALARM`, and expo-notifications "degrades to AlarmManagerCompat.setAndAllowWhileIdle" [SOURCE: apps/mobile/app.config.ts:356-366]. Android says such an alarm "never goes off before the supplied trigger time" and on Android 12+ is invoked "within one hour of the supplied trigger time, unless any battery-saving restrictions are in effect", and that "all alarms are canceled when a device shuts down" unless re-registered after boot [SOURCE: https://developer.android.com/develop/background-work/services/alarms/schedule (Android Developers, opened 2026-11-12)]. Our data has **no** opened date-scheduled local reminder from Android at all: since 2026-04-01, with test accounts excluded, the only Android opens are 5 `ride_idle` opens by 3 riders, which fire immediately during a ride [SOURCE: PostHog q01-r2-c]. OEM battery savers are not covered by the Android page [UNBACKED — needs a device check].

F13. **Model-level maintenance schedules cover almost none of the cohort's bikes.** Of 380 bikes added by non-synthetic users from 2026-08-14 to 11-04 (not deleted), **18 (4.7%)** match a verified model-level OEM row, **239 (63%)** fall to the make-generic tier, and **123 (32%)** to the GENERIC fallback [SOURCE: Supabase read-only query q01-r2-d, run 2026-11-12; tiers as in apps/api/src/modules/oem-schedules/oem-schedules.service.ts:94-100]. The make-generic rows are known to be guessed for at least one model (HONDA oil interval 6,000 km against the manual's 12,000 km) [SOURCE: memory `project_oem_schedule_africa_twin`, 2026-08-24].

F11. **Repo facts that change the plan.**
- What's New was already suppressed for new riders in #298 (2026-10-09): `markWhatsNewSeenForNewRider()` runs at the start of personalizing [SOURCE: apps/mobile/src/app/(onboarding)/personalizing.tsx:188-190; git log 1edc49cd]. The pack's "112 of 367 see What's New" (§5) is therefore mostly from before the fix. Re-run q04 split by version before anyone spends effort on it.
- The too-short guard already sends `elapsed_s` and `distance_m` [SOURCE: apps/mobile/src/app/(modals)/ride-hud.tsx:251-259]. That partly contradicts pack §9. Only speed is missing. The "home test vs real attempt" split can be computed for new builds now.
- Local notifications are scheduled on the device with `expo-notifications` [SOURCE: apps/mobile/src/lib/notifications.ts:4,168]. They do not depend on the server push token, which reaches only 12.9% of sign-ups [SOURCE: evidence pack §8b]. A day-1 message built as a local notification sidesteps the token gap.

## Proposals

### P01.1 Turn "ride too short" into a "test ride" sheet that asks for the next real ride

*Status after round 2: merged with P02.2, P03.2 and P05.1 into one build (Responses R1). Trigger, copy, baseline and measurement below follow the board's single spec; the draft-1 "first attempt" trigger, the "✓" glyph, the unconditional "GPS works" copy and the 11/49 baseline are all replaced.*

- **Hypothesis.** Riders who tap Start while standing still want to know the tracker works. Today they hit "Are you sure?", and on current builds they end anyway 27 times to 1 [SOURCE: 02-onboarding-ux.md, PostHog q-02a]. If the sheet instead says this was a test, tells them what saves a real ride and offers a reminder for their next ride, more of them will save a real ride within 7 days [UNBACKED — own idea].
- **Exact change.**
  - In `ride-hud.tsx` `handleEndRide`, on the too-short branch only (not `isNoGpsRide`; on builds ≥ 3.21.0 that branch is already < 120 s [SOURCE: apps/mobile/src/app/(modals)/ride-hud.tsx:55-67]), when the rider has **no saved real ride** and `distance_m < 10`, show the teaching variant. It shows on every such sheet, not only the first. A rider who moved 10 m or more keeps today's sheet.
  - Copy: 03's two strings, chosen by whether a location fix arrived during this attempt (at least one point with non-null accuracy; the HUD already records it with `setGpsAccuracy`, ride-hud.tsx:150) [SOURCE: 03-behavioural-scientist.md P03.2; 02-onboarding-ux.md Responses 1]:
    - **Fix arrived (`gps_fix = true`):** title "Test ride: all good"; body "GPS and recording work. Your real ride is saved once you've moved more than 50 m. Tap Start next time you're on the bike."
    - **No fix (`gps_fix = false`):** title "Testing it out?"; body "Your real ride is saved once you've moved more than 50 m. Go outside with a clear view of the sky, then tap Start when you're on the bike." It makes no claim that GPS works.
  - Buttons (both versions, as 03): primary "Got it" ends and discards, like "End Anyway" today; secondary "Keep recording"; tertiary "Remind me on my next ride day", which opens the shared when-will-you-ride chips (P02.1/P03.1). No glyph: the HUD is always dark [SOURCE: apps/mobile/src/app/(modals)/ride-hud.tsx:31].
  - One local notification kind for the board, `activation_next_ride`, deep-linking to `/(modals)/start-ride`.
  - Events: `ride_too_short_shown` gains `variant:'teaching'|'default'`, `gps_fix` and `max_speed_kmh` (elapsed and distance already exist, F11), and `action:'remind_me'`; `activation_reminder_scheduled {kind:'activation_next_ride', slot}`; `reminder_opened {kind:'activation_next_ride'}` through the existing `_layout.tsx` handler.
  - The rider is never blocked from ending the ride.
- **Target metric and baseline: the single ledger baseline.** Trigger as above (first `ride_too_short_shown` with `distance_m < 10` and `elapsed_s < 120`, no saved real ride before it), builds ≥ 3.21.0 only, q00 exclusions, cohort first seen 08-14..11-04, trigger before 2026-11-06 so 7 days are observable.
  - Primary: real ride saved within 7 days of the trigger. **Baseline 1 of 13** (14 riders triggered on ≥ 3.21.0 between 2026-10-06 and 11-09; 13 have a full week) [SOURCE: PostHog q01-r3-a]. It matches 02's q-02c (1/13) and 05's P1-ver (14 eligible, 1 saved) [SOURCE: 02-onboarding-ux.md q-02c; 05-rider-voice.md P1-ver]. **This is anecdote-sized: about 13 riders, so it is a count, not a rate.**
  - Why only ≥ 3.21.0: older builds fired the same event for no-GPS rides of 120 s or more, and the event writes one row per action (`shown`, `keep`, `end`), so pooled sheet counts are row counts [SOURCE: 02-onboarding-ux.md q-02a; 06-experimentation-analyst.md Diagnosis 2]. The pre-3.21.0 figure with the same trigger (10/32 [SOURCE: PostHog q01-r3-a]) is for reference only and must not be used as a before-window.
  - Retired: my 11/49 (no `elapsed_s` filter, mixed builds, counted from event rows) and 11/48; 06's 1/10 is a day-0 cut of a different trigger and stays in 06's file as reference [SOURCE: 06-experimentation-analyst.md P06.1 ledger].
- **Expected effect.** No source gives a size [UNBACKED — own idea]. I would call the mechanism working if at least a third of teaching sheets lead to a scheduled reminder and at least 30% of those reminders are opened [UNBACKED — own thresholds].
- **Effort.** S–M: one sheet variant with two copy versions, one notification kind, strings in all 7 app locales.
- **Risk to the onboarding paywall.** None. This screen comes after onboarding and is never inside it.
- **Measurement at ~7 installs a day.** About 2–3 riders a week reach this trigger on current builds (14 in ~5 weeks [SOURCE: PostHog q01-r3-a; my arithmetic]). A split test of the sheet alone is impossible (06 puts it at ~34 weeks for a doubling [SOURCE: 06-experimentation-analyst.md Responses R1, own simulation]). No lift claim is made from a before/after this winter [SOURCE: 06-experimentation-analyst.md F11, P06.3]. Read:
  - (a) **Mechanism chain, in counts per rider:** teaching sheet shown → `gps_fix` split → `remind_me` tapped → `activation_reminder_scheduled` → `reminder_opened` → real ride saved within 48 h of the open. Report the raw counts weekly; no rates until about 40 post-launch riders [SOURCE: 06-experimentation-analyst.md Responses R1 threshold].
  - (b) **Harm check only, per P06.3:** if the sheet ships outside the randomized slot, an 8-week trailing before-window on builds ≥ 3.21.0 starting after 2026-10-07, a 4–8 week after-window, and revert only if day-2 return or `activation_24h` falls below the before-window by more than the 80% interval of the difference [SOURCE: 06-experimentation-analyst.md P06.3]. The 1/13 count is reported alongside as description, never as a test.
  - (c) Qualitative: watch 10 session recordings of the new sheet, both `gps_fix` values.
  - Which path it ships on (inside the P06.2 treatment arm, or P06.3) is the single board decision in the P06.1 ledger; my vote is in P01.2 below.
- **Light/dark.** The HUD is dark in both app themes, so the sheet is dark too; use the existing bottom-sheet tokens from `@motovault/design-system` and check that the chips and the reminder's landing screen (start-ride) pass contrast in light and dark. Screenshot both themes in review.

### P01.2 One day-1 local message, chosen by the rider's onboarding goal

*Status after round 2: merged with P04.1 (Responses R2). The standalone 50/50 test of this message from draft 2 is **deleted**. I hold one version: the message is the in-arm fallback inside the first-session package, which I vote to put in the P06.2 slot (reasoning under "Which test", with a new power-at-cap run). The final choice is the single board decision recorded in the P06.1 ledger.*

- **Hypothesis.** Riders who finish onboarding (367) come back on day 2 at 15.8%, and nothing in the product calls them back [SOURCE: evidence pack §2, §1]. A single useful, goal-specific local notification on day 1, for riders who granted permission and set no ride plan, will raise first-week core actions. Follow-up messages are the #3 practitioner lever by mention count, not by measured impact (F2); a push in the first 90 days correlates with retention (F7, vendor, correlational). The size of the effect is UNBACKED.
- **Exact change.**
  - At `onboarding_completed`, in the treatment arm, if permission is granted **and** the rider has set no plan through the P01.1/P02.1/P03.1 picker, schedule **one** local notification of kind `activation_d1` for the next day at 18:00 local time. The send time is my own pick [UNBACKED — own idea]. A plan set later replaces it: at most one activation notification per rider in week 1 [UNBACKED — own rule; same as 02-onboarding-ux.md Responses 2].
  - Copy by `primary_goal`, no Pro wording (Apple 4.5.4, 04 F9):
    - `track_rides`: "Riding today? Tap Start when you roll out — MotoVault does the rest." Deep link: start-ride.
    - `maintain_bike`: **owner picks; frozen before launch; reported per branch, descriptive only**, as 04 sets it [SOURCE: 04-lifecycle-crm.md P04.1, after its R1.6]. Two candidates: 05's "Next up for your {bikeModel}: {task}. When did you last do it?" (opens the bike's Service segment), with 04's expense copy as fallback where the bike has no schedule row; or the expense copy for everyone, "Log your last fill-up in 10 seconds." (opens add-expense). No branch has evidence that its copy *causes* a return: the 41% expense-first return is selection [SOURCE: 04-lifecycle-crm.md P04.1; evidence pack §3]. One fact for the owner's choice: only 4.7% of cohort bikes have a model-level schedule and 63% only a make-generic one (F13), so "has a schedule row" must be defined before freezing. 05's question names a task but states no due date, so it cannot show a wrong interval [UNBACKED — own reading].
    - `manage_expenses`: the expense copy. Deep link: add-expense.
    - `just_exploring` / `discover_routes`: "Your garage is set — here's what riders use most." Deep link: home.
  - Cancel it if the rider does a core action before it fires.
  - Events: `reminder_scheduled {kind:'activation_d1', goal, arm}`, `reminder_opened {kind:'activation_d1'}`, `reminder_cancelled_activated`, and a new `notification_permission_status {granted}` sent on app foreground when it differs from the last value (needed for the revocation guardrail; today a later revocation is invisible [UNBACKED — own reading of the event list in evidence pack §1]).
  - "Not now" is already tracked through `onboarding_step_completed {skipped:true}` [SOURCE: 06 F14; apps/mobile/src/app/(onboarding)/notifications.tsx:207-213].
- **Pre-launch gate (Android).** Before launch, schedule a real `activation_d1` for the next day at 18:00 on at least one Android 13+ device left idle overnight with battery saver on, and one without, and log when it shows. Our data has never shown a date-scheduled local reminder opened on Android (F12). If it does not arrive within about an hour of 18:00, Android riders get no `activation_d1` and the component is reported for iOS only [UNBACKED — own gate].
- **Which test (one answer).**
  - **My vote: the first-session package in the P06.2 slot** (P01.1 sheet + P02.1/P03.1 plan picker + this message as fallback), assigned 50/50 at **all** `onboarding_completed` (intent-to-treat), crossed with `onboarding_paywall_2026q4`, primary **week-1 core action among completers, baseline 61/367 (16.6%)** [SOURCE: 06-experimentation-analyst.md P06.1 ledger; 02-onboarding-ux.md P02.1]. This is 02's design and 06's named alternative.
  - Why, against 06's and 04's "nudge alone": the calendar cap. I re-ran 06's Miller simulation with an enrolment cap [UNBACKED — own simulation, script `q01-r3-sim` at the end; procedure from SOURCE: https://www.evanmiller.org/sequential-ab-testing.html — "If T − C reaches 2√N, stop" (Evan Miller, 2015-10-13)]. Launch 2026-12-01 (after an OTA and the Android gate), cap 2026-03-31 = 120 days, N = 64, true doubling:
    - **Nudge alone** (granted completers, 13.5% day-2 engaged): power **0.29** at the late-October rate (~1.43 eligible a day = 06's 2.0/day ÷ 1.4), 0.60 at the window-average rate. With N = 36: 0.54 / 0.62.
    - **Package** (all completers, 16.6% week-1 core action): power **0.79** at the late-October rate (~2.14 completers a day = 3.0 ÷ 1.4), 0.82 at the window average.
    - A launch on 2027-01-04 (86 days to the cap) gives nudge 0.08 / 0.29 and package 0.54 / 0.79.
    - Both rows assume a doubling, which no source supports for either change [UNBACKED]. The point is relative: only the package has a realistic chance of a verdict before the cap.
  - If the board instead puts the nudge alone in the slot, P01.2 follows 06's ledger row (primary day-2 engaged return 23/171) and P01.1 waits for P06.3, because P06.3 allows no before/after change in flight while P06.2 runs unless it is behind the flag [SOURCE: 06-experimentation-analyst.md P06.3]. I do not hold that version; it is listed only so the ledger has both rows.
  - **I withdraw my Responses R3 "bundle" wording as a separate proposal**; it is the same package and the same primary as above.
- **Target metric and baseline for this component** (reported inside the package, not tested on its own). Population: completers who granted permission, **171** [SOURCE: 06-experimentation-analyst.md q06-rev-engaged; 04-lifecycle-crm.md query E].
  - Day-2 engaged return, 06 F14's written screen list: **23/171 (13.5%)**; Android **11/115**, iOS **12/56**, with platform mapped from app version/build as in pack §0 [SOURCE: 04-lifecycle-crm.md F18, query E; 06-experimentation-analyst.md q06-rev-engaged].
  - First-week core action in the same group: **36/171 (21.1%)** [SOURCE: 06-experimentation-analyst.md q06-rev-completers].
  - Raw day-2 return 35/171 (20.5%) [SOURCE: same].
  - Retired: my 26/171 and the Android 100 / iOS 29 / missing 42 split from q01-r2-b, which used a different exclusion list and a missing-platform bucket.
- **Expected effect.** UNBACKED. The only causal reference (F8) is +2% new-user retention, from *tuning* reminders that already existed.
- **Effort.** M: scheduling, cancellation on core action and on plan set, strings in 7 locales, one new kind in `NOTIFICATION_KIND`, a tap route, the permission-status event.
- **Risk to the onboarding paywall.** No onboarding screen changes; assignment happens at `onboarding_completed`, after the paywall. It must not land on the same day as `trial_reminder`. Crossing with `onboarding_paywall_2026q4` and stratifying reads by platform × arm keeps both paywall arms equally exposed.
- **Measurement at ~7 installs a day** (in-arm guardrails and direct signals; the verdict comes from the package's primary).
  - **Kill rule (pre-registered, thresholds UNBACKED — chosen as "visible harm at this volume"):** stop the message, not the package, if (a) permission revocations (`notification_permission_status {granted:false}` after a grant) within 7 days in the treatment arm exceed control by ≥ 3 riders, or (b) after 4 weeks, revocations in the treatment arm exceed `activation_d1` opens (04's stop rule [SOURCE: 04-lifecycle-crm.md P04.1 stop rule]). The package-level kill rule (engaged successes trailing by ≥ 6) is 06's [SOURCE: 06-experimentation-analyst.md P06.2].
  - Direct signal, no control needed: open rate, and core action within 2 h of an open (04's leading indicator); day-2 engaged return in granted completers, per arm, as description.
  - Report as "of consenting riders who granted permission".
- **Light/dark.** Notifications use the system UI. The landing deep links (start-ride, add-expense, home, the bike's Service segment) already exist; check both themes on each landing screen when testing.

### P01.3 An off-season aha moment for maintenance riders — **withdrawn, merged into P05.2**

*Status after round 1:* P05.2 ("Your next service, dated") specifies the same card with one past-work question. Two specs for one card would conflict, so I withdraw P01.3 and contribute two things to P05.2:
- **Coverage data (F13).** Only 18 of 380 cohort bikes (4.7%) have a verified model-level schedule; 63% would see make-generic intervals and 32% the GENERIC fallback [SOURCE: Supabase q01-r2-d]. So for most riders the card would show generic intervals, and at least some make-generic intervals are known to be wrong [SOURCE: memory `project_oem_schedule_africa_twin`]. My draft-1 line "fall back to generic intervals, labelled 'generic — set your own'" named no source; the fallback that exists is the app's own GENERIC/make-generic tiers [SOURCE: apps/api/src/modules/oem-schedules/oem-schedules.service.ts:94-100], and their intervals have no cited source in this research. P05.2 should either label them honestly ("typical interval — check your manual") or lead with the past-work question and skip the interval when only GENERIC exists [UNBACKED — own recommendation].
- **A metric with a baseline.** My "30-day return of riders who seeded a due date" has no baseline because the seeding action does not exist. The nearest measurable proxy today: `maintain_bike` riders' D7, 8/104 (7.7%) [SOURCE: evidence pack §4]. P05.2's own pre-registered delayed read (`reminder_opened {kind:'maintenance'}` within 60 days) is the better one and I defer to it.

**Suggested order (round 2).** One randomized change at a time, no before/after change in flight beside it [SOURCE: 06-experimentation-analyst.md P06.3]. (1) Add `post_onboarding_landed` (pack §9), `notification_permission_status`, `gps_fix` and `max_speed_kmh`, and write the slot's occupant, primary, N = 64, the 2026-03-31 cap, strata and kill rules into the P06.1 ledger. (2) Run the Android device gate. (3) Launch the P06.2 slot. My vote is the package (P01.1 + plan picker + P01.2 as fallback) behind the flag, so P01.1 and P01.2 ship together and nothing else is in flight. If the ledger puts the nudge alone in the slot, P01.1 waits until the slot stops. P01.3 is withdrawn into P05.2.

## What I'd NOT do, and why

- **Touch the onboarding paywall, or move steps around it to "shorten time to value".** It is revenue-critical, and its A/B tests (`onboarding_paywall_2026q4`, RC `expd7c1d56904`) are still underpowered at about 50 viewers per arm [SOURCE: evidence pack §6]. Any onboarding change would contaminate them.
- **Lower the 30 s / 50 m ride floor to inflate "rides saved".** It would make the metric measure test taps instead of riding. That is the trap in memory `feedback_metric_measures_something_else` [SOURCE: apps/mobile/src/utils/ride-constants.ts:12-13].
- **"We miss you" win-back pushes on days 3–7, or a multi-message drip.** Chen expects they won't move the curve (F5). Almost no one activates after day 1 [SOURCE: evidence pack §3]. With no causal data, a sequence risks uninstalls. Start with one message (P01.2).
- **Server push for activation, until the token gap is explained.** Only 12.9% of sign-ups have a stored token, against 176 PostHog grants [SOURCE: evidence pack §8b].
- **Daily streaks or gamification.** Riding is weekly and weekend-shaped, and seasonal (F10). A daily cadence would fight the real habit [UNBACKED — own idea].
- **Lead with AI diagnostics, or measure activation by `onboarding_completed`.** AI diagnostics is out of scope as the hero: 10 riders went through those paths and 0 returned [SOURCE: evidence pack §5]. `onboarding_completed` is a setup moment, not an aha moment (F3).
- **Classic 50/50 tests read weekly.** Weekly day-2 return already swings 3–12% [SOURCE: evidence pack §2]. Reading weekly guarantees false wins.
- **More What's New work.** It is already suppressed for new riders (F11). Re-run q04 split by version before spending more time on it.
- **Read the late-cohort dip as seasonal.** It is inside binomial noise (Diagnosis 4).

### Sources opened this session
1. https://www.lennysnewsletter.com/p/what-is-a-good-activation-rate
2. https://www.lennysnewsletter.com/p/how-to-determine-your-activation
3. https://phiture.com/mobilegrowthstack/managing-retention-rate-benchmarks-and-expectations/
4. https://hq-raydata-co.pages.dev/vault/06-reference/2026-04-03-activations-three-moments/ (secondary notes on Reforge)
5. https://amplitude.com/blog/7-percent-retention-rule (vendor)
6. https://andrewchen.com/new-data-shows-why-losing-80-of-your-mobile-users-is-normal-and-that-the-best-apps-do-much-better/
7. https://airship.com/blog/predict-and-prevent-customer-churn-and-increase-app-retention (vendor)
8. https://www.evanmiller.org/sequential-ab-testing.html
9. https://ultimatemotorcycling.com/2014/12/04/biker-summer-2014-survey-europeans-ride-10-million-miles
10. https://blog.duolingo.com/hi-its-duo-the-ai-behind-the-meme/ (vendor's own blog; no numbers)
11. https://research.duolingo.com/papers/yancey.kdd20.pdf
12. https://www.braze.com/resources/articles/mobile-app-retention (vendor)
13. https://www.news.aakashg.com/p/ultimate-guide-activation (draft 2)
14. https://developer.android.com/develop/background-work/services/alarms/schedule (draft 2)
15. https://www.reforge.com/guides/enable-plg-led-activation (draft 2; no readable text without JavaScript)
16. https://www.reforge.com/programs/retention-series-eg/preview/material (draft 2; no readable text)
17. https://www.reforge.com/artifacts/plg-system-architecture-and-activation (draft 2; no readable text)

## Responses

Added 2026-11-12 after reading drafts 02–06. One new read-only PostHog query was run for this section (q01-resp-a, SQL at the end). Nothing was written anywhere else.

**R1. On P02.2 (Onboarding UX), P03.2 (Behavioural) and P05.1 (Rider voice): one build, not four. Use 02's distance cut as the trigger.**
- Four of us proposed the same change to the too-short sheet (P01.1, P02.2, P03.2, P05.1). I agree with all of them and propose one merged spec [UNBACKED — own synthesis].
- **Trigger.** Show it when the rider has no saved ride and `distance_m < 10`, not on "first attempt ever" (P03.2). 02's new query shows the guard is mostly people standing still: 125 of 221 sheets (49 riders) fired at under 10 m and under 30 s, and only 27 sheets (5 riders) came after 50 m or more [SOURCE: PostHog q-02a, in 02-onboarding-ux.md appendix]. *(Draft 3: those are event rows across mixed builds. 02's revised q-02a on builds ≥ 3.21.0 counts 31 `shown` sheets, 20 of them (16 riders) under 10 m and 30 s; the trigger also needs the too-short branch, i.e. `elapsed_s < 120` on old builds. See P01.1.)* A rider who trips the guard twice at home should see the teaching copy both times. A rider who moved 50 m+ has a real problem and should keep today's sheet.
- **Copy.** Use 03's "Test ride: all good" framing (it rewards the right action) with 02's placement tip (phone where it can see the sky). Drop my "✓" glyph: the HUD is always dark [SOURCE: apps/mobile/src/app/(modals)/ride-hud.tsx:31], so a check mark adds a contrast problem and no meaning. *(Draft 3: the "GPS works" title is now shown only when a location fix arrived; otherwise 03's "Testing it out?" string. See P01.1 and R2.3.)*
- **One picker, one notification kind.** The "remind me" button should open the same when-will-you-ride chips as P02.1/P03.1, writing one kind (`activation_next_ride`). We should not ship three kinds (`first_ride`, `activation_first_ride`, `activation_next_ride`) for one idea [SOURCE: 01 P01.1, 02 P02.1, 03 P03.1, 05 P05.1 event names].
- **Metric.** The shared primary is "Start-tappers with no saved ride → real ride saved within 7 days", with 34/103 as the baseline over the whole window [SOURCE: evidence pack §3, q05]. As 03 says, re-cut it to a 7-day window before launch. *(Draft 2: superseded by 11/49. Draft 3: 11/49 is also superseded; the ledger baseline is 1/13 on builds ≥ 3.21.0, see P01.1 and R2.1.)*

**R2. On P04.1 (Lifecycle) and P06's "no day-1 reminder until the token gap is explained": the gap is explained, and local notifications already reach Android. Merge P04.1 with my P01.2 and ship it.**
- 04 found the cause of the 57-vs-176 gap: there have never been any Android push tokens (0 of 105), because Android has no FCM configuration [SOURCE: 04-lifecycle-crm.md, Supabase query A; apps/mobile/app.config.ts per 04]. That answers the blocker in 06's "What I'd NOT do" for **server** push only.
- New evidence that the **local** path works on Android. Since 2026-08-14, `reminder_opened` with `kind = ride_idle` was sent from `platform = android` 5 times by 3 riders [SOURCE: PostHog q01-resp-a]. With 0 Android tokens in the DB, those can only come from the locally scheduled ride-idle notification. The code fires that kind both locally (auto-pause) and from the server sweep [SOURCE: apps/mobile/src/lib/notifications.ts:14-21]. Caveat: n=3 riders, and q01-resp-a does not exclude test accounts. It proves the path works, not how often. *(Draft 2: this overclaimed. It shows that an immediate notification fired during a ride reaches Android, not that a next-day scheduled one does; see F12, R1.9 and the P01.2 device gate. Re-run with test accounts excluded: Android `ride_idle` is still 5 opens by 3 riders [SOURCE: PostHog q01-r2-c].)*
- I accept 06's correction that "Not now" is already tracked through `onboarding_step_completed {skipped:true}` [SOURCE: 06 F14; apps/mobile/src/app/(onboarding)/notifications.tsx:207-213]. I withdraw that instrumentation ask from P01.2.
- **Merged spec.** Use P04.1 as the base: 18:00 next day, cancelled by any core action, no Pro wording (Apple 4.5.4, 04 F9). Make two changes:
  - (a) If the rider set a plan in R1/P02.1/P03.1, **skip** the day-1 message. One activation notification per rider in week 1, at most [UNBACKED — own rule, to stop three proposals stacking into a drip].
  - (b) For `maintain_bike`, I drop my "what's due on your {model}" copy and take 04's expense copy. 04 points out that maintenance-first riders return at 7% while expense-first riders return at 41% (9/22), and that the OEM schedule has model gaps [SOURCE: evidence pack §3; 04 "What I'd NOT do"]. The due-date copy can come back once P05.2/P01.3 has seeded a real date. *(Draft 3: superseded. The `maintain_bike` branch is an owner pick, frozen before launch and reported per branch as description, as in 04; see P01.2 and R2.7.)*
- Keep 06's measurement fix: report day-2 "engaged" return without the reminder tap itself, or the test counts its own opens [SOURCE: 06 F14].

**R3. On P06.2 (Experimentation): agree on a crossed, sequential holdout. Challenge `activation_24h` as its primary metric.**
- I agree with the design: assign at `onboarding_completed`, cross it with `onboarding_paywall_2026q4` rather than nesting it, stratify by platform × arm, and use Evan Miller's stopping rule [SOURCE: 06 P06.2; https://www.evanmiller.org/sequential-ab-testing.html (2015-10-13)].
- **Challenge.** The board's leading interventions (R1 and P02.1/P03.1) work by *moving* a ride to the rider's next ride day, which is usually after the first 24 h. 03 schedules "This weekend" for Saturday 12:30 [SOURCE: 03 P03.1]. A metric that stops at 24 h will score those rides as zero. It rewards the very same-day behaviour that 66 of 103 Start-tappers could not do [SOURCE: evidence pack §3].
- 06's own sample-size table shows the cost of switching is about nothing. Doubling week-1 core action needs 540 installs; doubling `activation_24h` needs 594 [SOURCE: 06 F2]. So I propose:
  - **primary = week-1 core action** (real ride, expense, or completed task; baseline 7.7%, 61/793) [SOURCE: evidence pack §2];
  - `activation_24h` as an early diagnostic, and as a **harm** check that the plan sheet does not cannibalise same-day actions;
  - day-2 engaged return as the #365 secondary.
- What the flag should test: the R1 + R2 bundle (teaching sheet + plan picker + one local message) against today's experience. Testing them one at a time would exceed our traffic for a year (06 F2). The bundle is still free, post-onboarding and away from the paywall, so it respects every hard constraint [UNBACKED — own recommendation]. *(Draft 3: this is now the single version I hold, written out in P01.2 "Which test" with a power-at-cap run. The draft-2 standalone 50/50 of the message is deleted.)*

```sql
-- q01-resp-a (PostHog, read-only, 2026-11-12): local-reminder opens by platform and kind; test accounts NOT excluded
SELECT properties.platform AS platform, properties.kind AS kind, count() AS opens, uniq(person_id) AS riders
FROM events WHERE event = 'reminder_opened' AND timestamp >= '2026-08-14'
GROUP BY platform, kind ORDER BY opens DESC
-- result: ios/ride_idle 25 opens, 8 riders | (null)/ride_idle 10/5 | android/ride_idle 5/3 | (null)/maintenance 1/1
```

```sql
-- q01-r2-a (PostHog 155556, read-only, 2026-11-12): merged-trigger baseline for P01.1. Cohort + q00 exclusions as q05.
WITH c AS (SELECT person_id AS pid, min(timestamp) AS fs FROM events WHERE timestamp >= '2026-04-01' AND properties.$lib = 'posthog-react-native'
  GROUP BY pid HAVING fs >= '2026-08-14' AND fs < '2026-11-05'),
r AS (SELECT person_id AS pid,
  minIf(timestamp, event = 'ride_too_short_shown' AND toFloat(properties.distance_m) < 10) AS t_q,
  minIf(timestamp, event = 'ride_too_short_shown') AS t_any,
  countIf(event = 'ride_too_short_shown' AND properties.distance_m IS NULL) AS sheets_no_dist,
  countIf(event = 'ride_too_short_shown') AS sheets,
  minIf(timestamp, event = 'ride_completed' AND coalesce(toString(properties.below_min_ride), '') NOT IN ('true','1')) AS t_real
 FROM events WHERE timestamp >= '2026-08-14' AND timestamp < '2026-11-13' AND event IN ('ride_too_short_shown','ride_completed')
  AND person_id IN (SELECT pid FROM c) AND person_id NOT IN (/* q00 list */)
 GROUP BY pid HAVING t_any > toDateTime('2000-01-01'))
SELECT count() AS riders_with_any_sheet, sum(sheets), sum(sheets_no_dist),
 countIf(t_q > toDateTime('2000-01-01') AND (t_real < toDateTime('2000-01-01') OR t_real > t_q)) AS eligible,
 countIf(t_q > toDateTime('2000-01-01') AND t_real > t_q AND t_real <= t_q + INTERVAL 7 DAY) AS real_ride_7d
 -- plus the same two counts restricted to t_q < '2026-11-05'
FROM r
-- result: 66 riders | 221 sheets | 0 without distance_m | eligible 49 | real ride within 7 d 11 | (t_q before 11-05: 48 | 11)
-- SUPERSEDED in draft 3 by q01-r3-a: no elapsed_s filter, no build split, and '221 sheets' are event rows (one per action).

-- q01-r2-b (PostHog, read-only): day-2 raw vs engaged return by group. Base CTE = q02 base (same cohort, q00 exclusions) plus:
--   edays = days with a core action, or a $screen NOT IN ('/','/(tabs)/(home)','/(tabs)','/(tabs)/(home)/index','/whats-new')
--           and not starting with '/(auth)' or '/(onboarding)';  rdays = days with reminder_opened
-- grp = granted_completers if onboarding_completed AND last notification_permission_result.permission_granted = 'true'
-- SUPERSEDED in draft 3: different exclusion list and an unmapped-platform bucket; use 06 q06-rev-engaged / 04 query E (23/171).
-- result granted_completers: android 100 | raw 20 | engaged 12 | reminder 1;  ios 29 | 10 | 10 | 1;  platform missing 42 | 5 | 4 | 0
--   => 171 | raw 35 (20.5%) | engaged 26 (15.2%) | 2 opened a reminder on day 2
-- other_completers 196 | raw 23 | engaged 17;  not_completed 426 | raw 14 | engaged 4

-- q01-r2-c (PostHog, read-only): reminder_opened by platform and kind since 2026-04-01, q00 exclusions applied
-- result: ios/ride_idle 21 opens, 7 riders | (null)/ride_idle 10/5 | android/ride_idle 5/3 | (null)/maintenance 1/1
```

```sql
-- q01-r2-d (Supabase prod, read-only SELECT via Management API, 2026-11-12): OEM schedule tier of cohort bikes
with b as (
 select m.id, upper(m.make) mk, m.model, m.year from motorcycles m join users u on u.id = m.user_id
 where m.created_at >= '2026-08-14' and m.created_at < '2026-11-05' and m.deleted_at is null
   and coalesce(u.is_synthetic,false) = false and u.email not ilike '%@motovault.app'
   and u.email not ilike '%@cloudtestlabaccounts.com' and u.email not ilike '%@priorises.com'
), t as (
 select b.*,
  exists(select 1 from oem_maintenance_schedules s where s.is_verified and s.make = b.mk and s.model = b.model
         and (s.year_from is null or s.year_from <= b.year) and (s.year_to is null or s.year_to >= b.year)) as model_tier,
  exists(select 1 from oem_maintenance_schedules s where s.is_verified and s.make = b.mk and s.model is null) as make_tier
 from b)
select count(*) bikes, count(*) filter (where model_tier) model_level,
       count(*) filter (where not model_tier and make_tier) make_generic_only,
       count(*) filter (where not model_tier and not make_tier) generic_fallback from t
-- result: 380 bikes | 18 model-level | 239 make-generic only | 123 GENERIC fallback
-- caveats: the three named owner/test emails in q00 are not excluded by name here (they are small in number);
-- variant-level rows and the engine_cc filter are ignored, so model_level is an upper bound.
```

```sql
-- q01-r3-a (PostHog, read-only, 2026-11-12): THE ledger baseline for P01.1. Cohort = app persons first seen 2026-08-14..11-04,
-- q00 exclusions (12 ids). Trigger = first ride_too_short_shown with distance_m < 10 AND elapsed_s < 120, no saved real ride before it.
-- Build = $app_version of that triggering sheet (pre_3.21 = 3.18.0, 3.19.0, 3.19.1, 3.20.0).
WITH c AS (SELECT person_id AS pid, min(timestamp) AS fs FROM events
  WHERE timestamp >= '2026-04-01' AND properties.$lib = 'posthog-react-native' AND person_id NOT IN (/* q00 list */)
  GROUP BY pid HAVING fs >= '2026-08-14' AND fs < '2026-11-05'),
r AS (SELECT person_id AS pid,
  minIf(timestamp, event = 'ride_too_short_shown' AND toFloat(properties.distance_m) < 10 AND toFloat(properties.elapsed_s) < 120) AS t_q,
  argMinIf(toString(properties.$app_version), timestamp, event = 'ride_too_short_shown' AND toFloat(properties.distance_m) < 10 AND toFloat(properties.elapsed_s) < 120) AS ver,
  minIf(timestamp, event = 'ride_completed' AND coalesce(toString(properties.below_min_ride), '') NOT IN ('true','1')) AS t_real
 FROM events WHERE timestamp >= '2026-08-14' AND timestamp < '2026-11-13' AND event IN ('ride_too_short_shown','ride_completed')
  AND person_id IN (SELECT pid FROM c) GROUP BY pid)
SELECT if(ver IN ('3.18.0','3.19.0','3.19.1','3.20.0'), 'pre_3.21', 'ge_3.21') AS build,
  countIf(NOT (t_real > toDateTime('2000-01-01') AND t_real < t_q)) AS eligible,
  countIf(NOT (t_real > toDateTime('2000-01-01') AND t_real < t_q) AND t_q < toDateTime('2026-11-06')) AS eligible_full7d,
  countIf(t_q < toDateTime('2026-11-06') AND t_real > t_q AND t_real <= t_q + INTERVAL 7 DAY) AS saved_7d,
  groupUniqArray(ver) AS versions, min(t_q), max(t_q)
FROM r WHERE t_q > toDateTime('2000-01-01') GROUP BY build
-- result: ge_3.21  eligible 14 | full week 13 | saved within 7 d 1  | versions 3.21.0, 3.26.0 | 2026-10-06 .. 11-09
--         pre_3.21 eligible 32 | full week 32 | saved within 7 d 10 | versions 3.18.0, 3.19.0, 3.19.1 | 2026-08-14 .. 10-06
```

```python
# q01-r3-sim (local, Python 3 stdlib, fixed seeds; run with python3 -I). [UNBACKED — own simulation]
# Evan Miller's rule (https://www.evanmiller.org/sequential-ab-testing.html) with an enrolment cap = days to 2026-03-31 x enrolment/day.
import random, math
def run(pc, pt, N, cap_n, reps=4000, seed=1):
    rnd = random.Random(seed); d = math.ceil(2*math.sqrt(N)); wins = 0
    for _ in range(reps):
        T = C = n = 0
        while n < cap_n:
            n += 1
            if rnd.random() < 0.5: T += rnd.random() < pt
            else: C += rnd.random() < pc
            if T - C >= d: wins += 1; break
            if T + C >= N: break
    return wins/reps
for days in (120, 86):                       # launch 2026-12-01 / 2027-01-04
    for rate in (1.43, 2.0):                 # nudge: granted completers/day, late-Oct (2.0/1.4) and window average (06)
        cap = round(days*rate); print("nudge 13.5%", days, rate, cap, run(0.135, 0.27, 64, cap), run(0.135, 0.27, 36, cap))
    for rate in (2.14, 3.0):                 # package: completers/day, late-Oct (3.0/1.4) and window average (06)
        cap = round(days*rate); print("package 16.6%", days, rate, cap, run(0.166, 0.332, 64, cap))
# output (power for a true doubling; false positives under no effect were 0.0-0.034 in every cell):
# nudge   120 d: 1.43/d -> 0.29 (N=36: 0.54) | 2.0/d -> 0.60 (N=36: 0.62)
# package 120 d: 2.14/d -> 0.79              | 3.0/d -> 0.82
# nudge    86 d: 1.43/d -> 0.08 (N=36: 0.29) | 2.0/d -> 0.29 (N=36: 0.54)
# package  86 d: 2.14/d -> 0.54              | 3.0/d -> 0.79
```

## Answers to review

Round 1 (Skeptic, 2026-11-12). Draft 2 runs four new read-only queries (q01-r2-a..d above); nothing was written anywhere.

- **R1.1 — fixed:** re-cut with the exact merged trigger (`distance_m < 10`, no saved real ride before it), 7-day window, q00 exclusions: **11/49 (22%)** saved a real ride within 7 days; 11/48 when only sheets with a full observable week are counted [SOURCE: PostHog q01-r2-a]. All 221 sheets carry `distance_m`, so no rider drops out of the trigger. The "34 of 66" error is corrected (34 is of 103). P01.1 now states this as its primary baseline and lists the other members' cuts as reference only; it goes into the P06.1 ledger before launch.
- **R1.2 — fixed:** the P01.2 body now uses Miller's N in successes: N = 64, ship at T − C ≥ 16, stop with no winner at T + C = 64, as in 06's table [SOURCE: https://www.evanmiller.org/sequential-ab-testing.html; 06 P06.2]. I added the time cost at our baseline (~15 weeks with a doubling, ~30 weeks with no effect; own arithmetic). F9 already described N correctly; the "160 granted riders" line is gone.
- **R1.3 — fixed:** computed the engaged-return baseline for the actual population (completed onboarding and granted): **26/171 (15.2%)** engaged, 35/171 raw, matching 06's 35/171 [SOURCE: PostHog q01-r2-b]. The body now uses it, says why the pack's 20/119 and 15/57 are a different population, and drops the "Not now" instrumentation ask, in line with R2.
- **R1.4 — fixed:** Diagnosis 6 now says the source blends Statista, AppsFlyer, Adjust and Business of Apps worldwide with no Europe/US split, no seasonal or motorcycle category and unknown D1 definitions, so both the D1 and D7 comparisons are order-of-magnitude only.
- **R1.5 — fixed:** Diagnosis 4 now says the dip (9/120 over the last three weeks) is inside the 3–12% band and that weekly variance is below binomial noise (06 F3, ratio 0.60), so it cannot be told from noise. The survey's limits (2014, Delticom-run, self-selected, no US) are stated, and I keep only "much of Europe rides less in winter". Added the dip reading to "What I'd NOT do".
- **R1.6 — fixed, partly:** I tried to cite Reforge directly; its guide, program and artifact pages return no readable text without JavaScript [SOURCE: reforge.com pages listed as sources 15–17]. F3 now cites a named-author secondary (Aakash Gupta, 2023-12-06) for the setup/aha/habit sequence, tags the private-notes site as weak and unattributable, drops the "too early" quote as evidence, and rests the argument on our own 15.8% vs 83% numbers instead.
- **R1.7 — fixed:** P01.3 is **withdrawn and merged into P05.2**. I ran the coverage query: 18/380 cohort bikes (4.7%) have a model-level schedule, 63% make-generic, 32% GENERIC fallback [SOURCE: Supabase q01-r2-d]. So the generic case is the common case, as the review suspected. The unsourced "generic — set your own" line is replaced by a pointer to the app's existing tiers, with the note that their intervals are unsourced and in one known case wrong. For the metric, I defer to P05.2's 60-day maintenance-reminder read and give `maintain_bike` D7 8/104 as the only existing proxy.
- **R1.8 — fixed:** P01.2 now has a pre-registered kill rule: stop if test-arm engaged successes trail control by ≥ 6, if permission revocations within 7 days exceed control by ≥ 3, or if after 4 weeks revocations exceed opens (04's rule). Thresholds are tagged UNBACKED. Since revocations are invisible today, P01.2 adds a `notification_permission_status` event as a prerequisite.
- **R1.9 — fixed:** agreed, the ride_idle evidence only shows that an immediate in-ride notification reaches Android. New evidence makes the gap explicit: no date-scheduled local reminder has ever been opened on Android in our data (test accounts excluded) [SOURCE: PostHog q01-r2-c], and our alarms are inexact `setAndAllowWhileIdle` [SOURCE: apps/mobile/app.config.ts:356-366], which Android delivers "within one hour" on 12+ unless battery saver or Doze applies [SOURCE: https://developer.android.com/develop/background-work/services/alarms/schedule]. P01.2 now has an Android 13+ overnight device check (battery saver on and off) as a launch gate, and Responses R2 is annotated as overclaimed.

Round 2 (Skeptic, 2026-11-12). Draft 3 runs one new read-only PostHog query (q01-r3-a) and one local simulation (q01-r3-sim); nothing was written anywhere else.

- **R2.1 — fixed:** P01.1 now uses the single ledger baseline: merged trigger (`distance_m < 10`, too-short branch, so `elapsed_s < 120`), no saved real ride before, builds ≥ 3.21.0 only, q00 exclusions. Result: **1 of 13** riders saved a real ride within 7 days (14 triggered, 13 with a full week) [SOURCE: PostHog q01-r3-a]. That agrees with 02's 1/13 and 05's 14-eligible / 1-saved [SOURCE: 02-onboarding-ux.md q-02c; 05-rider-voice.md P1-ver]. The text says plainly that it is anecdote-sized (about 13 riders) and a count, not a rate. 11/49 and 11/48 are retired, the q01-r2-a block is marked superseded (no `elapsed_s` filter, mixed builds, row counts), and the pre-3.21.0 10/32 is kept only as a reference that must not serve as a before-window.
- **R2.2 — fixed:** measurement (b) no longer promises a lift. It is now P06.3's harm check only (8-week trailing before-window on builds ≥ 3.21.0 after 2026-10-07, 4–8 week after-window, revert only on a drop beyond the 80% interval) [SOURCE: 06-experimentation-analyst.md P06.3], plus the mechanism chain reported as per-rider counts (sheet → `gps_fix` → `remind_me` → scheduled → opened → ride within 48 h), with no rates before about 40 riders. The wrong §2 weekly-noise yardstick is gone.
- **R2.3 — fixed:** P01.1 adopts 03's two strings and the `gps_fix` property: "Test ride: all good" / "GPS and recording work. …" only when at least one location fix arrived (`setGpsAccuracy`, ride-hud.tsx:150), otherwise "Testing it out?" with the sky-view instruction [SOURCE: 03-behavioural-scientist.md P03.2; 02-onboarding-ux.md Responses 1]. Buttons follow 03. Responses R1's copy bullet is annotated.
- **R2.4 — fixed:** P01.2 now uses 06 F14's written screen list and the pack's platform mapping: **23/171 (13.5%)** day-2 engaged return, Android 11/115, iOS 12/56 [SOURCE: 06-experimentation-analyst.md q06-rev-engaged; 04-lifecycle-crm.md F18, query E]. The secondary first-week core action for the same group is **36/171 (21.1%)** [SOURCE: 06-experimentation-analyst.md q06-rev-completers]. 26/171 and the 100 / 29 / 42-missing split are retired, and q01-r2-b is marked superseded.
- **R2.5 — fixed:** I hold one version and deleted the other. The draft-2 standalone 50/50 of the message is gone. P01.2 is now the in-arm fallback of the first-session package, and my vote for the P06.2 slot is that package: all completers, intent-to-treat, primary week-1 core action 61/367 [SOURCE: 06-experimentation-analyst.md P06.1 ledger; 02-onboarding-ux.md P02.1]. The reason is new: at the calendar cap the package keeps a realistic chance of a verdict and the nudge alone does not (R2.6). The single board decision is the slot occupant written in the P06.1 ledger; P01.2 lists the fallback row so the ledger has both. The order is rewritten to obey P06.3's one-change-at-a-time rule: with the package in the slot, P01.1 and P01.2 ship together behind the flag; with the nudge alone, P01.1 waits until the slot stops.
- **R2.6 — fixed:** the uncapped 0.83 and "~15 weeks" are gone. I did not wait for 06; I ran 06's own procedure with an enrolment cap (script q01-r3-sim, own simulation). Launch 2026-12-01, cap 2026-03-31 (120 days), N = 64, true doubling: nudge alone **0.29** at the late-October rate and 0.60 at the window average (N = 36: 0.54 / 0.62); package **0.79** / 0.82. A 2027-01-04 launch gives nudge 0.08 / 0.29 and package 0.54 / 0.79 [UNBACKED — own simulation; rule from SOURCE: https://www.evanmiller.org/sequential-ab-testing.html (Evan Miller, 2015-10-13); 1.4× slow-down from 06-experimentation-analyst.md P06.2]. Both assume a doubling that no source supports, and a cap reached without a winner reads "no doubling shown", as 06 says. 06 should re-run these as the ledger's numbers.
- **R2.7 — fixed:** the `maintain_bike` branch is now "owner picks; frozen before launch; reported per branch, descriptive only", as in 04 [SOURCE: 04-lifecycle-crm.md P04.1 after R1.6]. Both candidates are listed (05's "when did you last…" with expense fallback, or expense for all), with the note that the 41% expense-first figure is selection. I added one fact for the choice: with model-level schedules on only 4.7% of cohort bikes and make-generic on 63% (F13), "has a schedule row" must be defined before the copy is frozen. Responses R2(b) is annotated as superseded.
