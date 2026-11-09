# Runbook: rider insights data (schema, reference geodata, synthetic flag, stats sweep)

Rider insights reads per-ride stats (`ride_stats`, `ride_tracks`) that the API computes,
and resolves countries, regions and towns against reference tables an owner-run script
loads. This runbook is the order in which those pieces reach production and how to check
each one. Every production step below is the owner's: an agent prepares files and stops
(`docs/runbooks/supabase-migrations.md`).

## Order

| # | Step | Check before going on |
|---|---|---|
| 1 | Apply `supabase/migrations/00197_rider_insights_schema.sql` | Its footer queries, output reported |
| 2 | Run the reference loader | Row counts and the Bratislava check pass |
| 3 | Review and flag synthetic accounts | `RETURNING` lists exactly the confirmed ids |
| 4 | Merge the API PR (the API deploys on merge) | Render deploy live; the ride-completed listener writes `ride_stats` for a new ride |
| 5 | Set the sweep secret in Vault and on Render, then a new Render deploy | Fingerprints match (below) |
| 6 | Apply `supabase/migrations/00198_ride_stats_sweep_cron.sql` | Its footer queries; first tick answers 200 |
| 7 | Watch the backfill | Progress reaches at least 99% |

Steps 2 and 3 can swap; both must be done before step 6, so the backfill neither leaves
rides stale for want of geodata nor counts synthetic accounts in its progress.

## 1. Schema (00197)

Apply as the migration header says (one Management API batch, leading comment block
stripped, version recorded by hand), then run its post-apply footer and keep the output.

## 2. Reference geodata loader

`scripts/load-ref-geodata.ts` downloads three pinned files and refuses any whose SHA-256
differs from the value pinned in the script:

- Natural Earth admin-0 1:10m countries, GeoJSON from the `v5.1.2` tag of
  `nvkelso/natural-earth-vector` (`ISO_A2_EH` is the code; `-99` areas are skipped).
- GeoNames `admin1CodesASCII.txt` and `cities15000.zip`, through Internet Archive
  snapshots, because GeoNames rewrites its dumps under the same names every day.

It then truncates and reloads `ref_country_parts` (`border` and `core` rows),
`ref_regions` and `ref_places` in ONE transaction: a failure leaves the previous data,
and running it again gives the same counts. It prints the counts and checks that central
Bratislava (48.1486, 17.1077) is SK in both border and core parts and that its nearest
town is in Bratislava Region. Any empty table or wrong answer exits non-zero.

```sh
# Direct (session) connection string, postgres role, from the Supabase dashboard.
# Read it into the variable without echoing it; there is no default database.
read -rs REF_GEODATA_DATABASE_URL && export REF_GEODATA_DATABASE_URL
pnpm exec tsx scripts/load-ref-geodata.ts
unset REF_GEODATA_DATABASE_URL
```

Expected on the pinned files (measured on a local PostGIS 3.5, about 15 s): 245 country
features merged into 239 countries, 8,207 border parts, 13,647 core parts (238 countries:
Vatican City is narrower than the 1 km the shrink removes), 3,865 regions and 34,179
places. A second run must print the same numbers.

The 500 m shrink is a geography buffer, which PostGIS computes in a projection chosen from
each landmass's extent. Most landmasses get one accurate to a few metres; the largest
(mainland Russia, the Canadian Arctic) get world Mercator, where the shrink comes out at
500 m x cos(latitude), down to about 250 m on Russia's borders.

To move to newer source data, change the URL and the SHA-256 together in `SOURCES`.

Tests: `pnpm exec tsx --test scripts/__tests__/load-ref-geodata.test.ts`. The database
cases run only with `REF_GEODATA_TEST_DATABASE_URL` set to a throwaway PostGIS
(`postgis/postgis:17-3.5`) prepared with `supabase/checks/fixtures/rider-insights-schema.sql`.

## 3. Synthetic accounts

`scripts/flag-synthetic-accounts.sql` has two parts. Step 1 is a read-only review query:
accounts with completed rides that have `region` set, a start on a whole second and no
waypoints (14 accounts on 2026-11-09), with their email, sign-up date and how many
ordinary rides they have. An account with ordinary rides is a real rider. Step 2 flags
only the ids pasted into its `ARRAY[...]`; as committed the list is empty and it updates
nothing. Its `RETURNING` lists what it flagged.

