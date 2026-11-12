# Skeptic review of 05-rider-voice.md

## Round 1

Reviewed 2026-11-12, covering the draft and its Responses section.

**What I checked.**
- **ADVrider** thread 1570843, read through agent-reach (web channel, jina backend). All five quoted phrases are present: "better way", "manually assemble", "paper and a pencil", "odometer to track", "lost years of records".
- **Reddit:** agent-reach Reddit search returns the "I constantly forget to start the ride tracking apps" post.
- **Not reproduced:** the REVER App Store page (R1.1).

**R1.1 — F5 and F9: none of the REVER App Store quotes reproduce.**
- I fetched the cited URL (`apps.apple.com/us/app/rever-motorcycle-gps-rides/id975571447?see-all=reviews`). None of the quotes or reviewer names appeared: HandsomeWeb, Buyer1962, Seahawk1966, dmig77.
- The App Store serves a rotating subset of reviews, so the quotes may be real but cannot be checked. Their dates have no year ("Oct", "Sep 16").
- F5 ("reliability breaks trust faster than anything else") rests mostly on these quotes.
- Fix: attach an archived copy or a screenshot under `docs/research/activation-365/`, or mark the quotes as "seen once, not reproducible" and weaken F5's headline.

**R1.2 — P05.1 target baseline: stale, and it doesn't match the trigger.**
- The P05.1 body uses 34/103, which counts saves at any time.
- Your Responses item 1 gives 13/56. That counts riders whose first sheet came under 50 m and before any ride, measured at any time in the window rather than on day 0.
- 06 gives 6/44 for day-0 too-short riders with no save later that day. 02 and 01 propose a trigger under 10 m.
- q05-sub also pools builds older than 3.21.0. In those builds `ride_too_short_shown` fired even at 120 s or more; the separate `ride_zero_distance_shown` branch only arrived in commit 54146980 on 2026-10-04.
- Fix: agree one trigger with 01 and 02 (distance threshold, day-0 or any day), re-cut one baseline with q00 exclusions, and update the P05.1 body.

