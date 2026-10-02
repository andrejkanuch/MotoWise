# Feature: Bike detail redesign — Phase 1 "Shell + Overview"

Branch `feat/bike-detail-shell-overview`. Plan written 2026-10-02 against `3626a4d6`.

"Phase N" below means a phase of **this plan** (run with `/phase-start N bike-detail-shell-overview`).
The six phases of the whole redesign are written **R1–R6** (this plan is R1).

## Context

- **Goal:** replace the one-ScrollView bike detail (`app/(tabs)/(garage)/bike/[id].tsx`, 893 lines, 13 blocks) with a persistent header + four segments, build the Overview segment, the Log / Odometer / Note sheets and the Notes screen, and add the three data prerequisites (`motorcycles.distance_unit`, `odometer_readings`, `notes`). Service / Costs / Bike segments render today's components unchanged until R2–R5.
- **Source of truth:** `docs/design/app-screens/05-garage/02-bike-detail/redesign/DESIGN-SPEC.md` + `screens/{Main,OverviewScrolled,OverviewEmpty,LogSheet,OdometerSheet,NoteSheet,Notes,Components}.dc.html`. Lead decisions D1–D4 in `redesign/PROGRESS.md` are settled.

### Facts verified in code (do not re-derive)

| Topic | Fact | Where |
|---|---|---|
| Table names | `motorcycles`, `maintenance_tasks`, `expenses`, `documents` (+ `document_files`, `document_categories`), `rides`, `maintenance_task_photos`, `expense_photos`. No `notes`, `odometer_readings`, `recall_*` or `expense_categories` table exists. | `packages/types/src/database.types.ts` |
| Odometer | `motorcycles.current_mileage` int, RAW in the owner's unit. Companion columns: `mileage_updated_at`, `odometer_sync_source` (`manual`/`gps_ride`), `odometer_last_ride_id`. A BEFORE trigger `trg_set_mileage_updated_at` already exists. | 00028, 00078 |
| Odometer writers | Three: `motorcycles.service.update` (manual), `rides.service.endRide` (auto-adds GPS distance, claim-first on `rides.mileage_applied`), `receipt-scan.service` (apply + guarded revert). Completing a task does **not** write the odometer. | `apps/api/src/modules/{motorcycles,rides,receipt-scan}` |
| Unit today | Label derives from `users.measurement_system` (`metric`/`imperial`) via `useMileageUnit()` (mobile) and `mileageUnitLabel()` (API). **`motorcycles.mileage_unit` already exists** (00005, `DEFAULT 'mi'`, deprecated, unreliable — never read it). | `hooks/use-mileage-unit.ts`, `validators/motorcycle.ts` |
| km→unit conversion sites (API) | `rides.service.ts:534-548` (metres → unit), `oem-schedules.service.ts:210-240`, `maintenance-tasks.service.ts:470-490` (OEM `interval_km`), `receipt-scan.service.ts:720-760`. All read `users.measurement_system`. | — |
| Recalls | **No cached list.** `motorcycleRecalls(motorcycleId)` calls NHTSA on demand (24 h in-memory server cache) and persists only `recall_count` + `recall_last_checked_at` on the bike. NHTSA is US data. | `motorcycles.service.ts:223-262`, `nhtsa.service.ts:101` |
| Documents | `documents(motorcycleId)` returns `categoryId`, `title`, `expiryDate`, `isPinned`. Category name comes from `documentCategories` (`kind` `seeded`/`custom`). Seeded names: Insurance, Registration, Title/Ownership, Inspection, Service Records, Manual, Warranty, Receipts. `NEAR_EXPIRY_BADGE_DAYS = 30`. | `constants/document-limits.ts`, `lib/document-expiry.ts` |
| Rides | `myRides(first, motorcycleId).totalCount` gives the ride count. Ride distance is auto-applied to the odometer at `endRide`; rides with `mileage_applied = false` are the exception. | `rides.service.ts:505-560` |
| Expenses | `expenses(motorcycleId, year)` returns **every** expense of that year with `date`, grouped by category, unpaginated (`year: 0` = all time). `expenseDashboard` has `currentYearTotal`, `previousYearTotal` (full year) and only the latest 12 monthly buckets — it cannot give "same period last year". | `expenses.service.ts:99-156`, audit §3.3 |
| Photos | Public bucket `maintenance-photos`, storage policy = first path folder is `auth.uid()`. `expense_photos` (00076) reuses it under `{userId}/expenses/{expenseId}/…` with a link table + `addExpensePhoto` mutation + request-scoped DataLoader. | 00022, 00076, `expense-photos.loader.ts` |
| Soft delete | `soft_delete_<table>(<table>_id uuid) RETURNS boolean`, SECURITY DEFINER, `SET search_path = ''`, `REVOKE … FROM PUBLIC, anon` + `GRANT … TO authenticated` in the same transaction. Template: 00176. | `supabase/migrations/00176_…` |
| Persistence | Zustand `persist` + `createZustandMMKVStorage(id)`. Precedent: `stores/whats-new.store.ts`. | `lib/mmkv-storage.ts` |
| i18n | `t()` everywhere; `en.json` is the source; **13 locale files** (`en es de fr it pt-BR ja hi th id tr pl sk`). The ratchet (`pnpm check:i18n`, pre-push + CI, not part of `pnpm precheck`) fails on any new `en.json` key missing from any of the other 12, and on new hard-coded JSX text in changed files. | `scripts/check-i18n.sh`, `scripts/check-i18n-new-keys.ts` |
| Colours | `check:mobile-colors` fails on any added line under `apps/mobile/src` containing `#hex`, `rgb(`, `rgba(`, `hsl(`. Of the spec colours only `#141210` (`surfaceDark`), `#1E1C19` (`cardDark`), `#D4622E` (`signature500`) and `#5B8DEF` (`trustBlue`) exist in `palette`. | `scripts/check-no-hardcoded-mobile-colors.sh`, `palette.ts` |
| Fonts | Only `InstrumentSerif-Regular` / `-Italic` are registered (`app/_layout.tsx:445-448`). `GeistMono*` and `PlusJakartaSans*` family names are used in ~130 places but **never loaded** — they render in the system font today. | `app/_layout.tsx`, `package.json` |
| Analytics on today's screen | `GARAGE_BIKE_REMOVED`, `MAINTENANCE_TASK_DELETED`, `RECALLS_CHECKED`, `OEM_SCHEDULE_IMPORTED`, `HEALTH_REPORT_VIEWED` (`[id].tsx`), `DOCUMENTS_SECTION_VIEWED`, `DOCUMENT_DELETED` (`documents-section.tsx`), receipt-scan entry events with `SCAN_ENTRY_SURFACE.BIKE_HUB`. | grep of `AnalyticsEvent.` |
| Entry points | Garage list ×2 (`push`), Home hero + task cards ×4 (`navigate` + `_ts`, two with `highlightTask`), Profile account section (`push`), notification (`push`, id only), What's New. | audit §2.3 |
| Tabs | JS `Tabs` from expo-router (not NativeTabs); the tab bar stays visible on pushed garage screens. | `app/(tabs)/_layout.tsx` |
| Local stack | `apps/mobile/.env` → API at a LAN address `:4000` (local Nest), Supabase URL = **production project**. `apps/api/.env` `SUPABASE_URL` = **production project**. So "local dev" today is a local API on the production database. Docker is not running and the Supabase CLI is not installed globally (`npx supabase`). `pnpm generate:types` runs `supabase gen types --linked`, i.e. against **production**. | env files, `packages/types/package.json:29` |

### Hard rules for every task

1. No paywall, Pro check or count limit on logging a task, expense, note, odometer reading or document.
2. No hex / `rgb(a)` / `hsl(a)` literal in `apps/mobile/src`. Colours come from `palette` (via the hub token module, Task 3.1); alpha via `withAlpha()` from `@motovault/design-system`.
3. No `any` on GraphQL data. Types come from `@motovault/graphql` (`type Note = NotesByMotorcycleQuery['notes'][number]`).
4. `as const` objects, never `enum`. No magic strings: segment ids, origins, sources, sort keys, route params are typed constants.
5. Dispatch tables and guard clauses, not if/else chains (priority → tag style, status → card style, segment → action).
6. Inline styles; `borderCurve: 'continuous'` on every rounded element; Reanimated v4 only, under 300 ms; haptics on iOS for interactive moments.
7. Touch targets ≥ 44 pt (48 dp on Android), `hitSlop` on small chips; `accessibilityLabel` on every icon-only control; `accessibilityRole` on buttons, tabs, switches.
8. A task row is a `View` with sibling `Pressable`s plus `accessibilityActions`. Never a pressable inside a pressable.
9. Every list has empty, loading and error states. Loading and not-found states of the screen keep the header with a working back button.
10. Date math through `date-fns`. `process.env.EXPO_OS`, not `Platform.OS`. `lucide-react-native` icons.
11. All copy through `t()` with keys under `bikeHub.*` in `en.json` **and the other 12 locale files** (translated, not English copies).
12. Navigation: route literals or `Href`; no `as any` / `as never` on router calls (`check:router`).
13. API: thin resolvers, logic in services, `SUPABASE_USER` client for all user-scoped CRUD, snake_case → camelCase mapped in the service, Zod schema + inferred type exported together, `PG_ERROR.*` constants (`check:api-bans`), new module registered in `AppModule`.
14. Do not edit `packages/graphql/src/generated/**` or hand-edit `database.types.ts`.
15. Do not push migrations to production and do not run plain `pnpm generate` before the owner pushes them (see Phase 0).
16. Existing analytics events keep their names and properties.

### Out of scope (R2–R6 — do not build)

- **R2 Service segment:** Active/History redesign, Overdue / Due soon / Later groups, sort control, "My order" + `manual_position`, swipe actions, instant mark-done + "Done · Add details · Undo", multi-select, bulk complete, PDF export. `TaskRow` with the mark-done circle is not built in R1.
- **R3 Task flows:** `TaskDetail`, `AddTask`, `EditTask`, `CompleteTask`, `LogPastWork`, `JobDetail`, `LinkJob` (so the NoteSheet "Link a job or expense" chip is not rendered).
- **R4 Costs:** Costs segment, year chips, TCO, category/month drill-downs, `AddExpense` / `ExpenseDetail` / `EditExpense`, scan-in-form, manage categories, `expense_categories.*`, `expenses.odometer/litres/shop/linked_task_id`, new category colours.
- **R5 Bike segment + recalls:** `Bike`, `BikeDetails`, `EditBike` (incl. the unit control), `Recalls` screen, `recall_acknowledgements`, `document_categories.blocks_riding`, `DocumentDetail`, `AddDocument`, `DeleteBike`, `ImportSchedule`.
- **R6 Cleanup + Home card:** deleting `bike-stats-row`, `mileage-display`, `bike-quick-actions`, `health-report` screen, `expense-dashboard`; `HomeCard`; dropping `motorcycles.mileage_unit`; moving the remaining label-only screens from `useMileageUnit()` to the bike's unit.
- Also out: "due soon at your pace" (only the log it needs is created), odometer history UI, recognition of part numbers / pressures / phone numbers in notes, light-theme design, web.

---

## Phase 0: Local verification environment (no app code)

The new tables and column do not exist in production, and both the local API and `pnpm generate:types` point at production. Nothing in Phases 1–7 can be verified on a device until one of the two routes below is in place.

