# #365 EXECUTION_PLAN.md: plan critic review

Critic run, 2026-11-12. **Research only:** nothing in the app, PostHog, RevenueCat, GitHub or Supabase was changed.
Code was read in the clean `origin/main` checkout at `52d281e9` (`/Users/andrejmacm5/personal/MotoWise-research`). Paths starting `apps/`,
`packages/` or `docs/` are repo-relative; any other code path is relative to `apps/mobile/src/`.
I read `EXECUTION_PLAN.md` in full, `05-session-replay-findings.md`, `board/99-synthesis.md` (instrumentation list and decisions),
`board/review-verdicts.md`, and the deep dives R1–R6 (targeted reads: every number and "verbatim at" range the plan cites).

**Verdict in one line.** The plan is thorough and almost every number matches the deep dives. It has **four blocking defects**:
1. OTAs from `main` do not reach Android production (item 1).
2. Database metrics cannot be dashboard tiles (item 2).
3. Most of the Maestro selectors do not exist and no task creates them (item 9).
4. Experiment 1's local draw ignores the flag, so "launch = flag flip" is false for pre-consent installs (item 6).

Items are numbered. Each item's class letter follows the brief: (a) gap, (b) order or dependency, (c) not startable, (d) evidence or number,
(e) constraint, (f) release path, (g) too large, (h) incomplete friction spec, (i) dashboard or annotation procedure.

---

## 0. Checks I ran

### 0.1 Code spot-checks (12 locations)

| # | Plan citation | What the code says | Result |
|---|---|---|---|
| K1 | `apps/mobile/app.config.ts:59-64` "fallbackToCacheTimeout 0" (§2) | Lines 59-64 hold only `runtimeVersion: { policy: 'appVersion' }` and `updates.url`. `fallbackToCacheTimeout` is **unset** (Expo default 0), and `version: '3.28.0'` is at `:37` | Claim holds as the default. The citation hides the important fact: the runtime is the app version (item 1) |
| K2 | `lib/analytics.ts:68` "register right after the client is created" (T01) | The client is created at `lib/analytics.ts:55`. `:68` is inside its options. `registerSuperProperties` no-ops while analytics is off at `:490-492` (confirmed) | Off by 13 lines; harmless |
| K3 | `hooks/use-analytics-super-properties.ts:64-71` | `buildSuperProperties({... platform: process.env.EXPO_OS})`: confirmed. `platform` is **already** a super property; it is null only before account load or consent | Confirmed; T01 should say "move earlier", not "add" |
| K4 | `apps/api/src/modules/users/users.service.ts:235-264` | Import runs only `if (input.bikeMake && input.acceptedOemScheduleIds?.length)`, and it picks the "most recently created motorcycle" | Confirmed (T07) |
| K5 | `apps/api/src/modules/oem-schedules/oem-schedules.service.ts:178-273` (dedup, unit) | Unit read from `users.measurement_system` (`:213-220`): confirmed. Dedup at `:222-230` selects **every** `maintenance_tasks` row for the bike and schedule ids, with **no `deleted_at` filter** | Confirmed, and it **breaks T23** (item 12) |
| K6 | `app/(tabs)/(diagnose)/new.tsx:220-228` | On `FORBIDDEN`: `requirePro('full_ai_diagnostics')`, then `state.setSubmitError(message)` | Confirmed (T08) |
| K7 | `components/home/onboarding-checklist.tsx:153-160` | `onPress` calls `completeItem(item.id)` before routing | Confirmed (T10) |
| K8 | `lib/subscription.ts:770-792` | `presentPaywall` only joins an in-flight request; no frequency cap | Confirmed (T21) |
| K9 | `lib/feature-flags.ts:18-25` | `isFeatureFlagOn` returns false when analytics is off | Confirmed (T30) |
| K10 | `app/(onboarding)/personalizing.tsx:366-393` | Cold-start branch `reset(); setOnboardingCompleted(true)` without `handleContinue`. The 8 s Retry shows only when `!mutationDone`. `:415` "garage_first: 'Open my garage' presents the onboarding paywall" | Confirmed; T16 edits an A/B surface (item 15) |
| K11 | `packages/types/src/constants/limits.ts:4-7`, `utils/ride-constants.ts:25-26`, `apps/mobile/package.json:17-27` | `MAX_BIKES: 1`, `MAX_AI_DIAGNOSTICS_PER_MONTH: 1`; `MIN_RIDE_ELAPSED_S = 30`, `MIN_RIDE_DISTANCE_M = 50`; the `test:e2e:*` script pattern exists | Confirmed |
| K12 | `stores/onboarding.store.ts:203-233` "v9 → v10"; `stores/experiment.store.ts:20-68` "version-2" | `version: 9` at `:212`; experiment store `version: 1` at `:67` | Confirmed |

