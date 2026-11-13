# #365 experiments ledger, canonical definitions and baselines

Owner of this file: T02 (created 2026-11-13). Every later #365 task appends here; nothing is deleted, superseded lines are struck
through with a date. Plan: `EXECUTION_PLAN.md` (§0 conventions, §1.2 metrics, §3A.0 release rules, §5/§5A specs, §9 decisions,
§10 ledger notes). SQL: `queries/fs/*.sql` (PostHog, one file per spec), `queries/db/*.sql` (weekly DB check),
`queries/q00-excluded-persons.md` (exclusion). All baselines below were run **read-only on 2026-11-13** unless a source says otherwise.

Contents: 1 Placeholders · 2 Canonical definitions · 3 Reading rule and strata · 4 Baselines · 5 Weekly DB check ·
6 Experiment 1 ledger (D13, D16, pre-registration, power) · 7 Both-arm change log · 8 Per-release read log ·
9 Ledger notes (plan §10) · 10 T06 research findings · 11 Dashboard, alerts and annotation (T03b)

---

## 1. Placeholders used in every query

| Placeholder | Meaning |
|---|---|
| `{RN}` | `properties.$lib = 'posthog-react-native'`. **Never** applied to server events (`$lib` null): `signup_completed`, and from T05e/T07a `onboarding_bike_created`, `ride_saved`, `service_plan_imported`. Mixed queries use `({RN} OR event IN (<server events>))` |
| `{EXCL}` | 14 excluded persons (13 test/synthetic + the V4 emulator person) + `e2e_run != 'true'` + `{E2E_PERSONS}`; ids kept outside the repo, recipe in `queries/q00-excluded-persons.md` |
| `{E2E_PERSONS}` | PostHog persons of E2E accounts that teardown deleted, mapped by user id from the runners' local ledger (`queries/q00-excluded-persons.md`): **empty** on 2026-11-13; runs before the ledger cannot be recovered |
| `{REL}` | `ver` (`$app_version`), `build` (`$app_build`), `lvl` (`activation_fix_level`), `ota` (`ota_update_id`), person-level `plat` = `coalesce(argMinIf(lower(toString(properties.platform)), timestamp, properties.platform IS NOT NULL), multiIf(toInt(argMin(toString(properties.$app_build), timestamp)) >= 100, 'ios?', 'android?'))`. The build fallback is valid for 3.26.0–3.28.x only (on 3.19.x–3.21.x it labels old iOS builds `android?`). `lvl`/`ota` are null on every event until 3.29.0 (T01) |
| DB exclusion | `queries/db/README.md` → "Exclusion" (`is_synthetic`, `e2e-%`, `delivered+mv-e2e-%`, test domains, 2026-11-10 junk) |

## 2. Canonical definitions

