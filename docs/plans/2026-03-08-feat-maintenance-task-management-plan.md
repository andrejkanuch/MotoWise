# Maintenance Task Management (MOT-18)

## Overview
Interactive to-do list of upcoming maintenance tasks per motorcycle with urgency indicators, manual task creation, and completion tracking.

**Linear:** MOT-18 | **Priority:** P1 (Urgent) | **Labels:** Phase 1: MVP, P0, Feature

## Acceptance Criteria (from Linear)
- [x] Tasks auto-generated from health system intervals
- [x] Manual tasks addable via "Add Maintenance Note" bottom sheet modal
- [x] Bottom sheet fields: title, target mileage, target date, notes
- [x] Tasks sorted by urgency with color-coded badges: Urgent (red), Soon (amber), Upcoming (green)
- [x] Expandable tasks showing notes and parts needed
- [x] Checkbox to mark task complete (moves to History tab with timestamp + odometer)
- [x] GraphQL `maintenanceTasks(motorcycleId)` query working
- [x] GraphQL `addMaintenanceTask` and `completeTask` mutations working

---

## Implementation Plan

### Phase 1: Database & Types

#### 1.1 Migration: `00020_create_maintenance_tasks_table.sql`
```sql
CREATE TABLE public.maintenance_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  motorcycle_id UUID NOT NULL REFERENCES public.motorcycles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  target_mileage INT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  notes TEXT,
  parts_needed TEXT[],
  completed_at TIMESTAMPTZ,
  completed_mileage INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.maintenance_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own maintenance tasks" ON public.maintenance_tasks FOR ALL USING (auth.uid() = user_id);
CREATE INDEX idx_maintenance_tasks_user_id ON public.maintenance_tasks (user_id);
CREATE INDEX idx_maintenance_tasks_motorcycle_id ON public.maintenance_tasks (motorcycle_id);
CREATE INDEX idx_maintenance_tasks_status ON public.maintenance_tasks (status);
```

#### 1.2 Enums in `packages/types/src/constants/enums.ts`
- `MAINTENANCE_TASK_STATUS`: pending, in_progress, completed, skipped
- `MAINTENANCE_PRIORITY`: low, medium, high, critical

#### 1.3 Zod Validators in `packages/types/src/validators/maintenance-task.ts`
- `CreateMaintenanceTaskSchema`: motorcycleId, title, description?, dueDate?, targetMileage?, priority?, notes?, partsNeeded?
- `UpdateMaintenanceTaskSchema`: all optional
- `CompleteMaintenanceTaskSchema`: completedMileage?

#### 1.4 GraphQL Enums in `apps/api/src/common/enums/graphql-enums.ts`
- `GqlMaintenanceTaskStatus`, `GqlMaintenancePriority`

### Phase 2: API Module

#### 2.1 NestJS Module: `apps/api/src/modules/maintenance-tasks/`
- `maintenance-tasks.module.ts` — module definition
- `models/maintenance-task.model.ts` — @ObjectType with all fields
- `dto/create-maintenance-task.input.ts` — @InputType
- `dto/update-maintenance-task.input.ts` — @InputType
- `maintenance-tasks.service.ts` — CRUD operations via SUPABASE_USER
  - `findByMotorcycle(userId, motorcycleId)` — sorted by priority/due_date
  - `findById(userId, id)`
  - `create(userId, input)`
  - `update(userId, id, input)`
  - `complete(userId, id, completedMileage?)`
  - `softDelete(userId, id)`
- `maintenance-tasks.resolver.ts` — queries + mutations with GqlAuthGuard
  - Query: `maintenanceTasks(motorcycleId)` → sorted list
  - Mutation: `createMaintenanceTask(input)` → new task
  - Mutation: `updateMaintenanceTask(id, input)` → updated task
  - Mutation: `completeMaintenanceTask(id, completedMileage?)` → completed task
  - Mutation: `deleteMaintenanceTask(id)` → soft delete

#### 2.2 Register in AppModule
Add `MaintenanceTasksModule` to imports in `app.module.ts`

### Phase 3: GraphQL Operations & Codegen

