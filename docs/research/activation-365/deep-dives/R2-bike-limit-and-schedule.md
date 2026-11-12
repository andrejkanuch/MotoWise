# R2: bike limit and day-0 service schedule (PO1 / PO1-H / Experiment 2)

Research only, 2026-11-12. Nothing in the app, the database or PostHog was changed.
Code read from the clean checkout of `origin/main` at `52d281e9` (`a clean checkout of origin/main`).
Database: Supabase production, read-only `SELECT` via the Management API. PostHog: project 155556 (EU), read-only `execute-sql`.
Test persons excluded in every PostHog query (the 12 ids in the task brief). DB queries reuse q08's exclusions
(`is_synthetic`, the owner/test emails and domains; the literal list is in `board/99-synthesis.md` Appendix A).

---

## 1. Question

1. **Experiment 2 / PO1-H.** Why did the share of first bikes with a maintenance schedule on day 0 fall from 62% to 23% in
   the install week of 2026-10-12, and what restores it?
2. **PO1.** Riders hit the `MAX_BIKES` paywall right after onboarding. Was their onboarding bike make-only, blank or wrong?
   Did they then manage to add a different bike? What is the best fix for "I want to set my real bike, but I get a
   paywall", without making a second bike free?

## 2. Evidence

### 2.1 Code (origin/main 52d281e9)

| # | What | Where |
|---|---|---|
| C1 | `completeOnboarding` imports OEM tasks **only** when the client sends `acceptedOemScheduleIds` (`if (input.bikeMake && input.acceptedOemScheduleIds?.length)`) | `apps/api/src/modules/users/users.service.ts:235-264` |
| C2 | The only screen that ever filled `acceptedOemScheduleIds` is the onboarding maintenance swipe deck, which is **in no flow since 2026-08-24** ("completed by 2 of 150 riders") | `apps/mobile/src/app/(onboarding)/maintenance.tsx:1-12`, `apps/mobile/src/config/onboarding.ts:111-121, 147-176` |
| C3 | So `personalizing.tsx` sends `acceptedOemScheduleIds` only when non-empty, which is now never | `apps/mobile/src/app/(onboarding)/personalizing.tsx:282` |
| C4 | The garage path `createMotorcycle` **always** auto-populates (full make/model/variant/year waterfall, no filter) | `apps/api/src/modules/motorcycles/motorcycles.resolver.ts:88-114` |
| C5 | The waterfall ends in a `GENERIC` fallback, so any bike — even a blank model or an unknown make — gets ~10 tasks | `apps/api/src/modules/oem-schedules/oem-schedules.service.ts:95-151` (tiers), `:178-273` (`autoPopulateForBike`, dedup by `oem_schedule_id`) |
| C6 | `complete_onboarding` RPC (00191, body re-applied by 00194) creates the bike, never tasks. Before 00191 it **dropped** a bike without a model; 00191 keeps it with `model = ''` | `supabase/migrations/00191_complete_onboarding_make_only_bike.sql:1-20, 84-117` |
| C7 | Free-tier gate: server `enforceFreeTierBikeLimit` counts live bikes (`FREE_TIER_LIMITS.MAX_BIKES = 1`) | `apps/api/src/modules/motorcycles/motorcycles.service.ts:186-216` |
| C8 | Client gates: Garage "Add" (`requireAccess('MAX_BIKES', motorcycles.length)`) and header (`presentPaywall … surface:'garage_add_bike_header'`), Home bike switcher, Profile, and the add-bike form's server-rejection fallback | `apps/mobile/src/app/(tabs)/(garage)/index.tsx:121-134`, `(home)/index.tsx:358-366`, `hooks/use-profile-data.ts:119`, `(garage)/add-bike.tsx:136-147` |
| C9 | **Editing** the bike is free and can change make, model and year, but `updateMotorcycle` never touches the schedule | `apps/mobile/src/app/(tabs)/(garage)/edit-bike.tsx:195-305`, `motorcycles.resolver.ts:116-123`, `motorcycles.service.ts:98-162` |
| C10 | Manual "Import OEM schedule" exists in the bike hub; fires `oem_schedule_imported` | `apps/mobile/src/components/bike-hub/shell/use-bike-actions.ts:52-97` |
| C11 | Make-only capture: quick-make chips in bike setup set `model: ''` and a default year | `apps/mobile/src/app/(onboarding)/bike-setup.tsx:323-345` |
| C12 | `autoPopulateForBike` converts `interval_km` with `users.measurement_system`. In onboarding, `personalizing.tsx` writes `measurement_system` **after** `completeOnboarding` returns, so an import inside `completeOnboarding` would read the `metric` default for imperial riders | `oem-schedules.service.ts:207-216, 233-238`; `personalizing.tsx:187-205, 299-326` |
| C13 | With no task, the Home plate shows "No service due" | `apps/mobile/src/components/home/home-plate.ts:96-103` |
| C14 | There is no analytics event for a bike edit (only `garage_bike_added` / `garage_bike_removed`) | `apps/mobile/src/lib/analytics.ts:613-614` |
| C15 | Maestro shared onboarding comment is stale ("a make-only Add to my garage leaves the garage empty") — wrong since 00191 | `apps/mobile/.maestro/flows/_shared/onboarding-to-account.yaml:85-87` |
| C16 | Task soft-delete already goes through an RPC (`soft_delete_maintenance_task`) | `apps/api/src/modules/maintenance-tasks/maintenance-tasks.service.ts:411`, `supabase/migrations/00176_soft_delete_rpc_standardisation.sql` |

