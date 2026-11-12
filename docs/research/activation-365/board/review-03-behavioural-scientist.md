# Skeptic review of 03-behavioural-scientist.md

## Round 1

Reviewed 2026-11-12, covering the draft and its Responses section.

**What I checked.** I opened these citations and they hold:
- NHTSA 813589: "49 percent … in 2021 versus 46 percent in 2022"; weekend = "Friday 6 p.m. to Monday 5:59 a.m. (2.5 days)".
- Bidargaddi et al., JMIR 2018: n=1,255, RR 1.039 (95% CI 1.01–1.08), weekend 8.7% vs weekday 2.5% with P = .18, and 12:30 weekend 11.8% with a **90%** CI of 1.02–1.13.
- Dai, Milkman & Riis 2014: 33.4% / 14.4% / 11.6%.
- The Behavioral Scientist glossary: 642 tests, d = 0.27 for behaviour, 0.15 as an adjusted overall estimate.

**R1.1 — Diagnosis 5 calls the BPS figure a median.**
- The BPS Research Digest says "the average time to reach maximum automaticity was 66 days". It is not a median.
- The 254 days is an extrapolation beyond the 84-day study.
- Fix: correct the word, and say the upper end is extrapolated.

**R1.2 — P03.1 and P03.3 weekly volumes are wrong.**
- "About 23/week finish onboarding": 367 completers over the 08-14 → 11-04 window (11.9 weeks) is about **31 a week** [pack §2].
- P03.3's "~23 eligible riders/week at most" has the opposite problem. The eligible group (granted, no core action, no plan) is a subset of the 171 granted completers, which is about 14 a week [06 q06-resp-subgroups].
- Fix: recompute both figures. Every downstream "readable in N weeks" claim depends on them.

**R1.3 — P03.1 primary metric: the denominator is wrong, and the file has two primaries.**
- The body uses "first-week core-action rate 7.7% (61/793)", which covers all installs. The card is shown only to riders with no saved ride who picked `track_rides`/`discover_routes` or tapped Start on day 0.
- Responses item 3 changes the primary to "real ride saved within 7 days of first open", but the body was not updated.
- Fix: one primary, with a baseline cut to the eligible subgroup (x/y), written into the P06.1 ledger.

**R1.4 — P03.1 outcome check: a winter before/after cannot show a lift.**
- The arithmetic holds roughly. With n = 793 vs 400, 80% power needs about 14.5–15%.
- But it compares an Aug–Oct baseline with a Nov–Jan post window, and your own seasonality warning (point 3) says this is confounded. 06 F11 agrees.
- Fix: relabel it as a harm guardrail only, which your text half-says, and drop the "would clear noise" framing.

**R1.5 — P03.1 timing rests on an exploratory, non-significant result, and the randomisation can't be read.**
- "This weekend → Saturday 12:30" cites the 12:30 weekend lift. That uses a 90% CI, comes from a workplace well-being app, and the weekend vs weekday difference was not significant (P = .18).
- The within-rider randomisation (10:00 vs 12:30) would get perhaps 1–3 "This weekend" pickers a week. It will never produce a readable result this season.
- Fix: tag the time as a default choice [UNBACKED], and drop or park the randomisation.

**R1.6 — Diagnosis 6 and the "What I'd NOT do" list are out of date.**
- "A grant is counted only when the rider taps Enable" is wrong. "Not now" is tracked as `onboarding_step_completed {skipped:true}` (notifications.tsx:207-213), so the grant rate among riders who answered is about 46% [06 F14].
- The 57-vs-176 token gap is explained: there is no FCM config, and there are 0 Android tokens [04 Diagnosis 1].
- So "no server push until the gap is explained" is no longer an open question. The finding is that server push doesn't work on Android.
- Fix: update both statements.

**R1.7 — F7 leaves something [UNBACKED — not checked] that another member has already checked.**
- 02 verified that the checklist starts at 0 of 5 and does not count the onboarding bike (checklist.store.ts:85-90, 153-168).
- Fix: replace the open question with that fact.

**R1.8 — F11 is not evidence.**
- A truncated search snippet ("After the initial honeymoon period, I struggle to f…") from a thread you could not open supports no claim.
- 05 has verified rider quotes on reliability, and I checked them (ADVrider via agent-reach, Reddit "constantly forget").
- Fix: drop F11, or point to 05 F4/F5.

