# Skeptic review of 01-activation-pm.md

## Round 1

Reviewed 2026-11-12, covering the draft and its Responses section.

**What I checked.** I opened these citations myself, and each one says what the draft claims:
- Lenny's activation-rate post: 34% average, 25% median, SaaS 36%/30%, follow-up comms ranked 3rd.
  Note: the ranking is by how often respondents mentioned each item, not by impact.
- Phiture: Health & Fitness ~20%/~8%, Travel ~16%/~7%, Productivity ~17%/~8%. The page is from 2022, updated 2026-03.
- Ultimate Motorcycling: 52% ride year-round, Austria about 11%, n=1,964 across 8 countries.
- Amplitude: the 7% / top 25% claim, 69%, 2,600+ companies. The page does not define "active".
- Airship: 95% churn, 190%, 63M users, 2017-02-16.
- Duolingo KDD'20 abstract: +0.5% DAU, +2% new-user retention.
- Andrew Chen / Quettra: D1 29.17%, D3 23.42%, D30 9.55%, and the "first visit" advice.
- Evan Miller: N counts successes, and the split must be 50/50.

**R1.1 — P01.1 secondary metric and Responses R1: wrong denominator, and the board now has four baselines.**
- "About 34 of 66 ever saved a real ride" is wrong. The pack says 34 of the **103** Start-tappers saved a ride at any time [evidence pack §3].
- R1 then uses 34/103 as the baseline. Other members have since cut narrower baselines:
  - 05: 13/56, first sheet under 50 m before any ride, saved within 7 days [05 q05-sub].
  - 06: 14/52 and 6/44, day-0 sheet, with and without a save later on day 0 [06 q06-resp-subgroups].
- Your merged trigger is "no saved ride AND `distance_m < 10`", and none of those four baselines uses it.
- Fix: re-cut the baseline with the exact merged trigger, a 7-day window and test persons excluded. State it as a count (x/y) and record it in the P06.1 ledger before launch.

**R1.2 — P01.2 measurement: the stopping rule is still misstated.**
- "N fixed in advance at about 160 granted riders" is wrong. Miller's N is a count of **successes**, not of riders. I checked the page: step 6 is "If T+C reaches N, stop", and its example is "at most 170 successes". 06 R2 made the same correction.
- Your Responses do not correct the P01.2 body.
- Fix: replace the figure with an N in successes (06 R2 table: N=64, ship at T−C ≥ 16), or justify another N.

**R1.3 — P01.2 primary metric: the baseline does not match the metric or the population.**
- R2 adopts "day-2 engaged return", but the quoted baselines (Android 20/119, iOS 15/57) are *raw* day-2 return.
- Those baselines are for riders who "tapped Enable and granted" [pack §4], not for riders who "granted permission and completed onboarding".
- 06 measured the second group as 35/171 raw [06 q06-resp-subgroups]. There is no engaged-return baseline anywhere yet.
- The P01.2 body also still asks for "Not now" instrumentation, which you withdrew in R2.
- Fix: compute the engaged-return baseline for granted completers before launch, and edit the body so it matches R2.

**R1.4 — Diagnosis 6 / Phiture benchmark: no transfer note on D1.**
- The figures check out. But the source blends Statista, AppsFlyer, Adjust and Business of Apps worldwide, with no Europe/US split and no seasonal or motorcycle category.
- "Our D1 is about half of it" puts a consent-gated, calendar-day measure next to vendor D1 definitions you don't know.
- Fix: add one line saying the D1 comparison is an order of magnitude only, as you already did for D7.

**R1.5 — Diagnosis 4: the seasonality inference conflicts with the board's own noise analysis.**
- You read the last three weeks (3/53, 3/41, 3/26) as a possible seasonal dip.
- 06 F3 shows weekly day-2 variance is *below* binomial noise (ratio 0.60). Those three weeks are inside the 3–12% band [pack §2].
- The Ultimate Motorcycling survey has three limits:
  - it is from 2014;
  - it was run with a tyre retailer (Delticom), and respondents chose themselves;
  - it has no US data.
- It supports "much of Europe rides less in winter". It does not support "our late-cohort dip is seasonal".
- Fix: say plainly that the dip is not distinguishable from noise.

**R1.6 — F3 rests on a personal-notes site, not on Reforge.**
- `hq-raydata-co.pages.dev` is a third party's private notes. The quotes cannot be attributed to Reforge from that page.
- Fix: cite a primary source, or tag F3 as a weak secondary source. It frames the "setup vs aha" argument, so the weakness should be visible.

**R1.7 — P01.3: unclear status, no baseline for its real metric, and an unsourced fallback.**
- 02 withdrew P02.3 in favour of P05.2, and your R2 dropped the "what's due" copy. Say whether P01.3 is withdrawn or merged into P05.2. Otherwise there are two specs for one card.
- The metric you call the honest one, "30-day return of riders who seeded a due date", has no baseline.
- "Generic intervals labelled 'generic — set your own'" names no source for the intervals.
- The OEM pipeline has known gaps (memory `project_oem_schedule_africa_twin`: "ZERO model rows"), so the generic fallback may be the common case.
- Fix: before building, run a query for the share of cohort bikes that have a schedule row.

**R1.8 — P01.2 has no harm guardrail or stop rule.**
- At about 14 eligible riders a week, the proposal needs a pre-registered kill condition: opt-outs, OS permission revocations, or a fall in engaged return in the test arm.
- 04 has a stop rule and 06 has a kill rule. P01.2 has neither.

