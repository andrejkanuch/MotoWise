---
title: "[#365 T39] Backfill service schedules for existing onboarding bikes (owner-run RPC); seed missing model rows"
labels: [enhancement, area:db, area:api, activation-365]
order: 54
task_id: T39
depends_on: [T07a]
phase: P4
size: M
release_path: "owner-applied migration with a SECURITY DEFINER RPC, run by the owner after a dry-run SELECT"
---

## Context
#365, plan §3 T39 (review item 11), D7. Board Exp 2 step 2 [SOURCE: board/99 Exp 2].

## Why
~250 onboarding bikes since 2026-08-24 have no tasks [SOURCE: R2 §3.1]. CLAUDE.md: never the service-role client for user-scoped writes; memory `project_service_role_key_public_repo` warns about service-role scripts.

## What to change
1. Dry run (`p_dry_run => true`, read-only) prints, with no emails or ids:
   - **per-tier counts**: target bikes by tier (model / make-generic / generic) and by capture level, and the number of tasks each tier would insert;
   - **a correctness sample**: for imperial bikes, `target_mileage − current_mileage = round(interval_km / 1.609344)` ±1 on every sampled task; and each `oem_schedule_id` is the verified schedule of the tier the API would pick for that bike (same waterfall as `autoPopulateForBike`, `apps/api/src/modules/oem-schedules/oem-schedules.service.ts:178-273`).
2. Migration `supabase/migrations/<n>_backfill_onboarding_service_plans.sql`: a reviewed `SECURITY DEFINER` function that inserts OEM tasks per bike with the same rules as `autoPopulateForBike` (unit conversion, dedup ignoring soft-deleted rows), with a `p_dry_run` flag and a batch limit; RLS untouched. The function has `SET search_path = ''` (schema-qualify every name) and is followed by `REVOKE EXECUTE ON FUNCTION … FROM PUBLIC, anon, authenticated;` — **no `GRANT` to `authenticated`** (only the owner runs it, as `service_role`).
3. `supabase/checks/backfill_onboarding_service_plans.sql` (pattern of the existing files in `supabase/checks/`, run by `supabase/checks/run.sh`): assert `has_function_privilege('authenticated', '<fn signature>', 'EXECUTE') = false` and `has_function_privilege('anon', '<fn signature>', 'EXECUTE') = false`.
4. The **owner** applies the migration and runs it (dry run first). Agents never apply or run it.
5. After the owner's run: a follow-up migration drops the function (`DROP FUNCTION …`), so it cannot be called again.
6. Run only after T07a's reminder cap is live (one combined push per bike, at most one per bike per 7 days; backfilled tasks create no immediate reminder). Model rows: data pipeline (memory `project_data_sourcing_pipeline`), MT-07 first.

## How
SQL checks in `supabase/checks/`: the privilege assertions above (run locally with `supabase/checks/run.sh`, which uses a throwaway Docker database and a fixture in `supabase/checks/fixtures/`) plus counts after the run; reviewed per `supabase/CLAUDE.md`.

## Acceptance criteria
- [ ] Dry-run per-tier counts and the correctness sample recorded (imperial ±1 holds; schedule ids match the API's tier).
- [ ] Function has `SET search_path = ''`; EXECUTE revoked from PUBLIC, anon, authenticated; the `supabase/checks/` privilege assertion passes.
- [ ] Migration reviewed; owner run logged with date; annotation `#365 fixes: db backfill — FS-PO1H`.
- [ ] Follow-up migration dropping the function merged after the run.

## Verification
Weekly DB check: share of live onboarding bikes with ≥ 1 OEM task (excluding synthetic users).

## Friction spec
FS-PO1H (existing riders). Repro: an onboarding bike created between 2026-08-24 and T07a's deploy → Service segment empty. Expected: after the run, tasks present. Automated check: `supabase/checks/` SQL assertion (run by the owner) — no Maestro (data change).

## Production metric
DB weekly: share of live onboarding bikes with ≥ 1 OEM task; baseline from T02; target ≥ 90% after the run. Annotate the run day.

## Release
Owner-applied migration + owner-run function.

## Dependencies
- Blocked by: T07a, including its reminder cap in `maintenance-push.service.ts` being live on Render.
- Blocks: —

## Out of scope
New model rows beyond the pipeline.

## Constraints
No service-role user writes from scripts; every DB change is a migration; agents never apply migrations.
