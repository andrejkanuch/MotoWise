# 05 Rider voice / community researcher

First draft 2026-11-12, revised 2026-11-12 after the Skeptic's round 1 and again after round 2 (`review-05-rider-voice.md`). Research and planning only: no code, PostHog, RevenueCat, GitHub or database writes were made. The revisions ran read-only SELECTs against PostHog (project 155556) and the Supabase production database (Management API). The SQL is at the end of "Answers to review" (round-2 queries P2 and M2 are new).

**Method and limits.**
- **Sources.** Draft: 12 sources (App Store pages and forum threads via WebFetch, 2 ADVrider threads via the agent-reach `read` CLI, 4 agent-reach Reddit searches). Revision: 1 WebFetch (REVER App Store page, again) and 1 agent-reach Reddit search (`public-web/exa` backend).
- **Reddit.** Thread pages (`agent-reach read`) came back "You've been blocked by network security", so I stopped there, as the skill's rules require. Reddit quotes come from the post and top-comment text that the search returned, not from the full threads.
- **ADVrider** sends plain fetches to a paywall (`tollbit.advrider.com`, HTTP 307). The agent-reach read worked once, on one thread. The Skeptic re-read it and found all five quotes.
- **calimoto.** The UK page returned paraphrase only (a 125-character quote limit), so calimoto items are marked as paraphrase.
- **App Store pages rotate.** Apple shows only the 4–10 reviews it chooses, and a second fetch of the same URL can show a different set. The REVER page did exactly that between my draft and the Skeptic's check (R1.1). App Store quotes below are therefore labelled **"single retrieval, may not reproduce"**. They are anecdotes, not a sample. Where I could, I backed each point with a Reddit post that has a stable URL and a date.
- **Seasonality.** I found no free source that puts a number on motorcycle seasonality.

---

## Diagnosis

Seen from the rider's side, our funnel loses people for three reasons. None of them is "the app is missing a feature".

