---
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
product_contract_source: ce-plan-bootstrap
title: "feat: Edit/reschedule a maintenance task (mobile)"
date: 2026-07-14
type: feat
depth: standard
---

# feat: Edit/reschedule a maintenance task (mobile)

## Summary

Riders can create, complete, and delete a maintenance task in the mobile app, but they **cannot edit one**. To fix a typo, push a due date, bump the priority, or change a recurring interval, the only path today is delete + recreate — which throws away the task's completion history and attached photos. The NestJS API already exposes a fully-wired `updateMaintenanceTask` mutation (`apps/api/src/modules/maintenance-tasks/maintenance-tasks.resolver.ts:63`) that the mobile app never calls. This plan closes that gap: add the client mutation, an edit screen that mirrors the existing add screen, reminder rescheduling on save, and an edit entry point from the task card.

This was the #1-ranked "S-tier" quick win from the 2026-07-14 maintenance-checklist investigation.

**Product Contract preservation:** N/A — no upstream brainstorm; direct plan from the investigation finding.

---

## Problem Frame

- **What's broken:** No update path exists on the client. `apps/mobile/src/graphql/mutations/` has `create`, `complete`, and `delete` maintenance-task mutations but **no update** mutation, and there is no edit screen.
- **Who it affects:** Every rider maintaining a bike — editing is a routine expectation, and the delete+recreate workaround destroys history/photos (the data the client specifically praised keeping).
- **Why now:** Zero server work required — the mutation, DTO (`UpdateMaintenanceTaskInput`), and Zod schema (`UpdateMaintenanceTaskSchema`) already exist and validate. This is pure client wiring.

---

## Requirements

- **R1** — A rider can open an existing (non-completed) task in an edit screen pre-filled with its current values: title, priority, due date, target mileage, recurring toggle + intervals, description, notes.
- **R2** — Saving persists changes via the existing `updateMaintenanceTask` mutation and refreshes the task lists (bike hub + all-tasks + all-user) so the edit is visible immediately.
- **R3** — Editing preserves the task's identity (same `id`) — completion history, photos, and `source` are untouched (guaranteed by using update, not delete+recreate).
- **R4** — Local reminders stay consistent with the edited due date: rescheduled when a due date is present/changed, cancelled when the due date is removed.
- **R5** — An edit entry point is discoverable from the task card action row (alongside Done / Delete), wired everywhere the card renders.
- **R6** — All new user-facing copy goes through `t()` (per mobile i18n rules) and does not regress the i18n ratchet.

---

## Key Technical Decisions

- **KTD1 — Prefill from the TanStack cache, not a new by-id query.** `MaintenanceTasksByMotorcycleDocument` already returns every editable field (`apps/mobile/src/graphql/queries/maintenance-tasks-by-motorcycle.graphql:1-35`). The edit screen reads the task from the cached query by `taskId`, exactly as `complete-task.tsx:77-87` does. No new query, no server change. Rationale: the user always reaches edit from a list that has already fetched the task, so the cache is warm; a network round-trip to re-fetch one task is wasted.
- **KTD2 — New edit screen file, not an `add-maintenance-task.tsx` mode flag.** Add a sibling `edit-maintenance-task.tsx` rather than overloading the add screen with an `edit` param. Rationale: the add screen is already 800+ lines; the two screens differ in prefill, mutation, button copy, and reminder-cancel-on-clear logic. A separate file keeps each readable and matches the repo's screen-per-route convention. The shared visual scaffolding (section cards, priority pills, date picker, recurring inputs) is copied over — acceptable duplication given the app's "inline styles unless reused across components" convention; extracting a shared form component is explicitly deferred (see Scope Boundaries).
- **KTD3 — Reschedule reminders through the existing `scheduleMaintenanceReminder`.** It already cancels prior stages for the task before scheduling (`notifications.ts:226`), so calling it on save is idempotent. When the edited task has **no** due date, call `cancelTaskNotification(taskId)` instead (mirror of `complete-task.tsx:104`). Rationale: reuse the battle-tested scheduler; do not hand-roll stage math.
- **KTD4 — i18n: reuse existing `maintenance.*` keys; new strings use `t()` with `defaultValue` inline and are NOT added to `en.json`.** The edit screen reuses almost every label from the add screen (`maintenance.priority`, `maintenance.dueDate`, `maintenance.schedule`, etc.). For the 2-3 genuinely new strings (edit header, "Save changes", update-failed error), use `t('key', { defaultValue: '...' })` without adding the key to `en.json`. Rationale: the i18n ratchet (`scripts/check-i18n-new-keys.ts`) blocks new `en.json` keys absent from any of the 13 locales; keeping new keys out of `en.json` and relying on `defaultValue` keeps CI green without a 13-locale translation pass. The literal `defaultValue` argument is allowed by the `no-literal-string` guard (it flags JSX text, not string args).

