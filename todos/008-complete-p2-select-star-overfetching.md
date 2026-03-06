---
status: pending
priority: p2
issue_id: "008"
tags: [code-review, performance]
dependencies: []
---

# SELECT * Over-Fetching on All Queries

## Problem Statement

Every service uses `.select('*')`, fetching all columns including heavy ones like `content_json` (JSONB), `raw_text` (TEXT), `search_vector` (TSVECTOR), and `questions_json`. The `articles.search()` method fetches full article content for list queries but only uses metadata fields.

## Findings

- **Source:** Performance Oracle (both instances)
- **Files:** All `*.service.ts` files — 7 services with `select('*')`
- Worst case: `articles.service.ts` search fetching `content_json` + `raw_text` for 20 articles per page

## Proposed Solutions

### Option A: Replace with Explicit Column Lists
Use `select('id, slug, title, ...')` matching what `mapRow` actually uses.
- **Effort:** Medium
- **Risk:** Low

## Acceptance Criteria

- [ ] All list/search queries use explicit column lists
- [ ] `findBySlug`/`findById` queries can keep `select('*')` for detail views
- [ ] No unused columns transferred in list queries

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-06 | Created from code review | Both performance reviewers flagged this |
