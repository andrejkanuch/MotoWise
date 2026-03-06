---
status: pending
priority: p2
issue_id: "010"
tags: [code-review, security, architecture]
dependencies: []
---

# QuizzesService Uses Admin Client for User-Facing Reads

## Problem Statement

`QuizzesService.findByArticle` and the quiz lookup in `submitAttempt` use `this.adminClient` (service-role, bypasses RLS) for read queries. The RLS policy allows all users to read quizzes (`USING (true)`), so the admin client is unnecessary and creates a security anti-pattern.

## Findings

- **Source:** Architecture Strategist (IMPORTANT #4), Performance Oracle (P2-4)
- **File:** `apps/api/src/modules/quizzes/quizzes.service.ts:15,34-38`

## Proposed Solutions

### Option A: Switch to userClient
Use the per-request user client for quiz reads. RLS already permits it.
- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [ ] `findByArticle` uses `userClient` instead of `adminClient`
- [ ] Quiz lookup in `submitAttempt` uses `userClient`
- [ ] Admin client reserved only for quiz generation (write)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-06 | Created from code review | Violates CLAUDE.md Supabase client rules |