1. **Most riders install while not on the bike. When they test the Ride button, the app treats it as an error.**
   - What Home actually shows after onboarding (origin/main 5a497a1c): a hero **bike plate** that states the bike's maintenance status ("ready, due soon or overdue": the next due task and the distance or days left), then an action row **Ride / Expense / Task / Diagnose**, a receipt-scan row, the onboarding checklist and an "Up next" task list [SOURCE: apps/mobile/src/app/(tabs)/(home)/index.tsx:125-166, 369-410]. My draft said Home "leads with Start ride". That was wrong; I took it from the pack's looser wording (§5).
   - Ride is the first of four equal actions. Of new riders who tap it, two thirds get "ride too short" (66 of 103) [SOURCE: evidence pack §3, PostHog q05].
   - The guard fires when a ride is under 30 s or under 50 m [SOURCE: apps/mobile/src/utils/ride-constants.ts:12-13; apps/mobile/src/app/(modals)/ride-hud.tsx:218 (origin/main)]. Most sheets fire while the rider is standing still: on builds ≥ 3.21.0, counting only `action = 'shown'` rows, 20 of 31 sheets (16 riders) came at under 10 m and under 30 s, and riders chose "End anyway" 27 times to "Keep riding" once [SOURCE: PostHog q-02a (revised), in 02-onboarding-ux.md Diagnosis 3 and appendix]. (The pack's "221" counts event rows — `shown`, `keep`, `end` — across mixed builds, not sheets.)
   - The sheet asks "Your ride was very short ({{seconds}}s, {{meters}}m). Are you sure?" [SOURCE: apps/mobile/src/i18n/locales/en.json `rideHud.shortRideWarning`]. That treats a curious rider testing the button as an error case. A better reading is "this rider intends to ride later". [UNBACKED — own reading]
   - Our cohort window, 08-14 → 11-04, is the end of the northern riding season, so a growing share of installs probably come from riders whose bike is parked for winter. [UNBACKED — own idea; I found no source with a number for winter lay-up]
2. **Riders who come for maintenance don't need us tomorrow. They need us when the next service is due. And since October, most of them don't get a schedule at all.**
   - The day-2 metric cannot reward them. maintain_bike riders return on day 2 at 3.6% [SOURCE: evidence pack §4], and maintenance-first riders at 7% [SOURCE: evidence pack §3]. Forum riders describe a maintenance log as something they open at an odometer interval or a service, not daily (F2, F7).
   - **New in this revision: the schedule is missing for most new bikes.** Among cohort riders' first bikes created on sign-up day, 105 of 161 (65%) got schedule tasks in Aug 14–Sep 30. In Oct 1–Nov 4 the figure was 45 of 127 (35%). For riders whose first goal was `maintain_bike` it fell from 26/40 to 7/34 [SOURCE: Supabase prod, query S3 below]. Nearly all of those tasks are `source='oem'` rows created within a minute of the bike [SOURCE: Supabase prod, query S4].
   - **Make-only bikes** (model left blank in onboarding, allowed since about 2026-10-06 [SOURCE: memory `project_onboarding_make_only_bike_dropped`]) get almost no schedule: 4 of 77 have any task [SOURCE: Supabase prod, query S2]. The 77 include 42 bikes backfilled by migration 00191 on 2026-10-15.
   - With no task, the plate falls back to the state "Ready" with the caption "**No service due**" [SOURCE: apps/mobile/src/components/home/home-plate.ts:96-103; en.json `home.noServiceDue`]. A rider who installed to learn their service schedule is told, on the hero card, that nothing is due. That is false: the app simply has no schedule for the bike. [UNBACKED — own reading of the code path]
   - I have not verified the cause of the October drop. A plausible lead, not checked end to end: the onboarding import only runs for schedule ids the rider accepted [SOURCE: apps/api/src/modules/users/users.service.ts:235]. The onboarding step that collected them was retired on 2026-08-24 ("completed by 2 of 150 riders") [SOURCE: apps/mobile/src/config/onboarding.ts:147], and blank-model bikes cannot match a model row. **The fact is the drop. The cause is open.**
   - So a low day-2 rate for this group is partly expected. The real failure is different: these riders leave day 0 without the one thing that would bring them back, which is a dated service item that will remind them (F7). [UNBACKED — own idea, built on F5–F7 and the data above]
3. **Day 0 is the only window, and nothing reaches the rider after it.**
   - 40 of the 61 first core actions happen in the first hour. Only 5 happen after day 1 [SOURCE: evidence pack §3 `ttfc`].
   - There is no day-0 → day-7 message of any kind [SOURCE: evidence pack §1].
   - The warm group is real: 76 riders tapped Start on day 0 without saving a ride, and 20 of them (26%) still came back on day 2 [SOURCE: evidence pack §3]. They meant to ride, and we give them nothing to come back to.

The web promises "your model's service schedule" (62% of search clicks) [SOURCE: evidence pack §7]. In the app, only 17 of 336 cohort first bikes (5%) match a verified model-level schedule; for maintain_bike riders it is 2 of 90 [SOURCE: Supabase prod, query S1]. Riders arrive from the web with a model question. The app can answer it for about one in twenty, and since October it shows most of them "No service due".

---

## Findings

**Why riders install, and what they want first**

- **F1. The rider's maintenance "system" today is scattered. They want it in one place, without assembling it themselves.**
  - The opening post lists what the rider has open while servicing: "my manual, email, notes, a couple parts diagrams open from a website somewhere… Then when done, I have to put in my maintenance log. There has to be a better way." [SOURCE: https://www.advrider.com/f/threads/motorcycle-maintenance-app.1570843/ — "There has to be a better way" (ADVrider, thread 2022)]
  - The same rider later says: "Something like this it not having to manually assemble is kind of what I had in my head." [SOURCE: same thread, post #5]
  - Implication for us: a pre-filled schedule is the "aha", and riders do not want to type it in. [UNBACKED — own inference]
- **F2. The competition is the odometer and a notebook, not another app.**
  - "I use a piece of paper and a pencil… Date, mileage and what was done." [SOURCE: https://www.advrider.com/f/threads/motorcycle-maintenance-app.1570843/ — post #8 (ADVrider, 2022)]
  - "I use the odometer to track the service. When it reaches a 5,000 mile interval the bike get the required service… No need to overcomplicate it." [SOURCE: same thread, post #6]
  - On GTAMotorcycle, riders use a spreadsheet (oioioi, sburns, GreyGhost), "a note on my phone" (Matt Rain), or a paper notebook ("I'm old school", Morrissey). [SOURCE: https://www.gtamotorcycle.com/xf/goto/post?id=2655575 — "I just use a spreadsheet to log maintenance" (GTAMotorcycle forum, 2020-03-07)]
  - In r/motorcycles, someone answers a request for a maintenance app with: "An app? Fuckit and here I've just been using the odometer and service manual!" [SOURCE: https://www.reddit.com/r/motorcycles/comments/ekrsjh/any_good_motorcycle_maintenance_tracking_apps_out/ — via agent-reach search (Reddit, 2020-01-06)]
- **F3. Riders say apps are "over engineered". Entry has to be fast.**
  - "some apps are "over engineered" and not user friendly." [SOURCE: https://www.gtamotorcycle.com/xf/goto/post?id=2655575 — oioioi (GTAMotorcycle, 2020-03-07)]
  - Fuelly is praised as "Real easy to enter". [SOURCE: same thread — STARSHIP]
  - Fuelly reviewers complain when a login gets in the way "when I simply want to add a fuel-up and get back onto the road". [SOURCE: https://apps.apple.com/us/app/id295905460?see-all=reviews — J. Meyer, "Was 5 Stars - Now Login Issues" (App Store, Jan 2026; single retrieval, may not reproduce)]
  - A Drivvo reviewer asks for "faster data entry, easier to switch between cars, default service reminders". [SOURCE: https://apps.apple.com/ca/app/drivvo-vehicle-expense-log/id1206041425 — Snakedog116 (App Store CA, 2017-10-08; single retrieval, may not reproduce)]
- **F4. Riders forget to press Start, and they want hands-off tracking.**
  - "everything i saw was an app that requires you to hit start trip. I constantly forget to start the ride tracking apps." [SOURCE: https://www.reddit.com/r/motorcycles/comments/1b6v4vs/are_there_any_automatic_ride_trackers_apart_from/ — u/eltatertoto via agent-reach search (Reddit r/motorcycles, 2024-03-05); the Skeptic reproduced it]
  - On Indian's own app: "Mine automatically tracks like 75% of my rides". [SOURCE: https://www.reddit.com/r/IndianMotorcycle/comments/1w1y4u3/dumb_question_how_do_you_track_a_ride_in_ride/ — u/LEGENDARYstefan via agent-reach search (Reddit, 2026-08-29)]
  - Relevance: riders do not want to perform a ride for the app. A Start button that only works once you are moving does not fit someone sitting on the sofa at install time. [UNBACKED — own inference]

**Why riders drop an app**

- **F5. Riders complain that ride trackers record unreliably and drain the battery. Some say they switched apps because of it.** (Weakened in this revision; see R1.1.)
  - BMW Connected: "Will record 90% of the time but occasionally stop halfway through or not record at all despite checking that the phone is connected to the bike & the app is open before taking off." [SOURCE: https://www.reddit.com/r/bmwmotorrad/comments/1k2aqja/connected_app_intermittently_not_recording/ — u/AsteriodZulu via agent-reach search (Reddit r/bmwmotorrad, 2025-04-18)]
  - REVER battery, with a switch to another app: "I love REVER but lately if I use it it drains my battery waaay too fast even if my phone is plugged in. Been using ESR eat sleep ride instead." [SOURCE: https://www.reddit.com/r/motorcyclesroadtrip/comments/1i5syvy/how_do_you_track_your_motorcycle_trips/ — u/WhiskyEye via agent-reach search (Reddit, 2025-01-20)]
  - Kawasaki Rideology: "it stop recording my position after about 10 mins of my ride". A reply blames Android battery optimisation. [SOURCE: https://www.reddit.com/r/Ninja650/comments/sk8v29/rideology_app_uk_version_for_ninja_650/ — u/No_Novel_2107 (Reddit r/Ninja650, 2022-02-04)]
  - REVER App Store, second retrieval (2026-11-12): "the app crashed while in the background often and my ride data lost or incomplete" (sandifop, 2022-02-21). [SOURCE: https://apps.apple.com/us/app/rever-motorcycle-gps-rides/id975571447?see-all=reviews — single retrieval, may not reproduce]
  - **Withdrawn from evidence:** the REVER quotes in my draft (HandsomeWeb, Buyer1962, Seahawk1966, dmig77) appeared on one fetch only. They did not reproduce for the Skeptic or for my own second fetch. I no longer cite them.
  - Scope: this is a recurring complaint across several apps. It is not evidence that reliability is "the top reason" riders leave; I have no ranking. [UNBACKED — own reading]
- **F6. Upsells before value annoy riders, and they say so in public.**
  - "the upsells to the premium version are too frequent, I just want basic tracking." [SOURCE: https://www.reddit.com/r/motorcycles/comments/x1u61x/ride_tracking_phone_apps/ — u/mikerowest via agent-reach search (Reddit r/motorcycles, 2022-08-30)]
  - "And then they want you to get the premium version. Um, no." [SOURCE: https://apps.apple.com/ca/app/riser-motorcycles-and-routes/id1087005682 — "Has some major drawbacks." (App Store CA, 2021-07-12; single retrieval, may not reproduce)]
  - Moto Shed (a direct competitor) launches on the line "Every bike maintenance app I tried was full of ads, bad design, or pointless paywalls… no accounts or tracking." [SOURCE: https://www.reddit.com/r/motorcyclegear/comments/1o4o6rv/moto_shed_maintenance_tracker/ — u/mankini01 via agent-reach search (Reddit, 2025-10-12)]
  - A rider looking for a tracker asks for "Ideally something free to use. Not trying to pay a subscription". [SOURCE: https://www.reddit.com/r/MotoLA/comments/1rgagpe/app_or_website_to_track_maintenance/ — u/sisayapacaya via agent-reach search (Reddit r/MotoLA, 2026-02-27)]
  - A connected-bike app that started charging after the free period: "you have to pay about 100$/year for subscription, that will show you all data that you had for free previously.. it sucks." [SOURCE: https://www.reddit.com/r/SuperSoco/comments/1jnokd4/vmoto_stoped_recording_rides/ — u/karcaak via agent-reach search (Reddit, 2025-03-30)]
  - calimoto, paraphrase only: a paying user complains about subscription renewal and refund handling. [SOURCE: https://apps.apple.com/gb/app/calimoto-motorbike-gps-routes/id1209129603 — "Potential but Limited" (App Store UK, Aug 2026; single retrieval)]
  - This bears on our hour-0 onboarding purchases: 3 of 4 Play trials were cancelled, and those buyers never returned [SOURCE: evidence pack §6]. I do **not** propose touching the paywall (hard constraint). I only note that riders describe "paywall before I've used it" as a reason to leave.
- **F7. What makes a maintenance app sticky is the push reminder when something is due, and riders punish broken or irrelevant reminders.**
  - "I now I could just make a spreadsheet on my computer, but I like getting the push notifications when somethings due." [SOURCE: https://www.advrider.com/f/threads/best-maintenance-app.1257432/ — Monsignore (ADVrider, 2017-09-22)]
  - A Fuelly reviewer: "the notifications for service reminders do not work on the app". [SOURCE: https://apps.apple.com/us/app/id295905460?see-all=reviews — A.J. Mac, "Does not care that notifications are broken" (App Store, 2018-10-12; single retrieval, may not reproduce)]
  - One Drivvo reviewer keeps the app because "It reminds me when my insurance is due to expire". Another is irritated that it "still asks me about the tire pressure in my motorcycle". [SOURCE: https://apps.apple.com/ca/app/drivvo-vehicle-expense-log/id1206041425 — Med Mokran 2025-10-09; TofinoTime 2025-01-29 (single retrieval, may not reproduce)]
  - Implication: a reminder has to be about something the rider recognises (their bike, their next service), or it reads as nagging. [UNBACKED — own inference]
- **F8. Long-term riders stay for their history and fear losing it.**
  - "I've got so much history with Fuelly that it would be time-consuming to migrate elsewhere." [SOURCE: https://apps.apple.com/us/app/id295905460?see-all=reviews — tankerace (App Store, 2024-09-28; single retrieval, may not reproduce)]
  - On ADVrider: "I lost years of records on oil and fluid changes, valve adjustments… If you are using an app back up the data". [SOURCE: https://www.advrider.com/f/threads/motorcycle-maintenance-app.1570843/ — post #11 (ADVrider, 2022); reproduced by the Skeptic]
  - Relevance: the first entry starts the "history" moat, and logging *past* work on day 0 is how a rider gets there. [UNBACKED — own inference]
- **F9. Riders who keep a ride tracker do it for the record (total mileage).** (The REVER quote is withdrawn; see R1.1.)
  - "I like the program for tracking rides and tracking total km". [SOURCE: https://apps.apple.com/ca/app/riser-motorcycles-and-routes/id1087005682 — "Puppy" (App Store CA; single retrieval, may not reproduce)]
  - The BMW Connected rider above merges each day's legs "to produce 1 route for the day", and has done so "for the last 2 years". [SOURCE: https://www.reddit.com/r/bmwmotorrad/comments/1k2aqja/connected_app_intermittently_not_recording/ — u/ratscabs (Reddit, 2025-04-18)]
  - Kawasaki's Rideology draws the opposite verdict: "Install it once, try it and forget about it". [SOURCE: https://www.reddit.com/r/OnlyZ900/comments/1kljhus/rideology/ — u/Tricky-Leg-411 via agent-reach search (Reddit, 2025-05-13)]
  - Evidence is thin (one App Store quote and one Reddit post). Treat F9 as a lead, not a finding. [UNBACKED — own judgement]

**Repo and data cross-checks (these affect measurement)**

- **F10. The guard event already carries `elapsed_s` and `distance_m`.** It sends them on `ride_too_short_shown`. Since 3.21.0, rides of 120 s or more send `ride_zero_distance_shown` instead [SOURCE: apps/mobile/src/app/(modals)/ride-hud.tsx:55-67, 218-224 (origin/main)]. Older builds fire `ride_too_short_shown` in both cases, so any baseline that mixes builds must filter `elapsed_s < 120` (done in query P1 below). Only speed is missing from the pack's §9 gap.
- **F11. Schedule coverage (new; answers R1.4).** Cohort sign-ups 2026-08-14..11-04, first live bike, n = 336 [SOURCE: Supabase prod, query S1]:
  - matches a verified **model-level** schedule (exact make + model + year range, the same rule as `OemSchedulesService.queryModelRows`): **17 (5%)**
  - **make-generic** rows only: 210 (62%)
  - neither, so only the `GENERIC` fallback: 109 (32%)
  - For the 90 riders whose first goal is `maintain_bike`: model-level 2, make-generic 52, generic 36.
  - The make-generic intervals are known to be wrong for at least one model: the Honda baseline says oil every 6,000 km, the Africa Twin manual says 12,000 km or yearly [SOURCE: memory `project_oem_schedule_africa_twin`].
  - Most-common cohort bikes without model rows include "YAMAHA MT-07" (6) and blank-model Honda (14), Yamaha (10) and Suzuki (9) [SOURCE: Supabase prod, query S5]. The MT-07 gap matters because MT-07 maintenance posts are among the top web landing pages (pack §7).

---

## Proposals

### P05.1 "Testing it out?": turn the first standstill guard sheet into a next-ride promise

*Merged with P01.1, P02.2 and P03.2 as one board change (see Responses item 1). Round 2: the copy, chips, events and permission path below now follow the board's merged spec (01 P01.1, 02 P02.1/P02.2, 03 P03.1/P03.2, 06 R1) instead of my own variants. Where those members still differ, I name the difference and do not add a fifth variant.*

- **Hypothesis.** Most guard sheets on current builds are a rider testing the button while standing still (20 of 31 `shown` sheets, 16 riders, under 10 m and 30 s, on builds ≥ 3.21.0) [SOURCE: PostHog q-02a (revised), 02-onboarding-ux.md]. The test signals intent: this rider plans to ride later. If we acknowledge the test and offer one reminder at a time the rider picks, more of these riders save a real ride within 7 days. Basis: F4 (riders forget to press Start). [UNBACKED — own hypothesis]
- **Exact change.**
  1. **Trigger (agreed with 01 and 02):** the rider has **0 saved real rides**, the guard is the too-short branch (not `isNoGpsRide`), and `distance_m < 10`. It fires on every such sheet, not only the first. Riders who moved 10 m or more keep today's sheet, and so does the no-GPS branch. [SOURCE: 02-onboarding-ux.md P02.2 "Condition"; 01-activation-pm.md P01.1]
  2. **Ride HUD guard sheet** (`app/(modals)/ride-hud.tsx`, guard at :218). Copy follows 03's P03.2, chosen by whether a GPS fix arrived during this attempt (at least one location point with a non-null accuracy; the HUD already records it via `setGpsAccuracy`, ride-hud.tsx:150) [SOURCE: 03-behavioural-scientist.md P03.2 after its R1.10; 02-onboarding-ux.md Responses 1]:
     - **Fix arrived:** title **"Test ride: all good"**; body "GPS and recording work. Your real ride is saved once you've moved more than 50 m. Tap Start next time you're on the bike."
     - **No fix:** title **"Testing it out?"**; body "Your real ride is saved once you've moved more than 50 m. Go outside with a clear view of the sky, then tap Start when you're on the bike." It makes no claim that GPS works.
     - Numbers are interpolated from `MIN_RIDE_DISTANCE_M` / `MIN_RIDE_ELAPSED_S`, not hard-coded [SOURCE: 02-onboarding-ux.md P02.1; apps/mobile/src/utils/ride-constants.ts].
     - Buttons: primary **"Remind me before my next ride"** (ends without saving, as "End anyway" does today, then opens the shared plan chips) [SOURCE: 01-activation-pm.md P01.1]; secondary **"Keep recording"** (today's behaviour); plain **"Got it"** ends and discards [SOURCE: 03 P03.2]. My draft's "Done" label is dropped in favour of 03's "Got it".
  3. **Plan chips: the shared sheet, not my own.** "When's your next ride?" with 03's chips **"Today · Tomorrow · This weekend · Not sure yet"** and 03's default times (Today → +3 h capped at 19:00 local; Tomorrow → 10:00; This weekend → next Saturday 10:00; Not sure yet → no reminder) [SOURCE: 03-behavioural-scientist.md P03.1, times tagged UNBACKED there]. My "Tomorrow morning / This weekend / Pick a day" is withdrawn. 02 words the first chip "Later today" [SOURCE: 02-onboarding-ux.md P02.1]; that is a one-word copy choice for the owner, not a different design.
  4. **Notification permission: one in-context OS ask, no fallback card of my own.** If the OS permission is missing, ask once, at the chip tap. If the rider declines, the plan shows on the existing checklist card the next time the app opens, with no further ask [SOURCE: 03 P03.1 "Permission"; 02 P02.1; 02 F4 (Android guidance on asking in context)]. My draft's "Turn on notifications" screen and separate checklist fallback are withdrawn.
  5. **Local notification:** 03's text, title "Riding today?", body "Open MotoVault and tap Start when you're on the bike, so your first route gets saved." Deep link to `/start-ride`. One activation message per rider in days 0–7 under the board budget (04 Responses 2), cancelled by any core action.
  6. **Events: the single property set 06 asks for (06 R1).** On `ride_too_short_shown`: `variant:'teaching'|'default'`, `gps_fix` (boolean), `max_speed_kmh`, and `action:'remind_me'` added to the existing `shown`/`keep`/`end` values (`elapsed_s` and `distance_m` already exist, F10). Plan and reminder: 03's `next_ride_plan_set {when, source:'too_short', permission_granted}` and `reminder_scheduled {kind:'activation_next_ride', fire_at}`, then the existing `reminder_opened {kind:'activation_next_ride'}` [SOURCE: 03 P03.1 Events; 01 Responses "one picker, one notification kind"]. I withdraw my `variant:'first_test'` and `activation_reminder_scheduled`. 04 still names its own day-1 nudge events `activation_nudge_*` with one `activation` kind [SOURCE: 04-lifecycle-crm.md P04.1 step 8]; the owner should pick one kind name in the P06.1 ledger before launch, and I take whichever is chosen.
- **Target metric (rewritten for R2.3: a harm check plus a mechanism chain, not a lift claim).**
  - **Ledger baseline, one rider pool, three cuts.** The board's three figures are the same riders cut three ways, and I re-ran them together to show that [SOURCE: PostHog query P2 below]:
    - all builds, whole window: **11 of 49** saved a real ride within 7 days of the trigger sheet (01's ledger primary);
    - builds ≥ 3.21.0, full 7 days observable: **1 of 13** (02); the same restricted to day-0 triggers: **1 of 10** (06).
    - My earlier 11/46 was the all-builds figure with an extra `elapsed_s < 120` filter, and my 1/14 included one rider whose week was not yet over. Both are withdrawn.
  - **The comparable before-window is ≥ 3.21.0 only: 1 of 13.** The sheet being changed exists only on those builds (06 R1.1), and the post-launch riders will all be on newer builds in Nov–Jan. 11/49 stays in the ledger as context. **I make no lift claim this winter** (06 P06.3).
  - **Mechanism chain (the main read):** teaching sheets shown → `action:'remind_me'` → `next_ride_plan_set` → `reminder_opened` → real ride saved within 7 days, reported as counts (for example "9 shown, 4 remind-me, 2 opened, 1 saved"). None of these can happen today, so they are new events with no baseline.
  - **Harm check (pre-registered in the P06.1 ledger):** (a) no sheet with `distance_m ≥ 10` or with a saved ride before it may carry `variant:'teaching'` (checked weekly from the event properties; a rider who really rode must never be told "test ride"), and (b) permission revocations after the in-context ask use 01/04's `notification_permission_status` rule [SOURCE: 01-activation-pm.md P01.2 kill rule; 04 P04.1]. Secondary context only: day-2 return of day-0 eligible riders, 12 of 40 all builds [SOURCE: PostHog query P1].
- **Expected effect.** Not sourced, and I don't promise a size. [UNBACKED — own idea]
- **Effort.** S–M. It reuses the guard sheet, the local-notification scheduler and the `reminder_opened` routing. New work is two copy variants, the `gps_fix` check and 7 locales.
- **Risk to the onboarding paywall.** None. The change is post-onboarding, in the ride HUD, and both onboarding arms are untouched. Local scheduling does not depend on the missing Android FCM token (pack §8b), but date-scheduled delivery on Android is unproven (04 R1.8), so 04's device check runs before launch.
- **How to measure at ~7 installs/day.**
  - Volume: 14 eligible riders on ≥ 3.21.0 in about 5 weeks, under 3 a week [SOURCE: PostHog query P2]. A split test is out.
  - Ship to everyone on 06's P06.3 no-harm path, with the ledger entry above written before launch.
  - Read the mechanism chain weekly; treat any cumulative "saved within 7 days" share as anecdote below 40 post-launch eligible riders (06's threshold), which is more than a season at winter volume.
  - Qualitative: 3–5 session replays of the new sheet, if mobile replay is on (03, 01).
- **Light/dark.** The HUD always renders in `editorialThemes.dark` (03's note), so the sheet has one palette; check both titles for contrast on `HUD_THEME.surface`. The chips sheet and checklist card use `@motovault/design-system` / `useEditorialTheme` tokens. Check both system themes in the simulator to catch theme leakage.

### P05.2 "Your bike's service plan": never show "No service due" for a bike with no schedule; get it a dated next item on day 0

*Rewritten for R1.3, R1.4 and R1.7. Same id, narrower change: it now fixes the existing plate instead of adding a new card. Round 2: new primary metric the sheet cannot write (R2.4), and it ships only after the schedule-import fix (R2.5).*

- **Hypothesis.** Maintenance riders install to get their model's schedule without typing it in (F1; 62% of web clicks, pack §7). They stay if the app tells them when something is due (F7). Home already leads with a plate that shows the next due service, but only when the bike has tasks (Diagnosis 2). Since October, 27 of 34 day-0 bikes of maintain_bike riders have no tasks, so their plate says "No service due". If such a bike gets a schedule in one or two taps, plus one "when did you last…?" question, the rider leaves day 0 with a dated item and a reminder. [UNBACKED — own hypothesis]
- **What most riders will see (answers R1.4).** For maintain_bike riders, 2 of 90 bikes have a model-level schedule, 52 make-generic and 36 generic only (F11). So the design must work with a **make-level or generic** schedule, and must say so honestly.
- **Exact change.**
  1. **Plate empty state** (`components/home/home-plate.ts:96-103`). When the active bike has **no maintenance tasks**, replace "Ready / No service due" with a new plate state "**Set up service plan**". Caption: "No schedule yet for your {{make}}". Tap opens a one-screen sheet. Riders whose bikes have tasks see no change.
  2. **The sheet**, in two steps, each skippable:
     - **(a) Model, only if blank** (make-only bikes, F11): "Which {{make}}?", using the existing model picker. Skippable.
     - **(b) Import.** Call the existing `importOemSchedule` mutation [SOURCE: apps/api/src/modules/oem-schedules/oem-schedules.resolver.ts:79-80] with the best tier available. Label the result by tier:
       - model-level: "{{model}} factory schedule"
       - make-level: "Typical {{make}} intervals. Edit any of them to match your manual."
       - generic: "Common motorcycle intervals. Edit to match your manual."
       The labels matter because make-level intervals can be wrong for a given model (F11, the Honda example).
     - Then one question with chips: "Last oil change: [odometer] [date] [Not sure]". An answer writes a past-work completion (the log-past-work path from PR #164, memory `project_units_task_logging_pr164`). The plate then shows the next due item: "Got it. Next oil change at {{km}} / {{date}}."
  3. **No new onboarding step.** It reuses Home's existing plate and sheet patterns.
  4. **Events:** `post_onboarding_landed {screen, goal}` (pack §9 gap), `service_plan_prompt_shown {tier_available:'model'|'make'|'generic', make_only:boolean}`, `service_plan_imported {tier, source:'onboarding'|'plate_sheet'|'garage'}`, `maintenance_last_done_answered {answer:'odo'|'date'|'unknown', tier}`. **Every `maintenance_task_completed` gains `source:'plate_sheet'|'task_screen'|'other'`**, so completions the sheet writes are counted apart from completions the rider logs later (R2.4).
  5. **Sequenced before this change (R2.5): fix the October schedule-import drop first.** Find out why day-0 schedule import fell from 65% to 35% (Diagnosis 2), fix it, and seed model rows for the cohort's most common uncovered models, starting with the MT-07 (F11). This is a data and bug task, not a UI experiment. It ships first, alone, and its effect is read on the share of day-0 bikes with tasks over the next 4 weeks. P05.2's plate change ships only after that, so the two never sit in the same before/after window (06 P06.3: one change in flight). The plate state then catches only the bikes the fix still misses (blank model, no model row). [UNBACKED — own prioritisation and sequencing]
- **Target metric (rewritten for R1.3, then for R2.4: the primary is an outcome the sheet cannot write).**
  - **Primary (a later-day return, measured by app opens, not by anything the sheet records):** the share of `maintain_bike` riders who open the app on **any day from day 3 to day 30** after first seen. Baseline **12 of 92 (13%)**, maintain_bike riders first seen 08-14..10-12 so that the full 30 days is observable; all other goals 69 of 545 [SOURCE: PostHog query M2 below]. Day 3 onward is chosen so that day-0 setup and the day-1 nudge (P04.1) cannot count; it is meant to catch a rider coming back for the bike, as F2 and F7 describe. [UNBACKED — own window choice]
  - **Mechanism counts (attributed by event, never by before/after):** `service_plan_prompt_shown` → `service_plan_imported {source:'plate_sheet'}` → `maintenance_last_done_answered` → `maintenance_task_completed {source:'plate_sheet'}`. These are reported separately and are **not** the outcome: the sheet writes them by construction (the `feedback_metric_measures_something_else` trap the Skeptic named).
  - **Delayed outcome (secondary):** `reminder_opened {kind:'maintenance'}` within 60 days, and `maintenance_task_completed` with `source` other than `plate_sheet` on days 1–60. Baselines: **0 of 112** and **1 of 112** maintain_bike riders [SOURCE: PostHog query M2]. Both are near zero today, so any count above 1–2 is worth reading, but only as a count.
  - **Context, not a P05.2 read:** "first bike has a schedule by end of day 0" (Oct–Nov baseline 7 of 34 maintain_bike, 45 of 127 all goals [SOURCE: Supabase prod, query S3]) belongs to the import fix in step 5, not to this change. Earlier figures for reference: day-0 completions 0/112 in PostHog, 4 of 98 in the DB [SOURCE: PostHog query M1; Supabase prod, query S6]; maintain_bike D7 8/104 [SOURCE: evidence pack §4].
  - I expect **day-2 return for this group to barely move**: maintenance riders don't need us on day 2 (Diagnosis 2). [UNBACKED — own inference]
- **Expected effect.** Not sourced. The forum evidence supports the *mechanism*: push-when-due is why riders prefer an app over a spreadsheet (F7). It does not support a size. [UNBACKED]
- **Effort.** M. Import and log-past-work exist. New work: the plate state, the two-step sheet, tier labels and 7 locales. The schedule-drop investigation is separate and unsized.
- **Risk to the onboarding paywall.** None: this is post-onboarding, on Home. Coordinate with the `garage_first` arm, and do not prompt a second bike add (pack §1: 34% re-add their bike).
- **How to measure at ~7 installs/day.**
  - About 1.3 maintain_bike riders arrive per day, and the primary needs 30 days per rider, so a read takes months. Log it in P06's ledger with the 12/92 baseline before launch, as a no-harm check: winter will push opens down, so a flat or slightly lower day-3–30 share is not evidence against the change, and no lift is claimed this season (06 P06.3).
  - The real read is **delayed**. Count, as a running total, whether dated items set on day 0 lead to `reminder_opened {kind:'maintenance'}` and a non-sheet logged service when due, often weeks later. Maintenance reminders are date-scheduled local notifications, whose Android delivery is unproven (04 R1.8), and server push reaches iOS only until Android FCM ships (pack §8b), so this read depends on P04.2 and 04's device check.
  - Qualitative: the "Not sure" answer share shows how many riders know their own service history. No email (see P05.3).
- **Light/dark.** The new plate state uses the existing plate component and theme tokens. Check it in both modes, and check the due-state colours (overdue, soon, ok) for contrast, especially amber on the dark surface.

### P05.3 Hear it from the riders: an in-app "why did you install?" question, plus replies to riders who already sent feedback

*Rewritten for R1.5. It adopts 04's alternative. Round 2: no free text in PostHog (R2.7).*

- **Hypothesis.** At 50 installs a week, numbers take months. A direct question tells us faster whether the reasons are the ones forums give: not on the bike now (F4), over-engineered (F3), upsell before value (F6), or "I only need it when something is due" (F7). [UNBACKED — own idea]
- **Exact change.**
  - **(i) In-app, everyone:** on the **second app open**, Home shows one dismissible card using theme tokens: "What did you want MotoVault to do when you installed it?" The answers are (a) track my rides, but I wasn't riding yet, (b) my bike's service schedule, (c) costs, (d) something else. Only the category goes to PostHog: `install_reason_answered {answer:'rides_not_riding'|'service_schedule'|'costs'|'other'}`, so it follows the existing analytics consent and needs no contact consent [SOURCE: 04-lifecycle-crm.md Responses item 3 (ii)]. **No free text is sent to analytics (R2.7).** "Something else" opens the existing in-app feedback form, whose message is stored in `public.feedback_messages` under the rider's account, insert-only for riders, removed on account deletion, and included in the GDPR export [SOURCE: supabase/migrations/00190_feedback_messages.sql:1-29 (origin/main); apps/mobile/src/app/(tabs)/(profile)/feedback.tsx]. The form already carries its own contact opt-in, so no new table or migration is needed. Its `feedback_sent` event sends only `quick_pick` and `contact_opt_in`, not the message [SOURCE: apps/mobile/src/features/feedback/feedback-screen.tsx:100-103 (origin/main)].
  - **(ii) Email, only riders who sent feedback:** the owner replies about that feedback and may add the same question. The only stored contact consent is `feedbackContact`, labelled "The developer may contact me about my feedback". 22 of 445 cohort sign-ups set it [SOURCE: 04-lifecycle-crm.md Responses item 3; apps/mobile/src/app/(onboarding)/notifications.tsx:224-231 (origin/main)]. **No email goes to anyone else.**
  - Repeat the reading about 6 weeks after P05.1 and P05.2 ship.
- **Limit.** The card reaches only riders who open the app a second time, so it misses the riders who never return, the very group we most want to hear from. Their voice stays the forum evidence above. [UNBACKED — own reading]
- **Target metric.** The answer distribution (PostHog) and the "something else" messages (feedback form, read by the owner). It moves no headline metric directly; it validates or kills the hypotheses behind P05.1 and P05.2.
- **Expected effect.** No reply-rate claim. [UNBACKED]
- **Effort.** S. One card, one event, a link to the existing feedback form, 7 locales.
- **Risk to the onboarding paywall.** None.
- **How to measure.** With 167 riders ever returning in 12 weeks (pack §2), expect tens of answers, not hundreds. Read the feedback-form messages, and pair each answer with the rider's `primary_goal` and first screens (q03) to see where the stated reason and the actual behaviour diverge. [SOURCE: evidence pack §2 for the 167]
- **Light/dark.** The card uses theme tokens. Check it in both modes.

---

## What I'd NOT do, and why

- **Don't add an upsell or Pro teaser on the first post-onboarding screen, in the service-plan sheet or in the activation reminder.** Riders publicly name "upsells too frequent" and "they want you to get the premium version. Um, no." as reasons to switch (F6). In our data, in-app paywalls sold nothing, and onboarding buyers who never activated didn't return [SOURCE: evidence pack §6]. The onboarding paywall itself stays, per the hard constraint.
- **Don't chase auto-start ride detection as the activation fix.** Riders want it (F4), but riders also complain about trackers that stop recording or drain the battery (F5). A flaky auto-detect would add to that. Revisit after P05.1 shows whether warm riders come back at all. [UNBACKED — own judgement]
- **Don't judge maintenance riders by day-2 return.** Riders use a service log at odometer intervals (F2, F7). Chasing that number with daily nags invites the "still asks me about the tire pressure" reaction (F7).
- **Don't state "service due" with factory confidence from a make-generic row.** 95% of cohort bikes have no model-level schedule (F11), and at least one make baseline is known to be off by 2× (Honda). Label the tier, and ask "when did you last…?" before asserting anything.
- **Don't add more onboarding steps to ask what the rider already told us.** Riders reject "over engineered" setup (F3). The maintenance step was retired after "2 of 150" completed it [SOURCE: apps/mobile/src/config/onboarding.ts:147]. Any onboarding change must cover the whole flow and both paywall arms. All three proposals act *after* onboarding.
- **Don't lean on AI diagnostics as the first-session hook.** It is out of scope as hero (house rule), and the 10 riders whose path went through it had 0 day-2 returns [SOURCE: evidence pack §5]. Nothing in the rider threads asks for it in the first five minutes.
- **Don't send a generic "We miss you" day-1 push.** Riders praise reminders tied to a real, dated need (insurance expiry, service due) (F7). Every message in P05.1 and P05.2 is tied to something the rider chose. [UNBACKED — own inference from F7]
- **Don't email riders who never agreed to contact.** See P05.3 and 04's F10.

---

## Responses

Written 2026-11-12 after reading drafts 01, 02, 03, 04 and 06, and updated in this revision where round 1 showed them wrong.

**1. On P01.1, P02.2, P03.2 and my P05.1: combine them into one guard-sheet change.** (Updated again in round 2.)
- Four of six board members propose the same thing: reframe the standstill "ride too short" sheet as a successful test, and offer a next-ride reminder. Ship it once. [UNBACKED — own synthesis]
  - Copy: 03's two titles chosen by `gps_fix` — "Test ride: all good" only when a fix arrived, "Testing it out?" otherwise (P03.2 after its R1.10; 02 Responses 1).
  - Picker: 03's shared "When's your next ride?" chips (Today · Tomorrow · This weekend · Not sure yet). My own chip set is withdrawn.
  - Permission: 02/03's single in-context OS ask at the chip tap.
  - Events: 06 R1's single property set on `ride_too_short_shown`, plus 03's `next_ride_plan_set` / `reminder_scheduled`. The notification kind name (`activation_next_ride` in 01/03, `activation` in 04) is the one open naming choice; the owner fixes it in the ledger.
  - Trigger: P02.2's (0 saved rides, too-short branch, under 10 m).
- **Baseline:** one rider pool, cut three ways — 11/49 all builds (01), 1/13 on ≥ 3.21.0 with a full week observable (02), 1/10 of those on day 0 (06) [SOURCE: PostHog query P2]. The comparable before-window is ≥ 3.21.0 only, so the read is a harm check plus the mechanism chain, not a lift.

**2. On P04.1: send `maintain_bike` riders their next service, not the expense nudge.** (Unchanged in substance. Data added.)
- P04.1's non-ride copy asks maintenance riders about costs. They came for a schedule (F1), they value push-when-due (F7), and they did 0 week-1 expenses [SOURCE: evidence pack §4].
- **Proposed change to P04.1:** keep its mechanics (one local message, cancelled by any core action, no Pro wording). For `maintain_bike`, the copy becomes: "Next up for your {{bikeModel}}: {{task}}. When did you last do it?"
- **New constraint from F11:** since October, 27 of 34 day-0 maintain_bike bikes have no task to name. For those riders the message should be "Set up your {{make}}'s service plan: 2 taps", opening P05.2's sheet. Fall back to the expense copy only if neither applies. [UNBACKED — own synthesis]

**3. On P04.2 and P06.2: FCM first, and a delayed read for the maintenance branch.** (Corrected for R1.6.)
- **Agreement with P04.2.** The due-reminder push is what forum riders say makes an app beat paper (F7), and it reaches no Android rider today (0 of 119 Android grants stored a token) [SOURCE: evidence pack §4, via P04.2]. Riders punish broken reminders (F7). So I rank P04.2 ahead of any server-sent activation message, as 04 does. [UNBACKED — own ranking]
- **On the metric: I withdraw "`activation_24h` is a sound primary for the ride-side change."**
  - 01, 02 and 03 showed it scores a planned weekend ride as a failure, and my own data agrees: of the 11 eligible riders who saved a real ride within 7 days, 2 did so after 24 h (P1).
  - For the ride-side change I adopt the **7-day saved-ride primary** (P05.1). This winter it is read as a harm check plus the mechanism chain, not as a lift (R2.3).
  - For P06.2's randomized slot, if it contains the maintain_bike branch, pre-register a delayed read in the P06.1 ledger: "dated item set on day 0", then "`reminder_opened{kind:'maintenance'}` within 60 days". [UNBACKED — own design]

---

## Answers to review

**R1.1 — fixed.**
- I fetched the REVER page again (2026-11-12). It showed a different set of reviews: sandifop, BubaDragon and kenth1957, from 2019–2024. None of my draft's REVER quotes appeared.
- So I **withdrew** the HandsomeWeb, Buyer1962, Seahawk1966 and dmig77 quotes from F5 and F9.
- I rebuilt F5 on Reddit posts that have stable URLs and dates (BMW Connected, REVER battery, Rideology), plus one App Store quote labelled "single retrieval, may not reproduce".
- F5's headline is now weaker: a recurring complaint with no ranking, not "faster than anything else".
- F9 is marked thin. Every App Store quote in the file now carries the "single retrieval" label.
- I did not attach archives or screenshots: my brief allows me to write only this file.

**R1.2 — fixed.**
- I adopted 02's trigger, which 01 endorsed: 0 saved real rides, `distance_m < 10`, `elapsed_s < 120`, on any day, on every such sheet.
- I re-cut one baseline with the q00 exclusions (query P1). The `elapsed_s < 120` filter removes the pre-3.21.0 no-GPS sheets the review flagged (54146980), so every build can be pooled.
- Result: **11 of 46 saved a real ride within 7 days** (10 of the 40 day-0 riders). *(Superseded in round 2 by the reconciled 11/49 · 1/13 · 1/10; see R2.3.)*
- I also report the post-3.21.0 volume on its own: 14 eligible riders in about 5 weeks, 1 saved. The P05.1 body now uses only these figures; 34/103 and 13/56 are gone.
- 06's 6/44 measures a different outcome (no save later the same day), so it is not a competing baseline.

**R1.3 — fixed.**
- I re-ran q02's logic by goal for `maintenance_task_completed` and `_created` (query M1). For maintain_bike: day-0 completions **0/112**, week-1 completions 0/112, week-1 creations 4/112.
- The DB, which also counts riders who declined analytics, shows 4 of 98 primary-goal maintain_bike sign-ups marking a task done on day 0 (query S6).
- "Baseline 0 by construction" now applies only to the new events, not to the primary metric.
- The self-contradictory sentence is removed, and the pack figures are quoted correctly (week-1 ride 1, expense 0).

**R1.4 — fixed, and it changed the proposal.**
- Coverage query S1: model-level **17/336 (5%)**, make-generic 210, generic only 109. For maintain_bike: 2 / 52 / 36 of 90.
- I also found that **since October most new bikes have no schedule tasks at all**: 45 of 127 day-0 bikes had them, against 105 of 161 before, and 4 of 77 make-only bikes do (S2, S3). On Home, a bike with no tasks reads "No service due".
- P05.2 now targets exactly that state. It labels the tier honestly: model / "typical {{make}}" / common intervals. It asks for the model on make-only bikes, and never asks the rider to type a schedule. Typing stays a per-item edit.
- The schedule drop is flagged as a separate bug or data task. Its cause is unverified.

**R1.5 — fixed.** P05.3 now follows 04's alternative: an in-app card on the second open for everyone, and email only as a reply to riders who sent feedback (`feedbackContact`, 22 of 445). It sends no email to anyone else.

**R1.6 — fixed.** I withdrew the claim that `activation_24h` is "a sound primary". P05.1's primary is now "saved a real ride within 7 days" (11/46), with 24 h as a secondary (9/46). This matches 01, 02 and 03 and my own data: 2 of the 11 saves came after 24 h. *(Round 2: the baseline is now 11/49 with 1/13 on ≥ 3.21.0; see R2.3.)*

**R1.7 — fixed.**
- Diagnosis 1 now describes the real screen (origin/main 5a497a1c): a hero bike plate showing maintenance status, then the Ride / Expense / Task / Diagnose row, the receipt-scan row, the checklist and "Up next" [SOURCE: apps/mobile/src/app/(tabs)/(home)/index.tsx:125-166, 369-410].
- P05.2 no longer replaces part of Home. It changes only the plate's empty state ("No service due" when the bike has no tasks) [SOURCE: apps/mobile/src/components/home/home-plate.ts:96-103].
- I also removed the "ride-first home" framing from the closing paragraph of the Diagnosis.

**Round 2 answers (2026-11-12)**

**R2.1 — fixed.** Diagnosis 1 and the P05.1 hypothesis no longer cite "125 of 221 sheets". Both now use 02's revised q-02a on builds ≥ 3.21.0, `shown` rows only: 20 of 31 sheets (16 riders) at under 10 m and 30 s, and 27 "End anyway" to 1 "Keep riding" [SOURCE: 02-onboarding-ux.md Diagnosis 3, q-02a revised]. Diagnosis 1 also says why 221 was wrong (event rows across mixed builds, not sheets).

**R2.2 — fixed.** P05.1 now has both titles, chosen by whether a GPS fix arrived: "Test ride: all good" with a fix, "Testing it out?" without, with 03's bodies, and `gps_fix` (boolean) on `ride_too_short_shown` [SOURCE: 03-behavioural-scientist.md P03.2; 02-onboarding-ux.md P02.2]. The fix test is the HUD's existing accuracy reading (ride-hud.tsx:150).

**R2.3 — fixed.**
- I re-ran the three baselines together (query P2). They are one rider pool cut three ways: **11/49** all builds (01), **1/13** on ≥ 3.21.0 with a full 7 days observable (02), **1/10** of those triggered on day 0 (06). Exactly one ≥ 3.21.0 rider saved a ride.
- My 11/46 was all builds with an extra `elapsed_s < 120` filter (32 + 14 riders), and my 1/14 included one rider whose week had not ended. Both are withdrawn.
- P05.1's read is now a pre-registered harm check plus the mechanism chain (shown → remind_me → plan set → `reminder_opened` → saved ride), against the ≥ 3.21.0 before-window of 1/13. The sentence "call it a win only if the 7-day saved share clearly beats 24%" is removed, and no lift is claimed this winter (06 P06.3).

**R2.4 — fixed.**
- The new primary is an outcome the sheet cannot write: **`maintain_bike` riders who open the app on any day from day 3 to day 30**, baseline **12/92 (13%)** for riders with a full 30 days observable [SOURCE: PostHog query M2].
- Completions the sheet writes carry `source:'plate_sheet'` on `maintenance_task_completed` and are reported only as mechanism counts.
- Delayed secondaries: `reminder_opened {kind:'maintenance'}` within 60 days (**0/112**) and non-sheet completions on days 1–60 (**1/112**) [SOURCE: PostHog query M2].
- One limit: a later return can also be moved by any other change that brings riders back (P04.1, P05.1). That is why it is logged in the single P06.1 ledger and read only as no-harm this winter.

**R2.5 — fixed by sequencing.**
- The schedule-import fix (P05.2 step 5) ships first, alone, and is read on "day-0 bikes with tasks" over 4 weeks.
- The plate change follows afterwards, so the two are never in the same before/after window.
- "First bike has a schedule by end of day 0" moves out of P05.2's metrics into the import fix's read. P05.2 attributes its own imports only by `service_plan_imported {source:'plate_sheet'}` events, never by that before/after.

**R2.6 — fixed.** P05.1 now uses the merged spec:
- **chips:** 03's "Today · Tomorrow · This weekend · Not sure yet", with 03's default times;
- **events:** 06 R1's property set (`variant`, `gps_fix`, `max_speed_kmh`, `action:'remind_me'`) and 03's `next_ride_plan_set` / `reminder_scheduled {kind:'activation_next_ride'}` / `reminder_opened`;
- **permission:** one in-context OS ask at the chip tap. If the rider declines, the plan stays on the checklist card and there is no further ask.

My `variant:'first_test'`, `activation_reminder_scheduled`, "Pick a day" chip and "Turn on notifications" fallback are withdrawn. Two differences between other members remain, and I do not add a variant of my own:
- 02's "Later today" vs 03's "Today" (a copy choice);
- 01/03's `activation_next_ride` kind vs 04's single `activation` kind.

The owner fixes both in the P06.1 ledger before launch.

**R2.7 — fixed.**
- `install_reason_answered` now sends only a category (`rides_not_riding` / `service_schedule` / `costs` / `other`). No free text goes to PostHog.
- "Something else" opens the existing feedback form. That form stores the message in `public.feedback_messages` under the rider's account: insert-only for riders, deleted with the account, and included in the GDPR export [SOURCE: supabase/migrations/00190_feedback_messages.sql:1-29].
- The form's analytics event sends only `quick_pick` and `contact_opt_in` [SOURCE: apps/mobile/src/features/feedback/feedback-screen.tsx:100-103]. No migration is needed.

**Queries run for this revision (read-only, 2026-11-12)**

```sql
-- P1 (PostHog 155556, HogQL): agreed guard trigger -> real saved ride.
-- Cohort c and q00 exclusions exactly as q05/q02.
-- ev: ride_too_short_shown / ride_completed / app-open events, 08-14..11-13.
-- r: t_real = first ride_completed with below_min_ride not true;
--    t_trig = first ride_too_short_shown with distance_m < 10 AND elapsed_s < 120;
--    adays  = active days.
-- eligible = t_trig set AND (no real ride, or first real ride after t_trig)
-- result:
--   trigger on day 0: eligible 40 | saved 24h 8 | saved 7d 10 | saved ever 10 | day-2 return 12
--   trigger later:    eligible 6  | saved 24h 1 | saved 7d 1  | saved ever 1
-- P1-ver: the same, restricted to $app_version >= 3.21.0 -> eligible 14, day-0 10, saved 7d 1, saved 24h 0.
-- Sheets by version: 3.18.0-3.20.0 196 sheets; 3.21.0+ 59 sheets; elapsed_s is present on every sheet.

-- M1 (PostHog): maintenance logging by onboarding goal, q02 base (argMax primary_goal from onboarding_step_completed step=goals).
-- result, goal | n | completed d0 | completed w1 | created w1:
--   maintain_bike 112 | 0 | 0 | 4;  track_rides 262 | 4 | 4 | 12;
--   manage_expenses 62 | 3 | 3 | 0; just_exploring 81 | 1 | 1 | 1

-- Supabase prod (Management API, SELECT only). u = q08's sign-up cohort and exclusions; b = each rider's first live bike.
-- S1: tiers, using the service's rule (is_verified, make = upper(b.make), model = b.model, year in range):
--     336 bikes: model 17 | make-generic only 210 | generic only 109.
--     By ridingGoals->>0: maintain_bike 90 = 2 | 52 | 36; track_rides 143 = 8 | 86 | 49.
-- S2: Oct 1-Nov 4 bikes, blank model: 77, of which 4 have any live task (first seen 2026-10-15; includes the 00191 backfill).
-- S3: bikes created within 1 day of sign-up:
--     Aug14-Sep30 161, 105 with tasks (maintain_bike 40, 26 with tasks);
--     Oct1-Nov4   127, 45 with tasks, 35 blank-model (maintain_bike 34, 7 with tasks).
-- S4: source of first task: Aug-Sep oem 105 (104 within 1 min of the bike); Oct+ oem 35 (27 within 1 min), user 11.
-- S5: top make/model in cohort: HONDA '' 14, YAMAHA '' 10, SUZUKI '' 9, YAMAHA MT-07 6 (no model rows), BMW '' 5 ...
-- S6: by ridingGoals->>0, maintenance completed_at within 1 day of sign-up: maintain_bike 4/98, track_rides 8/159, manage_expenses 5/45.
-- P2 (PostHog, round 2): reconcile the three P05.1 baselines. Trigger = first ride_too_short_shown with distance_m < 10;
--   eligible = no real ride before it; build = $app_version of that sheet; obs = trigger before 2026-11-05; d0 = trigger on first-seen day.
--   build      | eligible | saved 7d | eligible obs | saved 7d obs | elapsed<120 elig/saved | day-0 elig/saved | day-0 obs elig/saved
--   < 3.21.0   | 35       | 10       | 35           | 10           | 32 / 10                | 32 / 9           | 32 / 9
--   >= 3.21.0  | 14       | 1        | 13           | 1            | 14 / 1                 | 10 / 1           | 10 / 1
--   => 11/49 (01), 1/13 (02), 1/10 (06); my withdrawn 11/46 = the elapsed<120 column.

-- M2 (PostHog, round 2): q02 base, goal = argMax primary_goal; obs30 = first seen before 2026-10-13.
--   goal          | obs30 | n   | opened app day 3-30 | reminder_opened{kind:maintenance} <= day 60 | maintenance_task_completed day 1-60
--   maintain_bike | yes   | 92  | 12                  | 0                                            | 1
--   maintain_bike | no    | 20  | 0                   | 0                                            | 0
--   other goals   | yes   | 545 | 69                  | 0                                            | 6
--   other goals   | no    | 136 | 20                  | 0                                            | 0
```