---

## Implementation Units

### U1. Add the `updateMaintenanceTask` client mutation + regenerate types

**Goal:** Give the mobile app a typed `UpdateMaintenanceTaskDocument` to call.

**Requirements:** R2, R3

**Dependencies:** none

**Files:**
- `apps/mobile/src/graphql/mutations/update-maintenance-task.graphql` (create)
- `packages/graphql/src/generated/*` (regenerated — do not hand-edit)

**Approach:**
- Mirror `create-maintenance-task.graphql` but call `updateMaintenanceTask(id: $id, input: $input)`. The mutation signature is `updateMaintenanceTask(id: ID!, input: UpdateMaintenanceTaskInput!)` (resolver `:63-71`). Select the same fields the create mutation returns plus the ones the edit UI/reschedule need: `id, title, priority, status, dueDate, targetMileage, notes, description, isRecurring, intervalKm, intervalDays, remind30d, remind7d, remind1d, updatedAt`.
- Run `pnpm generate` after adding the file (repo rule: regenerate after any `.graphql` change; the pre-commit hook also enforces this). Re-stage generated files.

**Patterns to follow:** `apps/mobile/src/graphql/mutations/create-maintenance-task.graphql`.

**Test scenarios:** `Test expectation: none — codegen artifact + GraphQL document. Validated by codegen succeeding against the schema (the pre-commit hook and CI both validate every .graphql document) and by U2 typechecking against the generated document.`

**Verification:** `pnpm generate` completes with no schema errors; `UpdateMaintenanceTaskDocument` is exported from `@motovault/graphql`.

---

### U2. Build the `edit-maintenance-task` screen

**Goal:** A pre-filled form that updates an existing task and reschedules its reminder.

**Requirements:** R1, R2, R3, R4, R6

**Dependencies:** U1

**Files:**
- `apps/mobile/src/app/(tabs)/(garage)/edit-maintenance-task.tsx` (create)
- `apps/mobile/src/lib/analytics.ts` (modify — add `MAINTENANCE_TASK_UPDATED` to the `AnalyticsEvent` map)

**Approach:**
- Copy the visual scaffolding and state shape from `add-maintenance-task.tsx` (section cards, priority pills, inline date picker, target-mileage row, recurring toggle + interval inputs, description/notes card, footer).
- Params: `taskId`, `motorcycleId`, `bikeName` (via `useLocalSearchParams`). Read the task from the cache with the `MaintenanceTasksByMotorcycleDocument` query using the `initialData` cache-read pattern from `complete-task.tsx:77-87`, then `find` by `taskId`.
- **Prefill** all form state from the loaded task on first render (title, description, dueDate → `new Date(task.dueDate)`, targetMileage → string, priority, notes, isRecurring, intervalKm/intervalDays → strings). Guard for the task not being in cache yet (show nothing / loading until present; if truly absent, keep fields empty so the screen still functions).
- **Save** via `useMutation` calling `gqlFetcher(UpdateMaintenanceTaskDocument, { id: taskId, input: {...} })`. Build `input` the same way the create screen builds it (trim strings, `undefined` for empties, parse ints). For fields the user can clear (description, notes, targetMileage, dueDate), send explicit clears per the schema — the Zod `UpdateMaintenanceTaskSchema` accepts `.nullable()` for `description/dueDate/targetMileage/notes`, so send `null` to clear vs a value to set. (Title uses `nullishToUndefined`, so never send an empty title — keep the existing `!title.trim()` disable on the save button.)
- **onSuccess** (mirror create screen `:68-112`): invalidate `queryKeys.maintenanceTasks.byMotorcycle(motorcycleId)` and `queryKeys.maintenanceTasks.allUser`; run the reminder reschedule (see below); `trackEvent(AnalyticsEvent.MAINTENANCE_TASK_UPDATED, { priority, is_recurring, has_due_date })`; success haptic; `setSaved(true)`; `setTimeout(() => router.back(), 600)`.
- **Reminder reschedule (R4, KTD3):** in `onSuccess`, if the edited `dueDate` is set, call `scheduleMaintenanceReminder({ id: taskId, title, dueDate: toISODateInput(dueDate), motorcycleId, remind30d, remind7d, remind1d }, bikeName ?? 'Your bike')` using the remind flags from the mutation response. If `dueDate` is null/cleared, call `cancelTaskNotification(taskId)`.
- **onError:** `Alert.alert` with `t('common.error', ...)` + `t('maintenance.updateFailed', { defaultValue: 'Failed to update task. Please try again.' })`.
- **Copy (KTD4):** header reads "Edit task" (`t('maintenance.editPrefix', { defaultValue: 'Edit' })` + existing `maintenance.taskSuffix`); save button reads `t('maintenance.saveChanges', { defaultValue: 'Save changes' })`; reuse every other label key from the add screen verbatim.