Additional reads that produced findings:
- `docs/runbooks/mobile-ota.md:3, 173-188`: "An OTA update replaces the JavaScript bundle on every installed build whose runtime version matches", and the runtime is the `version` string.
- `lib/onboarding-experiment.ts` header comment: "PostHog cannot be asked (analytics off …) → uniform on-device draw, source `local`".
- `apps/mobile/scripts/run-onboarding-e2e.sh:9-12, 31-33`: it targets **production** Supabase by default, with the service-role key.
- `.maestro/flows/_shared/onboarding-to-account.yaml:39-48`: consent is declined only "where the country rule asks for it".
- `lib/push-token.ts:132`: `push_token_registered` already exists (PR #393).
- No `.github/workflows/*` file mentions Maestro.
- `expo-network` is installed. `@react-native-community/netinfo` is **not** installed.
- A testID grep over `apps/mobile/src` found **none** of these ids: `rides-empty-cta`, `recall-sheet`, `oem-imported-sheet`, `trip-card-0`, `tab-profile`, `tab-diagnose`, `diagnose-new`, `tab-discover`, `edit-bike-make`, `edit-bike-model-search`, `diagnose-step-bike`, `segment-service`, `service-task-card-*`, `garage-add-bike-header`, `limit-sheet`, `near-you-use-location`, `goal-chip-*`. Of the ids the plan uses, only `home-screen` (`app/(tabs)/(home)/index.tsx:269`) exists.

### 0.2 PostHog queries (project 155556, read-only `execute-sql`)

| Id | Query | Result |
|---|---|---|
| W1 | `SELECT table_name, table_type FROM system.information_schema.tables WHERE table_name NOT LIKE 'system.%' AND … LIMIT 50` | Only `posthog`-type tables in the first 50 |
| W2 | `SELECT table_type, count(), groupArray(table_name) FROM system.information_schema.tables WHERE table_type != 'posthog' GROUP BY table_type` | `data_warehouse` 58 tables: github, linear, metaads, sentry |
| W3 | `SELECT countIf(table_name ILIKE '%motorcycle%' OR '%maintenance%' OR '%postgres%' OR '%supabase%' OR '%push_token%' OR '%rides%') … WHERE table_type='data_warehouse'` | **0**: no Supabase/Postgres source is connected |

No Supabase query was run. Numbers from the deep dives were checked against their text: 30 baselines, including 6/10, 25/187, 15/70, 8/121, 10/151, 26/72, 7/118, 29/117, 7/27, 5/15, 10/291, 67/130, 6/105, 15/72, 9/22, 16/166, 44/472, 3/5, 20/124, 62/141, 52/104, 17 riders, 56/133, 7/117, 15/282, 6/282, 3/20, 15/13 and 16/19. I also checked all 27 "verbatim at" line ranges.

---

## 1. Return items

### 1. (f, blocking) The OTA path does not reach Android production, or most iOS riders
- **Problem.**
  - `runtimeVersion.policy: 'appVersion'` with `version: '3.28.0'` on main [SOURCE: apps/mobile/app.config.ts:37, :59-61; docs/runbooks/mobile-ota.md:173-176]. An OTA published from `main` therefore reaches only 3.28.0 binaries.
  - Android production is binary 3.26.0 [SOURCE: plan Q-P1]. On the last 14 days of `Application Opened`, 3.28.0 holds about 10 of ~190 riders (ios 3 + null 7) [SOURCE: plan Q-P1].
  - The plan nevertheless says "T01/T04/T05: OTA to returning riders", and relies on 2–4 weeks of T04/T05 data before Release A to gate T14 (45%), T15, T36 and T38 [SOURCE: plan §2, T14 "if 4 weeks show 0 me_cache relapses, re-scope"].
  - R5 says earlier fixes reached Android "by OTA on binary 3.26.0" [SOURCE: R5 Q18]. That is only possible by publishing on the 3.26.0 runtime from a branch whose `version` is 3.26.0 (memory `reference_ota_hotfix_older_runtime`). No task describes that.
- **Fix.**
  - Add a release-path rule to §3 "Common fields" and to T18 and T35. For each OTA, name the target runtimes (Android 3.26.0, iOS 3.26.0/3.27.0/3.28.0) and the branch to publish from. Add a native-diff check per runtime (`docs/runbooks/mobile-ota.md:173-188`), and state the expected reach from Q-P1.
  - Or accept that T04/T05 data starts at Release A, and move T14/T15/T36/T38 gates and dates by ~3 weeks.
  - After the 3.29.0 bump (T18), OTAs from main reach only 3.29.0. P2 OTAs then miss every pre-Release-A rider.
- **Confidence** that this is a real gap: 90%. It rises to 99% if the owner confirms how the November OTAs reached Android b93.

### 2. (i, blocking) Database metrics cannot be PostHog tiles; no Supabase warehouse source exists
- **Problem.**
  - T03 promises "every §5 spec id has a tile" and "an Android push-token tile … from the DB check". It also uses DB-only metrics as primary targets:
    - S4(a)/(b), the Experiment 2 primary;
    - FS-PO1H R2-M1;
    - FS-R2-4 and FS-R2-5;
    - the FS-PO4b DB share;
    - the FS-OB1e DB cross-check.
  - PostHog has no Postgres/Supabase source [SOURCE: W2, W3]. Those tiles cannot exist.
- **Fix.** Pick one of the following, as owner decision D2b:
  - (A) Connect a read-only Postgres source to the PostHog warehouse (a read-only role, owner-approved write).
  - (B) Add server-side events that carry the fact: `service_plan_imported` in T07 already covers S4(b); add `onboarding_bike_created {capture_level, make_valid}` for FS-R2-5, and `ride_saved {below_min}` server-side for FS-PO4b.
  - (C) A weekly scripted read-only Supabase query whose result `experiments.md` records, plus a manual PostHog annotation.

  For the push tile, use the existing `push_token_registered` event [SOURCE: lib/push-token.ts:132], not the DB.
- **Confidence:** 95%.

### 3. (i) Per-PR `ACTIVATION_FIX_LEVEL` bumps collide, and a level does not say which friction is fixed
- **Problem.**
  - "bumps `ACTIVATION_FIX_LEVEL` … in every PR" [SOURCE: plan §3 header, T01]. Parallel PRs bump to the same number, and levels then mean different sets on different branches.
  - The user asked to see "the version that fixes these frictions". The release log (§6) lists task ids but not friction spec ids, and no table says "FS-X fixed at level N, verified on date D".
- **Fix.**
  - Bump the level **only at a release cut**: the store build (T18/T35) or the OTA publish commit.
  - In the same file, add `ACTIVATION_FIXES: Record<FrictionSpecId, number>` (spec → level). Optionally add a super property `activation_fixes_mask`.
  - Add a per-friction status table to §6: spec, level, release row, Maestro run link, 2/4/8-week read, status (open / shipped / verified / regressed).
- **Confidence:** 85%.

### 4. (i) The FS-M target and its alert are unreachable as defined
- **Problem.**
  - "≥ 95% of `Application Opened` on the newest level within 3 days" [SOURCE: plan FS-M, T03 alert].
  - An OTA applies on the next launch [SOURCE: R3 C20]. Riders on runtimes the OTA was not published to never carry the level (item 1), and EEA decliners send nothing.
  - So the alert fires permanently.
- **Fix.** Define the share as: among opens from the runtimes the OTA targeted, over 7 days, the share with `ota_update_id` equal to the new id or a later one. For a binary, use opens with `$app_version` = the new version and the expected level.
- **Confidence:** 85%.

### 5. (i) The annotation and dashboard procedure needs concrete form and an earlier owner gate
- **Problem.**
  - T03 depends on T01, but T07 (API, P1) can deploy "as soon as merged" before T03 exists. The first fix would then ship with no annotation and no recorded baseline.
  - "One call per write, each with the owner's go-ahead" means about 40 tiles + 2 alerts ≈ 45 approvals.
  - T03 alerts on SQL insights: whether PostHog alerts support HogQL insights is [UNBACKED — not checked]. Alerts may need trends insights.
- **Fix.**
  - Make "T02 baselines recorded + T03 annotation made" a hard predecessor of **every** deploy, T07 included (add edges T02→T07 and T03→T07).
  - Ask the owner for one batched approval of a named list of writes.
  - Build the alert tiles as trends or event-count insights.
  - Write annotations per platform and per runtime, because Android and iOS go live on different days.
- **Confidence:** 75%.

### 6. (b/c, blocking) Experiment 1 "launch = flag flip" is false for pre-consent installs
- **Problem.**
  - T30 mirrors `lib/onboarding-experiment.ts`: when PostHog "cannot be asked (analytics off — every EEA/UK/CH install before consent …) → uniform on-device draw" [SOURCE: lib/onboarding-experiment.ts header].
  - So from the day Release B is installed, pre-consent installs get 50/50 local arms whether or not the flag is on. The kill switch (`flag off → control`) cannot stop them.
  - T35 says "flag defaulting to control … Flip when 3.30.0 serves ≥ 90% of new installs".
- **Fix.**
  - Embed a start gate (`EXP1_START_AT` date constant, or a remote value readable without analytics, e.g. a field on `me`). Local draws happen only after it.
  - Add an embedded stop date (2026-03-31).
  - Document that local-draw riders cannot be killed except by an OTA.
- **Confidence:** 90%.

### 7. (h/i) E2E runs pollute production PostHog and DB metrics; `{EXCL}` is a fixed list of 12
- **Problem.**
  - The runner targets production Supabase by default with the service-role key [SOURCE: scripts/run-onboarding-e2e.sh:9-12, 31-33].
  - Consent is declined only "where the country rule asks" [SOURCE: _shared/onboarding-to-account.yaml:39-48]. A US-region simulator therefore sends analytics.
  - The plan adds about 25 new flows, run in both arms and on both platforms for every release. Mechanical targets are "0" (FS-PO4b standstill rides, FS-OB1a, FS-PO3), and E2E standstill rides would count against them.
  - `{EXCL}` cannot exclude new e2e persons.
- **Fix.**
  - Exclude by person or email pattern (`e2e-%` prefix, or the `synthetic` flag per memory `project_test_account_cleanup_1110` and `reference_posthog_test_account_filters`) in every §5 query and tile.
  - Run flows in an EEA simulator locale, or force-decline consent.
  - Prefer local Supabase for seeding flows (T08 `E2E_SEED_DIAGNOSIS_USED`). It writes a `content_generation_log` row in production, which the AI-budget daily check may read [SOURCE: plan T06 item 4; ai-budget.service.ts:62-66 per R3].
- **Confidence:** 80%.

### 8. (h) "Automated check" is not automated: no CI runs Maestro
- **Problem.**
  - §0: "done only when its automated check passes in CI or on the named device". No workflow in `.github/workflows` runs Maestro (grep).
  - Several flows need a Google-account emulator, airplane mode (Android-only in Maestro), or a network conditioner that Maestro cannot set.
- **Fix.**
  - For each spec, state where the check runs: `jest (CI)` or `maestro (local, <device>)`.
  - Require the Maestro command, its output log and screenshots in the PR body.
  - For bug specs whose repro is feasible, require the **red run on `origin/main`** as T11 does. Apply it to FS-OB1b, FS-OB1c, FS-OB3, FS-PO2a, FS-PO4b and FS-PO10.
  - Mark the specs whose Maestro flow cannot reproduce the bug as "regression guard only": FS-OB6 (no link conditioner in Maestro), FS-PO12 (onboarding.yaml signs up by email, but the repro needs a Google account), FS-PO5, FS-PO13 on iOS.
- **Confidence:** 90%.

### 9. (c/h, blocking) Most Maestro selectors do not exist, and no task owns creating them
- **Problem.**
  - None of these exist on main (grep, §0.1): `rides-empty-cta`, `recall-sheet`, `oem-imported-sheet`, `trip-card-0`, `tab-profile`, `tab-diagnose`, `diagnose-new`, `edit-bike-make`, `edit-bike-model-search`, `diagnose-step-bike`, `limit-sheet`, `near-you-use-location`, `plan-chip-*`, `plan-card-scheduled`, `activation-plan-card`, `ride-guard-got-it`, `ride-guard-variant-teaching`.
  - T05 creates only part of the list. Several flows (FS-PO6, FS-PO7, FS-PO12, FS-PO17, FS-PO1, FS-PO2c, FS-PO8) depend on ids no task lists.
- **Fix.** Each task's "How" lists the testIDs it adds:
  - T21: `limit-sheet`;
  - T22: `edit-bike-*`;
  - T29: `near-you-use-location`, `trip-card-<n>`;
  - T16: the sheet ids;
  - T28: `rides-empty-cta`;
  - T15: the tab ids;
  - T24: `diagnose-step-bike`;
  - T31/T32: their ids.

  Each task verifies its ids with `inspect_screen` on both platforms.
- **Confidence:** 95%.

### 10. (c/f) T17 cites "existing … NetInfo", but NetInfo is not installed
- **Problem.** `@react-native-community/netinfo` is absent; `expo-network` is installed [SOURCE: apps/mobile/package.json:71; app/_layout.tsx:11]. An agent that adds NetInfo adds a **native module**, which is unsafe over OTA and needs a store build.
- **Fix.** "Use `expo-network` (`Network.getNetworkStateAsync`) and `isNetworkError` (`lib/network-error.ts:47`); add no native dependency."
- **Confidence:** 95%.

### 11. (f) T39 backfill is a production data write with no explicit owner gate and an unclear client
- **Problem.** "One-off script via `importOemSchedule` (not a migration)" writes tasks for about 250 riders. CLAUDE.md: "NEVER use the service-role Supabase client for user-scoped writes", and memory `project_service_role_key_public_repo` warns about service-role scripts.
- **Fix.**
  - Make the run an owner-executed step, like migrations.
  - Write the script so it inserts per user through the API/RPC path with RLS, or as a reviewed SECURITY DEFINER RPC in a migration that the owner applies.
  - Do a dry-run SELECT first.
- **Confidence:** 80%.

### 12. (c, bug in the plan) T23 "soft-delete then re-import" will re-import nothing for the same schedule ids
- **Problem.**
  - The dedup in `autoPopulateForBike` reads every `maintenance_tasks` row for the bike and schedule ids, **including soft-deleted ones** (no `deleted_at` filter) [SOURCE: apps/api/src/modules/oem-schedules/oem-schedules.service.ts:222-230].
  - A year change, or a model change that resolves to the same make-generic schedules, therefore retires the tasks and imports 0.
  - The rider ends with no schedule, the opposite of FS-R2-3.
- **Fix.** Add `.is('deleted_at', null)` to the dedup, or pass an "ignore retired" option. Add a spec case: year change → same ids → tasks re-created. The T07 spec "called twice → no duplicates" still holds with the filter.
- **Confidence:** 85%. It rises once the `maintenance_tasks` soft-delete column name is read.

### 13. (b) Missing edges in the dependency graph
- **Problem.**
  - `T06 (item 7) → T07` and `T06 (item 6) → T23` are in task text but not in the mermaid graph.
  - `T02/T03 → T07` is missing (item 5).
  - `T07 → T22` is missing (FS-PO1 expects "the schedule follows" after an edit).
  - `T21 → T08` is missing: T08 builds a limit panel with "See Pro plans" (`trigger:'rider_tap'`), and T21 later introduces `LimitSheet`. Either T08 reuses T21's component (order T21 first), or the plan says T24 replaces T08's panel.
- **Fix.** Add the edges, and state whether T08 ships its own panel.
- **Confidence:** 80%.

### 14. (b) T14, T15 and T20 ship in Release A ahead of the evidence that would scope them
- **Problem.** T14 (45%), T15 (30–35%) and T20 (25%) each depend on events (`gate_routed`, `auth_session_lost`, `onboarding_welcome_mounted`) that, per item 1, arrive with Release A itself.
- **Fix.**
  - Split each into a "measure" part, which is in T04, and a "fix" part gated on 2–4 weeks of data in a later release.
  - Keep in Release A only the parts that are safe regardless of cause: T14's local completion flag, and T15's "blip after completion never routes to `(auth)`" jest-backed guard.
- **Confidence:** 70%.

### 15. (e) T16 edits the garage_first onboarding paywall CTA, but D1 does not list T16 (or T30)
- **Problem.**
  - "Open my garage" presents the onboarding paywall in garage_first [SOURCE: app/(onboarding)/personalizing.tsx:415]. T16 changes its disabled state, its idempotency and the Retry rule, and T30 hooks assignment into `handleContinue`.
  - §0 says onboarding paywall surfaces are "never … moved or re-styled".
  - D1 covers T11–T14, T19, T20 and T25 only.
- **Fix.**
  - Add T16 and T30 to D1.
  - Require `onboarding-paywall-verify.yaml` in both arms in T16's acceptance.
  - Log the date in the both-arm ledger, so the `onboarding_paywall_2026q4` readout can be cut.
- **Confidence:** 85%.

### 16. (e) T25 may shift onboarding paywall placement inputs
- **Problem.** T25's own risk line says it "moves `bike_added` and goal→placement inputs". If capture level or goal feed the paywall placement or variant, T25 changes what the arms see.
- **Fix.** Add one sentence after reading `lib/onboarding-paywall.ts`: either "placement does not read capture level", or a D1 sub-decision.
- **Confidence:** 50% [UNBACKED, not read].

### 17. (d) S3 day-2 return reintroduces the two measurement bugs the board fixed
- **Problem.**
  - S3 = "any `Application Opened`/`Became Active`/`$screen` on calendar day after first seen (UTC)". The board's P06.1 flagged that this counts opens caused by our own reminders, and that its day is UTC [SOURCE: board/06-experimentation-analyst.md:13, :75].
  - P06.1 adopted F14 "engaged return" as canonical [SOURCE: board/99-synthesis.md:140, :231].
  - Exp 1's test arm sends notifications (T32, T34), so raw S3 is biased toward the test arm.
- **Fix.** Make S3 the F14 engaged return (baseline 37/367) as the Exp 1 secondary. Keep raw return only as a harm check outside the slot.
- **Confidence:** 90%.

### 18. (a) Board instrumentation items with no task
- **Problem.** The board's "Instrumentation to add first" has items no task covers:
  - #7: `source` on `maintenance_task_completed`;
  - #8: the F14 "engaged" route allow-list constant and test, so renamed routes cannot silently break S3;
  - #10: the saved weekly install-cohort table (`n, ob_done, activation_24h, core_w1, day2_return, day2_engaged_return, D7`).

  [SOURCE: board/99-synthesis.md:229-232; board/06-experimentation-analyst.md:86-87]
- **Fix.** Add #7 and #8 to T05, and #10 to T03.
- **Confidence:** 90%.

### 19. (a) iOS back-walks have no task
- **Problem.** R1 Q8: iOS 15/70 (21%) back-walkers, a higher share than Android 13% [SOURCE: R1:101-103]. T19 changes Android `BackHandler` only, "iOS swipe-back unchanged", and FS-OB1b's target is Android only.
- **Fix.** Add an iOS sub-task (disable swipe-back on steps after account, or make it single-step), or state why iOS is out of scope with a target. FS-OB1b needs an iOS target.
- **Confidence:** 80%.

### 20. (a/h) Frictions without a full spec
- **Problem.** The user asked that **every** friction be verifiable. These are not:
  - FS-PO15 and FS-PO16 have no repro, check or metric.
  - FS-PO9 has no SQL; its baseline comes from 100 replay-scanned sessions (R6-q1/q2), so it cannot be re-read per version without new scans.
  - OB1 and OB1-E have no "FS-OB1" spec; the coverage table cites one that does not exist. S6 has no SQL in §5.
- **Fix.**
  - Add an event-based draft SQL for FS-PO9 (last day-0 event < 60 s after `onboarding_completed`, ≤ 1 `$screen`).
  - Add S6 SQL (R6-q8 verbatim range).
  - Give FS-PO15/16 at least repro + metric + "not fixing" so they are tracked.
- **Confidence:** 90%.

### 21. (h) FS-OB2c's metric is not measurable
- **Problem.** "`auth_oauth_result` cancelled vs `$exception`/alert events within 2 s" assumes an alert event. `presentOAuthError` shows an `Alert` and fires no event [SOURCE: lib/oauth-error-alert.ts:19 per R5 C4].
- **Fix.** Add `auth_error_alert_shown {provider, outcome, error_code}` to T04.
- **Confidence:** 85%.

### 22. (h) FS-PO17 cannot be counted from one property
- **Problem.** `post_onboarding_landed.overlay` is set at first focus, but competing sheets appear after landing.
- **Fix.** Add `landing_sheet_shown {sheet, ms_since_landed, queue_position}` (T05/T16). The metric becomes "first-session riders with ≥ 2 `landing_sheet_shown` within 60 s".
- **Confidence:** 80%.

### 23. (h) FS-OB1b's after-T04 metric does not match its baseline
- **Problem.** The baseline counts riders with ≥ 3 *fast* backward moves ≤ 5 s apart (R1 Q8). The draft counts all `onboarding_back` events, so single, deliberate backs count too.
- **Fix.** Use `ms_on_screen ≤ 5000` and `trigger IN ('hardware','gesture')`, and require ≥ 3. Keep the `$screen` method next to it for continuity.
- **Confidence:** 85%.

### 24. (h) FS-PO13 and FS-OB1e use airplane mode on iOS
- **Problem.** Maestro `setAirplaneMode` is Android-only. T16's `post-onboarding-landing.yaml` (the FS-PO13 tail) runs on both platforms.
- **Fix.** Tag the airplane-mode tail `android`, or skip it on iOS. On iOS the check is jest only.
- **Confidence:** 75%.

### 25. (g) Tasks too large to review: split them
- **T05** (≈ 9 event changes, 15+ testIDs, `diagnostic_started` relocation, `log-ride.yaml` rewrite). Split into:
  - T05a: paywall `trigger`/`gate_policy` + `paywall_suppressed`;
  - T05b: diagnostics events;
  - T05c: ride guard props + ride/HUD testIDs + `log-ride.yaml`;
  - T05d: landing/screen-load/bike-edit/notification events.
- **T04** (≈ 10 events, 6 files). Split into: T04a OAuth/auth events; T04b onboarding navigation/resume/gate events; T04c `bike_setup_summary`.
- **T13** (store v10 migration + code-step restore + bike draft + resume semantics). Split into: account/code draft (FS-OB3) and bike draft + last-viewed resume (FS-OB1c). They share the migration, so do the migration in the first PR.
- **T16** (idempotent paywall CTA vs Home sheet queue across several owners). Split into: personalizing CTA/Retry (onboarding, D1) and Home sheet queue (D11).
- **T25** (API ranking + client search + year order + junk-make rule). Split into: API ordering (deploy first) and client.
- **T03** is not "S" (≈ 40 tiles, alerts, two runbooks, owner approvals). Make it M, or split into dashboard and runbook.
- **Confidence:** 80%.

### 26. (c) T22 and FS-PO1 assume edit-bike can set a model on a make-only bike
- **Problem.** The flow taps `edit-bike-model-search`, and no such id exists (item 9). Whether `edit-bike.tsx` has a model search for make-only bikes is not cited [SOURCE: plan T22 cites only `edit-bike.tsx:195-305`].
- **Fix.** Cite the model field in `app/(tabs)/(garage)/edit-bike.tsx`. If there is no search there, T22 needs the onboarding model picker reused (more size).
- **Confidence:** 60%.

### 27. (c) The FS-PO1H repro uses Africa Twin, which has no model rows
- **Problem.** Memory `project_oem_schedule_africa_twin`: "pipeline built but ZERO model rows". The flow will pass only through the make-generic fallback, so it does not test the model path.
- **Fix.** Choose a bike with known model rows (read `oem_schedules` read-only in T02), and keep the make-only branch as the second case.
- **Confidence:** 70%.

### 28. (d) Small citation and wording fixes
- **(a)** T01: client creation is at `lib/analytics.ts:55`, not `:68`. Also, `platform` is already a super property (`hooks/use-analytics-super-properties.ts:70`). The change is "register earlier", not "add".
- **(b)** §2 "with `fallbackToCacheTimeout` 0": say "unset → default 0" and cite R3 C19/C20; app.config does not contain it.
- **(c)** T09 Why "15 … saves by 13 riders": R4 splits it as 13/11 summary + 2/2 auto_end [SOURCE: R4:159-161]. The FS-PO4b target (`save_trigger='summary'` = 0) therefore has baseline **13/11**, not 15/13.
- **(d)** FS-PO10 baseline "data 20 (12)" means 8 data-ticked without a real ride. State 8 as the baseline of the "= 0" target.
- **(e)** S2 target (+4 pts) and FS-R2-3 (≥ 20%) are correctly tagged UNBACKED. S6 target "≤ 3%" has no tag; add [UNBACKED].

### 29. (f) Release A contents vs the Exp 1 control baseline
- **Problem.** T27 (Start Ride) and T29 (Discover) are "both arms before the slot" (D12), but they ship in Release B, the same binary that launches Exp 1. They are not "before"; they change control at launch, and their harm checks are confounded with Exp 1.
- **Fix.** Either move T27 and T29 into Release A, or record them as launch-day both-arm changes in the ledger, and read their mechanical metrics only.
- **Confidence:** 75%.

### 30. (f) API-then-client order for T07 is under-specified
- **Problem.** T07 adds nullable fields to the `completeOnboarding` result. `pnpm generate` "reads production" (CLAUDE.md). So client types for the new fields exist only after the API deploy, and the Release A client depends on that order (memory `project_vercel_render_deploy_race`).
- **Fix.** Spell out: merge API → Render deploy → `pnpm generate` on main → client PR → Release A.
- **Confidence:** 80%.

---

## 2. What the plan gets right (so fixes don't undo it)
- Every friction from 05 and R1–R6 maps to a task or an explicit "not doing", except items 18–20.
- Every number I checked matches its deep dive (30 baselines, 27 "verbatim at" ranges), except the T09/FS-PO4b and FS-PO10 baselines in item 28.
- Constraints:
  - no change to the onboarding paywall copy or order, and no change to `FREE_TIER_LIMITS` or ride floors;
  - AI is made quieter, not promoted (T24);
  - no India targeting;
  - light/dark is stated globally (§0) and per UI task (T17 and T27 rely on the global rule only);
  - migrations are owner-applied (T14, T23).
- The diagnosis that first sessions run embedded JS, and that every first-session fix therefore needs a store binary (R3 RC-2), is correct and well used.

## 3. Confidence scores (critic's own)

**A — we know what needs to be done: 70%.**
- The root causes for the P1 bugs are confirmed in code (K4–K10).
- It is lowered by: whether friction fixes move return at all (R6 §3.1); low-confidence causes (OB2, OB5, RC-D, PO12/13); the new T23 dedup defect (item 12).
- It rises with: 2–4 weeks of T04/T05 events on the runtimes riders actually use (item 1), and an Exp 1 readout.

**B — the plan is well defined: 55%** (planner said 70%).
- It is lowered by the four blocking items:
  1. OTA runtime reach;
  2. DB metrics with no PostHog source;
  3. missing testIDs and no CI Maestro;
  4. the Exp 1 local draw bypassing the flag;

  plus wrong dependency edges and six oversized tasks.
- It rises to about 75% after:
  - a per-runtime OTA rule;
  - a D2b decision on the DB metric source;
  - per-task testID lists;
  - an embedded Exp 1 start gate;
  - an e2e-person exclusion;
  - the splits in item 25.

**Return items: 30.**