### 2.2 Database queries (Supabase prod, read-only)

Cohort CTE `u` for R2-DB1..DB4/M1: `public.users` created 2026-09-01 → 2026-11-12, q08 exclusions. A bike counts as
**created by onboarding** when `motorcycles.created_at = users.onboarding_completed_at` — the RPC sets both with `NOW()`
in one transaction, so the timestamps are identical (C6). Everything else is a **garage** add (C4).

**R2-DB1 — day-0 bikes (all, incl. deleted) by origin, per week**

| Week | Bikes | Onboarding | Onboarding with any task d0 | Garage | Garage with OEM tasks ≤5 min | Blank model |
|---|---|---|---|---|---|---|
| 08-31 | 29 | 11 | 0 | 18 | 18 | 0 |
| 09-07 | 26 | 12 | 0 | 14 | 14 | 0 |
| 09-14 | 30 | 7 | 1 | 23 | 22 | 0 |
| 09-21 | 27 | 11 | 2 | 16 | 15 | 0 |
| 09-28 | 15 | 9 | 2 | 6 | 6 | 0 |
| 10-05 | 34 | 15 | 2 | 19 | 18 | 0 |
| **10-12** | 26 | **22** | 4 | **4** | 2 | 10 |
| 10-19 | 23 | 19 | 4 | 4 | 3 | 9 |
| 10-26 | 22 | 21 | 4 | 1 | 1 | 10 |
| 11-02 | 42 | 41 | 7 | 1 | 1 | 15 |
| 11-09 (3 d) | 25 | 22 | 10 | 3 | 3 | 5 |

Before 10-12, **most day-0 bikes came from the garage** (which auto-imports, C4). From 10-12 almost all come from
onboarding (which does not, C1).

**R2-DB2 — per rider, before vs after 2026-10-12**

| Period | Riders | Finished onboarding | Has an onboarding bike | Garage bike only (after onboarding) | Onboarding + garage bike | No bike | Onboarding bike with blank model |
|---|---|---|---|---|---|---|---|
| before 10-12 | 254 | 218 | 65 | 94 (89 after onboarding) | **0** | 95 | 0 |
| from 10-12 | 179 | 150 | 125 | 12 | **1** | 42 | 48 |

No rider who already has an onboarding bike adds a garage bike on day 0 (0 and 1): the 1-bike limit closes that path.

**R2-DB3 — when did the switch happen?** `supabase_migrations.schema_migrations` lists 00191. 67 blank-model bikes
were created in the hour 2026-10-15 10:00 UTC (the 00191 backfill; none of their owners has another live bike, none has
a task). Daily day-0 bikes: 10-10 → 10-14 onboarding 10 / garage 5; 10-15 → 10-18 onboarding 16 (9 blank) / garage 1.
**The garage path disappears the day 00191 was applied.**

**R2-DB4 — tasks on onboarding bikes (live), before vs after 2026-10-15 10:00**

| Period | Onboarding bikes | With any task d0 | With OEM task d0 | User-created only | OEM within 1 min | Median minutes to first task |
|---|---|---|---|---|---|---|
| before | 71 | 11 | 4 | 7 | 2 | 3.9 |
| after | 121 | 24 | 9 | 15 | 1 | 2.3 |

The onboarding path has **never** produced a schedule in this period; the few OEM rows come from the manual import (C10)
or the maintenance-intent cohort.

**R2-M1 (the Task 1 metric, defined in §5) — onboarding bikes with OEM tasks within 5 min of creation, per week**

| Week | 09-28 | 10-05 | 10-12 | 10-19 | 10-26 | 11-02 | 11-09 (3 d) | Total |
|---|---|---|---|---|---|---|---|---|
| bikes | 9 | 15 | 21 | 20 | 21 | 42 | 23 | 151 |
| with OEM ≤5 min | 1 | 1 | 1 | 2 | 2 | 2 | 1 | **10 (7%)** |
| blank model | 0 | 0 | 8 | 10 | 10 | 15 | 5 | 48 |

**R2-DB5 — the 29 day-0 bike-paywall riders (from R2-PH1), bike history in the DB** (ids truncated; all `free`, none synthetic)

