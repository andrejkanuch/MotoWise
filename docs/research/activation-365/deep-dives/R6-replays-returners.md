# R6 — Replays: returners vs non-returners, and the full friction register (#365)

Research only, 2026-11-12. Nothing in the app, PostHog, RevenueCat, GitHub or Supabase was changed. No new Replay Vision
scan was started. Code is cited from the clean checkout of `origin/main` at `52d281e9` (`a clean checkout of origin/main`).
Replay links: `https://eu.posthog.com/project/155556/replay/<session_id>` (the appendix gives the 8-character prefix; the full
ids are in the evidence below and in the scanner listings).

**Bottom line**

1. The 21 sessions that `05-session-replay-findings.md` had not read yet, and all the others, have now been read: 106 of 107
   post-onboarding observations (1 ineligible) and 60 of 67 onboarding drop-off observations (7 ineligible). [SOURCE: R6-V1, R6-V2]
2. Of the 100 scanned riders who finished onboarding before 2026-11-11 (so day 2 can be seen), **16 came back on day 2 (16%)**,
   the same as the 15.8% baseline. [SOURCE: R6-q2; evidence pack §2]
3. **First-session friction does not separate returners from non-returners.** Returners hit as many paywalls (2/16 vs 10/84),
   ride attempts (3/16 vs 13/84), "too short" sheets and rage clicks as non-returners. What separates them is who they are and
   whether they logged something: push permission granted (12/45 = 27% back vs 4/55 = 7%, Fisher p = 0.013), an expense or
   maintenance entry in the first session (5/11 = 45% vs 11/89 = 12%, p = 0.014), goal `track_rides` (13/59 vs 3/41, p = 0.056),
   and goal `maintain_bike` (**0/19** back, p = 0.037). [SOURCE: R6-q1, R6-q2, R6-F1]
4. So fixing the frictions is hygiene (they cost riders time and trust and some are plain bugs), but on this evidence it is
   **not** the lever that moves day-2 return; Experiment 1 (first-ride plan) and Experiment 2 (day-0 service schedule) stay the
   levers. Confidence 60% (section 3).
5. Two patterns are new and strong enough to act on: **diagnostics-first jumped on 3.26.0** (29 of 117 completers start a
   diagnosis in the first hour, 25%, vs 3–9% on 3.19–3.21) and **half of the riders who open Start Ride on day 0 never start**
   (67 of 130). Six smaller new frictions are listed (PO12–PO17). [SOURCE: R6-q3, R6-q9]
6. Every friction now has a spec with a repro, an expected result, an automated check (Maestro flow or jest test) and a HogQL
   metric with a per-version baseline (section 5). The release marker the owner asked for is task T0: two super properties
   (`activation_fix_level`, `ota_update_id`, same names as R4/R5) plus a PostHog annotation per release, so each metric can be
   read per fix level even when a fix ships as an OTA that keeps `$app_version`.

---

## 1. Question

- Finish the replay analysis of scanner A (`01a1cfa6-4f63-7b8b-bd0c-9dbd6bace7a1`, first session after onboarding, 107
  sessions; 21 not yet in 05) and scanner B (`01a1cfa9-dc29-76b9-91f0-84a19deb33b0`, onboarding drop-offs, 60 analysed).
- For each scanner-A session: did the rider come back on the calendar day after `onboarding_completed`? Compare returners and
  non-returners on first action, ride attempt, paywalls, dead taps, time spent and diagnostics.
- Update the count of every OB/PO finding, flag new frictions, and define each friction so an agent can later prove it is gone,
  per release.

## 2. Evidence

### 2.1 Replay Vision reads (read-only; no scans started)

| Id | Call | Result |
|---|---|---|
| R6-V1 | `vision-scanners-observations-list {"scanner_id":"01a1cfa6-…","limit":200}` (--json, saved to the session scratchpad, all 616 k chars read) | 107 observations: 106 `succeeded`, 1 `ineligible` (`01a1ceb5`, "only 5.5 s of active interaction"). Created 12:05 (86) and 12:14 (21 new). Model `gemini-3-flash-preview`, monitor type, the prompt quoted in 05. |
| R6-V2 | `vision-scanners-observations-list {"scanner_id":"01a1cfa9-…","limit":200}` (--json, all 354 k chars read) | 67 observations: 60 `succeeded`, 7 `ineligible` (too_inactive). 2 of the 60 are actually completers (`01a1ccf6`, `01a1cd34`, verdict "no"). |

I coded every scanner-A observation by hand into: first post-onboarding action (DIAG, RIDE, LOG, BIKE, BROWSE, NONE,
INCONC), whether a ride attempt is visible, and friction tags. The coding is in the appendix, one row per session. AI summaries
can be wrong (e.g. `01a17491` and `01a1a973` describe a logged service that no event confirms; `01a1c670` describes a
"Connect Google Fit / Apple Health" page that I cannot find in the app). Every count below says whether it rests on the
replay text, on events, or on both.

### 2.2 PostHog queries (project 155556, EU, `execute-sql`, read-only, test persons excluded where people are counted)

All are noncanonical one-off derivations (the governed metric catalog is empty, evidence pack §0).

**R6-q1 — per scanned session: owner and in-session events.** `$session_id IN (<107 ids>)`, 2026-10-10 → 11-13, grouped by
session: `argMax(person_id)`, `minIf(timestamp, event='onboarding_completed')`, `$app_version`, `platform`, counts of
`ride_started`, `ride_too_short_shown`, `paywall_present_requested` (all, and those whose `placement` is not `onboarding%`),
`diagnostic_started/submitted/completed`, `diagnostic_limit_reached`, `diagnostic_failed`, `expense_added`,
`maintenance_task_created/_completed`, `garage_bike_added`, `$rageclick`, `Application Backgrounded`.
Result: 107 sessions, 107 distinct persons, none of them a test person; 99 on 3.26.0, 5 on 3.27.0, 3 on 3.28.0; 78 Android, 29 iOS.
`$dead_click` does not exist in this project (taxonomy warning), so dead taps come only from the replay text. `$rageclick`
does exist. Per-session values are in the appendix.

**R6-q2 — per owner: day-2 return and week 1.** Person-level `min(onboarding_completed)` (2026-10-01 → 11-13), then:
`d2_return` = any `Application Opened` / `Application Became Active` / `$screen` on `toDate(ob)+1` (UTC, the evidence-pack
definition); `ever_return` = any of those on a later day; week-1 saved ride (`ride_completed` with `below_min_ride` not
true), `expense_added`, maintenance; `notification_permission_result {permission_granted:true}`; `primary_goal`.
Result: 107 persons; 7 completed on 11-11 or 11-12 and are not yet observable → **100 eligible, 16 back on day 2, 25 back
on any later day.** Per-person values in the appendix.

**R6-q3 — first-hour friction flags for all completers, by `$app_version` of `onboarding_completed`.** Completers whose
first `onboarding_completed` is 2026-09-13 → 11-10 (282 persons, q00 excluded). Result:

| ver | completers | d2 back | ride ≤120 s after completion | MAX_BIKES paywall 1 h | AI-diag paywall 1 h | diagnosis started 1 h | diag limit 1 h | diag failed 1 h | ≥2 paywall req (−10 min…+1 h) | ≥3 | non-onboarding paywall 1 h | too-short day 0 | ride started day 0 | completed twice | `$rageclick` 1 h | garage bike added 1 h | core action day 0 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 3.19.0 | 43 | 9 | 11 | 2 | 3 | 3 | 0 | 0 | 10 | 7 | 8 | 9 | 16 | 0 | 0 | 15 | 4 |
| 3.19.1 | 69 | 10 | 9 | 6 | 4 | 6 | 0 | 0 | 8 | 5 | 16 | 10 | 15 | 3 | 0 | 26 | 10 |
| 3.20.0 | 11 | 2 | 1 | 3 | 0 | 0 | 0 | 0 | 1 | 0 | 3 | 0 | 2 | 0 | 0 | 3 | 2 |
| 3.21.0 | 33 | 7 | 5 | 2 | 0 | 4 | 0 | 1 | 3 | 0 | 6 | 5 | 10 | 2 | 3 | 13 | 4 |
| 3.22.0 | 3 | 0 | 0 | 0 | 0 | 1 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 0 |
| 3.25.0 | 3 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 1 | 0 | 0 | 0 | 2 | 0 | 1 |
| **3.26.0** | **117** | **14** | 9 | 7 | 5 | **29** | 4 | 2 | 13 | 7 | 13 | 9 | 18 | 1 | 7 | **7** | 13 |
| 3.27.0 | 3 | 3 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 2 | 0 | 2 | 0 | 2 |
| **all** | **282** | **45** | **37** | **21** | **12** | **43** | **4** | **4** | **36** | **19** | **47** | **35** | **63** | **6** | **15** | **65** | **36** |

Caveat: a person who first completed onboarding before 09-13 and completed it again in the window is counted with the later
date. `$rageclick` only appears from 3.21.0 on (0 on 3.19.x), so it cannot be compared across that boundary.

**R6-q4 — source of rides started on day 0.** `ride_started.source` for completers (60 d): `phone` for all but 3 starts
(null). Within 120 s of completion: 39 starts by 37 riders, all `phone`. Later on day 0: 36 starts by 29 riders. No auto-start
source exists.

**R6-q5 — onboarding bike vs. garage re-add (60 d, by first `onboarding_completed`).**

| `has_bike` at completion | `bike_model` blank | completers | garage bike added ≤1 h | MAX_BIKES paywall ≤1 h | d2 back |
|---|---|---|---|---|---|
| false | — | 34 | 15 | 0 | 5 |
| true | no | 105 | 1 | 6 | 21 |
| true | yes | 143 | 49 | 15 | 19 |

**R6-q6 — `onboarding_completed` bike fields by version (60 d).** `has_bike` true / of those with blank `bike_model`:
3.19.0 35/27, 3.19.1 64/40, 3.20.0 10/4, 3.21.0 34/17, 3.26.0 107/54, 3.27.0 6/1, 3.28.0 2/1. `bike_make` is never blank.

**R6-q7 — identified riders since 2026-10-13 with a blank-model onboarding bike who added a garage bike within 1 h.**
Result: **0 rows.** The 49 re-adds in R6-q5 all happened before 10-13 (older builds). On 3.26.0, garage re-add in the first
hour is 7/117.

