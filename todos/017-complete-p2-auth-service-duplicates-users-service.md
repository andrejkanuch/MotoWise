---
status: pending
priority: p2
issue_id: "017"
tags: [code-review, architecture, simplicity]
dependencies: []
---

# AuthService Duplicates UsersService — Eliminate Redundancy

## Problem Statement

`AuthService.getProfile()` is identical to `UsersService.findById()`. The mapping logic is duplicated 3 times across both services. When a column is added to `users`, all copies must be updated.

## Findings

- **Source:** Code Simplicity Reviewer (IMPORTANT), TypeScript Reviewer (M1), Performance Oracle (P2-5)
- **Files:**
  - `apps/api/src/modules/auth/auth.service.ts:14-20`
  - `apps/api/src/modules/users/users.service.ts:14-21,33-40`

## Proposed Solutions

### Option A: Delegate AuthService to UsersService
Have `AuthResolver.me()` call `UsersService.findById()` directly. Delete `AuthService`.
- **Effort:** Small
- **Risk:** Low

### Option B: Merge AuthModule into UsersModule
Move the `me` query into `UsersResolver`. Delete `AuthModule` and `AuthService`.
- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [ ] Single source of user profile mapping logic
- [ ] `AuthService` eliminated or delegating to `UsersService`

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-06 | Created from code review | 3 agents flagged independently |