| Onboarding | PostHog onboarding bike | DB bikes now | Reading |
|---|---|---|---|
| 09-14 → 10-06 (15 riders) | make only (Yamaha, Zeeho, H-D, "V", Suzuki, BMW, Honda, "S", "A", "P" …) | 1 garage bike added 0–18 min after onboarding, model set, **10–12 OEM tasks** | Pre-00191: RPC dropped the make-only bike (C6), rider added it in the garage (auto-import), then hit the gate again minutes later |
| 09-24 → 10-11 (7 riders) | full model (MT-07, CVO, R 12, CB1000R, PCX150, Meteor 350, Africa Twin) | the onboarding bike only, **0 tasks** (1 had 10) | Had their real bike, tried to add (a second?) bike, blocked |
| 10-22 → 11-08 (7 riders, post-00191) | 3 make only (Yamaha, Honda, "Bajaj Pulser N160" typed as a make), 4 full (Kibo, Bonneville T100, Dyna Low Rider, Tiger 900 Rally) | the onboarding bike only; tasks 0 for 6, 1 for one | Blocked, never got a second bike, never edited to a model, no schedule |

- **No one of the 29 has more than one live bike today, and no one deleted a bike.** Nobody found the free "delete and re-add" or "edit" route.
- Single-letter or nonsense makes ("A", "V", "S", "P", "ABSOLUTELY WILD RANCH", "TEMPEST CYCLES/Tmmp") show the make search
  lets riders save junk — an OB4 symptom.

**R2-DB6 — the stock of blank-model bikes (all live bikes, all time):** 117 blank-model live bikes, **7 ever had a task**;
602 bikes with a model, 330 ever had a task.

### 2.3 PostHog queries (read-only)

**R2-PH1 — re-derive the 29 riders.** `onboarding_completed` (first per person, last 61 d) inner join first
`paywall_present_requested` with `properties.feature = 'unlimited_bikes'` in `[ob_at, ob_at + 1 day)`; person → the
UUID-shaped `distinct_id` (= Supabase user id). Result: **29 riders**, matches the brief. App versions (on `onboarding_completed`): 3.19.0 ×4,
3.19.1 ×9, 3.20.0 ×3, 3.21.0 ×5, 3.25.0 ×1, 3.26.0 ×7. 15 had a blank `bike_model` on
`onboarding_completed`; minutes from onboarding to the paywall: median ~2, 0–26.

**R2-PH2 — which surface fired** (same 1-day window): `use_pro_gate`/`feature_gate` 37 requests, 21 riders (7 after
00191); `garage_add_bike_header` 7 / 6 (1 after); `profile_add_bike` 5 / 5 (0 after).

**R2-PH3 — screens before the paywall** (riders who finished onboarding since 10-01, `$screen` from onboarding to
paywall + 5 min): several open `/add-bike` twice; 4 of 18 open **`edit-bike`** before or around the paywall
(`8df4a2ef`, `9459a35b`, `0133d4ac`, `c1b2ade8` person ids) — riders look for a way to change the bike.

**R2-PH4 — per-version baseline of the bike-limit paywall on day 0** (first `onboarding_completed` since 2026-09-13)

| Period | App version | Completers | With a bike | Make only | Bike paywall ≤1 day |
|---|---|---|---|---|---|
| before 00191 | 3.19.0 | 43 | 35 | 27 | 4 |
| | 3.19.1 | 69 | 61 | 39 | 9 |
| | 3.20.0 | 11 | 10 | 4 | 3 |
| | 3.21.0 | 33 | 30 | 17 | 5 |
| | 3.22.0 / 3.25.0 / 3.26.0 | 9 | 8 | 4 | 1 |
| after 00191 (10-15 10:00) | **3.26.0** | 118 | 104 | **52 (50%)** | **7 (5.9%)** |
| | 3.27.0 | 6 | 6 | 1 | 0 |
| | 3.28.0 | 3 | 2 | 1 | 0 |

- Before 00191: 22/165 (13%). After: **7/127 (5.5%)**. The rate fell because make-only riders now keep a bike and mostly
  stop trying to add one; it is not a sign the friction is fixed — they are now stuck on a blank bike with no schedule.
- **Half of onboarding bikes are make-only** before and after.

**R2-PH5 — manual schedule import usage:** `oem_schedule_imported` last 60 d: 23 events, **19 riders** (no `context`
set on the bike-hub path). That is the only way an onboarding bike gets a schedule today.

## 3. Root cause

### 3.1 The day-0 schedule drop (Experiment 2) — verdict, confidence 90%

**The onboarding path has not imported a service schedule since the maintenance swipe deck was retired on 2026-08-24.**
`completeOnboarding` imports only the ids the rider accepted in that deck (C1–C3), so `acceptedOemScheduleIds` is
always empty and the onboarding bike gets no tasks: 10 of 151 onboarding bikes since 09-28 have OEM tasks within 5 min,
and those come from other paths (R2-M1, R2-DB4).

