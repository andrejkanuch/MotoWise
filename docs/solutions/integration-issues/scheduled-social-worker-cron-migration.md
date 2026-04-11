---
title: Scheduled social posting silently fails — migrate from Claude sandbox to Cloudflare cron triggers
category: integration-issues
date: 2026-04-11
tags:
  - cloudflare-workers
  - cron-triggers
  - claude-scheduled-tasks
  - supabase
  - rls
  - postgrest
  - gemini
  - instagram
  - aspect-ratio
  - meta-graph-api
problem_type: integration_issue
component: social-worker
severity: high
status: resolved
commits:
  - dd7c5db  # feat(social-worker): move scheduled posting to Cloudflare cron triggers (squashed into #45)
  - 1dd9ef9  # feat(social-worker): /run-slot manual trigger + force-exact story aspect ratio
migration: supabase/migrations/00088_social_post_queue.sql
worker: motovault-social-api
---

# Scheduled social worker — sandbox egress migration + aspect ratio fix

## Problem

The three daily social-media scheduled tasks (`motovault-social-afternoon`,
`-evening`, `-night-americas`) on claude.ai stopped publishing posts on
2026-04-10. `marketing/motovault-social/data/performance-log.json` showed
**zero entries for Apr 10 and Apr 11**. No error was surfaced anywhere — the
tasks "ran" successfully from Claude's perspective.

When reproducing the skill by hand inside a Claude Code session, every call
the agent made to the Cloudflare Worker failed with:

```
403 host_not_allowed
```

A secondary issue was caught during the first live end-to-end smoke test
after the migration: the published Instagram story was `1536×2752` rather
than the exact `1080×1920` that Instagram expects. Ratio `0.558` vs
`0.5625` — only 0.8% off, so Meta accepted it, but IG letterboxed it on
device.

## Root cause

### Why the scheduled tasks failed

Claude's scheduled-task infrastructure runs each session inside a sandbox
with an **egress allowlist proxy**. The allowlist covers GitHub, npm,
PyPI, etc. — not arbitrary third-party APIs. Our Worker host
`motovault-social-api.kanuchandrej.workers.dev` is not on the allowlist,
so every outbound `POST /generate-image` and `POST /publish-post` was
blocked with `403 host_not_allowed` **before the request ever left the
sandbox**. Interactive Claude Code sessions on the user's laptop are
unrestricted, which is why manual debugging worked but the scheduled
runs did not.

This is not fixable from `settings.local.json` — that controls tool
permissions, not network egress. The only real fix is to move the
scheduling off Claude's infrastructure entirely.

### Why the story aspect ratio was wrong

`gemini-3.1-flash-image-preview` accepts `imageConfig.aspectRatio: '9:16'`
in its generation request, but at `imageSize: '2K'` it returns roughly
`1536×2752` — near 9:16 but not pixel-exact. Meta Graph API does not reject
off-ratio uploads, so the bad image propagated all the way to Instagram
Stories, where the renderer letterboxed it.

## Solution

### 1. Move scheduling into the Worker itself

Scheduling now runs via Cloudflare Cron Triggers against the existing
`motovault-social-api` Worker. No sandbox involvement, ever.

**`infra/social-worker/wrangler.toml`**
```toml
[triggers]
crons = [
  "0 14 * * *",  # afternoon slot (Europe afternoon / Americas morning)
  "0 19 * * *",  # evening slot (Europe evening)
  "0 0  * * *",  # night-americas slot
]
```

**`infra/social-worker/src/index.ts` — add `scheduled()` alongside `fetch()`:**
```typescript
async scheduled(
  controller: ScheduledController,
  env: Env,
  ctx: ExecutionContext,
): Promise<void> {
  // ctx.waitUntil is CRITICAL. Image gen + Meta Graph calls take 30–60s;
  // without it the Worker is terminated as soon as scheduled() returns.
  ctx.waitUntil(runScheduledPost(env, controller.cron));
},
```

The body of `runScheduledPost` (`src/scheduled.ts`) claims the next queued
row, generates a 4:5 + 9:16 image pair in parallel via Gemini, publishes
post + story to FB and IG, and marks the row published.

### 2. Content queue in Postgres — `social_post_queue`

The Worker can't generate fresh content creatively on its own, and we
don't want to lose Claude's caption-writing. Solution: **Claude writes
captions from your laptop into a Supabase table, the Worker consumes
them on cron.**

