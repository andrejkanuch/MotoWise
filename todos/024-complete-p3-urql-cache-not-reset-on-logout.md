---
status: pending
priority: p3
issue_id: "024"
tags: [code-review, security, performance]
dependencies: []
---

# urql Client Cache Not Reset on Logout — Stale User Data

## Problem Statement

The urql client is created once at module scope. When a user logs out and another logs in, the cache still holds data from the previous session. This is both a security issue (stale data) and UX issue.

## Findings

- **Source:** Performance Oracle (P3-1)
- **File:** `apps/mobile/src/app/_layout.tsx:8`

## Proposed Solutions

### Option A: Recreate Client on Auth State Change
Create a new urql client instance when the session changes.
- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [ ] urql cache cleared on logout
- [ ] New client created on login

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-06 | Created from code review | |
