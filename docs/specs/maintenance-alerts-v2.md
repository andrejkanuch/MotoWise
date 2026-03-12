# Maintenance Alerts v2 — PRD + Architecture Spec

**Author:** Claude (AI-assisted)
**Date:** 2026-03-11
**Status:** Draft
**Stakeholders:** Engineering, Product, Design

---

## 1. Problem Statement

The current maintenance alert system has three interconnected issues that degrade the user experience:

**P1 — Unreliable navigation from Home:** When a user taps a maintenance alert (e.g., "Tire Pressure") on the Home screen, navigation to the bike detail page is inconsistent. It works sometimes and fails silently other times.

**P2 — "Done" tasks reappear immediately:** When a user marks a recurring maintenance task as "Done" on the bike detail page, a new identical-looking task instantly appears in the active list. The user perceives this as the task "coming back" rather than a new future occurrence being scheduled. Non-recurring tasks also appear to linger briefly due to cache/refetch timing.

**P3 — No user control over recurrence:** Recurring tasks silently auto-generate the next occurrence. Non-recurring tasks offer no prompt to schedule future maintenance. Both feel like the system is working against the user rather than for them.

These issues compound into a frustrating loop: the user completes work → sees it reappear → loses trust in the system → stops using maintenance tracking.

---

## 2. Root Cause Analysis

### Bug 1: Intermittent Navigation

**File:** `apps/mobile/src/app/(tabs)/(home)/index.tsx` (line 151–155)

```typescript
onTaskPress={(motorcycleId) =>
  router.navigate({
    pathname: '/(tabs)/(garage)/bike/[id]',
    params: { id: motorcycleId },
  })
}
```

**Root cause:** `router.navigate()` is idempotent in expo-router. If the Garage tab already has `bike/[id]` in its stack (from a previous visit), `navigate` deduplicates and does nothing. This is the "sometimes works, sometimes doesn't" behavior — it depends on whether the route is already in the tab's stack.

**Fix:** Use `router.push()` instead of `router.navigate()`, OR reset the garage tab stack before navigating. However, `push` would stack duplicate screens. The better fix is a dedicated maintenance task detail route that doesn't depend on bike detail.

### Bug 2: Tasks Reappearing After "Done"

**Files:**
- `apps/api/src/modules/maintenance-tasks/maintenance-tasks.resolver.ts` (line 82–84)
- `apps/api/src/modules/maintenance-tasks/maintenance-tasks.service.ts` (`findByMotorcycle`, line 50–68)

**Root causes (two separate issues):**

1. **Recurring tasks auto-clone silently.** When `completeMaintenanceTask` runs, the resolver calls `createNextRecurrence()` which inserts a new `pending` task with the exact same title. The client then refetches and sees what appears to be the same task back in the active list.

2. **`findByMotorcycle` returns ALL statuses.** Unlike `findAllForUser` (which filters to `pending`/`in_progress`), the bike detail query has no status filter. The client filters in JS (`activeTasks`/`completedTasks`), but during the invalidation/refetch window, the completed task may briefly flash in both lists due to optimistic update timing.

### Bug 3: No Recurrence Control

**Root cause:** The recurrence system is entirely server-driven. When `is_recurring = true`, completing a task always creates the next one — no user confirmation, no option to skip, no prompt for non-recurring tasks. The `completeMaintenanceTask` mutation returns only the completed task, not the newly created one, so the client has no awareness of what just happened.

---

## 3. Goals

| # | Goal | Metric |
|---|------|--------|
| G1 | Eliminate navigation failures from Home → task | 0 failed navigations (deterministic routing) |
| G2 | Completing a task feels final and satisfying | Task visually exits with animation; no "ghost reappearance" |
| G3 | Users understand and control recurring maintenance | 80%+ of users who complete a recurring task interact with the "schedule next" prompt |
| G4 | Non-recurring task completion offers future scheduling | 30%+ conversion rate from "Done" → "Schedule next" for non-recurring tasks |
| G5 | Reduce maintenance-related frustration | 50% reduction in task delete actions (proxy for "gave up on the feature") |

