---
title: Onboarding make-only bike is silently dropped - Plan
type: fix
date: 2026-10-15
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
deepened: 2026-10-15
---

# Onboarding make-only bike is silently dropped - Plan

## Goal Capsule

- **Objective:** A rider who names their bike in onboarding without picking a model lands in a garage that already holds that bike, on every app version in the field, and the riders who already lost their bike get it back.
- **Means:** make the `complete_onboarding` RPC create the bike from make + year alone, storing an empty model (KTD1), then backfill the affected riders from their recorded onboarding answers (KTD3).
- **Authority:** this plan → `CLAUDE.md` (migration + Supabase client rules) → repo conventions.
- **Execution profile:** one migration, one SQL check, one one-off data backfill. No API change, no mobile release.
- **Stop conditions:** stop and report if prod's `complete_onboarding` body differs from the repo's latest definition in anything other than the bike branch, or if the backfill insert would touch a rider who has any `motorcycles` row at the moment of insert.
- **Finishes and ships:** the `lfg` run: PR to `main`, review, merge, apply the migration to prod, run the backfill.

---

## Product Contract

### Summary

Onboarding has offered a make-only path since #81 (2026-06-12): quick-make chips and "continue without a model". The app sends no `bikeModel` in that case, and the database function only inserts a motorcycle when make, model and year are all present. The bike is discarded without an error, so the rider finishes onboarding — and the "garage ready" paywall — with an empty garage.

### Problem Frame

Found while profiling the 2026-10-14 Android trial user: they entered a 2023 Venom without a model, started a trial on the `onboarding_garage_ready` paywall, then opened Add bike on an empty garage and left. PostHog shows 39 people with make-only onboarding bikes in the last 30 days against 29 with a model (consented users only). The empty-garage moment lands immediately after the paywall, so this costs both activation and trial-to-paid conversion.

### Requirements

**Onboarding save**
- R1. Completing onboarding with a make and a year but no model creates exactly one motorcycle for the rider, with the make, year, type, mileage, unit and nickname they gave and an empty model.
- R2. Completing onboarding with make, model and year behaves exactly as today, including not creating a duplicate when the same bike already exists.
- R3. Completing onboarding without a make (true skip) still creates no motorcycle.
- R4. The fix works for every installed app version, with no store build or OTA.

**Recovery**
- R5. Riders who completed onboarding with a make-only bike, still have no motorcycle (live or soft-deleted), and still have a live account get that bike created once.

**Safety**
- R6. The function keeps its `auth.uid()` ownership check, `SECURITY DEFINER` behaviour and existing grants.

### Scope Boundaries

- Not changing the onboarding UI or making model required — make-only capture is a deliberate activation choice from #81.
- Not changing the OEM import in `users.service.ts`: on the onboarding path it looks schedules up by accepted id and never reads the model, and `findByMotorcycle` already treats an empty model as make-level.
- Not making `motorcycles.model` nullable — it is `NOT NULL` and `String!` across GraphQL, web and mobile; an empty string fits every consumer today.

### Deferred to Follow-Up Work

- A garage prompt that invites riders with an empty model to add it. It matters more because mobile Edit bike will not save until a model is chosen (KTD2).
- Quick-make chip bikes store the screen's default year (`currentYear - 3`), not one the rider typed. This plan keeps that value; asking for the year belongs with the prompt above.
- Hardening `complete_onboarding`'s `search_path` to `''` and trimming its PUBLIC/anon EXECUTE grants; safe today because of the `auth.uid()` check, but worth doing in its own change.

---

## Planning Contract

### Key Technical Decisions

- KTD1. **Fix in the RPC, not the client.** The database decides whether the bike is created, so changing only the condition fixes every app version already installed (R4). A client change would need a store build and still leave 3.26.0 broken. The insert uses `COALESCE(NULLIF(btrim(p_bike_model), ''), '')` as the model, and the existence check matches on that same normalised value so a repeat call stays idempotent (R2).
- KTD2. **Empty string, not a placeholder.** A literal like "Unknown" would render as a model name everywhere and pollute OEM schedule matching. `''` is already what the client sends internally, satisfies `NOT NULL`, and renders as just "2023 Venom". The API update validator treats model as optional, but mobile Edit bike requires a model before Save enables, so these riders must pick a model to edit the bike. That is accepted here and tracked under Deferred to Follow-Up Work.
- KTD3. **Backfill from two recorded sources, as a one-off.** The dropped bike survives in two places: the PostHog `onboarding_completed` event (`has_bike`, `bike_make`, `bike_year`, empty `bike_model`; consented riders only) and the RevenueCat customer attributes `primary_bike_make` / `primary_bike_year` with no `primary_bike_model`, which the app writes before the onboarding paywall regardless of analytics consent. The candidate set is the union of both, de-duplicated by user id. Neither source holds the rider's type, mileage or nickname, so recovered bikes take the RPC defaults. The backfill is a reviewed one-off SQL run through the Management API, not a migration, because its input is a dated list of user ids. Only riders who neither consented nor reached the paywall are unrecoverable (stated in the PR).

### Assumptions

