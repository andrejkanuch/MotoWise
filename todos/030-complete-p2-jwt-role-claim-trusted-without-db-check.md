---
status: pending
priority: p2
issue_id: "030"
tags: [code-review, security]
dependencies: ["027"]
---

# JWT Role Claim Trusted Without Server-Side Verification

## Problem Statement

The auth guard reads `payload.user_role ?? 'user'` directly from the JWT. The `user_role` custom claim can potentially be set via `raw_user_meta_data` which the user controls. CLAUDE.md explicitly warns: "Do NOT use raw_user_meta_data for role checks (use public.users.role)".

## Findings

- **Source:** Security Sentinel (P2-2)
- **File:** `apps/api/src/common/guards/gql-auth.guard.ts:30`
- Currently no API-level authorization uses this role, but it's a dangerous footgun

## Proposed Solutions

### Option A: Remove Role from AuthUser
Since RLS handles authorization, remove `role` from the guard entirely.
- **Effort:** Small
- **Risk:** None

### Option B: Query DB for Admin Operations
If API-level role checks are needed, query `public.users.role` in the guard.
- **Effort:** Medium (adds DB call)
- **Risk:** Low

## Acceptance Criteria

- [ ] No privilege escalation possible via JWT claim manipulation
- [ ] CLAUDE.md convention respected

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-06 | Created from code review | |
