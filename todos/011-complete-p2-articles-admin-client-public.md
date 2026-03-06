---
status: pending
priority: p2
issue_id: "011"
tags: [code-review, security, architecture]
dependencies: ["005"]
---

# ArticlesService._adminClient Is Not Private — Leaks Service-Role Client

## Problem Statement

In `ArticlesService`, the admin client is declared as `readonly _adminClient` instead of `private readonly`. The underscore prefix suggests it was intended to be private. This exposes the service-role Supabase client to any code with a reference to `ArticlesService`.

## Findings

- **Source:** Architecture Strategist (IMPORTANT #3)
- **File:** `apps/api/src/modules/articles/articles.service.ts:12`

## Proposed Solutions

### Option A: Make Private
Change `readonly _adminClient` to `private readonly adminClient`.
- **Effort:** Small (1 line)
- **Risk:** None

## Acceptance Criteria

- [ ] Admin client is `private readonly adminClient`

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-06 | Created from code review | Simple fix |
