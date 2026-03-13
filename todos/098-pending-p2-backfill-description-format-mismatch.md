---
status: pending
priority: p2
issue_id: "098"
tags: [code-review, data-consistency, backfill]
dependencies: ["092"]
---

# Backfill description format mismatch with app code

## Problem Statement

Backfill creates descriptions as `'From: ' || mt.title` while `createFromTask()` uses the raw `taskTitle`. Users will see inconsistent description formats between backfilled and newly created expenses.

## Findings

- **Data Migration Expert:** Issue 9 (MEDIUM) — data inconsistency between old and new records

## Proposed Solutions

Remove the `'From: '` prefix from the backfill to match app behavior. This is addressed together with todo 092 (truncation fix): use `LEFT(mt.title, 200)` instead of `LEFT('From: ' || mt.title, 200)`.

- Effort: Small (part of todo 092 fix)
- Risk: Low

## Acceptance Criteria

- [ ] Backfill description format matches `createFromTask()` format (raw title, no prefix)
- [ ] Truncated to 200 chars

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-13 | Created from code review | Data migration expert flagged |
