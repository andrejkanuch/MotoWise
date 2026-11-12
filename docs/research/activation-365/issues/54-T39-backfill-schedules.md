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
1. Dry-run SELECT (read-only) listing counts of target bikes by make/model capture level (no emails).
2. Migration `supabase/migrations/<n>_backfill_onboarding_service_plans.sql`: a reviewed `SECURITY DEFINER` function that inserts OEM tasks per bike with the same rules as `autoPopulateForBike` (unit conversion, dedup ignoring soft-deleted rows), with a `p_dry_run` flag and a batch limit; RLS untouched; grants only to `service_role` for the owner's run.
3. The **owner** applies the migration and runs it (dry-run first). Agents never apply or run it.
4. Reminder burst check (T06 item 7) before the run. Model rows: data pipeline (memory `project_data_sourcing_pipeline`), MT-07 first.

## How
SQL check in `supabase/checks/` asserting counts after the run; reviewed per `supabase/CLAUDE.md`.

## Acceptance criteria
- [ ] Dry-run counts recorded; migration reviewed; owner run logged with date; annotation `#365 fixes: db backfill — FS-PO1H`.

## Verification
Weekly DB check: share of live onboarding bikes with ≥ 1 OEM task (excluding synthetic users).

## Friction spec
FS-PO1H (existing riders). Repro: an onboarding bike created between 2026-08-24 and T07a's deploy → Service segment empty. Expected: after the run, tasks present. Automated check: `supabase/checks/` SQL assertion (run by the owner) — no Maestro (data change).

## Production metric
DB weekly: share of live onboarding bikes with ≥ 1 OEM task; baseline from T02; target ≥ 90% after the run. Annotate the run day.

## Release
Owner-applied migration + owner-run function.

## Dependencies
- Blocked by: T07a.
- Blocks: —

## Out of scope
New model rows beyond the pipeline.

## Constraints
No service-role user writes from scripts; every DB change is a migration; agents never apply migrations.
