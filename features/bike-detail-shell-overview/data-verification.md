# Data verification — migrations 00180–00182

Run on 2026-10-02 against a **local** database (`127.0.0.1:54322`, Docker project `mvscratch`)
built by one clean replay of `00001–00182`. Nothing here ran against production.
How to reach that stack: `local-stack.md`.

## What the database is, and is not

The repo's migration folder does not replay on an empty database. The verification database is
built from a scratch copy of `supabase/` with **three old migrations patched in the copy only**
(tracked files untouched). After those three, the remaining 77 files applied unmodified.

| File | Failure on an empty DB | Patch in the copy | Guess? |
|---|---|---|---|
| `00093_places.sql` | `function ll_to_earth(double precision, double precision) does not exist` — `cube`/`earthdistance` are only created in 00094 | none to the file; untracked `supabase/roles.sql` creates both extensions before migrations | no (ordering) |
| `00097_users_handle.sql` stmt 4 | `cannot change name of view column "display_name" to "handle"` (42P16) | `CREATE OR REPLACE VIEW` → `DROP VIEW` + `CREATE VIEW`, same columns | no |
| `00098_surface_reports.sql` stmt 1 | `syntax error at or near "("` (42601): `UNIQUE (route_id, user_id, (reported_at::date))` is not valid SQL | constraint replaced by a unique index on the UTC day | **yes, and wrong**: production has a `report_date` column instead (see fidelity) |
| `00102_user_gating_events_year_month.sql` | `generation expression is not immutable` (42P17) | adds `public.year_month_immutable(ts)` and generates the column from it | **yes**: the function exists in production (it is in `database.types.ts`) but in no migration; its body is guessed |

```diff
--- supabase/migrations/00097_users_handle.sql
+++ supabase/migrations/00097_users_handle.sql
@@ -62,7 +62,9 @@
 -- ==========================================
 -- Update public_profiles view to include handle + show_saved_publicly
 -- ==========================================
-CREATE OR REPLACE VIEW public.public_profiles AS
+-- SCRATCH PATCH: CREATE OR REPLACE cannot insert a column mid-list (42P16).
+DROP VIEW public.public_profiles;
+CREATE VIEW public.public_profiles AS
 SELECT
   id,
   public_username,
--- supabase/migrations/00098_surface_reports.sql
+++ supabase/migrations/00098_surface_reports.sql
@@ -20,13 +20,14 @@
   reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
   condition   surface_condition NOT NULL,
   note        TEXT,
-  photo_url   TEXT,
-
-  -- One report per user per route per day
-  CONSTRAINT uq_surface_report_per_day
-    UNIQUE (route_id, user_id, (reported_at::date))
+  photo_url   TEXT
 );
 
+-- SCRATCH PATCH: a UNIQUE constraint cannot contain an expression (42601).
+-- Same rule as a unique index; UTC day because timestamptz::date is not immutable.
+CREATE UNIQUE INDEX uq_surface_report_per_day
+  ON surface_reports (route_id, user_id, ((reported_at AT TIME ZONE 'UTC')::date));
+
 -- Indexes
 CREATE INDEX idx_surface_reports_route_date
   ON surface_reports (route_id, reported_at DESC);
--- supabase/migrations/00102_user_gating_events_year_month.sql
+++ supabase/migrations/00102_user_gating_events_year_month.sql
@@ -1,8 +1,14 @@
 -- MOT-179: Add year_month generated column for monthly quota windowing
 -- No cron/reset needed — quota is computed via WHERE year_month = current month
 
+-- SCRATCH PATCH: to_char(timestamptz, ...) is not immutable (42P17). Production has
+-- public.year_month_immutable(ts) (see database.types.ts) but no migration creates
+-- it; the body below is a guess, the signature is from the types file.
+CREATE FUNCTION public.year_month_immutable(ts timestamptz) RETURNS text
+LANGUAGE sql IMMUTABLE AS $$ SELECT to_char(ts AT TIME ZONE 'UTC', 'YYYY-MM') $$;
+
 ALTER TABLE public.user_gating_events
-  ADD COLUMN year_month TEXT GENERATED ALWAYS AS (to_char(created_at, 'YYYY-MM')) STORED;
+  ADD COLUMN year_month TEXT GENERATED ALWAYS AS (public.year_month_immutable(created_at)) STORED;
 
 CREATE INDEX idx_gating_events_user_feature_month
   ON public.user_gating_events (user_id, feature, year_month DESC);
```

