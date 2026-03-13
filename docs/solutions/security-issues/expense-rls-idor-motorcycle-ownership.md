---
title: "Expense INSERT RLS Missing Motorcycle Ownership Check (IDOR)"
category: security-issues
tags: [supabase, rls, idor, expenses, insert-policy, with-check]
module: Expenses
symptom: "INSERT RLS policy allows creating expenses referencing another user's motorcycle_id"
root_cause: "WITH CHECK clause only verified auth.uid() = user_id, not motorcycle ownership"
date: 2026-03-13
severity: medium
---

# Expense INSERT RLS Missing Motorcycle Ownership Check

## Problem

The `expenses` table INSERT RLS policy only checked `auth.uid() = user_id`. A user who knows another user's motorcycle UUID could create expense records associated with motorcycles they don't own. The UPDATE policy had the same gap.

While SELECT RLS prevents cross-user reads (so the victim never sees the attacker's expenses), this is still a data integrity issue — an IDOR (Insecure Direct Object Reference) vulnerability.

## Root Cause

When creating the expenses table migration (00036), the INSERT `WITH CHECK` clause was modeled after simpler tables where `user_id` alone is sufficient. For tables with foreign keys to user-owned resources (like `motorcycle_id → motorcycles`), the RLS policy must also verify ownership of the referenced resource.

## Solution

Created migration `00038_fix_expense_insert_rls_motorcycle_ownership.sql`:

```sql
-- Fix INSERT policy
DROP POLICY "Users insert own expenses" ON public.expenses;
CREATE POLICY "Users insert own expenses" ON public.expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND motorcycle_id IN (
      SELECT id FROM public.motorcycles WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  );

-- Fix UPDATE policy
DROP POLICY "Users update own expenses" ON public.expenses;
CREATE POLICY "Users update own expenses" ON public.expenses
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NULL)
  WITH CHECK (
    auth.uid() = user_id
    AND motorcycle_id IN (
      SELECT id FROM public.motorcycles WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  );
```

## Prevention

**Rule:** When a table has a foreign key to a user-owned resource, the RLS `WITH CHECK` must verify ownership of BOTH the row being created AND all referenced resources.

**Pattern to follow for new tables:**
```sql
-- For any table with user_id AND a FK to another user-owned table:
WITH CHECK (
  auth.uid() = user_id
  AND foreign_resource_id IN (
    SELECT id FROM foreign_table WHERE user_id = auth.uid() AND deleted_at IS NULL
  )
)
```

**Checklist for new RLS policies:**
1. Does the table reference another user-owned table via FK?
2. If yes, add ownership subquery to WITH CHECK
3. Apply to both INSERT and UPDATE policies
4. Include `deleted_at IS NULL` on the subquery to prevent referencing soft-deleted resources

## Related

- Prior RLS fix: `docs/solutions/integration-issues/monorepo-code-review-multi-category-fixes.md` (missing WITH CHECK clause)
- PR #23: https://github.com/andrejkanuch/MotoWise/pull/23