**R6-q8 — onboarding friction flags per starter (60 d), by `$app_version` at start.**

| ver | starters | completed | viewed an early step after a later one (OB1) | `onboarding_resumed` | bike setup timed | bike setup median s | bike setup > 60 s (OB4) | stopped at account (OB5) |
|---|---|---|---|---|---|---|---|---|
| 3.19.0 | 120 | 44 | 6 | 22 | 90 | 39 | 21 | 20 |
| 3.19.1 | 103 | 66 | 8 | 8 | 78 | 44.5 | 26 | 12 |
| 3.21.0 | 46 | 27 | 7 | 11 | 36 | 53.5 | 17 | 4 |
| **3.26.0** | **166** | **96** | **16** | **19** | **133** | **45** | **56** | **21** |
| 3.27.0 | 8 | 6 | 1 | 1 | 8 | 42.5 | 1 | 0 |
| 3.28.0 | 5 | 2 | 1 | 0 | 4 | 31.5 | 0 | 1 |
| **all (incl. small versions)** | **472** | **254** | **44** | **64** | **367** | **44** | **127** | **63** |

"Early step after a later one" = a `onboarding_step_viewed` for `experience`/`bike_setup`/`welcome` later than the first view of
`goals`/`account`/`heard_about`/`notifications`. "Stopped at account" = viewed `account`, never viewed a later step and never
signed up or in.

**R6-q9 — Start Ride opened but no ride (completers, 60 d, day 0 after completion).** Riders with a `$screen` whose name
contains `start-ride`: **130; 63 started a ride that day, 67 (52%) did not.**

**R6-F1 — two-sided Fisher exact tests on the 100 eligible riders** (own computation from R6-q1/q2, plain Python):
push granted p = 0.013; logged expense/maintenance in the first session p = 0.014; goal `maintain_bike` p = 0.037;
goal `track_rides` p = 0.056; iOS p = 0.22; rage click p = 0.14; any diagnosis event p = 0.55; first action BIKE p = 0.36;
non-onboarding paywall p = 1.0; ride started p = 0.72. With ~10 comparisons, only push and logging stay notable; read
`maintain_bike` as a strong hint, not a proof.

### 2.3 Supabase production (read-only SELECT via the Management API)

**R6-s1 — first-day bikes per new account (accounts created 2026-10-13 → 11-10, synthetic/test excluded as in q08).**
0 bikes on day 0: 39; 1 live bike with a model: 74; 1 live bike with a blank model: 47; 1 bike soft-deleted on day 0: 1;
2 bikes (1 deleted): 1. So since 10-13 a rider almost never ends day 0 with two bikes, and 47 of 161 accounts (29%) have a
make-only first bike. (The "0 bikes" row also holds riders who chose "I'll add my bike later" and accounts that never finished
onboarding.) No emails or names were read.

### 2.4 Code read (origin/main 52d281e9)

- Free tier: `MAX_BIKES: 1`, `MAX_AI_DIAGNOSTICS_PER_MONTH: 1` — `packages/types/src/constants/limits.ts:4-6`; server gate
  `apps/api/src/modules/motorcycles/motorcycles.service.ts:208`.
- Ride floors: `MIN_RIDE_ELAPSED_S = 30`, `MIN_RIDE_DISTANCE_M = 50` — `apps/mobile/src/utils/ride-constants.ts:25-26`; the HUD
  guard event `ride_too_short_shown` vs `ride_zero_distance_shown` (≥120 s) — `apps/mobile/src/app/(modals)/ride-hud.tsx:55-67`.
- No code path opens the Ride HUD after onboarding on its own: the only routes into it are Start Ride after a start
  (`app/(modals)/start-ride.tsx:111`), resuming an unfinished ride (`features/ride/use-unfinished-ride.ts:73`) and
  `rideRouteFor` when a ride is live (`features/ride/ride-route.ts:25`). Matches R4 (Q-R4-05: 0 HUD views without a start).
- Location denied on Start Ride shows an alert "Location required" with Open Settings — `app/(modals)/start-ride.tsx:99-102`.
  Replay `01a1c85b` shows a spinner and a return to the setup screen; the alert itself may not be captured by the replay.
- Onboarding finish: "Open my garage" flips `onboardingCompleted`, the root guard redirects to Home
  (`app/(onboarding)/personalizing.tsx:389-393`); a safety net shows Retry/"Skip and continue" after 8 s if the server
  mutation has not returned (`personalizing.tsx:376-383`); `garage_first` presents the paywall first (`personalizing.tsx:413-473`).
- Onboarding resume after a relaunch routes to the last persisted step (`app/(onboarding)/index.tsx:84-92`).
- The "Get started" checklist row `FIRST_RIDE` links to the rides list (`apps/mobile/src/stores/checklist.store.ts:67-70`); none of
  the row labels the AI read in `01a1b7ee` ("Log first service", "Add your documents", "Join a club") exist in `en.json`, so that
  observation is probably a paraphrase of masked text.
- The diagnose limit event fires in `app/(tabs)/(diagnose)/new.tsx:222`; paywall requests are tracked in
  `apps/mobile/src/lib/subscription.ts:849` with `feature` / `limit_key` / `placement`.
- Super properties: `registerSuperProperties` exists (`apps/mobile/src/lib/analytics.ts:490-492`, used for `intent_cohort` at
  `:400`). No OTA update id is sent today (no `updateId` in `lib/analytics.ts`).
- Maestro: flows in `apps/mobile/.maestro/flows/`, shared steps in `_shared/onboarding-to-account.yaml`; `onboarding.yaml`
  signs in a pre-created user and closes any paywall with `optional: true`; `add-bike.yaml` documents that a free rider with the
  onboarding Honda hits the MAX_BIKES paywall "correct app behaviour" (`apps/mobile/.maestro/README.md`).

## 3. Root cause

### 3.1 Returners vs non-returners (100 eligible riders, 16 back on day 2)

| Signal (first session unless noted) | Returners (16) | Non-returners (84) | Read |
|---|---|---|---|
| First action: DIAG / RIDE / LOG / BROWSE / BIKE / NONE / INCONC | 4 / 2 / 3 / 6 / 0 / 0 / 1 | 15 / 12 / 17 / 25 / 10 / 3 / 2 | Day-2 return by first action: DIAG 4/19, RIDE 2/14, LOG 3/20, BROWSE 6/31, **BIKE 0/10, NONE 0/3** |
| Ride started (event) / too-short sheet (event) | 3 / 3 | 13 / 7 | No difference (19% vs 15%) |
| Ride attempt visible in the replay | 5 | 28 | — |
| Any non-onboarding paywall request | 2 (4 requests) | 10 (18 requests) | No difference |
| ≥2 paywall requests in the session | 2 | 10 | No difference |
| Any diagnosis event / hit the diagnose limit / diagnosis failed | 3 / 0 / 0 | 25 / 4 / 1 | Diagnosis 3/28 back vs 13/72 (11% vs 18%), not significant; **none of the 4 limit-hitters came back** |
| `$rageclick` / dead tap in the replay | 5 / 1 | 12 / 4 | Rage clicks go **with** engagement: 5/17 back vs 11/83 |
| Logged an expense or maintenance in the session | 5 | 6 | **5/11 back (45%) vs 11/89 (12%)** |
| Garage bike added | 1 | 5 | — |
| Recording after `onboarding_completed`, median | 216 s | 144 s | Longer, but 3/22 sessions under 60 s still returned |
| Push permission granted in onboarding | 12 | 33 | **12/45 back (27%) vs 4/55 (7%)** |
| Goal | track_rides 13, manage_expenses 2, just_exploring 1 | track_rides 46, maintain_bike 19, manage_expenses 8, just_exploring 9, discover_routes 2 | **maintain_bike 0/19** |
| Platform | Android 10, iOS 6 | Android 65, iOS 19 | iOS 6/25 vs Android 10/75 |
| Week 1 (any time): saved ride / expense / maintenance | 6 / 7 / 7 | 1 / 2 / 7 | Saved rides almost only among returners (partly circular: they came back to ride) |

Returner sessions: `01a1405c` (diagnosis, push), `01a14517` (ride, too short, rage), `01a16255` (ride setup, 2 paywalls),
`01a17228` (diagnosis articles), `01a19d1b` (checklist → maintenance ×10 → ride), `01a1a1dd` (empty states, receipt dead taps),
`01a1ace6` (looped back into email verification), `01a1b1de` (feature tour; app restarted to onboarding), `01a1b7b1` (Open my
garage loop, recording ends), `01a1b858` (diagnosis), `01a1b8df` (browse, receipt sheet), `01a1bb5b` (Discover + paywall,
diagnosis, rage), `01a1c0e7` (route planner rage → expense), `01a1c5f0` (3 expenses), `01a1c672` (ride, too short),
`01a1c749` (checklist, ride, too short, rage). Six of the 16 met a clear friction (loop, too-short, rage, paywalls) and still
came back.

**Verdict.** In the first session, friction is everywhere and does not predict who returns. The returners are riders who
(a) came for ride tracking, (b) granted push in onboarding, and (c) logged something right away; riders who came to maintain
their bike (0/19) or who spent the session on the bike card, photo or recalls (0/10) did not return.
[SOURCE: R6-q1, R6-q2, R6-F1] This matches the evidence pack (ride-first 83% back, maintain_bike 3.6%, push 16.8% vs 5.3%)
on an independent, replay-checked sample. **Confidence: 60%.**
What would raise it: (1) another ~100 scanned first sessions (the 16-returner group is small; only 2 of 10 tests clear p < 0.05);
(2) the Experiment 1 randomized read, which is the only clean test of "does changing the first session change return";
(3) repeating R6-q2 with the engaged-return definition (no notification-driven opens) from board/06 F14.

### 3.2 Per-friction root causes (short; the owning deep dive has the long form)

