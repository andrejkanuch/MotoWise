---
status: pending
priority: p2
issue_id: "055"
tags: [code-review, security, nestjs]
---

# Cursor pagination uses unvalidated base64-decoded date + users can modify immutable columns

## Problem Statement

Two input validation issues:

1. `ArticlesService.search()` base64-decodes the cursor and passes it directly to the query filter with no validation that it's a valid ISO date.
2. Users UPDATE RLS policy allows modifying `created_at` and `email` columns — only `role` is protected.

## Findings

- `apps/api/src/modules/articles/articles.service.ts:36-37` — unvalidated cursor
- `supabase/migrations/00004_fix_rls_role_escalation.sql:7-9` — only role is guarded

## Proposed Solution

**Cursor validation:**
```typescript
const cursorDate = Buffer.from(input.after, 'base64').toString('utf-8');
if (isNaN(Date.parse(cursorDate))) throw new BadRequestException('Invalid cursor');
```

**Immutable columns:** Add a trigger or extend the WITH CHECK to also protect email and created_at:
```sql
WITH CHECK (
  role = (SELECT role FROM public.users WHERE id = auth.uid())
  AND email = (SELECT email FROM public.users WHERE id = auth.uid())
);
```

## Effort
Small

## Acceptance Criteria
- [ ] Invalid cursors return 400, not a DB error
- [ ] Users cannot modify their own email or created_at via direct Supabase update
