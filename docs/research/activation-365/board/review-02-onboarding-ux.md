# Skeptic review of 02-onboarding-ux.md

## Round 1

Reviewed 2026-11-12, covering the draft and its Responses section.

**What I checked.** I opened these citations and they hold:
- Lazyweb (vendor): 15 of 809 apps, 373 plain empty states, 107 checklists, Health & Fitness 19, "prevalence, not conversion", 2026-07-07.
- Coglode: 19% vs 34% over 9 months, 300 customers.
- DC Rainmaker: "a new account gets a 10EUR discount for the first 10 days".
- Evan Miller: step 2 requires a 50/50 assignment.

On origin/main 5a497a1c I confirmed:
- `CHECKLIST_ITEM_ID.FIRST_RIDE` deep-links to `PROFILE_ROUTE.RIDES` (checklist.store.ts:67-70).
- `HUD_THEME = editorialThemes.dark` (ride-hud.tsx:34 on origin/main).

**R1.1 — F7 and the P02.1 "Expected effect": the effect sizes are mislabelled.**
- F7 calls d = 0.35 (trim-and-fill) and d = 0.15 (robust Bayesian) bias-corrected estimates "for behaviour change".
- The source you cite says the 0.15 is "an adjusted overall estimate, not the estimate for behavior alone". The behaviour-only figure is d = 0.27; the overall average is d = 0.36 across 642 tests. I opened the page, and 03's Responses flagged the same thing.
- So "bias-corrected d 0.15–0.35" in P02.1 is not a behaviour-change range.
- Fix: quote d = 0.27 for behaviour, and the 0.15/0.35 as corrections of the overall estimate.

**R1.2 — P02.1 measurement layer 3: Miller's rule does not apply to a 20% holdout.**
- Evan Miller's procedure requires "Assign subjects randomly to the treatment and control, with 50% probability each" (step 2). The 2√N threshold comes from a symmetric random walk.
- With an 80/20 split, the treatment arm collects about 4× the successes under the null, so T − C reaches 2√N with no effect at all.
- Fix: use a 50/50 split, or a method that allows unequal allocation (e.g. mSPRT, 06 F6). Otherwise drop the "sequential" claim.

**R1.3 — P02.1 primary metric: the denominator does not match the exposed population, and the file has two primaries.**
- The primary is "day-2 return 9.1% (72/793)", which covers all installs. The card only reaches riders who finish onboarding and land on Home.
- Your Responses item 3 then makes "core action within 7 days of `onboarding_completed`" the primary, but the P02.1 body was not updated.
- Measurement layer 2 ("saved real ride within 7 days among track_rides finishers") has no number.
- Fix: pick one primary, give its baseline for completers only (e.g. week-1 core action among the 367 completers), and compute the track_rides finisher baseline.

**R1.4 — P02.1's in-context permission ask: sequence it against the P04.1 test.**
- Asking for notification permission at the plan chip grows the population that the P04.1/P06.2 day-1 nudge test draws on, while that test is running.
- 06 R3 shows this breaks a before/after denominator (Dmitriev et al., "Ratio metrics can be misleading … if the denominator … changes").
- Fix: say whether the ask ships before the nudge test starts or after it ends, not during it.

**R1.5 — P02.1 and P02.2 copy misstates the save rule.**
- "MotoVault saves your ride once you've covered 50 m" and "MotoVault saves a ride once you've covered 50 m" are incomplete.
- The guard fires on `elapsed < MIN_RIDE_ELAPSED_S || dist < MIN_RIDE_DISTANCE_M` (ride-hud.tsx:218 on origin/main). A 60 m ride in 20 s is not saved.
- Fix: the copy needs both conditions, or a phrasing that avoids the number ("once you're actually riding").