| Friction | Cause verdict | Confidence | Owner deep dive |
|---|---|---|---|
| OB1 step regression | Relaunch resumes at the last *persisted* step; plus `resetForSignOut` on a null-session blip (05 OB1-H/H2) | 55% | R5 |
| OB2 Google sign-in hang | Separate Android activity, no outcome event | 50% | R5 |
| OB4 slow bike search | Long make/model lists; 42% of 3.26.0 riders take > 60 s (R6-q8) | 70% (that it is slow); cause of drop unproven | R5 |
| OB6 "Open my garage" loop / Retry / blank | Retry shows when the server mutation takes > 8 s (`personalizing.tsx:376-383`); loop = resume path or paywall hand-off re-entering personalizing (HYPOTHESIS) | 40% | this file (T4) |
| PO1 MAX_BIKES | Make-only onboarding bike + 1-bike free tier; much smaller since 10-13 (R6-q5/q7) | 75% | R2 |
| PO2 diagnostics first | 3.26.0 surfaces diagnosis more (25% start one in hour 1 vs 3–9%); limit = 1/month | 65% that the jump is real; cause of the jump not read in code | R3 |
| PO3 repeated paywalls | Each gate presents its own paywall; no frequency cap | 70% | R3 |
| PO4 standstill too-short | Riders test Start at home; guard treats it as an error | 85% | R4 |
| PO5 "HUD opens by itself" | **Reclassified:** riders tap Start within 2 min (37/282); no auto-open code path | 80% | R4 |
| PO14 Start Ride opened, not started | Unknown: setup screen asks for bike/permissions/options; 67/130 leave it | 35% | this file (T5) |
| PO12 sign-in screen after onboarding | Google SignInHub activity shown after completion (3 replays); cause unknown (re-auth? account link?) | 30% | this file (T6) |
| PO13 app returns to onboarding after completion | Same mechanism as OB1-H2 (`resetForSignOut`), unverified | 35% | R5 + T6 |

## 4. Fix options

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| A. Fix every friction first, then test the first session | Removes bugs; good for trust and reviews | R6 says friction does not separate returners; at ~2–3 completers/day a winter before/after cannot show a lift (board D8) | Do the **bugs** (OB6, PO12/PO13, PO14 if a bug, PO7) on the no-harm path, not as the #365 lever |
| B. Steer the first session toward a logging action or a ride plan (Experiment 1 + checklist) | Targets the strongest separator found (logging 45% vs 12%; track_rides) | Logging-first is partly selection; maintain-first riders still need a reason to come back | **Yes** — already the board plan; R6 adds evidence |
| C. Give `maintain_bike` riders their service plan on day 0 (Experiment 2) | 0/19 maintain-goal riders came back; the web sells maintenance | Effect unbacked | **Yes** — R6 strengthens the case |
| D. Gate diagnostics harder or hide it | Fewer limit paywalls | Riders choose it first (19/103); policy says handle the friction, do not promote or remove | **No**; instead explain the free quota before input (R3) |
| E. Measure per release (fix level + OTA id + annotations) | Lets every fix be proven per release, including OTAs | One small PR; needs discipline to bump the level | **Yes, first (T0)** |

**Recommended:** T0 (release marker + scoreboard) first; then the bug-class fixes T3–T7 on the no-harm path; the activation
levers stay Experiment 1 and Experiment 2. Every UI change works in light and dark mode; nothing touches the onboarding paywall
placement or its A/B tests.

## 5. Friction specs

Common frame for every production metric: cohort = persons whose first `onboarding_completed` (or `onboarding_started` for OB*)
falls in the window; q00 test persons excluded; break down by `$app_version` **and**, once T0 ships, by `activation_fix_level`
and `ota_update_id`. Read with the P06.3 rule: a mechanical metric (the friction event itself) is read directly; day-2 return
is a harm check only. All baselines are 60 days to 2026-11-12 unless stated.

Reusable snippet (named **SCOREBOARD-CTE** below):

```sql
WITH ob AS (
  SELECT person_id, min(timestamp) AS ob_at,
         argMin(toString(properties.$app_version), timestamp) AS ver,
         argMin(toString(properties.activation_fix_level), timestamp) AS fix_level   -- null until T0 ships
  FROM events
  WHERE event = 'onboarding_completed'
    AND timestamp >= {date_from} AND timestamp < {date_to}
    AND person_id NOT IN (<q00 test persons>)
  GROUP BY person_id
)
```

### F-OB1 — onboarding jumps back to an earlier step

1. **Repro:** Android emulator (API 34) and iOS simulator, release build, fresh install, new email account. Go to the account
   step; (a) tap Google and return; (b) request an email code, background the app for 60 s, force-stop it, relaunch.
2. **Expected:** the rider lands on the step they left (account / code entry) or later, never on `experience`, `bike_setup` or
   `welcome`, and entered data (bike, goals) is kept.
3. **Automated:** Maestro `apps/mobile/.maestro/flows/onboarding-relaunch-resume.yaml` (new): `runFlow: _shared/onboarding-to-account.yaml`
   → `stopApp` → `launchApp: {clearState: false}` → `extendedWaitUntil: {visible: "Continue with email", timeout: 30000}` →
   `assertNotVisible: ".*How long have you.*"`. The email-code variant is R5's `onboarding-email-code-relaunch.yaml`.
   Jest: resume-target tests next to `app/(onboarding)/index.tsx` (resume never returns a step before the last *viewed* step),
   and `lib/__tests__/auth-state-change.test.ts` (a null-session event during onboarding does not call `resetForSignOut`).
4. **Metric:** share of starters who view an early step after a later one.
   ```sql
   SELECT ver, count() AS starters, countIf(regress) AS regressed, round(100*countIf(regress)/count(),1) AS pct
   FROM (SELECT person_id, argMin(toString(properties.$app_version), timestamp) AS ver,
           maxIf(timestamp, event='onboarding_step_viewed' AND toString(properties.step) IN ('experience','bike_setup','welcome'))
             > minIf(timestamp, event='onboarding_step_viewed' AND toString(properties.step) IN ('goals','account','heard_about','notifications'))
           AND countIf(event='onboarding_step_viewed' AND toString(properties.step) IN ('goals','account','heard_about','notifications')) > 0 AS regress
         FROM events WHERE timestamp >= {from} AND timestamp < {to}
           AND event IN ('onboarding_started','onboarding_step_viewed') AND person_id NOT IN (<q00>)
         GROUP BY person_id HAVING countIf(event='onboarding_started') > 0)
   GROUP BY ver ORDER BY ver
   ```
   **Baseline 44/472 (9.3%); 3.26.0 16/166 (9.6%)** [SOURCE: R6-q8]. Replays: 12 clear app-driven regressions + 6 ambiguous
   (user may have tapped back) of 60 drop-offs, plus 2 completers sent back into onboarding (`01a1ace6`, `01a1b1de`) [SOURCE: R6-V1/V2].
   **Target:** ≤ 3% per version (some riders do go back on purpose), and 0 in the Maestro flow.

### F-OB2 — Google sign-in shows a blank screen or a long spinner

1. **Repro:** Android emulator with Google Play services, new install, account step → "Continue with Google"; cancel once, then
   complete; also put the app in the background while the Google sheet is open.
2. **Expected:** returns to the account step within 3 s of cancel/finish; on success the next step appears; a spinner never stays
   > 10 s without a retry/cancel affordance.
3. **Automated:** R5 `onboarding-oauth-cancel.yaml` (cancel path; real Google consent cannot be automated, so success is covered
   by jest `hooks/__tests__/use-oauth-sign-in.test.ts` with the native module mocked: timeout → error state with retry).
4. **Metric:** needs `oauth_sign_in_started` / `oauth_sign_in_result {provider, outcome, duration_ms}` (R5 instrumentation).
   **Baseline: not measurable today** (05 gap 1). Replays: 11 of 60 drop-offs (`01a15602, 01a157e2, 01a1a2d5, 01a14063,
   01a142bd, 01a17396, 01a1ac55, 01a1cebb, 01a1ac74, 01a151de, 01a1c1e9`). **Target:** p90 duration < 10 s; `outcome='error'` < 5%.

### F-OB3 — email code: leave to read it, come back to a reset flow

Spec owned by R5 (F-OB3, `onboarding-email-code-relaunch.yaml`). Replay count unchanged: 3 (`01a151ef, 01a18023, 01a1bb66`).
Metric: `user_signed_up` / code-sent riders per version; baseline 16/19 verified (05, 60 d).

### F-OB4 — bike search is long

1. **Repro:** fresh install, bike setup, search for a mid-popularity model (e.g. "SYM Jet X 125", "Euromot Rex 150") by typing
   and by scrolling the brand list.
2. **Expected:** a typed make or model shows a match in ≤ 2 s and ≤ 3 taps; a no-match offers "add as typed" (make-only is fine).
3. **Automated:** R5 `onboarding-bike-search.yaml` (type "Jet X" → assert result row within 5 s → select → reveal visible).
4. **Metric:** median seconds `bike_setup` viewed → completed, and share > 60 s (R6-q8 query, columns `bike_setup_median_s`,
   `ob4_bike_over_60s`). **Baseline: median 44 s; 127/367 (35%) > 60 s; 3.26.0: 45 s, 56/133 (42%)** [SOURCE: R6-q8].
   Replays: 11 drop-offs (`01a15363` rage, `01a16373`, `01a18d27`, `01a181bb` 100 s, `01a1a5ae`, `01a1bd21`, `01a1ba3f` re-picked 4×,
   `01a14063`, `01a1cebb`, `01a197a4` slow spinners, `01a1a203`). **Target:** > 60 s share ≤ 25%.

### F-OB5 — riders leave on the sign-up screen without trying

Record only (the account wall is a product decision; R5 owns it). Metric: R6-q8 `ob5_stopped_at_account`.
**Baseline 63/472 (13%); 3.26.0 21/166** [SOURCE: R6-q8]. Replays: 6 (`01a14563, 01a19e72, 01a1ce49, 01a1ba3f, 01a19c1e, 01a18d27`).
Automated check: R5 `onboarding-account-visible.yaml` (the account screen renders all providers in light and dark).

### F-OB6 — "Open my garage" loops, shows Retry, or a blank screen

1. **Repro:** iOS simulator and Android emulator, network link conditioner "3G/High latency", fresh install, finish onboarding in
   each paywall arm (`garage_first`, `commit_first`); tap "Open my garage" once.
