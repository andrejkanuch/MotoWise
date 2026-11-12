# Skeptic review of 04-lifecycle-crm.md

## Round 1

Reviewed 2026-11-12, covering the draft and its Responses section.

**What I checked.** These citations hold:
- Airship Activation PDF, text extracted: "The average Day 2 Activation Rate across categories is 16%". Category medians: Sports 18%, Tools 13%, Travel & Local 14%.
- OneSignal 2024: 28.29 / 17.86 / 7.88; Utilities 28.18 / 16.75 / 9.2; Lifestyle 25 / 13.13 / 5.94; Utilities opt-in 51.5 / 51.6; the 24% claim.
- Airship 2026 opt-in: Android 53.3%, iOS 48.85%, data from 2025, apps with at least 1,000 active users.
- Batch: "from 85% to 67%" and "from 58% last year to 56% now", data Jul 2024–Jul 2025. This sample is European.

The Diagnosis 1 code reading is sound.

**R1.1 — F11 and the "What I'd NOT do" list: `seasonalTips` is a silent default, not an opt-in.**
- On origin/main, `apps/mobile/src/stores/onboarding.store.ts:159` initialises `seasonalTips: true`.
- `setSeasonalTips` is defined (line 190), but no screen calls it. `git grep setSeasonalTips` finds only the store. The `seasonalTipsLabel` strings exist in the locales but nothing renders them.
- So the 354 `true` values are a default no rider saw or chose.
- Fix: delete "we hold an opt-in we have never used" and "possibly reuse the `seasonalTips` opt-in". It cannot serve as consent for anything.

**R1.2 — F6 misquotes Airship.**
- The 2026 Airship benchmarks page does not contain "Ask once at install. If the user declines, re-prompt when in-app behavior signals intent". I opened it.
- What it does say:
  - "Simply ask once, and if they say no, set the stage to ask again";
  - time prompts to "high-intent moments";
  - the lift claim is worded "as high as 40% above their category average", with no sample, period or method given.
- Fix: correct the quote, and tag the 40% as an unspecified internal vendor figure.

**R1.3 — P04.3 changes a screen inside the running onboarding A/B.**
- P04.3 rewrites the subtitle and sample card on `app/(onboarding)/notifications.tsx`.
- That screen is shared by both `onboarding_paywall_2026q4` arms, and in `garage_first` the paywall opens *after* it.
- Your own Responses 3(iii) argue against changing this exact screen while the arms run.
- The copy also promises "the day after you sign up, one tip", which ties P04.3 to P04.1 shipping. And the iOS provisional behaviour is [UNBACKED — needs a device check].
- Fix: defer P04.3 until the onboarding A/B ends, or get explicit owner sign-off and annotate the date in RevenueCat `expd7c1d56904`. Ship the `allowProvisional` part separately only if it changes nothing visible.

**R1.4 — P04.1's 20% holdout cannot be read. Your Responses do not answer 06's challenge.**
- You say the holdout gives about 17 control riders in 8 weeks, "report, don't test".
- 06 R2 shows a 50/50 split with Miller's rule (N = 64 successes) gets 0.83 power for ×2 in about 10 weeks on this population (171 granted completers, 20.5% raw day-2).
- Fix: adopt the 50/50 design or give a reason to refuse it. The 80/20 option cannot use Miller's rule, which requires "50% probability each".

**R1.5 — P04.1 primary baseline: wrong population, and still the raw metric.**
- Android 20/119 and iOS 15/57 are "tapped Enable and granted vs never asked" riders [pack §4]. They are not "completed onboarding and granted".
- Your Responses item 1 switched the primary to day-2 *engaged* return, but no engaged baseline exists.
- 06 gives only the raw rate for granted completers, 35/171.
- Fix: compute engaged return for granted completers, split by platform, before launch.

**R1.6 — The `maintain_bike` copy dispute rests on a correlation.**
- You send `maintain_bike` riders the expense prompt because "expense-first riders return at 41% (9/22)". Those 22 chose to log an expense, which is selection.
- The same riders, `maintain_bike`, logged **0** week-1 expenses [pack §4]. 05 Responses item 2 argues for "when did you last…" copy.
- Neither side has evidence that the prompt causes a return.
- Fix: write the branch as an explicit, owner-chosen bet, or make the copy the one thing that varies inside the treatment arm and report it per branch. Do not justify it with 41%.

**R1.7 — P04.1 copy carries a promise and frames the test as a failure.**
- "It's free, always." is a permanent pricing promise inside a notification. It needs the owner's sign-off, even though logging stays free under the current constraint.
- "That test didn't count" frames the rider's first action as a failure. 03's Diagnosis 4 and the merged guard-sheet copy aim for the opposite.
- Fix: align with the board's merged copy.

