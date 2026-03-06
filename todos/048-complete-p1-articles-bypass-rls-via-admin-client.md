---
status: complete
priority: p1
issue_id: "048"
tags: [code-review, security, database, nestjs]
---

# Articles service bypasses RLS via adminClient on public endpoints

## Problem Statement

`ArticlesService.search()` and `findBySlug()` use `this.adminClient` (service-role), completely bypassing RLS on unauthenticated public endpoints. The RLS policy already handles `is_hidden = false` filtering — using adminClient removes this safety net.

## Findings

- `apps/api/src/modules/articles/articles.service.ts:23` — search() uses adminClient
- `apps/api/src/modules/articles/articles.service.ts:64` — findBySlug() uses adminClient
- Articles resolver has NO `@UseGuards(GqlAuthGuard)` — intentionally public
- If `.eq('is_hidden', false)` is removed or missed in a new method, hidden articles leak
- Unauthenticated requests run with full service-role DB privileges

## Proposed Solution

Switch public read operations to `userClient` (or anon-scoped client). The RLS policy `"Anyone reads visible articles"` already enforces `is_hidden = false`:

```typescript
// Change from:
let query = this.adminClient.from('articles').select(...)
// To:
let query = this.userClient.from('articles').select(...)
```

Keep `adminClient` only for admin write operations (article generation).

## Effort
Small — change 2 references from adminClient to userClient

## Acceptance Criteria
- [x] `search()` uses userClient
- [x] `findBySlug()` uses userClient
- [ ] Hidden articles are not returned even if application filter is removed