2. **Expected:** Home shows within 5 s of the tap; personalizing is never shown again in the same session; no Retry when all steps
   are ticked; no black/white screen > 3 s.
3. **Automated:** Maestro `apps/mobile/.maestro/flows/post-onboarding-landing.yaml` (new): `runFlow: onboarding.yaml` (it already
   taps "Open my garage" and closes the paywall with `optional: true`; RevenueCat is not live in test runs) →
   `extendedWaitUntil: {visible: {id: "home-screen"}, timeout: 10000}` → `assertNotVisible: ".*Personalizing.*|Open my garage|Retry"`
   → `waitForAnimationToEnd` → wait 5 s → assert again → `takeScreenshot: post-onboarding-light`; runner repeats with
   `xcrun simctl ui booted appearance dark` / `adb shell cmd uimode night yes` → `takeScreenshot: post-onboarding-dark`.
   (`home-screen` testID: add in T4 if missing.) Jest: `app/(onboarding)/__tests__/personalizing.test.tsx` — with `completionSent`
   true and `mutationDone`, the CTA calls `setOnboardingCompleted(true)` exactly once; a second mount does not show the payoff.
4. **Metric:** (a) completers with `onboarding_completed` ≥ 2; (b) new event `post_onboarding_landed {screen, ms_since_cta}`
   (board instrumentation list) → p90 `ms_since_cta`.
   ```sql
   -- (a), with SCOREBOARD-CTE
   SELECT ob.ver, count() AS completers, countIf(n >= 2) AS completed_twice
   FROM ob INNER JOIN (SELECT person_id, count() AS n FROM events WHERE event='onboarding_completed'
                         AND timestamp >= {from} AND timestamp < {to} GROUP BY person_id) c ON c.person_id = ob.person_id
   GROUP BY ob.ver ORDER BY ob.ver
   ```
   **Baseline (a) 6/282 (2.1%)** [SOURCE: R6-q3]; (b) not measurable today. Replays: 7 completers (`01a14a5c` loop, `01a185da` 4×,
   `01a18b3f` 10 s black, `01a1b7a8` Retry with all ticked, `01a1b7b1` and `01a1c1b6` CTA does nothing / loops,
   `01a1c1bb` 28 s white screen) + 4 drop-offs (`01a14ca9` stuck spinner, `01a151de`/`01a197a4` CTA opened a sign-in, `01a1cebb`
   dead CTA). **Target:** (a) 0 per version; (b) p90 < 3,000 ms.

### F-PO1 — adding "my" bike hits the MAX_BIKES paywall

Spec owned by R2 (`bike-limit-update-bike.yaml`). Updated counts: replays 2 direct (`01a15d55`, `01a18376`) + 1 MAX_BIKES banner
(`01a19cbe`) + 3 Homes showing "add your first bike" (`01a14652`, `01a1518f`, `01a15f79`). Events: MAX_BIKES paywall in the first
hour **21/282 overall, 7/117 on 3.26.0**; garage bike added in the first hour fell from 26/69 (3.19.1) to **7/117 (3.26.0)**, and
since 10-13 no blank-model rider re-added a bike in the first hour [SOURCE: R6-q3, R6-q5, R6-q7]. Metric: R6-q3 column
`po1_maxbikes_1h`; target ≤ 2% per version.

### F-PO2 — diagnostics first, ending in a limit paywall, an error or a long wait

Spec owned by R3 (`diagnose-quota-used.yaml`, `diagnose-limit-loop.yaml`). Updated counts: DIAG is the first action in **19 of
103** conclusive replays; 29 sessions have a diagnosis event; limit hit in 4 (`01a163b0, 01a18376, 01a19cbe, 01a1a274` — none came
back), errors in 2 (`01a150c1`, `01a1546d` with 6 `diagnostic_failed`), 30 s analysis wait in `01a18376`. Events: diagnosis in the
first hour **43/282; 3.26.0 29/117 (25%) vs 3.19.0 3/43, 3.19.1 6/69, 3.21.0 4/33**; AI-diag paywall 12/282; limit 4; failed 4
[SOURCE: R6-q3]. **New point for R3/owner:** the 3.26.0 jump is large and its cause is not read yet (Open question 1).
Metric: R6-q3 columns `diag_any_1h`, `diag_limit_1h`, `diag_failed_1h`; targets: `diag_failed_1h` 0, limit-hitters see the quota
before input (R3).

### F-PO3 — repeated paywalls in the first hour

Spec owned by R3 (`gate-frequency-cap.yaml`). Replays: ≥3 paywall requests in 7 sessions (`01a163b0, 01a17a12, 01a17a64, 01a18376,
01a1a274, 01a1bb5b, 01a1cf7f`), a non-onboarding paywall in 13. Events: **≥2 requests 36/282 (12.8%), ≥3 19/282; non-onboarding
paywall in hour 1 47/282** [SOURCE: R6-q3]. R6 adds: returners and non-returners see paywalls at the same rate (2/16 vs 10/84),
so a cap is a trust fix, not a return lever. Target: ≥3 requests in hour 1 = 0 outside the onboarding paywall.

### F-PO4 — first ride attempt fails at a standstill ("too short")

Spec owned by R4 (`ride-standstill-teaching.yaml` / `ride-standstill-not-saved.yaml`). Replays: 12 (`01a14517, 01a14a5c, 01a15531,
01a1755b, 01a1815d, 01a18bae, 01a19197, 01a1a94e, 01a1c14a, 01a1c672, 01a1c749, 01a1cbd6`). Events: too-short on day 0
**35/282** [SOURCE: R6-q3]. Returners 3/10 vs 13/90 — the sheet is not what drives them away.

### F-PO5 — "Ride HUD opens right after onboarding" (reclassified)

Not an auto-open: 37 of 282 completers start a ride (`source=phone`) within 120 s of completion, and the code has no path that
opens the HUD without a start or resume [SOURCE: R6-q4; §2.4; R4 Q-R4-05]. Replays: 4 (`01a1815d, 01a18bae, 01a1c14a, 01a1cbd6`).
Spec owned by R4 (`first-session-no-auto-hud.yaml`, target 0 HUD views without a start). The real friction is PO4.

### F-PO6 — taps that do nothing, empty states tapped repeatedly

1. **Repro:** fresh account with the default onboarding bike; on Home tap every "Get started" checklist row, the bike card, the
   receipt-scan card, and each empty list row on Rides/Expenses.
2. **Expected:** every tap gives visible feedback within 300 ms and either navigates or opens a sheet; empty states show one
   primary button; no element is tappable without an action.
3. **Automated:** Maestro `apps/mobile/.maestro/flows/home-taps-respond.yaml` (new): `runFlow: onboarding.yaml`; for each
   `id: checklist-row-<id>` (ids from `CHECKLIST_ITEM_ID`, `stores/checklist.store.ts`), `tapOn` → `extendedWaitUntil` the target
   screen's testID (`rides-list`, `discover-screen`, `expense-dashboard`, `bike-detail`, `scan-receipt-modal`, timeout 5000) →
   `back`. Then the empty Rides list: `assertVisible: {id: "rides-empty-cta"}`. Jest: `__tests__/stores/checklist.store.test.ts`
   — every `ALL_CHECKLIST_ITEMS[].deepLink` resolves to a registered route (router manifest), so no row is a dead link.
4. **Metric:** `$rageclick` in the first hour after completion (exists from 3.21.0).
   ```sql
   -- with SCOREBOARD-CTE
   SELECT ob.ver, count() AS completers, uniqIf(e.person_id, e.event='$rageclick') AS riders_rage_1h
   FROM ob LEFT JOIN events e ON e.person_id = ob.person_id
   WHERE e.timestamp >= {from} AND e.timestamp < {to_plus_1d} AND e.timestamp >= ob.ob_at AND e.timestamp < ob.ob_at + INTERVAL 1 HOUR
   GROUP BY ob.ver ORDER BY ob.ver
   ```
   **Baseline 15/282; 3.26.0 7/117 (6%)** [SOURCE: R6-q3]. Add the rage-clicked element (`$el_text`/`$screen_name` on the
   `$rageclick` event) to the breakdown to find which control. Replays: dead taps 5 (`01a17a12, 01a19e50, 01a1a1dd, 01a1a54c,
   01a1b7ee`), empty-state wandering 5 (`01a19851, 01a1a0ab, 01a1a1dd, 01a1a54c, 01a1a9aa`), rage on the bike card 3
   (`01a15f79, 01a1ba3a, 01a1c85b`). **Target:** riders with a first-hour rage click ≤ 3% per version; 0 dead checklist links.
   Note: rage clicks go with engagement in R6 (5/17 back), so this is a usability metric, not a return predictor.

### F-PO7 — Discover slow or stuck

1. **Repro:** Android emulator, cold start, new account, tap the Discover tab within 10 s of landing; repeat on a throttled network.
2. **Expected:** trip cards visible within 3 s on a normal network, skeletons (not a bare spinner) while loading, an error with
   Retry after 10 s.
3. **Automated:** Maestro `discover-first-open-android.yaml` (named in R3/R4 lists; new): `runFlow: onboarding.yaml` →
   `tapOn: {id: "tab-discover"}` → `extendedWaitUntil: {visible: {id: "trip-card-0"}, timeout: 8000}`.
4. **Metric:** new `screen_load {screen:'discover', ms, outcome}` (05 gap 5). **Baseline: not measurable today**; replays 2
   (`01a1518f` 15 s empty, `01a18688` stuck spinner). **Target:** p90 < 3,000 ms, `outcome='timeout'` < 1%.

### F-PO8 — "Download maps" modal on the first route tap

Record only, owner decision (is the prompt needed before the first route?). Replays 1 (`01a19f85`, session ended on it).
Automated: Maestro step in `discover-first-open-android.yaml`: open a trip → tap Ride/Route → if `"Download maps"` is visible it
must have a "Not now" that leads to the route (`assertVisible: {id: "route-preview"}`). Metric: needs the modal's shown/choice
event (check `lib/analytics.ts` for an existing offline-maps event before adding one). Baseline unknown.

### F-PO9 — riders leave the garage within seconds, no taps

