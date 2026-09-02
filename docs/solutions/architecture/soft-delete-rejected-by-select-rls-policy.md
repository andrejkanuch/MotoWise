---
title: "Soft Delete Is Rejected By Its Own SELECT RLS Policy"
category: architecture
date: 2026-09-03
tags: [rls, postgres, supabase, soft-delete, security-definer, rpc, deleted_at, 42501]
module: expenses, rides, motorcycles, maintenance_tasks, ride_summaries
symptom: "Soft delete fails with 42501 new row violates row-level security policy, while the table's own UPDATE policy passes"
root_cause: "PostgreSQL applies SELECT policies to the NEW row of an UPDATE; a deleted_at IS NULL SELECT policy therefore rejects the UPDATE that sets deleted_at"
---

# Soft Delete Is Rejected By Its Own SELECT RLS Policy

## The rule

**PostgreSQL applies SELECT policies to the NEW row of an `UPDATE`.**

So a table with the standard owner-scoped read policy:

```sql
CREATE POLICY "Users read own <t>" ON public.<t>
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NULL);
```

cannot be soft-deleted by its owner. Stamping `deleted_at` makes the new row fail
`deleted_at IS NULL`, and the statement is rejected:

```
42501: new row violates row-level security policy for table "<t>"
```

The table's own `UPDATE` policy passes. It is the **SELECT** policy doing the
rejecting. That is the whole trap — the error names the table, not the policy, so
it reads as an ownership problem and sends you to the wrong place.

## How we learned it the expensive way

Migration `00053` tried to fix exactly this on `expenses` by simplifying the
UPDATE policy's `WITH CHECK`. It changed nothing, because the UPDATE policy was
never the problem. Expense deletion then stayed **broken for every rider from the
day it shipped** until 2026-09-02 (Sentry `MOTO-VAULT-REACT-NATIVE-1M`, 418
events / 14 users — the event count is people tapping Delete repeatedly). A
support report from a rider with a VTX1800R, unable to remove two duplicate
entries, is what finally surfaced it.

An earlier fix on `expenses` (`.maybeSingle()` instead of `.single()`) removed the
PGRST116 noise sitting on top of the bug without reaching it. Worth knowing why
it could not: a 0-row match and a **rejected statement** are different shapes. The
reject arrives as `error`, so tolerating the empty result never sees it.

## How to prove it in 3 queries

Each inside a rolled-back transaction, as the affected user:

```sql
BEGIN;
SET LOCAL role authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"<user-uuid>","role":"authenticated"}', true);
UPDATE public.expenses SET deleted_at = now() WHERE id = '<id>' AND deleted_at IS NULL;
ROLLBACK;
```

| change | result |
| --- | --- |
| none (baseline) | `42501` |
| relax the **SELECT** policy's `deleted_at IS NULL` | **succeeds** |
| relax the UPDATE `WITH CHECK` to `true` | still `42501` |
| run as `service_role` | **succeeds** |

Also diagnostic: updating any other column on the same row succeeds. Only
`deleted_at` fails. If you see that asymmetry, this is your bug.

## The fix: a SECURITY DEFINER RPC

Canonical since migration `00176`. Every user-facing soft delete goes through a
function shaped like this:

```sql
CREATE OR REPLACE FUNCTION public.soft_delete_<t>(<t>_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;

  UPDATE public.<t> SET deleted_at = NOW()
  WHERE id = <t>_id AND user_id = v_uid AND deleted_at IS NULL;

  IF FOUND THEN RETURN true; END IF;

  RETURN EXISTS (SELECT 1 FROM public.<t> WHERE id = <t>_id AND user_id = v_uid);
END;
$$;

GRANT EXECUTE ON FUNCTION public.soft_delete_<t>(uuid) TO authenticated;
```

Call it on the **user** client, never the admin client — `auth.uid()` is null on
service-role, and the function would refuse every delete.

Four properties are load-bearing:

- **`SECURITY DEFINER`** — runs as the table owner, so the SELECT policy does not
  apply and the UPDATE lands.
- **`user_id = v_uid` inside the function** — ownership stays in the database.
  This is the whole reason to prefer the RPC over the admin client.
- **`SET search_path = ''`** — a `SECURITY DEFINER` function without a pinned
  search_path can be hijacked by a shadowing schema. Everything inside must then
  be schema-qualified.
- **The `EXISTS` tail** — returns `true` for an already-deleted row the caller
  owns, so duplicate taps, stale lists and offline sync retries converge instead
  of erroring.

Return contract, identical for all four functions:

- `true` -> the row is soft-deleted **and** belongs to the caller
- `false` -> no such row for this caller

`false` deliberately does not distinguish "missing" from "owned by someone else".
Splitting them would be an existence oracle for other users' ids.

## Why not the service-role client

It works, and `rides.deleteRide` shipped that way for a while. The cost is that
service-role bypasses RLS wholesale, so ownership stops being a database
guarantee and becomes an `.eq('user_id', userId)` in application code — one
careless refactor from a cross-tenant delete, with nothing underneath to catch
it. Root `CLAUDE.md` says "NEVER use service-role for user-scoped writes"; the
RPC keeps that rule intact rather than widening its exception list.

## Every table with this policy shape

Check this list before adding a `deleted_at` column to a new table.

| table | status |
| --- | --- |
| `expenses` | RPC `soft_delete_expense` (00176) |
| `rides` | RPC `soft_delete_ride` (00176) — was admin-client |
| `motorcycles` | RPC `soft_delete_motorcycle` (00027, hardened in 00176) |
| `maintenance_tasks` | RPC `soft_delete_maintenance_task` (00027, hardened in 00176) |
| `ride_summaries` | **latent** — same policy shape (`00058:68`), no soft-delete path wired up yet. Wire one and it breaks the same way. |
| `ride_waypoints` | not affected — no `deleted_at`; rows are hard-deleted by the `purge_soft_deleted_rides` GDPR job (`00048`) |

## Why a mocked unit suite cannot catch this

Every `softDelete` test in this repo mocks the Supabase client, so the failure —
which lives entirely in a **database policy** — is structurally invisible. The
suite was green for the whole time expense deletion was 100% broken in
production. The regression guards added alongside `00176` assert the *shape*
(RPC, not a direct `.update()`, on the user client) rather than the behaviour,
because shape is the most a mocked suite can honestly prove here. Catching the
behaviour needs an integration test against real Postgres with RLS on, which this
repo does not have anywhere.

## Related

- `docs/solutions/security-issues/expense-rls-idor-motorcycle-ownership.md` — a
  *different* expenses RLS defect (missing motorcycle-ownership check in the
  INSERT/UPDATE `WITH CHECK`, fixed by `00038`). Same table, unrelated bug; do
  not conflate them.
- `docs/solutions/security-issues/supabase-admin-client-on-public-queries.md` —
  the admin-client rule this fix avoids leaning on.
