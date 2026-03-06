---
status: complete
priority: p2
issue_id: "054"
tags: [code-review, database, architecture]
---

# Primary motorcycle unique index doesn't exclude soft-deleted rows

## Problem Statement

`idx_motorcycles_one_primary_per_user` was created in migration 00002 (`WHERE is_primary = true`) before soft delete was added in migration 00005. If a user's primary motorcycle is soft-deleted, they cannot designate a new primary because the unique index still counts the deleted row.

## Findings

- `supabase/migrations/00002_tables_and_constraints.sql:108-109` — index predates soft delete
- Never updated in migration 00005 when `deleted_at` was added

## Proposed Solution

```sql
DROP INDEX idx_motorcycles_one_primary_per_user;
CREATE UNIQUE INDEX idx_motorcycles_one_primary_per_user
  ON public.motorcycles (user_id) WHERE is_primary = true AND deleted_at IS NULL;
```

## Effort
Small

## Acceptance Criteria
- [ ] Soft-deleted primary motorcycles don't block new primary designation
