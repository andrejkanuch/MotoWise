---
status: pending
priority: p1
issue_id: "028"
tags: [code-review, architecture, bug]
dependencies: []
---

# GraphQL Error Codes Use Numeric HTTP Status — Token Refresh Broken

## Problem Statement

The `AllExceptionsFilter` maps `HttpException` status codes as numeric values (e.g., `401`) in GraphQL error extensions. But the mobile urql auth exchange checks for `e.extensions?.code === 'UNAUTHENTICATED'` (string comparison). This means **token refresh will never trigger** — users get logged out instead of silently refreshing.

## Findings

- **Source:** Architecture Strategist (P2-6)
- **Files:**
  - `apps/api/src/common/filters/gql-exception.filter.ts:9-12` — sends `code: exception.getStatus()` (numeric)
  - `apps/mobile/src/lib/urql.ts:27` — checks `code === 'UNAUTHENTICATED'` (string)

## Proposed Solutions

### Option A: Map HTTP Status to GraphQL Error Code Strings
```typescript
const codeMap: Record<number, string> = {
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  400: 'BAD_REQUEST',
};
```
- **Effort:** Small
- **Risk:** None

## Acceptance Criteria

- [ ] 401 errors produce `code: 'UNAUTHENTICATED'` in GraphQL error extensions
- [ ] urql auth exchange triggers token refresh on expired tokens
- [ ] Other HTTP status codes mapped to appropriate string codes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-06 | Created from code review | Critical UX bug — users get logged out instead of refreshing |
