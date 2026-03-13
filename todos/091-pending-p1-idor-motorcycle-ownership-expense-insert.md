---
status: pending
priority: p1
issue_id: "091"
tags: [code-review, security, rls, supabase]
dependencies: []
---

# IDOR: Motorcycle ownership not verified on expense INSERT

## Problem Statement

The INSERT RLS policy on the `expenses` table only checks `auth.uid() = user_id`. It does **not** verify that `motorcycle_id` belongs to the authenticated user. A malicious user who knows another user's motorcycle UUID could associate expense records with motorcycles they don't own.

The `ExpensesService.create()` method passes `motorcycle_id` directly from user input without ownership verification.

**Why it matters:** Data integrity issue. While SELECT RLS prevents cross-user reads, fraudulent records could be created linked to other users' motorcycles.

**Known Pattern:** `docs/solutions/integration-issues/monorepo-code-review-multi-category-fixes.md` — prior RLS privilege escalation was caused by missing `WITH CHECK` clauses.

## Findings

- **Security Sentinel:** Classified as MEDIUM. INSERT policy at `00036_create_expenses_table.sql:24-26` only checks `auth.uid() = user_id`
- **Learnings Researcher:** Prior incident with RLS privilege escalation from missing WITH CHECK clause
- The FK constraint `REFERENCES motorcycles(id)` only checks existence, not ownership

## Proposed Solutions

### Option A: Fix in RLS policy (Recommended)
Add motorcycle ownership subquery to INSERT WITH CHECK:
```sql
CREATE POLICY "Users insert own expenses" ON public.expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND motorcycle_id IN (
      SELECT id FROM public.motorcycles WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  );
```
- Pros: Defense at the database level, impossible to bypass
- Cons: Subquery on every insert (minimal cost)
- Effort: Small
- Risk: Low

### Option B: Application-level check in ExpensesService.create()
Verify motorcycle ownership before inserting.
- Pros: Easier to test, clearer error message
- Cons: Can be bypassed if another code path inserts expenses
- Effort: Small
- Risk: Medium (less defense-in-depth)

## Recommended Action

Option A — fix at the RLS level for defense-in-depth.

## Technical Details

- **Affected files:** `supabase/migrations/00036_create_expenses_table.sql`, potentially `apps/api/src/modules/expenses/expenses.service.ts`
- **Database changes:** ALTER POLICY or new migration to replace the INSERT policy

## Acceptance Criteria

- [ ] INSERT RLS policy verifies motorcycle_id belongs to auth.uid()
- [ ] Test: attempt to create expense with another user's motorcycle_id fails
- [ ] Existing INSERT behavior for own motorcycles unchanged

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-13 | Created from code review | Security sentinel + learnings researcher flagged |

## Resources

- PR #23: https://github.com/andrejkanuch/MotoWise/pull/23
- Prior RLS fix: `docs/solutions/integration-issues/monorepo-code-review-multi-category-fixes.md`
