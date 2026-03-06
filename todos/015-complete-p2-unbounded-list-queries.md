---
status: pending
priority: p2
issue_id: "015"
tags: [code-review, performance]
dependencies: []
---

# Unbounded List Queries — Diagnostics, Learning Progress, Motorcycles

## Problem Statement

Three services fetch ALL records for a user with no pagination or limit. A power user with hundreds of diagnostics or progress records will experience increasingly slow queries.

## Findings

- **Source:** Performance Oracle (P2-2)
- **Files:**
  - `apps/api/src/modules/diagnostics/diagnostics.service.ts:10-18` — no limit, no pagination
  - `apps/api/src/modules/learning-progress/learning-progress.service.ts:10-14` — no limit, no ordering
  - `apps/api/src/modules/motorcycles/motorcycles.service.ts:10-16` — no limit

## Proposed Solutions

### Option A: Add Default Limits
Add `.limit(50)` as a sensible default to all list queries.
- **Effort:** Small
- **Risk:** Low

### Option B: Add Cursor-Based Pagination
Match the `ArticleConnection` pattern already used for articles.
- **Effort:** Medium
- **Risk:** Low

## Acceptance Criteria

- [ ] All list queries have a maximum result limit
- [ ] Learning progress query has deterministic ordering

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-06 | Created from code review | |