**R1.3 — P05.2 primary metric: "baseline 0 by construction" is wrong, and the sentence contradicts itself.**
- Riders can already log past work (`maintenance_task_completed`, log-past-work from PR #164).
- Pack §4 does not split week-1 maintenance completions by goal, so the baseline is unknown, not zero.
- The sentence "0 of 112 … did a week-1 expense or ride, 1 did a ride" contradicts itself.
- Fix: re-run q02 by goal for `maintenance_task_completed` (and DB "marked done", pack §8b) to get the pre-launch baseline for `maintain_bike` riders.

**R1.4 — P05.2: the OEM schedule coverage is unknown and may be near zero.**
- The card needs "the top 1–3 due items from the bike's imported schedule". Memory `project_oem_schedule_africa_twin` says the pipeline has "ZERO model rows".
- If most riders get the fallback ("Add your service interval"), the card asks them to type a schedule. Your F1 says riders don't want that ("not having to manually assemble").
- Fix: run a query for the share of cohort bikes with a schedule row, then state which version most riders will see.

**R1.5 — P05.3: the email has no consent basis as written.**
- 04 Responses item 3 shows that the only stored contact consent is `feedbackContact`. Its label is "The developer may contact me about my feedback", and only 22 of 445 cohort sign-ups set it.
- "Consenting sign-ups" in P05.3 is undefined, and the reachable pool is far below 20.
- Fix: adopt 04's alternative (email only riders who sent feedback, and ask everyone else in the app on the second open), or say what consent you rely on.

**R1.6 — Responses item 3 contradicts the board on the metric.**
- You call `activation_24h` "a sound primary for the ride-side change". 01, 02 and 03 show it scores a planned weekend ride as a failure.
- Your own q05-sub result also points against it: saves after the sheet are spread over 7 days, not 24 h.
- Fix: reconcile. Either argue for 24 h against that evidence, or adopt a 7-day ride-saved primary.

**R1.7 — Diagnosis 1: Home does not "lead with Start ride".**
- 02 read the code (`(tabs)/(home)/index.tsx:133-177, 388-404`). Home leads with the bike plate and a Ride / Expense / Task / Diagnose action row.
- Pack §5's wording is looser than the code.
- Fix: describe the actual screen, because P05.2 proposes to replace part of it.

Open items: 7

## Round 2

Reviewed 2026-11-12 against the revision and its "Answers to review".

**Closed.** R1.1, R1.2 (but see R2.3), R1.3 (but see R2.4), R1.4, R1.5, R1.6, R1.7.
I re-checked:
- The new BMW Connected thread via agent-reach Reddit search: u/ratscabs' merge-the-legs post and u/AsteriodZulu's "Will record 90% of the time but occasionally stop halfway through or not record at…" are present, dated 2025-04-18.
- On origin/main: `describePlate` falls back to READY with `home.noServiceDue` = "No service due" when there is no next task (home-plate.ts:92-103), and `importOemSchedule` exists (oem-schedules.resolver.ts:79-80).
- The schedule-coverage finding (S1–S3) is new and important, and it agrees with 01's q01-r2-d.

**R2.1 — Diagnosis 1 and the P05.1 hypothesis still cite "125 of 221 sheets".**
- 02's re-run (q-02a, after its R1.6) shows that 221 counts event rows (`shown`/`keep`/`end`), not sheets, and that it mixes builds.
- On builds ≥ 3.21.0 the figures are 20 of 31 `shown` sheets (16 riders) at under 10 m and 30 s.
- Fix: update both places.

**R2.2 — The P05.1 title "Test ride: all good" is unconditional.**
- Your Responses item 1 says you take P03.2's title. But P03.2 (after its R1.10) now uses that title only when a GPS fix arrived, and "Testing it out?" (your own draft-1 wording) otherwise. 02 asks the same.
- Fix: adopt both strings and the `gps_fix` property.

**R2.3 — The P05.1 win bar is a pooled, all-build baseline read as a winter lift.**
- "Call it a win only if the 7-day saved share clearly beats 24%" compares post-launch riders, all on builds ≥ 3.21.0 in Nov–Jan, with 11/46 pooled over Aug–Nov builds.
- Your own P1-ver gives 1/14 for ≥ 3.21.0. 06 requires a ≥ 3.21.0-only before-window, and P06.3 allows no lift claim this winter.
- Fix: restate the read as a harm check plus the mechanism chain, and use the single ledger baseline agreed with 01 (11/49), 02 (1/13) and 06 (1/10).

**R2.4 — P05.2's primary metric is produced by the feature itself.**
- The new sheet's "Last oil change" answer "writes a past-work completion", which is `maintenance_task_completed`.
- The primary is "maintain_bike riders with a `maintenance_task_completed` on day 0", baseline 0/112. Any rider who answers the chip therefore moves the primary by construction. That is the `feedback_metric_measures_something_else` trap.
- Fix: report sheet-written completions separately (a `source` property), and choose an outcome the sheet cannot write. Options: the 60-day `reminder_opened {kind:'maintenance'}` read you already propose, a later-day return, or completions outside the sheet.

**R2.5 — P05.2 and its schedule-import investigation would move the same metric at the same time.**
- The secondary ("first bike has a schedule by end of day 0", 7/34) will change if the October import drop (step 5) is fixed, whatever the plate does.
- 06 P06.3 allows only one before/after change in flight.
- Fix: sequence them, or attribute the change by `service_plan_imported` events and never by the secondary's before/after.

**R2.6 — The merged spec still diverges in the P05.1 details.**
- Your chips ("Tomorrow morning / This weekend / Pick a day") differ from 02's and 03's.
- Your events differ from 03's `next_ride_plan_set` / `reminder_scheduled` and 04's `activation_*`: `variant:'first_test'`, `activation_reminder_scheduled`.
- Your no-permission path ("Turn on notifications" → checklist fallback) differs from 02/03's one in-context OS ask.
- 06 R1 asks for one property set before launch.
- Fix: align with the single spec.

**R2.7 — P05.3 sends free text to PostHog.**
- `install_reason_answered {answer}` with a free-text "something else" option will collect whatever riders type, including names, emails or plates.
- Fix: cap the length and say the text is not shown elsewhere, or store the free text in the DB under the account and send only the category to PostHog.

Open items: 7
