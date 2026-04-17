---
status: pending
priority: p2
issue_id: "133"
tags: [code-review, architecture, boundaries]
dependencies: []
---

# Two paths create trip_waypoints; only one runs TripsService hooks

## Problem Statement

`apps/api/src/modules/trips/trips.service.ts:715-753` `TripsService.addWaypoint()` calls `verifyOrganiser` and is the canonical path. `apps/api/src/modules/trip-suggestions/trip-suggestions.service.ts:205-249` `materialiseWaypoint` inserts into `trip_waypoints` directly via Supabase, relying on RLS for "organiser OR co_planner." Any future side-effect on `addWaypoint` (analytics, notifications, route recompute) will silently skip the accept path, diverging behaviour between manual add and suggestion-accept.

## Findings

- **Architecture Strategist:** business logic split across two services; no single owner for "waypoint added."
- **Reliability Reviewer:** future hook added to addWaypoint alone would be invisible to co_planner accepts.

## Proposed Solutions

### Option A: Expose `addWaypointAsCoPlanner` on TripsService (Recommended)

Relax `verifyOrganiser` to "organiser OR co_planner" inside a new method:

```ts
async addWaypointAsCoPlanner(userId: string, input: AddWaypointInput) {
  await this.verifyOrganiserOrCoPlanner(userId, input.tripId);
  return this.insertWaypoint(input); // shared with addWaypoint
}
```

Inject `TripsService` into `TripSuggestionsService`; accept path calls `tripsService.addWaypointAsCoPlanner(...)`. Analytics, notifications, post-hooks run in both paths.

- Pros / Cons / Effort: Small / Risk: Low

### Option B: Domain event bus

Emit `WaypointAdded` from either path; side-effects subscribe. Cleaner long-term but overkill for two call sites.

## Recommended Action

Option A.

## Technical Details

- **Affected files:** `apps/api/src/modules/trips/trips.service.ts`, `apps/api/src/modules/trip-suggestions/trip-suggestions.service.ts`, relevant module imports

## Acceptance Criteria

- [ ] `TripSuggestionsService.materialiseWaypoint` routes through `TripsService`
- [ ] Circular-import check passes
- [ ] Existing RLS behaviour preserved (organiser + co_planner both succeed)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-16 | Created from /ce-review | architecture-strategist |

## Resources

- Branch: feat/impeccable-discover-redesign