**The 62% before 10-12 was an accident.** Before 00191 the `complete_onboarding` RPC dropped every bike without a model
(C6). Make-only capture is half of all onboarding bikes (R2-PH4), so most riders arrived in an empty garage and added
their bike from the garage form, which always auto-imports through the waterfall (C4, C5): 94 of 218 finishers before
10-12 got their bike that way (R2-DB2). **Migration 00191 (applied 2026-10-15 ~10:00 UTC) fixed the dropped bike, which
closed that accidental route**: the garage path disappears the same day (R2-DB3), and the onboarding bike — now kept,
with or without a model — never gets a schedule. Blank models are not the cause: bikes *with* a model coming from
onboarding were already at ~0 before 10-12 (R2-DB1 weeks 08-31 → 10-05: 4 of 65).

What would raise the confidence: API logs for a post-10-15 `completeOnboarding` showing no `autoPopulateForBike` call
(`Auto-populated … tasks` log line absent), and a replay of a 3.19 make-only rider adding the bike in the garage
straight after onboarding.

### 3.2 The bike-limit paywall after onboarding (PO1) — verdict, confidence 60%

Two different populations hide under the one count:

1. **Before 00191 (15 of the 29):** the onboarding bike had been silently dropped; the rider added it in the garage
   successfully, then hit the gate again within minutes (mostly `use_pro_gate`, R2-PH2, R2-DB5). This is history: the
   empty-garage cause is gone. The second tap is unexplained [UNBACKED — own guess: a stale "add your bike" entry such
   as the checklist row or a double tap].
2. **After 00191 (7 of 127 completers on 3.26.0, 5.5%):** the rider has an onboarding bike, opens Add bike, and gets the
   Pro paywall. 3 of 7 had a make-only bike, 1 a make that is really a model ("Bajaj Pulser N160"); 4 had a full model.
   **None of the 29 ever ended with a second bike, a deleted bike, or (for the blank ones) a model** (R2-DB5). Several
   open `edit-bike` around the paywall (R2-PH3). So the app offers no visible way to "set my real bike": editing is free
   and works (C9), but it is not offered at the moment the rider asks for it, and even when used it does not bring a
   schedule (C9).

The larger, quieter part of PO1-H is the riders who do **not** tap Add: 52 of 104 bikes on 3.26.0 are make-only
(R2-PH4); 117 blank-model live bikes exist, 7 ever had a task (R2-DB6).

Why 60%: the "I want my real bike" reading fits the make-only riders and the edit-bike visits, but 4 of the 7 had a
full model and may genuinely own a second bike. Would raise it: Replay Vision on the 7 post-00191 sessions (scan A may
already hold them — no new scan run here), or the choice logged by the sheet proposed in Task 3.

## 4. Fix options

### 4.1 Restore the day-0 schedule

| Option | Pros | Cons |
|---|---|---|
| **A. Server: `completeOnboarding` runs the full waterfall import (no id filter) when a bike was created** | One API deploy, no app release; reaches every app version at once; mirrors the garage path that produced the old 62%; idempotent (dedup by `oem_schedule_id`), so a repeated completion (OB6) is safe | Must use the onboarding unit (C12) or imperial targets are ~1.6× late; make-only bikes get make-generic/GENERIC rows (need the tier label guardrail) |
| B. Client: re-enable the swipe deck or auto-accept all ids | — | Onboarding screen change during the paywall A/B (forbidden); needs a release; the deck was retired for 2/150 completion |
| C. Lazy import on first bike-hub / Home view | No onboarding coupling | A client release; tasks appear only when a screen opens; harder to measure |

**Recommended: A**, with the unit taken from `input.bikeMileageUnit` (or `measurementSystem` passed explicitly), plus
`service_plan_imported` attribution.

### 4.2 "I want to set my real bike but I hit a paywall"

| Option | Pros | Cons |
|---|---|---|
| **D. Limit sheet:** a free rider with exactly one bike who taps any Add-bike entry sees a sheet — primary "Update <bike> (make / model / year)" → edit-bike; secondary "Add a second bike — Pro" → the existing paywall | Gives nothing new for free (editing was always free); the paywall stays one tap away for a real second bike; one code path for all 4 entry points | A client release; fewer direct paywall impressions (≈7 riders/month) — owner decision |
| **E. Edit refreshes the schedule:** when make, model, year or variant change, retire pending, never-completed OEM tasks via `soft_delete_maintenance_task` and re-run the waterfall | Makes D (and every existing edit) actually deliver the right schedule; server-only | Must not touch tasks the rider edited or completed; needs care with the dedup |
| F. Free first-bike replacement (delete + add allowed within N days) | Simple to explain | Delete loses the bike's data; a loophole for a second bike; not needed if D+E exist |
| G. Count only bikes older than N days / with data toward the limit | — | Effectively a second free bike; rejected (no justification to make multiple bikes free) |
| H. "Add your model" prompt in the bike hub for blank-model bikes | Reaches the 52/104 who never tap Add | UI work; Home placement would collide with the Experiment 1 slot (synthesis D6), so bike hub only |

**Recommended: D + E**, then H. No change to `FREE_TIER_LIMITS.MAX_BIKES`.

## 5. Friction specs