**Execution note:** Mostly UI wiring cloned from a known-good screen; prefer smoke verification (drive the edit flow in the simulator) over heavy unit coverage. Add unit coverage only for the reminder-reschedule decision (see scenarios).

**Patterns to follow:** `add-maintenance-task.tsx` (form + create mutation + reminder scheduling), `complete-task.tsx:77-104` (cache-read prefill + `cancelTaskNotification` on state change).

**Test scenarios:**
- Reminder-reschedule decision (extract the branch into a small pure helper if it eases testing, e.g. `resolveReminderAction(dueDate)` returning `{ kind: 'schedule' | 'cancel' }`):
  - Given a task saved **with** a future due date → action is `schedule` and `scheduleMaintenanceReminder` is invoked with the task's remind flags. *(happy path)*
  - Given a task saved with the due date **cleared** (null) → action is `cancel` and `cancelTaskNotification(taskId)` is invoked, `scheduleMaintenanceReminder` is not. *(edge/clear path)*
  - Given a due date in the **past** → `scheduleMaintenanceReminder` is still called but internally schedules nothing (`daysUntilDue < 0` guard at `notifications.ts:223`); assert no throw. *(boundary)*
- Update-input mapping (if a `buildUpdateInput(formState)` helper is extracted):
  - Empty description/notes/mileage → sent as `null` (clear), not `''`. *(edge)*
  - Non-recurring task → `intervalKm`/`intervalDays` omitted/undefined. *(happy path)*
- `Covers R4` for the reminder scenarios above.

**Verification:** In the simulator, open an existing task → Edit → change title + push due date + toggle recurring → Save → the list reflects the change with the same task id, history/photos intact, and a rescheduled local reminder (no duplicate stages).

---

### U3. Register the edit screen route

**Goal:** Make `edit-maintenance-task` a navigable route with modal presentation matching the add screen.

**Requirements:** R1

**Dependencies:** U2

**Files:**
- `apps/mobile/src/app/(tabs)/(garage)/_layout.tsx` (modify)

**Approach:** Add a `<Stack.Screen name="edit-maintenance-task" ... />` entry copying the `add-maintenance-task` options block (`_layout.tsx:55-67`): `presentation: 'formSheet'`, `sheetGrabberVisible: true`, `sheetAllowedDetents: [0.85, 1.0]`, `sheetHeaderStyle`, `sheetContentStyle`. Title: `t('garage.editMaintenanceTask', { defaultValue: 'Edit Task' })`.

**Patterns to follow:** the `add-maintenance-task` Stack.Screen block in the same file.

**Test scenarios:** `Test expectation: none — route registration/config. Verified by navigation working in U4's manual smoke.`

**Verification:** Navigating to `/(tabs)/(garage)/edit-maintenance-task` presents the form as a form sheet with the correct title.

---

### U4. Add an "Edit" entry point from the task card

**Goal:** Let riders reach the edit screen from the task card's action row, wired at every render site.

**Requirements:** R5

**Dependencies:** U2, U3

