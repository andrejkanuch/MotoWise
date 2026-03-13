---
status: pending
priority: p2
issue_id: "094"
tags: [code-review, performance, database, index]
dependencies: []
---

# Add composite index for expenses query + drop low-selectivity indexes

## Problem Statement

The `findByMotorcycle` query filters on `user_id`, `motorcycle_id`, `deleted_at IS NULL`, and optionally date range, then orders by `date DESC`. The migration creates 4 separate single-column indexes — PostgreSQL will use at most one and filter-scan the rest. The `idx_expenses_category` index has only 4 possible values (very low selectivity).

## Findings

- **Performance Oracle:** CRITICAL-2 — missing composite index for primary query pattern
- **Data Migration Expert:** Issues 5+6 — low selectivity category index, missing composite index
- Current indexes: `idx_expenses_user_id`, `idx_expenses_motorcycle_id`, `idx_expenses_date`, `idx_expenses_category`

## Proposed Solutions

Add a new migration:
```sql
-- Add composite index matching the primary query pattern
CREATE INDEX idx_expenses_user_motorcycle_date
  ON public.expenses (user_id, motorcycle_id, date DESC)
  WHERE deleted_at IS NULL;

-- Drop redundant single-column indexes (covered by composite)
DROP INDEX idx_expenses_user_id;
DROP INDEX idx_expenses_motorcycle_id;

-- Drop low-selectivity index
DROP INDEX idx_expenses_category;
```

Keep `idx_expenses_date` for potential date-only queries.

- Effort: Small
- Risk: Low

## Acceptance Criteria

- [ ] Composite partial index created matching query pattern
- [ ] Redundant single-column indexes dropped
- [ ] Query EXPLAIN shows index scan instead of sequential scan

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-13 | Created from code review | Performance oracle + data migration expert flagged |
