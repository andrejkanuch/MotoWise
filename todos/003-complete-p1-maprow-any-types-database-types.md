---
status: pending
priority: p1
issue_id: "003"
tags: [code-review, typescript, architecture]
dependencies: []
---

# All mapRow Methods Use `any` — No Type Safety at Data Boundary

## Problem Statement

Every service's `mapRow(row: any)` method destroys type safety at the most critical trust boundary — where snake_case DB rows become camelCase API models. A column rename or typo silently produces `undefined` instead of a compile error. The root cause is that `database.types.ts` is an empty stub and `SupabaseClient` is unparameterized.

## Findings

- **Source:** TypeScript Reviewer (C1, I4), Architecture Strategist
- **Files:**
  - `apps/api/src/modules/articles/articles.service.ts:75`
  - `apps/api/src/modules/motorcycles/motorcycles.service.ts:41`
  - `apps/api/src/modules/diagnostics/diagnostics.service.ts:45`
  - `apps/api/src/modules/learning-progress/learning-progress.service.ts:50`
  - `apps/api/src/modules/users/users.service.ts` and `auth/auth.service.ts`
- All Supabase providers use bare `SupabaseClient` without `Database` generic

## Proposed Solutions

### Option A: Generate database.types.ts and Parameterize SupabaseClient
1. Run `supabase gen types typescript --local` to populate `database.types.ts`
2. Pass `Database` generic to both Supabase providers: `SupabaseClient<Database>`
3. Type each `mapRow` against the actual row type

- **Pros:** Eliminates ALL `any` in service layer in one shot, compile-time safety on every DB query
- **Cons:** Requires local Supabase running to generate types
- **Effort:** Medium
- **Risk:** Low

## Acceptance Criteria

- [ ] `database.types.ts` generated with actual table types
- [ ] Both Supabase providers use `SupabaseClient<Database>`
- [ ] All `mapRow` methods typed against `Database['public']['Tables'][X]['Row']`
- [ ] Zero `any` in service-layer data mapping
- [ ] `pnpm typecheck` passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-06 | Created from code review | Root cause of all `any` usage in services |

## Resources

- `packages/types/src/database.types.ts`
- All `*.service.ts` files in `apps/api/src/modules/`