**Files:**
- `apps/mobile/src/components/bike-hub/swipeable-task-card.tsx` (modify — add optional `onEdit` prop + an Edit action button)
- `apps/mobile/src/app/(tabs)/(garage)/bike-tasks.tsx` (modify — add `handleEdit`, pass `onEdit`)
- `apps/mobile/src/components/bike-hub/maintenance-section.tsx` (modify — pass `onEdit` where it renders `SwipeableTaskCard`, so the bike-hub card also gets Edit)

**Approach:**
- In `SwipeableTaskCard`, add `onEdit?: (id: string) => void` to the props type (`swipeable-task-card.tsx:41-51`). In the action-row (`:190-240`), add an Edit `Pressable` (only when `!isCompleted` and `onEdit` is provided) between Done and Delete, using a `Pencil` icon from `lucide-react-native` and `t('common.edit', { defaultValue: 'Edit' })`. Match the existing button styling (flex:1, borderRight separators). Keep the prop optional so no call site breaks at compile time.
- In `bike-tasks.tsx`, add `handleEdit(taskId)` that does `router.push({ pathname: '/(tabs)/(garage)/edit-maintenance-task', params: { taskId, motorcycleId, bikeName: bikeName ?? '' } })` — mirroring `handleComplete` (`:132-137`) — and pass `onEdit={handleEdit}` to `SwipeableTaskCard` (`:300-311`).
- In `maintenance-section.tsx`, add the same `onEdit` handler at its `SwipeableTaskCard` render site so the bike-hub list gets the Edit action too. (If the bike-hub card is rendered read-only there, at minimum keep parity by wiring the same push.)

**Patterns to follow:** the existing Done/Delete `Pressable`s in `swipeable-task-card.tsx:198-239`; `handleComplete` route push in `bike-tasks.tsx:132-137`.

**Test scenarios:**
- Card renders an Edit action when `onEdit` is provided and the task is not completed; no Edit action when `onEdit` is omitted or the task is completed. *(happy path + edge)*
- Tapping Edit calls `onEdit` with the task id. *(happy path)*
- `Covers R5.`

**Verification:** From both the bike hub maintenance section and the All Tasks screen, expanding a pending task shows Edit; tapping it opens the pre-filled edit sheet; saving returns to the list with changes applied.

---

## Scope Boundaries

**In scope:** client update mutation, edit screen, route, reminder reschedule, task-card edit entry point, one analytics event, i18n-safe copy.

### Deferred to Follow-Up Work
- Editing `partsNeeded` (a structured parts list) — the add screen doesn't collect it either; tracked as its own maintenance-expansion item (investigation opportunity #4).
- Extracting a shared `<MaintenanceTaskForm>` component from the add + edit screens — intentional duplication now (KTD2); revisit if a third consumer appears.
- Editing cost fields (`partsCost`/`laborCost`) — belongs with the completion-flow cost-split expansion (investigation #4).
- Editing completed tasks — out of scope; edit targets pending/in-progress tasks only.

---

## Verification Contract

- `pnpm --filter mobile test` passes (new reminder-decision/input-mapping tests green).
- `pnpm precheck` (Biome + typecheck + test) passes; `pnpm generate` produces no diff beyond the new mutation types; the mobile ESLint i18n guard and `scripts/check-i18n.sh` report no new regressions.
- Manual smoke in the iOS simulator: edit a task's title, due date, priority, and recurring interval; confirm same-id persistence, history/photos intact, list refresh, and a single (non-duplicated) rescheduled reminder; clear a due date and confirm the reminder is cancelled.

## Definition of Done

- R1–R6 satisfied and demonstrated by the Verification Contract.
- Edit reachable from both the bike-hub maintenance section and the All Tasks screen.
- No new i18n ratchet failures; generated GraphQL types committed.
- CI green.

---

## Sources & Research

- Maintenance-checklist investigation, 2026-07-14 (edit/reschedule = ranked expansion opportunity #1).
- Server capability: `apps/api/src/modules/maintenance-tasks/maintenance-tasks.resolver.ts:63-71`, `dto/update-maintenance-task.input.ts`, `packages/types/src/validators/maintenance-task.ts:27-44`.
- Client patterns: `apps/mobile/src/app/(tabs)/(garage)/add-maintenance-task.tsx`, `complete-task.tsx:77-104`, `src/lib/notifications.ts:216-290`, `src/components/bike-hub/swipeable-task-card.tsx`, `bike-tasks.tsx:132-137`, `_layout.tsx:55-67`.
