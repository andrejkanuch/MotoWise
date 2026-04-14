---
title: "word_similarity() not found in SECURITY DEFINER function"
category: runtime-errors
date: 2026-04-14
tags: [supabase, pg_trgm, search_path, security-definer, typeahead]
components: [search-service, typeahead-rpc]
severity: P1
---

## Problem

After deploying migration `00103_typeahead_word_similarity.sql`, the `typeahead_search` RPC failed with:

```
function word_similarity(text, text) does not exist (SQLSTATE 42883)
```

`word_similarity()` worked fine when called directly in SQL, but failed inside the RPC function.

## Root Cause

The function was declared with `SET search_path = ''` (empty string). This is a common security hardening pattern for `SECURITY DEFINER` functions to prevent search path injection. However, it also excludes the `public` schema where `pg_trgm` extension functions are installed on this Supabase instance.

The previous `similarity()` function worked because it's an operator-bound function resolved differently, while `word_similarity()` requires schema resolution through `search_path`.

## Solution

Change `SET search_path = ''` to `SET search_path = 'public'`:

```sql
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public';
```

This allows the function to find `pg_trgm` functions while still preventing unqualified access to other schemas.

**Additional fixes applied in the same pass:**
- Replaced `set_limit(0.15)` with explicit `WHERE word_similarity(...) >= 0.15` — `set_limit()` is session-scoped and leaks across pooled connections (Supavisor/PgBouncer)
- Added `q.trim().slice(0, 100)` input length cap in the NestJS service to prevent trigram DoS
- Added `IF result_limit > 20 THEN result_limit := 20` inside the RPC to prevent abuse via direct PostgREST calls

## Prevention

Before deploying any `SECURITY DEFINER` function that uses extension functions (`pg_trgm`, `PostGIS`, etc.), verify the extension's schema and include it in the function's `search_path`. On Supabase, `pg_trgm` lives in `public`. Check with:

```sql
SELECT nspname FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace
WHERE e.extname = 'pg_trgm';
```

Never use `set_limit()` or other session-state-mutating functions inside RPC functions when connection pooling is in use — prefer explicit threshold comparisons.