Each spec is written so an agent can prove the friction is gone. Platform for E2E: iOS simulator with a
standalone/preview build (`apps/mobile/.maestro/README.md`); RevenueCat is not available in test runs, so flows assert
the **absence** of the paywall by asserting the app's own sheet, never the RevenueCat UI.

### F-R2-1 — The onboarding bike gets no service schedule (Experiment 2)

1. **Reproduce:** fresh install, new free account (email or the Maestro pre-created user), any platform. Onboarding →
   bike setup → pick Honda → Africa Twin → finish → Home. Garage → bike → Service segment. Repeat with "Not sure of the
   details?" → Honda quick chip (make-only).
2. **Expected after fix:** both bikes have the waterfall schedule (≥1 pending OEM task) within seconds of
   `onboarding_completed`; the Home plate shows the next due item, not "No service due"; make-generic rows say so (tier
   label), never claim model-level confidence; an imperial rider's first oil target = odometer + interval in **miles**.
3. **Automated check:**
   - Maestro `apps/mobile/.maestro/flows/onboarding-service-plan.yaml` (new): `runFlow onboarding.yaml` (default Honda
     Africa Twin) → `assertNotVisible: "No service due"` on Home → tap `"Garage(,.*)?"` → bike card → `tapOn: {id: segment-service}`
     → `extendedWaitUntil: {visible: {id: "service-task-card-.*"}}` (add that testID if missing). Second flow
     `onboarding-make-only-service-plan.yaml` with a new `MAKE_ONLY: "true"` branch in `_shared/onboarding-to-account.yaml`
     (tap "Not sure of the details?" → `".*Honda.*"` chip), same assertions plus `assertVisible` on the tier label.
     Fix the stale comment C15 in the same PR.
   - Jest `apps/api/src/modules/users/users.service.spec.ts`: completeOnboarding with a bike and no
     `acceptedOemScheduleIds` calls `autoPopulateForBike` once with no id filter; with `bikeMileageUnit: 'mi'` the
     conversion uses imperial; no bike → no call; import failure does not fail onboarding.
4. **Production metric:**
   - **Primary (DB, consent-independent) — R2-M1:** share of onboarding-created live bikes with an OEM task within
     5 minutes. SQL = R2-M1 (§2.2; `motorcycles.created_at = users.onboarding_completed_at`, `maintenance_tasks.source='oem'`,
     `created_at < bike + 5 min`), weekly. **Baseline 10/151 (7%)** since 2026-09-28. **Target ≥ 95%** for 2 straight
     weeks (only an import error can miss it, since GENERIC always matches). [UNBACKED — own target]
   - **Board metric:** Appendix A `q99-day0-schedule-weekly` (first bike on sign-up day with a task within 1 day):
     baseline 25/111 (23%), target ≥ 55% (synthesis).
   - **PostHog, per version (needs Task 2):**
     ```sql
     SELECT properties.$app_version AS app_version,
            uniq(person_id) AS completers_with_bike,
            uniqIf(person_id, toInt(properties.service_plan_task_count) > 0) AS with_plan
     FROM events
     WHERE event = 'onboarding_completed' AND properties.has_bike = true
       AND timestamp >= now() - INTERVAL 28 DAY
       AND person_id NOT IN (<12 test persons>)
     GROUP BY app_version ORDER BY app_version
     ```
     Since the fix is server-side it reaches all versions at the API deploy time: read R2-M1 by **deploy date**
     (PostHog annotation), and use the per-version table to confirm no version is left out.

### F-R2-2 — A free rider who wants to set their real bike gets the Pro paywall

1. **Reproduce:** new free account, finish onboarding with a make-only bike (Honda chip). Garage → "+" (header) or
   "Add a bike", or Home bike switcher "+", or Profile "Add bike". Today: the RevenueCat paywall (`unlimited_bikes`).
2. **Expected after fix:** a "Your plan has one bike" sheet with "Update Honda" (primary) and "Add a second bike — Pro"
   (secondary). Primary opens edit-bike prefilled with the bike; saving keeps one bike and the schedule follows the new
   model (F-R2-3). Secondary opens the same paywall as today. A Pro rider never sees the sheet.
3. **Automated check:** Maestro `apps/mobile/.maestro/flows/bike-limit-update-bike.yaml` (new): `runFlow onboarding.yaml`
   with `MAKE_ONLY: "true"` → Garage → `tapOn: {id: garage-add-bike-header}` → `assertVisible: {id: bike-limit-sheet}` →
   `tapOn: {id: bike-limit-update}` → `assertVisible: {id: edit-bike-make}` → pick a model by `edit-bike-model-search`
   (custom entry, as in add-bike.yaml; dismiss the custom keyboard by tapping a label) → save → `assertVisible` the model
   on the bike card → Garage shows exactly one bike card. Repeat the sheet assertion for the Home switcher entry. Jest:
   a pure `decideBikeLimitAction({isPro, bikeCount})` → `'open_form' | 'offer_update' | 'paywall'` in
   `apps/mobile/src/hooks/__tests__/`.