**`supabase/migrations/00088_social_post_queue.sql` (key parts):**
```sql
CREATE TABLE public.social_post_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot            TEXT NOT NULL,      -- afternoon | evening | night-americas
  scheduled_for   DATE NOT NULL,
  angle           TEXT NOT NULL,
  caption         TEXT NOT NULL,
  post_prompt     TEXT NOT NULL,
  story_prompt    TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'ready',
  attempts        INTEGER NOT NULL DEFAULT 0,
  post_results    JSONB,
  story_results   JSONB,
  error           TEXT,
  -- ...
);

ALTER TABLE public.social_post_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.social_post_queue FROM anon, authenticated;
GRANT ALL ON public.social_post_queue TO service_role;

CREATE OR REPLACE FUNCTION public.claim_next_social_post(p_slot TEXT)
RETURNS public.social_post_queue
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_id UUID; v_row public.social_post_queue;
BEGIN
  SELECT id INTO v_id
  FROM public.social_post_queue
  WHERE slot = p_slot
    AND status = 'ready'
    AND scheduled_for <= (now() AT TIME ZONE 'utc')::date
  ORDER BY scheduled_for ASC, created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_id IS NULL THEN RETURN NULL; END IF;

  UPDATE public.social_post_queue
  SET status = 'publishing', attempts = attempts + 1, last_attempt_at = now()
  WHERE id = v_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;
```

`FOR UPDATE SKIP LOCKED` + `SECURITY DEFINER` gives atomic pop semantics
even if multiple crons ever overlap.

### 3. Force exact aspect ratios via Supabase Storage render transforms

Rather than pulling a WASM image library into the Worker, the generated
image is uploaded to Supabase Storage and the URL passed to Meta goes
through `/storage/v1/render/image/` with explicit target dimensions and
`resize=cover`:

```typescript
// infra/social-worker/src/publish.ts
function renderUrl(env: Env, path: string, width: number, height: number): string {
  return (
    `${env.SUPABASE_URL}/storage/v1/render/image/public/social-media/${path}` +
    `?width=${width}&height=${height}&resize=cover`
  );
}

// Feed posts → exact 4:5
const imageUrl = renderUrl(env, path, 1080, 1350);

// Stories → exact 9:16
const imageUrl = renderUrl(env, path, 1080, 1920);
```

Meta fetches the render URL, Supabase crops Gemini's near-exact output
to pixel-perfect target dimensions on the fly, and Instagram renders the
image edge-to-edge with no letterboxing.

**Important caveat:** Supabase Storage transforms **downscale but never
upscale**. A source image narrower than 1080 px will pass through
unchanged. This is fine for cron-generated posts (Gemini 2K is ~1536+
wide) but meant that an orphan story recovered from a sub-1080 Apr 10
attempt came out at 1072×1920 instead of 1080×1920. Acceptable for one
recovery post, but anything routed through the cron path is guaranteed
exact.

### 4. Local CLI to seed the queue — `scripts/fill-queue.ts`

Run from your laptop (unrestricted network). Reads a `posts.json` array,
validates slot + date format, idempotent upsert (only touches `ready`
rows, never overwrites audit history for `published`/`failed`):

```bash
export SUPABASE_URL="https://<project-ref>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
npx tsx scripts/fill-queue.ts posts.json
```

### 5. Manual trigger endpoint — `POST /run-slot?slot=<name>`

Added so failed rows can be retried and e2e tests can fire without
waiting for the next cron tick. Invokes the **exact same**
`runScheduledPost()` function the cron calls, by reverse-looking-up the
cron string from the slot name via the exported `CRON_TO_SLOT` map.

## Gotchas discovered during e2e verification

Keep these close — each was a ~15 minute surprise during the live deploy.

### PostgREST serializes NULL composite returns as all-null objects

`claim_next_social_post(p_slot)` returns a `public.social_post_queue`
row type. When the function returns `NULL`, PostgREST does **not** send
JSON `null` — it sends `{id: null, slot: null, ...}`. Initial
`claimNextPost` logic used `!('id' in data)` to detect empty, which
falsely returned a phantom row.

**Fix** (`src/queue.ts`):
```typescript
const data = (await res.json()) as (QueueRow & { id: string | null }) | null;
if (data === null || data.id === null) {
  return null;
}
```

### `ctx.waitUntil` is not optional for long-running scheduled handlers

Without `ctx.waitUntil(runScheduledPost(...))`, the Worker terminates as
soon as `scheduled()` returns — which is immediately, because the entire
publish flow is async. Gemini image generation alone takes 20–40 s; a
Meta `/media_publish` cycle adds another 10–30 s. The Cloudflare docs
are explicit about this, but easy to miss.

### Supabase migration ledger drift blocks `db push`

