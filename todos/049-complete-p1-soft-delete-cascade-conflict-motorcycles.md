---
status: pending
priority: p1
issue_id: "049"
tags: [code-review, database, data-integrity]
---

# Soft delete + CASCADE conflict on diagnostics.motorcycle_id

## Problem Statement

`diagnostics.motorcycle_id` uses `ON DELETE CASCADE`, but motorcycles use soft delete (`deleted_at`). If a motorcycle is ever hard-deleted (admin operation, data cleanup), all diagnostics are silently destroyed — the exact scenario soft delete was designed to prevent.

## Findings

- `supabase/migrations/00002_tables_and_constraints.sql:66` — `ON DELETE CASCADE`
- Schema design doc explicitly states: "Diagnostics reference motorcycles; deleting breaks history"
- No application code prevents hard-delete via Supabase client `.delete()`
- No `softDelete()` method exists in `motorcycles.service.ts`

## Proposed Solution

New migration:
```sql
ALTER TABLE public.diagnostics
  DROP CONSTRAINT diagnostics_motorcycle_id_fkey,
  ADD CONSTRAINT diagnostics_motorcycle_id_fkey
    FOREIGN KEY (motorcycle_id) REFERENCES public.motorcycles(id) ON DELETE RESTRICT;
```

Also add a `softDelete()` method to `MotorcyclesService` to establish the correct pattern.

## Effort
Small — migration + service method

## Acceptance Criteria
- [ ] `diagnostics.motorcycle_id` uses ON DELETE RESTRICT
- [ ] `MotorcyclesService` has `softDelete()` that sets `deleted_at = NOW()`
- [ ] Hard-deleting a motorcycle with diagnostics fails at DB level
