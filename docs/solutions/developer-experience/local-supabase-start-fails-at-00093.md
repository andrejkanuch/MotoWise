---
title: "Local `supabase start` cannot replay the migrations; verify an unapplied migration with checks/run.sh instead"
symptom: "`supabase start` from the repo root stops replaying migrations (seen at 00093 with ll_to_earth, and at 00097/00098/00102)"
category: developer-experience
date: 2026-10-12
module: supabase migrations
problem_type: developer_experience
component: database
severity: medium
applies_when:
  - "Verifying a new migration's RLS, grants or CHECKs before it is applied to production"
  - "Running `pnpm db:start` or `pnpm db:reset` to replay every migration locally"
  - "A new table needs entries in packages/types/src/database.types.ts before production has it"
symptoms:
  - "`supabase start` (pnpm db:start) aborts while replaying migrations with `function ll_to_earth(double precision, double precision) does not exist`"
  - "`pnpm db:types` / `generate:types` output lacks a table whose migration is not yet live"
root_cause: "migration ordering: 00093_places.sql uses ll_to_earth() but cube/earthdistance are created later, in 00094"
resolution_type: workflow_improvement
tags: [supabase, migrations, local-dev, rls, earthdistance, database-types, checks]
---

# Local `supabase start` cannot replay the migrations; verify an unapplied migration with checks/run.sh instead

## Context

While building the `feedback_messages` table (migration 00190, branch `feat/store-review-direct`), the plan called for proving its RLS and grants and for generating its types before the migration reached production. Both obvious routes fail in this repo:

- `pnpm db:start` / `npx supabase start` from the repo root cannot replay the migrations onto an empty database. On 2026-10-12 (`npx supabase start` from the repo root, Supabase CLI 2.120.0, the locally cached Supabase Postgres 17.6.1.063 Docker image) it stopped at `supabase/migrations/00093_places.sql:28`, whose index calls `ll_to_earth(latitude, longitude)`; the only migration that creates `cube` and `earthdistance` is the later `supabase/migrations/00094_route_slug_backfill_rpcs.sql:36-37`, so this is likely the cause, but the base image's preinstalled extensions were not checked. `features/bike-detail-shell-overview/local-stack.md` (2026-10-05) records failures at 00097, 00098 and 00102 and a patched scratch workdir that does start; `docs/runbooks/supabase-migrations.md` (Local database) points to it.
- `pnpm db:types` runs `supabase gen types typescript --linked` (`packages/types/package.json`, `generate:types`), which reads production. A table whose migration is not applied yet is absent from the output (as `feedback_messages` was until its block was added by hand in this branch).

What this session did instead (worked, but cost time): ran the cached Supabase Postgres Docker image on its own with hand-made stand-in tables, found (per this session's observation; image version not recorded) that its built-in `auth.uid()` did not pick up `request.jwt.claims` and had to replace it with Supabase's current definition, which reads both `request.jwt.claim.sub` and `request.jwt.claims`, then generated types from that database and spliced only the new table's block into `database.types.ts`.

## Guidance

1. **Do not reach for `supabase start` from the repo root to test one new migration.** It cannot replay the migrations (see above). A full local stack is possible only through the patched scratch workdir in `features/bike-detail-shell-overview/local-stack.md`; for one migration's RLS, grants and constraints, the harness below is lighter.
2. **Use the repo's disposable-container harness**, `supabase/checks/run.sh` (documented in `supabase/CLAUDE.md`). It starts a throwaway `postgres:17`, cannot reach any other database, and runs `checks/fixtures/<check>.sql` before `checks/<check>.sql`. The fixture creates the `auth` schema, roles, a minimal `auth.users`, the referenced tables, and an `auth.uid()` that reads both `request.jwt.claim.sub` and `request.jwt.claims` — see `supabase/checks/fixtures/recall_acknowledgements_rls.sql` (00189) for the template. Apply the migration under test from the fixture, then probe it in the check with `SET LOCAL role authenticated` plus `set_config('request.jwt.claims', ...)` inside a transaction that rolls back.
3. **Types for an unapplied table:** the normal order in `CLAUDE.md` (apply to production, then `pnpm db:types`) stays the default. When the PR must type-check before the migration is live, generate from a database that has the migration (`supabase gen types typescript --db-url <throwaway>`) and add only that table's block to `database.types.ts`, leaving every other line as production generated it. Say so in the commit message, and regenerate with `pnpm db:types` once the migration is applied so the file returns to being purely generated.

## Why This Matters

Without this, the next agent spends the same hour: tries `db:start`, hits `ll_to_earth`, then rebuilds an auth stub that `supabase/checks` already provides. Worse, an `auth.uid()` that does not read the setting the probe sets makes an RLS probe pass or fail for the wrong reason; the fixture's definition avoids that.

## When to Apply

Any new or changed migration whose RLS, grants or constraints must be proven before it is applied to production, and any PR that adds a table the API code must already type against.

## Examples

Probe skeleton inside a check (after the fixture applied the migration):

```sql
-- in the fixture: INSERT INTO auth.users (id) VALUES ('<user-a uuid>'), ('<user-b uuid>');
-- feedback_messages.user_id references auth.users, so seed the probe users first.
BEGIN;
SET LOCAL role authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', '<user-a uuid>', 'role', 'authenticated')::text, true);
INSERT INTO public.feedback_messages (user_id, client_id, message, platform, app_version, locale)
VALUES ('<user-a uuid>', gen_random_uuid(), 'hi', 'ios', '3.26.0', 'en');   -- expect OK
-- same insert with another user's id -> expect 42501
ROLLBACK;
```

Related: `docs/solutions/architecture/soft-delete-rejected-by-select-rls-policy.md` (same rolled-back probe technique).
