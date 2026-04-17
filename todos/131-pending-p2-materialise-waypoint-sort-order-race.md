---
status: pending
priority: p2
issue_id: "131"
tags: [code-review, db, concurrency, race-condition]
dependencies: []
---

# materialiseWaypoint races on sort_order; 3 sequential round-trips

## Problem Statement

`apps/api/src/modules/trip-suggestions/trip-suggestions.service.ts:206-238` `materialiseWaypoint` computes the next `sort_order` with a read-then-insert pattern. Two co-planners accepting different suggestions on the same `(trip_id, day_index)` within ~100 ms both read `max(sort_order)=N` and both INSERT `N+1` → duplicate sort_order silently. The method also performs 3 sequential round-trips per accept (~150–300 ms p50).

## Findings

- **Performance Reviewer:** 3× round-trips per accept — select max, insert, update suggestion.
- **Data Integrity Guardian:** read-modify-write race on `sort_order`.

## Proposed Solutions

### Option A: Atomic INSERT with MAX subquery + unique index (Recommended)

```sql
INSERT INTO trip_waypoints (trip_id, day_index, name, lat, lng, notes, sort_order)
SELECT $1, $2, $3, $4, $5, $6,
       COALESCE(MAX(sort_order), -1) + 1
  FROM trip_waypoints
  WHERE trip_id = $1 AND day_index = $2
RETURNING *;

CREATE UNIQUE INDEX trip_waypoints_trip_day_sort_uidx
  ON trip_waypoints (trip_id, day_index, sort_order);
```

On 23505 (rare), retry once. Reduces accept to 1–2 round-trips and prevents duplicates.

- Pros / Cons / Effort: Small / Risk: Low

### Option B: SERIALIZABLE transaction

Wrap the three queries in a serializable transaction. Eliminates the race without schema change but adds retry loops on 40001 and is heavier than option A.

## Recommended Action

Option A. Add retry-on-23505 helper for the 1-in-1000 case.

## Technical Details

- **Affected files:** `apps/api/src/modules/trip-suggestions/trip-suggestions.service.ts`, new migration for unique index

## Acceptance Criteria

- [ ] Concurrent accepts on same `(trip_id, day_index)` never produce duplicate sort_order (test with 20 parallel calls)
- [ ] Accept latency drops ≥ 80 ms p50
- [ ] Unique index present in production schema

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-16 | Created from /ce-review | performance-reviewer + data-integrity-guardian |

## Resources

- Branch: feat/impeccable-discover-redesign