Scratch-only `config.toml` change (keeps the CLI from pulling images):

```diff
--- supabase/config.toml
+++ supabase/config.toml
@@ -78,3 +78,13 @@
 [storage]
 enabled = true
 file_size_limit = "50MiB"
+
+# SCRATCH ONLY: keep the CLI from pulling images that are not needed for verification.
+[realtime]
+enabled = false
+
+[analytics]
+enabled = false
+
+[edge_runtime]
+enabled = false
```

## Fidelity: scratch database (before 00180) vs production types

`supabase gen types --local` on the scratch database at 00179, compared structurally with the
committed `packages/types/src/database.types.ts` (generated from production). The two files
are in different text formats (local pg-meta v0.99.0 vs the linked generator), so the comparison
walks every table / view / function / enum with ts-morph and ignores order and quoting.

**Identical:** `motorcycles`, `users`, `rides`, `maintenance_tasks`, `expenses`, `documents`,
`document_files`, `document_categories` and everything else not listed below.

**28 differences, none on a table this phase touches:**

- Generator dialect, not schema (11): the `__InternalSupabase` key; generated columns typed
  `never` for Insert/Update locally and as their base type in the committed file —
  `discover_trips.start_lat/start_lng`, `routes.search_tsv`, `places.search_tsv`,
  `model_insights.normalized_key`, `user_gating_events.year_month`.
