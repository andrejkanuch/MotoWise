---
status: complete
priority: p1
issue_id: "151"
tags: [code-review, database, migration, data-integrity]
dependencies: []
---

# Migration 00128 DELETE+re-INSERT orphans FK references permanently

## Problem Statement

Migration 00128 NULLs `maintenance_tasks.oem_schedule_id`, DELETEs all model-specific OEM rows, then re-INSERTs with new UUIDs (`gen_random_uuid()`). Existing tasks lose their schedule link forever. The dedup check in `autoPopulateForBike` (keyed on `oem_schedule_id`) finds no matches → duplicate tasks on next run.

## Findings

- **Data Integrity Guardian:** `supabase/migrations/00128_oem_schedules_normalize_and_expand.sql:6-12` — DELETE+re-INSERT generates new UUIDs, severing all FK references
- **Code Simplicity Reviewer:** Migrations 00126 and 00128 are 99% identical — 00128 undoes 00126 completely
- **Architecture Strategist:** Orphaned `oem_schedule_id` breaks idempotency guarantees on `importOemSchedule`

## Proposed Solutions

### Option A: Squash into single migration (if 00126 not pushed to prod)
Remove 00126 entirely. Keep 00128 as the single migration that normalizes brand-generic rows and inserts model-specific rows in one pass. No DELETE needed.
- Effort: Low
- Risk: None if 00126 never ran in prod

### Option B: UPDATE existing rows instead of DELETE+re-INSERT (if 00126 already pushed)
Replace the DELETE+INSERT pattern with `UPDATE ... SET make = UPPER(make)` on existing model-specific rows to fix casing while preserving UUIDs. Only INSERT truly new models that don't exist yet.
- Effort: Medium
- Risk: Low — preserves all FK references

## Technical Details

- **Affected files:** `supabase/migrations/00128_oem_schedules_normalize_and_expand.sql`
- **Affected tables:** `oem_maintenance_schedules`, `maintenance_tasks`
- **Key decision:** Has migration 00126 been pushed to production?

## Acceptance Criteria

- [ ] Existing `maintenance_tasks.oem_schedule_id` values are preserved after migration
- [ ] `autoPopulateForBike` dedup check still works for previously imported tasks
- [ ] No duplicate maintenance tasks created for existing users