## 4. API deploy

Merging deploys the API. From then on each completed ride gets its `ride_stats` row from
the completion listener; older rides wait for the sweep (step 6).

## 5. Sweep secret

The endpoint `POST /webhooks/ride-stats-sweep` compares the `x-ride-stats-secret`
header with `RIDE_STATS_SWEEP_SECRET` and fails closed when it is unset. The cron reads
the same value from the Vault secret `ride_stats_sweep_secret`. Never print the value;
compare fingerprints.

1. Generate it into a shell variable, not onto the screen:
   `SWEEP_SECRET="$(openssl rand -hex 32)"`
2. Vault, through the Management API query endpoint (the value is in the request body
   only): `SELECT vault.create_secret('<value>', 'ride_stats_sweep_secret');`
   To replace an existing one: `SELECT vault.update_secret(id, '<value>') FROM vault.secrets WHERE name = 'ride_stats_sweep_secret';`
3. Render: set `RIDE_STATS_SWEEP_SECRET` on the API service, then trigger a NEW deploy.
   A restart does not pick up env changes.
4. Fingerprints, all three must match:
   - local: `printf %s "$SWEEP_SECRET" | shasum -a 256 | cut -c1-12`
   - Vault: `SELECT left(encode(sha256(convert_to(decrypted_secret, 'UTF8')), 'hex'), 12) FROM vault.decrypted_secrets WHERE name = 'ride_stats_sweep_secret';`
   - Render: copy the value from the dashboard into a variable the same way and hash it
     as for local.
5. `unset SWEEP_SECRET`.

## 6. Cron (00198)

Apply after the deploy in step 4 serves the endpoint and step 5 is done. It schedules
`ride-stats-sweep` at minutes 5, 15, 25, ... Each tick computes up to 10 stale rides, real
riders before synthetic accounts. Run the migration's footer; the first tick should log
`succeeded` in `cron.job_run_details` and a 200 in `net._http_response` (401: the secrets
differ; 404: the API with the endpoint is not deployed; a WARNING about the missing Vault
secret in the Postgres log: step 5 skipped).

## 7. Backfill progress

At 10 rides per tick the sweep does about 1,440 rides a day. Progress counts rows at the
current stats version (`RIDE_STATS_VERSION` in
`apps/api/src/modules/ride-stats/compute/compute-ride-stats.ts`, `1` today: change the
literal below when it changes) whose track has not changed since, over live completed
rides of non-synthetic accounts:

```sql
SELECT
  count(*) AS eligible_rides,
  count(*) FILTER (
    WHERE s.stats_version = 1
      AND (r.track_updated_at IS NULL OR r.track_updated_at <= s.computed_at)
  ) AS current_rows,
  round(100.0 * count(*) FILTER (
    WHERE s.stats_version = 1
      AND (r.track_updated_at IS NULL OR r.track_updated_at <= s.computed_at)
  ) / NULLIF(count(*), 0), 2) AS pct_done
FROM public.rides r
JOIN public.users u ON u.id = r.user_id
LEFT JOIN public.ride_stats s ON s.ride_id = r.id
WHERE r.status = 'completed'
  AND r.deleted_at IS NULL
  AND NOT u.is_synthetic;
```

Done when `pct_done` is at least 99. Rides left over are usually ones whose compute
throws (next section).

## Sweep failures in Sentry

The API reports from `apps/api/src/modules/ride-stats/ride-stats.service.ts`, all tagged
`area:ride-stats`:

- A ride whose compute throws: an exception tagged `op:sweep` with `extra.rideId`. The
  ride is skipped by that API process until it restarts, so it cannot hold a batch slot.
- `ride stats: reference geodata (ref_country_parts) is empty; N rides left stale this run`
  (warning): the loader has not run, or ran against another database. Rides stay stale
  and are computed once the data is there.
- `ride stats: N rides stale for over an hour` (warning, `extra.skipList`): expected
  every tick while the backfill runs; after it, a lasting non-zero count means rides
  that keep failing or a sweep that is not running.

A rejected or missing cron call never reaches Sentry: check `cron.job_run_details` and
`net._http_response` (step 6).