**R1.6 — P02.2 baseline and the q-02a buckets mix two code versions.**
- (a) The P02.2 primary baseline "~34/103 (≈33%)" counts saves at any time, not "within 7 days", and it is not cut to your trigger (0 saved rides, under 10 m). 06 measured 6/44 for day-0 too-short riders who saved nothing later that day. Re-cut it for your trigger.
- (b) q-02a counts 36 `ride_too_short_shown` sheets at 120 s or more. On current code that cannot happen: since 3.21.0 (commit 54146980, #259, 2026-10-04) rides of 120 s or more fire `ride_zero_distance_shown` instead. So q-02a pools old-build semantics with new ones.
- (c) q-02a also includes test persons.
- Fix: re-run q-02a on builds ≥ 3.21.0 with q00 exclusions before you use "125 of 221" as the design basis. Your Responses gate "elapsed < 120 s" is redundant on those builds.

**R1.7 — P02.2 measurement claims a lift from a winter before/after.**
- "Pre/post over 8–10 weeks against the trailing 12 weeks" puts an Aug–Oct window against a Nov–Jan window.
- 06 F11 and P06.3 (ITS, Bernal et al. 2017: seasonality is the main threat) reserve before/after for harm checks this season.
- Splitting "Americas and Europe separately" at about 9 Start-tappers a week, with Europe under-counted by consent [pack §1], gives cells of 0–3 riders.
- Fix: restate the read as a no-harm check plus the mechanism chain (sheet → remind_me → `reminder_opened` → saved ride), reported in counts. No regional split.

**R1.8 — P02.1 endowed-progress row: two changes bundled, and one breaks an existing ratio.**
- Moving the checklist from 0/5 to 1/6 changes the denominator of any existing checklist-completion metric.
- It ships in the same release as the plan sheet, so you cannot tell their effects apart.
- Fix: say that you accept the bundle, and stop reporting checklist completion across the change.

Open items: 8

## Round 2

Reviewed 2026-11-12 against the revision and its "Answers to review".

**Closed.** R1.1–R1.8.
- I re-checked the glossary wording. On origin/main I also confirmed `MIN_RIDE_ELAPSED_S = 30` / `MIN_RIDE_DISTANCE_M = 50` (ride-constants.ts:25-26), the guard condition and one `trackEvent` per action (ride-hud.tsx:218-250), and `items_total` on `checklist_item_completed` (checklist.store.ts:209-214).
- Your appendix caveat ("check whether `maintenance_task_created` fires for schedule tasks") is closed. On origin/main it fires only from `add-maintenance-task.tsx:203`, a rider action, so 61/367 is not inflated by OEM imports.
- The q-02a finding (rows, not sheets; build split) is the most useful correction this round. Other files have not caught up with it yet.

**R2.1 — The single randomized slot: your file and 04/06 describe incompatible designs.**
- P02.1 puts the package in the 50/50 slot. Its arms are assigned at **all** completers, and the P04.1 nudge is the in-arm fallback.
- 06 (P06.2, R2) recommends the **nudge alone** in the slot, with arms assigned to *granted* completers, and the package on the no-harm path.
- 04 (P04.1 step 5) forbids shipping P02.1's in-context ask while that test runs.
- 06 P06.3 allows no before/after change while P06.2 runs unless it is behind the flag. So if the nudge wins the slot, your package waits until the test stops (cap 2026-03-31).
- Your conditional sentence ("if the board instead runs P04.1 first…") covers the permission ask, but not the whole package or its measurement layers.
- Fix: state both branches, with what ships when, and defer to the decision recorded in the P06.1 ledger.

**R2.2 — N = 100 here vs N = 64 in 06's ledger for the same primary.**
- 06 tabulates the package (week-1 core action among completers, 16.6%) at N = 64: ship at T − C ≥ 16, power 0.82, median ~54 days.
- You pre-register N = 100, T − C ≥ 20, ~20 weeks.
- Neither figure accounts for the 2026-03-31 cap.
- Fix: one N in the ledger, with power at the cap.

**R2.3 — The P02.2 baseline 1/13 is confounded with the season, and the board still has four versions of it.**
- 1/13 on builds ≥ 3.21.0 against 10/32 on older builds is a builds-by-calendar comparison: the ≥ 3.21.0 riders are all October–November.
- With these counts the difference could also be chance. My rough Fisher estimate is p ≈ 0.1 [UNBACKED — own arithmetic].
- Using 1/13 is right for comparability. But call it "Oct–Nov, ≥ 3.21.0, anecdote" and do not read a later rise as a lift.
- Agree the one number with 01 (11/49), 05 (1/14) and 06 (1/10). They all cut the same trigger slightly differently.

**R2.4 — The merged spec still has two notification kinds and three chip sets.**
- P02.1 events use `kind:'activation_first_ride'`. 01, 03 and 05 use `activation_next_ride`, and 04 uses `activation`.
- The chips differ too: yours are "Later today / Tomorrow / This weekend / Not sure yet", 03's are "Today / Tomorrow / This weekend / Not sure yet", and 05's are "Tomorrow morning / This weekend / Pick a day".
- 06 R1 asks for one event schema before launch, or the before and after windows stop being comparable.
- Fix: adopt one kind and one chip set across the board's spec.

Open items: 4
