# Excluded PostHog persons (test + synthetic), used by every #365 query

The person ids themselves are kept outside the repo (session scratchpad of the agent that ran the query; the
owner can re-derive them with the recipe below). Committed SQL uses the placeholders `{EXCL}` and `{RN}`.

## `{EXCL}` (plan §0), re-derived 2026-11-13 (T02)

```sql
person_id NOT IN (<{EXCL} ids: 14 persons, list kept outside the repo>)
AND coalesce(toString(properties.e2e_run), '') != 'true'      -- E2E builds (super property from T01; absent before 3.29.0)
AND person_id NOT IN ({E2E_PERSONS})                          -- historical e2e persons (empty on 2026-11-13, see below)
```

The 14 ids are:

| Group | Persons | How found |
|---|---|---|
| Project test-account filter | 4 | `project-get` → `test_account_filters`: 4 hard-coded person ids; the same 4 are the only persons with `person.properties.internal = true` |
| Synthetic / test Supabase users | 11 (2 of them already in the filter) | `public.users` where `is_synthetic` OR email domain `@motovault.app` / `@cloudtestlabaccounts.com` / `@priorises.com` / `@test.com` OR soft-deleted on 2026-11-10 (the junk sign-ups) OR `e2e-%` / `delivered+mv-e2e-%` = **26 user ids** (19 `is_synthetic`), mapped through PostHog `person_distinct_ids` → 11 persons |
| Union = plan's "13 persons" | **13** | matches V1 §0 / V2-s1 |
| Internal tester on builds 92–99 (V3 item 7) | +0 | already in the 13: it is one of the 11 persons mapped from the synthetic/test Supabase users, but it was **not** in the project's test-account filter, which is why V3 saw it on Android 3.28.0. Flagging it `internal` in PostHog is a write for the D2 list (not done) |
| V4 emulator run (`sdk_gphone64_arm64`, 3.28.0, 2026-11-12 14:18–14:30 UTC, anonymous) | **+1** | `$device_model` is **null** on those events, so the model filter in V4 finds nothing. The run is the one anonymous person on build **99** (`$app_build = '99'`, android) with events 14:21–14:26 UTC; vc99 was installed only by the internal tester and by V4 (universal APK of the vc99 AAB). Another anonymous person at 14:18 is on build 98 (the Play production binary) and is **not** excluded |
| **Total** | **14** | |

Re-derive: run the Supabase SELECT below read-only, map the ids in PostHog, add the 4 filter ids and the V4 person.

```sql
BEGIN READ ONLY;
select id from public.users u
where u.is_synthetic
   or u.email ilike 'e2e-%' or u.email ilike 'delivered+mv-e2e-%'
   or u.email ilike '%@motovault.app' or u.email ilike '%@cloudtestlabaccounts.com'
   or u.email ilike '%@priorises.com' or u.email ilike '%@test.com'
   or u.deleted_at::date = '2026-11-10';
COMMIT;
```

```sql
-- PostHog execute-sql
SELECT DISTINCT person_id FROM person_distinct_ids WHERE distinct_id IN (<the user ids>)
```

## `{E2E_PERSONS}` (Q-P10 shape), run 2026-11-13

```sql
SELECT uniqIf(person_id, toString(person.properties.email) LIKE 'e2e-%')               AS e2e_prefix_persons,
       uniqIf(person_id, toString(person.properties.email) LIKE 'delivered+mv-e2e-%')  AS resend_e2e_persons,
       uniqIf(person_id, toString(properties.e2e_run) = 'true')                          AS e2e_run_persons
FROM events WHERE timestamp >= now() - INTERVAL 90 DAY AND properties.$lib = 'posthog-react-native'
```

Result: **0 / 0 / 0** (`e2e_run` does not exist yet). `{E2E_PERSONS}` is empty; re-run it at every 2/4/8-week read. From now on
the runners mark every account they create `users.is_synthetic = true` (`apps/mobile/scripts/e2e-mark-synthetic.sh`), so a test
account that reaches PostHog is caught by the synthetic-user mapping above, and E2E builds carry `e2e_run` after T01.

## DB exclusion (weekly DB check)

`queries/db/README.md` → "Exclusion": `is_synthetic`, `e2e-%`, `delivered+mv-e2e-%`, the four test domains and the 2026-11-10
soft-deleted junk sign-ups, always qualified as `u.` inside joins.

## Not excluded (cannot be identified)

Play pre-launch robots that never signed in, and the TikTok ad-review crawler (web only; web queries filter `$raw_user_agent`
ILIKE '%aweme%').
