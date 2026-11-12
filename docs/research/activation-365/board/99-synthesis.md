# #365 board: Synthesis and proposed plan (chair)

2026-11-12. Issue #365 "Activation: first session and first core action". Research and planning only: no code, flag, PostHog, RevenueCat or GitHub change was made.

**What I read:** the evidence pack, `push-tokens-investigation.md`, the six persona files (final drafts, including their "Answers to review"), the six skeptic reviews (rounds 1 and 2) and `review-verdicts.md`.

**What I added:**
- one read-only Supabase SELECT that extends the schedule-import check to 2026-11-11 by install week (Appendix A, `q99-day0-schedule-weekly`);
- one local re-run of 04's cap-test simulation with the bundle's inputs (Appendix B, `q99-capsim`);
- three source pages re-opened in this session (Evan Miller, The Behavioral Scientist glossary, Android alarms docs).

Every other external source below was opened by the board member named in the tag and re-checked by the Skeptic. For those I cite the board file, not the URL, because I did not open them myself.

---

> **Update 2026-11-12 (after the board ran): P04.2 is shipped.** Firebase app + FCM V1 key in EAS, `google-services.json`
> committed, failure reporting and a guard test merged in PR #393 (`52d281e9`). Android build 3.28.0 versionCode 99
> (EAS `27018d56`) goes to the Play internal track as a draft; production promotion is the owner's call once vc98 clears
> Google review. Owner decision 7 below is answered: the file is committed. Still to verify: the first `android` row in
> `device_push_tokens` after someone installs vc99.

## 1. Diagnosis the board agrees on

1. **Onboarding is not the main leak. The first session after it is.**
   - 46% finish onboarding, but only 15.8% of finishers come back on day 2 (58/367). Of the riders who don't finish, 3.3% come back [SOURCE: evidence pack §2].
   - Activation happens on day 0 or not at all. Of the 61 riders who did a core action in week 1, 40 did it within 1 h and 56 within 24 h. All 56 are onboarding completers [SOURCE: evidence pack §3; SOURCE: board/06-experimentation-analyst.md:8].
   - So the first Home screen after `onboarding_completed` *is* the activation surface [SOURCE: board/02-onboarding-ux.md:8].

2. **A saved real ride is the aha moment, and most first attempts can't reach it.**
   - Riders whose first core action is a saved ride come back on day 2 at 83% (20/24). Maintenance-first riders come back at 7% (1/15) [SOURCE: evidence pack §3].
   - Part of that link is selection: people who ride at all are riders. Pushing more riders to a ride should therefore lift return by much less than 83% vs 5.7% suggests [SOURCE: evidence pack §3 caveat; SOURCE: board/06-experimentation-analyst.md:22].
   - On builds ≥ 3.21.0, 20 of 31 "ride too short" sheets (16 riders) fired at under 10 m and under 30 s. Riders chose "End anyway" 27 times and "Keep riding" once [SOURCE: board/02-onboarding-ux.md:10, PostHog q-02a].
   - These riders are testing the button at home, and the sheet treats it as an error.

