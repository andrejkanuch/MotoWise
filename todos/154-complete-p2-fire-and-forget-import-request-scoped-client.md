---
status: complete
priority: p2
issue_id: "154"
tags: [code-review, api, reliability, bug]
dependencies: ["152"]
---

# Fire-and-forget importAcceptedOemTasks uses request-scoped client

## Problem Statement

`importAcceptedOemTasks` is called via `.catch()` as a detached promise (line 206) but uses `this.supabase` (request-scoped user client) for the INSERT (line 285). The request scope may be GC'd before the async operation completes → silent data loss. User sees onboarding complete but gets no maintenance tasks, with no retry path.

## Findings

- **Security Sentinel:** TOCTOU race — admin read at line 233, user-scoped write at line 285
- **Performance Oracle:** Request-scoped client in fire-and-forget context risks silent failures
- **Data Integrity Guardian:** No retry mechanism if insert fails silently

## Proposed Solutions

### Option A: Await the import (Recommended)
Make the call synchronous — await before returning the response. Adds ~50-100ms but guarantees task creation.
- Effort: Trivial
- Risk: None — acceptable latency for onboarding completion

### Option B: Use supabaseAdmin for the insert
Since this is a system-initiated operation for explicitly user-accepted tasks, admin is defensible. But conflicts with #153 goals.
- Effort: Trivial
- Risk: Low

## Technical Details

- **Affected files:** `apps/api/src/modules/users/users.service.ts:206, 285`
- **Note:** If todo #152 is resolved (consolidation), this issue goes away — `autoPopulateForBike` is already awaited.

## Acceptance Criteria

- [ ] OEM task import is awaited or uses a client that survives request-scope teardown
- [ ] Failed imports are logged with enough context to debug