- Production differs from the migration folder (17):
  - `social_post_queue.headline` exists in production only (also in `claim_next_social_post`'s return type).
  - `find_nearest_place` returns `place_id: number` in production, `id: string` from the folder.
  - `earth()` is in production's `public` schema, not locally.
  - `_visibility_backfill_audit` exists in the folder, not in production.
  - `sponsorships`: `cta_text`/`cta_url` NOT NULL and `monthly_budget` nullable in production; the reverse from the folder.
  - `surface_reports`: production has `report_date` and a `user_id` FK to `public.users`.
  - `public_profiles` view: production has no `city`, `follower_count`, `following_count`.

Types delta produced by 00180–00182 (scratch at 00179 vs scratch at 00182), all of it expected:
tables `notes`, `note_photos`, `odometer_readings`; functions `log_odometer_reading`,
`note_link_is_own`, `soft_delete_note`; `motorcycles.distance_unit` (Row `string`, Insert
**required** `string` — the column has no default, a BEFORE INSERT trigger fills it — Update optional).

## Production drift found

For the owner. The migration folder and production have drifted apart; none of it touches this
phase's tables, all of it was found while building the verification database.

**The folder does not replay on an empty database** (`supabase db reset` fails):

| Migration | Why it fails | What production really has |
|---|---|---|
| `00093_places.sql` | uses `ll_to_earth()` before 00094 creates `cube`/`earthdistance` | the extensions already existed when 00093 ran; `earth()` is visible in production's `public` schema |
| `00097_users_handle.sql` | `CREATE OR REPLACE VIEW public_profiles` inserts a column mid-list, which Postgres rejects | a `public_profiles` view without `city`, `follower_count`, `following_count` — i.e. not what 00097 would create either |
| `00098_surface_reports.sql` | `UNIQUE (route_id, user_id, (reported_at::date))` is not valid SQL | a `surface_reports.report_date` column (non-null, has a default or is generated) and a `user_id` FK to `public.users`. **My scratch patch (a unique index on the UTC day) guessed wrong.** |
| `00102_user_gating_events_year_month.sql` | `to_char(timestamptz)` in a generated column is not immutable | a function `public.year_month_immutable(ts)` that no migration creates; its body is unknown (the scratch patch guesses `to_char(ts AT TIME ZONE 'UTC', 'YYYY-MM')`) |

**Schema objects where production differs from what the folder builds** (the 17 structural
differences of the fidelity check, grouped):

1. `social_post_queue.headline` — column in production, in no migration (3: Row / Insert / Update).
2. `claim_next_social_post()` — return type includes `headline` in production (1).
3. `find_nearest_place()` — returns `place_id: number` in production; the folder's version returns `id: string` (1).
4. `earth()` — present in production's `public` schema, absent locally (1).
5. `_visibility_backfill_audit` — table created by the folder, absent in production (1).
6. `sponsorships` — `cta_text` and `cta_url` are NOT NULL and `monthly_budget` is nullable in production; the folder builds the opposite (3).
7. `surface_reports` — `report_date` column and the `user_id` → `public.users` relationship exist only in production (4: Row / Insert / Update / Relationships).
8. `public_profiles` view — `city`, `follower_count`, `following_count` exist only in the folder's version (3).

Consequence beyond this phase: nobody can stand up a faithful local or CI database from the
folder, and `schema_migrations` is not proof of what is live (as 00141 → 00178 already showed).
A baseline migration dumped from production would close it; that is an owner decision and is
not part of this phase.

## How `database.types.ts` was produced (commit `0826a283`)

It is **not generator output**. `supabase gen types --local` cannot reproduce the committed
file: its text format differs (above) and it would write the drift into the file (e.g. delete
`social_post_queue.headline`). So:

1. `types-before.ts` = `supabase gen types typescript --local --schema public,graphql_public` on
   the scratch database at 00179; `types-after.ts` = the same at 00182.
2. A scratch ts-morph script (kept out of the repo) read the nine new objects from
   `types-after.ts` — tables `notes`, `note_photos`, `odometer_readings`; functions
   `log_odometer_reading`, `note_link_is_own`, `soft_delete_note`; `motorcycles.distance_unit` in
   Row / Insert / Update — and inserted them into the committed file at their alphabetical
   positions, printed in that file's style (no semicolons, 80-column fit-or-break for functions).
   Result: 163 lines added, 0 removed.
3. Check, with the same structural comparison used for fidelity:
   - committed file after − committed file before = scratch types after − scratch types before:
     the same 9 objects, **exact**;
   - committed file after vs `types-after.ts` = the 28 pre-existing differences and nothing else,
     so each new object is structurally equal to what the generator emitted.

After the owner pushes 00180–00182: run `pnpm generate:types`. It must give a **zero diff**. If
it does not, commit the generator's output — it is the source of truth, this file is a stand-in.

## Column-level grants on `motorcycles` (Task 1.1)

`\dp public.motorcycles` on the replay: no column privileges; `authenticated` holds table-level
`arwdDxtm`. `information_schema.column_privileges` does list `recall_count` UPDATE for
`authenticated`, but only as the expansion of the table-level grant. So no `GRANT SELECT
(distance_unit)` is needed **per the folder**. Production may differ (00141 was once recorded as
applied and was not); the one-line check to run there before the push is in the 00180 header.

## Probes

Two users: A = `rider-a@local.test` (metric), B = `rider-b@local.test` (imperial). "As A" means
`SET LOCAL role authenticated` plus `request.jwt.claims` with A's id, i.e. RLS in force.
Every probe passed on the clean replay. One real defect was found and fixed on the way (below).

### 00180 — `motorcycles.distance_unit`

```
== P180.1 setup: B becomes imperial (as B, through the user UPDATE path)
== P180.2 insert bikes without distance_unit, as each user (expect A km / B mi)
 is_a | distance_unit | mileage_unit | current_mileage 
 t    | km            | mi           |           38167
 f    | mi            | mi           |           23716
(2 rows)
== P180.3 NULL count (expect 0)
 count 
     0
== P180.4 flip B to metric then back: unit flips, current_mileage byte-identical (expect km 23716, then mi 23716)
 distance_unit | current_mileage | has_stamp 
 km            |           23716 | t
 distance_unit | current_mileage 
 mi            |           23716
== P180.5 flip produced no odometer reading (expect only the initial row, count 1)
 source  | value | count 
 initial | 23716 |     1
== P180.6 soft-deleted bike is synced too
 distance_unit 
 km
== P180.7 CHECK rejects other units (expect 23514)
== P180.8 trigger functions not executable by anon/authenticated (expect f f f f)
ERROR:  new row for relation "motorcycles" violates check constraint "chk_motorcycles_distance_unit"
 has_function_privilege | has_function_privilege | has_function_privilege | has_function_privilege 
 f                      | f                      | f                      | f
== P180.9 backfill statements on existing bikes (column emptied inside a rolled-back transaction, then the two migration UPDATEs re-run): expect metric->km, imperial->mi, 0 NULLs, mileage unchanged
 measurement_system | distance_unit | bikes | mileage_sum 
 imperial           | mi            |     1 |       23716
 metric             | km            |     2 |       40752
(2 rows)
 nulls 
     0
 mileage_sum_after_rollback 
                      64468
```

Pass: no NULLs; an insert without the column takes the owner's unit (km / mi); flipping the
profile flips the unit and leaves `current_mileage` byte-identical (23716 both ways — no
conversion) and logs no odometer reading; soft-deleted bikes are synced; the CHECK rejects other
values; the two trigger functions are not executable by `anon` / `authenticated`; the backfill
statements map metric→km, imperial→mi.

### 00181 — `odometer_readings`

```
== P181.0 readings so far for bike A (expect 1 initial 38167)
 source  | value 
 initial | 38167
== P181.1 RPC today as A: returns uuid; 1 row for 39407; bike = 39407 manual; no duplicate from trigger
 logged 
 t
 source | count 
 manual |     1
 current_mileage | odometer_sync_source | odometer_last_ride_id | stamp_recent 
           39407 | manual               |                       | t
== P181.2 back-dated 90 days as A: logged (1 row 30000), bike unchanged (39407), stamp unchanged
 logged 
 t
 rows_30000 
          1
 current_mileage | stamp_still_recent 
           39407 | t
== P181.3 new bike with no odometer (no initial row), back-dated first reading: bike moves to 1240 and keeps the explicit stamp 2026-09-20 (set_mileage_updated_at change)
 logged 
 t
 current_mileage |   mileage_updated_at   
            1240 | 2026-09-20 10:00:00+00
 source | value |      recorded_at       
 manual |  1240 | 2026-09-20 10:00:00+00
== P181.4 direct UPDATE as A (legacy updateMotorcycle path): exactly one manual row from the trigger; stamp set by trigger
 source | ride_id | count 
 manual |         |     1
== P181.5 UPDATE that does not change current_mileage logs nothing (count stays 4 for bike A)
 count 
     4
== P181.6 service-role style write with gps_ride + ride id (what endRide does): one gps_ride row with ride_id
  source  |               ride_id                | value 
 gps_ride | cccccccc-0000-4000-8000-000000000001 | 39512
== P181.7 future timestamp refused (expect 22023), a bike of another user refused (expect P0002), cross-user read = 0
ERROR:  22023: recorded_at_in_future
ERROR:  P0002: motorcycle_not_found
unterminated quoted string
 b_rows_visible_to_a 
                   0
== P181.8 direct INSERT for
ERROR:  42501: new row violates row-level security policy for table "odometer_readings"
 should_not_appear 
(0 rows)
 should_not_appear 
(0 rows)
== P181.9 anon cannot execute the RPC (expect 42501), ACL flags (expect f t f f)
ERROR:  42501: permission denied for function log_odometer_reading
 anon_rpc | auth_rpc | anon_trg | auth_trg 
 f        | t        | f        | f
== P181.10 trigger cannot fail an odometer write: break the log table, update mileage (expect WARNING + 39600 returned), roll back
WARNING:  log_motorcycle_odometer_change: reading not logged for motorcycle aaaaaaaa-0000-4000-8000-000000000001: relation "public.odometer_readings" does not exist (42P01)
 current_mileage 
           39600
== P181.10b same with a CHECK violation (negative mileage is logged as a warning, write succeeds if the table allows it)
 current_mileage 
           39601
WARNING:  log_motorcycle_odometer_change: reading not logged for motorcycle aaaaaaaa-0000-4000-8000-000000000001: new row for relation "odometer_readings" violates check constraint "tmp_fail" (23514)
== P181.11 backfill statement on existing bikes (re-run in a transaction on a cleared log: expect one backfill row per bike with mileage > 0 = 3)
  source  | count 
 backfill |     3
== P181.12 final log for bike A, newest first
 value |  source  | has_ride 
 39512 | gps_ride | t
 39500 | manual   | f
 39407 | manual   | f
 38167 | initial  | f
 30000 | manual   | f
(5 rows)
```

("unterminated quoted string" is psql complaining about an apostrophe in an `\echo` label, not a probe result.)

Pass: RPC today → one `manual` row, bike moved, no duplicate from the trigger; back-dated older
than the latest → logged, bike and stamp unchanged; direct `UPDATE` (legacy path) → one `manual`
row; an `UPDATE` that does not change the mileage logs nothing; a `gps_ride` write logs one row
with `ride_id`; future timestamp → 22023; another user's bike → P0002; cross-user read → 0 rows;
direct insert for another user's bike → 42501; `UPDATE`/`DELETE` of readings affect 0 rows
(append-only); `anon` cannot execute the RPC (42501); **the trigger cannot fail an odometer
write** (log table renamed away, and a failing CHECK: both give a WARNING and the `UPDATE`
succeeds).

**Defect found by P181.3 and fixed (commit `63185755`):** `current_mileage` defaults to 0, so a
bike created without an odometer got an `initial` reading of 0 dated now. A first reading
back-dated before the bike's creation was then "older than the latest reading" and the RPC logged
it without moving the bike (it stayed at 0). The trigger now skips INSERTs at 0 and the backfill
skips bikes at 0. P181.3 above is the re-run: the bike moves to 1240 and keeps the explicit
2026-09-20 stamp, which also proves the `set_mileage_updated_at` change.

Ride end through the real API (`startRide` → `endRide` 25 km, as A):

```
-- E1 startRide
   {"startRide": {"id": "<uuid>", "status": "recording"}}
-- E2 endRide 25 km
   {"endRide": {"__typename": "EndRideResponse"}}
-- E3 odometerReadings: newest is gps_ride with rideId, value = previous + 25
   {"odometerReadings": [{"value": 39675, "source": "gps_ride", "rideId": "<uuid>"}, {"value": 39650, "source": "manual", "rideId": null}]}
-- E4 bike
   {"myMotorcycles": [{"model": "Tenere 700", "currentMileage": 1240, "odometerSyncSource": "manual", "odometerLastRideId": null}, {"model": "Africa Twin", "currentMileage": 39675, "odometerSyncSource": "gps_ride", "odometerLastRideId": "<uuid>"}]}
ride id <uuid>
```

### 00182 — `notes`

```
== P182.0 fixtures (tasks, expenses for A and B; one note for B)
INSERT 0 2
INSERT 0 2
INSERT 0 1
== P182.1 A inserts, selects and updates an own note (expect INSERT 0 1, 1 row, UPDATE 1, updated_at moved)
INSERT 0 1
          body          | odometer 
 Rear preload felt soft |    38100
UPDATE 1
== P182.2 A cannot see or update the note of B (expect 0 rows, UPDATE 0)
 b_notes_visible 
               0
UPDATE 0
== P182.3 A inserting a note on the bike of B (expect 42501)
ERROR:  42501: new row violates row-level security policy for table "notes"
== P182.4 A inserting a note for user B (expect 42501)
ERROR:  42501: new row violates row-level security policy for table "notes"
== P182.5 A linking the task of B on insert (expect 42501) and on update (expect 42501)
ERROR:  42501: new row violates row-level security policy for table "notes"
ERROR:  42501: new row violates row-level security policy for table "notes"
== P182.6 A linking the expense of B (expect 42501)
ERROR:  42501: new row violates row-level security policy for table "notes"
== P182.7 A linking own task and own expense (expect UPDATE 1)
UPDATE 1
== P182.8 whitespace-only and 4001-char bodies (expect 23514 twice), negative odometer (23514)
ERROR:  23514: new row for relation "notes" violates check constraint "notes_body_check"
ERROR:  23514: new row for relation "notes" violates check constraint "notes_body_check"
ERROR:  23514: new row for relation "notes" violates check constraint "notes_odometer_check"
== P182.9 the reason note_link_is_own exists: soft-delete the linked task, then edit the note (expect t, then UPDATE 1 and no 42501)
 task_deleted 
 t
UPDATE 1
== P182.9b control: the same edit under the plan-as-written policy (plain EXISTS) is rejected (expect 42501)
ERROR:  42501: new row violates row-level security policy for table "notes"
== P182.10 direct soft delete by UPDATE is rejected by the SELECT policy (expect 42501) - hence the RPC
ERROR:  42501: new row violates row-level security policy for table "notes"
== P182.11 hard DELETE affects nothing (no DELETE policy; expect DELETE 0)
DELETE 0
== P182.12 note_photos: own row ok (INSERT 0 1), row for user B refused (42501)
INSERT 0 1
ERROR:  42501: new row violates row-level security policy for table "note_photos"
== P182.13 soft_delete_note: own note twice (expect t t), note of B (expect f), note gone from SELECT (0), B note still there for B
 first | second 
 t     | t
 others_note 
 f
 own_note_visible 
                0
 a_deleted 
 t
 b_untouched |      body      
 t           | B private note
== P182.14 anon: RPC and helper not executable (expect 42501 twice; flags f t f t), anon sees no notes
ERROR:  42501: permission denied for function soft_delete_note
ERROR:  42501: permission denied for function note_link_is_own
 anon_notes 
          0
 anon_del | auth_del | anon_link | auth_link 
 f        | t        | f         | t
== P182.15 cascade: deleting the bike removes its notes and photos (in a rolled-back transaction; expect 0 0)
DELETE 1
 notes_left | photos_left 
          0 |           0
```

Pass: own insert / select / update; B's note invisible and not updatable; note on B's bike,
note for user B, link to B's task (insert and update) and to B's expense → 42501; body and
odometer CHECKs → 23514; direct soft delete by `UPDATE` → 42501 (hence the RPC); no hard delete;
`note_photos` own-only; `soft_delete_note` → `t t` for an own note, `f` for B's; `anon` cannot
execute either function; cascade from the bike removes notes and photos.

**P182.9 / P182.9b — why `note_link_is_own()` exists (deviation from the plan):** with the
linked task soft-deleted, the note is still editable (P182.9). The control swaps in the policy as
the plan wrote it (plain `EXISTS` on `maintenance_tasks`) and the same edit is rejected with
42501 (P182.9b), because that `EXISTS` runs under the tasks SELECT policy (`deleted_at IS NULL`).

## API round-trips (Tasks 2.2 / 2.3)

Local API on `:4010` against the local stack, two signed-in users (password grant), real
PostgREST. This also verifies the embeds in `notes.service.ts`
(`linked_task:maintenance_tasks!linked_task_id(title)`,
`linked_expense:expenses!linked_expense_id(amount, currency)`).

```
-- R1 myMotorcycles as A: distanceUnit km
   {"myMotorcycles": [{"id": "<uuid>", "model": "Tenere 700", "currentMileage": 1240, "distanceUnit": "km"}, {"id": "<uuid>", "model": "Africa Twin", "currentMileage": 39512, "distanceUnit": "km"}]}
-- R1b myMotorcycles as B: distanceUnit mi
   {"myMotorcycles": [{"id": "<uuid>", "currentMileage": 23716, "distanceUnit": "mi"}]}
-- R2 logOdometerReading 39700 as A -> bike with new currentMileage
   {"logOdometerReading": {"id": "<uuid>", "currentMileage": 39700, "distanceUnit": "km", "odometerSyncSource": "manual", "mileageUpdatedAt": "2026-10-02T11:59:33.433+00:00"}}
-- R3 odometerReadings as A: 39700 manual first
   {"odometerReadings": [{"value": 39700, "source": "manual", "rideId": null}, {"value": 39512, "source": "gps_ride", "rideId": "<uuid>"}, {"value": 39500, "source": "manual", "rideId": null}]}
-- R4 logOdometerReading lower value 39650 accepted
   {"logOdometerReading": {"currentMileage": 39650}}
-- R5 logOdometerReading future recordedAt rejected by the Zod pipe
   "ERROR: Please check your input and try again. [BAD_REQUEST]"
-- R6 logOdometerReading on the bike of B as A rejected
   "ERROR: Failed to log odometer reading [BAD_REQUEST]"
-- R7 odometerReadings of the bike of B as A: empty
   {"odometerReadings": []}
-- R8 pendingRideDistance as A (no unapplied rides yet): zero
   {"pendingRideDistance": {"rideCount": 0, "distance": 0}}
-- R9 unauthenticated odometerReadings rejected
   "ERROR: Missing authorization header [UNAUTHENTICATED]"
-- N1 createNote with alsoCreateTask as A: linked task, derived title (PostgREST embed)
   {"createNote": {"id": "<uuid>", "motorcycleId": "<uuid>", "text": "Rear preload felt soft two-up on the Pyrenees run — check sag before the next trip.", "odometer": 38100, "linkedTaskId": "<uuid>", "linkedTaskTitle": "Rear preload felt soft two-up on the Pyrenees run", "linkedExpenseId": null, "linkedExpenseAmount": null, "linkedExpenseCurrency": null, "photos": []}}
-- N2 the created task is low priority, undated
   {"maintenanceTasks": [{"id": "<uuid>", "title": "Rear preload felt soft two-up on the Pyrenees run", "priority": "low", "dueDate": null, "targetMileage": null, "notes": "Rear preload felt soft two-up on the Pyrenees run — check sag before the next trip."}]}
-- N3 createNote plain
   {"createNote": {"id": "<uuid>", "motorcycleId": "<uuid>", "text": "Idea: heated grips", "odometer": null, "linkedTaskId": null, "linkedTaskTitle": null, "linkedExpenseId": null, "linkedExpenseAmount": null, "linkedExpenseCurrency": null, "photos": []}}
-- N4 notes as A: newest first, 2 notes
   {"notes": [{"id": "<uuid>", "text": "Idea: heated grips", "linkedTaskTitle": null}, {"id": "<uuid>", "text": "Rear preload felt soft two-up on the Pyrenees run — check sag before the next trip.", "linkedTaskTitle": "Rear preload felt soft two-up on the Pyrenees run"}]}
-- N5 notes of the bike of A as B: empty
   {"notes": []}
-- N6 updateNote as A
   {"updateNote": {"id": "<uuid>", "text": "Rear preload: sag checked", "odometer": null, "linkedTaskTitle": "Rear preload felt soft two-up on the Pyrenees run"}}
-- N7 updateNote as B on the note of A: not found
   "ERROR: Note not found [NOT_FOUND]"
-- N8 createTaskFromNote on the plain note
   {"createTaskFromNote": {"id": "<uuid>", "linkedTaskId": "<uuid>", "linkedTaskTitle": "Idea: heated grips"}}
-- N9 createTaskFromNote again: unchanged (same linkedTaskId)
   {"createTaskFromNote": {"id": "<uuid>", "linkedTaskId": "<uuid>", "linkedTaskTitle": "Idea: heated grips"}}
-- N10 createNote on the bike of B as A rejected
   "ERROR: Failed to create note [BAD_REQUEST]"
-- N11 createNote whitespace text rejected by Zod
   "ERROR: Please check your input and try again. [BAD_REQUEST]"
-- N12 deleteNote as B on the note of A: not found
   "ERROR: Note not found [NOT_FOUND]"
-- N13 deleteNote as A
   {"deleteNote": true}
-- N14 deleteNote as A again: still true
   {"deleteNote": true}
-- N15 notes as A after delete: 1 note
   {"notes": [{"id": "<uuid>", "text": "Idea: heated grips"}]}
-- N16 addNotePhoto with a path outside the prefix rejected
   "ERROR: Invalid storage path [BAD_REQUEST]"
-- N17.1 addNotePhoto #1 (4th must be rejected)
   {"addNotePhoto": {"id": "<uuid>", "publicUrl": "http://127.0.0.1:54321/storage/v1/object/public/maintenance-photos/<uuid>/notes/<uuid>/1.webp", "mimeType": "image/webp"}}
-- N17.2 addNotePhoto #2 (4th must be rejected)
   {"addNotePhoto": {"id": "<uuid>", "publicUrl": "http://127.0.0.1:54321/storage/v1/object/public/maintenance-photos/<uuid>/notes/<uuid>/2.webp", "mimeType": "image/webp"}}
-- N17.3 addNotePhoto #3 (4th must be rejected)
   {"addNotePhoto": {"id": "<uuid>", "publicUrl": "http://127.0.0.1:54321/storage/v1/object/public/maintenance-photos/<uuid>/notes/<uuid>/3.webp", "mimeType": "image/webp"}}
-- N17.4 addNotePhoto #4 (4th must be rejected)
   "ERROR: Maximum of 3 photos per note [BAD_REQUEST]"
-- N18 notes as A: photos resolved through the DataLoader (3)
   {"notes": [{"id": "<uuid>", "photos": [{"id": "<uuid>", "storagePath": "<uuid>/notes/<uuid>/1.webp"}, {"id": "<uuid>", "storagePath": "<uuid>/notes/<uuid>/2.webp"}, {"id": "<uuid>", "storagePath": "<uuid>/notes/<uuid>/3.webp"}]}]}
-- N19 deleteNotePhoto as B: not found
   "ERROR: Photo not found [NOT_FOUND]"
-- N20 deleteNotePhoto as A
   {"deleteNotePhoto": true}
```

Seeded fixtures through the API (Task 0.2; `pendingRideDistance` with real rides in both units,
both note link variants):

```
-- S1 qa-metric@local.test bikes
   [{"id": "<uuid>", "model": "Ténéré 700", "currentMileage": 1240, "distanceUnit": "km", "isPrimary": false}, {"id": "<uuid>", "model": "Africa Twin", "currentMileage": 38167, "distanceUnit": "km", "isPrimary": true}]
-- S2 pendingRideDistance (expect rideCount 4, distance 1240)
   {"pendingRideDistance": {"rideCount": 4, "distance": 1240}}
-- S3 odometerReadings
   {"odometerReadings": [{"value": 38167, "recordedAt": "2026-09-28T09:00:00+00:00", "source": "manual"}, {"value": 37950, "recordedAt": "2026-08-26T10:00:00+00:00", "source": "manual"}]}
-- S4 notes (5, newest first, three link variants)
   [["2026-09-28", 38100, "Rear preload felt soft two-u", null, null, null], ["2026-08-26", 37950, "Pattex Nural 50 held the cra", null, 29.73, "EUR"], ["2026-08-09", 36400, "Front tyre pressure for load", null, null, null], ["2026-07-20", null, "Idea: heated grips before wi", null, null, null], ["2026-07-16", 37300, "Dealer (Motos Ebro) flagged ", "2nd scheduled service", null, null]]
-- S5 myRides totalCount for the bike (expect 9)
   {"myRides": {"totalCount": 9}}
-- S1 qa-imperial@local.test bikes
   [{"id": "<uuid>", "model": "Africa Twin", "currentMileage": 23716, "distanceUnit": "mi", "isPrimary": true}]
-- S2 pendingRideDistance (expect rideCount 4, distance 1240)
   {"pendingRideDistance": {"rideCount": 4, "distance": 1240}}
-- S3 odometerReadings
   {"odometerReadings": [{"value": 23716, "recordedAt": "2026-09-28T09:00:00+00:00", "source": "manual"}, {"value": 23581, "recordedAt": "2026-08-26T10:00:00+00:00", "source": "manual"}]}
-- S4 notes (5, newest first, three link variants)
   [["2026-09-28", 23674, "Rear preload felt soft two-u", null, null, null], ["2026-08-26", 23581, "Pattex Nural 50 held the cra", null, 29.73, "EUR"], ["2026-08-09", 22618, "Front tyre pressure for load", null, null, null], ["2026-07-20", null, "Idea: heated grips before wi", null, null, null], ["2026-07-16", 23177, "Dealer (Motos Ebro) flagged ", "2nd scheduled service", null, null]]
-- S5 myRides totalCount for the bike (expect 9)
   {"myRides": {"totalCount": 9}}
```

Seed script: ran twice, same ids and same row counts (6 tasks, 18 expenses, 5 notes, 4 documents,
9 rides, 2 readings per populated bike); refuses a non-local URL
(`Refusing to seed: SUPABASE_URL must be a 127.0.0.1 / localhost URL`); 2026 total 1,960.62,
2025 to Oct 2 1,748.62.

## Still unverified

- Everything above is against the scratch database. Production is known to differ from it in 17
  unrelated places; whether it differs on something this phase depends on (e.g. column grants on
  `motorcycles`, the body of `set_mileage_updated_at`, policies on `maintenance_tasks` /
  `expenses`) cannot be told from the types file. Run before pushing, read-only, on production:
  ```sql
  SELECT 1 FROM information_schema.table_privileges WHERE table_schema='public' AND table_name='motorcycles' AND grantee='authenticated' AND privilege_type='SELECT';
  SELECT pg_get_functiondef('public.set_mileage_updated_at()'::regprocedure);   -- must match 00028
  SELECT polname, pg_get_expr(polqual, polrelid) FROM pg_policy WHERE polrelid IN ('public.maintenance_tasks'::regclass, 'public.expenses'::regclass, 'public.motorcycles'::regclass);
  SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='motorcycles' AND column_name='current_mileage';   -- 0 locally
  ```
- The 00180 and 00181 backfills ran here against three bikes, not against production data volume.
- Receipt-scan apply/revert was not exercised end to end (needs the AI scan); it writes
  `current_mileage` through the same `UPDATE` path that P181.4 covers.
- `complete_onboarding` (the second bike-insert path) was not called; it inserts without
  `distance_unit`, which is the case P180.2 covers.
- Photo upload to storage (the object itself) — `addNotePhoto` was tested with link rows only.
- Nothing was verified on a device.