Not a bug; it is the outcome Experiment 1 targets. Replays 4 (`01a14526, 01a172c7, 01a17e2e, 01a1bd8d`), **0/4 came back**.
Metric: completers whose last event of day 0 is < 60 s after `onboarding_completed` and who have no tap-type event
(`$screen` count ≤ 1). Baseline: 22 of 100 scanned sessions had < 60 s of recording after completion, 3 of them came back
[SOURCE: R6-q1/q2]. No Maestro check (behaviour, not a defect).

### F-PO12 (new) — a sign-in screen appears after onboarding

1. **Repro:** Android, new account created with Google in onboarding; after Home, open Profile, then Diagnose → New, then Discover.
2. **Expected:** no sign-in / Google account picker appears while the session is valid.
3. **Automated:** Maestro `apps/mobile/.maestro/flows/post-onboarding-no-signin.yaml` (new): `runFlow: onboarding.yaml` → tap
   each tab (`tab-profile`, `tab-diagnose`, `tab-discover`) and `id: diagnose-new` → after each, `assertNotVisible:
   ".*Sign in.*|.*Continue with Google.*|.*Choose an account.*"`. (Google itself cannot be driven; the flow proves the app does
   not route to sign-in.) Jest: `lib/__tests__/auth-state-change.test.ts` — a token refresh (`TOKEN_REFRESHED`) or a transient null
   session after `onboardingCompleted` does not navigate to `(auth)`.
4. **Metric:** completers who view a sign-in screen or fire `user_signed_in` within 1 h after `onboarding_completed`:
   ```sql
   -- with SCOREBOARD-CTE
   SELECT ob.ver, count() AS completers,
          uniqIf(e.person_id, e.event = 'user_signed_in' OR (e.event = '$screen' AND toString(e.properties.$screen_name) ILIKE '%sign-in%')) AS signin_after_ob_1h
   FROM ob LEFT JOIN events e ON e.person_id = ob.person_id
   WHERE e.timestamp >= ob.ob_at + INTERVAL 5 SECOND AND e.timestamp < ob.ob_at + INTERVAL 1 HOUR
     AND e.timestamp >= {from} AND e.timestamp < {to_plus_1d}
   GROUP BY ob.ver ORDER BY ob.ver
   ```
   **Baseline: not yet run** (first task step of T6). Replays: 3 (`01a16e01` "repeatedly prompted with sign-in", `01a17532`
   sign-in blocked a diagnosis, `01a1b0c2` Google Sign-In activity while browsing Discover). **Target:** 0 per version.

### F-PO13 (new) — the app returns to onboarding or the login screen after completion

1. **Repro:** finish onboarding with an email-code account; background 2 min; relaunch; also toggle airplane mode during the first
   minute on Home.
2. **Expected:** Home on relaunch; never `experience`, email verification or "how did you hear about us" again.
3. **Automated:** Maestro `post-onboarding-landing.yaml` (F-OB6) gets a tail: `stopApp` → `setAirplaneMode: enabled` → `launchApp`
   → `assertVisible: {id: "home-screen"}` → `setAirplaneMode: disabled` → wait 10 s → `assertNotVisible: ".*How long have you.*|.*hear about us.*"`.
   Jest as F-OB1 (`resetForSignOut` not called on a blip).
4. **Metric:** completers with an `onboarding_step_viewed` **after** `onboarding_completed` (same person, within 7 days):
   ```sql
   SELECT ob.ver, count() AS completers,
          uniqIf(e.person_id, e.event = 'onboarding_step_viewed' AND e.timestamp > ob.ob_at + INTERVAL 10 SECOND) AS onboarding_after_completion
   FROM ob LEFT JOIN events e ON e.person_id = ob.person_id
   WHERE e.timestamp >= {from} AND e.timestamp < {to_plus_7d} AND e.timestamp < ob.ob_at + INTERVAL 7 DAY
   GROUP BY ob.ver ORDER BY ob.ver
   ```
   **Baseline: not yet run** (T6 step 1; `onboarding_completed` twice = 6/282 is a lower bound). Replays: 2 (`01a1ace6` looped
   into email verification and source, `01a1b1de` restarted to onboarding) — both of these riders came back on day 2.
   **Target:** 0 per version (excluding real sign-out → new account).

### F-PO14 (new) — Start Ride opened on day 0, no ride started

1. **Repro:** new account, location permission not yet asked; Home → Start Ride; read the screen without moving; then grant /
   deny location; then try with no bike selected.
2. **Expected:** one primary Start button above the fold with the bike preselected; permission asked once, in context; a denial
   shows the "Location required" alert with Open Settings (`start-ride.tsx:99-102`), never a silent spinner; the screen states
   that a short test ride is not saved (ties to PO4).
3. **Automated:** Maestro `apps/mobile/.maestro/flows/start-ride-first-open.yaml` (new): `launchApp: {permissions: {location: deny}}`
   after `runFlow: onboarding.yaml` → `tapOn: {id: "tab-ride-fab"}` → `assertVisible: {id: "start-ride-button"}` (no scroll) →
   `tapOn` → `assertVisible: ".*Location.*required.*"` within 5 s; second run with `permissions: {location: allow}` + `setLocation`
   → `assertVisible: {id: "ride-hud-root"}` within 5 s. Jest: `app/(modals)/__tests__/start-ride.test.tsx` — `startRideSession`
   resolving `{reason:'denied'}` shows the alert and clears the busy state.
4. **Metric:** completers who open Start Ride on day 0 and do not start a ride that day (R6-q9).
   **Baseline 67/130 (52%)** [SOURCE: R6-q9]. Replays: 5 opened setup and left (`01a16255, 01a17532, 01a1aa2a, 01a1b1ab, 01a1c2fa`),
   1 spinner (`01a1c73f`), 1 denied-permission return (`01a1c85b`). **Target:** ≤ 35% per version, read alongside Experiment 1
   (a rider who sets a "next ride" plan instead of starting is a success, so subtract riders with `next_ride_plan_set` in the test arm).

### F-PO15 (new) — receipt scan: extraction fails and the rider falls back to manual entry

Replays 1 (`01a1c85b`). Spec owned by the receipt-scan epic (`receipt-scan-entry.yaml` exists). Metric: the scan flow's failure
event by version (check `features/receipt-scan/use-scan-flow.ts` for the exact name before use). Baseline unknown. Low priority.

### F-PO16 (new) — a planned trip does not appear in "My trips"

Replays 1 (`01a1c14a`: repeated "No trips yet" after using the planner). Repro: Discover → plan a trip → save → My trips.
Expected: the trip is listed. Automated: Maestro `trip-plan-save.yaml` (new) asserting `id: my-trips-row-0`. Metric:
`trip_created` vs a trips-list view with an empty state within 10 min (confirm event names first). SEEN once; verify before work.

### F-PO17 (new) — sheets and modals over Home on landing compete with the first action

Replays 5 (`01a14fdf` bike confirmation modal, `01a176ac` safety-recall sheet, `01a19fd6` "OEM schedule imported" modal,
`01a1adb4` diagnostic check-in overlay, `01a1b1de` feature-highlight overlay) + What's New 2 (`01a16a02`, `01a1755b`; settled per
board). Expected: at most one sheet over Home in the first session, chosen by priority. Automated: `post-onboarding-landing.yaml`
asserts that at most one of `{id: "recall-sheet"}`, `{id: "oem-imported-sheet"}`, `{id: "whats-new"}` is visible. Metric: new
`post_onboarding_landed {screen, overlay}` → share with ≥ 2 overlays. Baseline unknown. Owner decision on priority.

### F-M — fixes cannot be read per release

1. **Repro:** ship an OTA; `$app_version` stays the same (R4 Q-R4-12), so no metric above can separate before/after.
2. **Expected:** every event carries `activation_fix_level` (integer constant, bumped by each friction PR) and `ota_update_id`;
   each release has a PostHog annotation listing the fixed friction ids.
3. **Automated:** jest `lib/__tests__/analytics-super-props.test.ts` — after consent, `registerSuperProperties` is called with
   both keys; `config/activation.ts` exports the level as a number. A CI guard (`scripts/check-activation-level.mjs`, optional)
   fails a PR that touches a file listed in a friction's "Files" without bumping the level.
4. **Metric:** `SELECT toString(properties.activation_fix_level) AS lvl, count() FROM events WHERE event='Application Opened' AND
   timestamp > now() - INTERVAL 3 DAY GROUP BY lvl` — **baseline: property absent (100% null)**; target: ≥ 95% of opens on the
   newest build carry it within 3 days of release.

## 6. Tasks

Order: T0 → T1 → (T2–T7 independent). Sizes: S ≤ 1 day, M 2–4 days, L > 4 days.

**T0 — Release marker and per-version activation scoreboard** (shared with R4 T1 / R5 F-M; do once)
- Why: OTA fixes keep `$app_version` (R4 Q-R4-12); the owner wants each fixing release visible in PostHog. Today no metric can be
  split by fix.
- What: `apps/mobile/src/config/activation.ts` exports `ACTIVATION_FIX_LEVEL = 1`; after consent call
  `registerSuperProperties({ activation_fix_level, ota_update_id: Updates.updateId ?? 'embedded' })` in `lib/analytics.ts` (next to
  the `intent_cohort` registration, `:400`). Write the SCOREBOARD query (R6-q3 + R6-q8 + R6-q9 columns, broken down by
  `ver`, `activation_fix_level`) into `docs/research/activation-365/queries/q-scoreboard.sql`. Release checklist
  (`docs/runbooks/mobile-release.md`): add "create a PostHog annotation: `#365 fix level N: <friction ids>`" — the annotation and
  any saved insight are created by the owner or an agent with the owner's go-ahead at release time, not in this research run.
- Files: `apps/mobile/src/config/activation.ts` (new), `apps/mobile/src/lib/analytics.ts`, jest test, the runbook, the SQL file.
- Acceptance: F-M jest passes; on a preview build, a PostHog `Application Opened` shows both properties (check with an
  `execute-sql` on the test person only).
- Verify: F-M metric ≥ 95% within 3 days of the release.
- Size S. Depends on: none. Owner decision: the annotation wording and who creates it.