#### 3.1 Mobile GraphQL Files
- `apps/mobile/src/graphql/queries/maintenance-tasks-by-motorcycle.graphql`
- `apps/mobile/src/graphql/mutations/create-maintenance-task.graphql`
- `apps/mobile/src/graphql/mutations/update-maintenance-task.graphql`
- `apps/mobile/src/graphql/mutations/complete-maintenance-task.graphql`
- `apps/mobile/src/graphql/mutations/delete-maintenance-task.graphql`

#### 3.2 Run `pnpm generate` to regenerate types

### Phase 4: Mobile UI

#### 4.1 Query Keys
Add to `apps/mobile/src/lib/query-keys.ts`:
```ts
maintenanceTasks: {
  all: ['maintenance-tasks'] as const,
  byMotorcycle: (motorcycleId: string) => ['maintenance-tasks', 'motorcycle', motorcycleId] as const,
}
```

#### 4.2 Bike Detail Tabs
Modify `apps/mobile/src/app/(tabs)/(garage)/bike/[id].tsx`:
- Add a segmented control or tab bar: **Details** | **Maintenance**
- Maintenance tab shows task list sorted by urgency

#### 4.3 Maintenance Task List (within bike detail)
- Urgency badges: Urgent (red/palette.danger500), Soon (amber/palette.warning500), Upcoming (green/palette.success500)
- Each task row: checkbox, title, urgency badge, due date
- Expandable: tap to show notes, parts needed
- Checkbox marks complete → mutation → moves to history section
- Two sections: "Active Tasks" and "History" (completed)

#### 4.4 Add Maintenance Task Modal
New file: `apps/mobile/src/app/(tabs)/(garage)/add-maintenance-task.tsx`
- `presentation: 'formSheet'`
- Fields: title (required), target mileage, target date (DateTimePicker), notes, priority selector
- Register in garage `_layout.tsx`

#### 4.5 FAB or Button on Maintenance Tab
- "Add Task" button to navigate to add-maintenance-task modal

---

## File Manifest

| # | File | Action | Phase |
|---|------|--------|-------|
| 1 | `supabase/migrations/00020_create_maintenance_tasks_table.sql` | Create | 1 |
| 2 | `packages/types/src/constants/enums.ts` | Edit | 1 |
| 3 | `packages/types/src/validators/maintenance-task.ts` | Create | 1 |
| 4 | `packages/types/src/validators/index.ts` | Edit | 1 |
| 5 | `apps/api/src/common/enums/graphql-enums.ts` | Edit | 1 |
| 6 | `apps/api/src/modules/maintenance-tasks/maintenance-tasks.module.ts` | Create | 2 |
| 7 | `apps/api/src/modules/maintenance-tasks/models/maintenance-task.model.ts` | Create | 2 |
| 8 | `apps/api/src/modules/maintenance-tasks/dto/create-maintenance-task.input.ts` | Create | 2 |
| 9 | `apps/api/src/modules/maintenance-tasks/dto/update-maintenance-task.input.ts` | Create | 2 |
| 10 | `apps/api/src/modules/maintenance-tasks/maintenance-tasks.service.ts` | Create | 2 |
| 11 | `apps/api/src/modules/maintenance-tasks/maintenance-tasks.resolver.ts` | Create | 2 |
| 12 | `apps/api/src/app.module.ts` | Edit | 2 |
| 13 | `apps/mobile/src/graphql/queries/maintenance-tasks-by-motorcycle.graphql` | Create | 3 |
| 14 | `apps/mobile/src/graphql/mutations/create-maintenance-task.graphql` | Create | 3 |
| 15 | `apps/mobile/src/graphql/mutations/complete-maintenance-task.graphql` | Create | 3 |
| 16 | `apps/mobile/src/graphql/mutations/delete-maintenance-task.graphql` | Create | 3 |
| 17 | `apps/mobile/src/lib/query-keys.ts` | Edit | 4 |
| 18 | `apps/mobile/src/app/(tabs)/(garage)/bike/[id].tsx` | Edit | 4 |
| 19 | `apps/mobile/src/app/(tabs)/(garage)/add-maintenance-task.tsx` | Create | 4 |
| 20 | `apps/mobile/src/app/(tabs)/(garage)/_layout.tsx` | Edit | 4 |

## Dependencies
- Supabase local running (`pnpm db:start`)
- After migration: `pnpm db:reset && pnpm generate:types`
- After API changes: `pnpm generate` (full pipeline)
