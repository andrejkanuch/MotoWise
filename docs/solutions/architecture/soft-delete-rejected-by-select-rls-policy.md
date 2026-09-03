---
title: "Soft Delete Is Rejected By Its Own SELECT RLS Policy"
category: architecture
date: 2026-09-03
tags: [rls, postgres, supabase, soft-delete, security-definer, rpc, deleted_at, 42501]
module: expenses, rides, motorcycles, maintenance_tasks, ride_summaries
symptom: "Soft delete fails with 42501 new row violates row-level security policy, while the table's own UPDATE policy passes"
root_cause: "PostgreSQL applies SELECT policies to the NEW row of an UPDATE whenever the statement needs read access to table columns (a WHERE clause, RETURNING, or a Supabase .select()); a deleted_at IS NULL SELECT policy therefore rejects the UPDATE that sets deleted_at"
---

# Soft Delete Is Rejected By Its Own SELECT RLS Policy

## The rule

**PostgreSQL applies SELECT policies to the NEW row of an `UPDATE` whenever the
statement needs read access to table columns** — a `WHERE` clause, a `RETURNING`
clause, or a Supabase `.select()`. Every real soft delete has at least the first.

So a table with the standard owner-scoped read policy:

```sql
CREATE POLICY "Users read own <t>" ON public.<t>
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NULL);
```

cannot be soft-deleted by its owner. Stamping `deleted_at` makes the new row fail
`deleted_at IS NULL`, and the statement is rejected:

```text
42501: new row violates row-level security policy for table "<t>"
```

`RETURNING` is one trigger for that read access, not *the* trigger — this is the
part that is easy to get wrong in both directions. The relevant sentence is
footnote 2 of the "Policies Applied by Command Type" table in the PostgreSQL
[`CREATE POLICY`](https://www.postgresql.org/docs/current/sql-createpolicy.html)
docs: the SELECT policy is consulted for an `UPDATE` "if read access is required
to the existing or new row (for example, a `WHERE` or `RETURNING` clause that
refers to columns from the relation)". A `WHERE id = $1` is already such a
reference, so the rejection does not wait for `RETURNING`. The `WHERE`-less row
in the table below is the boundary case that isolates this.

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

## How to prove it

Each variant inside a rolled-back transaction, as the affected user — this is how
every result below was measured against production on 2026-09-03:

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
| add `RETURNING id` | still `42501` |
| narrow the `WHERE` to `id = '<id>'` alone | still `42501` |
| relax the **SELECT** policy's `deleted_at IS NULL` | **succeeds** |
| relax the UPDATE `WITH CHECK` to `true` | still `42501` |
| drop the `WHERE` clause entirely (no column read required) | **succeeds** — 4 rows |
| run as `service_role` | **succeeds** |

Two of those rows are the ones that pin the mechanism down. `RETURNING` changes
nothing, so the read access that pulls in the SELECT policy is already there
without it. And a `WHERE`-less `UPDATE ... SET deleted_at = now()` — the one form
that needs no read access to any column — is the *only* variant that soft-deletes
successfully under the unmodified policies. Confirm it really wrote rather than
matching nothing by surfacing the count, since the SELECT policy hides the result
from you afterwards:

```sql
DO $$ DECLARE n int;
BEGIN
  UPDATE public.expenses SET deleted_at = now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE EXCEPTION 'rows_updated=%', n;   -- P0001: rows_updated=4
END $$;
```

Also diagnostic: updating any other column on the same row, with the same `WHERE`,
succeeds. Only `deleted_at` fails. If you see that asymmetry, this is your bug.

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

REVOKE EXECUTE ON FUNCTION public.soft_delete_<t>(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.soft_delete_<t>(uuid) TO authenticated;
```

Call it on the **user** client, never the admin client — `auth.uid()` is null on
service-role, and the function would refuse every delete.

Five properties are load-bearing:

- **`SECURITY DEFINER`** — runs as the table owner, so the SELECT policy does not
  apply and the UPDATE lands.
- **`user_id = v_uid` inside the function** — ownership stays in the database.
  This is the whole reason to prefer the RPC over the admin client.
- **`SET search_path = ''`** — a `SECURITY DEFINER` function without a pinned
  search_path can be hijacked by a shadowing schema. Everything inside must then
  be schema-qualified.
- **`REVOKE EXECUTE ... FROM PUBLIC, anon`** — and `anon` has to be named. Two
  default grants stack up on a new function in `public`, and revoking only the
  first looks like a fix without being one. See below.
- **The `EXISTS` tail** — returns `true` for an already-deleted row the caller
  owns, so duplicate taps, stale lists and offline sync retries converge instead
  of erroring.

Return contract, identical for all four functions:

- `true` -> the row is soft-deleted **and** belongs to the caller
- `false` -> no such row for this caller

`false` deliberately does not distinguish "missing" from "owned by someone else".
Splitting them would be an existence oracle for other users' ids.

## Why the REVOKE has to name `anon`

A new function in `public` picks up **two** independent EXECUTE grants, and the
advice you will find everywhere only removes one of them:

1. PostgreSQL grants `EXECUTE` to `PUBLIC` on every new function. Privileges are
   additive, so `GRANT ... TO authenticated` does not remove it.
2. Supabase additionally ships `ALTER DEFAULT PRIVILEGES ... IN SCHEMA public
   GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role`. Check it with
   `SELECT defaclobjtype, defaclacl FROM pg_default_acl` — `f` is the functions
   row. This one is an **explicit grant to `anon`**, and `REVOKE ... FROM PUBLIC`
   does not touch explicit grants.

So the usual `REVOKE EXECUTE ... FROM PUBLIC` leaves the function callable by
unauthenticated PostgREST requests while *looking* closed. Measured against this
database on 2026-09-03, with a throwaway `SECURITY DEFINER` probe function:

| statement | `SET LOCAL role anon; SELECT probe()` |
| --- | --- |
| `REVOKE ... FROM PUBLIC` only | returns `1` — **still executable** |
| `REVOKE ... FROM PUBLIC, anon` | `42501 permission denied for function` |

`service_role` keeps its grant on purpose: the `auth.uid() IS NULL` guard makes
the function refuse it, and a role that bypasses RLS wholesale gains nothing from
holding or losing this one grant.

Two more things that bite here:

- **`CREATE OR REPLACE FUNCTION` keeps the existing ACL.** Re-creating a function
  to harden it does not reset its grants, so a stale `anon` grant survives the
  replacement — which is exactly why `00176` has to revoke on the two functions it
  inherited from `00027`, not just the two it introduces.
- **Keep `REVOKE` and `GRANT` in the same transaction as the `CREATE`**, so there
  is no window in which the function exists and is executable by everyone.

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
