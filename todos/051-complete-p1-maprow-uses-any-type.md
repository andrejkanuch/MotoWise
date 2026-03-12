---
status: complete
priority: p1
issue_id: "051"
tags: [code-review, architecture, type-safety]
---

# mapRow uses `any` type across services, breaking type-safety pipeline

## Problem Statement

All service `mapRow` methods (except users) accept `any`, completely bypassing TypeScript at the DB-to-API boundary. If a column is renamed in a migration, `row.old_column_name` silently returns `undefined` instead of a compile error. This breaks the entire type pipeline (SQL -> database.types.ts -> service -> GraphQL).

## Findings

- `motorcycles.service.ts:61` — `mapRow(row: any)`
- `articles.service.ts:75` — `mapRow(row: any)`
- `diagnostics.service.ts:46` — `mapRow(row: any)`
- `learning-progress.service.ts:61` — `mapRow(row: any)`
- `users.service.ts:10` — uses `Record<string, unknown>` (marginally better but still not type-safe)
- `content-flags.service.ts` and `quizzes.service.ts` — inline mapping, no mapRow at all
- `content-flags.service.ts:25` and `quizzes.service.ts:43,68` — throw generic `Error` instead of NestJS exceptions

## Proposed Solution

Use generated row types from `database.types.ts`:

```typescript
import type { Tables } from '@motovault/types/database';

private mapRow(row: Tables<'motorcycles'>): Motorcycle {
  return { id: row.id, userId: row.user_id, ... };
}
```

Also standardize: extract `mapRow` in content-flags and quizzes services, replace `throw new Error` with NestJS exceptions.

## Effort
Medium — update all 7 services

## Acceptance Criteria
- [ ] All mapRow methods use generated DB types
- [ ] All services use NestJS HTTP exceptions (not bare Error)
- [ ] Column renames produce compile-time errors