**T1 — Instrumentation for frictions that are invisible today**
- Why: F-OB2, F-OB6(b), F-PO7, F-PO17 have no baseline.
- What: `post_onboarding_landed {screen, overlay, ms_since_cta}` (personalizing CTA → first Home render); `screen_load {screen,
  ms, outcome}` for Discover and the diagnosis result; R5's `oauth_sign_in_started/_result`. Each with jest event-shape tests in
  `lib/__tests__/`.
- Files: `apps/mobile/src/lib/analytics.ts`, `app/(onboarding)/personalizing.tsx`, `app/(tabs)/(home)/index.tsx`,
  `app/(tabs)/(discover)/index.tsx` (or its data hook), `hooks/use-oauth-sign-in.ts`.
- Acceptance: events visible for the test person on a preview build; jest passes; `pnpm verify:mobile` green.
- Verify: baselines filled in for F-OB2/OB6(b)/PO7/PO17 after 2 weeks on the new level.
- Size M. Depends on T0. Owner decision: none.

**T2 — Run the "not yet run" baselines and save the scoreboard (research, no code)**
- Why: F-PO12 and F-PO13 have queries but no baseline.
- What: run the two queries in F-PO12/F-PO13 read-only; add results to the scoreboard file; re-run R6-q2 with the engaged-return
  definition (board/06 F14).
- Acceptance: numbers recorded with query text and date. Size S. Depends on none.

**T3 — Diagnostics jump on 3.26.0: find the cause (research, then hand to R3)**
- Why: hour-1 diagnosis went from 3–9% to 25% (29/117) on 3.26.0 [R6-q3]; 4 limit-hitters never returned; policy says handle,
  do not promote.
- What: read the 3.26.0 diff for new diagnose entry points (Home tools icon, onboarding symptom step seen in `01a16cf9`, quick
  action "Diagnose Issue" `app/_layout.tsx:925-928`); `$screen` path query from Home to `(diagnose)/new` by version.
- Acceptance: the entry point that grew is named with a path:line and a count.
- Verify: R6-q3 `diag_any_1h` by entry point. Size S. Depends on none. Owner decision: whether that entry point should stay as prominent.

**T4 — "Open my garage" lands on Home once, fast (F-OB6, F-PO17)**
- Why: 7 completer replays + 4 drop-offs; `onboarding_completed` twice 6/282.
- What: (1) make the CTA idempotent (disable after the first tap; ignore a second `handleContinue`); (2) if `completionSent` and
  `mutationDone`, never render the payoff again on a remount; (3) show Retry only when the mutation actually failed, not merely
  after 8 s (`personalizing.tsx:376-383`), and keep "Skip and continue"; (4) queue landing sheets (recall, OEM imported, What's
  New, check-in) so at most one shows in the first session. No change to the paywall hand-off or its placement.
- Files: `apps/mobile/src/app/(onboarding)/personalizing.tsx`, `app/(tabs)/(home)/index.tsx` (+ testID `home-screen`), the
  sheet owners, jest test, Maestro `post-onboarding-landing.yaml` + runner script `test:e2e:post-onboarding`.
- Acceptance: Maestro passes in both paywall arms (arm forced like `onboarding-paywall-verify.yaml`), light and dark screenshots
  attached to the PR; jest passes.
- Verify: F-OB6 (a) = 0 and (b) p90 < 3 s on the new fix level; F-PO17 ≤ 1 overlay.
- Size M. Depends on T0 (T1 for metric b). Owner decision: priority order of landing sheets.

**T5 — Start Ride first open (F-PO14)**
- Why: 52% of riders who open Start Ride on day 0 leave without starting [R6-q9]; 7 replays.
- What: first diagnose with `$screen` + taps (which control was last); then: Start button above the fold with the onboarding bike
  preselected, in-context permission ask, denied → alert never a spinner, one line "Short test rides aren't saved" interpolated
  from `MIN_RIDE_*` (coordinate copy with R4/Experiment 1 so it is one spec).
- Files: `apps/mobile/src/app/(modals)/start-ride.tsx`, locales (7), jest, Maestro `start-ride-first-open.yaml`.
- Acceptance: Maestro passes with location denied and allowed, on iOS and Android, light and dark (the HUD stays `HUD_THEME`).
- Verify: F-PO14 ≤ 35% on the new fix level. Size M. Depends on T0. Owner decision: whether this ships both-arm or inside
  Experiment 1's test arm (board rule: a first-week Home change ships inside the arm; Start Ride is not Home — owner call).

**T6 — No sign-in or onboarding after completion (F-PO12, F-PO13)**
- Why: 5 replays (3 sign-in, 2 back to onboarding); same family as OB1-H2.
- What: T2 baselines first; then reproduce on Android with a Google account; trace what opens `SignInHubActivity` after completion
  (any `GoogleSignin.signIn` / `signInSilently` outside `(onboarding)`/`(auth)`; `hooks/use-oauth-sign-in.ts` consumers are
  `account.tsx`, `sign-in.tsx`, `register.tsx`, `login.tsx`); guard `resetForSignOut` so a transient null session after completion
  does not reset onboarding (`app/_layout.tsx:698`, `lib/auth-state-change.ts`).
- Files: `apps/mobile/src/app/_layout.tsx`, `apps/mobile/src/lib/auth-state-change.ts`, tests, Maestro
  `post-onboarding-no-signin.yaml`.
- Acceptance: jest + Maestro pass; repro steps no longer show sign-in.
- Verify: F-PO12 and F-PO13 = 0 per version. Size M. Depends on T2. Owner decision: none.

**T7 — Home taps always respond (F-PO6)**
- Why: 5 dead-tap and 5 empty-state replays; 15/282 rage clicks in hour 1.
- What: add testIDs to checklist rows and targets; jest that every checklist deep link is a registered route; make the bike card,
  receipt card and empty rows either navigate or not look tappable; break `$rageclick` down by element first to find the worst one.
- Files: `apps/mobile/src/stores/checklist.store.ts`, the Home checklist component, `components/home/*`, Maestro `home-taps-respond.yaml`.
- Acceptance: Maestro passes, light and dark. Verify: F-PO6 ≤ 3%. Size S–M. Depends on T0.

**T8 — Discover first open (F-PO7)** — skeleton + timeout/Retry; Maestro `discover-first-open-android.yaml`; verify `screen_load`
p90 < 3 s. Size S. Depends on T1.

**Not tasks here (owned elsewhere):** OB1/OB2/OB3/OB4/OB5 → R5; PO1 → R2; PO2/PO3 → R3; PO4/PO5 → R4; activation levers →
Experiment 1 and Experiment 2 (board/99-synthesis §4). PO8, PO15, PO16 → backlog until seen again.

## 7. Risks

- **Small numbers.** 16 returners; most comparisons are not significant. A friction that matters for 1 in 20 riders cannot be seen.
- **AI summaries misread.** Some replay claims have no event support (`01a17491`, `01a1a973`, `01a1c670`); masked text is paraphrased
  (`01a1b7ee`). Counts that drive tasks are backed by events where possible.
- **Consent.** Only riders who allowed analytics are recorded (EEA opt-in), ~17–27% of new users are invisible (evidence pack §1).
- **Selection.** Push granted and logging-first describe motivated riders; pushing everyone to log will not reproduce 45%.
- **Version mix.** 99 of 107 scanned sessions are 3.26.0; the per-version metrics before 3.26.0 come from older builds with
  different screens.
- **OTA blind spot** until T0 ships: before/after per OTA is impossible.
- **Light/dark.** Every UI task must ship screenshots in both modes (owner rule); the HUD is always dark.

## 8. Open questions

1. What made hour-1 diagnosis jump to 25% on 3.26.0 (T3)? Is it the onboarding symptom step, a Home entry point, or the quick action?
2. What opens the Google SignInHub after completion (F-PO12)?
3. Why do 0 of 10 BIKE-first riders return — is the bike card leading them away from any action (photo picker, recalls)?
4. Is the "Connect Google Fit / Apple Health" page in `01a1c670` real? Search the 3.26.0 bundle; if not, treat it as an AI misread.
5. Should Start Ride changes (T5) ship to both arms or only Experiment 1's test arm? (owner)
6. Landing-sheet priority (T4/F-PO17): recall vs OEM-imported vs check-in vs What's New (owner).
7. Re-run R6 on ~100 more first sessions after T0 ships, so the next comparison is per fix level.

## 9. Updated counts for 05-session-replay-findings.md

