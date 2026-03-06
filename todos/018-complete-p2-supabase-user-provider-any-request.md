---
status: pending
priority: p2
issue_id: "018"
tags: [code-review, typescript]
dependencies: []
---

# `request: any` in Supabase User Provider — No Type Safety

## Problem Statement

The `SUPABASE_USER` provider factory takes `request: any`. If the auth guard changes the property name from `accessToken`, this will silently produce `Bearer undefined`. Should use a typed interface.

## Findings

- **Source:** TypeScript Reviewer (I5)
- **File:** `apps/api/src/modules/supabase/supabase-user.provider.ts:12`

## Proposed Solutions

### Option A: Define AuthenticatedRequest Interface
```typescript
interface AuthenticatedRequest { accessToken?: string; user?: AuthUser; }
```
- **Effort:** Small
- **Risk:** None

## Acceptance Criteria

- [ ] `request` parameter properly typed
- [ ] Compile-time error if `accessToken` property name changes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-06 | Created from code review | |
