---
status: pending
priority: p3
issue_id: "148"
tags: [code-review, performance, db]
dependencies: []
---

# RidesService.list uses `select('*', { count: 'exact' })` — over-fetch + full count

## Problem Statement

`rides.service.ts` pages rides with `select('*', { count: 'exact' })`. `select('*')` pulls every column including any large JSONB (e.g. `waypoints_json`); a 50-row page can be 500KB–5MB over the wire Postgres→Nest before GraphQL projection strips it back down. `count: 'exact'` forces a full-table COUNT — 50–200ms at 10k rides and worse as data grows.

## Findings

- **Performance Oracle:** `apps/api/src/modules/rides/rides.service.ts:373-374` — unbounded column set + exact count

## Proposed Solutions

### Option A: Explicit columns + estimated/absent count (Recommended)
Select only the columns the GraphQL model exposes for the list view; use `count: 'estimated'` or drop count entirely (cursor pagination without total).
```ts
.select('id, user_id, started_at, ended_at, distance_m, motorcycle_id, …', { count: 'estimated' })
```
- Effort: Small

### Option B: Split blob columns into a sibling table
`rides_track(ride_id pk, waypoints_json)` — then `select('*')` on `rides` is safe. Larger change.
- Effort: Medium

## Technical Details

- **Affected files:** `apps/api/src/modules/rides/rides.service.ts`; possibly a new migration under Option B

## Acceptance Criteria

- [ ] List query payload size drops proportional to `waypoints_json` size
- [ ] p95 latency for `myRides` page improves on 10k-row dataset
- [ ] GraphQL contract unchanged

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-16 | Created from /ce-review | performance-oracle |
