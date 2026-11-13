# Weekly DB check (#365, D2b option C)

PostHog has no Supabase source, so the database-only metrics are read every **Monday** with these files, read-only, against
production. Each file starts with `BEGIN READ ONLY;` and ends with `COMMIT;`, so a mistaken write fails instead of changing data.
Only aggregates are recorded: never print or commit emails, names or user ids.

| File | Metric | Plan | Target |
|---|---|---|---|
| `s4a-day0-schedule.sql` | S4(a): first bike on sign-up day with a task within 1 day, columns *any source* and *`oem`* | §1.2 S4, FS-PO1H | `oem` column ≥ 55% for 4 weeks |
| `s4b-r2m1.sql` | S4(b) / R2-M1: onboarding bike with an OEM task within 5 min | FS-PO1H | ≥ 95% for 2 weeks after T07a |
| `fs-r2-4-imperial.sql` | Imperial riders' onboarding OEM tasks in miles (denominator `users.measurement_system`) | FS-R2-4 | 100% |
| `fs-po4b-first-ride.sql` | First ride live and sub-floor (null distance counts as sub-floor) | FS-PO4b | < 5% after T09 |
| `fs-ob1e-two-bikes.sql` | Accounts with two bikes created ≤ 2 min apart | FS-OB1e | 0 |
| `fs-r2-5-short-make.sql` | Onboarding bikes with a make under 3 letters | FS-R2-5 | 0 new after T25b |

## Monday recipe

1. Pick any one route (both are read-only by construction):
   - **Supabase MCP** `execute_sql` on project `tpsoneenbrmdwvzcbifw`, pasting the whole file (the transaction lines included).
   - **Management API**: `POST https://api.supabase.com/v1/projects/tpsoneenbrmdwvzcbifw/database/query` with a personal access
     token from the owner's environment (never committed), body `{"query": "<file contents>"}`:
     ```bash
     for f in docs/research/activation-365/queries/db/*.sql; do
       jq -n --rawfile q "$f" '{query: $q}' |
         curl -sS -X POST "https://api.supabase.com/v1/projects/tpsoneenbrmdwvzcbifw/database/query" \
           -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" -d @- ; echo
     done
     ```
2. Append one dated row per file to `experiments.md` → "Weekly DB check" (last **complete** Monday-to-Sunday week for the weekly
   files; the rolling 60-day value for the others).
3. If a threshold is crossed (a target met for the stated number of weeks, or a regression after a release), add a PostHog
   annotation from the D2 named list (T03a procedure). No other PostHog write.

## Exclusion (every file)

```sql
coalesce(u.is_synthetic, false) = false
and u.email not ilike 'e2e-%'                  -- run-onboarding-e2e.sh accounts
and u.email not ilike 'delivered+mv-e2e-%'     -- run-onboarding-email-code-e2e.sh accounts (Resend test inbox)
and u.email not ilike '%@motovault.app'
and u.email not ilike '%@cloudtestlabaccounts.com'
and u.email not ilike '%@priorises.com'
and u.email not ilike '%@test.com'
and not (u.deleted_at is not null and u.deleted_at::date = '2026-11-10')   -- junk sign-ups soft-deleted that day
```

Always qualify `u.deleted_at` / `u.email`: inside a join with `motorcycles` the bare names are ambiguous (V1 §3.8). The E2E
runners set `is_synthetic = true` on every account they create, so a kept test account drops out through the first line even
when its email has another shape. An account their teardown deletes has no row left, so DB counts never see it; PostHog
needs the runners' user-id ledger for those (`../q00-excluded-persons.md`, `{E2E_PERSONS}`).