**R1.9 — Responses R2: the Android "local path works" evidence proves less than claimed.**
- Five `ride_idle` opens from 3 Android riders show that an *immediate* local notification, fired by auto-pause during a ride, reaches Android.
- P01.2 needs a **date-triggered** notification scheduled about 24 h ahead. Android Doze, exact-alarm rules and OEM battery savers can delay or drop those. This is [UNBACKED — needs a device check].
- q01-resp-a also does not exclude test accounts.
- Fix: verify on an Android 13+ device that a next-day 18:00 trigger fires before treating the channel as proven.

Open items: 9

## Round 2

Reviewed 2026-11-12 against draft 2 and its "Answers to review".

**Closed.** R1.1 (re-cut done, but see R2.1), R1.2, R1.3 (but see R2.4), R1.4, R1.5, R1.6, R1.7, R1.8, R1.9.
I re-opened the new sources and they say what the draft claims:
- Android alarms page: "the alarm never goes off before the supplied trigger time"; on Android 12+ "within one hour of the supplied trigger time, unless any battery-saving restrictions are in effect"; "all alarms are canceled when a device shuts down"; alarms in Doze "are deferred until the device exits Doze".
- Aakash Gupta, 2023-12-06: "Users setup the feature so they can use it", "Users achieve the magic moment". The page does not credit Reforge with the framework.
- `app.config.ts` (origin/main 5a497a1c, lines ~362-366): no `SCHEDULE_EXACT_ALARM`, falls back to `setAndAllowWhileIdle`.
- `notifications.tsx:207-213`: "Not now" sends `onboarding_step_completed {skipped:true}`.

**R2.1 — P01.1 baseline 11/49 mixes builds and counts event rows, not sheets.**
- q01-r2-a takes the first `ride_too_short_shown` row with `distance_m < 10` and has no `elapsed_s < 120` filter and no build split.
- 02's re-run (q-02a) shows two things about that event. It writes one row per action (`shown`, `keep`, `end`). Builds older than 3.21.0 also fired it for no-GPS rides of 120 s or more.
- 06 now requires the before-window for this sheet to be builds ≥ 3.21.0 only.
- The same trigger now has four baselines on the board: 11/49 here, 11/45 and 1/13 (02), 11/46 and 1/14 (05), 1/10 (06, day-0 version).
- Fix: adopt the single ledger baseline (merged trigger, `elapsed_s < 120`, builds ≥ 3.21.0, q00 exclusions). Say plainly that it is anecdote-sized (about 13 riders).

**R2.2 — P01.1 measurement (b) still promises a lift from a winter before/after.**
- "Pre/post … only if the move is larger than the §2 weekly noise" uses the wrong yardstick: the §2 band is weekly day-2 return across all installs, not this metric.
- It also compares an Aug–Oct window with a Nov–Jan one. 06 P06.3, and 02 and 03 after round 1, keep before/after for harm checks only this season.
- Fix: replace (b) with the P06.3 harm check plus the mechanism chain in counts.

**R2.3 — P01.1 copy claims "GPS and tracking work" unconditionally.**
- 02 (Responses 1) and 03 (P03.2, after R1.10) both show that copy only when at least one location fix arrived (`setGpsAccuracy`, ride-hud.tsx:150). Otherwise they use the neutral "Testing it out?".
- Your merged spec is the one place that still asserts it with no condition.
- Fix: adopt 03's two strings and the `gps_fix` property.

**R2.4 — P01.2 engaged baseline 26/171 disagrees with the board's 23/171 for the same population.**
- 06 (q06-rev-engaged) and 04 (query E) both get **23/171**. 06's F14 screen list is the written, pre-registerable definition.
- q01-r2-b uses a different exclusion list. It also leaves 42 riders as "platform missing", although the pack maps platform from app version/build (§0). That gives Android 100 / iOS 29 here against 04's 115 / 56.
- Fix: use 06 F14's definition and the pack's platform mapping, and restate the baseline and split. The secondary "first-week core action for the same group" also needs its number; 06 has it as 36/171.

**R2.5 — Which test is P01.2 in? Your own file gives two answers.**
- The P01.2 body is a standalone 50/50 of granted completers, with primary day-2 engaged return.
- Your Responses R3 proposes testing the R1+R2 bundle with **primary week-1 core action**.
- 02 puts the whole package in the slot, assigned at all completers, with the nudge as an in-arm fallback. 06 and 04 put the nudge alone in the slot.
- "Suggested order: P01.1 first, then P01.2" also collides with 06 P06.3: there is one before/after change in flight at a time, and none while P06.2 runs unless it sits behind the flag.
- Fix: delete whichever version you no longer hold, and point to the single board decision in the P06.1 ledger.

**R2.6 — The power and timeline claim for P01.2 ignores the calendar cap.**
- "~15 weeks with a doubling" uses the window-average enrolment of 14 a week.
- 06 notes that late-October volume makes every duration about 1.4× longer, and P06.2 pre-registers a stop at 2026-03-31.
- A launch after an OTA and the Android device gate will not start before December. That leaves roughly 17 weeks, so the 0.83 power will not be reached by the cap.
- Fix: quote the power at the cap for a realistic launch date (ask 06 to run it). Do not quote the uncapped 0.83.

**R2.7 — The `maintain_bike` branch copy differs between 01 and 04.**
- P01.2 states the expense copy as settled.
- 04 (after its R1.6) makes the branch an owner-chosen bet and recommends 05's "when did you last…" copy, with an expense fallback.
- The merged spec cannot hold both.
- Fix: mark it "owner picks; frozen before launch; reported per branch, descriptive only", as 04 does.

Open items: 7