4. **Production metric:** share of onboarding completers with a bike-limit paywall request within 1 day, by version:
   ```sql
   WITH ob AS (SELECT person_id, min(timestamp) AS ob_at, argMin(toString(properties.$app_version), timestamp) AS ver
               FROM events WHERE event = 'onboarding_completed' AND timestamp >= now() - INTERVAL 60 DAY
                 AND person_id NOT IN (<12 test persons>) GROUP BY person_id),
        pw AS (SELECT person_id, min(timestamp) AS pw_at FROM events
               WHERE event = 'paywall_present_requested' AND properties.feature = 'unlimited_bikes'
                 AND timestamp >= now() - INTERVAL 60 DAY GROUP BY person_id)
   SELECT ob.ver AS app_version, count() AS completers,
          countIf(pw.pw_at >= ob.ob_at AND pw.pw_at < ob.ob_at + INTERVAL 1 DAY) AS bike_paywall_d0
   FROM ob LEFT JOIN pw ON pw.person_id = ob.person_id GROUP BY app_version ORDER BY app_version
   ```
   **Baseline 3.26.0: 7/118 (5.9%)** (R2-PH4). Target on the fix version: direct requests ≈ only riders who pick
   "second bike" in the sheet; plus the new `bike_limit_sheet_shown` → `bike_limit_choice {choice:'update'|'second_bike'|'dismiss'}`
   chain. Success = of riders shown the sheet, ≥ 50% choose `update` and save (`garage_bike_edited` within 10 min).
   [UNBACKED — own target] Harm check: Pro purchases from `feature='unlimited_bikes'` (RevenueCat/`rc_*`): 0 in the window, so
   no revenue is at risk.

### F-R2-3 — Changing the bike's make/model/year does not change its schedule

1. **Reproduce:** free account with a make-only Honda (after Task 1 it has Honda make-generic tasks). Garage → bike →
   Bike segment → Edit → set model "CB500F" → save. Service segment still shows the old tasks (today: none at all).
2. **Expected after fix:** pending OEM tasks that the rider never edited or completed are retired (soft-deleted through
   `soft_delete_maintenance_task`) and the new waterfall is imported; completed or edited tasks stay; user tasks are untouched.
3. **Automated check:** Jest `apps/api/src/modules/motorcycles/motorcycles.resolver.spec.ts`: update with a changed
   model → retires only `source='oem' AND status='pending' AND never completed AND not edited` tasks, then calls
   `autoPopulateForBike` without filter; update of nickname/odometer only → no schedule call. Maestro: the last steps of
   `bike-limit-update-bike.yaml` assert the Service segment shows a task after the edit.
4. **Production metric:** new `garage_bike_edited {changed_fields, from_capture_level:'make'|'model', source:'limit_sheet'|'bike_hub'|'other', schedule_refreshed_count}`.
   Per version: `uniqIf(person_id, properties.from_capture_level='make' AND has(splitByChar(',', toString(properties.changed_fields)), 'model'))`
   / riders with a make-only onboarding bike. **Baseline: not measurable today (no event, C14)**; DB proxy: blank-model
   live bikes 117, of which 7 ever had a task (R2-DB6). Target: ≥ 20% of make-only onboarding bikes get a model within
   7 days on the fix version. [UNBACKED — own target]

### F-R2-4 — Imperial riders would get wrong service targets from an onboarding import (latent; created by Task 1 if done naively)

1. **Reproduce (after a naive Task 1):** device region US or unit toggle "mi" in onboarding, new account, finish with
   odometer 10,000 mi. The first oil-change target reads ~10,000 + interval-in-km as miles.
2. **Expected:** target = odometer + `round(interval_km / 1.609)`.
3. **Automated check:** the users.service.spec case in F-R2-1 (`bikeMileageUnit: 'mi'`); Maestro: in
   `onboarding-service-plan.yaml` run once with the imperial unit toggle and assert the first task's distance ends in "mi"
   and matches the expected value for the GENERIC/Honda oil row.
4. **Production metric (DB):** for onboarding bikes with `mileage_unit='mi'` and OEM tasks, the share whose
   `target_mileage - current_mileage` equals the miles conversion of `interval_km` (± 1). Baseline: n/a (no imports yet).
   Target 100%.

### F-R2-5 — Junk makes in onboarding ("A", "V", "S", "P", a model typed as a make)

Out of this dive's fix scope (belongs to OB4 bike search), recorded so it is not lost. Spec: Jest on the bike-setup
custom-make rule (min length / must match NHTSA or a known make list before "Use 'X'"); metric: share of onboarding
bikes whose `make` has fewer than 3 letters or is not in the NHTSA make list (DB), baseline 4 of the 29 here.

## 6. Tasks

### T1 — Import the service schedule when onboarding creates the bike (Experiment 2 fix) — S
- **Why:** onboarding never imports since 2026-08-24 (C1–C3); 10/151 onboarding bikes have a schedule (R2-M1); the old
  62% came from the garage path that 00191 closed (R2-DB1–DB3).
