# 03 Behavioural scientist

Research board for #365, "Activation: first session and first core action". First draft 2026-11-12, revised the same day
after the Skeptic's rounds 1 and 2 (see "Answers to review" at the end). Round 2 aligned P03.1 and P03.2 with the board's
merged spec: P03.1 now uses 02's card eligibility and the P06.1 ledger primary, P03.2 uses the merged too-short trigger, and
both wait for the nudge test unless the ledger records a bundle.
Lens: habit formation (Fogg's B=MAP and Tiny Habits, Eyal's Hooked, Wood's habit research, implementation
intentions, temporal landmarks), prompts for a weekly and seasonal activity, and dark-pattern risk.
I wrote no code and made no external writes. For the revision I ran **one** read-only PostHog query on the pack's cohort
(same 793 installs and the same test-account exclusions as q02). Its numbers are tagged `[SOURCE: PostHog q03-rev-eligible]`,
and its definition is in the appendix at the end of this file. Every other number comes from the evidence pack, another
board file, or a source I opened.

## Diagnosis

**1. On install day the rider has a reason to act and a prompt, but can't do the core action.** Fogg's model
says a behaviour happens only when motivation, ability and a prompt are present at the same moment, and "when a
behavior does not occur, at least one of those three elements is missing" [SOURCE: https://behaviormodel.org/ —
"three elements must converge at the same moment for a behavior to occur: Motivation, Ability, and a Prompt" (BJ Fogg,
undated)]. The core behaviour that predicts return is recording a ride (ride-first riders: 83% back on day 2)
[SOURCE: evidence pack §3]. Ability for that behaviour means sitting on the bike. Install day happens at home: 66 of
103 new riders who tapped Start got "ride too short", which fits riders testing the button at home [SOURCE: evidence
pack §3]. The app shows Start ride first, at the one moment the rider can't ride [SOURCE: evidence pack §5].

**2. The prompt disappears before the rider can ride.** Activation happens on day 0 or not at all: 40 of 61 week-1
first core actions came within the first hour and only 5 came after day 1 [SOURCE: evidence pack §3]. No message of any
kind goes out between day 0 and day 7 [SOURCE: evidence pack §1;
apps/mobile/src/lib/notifications.ts:9-27 lists only document, maintenance, receiptScan, ride_idle and trial_reminder
kinds]. Riding is concentrated in a short weekly window. US crash data shows it: 46% of motorcyclist deaths in 2022
happened in the 2.5-day weekend window [SOURCE:
https://crashstats.nhtsa.dot.gov/Api/Public/ViewPublication/813589 — "49 percent of motorcyclists were killed in traffic
crashes during the weekend in 2021 versus 46 percent in 2022"; weekend = "Friday 6 p.m. to Monday 5:59 a.m. (2.5 days)"
(NHTSA, Traffic Safety Facts 2022, July 2024)]. Deaths stand in for riding exposure here; they are not a count of
rides. So for most riders, the next real chance to ride comes days after install, when nothing in the app prompts them.
The pattern "day 0 or never" is better explained by a missing prompt than by lost interest [UNBACKED — own
inference from the pack; it fits §3 but the data can't separate the two].

**3. Day-2 return is the wrong unit for a weekly activity, but it is still a useful alarm.** A Tuesday installer who
rides on Saturday has no reason to open the app on Wednesday. The 9.1% day-2 return [SOURCE: evidence pack §2]
partly measures the calendar. General app benchmarks don't transfer: the average Android app keeps about 29% of users on
day 1 [SOURCE: https://andrewchen.com/new-data-shows-why-losing-80-of-your-mobile-users-is-normal-and-that-the-best-apps-do-much-better/
— day-1 retention 29.17%, "loses 77% of its DAUs within the first 3 days" (Andrew Chen / Quettra, ~June 2015)]. That figure
pools all categories, most of them used daily, and is ten years old. It is not a target for a seasonal utility app
used on weekends. I'd keep day-2 return as issue #365 requires, and add a "returned by the first weekend after install"
reading next to it [UNBACKED — own idea].

**4. The two failures of the first session teach the wrong lesson.**
(a) The first Start tap usually ends in a warning: "Your ride was very short ({{seconds}}s, {{meters}}m). Are you sure?"
with a "Keep Riding" / "End Anyway" choice [SOURCE: apps/mobile/src/i18n/locales/en.json:2174 and
apps/mobile/src/app/(modals)/ride-hud.tsx:218-227, both on origin/main 5a497a1c]. The rider just did the right thing (checked
that the app works), and the app treats it as an error. (b) Maintenance-first logging is a one-off with a reward weeks
away: 1 of 15 maintenance-first riders came back on day 2 [SOURCE: evidence pack §3]. Habits form by repeating a behaviour
in the same context with an *immediate* reward ("they can be extrinsic rewards too, so long as they are immediate")
[SOURCE: https://behavioralscientist.org/good-habits-bad-habits-a-conversation-with-wendy-wood/ (Behavioral Scientist,
2019-10-14)]. A service-schedule entry has neither repetition nor an immediate reward.

**5. Week one can't build a habit, only a first successful attempt.** In Lally's study of *daily* behaviours, the
**average** time to reach maximum automaticity was 66 days. The range ran from 18 days to 254 days, and the upper end is
a model prediction beyond the 84-day study, not an observed value [SOURCE: https://bps.org.uk/research-digest/how-form-habit —
"the average time to reach maximum automaticity was 66 days", range "18 days" to a predicted "254 days"; 96 recruited,
82 completed (BPS Research Digest, 2010-10-06)]. Wood: "it can take two to three months to form a simple habit"
[SOURCE: behavioralscientist.org, as above]. Riding is weekly, seasonal and depends on the weather, so the repetitions
are much further apart than in that study. The goal for week one should be **one real ride recorded on the bike**, not
engagement [UNBACKED — own framing].

**6. Push opt-in is low and framed around maintenance, and server push does not reach Android at all.**
- Only 380 of 793 riders reach the notifications step [SOURCE: evidence pack §2]. Both answers are tracked: "Not now" sends
  `onboarding_step_completed {step:'notifications', skipped:true}` [SOURCE: apps/mobile/src/app/(onboarding)/notifications.tsx:207-213
  via 06-experimentation-analyst.md F14]. Among riders who answered, the grant rate is about 46% (198 granted, 224 skipped,
  9 not granted; all app persons, test accounts not removed) [SOURCE: 06-experimentation-analyst.md F14, PostHog q06-board-notif-skip].
