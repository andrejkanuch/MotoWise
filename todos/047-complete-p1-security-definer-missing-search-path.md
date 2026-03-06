---
status: pending
priority: p1
issue_id: "047"
tags: [code-review, security, database]
---

# SECURITY DEFINER functions missing search_path pinning

## Problem Statement

`is_admin()` and `handle_new_user()` are `SECURITY DEFINER` functions that execute with owner (postgres) privileges. Neither sets `search_path`, allowing potential privilege escalation if an attacker can create objects in a schema that shadows `public.users` or `auth.uid()`.

## Findings

- `is_admin()` at `supabase/migrations/00003_rls_indexes_triggers_storage.sql:7-11` — used in RLS policies on 8 tables
- `handle_new_user()` at same file lines 32-39 — also SECURITY DEFINER, also no search_path
- `handle_new_user()` additionally trusts `raw_user_meta_data->>'full_name'` with no length constraint

## Proposed Solution

New migration adding `SET search_path = ''` to both functions:

```sql
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, LEFT(NEW.raw_user_meta_data->>'full_name', 200), 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
```

Also add `CHECK (char_length(full_name) <= 200)` to users table.

## Effort
Small — single migration file

## Acceptance Criteria
- [ ] Both functions have `SET search_path = ''`
- [ ] `full_name` has length constraint at DB level