3. **Nothing calls a rider back, and on Android server push can't.**
   - There is no day-0 → day-7 message of any kind [SOURCE: evidence pack §1].
   - All 105 push tokens ever stored are iOS, because Android has no FCM configuration. The failure is silent: `logger.warn` is a no-op in production [SOURCE: push-tokens-investigation.md; SOURCE: board/04-lifecycle-crm.md:9-15].
   - Local notifications are a separate path and need no FCM. But a *date-scheduled* local notification has never been seen opened on Android in our data [SOURCE: board/01-activation-pm.md:44, PostHog q01-r2-c].
   - The app uses inexact alarms. Android delivers those "within one hour of the supplied trigger time, unless any battery-saving restrictions are in effect such as battery saver or Doze", and "Any scheduled alarms are deferred until the device exits Doze" [SOURCE: https://developer.android.com/develop/background-work/services/alarms/schedule — "within one hour of the supplied trigger time" (Android Developers, Google, opened 2026-11-12)].

4. **The maintenance promise the web makes is broken in the app, and got worse in October.**
   - 62% of web search clicks land on model-specific maintenance-schedule posts [SOURCE: evidence pack §7, GSC page 2026-08-14..11-10].
   - Only 17 of 336 cohort first bikes (5%) match a model-level schedule [SOURCE: board/05-rider-voice.md:99-104, Supabase S1].
   - A bike with no tasks shows "No service due" on the Home plate [SOURCE: board/05-rider-voice.md:29; apps/mobile/src/components/home/home-plate.ts:96-103 as cited there].
   - **New in this synthesis:** the drop in day-0 schedule import starts in the install week of **2026-10-12**, not on Oct 1.
     - Before (weeks of 08-10 → 10-05): 127 of 204 first bikes created on sign-up day had a task within a day (62%).
     - After (weeks of 10-12 → 11-02): 25 of 111 (23%).
     - The drop is **not only blank-model bikes**. Bikes with a model fell to 20 of 68 (29%); blank-model bikes, which appear from 10-12, are at 5 of 43.
     - The partial week of 11-09 (3 days) shows 13 of 25. That could be the start of a recovery, or noise. I have not explained it [SOURCE: Supabase prod, read-only, q99-day0-schedule-weekly, Appendix A].
   - The Skeptic's own check (44/127 for Oct 1–Nov 4) agrees [SOURCE: board/review-verdicts.md, "One check I ran myself"]. **The cause is still unverified.**
   - [UNBACKED — own reading] The timing matches the 3.26.0 / make-only-bike work around 10-13 → 10-15 (memory `project_onboarding_make_only_bike_dropped`).

5. **Money is decided before activation can happen.**
   - Every trial and the one web annual sale happened at hour 0 inside onboarding, before any core action. In-app paywalls sold nothing [SOURCE: evidence pack §6].
   - So a change that starts at `onboarding_completed` cannot change trial *starts*. It can only change cancellations and renewals. That protects the paywall guardrail by design [SOURCE: board/06-experimentation-analyst.md:10, :59].

6. **Volume allows only doubling-sized effects to be detected, and winter makes it slower.**
   - Weekly day-2 return swings 3–12%. That swing is binomial noise (variance ratio 0.60) [SOURCE: evidence pack §2; SOURCE: board/06-experimentation-analyst.md:38].
   - A 50/50 test needs about 1,500 installs to detect +50% on day-2 return [SOURCE: board/06-experimentation-analyst.md:26-34].
   - Every sourced effect for the board's mechanisms is small:
     - implementation intentions: d = 0.27 for behaviour [SOURCE: https://www.thebehavioralscientist.com/glossary/implementation-intentions — "d = 0.27" behaviour; 0.15 is "an adjusted overall estimate, not the estimate for behavior alone" (The Behavioral Scientist, opened 2026-11-12)];
     - Duolingo reminder tuning: +2% new-user retention [SOURCE: board/01-activation-pm.md:38]. Transfer: Duolingo is a daily-habit language app that already sent reminders. Its result is a lower bound on what *tuning* adds, not a forecast for a first message in a seasonal utility.
   - Any test we run is powered for a doubling. **A "no winner" is the most likely result**, and it means "no doubling shown", not "no effect" [SOURCE: board/review-verdicts.md, "Expectations"].

7. **Settled, so not worth an experiment.**
   - What's New is already hidden for new riders, since 3.25.0. After 10-12, 0 of 90 completers saw it [SOURCE: board/02-onboarding-ux.md:12].
   - "Not now" on the notifications step is already tracked as `onboarding_step_completed {skipped:true}` [SOURCE: board/06-experimentation-analyst.md:70].
   - `ride_too_short_shown` already carries `elapsed_s` and `distance_m`. Only `max_speed_kmh` is missing [SOURCE: board/06-experimentation-analyst.md:78].

## 2. Open disagreements, and how I resolve them

| # | Disagreement | Positions | Chair's resolution |
|---|---|---|---|
| D1 | What holds the single randomized slot | Bundle (first-session package + day-1 nudge as fallback, all completers): 02, 01, 06 (final), 03 accepts it. Nudge alone (granted completers): 04 still argues this, and 03's "Ships when" text says the package should wait [SOURCE: board/04-lifecycle-crm.md:159; board/03-behavioural-scientist.md:226-234] | **Bundle.** The nudge alone reaches power 0.17–0.42 for a doubling by the 2026-03-31 cap. Under P06.3 it would also block the package all winter [SOURCE: board/06-experimentation-analyst.md:90-95, :129-131]. 04's and 03's texts become void once the owner signs the ledger. |
| D2 | How much power the bundle really has | 06: 0.83 at 3.0 completers/day on a 16.6% baseline. 02: 0.45–0.58 at the October baseline (12.6%) and 2.1/day [SOURCE: board/06-experimentation-analyst.md:125; board/02-onboarding-ux.md:72-79] | Plan on 02's realistic row. **Adopt 04's cap z-test** (D3), which lifts that row to 0.76 (Appendix B). |
| D3 | Stopping rule | 06: Miller only. 04: Miller as an early stop, plus **one** one-sided two-proportion z-test at the cap [SOURCE: board/04-lifecycle-crm.md:160-172] | **Adopt 04's.** I re-ran it with the bundle's inputs. At 12.6% and 2.1/day, power for ×2 goes from 0.39 to 0.76 and for ×1.5 to 0.35. False positives stay at 4.9–5.7% (Appendix B) [UNBACKED — own simulation]. The Skeptic asked for exactly this choice [SOURCE: board/review-verdicts.md P06.2 row]. |
| D4 | Four specs for one feature | Notification kind: `activation_next_ride` / `activation` / `activation_d1` / `activation_first_ride`. Plan event: `first_ride_plan_set` vs `next_ride_plan_set`. Variant: `teaching` vs `teach`. First chip: "Today" vs "Later today". Copy: 01 and 05 still say "moved more than 50 m" [SOURCE: board/review-verdicts.md, "One spec, not four"] | One spec (§4, Experiment 1). Copy states **both** save conditions, interpolated from the constants [SOURCE: board/03-behavioural-scientist.md:280-288]. The "Today"/"Later today" wording goes to the owner. |
| D5 | Copy of the `maintain_bike` branch of the day-1 fallback | 04 and 05: "When did you last…?", naming the tier. 01: owner picks. 04's first draft: expense copy based on 41% expense-first return, which is selection [SOURCE: board/04-lifecycle-crm.md:131-138] | An **owner bet**, frozen before launch and reported per branch as description only. It reaches very few riders (Appendix A: few bikes have tasks at all since 10-12). |
| D6 | Where P05.2 sits against the slot | 05 puts its plate change on the no-harm path. 06's rule says a first-week Home change ships only inside the test arm [SOURCE: board/06-experimentation-analyst.md:169; board/review-verdicts.md P05.2 row] | **Split P05.2.** Step 5, the import fix, is a both-arm bug fix and ships now (Experiment 2). The plate change waits for the slot to end, or goes into the test arm only if the owner accepts an even larger bundle (not recommended). |
| D7 | Whether to start the slot at all if launch slips | 04: if launch slips past early January, don't start it this season [SOURCE: board/04-lifecycle-crm.md:172] | Adopted. The latest start is **2027-01-06**. After that, ship to everyone on the P06.3 no-harm path and say plainly that no lift was measured. |
| D8 | Whether a winter before/after can show a lift | Settled: it can't. Before/after is a harm check only [SOURCE: board/06-experimentation-analyst.md:63, :181] | No member still claims a winter lift after round 2. |

## 3. Ranked list of all proposals

Verdicts are the Skeptic's final ones [SOURCE: board/review-verdicts.md]. The rank is mine, by "strong evidence × can be read at our volume × respects the hard constraints". Effort: S/M/L as the authors gave it.

| Rank | Id | Proposal | Skeptic's verdict | Key sources | Effort | Chair's disposition |
|---|---|---|---|---|---|---|
| 1 | P06.1 | Activation scoreboard, canonical definitions, `experiments.md` ledger, missing events | STRONG | evidence pack §1, §9; 06 F14; Bernal et al. ITS (via board/06:63) | S + S | **Do first.** It is a prerequisite for everything else. |
| 2 | P06.2 | 50/50 slot, assigned at `onboarding_completed` after the paywall, crossed with the paywall tests, Miller stop + cap | STRONG | evanmiller.org (opened); Spotify on peeking, Eppo on stratification (via board/06:55-57) | M | **The design of Experiment 1**, with 04's cap z-test added (D3). |
| 3 | P02.1 | "When's your next ride?" plan card + pre-ticked "Bike added" row | STRONG | checklist.store.ts:67-70 links to an empty list; NN/g empty states; Android in-context permission (via board/02:23-25); d = 0.27 (opened) | M | **Core of Experiment 1.** |
| 4 | P04.2 | Make Android push real (FCM) + visible failures | STRONG | push-tokens-investigation.md; Expo FCM docs (via board/04:12) | S code + Play build | **Ship now** on the both-arm path. The owner has already done the Firebase/EAS steps [SOURCE: push-tokens-investigation.md "Update 2026-11-12"]. |
| 5 | P05.2 step 5 | Fix the October drop in day-0 schedule import; seed missing model rows (MT-07 first) | Part of P05.2 (PLAUSIBLE); the Skeptic says step 5 "deserves to go first as a plain bug fix" | Appendix A; board/05:27, :99-105; GSC §7 | S–M (cause unknown) | **Experiment 2** (a fix with a pre-registered read, not a lift test). |
| 6 | P02.2 / P01.1 / P03.2 / P05.1 | "Ride too short" becomes a teaching sheet with a next-ride reminder (one merged change) | PLAUSIBLE ×4 | q-02a standstill sheets; REVER placement tip; Reddit "constantly forget to start" (via board/05:60) | S | **Inside Experiment 1's test arm.** It reaches only 2–3 riders a week, so it is read as a mechanism chain only. |
| 7 | P03.1 | Same plan card (03's version) | PLAUSIBLE | d = 0.27; RR 1.039 from a workplace well-being app (via board/03) | M | **Merged into P02.1.** 03's chips, times and copy are adopted (§4). |
| 8 | P04.1 / P01.2 | One goal-branched day-1 local notification at 18:00, cancelled by any core action | PLAUSIBLE ×2 | Lenny's survey (#3 lever by mentions); Airship and Braze correlations (vendor); Android alarms docs (opened) | S–M | **In-arm fallback in Experiment 1**, gated on the Android device check. 04's delivery instrumentation is adopted. |
| 9 | P06.3 | Ship-on-no-harm, before/after against a trailing 8-week window | PLAUSIBLE | Bernal et al. 2017 (via board/06:63); own simulation | S per change | **Use it for Experiment 2 and FCM**, read against the slot's control-arm trend (the Skeptic's caveat on winter false reverts). |
| 10 | P05.3 | In-app "why did you install?" card + replies to riders who sent feedback | PLAUSIBLE | Forum and Reddit rider quotes (board/05 F1–F7); consent per `feedbackContact` | S | **Next candidate.** It is a qualitative signal suited to our volume. It shows on the second open, so the card is shown to both arms equally only if it ships before the slot or after it. |
| 11 | P05.2 plate | "Set up service plan" plate state instead of "No service due", with tier labels and "last oil change?" | PLAUSIBLE | home-plate.ts:96-103; ADVrider/Fuelly quotes (board/05 F1, F7) | M | **Next candidate**, after Experiment 2 and after the slot. |
| 12 | P04.3a | iOS provisional authorization on "Maybe later" | PLAUSIBLE | Expo `allowProvisional` docs (via board/04:65) | S | **Later.** It sits on an onboarding screen inside both paywall arms, and the device check on "nothing visible" is not done. |
| 13 | P04.3b | Goal-matched copy on the permission ask | WEAK | Airship "as high as 40%" (vendor, no method given) | S | **Not this season.** It would change a screen inside the running onboarding A/B. |
| 14 | P03.3 | Saturday welcome message | WEAK (parked) | Bidargaddi JMIR 2018, exploratory weekend result (via board/03) | S | **Parked.** One activation message per rider. |
| 15 | P01.3 | Off-season aha for maintenance riders | WEAK (withdrawn) | — | — | Merged into P05.2. |
| 16 | P02.3 | Maintenance promise on first Home | WEAK (withdrawn) | — | — | Merged into P05.2. |

## 4. The proposed plan

### Experiment 1 (randomized, the #365 lift test): "First-ride plan" bundle

- **Hypothesis.** Riders finish onboarding at home with nothing they can do now, and their first Start fails at a standstill. Experiment 1 has three parts: (a) ask *when* they'll ride next and remind them then, (b) turn the standstill "too short" sheet into a confirmation with a next-ride reminder, and (c) send riders who set no plan one goal-matched local message on day 1. Together they raise the share of completers who do a core action in week 1 [SOURCE: board/02-onboarding-ux.md:51; board/06-experimentation-analyst.md:115]. The size of the effect is [UNBACKED]. The test is sized for a doubling, which no source forecasts.

- **Exact change (one spec; it replaces the four variants).** Everything sits behind the PostHog flag `activation_365_first_session`. Control sees today's app.
  1. **Plan card** (P02.1 + P03.1). A new top row on `OnboardingChecklist` for completers with no saved ride, whatever their goal. It replaces the `FIRST_RIDE` link to the empty rides list [SOURCE: apps/mobile/src/stores/checklist.store.ts:67-70 via board/02:11].
     - Sheet title "When's your next ride?".
     - Chips "Today / Tomorrow / This weekend / Not sure yet". The fire times are 03's defaults: +3 h capped at 19:00; 10:00; Saturday 10:00; none. They are [UNBACKED — default choices] [SOURCE: board/03-behavioural-scientist.md:195-201].
     - The OS permission is asked in context, once, after a chip tap [SOURCE: board/02-onboarding-ux.md:25, Android permissions guidance].
     - Body: "Tap Start once you're rolling. Rides shorter than {{seconds}} seconds or {{meters}} m aren't saved.", interpolated from `MIN_RIDE_ELAPSED_S` / `MIN_RIDE_DISTANCE_M` [SOURCE: board/02-onboarding-ux.md:56].
     - Plus a pre-ticked "Bike added" row (1 of 6) [SOURCE: board/02-onboarding-ux.md:58].
  2. **Teaching sheet** (P02.2/P01.1/P03.2/P05.1). Canonical trigger: `action='shown'`, `distance_m < 10`, `elapsed_s < 120`, too-short branch, no saved real ride, any day, every sheet [SOURCE: board/06-experimentation-analyst.md:98].
     - Title "Test ride: all good" only if a GPS fix arrived; otherwise "Testing it out?".
     - The body states both save conditions, interpolated [SOURCE: board/03-behavioural-scientist.md:284-288].
     - Buttons: "Got it" (ends and discards), "Keep recording", and "Remind me on my next ride day", which opens the plan chips.
     - The 30 s / 50 m thresholds are **not** changed.
  3. **Day-1 fallback** (P04.1/P01.2). Only for riders who granted permission and set no plan by the end of day 0: one local notification, next day at 18:00 local, branched on goal and on `gps_fix` (04's copy), cancelled by any core action. No Pro, price or "free" wording (Apple 4.5.4) [SOURCE: board/04-lifecycle-crm.md:120-138].
     - At most **one** activation notification per rider in week 1. A rider-chosen time beats the fallback [SOURCE: board/06-experimentation-analyst.md:220].
  4. **One event schema** (chair's pick; the owner can rename it before launch, not after):
     - notification kind `activation`, with `source: 'plan_card' | 'guard_sheet' | 'd1_fallback'` on the existing `reminder_scheduled` / `reminder_opened`;
     - plan event `next_ride_plan_set {when, source, permission_granted}`;
     - `ride_too_short_shown` gains `variant:'teaching'|'default'`, `gps_fix`, `max_speed_kmh`, `action:'remind_me'`;
     - 04's `activation_nudge_presented` delivery check (`getPresentedNotificationsAsync`);
     - `notification_permission_status {granted, previous}` on foreground.
     - [UNBACKED — own choice; the reason is that one kind with a `source` keeps `reminder_opened` analysis to one filter, which 06 R3 asks for.]
  5. **Light/dark.** The card and sheet use `useEditorialTheme` tokens. The HUD sheet uses `HUD_THEME` (always dark). Screenshot both system modes before merge [SOURCE: board/02-onboarding-ux.md:81, :106].

- **Primary metric.** Core action (saved real ride, expense, or maintenance task created/completed by the rider) within 7 days of `onboarding_completed`, among completers.
  - **Baseline: 61/367 (16.6%)**. By month: Aug 17/61, Sep 25/162, Oct 16/127 (12.6%) [SOURCE: board/02-onboarding-ux.md:15, PostHog q-02d/q-02e; board/06-experimentation-analyst.md:100].
  - **Target: ×2** (16.6% → ~33%, or 12.6% → ~25% at the winter rate). This is the effect we can *detect*, not a forecast.

- **Secondary metrics (the #365 day-2 metric):**
  - day-2 *engaged* return among completers, **37/367 (10.1%)**, using 06 F14's definition, which does not count the app's own notification opens. Granted stratum 23/171 [SOURCE: board/06-experimentation-analyst.md:72-73];
  - raw day-2 return among completers, 58/367 (15.8%) [SOURCE: evidence pack §2];
  - week-1 saved ride, 27/367 [SOURCE: board/06-experimentation-analyst.md:18].
  - `activation_24h` (56/367) is a **diagnostic only**, because the plan deliberately moves the first ride past 24 h [SOURCE: board/06-experimentation-analyst.md:104].

- **Guardrails.**
  - **Onboarding paywall conversion and trial-start rate.** They cannot differ by design, because assignment happens after the paywall. Check `paywall_viewed` and trial starts by arm weekly as a *randomization check*, per `onboarding_variant` (`garage_first` / `commit_first`). Never pool them, because the paywall-seen rate per week ranges from 10/72 to 46/83 [SOURCE: board/06-experimentation-analyst.md:77, :139]. RevenueCat `expd7c1d56904` and `onboarding_paywall_2026q4` keep running untouched. The new flag is crossed with them (factorial), never nested.
  - **Trial cancellations within 3 days**, test vs control. This is a review trigger at a gap of ≥ 4 riders (it fires by chance 4–19% of the time at 60–150 riders per arm) [SOURCE: board/06-experimentation-analyst.md:140-149]. Revenue is read in RevenueCat.
  - **Day-2 return** in the test arm trailing control by ≥ 10 riders: a review trigger, not a kill.
  - **Notification permission revocations**: test arm ≥ 3 more than control after 4 weeks → stop the d1 fallback only [SOURCE: board/04-lifecycle-crm.md:205; board/01-activation-pm.md:117].
  - **Teaching variant hygiene**: no sheet with `distance_m ≥ 10`, or for a rider with a saved ride, may carry `variant:'teaching'` [SOURCE: board/05-rider-voice.md:134].
  - **Trust guardrails, automatic stop**: SRM χ² per platform and region weekly, and the crash rate in the test arm.

- **Measurement design at ~7 installs/day (~30 completers/week in season, ~15–21 in winter).**
  - 50/50, assigned at `onboarding_completed` for **all** completers. The arm is drawn locally for pre-consent installs, using the `onboarding-experiment.ts:24-33` pattern. Fire `activation_exposure`. Analysis is intent-to-treat [SOURCE: board/06-experimentation-analyst.md:117].
  - Strata: platform × `onboarding_variant` × granted-at-assignment [SOURCE: board/06-experimentation-analyst.md:57, :118].
  - **Rule (pre-registered):**
    - Early stop: Evan Miller's rule with N = 64 successes. Ship if T − C ≥ 16. Stop with no winner at T + C = 64. Miller requires assigning "with 50% probability each", and N counts successes, not riders [SOURCE: https://www.evanmiller.org/sequential-ab-testing.html — "If T-C reaches 2√N, stop the test"; "If T+C reaches N, stop the test. Declare no winner" (Evan Miller, opened 2026-11-12)].
    - If neither boundary is hit by the cap: **one** one-sided two-proportion z-test at α = 0.05 on everyone enrolled, plus the difference with a 90% interval [SOURCE: board/04-lifecycle-crm.md:160-162].
    - Look daily. Decide on the rule only, never on PostHog's "chance to win" [SOURCE: board/06-experimentation-analyst.md:55].
  - **Power at the cap** (launch 2026-12-15; enrolment stops 2026-03-24; 4,000–20,000 runs) [UNBACKED — own simulation, Appendix B]:

    | Baseline | Completers/day | Miller only, ×2 | **Miller + cap test, ×2** | Miller + cap test, ×1.5 | False positives |
    |---|---|---|---|---|---|
    | 16.6% | 3.0 | 0.82 | 0.84 | 0.52 | 5.7% |
    | 16.6% | 2.1 | 0.64 | 0.88 | 0.45 | 5.2% |
    | **12.6% (Oct)** | **2.1 (winter)** | 0.39 | **0.76** | 0.35 | 4.9% |

    The bold row is the one to plan on.
  - **What a capped readout can say:**
    - "doubling shown", if a rule fires;
    - the difference with a ±~7 pt 90% interval;
    - no harm, if the lower bound is above about −7 pts.
  - **What it cannot say:**
    - it cannot rule out a real +40% lift;
    - it cannot say which part worked. The mechanism chain gives a descriptive split only: plan set → reminder scheduled → delivered (`presented` + opened) → opened → core action within 48 h; and teaching sheet → remind_me → opened → saved ride [SOURCE: board/06-experimentation-analyst.md:135-138].
  - **Qualitative:** watch session replays of 10 riders per arm per month, if mobile replay is on (not verified) [UNBACKED — own idea].
  - **Consent caveat:** every read is "of consenting riders". About 17–27% of new users are invisible [SOURCE: evidence pack §1].

- **Duration.** Launch target 2026-12-15, cap 2026-03-31 (readout). Expected median time to a ship decision *if* it doubles is ~58 days. With no effect it runs to the cap [SOURCE: board/06-experimentation-analyst.md:49-51]. **Don't start after 2027-01-06** (D7).

- **Effort.** M for the feature (card, sheet, scheduler, 7 locales, events) plus M for the flag and assignment plumbing. Pre-launch gates:
  - the Android 13+/14+ device check of a next-day 18:00 local notification (stock Pixel plus a Samsung on default battery settings) [SOURCE: board/04-lifecycle-crm.md:139];
  - light/dark screenshots;
  - the P06.1 ledger signed.

- **Stop or roll back.**
  - *Automatic stop:* SRM failure, or a crash-rate jump in the test arm.
  - *Stop the d1 fallback only:* the revocation trigger, or the device check shows Android delivery missing the evening. In that case Android gets the card and sheet only, with no reminder promise in the copy.
  - *Kill the card:* if after 8 weeks fewer than 1 in 10 eligible riders set a plan [SOURCE: board/03-behavioural-scientist.md:242; board/02-onboarding-ux.md:70 uses 1 in 5]. Chair's pick: 1 in 10, because winter lowers intent [UNBACKED].
  - *After a capped "no winner":* keep the bundle if the 90% interval's lower bound is above −3 pts and the qualitative signals are not negative. Otherwise revert [SOURCE: board/06-experimentation-analyst.md:138, own rule there].
  - *Ship:* a ship boundary or a cap test win → roll out to 100%, and the day-1 nudge can get its own slot in spring.

### Experiment 2 (fix + pre-registered read, not a lift test): restore the day-0 service schedule

This is the honest second candidate [SOURCE: board/review-verdicts.md, "#365's done when"]. It fixes a verified break in the promise behind 62% of web clicks. It is not a randomized lift test, and it does not claim a #365 lift.

- **Hypothesis.** Since the install week of 2026-10-12, most new bikes leave day 0 with no maintenance tasks (25/111), so the Home plate says "No service due". If the import is restored, `maintain_bike` riders (the worst-retained goal at 3.6% day 2) at least get the dated item that F7's riders say keeps them in the app [SOURCE: Appendix A; evidence pack §4; board/05-rider-voice.md:81-85]. Any effect on return is [UNBACKED], and 05 expects day-2 return "to barely move" [SOURCE: board/05-rider-voice.md:169].
- **Exact change.**
  1. Find why day-0 import fell in the week of 10-12. The leads, unverified:
     - the import runs only for schedule ids the rider accepted [SOURCE: board/05-rider-voice.md:30, users.service.ts:235];
     - blank-model bikes can't match a model row;
     - something changed in the bike-creation path around 3.26.0 / #313 [UNBACKED].
     The fix is a bug fix, not UI.
  2. Seed model-level rows for the most common uncovered cohort models, starting with the MT-07, a top web landing page [SOURCE: board/05-rider-voice.md:105; evidence pack §7].
  3. Add `service_plan_imported {tier, source}` so the import is attributed by event, not by before/after [SOURCE: board/05-rider-voice.md:162].
  4. No UI change. The plate's "Set up service plan" state waits (rank 11). If a DB change is needed, it goes through a migration, and applying it to production is owner-approved.
- **Primary metric.** Share of riders' first bikes, created on sign-up day, with ≥ 1 maintenance task within a day.
  - **Baseline 25/111 (23%)**, weeks of 10-12 → 11-02. The pre-drop level was 127/204 (62%) [SOURCE: Supabase prod, q99-day0-schedule-weekly, Appendix A].
  - **Target: back to ≥ 55%** for 4 straight weeks. [UNBACKED — own target: near the pre-drop level, below it because blank-model bikes now exist.]
  - This metric is mechanical, so it is readable in weeks with no statistics.
- **Activation metrics (harm check only, P06.3 rule):**
  - `activation_24h` and day-2 return per install, against an 8-week before-window. Revert if d + 1.645·SE < 0 at the 4- or 8-week look [SOURCE: board/06-experimentation-analyst.md:159-166];
  - per the Skeptic's caveat, read next to the Experiment 1 control arm's trend, so winter isn't mistaken for harm [SOURCE: board/review-verdicts.md P06.3 row];
  - stratum to watch: `maintain_bike` riders' app opens on days 3–30, baseline 12/92 [SOURCE: board/05-rider-voice.md:165]. Description only, because a read takes months at ~1.3 riders a day.
- **Guardrails.** Onboarding paywall conversion and trial starts: untouched, because the change is post-onboarding and server-side. It reaches both slot arms equally, so it may ship during Experiment 1. Log its date in the ledger and cut the slot readout before and after it [SOURCE: board/06-experimentation-analyst.md:169].
  - Second guardrail: no task may state model-level confidence from a make-generic row. Keep the tier on the task [SOURCE: board/05-rider-voice.md:203].
- **Duration.** The investigation is unsized. The read is 4 weeks after the fix, plus 8 weeks for the harm looks.
- **Effort.** S–M (the cause is unknown), plus data seeding.
- **Stop or roll back.** Revert if (a) the P06.3 harm rule fires on both the before/after and the control-arm trend, or (b) riders report wrong intervals (feedback form / P05.3). Otherwise keep it: this is a bug fix.

### Instrumentation to add first (P06.1, one small mobile PR, before Experiment 1)

1. `post_onboarding_landed {screen, onboarding_variant}` on the first route after `personalizing` [SOURCE: evidence pack §9].
2. `activation_exposure {experiment, arm}` at the assignment point. Draw the arm locally for pre-consent installs [SOURCE: board/06-experimentation-analyst.md:87, :117].
3. `ride_too_short_shown`: add `max_speed_kmh`, `gps_fix`, `variant`, `action:'remind_me'` [SOURCE: board/06-experimentation-analyst.md:78].
4. `reminder_scheduled` / `reminder_opened` with `kind:'activation'` and `source` (§4.1 step 4); `activation_nudge_presented` [SOURCE: board/04-lifecycle-crm.md:140-145].
5. `notification_permission_status {granted, previous, platform}` on app foreground [SOURCE: board/04-lifecycle-crm.md:204].
6. Push-token visibility (from P04.2): `push_token_registered` / `push_token_registration_failed`, and `captureException` instead of the no-op `logger.warn` [SOURCE: push-tokens-investigation.md, "Proposed fix" step 6].
7. `service_plan_imported {tier, source}`, and `source` on `maintenance_task_completed` [SOURCE: board/05-rider-voice.md:162].
8. A route-name allow-list constant or test for the F14 "engaged" screen list, so renamed routes can't silently break the metric [SOURCE: board/06-experimentation-analyst.md:87].
9. `docs/research/activation-365/experiments.md` ledger, with the canonical definitions (06 F14 engaged return, canonical too-short trigger with baseline 1/13, week-1 core action 61/367), N, the cap, strata and triggers [SOURCE: board/06-experimentation-analyst.md:88-106]. The Skeptic notes it does not exist yet [SOURCE: board/review-verdicts.md P06.1 row].
10. A saved weekly install-cohort table in PostHog (owner-approved write) [SOURCE: board/06-experimentation-analyst.md:86].

### Next candidates, in order

1. **P04.2 Android FCM**: ship in parallel now, in the next Play build. It is a both-arm change, read by Android tokens per grant (today 0/119) [SOURCE: board/04-lifecycle-crm.md:217]. It is infrastructure, not an activation lever.
2. **P05.3 install-reason card**: before the slot starts or after it ends, so both arms see it equally. Qualitative signal.
3. **P05.2 plate state** "Set up service plan": after Experiment 2 and after the slot ends.
4. **Day-1 nudge on its own slot**: spring 2027, only if Experiment 1 wins and ships.
5. **P04.3a iOS provisional**: after the device check, and only if it is visibly a no-op inside both paywall arms.
6. **P03.3 Saturday message**: spring, as a slot occupant, never alongside another activation message.

### What we decided not to do

- **No change to onboarding screens or the paywall** while `onboarding_paywall_2026q4` and `expd7c1d56904` run: no practice-ride step, no permission-copy change (P04.3b), no moved sign-up [SOURCE: board/02-onboarding-ux.md:114-116; hard constraint].
- **No lowering of the 30 s / 50 m ride floor.** It would count standstill taps as rides [SOURCE: board/01-activation-pm.md:133].
- **No server-push experiment until FCM ships**, and no day-1 test judged on raw day-2 return, which counts the app's own opens [SOURCE: board/06-experimentation-analyst.md:182].
- **No nudge-alone test this winter.** Power at the cap is 0.17–0.42 [SOURCE: board/06-experimentation-analyst.md:129-131].
- **No winter before/after claim of a lift**, and no decisions on PostHog "chance to win" after daily looks [SOURCE: board/06-experimentation-analyst.md:180-181].
- **No drip, streaks, "we miss you" pushes or week-1 upsells.** Riding is weekly and seasonal, and riders name upsells-before-value as a reason to leave [SOURCE: board/03-behavioural-scientist.md:343-351; board/05-rider-voice.md:73-80].
- **No AI-diagnostics hook in the first session** (house rule; 10 riders, 0 back) [SOURCE: evidence pack §5]. No India targeting.
- **No paywalling of logging, rides or basic stats.** Nothing here gates any of them (hard constraint).
- **No email to riders without contact consent.** `seasonalTips` is a silent default, not an opt-in [SOURCE: board/04-lifecycle-crm.md:77-78].
- **No experiment spent on What's New.** It is already fixed [SOURCE: board/02-onboarding-ux.md:12].

## 5. Owner decisions needed

1. Sign the ledger: Experiment 1 (the bundle) holds the single randomized slot, with the primary week-1 core action among completers (61/367), N = 64, Miller early stop + one cap z-test, cap 2026-03-31, and no start after 2027-01-06. Yes or no?
2. Launch date: 2026-12-15 (needs a build or OTA plus the Android device check first), or earlier?
3. After a capped "no winner": keep the bundle if the lower bound is above −3 pts, or revert?
4. Copy for the `maintain_bike` branch of the day-1 fallback: "When did you last…?" with the tier named, or the expense prompt for everyone?
5. First chip: "Today" or "Later today"? And confirm the notification kind `activation` with a `source` property.
6. Approve the investigation and fix of the 10-12 schedule-import drop (Experiment 2), including any migration and the MT-07 row seeding, before Experiment 1 launches?
7. ~~FCM: commit `google-services.json` or keep it as an EAS file variable?~~ **Answered 2026-11-12: committed, PR #393; Android vc99 built.**
8. Is mobile session replay on, so the qualitative checks are possible?

---

## Appendix A: `q99-day0-schedule-weekly` (Supabase prod, read-only SELECT, Management API, 2026-11-12)

```sql
with u as (  -- q08's sign-up cohort and exclusions, extended to 2026-11-11
  select id, created_at from public.users
  where created_at >= '2026-08-14' and created_at < '2026-11-12'
    and coalesce(is_synthetic,false) = false
    and email not in ('<redacted-email>','<redacted-email>','<redacted-email>','<redacted-email>','<redacted-email>','<redacted-email>','<redacted-email>')
    and email not ilike '%@priorises.com' and email not ilike '%@motovault.app' and email not ilike '%cloudtestlabaccounts.com'
), b as (  -- first live bike created within 1 day of sign-up
  select distinct on (m.user_id) m.id, m.user_id, m.created_at, m.model
  from motorcycles m join u on u.id = m.user_id
  where m.deleted_at is null and m.created_at < u.created_at + interval '1 day'
  order by m.user_id, m.created_at
)
select to_char(date_trunc('week', b.created_at),'YYYY-MM-DD') wk, count(*) bikes,
  count(*) filter (where exists (select 1 from maintenance_tasks t where t.motorcycle_id=b.id and t.deleted_at is null and t.created_at < b.created_at + interval '1 day')) with_tasks_d0,
  count(*) filter (where coalesce(trim(b.model),'')='') blank_model,
  count(*) filter (where coalesce(trim(b.model),'')='' and exists (select 1 from maintenance_tasks t where t.motorcycle_id=b.id and t.deleted_at is null and t.created_at < b.created_at + interval '1 day')) blank_with_tasks
from b group by 1 order by 1;
```

| Week (Mon) | Bikes | With tasks d0 | Blank model | Blank with tasks |
|---|---|---|---|---|
| 08-10 | 10 | 6 | 0 | 0 |
| 08-17 | 24 | 13 | 0 | 0 |
| 08-24 | 12 | 11 | 0 | 0 |
| 08-31 | 30 | 19 | 0 | 0 |
| 09-07 | 26 | 14 | 0 | 0 |
| 09-14 | 28 | 21 | 0 | 0 |
| 09-21 | 27 | 17 | 0 | 0 |
| 09-28 | 15 | 8 | 0 | 0 |
| 10-05 | 32 | 18 | 0 | 0 |
| **10-12** | 25 | **6** | 9 | 0 |
| 10-19 | 23 | 7 | 9 | 2 |
| 10-26 | 22 | 5 | 10 | 1 |
| 11-02 | 41 | 7 | 15 | 2 |
| 11-09 (partial, 3 days) | 25 | 13 | 5 | 1 |

- Before (08-10 → 10-05): 127/204 (62%).
- After (10-12 → 11-02): 25/111 (23%). Model-filled bikes 20/68 (29%), blank-model 5/43.
- Week starts are `date_trunc('week')` in UTC. The DB includes riders who declined analytics.

## Appendix B: `q99-capsim` (local, Python 3 stdlib, fixed seeds, `python3 -I`)

This is 04's cap-test code [SOURCE: board/04-lifecycle-crm.md:175-199], unchanged, run with the bundle's inputs. Enrolment is 99 days (2026-12-15 → 03-24) × the rate. 4,000 runs for Miller-only and 20,000 for the cap rows [UNBACKED — own simulation].

```python
# run(pc, pt, n_cap, use_cap_test, N=64): Miller early stop (ship T-C>=16, stop T+C=64),
# then one one-sided two-proportion z-test (crit 1.645) at the enrolment cap if no boundary was hit.
for label, pc, rate in [("16.6% 3.0/d",.166,3.0),("16.6% 2.1/d",.166,2.1),("12.6% 2.1/d",.126,2.1),("12.6% 3.0/d",.126,3.0)]:
    n = int(rate*99)
    print(label, n, run(pc,2*pc,n,use_cap_test=False,reps=4000,seed=1), run(pc,2*pc,n), run(pc,1.5*pc,n,seed=8), run(pc,pc,n,seed=9))
# printed 2026-11-12:
# 16.6% 3.0/d n 297  miller-only x2 0.815  miller+cap x2 0.839  x1.5 0.518  FPR 0.057
# 16.6% 2.1/d n 207  miller-only x2 0.642  miller+cap x2 0.879  x1.5 0.446  FPR 0.052
# 12.6% 2.1/d n 207  miller-only x2 0.392  miller+cap x2 0.759  x1.5 0.350  FPR 0.049
# 12.6% 3.0/d n 297  miller-only x2 0.723  miller+cap x2 0.871  x1.5 0.455  FPR 0.052
```

Note: at 3.0/day the combined rule's false-positive rate is 5.7%, slightly above the nominal 5%. That is because the Miller boundary and the cap test each get a chance to fire. If the owner wants exactly 5%, use a cap critical value of about 1.70 (not simulated).