`supabase db push` failed with `Remote migration versions not found in
local migrations directory` because migration `00074` existed in the
remote `supabase_migrations.schema_migrations` table but had been renamed
or dropped locally on an earlier branch before merging. Recovery:

```bash
npx supabase migration repair --status reverted 00074
npx supabase db push
```

`migration repair` only mutates the ledger metadata — it does not undo
any schema changes. Safe if the drifted migration was additive and still
live on the database.

### Biome pre-push hook scans untracked files

Pushing to `main` failed because Biome linted
`apps/web/.vercel/project.json` (an untracked Vercel CLI artifact) and
found formatter violations. Workaround for the single push was to
temporarily `mv apps/web/.vercel /tmp/...`. Long-term fix: add
`"!**/.vercel"` to `biome.json → files.includes`.

### Instagram's container/media_publish flow leaks artifacts on failure

`/publish-story` uploads the image to Supabase → calls `/media` to
create a container → waits for processing → calls `/media_publish`. If
any step after the upload fails, the image stays in Supabase Storage as
an **orphan**, and no entry appears in `performance-log.json`. During
cleanup, two such orphans from 2026-04-10 were found at
`social-media/publish/` and successfully republished via `/publish-post`
and `/publish-story` once the sandbox block was removed. The new
`social_post_queue.error` column + `status='failed'` row makes this
visible going forward.

## Verification

End-to-end smoke test on 2026-04-11 09:01 UTC against production:

1. Seeded one row via `fill-queue.ts` (Bike Health Score angle)
2. `POST /run-slot?slot=afternoon` → worker logs via `wrangler tail`:
   ```
   [scheduled] slot=afternoon cron=0 14 * * * — claiming next post
   [scheduled] slot=afternoon id=16988d1b... angle=bike-health-score attempt=1
   [scheduled] id=16988d1b... images ready (post=gemini-3.1-flash-image, story=gemini-3.1-flash-image)
   [scheduled] id=16988d1b... PUBLISHED
   ```
3. Queue row: `status=published`, `attempts=1`, `post_results` + `story_results` populated with FB + IG IDs, `error=null`
4. All 4 live surfaces succeeded (FB post, IG post, FB story, IG story)

Second run (aspect ratio fix) verified the `render/image` URL returns
`1080×1920` JPEG from a 2K Gemini source.

## Prevention

**Do not put business-critical network traffic on Claude's scheduled
tasks unless the destination host is within Claude's known allowlist.**
The failure mode is silent — scheduled sessions run, log "Good", and
return success even though every network call was blocked by the egress
proxy. There is no indicator in the claude.ai UI.

Rule of thumb: **cron infrastructure should live on the same network as
the destination**. If you're calling a Cloudflare Worker, use Cloudflare
Cron Triggers. If you're calling a Supabase Edge Function, use pg_cron
or a Supabase scheduled function. Claude is excellent at generating the
content that gets fed into that infrastructure; it should not be the
infrastructure.

Testing loop to preserve:
```bash
# Local-only, no real Meta calls:
npx wrangler dev --test-scheduled
curl "http://localhost:8787/__scheduled?cron=0+14+*+*+*"
```

## Deployment reference (for the next time this needs to be rebuilt)

```bash
# 1. Migration
npx supabase db push

# 2. Secret (all others already on Worker)
cd infra/social-worker
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY

# 3. Deploy (registers cron triggers)
npx wrangler deploy

# 4. Seed queue from laptop
export SUPABASE_URL="https://<ref>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<key>"
npx tsx scripts/fill-queue.ts posts.json

# 5. Optional: fire immediately instead of waiting for next cron
curl -X POST -H "X-Auth-Key: $WORKER_AUTH_KEY" \
  "https://motovault-social-api.<subdomain>.workers.dev/run-slot?slot=afternoon"
```

## Files touched

- `supabase/migrations/00088_social_post_queue.sql` — table, RLS, claim RPC
- `infra/social-worker/wrangler.toml` — cron triggers, observability
- `infra/social-worker/src/env.ts` — typed env with new `SUPABASE_SERVICE_ROLE_KEY`
- `infra/social-worker/src/publish.ts` — extracted pure functions, `renderUrl` helper
- `infra/social-worker/src/queue.ts` — PostgREST client with PostgREST-NULL-safe claim
- `infra/social-worker/src/scheduled.ts` — `runScheduledPost` pipeline
- `infra/social-worker/src/index.ts` — `fetch` + `scheduled` exports, `/run-slot`
- `infra/social-worker/scripts/fill-queue.ts` — local CLI
- `infra/social-worker/scripts/tsconfig.json` — isolated Node tsconfig
- `infra/social-worker/{tsconfig.json,package.json,.gitignore}` — worker tooling
