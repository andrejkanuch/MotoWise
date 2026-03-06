---
status: pending
priority: p2
issue_id: "013"
tags: [code-review, typescript]
dependencies: []
---

# GraphQL Models Use `string` for Enum Fields — No Type Narrowing

## Problem Statement

Every GraphQL field that represents a constrained set of values (difficulty, category, role, status, severity) is typed as `string` instead of using `registerEnumType`. This loses type narrowing across the entire stack — clients can't benefit from enum autocompletion or validation.

## Findings

- **Source:** TypeScript Reviewer (I3)
- **Files:**
  - `apps/api/src/modules/articles/models/article.model.ts` — `difficulty: string`, `category: string`
  - `apps/api/src/modules/users/models/user.model.ts` — `role: string`
  - `apps/api/src/modules/content-flags/models/content-flag.model.ts` — `status: string`
  - `apps/api/src/modules/diagnostics/models/diagnostic.model.ts` — `severity?: string`
  - `apps/api/src/common/decorators/current-user.decorator.ts` — `role: string`

## Proposed Solutions

### Option A: Register GraphQL Enums
Use NestJS `registerEnumType` with the `as const` values and annotate fields with the enum type.
- **Effort:** Medium
- **Risk:** Low (breaking change for clients if they expect string)

## Acceptance Criteria

- [ ] All constrained fields use registered GraphQL enums
- [ ] `AuthUser.role` typed as `UserRole` instead of `string`
- [ ] Generated GraphQL schema uses enum types

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-06 | Created from code review | |