- The step's copy is "Stay on top of your bike's health" [SOURCE: en.json:574 on origin/main 5a497a1c], with the sample
  "Oil change due in 200 km — book it this week." [SOURCE: en.json:739 on origin/main, `v2NotificationsSampleBody`].
- The 57-token vs 176-grant gap is explained. Android has no FCM configuration and has never stored a push token; all
  105 tokens ever stored are iOS [SOURCE: evidence pack §8b; 04-lifecycle-crm.md Diagnosis 1]. **Server push today reaches
  iOS only.**
- **Local** notifications don't need a server token or FCM, only the OS permission (`hasNotificationPermission`,
  apps/mobile/src/lib/notifications.ts:124-127; 04-lifecycle-crm.md Diagnosis 1). So local scheduling is the only channel
  that reaches both platforms for any day-1 to day-7 prompt.

## Findings

F1. **B=MAP.** Behaviour needs motivation, ability and a prompt at the same time, and motivation and ability can make up
for each other: "if motivation is very high, ability can be low" [SOURCE: https://behaviordesign.stanford.edu/resources/fogg-behavior-model
(Stanford Behavior Design Lab, undated)]. Practitioner guides list three prompt types: *facilitator* (motivation high,
ability low; makes the action easier), *spark* (ability high, motivation low) and *signal* (both high; a reminder)
[SOURCE: https://www.productledalliance.com/the-ultimate-guide-to-using-the-fogg-behavioral-model/ — "Give them a nudge to
remind them what their next action should be" (Product-Led Alliance, 2025-03-11; secondary practitioner source, not Fogg)].
Our new rider who wants to ride and isn't on the bike needs a *signal* at the moment they are on the bike, not a spark
on install day.

F2. **Implementation intentions** ("If situation Y is encountered, then I will initiate goal-directed behavior X!") had a
medium-to-large effect on goal attainment, d = .65 across 94 independent tests [SOURCE:
https://kops.uni-konstanz.de/entities/publication/2e749bfb-8533-437c-8203-7e788c910c5f — "d = .65", "94 independent tests"
(Gollwitzer & Sheeran, Advances in Experimental Social Psychology, 2006)]. The larger 2024 meta-analysis (642 tests) gives
d = 0.27 for behaviour, and a bias-corrected overall d = 0.15 (95% CI 0.08–0.22) [SOURCE:
https://www.thebehavioralscientist.com/glossary/implementation-intentions — "d = 0.15 (95% CI 0.08–0.22)"; behaviour change
"d = 0.27" (The Behavioral Scientist glossary, updated 2026-10-04)]. Expect a **small** effect. The studies are lab and
health-behaviour research, not apps; only the direction transfers. Our onboarding "commitment" step is a *goal* intention
("I'm ready to take care of my [bike]") with a press-and-hold pledge, not a when/where plan
[SOURCE: apps/mobile/src/app/(onboarding)/commitment.tsx:105-107; en.json:711 on origin/main].

F3. **Prompt timing in a randomized trial (health app, not motorcycling).** In a micro-randomized trial with 1,255 users of
a workplace well-being app, a push raised 24-hour engagement by 3.9% (RR 1.039, 95% CI 1.01–1.08). On weekends the lift
was 8.7% vs 2.5% on weekdays; that difference was not significant (P = .18). The largest lift was at 12:30 pm on weekends,
11.8%, reported with a **90%** CI (1.02–1.13) [SOURCE: https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:10.2196/10123&resultType=core&format=json
— abstract of Bidargaddi et al., "To Prompt or Not to Prompt?", JMIR mHealth uHealth 2018;6(11):e10123]. *Transfer:* this is
a different kind of app (daily self-monitoring), and the weekend and time-of-day results are exploratory. What carries over
is only the overall size: a prompt is a *small relative* nudge, not a step change. It does **not** support a specific
send time for us.

F4. **Hooked.** Trigger → action → variable reward → investment. External triggers are things like "an email, a link on a
web site, or the app icon"; investment is "time, data, effort, social capital or money" that "improves the service for the
next go-around" [SOURCE: https://www.nirandfar.com/how-to-manufacture-desire/ (Nir Eyal, ~2012)]. A rider who states when
they will ride next has made a small investment that makes the next prompt useful, not generic.

F5. **Weekly rhythm (riding).** US motorcyclist deaths cluster in the weekend: 46% in 2022, in a window that is 2.5 of 7
days (36% of the week) [SOURCE: NHTSA 813589, as above]. *Transfer:* US crash data stands in for riding exposure. It
supports "riding clusters on weekends". It doesn't give a European figure and isn't a ride count.

F6. **Temporal landmarks.** Gym visits rose at the start of a new week (by 33.4%), month (14.4%) and year (11.6%) relative
to baseline [SOURCE: https://faculty.wharton.upenn.edu/wp-content/uploads/2014/06/Dai_Fresh_Start_2014_Mgmt_Sci.pdf —
"the probability of visiting the gym increases at the beginning of a new week (by 33.4%), month (by 14.4%), year (by 11.6%)"
(Dai, Milkman & Riis, Management Science, 2014)]. *Transfer:* the study is about aspirational goals (exercise). It suggests
that "first ride of the season" in spring is a natural restart for riders lost over winter. That matters for when we read
any result (see proposals).

F7. **Endowed progress.** A car-wash loyalty card with 2 of 10 stamps already filled was completed by 34% of customers,
vs 19% for a blank 8-stamp card [SOURCE: https://www.coglode.com/nuggets/endowed-progress-effect — "completion of the
non-pre-stamped 8 card over a 9-month period was only 19% whereas the pre-stamped 10-card was 34%" (Coglode summary of
Nunes & Drèze 2006; secondary)]. Our home checklist **does not** use this effect today: it starts at 0 of 5, and the bike
added in onboarding counts for nothing, because "Complete your bike profile" needs a photo [SOURCE:
apps/mobile/src/stores/checklist.store.ts:85-90, 153-168, verified in 02-onboarding-ux.md Diagnosis 4]. 02's P02.1 step 2
(a pre-ticked "Bike added" row, 1 of 6) is the concrete fix, and I back it.

