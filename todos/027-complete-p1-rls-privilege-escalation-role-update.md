---
status: pending
priority: p1
issue_id: "027"
tags: [code-review, security]
dependencies: []
---

# RLS Privilege Escalation — Users Can Self-Promote to Admin

## Problem Statement

The RLS policy on `public.users` allows `UPDATE USING (auth.uid() = id)` with no `WITH CHECK` clause preventing role changes. Any authenticated user can execute `UPDATE public.users SET role = 'admin' WHERE id = auth.uid()` to gain admin access across the entire system.

## Findings

- **Source:** Security Sentinel (P2-4 — upgraded to P1 due to severity)
- **File:** `supabase/migrations/00003_rls_indexes_triggers_storage.sql:62`
- The `role` column uses `user_role` enum but has no column-level restriction
- Admin role grants access to admin dashboard AND all admin RLS policies

## Proposed Solutions

### Option A: Add WITH CHECK Clause to Prevent Role Changes
```sql
CREATE POLICY "Users update own data" ON public.users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (role = (SELECT role FROM public.users WHERE id = auth.uid()));
```
- **Effort:** Small (new migration)
- **Risk:** None

### Option B: BEFORE UPDATE Trigger
Reject role changes unless performed by service-role.
- **Effort:** Small
- **Risk:** None

## Recommended Action

Option A — simplest, most enforceable at the DB level.

## Acceptance Criteria

- [ ] Users cannot change their own `role` column via RLS
- [ ] Admin promotion only possible via service-role (admin client)
- [ ] Verified with test: `supabase.from('users').update({role:'admin'}).eq('id', userId)` fails

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-06 | Created from code review | MOST DANGEROUS finding — immediate fix required |

## Resources

- `supabase/migrations/00003_rls_indexes_triggers_storage.sql`
