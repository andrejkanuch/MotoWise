# #365 Activation: execution plan (issue-by-issue, in order)

Planner run, 2026-11-12; **revised the same day after the critic review** (`EXECUTION_PLAN-review.md`, 30 items; answers in §8), and **validated the same day against production and devices** (`validation/V1…V5`; every change is listed in §11, the new confidence scores are in §11.1). **Research only:** no app code, migration, PostHog, RevenueCat, GitHub or Supabase write was made.
Code is cited from the clean checkout of `origin/main` at `52d281e9` (`a clean checkout of origin/main`).
Paths starting `apps/`, `packages/`, `supabase/`, `docs/` are repo-relative. Every other code path is relative to `apps/mobile/src/`.

**Inputs:** `00-evidence-pack.md`, `05-session-replay-findings.md`, `board/99-synthesis.md`, `board/review-verdicts.md`,
`push-tokens-investigation.md` and the six deep dives `deep-dives/R1…R6`. Where a deep dive and an earlier file disagree,
the deep dive wins (it re-ran the numbers on code and events). Disagreements resolved here are listed in §1.4.

**Who this is for:** coding agents implementing one GitHub issue per task, in the order of §3A (the revised, split task list; one issue draft per task in `issues/`). Each task section plus the
files it cites is enough to start. Each bug/enhancement task links one or more **friction specs** (§5). A task is done only
when (1) its automated check passes where §5A says it runs (`jest (CI)` or `maestro (local, <device>)`, with the run log + screenshots in the PR body,
and for reproducible bugs a **red run on `origin/main`** first), and (2) its production metric exists as an insight on the PostHog dashboard
"#365 Activation & frictions" (T03b), or — for DB-only metrics — as a dated row of the weekly DB check (D2b, §3A.0).

**Tag legend:** `[SOURCE: …]` = backed by a query id, file:line or URL. `[UNBACKED — own idea]` = planner's judgement.

---

## 0. Conventions used everywhere

- **`{EXCL}`** = `toString(person_id) NOT IN (<excluded test/synthetic person ids: project test-account filter + is_synthetic users; list kept outside the repo>)` (**13 persons**, not 12: the 11 PostHog persons of the 26 synthetic/test/soft-deleted Supabase users plus 2 filter-only ids [SOURCE: V1 §0, V2-s1]; T02 also adds the internal tester who runs internal builds 92–99 and is not flagged `internal` [SOURCE: V3 §2, item 7] and the person, if any, behind the V4 emulator run — `$device_model = 'sdk_gphone64_arm64'`, app 3.28.0, 2026-11-12 14:18–14:30 UTC, anonymous [SOURCE: V4 Setup]; `queries/q00-excluded-persons.md`) **AND** `coalesce(toString(properties.e2e_run), '') != 'true'` (E2E builds, super property from T01) **AND** `person_id NOT IN ({E2E_PERSONS})`, the list of historical e2e persons T02 finds once (`person.properties.email LIKE 'e2e-%'`). DB queries exclude `users.is_synthetic` and `email LIKE 'e2e-%'` (the runners set `is_synthetic = true`, T02). [review item 7]
- **`{RN}`** = `properties.$lib = 'posthog-react-native'`. **Never applied to server events** (`$lib` is null on them): `signup_completed` (462 events / 90 d), and from T05e/T07a `onboarding_bike_created`, `ride_saved`, `service_plan_imported`. A query that mixes them uses `({RN} OR event IN (<server events>))` [SOURCE: V1 summary item 7, V1-q1b].
  Supabase snippets inside a join qualify the exclusion columns (`u.deleted_at`, `u.email`; bare names are ambiguous with `motorcycles`) [SOURCE: V1 §3.8].
- **`{REL}`** (the release breakdown every metric uses) = `toString(properties.$app_version) AS ver, toString(properties.$app_build) AS build, toString(properties.activation_fix_level) AS lvl, toString(properties.ota_update_id) AS ota` plus a **person-level** platform:
  `coalesce(argMinIf(lower(toString(properties.platform)), timestamp, properties.platform IS NOT NULL), multiIf(toInt(properties.$app_build) >= 100, 'ios?', 'android?')) AS plat`
  inside the per-person aggregate. `$os` is **dropped**: it is never set on mobile events (0 of 332 opens in 7 d), and `platform` is null on 29% of opens — exactly the install/first open — so "platform of the first event" is null for most first-session cohorts [SOURCE: V1 §3.1, V1-q2…q5].
  The `$app_build` fallback is temporary and valid only for 3.26.0–3.28.x (Android versionCode 93–99, iOS build 106–111); it breaks once Android reaches versionCode 100, so T01 must make `platform` non-null on 100% of `Application Opened`, **including the first** (T01 acceptance). `build` also separates internal/tester builds from production on the same version (Android vc95–99, V1-q5). T03b tiles do not group by the first event's `plat` before T01 ships.
  Until T01 ships (embedded in Release A 3.29.0, D17), `lvl` and `ota` read null on every event (Q-P4 below), so pre-3.29.0 reads are by `ver` + calendar date.
  Also `toString(properties.runtime_version) AS rt` once T01 ships (an OTA reaches only its own runtime, §3A.0; OTAs are used only for crash/data-loss hotfixes, D17).
- **Release marker** (one name set, replacing the five variants in R1/R3/R4/R5/R6): super properties `activation_fix_level` (integer),
  `ota_update_id` (`Updates.updateId ?? 'embedded'`), `ota_channel`, `is_embedded_launch`, `runtime_version`, `e2e_run` (only on E2E builds) and `platform`
  (already a super property at `hooks/use-analytics-super-properties.ts:70`; T01 registers it **earlier**, at client init) (T01).
  **The level is bumped only at a release cut** (store build commit, or the publish commit of a crash/data-loss hotfix OTA, D17), never per PR; the §6.1 friction status table is the only record of
  which level first ships each spec's fix [review item 3; doc review item 13 dropped the `ACTIVATION_FIXES` code map].
  PostHog annotation per platform (× runtime for a hotfix OTA): `#365 fixes: <platform> <version|runtime+hotfix OTA id|api> lvl <N> — <spec ids>` (T03a procedure).
- **Cohort for a first-session metric** = persons whose *first* `onboarding_completed` (or `onboarding_started` for onboarding metrics)
  falls in the window, broken down by the `{REL}` values *of that first event* (`argMin(..., timestamp)`).
- **SQL status:** HogQL marked *(run)* was executed in this planner session or the cited deep dive with the result shown.
  HogQL marked *(draft)* was written here and **not run**; T02 runs every draft once, fixes syntax, and records the baseline in
  `experiments.md` before any fix ships. A baseline number quoted next to a draft comes from the cited source query, not from the draft.
- **Reading rule (owner requirement, evidence pack §2):** weekly day-2 return swings 3–12% on 26–90 installs/week, so outcome
  metrics (completion, return, core action) can only show *large* changes and are read as **harm checks** (P06.3 rule: revert if
  `d + 1.645·SE < 0` at the 4- or 8-week look against the trailing 8 weeks) [SOURCE: board/99-synthesis.md §4 Experiment 2]. **Mechanical**
  friction metrics (the friction event itself: stuck sign-ins, limit loops, junk saves) are read directly: the target is usually 0 or a
  ceiling, and a few riders on the fix version are enough. Only Experiment 1 (randomized) can claim a lift.
  **Season and platform (doc review item 11):** for first-session cohorts on iOS the same-weeks version comparison is n/a (new App Store installs always get the newest
  version). Any harm check whose post-release window falls in November–March is judged against a **concurrent comparison**: the Android staged-rollout cohort before the
  Exp 1 slot, the Exp 1 control arm after it starts. A trailing-8-week drop alone is recorded "no verdict (season)" and never triggers a revert.
  **Slow Android adoption (V3 §4):** 108 of 113 Android riders seen in 14 d last ran 3.26.0 and only 32 of them were active in the last 3 days, so for the first 2–4 weeks after a
  store build the `lvl` returning-rider reads are mostly iOS and first-session reads grow only with new installs (≈ 40 store impressions/day). A thin Android cohort at the
  2-week read (fewer than 30 riders on the new level) is recorded **"no verdict (thin Android cohort)"**, never as a regression.
  **Install-hour bias (V2 §5.3):** the UTC calendar-day "day 2" gives a 00:30 UTC install a 23.5 h wait and a 23:00 UTC install 1 h (00–05 UTC installs return 7% vs 18%, p = 0.013).
  Per-release S3 reads therefore use the rider's **24–48 h window** as the primary form; the calendar-day form stays only inside Exp 1, where randomization cancels the bias.
- **Light/dark:** every UI task attaches screenshots in light and dark system mode to its PR (HUD screens stay `HUD_THEME`, always dark).
  `pnpm check:mobile-colors` must pass [SOURCE: CLAUDE.md "Guards"].
- **Paywall constraints:** `onboarding_paywall_2026q4` and RevenueCat `expd7c1d56904` keep running untouched; onboarding paywall
  surfaces (`onboarding_paywall`, `onboarding_garage_ready`) are never capped, moved or re-styled; every both-arm onboarding change
  is logged in the ledger with its date so the A/B readout can be cut before/after it.
- **Free tier:** logging maintenance/expenses, ride recording, history and basic stats stay free. `FREE_TIER_LIMITS.MAX_BIKES = 1` and
  `MAX_AI_DIAGNOSTICS_PER_MONTH = 1` are **not** changed by this plan [SOURCE: packages/types/src/constants/limits.ts:4-7].
- **Maestro:** no CI job runs Maestro (no `.github/workflows/*` mentions it), so every Maestro check is `maestro (local, <device>)`: the PR body carries the
  command, its log and screenshots. E2E builds bake `EXPO_PUBLIC_E2E_RUN=1` (T01 registers `e2e_run`); flows that seed data (diagnosis used) run against local
  Supabase via the runner's existing `SUPABASE_URL` override (`scripts/run-onboarding-e2e.sh:11-12`). **Seeded flows (doc review item 10)** run on a **Release build whose
  `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_API_URL` point at local Supabase + the local NestJS API** per `features/bike-detail-shell-overview/local-stack.md` (iOS sim
  `127.0.0.1`; Android emulator host `10.0.2.2` for both URLs); the runner's `SUPABASE_URL` override must match that build (a prod build with a
  local seed would read the wrong database). **Correction (V3 §5, item 3):** `pnpm db:reset` does **not** seed the schema — the repo migrations fail on an empty DB at 00093
  (ordering), 00097, 00098 and 00102 (`features/bike-detail-shell-overview/data-verification.md:13-18`), and the Supabase CLI is not installed. Seeded flows use the **patched
  local stack** `~/.motovault-local/mvscratch` (running, at 00199 on 2026-11-12), first brought to the repo's latest migration (00200–00202), started/stopped with a pinned
  `npx supabase@<version> … --workdir ~/.motovault-local/mvscratch`. **T00** sets this up once; every task whose acceptance needs Maestro depends on T00. Airplane-mode steps (`setAirplaneMode`, Android only) are
  tagged `android`; on iOS that check is jest only. Every testID a flow uses is created by the task named in §3A.4 and verified with `inspect_screen` on both platforms.
- **Maestro (cont.):** flows need a bundled release build (not the dev client) and, for `onboarding.yaml`, a build with
  `EXPO_PUBLIC_OB_VARIANT=invested`. **No EAS `preview` build exists** (V4 Setup; `eas build:list`), so "preview build" in any spec below means the **T00 recipe**:
  iOS — the `e2e-simulator` EAS profile (`OB_VARIANT=invested`) on an iPhone simulator (T00 installs the runtime; none was installed on 2026-11-12, V3 §5);
  Android — the `e2e-android` profile T00 adds (APK, `EXPO_PUBLIC_OB_VARIANT=invested`, `EXPO_PUBLIC_E2E_RUN=1`), or a universal APK made from the production AAB with
  `bundletool build-apks --mode=universal` + a local debug key (as V4 did; production backend, so read-only flows only); seeded flows use the `e2e-android` variant whose
  `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_API_URL` point at `10.0.2.2`, or a dev-client build against the local stack; the runner `apps/mobile/scripts/run-onboarding-e2e.sh` creates and deletes a confirmed user
  [SOURCE: apps/mobile/.maestro/README.md:7-35]. RevenueCat is not available in test runs: close any paywall with `optional: true` and assert only
  app-owned UI (memory `feedback_no_revenuecat_in_tests`). Custom keyboard ignores `hideKeyboard` (tap a label instead); `inputText`
  concatenates if focus doesn't move; author selectors from `inspect_screen`, never from screenshots; the ride guard sheet buttons are not in the
  a11y tree today (memory `project_maestro_authoring`). Each new flow gets a script
  `"test:e2e:<name>": "E2E_FLOW=<file>.yaml E2E_EMAIL_PREFIX=e2e-<name> sh scripts/run-onboarding-e2e.sh"` in `apps/mobile/package.json`
  (pattern at `apps/mobile/package.json:17-27`) and a line in `apps/mobile/.maestro/README.md`.

### 0.1 Queries run in this planner session (PostHog project 155556, read-only `execute-sql`)

| Id | Query (abridged) | Result |
|---|---|---|
| Q-P1 | `Application Opened`, last 14 d, `{RN}`, `{EXCL}`, by platform × `$app_version`, `uniq(person_id)` | *As first run (event-level `coalesce(platform, $os)`):* `(null)` 3.26.0 107; android 3.26.0 34; ios 3.26.0 20; `(null)` 3.27.0 11; ios 3.27.0 10; `(null)` 3.28.0 7; ios 3.28.0 3; 3.19.x 4. **Superseded by the validation (V1-q5, V3 P1/P2):** the `(null)` rows were an artefact (`$os` is never set; `platform` is null on first opens). **Per-person platform, 14 d to 2026-11-12:** Android 3.26.0 (b93) **108**, Android 3.28.0 (vc98/99) 5 (incl. 1 internal tester); iOS 3.26.0 **37**, 3.27.0 **14**, 3.28.0 **11**; iPadOS 3.26.0 1; unknown 10; total 186. 82% of riders last ran 3.26.0. **Stores (V3 §2–3):** Play production = **3.28.0 vc98** (completed; fresh installs from ~11-12 11:23 UTC, so review very likely cleared, 80%); vc99 (FCM) is a **draft on internal named "3.26.0"**; App Store live = **3.28.0 b111** (from 11-11), nothing in review. Android vc95 (3.27.0) and vc96–97 opens are internal testers. |
| Q-P2 | `SELECT column_name FROM system.information_schema.columns WHERE table_name='system.dashboards'` | id, name, description, created_by_id, created_at, deleted, filters, variables |
| Q-P3 | `SELECT id,name,created_at FROM system.dashboards WHERE NOT deleted AND (name ILIKE '%activation%' OR '%365%' OR '%onboarding%' OR '%friction%')` | 738337 "Onboarding A/B 2026" (2026-06-10); 636265 "Onboarding Funnel" (2026-04-22). **No #365 dashboard exists.** |
| Q-P4 | `Application Opened`, 7 d, `{RN}`: `countIf(properties.ota_update_id IS NOT NULL)`, `countIf(properties.activation_fix_level IS NOT NULL)` by version | 3.26.0 0/0 of 232; 3.27.0 0/0 of 59; 3.28.0 0/0 of 36. Taxonomy warning: neither property exists. **Release-marker baseline = 0%.** |
| Q-P5 | S1 (§1.2) with completers whose first `onboarding_completed` is in [now−67 d, now−7 d), by first `$app_version` | 3.19.0 7/59; 3.19.1 14/86; 3.20.0 1/11; 3.21.0 7/33; 3.22.0 0/3; 3.25.0 1/3; **3.26.0 8/84 (9.5%)**; total 38/279 (13.6%) |
| Q-P6 | S2/S3 (§1.2) for persons whose first `onboarding_started` is in [now−60 d, now−2 d), by first `$app_version` | 3.19.0 43/118 completed, 11 d2; 3.19.1 66/100, 10; 3.21.0 27/46, 8; **3.26.0 90/153 completed (59%), 17 day-2 (11.1%)**; others n ≤ 14 |
| Q-P7 | FS-OB1a SQL (§5) as written there, 60 d | 3.21.0 2 riders authed on `/(onboarding)/sign-in`, 2 stuck; **3.26.0 10, 6 stuck**; all other versions 0/0 (reproduces R1 Q12; validates the SQL) |
| Q-P8 | S5: completers (first `onboarding_completed`, 60 d) with ≥ 2 `paywall_present_requested` in −10…+60 min (any) and ≥ 2 non-`onboarding*` surfaces in 0…+60 min | 3.19.0 10/6 of 42; 3.19.1 8/8 of 69; 3.21.0 3/3 of 33; **3.26.0 13/8 of 121**; 3.27.0 0/0 of 6; 3.28.0 1/1 of 4 (reproduces R3 Q5; validates the SQL) |

No Supabase query was run by the planner; DB numbers below come from the deep dives (cited).

---

## 1. Goal, success metrics, confidence, owner decisions

### 1.1 Goal

Riders who install MotoVault reach a first core action (a saved real ride, an expense, or a maintenance task) in their first session
and come back. Concretely, this plan (a) removes every first-session friction found in replays and events, each with a proof that it is
gone on the release that fixes it, (b) restores the day-0 service schedule (Experiment 2), and (c) builds and launches the one randomized
test, Experiment 1 "first-ride plan" [SOURCE: board/99-synthesis.md §4].

What the evidence says about expectations: first-session friction does **not** separate day-2 returners from non-returners — first in 100
replay-checked riders (paywalls 2/16 vs 10/84, ride attempts 3/16 vs 13/84) [SOURCE: deep-dives/R6-replays-returners.md §3.1, R6-q1/q2/F1], then on **all 367 completers**
(day-0 paywalls 0 → 20%, 1 → 13%, ≥ 2 → 14% back on day 2; diagnosis and sign-in provider: no difference) [SOURCE: validation/V2-returners.md §3.3, §5.2].
**What does separate them (V2, completers 08-14→11-04, not causal):** **starting a ride on day 0** — 31 of 88 who started one came back on day 2 (35%) vs 27 of 279 who did
not (10%), adjusted OR **4.5** [2.4, 8.5]; 14 of the 31 started another ride on day 2, only 2 came back via a reminder. **≥ 3 sessions on day 0** (25/55 = 45% vs 11%, OR 4.0).
Goal `track_rides` works mostly *through* riding (OR 2.4 → 1.4 once day-0 ride start is in the model) but splits S1 sharply (24% vs 8%). Day-0 logging separates only for
rides (11/13) and weakly expenses (7/23); **maintenance logging does not** (3/22). **Push grant is only a weak trait** (OR 1.7, CI includes 1 after adjustment, nothing on
days 7–13), not the effect of any message: in week 1, 1 of 426 new users got a server push [SOURCE: V2 §4, §5, V2-s2].
So P1/P2 are **hygiene and trust fixes judged mechanically** (T27 is the one P2 task aimed at the strongest predictor), and the
levers for return remain Experiment 1 and Experiment 2. Nobody should promise a day-2 lift from the friction fixes.

### 1.2 Success metrics (each is a dashboard insight in T03, broken down by `{REL}`)