F8. **Dark patterns (US regulator).** The FTC defines *nagging* as "Asking repeatedly and disruptively if a user wants to
take an action" or a request that "doesn't let the user permanently decline". Its example is presenting choices as "Yes"
or "Not Now" instead of "Yes" or "No". It defines *confirm shaming* as "Using shame to steer users away from certain
choices", and *baseless countdown timers* as fake time pressure [SOURCE:
https://www.ftc.gov/system/files/ftc_gov/pdf/P214800%20Dark%20Patterns%20Report%209.14.2022%20-%20FINAL.pdf, appendix
(FTC staff report "Bringing Dark Patterns to Light", 2022-09)]. Our notifications step uses "Maybe later" [SOURCE:
en.json:576 on origin/main]. That is fine once. It becomes nagging if we ask again and again.

F9. **App Store rule on push.** Push "should not be used for promotions or direct marketing purposes unless customers have
explicitly opted in … and you provide a method in your app for a user to opt out" [SOURCE:
https://developer.apple.com/app-store/review/guidelines/ — guideline 4.5.4 (Apple, current)]. A reminder at a time the
rider chose themselves is a requested service message, not marketing. A generic "come back" push would be closer to
the line [UNBACKED — own reading of 4.5.4, not legal advice].

F10. **Habits depend on context and don't need willpower.** "All we have to do is repeat something and get rewarded for
it, and we're learning a habit"; most people wrongly believe that starting one needs self-control, "and that's just not
true" [SOURCE: behavioralscientist.org Wood interview, as above]. Product consequence: don't lean on pledges and
motivation copy. Remove friction at the moment of the behaviour instead.

F11. **Rider voice: dropped as my own finding (R1.8).** My earlier F11 rested on a truncated Reddit snippet from a thread I
could not open, which supports nothing. The verified rider evidence is in 05: riders "constantly forget to start the ride
tracking apps" [SOURCE: 05-rider-voice.md F4, Reddit r/motorcycles 2024-03-05], and inconsistent recording makes riders
uninstall ride trackers [SOURCE: 05-rider-voice.md F5, REVER App Store reviews 2026]. Both support the same point I needed:
the first *real* recording must succeed, and the rider needs a prompt at the moment of riding.

F12. **Our data agrees with the behavioural reading.** 76 riders tapped Start on day 0 without saving a ride, and 20 of
them (26%) came back on day 2, vs 7.4% for riders with no day-0 core action [SOURCE: evidence pack §3]. These riders
wanted to ride and could act; they lacked the context (being on the bike). They are the best target for a prompt.
The guard already sends `elapsed_s` and `distance_m` with `ride_too_short_shown` [SOURCE: apps/mobile/src/app/(modals)/ride-hud.tsx:218-227
on origin/main 5a497a1c], so pack §9's "no distance context" gap is half-closed. Only speed is missing.

F13. **Ride-goal riders are the P03.1 stratum to watch: about 18 a week, 12% save a real ride in week 1.** Of 367 onboarding
completers, **209** picked `track_rides` or `discover_routes` and had no saved ride before `onboarding_completed`. Of these,
**25 (12.0%)** saved a real ride within 7 days of first open, and **44 (21.1%)** came back on day 2 [SOURCE: PostHog
q03-rev-eligible]. That is 209 over 11.9 weeks, about **17.6 a week**, in the busiest months of the northern season
[my arithmetic]. Since round 2 this is a **stratum**, not the primary: the card's eligibility and primary follow 02's P02.1
and the P06.1 ledger (all completers with no saved ride; core action within 7 days of `onboarding_completed`, 61/367 = 16.6%)
[SOURCE: 02-onboarding-ux.md P02.1; 06-experimentation-analyst.md P06.1 ledger]. The too-short door uses the board's merged
trigger (no saved real ride, too-short branch, `distance_m < 10`, any day, every such sheet). Its comparable baseline is
**1/13 on builds ≥ 3.21.0** (Oct–Nov only, anecdote), 11/45 across all builds [SOURCE: 02-onboarding-ux.md P02.2, PostHog q-02c].
My earlier 6/44 used 06's day-0 trigger and is superseded.

## Proposals

### P03.1: "When's your next ride?" A plan the rider sets, plus one local reminder

Merged in my Responses item 1 with P01.1, P02.1, P02.2 and P05.1 as "one plan, two doors". The card below is one door; the
too-short sheet (P03.2) is the other. One sheet, one notification kind.

- **Hypothesis.** New riders who want to ride (`track_rides`/`discover_routes` goal, or Start-tappers) fail on the *prompt at
  the right moment*, not on motivation. If the rider names a when (an implementation intention) and the app turns it into
  **one** local reminder at that moment, more of them record a first real ride in week 1. Since ride-first riders return,
  return rises too.
