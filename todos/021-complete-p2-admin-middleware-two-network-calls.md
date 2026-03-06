---
status: pending
priority: p2
issue_id: "021"
tags: [code-review, performance, architecture]
dependencies: []
---

# Admin Middleware Makes Two Supabase Network Calls Per Dashboard Navigation

## Problem Statement

Every `/dashboard/*` request triggers both `supabase.auth.getUser()` (network call to Auth) and `supabase.from('users').select('role')` (DB call). This adds latency to every page navigation.

## Findings

- **Source:** Architecture Strategist (IMPORTANT #5)
- **File:** `apps/admin/src/middleware.ts`

## Proposed Solutions

### Option A: Cache Admin Role in Session
After first verification, store the admin role in a cookie/session to skip the DB call on subsequent requests.
- **Effort:** Medium
- **Risk:** Low (need to handle role revocation)

### Option B: Accept Current Approach
`getUser()` is more secure than `getSession()`. Document the tradeoff.
- **Effort:** None
- **Risk:** None

## Acceptance Criteria

- [ ] Decision documented on security vs latency tradeoff
- [ ] If caching: role revocation handled within reasonable timeframe

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-06 | Created from code review | |
