---
status: pending
priority: p1
issue_id: "001"
tags: [code-review, performance, architecture]
dependencies: []
---

# Per-Request Supabase Client Instantiation Causes GC Pressure

## Problem Statement

Every HTTP request creates a brand-new `SupabaseClient` via `createClient()` in the `SUPABASE_USER` provider. The Supabase JS client constructor initializes GoTrueClient, RealtimeClient, WebSocket setup, localStorage adapters, and PostgrestClient — all immediately garbage-collected after the request completes. At scale (100+ req/s), this causes significant GC pressure and wasted CPU.

## Findings

- **Source:** Performance Oracle (both instances), Architecture Strategist
- **File:** `apps/api/src/modules/supabase/supabase-user.provider.ts:8-25`
- Every service injecting `SUPABASE_USER` also becomes request-scoped (NestJS scope bubbling), causing the entire dependency tree to be re-instantiated per request
- At 1000 req/s: severe GC stalls, p99 latency spikes

## Proposed Solutions

### Option A: Disable Unused Auth Features (Quick Fix)
Add `persistSession: false`, `autoRefreshToken: false`, `detectSessionInUrl: false` to the client options to eliminate the heaviest part of construction.
- **Pros:** Minimal code change, immediate improvement
- **Cons:** Still creates a new client per request
- **Effort:** Small
- **Risk:** Low

### Option B: Use @supabase/postgrest-js Directly
Replace the full SupabaseClient with lightweight PostgREST calls using per-request auth headers.
- **Pros:** Eliminates all unnecessary overhead, maximum performance
- **Cons:** Loses Supabase client convenience methods, more code to maintain
- **Effort:** Large
- **Risk:** Medium

### Option C: Shared Client with Per-Query Auth Headers
Create a single anon client and override Authorization header per-query.
- **Pros:** Best balance of performance and convenience
- **Cons:** Supabase JS v2 doesn't natively support per-query header overrides cleanly
- **Effort:** Medium
- **Risk:** Medium

## Recommended Action

Start with Option A immediately, then evaluate Option C for a longer-term fix.

## Technical Details

- **Affected files:** `apps/api/src/modules/supabase/supabase-user.provider.ts`
- **Components:** All services injecting SUPABASE_USER

## Acceptance Criteria

- [ ] Supabase user client constructor does not initialize GoTrue/Realtime machinery
- [ ] Per-request overhead reduced measurably (benchmark before/after)
- [ ] All existing RLS-enforced queries continue to work correctly

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-06 | Created from code review | Performance Oracle flagged as critical scalability concern |

## Resources

- `apps/api/src/modules/supabase/supabase-user.provider.ts`