- **What:** in `UsersService.completeOnboarding`, when `bikeMake` is set: find the bike the RPC returned (use the RPC's
  `motorcycle_id` instead of "latest bike"), then call `autoPopulateForBike` with no id filter (keep the id-filter branch
  for the intent cohort), with `currentMileage` and the unit from `input.bikeMileageUnit` (add an optional
  `measurementSystem` parameter to `autoPopulateForBike` that overrides the `users` read). Never fail onboarding on import errors (keep the `try/catch`).
- **Files:** `apps/api/src/modules/users/users.service.ts`, `apps/api/src/modules/oem-schedules/oem-schedules.service.ts`,
  their `.spec.ts`.
- **Acceptance:** spec cases in F-R2-1/F-R2-4 pass; `pnpm verify:api` green; Maestro `onboarding-service-plan.yaml` and
  `onboarding-make-only-service-plan.yaml` pass on a preview build against the deployed API.
- **Verify in production:** R2-M1 ≥ 95% for 2 weeks after deploy; Appendix A metric ≥ 55% for 4 weeks; harm check per
  synthesis P06.3. Log the deploy date as a PostHog annotation and in the experiments ledger.
- **Dependencies:** none. Backfill of the existing ~250 onboarding bikes without tasks is a separate owner decision
  (could be a one-off script via `importOemSchedule`, not a migration).
- **Owner decision:** approve shipping during Experiment 1 (both arms; synthesis says yes); approve backfill or not.

### T2 — Attribute imports and bike edits in analytics — S
- **Why:** no event says a plan was imported on onboarding, or that a bike was edited (C14, R2-PH5 has no `context`).
- **What:** (a) `onboarding_completed` gets `service_plan_task_count` and `service_plan_tier` — return them on the
  existing `completeOnboarding` result via a new nullable field (non-breaking for old clients), or have the client read
  the bike's task count after `invalidateUser`; (b) `oem_schedule_imported` gets `context:'bike_hub'`; (c) new
  `garage_bike_edited` (F-R2-3 fields); (d) `bike_limit_sheet_shown` / `bike_limit_choice` (T3). Add all to
  `apps/mobile/src/lib/analytics.ts` and the event schemas in `packages/analytics`.
- **Files:** `apps/api/src/modules/users/*`, `apps/mobile/src/app/(onboarding)/personalizing.tsx`,
  `apps/mobile/src/components/bike-hub/shell/use-bike-actions.ts`, `apps/mobile/src/app/(tabs)/(garage)/edit-bike.tsx`,
  `apps/mobile/src/lib/analytics.ts`, `packages/analytics`; `pnpm generate` if GraphQL changes.
- **Acceptance:** events visible in PostHog `read-data-schema` from the fix build; Jest asserts properties.
- **Dependencies:** T1 for (a). Ships in the instrumentation PR (synthesis P06.1 item 7).
- **Owner decision:** none.

### T3 — Bike-limit sheet: "Update my bike" before "Add a second bike (Pro)" — M
- **Why:** 7/118 completers on 3.26.0 hit the bike paywall on day 0 and none ever got their bike right (R2-PH4, R2-DB5);
  riders look for edit-bike (R2-PH3).
- **What:** one hook `useAddBikeGate` used by all four entries (C8): Pro or 0 bikes → form; free with ≥1 bike → bottom
  sheet (light + dark, 7 locales) with "Update <bike name>" → `edit-bike?id=` and "Add a second bike — Pro" → the
  existing `presentPaywall({feature:'unlimited_bikes', surface:<entry>})`. Server limit unchanged. testIDs:
  `bike-limit-sheet`, `bike-limit-update`, `bike-limit-second-bike`, `garage-add-bike-header`.
- **Files:** new `apps/mobile/src/hooks/use-add-bike-gate.ts` (+ test), `(tabs)/(garage)/index.tsx`, `(tabs)/(home)/index.tsx`,
  `hooks/use-profile-data.ts`, `(garage)/add-bike.tsx` (server-rejection fallback), `src/i18n/locales/*.json`.
- **Acceptance:** Maestro `bike-limit-update-bike.yaml` passes on iOS and Android; `pnpm verify:mobile`,
  `pnpm check:i18n`, `pnpm check:mobile-colors` green; screenshots in light and dark.
- **Verify in production:** F-R2-2 query by `$app_version`; sheet choice split.
- **Dependencies:** T4 (so "Update" also fixes the schedule); T2 (d).
- **Owner decision:** yes — it lowers direct `unlimited_bikes` paywall impressions (no purchases came from them in the
  window). It is not the onboarding paywall, so `onboarding_paywall_2026q4` and `expd7c1d56904` are untouched. Home
  switcher "+" is a Home element: confirm it is fine during the Experiment 1 slot (it is a gate, not a first-week Home
  content change), or ship the Garage/Profile entries first.

### T4 — Refresh the schedule when the bike's identity changes — M
- **Why:** edit is the free way to correct the bike, but it never changes tasks (C9); after T1 a make-only bike carries
  make-generic rows that must give way to model rows.
