---
status: pending
priority: p2
issue_id: "084"
tags: [code-review, security, api, agent-native]
dependencies: []
---

## Problem Statement

Free tier limits (MAX_BIKES, MAX_ARTICLES_PER_WEEK) are only enforced client-side via `useProGate` hook. A user could bypass these by calling GraphQL mutations directly. Only AI budget has server-side enforcement.

## Proposed Solutions

### Option A: Add server-side enforcement in resolvers
- Check bike count in `createMotorcycle` resolver
- Check article count in `generateArticle` resolver
- Use PremiumGuard or inline checks with FREE_TIER_LIMITS constants
- Effort: Medium | Risk: Low

## Acceptance Criteria

- [ ] `createMotorcycle` rejects if free tier bike limit exceeded
- [ ] `generateArticle` rejects if free tier article limit exceeded
- [ ] Server returns appropriate error codes for limit exceeded