- `/lfg` authorises the full run, including applying the migration to prod and running the backfill (the user asked to fix and merge).
- Prod's function body matches `supabase/migrations/00163_add_kes_currency.sql` outside the bike branch; U1 verifies this before writing the migration.

---

## Implementation Units

### U1. Migration: create make-only bikes in `complete_onboarding`

- **Goal:** R1, R2, R3, R4, R6.
- **Files:** `supabase/migrations/00191_complete_onboarding_make_only_bike.sql`.
- **Approach:** diff prod's `pg_get_functiondef` against 00163's definition first. `CREATE OR REPLACE` the function with an identical signature, changing only the bike branch per KTD1. `CREATE OR REPLACE` keeps the ACL, so no grant statements are needed (R6). Header comment explains the bug and links this plan.
- **Patterns:** `supabase/migrations/00163_add_kes_currency.sql` (latest full definition).
- **Test scenarios:** covered by U2.
- **Verification:** U2 passes against a disposable container with this migration applied.

### U2. SQL check for the onboarding bike branch

- **Goal:** prove R1–R3 and R6 on a real Postgres.
- **Files:** `supabase/checks/complete_onboarding_bike.sql`, `supabase/checks/fixtures/complete_onboarding_bike.sql`.
- **Approach:** follow `recall_acknowledgements_rls.sql`. The check file holds only assertions: one transaction ending in `ROLLBACK`, no psql meta-commands, raise on failure, so the same file runs unchanged on prod after 00191. The fixture, which `run.sh` loads only in the disposable container, stubs what the container lacks (an `auth` schema with `users` and a `uid()` that reads `request.jwt.claims`, `motorcycle_type`, `users`, and `motorcycles` with the real `NOT NULL` and check constraints) and then applies the U1 migration.
- **Test scenarios:**
  - make + year, model `NULL` → exactly one motorcycle, model `''`, make and year as given.
  - make + year, model `'   '` → treated as empty, one motorcycle.
  - same make-only call repeated → still one motorcycle.
  - make + model + year → one motorcycle with that model; repeated call → still one.
  - no make → no motorcycle; preferences and `onboarding_completed_at` still set.
  - `auth.uid()` set to a different user → raises `Unauthorized`.
- **Verification:** `supabase/checks/run.sh complete_onboarding_bike.sql` exits 0.

### U4. Backfill riders who lost their bike

- **Goal:** R5.
- **Files:** none committed beyond a note in the PR description; the query and its result counts go in the PR.
- **Approach:** after U1 is live, build the candidate set per KTD3. From PostHog, take every person's latest `onboarding_completed` with `has_bike = true`, empty `bike_model` and a non-empty `bike_make`, keyed by identified `distinct_id` (the Supabase user id). From RevenueCat, read the attributes of onboarded users who have no bike. The onboarding year field always holds a value, so every make-only bike has a year. In Supabase, keep only ids whose `users` row is live and who have no `motorcycles` row at all (live or deleted). Exclude the owner's test accounts. Dry-run as a `SELECT` and report the count per source. Then insert in one transaction with `model = ''`, `type = 'other'`, `current_mileage = 0`, `is_primary = true` and a unit from the user's measurement system. The `INSERT` itself carries `WHERE NOT EXISTS` on `motorcycles` for that user, so a rider who added a bike after the dry run is never duplicated.
- **Research notes:**
  - Pool: 101 live users have completed onboarding since 2026-06-12 with no `motorcycles` row. That pool also holds riders who skipped the bike step on purpose; those have no make in either source and drop out.
  - RevenueCat: `setOnboardingAttributes` has written `primary_bike_*` since #72 (2026-06-01), for every rider who reached the onboarding paywall. Read the attributes with the RevenueCat MCP `get-customer` (`expand: attributes`), only for pool members PostHog does not already cover. Do not use the v1 `GET /subscribers/{id}`: it creates a customer when none exists.
  - Constraints: `idx_motorcycles_one_primary_per_user` cannot conflict because every candidate has zero bikes. `trg_motorcycles_default_distance_unit` derives `distance_unit`, so the insert sets only `mileage_unit` (`mi` for imperial, otherwise `km`), as the RPC does.
- **Test expectation:** none — one-off data fix; the dry run's count and a post-insert recount are its proof.
- **Verification:** post-insert, every candidate has exactly one motorcycle; the 2026-10-14 trial user (`4c846fdc…`) has their 2023 Venom.

---

## Verification Contract

| Gate | Command | Proves |
|---|---|---|
| SQL check | `supabase/checks/run.sh complete_onboarding_bike.sql` | U1, U2 |
| Repo gate | `pnpm precheck` (lint + typecheck + test) | nothing else broke |
| Prod check | U2's check sent to prod through the Management API after the migration (rolls back) | U1 is live and correct in prod |
| Backfill | dry-run count, then recount after insert | U4 |

## Definition of Done

- Migration 00191 merged to `main`, applied to prod, and recorded in `supabase_migrations.schema_migrations`.
- U2's check passes locally and on prod.
- `pnpm precheck` green; PR reviewed with `ce-code-review` before merge.
- Backfill run, with candidate and inserted counts in the PR.
- No leftover experimental code or files in the diff.
