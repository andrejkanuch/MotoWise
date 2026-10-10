# Supabase — migrations, RLS, SQL checks

## What is here
- `migrations/` — every schema change, as `00NNN_<name>.sql`
- `checks/` — SQL checks with fixtures; `checks/run.sh` runs them in a disposable Postgres container (needs Docker) and cannot reach another database
- `templates/`, `config.toml` — auth email templates and local config
- `seed.sql`, `seed-articles.sql` — local seeds

## Rules
- **Every DB change is a migration** in `migrations/`. Create it with `pnpm db:migration <name>`.
- **Applying a migration to production is an owner-approved step.** Write the file and stop; do not apply it yourself. `npx supabase db push` is retired. The route that is used, and why: `docs/runbooks/supabase-migrations.md`.
- **Number above the highest version live on production**, not above the highest file here. A number may be reserved by an unmerged branch.
- **A migration that is live on production is frozen.** Correct it with a new migration (00178 re-applies 00141 this way).
- **RLS on every new table.** Never skip the policies.
- **Role checks read `public.users.role`**, never `raw_user_meta_data`.
- `pnpm db:types` and `pnpm generate` read the linked production project, so generated types show only what is live there.
- Read a migration's header before anything is done with it: some state a deploy order or must land as one batch.

## Soft delete
**Soft delete goes through a `SECURITY DEFINER` RPC, never a direct UPDATE.** PostgreSQL applies SELECT policies to the NEW row of an UPDATE whenever the statement reads table columns (a `WHERE` clause, `RETURNING`, or a Supabase `.select()`), so a `deleted_at IS NULL` SELECT policy rejects the UPDATE that sets `deleted_at` with `42501`, while the table's own UPDATE policy passes.

- Shape: `soft_delete_<table>(<table>_id uuid) RETURNS boolean`, called on the **user** client (`auth.uid()` is null on service-role, so the function refuses everything).
- `true` means "deleted and yours" including already-deleted; `false` means "no such row for you".
- Pin `SET search_path = ''`.
- Pair `GRANT EXECUTE ... TO authenticated` with `REVOKE EXECUTE ... FROM PUBLIC, anon` in the same transaction. **`anon` must be named**: Postgres grants EXECUTE to PUBLIC on every new function and this project carries Supabase's `ALTER DEFAULT PRIVILEGES ... GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role`, so `REVOKE ... FROM PUBLIC` alone leaves the RPC callable unauthenticated.
- `CREATE OR REPLACE` keeps a function's existing ACL, so re-creating one to harden it does not clear a stale grant.
- Check the table list in the solution doc before adding a `deleted_at` column; `ride_summaries` has the policy shape and no RPC yet.

Why, with the measurements: `docs/solutions/architecture/soft-delete-rejected-by-select-rls-policy.md`.
