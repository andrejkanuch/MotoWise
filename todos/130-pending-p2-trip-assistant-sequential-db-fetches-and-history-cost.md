---
status: pending
priority: p2
issue_id: "130"
tags: [code-review, performance, ai-cost, db]
dependencies: []
---

# Trip assistant fetches trip + bike sequentially; history trimmed too late

## Problem Statement

`apps/api/src/modules/trip-assistant/trip-assistant.service.ts:81-82, 85-91` calls `loadTripContext(tripId)` then `loadPrimaryBike(userId)` sequentially — 40–120 ms each on Supabase → 80–240 ms serialised where 40–120 ms would suffice. History is trimmed *after* DTO validation, so over-long client history still pays full token cost if no upstream cap exists (see #120).

## Findings

- **Performance Reviewer:** obvious Promise.all candidate.
- **Performance Reviewer:** history cost not capped until after validation; token burn bypasses intent.

## Proposed Solutions

### Option A: Parallel fetch + bounded history (Recommended)

```ts
const [trip, bike] = await Promise.all([
  this.loadTripContext(tripId),
  this.loadPrimaryBike(userId),
]);
const trimmed = (history ?? []).slice(-8); // bounded first, DTO-capped at 32 (#120)
```

- Pros / Cons / Effort: Small / Risk: Low

### Option B: Single join query

Select trip + waypoints + author + primary bike in one Supabase call via a view or PostgREST nested select. Faster still, but couples modules.

## Recommended Action

Option A. Re-evaluate Option B if p95 latency stays above 1.5 s.

## Technical Details

- **Affected files:** `apps/api/src/modules/trip-assistant/trip-assistant.service.ts`

## Acceptance Criteria

- [ ] Trip + primary bike fetched concurrently
- [ ] Handler latency drops ≥ 40 ms p50 in local benchmark
- [ ] History slice runs before Claude call with `slice(-8)`

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-16 | Created from /ce-review | performance-reviewer |

## Resources

- Branch: feat/impeccable-discover-redesign
- Related: #120 history cap