- **Exact change.**
  - Where: the first home-screen visit after `onboarding_completed`, as the top row of the existing checklist card
    (apps/mobile/src/app/(tabs)/(home)/index.tsx:413; P02.1's row). It sits **outside the onboarding flow**, so both paywall
    arms (`garage_first` / `commit_first`) and RC experiment `expd7c1d56904` see the same thing and stay comparable.
  - Shown when (02's P02.1 rule, adopted in round 2): the rider finished onboarding and has no saved ride, **whatever the
    goal**. One card, one eligibility rule. This does not conflict with "What I'd NOT do" on maintenance-first riders: the
    row is opt-in, and no reminder exists unless the rider picks a time.
  - Copy (EN; all 7 app locales needed): title "When's your next ride?"; chips "Today" · "Tomorrow" · "This weekend" ·
    "Not sure yet"; helper "We'll remind you once. Tap Start when you're on the bike, and we'll record the route."
    Hiding the card is a plain "No thanks" (not "Not now"), and it never comes back [F8].
  - Timing, all **[UNBACKED — default choices, not evidence-based]**: "Today" → +3 h (capped at 19:00 local); "Tomorrow" →
    10:00 local; "This weekend" → the next Saturday 10:00 local; "Not sure yet" → no reminder, and the card collapses into the
    checklist. I no longer cite F3 for the Saturday time: its weekend and 12:30 results are exploratory and come from a
    different kind of app (R1.5). There is **no** timing randomisation.
  - Permission: if the OS permission is missing, ask once in context at the "remind me" tap (P02's proposal, adopted in my
    Responses item 1). If the rider declines, the plan shows on the card the next time the app opens, with no further ask.
  - Message (local, through `scheduleNotificationAsync`, new `NOTIFICATION_KIND.ACTIVATION_NEXT_RIDE`, the kind 01 and 05
    also use; the final kind and chip set are whatever the P06.1 ledger fixes, see 02 R2.4): title "Riding today?",
    body "Open MotoVault and tap Start when you're on the bike, so your first route gets saved." Tapping opens `/start-ride`.
    **One** message per rider, ever, and it counts as that rider's single activation message under the board budget
    (Responses item 2).
  - Events: `next_ride_plan_set {when, source:'home'|'too_short', permission_granted}`, `next_ride_plan_dismissed`,
    `reminder_scheduled {kind:'activation_next_ride', fire_at}`, `reminder_opened {kind:'activation_next_ride'}` (existing
    tap handler, apps/mobile/src/app/_layout.tsx per pack §1), plus the existing `ride_completed` (below_min_ride=false).
- **Target metric and baseline (one primary, the P06.1 ledger's).** Primary: **core action within 7 days of
  `onboarding_completed`, among completers: 61/367 (16.6%)** [SOURCE: 06-experimentation-analyst.md P06.1 ledger;
  02-onboarding-ux.md P02.1, PostHog q-02d]. Guardrails as in the ledger: week-1 saved real ride 27/367 (7.4%) and day-2
  engaged return 37/367 (06 F14 definition, which excludes `reminder_opened`) [SOURCE: 06-experimentation-analyst.md P06.1
  ledger, PostHog q06-rev-engaged]. `activation_24h` is a **diagnostic only**, as the ledger says: the plan moves the first
  ride past 24 h on purpose. Reported per-goal stratum: track_rides/discover_routes riders, real ride within 7 days of first
  open, 25/209 (12.0%) [SOURCE: PostHog q03-rev-eligible] (02 cuts track_rides alone at 25/197). Also report "returned by the
  first Sunday after install" (Diagnosis 3; its baseline must be built from the same cohort before launch). The whole-funnel
  7.7% (61/793) is context, not the metric.
- **Expected effect.** Direction only. In the 2024 meta-analysis (642 tests), implementation intentions changed
  **behaviour** by d = 0.27; the 0.15 is a bias-adjusted estimate of the **overall** effect, not a behaviour-only figure
  [F2]. A timed prompt gives a small relative lift (RR 1.039 overall, different app type) [F3]. **No magnitude for
  MotoVault is sourced.** My guess is a few extra first rides a month among eligible riders, not points of the whole funnel
  [UNBACKED — own estimate].
- **Ships when (R2.6).** While the P06.2 nudge test holds the single randomised slot, P06.3 allows no before/after change
  unless it is behind P06.2's flag, and the in-context permission ask would change the nudge test's eligible group
  [SOURCE: 06-experimentation-analyst.md P06.3, Responses R3; 04-lifecycle-crm.md P04.1 step 5]. My position: **P03.1 and
  P03.2 wait until the nudge test stops** (calendar cap 2026-03-31). That puts the launch at the start of the northern season,
  when riders are about to ride and "first ride of the season" is a natural restart [F6]. The cost is that winter riders,
  including the southern hemisphere, don't get it [UNBACKED — own judgement]. If the ledger owner instead records a bundle
  (package behind the flag, treatment arm only), I accept it, provided arms are assigned at **all** completers, so the
  permission ask is part of the treatment and not a change to who is eligible [SOURCE: 02-onboarding-ux.md P02.1
  "Sequencing"; 06 F10]. The ledger decides; I don't run a third design.
- **Effort.** M (a checklist row and sheet with theme tokens, one notification kind, scheduling helper reused from
  `scheduleStages` / trial-reminder, 7 locales, events).
- **Risk to onboarding paywall.** None by design: nothing changes before `onboarding_completed`, and both arms get the
  card. The paywall itself is untouched.
- **How to measure at ~7 installs/day.**
  1. *Mechanism chain, no control group needed:* the share of eligible riders who set a plan, the reminder open rate, and
     **of plan setters, the share who save a real ride within 48 h of the planned slot**. About 31 completers a week reach
     the card in season (367 over 11.9 weeks), 17.6 of them with a ride goal [F13], and fewer in winter. Kill rule: if after 8 weeks fewer than 1 in 10 eligible riders set a plan,
     or no plan setter has saved a real ride within 48 h of the slot, remove the card [UNBACKED — own threshold].
  2. *Outcome check = harm guardrail only.* If it ships after the nudge test (my position, "Ships when"), it goes on 06's
     P06.3 no-harm path: a pre-registered before/after with the revert rule on the guardrails above. It cannot show a lift.
     A before window that ends in winter against an April–May after window mixes the change with the season (06 F11), in the
     other direction from the one I flagged in round 1. I make no "would clear noise" claim. For scale only: detecting a
     doubling in the ride-goal stratum (12% → 24%) would need about 160 riders per side, **320 in total**, at 80% power
     [UNBACKED — own two-proportion arithmetic]. At 17.6 a week that is **about 18 weeks** in season, longer in winter. If
     the ledger bundles the package into the randomised slot instead, the read is 06's sequential rule on the ledger primary,
     not this.
  3. *A lift read, if anyone wants one, needs calendar-matched windows or the randomised slot.* The pack's cohort starts on
     2026-08-14 [SOURCE: evidence pack §0], and I have not checked whether PostHog holds a usable spring-2026 window
     [UNBACKED — not checked]. If it doesn't, a same-weeks comparison is possible only from August 2027 (vs Aug–Oct 2026).
     Otherwise the only lift read is the slot after the nudge test. Keep "first ride of the season" in mind
     as a natural restart [F6], and split by hemisphere: Australia is a top GSC market [SOURCE: evidence pack §7].
  4. *Qualitative:* 3–5 session replays of riders who saw the card, read for whether the chips were understood.
- **Light/dark.** The row and sheet use `useEditorialTheme` tokens (`theme.surface`, `ink`, `ink2`, `surface2`), as the
  checklist card does [SOURCE: 02-onboarding-ux.md P02.1 Light/dark, onboarding-checklist.tsx:48, 98-143], never hard-coded
  hex. Selected chips use `theme.warm`/`onWarm` and must be visible in both modes. Check both appearances on the simulator.
  The notification is OS chrome.

### P03.2: Treat the first Start as a successful test, not an error

The second door of the merged feature (Responses item 1).

- **Hypothesis.** A first Start below the floor (30 s / 50 m, apps/mobile/src/utils/ride-constants.ts:25-26 on origin/main)
  is usually a home test. The current "Your ride was very short … Are you sure?" sheet frames the rider's first action as a
  mistake and leaves no next step. If the app confirms the test and sets up the real ride (the P03.1 sheet), more of these
  warm riders record a real ride in week 1.
- **Exact change.**
  - Where: the minimum-ride guard sheet (apps/mobile/src/app/(modals)/ride-hud.tsx:218-227 on origin/main 5a497a1c).
    **Trigger = the board's merged one** (round 2, R2.1): the rider has **no saved real ride**, the guard is the too-short
    branch (not the no-GPS branch, `guardEvent`, ride-hud.tsx:64-68), and **`distance_m < 10`**; on **any day**, on **every**
    such sheet, not only the first attempt [SOURCE: 02-onboarding-ux.md P02.2; 01-activation-pm.md P01.1; 05-rider-voice.md
    P05.1]. On builds ≥ 3.21.0 the too-short branch is already under 120 s, so 05's `elapsed_s < 120` adds nothing there.
    A rider who moved 10 m or more keeps today's sheet. One door, one trigger.
  - Copy (EN), chosen by whether a GPS fix arrived. The HUD already records accuracy from the last point
    (`setGpsAccuracy(lastPoint.accuracy ?? 0)`, ride-hud.tsx:150 on origin/main). "Fix arrived" = at least one location point
    with a non-null accuracy during this attempt. Both bodies state **both** save conditions, interpolated from
    `MIN_RIDE_ELAPSED_S = 30` and `MIN_RIDE_DISTANCE_M = 50`, never hard-coded [SOURCE: apps/mobile/src/utils/ride-constants.ts:25-26
    on origin/main; guard `elapsed < MIN_RIDE_ELAPSED_S || dist < MIN_RIDE_DISTANCE_M`, ride-hud.tsx:218]. The sentence is
    02's, so the board has one string.
    - **Fix arrived:** title "Test ride: all good"; body "GPS and recording work. Rides shorter than {{seconds}} seconds or
      {{meters}} m aren't saved. Tap Start next time you're on the bike."
    - **No fix:** title "Testing it out?" (P05.1's wording); body "Rides shorter than {{seconds}} seconds or {{meters}} m
      aren't saved. Go outside with a clear view of the sky, then tap Start when you're on the bike." This makes no claim
      that GPS works (R1.10; 02-onboarding-ux.md Responses item 1).
    - `{{meters}}` needs the rider's unit (mi/km preference) like the existing short-ride string; that is an implementation
      detail for the build, not a new decision [UNBACKED — not checked in code].
    - Buttons (both versions): primary "Got it" ends and discards, as "End Anyway" does today. Secondary "Keep recording"
      (same as today). Tertiary link "Remind me on my next ride day" opens the P03.1 chips if the rider has no plan.
  - Events (02's schema, so there is one): add `is_first_ride_attempt`, `variant:'teach'`, plus my `gps_fix` (boolean),
    and `max_speed_kmh` to the existing `ride_too_short_shown` (`elapsed_s`, `distance_m` are already sent). Add
    `action:'remind_me'` to the existing action values.
- **Target metric and baseline (the merged trigger's).** Primary: **riders whose first sheet meeting the trigger came before
  any saved real ride → real ride saved within 7 days of that sheet. Comparable baseline: 1/13 on builds ≥ 3.21.0
  (Oct–Nov only; anecdote, not a rate)**; 11/45 across all builds for context [SOURCE: 02-onboarding-ux.md P02.2, PostHog
  q-02c]. The before-window is ≥ 3.21.0 only, as 06 requires [SOURCE: 06-experimentation-analyst.md P06.1 ledger]. The same
  trigger has produced 11/49 (01), 11/46 and 1/14 (05); the canonical figure is the one 06 writes into the ledger (review-06
  R2.3), and I use that one once it is there. A later rise from 1/13 is not a lift: ≥ 3.21.0 riders are all from Oct–Nov,
  and 1/13 vs 10/32 is a builds-by-calendar comparison (review-02 R2.3). Guardrail: day-2 engaged return in the same group
  (06 F14 definition).
- **Expected effect.** Only direction: an immediate reward helps learning [F10] and a clear next step lowers the effort of
  the next attempt [F1]. No sourced magnitude [UNBACKED].
- **Effort.** S (one conditional branch with two copy variants, 7 locales, three event properties).
- **Risk to onboarding paywall.** None (it fires after onboarding, in the ride HUD).
- **How to measure at ~7 installs/day.** About 16 riders hit this trigger in the ~6 weeks of ≥ 3.21.0 data, 2–3 a week
  [SOURCE: 02-onboarding-ux.md P02.2, PostHog q-02c], so no test will be powered. It ships with P03.1 (same timing, see P03.1
  "Ships when"), on the P06.3 no-harm path. Read (a) the split of `action` values (keep / end / remind_me) and of `gps_fix`
  week by week, (b) the mechanism chain sheet → remind_me → `reminder_opened` → real ride within 48 h, in counts, and (c) a
  cumulative "first trigger sheet → real ride within 7 days" count against the ledger baseline, treated as anecdote below
  about 40 post-launch riders [SOURCE: 06-experimentation-analyst.md Responses R1 threshold]. Plus
  qualitative: 3–5 session replays or rider emails asking "did the test-ride message make sense?" [UNBACKED — own design].
- **Light/dark.** The HUD always uses `editorialThemes.dark` (`HUD_THEME`, ride-hud.tsx:34 on origin/main), whatever the
  system mode, so the sheet looks the same in light mode. Check contrast for both titles against `HUD_THEME.surface`, and check
  the sheet with the system in light mode to make sure nothing reads from the system theme.

### P03.3: A time-boxed welcome window — PARKED

**Status: parked (R1.9).** I am not proposing this for #365 now. Reasons: the board caps activation messaging at **one
message per rider in days 0–7** (my Responses item 2), message (2) is already dropped in favour of P04.1's expense branch,
and 06 parks any weekend message until the P04.1 test stops (06 Responses R3).

What would be needed to unpark it after the P04.1 test ends:
- **Who:** onboarding completers who granted permission and did no core action on day 0. Baseline group: **144** riders in
  the cohort, about 12 a week; **23 (16.0%)** came back on day 2 [SOURCE: PostHog q03-rev-eligible]. (06's wider group,
  171 granted completers, includes riders who already acted on day 0 [SOURCE: 06-experimentation-analyst.md Responses R2].)
- **What:** at most one local message, the first Saturday after install, only for riders with no plan reminder pending and
  no P04.1 message sent. Text as before: "Out on the [bike name] this weekend? Tap Start when you roll out, and we'll save
  the route." Opens `/start-ride`. Cancelled by any core action. The send time is [UNBACKED — default choice].
- **How it would be tested:** not an 80/20 split "read in a year". It would take P04.1's place as the arm in 06's single
  randomised slot: 50/50 at eligibility, assignment drawn the way `onboarding-experiment.ts` draws arms for pre-consent
  installs. A Saturday message fires after day 2 for most riders, so day-2 return can't be the primary. It would be
  **engaged return within 48 h of the scheduled send**, compared with the control arm's same window. Stop rule:
  Miller's sequential rule with N = 64 successes, as 06 tabulates for this group size [SOURCE: 06-experimentation-analyst.md
  Responses R2; https://www.evanmiller.org/sequential-ab-testing.html]. At about 12 eligible riders a week that is a
  spring-season test, not a winter one [UNBACKED — own design].
- No new settings toggle: it would reuse the existing reminder settings. The opt-out must exist before it ships (Apple 4.5.4 [F9]).

## What I'd NOT do, and why

- **No streaks, badges for consecutive days, or "don't lose your streak" pushes.** Riding is weekly and depends on the
  weather. Lally found that missing one day did not hurt habit formation, while very inconsistent performers did not form
  habits [SOURCE: bps.org.uk, as above]. A daily streak would be broken by rain, not by the rider, and punishes them for
  it [UNBACKED — own inference].
- **No repeated permission asks or "Not now" loops after onboarding.** The FTC lists this exact pattern as nagging [F8].
  One ask in onboarding, at most one in-context ask at the "remind me" tap, and one optional entry point in settings.
- **No countdown timers or "limited offer" pushes in week 1 to rescue revenue.** The FTC lists baseless countdown timers
  [F8]. All purchases already happen at hour 0 inside onboarding, and 3 of the 4 Play trials never reopened the app
  [SOURCE: evidence pack §6]. Pushing more paywall into week one would sell nothing and teach churn.
- **No new pledge or motivation copy.** Wood: habits don't come from self-control [F10]; prompts and ability are what
  move behaviour [F1]. Separately, the commitment step's subtitle "Riders who commit here are far more likely to keep their
  bike in top shape" [SOURCE: en.json:711 on origin/main] is a factual claim I found no backing for. It sits inside the running
  `commit_first` arm, so I would **not** change it mid-test. I'm flagging it to the owner as a copy-honesty item to fix
  when the A/B ends [UNBACKED — no evidence found either way].
- **No "come back" prompts for maintenance-first riders built on the ride loop.** Their reward is weeks away and the
  data shows maintenance-first doesn't predict return (1/15) [SOURCE: evidence pack §3]. Their prompt should be the real
  service date (the existing maintenance reminders), not invented daily nudges. Matching the web's maintenance promise
  belongs to other board members.
- **No separate 50/50 A/B test on day-2 return for P03.1 or P03.2.** Their eligible groups are about 31 completers (17.6
  with a ride goal) and 2–3 trigger riders a week [F13; 02 P02.2], and the weekly day-2 rate already swings 3–12% [SOURCE:
  evidence pack §2]. The board's single randomised slot goes to P04.1 (06 Responses R2), unless the ledger records the
  package as a bundle in that slot (P03.1 "Ships when").
- **No server push for any activation prompt.** Server push does not work on Android (no FCM, 0 Android tokens) and reaches
  iOS only [SOURCE: evidence pack §8b; 04-lifecycle-crm.md Diagnosis 1]. A server-push experiment would compare iOS riders
  with nobody. Local notifications reach both platforms. Server push waits for P04.2.
- **No AI-diagnostics hook in the first session.** It isn't the hero feature, and the 10 riders whose paths went through
  it had 0 return [SOURCE: evidence pack §5].

## Responses

Written after reading drafts 01, 02, 04, 05 and 06. One new source was opened for this section (the implementation-intentions
glossary below). Where the "Answers to review" section changes something below, the answer wins: P03.3 is now parked, the
Saturday time is an unbacked default. After round 2, item 1's "first too-short guard sheet" door uses the merged trigger
(any sheet with no saved ride and `distance_m < 10`), and item 3's 7-day ride primary (25/209) and 6/44 baseline are
superseded by the P06.1 ledger primary (61/367) and the ≥ 3.21.0 trigger baseline; 25/209 stays as a reported stratum.
`activation_24h` is a diagnostic, not a guardrail, as the ledger says.

**1. On P01.1 (Activation PM), P02.2 (Onboarding UX) and P05.1 (Rider voice), combined with P02.1 and my P03.1/P03.2: four of us proposed the same experiment. Ship it as one: "one plan, two doors".**
- The guard-sheet proposals (P01.1, P02.2, P05.1, P03.2) and the home-card proposals (P02.1, P03.1) target the same warm group, the 76 day-0 Start-tappers with no save, 26% of them back on day 2 [SOURCE: evidence pack §3]. They use the same mechanism, a when-plan plus one local reminder. Run them as one feature: one "When's your next ride?" sheet, one notification kind, and two ways in (the first too-short guard sheet, and the home checklist row). Shipping them as separate tests would split about 1 eligible rider a day across two reads that can't be told apart [UNBACKED — own design].
- Copy: use an affirming title for the test (P01.1 "Test ride passed" or my "Test ride: all good"), **only when a GPS fix arrived** (see R1.10). Avoid P02.2's "You haven't moved yet", which still frames the rider's first action as a shortfall [UNBACKED — own judgement, per Diagnosis 4]. Keep P02.2's phone-placement tip; it lowers the effort of the *next* attempt (ability, in B=MAP terms) [F1].
- I am adopting P02's in-context permission ask at the "remind me" tap [SOURCE: 02-onboarding-ux.md F4, Android guidance]. It replaces my "no ask, show it on the card" fallback. It is one ask at the moment of the feature, not a repeat nag [F8].
- I am downgrading my effect estimate. The 2024 meta-analysis (642 tests) gives d = 0.27 for behaviour change, and a robust-Bayesian bias-corrected d = 0.15 (95% CI 0.08–0.22) [SOURCE: https://www.thebehavioralscientist.com/glossary/implementation-intentions — "d = 0.15 (95% CI 0.08–0.22)"; behaviour change "d = 0.27" (The Behavioral Scientist glossary, updated 2026-10-04)]. Small correction to P02 F7: the page says the 0.15 is "an adjusted overall estimate, not a behavior-only figure". The same page reports no moderator analysis showing that more when/where detail helps, so I drop my implied "upper bound .65" reading and expect a small effect. The studies are lab and health-behaviour research, not apps; only the direction transfers.

**2. On P04.1 (Lifecycle): agree with one local message, cancelled by a core action, on the local path. Challenge the fixed "tomorrow 18:00" for track_rides riders. Make it the fallback for riders without a plan, and put a hard budget on messages across the board.**
- Agree: P04.1's finding that all 105 stored tokens are iOS and Android has no FCM config [SOURCE: 04-lifecycle-crm.md Diagnosis 1, Supabase query A] confirms my "local, not server" choice. P04.2 is the precondition for anything server-side.
- Challenge: a fixed weekday-evening slot prompts a rider whose next real chance to ride is usually the weekend [F5, NHTSA proxy]. A time the rider chose is better timed and is a requested service message, not marketing [F9]. (I no longer lean on F3's weekend result here; it is exploratory.)
- Combination: the rider's own plan (item 1) takes priority. P04.1 fires only for riders who set no plan. P04.1's expense branch for non-ride goals is the better day-1 content than my P03.3 message (2) (expense-first riders return at 41%, 9/22 [SOURCE: evidence pack §3]), so I drop my day-6 schedule message in favour of it. The board-wide budget: **at most one activation message per rider in days 0–7**, plus their own plan reminder if they set one. P01.2, P04.1 and P03.3 must not stack. Each one comes from a different member, and stacked they turn into the nagging pattern the FTC describes [F8] [UNBACKED — own rule].

**3. On P06.2 (Experimentation analyst): agree with post-paywall assignment, crossing the paywall arms (factorial), and the sequential rule. Challenge `activation_24h` as the primary for prompt-based changes, and adopt P06.1's reminder-tap exclusion everywhere.**
- `activation_24h` suits changes that act *inside* the first session. The plan-and-remind feature (item 1) works by design by moving the first real ride *out of* day 0, to the day the rider is on the bike. A rider who taps "This weekend" and records on Saturday is a success that `activation_24h` scores as a failure. Used as the primary, it would reject the board's main prompt intervention by construction [UNBACKED — own reasoning from the metric definition in 06-experimentation-analyst.md P06.2].
- Proposal: for item 1 use **"real ride saved (not `below_min_ride`) within 7 days of first open"** as the primary. The baseline is now cut: 25/209 (12.0%) for the home door and 6/44 (13.6%) for the too-short door [F13]. Keep `activation_24h` as a guardrail: it must not *fall*, because the sheet must not talk riders out of recording now. Also read "returned by the first Sunday after install" (my Diagnosis 3).
- Adopt P06.1's `day2_engaged_return` for every reminder proposal. Day-2 return today would count the open our own notification causes [SOURCE: 06-experimentation-analyst.md F14, P06.1].

## Answers to review

Round 1 (review-03-behavioural-scientist.md, 10 items).

- **R1.1 — fixed:** Diagnosis 5 now says "average", quoting the BPS page ("the average time to reach maximum automaticity
  was 66 days"), and says the 254-day upper end is a prediction beyond the 84-day study, not an observed value.
- **R1.2 — fixed:** 367 completers over 11.9 weeks is about 31 a week, not 23. More to the point, I replaced it with the
  group P03.1 actually targets: 209 card-eligible riders, about 17.6 a week [SOURCE: PostHog q03-rev-eligible; F13]. P03.3's
  group is recomputed as granted completers with no day-0 core action: 144, about 12 a week [same source]. That is a subset
  of 06's 171 (about 14 a week), as you said. The "readable in N weeks" claims are rewritten from these numbers.
- **R1.3 — fixed:** P03.1 has one primary: real ride saved within 7 days of first open among card-eligible riders,
  **25/209 (12.0%)** [SOURCE: PostHog q03-rev-eligible], with eligibility defined so it can be decided at the moment the card
  shows (completed onboarding, `track_rides`/`discover_routes`, no saved ride before `onboarding_completed`). Day-0 Start
  tapping is not part of eligibility, because it happens after the card is shown; those riders come in through the
  too-short door, with its own baseline 6/44. `activation_24h` and day-2 engaged return are guardrails. The 7.7% (61/793) is
  now context only. The body and Responses item 3 agree, and the primary is written so it can be copied into the P06.1 ledger.
- **R1.4 — fixed:** the outcome check is now a harm guardrail only, on 06's P06.3 path. I removed the "would clear noise"
  framing and the 793-vs-400 comparison, and say plainly that an Aug–Oct baseline against a Nov–Jan after window mixes the
  change with the season [SOURCE: 06-experimentation-analyst.md F11]. A lift read, if any, waits for a calendar-matched
  spring window.
- **R1.5 — fixed:** all reminder times are tagged [UNBACKED — default choices]. The weekend default moved to Saturday 10:00
  and no longer cites F3. F3 now says its weekend result was not significant (P = .18) and the 12:30 result uses a 90% CI,
  so it supports only "a prompt is a small nudge", not a send time. The within-rider 10:00-vs-12:30 randomisation is dropped.
- **R1.6 — fixed:** Diagnosis 6 now says "Not now" is tracked (`onboarding_step_completed {skipped:true}`,
  notifications.tsx:207-213) and the grant rate among riders who answered is about 46% [SOURCE: 06 F14]. It also says the
  token gap is explained: no FCM, 0 Android tokens, server push reaches iOS only [SOURCE: evidence pack §8b; 04 Diagnosis 1].
  The "What I'd NOT do" bullet now reads "no server push for any activation prompt", because server push does not work on
  Android, not because the gap is unexplained.
- **R1.7 — fixed:** F7 now states the checked fact: the checklist starts at 0 of 5 and does not count the onboarding bike
  [SOURCE: checklist.store.ts:85-90, 153-168 via 02-onboarding-ux.md Diagnosis 4]. I back 02's pre-ticked "Bike added" row.
- **R1.8 — fixed:** my F11 is dropped. The id now points to 05 F4 ("constantly forget to start the ride tracking apps") and
  05 F5 (inconsistent recording leads to uninstalls), which you verified.
- **R1.9 — fixed:** P03.3 is marked **parked**, consistent with my Responses item 2 and 06 Responses R3. The two-message
  sequence, the 80/20 holdout and the new settings toggle are gone. The section now lists only what unparking it would need:
  the eligible group with its baseline (144 riders, 16.0% day-2), one message, 50/50 assignment taking P04.1's slot after that
  test ends, a primary measured in the 48 h after the send, and Miller's sequential rule with N = 64 as 06 tabulates.
- **R1.10 — fixed:** P03.2 now has two strings chosen by whether at least one location point with accuracy arrived
  (`setGpsAccuracy(lastPoint.accuracy ?? 0)`, ride-hud.tsx:150 on origin/main). With a fix: "Test ride: all good" / "GPS and
  recording work. …". Without a fix: "Testing it out?" / "Your real ride is saved once you've moved more than 50 m. Go outside
  with a clear view of the sky, then tap Start when you're on the bike." A `gps_fix` property is added to
  `ride_too_short_shown` so the split can be read. Responses item 1 now carries the same condition.

Round 2 (review-03-behavioural-scientist.md, 6 items). No new external sources and no new queries: every number below
comes from another board file or my existing q03-rev-eligible run, so the board does not get a fifth version of a baseline.

- **R2.1 — fixed:** P03.2 now uses the board's merged trigger: no saved real ride, too-short branch (not no-GPS),
  `distance_m < 10`, any day, every such sheet [SOURCE: 02-onboarding-ux.md P02.2; 01-activation-pm.md P01.1; 05-rider-voice.md
  P05.1]. "First attempt ever" and the day-0 condition are gone. The primary is real ride within 7 days of the first trigger
  sheet, with the ≥ 3.21.0 baseline **1/13** (Oct–Nov, anecdote), 11/45 all builds for context [SOURCE: 02-onboarding-ux.md
  P02.2, PostHog q-02c], and a ≥ 3.21.0-only before-window as 06 requires. My 6/44 is marked superseded in F13 and the
  Responses preamble. Where the board still has 11/49, 11/46 and 1/14 for the same trigger, I defer to the figure 06 writes into
  the ledger (review-06 R2.3) rather than pick a winner. Volume is restated as 2–3 trigger riders a week.
- **R2.2 — fixed:** both P03.2 bodies now say "Rides shorter than {{seconds}} seconds or {{meters}} m aren't saved",
  interpolated from `MIN_RIDE_ELAPSED_S = 30` and `MIN_RIDE_DISTANCE_M = 50` (ride-constants.ts:25-26 on origin/main, which I
  re-checked), matching the guard at ride-hud.tsx:218. It is 02's sentence, so the board has one string.
- **R2.3 — fixed:** 320 riders at 17.6 a week is about **18 weeks**, not 9. Point 2 now says "about 160 per side, 320 in
  total, about 18 weeks in season, longer in winter", and labels it as scale only.
- **R2.4 — fixed:** I adopted 02's card. Eligibility: every completer with no saved ride, any goal. Primary: the ledger's,
  **core action within 7 days of `onboarding_completed`, 61/367 (16.6%)**, with the ledger's guardrails (week-1 saved ride 27/367,
  day-2 engaged return 37/367) and `activation_24h` as a diagnostic only [SOURCE: 06-experimentation-analyst.md P06.1 ledger].
  My 25/209 is now a per-goal stratum (track_rides/discover_routes). Showing the row to maintenance-goal riders doesn't break
  my "What I'd NOT do" item, because nothing is sent unless the rider picks a time. The notification kind stays
  `activation_next_ride` (also used by 01 and 05); the final kind and chip set are for the ledger (review-02 R2.4).
- **R2.5 — fixed:** "Expected effect" now says d = 0.27 for behaviour and calls 0.15 a bias-adjusted overall estimate, not a
  behaviour-only figure, matching F2 and the glossary I cited in round 1.
- **R2.6 — fixed:** P03.1 has a "Ships when" line. My position is that **P03.1 and P03.2 wait until the nudge test stops**
  (cap 2026-03-31) and then go on the P06.3 no-harm path. That keeps the nudge test's eligible group unchanged, and it lands the
  plan sheet at the start of the northern riding season [F6]. The cost is that winter and southern-hemisphere riders don't get
  it [UNBACKED — own judgement]. If the ledger owner records a bundle instead (package behind P06.2's flag, treatment arm only),
  I accept it on one condition: arms are assigned at all completers, so the permission ask is part of the treatment
  [SOURCE: 06-experimentation-analyst.md P06.3, F10; 02-onboarding-ux.md P02.1 "Sequencing"]. Measurement point 2 also now
  says a before/after across winter into spring is confounded by season, the opposite direction from round 1.

## Appendix: PostHog q03-rev-eligible (read-only, run 2026-11-12)

Same cohort, base CTE and test-account exclusions as `queries/q02-segments.sql` (n = 793, first seen 2026-08-14 → 11-04,
`$lib = posthog-react-native`). Per person: `t_obdone` = first `onboarding_completed`; `t_ride` = first `ride_completed` with
`below_min_ride` not true; `goal` = last `primary_goal` on `onboarding_step_completed {step:'goals'}`; `push` = last
`notification_permission_result.permission_granted`; day-0 core = first of ride / `expense_added` / maintenance task on the
first-seen UTC date; day-2 return as in pack §0. Results:

| Group | n | Real ride within 7 days of first open | Day-2 return |
|---|---|---|---|
| Onboarding completers | 367 | — | — |
| Card-eligible: completed, goal `track_rides`/`discover_routes`, no ride before `onboarding_completed` | 209 | 25 (12.0%) | 44 (21.1%) |
| Same, also counting day-0 Start-tappers with other goals | 223 | 26 (11.7%) | — |
| Completed, push granted | 171 | — | — |
| Completed, push granted, no day-0 core action (P03.3, parked) | 144 | — | 23 (16.0%) |

These are one-off, noncanonical derivations (the project's metric catalog is empty, per pack header), "of riders who allowed
analytics" (pack §1).
