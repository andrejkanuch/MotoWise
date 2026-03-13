---
status: pending
priority: p1
issue_id: "092"
tags: [code-review, data-migration, backfill, safety]
dependencies: []
---

# Backfill safety: description truncation + explicit ON CONFLICT target

## Problem Statement

Two issues in `00037_backfill_maintenance_task_costs_to_expenses.sql` that can cause the **entire backfill to fail**:

1. **Description exceeds 200-char CHECK:** The backfill constructs `'From: ' || mt.title` but `maintenance_tasks.title` has no length constraint. Any task title >194 chars causes a CHECK violation, rolling back the entire INSERT (zero rows backfilled).

2. **ON CONFLICT DO NOTHING without target:** Catches ANY constraint violation silently, not just the `maintenance_task_id` unique index. Masks potential bugs.

## Findings

- **Data Migration Expert:** Issue 8 (HIGH) + Issue 11 (MEDIUM) — both can cause data loss or silent failures
- The expenses table has `CHECK (char_length(description) <= 200)` at `00036:10`
- `ON CONFLICT DO NOTHING` at `00037:14` lacks explicit conflict target

## Proposed Solutions

### Fix (Single migration amendment)
```sql
INSERT INTO public.expenses (user_id, motorcycle_id, amount, category, date, description, maintenance_task_id)
SELECT
  mt.user_id,
  mt.motorcycle_id,
  COALESCE(mt.cost, 0) + COALESCE(mt.parts_cost, 0) + COALESCE(mt.labor_cost, 0),
  'maintenance',
  COALESCE(mt.completed_at::date, mt.created_at::date),
  LEFT(mt.title, 200),  -- Truncate to fit CHECK constraint (also removes 'From: ' prefix for consistency with app code)
  mt.id
FROM public.maintenance_tasks mt
WHERE mt.deleted_at IS NULL
  AND (COALESCE(mt.cost, 0) + COALESCE(mt.parts_cost, 0) + COALESCE(mt.labor_cost, 0)) > 0
ON CONFLICT (maintenance_task_id) WHERE maintenance_task_id IS NOT NULL AND deleted_at IS NULL DO NOTHING;
```

- Effort: Small
- Risk: Low

## Acceptance Criteria

- [ ] Description truncated with `LEFT(mt.title, 200)` (also fixes format mismatch — see todo 098)
- [ ] `ON CONFLICT` specifies explicit conflict target matching partial unique index
- [ ] Backfill succeeds even with task titles >200 chars
- [ ] Idempotent: running twice produces no duplicates

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-13 | Created from code review | Data migration expert flagged |

## Resources

- PR #23: https://github.com/andrejkanuch/MotoWise/pull/23
