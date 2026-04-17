---
status: pending
priority: p3
issue_id: "144"
tags: [code-review, cleanup, dead-parameter]
dependencies: []
---

# trip-suggestions.service.list takes a userId it doesn't use

## Problem Statement

`list(userId, tripId)` accepts `userId` but only references it in a debug log. RLS does the real auth work. Dead parameters invite future userId-based filtering that would fight RLS and introduce subtle leakage or missing-row bugs.

## Findings

- **Maintainability Reviewer:** `apps/api/src/modules/trip-suggestions/trip-suggestions.service.ts:68-69` — `userId` unused beyond a log line

## Proposed Solutions

### Option A: Drop the parameter (Recommended)
Remove `userId` from the signature and callers. If the log line is useful, rely on the correlation-id / request-context interceptor already attached to the logger.
- Effort: Small

## Technical Details

- **Affected files:** `apps/api/src/modules/trip-suggestions/trip-suggestions.service.ts`, its resolver, any unit tests touching `list`

## Acceptance Criteria

- [ ] `list(tripId)` signature; all callers updated
- [ ] Logger still emits enough context to correlate the request
- [ ] Tests pass without changes to behaviour

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-16 | Created from /ce-review | maintainability-reviewer |
