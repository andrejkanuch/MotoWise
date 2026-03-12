---
status: pending
priority: p2
issue_id: "081"
tags: [code-review, security, api, ai-budget]
dependencies: []
---

## Problem Statement

Both `checkUserDailyLimit` and `checkGlobalSpend` in `ai-budget.service.ts` fail open on database errors — if the DB is unavailable, all rate limits are bypassed. The global spend check protects against financial exposure and should fail closed.

## Proposed Solutions

### Option A: Fail closed on global spend, open on user limit
- Global: throw error on DB failure (protects budget)
- User: fail open (better UX, server still enforces global cap)
- Effort: Small | Risk: Low

## Acceptance Criteria

- [ ] `checkGlobalSpend` throws on DB errors
- [ ] `checkUserDailyLimit` behavior documented (fail-open by design)
