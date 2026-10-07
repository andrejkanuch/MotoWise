# Local stack for the bike-detail redesign (R1)

A local Supabase database that has migrations 00001–00182 applied. It exists because the
tables of this phase are not in production yet. **It is not production**: it is built from a
scratch copy of `supabase/` with three old migrations patched (see `data-verification.md`).
Nothing here touches `apps/api/.env` or `apps/mobile/.env` — both still point at production
and must stay that way; every local value is passed on the command line.

## State on 2026-10-05: NOT running, must be rebuilt

Before a machine restart on 2026-10-05 the stack was already gone: no `mvscratch` containers, no data volume and no `public.ecr.aws/supabase/*` images left in Docker (Docker was cleaned between Oct 2 and Oct 5). The patched workdir was copied out of `/private/tmp` to `~/.motovault-local/mvscratch` (config, patched migrations 00001–00182, roles.sql, seeds, `.temp/*-version`). To bring it back: `npx supabase start --workdir ~/.motovault-local/mvscratch --exclude studio,logflare,vector,edge-runtime,imgproxy,realtime,supavisor` (this pulls the images again, a few GB; disk had 108 GB free), then re-create the QA users through the Auth admin API (`email_confirm: true`, password `localTest123`), set `preferences.onboardingCompleted = true` for them, and run the seed script with the NEW user ids. The ids in the table below go stale.

## What was running (2026-10-02)

| Thing | Value |
|---|---|
| Supabase API (Kong) | `http://127.0.0.1:54321` |
| Postgres | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Mail (Mailpit) | `http://127.0.0.1:54324` |
| Docker project | `mvscratch` — containers `supabase_{db,kong,auth,rest,storage,pg_meta,inbucket}_mvscratch` |
| Workdir | `~/.motovault-local/mvscratch` |
| Not running | Studio, Realtime, Edge Functions, analytics, imgproxy (disabled to avoid image pulls) |

The keys are the public Supabase CLI demo keys (issuer `supabase-demo`), identical on every
local install — not secrets:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
SUPABASE_JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long
```

## Test users (local only, password `localTest123`, email sign-in)

| Email | Id | Profile | Garage |
|---|---|---|---|
| `qa-metric@local.test` | `74008181-4a9e-4532-ae33-06342d489b3f` | metric, EUR | bike A "Africa Twin" (km, full fixtures, primary) + bike B "Ténéré 700" (empty) |
| `qa-imperial@local.test` | `fdeb6c1d-a621-4d40-b65d-42066140be2c` | imperial, EUR | bike C "Africa Twin" in miles (copy of A) |
| `rider-a@local.test` | `c3dba548-4d5a-414e-9403-7e19ac2fa949` | metric | probe leftovers — do not use for Visual QA |
| `rider-b@local.test` | `f54faf79-47be-4414-8163-893825e5ca45` | imperial | probe leftovers |

Google and Apple sign-in do not work against the local stack.

## Start the API against it

`node_modules/.bin` entries are not executable on this machine (`nest`, `ts-node` fail with
EACCES), so `pnpm dev` does not start the API. Run it through node:

```bash
cd apps/api
PORT=4000 NODE_ENV=development \
SUPABASE_URL=http://127.0.0.1:54321 \
SUPABASE_ANON_KEY=<anon key above> \
SUPABASE_SERVICE_ROLE_KEY=<service role key above> \
SUPABASE_JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long \
UPSTASH_REDIS_REST_URL= UPSTASH_REDIS_REST_TOKEN= POSTHOG_PROJECT_TOKEN= RESEND_API_KEY= \
SENTRY_DSN=http://local@127.0.0.1:9/1 \
node ../../node_modules/ts-node/dist/bin.js --transpile-only src/main.ts
```

- Command-line variables win over `apps/api/.env`, so the production Supabase values in that
  file are never used. The blanked variables keep the local API away from production Redis,
  PostHog and Resend. `SENTRY_DSN` cannot be blank (env validation requires a URL); the dummy
  one sends nowhere. `OPENAI_API_KEY` etc. still come from `.env`.
- Run `pnpm --filter @motovault/types build` first if `packages/types` changed (the API reads
  its `dist`).
- GraphQL endpoint: `http://127.0.0.1:4000/graphql`.

## Start Expo against it

```bash
cd apps/mobile
EXPO_PUBLIC_API_URL=http://127.0.0.1:4000/graphql \
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key above> \
pnpm exec expo start --dev-client --clear
```

iOS simulator: `127.0.0.1` as above. Android emulator: `10.0.2.2` for both URLs. Physical
device: the Mac's LAN address (currently `192.168.1.14`). `--clear` matters: Metro caches the
inlined `EXPO_PUBLIC_*` values.

## Seed / re-seed the fixtures

```bash
SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=<service role key above> \
pnpm exec tsx scripts/seed-bike-hub-fixtures.ts \
  --user 74008181-4a9e-4532-ae33-06342d489b3f --imperial-user fdeb6c1d-a621-4d40-b65d-42066140be2c
```

Idempotent (run twice = same rows). Refuses any non-local `SUPABASE_URL`. What it cannot seed:
recalls (fetched from NHTSA on demand — the fixture's "1 open recall" depends on the live NHTSA
answer for a 2022 Honda Africa Twin), document files (documents have no file rows, so opening
one shows no attachment) and photos.

## Stop, restart, rebuild

```bash
W=$HOME/.motovault-local/mvscratch
npx supabase stop  --workdir $W               # keeps the data volume
npx supabase start --workdir $W --exclude studio,logflare,vector,edge-runtime,imgproxy,realtime,supavisor
npx supabase stop  --workdir $W --no-backup   # wipes the database
```

- Always pass `--workdir`. The repo's own `supabase/` cannot replay (00097, 00098, 00102 fail on
  an empty database), so `npx supabase start` / `db reset` from the repo root fails.
- Check `df -h /System/Volumes/Data` first; the disk on this machine is tight. The start must
  not pull anything: the workdir pins the image versions already in Docker
  (`supabase/.temp/*-version`) and its `config.toml` disables realtime / analytics /
  edge_runtime. If the CLI prints "Pulling from", stop it.
- After a wipe: re-create the users (Auth admin API, `email_confirm: true`) and re-seed. User ids
  change, so the ids in this file go stale.
- The workdir now lives at `~/.motovault-local/mvscratch` (outside the repo, survives reboots). It was first in a session scratchpad under `/private/tmp`, which does not survive one.
  To rebuild it: copy `supabase/{config.toml,roles.sql,seed.sql,seed-articles.sql,migrations}`,
  copy only the `*-version` and `storage-migration` files from `supabase/.temp` (not
  `project-ref`, `pooler-url`, `linked-project.json` — those link a directory to production),
  then apply the config and migration patches listed in `data-verification.md`.

## Never

`supabase db push`, anything with `--linked` or a remote `--db-url`, `pnpm generate`,
`pnpm generate:types`. They act on, or read from, production.