---

## 4. Non-Goals

| # | Non-Goal | Reason |
|---|----------|--------|
| N1 | Push notification overhaul | Separate initiative; current local notifications are adequate |
| N2 | OEM schedule import redesign | The `oem_maintenance_schedules` system works; this spec focuses on task lifecycle |
| N3 | Multi-bike batch operations | Low usage; adds complexity without solving the core frustration |
| N4 | Cost tracking improvements | Orthogonal feature; current `cost`/`partsCost`/`laborCost` fields are sufficient |
| N5 | Maintenance history analytics | Valuable but separate scope; history view works correctly today |

---

## 5. User Stories

**US1 — Reliable task navigation:**
As a rider on the Home screen, I want to tap any maintenance alert and reliably land on that specific task so that I can take action on it immediately.

**US2 — Satisfying completion:**
As a rider completing a task, I want to see it visually leave the active list with a success animation so that I trust the action was recorded.

**US3 — Controlled recurrence:**
As a rider completing a recurring task (e.g., oil change every 5,000 km), I want to be asked whether to schedule the next occurrence and when, so that I stay in control of my maintenance schedule.

**US4 — Optional future scheduling:**
As a rider completing a one-time task, I want to be offered (but not required) to schedule it again in the future so that I can easily set up recurring maintenance.

**US5 — Completion context capture:**
As a rider marking a task as done, I want to optionally record my current mileage and cost so that I can track spending and interval accuracy over time.

**US6 — Skip/snooze recurrence:**
As a rider who doesn't want to schedule the next occurrence right now, I want to dismiss the prompt and have the system remember my choice so that I'm not nagged.

---

## 6. Requirements

### P0 — Must-Have

**R1. Fix Home → Task navigation**
- Replace `router.navigate()` with deterministic navigation that always works regardless of tab stack state.
- Preferred approach: navigate to Garage tab, then push bike detail with a `scrollToTask` param so the specific task is highlighted/expanded on arrival.
- Acceptance criteria:
  - Given any maintenance alert on the Home screen
  - When the user taps it
  - Then they land on the bike detail page with that task visible and expanded
  - This works 100% of the time regardless of navigation history