| # | 05 count | R6 count (replays, all 166 read) | Events (R6, 60 d) |
|---|---|---|---|
| OB1 | ≈17 of 60 drop-offs | 12 clear + 6 ambiguous of 60; + 2 completers sent back (`01a1ace6`, `01a1b1de`) | 44/472 starters (9.3%) view an early step after a later one; 64/472 `onboarding_resumed`; 3.26.0 16/166 and 19/166 [R6-q8] |
| OB2 | ≈10 | 11 (+`01a1c1e9`) | not measurable |
| OB3 | 3 | 3 | — |
| OB4 | ≈8 | 11 | median 44 s; 127/367 > 60 s; 3.26.0 56/133 [R6-q8] |
| OB5 | ≈5 | 6 | 63/472 stopped at account [R6-q8] |
| OB6 | ≈5 of 85 completers | 7 of 103 completers + 4 drop-offs | completed twice 6/282 [R6-q3] |
| OB7 | 3 | 4 (+`01a1c5ae`, session ends on the paywall right after completion) | out of scope |
| PO1 | 4 | 2 direct + 1 banner + 3 "add first bike" Homes | MAX_BIKES 1 h 21/282; 3.26.0 7/117; garage re-add 1 h 65/282 → 7/117 on 3.26.0 [R6-q3/q5/q7] |
| PO2 | ≈19 of 85 | 19 of 103 first action; 29 with a diagnosis event | diagnosis 1 h 43/282; **3.26.0 29/117**; limit 4; failed 4 [R6-q3] |
| PO3 | 8 | ≥3 requests 7; non-onboarding paywall 13 | ≥2 36/282; ≥3 19/282 [R6-q3] |
| PO4 | 5 | 12 | too-short day 0 35/282 [R6-q3] |
| PO5 | 2 | 4 — **reclassified** as an immediate Start tap | 37/282 start ≤120 s, all `source=phone` [R6-q4] |
| PO6 | ≈7 | 5 dead taps + 5 empty-state + 3 bike-card rage | `$rageclick` 1 h 15/282 [R6-q3] |
| PO7 | 2 | 2 | not measurable |
| PO8 | 1 | 1 | — |
| PO9 | ≈5 | 4 (0 returned) | — |
| PO10 | 3 | 5 (+`01a1a07f`, `01a19d1b`) | — |
| PO11 | 2 | 2 | settled |
| **PO12 new** | — | 3 sign-in after onboarding | baseline T2 |
| **PO13 new** | — | 2 back to onboarding after completion | baseline T2 |
| **PO14 new** | — | 7 Start Ride opened, no start | 67/130 [R6-q9] |
| **PO15 new** | — | 1 receipt extraction failed | — |
| **PO16 new** | — | 1 planned trip not listed | — |
| **PO17 new** | — | 5 landing overlays (+2 What's New) | — |

## Appendix — every scanner-A session

First action is my coding of the replay text; event columns from R6-q1; day-2 from R6-q2 ("n/a" = completed 11-11 or 11-12).
Tags: `PO*`/`OB*` as above; `dead` dead taps; `empty` empty-state wandering; `pwN` N paywalls seen in the replay; `land_*` the
first screen was not Home; `signin_after_ob` (PO12); `OB1_after_ob`/`restart_to_onboarding` (PO13); `ride_setup_noStart` (PO14).

| Session (prefix) | New in R6 | Platform / ver | Completed (UTC day) | First action (replay) | Ride start evt / too-short evt | Non-onboarding paywall req | Diag evts (limit) | $rageclick | Replay tags | Day-2 back | Back on any later day |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 01a1405c |  | android 3.26.0 | 2026-10-15 | DIAG | 0 / 0 | 0 | 1 (0) | 0 | land_diag | **yes** | 1 |
| 01a14087 |  | android 3.26.0 | 2026-10-15 | DIAG | 0 / 0 | 0 | 1 (0) | 0 | bg | no | 0 |
| 01a1425b |  | android 3.26.0 | 2026-10-16 | BROWSE | 0 / 0 | 0 | 0 (0) | 0 | - | no | 0 |
| 01a14517 |  | ios 3.26.0 | 2026-10-16 | RIDE | 1 / 2 | 0 | 0 (0) | 1 | rage,tooshort | **yes** | 1 |
| 01a14526 |  | android 3.26.0 | 2026-10-16 | NONE | 0 / 0 | 0 | 0 (0) | 0 | PO9 | no | 0 |
| 01a14652 |  | android 3.26.0 | 2026-10-16 | BIKE | 1 / 0 | 0 | 0 (0) | 0 | addbike_cta | no | 0 |
| 01a14a37 |  | android 3.26.0 | 2026-10-17 | RIDE | 0 / 0 | 1 | 0 (0) | 0 | paywall_on_route,pw2 | no | 1 |
| 01a14a5c |  | android 3.26.0 | 2026-10-17 | RIDE | 1 / 2 | 0 | 0 (0) | 0 | OB6,tooshort | no | 1 |
| 01a14b27 |  | android 3.26.0 | 2026-10-17 | BROWSE | 0 / 0 | 0 | 0 (0) | 0 | - | no | 1 |
| 01a14fdf |  | android 3.26.0 | 2026-10-18 | DIAG | 0 / 0 | 0 | 3 (0) | 0 | bike_confirm_modal | no | 0 |
| 01a150c1 |  | android 3.26.0 | 2026-10-18 | DIAG | 0 / 0 | 0 | 3 (0) | 0 | diag_error | no | 0 |
| 01a1518f |  | android 3.26.0 | 2026-10-19 | BROWSE | 0 / 0 | 0 | 0 (0) | 0 | PO7 | no | 0 |
| 01a1541a |  | ios 3.26.0 | 2026-10-19 | BIKE | 0 / 0 | 0 | 0 (0) | 2 | land_recall | no | 1 |
| 01a1546d |  | android 3.26.0 | 2026-10-19 | DIAG | 0 / 0 | 0 | 8 (0) | 0 | diag_error | no | 0 |
| 01a15531 |  | android 3.26.0 | 2026-10-19 | LOG | 0 / 0 | 0 | 0 (0) | 0 | tooshort | no | 1 |
| 01a1569c |  | android 3.26.0 | 2026-10-20 | DIAG | 0 / 0 | 0 | 3 (0) | 0 | - | no | 1 |
| 01a1584a |  | android 3.26.0 | 2026-10-20 | DIAG | 0 / 0 | 0 | 3 (0) | 0 | - | no | 0 |
| 01a15a81 |  | ios 3.26.0 | 2026-10-20 | LOG | 0 / 0 | 0 | 0 (0) | 1 | - | no | 0 |
| 01a15d55 |  | android 3.26.0 | 2026-10-21 | BIKE | 0 / 0 | 0 | 0 (0) | 0 | PO1 | no | 0 |
| 01a15f79 |  | ios 3.26.0 | 2026-10-21 | BROWSE | 0 / 0 | 0 | 3 (0) | 4 | empty_garage,rage | no | 0 |
| 01a16255 |  | android 3.26.0 | 2026-10-22 | RIDE | 0 / 0 | 2 | 0 (0) | 0 | ride_setup_noStart,pw2 | **yes** | 1 |
| 01a163b0 |  | android 3.26.0 | 2026-10-22 | DIAG | 0 / 0 | 4 | 8 (3) | 0 | pw3,diag_limit | no | 0 |
| 01a163f5 |  | android 3.26.0 | 2026-10-22 | LOG | 0 / 0 | 0 | 0 (0) | 0 | - | no | 0 |
| 01a16947 |  | android 3.26.0 | 2026-10-23 | BIKE | 0 / 0 | 0 | 0 (0) | 0 | - | no | 0 |
| 01a16a02 |  | ios 3.26.0 | 2026-10-23 | BROWSE | 1 / 0 | 0 | 0 (0) | 2 | whatsnew,logout | no | 0 |
| 01a16cf9 |  | ios 3.26.0 | 2026-10-24 | DIAG | 0 / 0 | 0 | 3 (0) | 0 | - | no | 0 |
| 01a16e01 |  | android 3.26.0 | 2026-10-24 | BROWSE | 1 / 0 | 0 | 0 (0) | 0 | signin_after_ob | no | 0 |
| 01a17228 |  | android 3.26.0 | 2026-10-25 | DIAG | 0 / 0 | 0 | 0 (0) | 0 | - | **yes** | 1 |
| 01a172c7 |  | ios 3.26.0 | 2026-10-25 | BIKE | 0 / 0 | 0 | 0 (0) | 0 | PO9 | no | 1 |
| 01a1731d |  | ios 3.26.0 | 2026-10-25 | LOG | 0 / 0 | 0 | 0 (0) | 1 | PO10 | no | 0 |
| 01a17491 |  | android 3.26.0 | 2026-10-25 | LOG | 0 / 0 | 0 | 1 (0) | 0 | - | no | 0 |
| 01a17532 |  | android 3.26.0 | 2026-10-25 | LOG | 0 / 0 | 0 | 2 (0) | 0 | signin_after_ob,ride_setup_noStart | no | 0 |
| 01a1755b |  | android 3.26.0 | 2026-10-25 | LOG | 0 / 0 | 1 | 0 (0) | 0 | whatsnew,tooshort,pw2 | no | 0 |
| 01a17605 |  | ios 3.26.0 | 2026-10-26 | BROWSE | 0 / 0 | 0 | 0 (0) | 0 | - | no | 0 |
| 01a176ac |  | android 3.26.0 | 2026-10-26 | BIKE | 0 / 0 | 0 | 1 (0) | 0 | land_recall | no | 0 |
| 01a17a12 |  | android 3.26.0 | 2026-10-26 | BIKE | 0 / 0 | 2 | 0 (0) | 0 | dead,pw3 | no | 0 |
| 01a17a64 |  | android 3.26.0 | 2026-10-26 | BROWSE | 0 / 0 | 3 | 0 (0) | 0 | pw4 | no | 0 |
| 01a17e2e |  | android 3.26.0 | 2026-10-27 | NONE | 0 / 0 | 0 | 0 (0) | 0 | PO9 | no | 0 |
| 01a17f5f |  | android 3.26.0 | 2026-10-27 | DIAG | 0 / 0 | 0 | 3 (0) | 0 | - | no | 0 |
| 01a1815d |  | android 3.26.0 | 2026-10-28 | RIDE | 1 / 2 | 0 | 0 (0) | 0 | PO5,tooshort | no | 0 |
| 01a18376 |  | android 3.26.0 | 2026-10-28 | BIKE | 0 / 0 | 2 | 7 (2) | 0 | PO1,pw3,diag_limit | no | 0 |
| 01a1844c |  | android 3.26.0 | 2026-10-28 | DIAG | 0 / 0 | 0 | 5 (0) | 0 | - | no | 0 |
| 01a185da |  | ios 3.26.0 | 2026-10-29 | BROWSE | 1 / 1 | 0 | 0 (0) | 0 | OB6 | no | 0 |
| 01a18688 |  | android 3.26.0 | 2026-10-29 | BROWSE | 0 / 0 | 0 | 0 (0) | 0 | PO7 | no | 0 |
| 01a18804 |  | ios 3.26.0 | 2026-10-29 | LOG | 0 / 0 | 0 | 0 (0) | 1 | rage | no | 0 |
| 01a18b12 |  | android 3.26.0 | 2026-10-30 | LOG | 0 / 0 | 0 | 0 (0) | 0 | - | no | 0 |
| 01a18b3f |  | ios 3.26.0 | 2026-10-30 | LOG | 0 / 0 | 0 | 0 (0) | 2 | OB6 | no | 0 |
| 01a18bae |  | ios 3.26.0 | 2026-10-30 | RIDE | 1 / 2 | 0 | 1 (0) | 1 | PO5,tooshort | no | 1 |
| 01a18c61 |  | android 3.26.0 | 2026-10-30 | RIDE | 1 / 0 | 0 | 0 (0) | 0 | - | no | 0 |
| 01a19197 |  | android 3.26.0 | 2026-10-31 | BIKE | 1 / 2 | 0 | 0 (0) | 0 | tooshort,loc_denied | no | 0 |
| 01a197ba |  | android 3.26.0 | 2026-11-01 | BROWSE | 0 / 0 | 0 | 0 (0) | 0 | - | no | 0 |
| 01a19851 |  | ios 3.26.0 | 2026-11-01 | BROWSE | 0 / 0 | 0 | 3 (0) | 0 | empty | no | 0 |
| 01a19bd1 |  | ios 3.26.0 | 2026-11-02 | RIDE | 1 / 0 | 1 | 0 (0) | 0 | pw2 | no | 0 |
| 01a19cbe |  | android 3.26.0 | 2026-11-02 | DIAG | 0 / 0 | 1 | 6 (1) | 0 | diag_limit,pw2,maxbikes_banner | no | 0 |
| 01a19d1b |  | android 3.26.0 | 2026-11-02 | LOG | 0 / 0 | 0 | 0 (0) | 0 | - | **yes** | 1 |
| 01a19d50 |  | android 3.26.0 | 2026-11-02 | RIDE | 0 / 0 | 0 | 1 (0) | 0 | - | no | 0 |
| 01a19e50 |  | android 3.26.0 | 2026-11-02 | RIDE | 0 / 0 | 1 | 1 (0) | 0 | dead | no | 0 |
| 01a19f85 |  | android 3.26.0 | 2026-11-03 | BROWSE | 0 / 0 | 0 | 0 (0) | 0 | PO8 | no | 0 |
| 01a19fd6 |  | android 3.26.0 | 2026-11-03 | LOG | 0 / 0 | 0 | 0 (0) | 0 | oem_modal | no | 0 |
| 01a1a07f |  | ios 3.26.0 | 2026-11-03 | LOG | 0 / 0 | 0 | 0 (0) | 1 | - | no | 0 |
| 01a1a0ab |  | android 3.26.0 | 2026-11-03 | BROWSE | 0 / 0 | 0 | 0 (0) | 0 | empty | no | 0 |
| 01a1a1dd |  | android 3.26.0 | 2026-11-03 | BROWSE | 0 / 0 | 0 | 0 (0) | 0 | dead,empty | **yes** | 1 |
| 01a1a274 |  | ios 3.26.0 | 2026-11-03 | DIAG | 0 / 0 | 2 | 6 (2) | 1 | diag_limit,pw3 | no | 0 |
| 01a1a54c |  | android 3.26.0 | 2026-11-04 | BROWSE | 0 / 0 | 0 | 3 (0) | 0 | dead,empty | no | 0 |
| 01a1a717 |  | android 3.26.0 | 2026-11-04 | DIAG | 0 / 0 | 0 | 3 (0) | 0 | - | no | 0 |
| 01a1a94e |  | android 3.26.0 | 2026-11-05 | RIDE | 1 / 2 | 0 | 0 (0) | 0 | tooshort,pw_after_ob | no | 0 |
| 01a1a973 |  | android 3.26.0 | 2026-11-05 | LOG | 0 / 0 | 0 | 0 (0) | 0 | - | no | 0 |
| 01a1a9aa |  | android 3.26.0 | 2026-11-05 | BROWSE | 0 / 0 | 0 | 0 (0) | 0 | empty | no | 0 |
| 01a1aa2a |  | android 3.26.0 | 2026-11-05 | BROWSE | 0 / 0 | 0 | 0 (0) | 0 | ride_setup_noStart | no | 0 |
| 01a1ac90 |  | android 3.26.0 | 2026-11-05 | LOG | 0 / 0 | 0 | 0 (0) | 0 | - | no | 0 |
| 01a1ace6 |  | android 3.26.0 | 2026-11-05 | BROWSE | 0 / 0 | 0 | 0 (0) | 0 | OB1_after_ob | **yes** | 1 |
| 01a1adb4 |  | android 3.26.0 | 2026-11-05 | DIAG | 0 / 0 | 0 | 3 (0) | 0 | - | no | 0 |
| 01a1aec7 |  | android 3.26.0 | 2026-11-06 | DIAG | 0 / 0 | 0 | 3 (0) | 0 | - | no | 0 |
| 01a1aecc |  | android 3.26.0 | 2026-11-06 | BROWSE | 0 / 0 | 0 | 0 (0) | 0 | - | no | 1 |
| 01a1b0c2 |  | android 3.26.0 | 2026-11-06 | BROWSE | 0 / 0 | 0 | 0 (0) | 0 | signin_after_ob | no | 0 |
| 01a1b1ab |  | android 3.26.0 | 2026-11-06 | RIDE | 0 / 0 | 0 | 0 (0) | 0 | ride_setup_noStart | no | 0 |
| 01a1b1de |  | android 3.26.0 | 2026-11-06 | BROWSE | 0 / 0 | 0 | 0 (0) | 0 | restart_to_onboarding | **yes** | 1 |
| 01a1b7a8 |  | ios 3.26.0 | 2026-11-07 | BROWSE | 0 / 0 | 0 | 0 (0) | 0 | OB6 | no | 0 |
| 01a1b7b1 |  | android 3.26.0 | 2026-11-07 | INCONC | 0 / 0 | 0 | 0 (0) | 0 | OB6 | **yes** | 1 |
| 01a1b7ee |  | android 3.26.0 | 2026-11-07 | LOG | 0 / 0 | 0 | 0 (0) | 0 | dead | no | 0 |
| 01a1b858 |  | android 3.26.0 | 2026-11-07 | DIAG | 0 / 0 | 0 | 3 (0) | 0 | - | **yes** | 1 |
| 01a1b89e |  | android 3.26.0 | 2026-11-08 | BROWSE | 0 / 0 | 0 | 0 (0) | 0 | - | no | 0 |
| 01a1b8df |  | android 3.26.0 | 2026-11-08 | BROWSE | 0 / 0 | 0 | 0 (0) | 0 | - | **yes** | 1 |
| 01a1ba3a |  | ios 3.26.0 | 2026-11-08 | BROWSE | 0 / 0 | 0 | 0 (0) | 4 | rage | no | 0 |
| 01a1bb5b |  | ios 3.26.0 | 2026-11-08 | DIAG | 0 / 0 | 2 | 3 (0) | 1 | pw2,rage | **yes** | 1 |
| 01a1bd8d |  | android 3.26.0 | 2026-11-08 | NONE | 0 / 0 | 0 | 0 (0) | 0 | PO9 | no | 0 |
| 01a1c0e7 | yes | ios 3.26.0 | 2026-11-09 | BROWSE | 0 / 0 | 0 | 0 (0) | 3 | rage | **yes** | 1 |
| 01a1c14a | yes | android 3.26.0 | 2026-11-09 | RIDE | 1 / 4 | 0 | 0 (0) | 0 | PO5,tooshort,trip_not_saved | no | 0 |
| 01a1c1b6 | yes | android 3.26.0 | 2026-11-09 | INCONC | 0 / 0 | 0 | 0 (0) | 0 | OB6 | no | 0 |
| 01a1c1bb | yes | android 3.26.0 | 2026-11-09 | LOG | 0 / 0 | 0 | 0 (0) | 0 | white_28s | no | 0 |
| 01a1c1d9 | yes | android 3.26.0 | 2026-11-09 | LOG | 0 / 0 | 0 | 0 (0) | 0 | - | no | 0 |
| 01a1c2c0 | yes | android 3.26.0 | 2026-11-10 | BROWSE | 1 / 0 | 0 | 0 (0) | 0 | - | no | 0 |
| 01a1c2fa | yes | ios 3.26.0 | 2026-11-10 | BROWSE | 0 / 0 | 0 | 0 (0) | 2 | ride_setup_noStart | no | 0 |
| 01a1c40d | yes | android 3.26.0 | 2026-11-10 | BIKE | 0 / 0 | 0 | 0 (0) | 0 | - | no | 0 |
| 01a1c5ae | yes | android 3.26.0 | 2026-11-10 | INCONC | 0 / 0 | 0 | 0 (0) | 0 | OB7 | no | 0 |
| 01a1c5f0 | yes | ios 3.27.0 | 2026-11-10 | LOG | 0 / 0 | 0 | 0 (0) | 1 | - | **yes** | 1 |
| 01a1c670 | yes | android 3.26.0 | 2026-11-10 | BROWSE | 0 / 0 | 0 | 0 (0) | 0 | - | no | 0 |
| 01a1c672 | yes | ios 3.27.0 | 2026-11-10 | BROWSE | 1 / 2 | 0 | 0 (0) | 0 | tooshort | **yes** | 1 |
| 01a1c73f | yes | android 3.26.0 | 2026-11-10 | RIDE | 0 / 0 | 0 | 0 (0) | 0 | ride_spinner | no | 0 |
| 01a1c749 | yes | ios 3.27.0 | 2026-11-10 | LOG | 1 / 2 | 0 | 0 (0) | 2 | tooshort,rage | **yes** | 1 |
| 01a1c85b | yes | ios 3.27.0 | 2026-11-11 | LOG | 0 / 0 | 0 | 0 (0) | 3 | receipt_fail,rage,loc_denied_nostart | n/a (too recent) | 0 |
| 01a1c94a | yes | ios 3.27.0 | 2026-11-11 | LOG | 0 / 0 | 0 | 0 (0) | 2 | rage | n/a (too recent) | 0 |
| 01a1cbd6 | yes | android 3.26.0 | 2026-11-11 | RIDE | 1 / 2 | 0 | 0 (0) | 0 | PO5,tooshort | n/a (too recent) | 1 |
| 01a1cce2 | yes | android 3.26.0 | 2026-11-11 | BROWSE | 0 / 0 | 0 | 0 (0) | 0 | - | n/a (too recent) | 0 |
| 01a1ccff | yes | ios 3.28.0 | 2026-11-11 | BROWSE | 0 / 0 | 0 | 0 (0) | 1 | - | n/a (too recent) | 0 |
| 01a1ceb5 | yes | ios 3.28.0 | 2026-11-12 | INCONC | 0 / 0 | 0 | 0 (0) | 0 | ineligible | n/a (too recent) | 0 |
| 01a1cf7f | yes | android 3.28.0 | 2026-11-12 | BIKE | 0 / 0 | 2 | 3 (0) | 0 | - | n/a (too recent) | 0 |
