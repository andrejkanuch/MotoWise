---
title: "feat: Backlog Batch MOT-137..143 (7 tickets)"
type: feat
status: active
date: 2026-04-10
linear:
  - MOT-137
  - MOT-138
  - MOT-139
  - MOT-140
  - MOT-141
  - MOT-142
  - MOT-143
---

# Backlog Batch: MOT-137 through MOT-143

## Context

Seven P1/P2 backlog tickets, all full-stack (DB + API + mobile). Implementing on one feature branch `feat/backlog-batch-mot-137-143` branched from `feat/trip-day-management-ux`.

## Multi-Persona Analysis Summary

The tickets were written by a PM with input from motorcycle-domain research — each has explicit Goals / Non-Goals / User Stories / Schema / Success Metrics. I'm treating the PM spec as authoritative and layering the 4-persona review:

### Product
- All seven are P1-Growth except MOT-143 (P2). **Highest growth lift**: MOT-138 (OEM schedules) and MOT-140 (odometer sync) — both solve "the app tells me what to do" vs "I log what I remember."
- MOT-137 (Fuel) is highest DAU contribution per Fuelly precedent.
- MOT-142 (Recalls) is safety — a trust-builder, not a growth lever.

### UX/UI
- MOT-143 reuses an existing pattern (photos on tasks). Fast, low-risk polish win.
- MOT-141 is a share-sheet trigger — one button, high perceived value.
- MOT-139 changes the notification UX — must not regress the current 1-day default.
- MOT-138 needs a clean "Import schedule?" confirmation UI or it becomes a wall of tasks.

### Motorcyclist Expert
- MOT-140 is the biggest "wow" — no other maintenance app knows your real mileage. Protect against ferry-crossing / GPS drift with manual override.
- MOT-137: **the partial-fill flag matters** — MPG from a half-fill is garbage. Exclude partial fills from economy calc.
- MOT-138: Honda/Yamaha valve checks are at huge intervals (16,000 mi / 24,000 mi). The schedule must handle very long intervals correctly.
- MOT-142: NHTSA is US-only. Add a disclaimer for international users.

### Software Architecture
- **Shared patterns to extract**:
  - `PhotoAttachmentSection` reusable for tasks + expenses (MOT-143 kickoff)
  - Idempotency pattern for MOT-140 applies to any future sync features
  - Reminder scheduling abstraction for MOT-139 is a notification-layer concern, not task-layer
- **Migration sequencing**: All 7 migrations are additive (new columns / new tables). No conflicts. Can be numbered 00075-00081.
- **GraphQL contract drift** is the biggest risk running 7 features through one branch. Run `pnpm generate` after every resolver change; run full `pnpm lint` before every commit.

## Implementation Order & Dependencies

```
Phase 1 (independent, small):
  1. MOT-143 Receipt Photos     (establishes PhotoAttachmentSection)
  2. MOT-141 PDF Export         (client-only, expo-print)
  3. MOT-142 VIN Recall         (external API, isolated)

Phase 2 (foundation for reminders/fuel):
  4. MOT-140 Ride→Odometer Sync (enables accurate mileage)

Phase 3 (depends on Phase 2):
  5. MOT-139 Multi-stage Reminders  (benefits from accurate odometer)
  6. MOT-137 Fuel Logging            (pre-fills from latest ride)

Phase 4 (largest, data-heavy):
  7. MOT-138 OEM Schedules           (produces tasks for MOT-139)
```

Each ticket has its own section below with concrete file-level guidance.

---

## MOT-143: Receipt Photo Attachments on Expenses

**Migration:** `supabase/migrations/00075_expense_photos.sql`
```sql
CREATE TABLE expense_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_expense_photos_expense ON expense_photos(expense_id);
ALTER TABLE expense_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_select" ON expense_photos FOR SELECT USING (user_id = (select auth.uid()));
CREATE POLICY "owner_insert" ON expense_photos FOR INSERT WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "owner_delete" ON expense_photos FOR DELETE USING (user_id = (select auth.uid()));
```

