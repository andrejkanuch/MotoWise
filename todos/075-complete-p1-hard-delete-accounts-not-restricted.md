---
status: pending
priority: p1
issue_id: "075"
tags: [code-review, security, supabase, rls]
dependencies: []
---

## Problem Statement

`hard_delete_expired_accounts()` in migration `00033_account_deletion.sql` is declared `SECURITY DEFINER` but has no `REVOKE/GRANT` statements. Any authenticated user (or anonymous client) can call this RPC via PostgREST and permanently destroy all soft-deleted accounts whose grace period has expired.

Compare with `process_revenuecat_event` in migration `00031` which correctly restricts execution to `service_role`.

## Findings

- **Security Sentinel**: CRITICAL C1 — actively exploitable privilege escalation enabling data destruction
- **Architecture Strategist**: P1 — matches pattern established in migration 00031 but was missed here
- **Learnings Researcher**: Past solution `monorepo-code-review-multi-category-fixes.md` emphasizes RLS policy completeness

## Proposed Solutions

### Option A: Add REVOKE/GRANT to migration 00033
Add to the end of the migration:
```sql
REVOKE EXECUTE ON FUNCTION public.hard_delete_expired_accounts FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hard_delete_expired_accounts TO service_role;
```
Also restrict `soft_delete_user` and `cancel_account_deletion` for defense-in-depth.
- Pros: Minimal change, follows existing pattern
- Cons: Requires new migration or amending existing one
- Effort: Small
- Risk: Low

## Acceptance Criteria

- [ ] `hard_delete_expired_accounts` only callable by service_role
- [ ] `soft_delete_user` and `cancel_account_deletion` restricted similarly
- [ ] Verified via `SELECT proname, proacl FROM pg_proc WHERE proname IN ('hard_delete_expired_accounts', 'soft_delete_user', 'cancel_account_deletion')`