| # | Metric | Canonical definition | SQL |
|---|---|---|---|
| S1 | Week-1 core action among completers | Persons whose **first** `onboarding_completed` falls in the window; core action = `ride_completed` with `below_min_ride` not true, `expense_added`, `maintenance_task_created` or `maintenance_task_completed` in **[t0, t0 + 7 d)** of that first completion. Tile and Exp 1 primary are anchored on completion (not first seen) | `queries/fs/s1.sql` |
| S2 | Onboarding completion | Persons whose first `onboarding_started` is in the window and who have any `onboarding_completed` (second denominator: first-seen persons) | `queries/fs/s2.sql` |
| S3 | Day-2 engaged return (board/06 F14) | Return on the UTC calendar day after first seen **and** that day a core action or a `$screen` not on the F14 allow-list (Home, What's New, onboarding/auth routes). Per-release reads use the **24–48 h after first seen** form as primary (install-hour bias, V2 §5.3); the calendar-day form is the Exp 1 secondary. S3-raw (any open) is reported beside it, never read inside Exp 1 | `queries/fs/s3.sql` |
| S4 | Day-0 service schedule | (a) first live bike on sign-up day with a task within 1 day, **two columns: any source and `source = 'oem'`** (T07 is judged on `oem`); (b) R2-M1 onboarding bike with an OEM task ≤ 5 min; PostHog form after T07a | `queries/db/s4a-day0-schedule.sql`, `queries/db/s4b-r2m1.sql`, `queries/fs/fs-po1h-s4.sql` |
| S5 | First-hour multi-paywall | Completers with ≥ 2 `paywall_present_requested` in [t0 − 10 min, t0 + 60 min); post-onboarding form excludes `onboarding*` surfaces and (until `trigger` exists, T05a/T21) the explicit `profile_subscriptions_row` / `profile_pro_banner` surfaces | `queries/fs/fs-po3-s5.sql` |
| S6 | Post-auth early-step regression | Starters who view `experience`/`bike_setup`/`welcome` after a `goals`/`account`/`heard_about`/`notifications` view (R6:276-284) | `queries/fs/s6-fs-ob1.sql` |
| — | Too-short trigger (canonical) | `ride_too_short_shown` with `action = 'shown'`, `distance_m < 10`, `elapsed_s < 120`, first qualifying sheet, no saved real ride before it (board/06 `q06-r2-tooshort-canonical`) | `queries/fs/fs-po4a.sql` |

## 3. Reading rule and strata

- **Outcome metrics** (S1, S2, S3) are **harm checks**: revert only if `d + 1.645·SE < 0` at the 4- or 8-week look against the trailing
  8 weeks (P06.3). Weekly day-2 return swings 3–12 pts on 26–90 installs/week, so a change smaller than that is "no change shown",
  not "no effect". Only Experiment 1 (randomized) can claim a lift.
- **Mechanical metrics** (the friction event itself; targets 0 or a ceiling) are judged on counts on the fix level.
- **Per release:** (1) fix level vs previous level in the **same calendar weeks**, within one platform — n/a for iOS first-session
  cohorts (new App Store installs always get the newest version); (2) the fix level's first 4 and 8 weeks vs the trailing 8 weeks.
- **Season (Nov–Mar):** harm checks use a concurrent comparison (Android staged-rollout cohort before the Exp 1 slot; the Exp 1
  control arm after it). A trailing-8-week drop alone = **"no verdict (season)"**, never a revert.
- **Thin Android cohort:** < 30 riders on the new level at the 2-week read = **"no verdict (thin Android cohort)"** (V3 §4).
- **Strata:** goal `track_rides` vs every other goal (from `onboarding_step_completed` step `goals`, `primary_goal`) × platform.
  `returning_account` riders (first auth in the install = sign-in to an existing account) are excluded from Exp 1's primary and
  reported separately. `maintain_bike` riders are read on S1 and days 7–13, never on S3.
- Pre-3.29.0 reads are by `ver` + calendar date (no `lvl`); `build` separates internal/tester builds from production
  (Android vc95–99 on 3.27.0/3.28.0 were testers until vc98 went to production ~2026-11-12).

## 4. Baselines (run 2026-11-13, read-only)

Trailing windows are 60 d to 2026-11-13 unless stated. "Cited" = the plan / V1 number (2026-11-12). Differences of ±1–4 riders are
the one extra day of data and are within binomial noise unless explained.

### 4.1 Success metrics S1–S6 by version and platform

| Metric | Now (2026-11-13) | Cited | Note |
|---|---|---|---|
| S1 completion-anchored, first completion in [−67 d, −7 d) | **all 39/272 (14.3%)**; **3.26.0 10/89 (11.2%)** = android 8/68, ios 2/20, android? 0/1; 3.19.0 7/57; 3.19.1 14/79; 3.21.0 7/32; 3.20.0 0/9; 3.22.0 0/3; 3.25.0 1/3 | 37/275; 3.26.0 8/84 (Q-P5, V1-q7) | The window moved one day; 3.26.0 gained completers of 11-05/11-06. 8/84 vs 10/89 is well inside binomial noise (≈ ±6 pts at n ≈ 85), so **Q-P5 reproduces** |
| S1 strata (same window) | `track_rides` **34/145 (23.4%)**, other goals **5/127 (3.9%)** | first-seen cohort 08-14→11-04: 47/197 vs 14/170 (V2-q5) | The completion-anchored window is later (Sep–Nov) and colder; the gap between strata is larger. 87% of S1 events come from `track_rides` here (77% in V2) |
| S2 starters, first `onboarding_started` in [−60 d, −2 d) | all 241/435 (55.4%); **3.26.0 92/156 (59.0%)** = android 69/124, ios 23/28; 3.19.0 40/105; 3.19.1 64/96; 3.21.0 27/46; 3.27.0 5/7 | 3.26.0 90/153 (Q-P6), 91/154 (V1-q6); first-seen 367/793 (V1-q8) | reproduces |
| S3 engaged day-2 (calendar), same starters | all 31/435 engaged (52 raw); completers 31/241 engaged (41 raw); **3.26.0 10/156 engaged, 19 raw** (android 7, ios 3) | completers 37/367, all 39/793 (V1-q9, q02 cohort); 3.26.0 raw 17/153 | Different cohort (starters, rolling) from the q02 first-seen cohort; the q02 numbers stay the reference for the T03b funnel tile |
| S3 engaged 24–48 h (per-release primary) | completers **18/241**; 3.26.0 5/92 | new form (V2 §5.3) | first baseline |
| S4(a) | weeks 10-12→11-02: any **25/111 (22.5%)**, `oem` **15/111 (13.5%)**; partial 11-09 any 14/31, oem 5/31 | 25/111 (board/99, V1-db2) | exact match; see §5 |
| S4(b) R2-M1 | **10/157 (6.4%)** weeks 09-28→11-09 | 10/151 (R2), 10/155 (V1-db4) | reproduces |
| S5 (completers, 60 d) | **3.26.0 ≥ 2 any 13/121 (10.7%), ≥ 2 post-onboarding 8/121 (6.6%)**, post-onboarding excl. explicit upgrade surfaces 8/121 (android 6/92, ios 2/28); all any 35/292, post 25/292 | 13/121, 8/121 (Q-P8) | exact match |
| S6 (starters, 60 d) | all **42/462 (9.1%)**; **3.26.0 16/167 (9.6%)** = android 12/135, ios 2/28, android? 2/4; 3.28.0 1/15; 3.27.0 1/8 | 44/472, 3.26.0 16/166 (R6-q8) | reproduces |

### 4.2 Friction specs (one file each in `queries/fs/`; the file header carries the full result)

| Spec | Baseline 2026-11-13 | Cited | Status |
|---|---|---|---|
| FS-M | 0/341 opens carry `activation_fix_level`/`ota_update_id` (7 d); `platform` null on 97/341 | 0% (Q-P4) | measurable as a share from 3.29.0 (T01) |
| FS-OB1a | 3.26.0 **6 of 10** stuck on sign-in; 3.21.0 2/2; ≥ 2 auths in 2 min 16/77 | 6/10; 15/72 | reproduces |
| FS-OB1b | `$screen` method: android **28/208**, ios **14/74**, unknown 7/36 | 28/201, 14/72 (V1-q15) | reproduces; event form after T04b |
| FS-OB1c | bike-setup **8/31**, account **5/13**, goals 3/11 | same (V1-q17) | identical |
| FS-OB1d | proxy 9 riders, **3.26.0 6** | 12 / 6 (V1-q37) | V1's proxy SQL was not written down; the reconstruction matches 3.26.0 and finds 3 fewer on 3.19.x/3.25.0. Event form after T04b |
| FS-OB1e | relapse **11/292**, completed twice **6/292**; DB two bikes ≤ 2 min: 2 | 10/292, 6; 2 | +1 relapse in the extra day |
| FS-OB1f | not measurable until T04b (3.29.0) | — | |
| FS-OB2a | proxy 10-15→11-13: android **24/129 (18.6%)**, ios 6/42, android? 4/5 | 23/111, 6/34, null 5/28 (V1-q19) | person-level platform resolves V1's null-platform riders; android share within noise. OAuth events after T04a |
| FS-OB2b | **6/127** OAuth sign-ups > 10 s (5 foreground): google-android 3/81, apple-ios 2/17, google-ios 1/10 | 6/124 | reproduces |
| FS-OB2c | not measurable until T04a | every cancel alerts (code) | |
| FS-OB3 | **20 sent, 17 verified (85%)** | 19/16 | reproduces; restored after T04b/T13a |
| FS-OB4 | 28 d by first start: android p50 **45 s**/p90 **208 s**, ios 45/119; model **62/143 (43%)**; > 60 s **61/159 (38%)** | since 10-15: 45/43, 229/120; 45.6%; 38% | **window fixed** (trailing 28 d by first `onboarding_started`) as the plan asked; the target p90 ≤ 75 s is judged on it |
| FS-OB5 | stopped at account, never authed: all **45/462**, 3.26.0 **18/167** | 46/470, 18/166 | reproduces; split after T04a |
| FS-OB6 | (a) completed twice **6/292**; (b) not measurable until T05d | 6/292 | |
| FS-OB7 | **12/209** non-completers left after the paywall (3.26.0 2/70) | 13/216 | record only, no tile |
| FS-PO1 | 3.26.0 **7/121** (all within 1 h) | 7/118, 7/120 | reproduces |
| FS-PO1H | DB: S4(a)/(b) above; PostHog form after T07a/T07b | | |
| FS-R2-3 | DB proxy **117** live blank-model bikes, **7** ever with a task | 116/7 | event form after T05d/T23 |
| FS-R2-4 | imperial riders' onboarding bikes 77 (60 d), 4 with OEM interval tasks, 6 of 36 tasks in miles, 9 in km | n/a | baseline n/a until T07a; denominator from `measurement_system` |
| FS-R2-5 | **6/175** live onboarding bikes (60 d) with a make < 3 letters; all time 10/366 | 6/176 | reproduces |
| FS-PO2a | 3.26.0 **3 of 5** limit riders loop, 9 events | 3/5, 9 | identical |
| FS-PO2b | 14 failures; 3.26.0 **10 / 3 riders**, **7 offline**, p90 71 s (3.26.0 only), max **141 s** | p90 47 s (all 14), 141; 10/3; 7/14 | the all-version p90 includes 4 instant failures on 3.21/3.22; `reason`/`elapsed_s` after T17 |
| FS-PO2c | **6 upfront paywalls / 3 riders** (3.26.0 4/2, 3.28.0 2/1) | 6/3 | identical |
| FS-PO2d | first-hour `diagnostic_started` 3.26.0 **29/121 (24%)**; 3.19–3.21 2/39, 6/68, 4/33 | 29/117 | reproduces |
| FS-PO3 | 3.26.0 **14** automatic-gate sessions, **9** with a same-feature repeat (64%) | 9/14 (V1-q33) | identical |
| FS-PO3b | 3.26.0 **4 of 5** limit riders on the install launch | 4/5 | identical |
| FS-PO4a | ≥ 3.21 **1/14** | 1/14 (board 1/13) | identical |
| FS-PO4b | ≥ 3.21 `summary` **13 saves / 12 riders**, `auto_end` 2/2; DB first ride live sub-floor **40 of 69** (26 < 50 m + 14 null) | 13/11; DB 26 + 15 null of 71 | reproduces (per-version rider sum counts one rider twice) |
| FS-PO5 | **0** HUD views without any start; stale > 3 h 9 | 0 | guard (alert in T03b) |
| FS-PO6 | first-hour `$rageclick` all **18/292**, 3.26.0 **7/121** | 15/281, 7/116 | reproduces |
| FS-PO7 | not measurable until T05d/T29 | — | |
| FS-PO8 | android first Discover **43/44** backgrounded ≤ 2 s (median 0 s); ios 0/29; null 52/85; Garage control android 1/60, ios 0/37 | 42/43, 0/28, 1/59 | reproduces |
| FS-PO9 | 3.26.0 **11/121** | 11/121 | identical; no tile |
| FS-PO10 | by the first tick, real ride **before** the tick: tap **16** riders, 0 with a prior ride; data **20**, **10** without a prior ride; null trigger 10, 9 without | tap 16 (3), data 20 (12) counted "any time" | **ordered** as the plan asked: baselines of the "= 0" targets are tap 16 and data-without-prior-ride 10 |
| FS-PO11 | 3.26.0 **2/121** (completions 10-23, 11-05) — **both rider-opened** (see below) | 2/120 | settled; regression guard only, no tile |
| FS-PO12 | sign-in ≤ 1 h after completion all **11/292**, 3.26.0 **5/121**, 3.27.0 2/6 | 11/292, 5/120 | identical; T06 item 1 corrected tile baseline **4/292** (§10.2) |
| FS-PO13 | onboarding step ≤ 7 d after completion all **8/292**, 3.26.0 **6/121** | 7/292, 5/120 | +1 rider relapsed in the extra day |
| FS-PO14 | Start Ride opened day 0 with no ride **68/131 (52%)**, 3.26.0 31/49; ride started among openers 63/131 | 68/132, 30/48; 63/130 | reproduces |
| FS-PO15 | 11 of 48 scan-starting riders reached `receipt_scan_manual_fallback` (60 d) | unknown | not fixing now; no tile |
| FS-PO16 | `trip_created` 5 riders; "list rendered empty" not measurable (no `trips_list_viewed`) | unknown | not fixing now; no tile |
| FS-PO17 | not measurable until T05d/T16b | — | |
| FS-EXP1 | not measurable until T30; primary baseline = S1 above | | |

**FS-PO11 replay check (2026-11-13).** Both 3.26.0 completers who saw What's New within 1 h opened it **from the Profile tab**:
each was walking the Profile rows (rides, trips, saved, app settings) and the next `$screen` was `/(modals)/whats-new`, 2.7 min and
39.6 min after completion, mid-session, not on a launch and not on the post-completion Home landing. So the automatic What's New does
not reach brand-new riders. **Replays: could not answer by watching** — this agent cannot play recordings (no replay viewer, and new
Replay Vision scans are out of T02's scope). The 2026-11-05 session has a recording, the 2026-10-23 one has none; a human can confirm
the Profile-row tap in the 11-05 recording. Verdict: settled; the guard stays `whats-new.yaml`.

**What differs from the plan and why (summary):** S1 3.26.0 8/84 → 10/89 (one more day of completions; noise). FS-OB1d proxy 12 → 9
(V1's proxy SQL was never committed; the reconstruction matches 3.26.0's 6). FS-OB2a denominators grow (person-level platform). FS-OB4 and
FS-PO10 now use the fixed definitions the plan asked T02 to set (28-day window; real ride before the tick). Nothing else moved by more
than ±1–4 riders.

## 5. Weekly DB check (D2b C)

Recipe: `queries/db/README.md` (every Monday, read-only, each file `BEGIN READ ONLY; … COMMIT;`). One row per file per run.

| Run date | File | Window | Result |
|---|---|---|---|
| 2026-11-13 | `s4a-day0-schedule.sql` | last complete week 11-02 (and 10-12→11-02) | week 11-02: any 7/41, **oem 3/41**; 10-12→11-02: any 25/111 (22.5%), oem 15/111 (13.5%); pre-drop 08-10→10-05 any 137/218, oem 131/218 |
| 2026-11-13 | `s4b-r2m1.sql` | weeks 09-28→11-09 | 10/157 (6.4%); week 11-02 2/42 |
| 2026-11-13 | `fs-r2-4-imperial.sql` | onboarding in last 60 d | imperial 77 bikes, 4 with OEM interval tasks, 36 tasks: 6 in miles, 9 in km (n/a until T07a) |
| 2026-11-13 | `fs-po4b-first-ride.sql` | sign-ups in last 60 d | 69 sign-ups with a ride: first ride live sub-floor 40 (26 < 50 m + 14 null), real 16, deleted 13 |
| 2026-11-13 | `fs-ob1e-two-bikes.sql` | bikes in last 60 d | 2 accounts |
| 2026-11-13 | `fs-r2-5-short-make.sql` | onboarding bikes, last 60 d / all time | 6/175 / 10/366 |

## 6. Experiment 1 ledger — "first-ride plan" (D13 signed 2026-11-12; D16)

### 6.1 Design (D13)

- **The bundle holds the single slot** (T30 flag + assignment, T31 teaching sheet, T32 "When's your next ride?" plan card + local
  scheduler, T34 day-1 fallback notification). Flag `activation_365_first_session`; sticky assignment **after** the onboarding paywall.
- **Primary: S1** (week-1 core action among completers; first `onboarding_completed` after launch, 7 d from completion), by
  `activation_arm`. Baseline: completion-anchored 39/272 (14.3%), 3.26.0 10/89 (11.2%) (§4); D13's text cites the first-seen 61/367.
- **Stopping:** Miller N = 64 on unstratified counts (ship when T − C ≥ 16; stop when T + C = 64) **plus one one-sided z-test at
  the cap**.
- **Cap 2027-03-31** (`EXP1_STOP_AT`, embedded hard ceiling). **No start after 2027-01-06** (embedded hard ceiling).
- **Keep-after-no-winner rule:** after a capped no-winner, keep the bundle if the 90% lower bound of the difference > −3 pts, else
  revert. Qualitative signals are reported beside the decision, not gating.
- **Chips:** Later today, Tomorrow, This weekend, Not sure yet; **first chip "Later today"**.
- **`maintain_bike` day-1 copy:** "When did you last service your {model}?" (opens the bike's service plan).
- **Notification kind `activation`** with a `source` property.
- SRM χ² weekly per platform × region.

### 6.2 Start and stop (D16, doc review item 4)

- Start = the first day **3.30.0 is ≥ 90% of new installs on both platforms**, but **not later than 2027-01-06**. If not reached by
  then, the slot does not start this season; the bundle ships on the no-harm path (P06.3).
- The window is served by the API field **`activationExperimentWindow {startAt, stopAt}`** on the `User` returned by
  `completeOnboarding` (T30's API part, deployed before the 3.30.0 cut). Null or unreachable = not started (control,
  `source: 'pre_start'`, no draw). The **embedded ceilings always apply**: latest start 2027-01-06, stop `EXP1_STOP_AT` 2027-03-31.
- The start is set server-side on the D16 day and the PostHog flag is flipped the same day. **No OTA** is needed to start or stop.

| Field | Value |
|---|---|
| Release B (3.30.0) go-live iOS / Android | _(T35)_ |
| Day 3.30.0 ≥ 90% of new installs, both platforms | _(T35)_ |
| `activationExperimentWindow.startAt` set (date, by) | _(T35)_ |
| Flag flipped (date, PostHog id) | _(T35)_ |
| Stop (date, reason: Miller stop / cap / revert) | _(T40)_ |

### 6.3 Pre-registered analysis (plan §5 FS-EXP1; D13 implementation note, V2)

- **Primary test:** S1, **one one-sided test at the cap, stratified by goal (`track_rides` vs other) × platform**:
  Mantel–Haenszel risk difference and its z (both stratifiers are set before assignment). The keep rule uses the MH
  risk-difference interval. Miller N = 64 stays as the sequential stop on unstratified counts.
- **`returning_account` riders** (first auth in the install = sign-in to an existing account; 21/367 completers, 33% back on day 2)
  are **excluded from the primary** and reported separately.
- **One pre-specified subgroup: `track_rides`.** No other subgroup is read as a result.
- `maintain_bike` riders are read on S1 and days 7–13, never on S3.
- Secondary: S3 engaged (calendar day; randomization cancels the install-hour bias). FS-PO4a and FS-PO9 outcomes by arm are descriptive.
- **Detectable effect stated as an absolute lift** in S1 (test − control), not "×2".

### 6.4 Power (plan §5 FS-EXP1, recomputed 2026-11-12; normal approximation, one-sided α = 0.05 at the cap, 2.1 completers/day split 50/50, ≈ 6% removed as `returning_account`; planner calculation)

| Start | Days to cap | Riders per arm | +8 pts at 9.5% | +8 pts at 12.6% | +10 pts at 9.5% | +10 pts at 12.6% | ×2 at 9.5% / 12.6% (old framing) | 80%-power MDE |
|---|---|---|---|---|---|---|---|---|
| 2026-12-15 | 106 | ≈ 104 | ≈ 0.52 | ≈ 0.46 | ≈ 0.66 | ≈ 0.60 | 0.62 / 0.75 | +12.5 pts (9.5%) · +13.6 pts (12.6%) |
| 2027-01-06 (latest start) | 84 | ≈ 83 | ≈ 0.45 | ≈ 0.40 | ≈ 0.57 | ≈ 0.52 | 0.54 / 0.67 | +14.3 pts · +15.5 pts |

A Monte-Carlo check with the stratum baselines (24% / 8%, Oct-scaled 13.7% / 4.6%, 54% `track_rides`, uniform +8 pts) gives the
same power for the stratified MH test as for the unstratified z-test (±1 pt): stratification buys robustness to chance imbalance
and an honest subgroup, not power. A capped no-winner means **"no large lift shown"**, not "no effect".
The 2026-11-13 S1 strata (34/145 vs 5/127, §4.1) are colder than V2's (24% / 8%) for "other": treat the 9.5% column as the
realistic one, and possibly still high.

*Earlier ledger note (plan §10, ×2 framing, superseded by the table above on 2026-11-12):* start 2026-12-15 → ≈ 0.78 at a 12.6%
baseline, ≈ 0.65 at 9.5%; start 2027-01-06 → ≈ 0.69 at 12.6%, ≈ 0.56 at 9.5% (one-sided α = 0.05 at the cap, 2.1 completers/day,
×2 effect). A capped no-winner means "no doubling shown".

## 7. Both-arm change log

Every change that reaches **both** arms of `onboarding_paywall_2026q4` (RevenueCat `expd7c1d56904`) or of Experiment 1, with its
go-live date **per platform**, so the A/B and Exp 1 readouts can be cut before/after it (D1, §3A.0 rule 7). Paywall surfaces
(`onboarding_paywall`, `onboarding_garage_ready`) are never changed by #365.

| Date (go-live) | Platform | Task | Change | Release (version / build / API deploy) | `activation_fix_level` | PostHog annotation id |
|---|---|---|---|---|---|---|
| | | | | | | |

Expected entries (D1, D12): T11, T12, T13a, T13b, T14, T16a, T19a, T19b, T20, T25b, T30 (both onboarding arms); T27 (launch-day,
Release B) and T29 (Release A target) as both Exp 1 arms; P05.3 install-reason card if it ships in 3.30.0.

## 8. Per-release read log

One block per release row of plan §6, filled at 2, 4 and 8 weeks after go-live (per platform). Mechanical specs: count on the fix
level vs target. Outcome metrics: same-weeks comparison, then trailing 8 weeks; season / thin-cohort verdicts per §3.

| Release row (§6) | Platform | Read (2/4/8 wk) | Date | `lvl` vs previous | Specs read (result vs target) | S1 / S2 / S3 verdict | By |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

## 9. Ledger notes (copied from plan §10, 2026-11-12)

- **Post-slot candidate queue (was T41), in order:** P05.3 install-reason card (**card only**, see the P05.3 note below); P05.2 plate
  "Set up service plan"; day-1 nudge in its own slot (spring, only if Exp 1 wins); P04.3a iOS provisional notifications. Re-run the
  R6 returner comparison on ~100 first sessions per `activation_fix_level` after the slot (any new Replay Vision scan needs the
  owner's approval).
- **PO15 (receipt-scan fallback) and PO16 (trip missing in My trips) (was T41b):** "verify if seen again". Not fixing now; SQL in
  `queries/fs/` (`fs-po15.sql`, `fs-po16.sql`), no tile; full specs in plan §5A.3. If either shows up again in replays or support,
  open a task with its repro.
- **NHTSA model catalog cache (was T37):** trigger = `bike_setup_summary.model_fetch_ms` **p90 > 3 s** on any version (read from
  3.29.0 go-live). If it fires, persist the catalog (`apps/api/src/modules/motorcycles/nhtsa.service.ts`), target p90 ≤ 1.5 s.
- **Experiment 1 start/stop:** the window is served by the API field `activationExperimentWindow` (T30); null or unreachable = not
  started; embedded ceilings stop 2027-03-31, no start after 2027-01-06; the start is set server-side on the D16 day and the PostHog
  flag flipped the same day. No OTA is needed to start or stop. (Details §6.2.)
- **Experiment 1 power:** §6.4 (the absolute-lift table supersedes the earlier ×2 note).
- **P05.3 install-reason card — card only (validation V5, 2026-11-12).** The email channel is empty: 22 riders ticked the contact box
  (live since 10-14, source `onboarding`, wording v1), 21 of them inactive and live, and 0 of them ever sent feedback, so under the
  narrow reading of "The developer may contact me about my feedback" the pool is 0 (loose reading 21: es 11, en 9, tr 1). A broader
  email needs a new wording-v2 opt-in after the onboarding paywall A/B ends, and a stand-alone way to withdraw `feedbackContact`
  (today only by sending feedback again unticked; product gap, not a #365 task). Card: inline Home card, shown once on the first cold
  start on a later calendar day after completion, dismissible, theme tokens (light + dark), never in a session where a modal sheet or
  the Exp 1 plan card showed (D11 addition). Answers map 1:1 to the onboarding goals: `track_rides`, `maintain_bike`,
  `manage_expenses`, `discover_routes`, `just_exploring`, `other` ("Something else" opens the existing feedback form; its text stays in
  `feedback_messages`, never in PostHog). Events (consent-gated, `as const` constants next to `FEEDBACK_SENT`):
  `install_reason_card_shown {days_since_onboarding}`, `install_reason_answered {answer, matches_primary_goal, days_since_onboarding}`,
  `install_reason_dismissed {days_since_onboarding}`; strings in all app locale files (`pnpm check:i18n`). Under D17 it must be in a
  store binary: 3.30.0 at the latest (it then needs its own issue before the 2026-12-05 freeze), gated identically in both Exp 1
  arms, its go-live date logged as a both-arm change (§7); otherwise it waits until after 2027-03-31. Expected yield ≈ 12–20 answers
  in 8 weeks — enough to see a dominant reason, not to rank close ones, and it hears only riders who come back. Sending any email or
  shipping the card needs the owner's approval.
- **Push-grant correlation is not notification evidence (V2).** No rider in the 08-14→11-04 cohort got a re-engagement message (1 of
  426 new users got any server push in week 1), so R6's push-grant split (12/45 vs 4/55) and V2's OR 1.7 describe a rider trait, not a
  message effect. Do not cite them for a notification lever.
- **`maintain_bike` riders (V2 §5.1 item 6):** they return on days 7–13 at the baseline rate (7/65) but almost never on day 2 (3/72);
  read them on S1 and days 7–13, never on S3. The D13 d1 copy stays as the owner's bet.
- **Follow-up after T40 — default week-1 message for everyone (V2 "missing lever").** Today 0 of 426 new users get a week-1 message
  except the rare maintenance push; Exp 1 tests a re-engagement message (T32 reminder, T34 d1 fallback) only inside the slot and only
  in the test arm. After T40, decide the default week-1 message for all riders (control and post-slot), using T40's d1-fallback read
  and the T33 delivery result. Not a task this season.
- **Growth hypothesis — referral quality (V2 §3.1, confidence 55%):** riders who heard of MotoVault from an AI chat return 2×
  (18/62 = 29% vs 13%); social referrals (FB/IG/TikTok) return at 5% (2/41). One of ~60 tests; pass to growth as a hypothesis,
  outside #365. Install attribution carries no usable source (`install_source` null or `organic_unknown`), so the self-reported
  `referral_source` is the only signal.
- **Accepted delay (doc review item 14):** T14b, T15b and T38 (PO12/PO13 and the session drop) ship one release after their data gate,
  not in Release A. Since D17 their data gates count from 3.29.0 go-live and their fixes ship in the next store build after the gate.
- **Test-account filter gap (V3 item 7, T02 2026-11-13):** the internal tester on builds 92–99 is inside `{EXCL}` (via the synthetic
  users) but not in the project's test-account filter; adding `internal = true` to that person is a PostHog write for the D2 list
  (not done by T02).

## 10. T06 research findings

T06's answers live in [`research/t06-findings.md`](research/t06-findings.md) (written by T06; T02 only links it).

### 10.1 Reminder scheduler cap (T06 item 7, issue #410; copied word for word)

**Answered (doc review 2026-11-12):** no immediate burst, because imported tasks get due dates in the future; the risk is same-day clustering when
several intervals fall due on the same anniversary. Today `sendDuePush` sends one push per task
(`apps/api/src/modules/push-tokens/maintenance-push.service.ts:61, 125-158`), so the cap (one combined push per bike, at most one per bike per
7 days) is built inside T07a before its deploy.

### 10.2 Tile baselines and engaged return carried from T06 (read 2026-11-13)

| Item | Baseline | Note |
|---|---|---|
| FS-PO12 (T06 item 1) | **4/292** (3.26.0 **1/121**) without the cold-start `/(auth)` flash | Replaces 11/292 in §4.2 as the T15 / T15b tile baseline (column `po12_no_flash_1h` in `queries/fs/fs-po12.sql`); 11/292 is the as-measured form |
| FS-PO2d (T06 item 2) | first-hour diagnosis via Home → Diagnose, 3.26.0 **29/121** (60 d, tie-aware; T06 first reported 26/120, an order-dependent count) = all entries 29/121 | T03b tile baseline, column `po2d_diag_1h_via_home` in `queries/fs/fs-po2d.sql`. T06's 26/120 (90 d) came from q2a's last-screen rule, which depends on sort order when `/(tabs)` and `/(tabs)/(home)` share a timestamp (26, 27, 28 on same-day re-runs); counting the tie, all 29 first-hour diagnoses on 3.26.0 entered from Home |
| F14 engaged return, 100 scanned riders (T06 item 10) | d2 raw **16/100**, d2 engaged **13/100**, week-1 engaged 16/100 (**7/72** with a full week), week-1 core action 17/100 | Exp 1 context; the cohort F14 baseline stays 37/367 completers |

## 11. Dashboard, alerts and annotation (T03b, 2026-11-13)

**Dashboard:** [#365 Activation & frictions](https://eu.posthog.com/project/155556/dashboard/1111923) (PostHog project 155556, EU),
id **1111923**, tag `activation-365`. Named write list (D2, shared for information): issue #401,
[comment 6850112739](https://github.com/andrejkanuch/MotoWise/issues/401#issuecomment-6850112739). Every id is also in plan §6.2.

### 11.1 Day-1 drop-off funnel check (first tile)

Run 2026-11-13 on the evidence-pack window (first seen 2026-08-14 → 2026-11-04, lookback from 2026-04-01, app persons, 14-person
`{EXCL}`): **793 first seen → 685 started (86%) → 367 completed (46%) → 61 core action in week 1 (7.7%) → 39 engaged day-2 return**
(raw day-2 return 72; completers engaged 37). This is the evidence pack §2 and board/06 F14 **exactly**, so the `{EXCL}` change
(12 → 14 persons) moved nothing in this window. One difference, in the platform split only: the tile's person-level `plat` (plan §0
`{REL}`) gives android 673 / ios 120, the pack 559 / 228. The pack mapped old builds to a platform by hand; the `$app_build >= 100`
fallback labels iOS builds below 100 (3.19.x–3.22.x, b82–b97) `android?`. The fallback is valid for 3.26.0–3.28.x only (§1), so
pre-3.26 rows in any tile must not be split by platform. The saved tile uses a rolling window (first seen 90 d to 2 d ago), so its
week-1 column is still filling for riders first seen in the last 7 days.

### 11.2 How the tiles differ from the `queries/fs/` files

The tiles run the T02 SQL with these changes only (each tile's SQL starts with a comment naming its source):

- **`{REL}` columns added** (plan §0): `build`, `lvl` (`activation_fix_level`), `rt` (`runtime_version`) next to `ver`, taken from the
  same anchor event as `ver` (first completion, first start, first sheet, …); `plat` added where the file had none, as the person-level
  `argMinIf(platform, platform IS NOT NULL)` with the `$app_build` fallback, never the first event's platform. Event-level tiles (one
  row per event, e.g. FS-M, FS-OB3, FS-PO2a) use that event's own `platform`. FS-OB1b, FS-OB2b and FS-PO8 keep T02's last-non-null
  platform. Two tiles take the platform of their anchor event instead of the person: FS-PO3 (any `platform` in the paywall session) and
  FS-PO3b (`platform` on the rider's first `diagnostic_limit_reached`, null when that event lacks it). `lvl` and `rt` read null on every row until T01 ships in 3.29.0.
- `Application Opened` is added to the per-person event filters so `plat`/`build` can come from the install open.
- `{EXCL}` = `toString(person_id) NOT IN (SELECT person_id FROM activation365_excluded_persons) AND e2e_run != 'true'` (§11.4).
- One file, two tiles: `fs-po3-s5.sql` (part 1 → FS-PO3, part 2 → S5); `s2.sql`/`s3.sql` are one query, the tiles show different
  columns; the per-completer query (V1 §3.5) feeds FS-PO6, FS-PO12, FS-PO13, FS-PO14 and FS-PO2d, each tile keeping its own columns.
- `fs-ob2a.sql`/`fs-ob2b.sql` `{start}`/`{end}` → a rolling 28 days.
- Windows stay inside the SQL (cohort definitions), so the dashboard date picker does not change them.
- Server-event tiles (FS-R2-4 `service_plan_imported`, FS-R2-5 `onboarding_bike_created`) carry no client `ver`/`lvl`: read them by
  date against the API deploy annotation.

**No tile (by design):** FS-OB7, FS-PO9, FS-PO11, FS-PO15, FS-PO16 (SQL in `queries/fs/`, run at the 2/4/8-week reads) and the DB-only
checks (S4(a), DB forms of FS-R2-4, FS-R2-5, FS-PO4b, FS-OB1e; §5).

**Empty until 3.29.0 (Release A) or the named API deploy — expected, said in each tile description:** FS-OB1f, FS-OB2c, FS-R2-3,
FS-PO7, FS-PO17 (T04/T05 events); S4/FS-PO1H and FS-R2-4 (T07a deploy); FS-R2-5 (T05e deploy); FS-EXP1 (Release B); push tokens
(first store build with #393). `lvl`/`rt` columns everywhere until T01.

### 11.3 Tiles (dashboard order)

| # | Insight (name) | Source SQL (`queries/fs/`) | Insight id | Short id | Tile id |
|---|---|---|---|---|---|
| 1 | Day-1 drop-off funnel — first seen to engaged day-2 return | new (q02 base CTE + board/06 App. B) | 7346020 | `xoj8soYd` | 8599594 |
| 2 | S1 — Week-1 core action among completers | s1.sql | 7346041 | `8ca2D4XQ` | 8599629 |
| 3 | S2 — Onboarding completion | s2.sql | 7346043 | `QKKgVHEg` | 8599634 |
| 4 | S3 — Day-2 engaged return | s3.sql | 7346050 | `av2VAysF` | 8599642 |
| 5 | S4 / FS-PO1H — Onboarding bike gets a service plan within 5 min | fs-po1h-s4.sql | 7346064 | `agaPX2Ll` | 8599664 |
| 6 | S5 — First-hour multi-paywall | fs-po3-s5.sql (2) | 7346071 | `PwJuQxJM` | 8599671 |
| 7 | S6 / FS-OB1 — Post-auth early-step regression | s6-fs-ob1.sql | 7346112 | `c2IajgXD` | 8599735 |
| 8 | FS-M — Release marker on opens | fs-m.sql | 7346123 | `CiVcsl5U` | 8599754 |
| 9 | FS-OB1a — Sign-in screen does nothing after auth | fs-ob1a.sql | 7346128 | `NIEkCC5F` | 8599757 |
| 10 | FS-OB1b — Back-walk rewinds onboarding | fs-ob1b.sql | 7346139 | `lDkD2GKj` | 8599775 |
| 11 | FS-OB1c — Resume loses the screen | fs-ob1c.sql | 7346150 | `vsHgaN0N` | 8599794 |
| 12 | FS-OB1d — Welcome shows again in a live runtime | fs-ob1d.sql | 7346163 | `5fbikJZD` | 8599815 |
| 13 | FS-OB1e — Finished rider routed back into onboarding | fs-ob1e.sql | 7346167 | `lSfcoBlT` | 8599819 |
| 14 | FS-OB1f — Session drop mid-onboarding | fs-ob1f.sql | 7346168 | `Wjp528DN` | 8599820 |
| 15 | FS-OB2a — Riders who view the account step but never sign up | fs-ob2a.sql | 7346169 | `eOqmbeQy` | 8599821 |
| 16 | FS-OB2b — Long spinner after the OAuth session lands | fs-ob2b.sql | 7346171 | `i2dW1iW9` | 8599823 |
| 17 | FS-OB2c — Cancelling Google shows an error | fs-ob2c.sql | 7346172 | `zsBfauEg` | 8599824 |
| 18 | FS-OB3 — Email code lost when the rider leaves | fs-ob3.sql | 7346177 | `KV6rkE1w` | 8599829 |
| 19 | FS-OB4 — Bike search is slow or ends without a model | fs-ob4.sql | 7346188 | `85mYNrrO` | 8599848 |
| 20 | FS-OB5 — Riders leave the sign-up screen without trying | fs-ob5.sql | 7346189 | `hoYttVxS` | 8599849 |
| 21 | FS-OB6 — Open my garage loops or shows Retry | fs-ob6.sql (same query as FS-OB1e) | 7346190 | `C6wnLxVg` | 8599850 |
| 22 | FS-PO1 — Adding my bike hits the bike paywall | fs-po1.sql | 7346193 | `FSQoFbjw` | 8599852 |
| 23 | FS-R2-3 — Make-only bike gets its model set | fs-r2-3.sql | 7346195 | `eqWfiWw4` | 8599854 |
| 24 | FS-R2-4 — Imperial riders' imported plan units | fs-r2-4.sql | 7346196 | `vbSKixfS` | 8599855 |
| 25 | FS-R2-5 — Junk makes saved in onboarding | fs-r2-5.sql | 7346197 | `aXVq0ud9` | 8599856 |
| 26 | FS-PO2a — Diagnostics Try Again limit loop | fs-po2a.sql | 7346198 | `1evwpw2h` | 8599857 |
| 27 | FS-PO2b — Diagnosis failures: waits, raw text, offline | fs-po2b.sql | 7346199 | `nItW508v` | 8599858 |
| 28 | FS-PO2c — Exhausted diagnose CTA looks available | fs-po2c.sql | 7346201 | `XL9j2gJl` | 8599859 |
| 29 | FS-PO2d — First-hour diagnosis entered from Home | fs-po2d.sql (cols po2d_diag_1h, po2d_diag_1h_via_home) | 7346212 | `HxvW6fYc` | 8599878 |
| 30 | FS-PO3 — Repeated automatic paywalls in one session | fs-po3-s5.sql (1) | 7346213 | `ZbKfTIrJ` | 8599879 |
| 31 | FS-PO3b — Limit hit on the install launch | fs-po3b.sql | 7346215 | `QDURdvwW` | 8599881 |
| 32 | FS-PO4a — Standstill first attempt treated as an error | fs-po4a.sql | 7346216 | `X0alv0hr` | 8599882 |
| 33 | FS-PO4b — Standstill ride saved as a ride | fs-po4b.sql | 7346219 | `2EPRLdIH` | 8599883 |
| 34 | FS-PO5 — Ride HUD opened without any start | fs-po5.sql | 7346222 | `RtbykMhF` | 8599884 |
| 35 | FS-PO6 — Taps that do nothing on Home | fs-po6.sql (col po6_rage_1h) | 7346242 | `2BVPY35q` | 8599919 |
| 36 | FS-PO7 — Discover slow or stuck | fs-po7.sql | 7346245 | `asFePQCx` | 8599924 |
| 37 | FS-PO8 — Unexplained modal on first Discover | fs-po8.sql | 7346246 | `nGpL9m2G` | 8599932 |
| 38 | FS-PO10 — First-ride checklist row ticks without a ride | fs-po10.sql | 7346247 | `2jEhekUk` | 8599935 |
| 39 | FS-PO12 — Sign-in screen after onboarding | fs-po12.sql (cols po12_no_flash_1h, po12_signin_1h) | 7346257 | `Q7PFyBmB` | 8599953 |
| 40 | FS-PO13 — App returns to onboarding after completion | fs-po13.sql (col po13_onboarding_after) | 7346264 | `ZdK5AOXf` | 8599961 |
| 41 | FS-PO14 — Start Ride opened on day 0, no ride | fs-po14.sql (cols po14_*) | 7346271 | `HK0zMRzZ` | 8599967 |
| 42 | FS-PO17 — Several sheets over Home on landing | fs-po17.sql | 7346281 | `ytyBK24V` | 8599985 |
| 43 | FS-EXP1 — Experiment 1 enrolment | fs-exp1.sql | 7346292 | `93e8ohse` | 8600004 |
| 44 | Weekly install cohorts — activation by week, platform, onboarding variant | new (q02 base CTE + board/06 App. B) | 7346299 | `dUZcKZdI` | 8600011 |
| 45 | Android push tokens — push_token_registered by platform per week | new (`lib/push-token.ts`) | 7346305 | `JmPhGdbo` | 8600017 |
| 46 | FS-PO5 — alert: HUD opened without any ride start (last 7 d) | fs-po5.sql, last 7 d | 7346326 | `f10IUkAu` | 8600053 |
| 47 | FS-M — alert: opens on a #365 binary without the expected fix level | new (plan §5A.2 binary rule) | 7346324 | `YkNZQEVz` | 8600052 |

Reading rule in every description: mechanical tiles are read as counts on the fix `lvl` against the target; harm-check tiles (S1–S3,
FS-EXP1, the cohort table) use §3 (November–March: concurrent comparison, a trailing-8-week drop alone is "no verdict (season)";
fewer than 30 Android riders on the new level at 2 weeks is "no verdict (thin Android cohort)").

### 11.4 Exclusion view, alerts, annotation

| Object | Id | Notes |
|---|---|---|
| SQL view `activation365_excluded_persons` | `01a1d46b-e269-0000-0612-a1fe79b50e59` | One row per `{EXCL}` person id (14, as text; recipe `queries/q00-excluded-persons.md`), not materialized. Replaces the static cohort on the first named list: the V4 emulator person is personless, so a cohort cannot hold it. A later `{E2E_PERSONS}` addition is one `view-create` (upsert) on that read's own named list |
| Alert **FS-PO5 — HUD opened without any ride start (#365)** | `01a1d474-999b-0000-5792-c19c6b5dd5df` | Insight 7346326 (`f10IUkAu`); **weekly**; fires when any row has `hud_without_any_start > 0` (HUD views in the last 7 d, 60-d lookback for the start); email to the owner. Regression guard for FS-PO5 (no Maestro flow). Today: 0 of 83 HUD views |
| Alert **FS-M — opens without the expected fix level (#365)** | `01a1d474-a32e-0000-dc16-82ddcdf4b826` | Insight 7346324 (`YkNZQEVz`); **daily** over the last 3 days of `Application Opened` on versions ≥ 3.29.0; fires when any row has `mismatched_opens > 0` (level missing or below the cut level: 3.29.0 = 2, 3.30.0 = 3; a hotfix OTA only raises the level). This is stricter than the issue's "checked 3 days after go-live": a trailing 3-day window checked daily fires from the first mismatched open, so a wrong cut is caught on day 1 and the check never lapses. A later store version is checked for ≥ 2 until its cut adds its row: **each store-build cut after 3.30.0 updates this insight's `multiIf` on that release's named list**. Today: no rows (no ≥ 3.29.0 opens). Dry run with the floor at 3.27.0: 3.27.0 63/63, 3.28.0 30/30 mismatched (no marker yet), as expected |
| Annotation `#365 baseline — T02 baselines recorded (docs/research/activation-365/experiments.md §4)` | **204474** | Project scope, dated 2026-11-13 (the day T02 recorded the baselines) |

Alerts in the project after T03b: 4 of the free tier's 5 (2 from #326, 2 from #365).

**Verification (2026-11-13):** `SELECT id, name FROM system.dashboards WHERE NOT deleted AND name = '#365 Activation & frictions'` →
1 row (1111923). `SELECT count() FROM system.insights WHERE NOT deleted AND name LIKE 'FS-%'` → **38** (36 FS spec tiles + 2 alert
sources) ≥ the 36 PostHog-measurable FS specs with a tile. Spot checks of saved tiles reproduce §4.2: FS-PO5 0 without start / 9 stale;
FS-PO2b 3.26.0 10 failures / 3 riders / 7 offline / max 141 s; FS-PO3b 3.26.0 4 of 5; FS-PO8 android Discover 43/44 summed over the version rows (the tile splits T02's per-platform row by `ver`/`build`).