- **What:** in `MotorcyclesResolver.updateMotorcycle`, if make/model/year/variant changed: list the bike's tasks with
  `source='oem'`, `status='pending'`, no completion and not edited by the rider (compare against the schedule's
  title/interval, or add an `edited` check if a column exists), soft-delete each via `soft_delete_maintenance_task`
  (C16, user client), then `autoPopulateForBike` without filter. Return the count for T2's `schedule_refreshed_count`.
- **Files:** `apps/api/src/modules/motorcycles/motorcycles.resolver.ts` (+ spec), maybe
  `apps/api/src/modules/maintenance-tasks/maintenance-tasks.service.ts`.
- **Acceptance:** F-R2-3 spec; no migration needed if "edited" can be read from existing columns — if not, the
  migration is owner-approved (CLAUDE.md "Changing a data model").
- **Dependencies:** T1.
- **Owner decision:** confirm that a rider-edited OEM task must survive a model change.

### T5 — "Add your model" prompt for make-only bikes in the bike hub — S
- **Why:** 52/104 onboarding bikes on 3.26.0 are make-only (R2-PH4); 117 blank live bikes, 7 with a task (R2-DB6);
  most never tap Add, so T3 does not reach them.
- **What:** in the bike hub Overview (not Home), a row "Add your model for its exact service schedule" → edit-bike,
  shown when `model === ''`; show the tier on make-generic tasks.
- **Files:** `apps/mobile/src/components/bike-hub/overview/overview-segment.tsx`, locales.
- **Acceptance:** Maestro step in `onboarding-make-only-service-plan.yaml` taps the row and lands on edit-bike; light/dark.
- **Verify:** F-R2-3 metric with `source:'bike_hub'`.
- **Dependencies:** T4, T2.
- **Owner decision:** placement (bike hub now; Home plate state waits for the slot, synthesis rank 11).

### T6 — Fix the stale Maestro comment and add the MAKE_ONLY branch — S
- **Why:** C15 says a make-only bike leaves the garage empty; false since 00191 and it misleads flow authors.
- **What:** update the comment; add `MAKE_ONLY` env branch to `_shared/onboarding-to-account.yaml`; register
  `test:e2e:service-plan`, `test:e2e:make-only-service-plan`, `test:e2e:bike-limit` in `apps/mobile/package.json`
  (via `E2E_FLOW=… run-onboarding-e2e.sh`), and list them in `.maestro/README.md`.
- **Dependencies:** none (lands with T1's flows).
- **Owner decision:** none.

### Release marking in PostHog (owner requirement)

- T1 and T4 are API-only: create a PostHog annotation at the Render deploy time ("R2 onboarding schedule import live",
  owner-approved write) and read R2-M1 / Appendix A before vs after that date.
- T2, T3, T5 ship in one mobile version (e.g. the next minor after 3.28.0): every PostHog metric above is broken down
  by `properties.$app_version` (and `$app_build` for Android vs iOS), so "fix version vs 3.26.0–3.28.0" reads directly.
  Add the version to `docs/research/activation-365/experiments.md` (ledger, synthesis P06.1 item 9).

## 7. Risks

- **Imperial targets** wrong if T1 reads `users.measurement_system` (C12). Mitigated in T1's spec.
- **Wrong intervals presented as model-specific:** make-generic Honda says 6,000 km oil vs Africa Twin 12,000 km
  (memory `project_oem_schedule_africa_twin`). Keep the tier label on tasks; Experiment 2 guardrail.
- **Reminder noise:** ~10 tasks with due dates per new bike start scheduling maintenance reminders/push for riders who
  never asked (they did not swipe). Check the reminder scheduler caps first notifications. [UNBACKED — not read]
- **Double completion (OB6):** `completeOnboarding` can run twice; the import dedups by `oem_schedule_id` (C5), so safe.
- **Experiment 1 read:** T1 changes what Home shows in both arms; log it in the ledger and cut the slot readout at the
  deploy date (synthesis Experiment 2 guardrails).
- **T3 lowers paywall exposure** for `unlimited_bikes`; no purchases came from it in the window (evidence pack §6), but
  the owner decides.
- **Small numbers:** ~7 riders/month hit the bike paywall; F-R2-2 will read as counts, not rates, for months.

## 8. Open questions

1. Why did 15 pre-00191 riders hit the gate minutes after a *successful* garage add? (checklist row, double tap?) —
   historical, but the same entry may still fire for Pro-limit riders.
2. Do the 4 post-00191 riders with a full-model bike want a second bike or a different one? (replay the 7 sessions; T3's
   choice event answers it going forward.)
3. Backfill the ~250 existing onboarding bikes without tasks (one-off import), or only new bikes?
4. Is there a field that marks an OEM task as edited by the rider (for T4), or does T4 need a migration?
5. Does the maintenance reminder scheduler need a cap before T1 creates ~10 dated tasks per new bike?
6. Should the junk-make issue (F-R2-5) join OB4's bike-search work?
