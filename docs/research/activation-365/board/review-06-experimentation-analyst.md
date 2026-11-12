# Skeptic review of 06-experimentation-analyst.md

## Round 1

Reviewed 2026-11-12, covering the draft and its Responses section.

**What I checked.** These citations hold:
- Evan Miller: 50/50 assignment, and N counts successes.
- RevenueCat SOSA 2025: "82% of trial starts occur the same day a user installs". The page attributes the line to Phil Carter. Median 6.2%, p90 20.3%. This is a vendor source.
- PostHog experiments statistics (vendor): "at least 50 exposures per variant", 5 conversions for funnels, no multiple-comparison correction, nothing about peeking.
- Spotify Engineering, 2026-09-08: "reproduces the false positive rate of frequentist peeking".
- Andrew Chen / Quettra: D1 29.17%, D7 17.28%, top 10 D1 74.67%.

I re-derived two rows of the F2 table and both match:
- ×2 on day-2 return needs about 444 installs;
- ×2 on week-1 core action needs about 538.

**R1.1 — Diagnosis 2: "every too short is a stop within two minutes" is false for most of the cohort window.**
- The 120 s no-GPS branch (`NO_GPS_MIN_ELAPSED_S`) was added in commit 54146980 (#259, 3.21.0, 2026-10-04).
- Before it, `ride_too_short_shown` fired at any elapsed time. 02's q-02a finds 36 too-short sheets at 120 s or more in this cohort.
- Fix: limit the claim to builds ≥ 3.21.0, and read any too-short analysis split by build.

**R1.2 — F14 and P06.1 ask for a property that already exists.**
- `ride_too_short_shown` already sends `elapsed_s` and `distance_m` (`handleGuardEndAnyway` on origin/main; noted by 01 F11, 02 Diagnosis 6, 03 F12 and 05 F10).
- Only `max_speed_kmh` is missing.
- Fix: correct F14's "still missing" list and P06.1 step 2.

**R1.3 — P06.3's worked example is already shipped.**
- "Hiding What's New for a rider's first session" has been live since 3.25.0 (`markWhatsNewSeenForNewRider()` in personalizing).
- 02's q-02b shows 0 of 90 completers saw it after 10-12.
- Fix: replace the example with a change that is actually pending, e.g. P04.2's FCM fix, which is a no-harm infrastructure change.

**R1.4 — F14 and "What I'd NOT do": the push-token blocker is out of date.**
- "Any push experiment is invalid until this is explained" — 04 explained it. There is no FCM config, and all 105 tokens are iOS.
- The rule should now read: server push is out until P04.2 ships, and local notifications are fine.
- This matters because R2 itself proposes a local day-1 nudge test.

**R1.5 — The file now holds three different primary metrics.**
- P06.2 sets `activation_24h` as the primary.
- R2 uses day-2 engaged return for the nudge test.
- 01, 02 and 03 all argue that the plan and guard-sheet package needs a 7-day ride-saved or core-action window, because it defers the ride past 24 h.
- Fix: for each test the board picks, state one primary in the P06.1 ledger, and say explicitly whether `activation_24h` is a guardrail or the primary for the combined first-session package.

**R1.6 — The stopping-rule numbers rest on a simulation nobody can see, with an inconsistent baseline.**
- F5, R1 and R2 rely on `scratchpad/ss2.py`, "not checked in". The N = 64 / power 0.83 figures are what the board would pre-register.
- F5 says the simulation used "activation_24h, control 7.7%", but you give the `activation_24h` baseline as 7.1% (56/793). 7.7% is week-1 core action.
- Fix: check the script into `docs/research/activation-365/` with its inputs, and re-run it at 7.1%, or say which metric it simulated.

**R1.7 — "Day-2 engaged return" has no operational definition and no baseline.**
- F14 defines it as "a day-2 session with any `$screen` other than home, or a core action".
- `$screen` names changed format across versions (`/experience` vs `/(onboarding)/experience`) [pack §1], so "home" needs an explicit list of route names.
- R2 gives only the raw baseline, 35/171.
- Fix: write the screen list and the SQL, and compute the engaged baseline for the granted-completer group before any launch.

**R1.8 — The P06.2 kill rule fires on noise.**
- The rule is "Test-arm trial cancellations within 3 days exceed control by ≥ 2 riders".
- Assignment happens after the paywall, and the whole cohort had 15 trials in 12 weeks [pack §6], which is about 1 trial per arm a month. A 2-rider gap is likely by chance alone.
- The day-2 "≥ 6 riders" rule is likewise [UNBACKED].
- Fix: call these manual review triggers, not kill rules, or give the false-alarm rate under no effect from your simulation.

Open items: 8

## Round 2

Reviewed 2026-11-12 against the revision and its "Answers to review".

**Closed.** R1.1–R1.8.
- I read Appendix A. It implements Miller's rule as stated (50/50, ship at `ceil(2√N)`, stop at T + C = N), with fixed seeds.
- I re-derived the F2 "completers ×2" row: about 112 per arm, so 226 in total holds.
- The completer re-basing (56/367, all activators are completers) is a real correction.
- The engaged definition and its SQL are now pre-registerable.

**R2.1 — The calendar cap and the quoted power do not fit together.**
- P06.2 recommends the nudge for the slot: median ~99 days when it works, at the window-average ~2.0 granted completers a day.
- You also say late-October volume makes every duration about 1.4× longer, which is ~139 days.
- The nudge needs a build/OTA and 04's Android device gate first, so launch is realistically December. That leaves roughly 120 days to the 2026-03-31 cap.
- So the board will not get the 0.83 power that 01, 04 and this file quote. 01 and 04 repeat that figure without the cap.
- Fix: simulate power *at the cap* for a stated launch date and winter enrolment (e.g. 1.4 a day). Put that number in the ledger, plus what the cap result can and cannot say.

**R2.2 — Your own P06.3 rule blocks the rest of the board's plan, and the files disagree on who is in the slot.**
- P06.3 says "none while P06.2 is running unless it is behind P06.2's flag". With the nudge in the slot until as late as 2026-03-31, the first-session package (P01.1/P02/P03/P05) and the too-short sheet, which you list as a P06.3 example, cannot ship this winter except behind the flag.
- R3 adds that the package's in-context permission ask changes the nudge's eligible group.
- Meanwhile:
  - 02 puts the package *in* the slot, with arms assigned at all completers and the nudge as an in-arm fallback;
  - 01 ships P01.1 first, then P01.2;
  - 04 assigns granted completers only.
- As the ledger owner, record one decision with its consequences. For example: (a) nudge in the slot, and the package ships behind the same flag in the test arm only, making it a bundle; or (b) nudge in the slot, and the package waits; or (c) package in the slot, as 02 wants.

**R2.3 — The ledger pins neither the too-short trigger nor the engaged definition.**
- Your "too-short sheet alone" row uses "first `ride_too_short_shown` on day 0", baseline 1/10 on ≥ 3.21.0.
- The board's merged trigger is different: no saved ride, `distance_m < 10`, too-short branch, any day, every sheet. It has produced 11/49 (01, all builds, no `elapsed_s` filter), 11/45 and 1/13 (02), and 11/46 and 1/14 (05).
- Day-2 engaged return also exists in three versions: your F14 list (23/171), 04's shorter list (23/171) and 01's list with unmapped platform (26/171).
- Fix: the ledger states the canonical trigger, the ≥ 3.21.0 baseline query and F14 as the only engaged definition. Mark the other files' figures as superseded.

**R2.4 — The P06.3 harm rule is not operational.**
- "Revert if the after-window is lower than the before-window by more than the 80% interval of the difference" does not say which bound is compared with what.
- Fix: write it as an exact rule, e.g. "revert if the upper bound of the 80% two-sided interval for (after − before) is below 0". State its false-revert rate under no change (10% one-sided per look), and how many looks are allowed.

Open items: 4
