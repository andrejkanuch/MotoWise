---
status: complete
priority: p2
issue_id: "059"
tags: [code-review, performance, data-integrity]
---

# markRead() two-round-trip pattern + race condition on first_read_at

## Problem Statement

`LearningProgressService.markRead()` performs an upsert then a conditional second UPDATE for `first_read_at`. This doubles latency for first reads and has a race condition where concurrent requests for the same user+article can fail.

## Findings

- `apps/api/src/modules/learning-progress/learning-progress.service.ts:22-56` — two sequential DB calls
- Concurrent request: second `.single()` at line 52 returns no rows, throws InternalServerErrorException

## Proposed Solution

Single upsert via RPC or inline:
```sql
INSERT INTO learning_progress (user_id, article_id, article_read, first_read_at, last_read_at)
VALUES ($1, $2, true, NOW(), NOW())
ON CONFLICT (user_id, article_id)
DO UPDATE SET article_read = true, last_read_at = NOW(),
  first_read_at = COALESCE(learning_progress.first_read_at, NOW());
```

## Effort
Small — single RPC function or raw query

## Acceptance Criteria
- [ ] markRead() uses single round-trip
- [ ] Concurrent requests don't fail
- [ ] first_read_at is set only on first read
