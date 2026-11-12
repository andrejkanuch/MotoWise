# 02 Onboarding UX designer

Board member 02. First draft 2026-11-12; **revised 2026-11-12 after Skeptic round 1, and again after round 2** (see "Answers to review" at the end). Research and planning only. No code, flags, PostHog or RevenueCat objects were changed.
Read-only PostHog SQL checks are marked **[NEW q-02a … q-02f]**; SQL is in the appendix. One stopping-rule simulation is marked **[q-02g sim]** (script in the appendix). They use the evidence-pack cohort (first seen 2026-08-14 → 11-04) and, from this revision on, the q00 test-person exclusions. Code references are to origin/main 5a497a1c unless marked "working branch".

## Diagnosis

1. **Onboarding is not the main leak. The first ten minutes after it are.** 46% finish onboarding, but only 15.8% of finishers come back on day 2 [SOURCE: evidence pack §2]. Activation happens on day 0 or not at all: 40 of the 61 week-1 core actions happen in the first hour, and only 5 happen after day 1 [SOURCE: evidence pack §3 `ttfc`]. So whatever the rider sees on their first home screen *is* the activation surface.
2. **The first home screen asks for an action most riders cannot do yet.** Home leads with the bike plate and a Ride / Expense / Task / Diagnose action row; the "Get Started" checklist sits below it [SOURCE: apps/mobile/src/app/(tabs)/(home)/index.tsx:403 (origin/main, `<OnboardingChecklist />`)]. Riders install at home, not on the bike. 66 of 103 riders who tapped Start got "ride too short" [SOURCE: evidence pack §3].
3. **On current builds the ride-too-short guard is mostly people tapping Start while standing still, and almost all of them give up.** Re-cut on builds ≥ 3.21.0 only, test persons excluded, counting only `action = 'shown'` rows: **31 guard sheets, 20 of them (16 riders) at under 10 m and under 30 s; 7 sheets (1 rider) after ≥ 50 m but under 30 s** [SOURCE: PostHog NEW q-02a]. On those builds riders chose "End anyway" 27 times and "Keep riding" once [SOURCE: PostHog NEW q-02a]. (The pack's "221 times" counts event *rows*: on current builds each sheet writes a `shown` row plus a decision row, and builds before 3.21.0 wrote mainly decision rows and also fired this event for ≥ 120 s no-GPS rides [SOURCE: PostHog NEW q-02a; ride-hud.tsx:58-68].) The sheet's copy treats this as a mistake ("Your ride was very short (…s, …m). Are you sure?") [SOURCE: apps/mobile/src/i18n/locales/en.json `rideHud.shortRideWarning`]. Nothing tells a first-timer that this is normal, or helps them come back when they do ride. **Baseline for this group:** of 46 riders whose first standstill guard (< 10 m) came before any saved ride, 11 of 45 eligible saved a real ride within 7 days (10/32 on builds < 3.21.0, **1/13 on builds ≥ 3.21.0**), and 13/46 opened the app the next day [SOURCE: PostHog NEW q-02c]. **Round-2 re-cut on the board's canonical trigger** (first sheet with `distance_m < 10`, no saved real ride before it, any day, no `elapsed_s` filter, sheet before 2026-11-05 so 7 days are observable): **all builds 11/48; builds ≥ 3.21.0 1/13** (Oct 1/12, Nov 0/1); older builds 10/35 (Aug 1/6, Sep 8/28, Oct 1/1) [SOURCE: PostHog NEW q-02f]. This reproduces 01's 11/48 and my 1/13, so the board's four versions reduce to these two. The ≥ 3.21.0 riders are all Oct–Nov and the older ones mostly Aug–Sep, so the build difference is also a season difference, and with these counts it may be chance (Fisher two-sided p ≈ 0.25 [UNBACKED — own arithmetic on q-02f counts]). 1/13 is an **Oct–Nov anecdote**, not a rate.
4. **The checklist's first ride item points to an empty list.** "See your first ride stats" deep-links to `PROFILE_ROUTE.RIDES` [SOURCE: apps/mobile/src/stores/checklist.store.ts:67-70]. A brand-new rider has no rides, so this sends them to a blank screen. The card starts at 0 of 5. The bike they just added in onboarding counts for nothing ("Complete your bike profile" needs a photo) [SOURCE: apps/mobile/src/stores/checklist.store.ts:85-90, 153-168 (working branch)].
5. **The "What's New" problem in §5 is already fixed.** `markWhatsNewSeenForNewRider()` runs in personalizing and shipped in 3.25.0 (#298, 2026-10-09) [SOURCE: apps/mobile/src/app/(onboarding)/personalizing.tsx:191]. Onboarding completers who saw What's New within an hour: **112 of 278 before 10-12, 0 of 90 from 10-12** [SOURCE: PostHog NEW q-02b]. The §5 figure is history, and the board should not spend an experiment on it.
6. **Small correction to the pack's §9 gap table.** `ride_too_short_shown` already carries `elapsed_s` and `distance_m` [SOURCE: apps/mobile/src/app/(modals)/ride-hud.tsx:218-226]. Only a speed field is missing.
7. **Goal intent is collected and then dropped.** `primary_goal` predicts everything: track_rides gets 16.8% day-2 return, maintain_bike 3.6% [SOURCE: evidence pack §4]. Yet the first home screen is the same for every goal; only the order of the checklist changes [SOURCE: apps/mobile/src/stores/checklist.store.ts:153-168 (working branch)]. Web visitors come for their model's service schedule [SOURCE: evidence pack §7].
8. **Completer baselines (new, for the proposals below).** Of 367 onboarding completers, **61 (16.6%) did a core action within 7 days of `onboarding_completed`**; by completion month Aug 17/61, Sep 25/162, Oct 16/127 (Nov 3/17, partial). Of 197 completers who chose track_rides, **25 (12.7%) saved a real ride within 7 days** [SOURCE: PostHog NEW q-02d, q-02e]. The monthly series falls into autumn, which is why no before/after in this season can show a lift (P02.2 measurement).

## Findings

**F1. Guided first actions are rare. Most apps rely on plain empty states.** In a 2026 sample, "Only 15 of 809 apps use an explicit guided first-action prompt", 373 rely on "a plain empty state", 107 use a setup checklist [SOURCE: https://design.lazyweb.com/blog/how-apps-drive-first-meaningful-action.md — "Only 15 of 809 apps use an explicit guided first-action prompt" (Lazyweb Research (vendor), 2026-07-07)]. The study measures prevalence, not conversion ("The corpus shows prevalence, not conversion").

**F2. Teach in context, not with tutorials.** NN/g: "avoid creating app onboarding whenever possible"; in their research "tutorials didn't improve task performance" [SOURCE: https://www.nngroup.com/articles/mobile-app-onboarding/ — "tutorials didn't improve task performance" (Nielsen Norman Group, 2020-06-21)]. This supports teaching the save rule *at the moment the guard fires*.

**F3. Empty states should show status, teach, and link straight to the key task** [SOURCE: https://www.nngroup.com/articles/empty-state-interface-design/ — "Use Empty States to Provide Direct Pathways for Key Tasks" (Nielsen Norman Group, Kate Kaplan, 2021-09-19)]. The first-ride item links to an empty list (Diagnosis 4).

**F4. Ask for permissions in context.** "Ask for a permission in context, when the user starts to interact with the feature that requires it." "Don't block the user." On Android, two denials make the system treat it as "don't ask again" [SOURCE: https://developer.android.com/training/permissions/requesting — "Ask for a permission in context…" (Android Developers, Google, undated, fetched 2026-11-12)]. Our notification step sits after account creation and only 380 of 793 riders reach it [SOURCE: evidence pack §2].

**F5. Pre-filled progress raises completion.** Car-wash loyalty cards: 8 empty stamps gave 19% completion; 10 stamps with 2 pre-stamped gave 34% over 9 months, n=300 [SOURCE: https://www.coglode.com/nuggets/endowed-progress-effect — "19%" vs "34%" (Coglode summary of Nunes & Drèze 2006, J. Consumer Research 32(4))]. Offline retail loyalty, not an app: it transfers as a principle for a progress card only; the size should not be assumed.

**F6. Vendor guidance agrees** that progress bars "work best when they show a substantial percentage already filled out", and that the empty state is "one of the most common silent drop-off points in early activation" [SOURCE: https://www.appcues.com/blog/user-onboarding-guide — (Appcues (vendor), 2026-06-09)]. Unsourced vendor claims; corroboration only.

**F7. If-then plans help people act on intentions; the effect on behaviour is small to modest.** Implementation intentions are "specific if–then plans that connect a future situation with a response". The 2006 meta-analysis found d = 0.65 for goal attainment across 94 tests. The 2024 update (642 tests) finds an **overall** average of d = 0.36 (95% CI 0.33–0.40) across behavioural, cognitive, affective and social-judgment outcomes, and **d = 0.27 for behaviour change specifically**. Bias corrections of the *overall* estimate give d = 0.35 (trim-and-fill) and d = 0.15 (robust Bayesian, 95% CI 0.08–0.22); the page notes the 0.15 is "an adjusted overall estimate, not the estimate for behavior alone" [SOURCE: https://www.thebehavioralscientist.com/glossary/implementation-intentions — "d = 0.27" for behaviour; "d = 0.15 (95% CI 0.08–0.22)" adjusted overall (The Behavioral Scientist glossary, citing Gollwitzer & Sheeran 2006 and Sheeran, Listrom & Gollwitzer 2024; re-opened 2026-11-12)]. Lab and health-behaviour studies, not apps. For a seasonal motorcycle app, "When's your next ride?" is a natural if-then prompt; expect a small effect, not a doubling.

**F8. Comparable vehicle-logging apps say plainly when value arrives.** Drivvo: "Download Drivvo, add your vehicle and log your next fill-up… By the second one, your first fuel economy figure shows up" [SOURCE: https://drivvo.com/ — (Drivvo homepage (vendor), fetched 2026-11-12)]. MotoVault's ride value also arrives on the next real ride, and the app never says so.

**F9. Motorcycle tracking apps treat GPS setup as something to teach.** REVER tells riders to avoid places where "the signal could [not] be blocked such as under your seat or in a metal saddlebag" [SOURCE: https://rever.co/post/five-simple-tips-to-get-the-most-out-of-rever — (REVER, 2020-09-30)]. In REVER it is a blog post, so it reaches no one in the first session.

**F10. Competitors on the paywall around first use.** komoot: "a new account gets a 10EUR discount for the first 10 days" [SOURCE: https://dcrainmaker.com/2025/03/komoots-expanded-paywalls-trying-to-make-sense-of-it.html — (DC Rainmaker, 2025-03)]. Context for the monetization member only; I do **not** propose changing the paywall (hard constraint).

**F11. Strava's onboarding sets up recording and social before the first activity (weak).** [SOURCE: https://screensdesign.com/articles/strava-onboarding-design/ — "Background access carries a clear cost" (ScreensDesign, undated)]. A blog's "roughly 20-30% of users complete even one workout in their first week" is **unsourced** and from a daily-use category [SOURCE: https://dev.to/paywallpro/fitness-app-onboarding-guide-data-motivation-completion-an0 — (paywallpro on DEV, 2025-12-22; possibly vendor)]. Not a benchmark for us.

**F12. Sequential stopping needs a 50/50 split.** Evan Miller's rule: "Assign subjects randomly to the treatment and control, with 50% probability each"; "If T-C reaches 2√N, stop the test"; "If T+C reaches N, stop the test. Declare no winner" [SOURCE: https://www.evanmiller.org/sequential-ab-testing.html — steps 2, 5, 6 (Evan Miller, 2015-10-13; re-opened 2026-11-12)]. For unequal allocation the board's analyst points to always-valid p-values (mSPRT) [SOURCE: board/06-experimentation-analyst.md F6].

**F13. Our own data:** guard pattern on current builds, the per-trigger baseline, completer baselines, and the What's New fix [SOURCE: PostHog NEW q-02a … q-02e].

## Proposals

Ranked. P02.1 and P02.2 are the two experiments I put forward for #365, **shipped as one post-onboarding package**, in the board's single 50/50 slot (P06.2) if the P06.1 ledger puts it there (Branch A), or after the nudge test if it does not (Branch B; see P02.1 "Sequencing"). P02.3 is **withdrawn** in favour of P05.2 (see Responses). None of them touches onboarding screens, the `onboarding_paywall_2026q4` arms, or RevenueCat experiment `expd7c1d56904`. All happen after `onboarding_completed`.

### P02.1 — "Plan your first ride" on the first home screen

- **Hypothesis.** Riders finish onboarding at home with nothing they can do now. Asking *when* they'll ride next, and reminding them then, turns day-0 intent into a day 1–7 ride [SOURCE: F7, F8; evidence pack §3]. The effect size is [UNBACKED — own idea].
- **Exact change.**
  1. The `OnboardingChecklist` card gets a new top row for riders with no saved ride, using the existing `CHECKLIST_ITEM_ID.FIRST_RIDE` item, which stops linking to `PROFILE_ROUTE.RIDES` [SOURCE: apps/mobile/src/stores/checklist.store.ts:67-70]. Tapping it opens a small sheet:
     - Title: "When's your next ride?"
     - Chips (board set, adopted from P03.1 in round 2): "Today", "Tomorrow", "This weekend", "Not sure yet". Fire times are 03's defaults, which 03 itself marks unbacked: Today → +3 h, capped at 19:00 local; Tomorrow → 10:00 local; This weekend → next Saturday 10:00 local; Not sure yet → no reminder [SOURCE: board/03-behavioural-scientist.md P03.1 timing]
     - Body: **"Tap Start once you're rolling. Rides shorter than 30 seconds or 50 m aren't saved."** Both numbers come from `MIN_RIDE_ELAPSED_S = 30` / `MIN_RIDE_DISTANCE_M = 50` and must be interpolated from them, not hard-coded [SOURCE: apps/mobile/src/utils/ride-constants.ts:25-26; ride-hud.tsx:218].
     - Choosing a time schedules **one local notification** of the board's single kind, `NOTIFICATION_KIND.ACTIVATION_NEXT_RIDE = 'activation_next_ride'` (the single activation reminder slot, see Responses 2), e.g. "Riding today? Tap Start when you roll out — we'll log the route and distance for you." If the OS notification permission is missing, ask for it *here*, once, only after a chip tap [SOURCE: F4]. If it is denied, show "We'll keep this card here for you" and change nothing else.
  2. **Endowed progress (bundled, accepted).** Add a "Bike added" row, already ticked when onboarding saved a bike, so the card starts at 1 of 6 instead of 0 of 5 [SOURCE: F5, F6]. This ships in the same arm as the plan sheet; I accept that their effects cannot be separated (Answers R1.8).
  3. **Events:** `post_onboarding_landed {screen, variant}` (fills a §9 gap); `first_ride_plan_viewed`; `first_ride_plan_set {when: 'today'|'tomorrow'|'weekend'|'not_sure', source: 'card'|'guard_sheet'}`; the **existing** `reminder_scheduled` event [SOURCE: apps/mobile/src/lib/analytics.ts:788 (origin/main)] with `{kind:'activation_next_ride', fire_at, when}`; the existing `reminder_opened {kind:'activation_next_ride'}`. No new `activation_reminder_scheduled` event and no `activation_first_ride` kind. Every event carries the holdout `variant`. All copy through i18n (CI `check:i18n`).
- **Target metric (one primary, completers only).** **Core action within 7 days of `onboarding_completed`, among completers: baseline 61/367 (16.6%)**; monthly Aug 17/61, Sep 25/162, Oct 16/127 [SOURCE: PostHog NEW q-02d, q-02e]. Secondary: saved real ride within 7 days among track_rides completers, **25/197 (12.7%)** [SOURCE: PostHog NEW q-02d]. Guardrails: day-2 return among completers, **58/367 (15.8%)** [SOURCE: evidence pack §2], excluding opens that come from a reminder tap, and `activation_24h` (P06.2).
- **Expected effect.** [UNBACKED — own idea] A gain of a few points at most. F7's behaviour-specific estimate is d = 0.27 in lab and health studies, the robust-Bayesian *overall* estimate is lower (0.15), and the reminder only reaches riders who grant permission.
- **Effort.** M: card row, sheet, local-notification scheduling (`lib/notifications.ts`), events, i18n.
- **Pre-launch delivery check (added round 2).** A *date-scheduled* local notification on Android has been seen opened only once ever, and the app has no exact-alarm permission, so Android delivers late by design [SOURCE: board/04-lifecycle-crm.md Diagnosis, PostHog query F; apps/mobile/app.config.ts:379-389]. Before launch, schedule a "Tomorrow 10:00" reminder on one physical Android device and log when it arrives. If it arrives hours late, Android riders get the card only (no reminder promise in the copy) until that is fixed.
- **Risk to the onboarding paywall.** None direct. The card renders on Home after the paywall in both arms; it does not touch the paywall step or its placements.
- **Sequencing: which test holds the single randomized slot (rewritten round 2).** The board has one 50/50 slot (P06.2) and one ledger (P06.1). 06 recommends the day-1 nudge (P04.1) for the slot; I recommend this package. The ledger owner records the choice; my file follows it. What ships when in each branch:
  - **Branch A — package in the slot (my recommendation).** Flag `activation_365_first_session`, assigned at `onboarding_completed` for **all** completers. Test arm: plan card + 1-of-6 row + in-context permission ask + P02.2 teaching sheet + P04.1's 18:00 message as the fallback for granted riders who set no plan. Control: today's app. No separate P04.1 test runs, so 04's step 5 ("don't change who becomes eligible during the nudge test") is not triggered. Primary: week-1 core action among completers. Ends at the first Miller boundary or the 2026-03-31 cap; then the winner ships to everyone and the nudge can get its own slot.
  - **Branch B — nudge in the slot (06's recommendation).** The nudge test enrols granted completers. Under 06's P06.3 rule no other change ships before/after while it runs [SOURCE: board/06-experimentation-analyst.md P06.3], and my permission ask would change the nudge's eligible group [SOURCE: board/04-lifecycle-crm.md P04.1 step 5]. So **the whole package waits**: nothing from P02.1 or P02.2 ships until the nudge test stops (boundary or 2026-03-31). Then it ships on the P06.3 no-harm path, with only the mechanism chain in counts as evidence, because an April before/after runs into the start of the riding season. I do **not** support the third option (package bundled into the nudge's test arm): the read would be "package + nudge vs nothing" on the nudge's day-2 metric, which answers neither question.
  - In both branches every read uses **assigned** riders as the denominator (intent-to-treat), never "riders who granted" [SOURCE: board/06-experimentation-analyst.md F10, Dmitriev et al. via The Morning Paper].
- **Measuring at ~7 installs/day (~30 completers/week).** Three layers:
  1. **Mechanism check, readable in 2–3 weeks:** `first_ride_plan_set` / `post_onboarding_landed` in the treatment arm, and reminders opened / scheduled, in counts. If fewer than about 1 in 5 set a plan, stop: no downstream effect is possible. [UNBACKED — own threshold]
  2. **Concurrent control (Branch A only):** a **50/50** split of completers (the P06.2 slot), Evan Miller's sequential rule on the primary [SOURCE: F12], with **06's ledger values: N = 64, ship if T − C ≥ 16, stop with no winner at T + C = 64, calendar cap 2026-03-31** [SOURCE: board/06-experimentation-analyst.md P06.2]. I drop my earlier N = 100: in my cap simulation it has lower power at the cap in every case where the cap binds [SOURCE: q-02g sim]. **Power at the cap** (probability of hitting the ship boundary before 2026-03-31; launch 2026-12-01 = 120 days, or 2026-12-15 = 106 days) [SOURCE: q-02g sim, own simulation, 4,000 runs per cell]:
     | Baseline (completers) | Completers/day | Effect | Launch 12-01 | Launch 12-15 |
     |---|---|---|---|---|
     | 16.6% (window average) | 3.0 (window average) | ×2 | 0.83 | 0.83 |
     | 16.6% | 2.1 (winter, 06's ×1.4 slowdown) | ×2 | 0.78 | 0.70 |
     | 12.6% (Oct, 16/127) | 2.1 | ×2 | 0.58 | 0.45 |
     | 12.6% | 2.1 | ×1.5 | 0.14 | 0.09 |
     | either | 2.1 | none | ≤ 0.02 (false ship) | ≤ 0.01 |
     The realistic row is the third: about a coin flip for a doubling, and almost no chance for a 50% lift. The 7-day metric also means riders enrolled in the last week before the cap cannot be scored, which the simulation ignores, so these numbers are slightly optimistic. **At the cap**, report T, C and the difference with a 90% interval; a cap without a boundary hit means "no doubling shown", never "no effect". If the board wants an unequal split, use mSPRT instead [SOURCE: F12].
  3. **No-harm check:** guardrails above, weekly series per arm, in counts.
- **Light/dark.** The card already uses `useEditorialTheme` tokens (`theme.surface`, `ink`, `ink2`, `surface2`) [SOURCE: apps/mobile/src/components/home/onboarding-checklist.tsx:48, 98-143 (working branch)]. The sheet and chips use the same tokens, selected chips on `theme.warm`/`onWarm`. Screenshot both modes before merge.

### P02.2 — Make the "ride too short" guard teach first-time riders

- **Hypothesis.** On current builds most guard sheets fire at a standstill (20 of 31 sheets, 16 riders, < 10 m and < 30 s), and riders nearly always end anyway (27 End vs 1 Keep) [SOURCE: PostHog NEW q-02a]. For a rider with **no saved ride yet**, "Are you sure?" is a dead end. A sheet that says "this is normal, here's how it works, we'll remind you" keeps the Start-tappers moving toward a real first ride [SOURCE: F2, F9; evidence pack §3 "warm group"].
- **Exact change** (`app/(modals)/ride-hud.tsx`, guard at line 218):
  - Condition: the rider has 0 saved rides AND the guard is the too-short branch (not `isNoGpsRide`, ride-hud.tsx:58-62) AND `distance < 10 m`. On builds ≥ 3.21.0 the too-short branch is already < 120 s, so no separate time gate is needed.
  - Title: neutral ("Testing it out?") unless at least one location fix arrived, which the HUD already tracks (`setGpsAccuracy`, ride-hud.tsx:150); never claim "GPS works" without a fix (Responses 1).
  - Body: **"MotoVault saves a ride once you've been riding for at least 30 seconds and 50 m. Start it when you roll out — keep your phone where it can see the sky, not in a metal case or under the seat."** Numbers interpolated from the constants [SOURCE: ride-constants.ts:25-26]; placement tip adapted from REVER [SOURCE: F9].
  - Primary: "Got it — remind me when I ride". Ends without saving (same path as `handleGuardEndAnyway`) and opens the P02.1 plan sheet.
  - Secondary: "Keep recording" (existing `handleGuardKeepRiding`).
  - `startRide.subtitle` (start-ride.tsx:224) gets a zero-rides variant: "Tap Start once you're on the bike. Rides shorter than 30 seconds or 50 m aren't saved."
  - Primary button's plan sheet writes `first_ride_plan_set {source:'guard_sheet'}` and the same `reminder_scheduled {kind:'activation_next_ride'}` as P02.1 (one kind, one chip set, one pending reminder per rider).
  - **Events:** add `is_first_ride_attempt: true` and `variant: 'teaching'` (01's value, adopted round 2) to `ride_too_short_shown` (which already carries `elapsed_s`, `distance_m`, `action`); add `max_speed_kmh` per pack §9.
  - Do **not** change the 50 m / 30 s thresholds: lowering them would make `ride_completed` count standstill junk (memory `feedback_metric_measures_something_else`).
- **Target metric (canonical trigger, round 2).** Riders whose first sheet with `distance_m < 10` came before any saved real ride → saved a real ride **within 7 days of that sheet**: **1/13 on builds ≥ 3.21.0 (Oct–Nov, anecdote)**; all builds 11/48 [SOURCE: PostHog NEW q-02f]. The q-02c figures (11/45, 10/32) used an extra `elapsed_s < 120` filter and are superseded. The 1/13 is labelled "Oct–Nov, ≥ 3.21.0, anecdote" in the ledger: it is confounded with the season (Diagnosis 3), so a later rise, for example in spring, is **not** a lift. Secondary: next-day open after the trigger, **2/14 on ≥ 3.21.0, 15/49 all builds** [SOURCE: PostHog NEW q-02f]. Downstream it feeds P02.1's primary.
- **Expected effect.** [UNBACKED — own idea] Small and noisy. About 16 riders hit this trigger in the ~6 weeks of ≥ 3.21.0 data [SOURCE: PostHog NEW q-02c], i.e. 2–3 a week.
- **Effort.** S: one conditional branch in an existing sheet, copy strings, one subtitle variant, event properties.
- **When it ships.** With P02.1, in the same branch (P02.1 "Sequencing"): in the slot's test arm in Branch A; after the nudge test stops in Branch B.
- **Risk to the onboarding paywall.** None. Ride HUD, after onboarding.
- **Measuring at 2–3 trigger riders a week.** No A/B test and **no claim of a lift**: a before/after this season puts Aug–Oct against Nov–Jan, and seasonality is the main threat [SOURCE: board/06-experimentation-analyst.md F11, P06.3]. The read is:
  1. **No-harm check** (P06.3 path) on the P02.1 guardrails.
  2. **Mechanism chain in counts:** teaching sheets shown → "remind me" taps → `reminder_opened` → real ride saved within 7 days, e.g. "9 shown, 5 remind-me, 2 opened, 1 saved". No regional split (cells would hold 0–3 riders, and Europe is under-counted by consent [SOURCE: evidence pack §1]).
  3. **Qualitative:** watch up to 10 replays of first Start taps after launch, if mobile replay is on.
  Because it rides in the P02.1 treatment arm, its contribution also shows up, undivided, in the P02.1 holdout.
- **Light/dark.** The HUD is always dark by design (`HUD_THEME = editorialThemes.dark`) [SOURCE: apps/mobile/src/app/(modals)/ride-hud.tsx:34]. Keep the new sheet on `HUD_THEME` tokens. The start-ride subtitle uses that screen's theme tokens. Check both system modes.

### P02.3 — Answer the maintenance promise on first home for maintain_bike riders — **WITHDRAWN**

Merged into **P05.2** (Rider voice), which already has the no-schedule fallback, the delayed-read measurement and the garage_first duplicate-bike warning (Responses 3). My diagnosis stands: maintain_bike riders 3.6% day-2 return, maintenance-first logging does not predict return (1/15) [SOURCE: evidence pack §3, §4], so I do not expect that change to move day-2 return.

## What I'd NOT do, and why

- **Add a "practice ride" or "how tracking works" step inside onboarding.** It would change both `onboarding_paywall_2026q4` arms mid-test; onboarding is revenue-critical; NN/g finds tutorials don't improve task performance [SOURCE: F2]. Teach at the guard instead (P02.2).
- **Ask for location (or "Always") during onboarding.** Ask when the rider starts using the feature; repeated denials become permanent on Android [SOURCE: F4].
- **Defer sign-up past onboarding.** `commit_first` puts the paywall straight after account on purpose [SOURCE: apps/mobile/src/config/onboarding.ts:178-183 (working branch)]. Out of bounds this quarter.
- **Spend an experiment on What's New.** Already fixed [SOURCE: PostHog NEW q-02b].
- **Lower the 50 m / 30 s ride floor.** It would inflate `ride_completed` with standstill junk.
- **Lead first home with AI diagnostics.** Not the hero feature; paths through diagnostics: 10 riders, 0 back [SOURCE: evidence pack §5].
- **Use an 80/20 holdout with Miller's rule, or any before/after this winter as proof of a lift.** Miller's rule assumes 50/50 [SOURCE: F12]; seasonality dominates a winter before/after [SOURCE: board/06-experimentation-analyst.md F11].
- **Report checklist completion across the change.** The 0/5 → 1/6 change moves `items_total` in `checklist_item_completed` [SOURCE: apps/mobile/src/stores/checklist.store.ts:209-214]; compare per-item completion by `item` id instead.
- **Copy "fitness app" first-week benchmarks as targets** [SOURCE: F11].

## Appendix — read-only queries (PostHog project 155556)

```sql
-- q-02a (REVISED 2026-11-12): ride_too_short_shown by build, action, distance and time.
-- Cohort first seen 2026-08-14..11-04, q00 test persons excluded.
-- build = $app_version major*10000 + minor*100 >= 32100 ('new>=3.21') else 'old<3.21'
SELECT build, toString(properties.action) AS action, dist_bucket, time_bucket, count() AS n, uniq(person_id) AS riders
FROM events WHERE timestamp >= '2026-08-14' AND timestamp < '2026-11-13'
  AND event = 'ride_too_short_shown' AND person_id IN (SELECT pid FROM c)   -- c = cohort CTE with q00 exclusions
GROUP BY build, action, dist_bucket, time_bucket
-- result, builds >= 3.21.0, action = 'shown': <10m/<30s 20 rows (16 riders) | <10m/30-119s 3 (2) | 10-49m/<30s 1 (1) | >=50m/<30s 7 (1) = 31
--         decisions on >= 3.21.0: end 27, keep 1
-- builds < 3.21.0: 8 'shown', 83 'keep', 71 'end' rows, incl. 36 rows at >= 120 s (no-GPS rides, now ride_zero_distance_shown)
-- total rows all builds = 221 (= the pack's figure; it counts rows, not sheets)

-- q-02b: What's New within 1h of onboarding_completed, before vs after the 3.25.0 suppression (unchanged; no q00 exclusion)
-- result: before 10-12: 278 completers, 112 saw What's New within 1h | from 10-12: 90 completers, 0

-- q-02c (NEW): per rider, first ride_too_short_shown with distance_m < 10 and elapsed_s < 120 (t_trig),
-- first real ride_completed (below_min_ride not true) t_ride; trigger counted only if no real ride before it.
-- result: builds < 3.21.0: 38 triggered, 32 with no ride before, 10/32 saved within 7d, 11 opened next day
--         builds >= 3.21.0: 16 triggered, 14 with no ride before, 1/13 (7d-eligible) saved within 7d, 2 opened next day

-- q-02d (NEW): onboarding completers (q00 excluded), core action within 7 days of onboarding_completed, by goal
-- result: track_rides 197 completers, ride_7d 25, core_7d 47, day-2 42 | other goals 170, ride_7d 2, core_7d 14, day-2 16
--         total 367, core_7d 61 (16.6%), day-2 58

-- q-02e (NEW): same, by completion month: Aug 17/61, Sep 25/162, Oct 16/127, Nov 3/17 (partial)

-- q-02f (ROUND 2, canonical trigger): per rider (cohort + q00 exclusions),
--   t_trig = first ride_too_short_shown with distance_m < 10 (any action row, any day, no elapsed filter),
--   build = $app_version of that row, t_ride = first ride_completed with below_min_ride not true.
--   eligible = no real ride before t_trig AND t_trig < 2026-11-05; saved_7d = t_ride in (t_trig, t_trig + 7d].
SELECT build, toStartOfMonth(t_trig) AS m, count() AS triggered,
  countIf(no_ride_before) AS no_ride_before, countIf(no_ride_before AND t_trig < '2026-11-05') AS eligible_7d,
  countIf(t_ride > t_trig AND t_ride <= t_trig + INTERVAL 7 DAY AND t_trig < '2026-11-05') AS saved_7d,
  countIf(no_ride_before AND has(days, toDate(t_trig) + 1)) AS next_day_open
FROM r GROUP BY build, m
-- result (build | month | triggered | no ride before | eligible 7d | saved 7d | next-day open):
--   >=3.21 | Oct | 14 | 12 | 12 | 1 | 2      >=3.21 | Nov | 2 | 2 | 1 | 0 | 0
--   <3.21  | Aug |  7 |  6 |  6 | 1 | 2      <3.21  | Sep | 32 | 28 | 28 | 8 | 10     <3.21 | Oct | 2 | 1 | 1 | 1 | 1
--   totals: >=3.21 1/13; <3.21 10/35; all 11/48 (= 01's q01-r2-a 11/48)
```

```python
# q-02g sim (ROUND 2): Evan Miller rule (50/50, ship at T-C >= ceil(2*sqrt(N)), stop at T+C = N)
# with Poisson enrolment and a calendar cap. Python 3 stdlib, seed 7, 4,000 runs per cell. Run with python3 -I.
import random, math
def run(pc, mult, N, per_day, days, reps=4000, seed=7):
    rnd = random.Random(seed); d = math.ceil(2*math.sqrt(N)); ship = nowin = 0
    for _ in range(reps):
        T = C = 0; t = 0.0; res = 'cap'
        while True:
            t += rnd.expovariate(per_day)
            if t > days: break
            if rnd.random() < 0.5:
                T += rnd.random() < pc*mult
            else:
                C += rnd.random() < pc
            if T - C >= d: res = 'ship'; break
            if T + C >= N: res = 'nowin'; break
        ship += res == 'ship'; nowin += res == 'nowin'
    return ship/reps, nowin/reps
# selected output, P(ship by cap): N=64: 16.6%/3.0d/x2 120d 0.83; 16.6%/2.1d/x2 120d 0.78, 106d 0.70;
#   12.6%/2.1d/x2 120d 0.58, 106d 0.45; 12.6%/2.1d/x1.5 120d 0.14; x1.0 <= 0.02.
#   N=100: 16.6%/2.1d/x2 120d 0.60; 12.6%/2.1d/x2 120d 0.33 (lower than N=64 whenever the cap binds).
```

Caveat (closed in Skeptic round 2): core action includes `maintenance_task_created`, which on origin/main fires only from `add-maintenance-task.tsx:203`, a rider action, so the 61/367 completer baseline is not inflated by OEM schedule imports [SOURCE: board/review-02-onboarding-ux.md Round 2].

## Responses

Written after reading drafts 01, 03, 04, 05 and 06 (2026-11-12). **Numbers in item 1 were updated in the round-1 revision** to the q-02a re-cut on builds ≥ 3.21.0.

**1. On P01.1, P03.2 and P05.1: combine them with my P02.2 into one guard-sheet spec, and fix two conditions.** Four of six members propose the same change; it should ship as one spec.
- **Gate on distance, not only on "the guard tripped".** P01.1 and P03.2 would also catch riders who moved ≥ 50 m in under 30 s (on current builds 7 sheets, 1 rider) [SOURCE: PostHog NEW q-02a], because the guard fires on `elapsed < MIN_RIDE_ELAPSED_S || dist < MIN_RIDE_DISTANCE_M` [SOURCE: ride-hud.tsx:218]. Telling them "test ride" is wrong. The bulk is < 10 m and < 30 s (20 of 31 sheets, 16 riders). I propose: 0 saved rides AND too-short branch AND `distance_m < 10`. P05.1's `< 50 m` would also work. Use one threshold, written in the P06.1 ledger before launch.
- **Do not claim "GPS works" unless a fix arrived.** The HUD knows whether a point with accuracy arrived [SOURCE: ride-hud.tsx:150]. Use the "it works" title only then; otherwise a neutral title (P05.1's "Testing it out?") plus the sky-view tip [SOURCE: F9]. A ✓ needs a contrast check on the always-dark `HUD_THEME` [SOURCE: ride-hud.tsx:34].

**2. On P03.1, P01.2 and P04.1: one reminder slot per rider; the rider's own plan takes priority.** (a) One `NOTIFICATION_KIND` (`activation_next_ride`, round 2), one chip set (P03.1's), one pending reminder per rider, cancelled by any core action (P04.1 step 3). (b) A plan set on the card or guard sheet replaces the default time. (c) Only riders who granted permission and set no plan get P04.1's goal-branched 18:00 day-1 message. Where I challenge P03.1: the plan chip is the in-context moment the Android guidance describes [SOURCE: F4]; keep **one** ask, only on a chip tap. Day-2 return must exclude reminder-tap opens. Which test holds the slot, and what ships when in each case, is in P02.1 "Sequencing" above.

**3. On P06.2: one 50/50 holdout for the combined first-session package; the primary is 7-day core action among completers, not `activation_24h`.** The plan card and guard sheet both defer the ride to the rider's next real ride, so a 24-hour window would score a Saturday rider as a failure. Primary: core action within 7 days of `onboarding_completed` (baseline 61/367) [SOURCE: PostHog NEW q-02d]. Guardrails: `activation_24h` and day-2 return. **I withdraw P02.3 in favour of P05.2** as the single maintenance spec, in its own stratum and metric.

## Answers to review

### Round 1

**R1.1 — fixed.** F7 now gives d = 0.36 as the overall 2024 average (642 tests), d = 0.27 for behaviour change, and 0.35 / 0.15 as bias corrections of the *overall* estimate, quoting the page's "not the estimate for behavior alone" [SOURCE: https://www.thebehavioralscientist.com/glossary/implementation-intentions — re-opened 2026-11-12]. P02.1's "Expected effect" no longer calls 0.15–0.35 a behaviour range.

**R1.2 — fixed.** The 20% holdout is gone. P02.1 uses the board's single **50/50** holdout (P06.2) with Miller's rule, whose step 2 requires 50/50 [SOURCE: F12]; if anyone wants unequal allocation, mSPRT [SOURCE: board/06-experimentation-analyst.md F6]. I also state what it can detect: at ~5 baseline successes a week, N = 100 takes about 20 weeks and an early stop needs T − C ≥ 20, so only a large effect [UNBACKED — own arithmetic].

**R1.3 — fixed.** One primary: **core action within 7 days of `onboarding_completed`, completers only, 61/367 (16.6%)**, with the monthly series [SOURCE: PostHog NEW q-02d, q-02e]. Secondary computed: **track_rides completers who saved a real ride within 7 days, 25/197 (12.7%)** [SOURCE: PostHog NEW q-02d]. Day-2 return among completers (58/367) moved to a guardrail. The 72/793 all-install figure is no longer used for P02.1.

**R1.4 — fixed.** The ask ships **before** any P04.1 test, inside the package's treatment arm from day one of the 50/50 holdout, with P04.1's 18:00 message as the in-arm fallback, so no separate P04.1 test runs while the ask is live. If the board runs P04.1 standalone first, the ask waits until it reads out. All reads use assigned completers as the denominator, never "granted" riders, which removes the ratio-metric problem [SOURCE: board/06-experimentation-analyst.md F10].

**R1.5 — fixed.** All copy now carries both conditions: "Rides shorter than 30 seconds or 50 m aren't saved" (card body and start-ride subtitle) and "once you've been riding for at least 30 seconds and 50 m" (guard sheet), with the numbers interpolated from `MIN_RIDE_ELAPSED_S` / `MIN_RIDE_DISTANCE_M` [SOURCE: ride-constants.ts:25-26; ride-hud.tsx:218].

**R1.6 — fixed, and the re-run found a bigger problem than flagged.** (a) Baseline re-cut to the trigger and the 7-day window: 11/45 overall, **1/13 on builds ≥ 3.21.0**, 10/32 on older builds [SOURCE: PostHog NEW q-02c]; P02.2 uses the ≥ 3.21.0 count. (b) q-02a re-run with a build split: on ≥ 3.21.0, 31 sheets, 20 (16 riders) at < 10 m / < 30 s, 7 (1 rider) at ≥ 50 m / < 30 s; 36 old-build rows are ≥ 120 s no-GPS rides, as you said. Beyond that, `ride_too_short_shown` writes one row per *action* (`shown`, `keep`, `end`) [SOURCE: ride-hud.tsx:218-245], and old builds wrote mostly decision rows, so the pack's "221 times" and my "125 of 221" counted rows, not sheets. The design basis is now the ≥ 3.21.0 `shown` rows. It also shows riders end anyway 27 times to 1. (c) q00 exclusions applied to q-02a, q-02c, q-02d, q-02e (q-02b unchanged; it is not a design basis). The redundant "< 120 s" gate is replaced by "too-short branch" (not `isNoGpsRide`).

**R1.7 — fixed.** P02.2 no longer claims a lift from a before/after. Its read is a no-harm check (P06.3) plus the mechanism chain in counts (sheet → remind-me → `reminder_opened` → saved ride within 7 days), with no regional split [SOURCE: board/06-experimentation-analyst.md F11, P06.3]. Its effect also lands, undivided, inside the P02.1 50/50 holdout. The q-02e monthly series (Aug 28% → Oct 13%) shows why a winter before/after cannot be read as a lift.

**R1.8 — fixed.** I accept the bundle: the 1-of-6 endowed row ships in the same arm as the plan sheet, and their effects are not separated. Checklist completion is not reported across the change, because `checklist_item_completed` carries `items_total`, which moves from 5 to 6 [SOURCE: apps/mobile/src/stores/checklist.store.ts:209-214]; per-item completion by `item` id is reported instead (added to "What I'd NOT do").

### Round 2

**R2.1 — fixed.** P02.1 "Sequencing" now states both branches and defers to the P06.1 ledger. **Branch A (package in the slot, my recommendation):** flag assigned at `onboarding_completed` for all completers; the test arm gets the plan card, 1-of-6 row, in-context ask, P02.2 sheet and P04.1's 18:00 message as the in-arm fallback; no separate nudge test runs, so 04's step 5 is not triggered; primary is week-1 core action among completers. **Branch B (nudge in the slot, 06's recommendation):** the whole package, not only the permission ask, waits until the nudge test stops (boundary or 2026-03-31), then ships on the P06.3 no-harm path with only the mechanism chain as evidence [SOURCE: board/06-experimentation-analyst.md P06.3; board/04-lifecycle-crm.md P04.1 step 5]. I reject the third option you listed (package bundled into the nudge's test arm), because its read on the nudge's day-2 metric answers neither question [UNBACKED — own reasoning]. P02.2 now has a "When it ships" line that follows the same branch.

**R2.2 — fixed.** I adopt 06's N = 64 (ship at T − C ≥ 16) and drop my N = 100. I simulated power **at the 2026-03-31 cap** with Poisson enrolment [SOURCE: q-02g sim, own simulation, script in the appendix]. For a doubling at N = 64: 0.83 at the window-average 16.6% and 3.0 completers/day; 0.78 (launch 12-01) / 0.70 (12-15) at 2.1/day; **0.58 / 0.45 at the October baseline 12.6% and 2.1/day**, which is the realistic case. For a ×1.5 effect, 0.14 / 0.09. With no effect, false ship ≤ 0.02. N = 100 is lower at the cap in every case where the cap binds (e.g. 0.33 vs 0.58 in the realistic case), so one N for the ledger: 64. The power table and "what the cap can say" (T, C, difference with a 90% interval; "no doubling shown", never "no effect") are in P02.1 measurement layer 2. The 7-day metric makes the last week before the cap unscorable, so these figures are slightly optimistic; that is stated too.

**R2.3 — fixed, with one correction to your estimate.** I re-ran the trigger with the board's canonical definition (first sheet with `distance_m < 10`, no real ride before it, any day, no `elapsed_s` filter, 7 days observable) [SOURCE: PostHog NEW q-02f]. Result: **≥ 3.21.0 1/13 (Oct 1/12, Nov 0/1); all builds 11/48**, which reproduces 01's 11/48 (q01-r2-a) and my 1/13. So the board needs two numbers, not four: 1/13 as the comparable baseline, 11/48 as context. 05's 1/14 and 06's 1/10 use different trigger windows (06 counts day-0 sheets only) and should be marked superseded in the ledger, which is 06's file to change. P02.2 and Diagnosis 3 now call 1/13 "Oct–Nov, ≥ 3.21.0, anecdote" and say a later rise is not a lift. On these canonical counts (1/13 vs 10/35) the two-sided Fisher p is about 0.25, not 0.1 [UNBACKED — own arithmetic]. That supports your point: the build gap may be chance, and in any case it is confounded with the season (the ≥ 3.21.0 riders are Oct–Nov, the older ones mostly Sep). My q-02c figures (11/45, 10/32, 13/46) are marked superseded in P02.2.

**R2.4 — fixed.** One kind: **`activation_next_ride`** (`NOTIFICATION_KIND.ACTIVATION_NEXT_RIDE`), the name 01, 03 and 05 already use; I drop `activation_first_ride`, and 04's `activation` should map to it. One chip set: **03's "Today / Tomorrow / This weekend / Not sure yet"**, because it is the only one with written fire times and an explicit no-reminder choice [SOURCE: board/03-behavioural-scientist.md P03.1]; I drop my "Later today", and 05's "Pick a day" is out. One schedule event: the **existing** `reminder_scheduled` [SOURCE: apps/mobile/src/lib/analytics.ts:788 (origin/main)] with `{kind:'activation_next_ride', fire_at, when}`, not 01/05's new `activation_reminder_scheduled`; plus `first_ride_plan_set {when, source}` so card and guard-sheet plans can be told apart. P02.2's variant value is 01's `'teaching'`. These are written into P02.1 and P02.2; aligning the other files is their owners' job.