**API (NestJS):**
- `apps/api/src/modules/expenses/models/expense-photo.model.ts`
- Extend `ExpensesService` with `listExpensePhotos`, `addExpensePhoto`, `removeExpensePhoto`
- Expose `expensePhotos` field on `Expense` GraphQL object

**Mobile:**
- Find existing task photo component (likely `apps/mobile/src/components/task/task-photo-section.tsx`)
- If it exists: extract to `apps/mobile/src/components/photo-attachment-section.tsx` with generic props `{ entityType: 'task'|'expense', entityId, maxPhotos, photos, onUpload, onDelete }`
- If it doesn't exist: build `PhotoAttachmentSection` directly for expenses
- Wire into `add-expense.tsx` / `edit-expense.tsx` / expense detail

**Storage:** Reuse existing bucket or create `expense-photos` bucket with RLS.

---

## MOT-141: Maintenance History PDF Export

**No migration. Pure client-side.**

**Mobile:**
- `apps/mobile/src/utils/pdf-export.ts` — new utility using `expo-print` + `expo-sharing`
- `apps/mobile/src/utils/pdf-history-template.ts` — HTML template function
- Add `Export History` button in garage detail screen
- Filter bottom sheet with date range picker (all / last year / custom)
- Filename: `MotoVault_{Make}{Model}_ServiceHistory_{YYYY-MM-DD}.pdf`

**HTML template requirements:**
- Inline CSS only (no external stylesheets)
- Table with columns: Date / Task / Odometer / Cost / Notes
- Header with bike make/model/year + current odometer + export date
- `@media print { @page { margin: 2cm; } }` for pagination

---

## MOT-142: VIN Safety Recall Lookup

**Migration:** `supabase/migrations/00076_motorcycle_vin_recalls.sql`
```sql
ALTER TABLE motorcycles ADD COLUMN vin TEXT;
ALTER TABLE motorcycles ADD CONSTRAINT vin_format
  CHECK (vin IS NULL OR (LENGTH(vin) = 17 AND vin ~ '^[A-HJ-NPR-Z0-9]{17}$'));
ALTER TABLE motorcycles ADD COLUMN recall_last_checked_at TIMESTAMPTZ;
ALTER TABLE motorcycles ADD COLUMN recall_count INT DEFAULT 0;
```

**API (NestJS):**
- `apps/api/src/modules/recalls/recalls.module.ts`
- `apps/api/src/modules/recalls/recalls.service.ts` — NHTSA fetch + 24h in-memory Map cache (or Redis if available)
- `apps/api/src/modules/recalls/recalls.resolver.ts` — `checkRecalls(motorcycleId)` query
- Use `SUPABASE_USER` client for auth/user-scoped queries; external NHTSA call is a plain `fetch`

**NHTSA endpoints:**
- `https://api.nhtsa.gov/recalls/recallsByVehicle?make=X&model=Y&modelYear=Z`
- `https://api.nhtsa.gov/recalls/recallsByVin?vin=X`

**Mobile:**
- Add VIN field to `edit-bike.tsx` / `add-bike.tsx` (17-char max, uppercase, validator)
- New `recalls.tsx` modal screen showing list
- `Check Safety Recalls` button on bike detail
- Warning badge on garage card when `recall_count > 0`
- NHTSA attribution text

---

## MOT-140: Ride-to-Odometer Automatic Sync

**Migration:** `supabase/migrations/00077_odometer_sync.sql`
```sql
ALTER TABLE rides ADD COLUMN odometer_synced BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE motorcycles ADD COLUMN odometer_sync_source TEXT DEFAULT 'manual';
ALTER TABLE motorcycles ADD COLUMN odometer_last_synced_at TIMESTAMPTZ;
ALTER TABLE motorcycles ADD COLUMN odometer_last_ride_id UUID REFERENCES rides(id);
```

