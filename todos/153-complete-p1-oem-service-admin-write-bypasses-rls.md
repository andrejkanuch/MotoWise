---
status: complete
priority: p1
issue_id: "153"
tags: [code-review, security, api, architecture]
dependencies: ["152"]
---

# OemSchedulesService writes maintenance_tasks via SUPABASE_ADMIN, bypassing RLS

## Problem Statement

`OemSchedulesService` only injects `SUPABASE_ADMIN` (line 10). The `autoPopulateForBike` method inserts into `maintenance_tasks` (line 129) using the admin client. This is a user-scoped write that per CLAUDE.md conventions should use `SUPABASE_USER` to enforce RLS author checks (`user_id = auth.uid()`).

## Findings

- **Architecture Strategist:** `oem-schedules.service.ts:129` — admin client used for user-scoped writes violates convention and removes defense-in-depth
- **Security Sentinel:** Not immediately exploitable (userId is always the authenticated user), but removes the RLS safety net

## Proposed Solutions

### Option A: Inject both clients (Recommended)
Inject `SUPABASE_ADMIN` for reads (reference data) and `SUPABASE_USER` for writes to `maintenance_tasks`. The user client must be passed from the calling context (resolver/service) since `OemSchedulesService` may not be request-scoped.
- Effort: Low
- Risk: Low

### Option B: Move insert logic to calling code
If consolidating with todo #152, the insert can live in the resolver/service that already has the user client. `OemSchedulesService` stays read-only (admin for reference data).
- Effort: Low (combined with #152)
- Risk: Low

## Technical Details

- **Affected files:** `apps/api/src/modules/oem-schedules/oem-schedules.service.ts`

## Acceptance Criteria

- [ ] `maintenance_tasks` inserts go through user-scoped client with RLS enforcement
- [ ] `oem_maintenance_schedules` reads still use admin client (no RLS on reference table)
