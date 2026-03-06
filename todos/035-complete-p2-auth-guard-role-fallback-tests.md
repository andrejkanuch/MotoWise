---
status: pending
priority: p2
issue_id: "035"
tags: [code-review, security, testing]
dependencies: []
---

# Auth Guard Role Fallback Chain Tests Missing

## Problem Statement

The `GqlAuthGuard` has a three-way role fallback:
```typescript
role: (payload.app_metadata as Record<string, unknown>)?.role ?? payload.user_role ?? 'user'
```

The test only covers the `app_metadata.role` path. Missing coverage for:
- `app_metadata` exists but has no `role` key, falling back to `payload.user_role`
- Both `app_metadata.role` and `user_role` absent, defaulting to `'user'`
- `app_metadata` itself is undefined/null

## Findings

- **Source**: Security Sentinel, Test Analyzer, Learnings Researcher (all flagged independently)
- **File**: `apps/api/src/common/guards/gql-auth.guard.spec.ts` (line 37-56 only tests one path)
- **Production code**: `apps/api/src/common/guards/gql-auth.guard.ts` (lines 33-34)

## Proposed Solutions

### Option A: Add 3 test cases to existing describe block
- Add "uses user_role when app_metadata.role missing"
- Add "defaults to 'user' when both missing"
- Add "handles undefined app_metadata"
- **Effort**: Small (15 min)
- **Risk**: None

## Acceptance Criteria

- [ ] Test covers `user_role` fallback when `app_metadata.role` is absent
- [ ] Test covers default `'user'` when both `app_metadata.role` and `user_role` are absent
- [ ] Test covers `app_metadata` being undefined
- [ ] All tests pass