**API:** Modify `RidesService.completeRide` (or wherever ride → completed status transitions) to call `MotorcycleService.incrementOdometerFromRide(motorcycleId, distanceKm, rideId)`:
1. Check `rides.odometer_synced` — if true, no-op
2. Increment `motorcycles.current_odometer_km` by `distanceKm`
3. Set `odometer_sync_source='gps_ride'`, `odometer_last_synced_at=NOW()`, `odometer_last_ride_id=rideId`
4. Set `rides.odometer_synced=true`
All within a transaction.

**Mobile:** Display `(Auto-updated)` / `(Manual entry)` label + timestamp on bike detail.

---

## MOT-139: Multi-Stage Maintenance Reminders

**Migration:** `supabase/migrations/00078_maintenance_reminders.sql`
```sql
ALTER TABLE maintenance_tasks
  ADD COLUMN remind_30d BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN remind_7d  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN remind_1d  BOOLEAN NOT NULL DEFAULT TRUE;
```

**Mobile:**
- `apps/mobile/src/lib/notifications.ts` — rewrite/extend scheduling to handle 3 stages per task
- Respect iOS 64-notification cap: only schedule next 3 months; reschedule on app open
- Settings screen: global defaults toggle
- Task create/edit: per-task stage checkboxes (collapsible "Advanced")

---

## MOT-137: Fuel Fill-up Logging & MPG Tracking

**Migration:** `supabase/migrations/00079_fuel_logs.sql`
```sql
CREATE TABLE fuel_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  motorcycle_id UUID NOT NULL REFERENCES motorcycles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  odometer_km NUMERIC(10,2) NOT NULL,
  fuel_litres NUMERIC(8,3) NOT NULL,
  total_cost NUMERIC(10,2),
  currency TEXT DEFAULT 'USD',
  fuel_type TEXT DEFAULT 'regular',
  is_partial BOOLEAN DEFAULT FALSE,
  notes TEXT,
  filled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_fuel_logs_bike_filled ON fuel_logs(motorcycle_id, filled_at DESC) WHERE deleted_at IS NULL;
ALTER TABLE fuel_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_all" ON fuel_logs FOR ALL USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
```

**API:** NestJS `fuel-logs` module with MPG calculation helper. Auto-create expense in `fuel` category on insert.

**Mobile:** Fill-up form + history list + economy chart (P1). Pre-fill odometer from MOT-140 latest ride.

---

## MOT-138: OEM Service Schedule Templates

**Migration:** `supabase/migrations/00080_oem_schedules.sql`
```sql
CREATE TABLE oem_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year_from INT,
  year_to INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_oem_make_model_years ON oem_schedules(make, model, year_from, year_to);

CREATE TABLE oem_schedule_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES oem_schedules(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  interval_km INT,
  interval_months INT,
  notes TEXT,
  priority TEXT DEFAULT 'high'
);
-- Public read (schedules are shared reference data)
ALTER TABLE oem_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE oem_schedule_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON oem_schedules FOR SELECT USING (true);
CREATE POLICY "public_read" ON oem_schedule_items FOR SELECT USING (true);
```

**Seed:** `supabase/seeds/oem_schedules.sql` — start with Honda CB500F, Yamaha MT-07, Kawasaki Z650, Suzuki GSX-S750, KTM 390 Duke, BMW F 750 GS as representative models. Expand to 50 over time.

**API:** `oemSchedules` module with `findByMakeModelYear` + `importToBike` mutation that creates tasks with `oemScheduleId` set.

**Mobile:** Import prompt on bike add + button on bike detail.

---

## Verification

Each ticket has its own verification. Global checks:
- `pnpm generate` succeeds after every API change
- `pnpm lint` returns 0 errors before every commit
- `pnpm --filter mobile test` passes
- `pnpm --filter api test` passes
- All 7 migrations deploy cleanly in sequence