- [ ] Task 0.1: Bring up a local Supabase stack and prove the migration chain applies
  - Files: none committed. Local-only edits to `apps/api/.env` and `apps/mobile/.env` (both gitignored) — record the original values and restore them at the end of the phase work.
  - Steps:
    1. Start Docker Desktop. `npx supabase start` from the repo root — the **full** stack, not `pnpm db:start` (that excludes `storage-api`, which bike and note photos need).
    2. `npx supabase db reset` — applies `00001…00179` + `seed.sql`.
    3. `npx supabase status` → put the local API URL, anon key, service-role key and JWT secret into `apps/api/.env`; put the URL (simulator: `http://127.0.0.1:54321`; Android emulator: `http://10.0.2.2:54321`; a physical device: the Mac's LAN IP) and anon key into `apps/mobile/.env`, and set `EXPO_PUBLIC_API_URL` to the local API (`http://127.0.0.1:4000/graphql` on the simulator).
    4. Create a confirmed local user through the Auth admin API (`scripts/run-onboarding-e2e.sh` already does this and honours `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` overrides). Sign in with email + password — Google and Apple sign-in do not work against the local stack.
    5. `pnpm dev`, open the dev client, add a bike.
  - Acceptance:
    - `MANUAL` `npx supabase db reset` finishes without error on `00001–00179`. **If it does not** (production and the migration folder have diverged before — see `00178`), stop and report to the lead: do not patch old migrations. Fallback route: the owner pushes the three additive migrations of Phase 1 to production ahead of the PR (they are additive; see the risk note in Task 1.2), and the device work then runs against today's setup.
    - `DEVICE` Signed in on the simulator against the local stack; Garage list shows the test bike.
  - Requirement: lead brief "say plainly how mobile work is verified locally before the push".

- [ ] Task 0.2: Seed the two QA bikes locally
  - Files: `scripts/seed-bike-hub-fixtures.ts` (new, dev-only, takes `--user <id>` and refuses to run unless `SUPABASE_URL` is a `127.0.0.1` / `localhost` URL)
  - Details: bike A "Africa Twin" (2022 Honda, primary, km, odometer 38,167, purchase 2022-06 €11,800) with the tasks, documents, expenses and rides of the Fixtures section; bike B "Ténéré 700" (2024 Yamaha, odometer 1,240, purchase price €10,400, **all auto-populated OEM tasks deleted**, no documents, no expenses); bike C = a copy of A for a second user whose `measurement_system` is `imperial` (miles states).
  - Acceptance:
    - `MANUAL` Running the script twice leaves one copy of each bike (idempotent on a fixed id set).
    - `TEST` none (dev tooling).

## Phase 0 Checkpoint
- `MANUAL` The lead records in `PROGRESS.md` which route is in use: **local stack** or **owner pre-pushed migrations**.
- `MANUAL` `apps/api/.env` and `apps/mobile/.env` are not staged (`git status` clean of them).

---

## Phase 1: Data — migrations and types

Order inside every data slice: migration → types (`--local`) → Zod → (Phase 2) Nest → `.graphql` → codegen.

**Type generation before the push.** `pnpm generate:types` and therefore `pnpm generate` read the **linked production** schema; running either before the owner pushes would delete the new tables from `database.types.ts`. Until the push, regenerate with:
`npx supabase gen types typescript --local --schema public,graphql_public > packages/types/src/database.types.ts`
and review the diff: it must contain only the objects added in this phase. Unrelated noise means local and production schemas differ — stop and report. After the owner pushes, run `pnpm generate:types` once and confirm a zero diff.

- [ ] Task 1.1: Migration `00180_motorcycles_distance_unit.sql`
  - Files: `supabase/migrations/00180_motorcycles_distance_unit.sql`
  - Details (D1 — label only, nothing is converted):
    - `ALTER TABLE public.motorcycles ADD COLUMN distance_unit text` (nullable for the backfill).
    - Backfill from the owner's **current** measurement system, not from the stale `mileage_unit`:
      `UPDATE public.motorcycles m SET distance_unit = CASE WHEN u.measurement_system = 'imperial' THEN 'mi' ELSE 'km' END FROM public.users u WHERE u.id = m.user_id;` then `UPDATE … SET distance_unit = 'km' WHERE distance_unit IS NULL;` (orphans). Soft-deleted bikes are backfilled too.
    - `ALTER COLUMN distance_unit SET NOT NULL`, `ADD CONSTRAINT chk_motorcycles_distance_unit CHECK (distance_unit IN ('km','mi'))`.
    - `BEFORE INSERT` trigger `trg_motorcycles_default_distance_unit`: when `NEW.distance_unit IS NULL`, set it from the owner's `measurement_system` (`'km'` when the user row is missing). This covers both insert paths — `motorcycles.service.create` and the `complete_onboarding` RPC — without re-creating that RPC. Function: `SECURITY DEFINER`, `SET search_path = ''`, schema-qualified, `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated` (it is trigger-only).
    - **Interim sync (remove in R5):** `AFTER UPDATE OF measurement_system ON public.users` trigger that sets `distance_unit` on all of that user's bikes to match. Reason: until R5 ships the Edit-bike unit control and R6 moves the remaining screens off `useMileageUnit()`, the four API conversion sites and ~10 mobile screens still read the profile unit. Keeping `bike.distance_unit == profile unit` preserves today's behaviour exactly (a global, label-only toggle) and makes a mixed-unit bike impossible in R1–R4. Comment the trigger `-- INTERIM (bike-detail redesign R1): drop in the R5 migration that adds the Edit-bike unit control.` See Open question 3.
    - `mileage_unit` is left untouched (dropped in R6). `COMMENT ON COLUMN` for `distance_unit` states "label only; `current_mileage`, `target_mileage`, `completed_mileage` and user `interval_km` are raw values in this unit".
  - Acceptance:
    - `MANUAL` On the local stack after `db reset`: `SELECT count(*) FROM motorcycles WHERE distance_unit IS NULL` = 0; a bike inserted without the column for an imperial user gets `'mi'`; flipping that user's `measurement_system` flips the bike's `distance_unit`; `current_mileage` is byte-identical before and after (no conversion).
    - `MANUAL` `\dp public.motorcycles` checked for column-level grants. A code comment (`motorcycles.service.ts:247`) says `recall_*` columns sit outside the user UPDATE grants, but no such `GRANT` is in `supabase/migrations/`. If column grants exist, the migration adds `GRANT SELECT (distance_unit)` (and no UPDATE grant in R1); if they do not, nothing to add. Record the finding in the migration header.
  - Requirement: spec §3 `motorcycles.distance_unit`; D1.

- [ ] Task 1.2: Migration `00181_odometer_readings.sql`
  - Files: `supabase/migrations/00181_odometer_readings.sql`
  - Details:
    - Table `public.odometer_readings`: `id uuid pk default gen_random_uuid()`, `user_id uuid not null references auth.users(id) on delete cascade`, `motorcycle_id uuid not null references public.motorcycles(id) on delete cascade`, `value integer not null check (value >= 0)`, `recorded_at timestamptz not null`, `source text not null check (source in ('manual','gps_ride','initial','backfill'))`, `ride_id uuid null references public.rides(id) on delete set null`, `created_at timestamptz not null default now()`. Append-only in R1: no `deleted_at`, no UPDATE/DELETE policy. Spec names `at` → `recorded_at` (`at` reads badly in SQL and GraphQL).
    - Index `(motorcycle_id, recorded_at desc)`.
    - RLS on. `SELECT` and `INSERT` policies `TO authenticated`: `(SELECT auth.uid()) = user_id`; the INSERT `WITH CHECK` also requires `EXISTS (SELECT 1 FROM public.motorcycles m WHERE m.id = motorcycle_id AND m.user_id = (SELECT auth.uid()) AND m.deleted_at IS NULL)`.
    - Function `public.log_odometer_reading(p_motorcycle_id uuid, p_value integer, p_recorded_at timestamptz) RETURNS uuid` — `SECURITY INVOKER` (RLS stays in force), `SET search_path = ''`. In one transaction: reject `auth.uid() IS NULL`, a future `p_recorded_at` (> now() + 5 min) and a bike the caller does not own; insert the reading with `source = 'manual'`; **if no reading with a later `recorded_at` exists**, `PERFORM set_config('app.odometer_logged','1', true)` and update `motorcycles` (`current_mileage`, `mileage_updated_at = p_recorded_at`, `odometer_sync_source = 'manual'`, `odometer_last_ride_id = NULL`). A back-dated reading older than the latest one is logged but does not move `current_mileage`. `REVOKE EXECUTE … FROM PUBLIC, anon; GRANT EXECUTE … TO authenticated` in the same transaction.
    - Trigger `trg_motorcycles_log_odometer` `AFTER INSERT OR UPDATE OF current_mileage ON public.motorcycles`, row-level, `WHEN (NEW.current_mileage IS NOT NULL)`: skip when `current_setting('app.odometer_logged', true) = '1'` or (on UPDATE) the value did not change; otherwise insert a reading (`value = NEW.current_mileage`, `recorded_at = now()`, `source = NEW.odometer_sync_source` on UPDATE / `'initial'` on INSERT, `ride_id = NEW.odometer_last_ride_id`, `user_id = NEW.user_id`). This captures the ride sync, the receipt-scan apply/revert and the legacy `updateMotorcycle(currentMileage)` path (older app builds keep using it) **without touching those services**. Trigger function `SECURITY DEFINER` + `SET search_path = ''` (the receipt-scan revert and any service-role write must log too), `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated`.
    - Check how `trg_set_mileage_updated_at` (00028) treats an explicit `mileage_updated_at` in the same UPDATE; if it overwrites it with `now()`, the RPC's back-dated stamp is lost — then adjust that function in this migration so an explicitly changed `mileage_updated_at` wins, and say so in the header.
    - Backfill: one row per bike with `current_mileage IS NOT NULL`: `recorded_at = COALESCE(mileage_updated_at, created_at)`, `source = 'backfill'`. This is what makes "was 38,167 · since Sep 28" true on day one.
  - Risk note (for the owner's push decision): the table and RPC are additive; the trigger runs inside every production odometer write from the moment it is applied. A failing trigger would fail ride end and receipt-scan saves, so the trigger body wraps the insert in `BEGIN … EXCEPTION WHEN OTHERS THEN RAISE WARNING … END` — a lost log row is acceptable, a failed ride end is not.
  - Acceptance:
    - `MANUAL` Local stack: `log_odometer_reading` today → 1 row, bike updated, no duplicate from the trigger; back-dated older than latest → 1 row, bike unchanged; `UPDATE motorcycles SET current_mileage = …` as the user → 1 row with `source = 'manual'`; as `anon` the RPC is not executable (`SET LOCAL role anon` probe, as in 00176).
    - `MANUAL` Ending a ride on the local stack adds a `gps_ride` row with `ride_id` set.
  - Requirement: spec §3 `odometer_readings`.

- [ ] Task 1.3: Migration `00182_notes.sql`
  - Files: `supabase/migrations/00182_notes.sql`
  - Details:
    - Table `public.notes`: `id`, `user_id` (→ `auth.users`, cascade), `motorcycle_id` (→ `motorcycles`, cascade), `body text not null check (char_length(btrim(body)) between 1 and 4000)`, `odometer integer null check (odometer >= 0)`, `linked_task_id uuid null references public.maintenance_tasks(id) on delete set null`, `linked_expense_id uuid null references public.expenses(id) on delete set null`, `created_at`, `updated_at`, `deleted_at`. Spec `text` → column `body` (GraphQL field stays `text`). The two `linked_*` columns are created now (D3); only `linked_task_id` is written in R1 (by "make it a task").
    - Spec `photo_ids[]` is implemented as the repo's link-table pattern, not an array column: table `public.note_photos` mirroring `expense_photos` (00076) — `id`, `note_id` (→ `notes`, cascade), `user_id`, `storage_path text not null`, `file_size_bytes int`, `mime_type text not null default 'image/webp'`, `created_at`. Files go to the existing public `maintenance-photos` bucket under `{userId}/notes/{noteId}/{timestamp}.webp`; the bucket's policy (first folder = uid) already allows it, so **no new bucket and no storage policy**. Reason for the table over an array: every other photo attachment in the app is a link table with a DataLoader and a cascade; an array of ids would need a second lookup table anyway.
    - Indexes: `notes (motorcycle_id, created_at desc) WHERE deleted_at IS NULL`, `notes (user_id)`, `note_photos (note_id)`, `note_photos (user_id)`.
    - RLS on both. `notes`: SELECT `(SELECT auth.uid()) = user_id AND deleted_at IS NULL`; INSERT `WITH CHECK` own + bike owned and not deleted + (`linked_task_id IS NULL` or the task is the caller's) + (`linked_expense_id IS NULL` or the expense is the caller's); UPDATE `USING` own, `WITH CHECK` own + the same link ownership checks; **no DELETE policy**. `note_photos`: `FOR ALL` own (as 00076).
    - `set_updated_at` BEFORE UPDATE trigger (existing function from 00013).
    - `public.soft_delete_note(note_id uuid) RETURNS boolean` copied from the 00176 shape: SECURITY DEFINER, `SET search_path = ''`, `auth.uid()` null → false, update where `id`, `user_id`, `deleted_at IS NULL`, idempotent `true` for an already-deleted own row; `REVOKE EXECUTE … FROM PUBLIC, anon; GRANT EXECUTE … TO authenticated;` in the same `BEGIN … COMMIT`.
    - Check whether the hard-delete cron (00035) enumerates tables; if it does, add `notes` there or note in the header why not.
  - Acceptance:
    - `MANUAL` Local stack as user A: insert, select, update own note; user B cannot select or update it; inserting a note on B's bike or linking B's task is rejected with 42501; `soft_delete_note` returns `true` twice for an own note and `false` for B's note; after it the note is absent from `SELECT`.
    - `MANUAL` `anon` cannot execute `soft_delete_note`.
  - Requirement: spec §3 `notes`.

- [ ] Task 1.4: Types and Zod
  - Files: `packages/types/src/database.types.ts` (generated with `--local`, see above), `packages/types/src/constants/enums.ts` (add `DistanceUnit` alias note + `OdometerReadingSource` as const), `packages/types/src/constants/limits.ts` (`NOTE_TEXT_MAX = 4000`, `NOTE_PHOTOS_MAX = 3`, `ODOMETER_MAX = 9_999_999`), `packages/types/src/validators/note.ts` (new: `CreateNoteSchema`, `UpdateNoteSchema`, `AddNotePhotoSchema` + inferred types), `packages/types/src/validators/odometer.ts` (new: `LogOdometerReadingSchema`), `packages/types/src/validators/index.ts`, tests in `packages/types/src/validators/__tests__/`
  - Details: reuse the existing `MileageUnit` const (`'mi'|'km'`) as the type of `distance_unit` — do not create a second unit enum. `CreateNoteSchema`: `motorcycleId` uuid, `text` trimmed 1–4000, `odometer` int ≥ 0 optional, `alsoCreateTask` boolean optional. `LogOdometerReadingSchema`: `motorcycleId` uuid, `value` int 0–`ODOMETER_MAX`, `recordedAt` ISO datetime optional. `MotorcycleSchema`/`UpdateMotorcycleSchema` are **not** given a writable `distanceUnit` in R1 (the control is R5).
  - Acceptance:
    - `TEST` `pnpm --filter @motovault/types test`: note text empty / whitespace-only / 4001 chars rejected; odometer negative, fractional and > max rejected; valid inputs parse.
    - `TYPE` `pnpm typecheck` green; `Database['public']['Tables']['notes' | 'note_photos' | 'odometer_readings']` and `motorcycles.Row.distance_unit` exist.

## Phase 1 Checkpoint
- `GATE` `pnpm precheck` (subject to Open question 1: the untracked `outputs/play-release-3.20.0/release-notes-3.20.0.json` fails Biome; until it is resolved the gate is "every `check:*` + `biome check` on everything else + typecheck + test").
- `MANUAL` The `database.types.ts` diff contains only: `notes`, `note_photos`, `odometer_readings`, `motorcycles.distance_unit`, `log_odometer_reading`, `soft_delete_note`.
- `MANUAL` Nothing pushed to production (`PROGRESS.md` "Migration pushed" stays `no`).

---

## Phase 2: API slices and GraphQL documents

Before the push, regenerate with `pnpm --filter @motovault/api generate:schema && pnpm --filter @motovault/graphql generate:graphql` — **not** `pnpm generate`.

- [ ] Task 2.1: `distanceUnit` on `Motorcycle`
  - Files: `apps/api/src/modules/motorcycles/motorcycles.service.ts` (`MOTORCYCLE_SELECT`, `mapRow`), `models/motorcycle.model.ts` (`distanceUnit: string`, non-null; mark `mileageUnit` `deprecationReason`), `motorcycles.service.spec.ts`, `apps/mobile/src/graphql/queries/my-motorcycles.graphql`, `apps/mobile/src/graphql/mutations/update-motorcycle.graphql`, any `apps/web` `.graphql` document selecting motorcycles only if codegen requires it
  - Details: read-only field. `MOTORCYCLE_SELECT` is used by `myMotorcycles` for every user — see the deploy-order rule in Phase 7.
  - Acceptance:
    - `TEST` service spec: row with `distance_unit: 'mi'` maps to `distanceUnit: 'mi'`.
    - `TYPE` `MyMotorcyclesQuery['myMotorcycles'][number]['distanceUnit']` is `string` after codegen.

- [ ] Task 2.2: Odometer slice
  - Files: new `apps/api/src/modules/odometer/` (`odometer.module.ts`, `odometer.resolver.ts`, `odometer.service.ts`, `dto/log-odometer-reading.input.ts`, `models/odometer-reading.model.ts`, `models/pending-ride-distance.model.ts`, `odometer.service.spec.ts`), `apps/api/src/app.module.ts`, `apps/mobile/src/graphql/queries/odometer-readings.graphql`, `…/queries/pending-ride-distance.graphql`, `…/mutations/log-odometer-reading.graphql`, `apps/mobile/src/lib/query-keys.ts` (`odometer.readings(id)`, `odometer.pendingRides(id)`)
  - Details:
    - `odometerReadings(motorcycleId: String!, limit: Int = 20): [OdometerReading!]!` newest first (`id`, `value`, `recordedAt`, `source`, `rideId`).
    - `pendingRideDistance(motorcycleId: String!): PendingRideDistance!` → `{ rideCount: Int!, distance: Int! }`: completed rides of that bike with `mileage_applied = false`, `distance_m > 0` and `ended_at` after the latest reading's `recorded_at`; `distance` = `Math.round(metersToUnit(sum, bike.distance_unit))`. Zero when there are none.
    - `logOdometerReading(input): Motorcycle!` → `supabase.rpc('log_odometer_reading', …)` on the **user** client, then returns the bike through `MotorcyclesService`. A lower-than-current value is accepted (the client asks first; a rider must be able to correct a typo).
    - Do not change `rides.service`, `receipt-scan.service` or `motorcycles.service.update` — the 00181 trigger logs their writes.
  - Acceptance:
    - `TEST` service spec (mocked client): RPC called with the mapped args; RPC error → `BadRequestException`; `pendingRideDistance` converts metres with the bike's unit (1,995,582 m → 1,240 mi for `mi`; 1,240,000 m → 1,240 km for `km`) and ignores rides ended before the latest reading.
    - `TEST` Zod pipe rejects a future `recordedAt` beyond tolerance and a negative value.
    - `MANUAL` Local stack, GraphQL playground: mutation returns the bike with the new `currentMileage`; `odometerReadings` lists it first.

- [ ] Task 2.3: Notes slice
  - Files: new `apps/api/src/modules/notes/` (`notes.module.ts`, `notes.resolver.ts`, `notes.service.ts`, `note-photos.loader.ts`, `note-task-title.ts`, `dto/{create-note,update-note,add-note-photo}.input.ts`, `models/{note,note-photo}.model.ts`, specs), `apps/api/src/app.module.ts`, `apps/mobile/src/graphql/queries/notes-by-motorcycle.graphql`, `…/mutations/{create-note,update-note,delete-note,create-task-from-note,add-note-photo,delete-note-photo}.graphql`, `apps/mobile/src/lib/query-keys.ts` (`notes.byMotorcycle(id)`)
  - Details:
    - `notes(motorcycleId: String!): [Note!]!` newest first, unpaginated (personal notes; revisit with a Relay connection if a bike passes ~200). `Note`: `id`, `motorcycleId`, `text`, `odometer`, `createdAt`, `updatedAt`, `linkedTaskId`, `linkedTaskTitle`, `linkedExpenseId`, `linkedExpenseAmount`, `linkedExpenseCurrency` (PostgREST embeds `maintenance_tasks(title)` / `expenses(amount,currency)` in the one select — no N+1), `photos: [NotePhoto!]!` via a request-scoped `NotePhotosLoader` (copy `expense-photos.loader.ts`; resolver marked `Scope.REQUEST`).
    - `createNote(input)`: insert through the user client. When `alsoCreateTask`, call `MaintenanceTasksService.create` (priority `low`, no due date, no target mileage, `notes` = full note text, title from `deriveTaskTitleFromNote`) and store its id in `linked_task_id`. `deriveTaskTitleFromNote` (pure, in `note-task-title.ts`): first line, cut at the first sentence end or dash, trimmed, max 60 chars with an ellipsis.
    - `updateNote(id, input)` (text, odometer), `deleteNote(id): Boolean!` → `rpc('soft_delete_note')` on the user client; `false` → `NotFoundException`.
    - `createTaskFromNote(noteId): Note!` — same task creation for an existing note without a linked task (the "Make it a task" link on the Notes screen). Idempotent: a note that already has a live linked task returns unchanged.
    - `addNotePhoto(noteId, storagePath, fileSizeBytes)`: path must start with `${userId}/notes/${noteId}/` (reject otherwise, as `maintenance-task-photos.service.ts:61`), max `NOTE_PHOTOS_MAX`. `deleteNotePhoto(photoId)` removes the row and the storage object. `publicUrl` computed in the service like task photos.
    - No entitlement check anywhere in this module.
  - Acceptance:
    - `TEST` service spec: create maps camelCase → snake_case; `alsoCreateTask` creates one low-priority undated task and links it; `deleteNote` with RPC `false` → NotFound, RPC `true` twice → `true` twice; `addNotePhoto` rejects a path outside the prefix and a 4th photo; `deriveTaskTitleFromNote` cases incl. the fixture ("Rear preload felt soft two-up on the Pyrenees run — check sag before the next trip." → "Rear preload felt soft two-up on the Pyrenees run").
    - `TEST` `controller-auth-inventory.spec.ts` and the resolver spec still pass (no `@Public()` added).
    - `TYPE` `NotesByMotorcycleQuery` generated; no `any`.
    - `MANUAL` Local stack: create → list → update → delete → list round-trip in the playground as two different users (B never sees A's note).

## Phase 2 Checkpoint
- `GATE` `pnpm precheck` (same caveat as Phase 1).
- `MANUAL` `apps/api/schema.graphql` diff contains only the additions of 2.1–2.3; `packages/graphql/src/generated` regenerated, not hand-edited.
- `MANUAL` `pnpm check:api-bans` clean (no raw `'PGRST116'` / `'23505'`).

---

## Phase 3: Foundations — tokens, fonts, copy, pure logic

- [ ] Task 3.1: Palette tokens and the hub token module
  - Files: `packages/design-system/src/palette.ts`, `apps/mobile/src/components/bike-hub/ui/tokens.ts` (new)
  - Details — add under a `// ── Bike hub redesign ──` block (names are binding so later phases reuse them):

    | Token | Hex | Use |
    |---|---|---|
    | `hubRaised` | `#2A2724` | raised surface, selected segment, secondary button, keypad key, icon tile |
    | `hubOption` | `#26231F` | Log sheet option row |
    | `hubTrack` | `#4A4640` | sheet grabber, switch off, "other" share of the category bar |
    | `hubText` | `#F3EEE6` | text |
    | `hubTextSoft` | `#E6E0D6` | note body |
    | `hubDim` | `#B5ADA2` | secondary text |
    | `hubMuted` | `#9C958A` | eyebrows, meta, chevrons |
    | `hubInk` | `#1A1410` | ink on copper |
    | `hubCopperText` | `#E07A48` | copper text actions, active chip border (with alpha) |
    | `hubLate` | `#FF7A6B` | past due, CRIT tag text |
    | `hubSoon` | `#F0A050` | due soon, HIGH tag text |
    | `hubMedium` | `#7DA9F0` | MED tag text |
    | `hubLow` | `#A39B8F` | LOW tag text |
    | `hubOk` | `#5FC8A0` | ready / ok |
    | `hubNotReadyDot` | `#FF5A4A` | "Not ready" dot |
    | `hubTagCritBg` / `hubTagHighBg` / `hubTagMedBg` / `hubTagLowBg` | `#3A1A16` / `#3A2412` / `#172538` / `#2A2824` | tag fills, attention icon tiles |
    | `hubCardCheck` | `#241D15` | "Check before riding" card |
    | `hubCardNotReady` | `#2A1512` | "Not ready" card |
    | `hubCardReady` | `#152019` | "Ready to ride" card |
    | `hubRowCritical` | `#241715` | overdue Critical task row (used from R2) |
    | `hubChipOn` | `#2A2017` | selected chip in sheets |
    | `whiteAlpha18` | `rgba(255,255,255,0.18)` | dashed "Add a photo" border |

    Already present and reused: `surfaceDark` (ground), `cardDark` (card), `signature500` (copper), `whiteAlpha06/08/10` (hairlines). Tinted borders (`rgba(240,160,80,.35)`, `rgba(255,122,107,.4)`, `rgba(95,200,160,.3)`, `rgba(224,122,72,.5)`, photo-chip `rgba(20,18,16,.78)`) are produced with `withAlpha(palette.x, a)` — the checker only matches literal `rgba(` text in mobile files.
    `tokens.ts` exports `hub` (semantic names → palette), `HUB_FONT` (see 3.2), `HUB_RADIUS`, `HUB_HEIGHT = { primary: 52, secondary: 48, small: 36 }`, `PRIORITY_TAG: Record<MaintenancePriority, { labelKey, bg, fg }>` and `RIDE_STATUS_STYLE: Record<RideStatus, { card, border, dot }>` as dispatch tables. The eight category colours and `#B9AEF5` are **not** added (R4).
  - Acceptance:
    - `GATE` `pnpm check:mobile-colors` passes; `grep -nE "#[0-9a-fA-F]{3,8}|rgba?\(" apps/mobile/src/components/bike-hub/{ui,overview}` returns nothing.
    - `TEST` `pnpm --filter @motovault/design-system test` (if the package has tests) still green.
    - `TYPE` `PRIORITY_TAG` is exhaustive over `MaintenancePriority` (a missing key fails typecheck).

- [ ] Task 3.2: Register the two missing font families for the hub
  - Files: `apps/mobile/package.json` (`@expo-google-fonts/geist-mono`, `@expo-google-fonts/plus-jakarta-sans` via `npx expo install` run **from `apps/mobile`**), `apps/mobile/src/app/_layout.tsx` (`useFonts` map), `apps/mobile/src/components/bike-hub/ui/tokens.ts` (`HUB_FONT`)
  - Details: register under **new** family keys used only by the hub — `HubMono-Regular`, `HubMono-Medium`, `HubSans-Regular`, `HubSans-Medium`, `HubSans-SemiBold`, `HubSans-Bold` — so the ~130 existing usages of the unregistered names `GeistMono*` / `PlusJakartaSans*` do not change appearance in this PR (Open question 5). JS-loaded fonts ship over OTA; no native change. Look up the current `useFonts` / package export names with Context7 before writing.
  - Acceptance:
    - `DEVICE` Header odometer chip renders in Geist Mono (zero with a slash-less, monospaced figure width: "38,167" and "11,111" are the same width); the bike name renders in Instrument Serif.
    - `DEVICE` A screen outside the hub that uses `fontFamily: 'GeistMono'` (ride summary) looks unchanged.

- [ ] Task 3.3: Copy keys in all 13 locales
  - Files: `apps/mobile/src/i18n/locales/{en,es,de,fr,it,pt-BR,ja,hi,th,id,tr,pl,sk}.json`
  - Details: add the `bikeHub.*` keys for every string in the seven screens (segment names, ride-status titles and reason fragments, attention rows, due-line fragments, costs card, notes, sheets, empty states, accessibility labels, errors, snackbar). Plurals via i18next `_one` / `_other` (and the forms each language needs); interpolate numbers and units (`{{count}}`, `{{distance}}`, `{{unit}}`) — never concatenate. Reuse existing keys where they already exist (`common.cancel`, `tabs.garage`, `documents.title`, `maintenance.modeLog`, `garage.addPhoto`, `recalls.*`). Subsequent tasks add keys as they need them; this task establishes the namespace and the due-line / ride-status vocabulary used by the pure modules.
  - Acceptance:
    - `GATE` `pnpm check:i18n` passes (new keys present in all 12 secondary locales; no new hard-coded JSX text).
    - `TEST` `apps/mobile/src/__tests__/i18n.test.ts` green.
    - `MANUAL` Non-English values are translations, not English copies.

- [ ] Task 3.4: Pure logic modules (the Test writer covers these; fixtures at the end of this plan)
  - Files: `apps/mobile/src/lib/bike-hub/{constants.ts,task-due.ts,ride-status.ts,attention.ts,costs-summary.ts,odometer-input.ts,segments.ts,recall-severity.ts,format.ts}` + `__tests__/`
  - Rules: no React, no i18n, no `Date.now()` inside — every function takes `today: Date` (and the unit) as an argument and returns **data** (kinds + numbers); components turn that into copy with `t()`.
  - Modules:
    - `constants.ts` — `BIKE_SEGMENT = { OVERVIEW, SERVICE, COSTS, BIKE }`, `BIKE_ORIGIN = { GARAGE, HOME, PROFILE }`, `RIDE_STATUS = { NOT_READY, CHECK, READY, UNTRACKED }`, `DUE_STATE = { OVERDUE, SOON, LATER, SOMEDAY }`, `ATTENTION_KIND = { RECALL, TASK, DOCUMENT }`, `DUE_SOON_DAYS = 30`, `DUE_SOON_DISTANCE = { km: 2000, mi: 1200 }`, `ATTENTION_MAX_ROWS = 3`, `RIDE_BLOCKING_DOCUMENT_CATEGORIES = ['Insurance','Inspection','Registration']` (D2; seeded names from `SEEDED_CATEGORIES`, matched only on `kind === 'seeded'`), `ODOMETER_QUICK_ADD = [50, 100, 250]`, `UNDO_WINDOW_MS = 5000`, `RECALL_CRITICAL_KEYWORDS = ['stall','brake','steering','fuel','fire']`. All `as const` with exported value types.
    - `task-due.ts` — `getTaskDue(task, { odometer, today, unit })` → `{ state, primary, secondary, tone }` where a limit is `{ dimension: 'time' | 'distance', direction: 'past' | 'ahead', amount }`. Rules: a task is **overdue** when its date has passed **or** `odometer >= targetMileage`; a passed limit always leads (both passed → date first, distance second, both red); otherwise the closer limit leads, comparing days against distance at the due-soon ratio (`DUE_SOON_DAYS` days ≙ `DUE_SOON_DISTANCE[unit]`), ties to time; `tone` = late when any limit is past, soon when the leading limit is within 30 days or 2,000 km / 1,200 mi, else plain; no date and no target → `SOMEDAY`. Values are never converted — the unit only picks the threshold and the label. Also `compareTasksForAttention` (priority desc, then nearest due).
    - `ride-status.ts` — `getRideStatus({ tasks, documents, categories, recalls, odometer, today, unit })` → `{ status, reasons[] }` implementing spec §2 in this order: open recall → at least CHECK; overdue Critical → NOT_READY; expired document in a blocking category → NOT_READY; overdue High or blocking document expiring within 30 days → CHECK; nothing tracked (no active or completed tasks **and** no documents **and** no recalls) → UNTRACKED; else READY. Overdue Low/Medium never change it. D2: every recall returned counts as open.
    - `attention.ts` — `rankAttention(input)` → `{ items, total, visible, overflow }` with rank recalls (one grouped item) → overdue Critical/High → expiring or expired documents → other overdue → due soon; `visible` = first `ATTENTION_MAX_ROWS`, `overflow` = `{ count, titles[], allOverdue, priorities[] }`. Takes `excludeTaskIds` (the Overview passes the Next-up task — Open question 6). `getNextUp(tasks)` = nearest not-overdue active task. `getServiceBadgeCount(tasks)` = overdue Critical/High only.
    - `costs-summary.ts` — `summariseCosts({ currentYearExpenses, previousYearExpenses, today })` → `{ total, samePeriodLastYear, yoy: { direction, amount, percent } | null, thisMonth, perMonth, monthsCounted, shares[] (top 5 + rest), topCategory: { key, percent } | null }`. "Same period" = previous-year expenses dated on or before the same month-day (Feb 29 clamps to Feb 28). `monthsCounted = max(1, completed calendar months this year)`; `perMonth = total / monthsCounted`. `yoy` is `null` when last year's same-period total is 0.
    - `odometer-input.ts` — `applyKey(digits, key)` (max 7 digits, no leading zero), `applyQuickAdd(current, delta)`, `validateReading({ value, lastValue, recordedAt, lastRecordedAt, today })` → `{ ok } | { needsConfirm: 'LOWER_THAN_LAST' } | { error: 'EMPTY' | 'FUTURE_DATE' | 'UNCHANGED' }`, `describeDelta(value, last)`.
    - `segments.ts` — `resolveInitialSegment({ segmentParam, highlightTask, remembered })` (explicit param → `highlightTask` ⇒ SERVICE → remembered → OVERVIEW; unknown strings fall through), `parseOrigin(param)` (unknown → GARAGE), `ownerSegmentOf(leaf)`.
    - `recall-severity.ts` — `getRecallSeverity(recall)` → critical when summary/consequence/component contains a keyword (case-insensitive), else high.
    - `format.ts` — `formatOdometer(value)` (grouping separator, no unit conversion), `bikeDisplayName(bike)` (nickname in typographic quotes, else model).
  - Acceptance:
    - `TEST` `pnpm --filter mobile test -- bike-hub` green with the fixtures at the end of this plan, both `km` and `mi`.
    - `TYPE` Every exported function has an explicit return type; inputs are typed from `@motovault/graphql` query types via `Pick<>`, not hand-written shapes.

## Phase 3 Checkpoint
- `GATE` `pnpm precheck` + `pnpm check:i18n`.
- `MANUAL` No file under `lib/bike-hub/` imports React, `react-i18next` or a component.

---

## Phase 4: Shell

- [ ] Task 4.1: Shared UI primitives
  - Files: `apps/mobile/src/components/bike-hub/ui/{section-header.tsx,priority-tag.tsx,due-line.tsx,stat.tsx,action-pill.tsx,hub-card.tsx,row-chevron.tsx}`
  - Details (APIs chosen so R2–R5 reuse them):
    - `SectionHeader({ label, count?, tone?, action?: { label, onPress, accessibilityLabel? }, hint? })` — mono 11 px uppercase eyebrow, 0.08 em; copper text action with a 44 pt hit area.
    - `PriorityTag({ priority } | { variant: 'SAFETY' | 'DOC' })` — mono 10 px; `fixedWidth` prop (44 px column, used from R2).
    - `DueLine({ due, unit })` — renders `getTaskDue` output with `t()`; leading part in tone colour, secondary in muted.
    - `Stat({ eyebrow, value, basis?, valueStyle? })` — never pressable.
    - `ActionPill({ label?, icon, onPress, accessibilityLabel })` — 52 high, radius 26, copper with `hubInk`, labelled or icon-only, positioned by the parent above the tab bar.
    - `HubCard` — card surface (`cardDark`, 1 px `whiteAlpha06`, radius 16 continuous) with optional `onPress` + pressed scale.
    - `TaskRow` (mark-done circle, swipe, accessibilityActions) is **not** built here (R2). The Overview uses `AttentionRow` (Task 5.3).
  - Acceptance:
    - `TEST` Render tests (`@testing-library/react-native`): `PriorityTag` label and colours per priority; `DueLine` output for the three component-sheet examples in `km` and one in `mi`; `ActionPill` exposes `accessibilityRole="button"` and the label when icon-only.
    - `DEVICE` Spot check against `Components.dc.html` (tag, section header, stat, buttons).

- [ ] Task 4.2: `BikeHeader`
  - Files: `apps/mobile/src/components/bike-hub/ui/bike-header.tsx`
  - Details: safe-area top inset; row 48 high: back button (44×44 chevron; `accessibilityLabel` "Back to {{origin}}"; the visible label is the chevron only at full size, per `Main.dc.html`), centred name (Instrument Serif 22/24) + eyebrow (mono 10, "{{year}} · {{make}}"), odometer chip (36 high, mono 13, gauge icon, `accessibilityLabel` "Odometer {{value}} {{unit}}, tap to update", `hitSlop` to 44). Chip shows "Set odometer" when `currentMileage` is null. Props: `bike`, `origin`, `unit`, `collapse: SharedValue<number>` (0–1), `onBack`, `onOdometerPress`. On scroll (Reanimated `interpolate`, no layout animation): the two-line block collapses into **one 44 px row** — name 17 px, eyebrow fades out, chip stays. The segment bar is a sibling and never collapses. The header never scrolls away. The unit is `bike.distanceUnit` — not `useMileageUnit()`.
  - Acceptance:
    - `TEST` Renders name, eyebrow and "38,167 km"; back label per origin (`Garage` / `Home` / `Profile`); `mi` bike shows `mi`.
    - `DEVICE` Scrolling Overview collapses the header to one row within ~40 px of scroll, with no jump and no dropped frames; scrolling back restores it.

- [ ] Task 4.3: `SegmentBar`
  - Files: `apps/mobile/src/components/bike-hub/ui/segment-bar.tsx` (+ `segment-bar.ios.tsx` / `.android.tsx` only if the two variants diverge enough to justify it)
  - Details: iOS/default — horizontally scrollable row, pills 36 high, 14 px side padding, min width 72, 6 px gap, radius 10, selected = `hubRaised` + `hubText`; `accessibilityRole="tablist"` / `"tab"` + `accessibilityState.selected`; each pill's hit area ≥ 44 pt (vertical `hitSlop`). Android — Material tabs: 48 dp tall, equal-width, 2 dp copper indicator animated with Reanimated, ripple. First check `@expo/ui/jetpack-compose` for a tab-row primitive via Context7; use a plain RN implementation if none fits (no new dependency). Badge on a segment: `badge?: number` → mono 11 px pill (`hubTagCritBg` / `hubLate`), hidden at 0, included in the tab's accessibility label ("Service, 1 overdue high-priority task"). Only Service passes a badge. Scrolls the selected pill into view under large text.
  - Acceptance:
    - `TEST` Four tabs render from `BIKE_SEGMENT`; `onChange` fires with the typed id; badge hidden at 0 and shown at 1; selected state exposed to accessibility.
    - `DEVICE` iOS: matches `Main.dc.html`. Android: Material tabs with indicator and ripple. Largest Dynamic Type: bar scrolls horizontally, nothing truncates.

- [ ] Task 4.4: Segment state store
  - Files: `apps/mobile/src/stores/bike-hub.store.ts`, `apps/mobile/src/stores/__tests__/bike-hub.store.test.ts`
  - Details: Zustand `persist` + `createJSONStorage(() => createZustandMMKVStorage('bike-hub'))` (same mechanism as `whats-new.store.ts`). State: `lastSegmentByBike: Record<string, BikeSegment>`, `setLastSegment(bikeId, segment)`, `forgetBike(bikeId)` (called when a bike is deleted). Scroll offsets are **not** persisted — they live in the mounted scroll views (Task 4.5).
  - Acceptance:
    - `TEST` set / read / forget; a persisted unknown segment string resolves to OVERVIEW through `resolveInitialSegment`.

- [ ] Task 4.5: Screen rewrite — segment container
  - Files: `apps/mobile/src/app/(tabs)/(garage)/bike/[id].tsx` (rewritten to a thin container, target < 250 lines), `apps/mobile/src/components/bike-hub/shell/{bike-hub-screen.tsx,segment-container.tsx,use-bike-hub-data.ts,use-bike-photo.ts}`, `apps/mobile/src/components/bike-hub/segments/{service-segment.tsx,costs-segment.tsx,bike-segment.tsx}`
  - Details:
    - Route params (typed): `id`, `highlightTask?`, `segment?`, `from?`, `_ts?`.
    - `use-bike-hub-data.ts` owns the queries the shell needs: `MyMotorcycles` (bike), `MaintenanceTasksByMotorcycle` (badge + Overview), documents via `useMotorcycleDocuments`, rides count (`MyRides first: 1`). Keys from `queryKeys`; expenses keyed `[...queryKeys.expenses.byMotorcycle(id), year]` (the bare key is shared with other variables elsewhere — audit §3.3).
    - `SegmentContainer`: each segment is its own `Animated.ScrollView`; segments mount lazily on first activation and **stay mounted** (inactive ones hidden with `display: 'none'`), which preserves each segment's scroll position natively and keeps `DOCUMENTS_SECTION_VIEWED` meaning "the rider opened the Bike segment". Each scroll view reports to its own shared value; the active one drives `BikeHeader.collapse`. Content inset bottom = tab bar + 96 px (pill clearance). Pull-to-refresh per segment refreshes bike, tasks, expenses, rides **and documents** (fixes audit §4.6).
    - Initial segment = `resolveInitialSegment`; re-evaluated when `_ts` or `highlightTask` changes (Home re-navigates to an already-mounted screen); every user change calls `setLastSegment`.
    - Action pill by dispatch table: Overview → labelled "Log" → Log sheet (Task 6.1); Service → icon-only → `add-maintenance-task`; Costs → icon-only → `add-expense`; Bike → icon-only → `add-document`. All with `motorcycleId` + `bikeName`.
    - Interim segments (today's components, props unchanged):
      - **Service** = `MaintenanceSection` (with `initialExpandedId={highlightTask}`, the existing complete / edit / delete handlers moved here, `MAINTENANCE_TASK_DELETED` kept) + `OemDisclaimerCard`.
      - **Costs** = `ReceiptScanEntry` (`SCAN_ENTRY_SURFACE.BIKE_HUB` — today's add-expense form has no scan entry, so removing the banner now would remove the bike-level scan entry) + `ExpensesSection`.
      - **Bike** = `DocumentsSection` + `BikeDetailsCard` + an **interim actions list** so nothing reachable today becomes unreachable when the ⋯ menu, the hero camera button and the two cards disappear: Edit bike (`edit-bike`), Change photo (today's action sheet), Safety recalls (`/(modals)/recalls`, `RECALLS_CHECKED` with today's properties), Import service schedule (`OEM_SCHEDULE_IMPORTED`, same mutation + alerts), Service report (`health-report`, `HEALTH_REPORT_VIEWED` with today's properties), Remove bike (red text, last; today's confirm; `GARAGE_BIKE_REMOVED`; also `forgetBike`). Rows use `HubCard` + hub tokens. R5 replaces this list.
    - The legacy sections take `mileageUnit` as a prop: pass `bike.distanceUnit`.
    - Not rendered any more: hero, meta block, `MileageDisplay`, `BikeQuickActions`, `BikeStatsRow`, Service Report card, Documents entry card. Their files stay (deleted in R6); if `pnpm knip` (advisory) lists them, leave them and note it in the PR.
    - Loading and not-found states render `BikeHeader` (back works) + a centred spinner / message. Keep `Sentry.TimeToInitialDisplay` / `TimeToFullDisplay`.
  - Acceptance:
    - `TEST` Container test with mocked queries: opens on Overview by default; with `highlightTask` opens on Service and passes the id to `MaintenanceSection`; with a remembered segment opens there; switching segments calls `setLastSegment`; loading and not-found states contain a back button.
    - `DEVICE` Scroll Overview halfway → Service → back to Overview: position kept. Leave the bike and reopen: last segment restored. Kill and relaunch: still restored.
    - `DEVICE` Every item of the interim Bike list works; each of the five analytics events fires once with the same property names as on `main` (check with the dev analytics logger).
    - `DEVICE` Pull-to-refresh on the Bike segment refetches documents.
    - `TYPE` No `any`; route params typed; `pnpm check:router` clean.

- [ ] Task 4.6: Origin-aware back
  - Files: `apps/mobile/src/app/(tabs)/(home)/index.tsx` (2 call sites), `apps/mobile/src/components/home/use-home-data.ts` (2), `apps/mobile/src/components/profile/account-section.tsx` (1), `apps/mobile/src/components/bike-hub/shell/use-bike-back.ts`
  - Details: callers add `from: BIKE_ORIGIN.HOME` / `.PROFILE`; Garage, notification and What's New pass nothing (→ GARAGE). `useBikeBack(origin)` uses a dispatch table: GARAGE → `router.back()` when `router.canGoBack()`, else `router.replace('/(tabs)/(garage)')`; HOME → pop the bike off the garage stack, then `router.navigate('/(tabs)/(home)')`; PROFILE → same towards the profile tab. Typed `Href`s only.
  - Acceptance:
    - `TEST` `parseOrigin` + the label mapping; hook test with a mocked router for the three origins.
    - `DEVICE` From Home hero card: back returns to Home, and tapping the Garage tab afterwards shows the garage list, not the bike. From Profile: back returns to Profile. From a notification on cold start: back goes to the garage list.

## Phase 4 Checkpoint
- `GATE` `pnpm precheck` + `pnpm check:i18n`.
- `DEVICE` iOS and Android: header, segment bar, four segments, pill on each, no regression in the wrapped sections (add task, complete task, add expense, delete expense, open document all still work from their tabs).
- `MANUAL` No feature reachable on `main`'s bike detail is unreachable (walk audit §2.1 row by row).

---

## Phase 5: Overview segment

All under `apps/mobile/src/components/bike-hub/overview/`. Entering animation: `FadeInUp.delay(index * 50)` capped under 300 ms. Composition file: `overview-segment.tsx`; data: `use-overview-data.ts`.

- [ ] Task 5.1: Overview data hook
  - Files: `overview/use-overview-data.ts`
  - Details: composes shell data + `MotorcycleRecalls` (existing query and key, `staleTime` 24 h, `retry: 1`; while loading or on error fall back to `bike.recallCount` for the count and show no recall detail) + `DocumentCategories` (`includeHidden: true`, to resolve category names) + `ExpensesByMotorcycle` for the current and the previous year + `NotesByMotorcycle`. Feeds `getRideStatus`, `rankAttention`, `getNextUp`, `summariseCosts`. Exposes per-block `isLoading` / `isError` / `refetch` so one failing query degrades one block, not the page.
  - Acceptance:
    - `TEST` Hook test with mocked fetchers: fixture data produces status CHECK, attention total 6, visible 3 + overflow 3, next-up "Air filter", costs total 1960.62 / yoy 12; recalls query error still yields a status (from `recallCount`).
    - `TYPE` Inputs typed from generated query types.

- [ ] Task 5.2: Photo band
  - Files: `overview/photo-band.tsx`
  - Details: 150 high, radius 16, `expo-image` cover; chips bottom-left (mono 11, `withAlpha(palette.surfaceDark, 0.78)`): "PRIMARY" when `isPrimary`, "{{count}} rides" when > 0. Tap → Bike segment (D3: `BikeDetails` is R5). `accessibilityLabel` "Bike photo, open bike details". No photo → dashed 120-high button "Add a photo" (camera icon) → today's take / choose action sheet, upload overlay while uploading, error alert on failure (reuse `uploadBikePhoto`, logic moved into `shell/use-bike-photo.ts`).
  - Acceptance:
    - `DEVICE` Populated: matches `Main.dc.html`. Empty: matches `OverviewEmpty.dc.html`; adding a photo replaces the dashed button with the band.
    - `TEST` Chips: primary + 9 rides; non-primary with 0 rides renders no chip row.

- [ ] Task 5.3: Ride status card + Needs attention + Next up
  - Files: `overview/ride-status-card.tsx`, `overview/attention-list.tsx`, `overview/attention-row.tsx`, `overview/next-up.tsx`, `overview/setup-list.tsx`
  - Details:
    - `RideStatusCard`: dot 10, serif 24/26 title, 13 px reasons line joined with " · " (built from `reasons[]` with plural keys), chevron; card style from `RIDE_STATUS_STYLE`. Pressing it performs the action of the top attention row; UNTRACKED and READY with no attention are not pressable. `accessibilityRole="button"` only when pressable; the label reads title + reasons.
    - `AttentionRow`: one `Pressable` row (no inner pressable): 36 px icon tile (tinted by kind/severity), title 15/600, sub-line (tone part + muted part), trailing tag (`SAFETY` / priority / `DOC`) or chevron.
    - Row content and destination (D3):
      - Recall (grouped): 1 → "Open safety recall · {{component}}"; n → "{{count}} open safety recalls" with components joined; tag SAFETY (crit style when any is critical). Sub-line "Free dealer fix". → `/(modals)/recalls` with today's params, firing `RECALLS_CHECKED` with today's properties.
      - Task: title + `DueLine`; priority tag. → switches to the Service segment with that task highlighted (state change, not a navigation).
      - Document: "{{category}} expires {{date}}" / "{{category}} expired {{date}}", sub-line "In {{count}} days · {{title}}" / "{{count}} days ago · {{title}}"; tag DOC. → `/(tabs)/(garage)/document/[id]`.
      - Overflow: "{{count}} more overdue, {{priorities}}" when all remaining are overdue, else "{{count}} more"; sub-line = titles joined with " · " (one line, truncated). → Service segment.
    - Header: `SectionHeader` "Needs attention · {{total}}" + action "All" → Service segment. The whole block is hidden when `total === 0`.
    - `NextUp`: `SectionHeader` "Next up" + one row (title, `DueLine`, priority tag) → Service segment highlighted. Hidden when there is no upcoming task.
    - `SetupList` (only when status is UNTRACKED): "Set this bike up" — Import the {{make}} service schedule (today's mutation + result alert, `OEM_SCHEDULE_IMPORTED`), Log work already done (`add-maintenance-task?mode=log`), Add insurance and registration (`add-document`).
    - States: tasks loading → three skeleton rows (no spinner jump); tasks error → inline "Couldn't load tasks" + Retry.
  - Acceptance:
    - `TEST` Render with the fixture: title "Check before riding", reasons "1 open recall · 1 overdue high task · insurance expires in 12 days", eyebrow "Needs attention · 6", rows in order recall → Brake pads inspection → Insurance, overflow "3 more overdue, medium and low" with "Coolant · Tire pressure · Chain clean & lube", Next up "Air filter" with "In 2 days · or in 8,733 km".
    - `TEST` Status variants: NOT_READY (overdue critical), READY (no attention), UNTRACKED (no tasks, no documents) → setup list rendered, attention hidden. One-item variant: single attention row, no overflow row.
    - `DEVICE` Tapping the task row lands on Service with the task expanded; recall row opens the recalls sheet; document row opens the document.
    - `MANUAL` Status is readable without colour (words beside every dot).

- [ ] Task 5.4: Costs card
  - Files: `overview/costs-card.tsx`
  - Details: `SectionHeader` "Costs · {{year}}" + action "Full analytics". Card (pressable as a whole; stats inside are not): total mono 32/34 via `useCurrency().formatFor`; YoY line "▲ {{percent}}% vs same period of {{year}}" (▲ in `hubSoon` when higher, ▼ in `hubOk` when lower, line omitted when `yoy` is null); 8 px category bar (top 5 + rest in `hubTrack`, 2 px gaps), each share carrying an `accessibilityLabel` "{{category}} {{percent}}%"; three `Stat`s — "This month", "Per month · {{year}}" (rounded to whole currency units), "Top category" ("{{label}} {{percent}}%"). Bar and top-category colours come from today's `CATEGORY_COLORS` (already tokenised); the redesign's category palette is R4. Card and "Full analytics" → Costs segment. Empty (no expenses this year): compact card "{{zero}}" + "Purchase price {{price}} recorded. Log fuel or a receipt to start the running total." (without a purchase price: "Log fuel or a receipt to start the running total."). Loading → skeleton; error → inline retry.
  - Acceptance:
    - `TEST` Fixture renders "€1,960.62", "▲ 12% vs same period of 2025", "€0.00", "€218", "Insurance 25%"; previous year empty → no YoY line; no expenses → empty copy with "€10,400".
    - `DEVICE` Matches `OverviewScrolled.dc.html` layout (colours of the bar differ until R4 — expected).
    - `MANUAL` No cost-per-distance figure anywhere.

- [ ] Task 5.5: Notes block
  - Files: `overview/notes-block.tsx`, `apps/mobile/src/components/bike-hub/notes/use-notes.ts` (queries + mutations with optimistic insert and invalidation of `queryKeys.notes.byMotorcycle(id)`)
  - Details: `SectionHeader` "Notes · {{count}}" + "All notes" → Notes screen. Card: the two newest notes (14/19 text, max 3 lines; mono 12 meta "{{date}} · {{odometer}} {{unit}}", odometer part omitted when null), each row → Notes screen; then the quick-add row: `TextInput` "Jot something down…" (36 high; return key = send → `createNote` with text + current odometer stamp, then clear and light haptic) + copper "Note" button (36 high, `accessibilityLabel` "Write a longer note") → Note sheet carrying the typed draft. Zero notes: only the quick-add row under "Notes". The segment scroll view uses `react-native-keyboard-controller` so the input is never covered. Create failure → the row shows the error inline and the text is restored. New analytics event `NOTE_CREATED` (`motorcycle_id`, `source`: `overview_quick` | `sheet` | `notes_composer`, `has_photo`, `also_task`) added to `lib/analytics.ts`.
  - Acceptance:
    - `TEST` Two newest of five shown, count 5; quick add calls the mutation with the trimmed text and the bike's odometer; whitespace-only input does nothing.
    - `DEVICE` iOS and Android: type, send, note appears at the top, keyboard does not cover the input, the action pill does not overlap the row while the keyboard is open.

- [ ] Task 5.6: Papers & bike rows
  - Files: `overview/papers-bike-rows.tsx`
  - Details: "Papers & bike" eyebrow; card with two rows. Documents row: sub-line = most urgent document signal in tone colour ("{{category}} expires in {{count}} days" / "{{category}} expired") + " · {{count}} stored"; with none stored: "Insurance, registration, title & service records" (existing key `documents.cardEmptySubtitle`). → Bike segment. Bike row: title "{{year}} {{make}} {{model}}", sub-line = the present parts of [variant, "bought {{month year}}", purchase price] joined with " · ". → Bike segment.
  - Acceptance:
    - `TEST` Fixture: "Insurance expires in 12 days · 4 stored"; bike row "2022 Honda Africa Twin" / "DCT · bought June 2022 · €11,800"; bike without purchase data renders only what exists.
    - `DEVICE` Both rows switch to the Bike segment.

- [ ] Task 5.7: Compose the Overview
  - Files: `overview/overview-segment.tsx`
  - Details: order — photo band → ride status → (attention | setup list) → next up → costs → notes → papers & bike. 12 px gaps, 16 px side padding. In the UNTRACKED state the order is photo → status → setup list → costs (as `OverviewEmpty.dc.html`), then notes and papers & bike.
  - Acceptance:
    - `DEVICE` Africa Twin fixture bike vs `Main.dc.html` and `OverviewScrolled.dc.html`; Ténéré fixture bike vs `OverviewEmpty.dc.html`.
    - `TEST` Order assertion for both states.

## Phase 5 Checkpoint
- `GATE` `pnpm precheck` + `pnpm check:i18n`.
- `DEVICE` Screens × states table rows for Main / OverviewScrolled / OverviewEmpty captured on iOS; segment bar + keyboard rows on Android.
- `MANUAL` VoiceOver pass over the Overview: every control has a label; reading order top to bottom.

---

## Phase 6: Sheets

Routes live in `app/(tabs)/(garage)/` and are registered in `_layout.tsx` with `presentation: 'formSheet'` (D4), `headerShown: false`, `sheetGrabberVisible: true`, `sheetCornerRadius: 24`, `contentStyle` in the hub card colour. Look up the current `sheetAllowedDetents` / `fitToContents` options for expo-router 57 / react-native-screens 4.26 with Context7 before writing.

- [ ] Task 6.1: Log sheet
  - Files: `apps/mobile/src/app/(tabs)/(garage)/log-entry.tsx`, `_layout.tsx`, `apps/mobile/src/components/bike-hub/sheets/log-options.ts` (typed option table)
  - Details: detent fit-to-contents. Title serif 26 "Log on the {{name}}", "Cancel". Five options from a table (`id`, icon, tint, title key, sub-line key, `href(bike)`): Expense → `add-expense`; Maintenance task → `add-maintenance-task`; Work already done → `add-maintenance-task` with `mode: 'log'`; Note → `note`; Document → `add-document` (D3). Each row ≥ 64 high, `accessibilityRole="button"`. Choosing dismisses the sheet and then opens the target (the target is itself a sheet/modal — do it as dismiss → push after the dismissal completes; if stacked form sheets misbehave on either platform, fall back to an in-screen `@gorhom/bottom-sheet` for this chooser only and record it). New event `BIKE_LOG_OPTION_SELECTED` (`motorcycle_id`, `option`). **No Pro gate on any option.**
  - Acceptance:
    - `TEST` Five options in the spec order, each resolving to the expected typed route + params.
    - `DEVICE` iOS and Android: each option opens the right form with the bike pre-selected; no flash of the previous sheet; Cancel and swipe-down both dismiss. Checked for the duplicate-content problem recorded for dark form sheets (Open question 2).

- [ ] Task 6.2: Odometer sheet
  - Files: `apps/mobile/src/app/(tabs)/(garage)/odometer.tsx`, `_layout.tsx`, `apps/mobile/src/components/bike-hub/sheets/{odometer-keypad.tsx,use-log-odometer.ts}`
  - Details (replaces the iOS-only `Alert.prompt`; identical on both platforms, no system keyboard):
    - "Odometer" serif 26 + Cancel; eyebrow "New reading"; value mono 44/46 with a copper caret + unit (`bike.distanceUnit`); delta line "+{{delta}} {{unit}} since {{date}} · was {{last}}" (from the latest `odometerReadings` row; when lower: "−{{delta}} {{unit}} · was {{last}}" in `hubSoon`).
    - Chips (40 high, mono 13, horizontal scroll): "+{{distance}} from {{count}} tracked rides" (copper outline; only when `pendingRideDistance.rideCount > 0`), then +50 / +100 / +250 from `ODOMETER_QUICK_ADD`. Chips add to the **current entry**.
    - Keypad 3×4, keys 56 high: digits, "Date · today" (opens the `@expo/ui` community date picker, max today; label becomes "Date · {{date}}"), 0, delete (`accessibilityLabel` "Delete digit"; long-press clears).
    - Helper text as in the design. Primary button "Save {{value}} {{unit}}" (52 high), disabled for `EMPTY` / `UNCHANGED` / `FUTURE_DATE`.
    - Save → `validateReading`; `LOWER_THAN_LAST` → confirm dialog ("Lower than the last reading ({{last}} {{unit}}). Save anyway?" — Cancel / Save) before the mutation. `logOdometerReading` → on success invalidate `queryKeys.motorcycles.all`, `odometer.*`, `maintenanceTasks.byMotorcycle(id)`; success haptic; dismiss. Error → inline message, sheet stays open, entry kept.
    - New event `ODOMETER_UPDATED` (`motorcycle_id`, `source: 'sheet'`, `delta`, `backdated`, `used_quick_add`).
  - Acceptance:
    - `TEST` Component test: typing 3-9-4-0-7 shows "39,407" and "+1,240 km since Sep 28 · was 38,167", button "Save 39,407 km"; "+100" from an empty entry yields last + 100; a lower value asks before saving and saves on confirm; equal value keeps Save disabled; `mi` bike shows `mi`.
    - `DEVICE` iOS and Android: save updates the header chip immediately; reopening shows "was 39,407"; back-dated reading older than the latest does not change the chip (and says so in a one-line notice before saving).
    - `MANUAL` Local stack: an `odometer_readings` row exists per save with the chosen date.

- [ ] Task 6.3: Note sheet
  - Files: `apps/mobile/src/app/(tabs)/(garage)/note.tsx`, `_layout.tsx`, `apps/mobile/src/components/bike-hub/sheets/note-form.tsx`, `apps/mobile/src/lib/image-upload.ts` (`uploadNotePhoto(uri, userId, noteId)` → `{userId}/notes/{noteId}/{timestamp}.webp`, same compression as maintenance photos)
  - Details: params `motorcycleId`, `noteId?` (edit), `draft?`. Large detent. Header: Cancel · "New note" / "Edit note" (serif 24). Multiline input (16/23, autofocus, 6 rows min, `maxLength` `NOTE_TEXT_MAX`). Chips: odometer stamp "{{odometer}} {{unit}} · today" (on by default, toggles the stamp off), "Photo" (take / choose; thumbnail with remove; up to `NOTE_PHOTOS_MAX`). The "Link a job or expense" chip is **not rendered** (D3). "Attach to": one chip per bike from `MyMotorcycles` (`bikeDisplayName`), current bike selected; hidden with a single bike; changing it changes the target bike and the odometer stamp. "Also make it a task" row with `NativeToggle` + sub-line "Creates a low-priority task with no due date, with this note attached". The "recognised and become tappable" hint line is **not rendered** (the feature is not built — out of scope). Keyboard-attached "Save note" (52 high) via `KeyboardStickyView`; the form scrolls. Save: `createNote` (or `updateNote`) → then upload photos and `addNotePhoto` for each (a failed photo keeps the note and shows "Note saved, photo failed — Retry"). Discard confirmation only when there is unsaved text. No gate.
  - Acceptance:
    - `TEST` Save disabled for empty / whitespace text; stamp off sends `odometer: null`; switch on sends `alsoCreateTask: true`; edit mode pre-fills and calls `updateNote`.
    - `DEVICE` iOS and Android: Save stays above the keyboard; long text scrolls; a note with a photo shows the photo after reload; "also make it a task" produces a Low task without due date on the Service tab and the note links to it. Checked for the dark form-sheet duplicate-content problem.

## Phase 6 Checkpoint
- `GATE` `pnpm precheck` + `pnpm check:i18n` + `pnpm check:router`.
- `DEVICE` All three sheets on iOS and Android per the Screens × states table.
- `MANUAL` `grep -rn "Alert.prompt" apps/mobile/src/components/bike-hub/{shell,overview,sheets,ui}` returns nothing.

---

## Phase 7: Notes screen, undo, wiring

- [ ] Task 7.1: `UndoSnackbar` + deferred delete
  - Files: `apps/mobile/src/components/bike-hub/ui/undo-snackbar.tsx`, `apps/mobile/src/stores/pending-delete.store.ts`, `apps/mobile/src/components/bike-hub/ui/use-deferred-delete.ts`, tests
  - Decision — **deferred delete on the client, server delete through the `soft_delete_note` RPC**: on delete the row is hidden optimistically and a 5 s timer starts; Undo cancels it; when it elapses the client calls `deleteNote`. The pending entry is committed immediately when the screen blurs, the app goes to background, or a second delete starts. Why not "soft-delete now + restore RPC": it needs a second SECURITY DEFINER function per table (notes now; tasks and expenses in R2/R4 have no restore either) purely to support five seconds of regret, while the deferred form needs none and fails safe — if the app dies inside the window the note is simply still there. The one cost (a delete can be lost on a crash within 5 s) is acceptable for a note. A failed commit restores the row and shows an error.
  - `UndoSnackbar({ message, actionLabel, onAction, secondaryAction?, durationMs = UNDO_WINDOW_MS })`: rendered inside the screen above the composer / action pill, `FadeInUp` 250 ms / `FadeOutDown` 200 ms, `accessibilityLiveRegion="polite"`, action hit area ≥ 44 pt; does not collide with the root `ReceiptScanSaveSnackbar` (`bottom: 96`). `secondaryAction` exists for R2's "Add details".
  - Acceptance:
    - `TEST` (fake timers) delete → hidden; Undo within 5 s → mutation never called, row back; 5 s elapse → mutation called once; blur at 2 s → mutation called at once; mutation failure → row restored + error surfaced; second delete commits the first.
    - `DEVICE` Delete a note, Undo, the note is back in place.

- [ ] Task 7.2: Notes screen
  - Files: `apps/mobile/src/app/(tabs)/(garage)/notes.tsx`, `_layout.tsx` (`presentation: 'card'`, custom header), `apps/mobile/src/components/bike-hub/notes/{note-row.tsx,notes-composer.tsx}`
  - Details: params `motorcycleId`, `from?: BikeSegment` (back label = that segment's name, default Overview). Header 48: copper back "‹ Overview", title "Notes · {{name}}" 15/600. Body: "{{count}} notes" serif 30 + hint "newest first · swipe for edit · delete"; search field (40 high, "Search notes…", client-side case-insensitive filter over text, debounced); card list (`FlatList`): text 15/21 `hubTextSoft`, meta row mono 12 "{{date}} · {{odometer}} {{unit}}" + right link by dispatch — linked task → its title → bike detail Service segment with `highlightTask`; linked expense → "Linked expense · {{amount}}" → `expense-detail`; neither → "Make it a task" → `createTaskFromNote`, then the link shows the task title. Photos as 56 px thumbnails. Swipe left reveals Edit · Delete (gesture-handler + Reanimated, pattern of `components/shared/swipeable-expense.tsx`); the same two as `accessibilityActions` and in a long-press menu. Edit → Note sheet with `noteId`; Delete → Task 7.1 ("Note deleted" · Undo), event `NOTE_DELETED`. Composer bar (keyboard-sticky, above the tab bar): growing input (min 48) "Jot something down…", photo button (48, `accessibilityLabel` "Attach a photo" → Note sheet with the draft and the picker open), "Add" (copper, 48) — saves the draft directly when it has text, opens the Note sheet when empty. States: loading skeleton rows; error + Retry; empty ("No notes yet" + one line, composer still present); search with no match ("No notes match "{{query}}"").
  - Acceptance:
    - `TEST` Five fixture notes newest first; search "2.5 bar" leaves one; right-link variants; composer Add with text calls `createNote` with `source: 'notes_composer'`.
    - `DEVICE` iOS and Android: composer stays above the keyboard and above the tab bar; swipe actions; back label matches the origin segment; a 60-note list scrolls at 60 fps.

- [ ] Task 7.3: Deep links and landing rule
  - Files: `apps/mobile/src/components/bike-hub/shell/use-bike-hub-navigation.ts`, call-site review of `hooks/use-notification-deep-link.ts`, `app/(modals)/whats-new.tsx`, `app/(tabs)/(garage)/expense-detail.tsx`
  - Details: one helper exposes `openLeaf(leaf, params)` = set the owning segment (`ownerSegmentOf`) and remember it, then push the leaf, so back from any leaf lands on its owning segment (notes → the segment it was opened from; document → Bike; recalls → Overview; task forms → Service; expense forms → Costs). `highlightTask` from Home / notifications lands on Service with the task expanded — `MaintenanceSection` is unchanged, so a highlighted task beyond its first five still does not render (existing defect, fixed in R2 — record it in the PR). Notification payloads carry only `motorcycleId`; they keep landing by the default rule.
  - Acceptance:
    - `TEST` `ownerSegmentOf` table; navigation helper with a mocked router and store.
    - `DEVICE` Home "upcoming task" card → bike opens on Service with that task expanded and back says "Home". Overview → document row → back → Overview is still selected in the store but the Bike segment is the one remembered only if the rider switched to it (verify the remembered segment is not overwritten by a leaf push).

- [ ] Task 7.4: Regression flows and clean-up of references
  - Files: `apps/mobile/.maestro/flows/{log-past-work.yaml,add-expense.yaml,complete-maintenance-task.yaml,edit-maintenance-task.yaml,units-display-toggle.yaml}` (entry-point selectors changed: no ⋯ menu, no quick-action row), new `apps/mobile/.maestro/flows/bike-hub-overview.yaml` (open bike → four segments → Log → Note → save → Notes → delete → Undo; odometer save), `apps/mobile/.maestro/README.md`
  - Acceptance:
    - `E2E` The new flow passes on a preview simulator build against the local stack (README: flows need a bundled build, not the dev client).
    - `E2E` The five existing flows pass with their updated entry points.

## Phase 7 Checkpoint
- `GATE` `pnpm precheck` (Open question 1 caveat) + `pnpm check:i18n`; each of `check:api-bans`, `check:router`, `check:mobile-colors`, `check:arch`, `check:store-copy` green on its own. `check:store-copy` and `check:arch` are unaffected by this change by construction (no store metadata touched; no `packages/` → `apps/` import) — run them anyway.
- `DEVICE` Full Screens × states table captured.
- `MANUAL` **Deploy order, for the owner:** the API reads `motorcycles.distance_unit` in `MOTORCYCLE_SELECT`, which backs `myMotorcycles` for every user, and Render auto-deploys `apps/api` on merge. Merging before the migrations are applied breaks the garage for all riders. Order: (1) owner approves and pushes `00180–00182`; (2) `pnpm generate:types` (linked) → zero diff; (3) merge → Render deploys; (4) mobile ships (OTA is sufficient: JS + JS-loaded fonts only, runtime `3.20.0`) using `apps/mobile/.env.production`. Old app builds keep working: every change is additive and the trigger logs their odometer writes.
- `MANUAL` `PROGRESS.md` updated by the lead; local `.env` files restored.

---

## Screens × states (Visual QA)

iPhone 390×844 dark unless noted. "AT" = Africa Twin fixture bike, "T7" = Ténéré fixture bike, "mi" = imperial copy.

| Screen | Populated | Empty / new | Loading | Error | One item | Miles | Android |
|---|---|---|---|---|---|---|---|
| **Main** (Overview top) | AT: status CHECK, attention 6 (3 + overflow), Next up | see OverviewEmpty | header + skeleton rows, back works | tasks query fails → inline retry in the attention block; rest renders | 1 attention row, no overflow; READY variant (no attention block); NOT_READY variant (overdue critical) | chip "23,716 mi"; due lines in mi; soon threshold 1,200 mi | Material tabs, badge, ripple; pill above the tab bar; 48 dp targets |
| **OverviewScrolled** | AT: collapsed 44 px header, costs card, 2 notes + quick add, papers & bike | — | costs skeleton; notes skeleton | expenses fail → costs retry; notes fail → notes retry | 1 note; 1 expense category (bar is one block); no previous-year data (no YoY line) | bike row unaffected; note meta "… mi" | quick-add input with keyboard open: input visible, pill not overlapping |
| **OverviewEmpty** | — | T7: dashed photo, "Nothing tracked yet", setup list, costs zero with purchase price | as Main | recalls query fails → status still renders | bike with only a document (status READY, no setup list) | — | dashed photo button, setup rows |
| **LogSheet** | 5 options, title with bike name | — | — | — | long nickname (title wraps / truncates cleanly) | — | sheet height, back gesture dismisses, each option opens its form |
| **OdometerSheet** | AT: "39,407", "+1,240 km since Sep 28 · was 38,167", ride chip visible | bike without odometer (no "was" line, Save enabled from first digit) | readings loading (delta line placeholder) | save fails → inline error, entry kept | no pending rides (ride chip hidden) | unit "mi", Save "… mi" | keypad sizing, date picker, lower-than-last confirm |
| **NoteSheet** | filled text, stamp on, 3 bike chips, switch off | new note (placeholder, Save disabled) | saving (button busy) | save fails → inline error; photo fails → "Note saved, photo failed" | single-bike account (no "Attach to") ; edit mode | stamp "… mi · today" | Save above keyboard, long text scroll, photo picker |
| **Notes** | AT: 5 notes, three link variants | "No notes yet" + composer | skeleton rows | error + Retry | 1 note; search with no match | meta in mi | composer above keyboard + tab bar; swipe actions; undo snackbar |

Also capture once: largest Dynamic Type on Main (segment bar scrolls); VoiceOver focus order on Main; back label for Home and Profile origins.

## Fixtures (for the Test writer and the seed script)

"Today" = **2026-10-02**. Currency EUR, unit km unless noted.

**Bike A** — 2022 Honda Africa Twin, variant DCT, primary, 9 rides, odometer **38,167**, purchase 2022-06 **€11,800**. Header: "Africa Twin" / "2022 · Honda" / "38,167 km".

| Item | Data | Expected |
|---|---|---|
| Recall (1 returned) | component mentions ECU, summary mentions "stall" | severity critical; row "Open safety recall · …", tag SAFETY, sub-line "Free dealer fix" |
| Brake pads inspection | priority high, due 2026-03-15, target 42,100 | overdue; "201 days late · 3,933 km to target"; tone late |
| Coolant / Tire pressure / Chain clean & lube | medium, low, low; each overdue by date | overflow row "3 more overdue, medium and low" · "Coolant · Tire pressure · Chain clean & lube" |
| Air filter | medium, due 2026-10-04, target 46,900 | Next up; "In 2 days · or in 8,733 km"; tone soon |
| Insurance document | seeded category Insurance, title "Mapfre", expiry 2026-10-14 | "Insurance expires Oct 14" / "In 12 days · Mapfre"; tag DOC |
| Documents | 4 stored | "Insurance expires in 12 days · 4 stored" |
| Ride status | — | CHECK; "1 open recall · 1 overdue high task · insurance expires in 12 days" |
| Needs attention | — | eyebrow count **6** (1 recall + 1 + 1 + 3), 3 rows + overflow; Service badge **1** |
| Costs 2026 | total 1,960.62; same period 2025 = 1,748.62; October 0; September 65.62; Insurance ≈ 490.16 | "€1,960.62"; "▲ 12% vs same period of 2025" (+€212.00, 12.1 %); "This month €0.00"; "Per month · 2026 €218" (÷ 9 months); "Insurance 25%"; shares 25 / 20 / 13 / 12 / 12 / rest 18 |
| Odometer | latest reading 38,167 at 2026-09-28; 4 unapplied rides totalling 1,240 km | entering 39,407 → "+1,240 km since Sep 28 · was 38,167", "Save 39,407 km", chip "+1,240 from 4 tracked rides"; +50 → 38,217; entering 38,000 → needs confirm; entering 38,167 today → unchanged (Save disabled) |
| Notes (5) | Sep 28 · 38,100 km "Rear preload felt soft two-up…"; Aug 26 · 37,950 km "Pattex Nural 50…" (linked expense €29.73 — set directly by the seed); Aug 9 · 36,400 km "Front tyre pressure… 2.5 bar…"; Jul 20, no odometer "Idea: heated grips…"; Jul 16 · 37,300 km "Dealer (Motos Ebro)…" (linked task "2nd scheduled service") | "Notes · 5"; Overview shows the first two; search "2.5 bar" → 1 result |

**Due-line cases from the component sheet** (unit in brackets):

| Task | Input | Expected |
|---|---|---|
| Rear brake shoes [mi] | critical, date 38 days ago, odometer 420 past target | "38 days late · 420 mi past target", both red |
| Chain tension [mi] | low, date 12 days ago, 180 short of target | "12 days late · 180 mi to target" |
| Engine oil & filter [km] | high, target 40,000 at odometer 38,167, date 2027-01-10 | "In 1,833 km · or by Jan 10", tone soon (< 2,000 km) |
| Brake fluid [km] | medium, date in Mar 2027, OEM source, no target | "Mar 2027 · Honda schedule", tone plain |
| OEM task [km] | target 48,000, no date, OEM source | "In 9,833 km · Honda schedule", tone plain |
| Threshold [mi] | target 1,200 mi ahead / 1,201 mi ahead | soon / plain |
| Threshold [km] | date 30 days ahead / 31 days ahead | soon / plain |
| Undated, no target | — | state SOMEDAY |

**Ride-status table:** overdue Critical → NOT_READY; expired Insurance → NOT_READY; expired Warranty (non-blocking) → unchanged; overdue High only → CHECK; Registration expiring in 30 days → CHECK, in 31 → READY; overdue Low + Medium only → READY; one recall and nothing else → CHECK; no tasks, no documents, no recalls → UNTRACKED; custom category named "Insurance" (`kind: custom`) expired → unchanged.

**Bike B** — 2024 Yamaha Ténéré 700, odometer 1,240, purchase price €10,400, no tasks, no documents, no expenses, no photo: "Nothing tracked yet", setup list, "€0.00" + "Purchase price €10,400 recorded. Log fuel or a receipt to start the running total."

**Segment resolution:** `segment=costs` → COSTS; `highlightTask` set → SERVICE; remembered BIKE → BIKE; `segment=nonsense` + remembered SERVICE → SERVICE; nothing → OVERVIEW. Origin: `home` → "Home"; `profile` → "Profile"; absent / unknown → "Garage".

---

## Open questions (each with the fallback this plan is built on)

1. **`pnpm precheck` cannot go green locally** while the untracked `outputs/play-release-3.20.0/release-notes-3.20.0.json` fails Biome (PROGRESS Q1). *Fallback:* gate = every `check:*` + Biome on everything else + typecheck + test.
2. **formSheet vs fullScreenModal for dark sheets** (PROGRESS Q2; an earlier preference was `fullScreenModal`). *Fallback:* formSheet per D4; each sheet task has a device check for the duplicate-content problem; the Log chooser may fall back to an in-screen bottom sheet if stacked form sheets misbehave.
3. **Per-bike unit while the rest of the app is per-user** (PROGRESS Q3). Four API conversion sites and ~10 screens still read `users.measurement_system`. Letting the two diverge before R5/R6 would reintroduce the 1.61× class of bug (a ride adding miles to a km bike). *Fallback:* the interim users→bikes sync trigger in 00180, removed in R5 together with moving the conversion sites to the bike's unit. If the owner prefers real per-bike units now, Task 2.1 grows to switch `rides.service`, `oem-schedules.service`, `maintenance-tasks.service` and `receipt-scan.service` to `distance_unit` in this PR.
4. **`motorcycles.mileage_unit` already exists** (deprecated, default `'mi'`). The spec asks for `distance_unit`. *Fallback:* add `distance_unit` as a new column per D1, never read `mileage_unit`, drop it in R6.
5. **Geist Mono and Plus Jakarta Sans are not registered** in the app; ~130 existing usages render in the system font. *Fallback:* register both under hub-only family names so nothing outside the hub changes. Registering them under the names existing code already uses would fix the whole app at once but changes many screens in this PR — owner's call.
6. **"Needs attention · 6" excludes the due-soon Air filter**, although spec §2 ranks "due soon" as the fifth attention class. *Fallback:* the ranking function implements all five classes; the Overview excludes the one task shown under "Next up", which reproduces the screen (6) and the spec.
7. **"+1,240 from 4 tracked rides"**: ride distance is already added to the odometer automatically at ride end, so this chip can only ever cover rides whose automatic sync did not apply. *Fallback:* the chip shows only for such rides and is otherwise hidden; the delta line still works from the readings log.
8. **OverviewEmpty is nearly unreachable**: creating a bike auto-populates OEM tasks (a GENERIC schedule exists), so a new bike is not "nothing tracked", and "Import the Yamaha service schedule" would import what is already there. *Fallback:* the state is implemented by the rule (no tasks and no documents) and the import row calls today's idempotent import; QA uses a bike whose tasks were deleted. Owner may want the setup list shown on other conditions (e.g. no completed work and no documents).
9. **Recall row copy** — "ECU stall risk" and "1 other already fixed" need a short human title and per-rider recall state. NHTSA returns a long `component` string and there is no acknowledgement data until R5; NHTSA covers US recalls only. *Fallback:* title from the `component` field, sub-line "Free dealer fix", no "already fixed" fragment.
10. **Bike row sub-line "CRF1100L"** — no model-code field exists. *Fallback:* variant · bought month/year · purchase price, whichever exist.
11. **"Also make it a task" title** ("Check rear sag") implies summarising the note. *Fallback:* deterministic first-line title (max 60 chars); the sub-line under the switch describes the task generically instead of previewing a title.
12. **Note sheet hint "Part numbers, pressures and phone numbers are recognised and become tappable"** — not in spec §3 and not buildable from existing data. *Fallback:* the hint is not rendered and nothing is recognised.
13. **Notes screen shows no tab bar and a serif "5 notes" heading.** Pushed screens in the garage stack keep the tab bar, and §2 reserves the serif for bike name, sheet titles and ride status. *Fallback:* tab bar stays (as every other pushed garage screen), composer sits above it; the serif heading is built as drawn.
14. **Copy differences between files:** `Main` says "Due in 2 days", `Components` says "In 2 days"; spec says "Ready", `Components` says "Ready to ride". *Fallback:* "In 2 days" and "Ready to ride".
15. **How "closer limit" is decided between a date and a distance** is not defined. *Fallback:* a passed limit always leads; otherwise days and distance are compared at the due-soon ratio (30 days ≙ 2,000 km / 1,200 mi). Every example on the component sheet comes out as drawn.
16. **"Per month"** denominator: the design shows 9 months on Oct 2. *Fallback:* completed calendar months of the year, minimum 1.
17. **Category bar colours** on the Overview costs card follow today's category colours, not the redesign palette (R4 owns `expense_categories.colour`). Visual QA should expect that one difference.
18. **Light theme:** the screens are dark only; today's screen follows the system scheme. *Fallback:* the hub uses the dark hub tokens in both schemes until a light design exists.
19. **Photo band tap** leads to `BikeDetails` (R5). *Fallback:* it switches to the Bike segment; changing the photo moves to the interim Bike list; the empty-state button opens the photo picker directly.
20. **Header name with a nickname** — the design shows the model ("Africa Twin") in the header and nicknames in quotes on chips. *Fallback:* header shows the model; sheets and chips use the nickname in quotes when set.
21. **Local migration replay may fail** (`supabase db reset` over 179 migrations has not been run on this machine; Docker is not running; production has diverged from the folder before). *Fallback:* Task 0.1's second route — the owner pushes the three additive migrations first.
22. **Column-level grants on `motorcycles`** are implied by a code comment but not present in the migrations folder. *Fallback:* Task 1.1 inspects the live ACL on the local stack and adds a `GRANT SELECT (distance_unit)` only if column grants exist.
