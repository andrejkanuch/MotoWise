---
status: complete
priority: p2
issue_id: "058"
tags: [code-review, database, pattern-consistency]
---

# Motorcycles and content_flags tables lack updated_at

## Problem Statement

`motorcycles` and `content_flags` are mutable entities that lack `updated_at` columns. Motorcycle mileage/nickname updates and flag status transitions have no timestamp audit trail.

## Findings

- `motorcycles` — has `created_at` only. `UpdateMotorcycleSchema` exists in types, suggesting updates are planned
- `content_flags` — status transitions (`pending` -> `reviewed` -> `resolved`) are untracked
- `users` and `articles` both have `updated_at` + trigger — inconsistent

## Proposed Solution

New migration:
```sql
ALTER TABLE public.motorcycles ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.content_flags ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.motorcycles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.content_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

## Effort
Small

## Acceptance Criteria
- [ ] Both tables have updated_at with auto-update triggers
