---
status: complete
priority: p2
issue_id: "157"
tags: [code-review, performance, api]
dependencies: ["152"]
---

# importAcceptedOemTasks uses redundant 3-level waterfall query

## Problem Statement

`importAcceptedOemTasks` calls `findByMotorcycle()` which performs up to 3 sequential Supabase queries (exact match → make fallback → GENERIC fallback), then filters results by the schedule IDs the client already sent. The IDs are known — a single `WHERE id IN (...)` query replaces 1-3 round trips.

## Findings

- **Performance Oracle:** `users.service.ts:248-253` — eliminates 1-2 unnecessary DB round trips (~20-60ms each)

## Proposed Solutions

### Option A: Direct ID lookup (Recommended)
```typescript
const { data: accepted } = await this.supabaseAdmin
  .from('oem_maintenance_schedules')
  .select('*')
  .in('id', scheduleIds);
```
- Effort: Low
- Risk: None — primary key lookup

**Note:** If todo #152 is resolved (consolidation into `autoPopulateForBike` with `scheduleIdFilter`), implement the filter there instead.

## Acceptance Criteria

- [ ] Accepted OEM schedules fetched by ID, not via waterfall
- [ ] Single DB round trip for the lookup
