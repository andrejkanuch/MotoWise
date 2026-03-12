---
status: pending
priority: p1
issue_id: "076"
tags: [code-review, security, supabase, rls, gdpr]
dependencies: []
---

## Problem Statement

The `data_export_requests` UPDATE RLS policy in migration `00032_data_export_requests.sql` uses `USING (true)` without a `TO` clause, allowing ANY authenticated user to update ANY export request record (including changing `download_url`, `status`, etc.).

```sql
create policy "Service role can update export requests"
  on public.data_export_requests for update
  using (true);
```

The policy name is misleading — service_role already bypasses RLS, so this policy is only granting access to non-service roles.

## Findings

- **Security Sentinel**: HIGH H2 — attacker could change another user's export URL
- **Performance Oracle**: HIGH — overly permissive
- **TypeScript Reviewer**: CRITICAL — over-permissive RLS
- **Architecture Strategist**: P1

## Proposed Solutions

### Option A: Scope to service_role only
```sql
create policy "Service role can update export requests"
  on public.data_export_requests for update
  to service_role
  using (true);
```
- Effort: Small | Risk: Low

### Option B: Drop the policy entirely
Service_role bypasses RLS anyway. The policy is unnecessary.
- Effort: Small | Risk: Low

## Acceptance Criteria

- [ ] Authenticated users cannot update other users' export requests
- [ ] Service role can still update export status programmatically