**R1.8 — P04.1 delivery on Android is assumed, not shown.**
- "The local path works on Android today" is shown only for immediate `ride_idle` notifications [01 R2].
- A date-triggered notification at 18:00 the next day can be deferred by Doze, exact-alarm limits or OEM battery savers [UNBACKED — needs a device check].
- Fix: add a device check on Android 13+ to the launch checklist, and log `activation_nudge_scheduled` against `reminder_opened`, so that delivery failures show up.

**R1.9 — P04.1 stop rule: its input is not measurable.**
- "If the opt-out or permission-revoke rate … exceeds the open rate" assumes an event for OS-level revocation. None exists.
- Fix: name how revocation is detected, e.g. a permission-status check on app open that emits `notification_permission_status {granted}` with the prior state, and the toggle event for the in-app setting.

Open items: 9

## Round 2

Reviewed 2026-11-12 against the revision and its "Answers to review".

**Closed.** R1.1–R1.9.
I re-opened the new sources:
- Android alarms page: the "never goes off before", "within one hour … unless … battery saver or Doze" and "deferred until the device exits Doze" quotes all hold.
- Expo notifications docs: "Without this permission, scheduled notifications arrive at an approximate time"; "Android 14 (API level 34) and later deny the permission by default for newly installed apps"; `getPresentedNotificationsAsync` "Fetches information about all notifications present in the notification tray (Notification Center)"; `allowProvisional` "noninterrupting notifications provisionally to the Notification Center".
The R1.3 split, the dropped pricing promise and the measurable revocation rule answer the review fully.

**R2.1 — `maintain_bike` branch: "bike has a schedule row" is undefined, and in practice it would show guessed intervals as model facts.**
- 01 F13 and 05 F11 measured the cohort: about 5% of bikes have a model-level schedule, 62–63% only make-generic and 32% only GENERIC.
- 05 also found that since October most day-0 bikes have **no tasks at all** (45/127; maintain_bike 7/34).
- If "schedule row" means any tier, then "Next up for your {bikeModel}: {task}" presents a make-generic interval as model-specific. Your own "What I'd NOT do" warns that a wrong service-due message costs trust, and the Honda interval is a known 2× error.
- Fix: define the condition as "the bike has tasks". Add 05's tier label to the copy (e.g. "typical {make} interval"), or limit the branch to model-level bikes and send the rest to the fallback.

**R2.2 — The notification title "Test ride: all good" asserts success the app may not have seen.**
- The board's sheet copy now uses the affirming title only when a GPS fix arrived (03 P03.2, 02 Responses 1).
- A day-1 notification to a rider who "saw the short-ride sheet" knows nothing of that, unless it reads the new `gps_fix` property.
- Fix: use the neutral wording, or branch on `gps_fix`.

**R2.3 — One flag, two incompatible designs.**
- P04.1 assigns `activation_365_first_session` to riders who granted permission at `onboarding_completed`, and step 5 forbids P02.1's in-context ask during the test.
- 02 (P02.1, "Sequencing" and Answers R1.4) assigns the same flag at **all** completers, ships the ask in the treatment arm from day one, and treats your nudge as the in-arm fallback.
- These cannot both be pre-registered.
- Fix: record the board decision (06 owns the ledger) and make P04.1 match it.

**R2.4 — The timeline still omits the calendar cap, and your simulation can't be reproduced.**
- "About 16 weeks" (218 riders median) comes from `scratchpad/miller.py`, which is not checked in.
- 06's inline script gives 198 riders (~14 weeks) for the same inputs (13.5% → 27%, N = 64).
- Neither figure fits inside 06's 2026-03-31 cap from a December launch at winter volume (06: ×1.4).
- Fix: cite 06 Appendix A, or paste your script inline as 06 did, and state the power at the cap.

**R2.5 — Your engaged-return definition differs from 06's.**
- F18's exclusion list (`/`, `/(tabs)/(home)`, `/whats-new`, `/(auth)`, `/login`, `/paywall`) is not 06 F14's list. Yours does not exclude `/(onboarding)/…`, `/account`, `/notifications`, `/personalizing`, etc., and it matches `/(auth)` exactly where 06 uses a prefix.
- Both happen to give 23/171 on this cohort, and 01 got 26/171 with a third list.
- A pre-registered primary needs one written definition.
- Fix: adopt 06 F14's list and drop yours.

Open items: 5
