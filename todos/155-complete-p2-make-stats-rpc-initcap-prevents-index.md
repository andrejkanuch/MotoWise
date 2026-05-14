---
status: complete
priority: p2
issue_id: "155"
tags: [code-review, performance, database]
dependencies: []
---

# get_make_stats() groups on initcap(m.make) preventing index use

## Problem Statement

The `get_make_stats()` RPC function groups by `initcap(m.make)` which wraps the column in a function expression, forcing a full sequential scan of the `motorcycles` table on every call. Makes are already normalized to ALL CAPS by migrations 00126/00128.

## Findings

- **Performance Oracle:** `supabase/migrations/00127_make_stats_rpc.sql:19,27` — `GROUP BY initcap(m.make)` prevents any index on `make` from being used. At 100K rows this becomes multi-hundred-ms.

## Proposed Solutions

### Option A: Group by raw make, initcap in SELECT only (Recommended)
```sql
SELECT initcap(m.make) AS make, ...
GROUP BY m.make
```
Plus add a partial index:
```sql
CREATE INDEX idx_motorcycles_make_active ON public.motorcycles (make)
  WHERE make IS NOT NULL AND make != '' AND deleted_at IS NULL;
```
- Effort: Low
- Risk: None

## Technical Details

- **Affected files:** `supabase/migrations/00127_make_stats_rpc.sql`
- Also remove the redundant `HAVING COUNT(DISTINCT m.user_id) >= 1` (always true in GROUP BY)

## Acceptance Criteria

- [ ] `GROUP BY m.make` (raw column, not function-wrapped)
- [ ] `initcap()` applied only in SELECT for display
- [ ] Partial index added for the query pattern
- [ ] `HAVING` clause removed
