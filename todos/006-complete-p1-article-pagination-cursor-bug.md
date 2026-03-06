---
status: pending
priority: p1
issue_id: "006"
tags: [code-review, bug, performance]
dependencies: []
---

# Article Pagination Uses UUID Cursor with generated_at Ordering — Broken

## Problem Statement

The article search orders by `generated_at DESC` but uses `lt('id', cursorId)` for cursor pagination. UUIDs (v4) are random and have no correlation with insertion order. This means pagination will skip articles or return duplicates.

## Findings

- **Source:** Performance Oracle (both instances, P2-7 / 3.1)
- **File:** `apps/api/src/modules/articles/articles.service.ts:27,36-38`
- Order: `generated_at DESC`, Cursor filter: `lt('id', cursorId)` — mismatch

## Proposed Solutions

### Option A: Use generated_at as Cursor
Use `generated_at` (+ `id` tiebreaker) as the cursor value. Filter with `lt('generated_at', cursorDate)`.
- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [ ] Cursor encodes `generated_at` (not UUID)
- [ ] Pagination filter matches sort order
- [ ] No skipped or duplicated articles when paginating

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-06 | Created from code review | Correctness bug, not just performance |
