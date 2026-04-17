---
status: pending
priority: p3
issue_id: "139"
tags: [code-review, authz, api-contract]
dependencies: ["117"]
---

# setParticipantRole silently succeeds on non-participant / organiser self-demotion

## Problem Statement

`trip-suggestions.service.ts` issues a final `update('trip_participants').eq('user_id', input.userId)` without verifying the target is actually a participant. Supabase returns success with 0 rows affected, so the UI shows a spurious "role updated". Separately, there is no guard preventing the organiser from setting their own `trip_participants` row to `'rider'`, which creates a contradictory state (organiser flagged as rider).

## Findings

- **API Contract Reviewer:** `trip-suggestions.service.ts:176-203` — update has no `.select()` / affected-row assertion
- **Correctness Reviewer:** organiser can demote their own participant row; downstream role checks then diverge from `trips.organiser_user_id`

## Proposed Solutions

### Option A: Assert exactly-one row + reject organiser self-update (Recommended)
```ts
const { data, error } = await sb
  .from('trip_participants')
  .update({ role: input.role })
  .eq('trip_id', input.tripId)
  .eq('user_id', input.userId)
  .select('id');
if (error) throw error;
if (!data || data.length !== 1) throw new NotFoundException('participant not found');
if (input.userId === trip.organiser_user_id) throw new ForbiddenException('cannot change organiser role');
```
- Effort: Small

## Technical Details

- **Affected files:** `apps/api/src/modules/trip-suggestions/trip-suggestions.service.ts`

## Acceptance Criteria

- [ ] Returns NotFound when target user isn't a participant
- [ ] Rejects setting the organiser's own row
- [ ] Unit tests cover both paths

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-16 | Created from /ce-review | api-contract-reviewer |