| # | Metric | Definition | Baseline [source] | Target | Read as |
|---|---|---|---|---|---|
| S1 | **Week-1 core action among completers** | completers with `ride_completed` (`below_min_ride` not true), `expense_added`, `maintenance_task_created` or `_completed` within 7 d **of their first `onboarding_completed`** (the tile and the Exp 1 primary are anchored on completion, not on first seen; V1 item 15) | **completion-anchored (canonical):** trailing first completions in [−67 d, −7 d): all **37/275 (13.5%)**, 3.26.0 **8/84 (9.5%)** [SOURCE: V1-q7; Q-P5]. First-seen cohort 08-14→11-04 (reference only): 61/367 (16.6%) [SOURCE: evidence pack §2; V1-q8]; Oct 16/127 (12.6%) [SOURCE: board/99 §4]. **Strata:** goal `track_rides` 47/197 (24%) vs other goals 14/170 (8%) — 77% of S1 events come from `track_rides` [SOURCE: V2-q5] | Exp 1: an **absolute lift** in test vs control (pre-registered, stratified; see FS-EXP1) — ×2 is not a plausible target in the `track_rides` stratum (24% → 48%); fix releases: no harm | Exp 1 primary (randomized, stratified by goal × platform); else harm check |
| S2 | **Onboarding completion** | first-seen persons (or starters) with `onboarding_completed` | **367/793 (46%)** of first-seen [SOURCE: evidence pack §2]; of starters 3.26.0 **90/153 (59%)** [SOURCE: Q-P6] | ≥ 50% of first-seen / ≥ 63% of starters on the first binary with P1+P2 onboarding fixes, 8-week read [UNBACKED — own target: +4 pts ≈ removing half of the confirmed OB1/OB3/OB6 loss] | harm check + mechanical sub-metrics FS-OB* |
| S3 | **Day-2 engaged return** (F14, canonical) [review item 17] | day-2 return (calendar day after first seen, UTC) **and** that day a core action or a `$screen` not on the F14 allow-list (home, What's New, onboarding/auth) — SQL board/06 Appendix B; route list = constant from T05d | **completers 37/367 (10.1%)**, all installs 39/793 [SOURCE: board/06-experimentation-analyst.md F14]; raw return kept as S3-raw: 72/793, completers 58/367, 3.26.0 starters 17/153 [SOURCE: evidence pack §2; Q-P6] | no harm; Exp 1 secondary (engaged only, the test arm sends notifications) | harm check only (weekly spread 3–12%); S3-raw only outside the Exp 1 read. **Per-release reads use the rider's 24–48 h window as the primary form** (the UTC calendar day is biased by install hour: 00–05 UTC installs 7% vs 18%, and only 42 of 72 day-2 returners came back 24–48 h after install) [SOURCE: V2 §5.3]; the calendar-day form stays the Exp 1 secondary (randomized). Never judge `maintain_bike` riders on S3: they return on days 7–13 (7/65, at baseline), not day 2 (3/72) [SOURCE: V2 §5.1 item 6]. Exclude or stratify `returning_account` riders (V2 §5.1 item 4) |
| S4 | **Day-0 service schedule** | (a) board: first bike created on sign-up day with ≥1 task within 1 day (DB, weekly DB check D2b), **reported in two columns: any source, and `source = 'oem'` only** — rider-created (`user`) tasks alone lifted the partial week 11-09 to 12/24 (9 bikes `user` vs 4 `oem`), so the any-source column can "recover" without T07; T07 is judged on the `oem` column and on (b) [SOURCE: V1-db3, V1 item 11]; (b) R2-M1: onboarding-created bikes with an OEM task ≤ 5 min (DB); PostHog tile = share of `onboarding_completed` with a bike that have a server `service_plan_imported` within 5 min (T07a) | (a) **25/111 (23%)** weeks 10-12→11-02, pre-drop 127/204 (62%) [SOURCE: board/99 Appendix A]; (b) **10/151 (7%)** [SOURCE: deep-dives/R2 R2-M1] | (a) **≥ 55%** 4 straight weeks; (b) ≥ 95% 2 straight weeks | mechanical (DB, consent-independent) |
| S5 | **First-hour multi-paywall** | completers with ≥ 2 paywall requests in −10 min…+60 min of `onboarding_completed` | **15%** (43/291 ≥ 2, any surface) [SOURCE: 05 PO3]; current build 3.26.0: ≥ 2 any 13/121 (10.7%), **≥ 2 post-onboarding 8/121 (6.6%)** [SOURCE: deep-dives/R3 Q5; reproduced 13/120 and 8/120, V1-q11]. "Post-onboarding" still includes rider taps until T05a/T21 add `trigger`; exclude `profile_subscriptions_row`/`profile_pro_banner` until then [SOURCE: V1 item 6] | ≥ 2 automatic post-onboarding ≤ 2% on the fix binary | mechanical |
| S6 | **Post-auth early-step regression** | 05's "viewed experience/bike_setup/welcome after sign-up/in" = **30% (22/73)** [SOURCE: 05 OB1-E] — **redefined** (R1 Q1: 12 of the 21 signed in *before* starting): starters who view an early step after a later one | redefined: **44/472 (9.3%)**, 3.26.0 **16/166 (9.6%)** [SOURCE: deep-dives/R6 R6-q8]; sign-in dead end 3.26.0 6 of 10 riders stuck [SOURCE: deep-dives/R1 Q12] | ≤ 3% per version [UNBACKED — own target, R6 F-OB1]; stuck sign-ins 0 | mechanical; SQL `deep-dives/R6-replays-returners.md:276-284` [review item 20] |

**Per-release success reading (owner requirement).** For every metric: (1) compare riders whose first event is on the fix level/version
with riders on the previous level/version **in the same calendar weeks** (staged store rollouts and riders who have not updated make both populations
co-exist), within one platform (iOS and Android differ ×1.6 on day-2 return [SOURCE: evidence pack §2]) — **n/a for iOS first-session cohorts**, because new App Store
installs always get the newest version; (2) then compare the fix level's first 4 and 8 weeks with the trailing 8 weeks before the release date (P06.3). **November–March
(doc review item 11):** riding season drives the trailing comparison, so a harm check in that window is judged against a concurrent comparison (Android staged-rollout cohort
before the Exp 1 slot; the Exp 1 control arm after it starts); a trailing-8-week drop alone is recorded "no verdict (season)" and never triggers a revert. A change smaller than the weekly spread (3–12 pts on
day-2 return) is "no change shown", not "no effect". Mechanical metrics (targets of 0 or a ceiling) are judged on counts.

### 1.3 Confidence (pre-review; revised in §8.1: A 75%, B 78%; after validation in §11.1: A 78%, B 75%)

**A — we know what needs to be done: 75%.**
- High-confidence root causes, confirmed in code and events: the onboarding schedule import never runs since the swipe deck was retired
  (90%) [SOURCE: deep-dives/R2 §3.1]; the diagnostics "Try Again" limit loop (90%) [SOURCE: R3 RC-1]; the onboarding sign-in dead end (85%)
  [SOURCE: R1 RC-A]; standstill rides saved as junk and the checklist ticking without a ride (80%) [SOURCE: R4 §3.2]; no paywall frequency cap (85%) [SOURCE: R3 RC-3];
  first-session fixes don't reach new installs via OTA (80%) [SOURCE: R3 RC-2]; PO5 is not a bug (92%) [SOURCE: R4 §3.1].
- Lower: OB2 Google sheet hang vs abandonment (60%), OB5 (40%), OB4 design vs latency (70%), RC-D Welcome remount (25%), PO12/PO13 (30–35%),
  PO14 (35%), the 3.26.0 diagnostics jump (cause unread) [SOURCE: R5 §3, R1 §3, R6 §3.2].
- **Validation 2026-11-12 (device repro on the store binary 3.28.0, V4):** RC-B Android back-walk **~90%** (reproduced: one screen per Back down to Welcome, Back on the root
  closes the app); RC-C resume **~85%** (reproduced: cold resume lands on the right screen but bike-setup loses make and query, goals shows "0 of 5 picked" on any remount,
  and a back-walk then forward overwrites the resume point); **RC-D 25% → ~80%** with a repeatable trigger (Back out of the onboarding root, then a warm launch while the
  process is cached: `resumeHandledThisLaunch` is already `true`, so Welcome shows with no resume). PO8: **42 of 43** Android first Discover visits background within 2 s
  (iOS 0/28, Garage control 1/59) — an OS dialog on Discover open is now likely (≈ 70%) [SOURCE: V1-q36]. RC-A and PO4 could not be reproduced without production writes
  (static code check only; unchanged at 85% / 80%).
- The biggest unknown is not *what to fix* but *whether fixing it moves return*: friction does not separate returners (60%) [SOURCE: R6 §3.1].
- Raises A: T04/T05 events for 2–4 weeks (splits OB2/OB5/RC-B…F), T06 research answers, and the Experiment 1 randomized read.

**B — the plan is well defined: 70%.**
- Every task has files with path:line, a test, a production query and a release path; owner decisions are explicit (§1.4).
- Lowers it: 15 owner decisions gate about 20 tasks; most HogQL is *(draft)* until T02 runs it; several Maestro selectors/testIDs must be
  created first and checked with `inspect_screen`; Maestro cannot cover OAuth success, OS notification delivery or iOS airplane mode
  (jest covers those); sizes are estimates; the Experiment 1 timeline needs two store releases before 2027-01-06.
- Raises B: owner answers to §1.4; T02 baselines re-run; one Maestro dry run of `onboarding.yaml` on a T00 E2E build (no `preview` build exists, V4).

### 1.4 Owner decisions needed (numbered; tasks cite them as D#)

1. **D1 Both-arm onboarding fixes during the paywall A/B.** T11, T12, T13, T14, T19, T20, T25 change navigation, persistence, the account
   screen's busy/cancel/wait behaviour and the bike search, identically in both `onboarding_paywall_2026q4` arms, without touching the
   paywall. The board rule says "no change to onboarding screens" [SOURCE: board/99 "What we decided not to do"]. Approve as bug fixes, with
   dates logged in the ledger? (Recommended: yes for T11–T14, T19, T20; T25 changes screen content — yes or wait.)
2. **D2 PostHog writes:** create the dashboard + insights (T03), an annotation per release, two alerts (T03), the feature flag
   `activation_365_first_session` (T35). Who creates them (owner, or an agent with explicit go-ahead per write)?
3. **D3 Standstill ride below both floors, ended from the guard:** discard in both arms now (recommended) or only in Exp 1's test arm (T09)?
   And: discard the 2/60 d auto-ended sub-floor rides too?
4. **D4 Checklist "first ride" row:** new label "Record your first ride" → Start Ride, or keep the rides list (T10)?
5. **D5 Paywall frequency cap:** 1 automatic paywall per feature per session, 2 per session, 10-min cooldown after an error; explicit
   Upgrade surfaces (`profile_subscriptions_row`, `profile_pro_banner`) exempt (T21). And: a free rider tapping Add bike sees "Update my bike"
   first, lowering direct `unlimited_bikes` impressions (≈7 riders/month, 0 purchases from them on ≥ 3.26) (T22).
6. **D6 Diagnostics copy and timeouts:** limit panel + exhausted CTA copy (T08, T24); 75 s client deadline vs fewer server retries (T17).
7. **D7 Backfill** the ~250 existing onboarding bikes without tasks (T39), and confirm the reminder scheduler cap before T07 creates ~10
   dated tasks per new bike (T06 answers the cap question).
8. **D8 Rider-edited OEM tasks survive a model change** (T23); a migration only if no "edited" signal exists (owner applies migrations).
9. **D9 Android Back on experience/Welcome:** leave silently (recommended) or "Leave setup? Your answers are saved" dialog (T19).
10. **D10 Keep the rider's email on the device** until onboarding ends (never the password) to restore the code step (T13).
11. **D11 Landing-sheet priority** in the first session (recall, OEM-imported, check-in, What's New) (T16).
12. **D12 Start Ride first-open change** (T27) and **Discover location ask** (T29): both arms before the slot (recommended) or inside/after Exp 1.
13. **D13 Experiment 1 ledger** (board decisions 1–5): the bundle holds the slot; primary S1; N = 64 Miller + one cap z-test; cap 2027-03-31;
    no start after 2027-01-06; keep-after-no-winner rule (lower bound > −3 pts); `maintain_bike` d1 copy; first chip "Later today" (decided, §9);
    notification kind `activation` with `source`. Sign or amend (T35).
14. **D14 Release train:** store builds 3.29.0 (Release A, target submit 2026-11-30) and 3.30.0 (Release B, target submit 2026-12-08), both
    platforms, plus promotion of Android vc99 (FCM) to production (T18, T35). *(Validation, V3:)* vc98 is in Play production; vc99 is a draft on internal named "3.26.0" —
    rename to "3.28.0 (99)", roll to internal, verify a push token registers, promote with owner go-ahead; if not promoted before the 3.29.0 cut, FCM ships in 3.29.0 (T18).
15. **D15 Credential Manager licence/dependency** for Android Google sign-in, only if T04 data shows ≥ 10% hung sheets (T36).
16. ~~Is mobile session replay on?~~ **Answered:** 124 of 127 completers in 28 d have a recording [SOURCE: 05 Method].

---

## 2. Phases (chronological) and dependency graph — revised after review

| Phase | Window (target) | Tasks (issue order in §3A.1) | Ships as |
|---|---|---|---|
| **P0 Measurement first** | 11-13 → 11-21 | **T00 (test environment, first)**, T01, T02, T03a, T03b, T04a–c, T05a–e, T06 | T01/T04/T05 (mobile JS, incl. T05c's guard-sheet render change and testIDs) → **store binary 3.29.0 (Release A, T18)** only (D17; TR0 removed); T05e: API deploy; T02/T03a docs; T03b PostHog (D2). Every client event and the release marker start at 3.29.0 go-live per platform; pre-fix comparisons use the R1/R5 proxy SQL |
| **P1 Bugs that block activation** | 11-17 → 11-30 | T07a, T07b, T08–T13b, T14, T15, T16a, T16b, T17, **T29 (moved up from P2 by the validation, V1 FS-PO8)**, release **T18** | T07a: API deploy (Render) **only after T02 baselines + T03a annotation** exist; mobile: **store binary 3.29.0 (Release A)**; no OTA of P1 fixes to any runtime (D14b, D17) |
| **P2 Friction removal** | 11-24 → 12-05 (Release B code freeze) | T19a, T19b, T20, T21, T23, T22, T24, T25a, T25b, T26–T28 (T29 only if it misses Release A: then it is the **first** P2 task merged for Release B) | T23, T25a: API deploy; mobile: **store binary 3.30.0 (Release B)** if merged by the **code freeze 2026-12-05**; anything that misses it goes into the **next store build** (D17); T27/T29 then ship after the slot (D12). **T19a and T20 ship in the same build** (V4: T19a alone reproduces RC-D on the next warm launch) |
| **P3 Experiment 1 build + launch** | 11-24 → 12-15 (hard stop 2027-01-06) | T30–T35 | T30's API field `activationExperimentWindow` deploys **before the 3.30.0 cut**; client embedded in Release B; the flag defaults to control **and** no draw happens until the API serves a start (T30); launch = start set server-side + PostHog flag flip, same day (T35, D16) |
| **P4 Follow-ups** | 12-15 → 2027-03-31+ | T14b, T15b, T36, T38, T39, T40 (T37, T41, T41b moved to the ledger, §10) | T14b/T15b/T36/T38: data gates count 4 weeks from 3.29.0 go-live per platform (pre-fix comparison: R1/R5 proxy SQL); fixes ship in the next store build; T40 after the slot |

**Why store binaries and not OTA alone:** `fallbackToCacheTimeout` is unset in `apps/mobile/app.config.ts` (Expo default 0), so an OTA runs only on the *next* launch, and a brand-new rider's
first session runs the JS embedded in the store binary [SOURCE: R3 C19–C21, Q13]. **And an OTA reaches only its own runtime:** `runtimeVersion.policy: 'appVersion'`
with `version: '3.28.0'` on main [SOURCE: apps/mobile/app.config.ts:37, :59-61; docs/runbooks/mobile-ota.md:173-176], so an OTA from `main` reaches only 3.28.0 binaries
(≈10 of ≈190 riders in 14 d) [review item 1]. Every first-session fix and
Experiment 1's assignment must therefore be **in the binary new riders install**.
*(Validation, V3:)* Play production moved to 3.28.0 vc98 on ~11-12, but 108 of 113 Android riders seen in 14 d still last ran binary 3.26.0 (b93) and iOS riders upgrade within days, so 82% of riders run 3.26.0 JS [SOURCE: V3 §2, §4; Q-P1 revised].
**Owner rule D17 (2026-11-12):** every new functionality — features, UI changes, the experiment, new events/instrumentation, testIDs — ships **only in a new store build**
(App Store + Play, bumped app version: 3.29.0, 3.30.0, then the next store build). OTA is used only for urgent crash or data-loss hotfixes per `docs/runbooks/mobile-ota.md`.
API deploys and owner-applied migrations are unaffected. The former per-runtime instrumentation OTA (TR0) is removed (§3A.0 rule 1, §9 D17).

```mermaid
graph TD
  T00[T00 test environment setup] --> T05c
  T00 -.-> MAE[every task whose acceptance needs Maestro: T07b, T08–T17, T19a–T22, T24–T29, T31, T32]
  T00 --> T18
  T00 --> T35
  T01[T01 release marker] --> T03b[T03b dashboard + alerts]
  T02[T02 ledger + baselines + DB check] --> T03a[T03a release procedure + status table]
  T02 --> T03b
  T03a --> T03b
  T01 --> T04a[T04a OAuth/auth events]
  T01 --> T04b[T04b onboarding nav/gate events]
  T01 --> T04c[T04c bike_setup_summary]
  T01 --> T05a[T05a paywall events]
  T01 --> T05b[T05b diagnostics events]
  T01 --> T05c[T05c ride guard + ride testIDs]
  T01 --> T05d[T05d landing/screen/edit/notif events]
  T02 --> T05e[T05e API server events]
  T03a --> T05e
  T06[T06 research batch]
  T02 & T03a --> T07a[T07a Exp2 schedule import API + reminder cap]
  T07a --> T07b[T07b client fields + service-plan flows]
  T05b --> T08[T08 diag limit loop]
  T05c --> T09[T09 junk ride not saved]
  T05d --> T10[T10 checklist first ride]
  T04a & T04b --> T11[T11 sign-in advances]
  T04a --> T12[T12 account hygiene]
  T04b --> T13a[T13a account/code draft + store v10]
  T13a --> T13b[T13b bike draft + resume]
  T04c --> T13b
  T04b --> T14[T14 local completion flag]
  T06 --> T14
  T04b --> T15[T15 no auth route after completion guard]
  T05d --> T16a[T16a Open my garage once]
  T05d --> T16b[T16b landing sheet queue]
  T08 --> T17[T17 diag errors/timeout]
  T07b & T08 & T09 & T10 & T11 & T12 & T13b & T14 & T15 & T16a & T16b & T17 --> T18[T18 Release A 3.29.0]
  T29 -.->|target: in Release A, else first in Release B| T18
  T01 & T04a & T04b & T04c & T05a & T05b & T05c & T05d --> T18
  T04b --> T19a[T19a Android Back]
  T04b --> T19b[T19b iOS back]
  T19a --> T20[T20 Welcome resume]
  T20 ==>|same build as T19a| T35
  T05a --> T21[T21 LimitSheet + cap]
  T07a --> T23[T23 schedule refresh on edit API + dedup fix]
  T21 & T23 & T05d --> T22[T22 bike-limit update sheet]
  T21 & T08 --> T24[T24 exhausted diag CTA]
  T04c --> T25a[T25a API model ordering]
  T25a --> T25b[T25b client bike search]
  T23 --> T26[T26 add-your-model row]
  T05c --> T27[T27 start ride first open]
  T05d --> T28[T28 home taps respond]
  T05d & T06 --> T29[T29 discover first open]
  T05d & T02 --> T30[T30 flag + assignment + start gate]
  T09 & T30 & T05c --> T31[T31 teaching sheet]
  T10 & T30 --> T32[T32 plan card + scheduler]
  T32 --> T33[T33 Android delivery check]
  T33 --> T34[T34 day-1 fallback]
  T02 & T05c & T05d & T09 & T10 & T18 & T30 & T31 & T32 & T33 & T34 --> T35[T35 Release B 3.30.0 + Exp1 launch]
  T19a & T19b & T20 & T21 & T22 & T24 & T25b & T26 & T27 & T28 -.-> NB[P2 tasks: in 3.30.0 if merged by the 2026-12-05 freeze, else the next store build, T19a and T20 together]
  NB -.-> T35
  T18 --> T14b[T14b cached-me rule, conditional]
  T18 & T06 --> T15b[T15b sign-in after completion, conditional]
  T18 --> T36[T36 Credential Manager decision]
  T18 --> T38[T38 same-user session drop, conditional]
  T07a --> T39[T39 backfill, owner-run, after the T07a reminder cap is live]
  T35 --> T40[T40 Exp1 readout]
  T40 -.-> FU[ledger follow-up: default week-1 message for everyone]
```

**Release B code freeze and throughput (doc review item 5).** Code freeze for Release B: **2026-12-05** (submit target 2026-12-08, D14). T35's hard dependencies are only the
Exp 1 minimum set (T02, T05c, T05d, T09, T10, T18, T30, T31, T32, T33, T34); P2 tasks are soft (dotted edges). P2 tasks not merged by the freeze go into the next store build
(D17). The dates need about **2 merged PRs per day** from 11-13 to 12-05 (≈ 45 implementation tasks in ≈ 23 days), so agents work in
parallel on independent tasks.

Edges added after review (item 13): T02/T03a/T06 → T07a; T07a → T23 → T22; T08 → T24 (T08 ships its own in-form limit panel; T24 later routes the
exhausted CTA to T21's `LimitSheet`, which reuses T08's copy keys — so no T21 → T08 edge is needed). The T06 item 6 → T23 and T06 item 7 → T07a edges were removed in the 2026-11-12 doc review: item 6 is settled by D8, item 7 by the T07a reminder cap.

---
## 3. Tasks

Template per task: **Type · Size · Depends · Blocks · Friction specs · Release path · Constraints**, then Why / What / How (files,
approach, tests) / Acceptance / Verification / Out of scope / Risks. Sizes: S ≤ 1 day, M 2–4 days, L > 4 days.
Every task's PR body lists its task id and friction spec ids, the check location and run log (§5A.1), and the testIDs it adds (§3A.4). It does **not**
bump `ACTIVATION_FIX_LEVEL`: only the release cut does (§3A.0 rule 2), which also adds the Release log row (§6) and the status (§6.1).

### P0 — Measurement first

#### T01 — Release marker: `activation_fix_level`, `ota_update_id` and friends on every event
- **Type** instrumentation · **Size** S · **Depends** — · **Blocks** T03, T04, T05 and every metric's per-release read · **Specs** FS-M ·
  **Release** Release A store build 3.29.0 (T18) only (D17) · **Constraints** no PII.
- **Why.** OTAs keep `$app_version`/`$app_build` (Android has run binary 3.26.0 b93 through every November OTA) [SOURCE: R5 Q18; Q-P1]; no event carries
  the update id (0% today) [SOURCE: Q-P4; R1 C14; R6 §2.4]; first sessions run embedded JS [SOURCE: R3 RC-2]. Without this no fix can be read per release.
  Five deep dives proposed five names; this task fixes one set (§0).
- **What.** Super properties on every event: `activation_fix_level` (integer constant), `ota_update_id` (`Updates.updateId ?? 'embedded'`),
  `ota_channel` (`Updates.channel`), `is_embedded_launch` (`Updates.isEmbeddedLaunch`), `runtime_version` (`Updates.runtimeVersion`), and
  `platform` (`process.env.EXPO_OS`) registered at client init so early onboarding events stop having `platform = null` [SOURCE: R5 6b].
- **How.**
  - New `config/activation.ts`: `export const ACTIVATION_FIX_LEVEL = 0 as const;` (0 = pre-release JS, dev/preview builds only; the Release A cut sets 2, level 1 is not used, §3A.0 rule 2) with a header comment: "bump by 1 in every PR that ships
    a #365 friction fix" → **superseded** (review item 3): bump only at a release cut; see §3A.
  - `lib/analytics.ts`: build the marker object once (`buildReleaseMarker()` reading `expo-updates`), register it right after the PostHog client
    is created (`lib/analytics.ts:55`) **and** again on consent grant, because `registerSuperProperties` (`lib/analytics.ts:490`) no-ops while
    analytics is off (comment at `lib/analytics.ts:388`).
  - `hooks/use-analytics-super-properties.ts:64-71`: include the marker in `buildSuperProperties` so the keyed re-register keeps it.
  - Jest `lib/__tests__/analytics-release-marker.test.ts` (mock `expo-updates`): embedded launch → `ota_update_id: 'embedded'`,
    `is_embedded_launch: true`; OTA launch → the id; level equals the exported constant; registered at init and on consent.
- **Acceptance.** Jest passes; `pnpm verify:mobile` green; on a T00 E2E build with a consenting test account, Live events show all six properties; **`platform` is non-null on 100% of `Application Opened`, including the install/first open** (today null on 29% of opens, always the first; `$os` is never set) [SOURCE: V1 §3.1].
- **Verification (prod).** FS-M (redefined, §5A): opens with `$app_version = 3.29.0` carry the expected level (100%); for a crash/data-loss hotfix OTA, the §5A.2 share.
- **Out of scope.** Any CI guard that forces a level bump (optional idea in R4 F-R4-7; not required).
- **Risks.** Riders on binaries older than 3.29.0 never carry the marker → read `activation_fix_level IS NULL` as "pre-marker JS" (pre-3.29.0 binaries).

#### T02 — Ledger, canonical definitions, baseline re-run and scoreboard SQL (docs only)
- **Type** research/docs · **Size** S · **Depends** — (re-run part after T01 ships for the `lvl` column) · **Blocks** T03, T30, T35 · **Specs** all ·
  **Release** repo docs commit · **Constraints** read-only queries; no PostHog writes.
- **Why.** `experiments.md` does not exist [SOURCE: board/review-verdicts.md P06.1]; most metrics in §5 are drafts; OB1-E's 22/73 headline
  counts auth-first riders [SOURCE: R1 Q1, T8].
- **Validation inputs (2026-11-12):** take the corrected SQL and baselines from `validation/V1-metrics.md` §1 and §3 (`{REL}` platform fallback, FS-OB1b/c, FS-OB5, FS-OB2b,
  the per-completer FS-PO6/11/12/13/14 query, FS-PO8, FS-PO3 filter, DB snippets) instead of re-deriving the drafts; record the 13-person `{EXCL}` plus the internal tester and
  the V4 emulator person (§0).
- **What.** Create `docs/research/activation-365/experiments.md` with: canonical definitions (S1–S6, engaged return per board/06 F14,
  canonical too-short trigger), the Experiment 1 ledger text for D13, the strata, the reading rule (§0), and a "both-arm changes" log
  (date, task, release) used to cut the onboarding A/B and Exp 1 readouts. Create `docs/research/activation-365/queries/fs/<spec-id>.sql`,
  one file per §5 metric, each run once read-only with the result and date pasted as a comment; fix any draft that fails.
- **How.** PostHog `execute-sql` (read-only) and the Supabase Management API SELECT recipe from the task brief; record each query and result.
- **Acceptance.** Every §5 spec has a `.sql` file with a dated baseline; S1–S6 re-run on the trailing 8 weeks by version; ledger lists D13 items.
- **Verification.** Files exist; numbers within the binomial noise of the cited baselines, or the difference is explained in the file.
- **Out of scope.** Creating PostHog insights (T03).

#### T03 — PostHog dashboard "#365 Activation & frictions", alerts and the release-marking procedure
- **Type** instrumentation (PostHog writes by the implementing agent from the named list, **D2**) · **Size** S · **Depends** T01, T02 (T04/T05 for insights on new events —
  add those tiles when the events land) · **Blocks** "done" of every bug/enhancement task · **Specs** all · **Release** PostHog + runbook docs.
- **Why.** Owner requirement: watch each fix release's effect; no such dashboard exists [SOURCE: Q-P3].
- **What.**
  1. Dashboard **"#365 Activation & frictions"** on project 155556. One SQL insight per success metric S1–S6 and per friction metric in §5,
     each named `<spec id> — <short name>`, each broken down by `ver`, `lvl` and `plat` (`{REL}`), each with its description field holding:
     definition, baseline + source + date, target, and "mechanical" or "harm check". Use the `.sql` files from T02 verbatim.
  2. Two alerts: FS-PO5 `hud_without_any_start > 0` weekly; FS-M binary rule — any open with the new `$app_version` whose `activation_fix_level` is not the expected level,
     checked 3 days after go-live (target 100%, alert on any mismatch).
     Plus an Android push-token tile (rows with `platform='android'` in `device_push_tokens` per week, from the DB check in T06) so P04.2 (PR #393) is visible.
  3. **Release-marking procedure**, written into `docs/runbooks/mobile-release.md` (after the OTA/E2E section around line 56) and
     `docs/runbooks/mobile-ota.md`: on the day a binary reaches production (per platform), a crash/data-loss hotfix OTA is published (D17), or an API fix deploys on Render,
     create a PostHog annotation `#365 fixes: <version|hotfix OTA id|api> lvl <N> — <task ids>` dated the go-live day, then add a row to §6 Release log here
     (version, date, platform, tasks, annotation id). Every 2, 4 and 8 weeks after each release, read the dashboard by `lvl` vs the previous `lvl`
     in the same calendar weeks, per platform, and record the read in `experiments.md`.
- **How.** `exec search dashboard-create`, `insight-create`, `annotation`, `alert` tools; the implementing agent makes each write from the named per-release list and records its id in §6 (D2).
- **Acceptance.** Dashboard URL recorded in `experiments.md`; every §5 spec id has a tile (tiles for not-yet-existing events show "no data" until T04/T05 ship); runbook lines merged.
- **Verification.** `SELECT id, name FROM system.dashboards WHERE name = '#365 Activation & frictions'` returns one row; annotation list shows the first entry.
- **Risks.** Tile sprawl (≈ 40 tiles): order tiles as §5 and keep S1–S6 at the top.

#### T04 — Instrumentation A: auth and onboarding navigation
- **Type** instrumentation · **Size** M · **Depends** T01 · **Blocks** T11–T15, T19, T20, T25, T36, T38 metrics · **Specs** FS-OB1a–f, FS-OB2a–c,
  FS-OB3, FS-OB4, FS-OB5 · **Release** Release A · **Constraints** events only, no UI change, no email/free text in properties.
- **Why.** OAuth attempts, cancels, errors and durations are invisible (no event on tap/cancel/error; `sign_in_oauth_clicked` is web-only)
  [SOURCE: hooks/use-oauth-sign-in.ts:28-38; R5 Q1–Q3]; RC-B…RC-F cannot be separated [SOURCE: R1 §2.2 Q4, Q9]; bike search has no timing [SOURCE: R5 Q16].
- **What (exact names; add to `AnalyticsEvent` in `lib/analytics.ts` and to `packages/analytics/src/events.ts`):**
  | Event | Properties | Fire location |
  |---|---|---|
  | `auth_oauth_started` | `provider: 'google'\|'apple'`, `surface: 'onboarding_account'\|'onboarding_sign_in'\|'login'\|'register'` | `hooks/use-oauth-sign-in.ts` before calling the provider (hook gains a `surface` arg) |
  | `auth_oauth_result` | `provider`, `surface`, `outcome: 'success'\|'cancelled'\|'in_progress'\|'no_play_services'\|'cannot_present'\|'error'`, `stage: 'sheet'\|'token_exchange'`, `duration_ms`, `is_new_user`, `error_code` (code only, no message) | same hook, `finally`; timing marks from `lib/oauth.ts:121-182` |
  | `auth_email_submitted` | `surface`, `mode: 'signup'\|'signin'` | `app/(onboarding)/account.tsx` and `app/(onboarding)/sign-in.tsx` email handlers |
  | `auth_post_signin_wait` | `wait_ms`, `outcome: 'advanced'\|'already_onboarded'\|'me_error'\|'timeout'` | `app/(onboarding)/account.tsx:125-148` advance effect |
  | `onboarding_resumed` (extend) | add `resumed_from_screen` (persisted `lastViewedScreen`), `away_s`, `cold_start: true`, `pending_code_step: 0\|1`, `had_session: 0\|1` | `app/(onboarding)/index.tsx:82-96`; persist `lastViewedScreen`/`lastViewedAt` on every step view in `stores/onboarding.store.ts` |
  | `onboarding_back` | `from`, `to`, `trigger: 'hardware'\|'gesture'\|'button'`, `ms_on_screen` | `hooks/use-onboarding-flow.ts` |
  | `onboarding_welcome_mounted` | `reason: 'initial'\|'back'\|'remount'`, `had_progress` | `app/(onboarding)/index.tsx:47-57` |
  | `gate_routed` | `group`, `onboarding_completed_source: 'local'\|'me_cache'\|'me_network'\|'none'`, `me_age_s` (once per cold start) | `app/_layout.tsx:453-467` NavigationGate |
  | `auth_session_lost` | `during_onboarding`, `last_step` | null-session branch `app/_layout.tsx:579-711` before `resetForSignOut()` (`:698`) |
  | `bike_setup_summary` | `outcome: 'completed'\|'skipped'\|'back'\|'left'`, `duration_ms`, `make_queries`, `model_queries`, `make_picked_via`, `model_picked_via: 'list'\|'search'\|'custom'\|'none'`, `model_list_size`, `model_fetch_ms`, `year_changed` | `app/(onboarding)/bike-setup.tsx` on leave; counters in `components/onboarding/bike-setup/make-grid.tsx`, `model-picker.tsx` |
  Also: `surface` on `user_signed_up`/`user_signed_in`.
- **How.** Jest per event under `src/__tests__/` / `lib/__tests__/` asserting one fire per action with typed properties; document in `docs/onboarding-ab-event-schema.md`.
- **Acceptance.** Jest passes; `pnpm verify:mobile`; after 3.29.0 go-live, `read-data-schema` lists each event within 48 h.
- **Verification.** `SELECT event, count() FROM events WHERE timestamp > now() - INTERVAL 7 DAY AND event IN ('auth_oauth_started','auth_oauth_result','onboarding_back','onboarding_welcome_mounted','gate_routed','auth_session_lost','bike_setup_summary') GROUP BY event` → all non-zero within 7 days (except `auth_session_lost`, which may be rare).
- **Risks.** `Application Backgrounded` on Android account step = Google sheet open for 80/81 sign-ups [SOURCE: R5 Q10] — never use it as "left the app".

#### T05 — Instrumentation B: post-onboarding events and test hooks
- **Type** instrumentation · **Size** M · **Depends** T01 · **Blocks** T08–T10, T16, T21–T24, T27–T32 · **Specs** FS-PO2a–d, FS-PO3, FS-PO4a/b,
  FS-PO5, FS-PO6, FS-PO7, FS-PO10, FS-PO14, FS-PO17, FS-R2-3, FS-PO1 · **Release** Release A.
- **Why.** `diagnostic_started` re-fires on every focus (51 started vs 47 submitted) [SOURCE: R3 C13, Q9]; paywall events can't tell automatic
  from rider-tapped [SOURCE: R3 F-R3-6]; ride guard lacks `gps_fix`/`max_speed_kmh` [SOURCE: ride-hud.tsx:213-228; board/99 instr. 3]; no
  first-landing event [SOURCE: evidence pack §9]; bike edits untracked [SOURCE: R2 C14]; no testIDs on Start Ride/HUD/checklist and the guard sheet is not in the a11y tree [SOURCE: R4 §2.3].
- **What.**
  - Paywall: `trigger: 'auto'|'rider_tap'`, `gate_policy` (`'none'` now, `'capped_v1'` after T21), `session_paywall_index`,
    `minutes_since_onboarding_completed` on `paywall_present_requested/viewed/result` (`lib/subscription.ts:133-149`); new events
    `paywall_suppressed {feature, surface, reason}` and `limit_sheet_viewed {feature, surface}` (constants only; fired by T21).
  - Diagnostics: move `diagnostic_started` out of `useFocusEffect` (`app/(tabs)/(diagnose)/new.tsx:70-79`) into `components/diagnosis/use-start-diagnosis.ts:6-13`
    and `use-diagnostic-entry-gate.ts:22-46` with `entry: 'list'|'detail'|'quick_action'`; `diagnostic_failed` gains `reason`, `elapsed_s`.
  - Ride: `ride_too_short_shown` gains `gps_fix` (new `hadFixRef` set when any point is buffered, `ride-hud.tsx:93,140-151`), `max_speed_kmh`,
    `has_real_ride`, `variant: 'default'` (T31 adds `'teaching'`).
  - `post_onboarding_landed {screen, onboarding_variant, ms_since_cta, overlay}` on first focus of a `(tabs)` route after completion
    (`hooks/use-screen-tracking.ts` + a once-flag).
  - `screen_load_timed {screen: 'discover', ms_to_content, outcome}` (Discover only; doc review item 13).
  - `garage_bike_edited {changed_fields, from_capture_level, source, schedule_refreshed_count}` (`app/(tabs)/(garage)/edit-bike.tsx:195-305`);
    `oem_schedule_imported` gains `context: 'bike_hub'` (`components/bike-hub/shell/use-bike-actions.ts:52-97`).
  - testIDs: `tab-ride-fab` (`app/(tabs)/_layout.tsx:137`), `start-ride-screen`, `start-ride-button` (`app/(modals)/start-ride.tsx`), `ride-hud-root`,
    `ride-guard-sheet`, `ride-guard-keep`, `ride-guard-end-anyway`, `ride-guard-variant-default` (`app/(modals)/ride-hud.tsx:332-436`; render the sheet
    content so its buttons are in the a11y tree — verify with `inspect_screen`), `checklist-row-<id>` (`components/home/onboarding-checklist.tsx:153-182`),
    `home-screen`, `tab-discover`, `garage-add-bike-header`, `service-task-card-<n>`, `segment-service`.
- **How.** Jest: `lib/__tests__/subscription.test.ts` (extend), `components/diagnosis/__tests__/use-start-diagnosis.test.tsx`, event-shape tests.
  Switch `apps/mobile/.maestro/flows/log-ride.yaml` from point taps (`:14-19, 56-71`) to the new ids.
- **Acceptance.** Jest; `inspect_screen` on iOS sim + Android emulator lists every id incl. guard buttons; `log-ride.yaml` passes using ids.
- **Verification.** FS-PO2 started/submitted ratio ≈ 1.0 on the new level; `trigger` present on 100% of paywall events on the new level.

#### T06 — Research batch (no code): open questions that gate P1/P2
- **Type** research · **Size** S · **Depends** — · **Blocks** T14, T15b, T29 · **Release** findings appended to `experiments.md`.
- **Items** (each: query/read, result, date):
  1. ~~FS-PO12 and FS-PO13 baselines~~ **Measured by the validation (V1-q40):** FS-PO12 11/292 (3.26.0 5/120), FS-PO13 7/292 (3.26.0 5/120). Item 1 is now: confirm 3–5 of these riders with replays [SOURCE: R6 T2; V1 item 4].
  2. Cause of the 3.26.0 diagnostics jump (hour-1 diagnosis 29/117 = 25% vs 3–9% before): read the 3.26.0 diff for new entry points (Home tools
     icon, onboarding symptom step, quick action `app/_layout.tsx:925-928`) and a `$screen` path count by version; name the entry point with path:line [SOURCE: R6 T3, R6-q3].
  3. Which commit each 3.26.0 store binary was built from (EAS build list) — confirms RC-2 [SOURCE: R3 OQ1].
  4. Whether submit `FORBIDDEN` is ever the daily `checkBudget` or circuit breaker, not the monthly limit (`apps/api/src/modules/ai-budget/ai-budget.service.ts:62-66, 320-373`) [SOURCE: R3 OQ3].
  5. Is `complete_onboarding` idempotent (second call → second bike?) — read `supabase/migrations/00191_complete_onboarding_make_only_bike.sql:84-117` and its 00194 re-apply [SOURCE: R1 OQ6].
  6. Is there a column that marks an OEM task as edited by the rider (`maintenance_tasks`)? [SOURCE: R2 OQ4]. **Answered:** no column (C-2); D8 proxy used; no longer gates T23.
  7. Does the maintenance reminder scheduler cap first notifications when ~10 dated tasks appear at once? [SOURCE: R2 OQ5, R2 §7]. **Answered (doc review 2026-11-12):**
     no immediate burst, because imported due dates are in the future; but tasks with the same interval fall due on the same day at interval anniversaries. `sendDuePush`
     sends one push per task today; the per-bike cap is built in T07a (D7).
  8. Watch replay `01a19f85` at 03:54:55–03:55:01 (PO8) and `01a1815d` 07:19:20–40 / `01a18bae` 07:24:50–07:25:06 (PO5) [SOURCE: R4 §3.1, §3.3]. **And confirm the PO8 dialog type on a device** (T00 Android emulator with a universal APK of the store binary, fresh install, Spanish locale, finish onboarding, open Discover; screenshot whatever appears within 2 s: location permission vs another OS/Play-services prompt). 42 of 43 Android first Discover visits background within 2 s [SOURCE: V1-q36]; the answer decides T29's exact fix.
  9. Android push tokens after vc99 reaches production: `select platform, count(*) from device_push_tokens where created_at > now() - interval '7 days' group by 1` (DB, read-only) [SOURCE: push-tokens-investigation.md "Verify"]. **Baseline is not 0: android 3 tokens (all 7 d, test devices on FCM-capable builds)**, ios 106 total / 8 in 7 d [SOURCE: V3 §2].
  10. Week-1 engaged-return (F14) re-run of R6-q2 on the 100 scanned riders [SOURCE: R6 §3.1].
- **Acceptance.** Every item answered or marked "could not answer: <why>". **Out of scope.** New Replay Vision scans (cost credits; owner approval).

### P1 — Bugs that block activation

#### T07 — Experiment 2: import the service schedule when onboarding creates the bike (API)
- **Type** bug · **Size** S · **Depends** — (the D7 reminder cap below ships in the same deploy) · **Blocks** T23, T26, T39 · **Specs** FS-PO1H (Exp 2), FS-R2-4 ·
  **Release** API deploy on Render (reaches every app version at once) + annotation · **Constraints** both Exp 1 arms equally (allowed during the slot,
  log the date); tier label kept on make-generic tasks; logging stays free.
- **Why.** `completeOnboarding` imports OEM tasks only for `acceptedOemScheduleIds` (`apps/api/src/modules/users/users.service.ts:235-264`), filled only by the
  swipe deck that is in no flow since 2026-08-24 (`app/(onboarding)/maintenance.tsx:1-12`, `config/onboarding.ts:111-121`) and sent only when non-empty
  (`app/(onboarding)/personalizing.tsx:282`). The old 62% came from riders adding the bike in the garage (auto-import, `apps/api/src/modules/motorcycles/motorcycles.resolver.ts:88-114`)
  after the RPC dropped make-only bikes; migration 00191 (2026-10-15) kept those bikes and closed that route. Onboarding bikes with OEM tasks ≤ 5 min: 10/151 (7%).
  Root cause confidence 90% [SOURCE: deep-dives/R2 §3.1, R2-DB1–DB4, R2-M1].
- **What.** When `input.bikeMake` is set, import the full waterfall (no id filter) for the bike the RPC created, in the rider's unit; keep the id-filter
  branch for the intent cohort; never fail onboarding on import errors. Add server event `service_plan_imported {tier, task_count, source:'onboarding'}`
  (server-side capture with the consent rule of §3A.0 rule 6: user id only with a stored "yes"; otherwise a constant `distinct_id` + `NO_CONSENT_PROPERTIES`; jest: decision
  `false` or missing → no user id in the payload), and return `servicePlanTaskCount`/`servicePlanTier` as
  new nullable fields on the `completeOnboarding` result so the client can put them on `onboarding_completed` (non-breaking for old clients).
- **How.**
  - `apps/api/src/modules/users/users.service.ts:235-264`: use the RPC's returned `motorcycle_id` instead of "latest bike"; call
    `oemSchedulesService.autoPopulateForBike(...)` with `acceptedIds = undefined`.
  - `apps/api/src/modules/oem-schedules/oem-schedules.service.ts:178-273`: add optional `measurementSystem` param overriding the `users.measurement_system`
    read (`:207-216, 233-238`), because `personalizing.tsx:187-205, 299-326` writes the unit **after** `completeOnboarding` [SOURCE: R2 C12]. Pass it from `input.bikeMileageUnit`.
  - Jest `apps/api/src/modules/users/users.service.spec.ts`: bike + no accepted ids → one unfiltered call; `bikeMileageUnit:'mi'` → imperial conversion;
    no bike → no call; import throws → onboarding still succeeds; called twice → no duplicate tasks (dedup by `oem_schedule_id`, `oem-schedules.service.ts:178-273`).
  - `pnpm generate` if the GraphQL result type changes; client reads the new fields in `personalizing.tsx` (`trackOnboardingCompleted`) — ships with Release A.
  - Maestro `onboarding-service-plan.yaml` and `onboarding-make-only-service-plan.yaml` (FS-PO1H) + `MAKE_ONLY` branch in `_shared/onboarding-to-account.yaml`;
    fix the stale comment at `_shared/onboarding-to-account.yaml:85-87` [SOURCE: R2 C15, T6].
  - **D7 reminder cap (doc review item 2; must ship before or with the T07a deploy).** In `apps/api/src/modules/push-tokens/maintenance-push.service.ts` `sendDuePush` (`:61`):
    group due tasks by `motorcycle_id`, send at most **one combined push per bike** naming the count ("3 services due on your MT-09"), and skip a bike that had a maintenance
    push in the last 7 days. `maintenance_push_log` has `user_id, task_id, due_date, sent_at` and no bike column (`supabase/migrations/00161_maintenance_push_log.sql:6-13`),
    so the 7-day check joins `task_id` → `maintenance_tasks.motorcycle_id` (or adds a column in an owner-applied migration). Imported or backfilled tasks create no
    immediate reminder. Jest (`maintenance-push.service.spec.ts`): 3 tasks due the same day on one bike → 1 push; a second due task on that bike within 7 days → skipped.
    Client side (T07b): overdue items show as "due now"; Home and the Service segment show at most the 3 most urgent with "+N more".
- **Acceptance.** Spec cases pass (incl. the reminder-cap cases); `pnpm verify:api`; both Maestro flows pass on a T00 E2E build against the deployed API (T07b runs them).
- **Verification.** S4(b) ≥ 95% for 2 weeks after deploy; S4(a) ≥ 55% for 4 straight weeks; FS-R2-4 100%; harm check on S1/S3 vs trailing 8 weeks read next to the Exp 1 control trend.
- **Out of scope.** Home plate "Set up service plan" (board rank 11, after the slot); backfill (T39); seeding new model rows (MT-07) — tracked in T39's note.
- **Risks.** ~10 dated tasks per new bike: no immediate burst (imported due dates are in the future), but tasks cluster on the same day at interval anniversaries
  — handled by the D7 cap above (T06 item 7 answer); make-generic intervals differ from model ones (keep tier label).

#### T08 — Diagnostics: stop the "Try Again" limit loop
- **Type** bug · **Size** S · **Depends** T05 · **Blocks** T17, T24 · **Specs** FS-PO2a · **Release** Release A · **Constraints** AI not promoted; copy D6; light/dark.
- **Why.** After `FORBIDDEN`, `new.tsx` calls `requirePro('full_ai_diagnostics')` and sets `submitError` to the raw English server text
  (`app/(tabs)/(diagnose)/new.tsx:220-228`); the review step shows an enabled "Try Again" (`components/diagnostic-flow/step-review-submit.tsx:145, 414-454`); every tap re-submits,
  hits the limit and presents the paywall again. 3 of 5 limit riders on 3.26.0 looped 2–3× within seconds [SOURCE: R3 RC-1, Q2, Q3]. Confidence 90%.
- **What.** On `FORBIDDEN`: set typed `limitReached` state (not `submitError`); render a localized limit panel ("This month's free diagnosis is used. It's back on {date}.",
  date from `useDiagnosticQuota().resetDate`, `components/diagnosis/use-diagnostic-quota.ts:46-82`, formatted with `date-fns` per locale; when `resetDate` is unknown:
  "This month's free diagnosis is used. It resets next month.") with "See Pro plans" (`presentPaywall` with `trigger:'rider_tap'`) and "Done" (returns to the Diagnose
  list and clears the in-progress form); no "Try Again" in this state; automatic paywall at most once per form instance; never render server text.
- **How.** Files: `app/(tabs)/(diagnose)/new.tsx`, `components/diagnostic-flow/step-review-submit.tsx`, `stores/diagnostic-flow.store.ts`, `src/i18n/locales/*.json` (all app locale files enforced by `pnpm check:i18n`).
  Jest `app/(tabs)/(diagnose)/__tests__/new-limit.test.tsx`: mock `gqlFetcher` → `FORBIDDEN`; `presentPaywall` called once; second submit is a no-op; no raw message rendered.
  Runner support: `scripts/run-onboarding-e2e.sh` opt-in `E2E_SEED_DIAGNOSIS_USED=1` inserting one `content_generation_log` success row for the test user (deleted with the user) [SOURCE: R3 T7].
  Maestro `diagnose-limit-loop.yaml` (Android emulator for airplane mode) — steps in FS-PO2a.
- **Acceptance.** Jest + Maestro pass; light/dark screenshots; `pnpm check:i18n`.
- **Verification.** FS-PO2a: 0 riders with ≥ 2 `diagnostic_limit_reached` in one session on the fix level (baseline 3/5 on 3.26.0).
- **Out of scope.** Changing the 1/month free limit (R3 OQ7: product question).

#### T09 — A standstill ride ended from the guard is not saved
- **Type** bug · **Size** S–M · **Depends** T05 · **Blocks** T31 · **Specs** FS-PO4b · **Release** Release A (before the slot so control is clean) ·
  **Constraints** D3; ride recording stays free; floors 30 s / 50 m unchanged [SOURCE: utils/ride-constants.ts:25-26].
- **Why.** "End Anyway" → `executeEndRide` → summary that says "RIDE SAVED" with Save primary (`app/(modals)/ride-hud.tsx:202-211, 244-257`;
  `app/(modals)/ride-summary.tsx:193-279`). 26 of 72 new riders' first ride is a live sub-50 m ride [SOURCE: R4 S-R4-01]; 15 `below_min_ride=true` saves by 13 riders on ≥ 3.21, of which **13 saves / 11 riders via the summary** and 2/2 via auto-end [SOURCE: R4 Q-R4-08, R4:159-161].
- **What (aligned to D3, doc review item 6a).** When the guard fires for a ride under the **50 m distance floor, whatever its elapsed time**, and it is not the no-GPS ≥ 120 s
  branch, "End Anyway" becomes "End without saving": end + discard + toast "Not saved: rides under {{seconds}} s or {{meters}} m aren't kept" (interpolated from
  `MIN_RIDE_ELAPSED_S`/`MIN_RIDE_DISTANCE_M`) + route to Home. **Auto-ended rides below both floors** (`autoEndRide`, `utils/ride-location.ts:586`) are discarded through the
  same `discardEndedRide`, and their notification (`rideAutoEndedNotificationContent`, `:667`) reads "Your ride was too short to save". One event for both:
  `ride_discarded {reason:'below_floor', trigger:'guard'|'auto_end'}`; no `ride_completed`.
- **How.** Extract `discardEndedRide(rideId, reason)` from `ride-summary.tsx:256-279` into `features/ride/ride-controller.ts`; call it in the guard's end handler in
  `ride-hud.tsx` and in `autoEndRide`; all app locale files (`pnpm check:i18n`). Update `log-ride.yaml` (it expects "RIDE SAVED" for a standstill ride, `:62-80`) to a moving route (`setLocation` sequence / `travel`);
  new `ride-standstill-not-saved.yaml`. Jest `features/ride/__tests__/ride-controller.test.ts` (`discardEndedRide` enqueues `deleteRide`, clears the record; a 90 s / 20 m guard end
  is discarded; an auto-end below both floors is discarded with `trigger:'auto_end'` and the "too short to save" notification).
- **Acceptance.** FS-PO4b checks; a ≥ 30 s / ≥ 50 m ride still reaches the summary; CarPlay end path unchanged.
- **Verification.** FS-PO4b: 0 `below_min_ride=true` with `save_trigger='summary'` on the fix level; DB share of live sub-50 m first rides < 5% for sign-ups after release.
- **Risks.** A real GPS-poor ride < 50 m is dropped (rider chose "End without saving" explicitly; the no-GPS ≥ 120 s branch still offers save).

#### T10 — Checklist "first ride" row: no tick without a real ride, and it leads to a ride
- **Type** bug · **Size** S · **Depends** T05 · **Blocks** T32 · **Specs** FS-PO10 · **Release** Release A · **Constraints** D4; light/dark; both arms (before the slot).
- **Why.** Every row press calls `completeItem` before navigating (`components/home/onboarding-checklist.tsx:153-160`); FIRST_RIDE completes on any completed
  ride (`lib/checklist-signals.ts:44-47`) and links to the empty rides list (`stores/checklist.store.ts:66-72`). 17 riders ticked it by tap, 14 without a real ride [SOURCE: R4 Q-R4-10].
- **What.** Data-backed items never tick on tap; FIRST_RIDE needs a completed ride with duration ≥ `MIN_RIDE_ELAPSED_S` and distance ≥ `MIN_RIDE_DISTANCE_M`;
  FIRST_RIDE label "Record your first ride" → `/(modals)/start-ride` (D4).
- **How.** Add `distanceM`/`durationS` to the Home rides fragment in `apps/mobile/src/graphql/` → `pnpm generate`; `lib/checklist-signals.ts`,
  `components/home/use-checklist-signals.ts`, `stores/checklist.store.ts` (persist migration for the deep link; the same migration **unticks `first_ride` when no saved ride
  meets the floors**, with a test), `onboarding-checklist.tsx`, all app locale files (`pnpm check:i18n`).
  Jest: `lib/__tests__/checklist-signals.test.ts` (0 m ride does not complete; 60 s / 800 m does), `components/home/__tests__/onboarding-checklist.test.tsx` (press on data-backed row does not call `completeItem`).
  Maestro `checklist-first-ride.yaml`.
- **Verification.** FS-PO10: `trigger='tap'` completions of `first_ride` = 0; data-ticked without a real ride = 0 on the fix level.

#### T11 — Onboarding sign-in screen advances when the session lands; OAuth double-tap guard
- **Type** bug · **Size** S · **Depends** T04 · **Specs** FS-OB1a · **Release** Release A · **Constraints** D1; banner light/dark; all app locale files (`pnpm check:i18n`).
- **Why.** `app/(onboarding)/sign-in.tsx` has no reaction to a new session (no `useEffect` on session; only `goToGetStarted`, `:82`), while the root gate keeps
  `(onboarding)` mounted for unfinished accounts (`app/_layout.tsx:459`). 15/72 auth riders repeated auth within 2 min, 9 never completed; on 3.26.0, 6 of 10
  sign-in-screen riders had no screen change 10 s after auth [SOURCE: R1 RC-A, Q11, Q12]. Confidence 85%.
- **What.** Mirror `app/(onboarding)/account.tsx:125-148`: when a session exists and `me` settled → already onboarded: let the gate route to tabs; else
  `router.replace(getResumeRoute(...) ?? OB_ROUTE.EXPERIENCE)` with route param `notice=account_ready`; the destination screen shows a transient "Account ready — let's set up
  your garage" notice that auto-dismisses after 4 s, is announced to screen readers, testID `onboarding-account-ready`. Module-level in-flight guard
  in `hooks/use-oauth-sign-in.ts` (second tap while pending = no second provider call). `testID="onboarding-sign-in-screen"`.
- **How.** Jest `app/(onboarding)/__tests__/sign-in-session-advance.test.tsx` (session + `me.onboardingCompleted:false` → replace; `true` → no replace) and
  `__tests__/hooks/use-oauth-sign-in.test.ts` (double tap). Maestro `onboarding-signin-unfinished-account.yaml` + runner `scripts/run-onboarding-signin-e2e.sh`
  (creates a confirmed, not-onboarded user via the admin API like `run-onboarding-e2e.sh`). Run the flow on `origin/main` first: it must **fail** (proves the repro).
- **Verification.** FS-OB1a: 0 stuck on the fix level after ≥ 5 sign-in-screen auths.

#### T12 — Account screen: busy state from tap, silent cancel, bounded post-sign-in wait
- **Type** bug · **Size** S–M · **Depends** T04 · **Specs** FS-OB2b, FS-OB2c · **Release** Release A · **Constraints** D1; no copy/order change; light/dark.
- **Why.** Cancel on the Google sheet shows "Error — Something went wrong" (`lib/oauth.ts:169-171`, `lib/oauth-error-alert.ts:19`); no busy state during OAuth
  (`app/(onboarding)/account.tsx:85,152-207`); the "Creating your account…" overlay waits on `me` with retries and no upper bound (`account.tsx:110,125-148`,
  `lib/query-client.ts:176-181`); >10 s for 6/105 OAuth sign-ups, max 141 s [SOURCE: R5 C4–C7, Q8].
- **What.** `oauthBusy` from tap to settle (buttons disabled, spinner on the tapped button); `expected` cancel → no alert; advance after
  `ACCOUNT_ME_WAIT_MS = 8000` even if `me` is loading (root gate still routes onboarded accounts to tabs); fire `auth_post_signin_wait`.
- **How.** Files `app/(onboarding)/account.tsx`, `lib/oauth-error-alert.ts`, `hooks/use-oauth-sign-in.ts`. Jest `__tests__/screens/account-post-signin-wait.test.tsx`
  (fake timers: `me` never resolves → `goNext` once at 8 s, outcome `timeout`; resolves onboarded at 1 s → no `goNext`). Maestro `onboarding-oauth-cancel.yaml` (Android).
- **Verification.** FS-OB2b: 0 OAuth sign-ups with > 10 s to the next step; FS-OB2c: 0 error alerts on `outcome='cancelled'`.

#### T13 — Persist the account/code draft and the bike draft; resume to the screen the rider was on
- **Type** bug · **Size** M · **Depends** T04 (`lastViewedScreen`) · **Specs** FS-OB3, FS-OB1c · **Release** Release A · **Constraints** D1, D10; never persist the password.
- **Why.** Resume targets the screen after the last *completed* one (`config/onboarding.ts:577-583`); the account step never records completion and keeps
  email/code in component state (`hooks/use-email-code-step.ts:4-13,54`); bike-setup keeps its search in component state. Completion after resume: bike-setup 7/27,
  account 5/15 [SOURCE: R1 RC-C, Q13]; email code lost after relaunch in 1 of 19 senders (3 replays) [SOURCE: R5 Q13; 05 OB3].
- **What (aligned to D10, doc review item 6c).** `email` and `codeSentAt` live in a **dedicated `expo-secure-store` key** behind a small helper, cleared in `reset()`,
  `resetForSignOut()`, on code success and at completion; the MMKV onboarding store v10 (`stores/onboarding.store.ts:203-233`, migration from v9) holds only
  `accountDraft {mode}` and `bikeDraft {makeId, make, modelQuery, year}`; on mount within 1 h of `codeSentAt`, reopen the code step for that address (verifyOtp needs no password; the
  recover branch falls back to the form with email prefilled); resume targets a **monotonic `furthestScreen`** (never lowered by a back-walk; V4 a5) rather than the screen after the last completed one; the goals screen seeds its picks from the persisted `ridingGoals` (`goals.tsx:77` starts with an empty `Set`, V4 a3); clear drafts in `reset()`,
  `resetForSignOut()` and on success; fire `email_code_step_restored {age_s}`.
- **How.** Files `stores/onboarding.store.ts`, `app/(onboarding)/account.tsx`, `app/(onboarding)/sign-in.tsx`, `components/auth/email-code-step.tsx`,
  `hooks/use-email-code-step.ts`, `app/(onboarding)/bike-setup.tsx`, `config/onboarding.ts`. Jest `stores/__tests__/onboarding.store.test.ts` (migration keeps
  fields; reset clears drafts and the secure-store key; `partialize` contains neither email nor password), `__tests__/hooks/use-email-code-step.test.ts`. Maestro: runner
  `run-onboarding-email-code-e2e.sh` gets `RELAUNCH=1` → new middle flow `onboarding-email-code-relaunch.yaml`; `onboarding-bike-resume.yaml`.
- **Verification.** FS-OB3 restored = relaunched-with-code (100%); FS-OB1c completion after resume ≥ 50% for bike-setup and account (judge after ≥ 15 resumes each).

#### T14 — Onboarding completion survives a cold start (no relapse into onboarding)
- **Type** bug · **Size** S–M · **Depends** T04 (`gate_routed`), T06 item 5 · **Specs** FS-OB1e, FS-OB6 (part) · **Release** Release A.
- **Why.** `onboardingCompleted` is not persisted (`stores/auth.store.ts:78-89,140-152`); a 7-day persisted `me` is restored on cold start
  (`lib/query-persist.ts:67-74`); "Open my garage" wipes the onboarding store (`personalizing.tsx:389-393`). 10/291 completers saw onboarding again; 4 completed twice;
  `532d475d` routed to Welcome 6 min after completing [SOURCE: R1 RC-E, Q6, Q7]. Confidence 45% (raise with `gate_routed` first: if 4 weeks show 0 `me_cache` relapses, re-scope).
- **What.** Persist `onboardingCompletedForUserId` in the auth store (set wherever `setOnboardingCompleted(true)` is called; cleared on sign-out/user change); gate uses
  local flag for the session's user || server `me` from the **network**; a cached `me` older than the session's sign-in cannot say "not completed". A second
  `complete_onboarding` is a no-op server-side (per T06 item 5; migration only if needed, owner-approved).
- **How.** Files `stores/auth.store.ts`, `app/_layout.tsx` (gate `:417-419, 453-467`), `app/(onboarding)/personalizing.tsx`. Jest `app/__tests__/navigation-gate.test.tsx`
  (three cases in FS-OB1e). Maestro `onboarding-complete-relaunch.yaml` (Android, `setAirplaneMode`).
- **Verification.** FS-OB1e = 0 on the fix level; DB: no account with 2 bikes created ≤ 2 min apart by onboarding.

#### T15 — No sign-in screen or onboarding after completion (PO12/PO13)
- **Type** bug (investigate → fix) · **Size** M · **Depends** T04, T06 item 1 · **Specs** FS-PO12, FS-PO13 · **Release** Release A.
- **Why.** 5 replays: Google SignInHub / sign-in after completion (`01a16e01`, `01a17532`, `01a1b0c2`) and back into onboarding (`01a1ace6`, `01a1b1de`) [SOURCE: R6 F-PO12, F-PO13].
  Any null-session event after a user existed runs `resetForSignOut()` (`app/_layout.tsx:698`, gated in `lib/auth-state-change.ts:86-117`). Confidence 30–35%.
- **What.** (1) Baselines (T06). (2) Repro on Android with a Google account; find any `GoogleSignin.signIn`/`signInSilently` call outside `(onboarding)`/`(auth)`
  (consumers of `hooks/use-oauth-sign-in.ts`: `account.tsx`, `sign-in.tsx`, `register.tsx`, `login.tsx`). (3) A `TOKEN_REFRESHED` or transient null session after
  completion must not navigate to `(auth)` nor reset onboarding. If (2) finds nothing and baselines are 0, close as "not reproduced" with the metric left on the dashboard.
- **How.** Jest `lib/__tests__/auth-state-change.test.ts` (blip after completion → no `(auth)` route, no `resetForSignOut`). Maestro `post-onboarding-no-signin.yaml`.
- **Verification.** FS-PO12 and FS-PO13 = 0 per version.

#### T16 — "Open my garage" lands on Home once, fast; at most one sheet over Home on landing
- **Type** bug · **Size** M · **Depends** T05 (`post_onboarding_landed`) · **Specs** FS-OB6, FS-PO17 · **Release** Release A · **Constraints** paywall hand-off and placement untouched; D11; light/dark.
- **Why.** Retry shows after a bare 8 s timer even when steps are ticked (`app/(onboarding)/personalizing.tsx:376-383`); `onboarding_completed` twice for 6/282;
  7 completer replays (loops ×4, black 10 s, white 28 s, Retry with all ticked) [SOURCE: R6 F-OB6, R6-q3]; 5 replays with competing landing sheets [SOURCE: R6 F-PO17].
- **What.** CTA disabled after the first tap and `handleContinue` idempotent (`personalizing.tsx:389-393`); never render the payoff again once `completionSent && mutationDone`;
  **CTA states (T16a, doc review item 9):** idle → pending (spinner, disabled) → pending > 10 s (show only "Skip and continue") → failed (Retry + "Skip and continue") →
  success (navigate once); jest with fake timers per state;
  Retry only when the mutation **failed** (keep "Skip and continue"); a sheet queue (D11, doc review item 6d): **at most one modal sheet per cold session**; analytics consent is
  an earlier gate; then recall, then "Service plan ready" (the OEM-imported sheet); the Exp 1 plan card is an **inline Home card** shown only when no sheet is shown;
  What's New and check-in become eligible from the next session.
- **How.** Files `app/(onboarding)/personalizing.tsx`, `app/(tabs)/(home)/index.tsx` (`home-screen` testID), the sheet owners. Jest `app/(onboarding)/__tests__/personalizing.test.tsx`.
  Maestro `post-onboarding-landing.yaml` (both paywall arms via `EXPECTED_ARM` as in `run-onboarding-paywall-e2e.sh`; screenshots light + dark).
- **Verification.** FS-OB6 (a) 0 completed-twice, (b) p90 `ms_since_cta` < 3,000; FS-PO17 ≤ 1 overlay.

#### T17 — Diagnosis failures: offline pre-check, deadline, localized errors
- **Type** bug · **Size** S–M · **Depends** T05, T08 · **Specs** FS-PO2b · **Release** Release A · **Constraints** D6.
- **Why.** Successful diagnoses take 6 s p50 / 11 s p90; failures p90 47 s, max 141 s, 7/14 offline, under a 300 s client timeout (`lib/graphql-client.ts:30-41,55-63`);
  raw server text shown (`new.tsx:228`); no server row for any failure, so the free diagnosis is never burned [SOURCE: R3 RC-4, Q8, S1–S2].
- **What.** Offline pre-check with `expo-network` (`Network.getNetworkStateAsync`, installed at `apps/mobile/package.json:71`) and `isNetworkError` (`lib/network-error.ts:47`); **add no native dependency** (`@react-native-community/netinfo` is not installed) [review item 10] → "You're offline. Your answers are kept…" with `diagnostic_failed {reason:'offline_precheck'}`;
  `GQL_TIMEOUT_MS.DIAGNOSIS = 75_000` on `SubmitDiagnosticDocument`; in-flight state with a spinner, "Still working…" after 10 s, Back keeps the answers; error classes → i18n keys
  (offline, throttled `TOO_MANY_REQUESTS`, timeout, server). **After the 75 s client deadline (doc review item 7)** the server may still finish, so show "Still working — if it
  finishes, it will appear in your diagnoses" (never "wasn't used"); keep submit disabled until the server's maximum window has passed (`AI_CLIENT.TIMEOUT_MS` 60 s ×
  (1 + `MAX_RETRIES` 3) ≈ 240 s, `apps/api/src/config/constants.ts:41-45`), then refetch `diagnosticQuota`; if that refetch fails, Retry reruns the refetch first.
- **How.** Files `lib/graphql-client.ts`, `app/(tabs)/(diagnose)/new.tsx`, `components/diagnostic-flow/step-review-submit.tsx`, locales. Jest
  `app/(tabs)/(diagnose)/__tests__/new-timeout.test.tsx` (fake timers: timeout at 75 s → no "not used" copy, submit disabled until the 240 s window ends, then quota refetch;
  failed refetch → Retry refetches first). Maestro `diagnose-offline.yaml` (Android, `setAirplaneMode`).
- **Verification.** FS-PO2b: p90 submit→failed ≤ 75 s; failures per failing rider ≤ 1.5; post-send offline failures 0.

#### T18 — Release A: store binary 3.29.0 "#365 fixes A" (iOS + Android)
- **Type** release · **Size** S · **Depends** T01, T04a, T04b, T04c, T05a, T05b, T05c, T05d, T07b, T08–T17 (merged) · **Blocks** T35, T14b, T15b, T36, T38 · **Release** store builds per `docs/runbooks/mobile-release.md`
  (D17: no OTA of this content; an OTA only for a crash/data-loss hotfix per `docs/runbooks/mobile-ota.md`, `--environment production`, owner go-ahead) · **Constraints** D14, D17.
- **What.** Version bump in `apps/mobile/app.config.ts`; `ACTIVATION_FIX_LEVEL = 2` (level 1 is not used, §3A.0 rule 2); release notes list task ids;
  pre-promotion E2E: `onboarding-paywall-verify.yaml` both arms (required by the runbook; iOS build from the `e2e-simulator-paywall` profile, vendor SDKs on, owner go-ahead),
  `onboarding.yaml`, plus every new flow from T07–T17 (iOS flows on `e2e-simulator`; the Android-only `onboarding-complete-relaunch.yaml` and `diagnose-offline.yaml` on `e2e-android`; both vendor SDKs off).
  On go-live per platform: annotation + §6 row (T03 procedure). Android also carries the FCM config from PR #393 (vc99 line). **vc99 (validation, V3 §2):** vc98 is in Play
  production, so D14's condition is met, but vc99 is a **draft on internal named "3.26.0"** (not even delivered to testers). Steps: (a) rename the release to "3.28.0 (99)";
  (b) roll it to internal and verify a push token registers (`push_token_registered` with `platform='android'`, and a `device_push_tokens` row); (c) promote to production with the
  owner's go-ahead. If vc99 is not promoted before the 3.29.0 cut, drop it and let FCM ride in 3.29.0. FCM itself works: 3 Android tokens already registered from test devices.
  **Depends also on T00** (the runbook's pre-promotion `test:e2e:onboarding-paywall` needs a booted iOS simulator, `docs/runbooks/mobile-release.md:12-16`; none existed on 2026-11-12). Release A is the first release of the P0
  instrumentation (T01, T04a–c, T05a–d incl. T05c's guard-sheet render change and testIDs; D17, TR0 removed), and its go-live date per platform starts every client-event
  baseline (FS-OB* first-session and post-onboarding) and the T14b/T15b/T36/T38 gate windows (§3A.0 rule 1).
- **Acceptance.** Both binaries in production; FS-M binary check: 100% of opens with `$app_version = 3.29.0` carry level 2 three days after go-live (any mismatch = wrong cut);
  first `is_embedded_launch=true` events with the new level.
- **Verification.** 2/4/8-week dashboard reads recorded in `experiments.md`, using the §0/§1.2 reading rule: iOS first-session same-weeks comparison n/a; Nov–Mar harm checks
  against the Android staged-rollout cohort (concurrent); a trailing-8-week drop alone = "no verdict (season)", never a revert. Android adopts a new binary slowly (V3 §4): for
  2–4 weeks `lvl = 2` returning-rider reads are mostly iOS, and a thin Android `lvl = 2` cohort at the 2-week read is "no verdict", not a regression.

### P2 — Friction removal

#### T19 — Android Back steps once and leaves onboarding instead of rewinding it
- **Type** enhancement · **Size** M · **Depends** T04 (`onboarding_back`), T00 · **Blocks** T20 · **Specs** FS-OB1b · **Release** Release B, **in the same build as T20** (V4: T19a alone reproduces RC-D on the next warm launch; if T20 misses the freeze, T19a is held back too) · **Constraints** D1, D9; iOS swipe-back unchanged.
- **Validation (V4 b1/b2/a4, ~90%):** reproduced on the store binary 3.28.0 — one screen per Back down to Welcome, Back on the root finishes the activity; Android Back on a
  *resumed* root step (account, bike-setup) closes the app while the on-screen chevron goes one step back. FS-OB1b gains the check "cold resume to account → Android Back →
  goals, not the launcher".
- **Why.** No `BackHandler` in `app/(onboarding)` or `components/onboarding`; Back pops one screen per press down to Welcome (`app/(onboarding)/_layout.tsx:42-64`).
  49 riders made ≥ 3 back steps ≤ 5 s apart; 7 completed vs ~57% of others; replays label these "the app reset" [SOURCE: R1 RC-B, Q8, Q9].
- **What (aligned to D9, doc review item 6b).** `BackHandler` registered by every step via `hooks/use-onboarding-flow.ts`: one step back via `getPreviousRoute` (`replace`,
  param `from:'back'`), debounced to one step per 400 ms; on **experience**, Back does `router.replace` to Welcome with `from:'back'`; **only Welcome** returns `false` so the OS
  backgrounds the app (prefer this to `exitApp()`, which can kill the process and lose resume); forward after Back keeps answers. The email code step keeps its own handler.
- **How.** Files `hooks/use-onboarding-flow.ts`, `app/(onboarding)/*.tsx`. Jest: extend `src/config/__tests__/onboarding.test.ts` for `getPreviousRoute` per variant with/without bike.
  Maestro `onboarding-back-preserves.yaml` (Android; testID `goal-chip-<id>-selected` added here).
- **Acceptance.** FS-OB1b checks pass on Android; iOS unchanged.
- **Verification.** FS-OB1b ≤ 5% of Android starters with ≥ 3 fast backs; S2 harm check (completion of starters not below trailing 8 weeks).
- **Out of scope.** "Leave setup?" dialog (D9: no dialog). **Risks.** OEM differences in Back behaviour → test a Samsung too.

#### T20 — Welcome resumes on any non-Back remount
- **Type** bug · **Size** S · **Depends** T04, T19 (`from:'back'` param) · **Specs** FS-OB1d · **Release** Release B · **Constraints** D1.
- **Why.** Welcome resumes once per JS runtime (`resumeHandledThisLaunch`, `app/(onboarding)/index.tsx:23-29,47-57`); 11 riders saw Welcome again in a live runtime
  with progress, 7 on 3.26.0 [SOURCE: R1 RC-D, Q4, Q10]. **Trigger found on device (V4 b3, ~80%):** Back out of the onboarding root, then a warm launch while the process is cached → the new
  activity mounts Welcome in the same JS runtime with `resumeHandledThisLaunch === true`, so it does not resume. T19's "only Welcome returns `false`" produces exactly this, so **T19a and T20 ship in the same build**.
- **What.** Replace the module flag with "resume unless `params.from === 'back'` or the store has no progress"; keep a per-mount double-fire guard; fire `onboarding_welcome_mounted`.
- **How.** Jest `app/(onboarding)/__tests__/welcome-resume.test.tsx` incl. "flag true, new mount, no param → resume". Maestro `onboarding-welcome-warm-resume.yaml` (tag `android`): to bike-setup → `pressKey: back` until the app is backgrounded → `launchApp` (no `stopApp`, no `clearState`) → `assertNotVisible: "Let's get started"`. Red first.
- **Verification.** FS-OB1d: 0 unexplained (`reason != 'back'`) Welcome mounts with progress. ~~Out of scope: finding the remount trigger~~ (resolved by V4).

#### T21 — `LimitSheet` and a session frequency cap for feature-gate paywalls
- **Type** enhancement · **Size** M · **Depends** T05 · **Blocks** T22, T24 · **Specs** FS-PO3, FS-PO2c (part) · **Release** Release B ·
  **Constraints** D5; onboarding surfaces exempt via `isOnboardingPaywallSurface`; a rider-tapped path to the paywall always exists; light/dark; all app locale files (`pnpm check:i18n`).
- **Why.** `requirePro`/`requireAccess` present on every call (`hooks/use-pro-gate.ts:64-105`); `presentPaywall` only de-duplicates concurrent requests
  (`lib/subscription.ts:770-792`); five MAX_BIKES entry points each present (R3 C18). On 3.26.0, 9/22 gate-paywall sessions had ≥ 2 views and 8/22 a same-feature repeat
  ≤ 60 s; riders re-tap 1–11 s after dismissing [SOURCE: R3 RC-3, Q7, Q10]. 2 of 3 gate purchases (all 3.19.1) came on a repeat view, so a hard cap is rejected [SOURCE: R3 Q12].
- **What.** New `lib/paywall-frequency.ts` ledger (in memory; resets on cold start or > 30 min background): 1 automatic present per feature per session, 2 per session,
  10-min cooldown after a `paywall_result: error`. Capped calls open `components/paywall/limit-sheet.tsx` (feature copy; bikes: "Free includes 1 bike. Update your bike, or see Pro";
  diagnostics: reset date) with "See Pro plans" (`trigger:'rider_tap'`, never capped); fire `paywall_suppressed` and `limit_sheet_viewed`; set `gate_policy:'capped_v1'`.
  **Copy table (doc review item 9):** title, body and CTA for each gated feature `full_ai_diagnostics`, `unlimited_bikes`, `gpx_export`, `offline_trips`, `trip_assistant`
  (`packages/types/src/constants/limits.ts`), plus a generic fallback keyed off `feature`; all app locale files enforced by `pnpm check:i18n`; the table is in the T21 issue.
- **How.** Consulted by `hooks/use-pro-gate.ts:64-105`, `app/(tabs)/(garage)/index.tsx:128-130`, `hooks/use-profile-data.ts:118-128`. Jest `lib/__tests__/paywall-frequency.test.ts`
  (rules in FS-PO3). Maestro `gate-frequency-cap.yaml` (seeded used diagnosis). `onboarding.yaml` and `onboarding-paywall-verify.yaml` must still pass unchanged.
- **Verification.** FS-PO3: 0 sessions with ≥ 2 automatic same-feature views; S5 ≤ 2%; guardrail: gate purchases + `rider_tap` views not zero over 8 weeks (counts).
- **Out of scope.** Onboarding paywall, RC experiment, placement `feature_gate` config. **Risks.** A lost repeat-view purchase (expected small; guardrail counts).

#### T22 — Bike limit: "Update my bike" before "Add a second bike (Pro)"
- **Type** enhancement · **Size** M · **Depends** T21 (sheet), T23 (edit refreshes schedule), T05 (`garage_bike_edited`) · **Specs** FS-PO1 · **Release** Release B ·
  **Constraints** D5; `MAX_BIKES` unchanged (no second free bike); light/dark; all app locale files (`pnpm check:i18n`); Home switcher "+" is a gate, not Home content (log date for Exp 1).
- **Why.** 7/118 completers on 3.26.0 hit the bike paywall on day 0; none of the 29 day-0 bike-paywall riders ever got a second bike, deleted one, or (for make-only) set a model;
  several opened `edit-bike` around the paywall [SOURCE: R2 §3.2, R2-PH3, R2-PH4, R2-DB5]. Editing is free but not offered at that moment (`app/(tabs)/(garage)/edit-bike.tsx:195-305`).
- **What.** One hook `hooks/use-add-bike-gate.ts` with pure `decideBikeLimitAction({isPro, bikeCount}) → 'open_form'|'offer_update'|'paywall'` used by all entries
  (`app/(tabs)/(garage)/index.tsx:121-134`, `app/(tabs)/(home)/index.tsx:358-366`, `hooks/use-profile-data.ts:119`, `app/(tabs)/(garage)/add-bike.tsx:136-147`):
  free with ≥ 1 bike → `LimitSheet` variant "Your plan has one bike". **Doc review item 9 (amends D5):** "Update my bike" is primary **only when the rider's bike has an empty
  model** (→ `edit-bike?id=`), with "Add a second bike — Pro" secondary; for a complete bike the primary is "Add a second bike (Pro)" → existing paywall
  (`feature:'unlimited_bikes'`, `surface:<entry>`) and the secondary is "Edit <bike>". `decideBikeLimitAction` takes the bike's model; jest covers both cases. Events `bike_limit_sheet_shown`, `bike_limit_choice {choice}`. testIDs `bike-limit-sheet`, `bike-limit-update`, `bike-limit-second-bike`.
- **How.** Jest `hooks/__tests__/use-add-bike-gate.test.ts`. Maestro `bike-limit-update-bike.yaml` (iOS + Android). Update `.maestro/README.md` note that `add-bike.yaml` expects the paywall.
- **Verification.** FS-PO1: of riders shown the sheet ≥ 50% choose update and save; day-0 bike paywall ≤ 2% of completers. **Out of scope.** Free bike swap/delete loophole (rejected, R2 §4.2 F/G).

#### T23 — Changing make/model/year refreshes the bike's schedule (API)
- **Type** enhancement · **Size** M · **Depends** T07 · **Blocks** T22, T26 · **Specs** FS-R2-3 · **Release** API deploy (+ annotation); no migration (D8) · **Constraints** D8.
- **Why.** `updateMotorcycle` never touches tasks (`apps/api/src/modules/motorcycles/motorcycles.resolver.ts:116-123`, `motorcycles.service.ts:98-162`); after T07 a make-only bike carries make-generic rows.
- **What.** If make/model/year/variant changed: soft-delete pending, never-completed, rider-unedited OEM tasks (rider-unedited = `updated_at` within 60 s of `created_at`, D8) via `soft_delete_maintenance_task` (RPC, user client —
  `apps/api/src/modules/maintenance-tasks/maintenance-tasks.service.ts:411`; CLAUDE.md "Soft delete goes through a SECURITY DEFINER RPC"), then `autoPopulateForBike`
  unfiltered with the rider's unit; return `scheduleRefreshedCount`. **Dedup fix (review item 12):** the dedup in `autoPopulateForBike`
  (`apps/api/src/modules/oem-schedules/oem-schedules.service.ts:222-228`) reads soft-deleted rows too; add `.is('deleted_at', null)`
  (`maintenance_tasks.deleted_at`, `packages/types/src/database.types.ts:2001`) so retired tasks with the same schedule ids are re-created.
- **How.** Jest `apps/api/src/modules/motorcycles/motorcycles.resolver.spec.ts` (identity change retires only eligible tasks then imports; nickname/odometer change → no call). `pnpm verify:api`; `pnpm generate` if the type changes.
- **Verification.** FS-R2-3: ≥ 20% of make-only onboarding bikes get a model within 7 d on the fix level, with `schedule_refreshed_count > 0`. **Risks.** Never delete rider-edited or completed tasks.

#### T24 — Exhausted diagnose CTA and the "1 bike on Free" hint
- **Type** enhancement · **Size** S · **Depends** T21 · **Specs** FS-PO2c · **Release** Release B · **Constraints** D6; the CTA gets *quieter* (AI not promoted); light/dark contrast.
- **Why.** With the quota used, the CTA looks unchanged and the limit is only a caption (`components/diagnosis/quota-note.tsx:13-30`, `app/(tabs)/(diagnose)/index.tsx:141-163`);
  3 riders got 6 upfront paywalls, re-tapping 1.4–7 s after dismissing [SOURCE: R3 Q1, Q7].
- **What.** When `quota.isExhausted` (known), the list CTA and `[id].tsx:116` "Start new" read "Free diagnosis used · back on {date}" in a muted style and open the `LimitSheet`,
  never the form or the paywall directly; unknown keeps today's optimistic CTA. Garage add button shows "1 bike on Free".
- **How.** Jest `components/diagnosis/__tests__/diagnose-cta.test.tsx` (available / exhausted / unknown). Maestro `diagnose-quota-used.yaml`.
- **Verification.** FS-PO2c: 0 automatic upfront paywalls; `limit_sheet_viewed` for the same riders.

#### T25 — Bike search: one make+model search, popular-first models, year before model; reject junk makes
- **Type** enhancement · **Size** M · **Depends** T04 (`bike_setup_summary`) · **Specs** FS-OB4, FS-R2-5 · **Release** API deploy **first**, then Release B
  (memory `project_vercel_render_deploy_race`) · **Constraints** D1 (screen content change before the arms diverge); keep `bike_added.capture_level` semantics; light/dark.
- **Why.** The make search placeholder promises "e.g. 'Yamaha MT-07'" but matches makes only (`components/onboarding/bike-setup/make-grid.tsx:31-61`, `i18n/locales/en.json:750`);
  models show the first 6 alphabetically (`model-picker.tsx:35-54`); year defaults to current−3 below the list (`app/(onboarding)/bike-setup.tsx:96-98,231-237,520-535`);
  bike_setup is the slowest step (p50 44 s / p90 146 s Android) and 60–75% of onboarding bikes are make-only every week [SOURCE: R5 OB4, Q14–Q16]. Junk makes ("A", "V", "S", "P") are saved [SOURCE: R2 R2-DB5].
- **What.** (a) Query tokens after a matched make search that make's models → "Yamaha MT-07" rows; (b) models ranked by fleet count then alphabetically (API ordering on
  `motorcycleModels`, `apps/api/src/modules/motorcycles/motorcycles.resolver.ts` / `nhtsa.service.ts:118-135`, or reuse `makeStats`); (c) year stepper above the model list;
  (d) custom make requires ≥ 3 letters or a known/NHTSA make before "Use 'X'"; no-match states: < 3 letters "Keep typing your brand's name", ≥ 3 letters "Use 'X'".
- **How.** Jest `__tests__/components/make-grid-search.test.tsx`, `model-picker-ranking.test.tsx`, custom-make rule test. Split `_shared/onboarding-to-account.yaml` at the bike step into
  `_shared/onboarding-to-bike-setup.yaml`; Maestro `onboarding-bike-search.yaml` ("Yamaha MT-07" and "mt07").
- **Verification.** FS-OB4: dwell p50 ≤ 25 s, p90 ≤ 75 s; model share ≥ 60%; bike_setup drop-off not above baseline. FS-R2-5: junk makes 0.
- **Out of scope.** NHTSA cache persistence (ledger line in §10: trigger `model_fetch_ms` p90 > 3 s; was T37). **Risks.** Moves `bike_added` and goal→placement inputs; add, never rename, properties.

#### T26 — "Add your model" row for make-only bikes in the bike hub
- **Type** enhancement · **Size** S · **Depends** T23, T05 · **Specs** FS-R2-3 (source `bike_hub`) · **Release** Release B · **Constraints** bike hub only (not Home: Exp 1 slot); light/dark; all app locale files (`pnpm check:i18n`).
- **Why.** 52/104 onboarding bikes on 3.26.0 are make-only; 117 blank-model live bikes, 7 ever had a task; most never tap Add, so T22 does not reach them [SOURCE: R2 R2-PH4, R2-DB6].
- **What.** In `components/bike-hub/overview/overview-segment.tsx`, when `model === ''`, a row "Add your model for its exact service schedule" → edit-bike; show the tier on make-generic tasks.
- **How.** Maestro step appended to `onboarding-make-only-service-plan.yaml` (tap row → edit-bike visible). **Verification.** FS-R2-3 by `source='bike_hub'`.

#### T27 — Start Ride first open: one clear Start, bike preselected, permission in context, denial never a silent spinner
- **Type** enhancement · **Size** M · **Depends** T05 · **Specs** FS-PO14 · **Release** Release B · **Constraints** D12; HUD stays `HUD_THEME`; copy shares the floors interpolation with T31.
- **Why.** 67 of 130 completers who opened Start Ride on day 0 did not start (52%); replays show setup-screen exits, a spinner, a denied-permission return [SOURCE: R6 F-PO14, R6-q9].
  **The P2 task most likely to move return (still not causal):** starting a ride on day 0 is the strongest returner predictor (35% vs 10% back on day 2, adjusted OR 4.5) [SOURCE: V2 §5, §5.2].
  Denied location should show "Location required" (`app/(modals)/start-ride.tsx:99-102`); start flow `:81-148`.
- **What.** First diagnose with `$screen` + last-tap data (record in `experiments.md`); then: Start button above the fold, onboarding bike preselected, in-context permission once,
  denied → alert with Open Settings (never a spinner), one line "Short test rides aren't saved (under {{seconds}} s or {{meters}} m)".
- **How.** Jest `app/(modals)/__tests__/start-ride.test.tsx` (`{reason:'denied'}` → alert + busy cleared). Maestro `start-ride-first-open.yaml` (deny and allow runs).
- **Verification.** FS-PO14 ≤ 35% per version (test arm: riders with `next_ride_plan_set` subtracted); **own per-release metric:** day-0 `ride_started` among riders who opened Start Ride on day 0, baseline **63/130 (48%)** [SOURCE: V2 §5.2; R6-q9]. **Out of scope.** Changing ride floors.

#### T28 — Home taps always respond (checklist rows, bike card, receipt card, empty states)
- **Type** bug · **Size** S–M · **Depends** T05 · **Specs** FS-PO6 · **Release** Release B · **Constraints** light/dark.
- **Why.** 5 dead-tap and 5 empty-state replays; first-hour `$rageclick` 15/282, 3.26.0 7/117 [SOURCE: R6 F-PO6, R6-q3]; autocapture is off so dead taps are invisible in events [SOURCE: 05 PO6].
- **What.** Break `$rageclick` down by `$screen_name`/`$el_text` first (record the worst control); every checklist deep link resolves to a registered route; bike card,
  receipt card and empty rows either navigate/open a sheet or stop looking tappable.
- **How.** Jest `__tests__/stores/checklist.store.test.ts` (every `ALL_CHECKLIST_ITEMS[].deepLink` is a registered route). Maestro `home-taps-respond.yaml`.
- **Verification.** FS-PO6 first-hour rage riders ≤ 3%; 0 dead checklist links.

#### T29 — Discover first open: no unprompted location dialog; skeleton, timeout and Retry
- **Type** enhancement · **Size** S + S · **Depends** T05 (`screen_load_timed`), T06 item 8, T00 · **Specs** FS-PO7, FS-PO8 · **Release** **Release A** (moved up by the validation; if it misses the Release A cut it is the first P2 task in Release B) · **Constraints** D12 (both arms, before the slot — Release A is earlier and not a launch-day change); light/dark.
- **Why.** Discover asks for location on mount (`app/(tabs)/(discover)/index.tsx:503`, `hooks/use-user-country.ts:30-45`); PO8's "Descargar mapas" is not an app string and the session
  backgrounded 0.37 s after `discover_tab_viewed` [SOURCE: R4 §3.3, Q-R4-11]; 2 replays of slow/stuck Discover [SOURCE: R6 F-PO7]. **Validation (V1-q36):** on a rider's first Discover
  visit, `Application Backgrounded` follows within 2 s for **42 of 43 Android riders** (median 0 s) vs 1 of 59 on the first Garage view and 0 of 28 on iOS — a likely OS dialog
  (location, ≈ 70%) hitting nearly every Android rider who opens Discover; T06 item 8 confirms the dialog type on a device.
- **What.** `useUserCountry` disabled until a "Use my location" tap in "Near you" (`components/discover/near-you-section.tsx`) with a reason line; skeleton cards while loading;
  error + Retry after 10 s; `screen_load_timed {screen:'discover'}`.
- **How.** Jest `hooks/__tests__/use-user-country.test.ts`. Maestro `discover-first-open-android.yaml`.
- **Verification.** FS-PO7 p90 < 3,000 ms, timeout < 1%; FS-PO8 Android first-visit backgrounding ≤ 2 s from 42/43 → ≤ 5% (at the Garage-control level, 1/59).

### P3 — Experiment 1 "first-ride plan" (build + launch)

The spec is the board's single spec [SOURCE: board/99-synthesis.md §4 Experiment 1] with R4's code corrections [SOURCE: deep-dives/R4 §3.4].
**Correction to the board and R4 T5:** the code must be **embedded in the store binary** (Release B; D17: never by OTA), because assignment happens in the
first session and new installs run embedded JS [SOURCE: R3 RC-2]. Launch = flag flip once Release B is ≥ 90% of new installs on both platforms.

#### T30 — Flag `activation_365_first_session` and sticky assignment after the paywall
- **Type** experiment · **Size** M · **Depends** T05, T02 (ledger) · **Blocks** T31, T32, T34, T35 · **Specs** FS-EXP1 · **Release** API part: Render deploy before the 3.30.0 cut (§3A.0 rule 3); client: Release B (flag default control) ·
  **Constraints** crossed (factorial) with `onboarding_paywall_2026q4` and `expd7c1d56904`, never nested; D13.
- **Why.** `isFeatureFlagOn` is false whenever analytics is off, so every pre-consent EEA/UK/CH install would land in control (SRM by region)
  (`lib/feature-flags.ts:18-25`); for `garage_first`, `onboarding_completed` fires before the paywall; the cold-start branch completes without `handleContinue`
  (`app/(onboarding)/personalizing.tsx:366-371` vs `:389-393`) [SOURCE: R4 §3.4].
- **What.** `lib/activation-experiment.ts` mirroring `lib/onboarding-experiment.ts:13-40,67-71`: PostHog multivariate `control`/`test` if it answers (source `posthog`);
  flag off/unknown → `control` (kill switch); cannot ask → uniform local draw (source `local`); sticky `activationArm/AssignedAt/Source/ExposurePending` in
  `stores/experiment.store.ts:20-68` (version-2 migration); assign in one `completeOnboardingAndAssign()` called from `handleContinue` **and** the cold-start branch, only
  for riders with no real ride; `activation_exposure {experiment, arm, source, onboarding_variant, notifications_granted, primary_goal, returning_account}` + super property `activation_arm`; pending exposure flushed on consent.
  `primary_goal` = the onboarding primary goal (already the `onboarding_goal_primary` super property); `returning_account` = the rider's first auth in this install signed in to a pre-existing
  account (21 of 367 completers, 33% back on day 2 — reinstalls, not new riders) [SOURCE: V2 §3.1, §5.1 item 4]. Both are pre-treatment, so T40 can stratify on goal and exclude or stratify `returning_account`.
- **How.** Jest `lib/__tests__/activation-experiment.test.ts` (each source path, stickiness across relaunch and sign-out, no re-roll, exposure once, pre-consent flush,
  assignment after the garage_first paywall) + a 10,000-draw SRM simulation in the test.
- **Start/stop window from the API (doc review item 4).** API part: a nullable field `activationExperimentWindow { startAt, stopAt }` on a query the client already makes
  at onboarding completion: a `@ResolveField` on the `User` type that the `completeOnboarding` mutation returns (`apps/api/src/modules/users/users.resolver.ts:43-50`; client
  `apps/mobile/src/graphql/mutations/complete-onboarding.graphql`), its values from two env vars validated in `apps/api/src/config/env.validation.ts` (a Render env change needs a
  new deploy, memory `project_render_env_needs_deploy`).
  The client draws only when `startAt <= now < stopAt`. Embedded hard ceilings stay: `EXP1_STOP_AT = 2027-03-31` and no start after 2027-01-06. Unreachable API or
  `null` window = not started: `control`, `source: 'pre_start'`, no draw, no exposure. On the D16 day the start is set server-side and the PostHog flag is flipped the same day;
  no other switch is needed for pre-consent riders (their local draw reads the same window). Jest in `apps/api` (field null by default, returns the configured window) and in
  the client (null / unreachable / before start / after stop / after the 2027-01-06 ceiling → no draw).
- **Verification.** FS-EXP1 SRM χ² per platform weekly passes; exposure count ≈ completers. **Risks.** Assignment drift if a completion path bypasses the shared function.

#### T31 — Teaching sheet for a standstill first ride (test arm)
- **Type** experiment · **Size** M · **Depends** T09, T30, T05 · **Specs** FS-PO4a · **Release** Release B · **Constraints** `HUD_THEME`; floors unchanged; copy D13.
- **What.** Pure `features/activation/guard-variant.ts` `selectGuardVariant({elapsedS, distanceM, hasRealRide, arm})`: teaching only for test arm, `distance_m < 10`,
  too-short branch, no real ride. Title "Test ride: all good" if `gps_fix`, else "Testing it out?"; body states both floors interpolated from the constants;
  buttons "Got it" (= T09 discard), "Keep recording", "Remind me on my next ride day" (opens T32 chips, `action:'remind_me'`); `variant:'teaching'`.
- **How.** Jest `app/(modals)/__tests__/ride-guard-variant.test.ts` (all branches incl. no-GPS ≥ 120 s, distance 9/10/50). Maestro `ride-standstill-teaching.yaml` with `EXPECTED_ARM`.
- **Verification.** FS-PO4a hygiene: 0 teaching sheets with `distance_m ≥ 10` or after a real ride; ≥ 95% eligible test-arm sheets are teaching.

#### T32 — "When's your next ride?" plan card + local scheduler (test arm)
- **Type** experiment · **Size** M · **Depends** T10, T30 · **Blocks** T33, T34 · **Specs** FS-EXP1 (plan chain) · **Release** Release B · **Constraints** light/dark via `useEditorialTheme`; all app locale files (`pnpm check:i18n`); no Pro/price wording.
- **What.** `components/home/activation-plan-card.tsx` on top of `OnboardingChecklist` for test-arm riders with no real ride (replacing the FIRST_RIDE row); chips
  Later today (D13), Tomorrow, This weekend, Not sure yet; fire times from `features/activation/plan-fire-time.ts` (+3 h capped 19:00; 10:00; Saturday 10:00; none);
  in-context permission once after a chip; one local notification via `lib/notifications.ts` kind `activation`, `source:'plan_card'`; opens Start Ride via the response handler
  (`app/_layout.tsx:975`); cancelled by any core action; events `next_ride_plan_set {when, source, permission_granted}`, `reminder_scheduled/opened {kind:'activation', source}`,
  `activation_nudge_presented` (`getPresentedNotificationsAsync`); pre-ticked "Bike added" row. It is an **inline Home card**, shown only when no landing sheet is shown (D11).
  **Card states (doc review item 9), each with a testID and light/dark screenshots:** unset (chips, `activation-plan-card`) → chosen + permission granted ("Reminder set for <time>",
  Change; `plan-card-scheduled`) → chosen + permission denied ("We'll keep this on your list", Open Settings, no reminder promise; `plan-card-denied`) → not sure (collapses to
  one line; `plan-card-collapsed`) → core action done (card removed).
- **How.** Jest `features/activation/__tests__/plan-fire-time.test.ts` (chips, cap, TZ, DST, Saturday), `scheduler.test.ts` (max one activation notification, cancel on core action).
  Maestro `first-ride-plan-card.yaml` (`EXPECTED_ARM=test` asserts card; `control` asserts absent). Delivery is not Maestro-provable → T33.
- **Verification.** Plan-set rate among eligible test-arm completers; kill the card if < 1 in 10 after 8 weeks [SOURCE: board/99 §4].

#### T33 — Android next-day local notification delivery check (gate for T34 and reminder copy)
- **Type** research (device) · **Size** S · **Depends** T32 build · **Blocks** T34 · **Release** — · **Constraints** stock Pixel (Android 14+) and a Samsung on default battery settings.
- **What.** Schedule next-day 18:00; record delivery time and `activation_nudge_presented`; write results in `experiments.md`. Pass = delivered within 1 h on both;
  fail → Android gets card + sheet without reminder copy [SOURCE: board/99 §4; Android alarms docs as cited there].
  **Why it matters more than a gate (V2 §5.1 item 5):** T32's reminder and T34 are the plan's **only test of a re-engagement message** — in week 1, 1 of 426 new users got a
  server push, 6 persons ever had a local reminder scheduled, and only 55 of 426 have a push token. The push-token gap (`push-tokens-investigation.md`; FCM via vc99 or 3.29.0,
  T18) is a prerequisite: record Android token registration for the test devices in the same table.

#### T34 — Day-1 fallback local notification (test arm)
- **Type** experiment · **Size** S–M · **Depends** T30, T32, T33 · **Specs** FS-EXP1 (d1 chain) · **Release** Release B · **Constraints** one activation notification per rider in week 1; Apple 4.5.4 (no Pro/price/"free").
- **What.** Granted test-arm riders with no plan and no core action by end of day 0 → one `activation` notification next day 18:00 local, `source:'d1_fallback'`, goal-branched copy
  (`maintain_bike` copy = D13 owner bet), cancelled by any core action. Jest scheduling rules. Stop rule: revocations test ≥ control + 3 after 4 weeks → disable d1 only.
  This is the only notification lever Exp 1 tests (V2 §5.1 item 5): cutting T34 for time means Exp 1 tests no notification at all. `maintain_bike` riders are read on S1 and
  days 7–13, never S3 (they return on days 7–13, 7/65, not day 2, 3/72) [SOURCE: V2 §5.1 item 6].

#### T35 — Release B (3.30.0) and Experiment 1 launch
- **Type** release/experiment · **Size** S · **Depends (hard) — the Exp 1 minimum set:** T02, T05c, T05d, T09, T10, T18, T30 (incl. its API part deployed), T31, T32, T33, T34, **T00** (pre-promotion E2E needs the iOS simulator; validation) · **Soft:** the P2 tasks (T19a–T28; T29 targets Release A) merged by the **Release B code freeze 2026-12-05** (T19a only together with T20); any P2 task not merged by then goes into the **next store build** (D17); T27 and T29, if they miss the freeze, ship in the first binary **after** the slot, so D12 holds (no both-arm change inside the slot) · **Blocks** T40 ·
  **Constraints** D2, D13, D14; latest start 2027-01-06 [SOURCE: board/99 D7].
- **What.** Store builds 3.30.0 both platforms with the Exp 1 code and the flag defaulting to control; E2E as T18 plus `first-ride-plan-card.yaml`,
  `ride-standstill-teaching.yaml` in both arms. Ledger signed (D13); the implementing agent creates the PostHog flag 50/50, no targeting (D2). On the D16 day (3.30.0 ≥ 90% of new
  installs on both platforms, not later than 2027-01-06) set the start server-side in `activationExperimentWindow` and flip the flag the same day.
  Annotation `#365 Exp1 launch 3.30.0 lvl <N>`; §6 row.
- **Verification.** Daily: Miller counts (ship if T − C ≥ 16; stop no-winner at T + C = 64); weekly SRM per platform × region; crash rate by arm.

### P4 — Follow-ups

#### T36 — Decide on Credential Manager for Android Google sign-in
- **Type** research → enhancement · **Size** M (L with store release) · **Depends** T04a, T18 (2–4 weeks of `auth_oauth_*` counted from **3.29.0 go-live per platform**: the OAuth events ship first in 3.29.0 (D17); R5 proxy SQL is the pre-fix comparison) · **Specs** FS-OB2a · **Constraints** D15; native → store release only.
- **Why.** The free module uses the deprecated legacy Google Sign-In SDK on Android [SOURCE: R5 C1–C2, Context7 docs cited there]; every OB2 replay is Android [SOURCE: R5 Q17].
- **What.** If "started, no result" ≥ 10% of Android Google starts, spike Credential Manager behind a flag; device check Pixel + Samsung; else close with the numbers.
- **Verification.** Android Google started→success ≥ 90% on the new build.

#### T37 — Persist the NHTSA model catalog (only if needed) — CLOSED 2026-11-12, moved to the ledger (§10)
- **Type** enhancement · **Size** S · **Depends** T04/T25 data showing `model_fetch_ms` p90 > 3 s · **Release** API deploy · Files `apps/api/src/modules/motorcycles/nhtsa.service.ts:387-425`, `apps/api/src/modules/redis/*`. Target p90 ≤ 1.5 s.

#### T38 — Keep the onboarding run across a same-user session drop (conditional)
- **Type** bug · **Size** S · **Depends** T04b, T18 + 4 weeks counted from **3.29.0 go-live per platform** (`auth_session_lost` ships first in 3.29.0, D17; R1 proxy SQL is the pre-fix comparison) · **Release** next store build · **Specs** FS-OB1f · Only if `auth_session_lost {during_onboarding:true}` ≥ 2 riders/month: keep the store when the next session is the
  same user id; login copy "Sign in to continue setting up". Files `lib/auth-state-change.ts`, `app/_layout.tsx`. Jest `lib/__tests__/auth-state-change.test.ts`.

#### T39 — Backfill service schedules for existing onboarding bikes; seed missing model rows
- **Type** enhancement (data) · **Size** S–M · **Depends** T07a **including its D7 reminder cap, live in production**, D7 · **Release** **owner-executed** (like migrations): a reviewed `SECURITY DEFINER` RPC in a migration
  that the owner applies and runs, after a dry-run SELECT of the target rows; never a service-role script writing user rows [review item 11; CLAUDE.md hard rules]; model rows via the data pipeline (memory `project_data_sourcing_pipeline`), MT-07 first [SOURCE: board/99 Exp 2 step 2].
- **Function hardening (doc review item 8).** The migration sets `SET search_path = ''` on the function and `REVOKE EXECUTE ON FUNCTION … FROM PUBLIC, anon, authenticated`,
  with no `GRANT` to `authenticated`. A `supabase/checks/` assertion requires `has_function_privilege('authenticated', fn, 'EXECUTE') = false` and the same for `'anon'`.
  The dry run prints per-tier counts and a correctness sample: for imperial bikes `target_mileage − current_mileage = round(interval_km / 1.609344)` ±1, and each
  `oem_schedule_id` is the verified schedule of the tier the API would pick. A follow-up migration drops the function after the owner's run.
- **Verification.** DB: share of live onboarding bikes with ≥ 1 OEM task. **Risks.** Reminder burst for old riders — prevented by T07a's per-bike cap (one push per bike per 7 days).

#### T40 — Experiment 1 readout and ship/revert
- **Type** experiment · **Depends** T35 · **When** a Miller boundary fires or 2027-03-31. One-sided z-test at the cap on everyone enrolled + 90% interval, **computed stratified
  (Mantel–Haenszel) on goal `track_rides` vs other × platform**, both set before assignment; `returning_account` riders excluded from the primary and reported separately; one
  pre-specified subgroup, `track_rides` (V2 §5.1 items 2, 4); **keep if the 90% lower bound > −3 pts, else revert**; qualitative signals are reported beside the decision but do not gate it (D13, doc review item 6h) [SOURCE: board/99 §4]. A capped
  no-winner means "no doubling shown", not "no effect". Cut the readout at every both-arm change date in the ledger.

#### T41 — Post-slot candidates and replay re-run per fix level — CLOSED 2026-11-12, moved to the ledger (§10)
- **Type** research · **Depends** T35 (and T40 for the candidates) · Queue, in order: P05.3 install-reason card, P05.2 plate "Set up service plan", day-1 nudge own slot (spring, only if Exp 1 wins),
  P04.3a iOS provisional. Re-run the R6 returner comparison on ~100 first sessions per `activation_fix_level` (needs owner approval for any new Replay Vision scan).

### Common fields for P1–P4 tasks that do not state them

- **Out of scope (all):** any change to onboarding paywall surfaces, their order or copy; `FREE_TIER_LIMITS`; ride floors; AI-diagnostics promotion; India targeting.
- **Risks (all):** small numbers (~7 installs/day) — read mechanical metrics as counts and outcomes as harm checks; consent gap (EEA decliners invisible, 17–27% of new users
  [SOURCE: evidence pack §1]); a both-arm change during Exp 1 must be logged with its date (T02 ledger) so the readout can be cut.
- **Blocks:** where a task does not list it, read it from the §2 dependency graph.
- **Release path rule:** see §3A.0 rule 1 (D17). Short form: mobile JS (features, UI, experiment, events, testIDs) → the next store build only (new riders' first session runs the binary's JS) [SOURCE: R3 RC-2]; OTA only for a crash/data-loss hotfix; API → Render deploy before the dependent store build;
  DB change → migration file, applied to production only by the owner (CLAUDE.md "Changing a data model").

---

---

## 3A. Revised task list after review (supersedes §3 where they differ)

§3 stays as the long-form reasoning for each task. Where §3A splits, re-orders or changes a task, §3A wins, and the issue draft in
`issues/<order>-<task id>-<slug>.md` is the final spec an agent implements.

### 3A.0 Release-path rules (apply to every task) [review items 1, 3, 4, 5, 30]

1. **Release paths (owner rule D17, 2026-11-12; replaces the per-runtime OTA rule).** Only three release paths carry #365 work:
   **store builds** (3.29.0 = Release A, T18; 3.30.0 = Release B, T35; later fixes = the next store build, App Store + Play, bumped app version),
   **API deploys** (Render) and **owner-applied migrations**. Every new functionality — features, UI changes, the experiment, new events/instrumentation, testIDs —
   ships only in a store build. **OTA is used only for an urgent crash or data-loss hotfix** per `docs/runbooks/mobile-ota.md` (`--environment production` or the
   `Mobile OTA Update` workflow, never a local env file, owner go-ahead per publish; CLAUDE.md hard rule).
   Why (facts that still hold): `runtimeVersion.policy: 'appVersion'` [SOURCE: apps/mobile/app.config.ts:59-61], so an OTA reaches only binaries whose `version` equals the
   runtime it was published for [SOURCE: docs/runbooks/mobile-ota.md:3, 173-176], and an OTA applies on the next launch, so a new rider's first session runs the binary's
   embedded JS [SOURCE: R3 RC-2]; per-runtime release-branch OTAs were complex and risked rolling back OTAs riders already run (doc review item 3).
   A hotfix OTA to an older runtime follows the runbook (branch from that runtime's latest production update commit, native-diff check; memory `reference_ota_hotfix_older_runtime`).
   **Runtime 3.27.0 has never received an OTA** (EAS `production` branch, V3 §1), so a 3.27.0 crash/data-loss hotfix is the first update on that runtime and branches from the
   **store-build commit `2ce57d1d`** (iOS b108 / Android vc95). Latest groups on 2026-11-12: 3.28.0 `fece7a3c` (`5a497a1c`), 3.26.0 `bd05b306` (`0b099fd3`).
   **Consequence for measurement:** the P0 instrumentation (T01, T04a–c, T05a–e incl. T05c's guard-sheet render change and testIDs) first reaches riders in **3.29.0**
   (T05e is server-side and ships by API deploy). Every client-event baseline (FS-OB* first-session and post-onboarding), and the data-gate windows of T14b, T15b, T36 and T38,
   count from **3.29.0 go-live per platform**, with the R1/R5 proxy SQL (`$screen`-based) as the pre-fix comparison. The former TR0 instrumentation OTA is removed (D17).
2. **Level bump only at a release cut.** `ACTIVATION_FIX_LEVEL` changes only in the commit that cuts a store build (T18, T35, later store builds) or a crash/data-loss hotfix OTA publish.
   PRs never bump it. The same commit updates the friction status table (§6.1), the only spec-to-level record (no code map; doc review item 13). Levels: 0 = pre-release JS
   (T01's initial constant; dev/preview builds only), **1 = not used** (it was TR0, removed by D17; numbers are kept so the drafts' levels stay valid), 2 = Release A (3.29.0),
   3 = Release B (3.30.0), 4+ = later store builds and any crash/data-loss hotfix OTA.
3. **Order for API + client changes** (incl. T30's `activationExperimentWindow`, deployed before the 3.30.0 cut): merge API PR → Render deploy finishes (check the deploy is live, memory `project_render_env_needs_deploy`) → `pnpm generate` on `main`
   (it reads production) → client PR → store build [SOURCE: CLAUDE.md "Commands"; memory `project_vercel_render_deploy_race`]. Old clients must keep working (nullable fields only).
4. **No deploy without a baseline and an annotation.** Every production change (API deploy, store build, hotfix OTA) is blocked until (a) T02 recorded the baselines of the specs it
   touches and (b) T03a's procedure exists; on go-live the annotation is made **per platform** (and per runtime for a hotfix OTA; Android and iOS go live on different days).
5. **PostHog writes from a named list (D2, aligned by doc review item 6e):** each task that needs PostHog writes lists them (insight names, annotation text) in a per-release
   list; the **implementing agent** makes the writes from that list and records each id in §6; the list is shared with the owner for information, not for approval. SQL insights support alerts [SOURCE: PostHog docs "Alerts", docs-search 2026-11-12]; the free tier allows 5 alerts in total, so #365 uses at most 2.
6. **DB metrics (D2b, ruled B + C):** PostHog has no Supabase/Postgres warehouse source [SOURCE: review W2, W3]. So:
   (B) facts that matter per release become **server-side PostHog events**: `service_plan_imported` (T07a), `onboarding_bike_created {capture_level, make_valid}` and
   `ride_saved {below_min, distance_m, duration_s, is_first}` (T05e); push tokens use the existing `push_token_registered` (`lib/push-token.ts:132`).
   **Server events respect analytics consent (doc review 2026-11-12, item 1).** Each server event resolves the rider's decision with `readAnalyticsDecision(preferences, signupMetadata)`
   and `hasAnalyticsConsent` (`apps/api/src/modules/analytics/analytics-consent.ts:18-38`), as `signup-events.service.ts:185-198` does. With consent: `distinct_id` = user id.
   Without consent, **or when no decision is stored yet** (e.g. OAuth sign-ups inside `completeOnboarding`; stricter than `hasAnalyticsConsent`'s NULL rule): a constant,
   non-identifying `distinct_id` per event (pattern `ANONYMOUS_DISTINCT_ID`, `signup-events.service.ts:24`) plus `NO_CONSENT_PROPERTIES` (`$process_person_profile: false`,
   `analytics-consent.ts:45-48`). Never email. Each event has a jest case: decision `false` or missing → no user id in the payload;
   (C) the rest (S4(a)/(b) DB form, FS-R2-4, FS-OB1e cross-check, FS-PO4b DB share) are **weekly DB checks**: `queries/db/<spec>.sql`, each file starting with `BEGIN READ ONLY;`
   and ending with `COMMIT;`, run read-only by the agent or owner every Monday via the Supabase Management API SELECT recipe, result row appended to `experiments.md`,
   plus a PostHog annotation when a threshold is crossed. No warehouse connection of the production DB to PostHog (D2b).
7. **Both-arm changes** during the onboarding paywall A/B or Exp 1 are logged in `experiments.md` with the go-live date per platform (T02 ledger). T27 ships in Release B,
   the same binary as Exp 1's launch: a **launch-day both-arm change**, read on mechanical metrics only (review item 29). **T29 targets Release A** (validation: FS-PO8 hits
   42/43 Android Discover openers); if it misses the Release A cut it ships in Release B as a launch-day both-arm change, like T27.
8. **T19a and T20 ship in the same build** (validation, V4): T19a's "only Welcome returns `false`" reproduces RC-D on the next warm launch unless T20 is in the same binary.
9. **Test environment first (T00, validation V3/V4):** no iOS simulator runtime, no Supabase CLI, no repo-replayable schema and no Android E2E build existed on 2026-11-12, so
   every task whose acceptance needs Maestro, and both release tasks, depend on T00.

### 3A.1 Ordered task list (issue order)

| # | Task | Title | Type | Phase | Size | Depends on | Release path |
|---|---|---|---|---|---|---|---|
| 00 | T00 | Test environment setup: iOS sim runtime, pinned Supabase CLI, local stack at the latest migration, `e2e-android` build recipe, `pnpm install` (validation V3/V4) | setup | P0 | S–M | — | local setup + `eas.json` profile (no app code, nothing reaches riders) |
| 01 | T01 | Release marker super properties + `e2e_run`; `platform` non-null on 100% of opens incl. the first | instrumentation | P0 | S | T00 | Release A 3.29.0 |
| 02 | T02 | `experiments.md` ledger, baselines, SQL files, weekly DB check, e2e exclusion | research | P0 | M | — | docs commit |
| 03 | T03a | Release-marking runbook (store builds; hotfix-OTA exception), friction status table | instrumentation | P0 | S | T02 | docs commit |
| 04 | T03b | PostHog dashboard "#365 Activation & frictions" (first tile: Day-1 drop-off funnel), 2 alerts, weekly cohort table | instrumentation | P0 | M | T01, T02, T03a | PostHog writes by the agent from the named list (D2) |
| 05 | T04a | OAuth/auth events incl. `auth_error_alert_shown` | instrumentation | P0 | S | T01 | Release A 3.29.0 |
| 06 | T04b | Onboarding navigation, resume and gate events | instrumentation | P0 | M | T01 | Release A 3.29.0 |
| 07 | T04c | `bike_setup_summary` event | instrumentation | P0 | S | T01 | Release A 3.29.0 |
| 08 | T05a | Paywall `trigger`/`gate_policy` props + `paywall_suppressed`/`limit_sheet_viewed` constants | instrumentation | P0 | S | T01 | Release A 3.29.0 |
| 09 | T05b | Diagnostics events: `diagnostic_started` once per entry, failure reasons | instrumentation | P0 | S | T01 | Release A 3.29.0 |
| 10 | T05c | Ride guard props, ride/HUD testIDs, guard sheet in a11y tree, `log-ride.yaml` on ids | instrumentation | P0 | M | T01, T00 | Release A 3.29.0 (event props, sheet render, testIDs) |
| 11 | T05d | Landing, Discover screen-load and bike-edit events, F14 route constant, `source` on task completion, tab/checklist testIDs | instrumentation | P0 | M | T01 | Release A 3.29.0 |
| 12 | T05e | API server events `onboarding_bike_created`, `ride_saved` | instrumentation | P0 | S | T02, T03a | API deploy |
| 13 | T06 | Research batch (no code) | research | P0 | S | — | docs |
| 15 | T07a | Exp 2: import the service schedule when onboarding creates the bike (API) + D7 per-bike reminder cap | bug | P1 | M | T02, T03a | API deploy |
| 16 | T07b | Client reads service-plan fields; service-plan Maestro flows | bug | P1 | S | T00, T07a | Release A |
| 17 | T08 | Diagnostics: stop the "Try Again" limit loop | bug | P1 | S | T00, T05b | Release A |
| 18 | T09 | A standstill ride ended from the guard is not saved | bug | P1 | M | T00, T05c | Release A |
| 19 | T10 | Checklist "first ride" row: no tick without a real ride | bug | P1 | S | T00, T05d | Release A |
| 20 | T11 | Onboarding sign-in advances when the session lands; OAuth double-tap guard | bug | P1 | S | T00, T04a, T04b | Release A |
| 21 | T12 | Account screen: busy state, silent cancel, bounded wait | bug | P1 | M | T00, T04a | Release A |
| 22 | T13a | Persist the account/code draft (store v10 migration) | bug | P1 | M | T00, T04b | Release A |
| 23 | T13b | Persist the bike draft; goals seeds from `ridingGoals`; resume to a monotonic `furthestScreen` | bug | P1 | M | T13a, T04c, T00 | Release A |
| 24 | T14 | Local onboarding-completion flag survives a cold start | bug | P1 | S | T00, T04b, T06 | Release A |
| 25 | T15 | Guard: an auth blip after completion never routes to `(auth)` | bug | P1 | S | T00, T04b | Release A |
| 26 | T16a | "Open my garage" once: idempotent CTA, Retry only on failure | bug | P1 | S | T00, T05d | Release A |
| 27 | T16b | At most one sheet over Home on landing (+ `landing_sheet_shown`) | bug | P1 | M | T00, T05d | Release A |
| 28 | T17 | Diagnosis failures: offline pre-check, 75 s deadline, localized errors | bug | P1 | M | T00, T05b, T08 | Release A |
| 29 | T18 | Release A: store 3.29.0 (lvl 2), first release of the P0 instrumentation; vc99/FCM steps | release | P1 | S | T00, T01, T04a, T04b, T04c, T05a, T05b, T05c, T05d, T07b–T17 (T29 soft) | store builds |
| 30 | T19a | Android Back steps once and leaves onboarding | enhancement | P2 | M | T04b, T00 | Release B, same build as T20 |
| 31 | T19b | iOS swipe-back cannot rewind past the account step | enhancement | P2 | S | T00, T04b | Release B |
| 32 | T20 | Welcome resumes on any non-Back remount (trigger found: Back out + warm launch) | bug | P2 | S | T19a, T00 | Release B, same build as T19a |
| 33 | T21 | `LimitSheet` and a session frequency cap for gate paywalls | enhancement | P2 | M | T00, T05a | Release B |
| 34 | T23 | Edit make/model/year refreshes the schedule (API) + dedup ignores retired tasks | enhancement | P2 | M | T07a | API deploy |
| 35 | T22 | Bike limit: "Update my bike" before "Add a second bike (Pro)" | enhancement | P2 | M | T00, T21, T23, T05d | Release B |
| 36 | T24 | Exhausted diagnose CTA opens the LimitSheet; "1 bike on Free" hint | enhancement | P2 | S | T00, T21, T08 | Release B |
| 37 | T25a | API: models ranked popular-first | enhancement | P2 | S | T04c | API deploy |
| 38 | T25b | Client bike search: make+model in one search, year first, no junk makes | enhancement | P2 | M | T00, T25a | Release B |
| 39 | T26 | "Add your model" row for make-only bikes in the bike hub | enhancement | P2 | S | T00, T23 | Release B |
| 40 | T27 | Start Ride first open: clear Start, bike preselected, no silent spinner — the P2 task most likely to move return | enhancement | P2 | M | T05c, T00 | Release B (launch-day both-arm) |
| 41 | T28 | Home taps always respond | bug | P2 | M | T00, T05d | Release B |
| 42 | T29 | Discover first open: no unprompted location ask; skeleton, timeout, Retry (FS-PO8: 42/43 Android) | enhancement | **P1** (raised) | M | T05d, T06, T00 | **Release A**; if it misses the cut, first in Release B (launch-day both-arm) |
| 43 | T30 | Exp 1 flag, sticky assignment, start/stop window served by the API (+ embedded ceilings) | experiment | P3 | M | T00, T05d, T02 | API deploy before the 3.30.0 cut + Release B |
| 44 | T31 | Teaching sheet for a standstill first ride (test arm) | experiment | P3 | M | T00, T09, T30, T05c | Release B |
| 45 | T32 | "When's your next ride?" plan card + local scheduler (test arm) | experiment | P3 | M | T00, T10, T30 | Release B |
| 46 | T33 | Android next-day local notification delivery check | research | P3 | S | T32 | device check |
| 47 | T34 | Day-1 fallback local notification (test arm) | experiment | P3 | S | T30, T32, T33 | Release B |
| 48 | T35 | Release B 3.30.0 (lvl 3) + Exp 1 launch | release | P3 | S | T00, T02, T05c, T05d, T09, T10, T18, T30–T34 (P2 soft) | store builds + flag |
| 49 | T14b | Cached `me` cannot say "not completed"; server idempotency (conditional) | bug | P4 | S | T18 (window from 3.29.0 go-live) | next store build |
| 50 | T15b | Investigate and fix sign-in screens after completion (conditional) | bug | P4 | M | T18 (window from 3.29.0 go-live), T06 | next store build |
| 51 | T36 | Decide on Credential Manager for Android Google sign-in | research | P4 | M | T04a, T18 (window from 3.29.0 go-live) | store build if yes |
| 53 | T38 | Keep the onboarding run across a same-user session drop (conditional) | bug | P4 | S | T04b, T18 (window from 3.29.0 go-live) | next store build |
| 54 | T39 | Backfill schedules for existing onboarding bikes (owner-run; hardened function, dropped after the run) | enhancement | P4 | M | T07a (reminder cap live) | owner-applied migration |
| 55 | T40 | Experiment 1 readout and ship/revert (stratified MH test; `returning_account` excluded; `track_rides` subgroup) | experiment | P4 | S | T35 | decision |

### 3A.2 What changed per task (deltas against §3)

- **T01** registers the marker at client creation (`lib/analytics.ts:55`) and on consent; `platform` is moved earlier, not added; adds `e2e_run` (`EXPO_PUBLIC_E2E_RUN === '1'`);
  the level is bumped only at release cuts (3A.0 rule 2). No `ACTIVATION_FIXES` map (dropped in doc review item 13; §6.1 is the record).
- **T02** also: e2e exclusion (`{E2E_PERSONS}` list; runners set `users.is_synthetic = true` for created users, `scripts/run-onboarding-e2e.sh`), the weekly DB check
  files `queries/db/*.sql`, the S3 engaged-return SQL, S6 SQL (R6:276-284), FS-PO9 SQL. Size S → M.
- **T03 → T03a + T03b.** T03a: runbook text (release marking per platform for store builds, per platform × runtime for a crash/data-loss hotfix OTA (D17), 2/4/8-week reads, friction status table). T03b: dashboard, tiles,
  2 alerts (SQL insights), the saved weekly install-cohort table (board instrumentation #10) — written by the implementing agent from the named list (D2). **The first tile
  (doc review item 12) is "Day-1 drop-off funnel"**: first seen → `onboarding_started` → `onboarding_completed` → core action in week 1 → engaged day-2 return, by `{REL}`,
  checked against `00-evidence-pack.md` §2 (793 first seen, 367 completers, 61 week-1 core action, 39 engaged day-2). FS-OB7, FS-PO9, FS-PO11 and FS-PO15/16 keep their SQL in
  `queries/fs/` but get **no tile** (item 13).
- **T04 → T04a/b/c** (OAuth/auth incl. `auth_error_alert_shown`; onboarding nav/resume/gate; `bike_setup_summary`).
- **T05 → T05a/b/c/d + T05e.** T05d adds board instrumentation #7 (`source` on `maintenance_task_completed`) and #8 (F14 engaged route allow-list constant + test) and the
  `landing_sheet_shown` constant; T05e is the API side of D2b.
- **TR0** — Removed by D17 (2026-11-12): instrumentation ships in Release A 3.29.0.
- **T07 → T07a (API) + T07b (client + Maestro).** T07a is blocked by T02/T03a (baseline + annotation) and **contains the D7 per-bike reminder cap** in `sendDuePush`
  (doc review item 2), which ships before or with the import; T07b shows overdue items as "due now" and at most 3 tasks + "+N more" on Home/Service.
- **T08** ships its own in-form limit panel; T24 later moves the exhausted CTA to `LimitSheet`.
- **T13 → T13a/T13b** (the v9 → v10 store migration is in T13a; T13b adds the bike draft fields in a v11 step or re-uses v10 fields defined up front in T13a — T13a defines both drafts' types).
- **T14** keeps only the local completion flag (safe regardless of cause); the cached-`me` rule and server idempotency move to **T14b**, gated on 4 weeks of `gate_routed` counted from 3.29.0 go-live per platform (D17).
- **T15** keeps only the jest-backed guard "a session blip after completion never routes to `(auth)` nor resets onboarding"; investigation/fix moves to **T15b**.
- **T16 → T16a** (personalizing CTA/Retry; onboarding, **D1 covers it**, `onboarding-paywall-verify.yaml` both arms required) **+ T16b** (Home sheet queue, D11).
- **T17** uses `expo-network`, no native dependency.
- **T19 → T19a (Android) + T19b (iOS: `gestureEnabled: false` on steps after account in `app/(onboarding)/_layout.tsx`, in-screen back button kept).**
- **T20** stays in Release B: the fix (resume unless `from === 'back'`) is safe whatever the remount cause; the event names the cause.
- **T22** cites the existing edit-bike model search: `TEST_ID.MODEL_SEARCH = 'edit-bike-model-search'` (`app/(tabs)/(garage)/edit-bike.tsx:66-84`), rendered at `:540-583`;
  saving needs a model (`isValid`, `:288`). No picker reuse needed.
- **T23** adds the dedup fix (`deleted_at` filter) and a spec case "year change → same schedule ids → tasks re-created".
- **T25 → T25a (API ordering, deploy first) + T25b (client).** Placement check (review item 16): the onboarding paywall placement reads only the goals and the pending intent
  (`lib/onboarding-paywall.ts:44-50`); bike make/model/year are written as RevenueCat attributes "targeting only, not copy" (`:64-80`). T25b raises the share of riders
  with a model attribute; it does not change placement or variant. D1 sub-decision D1c: confirm no RevenueCat targeting rule reads `bikeModel`.
- **T30** reads the window from the API field `activationExperimentWindow {startAt, stopAt}` (doc review item 4; API part deploys before the 3.30.0 cut), with embedded hard
  ceilings `EXP1_STOP_AT = 2027-03-31` and latest start 2027-01-06: no local draw (and no PostHog-arm use) outside the window; null or unreachable window = everyone `control`
  with `source: 'pre_start'` and no exposure event. Stopping or starting needs no OTA: it is a server-side change. **D1 covers T30** (hooks into `handleContinue`).
- **T39** is owner-run via a reviewed `SECURITY DEFINER` RPC migration after a dry-run SELECT.
- **Validation deltas (2026-11-12, §11 has the full list):** new **T00** (test environment, first; blocks T05c, T18, T35 and every Maestro-accepted task); **T01** acceptance adds
  `platform` on 100% of opens incl. the first; **T13b** adds goals seeding from `ridingGoals` and a monotonic `furthestScreen` resume target; **T19a + T20** ship in the same build,
  T20 gets Maestro `onboarding-welcome-warm-resume.yaml`; **T29** moves to Release A (FS-PO8 42/43 Android); **T27** is the P2 task most likely to move return, with its own
  metric; **T30** adds `primary_goal` and `returning_account` to `activation_exposure`; **T40** reads S1 stratified (MH, goal × platform) with `returning_account` excluded and
  one pre-specified subgroup (`track_rides`); **T18** carries the vc99 steps; **T06** item 1 becomes a replay confirmation and item 8 a device check of the dialog type.

### 3A.3 Owner decisions added or changed

- **D1 (amended):** T11, T12, T13a, T13b, T14, T16a, T19a, T19b, T20, T25b, **T30** change onboarding screens identically in both paywall arms. **D1c:** confirm no RC targeting reads bike attributes (T25b).
- **D2 (amended; final ruling §9):** the implementing agent makes the PostHog writes from the named per-release list (T03b list; annotations from T03a) and records each id in §6; the list is shared with the owner for information.
- **D2b (new; final ruling §9):** DB metrics source — (B) server events + (C) weekly read-only DB check. No warehouse connection.
- **D14b (new; amended by D17):** no OTA of fixes to older runtimes (3.26.0–3.28.0); absolute except crash/data-loss hotfixes.
- **D17 (new, owner rule 2026-11-12):** new functionality ships only in store builds; OTA only for crash/data-loss hotfixes (§9 D17).
- **D11 (clarified by the validation, V5):** at most one **inline** Home card per session as well; the Exp 1 plan card wins, a later install-reason card waits for the next later-day open, in both arms.
- **D13 (implementation note, validation V2):** the single one-sided z-test at the cap is computed stratified (Mantel–Haenszel, goal `track_rides` vs other × platform); the detectable effect is stated as an absolute lift. Owner confirmation recommended (§11).
- **D16 (new, amended 2026-11-12):** Exp 1 start date (the day 3.30.0 is ≥ 90% of new installs on both platforms, not later than 2027-01-06), set **server-side** in
  `activationExperimentWindow` on that day, with the PostHog flag flip the same day. No OTA.

### 3A.4 testIDs: which task creates which id [review item 9]

Only `home-screen` (`app/(tabs)/(home)/index.tsx:269`), the `home-action-*` ids (`:132-150`), the `edit-bike-*` ids (`app/(tabs)/(garage)/edit-bike.tsx:66-84`)
and `hub-tab-dock` (`app/(tabs)/_layout.tsx:215`) exist on main. Every other id is created by exactly one task and checked with Maestro `inspect_screen` on iOS and Android
(output pasted in the PR):

| Task | testIDs it adds |
|---|---|
| T05c | `tab-ride-fab`, `start-ride-screen`, `start-ride-button`, `ride-hud-root`, `ride-guard-sheet`, `ride-guard-keep`, `ride-guard-end-anyway`, `ride-guard-variant-default` |
| T05d | `tab-home`, `tab-garage`, `tab-diagnose`, `tab-discover`, `tab-profile`, `checklist-row-<id>`, `garage-add-bike-header`, `segment-service`, `service-task-card-<n>`, `rides-empty-cta`, `diagnose-new` |
| T08 | `diagnose-limit-panel`, `diagnose-limit-see-pro`, `diagnose-limit-done` |
| T11 | `onboarding-sign-in-screen`, `onboarding-account-ready` |
| T16b | `recall-sheet`, `oem-imported-sheet`, `whats-new-sheet` |
| T19a | `goal-chip-<id>` and `goal-chip-<id>-selected` |
| T21 | `limit-sheet`, `limit-sheet-see-pro`, `limit-sheet-close` |
| T22 | `bike-limit-sheet`, `bike-limit-update`, `bike-limit-second-bike` |
| T24 | `diagnose-cta-exhausted`, `diagnose-step-bike` |
| T26 | `bike-hub-add-model-row` |
| T27 | `start-ride-bike-preselected`, `start-ride-location-required` |
| T29 | `near-you-use-location`, `trip-card-<n>`, `discover-skeleton`, `discover-retry` |
| T31 | `ride-guard-variant-teaching`, `ride-guard-got-it`, `ride-guard-remind-me` |
| T32 | `activation-plan-card`, `plan-chip-<when>`, `plan-card-scheduled`, `plan-card-change`, `plan-card-denied`, `plan-card-open-settings`, `plan-card-collapsed` |

---

## 4. Coverage table (every finding and every board proposal)

| Finding / proposal | Where it goes | Note |
|---|---|---|
| OB1 onboarding goes back | T11 (RC-A), T19 (RC-B), T13 (RC-C), T20 (RC-D), T14 (RC-E), T38 (RC-F); metrics T04 | four mechanisms, not one reset [SOURCE: R1 §3] |
| OB1-E post-auth 22/73 | T02 redefines (S6); FS-OB1 | 12 of 21 authenticated first [SOURCE: R1 Q1] |
| OB1-H relaunch/resume | T13 | |
| OB1-H2 null-session reset | T38 (conditional), T15 | not confirmed (20%) |
| OB2 Google blank/spinner | T04 (measure), T12 (spinner, cancel), T36 (Credential Manager) | |
| OB3 email code reset | T13 | |
| OB4 bike search slow | T25 (+ NHTSA cache ledger line, §10, if latency) | |
| OB5 leave sign-up without trying | T04 (measure, FS-OB5); no UI change | account gate is a product decision; 3 of 5 cited replays never reached account [SOURCE: R5 Q17] |
| OB6 "Open my garage" loops/Retry/black | T16, T14 | |
| OB7 leave right after onboarding paywall | **Not doing** (record only, FS-OB7 SQL file, no tile) | paywall A/B running, hard constraint |
| PO1 MAX_BIKES on "my" bike | T22 (+T21 sheet, T23 schedule refresh) | |
| PO1-H make-only bike → no schedule | T07 (Exp 2), T26, T23 | cause is the retired swipe deck, not blank models [SOURCE: R2 §3.1] |
| PO2 diagnostics first → limit/error/wait | T08, T17, T24; T06 item 2 (3.26.0 jump) | AI not promoted; T24 makes the CTA quieter |
| PO3 repeated paywalls | T21 | headline corrected: 3.26.0 8/121 [SOURCE: R3 Q5] |
| PO4 standstill "too short" | T09 (junk save, both arms), T31 (teaching, test arm) | |
| PO5 HUD opens after onboarding | **Not a bug** (92%); regression guard flow + alert in FS-PO5 (T05 testIDs, T03 alert) | [SOURCE: R4 §3.1] |
| PO6 dead taps / empty states | T28 | |
| PO7 slow/stuck Discover | T29 | |
| PO8 "Download maps" modal | T06 item 8 (watch + device check of the dialog type), T29 (location ask; **Release A**) | not an app string; validation: 42/43 Android first Discover visits background ≤ 2 s (≈ 70% an OS dialog) [SOURCE: V1-q36] |
| PO9 leave garage in ≤ 20 s | Exp 1 (T30–T35) outcome; FS-PO9 SQL file only (no tile) | behaviour, not a defect |
| PO10 checklist works | T10 (fix FIRST_RIDE), T32 (plan card replaces the row in test arm) | |
| PO11 What's New on day 0 | **Not doing** — settled since 3.25.0; FS-PO11 SQL file (no tile); `whats-new.yaml` stays green | [SOURCE: board/99 §1.7] |
| PO12 sign-in after completion (new, R6) | T15 | |
| PO13 back to onboarding after completion (new, R6) | T14, T15 | |
| PO14 Start Ride opened, no ride (new, R6) | T27 | day-0 ride start is the strongest returner predictor (V2) |
| Test environment gap (validation V3/V4: no iOS sim runtime, no Supabase CLI, no replayable schema, no Android E2E build) | **T00** | new task, first in order |
| Re-engagement message for riders outside the Exp 1 test arm (V2 "missing lever") | ledger follow-up after T40 (§10) | not a task this season |
| Acquisition quality: AI-chat referrals return 2× (V2) | ledger: growth hypothesis (§10) | outside #365 |
| PO15 receipt scan extraction fails (new, R6) | **Not doing now** — owned by the receipt-scan epic; n = 1 | |
| PO16 planned trip missing in My trips (new, R6) | **Not doing now** — SEEN once; verify before work | |
| PO17 competing landing sheets (new, R6) | T16 | |
| R2 junk makes (F-R2-5) | T25 | |
| R2 edit doesn't refresh schedule (F-R2-3) | T23, T26 | |
| R2 imperial targets (F-R2-4, latent) | T07 | |
| R3 RC-2 first session runs stale JS | T01 (`is_embedded_launch`), T18/T35 store binaries | |
| R4 junk ride saved; checklist ticks on tap | T09, T10 | new vs board |
| R6 3.26.0 diagnostics jump | T06 item 2 | |
| Measurement gaps (05 list 1–5; evidence pack §9) | T01, T04, T05 | |
| P06.1 scoreboard + ledger | T02, T03 | |
| P06.2 randomized slot | T30, T35, T40 | + 04's cap z-test [SOURCE: board/99 D3] |
| P02.1 / P03.1 plan card | T32 | |
| P02.2 / P01.1 / P03.2 / P05.1 teaching sheet | T31 (+T09 discard) | |
| P04.1 / P01.2 day-1 fallback | T34 (gated by T33) | |
| P04.2 Android FCM | **Done** in PR #393; verification only: T06 item 9, T03 tile, Release A/B | not re-planned |
| P05.2 step 5 import fix (Exp 2) | T07 (+T39 backfill/model rows) | |
| P05.2 plate "Set up service plan" | ledger post-slot queue, §10 (was T41) | board rank 11 |
| P05.3 install-reason card | ledger, §10 (was T41) — **card only** (V5) | email pool 0–21; card in a store binary, 3.30.0 at the latest or after the slot |
| P06.3 ship-on-no-harm | §0 reading rule; used by every P1/P2 task | |
| P04.3a iOS provisional | ledger post-slot queue, §10 (was T41) | after device check |
| P04.3b goal-matched permission copy | **Not doing this season** — onboarding screen inside the paywall A/B | |
| P03.3 Saturday message | **Parked** — one activation message per rider | |
| P01.3 / P02.3 | merged into P05.2 (T07, ledger) | withdrawn |

---

## 5. Friction specs

Format per spec: **Tasks** · (1) Repro (preconditions, account, platform) · (2) Expected after fix · (3) Automated check · (4) Production metric (definition,
SQL, baseline + source, target, breakdown). Unless stated: breakdown = `{REL}` of the cohort's first event; window = trailing 28 or 60 days; `{EXCL}` and `{RN}` applied.
"Verbatim at <file:lines>" means copy that SQL, replace its test-person placeholder by `{EXCL}` and add the `{REL}` columns. A task is done only when (3) passes and (4) is a tile on the T03 dashboard.

### FS-M — Fixes can be read per release
- **Tasks** T01, T03, T18. (1) Problem: an OTA keeps `$app_version` the same [SOURCE: R4 Q-R4-12], so nothing tells which JS ran. (2) From 3.29.0 (D17) every event carries the §0 marker; each release has an annotation.
- (3) Jest `lib/__tests__/analytics-release-marker.test.ts`. No E2E (Maestro cannot install an OTA in order) [SOURCE: R3 F-R3-2].
- (4) *(run, Q-P4 shape)* `SELECT toString(properties.$app_version) AS ver, toString(properties.activation_fix_level) AS lvl, count() FROM events WHERE timestamp >= now() - INTERVAL 3 DAY AND event = 'Application Opened' AND {RN} GROUP BY ver, lvl`.
  **Baseline 0%** [SOURCE: Q-P4]. **Target (superseded by §5A.2):** binary — 100% of opens with the new `$app_version` carry the expected level; crash/data-loss hotfix OTA (D17) — §5A.2 share.

### FS-OB1a — Onboarding sign-in screen does nothing after auth (RC-A)
- **Tasks** T11. (1) iOS sim or Android emulator, T00 E2E build pointed at the local stack (the runner creates users, so never production), `clearState`+`clearKeychain`; a confirmed account with `preferences.onboardingCompleted=false` (runner creates it);
  Welcome → "Already have an account? Sign in" → email + password. (2) Within 5 s the app leaves sign-in: unfinished → resume target or experience with the transient "Account ready" notice (`onboarding-account-ready`, 4 s);
  onboarded → Home. OAuth buttons disabled while a provider call is pending.
- (3) Maestro `onboarding-signin-unfinished-account.yaml` (runner `scripts/run-onboarding-signin-e2e.sh`): `clearState`, `clearKeychain`, `launchApp` → wait "Let's get started" →
  tap "Already have an account? Sign in" → consent `runFlow when` (as `_shared/onboarding-to-account.yaml`) → "Continue with email" → `inputText` email/password (tap a label to dismiss the custom keyboard) →
  submit → `extendedWaitUntil: {visible: ".*How long have you.*", timeout: 8000}` → `assertNotVisible: {id: "onboarding-sign-in-screen"}`; second case with an onboarded user → Home tab visible.
  Jest `app/(onboarding)/__tests__/sign-in-session-advance.test.tsx` and the double-tap test (OAuth success can't run in Maestro).
- (4) Riders whose auth happened while the last `$screen` was `/(onboarding)/sign-in` and who had no `$screen` in the next 10 s. *(run, Q-P7)*:
  ```sql
  WITH p AS (SELECT person_id, argMin(toString(properties.$app_version), timestamp) AS ver,
      arraySort(x -> tupleElement(x, 1), groupArrayIf(tuple(timestamp, toString(properties.$screen_name)), event = '$screen')) AS scr,
      groupArrayIf(timestamp, event IN ('user_signed_up','user_signed_in')) AS auths
    FROM events WHERE timestamp >= now() - INTERVAL 60 DAY AND {RN} AND {EXCL}
      AND event IN ('$screen','user_signed_up','user_signed_in') GROUP BY person_id HAVING length(auths) > 0)
  SELECT ver,
    countIf(arrayExists(a -> tupleElement(arrayLast(s -> tupleElement(s, 1) <= a, scr), 2) = '/(onboarding)/sign-in', auths)) AS riders_auth_on_signin,
    countIf(arrayExists(a -> tupleElement(arrayLast(s -> tupleElement(s, 1) <= a, scr), 2) = '/(onboarding)/sign-in'
      AND NOT arrayExists(s -> tupleElement(s, 1) > a AND tupleElement(s, 1) <= a + INTERVAL 10 SECOND, scr), auths)) AS riders_stuck
  FROM p GROUP BY ver ORDER BY ver
  ```
  (Add `lvl` via `argMin(toString(properties.activation_fix_level), timestamp)` after T01.) **Baseline 3.26.0: 6 of 10 stuck; 3.21.0 2/2** [SOURCE: Q-P7, matches R1 Q12]. **Target 0** (allow 1 genuine network failure) after ≥ 5 auths on the fix level.
  Secondary: riders with ≥ 2 auth events within 2 min, baseline 15/72 per 60 d [SOURCE: R1 Q11], target ≤ 2.

### FS-OB1b — Back-walk rewinds onboarding (RC-B)
- **Tasks** T19a (+ T20 in the same build). (1) Android emulator, gesture nav, T00 Android E2E build (or a universal APK of the store binary for the red run, as V4 did), anonymous; `_shared/onboarding-to-account.yaml`; press Back ×5. **Reproduced on 3.28.0 (V4 b1/b2, ~90%).** (2) One step per Back, answers kept, no paywall re-present;
  Back on experience goes to Welcome; Back on Welcome backgrounds the app; a warm launch shows the resume screen.
- (3) Maestro `onboarding-back-preserves.yaml` (tag `android`): to account → `pressKey: back` → goals with chosen chip `assertVisible: {id: "goal-chip-track_rides-selected"}` →
  back ×2 → bike setup with the chosen bike → Continue ×2 → account visible → back until experience → back → `assertVisible: "Let's get started"` (Welcome) → back →
  app backgrounded (`assertNotVisible: "Let's get started"`) → `launchApp` (no clearState, warm) → `assertVisible` the resume screen (`".*How long have you.*|.*bike.*"`). Jest `src/config/__tests__/onboarding.test.ts` `getPreviousRoute` cases.
  **Added by the validation (V4 a4, a3):** (i) **cold resume to account → Android Back → goals, not the launcher** (`stopApp` at account → `launchApp` → `pressKey: back` →
  `assertVisible` goals; today the app closes because the resumed screen is the stack root); (ii) a **replace-path** goals assertion: after the cold resume, Back to goals shows the
  chosen chip (`goal-chip-track_rides-selected`) — today it shows "0 of 5 picked" (fixed by T13b's goals seeding). The existing `goal-chip-…-selected` step passes on main only
  because the back-pop keeps goals mounted.
- (4) Starters with ≥ 3 backward `/(onboarding)/…` screen moves ≤ 5 s apart (R1 Q8 method — **now written down and run: `validation/V1-metrics.md` §3.2**, committed by T02 as
  `queries/fs/fs-ob1b.sql` beside the event form), and `uniqIf(person_id, event='onboarding_back' AND properties.trigger='hardware')` after T04b. Event form *(draft; `{REL}` platform per §0, not `$os`)*:
  ```sql
  SELECT ver, plat, count() AS starters, countIf(fast_backs >= 3) AS backwalkers, countIf(fast_backs >= 3 AND done) AS backwalkers_completed
  FROM (SELECT person_id, argMin(toString(properties.$app_version), timestamp) AS ver,
          coalesce(argMinIf(lower(toString(properties.platform)), timestamp, properties.platform IS NOT NULL), 'unknown') AS plat,
          countIf(event = 'onboarding_completed') > 0 AS done,
          countIf(event = 'onboarding_back' AND toInt(properties.ms_on_screen) <= 5000
                  AND toString(properties.trigger) IN ('hardware','gesture')) AS fast_backs   -- after T04b; keep R1 Q8's $screen method beside it [review item 23]
        FROM events WHERE timestamp >= now() - INTERVAL 28 DAY AND {RN} AND {EXCL}
          AND event IN ('onboarding_started','onboarding_back','onboarding_completed')
        GROUP BY person_id HAVING countIf(event = 'onboarding_started') > 0)
  GROUP BY ver, plat
  ```
  **Baseline (`$screen` method, 60 d to 2026-11-12): Android 28/201 (13.9%), 4 completed; iOS 14/72 (19.4%), 2 completed; platform unknown 7/36** [SOURCE: V1-q15, V1 §3.2] (R1 Q8 had
  Android 25/187, iOS 15/70). 3.19.x screen names are not mapped. **Target ≤ 5% Android (T19a); ≤ 8% iOS (T19b)** [UNBACKED — own target]; S2 not below trailing 8 weeks.

### FS-OB1c — Resume loses the screen and in-screen progress (RC-C)
- **Tasks** T13. (1) Android emulator, "Don't keep activities" ON; (a) bike setup: pick brand, type model → kill → relaunch; (b) see FS-OB3; (c) reach account with 2 goals picked → kill →
  relaunch → on-screen Back to goals; (d) reach account, walk back to experience, forward to bike-setup → kill → relaunch. (2) Reopens on bike setup with the brand selected;
  goals shows the picks (not "0 of 5 picked"); (d) resumes at the furthest screen reached (account), not bike-setup; a resume never lands on a screen before the one the rider left.
  **Reproduced on 3.28.0 (V4 a1–a5, ~85%):** screen-level resume works; make + query lost (a1); goals 0 picks on any remount (`goals.tsx:77`, a3); back-walk overwrites the resume point (a5).
- (3) Maestro `onboarding-bike-resume.yaml`: shared steps to bike setup → select a make (as `add-bike.yaml`) → `stopApp` → `launchApp` (no clearState) → `assertVisible` the make chip; second case (c): to account → `stopApp` → `launchApp` → back chevron → `assertVisible: {id: "goal-chip-track_rides-selected"}`. Jest store migration test (T13a), goals seeding test and monotonic `furthestScreen` test (T13b).
- (4) Completion **after** `onboarding_resumed` by `resume_target` — **use the ordered SQL in `validation/V1-metrics.md` §3.3** (R1's SQL at `deep-dives/R1-onboarding-reset.md:268-276` counted completions *before* the resume), plus `{REL}`, and after T04b/T13 the `restored_draft` share.
  **Baseline (60 d to 2026-11-12): bike-setup 8/31 (26%), account 5/13 (38%), goals 3/11** [SOURCE: V1-q17] (R1 Q13: 7/27, 5/15). **Target ≥ 50% each** (judge after ≥ 15 resumes per target).

### FS-OB1d — Welcome shows again in a live runtime (RC-D)
- **Tasks** T20 (same build as T19a). (1) **Reproduced on 3.28.0 (V4 b3, cause ~80%):** Android emulator; reach bike-setup (or any step) → Android Back until the app leaves the
  onboarding root → launch from the launcher while the process is cached (`LaunchState: WARM`) → Welcome "Let's get started" with no resume, although the store holds progress
  (`resumeHandledThisLaunch` is already `true`, `app/(onboarding)/index.tsx:23-29, 49`). Other triggers (OS activity recreation) may exist. (2) A Welcome mount with progress resumes unless it came from Back.
- (3) Jest `app/(onboarding)/__tests__/welcome-resume.test.tsx` (flag already true + `lastCompletedScreen` + no `from:'back'` → `router.replace` resume; **"flag true, new mount, no param → resume"**).
  **Maestro `onboarding-welcome-warm-resume.yaml` (tag `android`)**: to bike-setup → `pressKey: back` until the app is backgrounded → `launchApp` (no `stopApp`, no `clearState`) →
  `assertNotVisible: "Let's get started"`. Red first on `origin/main`.
- (4) `uniqIf(person_id, event='onboarding_welcome_mounted' AND properties.had_progress AND properties.reason != 'back')` by `{REL}` (after T04b). **Baseline (pre-event proxy) 12 riders / 60 d, 6 on 3.26.0** [SOURCE: V1-q37] (R1 Q4/Q10: 11 / 7). **Target 0**.

### FS-OB1e — A finished rider is routed back into onboarding (RC-E)
- **Tasks** T14. (1) iOS sim (T00 runtime) `e2e-simulator` build: finish `onboarding.yaml`; kill within 2 s of "Open my garage"; airplane mode on → relaunch (or seed the persisted cache with `onboardingCompleted:false` in a dev build).
  (2) Home (or offline banner on Home), never Welcome/experience.
- (3) Maestro `onboarding-complete-relaunch.yaml` (Android; iOS runs online): `runFlow: onboarding.yaml` → `stopApp` → `setAirplaneMode: enabled` → `launchApp` → `assertVisible` Home tab →
  `assertNotVisible: "Let's get started"` → `setAirplaneMode: disabled`. Jest `app/__tests__/navigation-gate.test.tsx` (local flag + cached `false` → tabs; network `true` → tabs; error, no flag → onboarding).
- (4) Completers with any `onboarding_step_viewed` (not paywall) after `onboarding_completed` + 5 s, and riders with ≥ 2 `onboarding_completed`. *(draft)*:
  ```sql
  SELECT ver, count() AS completers, countIf(relapse) AS relapsed, countIf(n_oc >= 2) AS completed_twice
  FROM (SELECT person_id, argMinIf(toString(properties.$app_version), timestamp, event = 'onboarding_completed') AS ver,
          minIf(timestamp, event = 'onboarding_completed') AS t0, countIf(event = 'onboarding_completed') AS n_oc,
          maxIf(timestamp, event = 'onboarding_step_viewed' AND toString(properties.step) != 'paywall') > t0 + INTERVAL 5 SECOND AS relapse
        FROM events WHERE timestamp >= now() - INTERVAL 60 DAY AND {RN} AND {EXCL}
          AND event IN ('onboarding_completed','onboarding_step_viewed') GROUP BY person_id HAVING n_oc > 0)
  GROUP BY ver
  ```
  **Baseline 10/292 (3.4%) relapsed, 6 completed twice** [SOURCE: V1-q18; R1 Q7 said "4", which is corrected to 6, as in FS-OB6(a)]. **Target 0** on the fix level. DB cross-check: accounts with 2 bikes created ≤ 2 min apart (2 users in 60 d, V1-db6).

### FS-OB1f — Session drop mid-onboarding wipes the run (RC-F / OB1-H2)
- **Tasks** T38 (conditional). (1) Android emulator; sign up at account; admin `auth.admin.signOut(userId)`; background 65 min → foreground. (2) Only if the event shows it matters:
  login says "Sign in to continue setting up", and the same user resumes at the saved step.
- (3) Jest `lib/__tests__/auth-state-change.test.ts` (null then SIGNED_IN same id keeps `lastCompletedScreen`; different id wipes). Maestro not possible (server revocation; candidate for the runner).
- (4) `uniqIf(person_id, event='auth_session_lost' AND properties.during_onboarding)` per month by `{REL}`. **Baseline unknown** (not instrumented). **Decision rule:** fix only if ≥ 2 riders/month.

### FS-OB2a — Google sign-in sheet hangs or is abandoned (Android)
- **Tasks** T04, T36. (1) Android emulator with a GMS image + a signed-in Google account — the T00 AVD (API 35 `google_apis`, GMS, no Play Store) if Google sign-in works on it, else the optional API-34 `google_apis_playstore` AVD from T00 (V3 item 6); account step → "Continue with Google": (a) Back on the picker, (b) double tap, (c) airplane mode after picking.
  (2) (a) back on account, no alert, buttons enabled, `outcome:'cancelled'`; (b) one sheet, busy state; (c) friendly network message ≤ 10 s, `outcome:'error', stage:'token_exchange'`.
- (3) Maestro `onboarding-oauth-cancel.yaml` (tag `android-oauth`): to account → tap Google → `extendedWaitUntil: {visible: "(?i)choose an account|sign in with google", timeout: 20000}` → `back` →
  `extendedWaitUntil: {visible: "Continue with Google"}` → `assertNotVisible: "Something went wrong.*"` → double tap (second `optional: true`) → picker once → `back`. Success path: jest
  `__tests__/hooks/use-oauth-sign-in.test.ts` (resolve / cancel / in-progress / network → one `auth_oauth_started` + one `auth_oauth_result`, no `presentOAuthError` on cancel).
- (4) Verbatim at `deep-dives/R5-signin-and-measurement.md:197-209` (M-OB2, replace `activation_release` by `activation_fix_level`); "started, no result" = started − (success+cancelled+error).
  **Baseline: no OAuth events yet; proxy Android account viewers without `signup_completed`, 10-15→11-12: 23/111 (20.7%)**; iOS 6/34; platform-null 5/28 [SOURCE: V1-q19, V1-q20] (R5 Q9: 20/124, 16.1%; the target ≤ 10% is now a larger relative drop). Proxy SQL verbatim at `R5…:213-221`, **without `{RN}` on `signup_completed`** (server event) and with the §0 person-level platform.
  **Target** Android account-step loss ≤ 10%; started-no-result ≤ 5% of Google starts.

### FS-OB2b — Long "Creating your account…" spinner after the session lands
- **Tasks** T12. (1) Sim/emulator; block the API host right after the Apple/Google sheet returns; sign in at account. (2) Overlay ≤ 8 s, flow advances, `me` keeps loading.
- (3) Jest `__tests__/screens/account-post-signin-wait.test.tsx` (fake timers). Not Maestro: the network can't be cut at that exact moment.
- (4) Seconds from server `signup_completed` to the **first onboarding step view after it** — **use `validation/V1-metrics.md` §3.5 (FS-OB2b)**: R5's form (`R5…:230-242`) used `minIf` over all views (could pick a view before sign-up), `any()` for platform and applied `{RN}` to the server event; gaps > 10 min count as "backgrounded", not as a wait. After T04a: `auth_post_signin_wait.wait_ms` p90.
  **Baseline since 10-15: 6/124 OAuth sign-ups > 10 s** (google-android 3/79, apple-ios 2/17, google-ios 1/10; one 98,915 s overnight gap excluded as backgrounded) [SOURCE: V1-q22] (R5 Q8: 6/105, max 141 s). **Target 0 > 10 s** (excluding backgrounded gaps) per 4 weeks.

### FS-OB2c — Cancelling Google shows "Something went wrong"
- **Tasks** T12. (1) As FS-OB2a(a). (2) No alert. (3) Covered by `onboarding-oauth-cancel.yaml` assertion and the jest cancel case.
- (4) `countIf(event='auth_error_alert_shown' AND properties.outcome='cancelled')` (new event, T04a, fired by `presentOAuthError`) over `countIf(event='auth_oauth_result' AND properties.outcome='cancelled')`, by `{REL}` [review item 21]. **Baseline:** every cancel alerts today (code: `lib/oauth.ts:169-171`, `lib/oauth-error-alert.ts:19`) [SOURCE: R5 C4]. **Target 0**.

### FS-OB3 — Email code lost when the rider leaves to read it
- **Tasks** T13. (1) iOS sim (T00 runtime), `e2e-simulator` build, fresh install → account → "Continue with email" → `delivered+…@resend.dev` + password → code step → terminate app → relaunch.
  (2) Reopens on "Enter your code" for the same address, no password field; code continues onboarding; > 1 h → email form prefilled.
- (3) Maestro: `run-onboarding-email-code-e2e.sh` with `RELAUNCH=1` → part 1 `onboarding-email-code-signup.yaml` → new `onboarding-email-code-relaunch.yaml`: `stopApp` →
  `launchApp: {clearState: false}` → `extendedWaitUntil: {visible: "Enter your code", timeout: 30000}` → `assertVisible: "${TEST_EMAIL}"` → part 2 `onboarding-email-code-verify.yaml`.
  Jest `__tests__/hooks/use-email-code-step.test.ts` (persists `{email, sentAt}`, never the password).
- (4) Verbatim at `R5…:251-260` (M-OB3; replace `activation_release` by `activation_fix_level`). **Baseline 16/19 verified (84%), 1 lost after relaunch** [SOURCE: R5 Q13; reproduced 19 sent / 16 verified, V1-q23]. **Target** restored = relaunched-with-code (100%); verified ≥ 90% (60 d).

### FS-OB4 — Bike search is slow and ends without a model
- **Tasks** T25. (1) Any platform, fresh install, bike setup; task "Yamaha MT-07, 2019": type "Yamaha MT-07" in the make search. (2) A "Yamaha MT-07" row appears directly; year chosen before/with the model; popular models first.
- (3) Maestro `onboarding-bike-search.yaml`: `_shared/onboarding-to-bike-setup.yaml` → tap "Start typing your bike.*" → `inputText: "Yamaha MT-07"` → `extendedWaitUntil: {visible: "(?i)MT-07", timeout: 15000}` →
  tap → year 2019 → Continue → reveal shows "MT-07"; repeat with "mt07". Jest `make-grid-search.test.tsx`, `model-picker-ranking.test.tsx`.
- (4) Dwell bike_setup viewed → completed/skipped and model share — verbatim at `R5…:269-283` (M-OB4). **Baseline p50 44 s Android / 37 s iOS, p90 146 / 109 s; model 62/141 (44%)** [SOURCE: R5 Q14, Q16];
  share > 60 s 3.26.0 56/133 (42%) [SOURCE: R6-q8]. **Validation re-run since 10-15 (V1-q24):** p50 45 s Android / 43 s iOS, p90 229 / 120 s; model 77/169 (45.6%); > 60 s 73/190 (38%) —
  the Android p90 depends on the window, so T02 fixes the window (trailing 28 d by first `onboarding_started`) before the p90 target is judged. **Target p50 ≤ 25 s, p90 ≤ 75 s, model ≥ 60%, > 60 s ≤ 25%.**

### FS-OB5 — Riders leave the sign-up screen without trying
- **Tasks** T04 (measure only). (1) Device check: Android 5.5" fresh install, account step shows all options + reassurance without scrolling, light and dark. (2) We know the split tried vs not.
- (3) Maestro `onboarding-account-visible.yaml` (asserts "Continue with Google", "Continue with email", "Already have an account?"; iOS also Apple). Jest: `auth_email_submitted` fires on submit.
- (4) Verbatim at `R5…:292-299` (M-OB5; replace `activation_release` by `activation_fix_level`; no `{RN}` on `signup_completed`). **Baseline** loss 23/111 Android since 10-15 (FS-OB2a proxy, V1-q19); proxy "stopped at account, never authed" with the SQL in `validation/V1-metrics.md` §3.4 (R6-q8's SQL is not in the repo): **3.26.0 18/166, all 46/470** [SOURCE: V1-q25] (R6-q8: 21/166, 63/472). **Target:** establish the split (2–4 weeks); no target until then.

### FS-OB6 — "Open my garage" loops, shows Retry, or a blank screen
- **Tasks** T16, T14. (1) iOS sim + Android emulator, "3G/High latency" link conditioner, fresh install, finish onboarding in each paywall arm, tap "Open my garage" once.
  (2) Home within 5 s; personalizing never again; no Retry with all ticked; no blank screen > 3 s.
- (3) Maestro `post-onboarding-landing.yaml`: `runFlow: onboarding.yaml` → `extendedWaitUntil: {visible: {id: "home-screen"}, timeout: 10000}` → `assertNotVisible: ".*Personalizing.*|Open my garage|Retry"` →
  wait 5 s → assert again → `takeScreenshot` light; runner repeats in dark (`xcrun simctl ui booted appearance dark` / `adb shell cmd uimode night yes`). Jest `app/(onboarding)/__tests__/personalizing.test.tsx`.
- (4) (a) completed twice — verbatim at `R6…:340-345` with SCOREBOARD-CTE at `R6…:250-261`; (b) p90 `post_onboarding_landed.ms_since_cta` (after T05).
  **Baseline (a) 6/282 (2.1%)** [SOURCE: R6-q3; reproduced 6/292, V1-q18 — use FS-OB1e's per-completer SQL, not the SCOREBOARD join]; (b) none. **Target (a) 0; (b) p90 < 3,000 ms.**

### FS-OB7 — Riders leave right after the onboarding paywall (record only)
- **Tasks** none (paywall A/B running). (4) Last `onboarding_step_viewed` = `paywall` among non-completers, by `onboarding_variant` and `{REL}`. **Baseline 3 of 67 drop-offs (28 d)** [SOURCE: 05 §A]; 60 d: 13/216 non-completers (3.26.0 2/70, 3.19.0 10/73) with `validation/V1-metrics.md` §3.4 [SOURCE: V1-q25]. SQL in `queries/fs/` only, no dashboard tile (doc review item 13).

### FS-PO1 — Adding "my" bike hits the bike paywall
- **Tasks** T22. (1) New free account, finish with a make-only bike (Honda chip); Garage header "+", "Add a bike", Home switcher "+", Profile "Add bike". (2) "Your plan has one bike" sheet:
  primary "Update Honda" → edit-bike prefilled, save keeps one bike and the schedule follows (FS-R2-3); secondary opens today's paywall; Pro riders never see it.
- (3) Maestro `bike-limit-update-bike.yaml`: `runFlow: onboarding.yaml` with `MAKE_ONLY: "true"` → Garage → `tapOn: {id: garage-add-bike-header}` → `assertVisible: {id: bike-limit-sheet}` →
  `tapOn: {id: bike-limit-update}` → `assertVisible: {id: edit-bike-make}` → set model via `edit-bike-model-search` → save → model on the card → exactly one bike card; repeat sheet assertion from the Home switcher.
  Jest `decideBikeLimitAction` in `hooks/__tests__/use-add-bike-gate.test.ts`.
- (4) Completers with an `unlimited_bikes` paywall request within 1 day — verbatim at `deep-dives/R2-bike-limit-and-schedule.md:277-287`; plus `bike_limit_choice` split.
  **Baseline 3.26.0 7/118 (5.9%)** [SOURCE: R2-PH4; reproduced 7/120, all within 1 h, V1-q26]; first hour MAX_BIKES 7/117 [SOURCE: R6-q3]. **Target ≤ 2%** direct; ≥ 50% of sheet viewers choose update and save within 10 min.

### FS-PO1H — Experiment 2: the onboarding bike gets no service schedule
- **Tasks** T07. (1) Fresh install, new free account; onboarding **Yamaha → MT-09 → 2019** (12 model rows, years 2014–2025, read-only `oem_maintenance_schedules` query DB-1 in §8) → finish → Garage → bike → Service segment; repeat with "Not sure of the details?" → Honda chip.
  (2) Both bikes have ≥ 1 pending OEM task within seconds; Home plate shows the next item, not "No service due" (`components/home/home-plate.ts:96-103`); make-generic tasks show the tier; imperial → miles.
- (3) Maestro `onboarding-service-plan.yaml`: `runFlow onboarding.yaml` → `assertNotVisible: "No service due"` → tap `"Garage(,.*)?"` → bike card → `tapOn: {id: segment-service}` →
  `extendedWaitUntil: {visible: {id: "service-task-card-.*"}}`; `onboarding-make-only-service-plan.yaml` (MAKE_ONLY branch) + tier label. Jest `users.service.spec.ts` (T07).
- (4) Primary DB metric (consent-independent), R2-M1: onboarding-created live bikes (`motorcycles.created_at = users.onboarding_completed_at`) with an OEM task (`maintenance_tasks.source='oem'`) created < bike + 5 min, weekly.
  SQL: R2 §2.2 R2-M1 definition (`deep-dives/R2…:91-97`) with q08 exclusions (board/99 Appendix A CTE `u`; qualify `u.deleted_at`/`u.email` inside joins, V1 §3.8). **Baseline 10/151 (7%)** [SOURCE: R2-M1; reproduced 10/155, V1-db4]. **Target ≥ 95%** 2 weeks.
  Board metric S4(a) verbatim at `board/99-synthesis.md:271-289` **plus a `source = 'oem'` column** (V1 §3.8: `with_oem_tasks_d0`), **baseline 25/111 (23%)** any source; partial week 11-09 already 12/24 from rider-created tasks (9 `user` vs 4 `oem` bikes) [SOURCE: V1-db2, V1-db3]. **Target ≥ 55%** 4 weeks, judged on the `oem` column for T07 (T07 is judged on S4(b)/R2-M1). PostHog per version: verbatim at `R2…:249-258` (needs T07 client fields).
  Read by **deploy date** (API reaches all versions at once) with the annotation.

### FS-R2-3 — Changing make/model/year does not change the schedule
- **Tasks** T23, T26. (1) Free account, make-only Honda (after T07 it has make-generic tasks) → Bike → Edit → model "CB500F" → save → Service segment. (2) Pending, never-completed, unedited OEM tasks retired; new waterfall imported; rider's tasks untouched.
- (3) Jest `motorcycles.resolver.spec.ts`; Maestro tail of `bike-limit-update-bike.yaml` asserts a service task after the edit.
- (4) `garage_bike_edited` with `from_capture_level='make'` and `changed_fields` containing `model`, over riders with a make-only onboarding bike, 7 d. **Baseline not measurable** (no event); DB proxy 117 blank-model live bikes, 7 ever with a task [SOURCE: R2-DB6; reproduced 116 / 7, V1-db5]. **Target ≥ 20%** [UNBACKED — own target, R2].

### FS-R2-4 — Imperial riders get wrong targets from an onboarding import (latent)
- **Tasks** T07. (1) US region / "mi" toggle, odometer 10,000 mi, finish onboarding. (2) First oil target = odometer + round(interval_km / 1.609) mi.
- (3) Jest `users.service.spec.ts` `bikeMileageUnit:'mi'`; Maestro `onboarding-service-plan.yaml` imperial run asserts "mi". (4) DB: onboarding bikes of **imperial riders** with OEM tasks whose `target_mileage − current_mileage` equals the miles conversion ±1. **The denominator cannot come from `motorcycles.mileage_unit`**: the column defaults to `'mi'` (86 of 176 onboarding bikes in 60 d are `mi`, 6 of them with OEM tasks), so take the unit from `onboarding_completed.measurement_system` or T07a's `service_plan_imported.unit` [SOURCE: V1-db7, V1-db8]. **Baseline n/a. Target 100%.**

### FS-R2-5 — Junk makes saved in onboarding
- **Tasks** T25. (1) Bike setup → type "A" → "Use 'A'". (2) Not offered until ≥ 3 letters or a known make. (3) Jest custom-make rule. (4) DB: onboarding bikes whose `make` has < 3 letters (SQL `validation/V1-metrics.md` §3.8; no known-make table exists — T37 closed — so "not a known make" needs T05e's `make_valid`). **Baseline 6/176 onboarding bikes in 60 d** (all-time 10/373; 53/176 makes are not in `oem_maintenance_schedules`) [SOURCE: V1-db6] (the earlier "4 of 29 bike-paywall riders", R2-DB5, used another denominator). **Target 0** new.

### FS-PO2a — Diagnostics "Try Again" limit loop
- **Tasks** T08. (1) iOS sim/Android emulator T00 E2E build against the patched local stack (seeded), free user with a seeded used diagnosis (`E2E_SEED_DIAGNOSIS_USED=1`); reach the form before the quota loads (airplane mode on, Diagnose → Start, fill 4 steps, airplane off) → Analyze → dismiss → "Try Again".
  (2) Localized limit panel with "See Pro plans" (rider tap) and "Done"; no "Try Again"; ≤ 1 automatic paywall per form.
- (3) Maestro `diagnose-limit-loop.yaml` (Android for `setAirplaneMode`): steps above → optional dismiss → `assertVisible: ".*free diagnosis is used.*"` → `assertNotVisible: "Try Again"` → `assertVisible: "See Pro plans"`. Jest `new-limit.test.tsx`.
- (4) Riders with ≥ 2 `diagnostic_limit_reached` in one `$session_id` — verbatim at `deep-dives/R3-first-hour-paywalls.md:395-402`. **Baseline 3.26.0: 3 of 5 limit riders, 9 events** [SOURCE: R3 Q2, Q9; reproduced, V1-q27]. **Target 0.**

### FS-PO2b — Diagnosis failures: long waits, raw text, offline submits
- **Tasks** T17. (1)(a) Airplane mode → Analyze; (b) proxy delaying `submitDiagnostic` 120 s. (2)(a) blocked offline message, no request; (b) "Still working…" at 10 s; at 75 s "Still working — if it finishes, it will appear in your diagnoses", submit disabled until
  the server window (≈ 240 s) ends, then quota refetch; no raw server text.
- (3) Maestro `diagnose-offline.yaml` (Android): fill → airplane on → Analyze → `assertVisible: ".*offline.*"` → `assertNotVisible: ".*Failed to analyze.*|.*Network request failed.*"`. Jest `new-timeout.test.tsx` (fake timers; Maestro can't delay one GraphQL op).
- (4) Verbatim at `R3…:545-550`. **Baseline failure p90 47 s (max 141); 10 failures / 3 riders on 3.26.0; 7/14 offline after send** [SOURCE: R3 Q8, Q9]. **Target p90 ≤ 75 s; ≤ 1.5 failures per failing rider; 0 post-send offline.**

### FS-PO2c — Exhausted diagnose CTA looks available
- **Tasks** T24. (1) Free user, seeded used diagnosis, network on → Diagnose tab. (2) CTA "Free diagnosis used · back on {date}" (muted) → `LimitSheet`, never the form. (3) Maestro `diagnose-quota-used.yaml`
  (`assertVisible: ".*Free diagnosis used.*"` → tap → `assertVisible: {id: limit-sheet}` → `assertNotVisible: {id: diagnose-step-bike}`). Jest `diagnose-cta.test.tsx`.
- (4) Verbatim at `R3…:510-517`. **Baseline 6 upfront paywalls / 3 riders (60 d)** [SOURCE: R3 Q1, Q7]. **Target 0** automatic upfront paywalls.

### FS-PO2d — Diagnostics is the first action much more often on 3.26.0 (research)
- **Tasks** T06 item 2. (4) First-hour `diagnostic_started` (after T05: once per entry) among completers by `{REL}` and `entry`. **Baseline 3.26.0 29/117 (25%) vs 3–9% on 3.19–3.21** [SOURCE: R6-q3]. Target: none (policy: handle, don't promote); the owner decides on the entry point.

### FS-PO3 — Repeated automatic paywalls in one session
- **Tasks** T21. (1) Free user, seeded diagnosis: Diagnose → Start → dismiss → Start again; Garage "Add a Bike" → dismiss → Home "+" → Profile "Add bike". (2) ≤ 1 automatic present per feature, ≤ 2 per session;
  later taps open `LimitSheet` with "See Pro plans" (`rider_tap`, never capped); 10-min cooldown after an error; onboarding surfaces unchanged.
- (3) Maestro `gate-frequency-cap.yaml` (light then dark): Garage Add → optional dismiss → Add again → `assertVisible: {id: limit-sheet}` + `".*1 bike.*Free.*"` → Diagnose Start → dismiss → Start → `assertVisible: {id: limit-sheet}` →
  `assertVisible: "See Pro plans"`. Jest `lib/__tests__/paywall-frequency.test.ts` (5 rules incl. session reset).
- (4) Sessions with ≥ 2 automatic same-feature `paywall_viewed` (non-onboarding) — verbatim at `R3…:473-485` **plus, until T05a/T21 add `trigger`, `AND coalesce(toString(properties.surface), '') NOT IN ('profile_subscriptions_row','profile_pro_banner')`** and `toString()` around `properties.*` (V1 §3.7); plus `paywall_suppressed` counts. **Baseline 3.26.0: 14 automatic-gate sessions, 9 with a same-feature repeat (64%), 8 within 60 s** [SOURCE: V1-q33] (the earlier 9/22 = 41% counted explicit upgrade taps in the denominator, R3 Q10).
  **Target 0.** S5 *(run, Q-P8)* first-hour ≥ 2 post-onboarding requests **3.26.0 8/121** → ≤ 2%. Guardrail: gate purchases + `rider_tap` views ≠ 0 over 8 weeks (baseline 3 gate purchases/60 d, all 3.19.1) [SOURCE: R3 Q11–Q12].

### FS-PO3b — First session runs the store binary's JS, so OTA fixes miss new riders
- **Tasks** T01, T18, T35. (1) Install a binary built before a JS fix, publish the fix as OTA, reinstall, complete onboarding in one launch → fix absent (`Updates.isEmbeddedLaunch`). (2) First-hour fixes are in the binary.
- (3) Jest marker test (FS-M); release checklist line "first-session fixes are embedded" in `docs/runbooks/mobile-release.md` (manual). No E2E.
- (4) Verbatim at `R3…:425-435`, then `countIf(properties.is_embedded_launch = true)` after T01. **Baseline 3.26.0: 4 of 5 limit riders hit it on their install launch** [SOURCE: R3 Q13]. **Target 0** on the first binary embedding T08.

### FS-PO4a — Standstill first attempt is treated as an error (Exp 1 test arm)
- **Tasks** T31. (1) Sim with fixed `setLocation`, new account, test arm, FAB → Start → wait 5 s → hold to end. (2) Teaching sheet ("Test ride: all good"/"Testing it out?"), both floors, three buttons; control unchanged.
- (3) Maestro `ride-standstill-teaching.yaml` (`EXPECTED_ARM=test`): `tapOn: {id: "start-ride-button"}` → `extendedWaitUntil: RECORDING` → wait 5 s → `longPressOn: ".*Hold to end ride.*"` → `assertVisible: {id: "ride-guard-variant-teaching"}` →
  `assertVisible: ".*30 seconds.*50 m.*"` → `tapOn: {id: "ride-guard-got-it"}` → `assertNotVisible: ".*RIDE SAVED.*"`; control run asserts `ride-guard-variant-default`. Jest `ride-guard-variant.test.ts`.
- (4) Mechanism + outcome by arm — verbatim at `deep-dives/R4-first-ride.md:376-389` **with a complete-7-day-window guard**. **Baseline ≥ 3.21: 1/14 standstill-first riders saved a real ride ≤ 7 d** [SOURCE: V1-q35] (R4 Q-R4-06's 3/20 had no complete-window guard; board 1/13). Outcome reads by arm are even smaller-n than first stated. **Target:** hygiene 0 bad teaching sheets; outcome descriptive only.

### FS-PO4b — A standstill ride is saved as a ride
- **Tasks** T09. (1) As FS-PO4a, control/today; tap "End Anyway". (2) Ended + discarded + toast; no "RIDE SAVED"; rides list "No rides yet"; `ride_discarded {reason:'below_floor', trigger:'guard'}`; an auto-ended ride below both
  floors is discarded the same way (`trigger:'auto_end'`, notification "Your ride was too short to save").
- (3) Maestro `ride-standstill-not-saved.yaml`: standstill → end → `tapOn: {id: "ride-guard-end-anyway"}` → `assertNotVisible: ".*RIDE SAVED.*"` → Profile → Rides → `assertVisible: "No rides yet"`; updated `log-ride.yaml` (moving). Jest `ride-controller.test.ts` (guard and auto-end cases).
- (4) Verbatim at `R4…:408-414`. **Baseline ≥ 3.21: `save_trigger='summary'` 13 saves / 11 riders (target metric); all 15 / 13 incl. auto-end (60 d); DB 26 of 71 sign-ups' first rides are live < 50 m, plus 15 live with null distance** [SOURCE: R4 Q-R4-08, S-R4-01; V1-q36a, V1-db9]. The DB share counts **null distance as sub-floor** (`coalesce(distance_m, 0) < 50`, V1 §3.8) or reports it separately, else "< 5%" is understated. **Target 0** summary junk saves; DB < 5%.

### FS-PO5 — Ride HUD opens without a start (regression guard; not a bug today)
- **Tasks** T03b (alert). (1) Both platforms, fresh install, each paywall arm, Home, wait 15 s, relaunch. (2) Never `/(modals)/ride-hud` without Start/Resume.
- (3) No Maestro flow (dropped in doc review item 13): the weekly `hud_without_any_start` alert is the guard.
- (4) Verbatim at `R4…:342-352`. **Baseline 0 views / 0 riders** [SOURCE: R4 Q-R4-05]. **Target 0** every version (alert).

### FS-PO6 — Taps that do nothing on Home
- **Tasks** T28. (1) Fresh account with the onboarding bike; tap every checklist row, bike card, receipt card, empty list rows. (2) Visible response ≤ 300 ms; navigates or opens a sheet.
- (3) Maestro `home-taps-respond.yaml`: for each `id: checklist-row-<id>` tap → `extendedWaitUntil` target testID (timeout 5000) → back; `assertVisible: {id: "rides-empty-cta"}`. Jest checklist deep-link test.
- (4) First-hour `$rageclick` riders — **per-completer SQL in `validation/V1-metrics.md` §3.5** (R6's SCOREBOARD-CTE form at `R6…:401-406` counts event rows — 4,047 "completers" for 116 persons on 3.26.0 — and turns the LEFT JOIN into an inner join), broken down also by `$screen_name`. **Baseline 15/281; 3.26.0 7/116 (6%)** [SOURCE: V1-q30a]. **Target ≤ 3%.**

### FS-PO7 — Discover slow or stuck
- **Tasks** T29. (1) Android emulator, cold start, new account, Discover within 10 s; repeat throttled. (2) Cards ≤ 3 s; skeletons; error + Retry at 10 s.
- (3) Maestro `discover-first-open-android.yaml`: `runFlow: onboarding.yaml` → `tapOn: {id: "tab-discover"}` → `extendedWaitUntil: {visible: {id: "trip-card-0"}, timeout: 8000}`.
- (4) `quantile(0.9)(toFloat(properties.ms_to_content))` and `countIf(properties.outcome != 'content')/count()` on `screen_load_timed` with `properties.screen = 'discover'` by `{REL}`. **Baseline not measurable** (2 replays) [SOURCE: R6 F-PO7]. **Target p90 < 3,000 ms; non-content < 1%.**

### FS-PO8 — Unexplained modal on first Discover / route tap
- **Tasks** T06 item 8, T29. (1) Android (emulator + real phone), Spanish locale, fresh install, finish onboarding, Discover, then FAB. (2) No dialog without a rider action; location asked only after "Use my location".
- (3) Same flow: after `tab-discover`, wait 3 s → `assertNotVisible: "Allow.*location|While using the app|Only this time|Descargar.*"` → `assertVisible: {id: "near-you-use-location"}` → tap → OS dialog visible. Jest `use-user-country.test.ts`.
- (4) First Discover visits with `Application Backgrounded` ≤ 2 s after `discover_tab_viewed` — **use `validation/V1-metrics.md` §3.6** (array form with a first-Garage-view control; replaces R4's `leadInFrame` form at `R4…:478-488`). **Baseline (60 d): Android 42/43 (median 0 s); iOS 0/28; platform-null 54/87. Controls: first Garage view Android 1/59, Profile 3/58** [SOURCE: V1-q36] — not "n = 1": an OS dialog (likely location, ≈ 70%) fires on Discover open for nearly every Android rider who opens it. **This raises T29 to Release A**; T06 item 8 confirms the dialog type on a device. **Target** Android ≤ 5% (Garage-control level).

### FS-PO9 — Leave the garage within seconds (behaviour; Exp 1 outcome)
- **Tasks** T30–T35. (4) Completers whose last day-0 event is < 60 s after `onboarding_completed` with ≤ 1 `$screen` — event-based SQL in §5A (re-readable per version without new scans) [review item 20]. **Baseline 22/100 scanned sessions < 60 s, 3 returned** [SOURCE: R6-q1/q2]. Read by Exp 1 arm; no Maestro (behaviour). SQL in `queries/fs/`, no dashboard tile (doc review item 13).

### FS-PO10 — "First ride" checklist row ticks without a ride and leads to an empty list
- **Tasks** T10. (1) New account → Home → tap "See your first ride stats". (2) Stays unticked; opens Start Ride; sub-floor ride doesn't tick; real ride does.
- (3) Maestro `checklist-first-ride.yaml`: `tapOn: {id: "checklist-row-first_ride"}` → `assertVisible: {id: "start-ride-screen"}` → close → `assertVisible: {id: "checklist-row-first_ride", checked: false}`. Jest (T10).
- (4) Verbatim at `R4…:430-436`. **Baseline tap 17 riders (3 with a real ride); data 20, of which 12 with a real ride → 8 data-ticked without a real ride (baseline of the "= 0" target)** [SOURCE: R4 Q-R4-10; re-run tap 16 (3), data 20 (12), null trigger 10 on old builds, V1-q39]. "With a real ride" must be a real ride **before the tick** (V1 counted any time in 60 d); T02 orders it for the "= 0" target. **Target tap = 0; data-ticked without a real ride = 0.**

### FS-PO11 — What's New shown to brand-new riders (settled; regression tile)
- **Tasks** none. (3) Existing `apps/mobile/.maestro/flows/whats-new.yaml` stays green. (4) Completers with `$screen` containing `whats-new` within 1 h of `onboarding_completed`, by `{REL}` (per-completer SQL `validation/V1-metrics.md` §3.5; SQL in `queries/fs/`, no tile). **Baseline 3.26.0 2/120** (completions on 10-23 and 11-05, both `/(modals)/whats-new`; 3.19.1 65/69, 3.22.0 3/3) [SOURCE: V1-q40, V1-q41] — not 0/90: the events cannot tell an automatic show from a rider-opened one; T02 checks those 2 with replays before calling it settled. Regression tile kept. **Target 0.**

### FS-PO12 — A sign-in screen appears after onboarding
- **Tasks** T15, T15b. **Regression guard only** in Maestro (`onboarding.yaml` signs up by email; the repro needs a Google account) [review item 8]. (1) Android, Google-created account; after Home open Profile, Diagnose → New, Discover. (2) No sign-in / Google picker while the session is valid.
- (3) Maestro `post-onboarding-no-signin.yaml`: `runFlow: onboarding.yaml` → each of `tab-profile`, `tab-diagnose`, `diagnose-new`, `tab-discover` → `assertNotVisible: ".*Sign in.*|.*Continue with Google.*|.*Choose an account.*"`. Jest `auth-state-change.test.ts`.
- (4) **Per-completer SQL in `validation/V1-metrics.md` §3.5** (`po12_signin_1h`; R6's join at `R6…:449-455` counts event rows). **Baseline 11/292 (3.8%); 3.26.0 5/120, 3.27.0 2/6** [SOURCE: V1-q40] (includes `/(auth)…` screens). T06 item 1 now only confirms a sample with replays. **Target 0** — a measurable target for T15/T15b (≈ 4% of completers today).

### FS-PO13 — App returns to onboarding after completion
- **Tasks** T14, T15. (1) Email-code account, finish, background 2 min, relaunch; airplane mode during the first minute on Home. (2) Home; never experience / verification / "how did you hear".
- (3) Tail of `post-onboarding-landing.yaml`, **tagged `android`** (Maestro `setAirplaneMode` is Android-only; iOS = jest only) [review item 24]: `stopApp` → `setAirplaneMode: enabled` → `launchApp` → `assertVisible: {id: "home-screen"}` → airplane off → wait 10 s → `assertNotVisible: ".*How long have you.*|.*hear about us.*"`.
- (4) **Per-completer SQL in `validation/V1-metrics.md` §3.5** (`po13_onboarding_after`, excludes `paywall` step views; R6's join at `R6…:468-474` counts event rows). **Baseline 7/292 (2.4%); 3.26.0 5/120** [SOURCE: V1-q40]. **Target 0.**

### FS-PO14 — Start Ride opened on day 0, no ride
- **Tasks** T27. (1) New account, location not asked; Home → Start Ride; deny, then allow. (2) Start above the fold, bike preselected, permission once in context, denial → alert (never spinner), "short test rides aren't saved" line.
- (3) Maestro `start-ride-first-open.yaml`: `launchApp: {permissions: {location: deny}}` after setup → `tapOn: {id: "tab-ride-fab"}` → `assertVisible: {id: "start-ride-button"}` → tap → `assertVisible: ".*Location.*required.*"`;
  second run `permissions: {location: allow}` + `setLocation` → `assertVisible: {id: "ride-hud-root"}`. Jest `start-ride.test.tsx`.
- (4) Completers with a `$screen` containing `start-ride` on day 0 and no `ride_started` that day, by `{REL}` — `po14_opened_no_ride_d0` in `validation/V1-metrics.md` §3.5 *(run)*. **Baseline 68/132 (52%); 3.26.0 30/48** [SOURCE: V1-q40] (R6-q9: 67/130). **Target ≤ 35%** (subtract `next_ride_plan_set` riders in the test arm).
  **Second per-release metric (V2 §5.2):** day-0 `ride_started` among riders who opened Start Ride on day 0 — **baseline 63/130 (48%)** [SOURCE: R6-q9]. Day-0 ride start is the strongest returner predictor (35% vs 10% back on day 2, adjusted OR 4.5; V2 §4), so T27 is the P2 task most likely to move return (not causal).

### FS-PO15 / FS-PO16 — Receipt-scan fallback; trip missing in My trips (not doing now; full specs in §5A; ledger line in §10)
- SQL in `queries/fs/`, no tile (doc review item 13); "verify if seen again". Event names to confirm (`features/receipt-scan/use-scan-flow.ts`; `trip_created` vs empty trips list ≤ 10 min). Baselines unknown (1 replay each) [SOURCE: R6 F-PO15, F-PO16].

### FS-PO17 — Several sheets over Home on landing
- **Tasks** T16b. (3) `post-onboarding-landing.yaml` asserts at most one of `{id: "recall-sheet"}`, `{id: "oem-imported-sheet"}`, `{id: "whats-new-sheet"}` visible, and none of them
  after a sheet was dismissed in the same cold session. (4) First-session riders with ≥ 2 `landing_sheet_shown {sheet, ms_since_landed, queue_position}` within 60 s of `post_onboarding_landed` (T05d constant, fired by T16b) [review item 22]. **Baseline unknown** (5 replays). **Target 0.**

### FS-EXP1 — Experiment 1 "first-ride plan"
- **Tasks** T30–T35, T40. (1) New account, either paywall arm; runner repeats until the arm is drawn (`EXPECTED_ARM`, as `run-onboarding-paywall-e2e.sh`). (2) Test arm: plan card, teaching sheet, d1 fallback; control: today's app.
- (3) Maestro `first-ride-plan-card.yaml` (test: `assertVisible: {id: "activation-plan-card"}` → `tapOn: {id: "plan-chip-tomorrow"}` → optional "Allow" → `assertVisible: {id: "plan-card-scheduled"}` → relaunch → still scheduled; control: card absent).
  Jest assignment, fire-time and scheduler tests (T30, T32); delivery via T33.
- (4) Exposure by arm × `onboarding_variant` × platform — verbatim at `R4…:455-461` (plus `primary_goal` and `returning_account` from T30); primary S1 by `properties.activation_arm` (first `onboarding_completed` after launch, 7 d from completion).
  **Baselines:** completion-anchored S1 37/275 (13.5%), 3.26.0 8/84 (9.5%) [SOURCE: V1-q7]; first-seen cohort 61/367 (16.6%), Oct 16/127 (12.6%) [SOURCE: board/99 §4; evidence pack §2].
  **By stratum (V2-q5):** goal `track_rides` 47/197 (24%), other goals 14/170 (8%); 77% of S1 events come from `track_rides`. October completers came back at half the Aug–Sep rate
  (season and 3.26.0 confounded) and the slot runs Dec–Mar, so the **9.5% column is the realistic one, and may still be high** [SOURCE: V2 §3.2, §5.1 item 3].
  **Pre-registered analysis (V2 §5.1, D13 implementation note §3A.3):**
  - Primary: S1, **one one-sided test at the cap, stratified by goal (`track_rides` vs other) × platform** (Mantel–Haenszel risk difference and its z; both strata variables are
    set before assignment). The keep rule (90% lower bound > −3 pts) uses the MH risk-difference interval. Miller N = 64 (ship T − C ≥ 16; stop T + C = 64) stays as the
    sequential stop on unstratified counts.
  - `returning_account` riders (first auth in the install = sign-in to an existing account; 21/367 completers, 33% back on day 2) are **excluded from the primary** and reported separately.
  - **One pre-specified subgroup: `track_rides`** (where an effect should show first). No other subgroup is read as a result.
  - `maintain_bike` riders are read on S1 and days 7–13, never on S3 (3/72 on day 2 but 7/65 on days 7–13).
  SRM χ² weekly per platform × region.
  **Detectable effect, stated as an absolute lift (replaces "×2"):** ×2 on the `track_rides` stratum (24% → 48%) is not plausible, while ×2 on 8% is +8 pts, so the target is an
  absolute test − control difference in S1. **Power (recomputed 2026-11-12, normal approximation, one-sided α = 0.05 at the cap, 2.1 completers/day split 50/50, ≈ 6% of
  completers removed as `returning_account`; planner calculation [UNBACKED]):**

  | Start | Days to cap | Riders per arm | +8 pts at 9.5% | +8 pts at 12.6% | +10 pts at 9.5% | +10 pts at 12.6% | ×2 at 9.5% / 12.6% (old framing) | 80%-power MDE |
  |---|---|---|---|---|---|---|---|---|
  | 2026-12-15 | 106 | ≈ 104 | ≈ 0.52 | ≈ 0.46 | ≈ 0.66 | ≈ 0.60 | 0.62 / 0.75 | +12.5 pts (9.5%) · +13.6 pts (12.6%) |
  | 2027-01-06 (latest start) | 84 | ≈ 83 | ≈ 0.45 | ≈ 0.40 | ≈ 0.57 | ≈ 0.52 | 0.54 / 0.67 | +14.3 pts · +15.5 pts |

  A Monte-Carlo check with the stratum baselines (24% / 8%, and Oct-scaled 13.7% / 4.6%, 54% `track_rides`, uniform +8 pts) gives the **same power for the stratified MH test as for
  the unstratified z-test (±1 pt)**: with simple randomization the stratification buys robustness to chance imbalance and an honest subgroup, not power. The experiment can
  detect only a large lift (≈ +12 to +15 pts) with 80% power; a capped no-winner means **"no large lift shown"**, not "no effect".

---

---

## 5A. Friction spec changes after review (supersede §5 where they differ)

### 5A.1 Where each automated check runs, and whether it can show the bug [review items 8, 24]

`jest (CI)` = runs in `pnpm verify:mobile`/`verify:api` in CI. `maestro (local, <device>)` = run by the implementing agent; command, log and screenshots go in the PR body.
**Red first** = run the Maestro flow (or jest test) on `origin/main` before the fix; it must fail, and the failing log goes in the PR. **Guard only** = the flow cannot reproduce
the bug and only protects the fixed behaviour.

| Spec | Jest (CI) | Maestro (local) | Red first | Notes |
|---|---|---|---|---|
| FS-M | `analytics-release-marker.test.ts` | — | — | OTA order not reproducible in Maestro |
| FS-OB1a | `sign-in-session-advance.test.tsx`, OAuth double tap | iOS sim + Android emu: `onboarding-signin-unfinished-account.yaml` | **yes** | |
| FS-OB1b | `onboarding.test.ts` `getPreviousRoute` | Android emu: `onboarding-back-preserves.yaml` (tag `android`, + "cold resume to account → Back → goals"); iOS sim: `onboarding-ios-swipe-back.yaml` (T19b) | **yes** (Android) | reproduced on 3.28.0 (V4) |
| FS-OB1c | store migration test, goals seeding, monotonic `furthestScreen` | Android emu ("Don't keep activities"): `onboarding-bike-resume.yaml` (+ goals case) | **yes** | reproduced on 3.28.0 (V4) |
| FS-OB1d | `welcome-resume.test.tsx` | Android emu: `onboarding-welcome-warm-resume.yaml` (tag `android`) | **yes** | trigger found (V4 b3): Back out + warm launch |
| FS-OB1e | `navigation-gate.test.tsx` | Android emu: `onboarding-complete-relaunch.yaml` (tag `android`) | guard only | the stale-cache race is not forced by Maestro |
| FS-OB1f | `auth-state-change.test.ts` | — | — | conditional (T38) |
| FS-OB2a | `use-oauth-sign-in.test.ts` | Android emu with Google account: `onboarding-oauth-cancel.yaml` (tag `android-oauth`) | yes (cancel alert) | success path jest only |
| FS-OB2b | `account-post-signin-wait.test.tsx` | — | jest red first | network cut at that moment not scriptable |
| FS-OB2c | cancel case | same as FS-OB2a | **yes** | |
| FS-OB3 | `use-email-code-step.test.ts` | iOS sim: `onboarding-email-code-relaunch.yaml` via `RELAUNCH=1` | **yes** | |
| FS-OB4 | `make-grid-search.test.tsx`, `model-picker-ranking.test.tsx` | both: `onboarding-bike-search.yaml` | yes (no "MT-07" row today) | |
| FS-OB5 | `auth_email_submitted` fires | both: `onboarding-account-visible.yaml` | — | measure only |
| FS-OB6 | `personalizing.test.tsx` | both: `post-onboarding-landing.yaml` | guard only | needs a link conditioner Maestro cannot set |
| FS-PO1 | `use-add-bike-gate.test.ts` | both: `bike-limit-update-bike.yaml` | yes (paywall shows today) | |
| FS-PO1H | `users.service.spec.ts` | both: `onboarding-service-plan.yaml`, `onboarding-make-only-service-plan.yaml` | **yes** ("No service due" today) | |
| FS-R2-3 | `motorcycles.resolver.spec.ts`, `oem-schedules.service.spec.ts` (dedup) | tail of `bike-limit-update-bike.yaml` | yes | |
| FS-R2-4 | `users.service.spec.ts` mi case | imperial run of `onboarding-service-plan.yaml` | yes | |
| FS-R2-5 | custom-make rule | — | jest red first | |
| FS-PO2a | `new-limit.test.tsx` | Android emu: `diagnose-limit-loop.yaml` (tag `android`, local Supabase seed) | **yes** | |
| FS-PO2b | `new-timeout.test.tsx` | Android emu: `diagnose-offline.yaml` (tag `android`) | **yes** | 75 s deadline and 240 s submit lock jest only |
| FS-PO2c | `diagnose-cta.test.tsx` | both: `diagnose-quota-used.yaml` (local Supabase seed) | yes | |
| FS-PO3 | `paywall-frequency.test.ts` | both: `gate-frequency-cap.yaml` | **yes** | RevenueCat absent in test runs: assert app UI only |
| FS-PO4a | `ride-guard-variant.test.ts` | both: `ride-standstill-teaching.yaml` (`EXPECTED_ARM`) | — | new feature |
| FS-PO4b | `ride-controller.test.ts` | both: `ride-standstill-not-saved.yaml` | **yes** | |
| FS-PO5 | — | — (flow dropped, doc review item 13) | — | not a bug; the weekly `hud_without_any_start` alert is the guard |
| FS-PO6 | checklist deep-link test | both: `home-taps-respond.yaml` | yes for dead links | |
| FS-PO7 | `use-user-country.test.ts` | Android emu: `discover-first-open-android.yaml` | guard only | latency not reproducible |
| FS-PO8 | same | same flow + Spanish locale | **yes** (Android: dialog within 2 s on main) | 42/43 Android (V1-q36); T29 in Release A |
| FS-PO10 | `checklist-signals.test.ts` | both: `checklist-first-ride.yaml` | **yes** | |
| FS-PO11 | — | both: `whats-new.yaml` (exists) | guard only | settled |
| FS-PO12 | `auth-state-change.test.ts` | both: `post-onboarding-no-signin.yaml` | **guard only** | needs a Google account; email sign-up in the flow |
| FS-PO13 | `auth-state-change.test.ts` | Android emu: tail of `post-onboarding-landing.yaml` (tag `android`) | guard only | iOS: jest only |
| FS-PO14 | `start-ride.test.tsx` | both: `start-ride-first-open.yaml` | yes (spinner on deny) | |
| FS-PO17 | sheet queue test | both: `post-onboarding-landing.yaml` | guard only | |
| FS-EXP1 | assignment, start-gate, fire-time, scheduler tests | both: `first-ride-plan-card.yaml` | — | delivery: T33 device check |

### 5A.2 FS-M redefined [review item 4]
- **Hotfix OTA (crash/data-loss only, D17):** among `Application Opened` with `runtime_version` in the runtimes the OTA targeted, over the 7 days after publish, the share whose `ota_update_id` equals the new id or
  a later one. Target ≥ 90% of riders seen ≥ 2 times in those 7 days (an OTA applies on the next launch). Riders on other runtimes and EEA decliners are not in the denominator.
- **Binary:** opens with `$app_version` = the new version carry `activation_fix_level` = the expected level: target 100% (a mismatch means a wrong cut).
- Alert (T03b): binary rule only (deterministic), checked 3 days after go-live, fires on any mismatch. A hotfix OTA's share is read in the 2/4/8-week review, not alerted.

### 5A.3 New and completed metric SQL [review items 17, 20]
- **Corrected SQL from the validation (2026-11-12) — T02 takes these verbatim from `validation/V1-metrics.md`:** §3.1 `{REL}` person-level platform (§0); §3.2 FS-OB1b `$screen`
  back-walk; §3.3 FS-OB1c completion after resume (ordered); §3.4 FS-OB5 proxy + FS-OB7; §3.5 FS-OB2b (first step after sign-up, no `{RN}` on `signup_completed`) and the
  **per-completer array query for FS-PO6 / PO11 / PO12 / PO13 / PO14 (+ FS-PO2d)**, which replaces every R6 SCOREBOARD-CTE join (those count event rows); §3.6 FS-PO8 with the
  Garage control; §3.7 FS-PO3 surface filter; §3.8 DB: S4(a) with the `oem` column, FS-R2-5 short makes, FS-PO4b null distance as sub-floor. The tables in §5 quote their results.
- **S3 engaged return:** board/06 Appendix B SQL (hard-dated: replace the dates with a rolling window and add `ver`; V1 S3 row), route list from the T05d constant (`config/engaged-routes.ts`), with `{REL}`. Per-release reads add the **24–48 h** form as primary (V2 §5.3).
- **S6 / FS-OB1 (post-auth early-step regression):** verbatim `deep-dives/R6-replays-returners.md:276-284` with `{EXCL}` and `{REL}`. Target ≤ 3% per version [UNBACKED — own target].
- **FS-PO9 (event-based, re-readable per version):** *(run, Q-P9, 2026-11-12)*
  ```sql
  SELECT ver, count() AS completers, countIf(left_fast) AS left_under_60s
  FROM (SELECT ver, t0,
          arrayFilter(x -> tupleElement(x, 1) >= t0 AND toDate(tupleElement(x, 1)) = toDate(t0), ev) AS day0,
          arrayMax(arrayMap(x -> tupleElement(x, 1), day0)) < t0 + INTERVAL 60 SECOND
            AND length(arrayFilter(x -> tupleElement(x, 2) = '$screen', day0)) <= 1 AS left_fast
        FROM (SELECT person_id,
                argMinIf(toString(properties.$app_version), timestamp, event = 'onboarding_completed') AS ver,
                minIf(timestamp, event = 'onboarding_completed') AS t0,
                groupArray(tuple(timestamp, event)) AS ev
              FROM events
              WHERE timestamp >= now() - INTERVAL 60 DAY AND {RN} AND {EXCL}
                AND event NOT IN ('Application Backgrounded','$exception','$feature_flag_called','$set','$identify')
              GROUP BY person_id HAVING countIf(event = 'onboarding_completed') > 0))
  GROUP BY ver ORDER BY ver
  ```
  Result: **3.26.0 11/121 (9.1%)**; 3.19.0 2/42; 3.19.1 0/69; 3.20.0 1/11; 3.21.0 0/33; 3.22.0 0/3; 3.25.0 0/3; 3.27.0 0/6; 3.28.0 0/4. It is lower than the replay figure
  (22/100 < 60 s) because the replay counted the session end, while this counts any later day-0 event; it is the per-version tile, the replay figure stays the qualitative baseline.
  Target: none (behaviour; Exp 1 outcome read by arm).
- **FS-PO15 — receipt scan falls back to manual entry.** (1) Repro: free account, Expenses → scan a blurred receipt photo (fixture). (2) Expected: a clear "Couldn't read this receipt"
  message and a prefilled manual form; no silent empty form. (3) Check: existing `receipt-scan-entry.yaml` stays green (guard only). (4) Metric: scan-started riders whose scan
  ended in the manual form, by `{REL}` (event names confirmed when re-seen, ledger §10, from `features/receipt-scan/use-scan-flow.ts`). Baseline unknown (1 replay). **Status: not fixing now**
  (owned by the receipt-scan epic, memory `project_receipt_scan`); ledger line "verify if seen again" (§10).
- **FS-PO16 — a planned trip is missing in "My trips".** (1) Repro: Discover → plan a trip → save → My trips. (2) Expected: the trip is listed within 2 s. (3) Check: a jest test on
  the trips list query invalidation after `trip_created` (written only if reproduced). (4) Metric: riders with `trip_created` and a My-trips `$screen` within 10 min whose
  list rendered empty (needs a `trips_list_viewed {count}` event, proposed if re-seen). Baseline unknown (1 replay, SEEN once). **Status: not fixing now**; ledger line "verify if seen again" (§10).

### 5A.4 Metric source per spec (D2b) [review item 2]

| Spec / metric | PostHog tile (event) | Weekly DB check (`queries/db/…sql`) |
|---|---|---|
| S4(a) board day-0 schedule | — | `s4a-day0-schedule.sql` (board/99:271-289) + `source='oem'` column (V1 §3.8) |
| S4(b) / FS-PO1H | `service_plan_imported` within 5 min of `onboarding_completed` (T07a) | `s4b-r2m1.sql` (R2:91-97) |
| FS-R2-4 | `service_plan_imported.unit` = `mi` share | `fs-r2-4-imperial.sql` |
| FS-R2-5 | `onboarding_bike_created.make_valid = false` (T05e) | — |
| FS-PO4b DB share | `ride_saved {below_min:true, is_first:true}` (T05e) | `fs-po4b-first-ride.sql` |
| FS-OB1e cross-check | — | `fs-ob1e-two-bikes.sql` |
| Android push tokens | `push_token_registered` by `platform` (`lib/push-token.ts:132`) | — |

**#365 T05e — `ride_saved` covers rider saves only.** It is sent from `RidesService.endRide` (including the reclaim branch). Rides the server completes itself (`closeStaleRides` on the next ride start, the idle sweep in `push-tokens/ride-idle.service.ts`) never send it. Those are mostly null-distance or abandoned first rides, the bucket FS-PO4b counts as sub-floor, and a rider whose first ride was swept gets `is_first = false` on the next save, so they leave both numerator and denominator. The two shares also measure different things: `below_min` uses the HUD floors (distance < 50 m **or** duration < 30 s, the client's `below_min_ride`) while the SQL tests distance only, and the event covers every rider while the SQL covers a sign-up cohort. So the event share `ride_saved{is_first, below_min}` / `ride_saved{is_first}` is not directly comparable to `fs-po4b-first-ride.sql` and can differ in either direction; the weekly DB check stays the source of truth for FS-PO4b and the tile is a trend signal only. Follow-up (not in T05e): emit `ride_saved` with a system `save_trigger` from the two sweep paths.

---

## 6. Release log (fill during implementation; one row per binary per platform, crash/data-loss hotfix OTA (D17), or API deploy)

| # | Version / runtime + hotfix OTA id / API | Go-live date | Platform | `activation_fix_level` | Tasks + spec ids shipped | PostHog annotation id | Notes (staged %, E2E run link, publish branch) |
|---|---|---|---|---|---|---|---|
| 0 | 3.26.0 (b93 Android / b106 iOS), 3.27.0 (iOS b108; Android vc95 internal only), 3.28.0 (iOS b111 from 11-11; Android vc98 from ~11-12) | before 2026-11-12 | both | null | — (baseline) | — | Riders 14 d, per-person platform: Android 3.26.0 108, 3.28.0 5; iOS 3.26.0 37, 3.27.0 14, 3.28.0 11 [SOURCE: V3 P1]. Play production 3.28.0 vc98 (review cleared ~11-12, 80%); vc99 = internal draft named "3.26.0"; App Store 3.28.0 b111, nothing in review [SOURCE: V3 §2–3]. Latest OTA groups: 3.28.0 `fece7a3c`, 3.26.0 `bd05b306`; none on 3.27.0 |
| 1 | API `49db3863` (Render `dep-dbrh42m7bikc73f0ebg0`) | 2026-11-13 | server | null (`lvl n/a`) | T05e (#471) — measurement for FS-R2-5, FS-PO4b: server events `onboarding_bike_created`, `ride_saved` | `204938`; text `#365 fixes: server api 49db3863 lvl n/a — FS-R2-5, FS-PO4b (T05e measurement: onboarding_bike_created, ride_saved)` | Live 13:37 UTC; reaches every app version at once. Measurement only: §6.1 rows for FS-R2-5 (T25b) and FS-PO4b (T09) stay `open`. `ride_saved` misses server-ended rides; FS-PO4b stays on the weekly DB check (§5A.4) |
| 2 | API `8fd7cf6f` (Render `dep-dbrhcgqjnfac739gqms0`) | 2026-11-13 | server | null (`lvl n/a`) | T07a (#472) — FS-PO1H, FS-R2-4 (Exp 2): onboarding bike gets its OEM service plan in the rider's unit, `User.servicePlanTaskCount`/`servicePlanTier`, server event `service_plan_imported`; D7 cap (one maintenance push per bike per 7 days) | `204996`; text `#365 fixes: server api 8fd7cf6f lvl n/a — FS-PO1H, FS-R2-4 (T07a Exp 2: onboarding service plan import + per-bike reminder cap; event service_plan_imported)` | Live 13:55 UTC; reaches every app version at once. Both Exp 1 / onboarding-paywall arms (experiments.md §7). No migration. Client half (tier label, Maestro) is T07b in a store build; §6.1 rows stay `open` until T07b ships |
| 3 | | | | | | | |

**Template — example row, NOT a real go-live (#365 T03a).** Copy its shape; build numbers, dates and ids are placeholders. Procedure: `docs/runbooks/mobile-release.md` → "#365 release marking".

| # | Version / runtime + hotfix OTA id / API | Go-live date | Platform | `activation_fix_level` | Tasks + spec ids shipped | PostHog annotation id | Notes (staged %, E2E run link, publish branch) |
|---|---|---|---|---|---|---|---|
| *ex.* | *3.29.0 (vc100) — Release A* | *2026-12-0X* | *android* | *2* | *T01, T04a–c, T05a–d, T07b–T17, T29 — FS-M, FS-OB1a, FS-PO2a, … (every spec whose §6.1 `Level` = 2)* | *`<id from annotation-create>`; text `#365 fixes: android 3.29.0 (vc100) lvl 2 — FS-M, FS-OB1a, …`* | *Play production staged 20%; onboarding-paywall E2E `<PR link>`; cut commit `<sha>`* |

**How to read a row:** 2, 4 and 8 weeks after go-live, open the dashboard, filter `lvl` = this row's level vs the previous level, same calendar weeks, per platform;
then the trailing-8-week comparison (§0). Record both in `experiments.md` under the row number.

### 6.1 Friction status table (one row per spec; updated at every release cut and every 2/4/8-week read) [review item 3]

Status values: `open` → `shipped` (in a release; level known) → `verified` (production metric met target on that level, read date given) / `regressed` / `not fixing`.
This table is the only record of which level ships which spec (no code map; doc review item 13).

**How to update (#365 T03a; full steps in `docs/runbooks/mobile-release.md` → "#365 release marking"):**
- **Cut commit** (store build, or a hotfix OTA publish commit on a runtime ≥ 3.29.0): the same commit that sets `ACTIVATION_FIX_LEVEL` fills `Level` for every spec whose fix is in that build. A hotfix OTA on a runtime < 3.29.0 has no release marker: no level, §6 level cell `null`, annotation `lvl n/a`, never cherry-pick T01 (`docs/runbooks/mobile-ota.md`).
- **Go-live, per platform** (separate docs commit): `Release row (§6)` = the new §6 row number(s), one per platform (e.g. `3 (android), 4 (ios)`); `Status` → `shipped`. The `Maestro run` cell takes the PR link of the spec's passing local run.
- **2/4/8-week reads:** fill the read cell with date + result vs target (or `no verdict (season)` / `no verdict (thin Android cohort)`), the same line goes to `experiments.md` §8; `Status` → `verified` (target met; read date given) or `regressed`.
- Never edit another spec's row in the same change unless it shipped in the same release. The example row below the table is a template, not a status.

| Spec | Task(s) | Level | Release row (§6) | Maestro run (PR link) | 2-wk read | 4-wk read | 8-wk read | Status |
|---|---|---|---|---|---|---|---|---|
| FS-M | T01, T18 | | | n/a | | | | open |
| FS-OB1a | T11 | | | | | | | open |
| FS-OB1b | T19a, T19b | | | | | | | open |
| FS-OB1c | T13b | | | | | | | open |
| FS-OB1d | T20 (same build as T19a) | | | | | | | open |
| FS-OB1e | T14, T14b | | | | | | | open |
| FS-OB1f | T38 | | | n/a | | | | open (conditional) |
| FS-OB2a | T04a, T36 | | | | | | | open (measure) |
| FS-OB2b | T12 | | | n/a | | | | open |
| FS-OB2c | T12 | | | | | | | open |
| FS-OB3 | T13a | | | | | | | open |
| FS-OB4 | T25a, T25b | | | | | | | open |
| FS-OB5 | T04a | | | | | | | open (measure) |
| FS-OB6 | T16a | | | | | | | open |
| FS-OB7 | — | — | — | — | | | | not fixing (paywall A/B) |
| S6 / FS-OB1 | T11, T13a/b, T14, T19a/b, T20 | | | n/a | | | | open |
| FS-PO1 | T22 | | | | | | | open |
| FS-PO1H (S4) | T07a, T07b | | | | | | | open |
| FS-R2-3 | T23, T26 | | | | | | | open |
| FS-R2-4 | T07a | | | | | | | open |
| FS-R2-5 | T25b | | | n/a | | | | open |
| FS-PO2a | T08 | | | | | | | open |
| FS-PO2b | T17 | | | | | | | open |
| FS-PO2c | T24 | | | | | | | open |
| FS-PO2d | T06 | — | — | — | | | | research |
| FS-PO3 / S5 | T21 | | | | | | | open |
| FS-PO3b | T01, T18, T35 | | | n/a | | | | open |
| FS-PO4a | T31 | | | | | | | open (Exp 1) |
| FS-PO4b | T09 | | | | | | | open |
| FS-PO5 | T03b (alert) | | | n/a | | | | guard (not a bug) |
| FS-PO6 | T28 | | | | | | | open |
| FS-PO7 | T29 | | | | | | | open |
| FS-PO8 | T06, T29 (Release A target) | | | | | | | open |
| FS-PO9 | T30–T35 | | | n/a | | | | Exp 1 outcome |
| FS-PO10 | T10 | | | | | | | open |
| FS-PO11 | — | — | — | whats-new.yaml | | | | guard (settled) |
| FS-PO12 | T15, T15b | | | | | | | open |
| FS-PO13 | T14, T15, T15b | | | | | | | open |
| FS-PO14 | T27 | | | | | | | open |
| FS-PO15 | — (ledger, §10) | — | — | — | | | | not fixing now |
| FS-PO16 | — (ledger, §10) | — | — | — | | | | not fixing now |
| FS-PO17 | T16b | | | | | | | open |
| FS-EXP1 | T30–T35, T40 | | | | | | | open |

**Template — example row, NOT a real status (#365 T03a).** Shows FS-PO2a after a hypothetical Release A go-live on Android (§6 example row) and a 2-week read; placeholders in angle brackets.

| Spec | Task(s) | Level | Release row (§6) | Maestro run (PR link) | 2-wk read | 4-wk read | 8-wk read | Status |
|---|---|---|---|---|---|---|---|---|
| *ex. FS-PO2a* | *T08* | *2* | *ex. (android)* | *`<T08 PR link>`* | *`<date>`: 0 limit loops on lvl 2 (target 0), n = `<riders>` android* | | | *shipped* |

---

### 6.2 T03b PostHog objects (created 2026-11-13 from the named list, D2)

Named list: issue #401, [comment 6850112739](https://github.com/andrejkanuch/MotoWise/issues/401#issuecomment-6850112739)
(amended before the writes it changed: the static cohort was replaced by a SQL view, because one `{EXCL}` person is personless).
Full tile table, SQL changes and checks: `experiments.md` §11.

| Object | Id |
|---|---|
| Dashboard "#365 Activation & frictions" | **1111923** — https://eu.posthog.com/project/155556/dashboard/1111923 |
| SQL view `activation365_excluded_persons` (`{EXCL}` ids) | `01a1d46b-e269-0000-0612-a1fe79b50e59` |
| Insights (47, tag `activation-365`) | 7346020 (Day-1 funnel, first tile), 7346041 (S1), 7346043 (S2), 7346050 (S3), 7346064 (S4 / FS-PO1H), 7346071 (S5), 7346112 (S6 / FS-OB1), 7346123 (FS-M), 7346128 (FS-OB1a), 7346139 (FS-OB1b), 7346150 (FS-OB1c), 7346163 (FS-OB1d), 7346167 (FS-OB1e), 7346168 (FS-OB1f), 7346169 (FS-OB2a), 7346171 (FS-OB2b), 7346172 (FS-OB2c), 7346177 (FS-OB3), 7346188 (FS-OB4), 7346189 (FS-OB5), 7346190 (FS-OB6), 7346193 (FS-PO1), 7346195 (FS-R2-3), 7346196 (FS-R2-4), 7346197 (FS-R2-5), 7346198 (FS-PO2a), 7346199 (FS-PO2b), 7346201 (FS-PO2c), 7346212 (FS-PO2d), 7346213 (FS-PO3), 7346215 (FS-PO3b), 7346216 (FS-PO4a), 7346219 (FS-PO4b), 7346222 (FS-PO5), 7346242 (FS-PO6), 7346245 (FS-PO7), 7346246 (FS-PO8), 7346247 (FS-PO10), 7346257 (FS-PO12), 7346264 (FS-PO13), 7346271 (FS-PO14), 7346281 (FS-PO17), 7346292 (FS-EXP1), 7346299 (weekly install-cohort table), 7346305 (push tokens), 7346326 (FS-PO5 alert source), 7346324 (FS-M alert source) |
| Alert FS-PO5 (weekly, `hud_without_any_start > 0`) | `01a1d474-999b-0000-5792-c19c6b5dd5df` |
| Alert FS-M (daily, last 3 d, `mismatched_opens > 0`) | `01a1d474-a32e-0000-dc16-82ddcdf4b826` |
| Annotation `#365 baseline` (2026-11-13) | **204474** |

FS-M alert upkeep: the FS-M alert source (7346324) maps 3.29.0 → 2 and 3.30.0 → 3; each later store-build cut adds its version →
level row with one `insight-update` on that release's named list (§3A.0 rule 5).

## 7. Queries and reads added in the revision run (2026-11-12, all read-only)

| Id | Where | Query / read | Result |
|---|---|---|---|
| Q-P9 | PostHog `execute-sql` | FS-PO9 event-based SQL (§5A.3), 60 d, `{RN}`, 12-person `{EXCL}` | 3.26.0 11/121; 3.19.0 2/42; 3.19.1 0/69; 3.20.0 1/11; 3.21.0 0/33; 3.22.0 0/3; 3.25.0 0/3; 3.27.0 0/6; 3.28.0 0/4 |
| Q-P10 | PostHog `execute-sql` | `SELECT count() … FROM (SELECT person_id, count() FROM events WHERE timestamp >= now() - INTERVAL 90 DAY AND {RN} AND person.properties.email LIKE 'e2e-%' GROUP BY person_id)` | **0 persons, 0 events**: existing E2E runs have not polluted PostHog (they decline consent or never identify); the `e2e_run` rule protects the ~25 new flows |
| Q-P11 | PostHog `docs-search` | "insight alerts which insight types are supported" | Alerts are supported on trends, funnels and SQL (HogQL) insights; free tier 5 alerts in total [SOURCE: https://posthog.com/docs/alerts] |
| DB-1 | Supabase Management API SELECT | `select column_name from information_schema.columns where table_name='oem_maintenance_schedules'` (the table is `oem_maintenance_schedules`, not `oem_schedules`) | id, make, model, year_from, year_to, task_name, … variant, service_type |
| DB-2 | same | `select make, model, count(*) from public.oem_maintenance_schedules where model <> '' group by 1,2 order by 3 desc limit 15` | top: YAMAHA MT-09 12 rows; DUCATI Monster 821 11; BMW R 1250 GS 10; … 84 make+model pairs, 24 makes |
| DB-3 | same | make-generic rows (`model` null/empty) by make | 10 rows each for KTM, BMW, APRILIA, KAWASAKI, DUCATI, GENERIC, HARLEY-DAVIDSON, HONDA, HUSQVARNA, PIAGGIO |
| DB-4 | same | year ranges for candidate test bikes | YAMAHA MT-09 2014–2025 (12); BMW R 1250 GS 2019– (10); **no rows for MT-07 or any CB500** |
| C-1 | code | `apps/api/src/modules/oem-schedules/oem-schedules.service.ts:222-228` | dedup select has no `deleted_at` filter (confirms review item 12) |
| C-2 | code | `packages/types/src/database.types.ts:1994-2031` (`maintenance_tasks` Row) | `deleted_at` exists (`:2001`); **no "edited by rider" column** (answers T06 item 6 partly: only `updated_at`, `:2025`) |
| C-3 | code | `apps/mobile/src/lib/onboarding-paywall.ts:44-50, 64-80` | placement = goals + pending intent only; bike make/model/year are RC attributes ("targeting only, not copy") |
| C-4 | code | `apps/mobile/src/app/(tabs)/(garage)/edit-bike.tsx:66-84, 288, 540-583` | `edit-bike-make`, `edit-bike-model-search` etc. exist as `TEST_ID` constants; save requires a model |
| C-5 | code | testID grep over `apps/mobile/src` | exist: `home-screen`, `home-action-*`, `edit-bike-*`, `hub-tab-dock`; missing: every other id in §3A.4 |
| C-6 | code | `apps/mobile/package.json:71, 84`; `src/lib/network-error.ts:47`; `scripts/run-onboarding-e2e.sh:11-12` | `expo-network`, `expo-updates` installed; no NetInfo; runner supports a local Supabase override |
| C-7 | docs | `docs/runbooks/mobile-ota.md:3, 24-31, 157-188`; memory `reference_ota_hotfix_older_runtime` | OTA reaches only the matching runtime; the workflow publishes from a chosen git branch; older runtimes via release branch + cherry-pick |
| V1–V5 | `validation/` | Validation run 2026-11-12 (read-only): V1 production metrics (47 specs, corrected SQL), V2 returners vs non-returners (367 completers), V3 release and tooling state, V4 device repro on the store binary 3.28.0, V5 rider-survey prep | Applied in §11; query ids are cited as `V1-q…`, `V2-q…`, `V3 P…`, `V4 a…/b…`, `V5-…` |

---

## 8. Answers to review

Every item of `EXECUTION_PLAN-review.md` §1, with what changed. "Fixed" means the change is in this file (section named) **and** in the issue drafts in `issues/`.

| # | Item | Answer | Where |
|---|---|---|---|
| 1 | OTA path does not reach Android production | **Fixed.** Per-runtime OTA rule (target runtimes + reach from Q-P1, publish branch `release/<runtime>-365`, native-diff check, owner go-ahead). New task **TR0** ships P0 instrumentation to 3.26.0/3.27.0/3.28.0 runtimes, so T14b/T15b/T36/T38 gates get data before Release A; P1/P2 fix OTAs to older runtimes are owner decision D14b. *(Superseded 2026-11-12 by D17: TR0 removed by D17; instrumentation ships in Release A 3.29.0; OTA only for crash/data-loss hotfixes, §10.1.)* | §2, §3A.0 rule 1, §9 D17 |
| 2 | DB metrics cannot be PostHog tiles | **Fixed.** D2b: (B) server events `service_plan_imported` (T07a), `onboarding_bike_created`, `ride_saved` (T05e), push via `push_token_registered`, consent-aware (§3A.0 rule 6); (C) weekly DB checks recorded in `experiments.md`. Metric-source table per spec. | §3A.0 rule 6, §5A.4, T05e, T02 |
| 3 | Per-PR level bumps collide | **Fixed.** Level changes only at a release cut; per-friction status table (§6.1) records spec → level (the `ACTIVATION_FIXES` code map was dropped in the 2026-11-12 doc review). | §0, §3A.0 rule 2, §6.1, T01, T03a |
| 4 | FS-M target unreachable | **Fixed.** Per-runtime 7-day OTA share (≥ 90% of riders seen twice; since D17 used only for a crash/data-loss hotfix OTA) and a deterministic binary rule (100%); only the binary rule is alerted. | §5A.2, T03b |
| 5 | Annotation/dashboard procedure | **Fixed.** T02 + T03a block every production change incl. T07a (edges added); one batched owner approval per release; alerts on SQL insights confirmed supported (Q-P11), max 2 of the free tier's 5; annotations per platform × runtime. | §3A.0 rules 4–5, T03a, T03b |
| 6 | Exp 1 local draw ignores the flag | **Fixed.** `EXP1_START_AT` / `EXP1_STOP_AT` embedded; no local draw outside the window; before start everyone is control with `source:'pre_start'` and no exposure. D16 sets the date. *(Superseded 2026-11-12, §10 item 4: the window is served by the API; no OTA is needed to start or stop.)* | §3A.2 T30, T30, T35 |
| 7 | E2E pollution | **Fixed.** `e2e_run` super property from `EXPO_PUBLIC_E2E_RUN=1` builds, added to `{EXCL}` with a historical e2e person list (Q-P10: 0 today); runners mark created users `is_synthetic`; DB checks exclude synthetic and `e2e-%`; seeding flows run on local Supabase. Forcing consent decline was not chosen: the marker keeps the flows' own analytics assertions possible. | §0, T01, T02 |
| 8 | No CI runs Maestro | **Fixed.** Per-spec check location, "red first" on `origin/main` for reproducible bugs (incl. FS-OB1b, FS-OB1c, FS-OB3, FS-PO2a, FS-PO4b, FS-PO10), "guard only" for FS-OB6, FS-PO12, FS-PO5, FS-PO13 (iOS jest only); PR body carries command, log and screenshots. Adding Maestro to CI is out of scope (needs a macOS runner and a preview build per PR). | §0, §5A.1 |
| 9 | Missing testIDs | **Fixed.** testID ownership table; each issue lists its ids and requires `inspect_screen` on both platforms. Correction: `edit-bike-make` and `edit-bike-model-search` **do exist** as `TEST_ID` constants (`edit-bike.tsx:66-84`), the critic's literal grep missed them. | §3A.4, C-4, C-5 |
| 10 | NetInfo not installed | **Fixed.** T17 uses `expo-network` + `isNetworkError`; no native dependency. | §3 T17, T17 issue |
| 11 | T39 backfill unsafe | **Fixed.** Owner-run, reviewed `SECURITY DEFINER` RPC migration, dry-run SELECT first; no service-role user writes. | §3 T39, §3A.2, T39 issue |
| 12 | T23 dedup re-imports nothing | **Fixed.** `.is('deleted_at', null)` in the dedup (`oem-schedules.service.ts:222-228`; column at `database.types.ts:2001`); spec case "year change → same ids → re-created". Confidence 95% (column read). | §3 T23, C-1, C-2 |
| 13 | Missing graph edges | **Fixed.** Added T02/T03a/T06 → T07a, T07a → T23 → T22, T08 → T24; T08 ships its own in-form panel, T21's sheet reuses its copy keys, so no T21 → T08 edge. | §2 |
| 14 | T14/T15/T20 ahead of their evidence | **Fixed for T14 and T15**: Release A keeps only the cause-independent parts (local completion flag; jest guard against `(auth)` routing after completion); the rest moves to conditional T14b/T15b gated on 4 weeks of data *(since D17: counted from 3.29.0 go-live; the TR0 source was removed by D17)*. **Partly disagree for T20:** its fix (resume unless `from==='back'`) is safe whatever the remount cause and costs one condition; it stays in Release B with the event naming the cause. | §3A.1, §3A.2 |
| 15 | T16/T30 missing from D1 | **Fixed.** D1 now lists T16a and T30; T16a acceptance requires `onboarding-paywall-verify.yaml` in both arms and a ledger date. | §3A.3, T16a, T30 |
| 16 | T25 and placement inputs | **Answered.** Placement reads goals + pending intent only (`lib/onboarding-paywall.ts:44-50`); bike fields are RC attributes "targeting only" (`:64-80`). T25b changes no placement; D1c asks the owner to confirm no RC targeting rule reads `bikeModel`. | §3A.2, C-3 |
| 17 | S3 reintroduces measurement bugs | **Fixed.** S3 = F14 engaged return (completers 37/367); raw return kept as S3-raw outside the Exp 1 read; 24–48 h variant beside it. | §1.2, §5A.3 |
| 18 | Board instrumentation without a task | **Fixed.** #7 `source` on `maintenance_task_completed` and #8 F14 route constant + test in T05d; #10 weekly install-cohort table in T03b. | T05d, T03b |
| 19 | iOS back-walks | **Fixed.** New T19b (no swipe-back past the account step on iOS; in-screen back kept); FS-OB1b iOS target ≤ 8% [UNBACKED]. | §3A.1, §5 FS-OB1b |
| 20 | Frictions without a full spec | **Fixed.** FS-PO9 event SQL run (Q-P9); S6 SQL cited (R6:276-284) with [UNBACKED] target; FS-PO15/16 full specs + T41b tracking task. OB1/OB1-E now point at S6 / FS-OB1 explicitly. | §5A.3, T41b |
| 21 | FS-OB2c not measurable | **Fixed.** `auth_error_alert_shown {provider, outcome, error_code}` in T04a. | §5 FS-OB2c, T04a |
| 22 | FS-PO17 from one property | **Fixed.** `landing_sheet_shown {sheet, ms_since_landed, queue_position}` (constant T05d, fired by T16b); metric = riders with ≥ 2 within 60 s. | §5 FS-PO17, T16b |
| 23 | FS-OB1b metric mismatch | **Fixed.** `ms_on_screen ≤ 5000`, `trigger IN ('hardware','gesture')`, ≥ 3; `$screen` method kept beside it. | §5 FS-OB1b |
| 24 | Airplane mode on iOS | **Fixed.** Airplane-mode tails tagged `android`; iOS = jest only. | §0, §5A.1 |
| 25 | Tasks too large | **Fixed.** T03 → a/b, T04 → a/b/c, T05 → a/b/c/d (+e), T07 → a/b, T13 → a/b, T16 → a/b, T19 → a/b, T25 → a/b; T02 to M. | §3A.1 |
| 26 | Edit-bike model search | **Answered.** It exists (`edit-bike.tsx:66-84, 540-583`) and saving needs a model (`:288`); no picker reuse needed. | §3A.2 T22 |
| 27 | Africa Twin has no model rows | **Fixed.** FS-PO1H repro uses Yamaha MT-09 2019 (12 rows, DB-2/DB-4); make-only branch uses the Honda chip (10 make-generic rows, DB-3); FS-R2-3 edits a make-only BMW to R 1250 GS 2021 (10 rows). | §5 FS-PO1H, T07b, T23 |
| 28 | Small citations | **Fixed.** (a) `lib/analytics.ts:55`, platform moved earlier; (b) `fallbackToCacheTimeout` unset → default 0; (c) FS-PO4b baseline 13/11 via summary; (d) FS-PO10 baseline 8; (e) S6 target tagged [UNBACKED]. | §0, §2, §3 T01/T09, §5 |
| 29 | T27/T29 vs Exp 1 control | **Fixed (ledger option).** They ship in Release B as launch-day both-arm changes, logged in the ledger, read on mechanical metrics only. Moving them to Release A was rejected: Release A already holds 15 tasks and T27 needs a diagnosis step first. | §3A.0 rule 7, T27, T29 |
| 30 | API-then-client order | **Fixed.** merge API → Render deploy live → `pnpm generate` on main → client PR (T07b) → Release A. | §3A.0 rule 3, T07a/T07b |

### 8.1 Confidence after revision

*(Superseded by §11.1 after the 2026-11-12 validation: A 78%, B 75%.)*

**A — we know what needs to be done: 75%.** Unchanged from the planner's 75% (critic: 70%). Raised by: the T23 dedup defect is now confirmed in code and fixed in the plan (C-1, C-2);
T25's placement question is answered (C-3); test bikes with real model rows exist (DB-2/DB-4). Held down by: whether friction fixes move return at all (R6 §3.1, 60%); low-confidence causes
(OB2 60%, OB5 40%, RC-D 25%, PO12/PO13 30–35%) that are now explicitly behind data gates (T14b, T15b, T36, T38). Raised further by: 4 weeks of P0 instrumentation events from 3.29.0 go-live (D17; TR0 removed by D17) and the Exp 1 read.

**B — the plan is well defined: 78%** (critic 55%, planner 70%). All four blocking items have a concrete rule: release paths (D17: store builds only; TR0 removed by D17), D2b metric sources, a testID owner per id, the Exp 1
start gate. Every task is an issue with files, tests, a check location and a metric. Held down by: owner decisions D1/D1c/D2/D2b/D14/D14b/D16 still open; most HogQL is still *(draft)*
until T02 runs it; with D17 all client measurement waits for 3.29.0 go-live (no earlier data on the live runtimes); dates assume ~2 merged agent PRs per day (parallel agents; doc review item 5).

---

## 9. Owner decisions — DECIDED 2026-11-12

The owner delegated every decision ("decide for me with the best solution", 2026-11-12). These rulings are binding for the tasks;
a task that cites D# follows the ruling below. Change a ruling only with the owner.

| # | Decision | Ruling | Why |
|---|---|---|---|
| D1 | Both-arm onboarding fixes during the paywall A/B (T11, T12, T13a, T13b, T14, T16a, T19a, T19b, T20, T25b, T30) | **Approved as bug fixes**, shipped identically to both `onboarding_paywall_2026q4` arms. Each ship date is logged in `experiments.md` and annotated in PostHog; the paywall screens, copy, placement and offerings are not touched. | They fix broken behaviour that hurts both arms equally; identical exposure keeps the A/B comparison valid. |
| D1c | Does any RevenueCat targeting read bike attributes? | **Verified: no.** The only targeting rule (`b8bf6277e0`) reads `customAttribute:has_had_trial`; audiences use sandbox/status/purchase fields only (RevenueCat API, 2026-11-12). T25b may change bike fields freely. | Checked, not assumed. |
| D2 | Who makes PostHog writes | **The implementing agent**, from a named list per release (dashboard, insights, 2 alerts, annotations, flag `activation_365_first_session`), each write recorded in the release log (§6) with its id. No other PostHog writes. *(2026-11-12:)* the list is shared with the owner for information, not for approval; T03/T03b, §3A.0 rule 5 and 3A.3 now say the same. | Keeps writes traceable without blocking on the owner for each one. |
| D2b | Source for database metrics | **(B) server-side PostHog events + (C) a weekly read-only DB check** (script in T02). **No** warehouse connection of the production DB to PostHog (A). | No production DB credentials outside Supabase; events cover the dashboard, the weekly check covers what events cannot. |
| D3 | Standstill ride ended from the guard | **Discard in both arms** (not saved, not in history, does not tick the checklist; `ride_discarded {reason:'below_floor'}` fires). Auto-ended rides below both floors are **discarded too**, with the same event. *(Amended 2026-11-12, doc review item 6a:)* the guard discard applies to **any** guard-ended ride under the 50 m distance floor whatever its elapsed time (except the no-GPS ≥ 120 s branch), via "End without saving"; auto-ended rides below both floors go through the same `discardEndedRide`; the event is `ride_discarded {reason:'below_floor', trigger:'guard'\|'auto_end'}`; the auto-end notification reads "Your ride was too short to save". | A sub-floor ride is a test tap, not a ride; saving it pollutes history, stats and the first-ride signal. |
| D4 | Checklist first-ride row | **"Record your first ride" → opens Start Ride**; ticks only after a real saved ride. | The current row ticks on tap and leads to an empty list (FS-PO10). |
| D5 | Paywall frequency cap; bike limit | **Auto-present a gate paywall at most once per feature per session and at most 2 per session; 10-min cooldown after a paywall error; after the cap the app shows `LimitSheet` with a rider-tapped "See Pro plans".** Explicit upgrade surfaces (profile subscriptions row, Pro banner) are exempt. **Add bike for a free rider with one bike opens "Update my bike" first**, "Add a second bike (Pro)" second. The 1-bike free limit stays. *(Amended 2026-11-12, doc review item 9:)* "Update my bike" comes first only when the rider's bike has an empty model; for a complete bike the sheet shows "Add a second bike (Pro)" as primary and "Edit <bike>" as secondary. | Stops repeat paywalls (15% of riders) while keeping every purchase path; 2 of 3 gate purchases came on a repeat view, so the rider-tapped path stays. |
| D6 | Diagnostics copy and timeouts | **Localized limit panel** "This month's free diagnosis is used. It's back on {date}." (all app locale files enforced by `pnpm check:i18n`), exhausted CTA opens `LimitSheet` without promoting AI; **75 s client deadline** with offline pre-check and localized error + Retry; server retries unchanged. | Failures, not slow successes, cause the long waits (p90 47 s, up to 141 s). |
| D7 | Backfill existing bikes; reminder burst | **Yes, backfill the ~250 onboarding bikes** via an owner-run `SECURITY DEFINER` RPC after a dry run that reports counts (migration applied by the owner per `docs/runbooks/supabase-migrations.md`). **Backfilled and newly imported tasks schedule no immediate reminders: overdue items are shown as "due now" in the app, and at most 1 reminder per bike per 7 days.** *(Amended 2026-11-12, doc review item 2:)* the cap is built in T07a (`sendDuePush` groups due tasks by bike, one combined push naming the count, skip a bike pushed in the last 7 days) and ships before or with the T07a deploy; Home/Service show at most the 3 most urgent with "+N more" (T07b); T39 runs only after the cap is live. | Gives every existing rider the service plan without a notification storm. |
| D8 | Detect rider-edited OEM tasks on a model change | **No migration. Proxy: refresh only pending OEM tasks with `updated_at` within 60 s of `created_at` and no completion; never touch completed or rider-edited tasks.** | Safe default; a wrong guess only leaves an old interval in place. |
| D9 | Android Back on the first steps | **Back steps one screen; on the experience step Back returns to Welcome; Back on Welcome leaves the app. No dialog.** Progress is persisted (T13a/T13b), so a rider who leaves resumes where they were. | Platform-native, and with persistence nothing is lost. |
| D10 | Keep the rider's email on the device until onboarding ends | **Yes, in SecureStore, cleared when onboarding completes or on sign-out. Never the password or the code.** | Restores the code step after the rider reads the email (FS-OB3). |
| D11 | Landing-sheet priority in the first session | **At most one sheet on landing. Order: (1) analytics consent if required, (2) safety recall for the rider's bike, (3) "Service plan ready", (4) Exp 1 plan card (test arm only). Everything else (What's New, check-in) waits for a later session.** *(Clarified 2026-11-12, doc review item 6d:)* at most one **modal** sheet per cold session; consent is an earlier gate, not a landing sheet; the Exp 1 plan card is an inline Home card shown only when no sheet is shown; What's New and check-in become eligible from the next session. *(Addition 2026-11-12, validation V5:)* **at most one inline Home card per session; the Exp 1 plan card (test arm) wins**; the install-reason card (P05.3) waits for the next later-day open, in both arms. | Safety first, then the value the rider came for; never stacked sheets (FS-PO17). |
| D12 | Start Ride first-open (T27) and Discover location ask (T29) | **Ship in both arms before the Exp 1 slot opens** (in Release B, before the Exp 1 start). *(Validation 2026-11-12, V1 FS-PO8:)* T29 now **targets Release A** — earlier, still both arms and before the slot, so the ruling's rule holds; if T29 misses the Release A cut, it ships in Release B as before. *(Amended 2026-11-12, doc review item 5:)* if either misses the Release B code freeze (2026-12-05), it ships in the first store build **after** the slot, never inside it (D17: never by OTA). | Bug-level fixes; shipping them before the slot keeps the experiment clean. |
| D13 | Experiment 1 ledger | **Signed as specified:** the bundle holds the single slot; primary S1 (week-1 core action among completers, baseline 61/367); Miller N = 64 + one one-sided z-test at the cap; cap **2027-03-31**; no start after **2027-01-06**; after a capped no-winner keep the bundle if the 90% lower bound > −3 pts, else revert (qualitative signals reported beside the decision, not gating); chips Later today, Tomorrow, This weekend, Not sure yet; first chip **"Later today"**; `maintain_bike` day-1 copy **"When did you last service your {model}?"** (opens the bike's service plan); notification kind `activation` with a `source` property. *(Implementation note, validation V2, 2026-11-12 — owner confirmation recommended:)* the one one-sided z-test at the cap is computed **stratified** (Mantel–Haenszel on goal `track_rides` vs other × platform), `returning_account` riders are excluded from the primary, `track_rides` is the one pre-specified subgroup, and the detectable effect is stated as an absolute lift (FS-EXP1). Primary metric, Miller rule, cap and keep rule are unchanged. | The board's recommended design; "Later today" avoids promising a ride the same minute; the maintenance copy matches what those riders came for. |
| D14 | Release train | **3.29.0 (Release A) submit target 2026-11-30; 3.30.0 (Release B) 2026-12-08; both platforms.** Promote Android **vc99 (FCM)** to production as soon as vc98 clears Google review. *(Implementation, validation V3, 2026-11-12:)* vc98 is in production (the condition is met); vc99 is an internal **draft** named "3.26.0": rename it "3.28.0 (99)", roll to internal, verify a push token registers, then promote with the owner's go-ahead; if it is not promoted before the 3.29.0 cut, FCM ships in 3.29.0 and vc99 is dropped. | Matches the dependency graph and the 2027-01-06 hard stop. |
| D14b | OTA the P1/P2 fixes to older runtimes? | **No.** Fixes ship in 3.29.0/3.30.0 and later store builds. *(Amended 2026-11-12 by D17:)* the rule is now **absolute**: no OTA of fixes, features or instrumentation to any runtime (older or current); the only exception is an urgent crash or data-loss hotfix per `docs/runbooks/mobile-ota.md`. Older runtimes get no instrumentation OTA (TR0 removed by D17). | New riders run the binary's embedded JS anyway; release-branch OTAs are manual and error-prone. |
| D15 | Credential Manager for Android Google sign-in | **Keep the data gate:** adopt it in T36 only if T04a data shows ≥ 10% hung Google sheets over 4 weeks. | Avoids a native auth migration without evidence. |
| D16 | Exp 1 start date | **The first day 3.30.0 is ≥ 90% of new installs on both platforms, but not later than 2027-01-06.** If not reached by then, do not start the slot this season; ship the bundle on the no-harm path (P06.3). *(Amended 2026-11-12, doc review item 4:)* the start is set **server-side** in the API field `activationExperimentWindow {startAt, stopAt}` (T30's API part, deployed before the 3.30.0 cut) on that day, and the PostHog flag is flipped the same day; no OTA and no other switch. A null or unreachable window means not started (control, `source:'pre_start'`, no draw); the embedded ceilings (stop 2027-03-31, no start after 2027-01-06) always apply. | Assignment must run in the binary new riders install; a server-side window can be set or pulled back without a release. |
| TR0 | Per-runtime instrumentation OTA | **Removed by D17 (2026-11-12):** instrumentation ships in Release A 3.29.0 (T18). The earlier go-ahead (per-runtime OTAs to 3.26.0/3.27.0/3.28.0 from `release/<runtime>-365` branches) is withdrawn; first-session and post-onboarding events, the T14b/T15b/T36/T38 gate windows and FS-OB* pre-fix baselines start at 3.29.0 go-live per platform (R1/R5 proxy SQL as pre-fix comparison). | See D17. |
| D17 | How new functionality ships (owner rule, 2026-11-12, binding) | **Every new functionality — features, UI changes, the experiment, new events/instrumentation, testIDs — ships ONLY in a new store build version (App Store + Play, bumped app version: 3.29.0, 3.30.0, then the next store build). OTA is used only for urgent crash or data-loss hotfixes per `docs/runbooks/mobile-ota.md`.** API deploys and owner-applied migrations are unaffected (they are not app builds). Replaces the per-runtime OTA rule (§3A.0 rule 1), removes TR0, makes D14b absolute. | OTAs reach only their own runtime and apply on the next launch, so new riders' first sessions run the binary's JS; per-runtime release-branch OTAs were complex and risked rolling back shipped OTAs. |
| — | Commit the research and plan; create the GitHub issues | **Yes.** Commit `docs/research/activation-365/` (emails and person ids redacted) via a docs PR; create one issue per draft under #365 in plan order, with "Blocked by" links. | Agents need the plan and its evidence on `main`. |

---

## 10. Doc review 2026-11-12 — changes applied

The owner delegated every decision; the rulings below are final. Each line names what changed and where. `issues/NN` = `issues/NN-<task>-*.md`.
`experiments.md` does not exist yet, so the ledger text is in "Ledger notes" below; T02 copies it into `experiments.md` when it creates that file.

| # | Change | Plan sections changed | Issue drafts changed |
|---|---|---|---|
| 1 | Server-side PostHog events (`onboarding_bike_created`, `ride_saved`, `service_plan_imported`) respect analytics consent: `readAnalyticsDecision` + `hasAnalyticsConsent` (`apps/api/src/modules/analytics/analytics-consent.ts`); consent → user id; no or missing decision → constant `distinct_id` per event + `NO_CONSENT_PROPERTIES`; never email; jest per event. | §3A.0 rule 6, §3 T07 What, §8 row 2 | 12 (T05e), 15 (T07a) |
| 2 | D7 reminder cap built inside T07a (`sendDuePush`: one combined push per bike, skip a bike pushed in the last 7 days; imported/backfilled tasks no immediate reminder); client "due now" + top 3 "+N more" in T07b; T39 depends on it; T06 item 7 answered (no immediate burst; same-day clustering at interval anniversaries). | §2 graph, §3 T06 item 7, T07 Depends/How/Acceptance/Risks, T39, §3A.1 rows 15/54, §3A.2 T07, §9 D7 row | 13 (T06), 15 (T07a), 16 (T07b), 54 (T39) |
| 3 | *(Historical; TR0 removed by D17, §10.1.)* TR0 release branches cut from the latest production update commit per runtime (3.28.0: `fece7a3c` / `5a497a1c`), not the store build; `git log` check; scope = events/properties only (T05c's sheet render + testIDs → Release A); pre-publish `onboarding.yaml` + `log-ride.yaml`; TR0 measures later sessions only; T36/T38 windows and FS-OB* baselines start at 3.29.0 go-live, R1/R5 proxy SQL as pre-fix comparison. | §2 table + graph, §3A.0 rule 1, §3 T18/T36/T38, §3A.1 rows 10/14/51/53, §9 TR0 row | 03 (T03a), 10 (T05c), 11 (T05d), 14 (TR0), 29 (T18), 51 (T36), 53 (T38) |
| 4 | Exp 1 start/stop served by the API: nullable `activationExperimentWindow {startAt, stopAt}` on the `User` returned by `completeOnboarding`, deployed before the 3.30.0 cut; embedded ceilings 2027-03-31 / 2027-01-06; null or unreachable = not started; start set server-side on the D16 day with the flag flip the same day; "move `EXP1_START_AT` by OTA" deleted. | §2 P3 row, §3 T30, §3A.0 rule 3, §3A.1 row 43, §3A.2 T30, §3A.3 D16, §8 row 6, §9 D16 row | 43 (T30), 48 (T35), 02 (T02 ledger text) |
| 5 | Release B: T35 hard dependencies = Exp 1 minimum set (T02, T05c, T05d, T09, T10, T18, T30, T31, T32, T33, T34); code freeze 2026-12-05; P2 tasks that miss it go into the next store binary, never an OTA; T27/T29 then ship after the slot (D12 holds); ≈ 2 merged PRs/day needed. | §2 table, graph and freeze note, §3 T35, §8.1, §9 D12 row | 48 (T35, incl. `depends_on`) |
| 6a | D3 / T09: any guard-ended ride under 50 m discarded whatever its time (except no-GPS ≥ 120 s); auto-ended sub-floor rides discarded via the same `discardEndedRide`; `ride_discarded {reason:'below_floor', trigger}`; "Your ride was too short to save"; auto-end jest case. | §3 T09, §5 FS-PO4b, §9 D3 row | 18 (T09) |
| 6b | D9 / T19a: Back on experience → `router.replace` to Welcome (`from:'back'`); only Welcome returns `false`; new Maestro tail. | §3 T19, §5 FS-OB1b | 30 (T19a) |
| 6c | D10 / T13a: email + `codeSentAt` in a dedicated `expo-secure-store` key; MMKV v10 holds only mode and bikeDraft; partialize test. | §3 T13 | 22 (T13a) |
| 6d | D11 / T16b: at most one modal sheet per cold session; consent earlier gate; recall → "Service plan ready"; plan card inline only when no sheet; What's New/check-in next session; FS-PO17 ids incl. `whats-new-sheet`. | §3 T16, §5 FS-PO17, §3 T32, §9 D11 row (clarified) | 27 (T16b), 45 (T32) |
| 6e | D2: the agent makes PostHog writes from the named per-release list, records ids in §6; list shared with the owner for information. | §3 T03, §3A.0 rule 5, §3A.1 row 04, §3A.3 D2, §9 D2 row | 04 (T03b) |
| 6f | D2b: warehouse option (A) deleted. | §3A.0 rule 6, §3A.3 D2b, §8 row 2 | — |
| 6g | D8 / T23: rider-unedited = pending, never completed, `updated_at` within 60 s of `created_at`; T06 item 6 dependency removed. | §2 graph, §3 T06 item 6, §3 T23, §3A.1 row 34 | 34 (T23), 13 (T06) |
| 6h | D13: caps 2027-03-31; T32 chips Later today, Tomorrow, This weekend, Not sure yet; T40 keep rule (90% lower bound > −3 pts else revert; qualitative not gating). | §1.4 D13, §3 T32, §3 T40, §9 D13 row | 45 (T32), 55 (T40) |
| 7 | T17: after 75 s "Still working — if it finishes, it will appear in your diagnoses"; submit locked until ≈ 240 s (`AI_CLIENT` 60 s × (1 + 3)); quota refetch; Retry refetches first; jest. | §3 T17, §5 FS-PO2b, §5A.1 | 28 (T17) |
| 8 | T39 hardening: `SET search_path = ''`, revoke EXECUTE from PUBLIC/anon/authenticated, `supabase/checks` privilege assertion, dry run with per-tier counts + correctness sample, drop the function after the run, depends on item 2's cap. | §3 T39, §3A.1 row 54 | 54 (T39) |
| 9 | UI states: T21 LimitSheet copy table (5 features + fallback); T08 unknown-date line, date-fns, "Done" behaviour; T16a CTA state table; T22 "Update my bike" first only for an empty model (D5 amended); T32 card states; T10 migration unticks `first_ride`; T25b no-match states; T11 transient "Account ready" notice. | §3 T08, T10, T11, T16, T21, T22, T25, T32, §3A.4, §5 FS-OB1a, §9 D5 row | 17 (T08), 19 (T10), 20 (T11), 26 (T16a), 33 (T21), 35 (T22), 38 (T25b), 45 (T32) |
| 10 | Seeded Maestro flows run on a Release build pointed at local Supabase + local NestJS API (`features/bike-detail-shell-overview/local-stack.md`; Android `10.0.2.2`), `pnpm db:reset`, matching runner `SUPABASE_URL`. | §0 Maestro | 17 (T08), 33 (T21), 36 (T24) |
| 11 | Reading rule: iOS first-session same-weeks comparison n/a; Nov–Mar harm checks against a concurrent comparison (Android staged rollout before the slot, Exp 1 control after); trailing-8-week drop alone = "no verdict (season)", never a revert. FS-M release check binary 100%, alert on any mismatch 3 days after go-live. | §0 reading rule, §1.2, §3 T03 alerts, §3 T18, §5 FS-M, §5A.2 | 04 (T03b), 29 (T18), 48 (T35) |
| 12 | First dashboard tile "Day-1 drop-off funnel", checked against the evidence pack. | §3A.2 T03 | 04 (T03b) |
| 13 | Scope trims: `ACTIVATION_FIXES` code map dropped (§6.1 is the record); `first-session-no-auto-hud.yaml` dropped (alert stays the guard); T05d keeps `screen_load_timed` for Discover only and drops `notification_permission_status`; FS-OB7/PO9/PO11/PO15/PO16 SQL only, no tile; T37, T41, T41b removed from the task list and closed (ledger notes below); FS-EXP1 power for two start dates. | §0, §2, §3 T05/T25/T37/T41, §3A.0 rule 2, §3A.1, §3A.2, §4, §5 FS-OB7/PO5/PO9/PO11/PO15-16/EXP1, §5A.1, §5A.3, §6.1, §8 row 3 | 01 (T01), 02 (T02), 03 (T03a), 04 (T03b), 11 (T05d), 14 (TR0, since removed by D17), 16–20, 22, 26–30, 33, 35, 36, 38, 48 (Release lines without the map), 52 (T37), 56 (T41), 57 (T41b) closed; 48 (T35), 55 (T40) power |
| 14 | Recorded (no task change): the real fixes for PO12/PO13 (T14b, T15b, T38) stay gated on data because their cause confidence is 25–45%; the owner accepts that they arrive one release later. Weekly DB check SQL files begin with `BEGIN READ ONLY;` and end with `COMMIT;`. | §3A.0 rule 6 | 02 (T02) |

### Ledger notes (for `experiments.md`)

- **Post-slot candidate queue (was T41), in order:** P05.3 install-reason card (**card only**, see the P05.3 note below); P05.2 plate "Set up service plan"; day-1 nudge in its own slot (spring, only if Exp 1 wins);
  P04.3a iOS provisional notifications. Re-run the R6 returner comparison on ~100 first sessions per `activation_fix_level` after the slot (any new Replay Vision scan needs
  the owner's approval).
- **PO15 (receipt-scan fallback) and PO16 (trip missing in My trips) (was T41b):** "verify if seen again". Not fixing now; SQL in `queries/fs/`, no tile; full specs in §5A.3.
  If either shows up again in replays or support, open a task with its repro.
- **NHTSA model catalog cache (was T37):** trigger = `bike_setup_summary.model_fetch_ms` p90 > 3 s on any version (read from 3.29.0 go-live). If it fires, persist the
  catalog (`apps/api/src/modules/motorcycles/nhtsa.service.ts`), target p90 ≤ 1.5 s.
- **Experiment 1 start/stop:** the window is served by the API field `activationExperimentWindow` (T30); null or unreachable = not started; embedded ceilings stop 2027-03-31,
  no start after 2027-01-06; the start is set server-side on the D16 day and the PostHog flag flipped the same day. No OTA is needed to start or stop.
- **Experiment 1 power (approximate, normal approximation, Appendix B not re-run):** start 2026-12-15 → ≈ 0.78 at a 12.6% baseline, ≈ 0.65 at 9.5%; start 2027-01-06 →
  ≈ 0.69 at 12.6%, ≈ 0.56 at 9.5% (one-sided α = 0.05 at the cap, 2.1 completers/day, ×2 effect). A capped no-winner means "no doubling shown".
- **P05.3 install-reason card — card only (validation V5, 2026-11-12).** The email channel is empty: 22 riders ticked the contact box (live since 10-14, source `onboarding`, wording v1),
  21 of them inactive and live, and **0 of them ever sent feedback**, so under the narrow reading of "The developer may contact me about my feedback" the pool is **0**
  (loose reading 21: es 11, en 9, tr 1). A broader email needs a **new wording-v2 opt-in** after the onboarding paywall A/B ends, and a stand-alone way to withdraw
  `feedbackContact` (today only by sending feedback again unticked; product gap, not a #365 task). Card: inline Home card, shown once on the first cold start on a **later calendar
  day** after completion, dismissible, theme tokens (light + dark), never in a session where a modal sheet or the Exp 1 plan card showed (D11 addition). Answers map 1:1 to the
  onboarding goals: `track_rides`, `maintain_bike`, `manage_expenses`, `discover_routes`, `just_exploring`, `other` ("Something else" opens the existing feedback form; its text stays in
  `feedback_messages`, never in PostHog). Events (consent-gated, `as const` constants next to `FEEDBACK_SENT`): `install_reason_card_shown {days_since_onboarding}`,
  `install_reason_answered {answer, matches_primary_goal, days_since_onboarding}`, `install_reason_dismissed {days_since_onboarding}`; strings in all app locale files
  (`pnpm check:i18n`). **Under D17 it must be in a store binary:** 3.30.0 at the latest (it then needs its own issue before the 2026-12-05 freeze), gated identically in both Exp 1
  arms, its go-live date logged as a both-arm change; otherwise it waits until after 2027-03-31. Expected yield ≈ 12–20 answers in 8 weeks — enough to see a dominant reason,
  not to rank close ones, and it hears only riders who come back. Sending any email or shipping the card needs the owner's approval.
- **Push-grant correlation is not notification evidence (V2).** No rider in the 08-14→11-04 cohort got a re-engagement message (1 of 426 new users got any server push in
  week 1), so R6's push-grant split (12/45 vs 4/55) and V2's OR 1.7 describe a rider trait, not a message effect. Do not cite them for a notification lever.
- **`maintain_bike` riders (V2 §5.1 item 6):** they return on days 7–13 at the baseline rate (7/65) but almost never on day 2 (3/72); read them on S1 and days 7–13, never on
  S3. The D13 d1 copy stays as the owner's bet.
- **Follow-up after T40 — default week-1 message for everyone (V2 "missing lever").** Today 0 of 426 new users get a week-1 message except the rare maintenance push; Exp 1 tests a
  re-engagement message (T32 reminder, T34 d1 fallback) only inside the slot and only in the test arm. After T40, decide the default week-1 message for all riders (control and
  post-slot), using T40's d1-fallback read and the T33 delivery result. Not a task this season.
- **Growth hypothesis — referral quality (V2 §3.1, confidence 55%):** riders who heard of MotoVault from an AI chat return 2× (18/62 = 29% vs 13%); social referrals (FB/IG/TikTok)
  return at 5% (2/41). One of ~60 tests; pass to growth as a hypothesis, outside #365. Install attribution carries no usable source (`install_source` null or
  `organic_unknown`), so the self-reported `referral_source` is the only signal.
- **Accepted delay (item 14):** T14b, T15b and T38 (PO12/PO13 and the session drop) ship one release after their data gate, not in Release A.
  Since D17 their data gates count from 3.29.0 go-live and their fixes ship in the next store build after the gate.

### 10.1 Owner rule D17 — changes (2026-11-12)

Rule: every new functionality (features, UI changes, the experiment, new events/instrumentation, testIDs) ships only in a new store build version (App Store + Play,
bumped app version); OTA only for urgent crash or data-loss hotfixes per `docs/runbooks/mobile-ota.md`; API deploys and owner-applied migrations unaffected.
**Level numbering decision:** numbers are kept, **level 1 is not used** (it was TR0). 0 = T01's initial constant (pre-release JS, dev/preview builds only), 2 = Release A 3.29.0,
3 = Release B 3.30.0, 4+ = later store builds and any crash/data-loss hotfix OTA. `activation_fix_level` semantics are unchanged.

| # | Change | Plan sections changed | Issue drafts changed |
|---|---|---|---|
| D17-1 | §9: new ruling row D17; D14b amended (no OTA of fixes to any runtime, absolute except crash/data-loss hotfixes); TR0 row replaced by "Removed by D17"; D12 "never by OTA" tied to D17. §3A.3 lists D14b (amended) and D17. | §9, §3A.3 | — |
| D17-2 | TR0 removed as a task: P0 instrumentation (T01, T04a–c, T05a–e incl. T05c's guard-sheet change/testIDs) ships in Release A 3.29.0. T18 depends on T01, T04a, T04b, T04c, T05a, T05b, T05c, T05d (+ T07b–T17); T14b, T15b, T36, T38 depend on T18, data-gate windows from 3.29.0 go-live per platform, R1/R5 proxy SQL for pre-fix comparisons. §2 phase table (P0, P1, P2, P4 rows), "why store binaries" paragraph (D17 rule), mermaid graph (TR0 node/edges removed; T01/T04a–c/T05a–d → T18; T18 → T14b/T15b); §3A.0 rule 1 rewritten (release paths: store builds 3.29.0/3.30.0, API deploys, owner migrations; OTA only for crash/data-loss hotfixes) and rule 2 (levels); 3A.1 row 14 dropped (other orders kept), rows 01/03/05–11/29/49/50/53 updated; 3A.2 TR0 bullet → "Removed by D17"; T14b gate wording; §3 T01 (release, constant 0, verification, risks), T04/T05 release + acceptance, T18 (depends, blocks, release, level 2, instrumentation note); §0 `{REL}`/marker/annotation text; §1.2 co-existence wording; §5 FS-M; §5A.2 (OTA share = hotfix OTA only); §6 header; §6.1 FS-M row (T01, T18); §8 rows 1/4/14 and §8.1 annotated as superseded/historical. | §0, §1.2, §2, §3, §3A.0–3A.3, §5, §5A.2, §6, §6.1, §8, §8.1, §9 | 14 (TR0: CLOSED line), 29 (T18), 49 (T14b), 50 (T15b), 51 (T36), 53 (T38), and the `TR0`-listing drafts 01, 03, 05–11 |
| D17-3 | Every fix-shipping "later OTA" / "OTA + Release A/B" / "next build / OTA" / "OTA to the 3.29.0+ runtime" / "optional older-runtime OTA" path → Release A/B or "next store build". Remaining OTA mentions are facts (why OTAs miss first sessions, runtime reach, FS-PO3b repro) or the crash/data-loss hotfix exception. | §2, §3 (T01, T04, T05, T08–T17, T19–T29, T18, T35, T36, T38, P3 intro, release-path rule), §3A.0 rules 3–4, §5, §5A.2, §6 | 01, 03, 04 (T03b "no data until" line), 05–11, 17 (T08), 29, 37 (T25a), 48 (T35), 49, 50, 51, 53 |
| D17-4 | Issue draft 14 (TR0) marked closed by D17 (first body line); `depends_on` of T18, T14b, T15b, T36, T38 no longer list TR0; `release_path` values that named OTA now name store builds. | — | 14, 29, 49, 50, 51, 53, 01, 05–11, 17 |
| D17-5 | This list. | §10.1 | — |

---

## 11. Validation 2026-11-12 — changes applied

Five read-only validation reports were folded into this plan and its issue drafts the same day: `validation/V1-metrics.md` (production metrics, 47 specs),
`validation/V2-returners.md` (returners vs non-returners, 367 completers), `validation/V3-release.md` (stores, EAS, tooling), `validation/V4-device-repro.md` (device repro on the
store binary 3.28.0) and `validation/V5-rider-survey.md` (survey prep, nothing sent). Every correction they list was applied unless marked otherwise below.
**No correction conflicted with a §9 ruling.** Three touch a ruling's wording and are applied as implementation notes or additions, flagged for the owner: D13 (stratified test),
D12 (T29 earlier), D11 (one inline card). `issues/NN` = `issues/NN-<task>-*.md`.

| # | Source | Change | Plan sections changed | Issue drafts changed |
|---|---|---|---|---|
| V1-1 | V1 §3.1, item 1 | `{REL}` platform: person-level `argMinIf(platform, platform IS NOT NULL)` with a temporary `$app_build` fallback (valid for 3.26.0–3.28.x only); `$os` dropped (never set); `build` column added; tiles never group by the first event's platform before T01 | §0 `{REL}`, §5 FS-OB1b SQL | 04 (T03b), 29 (T18 SQL) |
| V1-2 | V1 item 1 | T01 acceptance: `platform` non-null on 100% of `Application Opened`, incl. the first open | §3 T01, §3A.1 row 01 | 01 (T01) |
| V1-3 | V1 item 7 | `{RN}` never applied to server events (`signup_completed`, T05e/T07a events) | §0 `{RN}`, §5 FS-OB2a/2b/5 | 02, 04, 05 |
| V1-4 | V1 §0, item 16; V2-s1 | `{EXCL}` = 13 persons (not 12) + the internal tester (V3 item 7) + the V4 emulator person if identifiable; Supabase snippets qualify `u.deleted_at`/`u.email` | §0 `{EXCL}`, §0 `{RN}` note | 02 (T02), 00 (T00 side rule) |
| V1-5 | V1 item 2; V3 P1/P2 | Q-P1 rewritten: per-person platform (Android 3.26.0 108; iOS 3.26.0 37, 3.27.0 14, 3.28.0 11; Android 3.28.0 5 incl. a tester); `(null)` rows were an artefact | §0.1 Q-P1, §2 "why store binaries" | — |
| V1-6 | V1 item 15 | S1 anchored on the first `onboarding_completed` (7 d); canonical baseline 37/275, 3.26.0 8/84; 61/367 kept as first-seen reference | §1.2 S1, §5 FS-EXP1 | 02, 45 (T32), 48 (T35), 55 (T40) |
| V1-7 | V1 item 11 | S4(a) gets a `source = 'oem'` column; T07 judged on S4(b)/R2-M1 and the `oem` column | §1.2 S4, §5 FS-PO1H, §5A.4 | 02, 15 (T07a) |
| V1-8 | V1 item 6 | S5 note: exclude explicit upgrade surfaces until `trigger` exists | §1.2 S5 | — |
| V1-9 | V1 §3.2, item 8 | FS-OB1b `$screen` SQL written down (V1 §3.2), baseline Android 28/201, iOS 14/72 | §5 FS-OB1b | 06 (T04b), 30 (T19a), 31 (T19b) |
| V1-10 | V1 §3.3, item 8 | FS-OB1c ordered SQL; baseline bike-setup 8/31, account 5/13, goals 3/11 | §5 FS-OB1c | 23 (T13b) |
| V1-11 | V1-q37 | FS-OB1d proxy baseline 12 / 60 d, 6 on 3.26.0 | §5 FS-OB1d | 06, 32 (T20) |
| V1-12 | V1 item 8 | FS-OB1e "4 completed twice" → 6; relapse 10/292 | §5 FS-OB1e, FS-OB6 | 24 (T14), 26 (T16a), 49 (T14b) |
| V1-13 | V1 item 9 | FS-OB2a proxy 23/111 (20.7%); `activation_release` → `activation_fix_level` in M-OB2/3/5 | §5 FS-OB2a, FS-OB3, FS-OB5 | 05 (T04a), 51 (T36) |
| V1-14 | V1 §3.5, item 9 | FS-OB2b fixed SQL (first step after sign-up, > 10 min = backgrounded); baseline 6/124 | §5 FS-OB2b | — |
| V1-15 | V1-q24 | FS-OB4 drift recorded; T02 fixes the window before the p90 target | §5 FS-OB4 | 38 (T25b) |
| V1-16 | V1 §3.4 | FS-OB5 proxy SQL + baseline 18/166 (3.26.0), 46/470; FS-OB7 60 d 13/216 | §5 FS-OB5, FS-OB7 | — |
| V1-17 | V1 item 6, §3.7 | FS-PO3 denominator 14 automatic-gate sessions, 9 repeats (64%), 8 ≤ 60 s; surface filter until `trigger` | §5 FS-PO3 | 08 (T05a), 33 (T21) |
| V1-18 | V1 item 7 | FS-PO4a baseline 1/14 (complete-window guard) | §5 FS-PO4a | 10 (T05c), 44 (T31) |
| V1-19 | V1 item 14 | FS-PO4b DB share: null distance counted as sub-floor (26/71 + 15 null) | §5 FS-PO4b | 10, 12 (T05e), 18 (T09) |
| V1-20 | V1 items 3–4, §3.5 | FS-PO6/PO11/PO12/PO13/PO14 use the per-completer query (R6 joins counted event rows); baselines PO6 7/116, PO11 2/120, PO12 11/292 (5/120), PO13 7/292 (5/120), PO14 68/132; T06 item 1 lowered to replay confirmation | §5 FS-PO6, PO11–PO14, §3 T06 item 1, §5A.3 | 13 (T06), 25 (T15), 41 (T28), 40 (T27) |
| V1-21 | V1 item 5, §3.6 | FS-PO8 baseline 42/43 Android (iOS 0/28, Garage 1/59); **T29 moved to Release A** (first in Release B if it misses the cut); T06 item 8 confirms the dialog type on a device | §1.3, §2 table + graph, §3 T06 item 8, §3 T29, §3A.0 rule 7, §3A.1 row 42, §4, §5 FS-PO8, §5A.1, §6.1, §9 D12 note | 13 (T06), 29 (T18), 42 (T29), 48 (T35) |
| V1-22 | V1 items 12–13 | FS-R2-4 denominator from `measurement_system`/`service_plan_imported.unit` (`mileage_unit` defaults to `'mi'`); FS-R2-5 baseline 6/176 short makes, "known make" = `make_valid` | §5 FS-R2-4, FS-R2-5 | 02, 12, 15, 38 |
| V1-23 | V1 FS-PO10 row | "with a real ride" must precede the tick | §5 FS-PO10 | — |
| V1-24 | V1 §3 | §5A.3 points T02 at V1 §3.1–3.8 verbatim | §5A.3, §3 T02 | 02 (T02) |
| V2-1 | V2 §4, §5 | §1.1 diagnosis: day-0 ride start (35% vs 10%, OR 4.5), ≥ 3 day-0 sessions, `track_rides` mostly via riding, day-0 logging (rides/expenses yes, maintenance no), push grant a weak trait | §1.1 | 45 (T32 Why) |
| V2-2 | V2 §5.1 items 2–3 | FS-EXP1: pre-registered stratified S1 test (MH, goal × platform), `track_rides` the one subgroup, `returning_account` excluded, absolute-lift framing, power recomputed (MDE ≈ +12.5 to +15.5 pts; Monte-Carlo: stratification ≈ same power), Oct-level baseline flagged | §1.2 S1, §5 FS-EXP1, §3 T40, §3A.3, §9 D13 note | 48 (T35), 55 (T40) |
| V2-3 | V2 §5.1 item 4 | T30 `activation_exposure` adds `primary_goal`, `returning_account` | §3 T30 | 43 (T30) |
| V2-4 | V2 §5.3 | S3 per-release reads use the rider's 24–48 h window as primary (calendar day only inside Exp 1) | §0 reading rule, §1.2 S3, §5A.3 | 03 (T03a), 04 (T03b), 29 (T18) |
| V2-5 | V2 §5.2 | T27 = the P2 task most likely to move return; own metric day-0 `ride_started` among Start Ride openers, baseline 63/130 | §1.1, §3 T27, §3A.1 row 40, §4, §5 FS-PO14 | 40 (T27) |
| V2-6 | V2 §5.1 item 5 | T33/T34 are the only notification-lever test; push-token gap is a prerequisite | §3 T33, T34 | 46 (T33), 47 (T34) |
| V2-7 | V2 §5.1 item 6 | `maintain_bike` judged on S1 and days 7–13, never S3 | §1.2 S3, §5 FS-EXP1, §10 ledger | 47 (T34), 55 (T40) |
| V2-8 | V2 "missing lever", §3.1 | Ledger: follow-up after T40 on the default week-1 message; growth hypothesis on referral quality (AI-chat 2×); push-grant correlation is not notification evidence | §2 graph (FU node), §4, §10 ledger | 55 (T40) |
| V3-1 | V3 item 1 | §6 row 0 rewritten (stores, builds, per-person riders, OTA groups) | §6 row 0 | — |
| V3-2 | V3 item 2 | vc99 steps (rename "3.28.0 (99)", internal, push-token check, promote with owner go-ahead) or FCM folded into 3.29.0; 3 Android test tokens already registered | §1.4 D14, §3 T18, §3 T06 item 9, §9 D14 note | 13 (T06), 29 (T18) |
| V3-3 | V3 items 3–6 | **New task T00 — test environment setup** (iOS runtime + simulator, pinned Supabase CLI, `mvscratch` at the latest migration, "`pnpm db:reset` cannot replay", `e2e-android` profile + universal-APK recipe, `pnpm install`, optional API-34 Play AVD); first in order; blocks T05c, T18, T35 and every Maestro-accepted task | §0 Maestro bullets, §2 table + graph, §3A.0 rule 9, §3A.1 (row 00 + T00 in 31 rows), §3 T18/T19/T35, §4 | **00 (new)**; `depends_on` + "Blocked by" of 01, 10, 16–33, 35, 36, 38–45, 48 |
| V3-4 | V3 item 3; V4 Invalidates | "preview build" replaced by the T00 recipe (e2e-simulator / `e2e-android` / universal APK / dev client on the local stack); seeded flows use `mvscratch`, not `pnpm db:reset` | §0, §1.3, §3 T01, T07, §5 FS-OB1a, OB1b, OB1e, OB3, PO2a | 01, 06, 16, 17, 20, 30, 33, 36, 02 |
| V3-5 | V3 item 6 | FS-OB2a device: GMS image + Google account (T00 AVD) or T00's optional API-34 Play AVD | §5 FS-OB2a | 50 (T15b), 51 (T36) |
| V3-6 | V3 item 9 | Hotfix guidance: a 3.27.0 hotfix branches from store-build commit `2ce57d1d` (no OTA ever on 3.27.0) | §3A.0 rule 1 | 03 (T03a), 29 (T18) |
| V3-7 | V3 item 8 | Thin Android `lvl = 2` cohort at the 2-week read = "no verdict" | §0 reading rule, §3 T18 | 03, 04, 29 |
| V4-1 | V4 (a)–(b) | §1.3 confidences: RC-B ~90%, RC-C ~85%, RC-D 25% → ~80% (trigger: Back out + warm launch, `resumeHandledThisLaunch` already true) | §1.3, §5 FS-OB1b/c/d, §11.1 | 23, 30, 32 |
| V4-2 | V4 (b) | T20: trigger known, Maestro `onboarding-welcome-warm-resume.yaml`, jest "flag true, new mount, no param → resume"; **T19a and T20 ship in the same build** | §2 table + graph, §3 T19, T20, §3A.0 rule 8, §3A.1 rows 30/32, §5 FS-OB1d, §5A.1, §6.1 | 30 (T19a), 32 (T20), 48 (T35) |
| V4-3 | V4 (a) a3, a5 | T13: goals seeds from `ridingGoals` (jest case); resume to a monotonic `furthestScreen` | §3 T13, §3A.1 row 23, §5 FS-OB1c | 22 (T13a v10 field), 23 (T13b) |
| V4-4 | V4 (a) a4 | FS-OB1b adds "cold resume to account → Android Back → goals, not the launcher" and a replace-path goals assertion | §3 T19, §5 FS-OB1b, §5A.1 | 30 (T19a) |
| V5-1 | V5 §1, §4 | P05.3 card only (email pool 0–21 under the narrow consent reading; broader email needs a wording-v2 opt-in after the onboarding A/B + a stand-alone withdraw path) | §4, §10 ledger | — |
| V5-2 | V5 §3 | Card answers = the 5 onboarding goals + `other`; events `install_reason_card_shown` / `_answered {answer, matches_primary_goal, days_since_onboarding}` / `_dismissed`; under D17 in a store binary (3.30.0 at the latest), gated identically in both Exp 1 arms, date logged | §10 ledger | — |
| V5-3 | V5 Corrects | D11 addition: at most one inline Home card per session; the plan card wins | §3A.3, §9 D11 row | 45 (T32) |
| V5-4 | V5 locale note | "7 app locales" → "all app locale files enforced by `pnpm check:i18n`" (`SUPPORTED_LOCALES` has 13 entries, `apps/mobile/src/i18n/locales/` has 14 files incl. `es-ES`; `scripts/check-i18n.sh` requires every new en key in all of them) | §3 T08–T10, T11, T21, T22, T26, T32, §9 D6 | 17, 18, 19, 20, 28, 33, 35, 36, 38, 39, 40, 42, 44, 45, 47, 53 |
| — | all | This section and §11.1; header line; §1.3/§8.1 pointers; §3A.2 validation bullet; §7 row V1–V5 | header, §1.3, §3A.2, §7, §8.1, §11 | — |

**Not applied, or applied only in part (with why):**
- **V3 item 7 — flag the internal tester `internal` in PostHog:** not done (a PostHog write; this pass made no external writes). The tester is added to the `{EXCL}` id list kept outside the repo (T02), and the flag write goes on the D2 named list.
- **V4 alternative — `moveTaskToBack` on Welcome instead of returning `false`:** recorded as an option in T20; not chosen here, because T20 is needed for other remount paths anyway and D9 is implemented by T19a.
- **V4 alternative — move T20 into Release A:** not chosen; the same-build rule (T19a + T20 in Release B) meets V4's requirement without growing Release A.
- **V2 — onboarding bike category in T05 instrumentation:** not applied (V2 marks it "if the owner wants segment targeting later"; it would add scope to Release A's instrumentation). Left as an owner option.
- **V2 — a default week-1 message for everyone; referral quality:** recorded as ledger lines, not tasks (outside this season's scope, as V2 itself says).
- **V5 — the draft email and the in-app card:** not sent, not built, no issue created; the card needs the owner's approval and, if wanted inside the slot, its own issue before the 2026-12-05 freeze. The `feedbackContact` withdraw gap is logged in the ledger as a product gap, not a #365 task.
- **D13 (owner confirmation recommended, not a conflict):** the stratified MH computation of the "one one-sided z-test at the cap", the `returning_account` exclusion and the absolute-lift framing are applied as D13's implementation; primary metric, Miller rule, cap and keep rule are unchanged.
- **Not verified here:** whether the V4 emulator run created a PostHog person (T02 checks); the Play Console review state of vc98 (UI only, V3); whether Google sign-in works on the API 35 GMS AVD (T00).

### 11.1 Confidence after validation (2026-11-12)

**A — we know what needs to be done: 78%** (was 75%).
- *Raised by:* RC-B, RC-C and RC-D reproduced on the store binary, with RC-D's cause going from 25% to ~80% and two new concrete sub-defects (goals remount, back-walk resume point) now in T13b (V4); FS-PO8 turned from "n = 1" into 42/43 Android riders, so T29 is a real first-session fix (V1); the friction-is-hygiene reading confirmed on all 367 completers, not 100 replays, and Exp 1's target behaviour (day-0 ride start, OR 4.5) confirmed as the strongest returner signal (V2); the store-build-only path matches the stores and EAS (V3); ~30 of 47 baselines reproduce and the behind-the-task numbers for T07–T11, T17, T21, T22, T24 hold (V1).
- *Held below 100% by:* none of the returner findings is causal — whether a first ride *caused* by the product moves return is exactly what Exp 1 must show, and it can detect only a large lift (MDE ≈ +12.5 to +15.5 pts; power for +8 pts ≈ 0.45–0.52); Oct completers return at half the Aug–Sep rate and season vs 3.26.0 cannot be separated; RC-A and PO4 are not device-reproduced (production writes needed); PO8's dialog type ≈ 70%; OB2 (60%), OB5 (40%) and PO12/PO13 causes (30–35%, now ~4% of completers and measurable) stay behind data gates; why never-returners leave is still unanswered by any channel (V5: card hears only returners; email pool 0–21).

**B — the plan is well defined: 75%** (was 78%).
- *Raised by:* the measurement layer now has corrected, run SQL for every spec V1 touched (platform, three R6 joins, FS-PO3/R2-5 denominators, S4 `oem` split) instead of drafts; the Exp 1 analysis is pre-registered (stratified test, subgroup, `returning_account`, absolute-lift power); release facts are current (vc98 live, vc99 steps, 3.27.0 hotfix base, Q-P1); the T19a/T20 coupling and the T29 move are explicit; T00 turns an invisible blocker into a defined first task.
- *Lowered by / held below 100% by:* the verification environment is **unproven** until T00 runs (no iOS runtime, local stack two migrations behind and patched partly by guesswork at 00098/00102, Google sign-in on the AVD untested), and T00 now gates ~30 tasks; Release A grows (T29) inside the same 11-30 submit target and the plan still needs ≈ 2 merged PRs/day; the D13 implementation note and the vc99 promotion need the owner; the `$app_build` platform fallback breaks at Android versionCode 100 if T01 slips; with slow Android adoption the 2-week reads will often be "no verdict"; T02 still has to commit V1's SQL into `queries/fs/` before T03b can build tiles.
