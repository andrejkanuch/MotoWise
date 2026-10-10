# Runbook: Supabase migrations and production

**Applying a migration to production is an owner-approved step.** An agent writes the
migration file and stops. It does not apply anything to production on its own
initiative, as part of a data-model change or otherwise.

This runbook records only what tracked files in this repository already state. It does
not define a procedure. **How migrations are meant to reach production is an open owner
decision** (Owner Decision 1 of
`docs/plans/2026-10-10-1356-refactor-mobile-structure-and-agent-instructions-plan.md`):
retire `npx supabase db push`, or repair it with a non-interactive database password.
Until the owner rules, treat everything under "What the tracked record shows" as history,
not as instructions.

## What an agent may do without asking

- Create the file: `pnpm db:migration <name>` (`supabase migration new`), then rename it
  to the `00NNN_<name>.sql` form the folder uses, numbered as described below.
- Run the SQL checks: `supabase/checks/run.sh`. It starts a disposable `postgres:17`
  container and has no host, port or URL parameter, so it cannot reach another database.
  It needs Docker.

## Type generation reads production

`pnpm db:types` runs `supabase gen types typescript --linked` in `packages/types`.
`--linked` means the linked Supabase project, which is production. `pnpm generate` runs
the same task along with the schema and codegen tasks. So:

- Regenerated types describe what is live in production, not what the migrations folder
  would build. A migration that has not been applied is absent from them.
- `features/bike-detail-shell-overview/data-verification.md` records a case where types
  for unapplied migrations (00180 to 00182) were produced another way, and why
  `supabase gen types --local` could not reproduce the committed file.

## Numbering

- Pick the next number above the highest version **live on production**, not above the
  highest file in `supabase/migrations/`
  (`features/Receipt-scan/NEXT-SESSION.md`; `docs/Activation-Store-Truth-Runbook-2026-08-24.md`:
  "Check the number first").
- A number can be reserved by an unmerged branch. The headers of 00184, 00185 and 00187
  say so about 00180 to 00182.
- A migration that is live on production is not edited. A correction is a new migration:
  `supabase/migrations/00178_reapply_00141_users_grants_and_rpc_auth.sql` re-applies
  00141 instead of changing it.

## What the tracked record shows

- **`npx supabase db push` has not been the working route.**
  `docs/Activation-Store-Truth-Runbook-2026-08-24.md` records that `npx supabase db push`
  and `npx supabase migration list` block on an interactive database-password prompt.
  `docs/HANDOFF-Growth-MOT-269.md` (2026-06-30) records `db push` failing with
  `Remote migration versions not found in local migrations directory`, because of
  history drift.
- **The Supabase Management API is the route those documents show working.** Migration
  00174 was applied with `POST /v1/projects/{ref}/database/query`
  (`docs/Activation-Store-Truth-Runbook-2026-08-24.md`). The header of
  `supabase/migrations/00187_revenuecat_entitlement_source_of_truth.sql` is written for
  that route: "Apply this whole file as ONE statement batch (one Management API call,
  with this leading comment block stripped: a call that starts with a comment executes
  nothing)". `docs/runbooks/supabase-confirmation-template.md` uses the same API for an
  auth template.
- **The Management API does not record the version.** After 00174 the version was
  written into `supabase_migrations.schema_migrations` by hand (same document).
  Out-of-band applies have also landed with a timestamp version instead of the file
  number: 00158 was recorded as `20260625120202` (`docs/HANDOFF-Growth-MOT-269.md`).
- **`schema_migrations` is not proof that a migration is live.** 00141 was listed as
  applied while its grants, policies and RPC checks were absent from production; 00178
  re-applied it (the header of 00178;
  `features/bike-detail-shell-overview/data-verification.md`). Verify the objects, not
  the row.
- **Read a migration's header before applying it.** Some state a deploy order (00187:
  apply the migration, then deploy the API; 00178: deploy the code first) and some must
  land as one batch so that a `REVOKE` is never separated from its `CREATE`.

## Local database

- `pnpm db:start`, `pnpm db:stop` and `pnpm db:reset` wrap the Supabase CLI.
- `features/bike-detail-shell-overview/local-stack.md` (2026-10-05) records that the
  repository's own `supabase/` folder cannot replay on an empty database (00097, 00098
  and 00102 fail), so `supabase start` and `db reset` from the repository root fail, and
  describes the patched scratch workdir used instead.
- The same file warns against copying `project-ref`, `pooler-url` or
  `linked-project.json` out of `supabase/.temp` into a scratch workdir: those files link
  a directory to production.

## Related

- `docs/solutions/architecture/soft-delete-rejected-by-select-rls-policy.md` — the
  soft-delete RPC rule and why its `REVOKE` must name `anon`.
- `supabase/checks/` — SQL checks and their fixtures.