**R2. Completion confirmation sheet**
- When the user taps "Done" on a task, present a bottom sheet (formSheet on iOS) instead of immediately completing.
- Sheet contains:
  - Task title + bike name (read-only confirmation)
  - Optional mileage input (pre-filled with bike's `currentMileage` if available)
  - Optional cost input
  - "Complete" primary button
  - "Cancel" to dismiss
- For recurring tasks, the sheet additionally shows:
  - "Schedule next" toggle (default ON for recurring, OFF for non-recurring)
  - Next due date (auto-calculated from `interval_days`, editable)
  - Next target mileage (auto-calculated from `interval_km`, editable)
- Acceptance criteria:
  - Given a task with `is_recurring = true` and `interval_days = 90`
  - When the user taps "Done"
  - Then the sheet shows "Schedule next in 90 days (June 10, 2026)" with the option to adjust
  - When the user taps "Complete"
  - Then the current task is completed AND the next occurrence is created with the user's chosen date

**R3. Animated task exit**
- After the user confirms completion in the sheet, the task card animates out of the active list (e.g., `FadeOutLeft` or `SlideOutRight`, 250ms).
- If a new recurring task was created, it fades in after a 500ms delay so the user perceives two distinct events: "old task done" → "new task scheduled."
- Acceptance criteria:
  - Given a completed task in the active list
  - When the completion mutation succeeds
  - Then the task animates out before being removed from the list
  - If a next occurrence exists, it appears with a `FadeInUp` animation after a visible delay

**R4. Server-side completion response includes next task**
- Modify `completeMaintenanceTask` mutation to return both the completed task AND the newly created next occurrence (if any).
- New return type: `CompleteMaintenanceTaskResult { completed: MaintenanceTask, nextOccurrence: MaintenanceTask? }`
- The client uses this to orchestrate the animation sequence without needing a refetch.
- Acceptance criteria:
  - Given a recurring task being completed
  - When the mutation resolves
  - Then the response includes both the completed task (status=completed) and the new pending task
  - The client does NOT need to invalidate/refetch to show the new task

**R5. Optimistic task removal from active list**
- When the user confirms completion, immediately remove the task from the local `activeTasks` array before the mutation resolves.
- On mutation error, restore the task to its previous position with an error toast.
- This eliminates any flicker where the completed task is briefly visible in the active list during refetch.

### P1 — Nice-to-Have

**R6. "Schedule next" prompt for non-recurring tasks**
- After completing a non-recurring task, show a subtle prompt: "Want to schedule this again?"
- If yes, open a mini-form to set the next due date/mileage and creates a new task with `is_recurring = false` (one-time clone).
- This captures the common pattern of users who do the same maintenance periodically but haven't set up recurrence.

**R7. Task snooze**
- Add a "Snooze" action (alongside Done and Delete) that pushes the due date forward by a configurable amount (1 day, 1 week, 1 month).
- Prevents users from deleting tasks just because they're not ready yet.

**R8. Deep link to specific task**
- Support `/(tabs)/(garage)/bike/[id]?task=[taskId]` parameter.
- When present, auto-scroll to and expand the specific task card on the bike detail page.
- This makes Home → task navigation pixel-precise.

### P2 — Future Considerations

**R9. Maintenance schedule templates**
- Pre-built maintenance schedules by bike model (e.g., "Honda CB500F — OEM intervals").
- Auto-populate tasks when a user adds a new bike.

**R10. Smart interval suggestions**
- Based on completion history, suggest adjusted intervals (e.g., "You usually do this every 80 days, not 90. Adjust?").

---

## 7. Technical Architecture

### 7.1 Database Changes

#### New: `maintenance_task_completions` table

Instead of mutating the task row in-place on completion, we introduce a separate completions log. This cleanly separates "the recurring schedule" from "individual completions" and solves the ghost reappearance problem.

**However**, this is a P2 architectural improvement. For v1, we keep the current single-table approach and fix the UX issues with client-side and resolver changes. The rationale: the current schema works correctly — the problems are all in the completion flow UX and the navigation code.

#### V1 Changes (no migration needed)

No schema changes required. The current `maintenance_tasks` table structure is sufficient. The fixes are:

1. **Resolver change:** `completeMaintenanceTask` returns a compound type including the optional next occurrence.
2. **Client change:** Optimistic updates + completion sheet UI.
3. **Navigation change:** Deterministic routing from Home.

#### V2 Schema (future — if v1 isn't sufficient)

If the v1 approach reveals deeper issues (e.g., task ID confusion between original and clone), consider:

```sql
-- New table: tracks individual completion events
CREATE TABLE maintenance_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES maintenance_tasks(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_mileage INT,
  cost NUMERIC,
  parts_cost NUMERIC,
  labor_cost NUMERIC,
  currency TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Move completion fields off maintenance_tasks:
-- Remove: completed_at, completed_mileage, cost, parts_cost, labor_cost, currency
-- Add: last_completed_at TIMESTAMPTZ (denormalized for quick queries)
-- Change status semantics: 'active' (has future due date) | 'paused' (user snoozed) | 'archived'
```

This model treats a maintenance task as a "schedule definition" and completions as individual events. A recurring oil change is ONE task row with MANY completion rows. This eliminates the clone-on-complete pattern entirely.

**Trade-off:** More complex queries for the bike detail page (need to join completions), but eliminates the "ghost task" problem at the data layer. Recommended for v2 if v1 UX fixes aren't sufficient.

### 7.2 GraphQL API Changes

#### New return type

```graphql
type CompleteMaintenanceTaskResult {
  completed: MaintenanceTask!
  nextOccurrence: MaintenanceTask
  # True if a next occurrence was auto-created (helps client animate)
  hasNextOccurrence: Boolean!
}
```

#### Modified mutation

```graphql
mutation CompleteMaintenanceTask(
  $id: String!
  $input: CompleteMaintenanceTaskInput
  # New: let client control whether to create next occurrence
  $createNextOccurrence: Boolean
  # New: let client override the next due date
  $nextDueDate: String
  $nextTargetMileage: Int
) {
  completeMaintenanceTask(
    id: $id
    input: $input
    createNextOccurrence: $createNextOccurrence
    nextDueDate: $nextDueDate
    nextTargetMileage: $nextTargetMileage
  ) {
    completed {
      id, status, completedAt, completedMileage, cost
    }
    nextOccurrence {
      id, title, dueDate, targetMileage, priority, status
    }
    hasNextOccurrence
  }
}
```

**Key change:** The client now explicitly tells the server whether to create the next occurrence (`createNextOccurrence`), rather than the server deciding based on `is_recurring`. This puts the user in control.

### 7.3 Resolver Changes

```
// maintenance-tasks.resolver.ts — completeMaintenanceTask

1. Complete the task (set status, completed_at, costs)
2. IF createNextOccurrence param is true (or undefined + task.isRecurring):
   a. Use nextDueDate/nextTargetMileage if provided by client
   b. Otherwise fall back to interval_days/interval_km calculation
   c. Create next task row
   d. Return { completed, nextOccurrence, hasNextOccurrence: true }
3. ELSE:
   Return { completed, nextOccurrence: null, hasNextOccurrence: false }
```

### 7.4 Mobile Client Changes

#### Navigation Fix (R1 + R8)

```
// Home screen onTaskPress handler
onTaskPress={(motorcycleId, taskId) => {
  // Use router.push to guarantee navigation, include taskId for scroll-to
  router.push({
    pathname: '/(tabs)/(garage)/bike/[id]',
    params: { id: motorcycleId, highlightTask: taskId },
  });
}}
```

The `MaintenanceSummary` component needs to pass `taskId` alongside `motorcycleId`. The `MaintenanceTaskRow.onPress` callback signature changes from `() => void` to include the task ID.

On the bike detail page, read `highlightTask` from route params and auto-expand + scroll to that task card on mount.

#### Completion Sheet (R2)

New component: `CompleteTaskSheet.tsx` (bottom sheet / formSheet modal).

```
Props:
  task: MaintenanceTask
  bikeName: string
  currentMileage?: number
  onComplete: (input: CompleteInput) => void
  onCancel: () => void

State:
  mileage: number (pre-filled from bike.currentMileage)
  cost: number (empty)
  scheduleNext: boolean (default: task.isRecurring)
  nextDueDate: Date (auto-calculated)
  nextTargetMileage: number (auto-calculated)

Flow:
  1. User taps "Done" → sheet opens (task card stays in place)
  2. User fills optional fields, toggles "schedule next"
  3. User taps "Complete" → sheet dismisses
  4. Task card animates out (FadeOutLeft, 250ms)
  5. Mutation fires with all params
  6. On success: if nextOccurrence exists, insert into activeTasks with FadeInUp after 500ms delay
  7. On error: restore task to active list, show error toast
```

#### Optimistic Updates (R5)

```typescript
// In completeMutation.onMutate:
1. Cancel outgoing refetches for task queries
2. Snapshot previous task data
3. Remove the task from activeTasks cache immediately
4. Return { previousTasks } for rollback

// In completeMutation.onError:
1. Restore previousTasks from context
2. Show error toast

// In completeMutation.onSuccess:
1. If response.hasNextOccurrence:
   - After 500ms delay, insert response.nextOccurrence into activeTasks cache
2. Invalidate queries in background (for full consistency)
```

### 7.5 Animation Sequence

```
t=0ms:    User taps "Complete" in sheet
t=0ms:    Sheet dismisses
t=50ms:   Task card begins FadeOutLeft (250ms duration)
t=300ms:  Task card removed from list, other cards slide up (LayoutAnimation)
t=300ms:  Mutation fires in background
t=800ms:  If next occurrence: new task card FadeInUp at appropriate sort position
t=800ms:  Brief "✓ Completed" toast appears (1.5s auto-dismiss)
```

This timing creates a clear "done → new" perception rather than "done → same thing back."

---

## 8. Implementation Plan

### Phase 1: Navigation Fix (1 day)

1. Change `MaintenanceSummary.onTaskPress` to pass both `motorcycleId` and `taskId`
2. Change Home page handler to use `router.push` with `highlightTask` param
3. Add `highlightTask` param handling in `bike/[id].tsx` (auto-expand + scroll)
4. Test: navigate from Home to every possible task across multiple bikes

### Phase 2: API Changes (1 day)

1. Create `CompleteMaintenanceTaskResult` model
2. Add `createNextOccurrence`, `nextDueDate`, `nextTargetMileage` params to resolver
3. Update resolver to return compound result
4. Update GraphQL operation file + run `pnpm generate`
5. Test: complete recurring and non-recurring tasks via GraphQL playground

### Phase 3: Completion Sheet UI (2–3 days)

1. Build `CompleteTaskSheet` component (bottom sheet with form fields)
2. Wire up to bike detail page (replace direct `completeMutation.mutate()` call)
3. Implement optimistic update logic in the mutation hooks
4. Add exit/enter animations with proper timing
5. Test: complete tasks of all types, verify animation sequence, test error rollback

### Phase 4: Polish + Edge Cases (1 day)

1. Handle "Schedule next" for non-recurring tasks (R6)
2. Ensure task count badges update correctly on Home after completion
3. Test cross-tab consistency (complete on bike detail → Home reflects change)
4. Verify health score recalculates after completion
5. Performance test with 20+ tasks per bike

**Total estimate: 5–6 days**

---

## 9. Success Metrics

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| Navigation success rate (Home → task) | ~60% (intermittent) | 100% | Analytics event on tap + arrival |
| Task delete rate (proxy for frustration) | Current baseline TBD | -50% | Delete mutation count / active users |
| "Schedule next" interaction rate | 0% (doesn't exist) | 80% of recurring completions | Sheet interaction analytics |
| Non-recurring → schedule conversion | 0% | 30% | "Schedule next" taps on non-recurring |
| Time from "Done" tap to task exit | ~200ms (flicker) | Smooth 300ms animation | Visual QA |

---

## 10. Open Questions

| # | Question | Owner | Blocking? |
|---|----------|-------|-----------|
| Q1 | Should the completion sheet be a full formSheet modal or an inline bottom sheet? formSheet is more consistent with add-bike, but bottom sheet is faster to dismiss. | Design | No (default: formSheet) |
| Q2 | For v2 schema: should we migrate existing completion data into a separate `maintenance_completions` table, or only use it for new completions? | Engineering | No (v2 scope) |
| Q3 | Should snooze (R7) be a swipe action or a button? Swipe is discoverable on iOS but less so on Android. | Design | No (P1 scope) |
| Q4 | Do we need to handle the edge case where a user completes a task offline? Current implementation requires network. | Engineering | No (existing limitation) |

---

## 11. Files to Modify

### Navigation Fix
- `apps/mobile/src/components/home/maintenance-summary.tsx` — pass taskId in onTaskPress
- `apps/mobile/src/components/home/maintenance-task-row.tsx` — include task.id in onPress
- `apps/mobile/src/app/(tabs)/(home)/index.tsx` — update onTaskPress handler to use router.push + highlightTask param
- `apps/mobile/src/app/(tabs)/(garage)/bike/[id].tsx` — read highlightTask param, auto-expand + scroll

### API Changes
- `apps/api/src/modules/maintenance-tasks/models/` — new `CompleteMaintenanceTaskResult` model
- `apps/api/src/modules/maintenance-tasks/maintenance-tasks.resolver.ts` — update return type + params
- `apps/api/src/modules/maintenance-tasks/maintenance-tasks.service.ts` — update `createNextRecurrence` to accept overrides
- `apps/mobile/src/graphql/mutations/complete-maintenance-task.graphql` — update operation
- Run `pnpm generate` after all GQL changes

### Completion Sheet
- `apps/mobile/src/components/maintenance/complete-task-sheet.tsx` — **new file**
- `apps/mobile/src/app/(tabs)/(garage)/bike/[id].tsx` — integrate sheet, add optimistic updates + animations
