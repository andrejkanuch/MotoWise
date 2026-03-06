---
status: pending
priority: p2
issue_id: "016"
tags: [code-review, performance]
dependencies: []
---

# Redundant SELECT Before UPSERT in markRead()

## Problem Statement

`LearningProgressService.markRead()` executes an extra SELECT query solely to decide whether to set `first_read_at`. This can be handled in a single upsert by letting the `ON CONFLICT` clause preserve the existing `first_read_at`.

## Findings

- **Source:** Performance Oracle (both instances)
- **File:** `apps/api/src/modules/learning-progress/learning-progress.service.ts:23-29`

## Proposed Solutions

### Option A: Single Upsert with DB-Level Logic
Use a trigger or `COALESCE` in a raw SQL call to preserve `first_read_at` on conflict.
- **Effort:** Small-Medium
- **Risk:** Low

## Acceptance Criteria

- [ ] `markRead` uses a single DB query instead of two
- [ ] `first_read_at` is preserved on subsequent reads

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-06 | Created from code review | |
