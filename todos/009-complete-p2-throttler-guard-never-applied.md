---
status: pending
priority: p2
issue_id: "009"
tags: [code-review, security, performance]
dependencies: []
---

# ThrottlerModule Configured But Never Applied — Rate Limiting Inert

## Problem Statement

`ThrottlerModule` is imported with two named buckets (`default` and `ai`) but `@UseGuards(ThrottlerGuard)` or `@Throttle()` is never applied to any resolver. Rate limiting is completely inert.

## Findings

- **Source:** Code Simplicity Reviewer, Security Sentinel (from previous session)
- **File:** `apps/api/src/app.module.ts:31-42`
- No resolver uses `@Throttle()` or `@UseGuards(ThrottlerGuard)`

## Proposed Solutions

### Option A: Apply ThrottlerGuard Globally + @Throttle on AI Resolvers
Set ThrottlerGuard as a global guard, add `@Throttle('ai')` on diagnostic/generation resolvers.
- **Effort:** Small
- **Risk:** Low

### Option B: Remove Until Needed (Per Simplicity Review)
Delete ThrottlerModule config, add back when wiring up rate limiting.
- **Effort:** Small
- **Risk:** Medium (no rate limiting at all)

## Recommended Action

Option A — the configuration is already correct; just apply the guard.

## Acceptance Criteria

- [ ] ThrottlerGuard applied globally or on each resolver
- [ ] AI endpoints use stricter `ai` rate limit bucket
- [ ] Rate-limited requests return 429

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-06 | Created from code review | Both security and simplicity reviewers flagged |