**R1.9 — P03.3: status unclear after the Responses.**
- Responses item 2 drops message (2) and caps the board at one activation message. 06 R3 parks the weekend message until the P04.1 test ends.
- The P03.3 body still specifies two messages, an 80/20 per-rider holdout with no N and no stopping rule ("in a year of data"), and a new settings toggle.
- Fix: mark P03.3 as parked. If any of it stays, give it an N, a stop rule and an allocation compatible with the chosen test.

**R1.10 — P03.2 copy: "GPS and recording work" can be false.**
- On a standstill tap no GPS fix may have arrived. The HUD tracks this through `setGpsAccuracy(lastPoint.accuracy ?? 0)` (ride-hud.tsx:150 on origin/main).
- 02 raised this in its Responses item 1. Your Responses keep the affirming title without the condition.
- Fix: show the "it works" wording only when at least one point with accuracy arrived; otherwise use neutral copy. Name both strings.

Open items: 10

## Round 2

Reviewed 2026-11-12 against the revision and its "Answers to review".

**Closed.** R1.1, R1.2, R1.3 (see R2.4), R1.4, R1.5, R1.6, R1.7, R1.8, R1.9, R1.10.
- On origin/main: `notifications.tsx:207-213` skip tracking; `setGpsAccuracy` at ride-hud.tsx:150; `NOTIFICATION_KIND` holds only document, maintenance, receiptScan, ride_idle and trial_reminder; en.json:574/576/711 as quoted. The sample card is at en.json:739, not 732. You flagged that line as unchecked, so it is not an open item.
- The 12% → 24% two-proportion figure checks out: about 160 per arm.

**R2.1 — P03.2 still uses its own trigger and baseline, not the board's merged one.**
- P03.2 fires "only for the rider's first attempt ever", and its baseline is 6/44, built on 06's day-0 trigger across all builds.
- The board has merged on a different trigger (01 R1, 02 Responses 1, 05 P05.1): no saved ride, `distance_m < 10`, too-short branch, any day, every such sheet.
- Your own Responses item 1 calls this "one plan, two doors". But one door with two triggers is two features.
- 06 also requires a builds-≥ 3.21.0-only before-window, where this subgroup is about 1/10.
- Fix: adopt the merged trigger and the single ledger baseline.

**R2.2 — P03.2 copy states only half the save rule.**
- Both bodies say "Your real ride is saved once you've moved more than 50 m".
- The guard also needs 30 s (`elapsed < MIN_RIDE_ELAPSED_S || dist < MIN_RIDE_DISTANCE_M`, ride-hud.tsx:218). 02 fixed exactly this in its R1.5.
- Fix: state both conditions, interpolated from the constants, or avoid numbers altogether.

**R2.3 — P03.1 measurement point 2: wrong duration.**
- "About 160 eligible riders per side … about 9 weeks at in-season volume": 160 per side is 320 riders in total. At 17.6 a week that is about **18 weeks**, and longer in winter.
- Fix the figure.

**R2.4 — Same card, different eligibility and primary from 02.**
- P03.1 shows the card only to `track_rides`/`discover_routes` riders with no ride, and its primary is "real ride within 7 days of first open" (25/209).
- 02's P02.1 is the same card row. It is shown to every completer with no saved ride, and its primary is "core action within 7 days of `onboarding_completed`" (61/367). 06's ledger row uses 02's version.
- A merged feature needs one eligibility rule and one primary.
- Fix: agree it with 02 and record it in the ledger. Report the other number as a per-goal stratum.

**R2.5 — P03.1 "Expected effect" repeats the d-value mislabel.**
- "d = 0.15–0.27 in the 2024 meta-analysis" presents the range as one behaviour estimate.
- Your F2 has it right: 0.27 is behaviour-specific, and 0.15 is an adjusted *overall* estimate. This is the same error flagged in 02 R1.1.
- Fix: rewrite the sentence to match F2.

**R2.6 — The P06.3 path is not open while the nudge test runs.**
- P03.1 and P03.2 "ship on 06's P06.3 no-harm path", and you agree the single randomized slot goes to P04.1.
- But P06.3 allows no before/after change while P06.2 runs, unless it is behind P06.2's flag. The P03.1 in-context ask also changes the nudge test's eligible group (06 R3, 04 step 5).
- So, as written, P03.1/P03.2 either wait until the nudge test stops (cap 2026-03-31) or ship inside its flag.
- Fix: say which.

Open items: 6
