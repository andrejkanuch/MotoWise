---
status: complete
priority: p1
issue_id: "152"
tags: [code-review, architecture, api, refactor]
dependencies: []
---

# Duplicate task-creation logic between OemSchedulesService and UsersService

## Problem Statement

`importAcceptedOemTasks` in `UsersService` (lines 260-283) is a near-copy of `autoPopulateForBike` in `OemSchedulesService` (lines 100-125). Both construct identical `tasksToInsert` arrays with the same shape. Only the filter differs. Additionally, `importAcceptedOemTasks` lacks the dedup check that `autoPopulateForBike` has — client retries create duplicate tasks.

## Findings

- **Code Simplicity Reviewer:** ~60 lines of duplicated task-building logic across two services
- **Architecture Strategist:** If `maintenance_tasks` schema changes, one path breaks while the other works
- **Architecture Strategist:** `importAcceptedOemTasks` has no dedup check before insert (P2-3)

## Proposed Solutions

### Option A: Add `scheduleIdFilter` param to `autoPopulateForBike` (Recommended)
Add an optional `scheduleIdFilter?: string[]` parameter to `autoPopulateForBike`. When provided, only import matching IDs (instead of all). Call from `completeOnboarding`. Remove `importAcceptedOemTasks` entirely and the `OemSchedulesModule` import from `UsersModule`.
- Effort: Low (~1hr)
- Risk: Low — single source of truth, inherits existing dedup logic
- LOC reduction: ~55 lines

### Option B: Extract shared `buildOemTasks()` helper
Create a shared method on `OemSchedulesService` for building task rows, called by both codepaths.
- Effort: Low
- Risk: Low — but still two insert paths

## Technical Details

- **Affected files:** `apps/api/src/modules/users/users.service.ts`, `apps/api/src/modules/oem-schedules/oem-schedules.service.ts`, `apps/api/src/modules/users/users.module.ts`

## Acceptance Criteria

- [ ] Single codepath for OEM task creation
- [ ] Dedup check applies to both auto-populate and accepted-IDs flows
- [ ] `OemSchedulesModule` import removed from `UsersModule` (if Option A)
- [ ] No duplicate maintenance tasks on client retry
