---
status: complete
priority: p2
issue_id: "160"
tags: [code-review, database, data-integrity]
dependencies: ["151"]
---

# No unique constraint on oem_maintenance_schedules natural key

## Problem Statement

The `oem_maintenance_schedules` table has no UNIQUE constraint on `(make, model, year_from, task_name)`. Re-running migrations or duplicate INSERTs create duplicate schedule rows, which then yield duplicate maintenance tasks via `autoPopulateForBike`.

## Findings

- **Data Integrity Guardian:** Original table definition in migration 00022 — no natural key constraint

## Proposed Solutions

### Option A: Add unique index (Recommended)
```sql
CREATE UNIQUE INDEX idx_oem_schedules_natural_key
  ON public.oem_maintenance_schedules (make, COALESCE(model, ''), COALESCE(year_from, 0), task_name);
```
- Effort: Low
- Risk: Low — add in the migration fix for #151

## Acceptance Criteria

- [ ] Unique constraint prevents duplicate schedule rows
- [ ] INSERTs use ON CONFLICT or are verified unique before running
