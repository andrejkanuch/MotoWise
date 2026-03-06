---
status: pending
priority: p2
issue_id: "037"
tags: [code-review, typescript, testing]
dependencies: []
---

# Reduce ~30 as any Casts in Test Files

## Problem Statement

~30 `as any` casts across test files defeat TypeScript's type checking in tests. Three categories:
1. Supabase mock client casts (`adminMock.client as any`) in 7 service specs
2. Resolver input casts (`input as any`) in 7 resolver specs
3. Admin middleware request/response casts (12 occurrences)

## Findings

- **Source**: TypeScript Reviewer (HIGH severity)
- **Files**: All `*.spec.ts` in `apps/api/src/modules/`, `apps/admin/src/middleware.spec.ts`
- Also: `as never` in auth guard spec (12 occurrences) — semantically misleading

## Proposed Solutions

### Option A: Type the mock factory and use real DTOs
1. Add return type to `createMockSupabaseClient` using `Pick<SupabaseClient, 'from' | 'auth'>`
2. Import real DTO types in resolver tests instead of `as any`
3. Replace `as never` with `as unknown as ExecutionContext` in guard spec
- **Effort**: Medium (45 min)
- **Risk**: Low

## Acceptance Criteria

- [ ] `createMockSupabaseClient` has typed return (no `as any` needed at call sites)
- [ ] Resolver tests use real DTO types for inputs
- [ ] `as never` replaced with proper type casts in guard spec
- [ ] `as any` count reduced by at least 50%
- [ ] All tests pass
