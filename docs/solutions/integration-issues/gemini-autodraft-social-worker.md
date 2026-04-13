---
title: Gemini auto-draft — Worker self-generates social posts when queue is empty
category: integration-issues
date: 2026-04-13
tags:
  - cloudflare-workers
  - gemini-api
  - structured-output
  - cron-triggers
  - supabase
  - postgrest
  - instagram
  - facebook
  - meta-graph-api
  - wrangler
  - social-worker
problem_type: integration_issue
component: social-worker
severity: high
status: resolved
commits:
  - ab08d2b  # feat(social-worker): carousel publishing + 4:5 slide regeneration
  - 045a9ea  # feat(social-worker): Gemini auto-draft when queue is empty
migrations:
  - supabase/migrations/00090_social_post_queue_source.sql
  - supabase/migrations/00091_social_post_queue_autodraft_unique.sql
worker: motovault-social-api
related:
  - docs/solutions/integration-issues/scheduled-social-worker-cron-migration.md
---

# Gemini auto-draft — Worker self-generates social posts when queue is empty

## Problem

After disabling the three broken Claude remote triggers (`motovault-social-afternoon`, `-evening`, `-night-americas`) on 2026-04-11, the `social_post_queue` table was permanently empty. The Cloudflare cron triggers still fired at 14/19/00 UTC, but `claim_next_social_post()` returned `null` every time — the Worker logged "queue is empty, nothing to publish" and exited. Zero posts went out.

The triggers were disabled for two independent reasons:
1. **Sandbox egress allowlist** — Claude's scheduled-task sandbox blocks outbound traffic to `motovault-social-api.kanuchandrej.workers.dev` with `403 host_not_allowed`.
2. **Rotated auth key** — the triggers hardcoded an old `WORKER_AUTH_KEY` that was rotated during the same session.

Even if both issues were fixed, the triggers couldn't push content to Supabase either (also not allowlisted), and couldn't push to GitHub (sandbox git proxy denies push). The triggers were architecturally incompatible with Claude's sandbox constraints. See the [original migration doc](./scheduled-social-worker-cron-migration.md) for the full egress root-cause analysis.

The manual workaround — running `scripts/fill-queue.ts` from the user's laptop weekly — works but creates a content cadence gap whenever the user forgets or is unavailable.

## Root cause

**Content creation was a human dependency in a fully-automated publishing pipeline.** The Cloudflare cron handles publishing autonomously, but it had no way to generate content when the queue was empty. The missing piece was an LLM that could draft captions and image prompts from inside the same network where the publishing infra runs — i.e., from the Worker itself.

## Solution

### Architecture: draft + publish in one cron tick

Extended `runScheduledPost()` in `infra/social-worker/src/scheduled.ts` with an auto-draft branch:

```
scheduled() → runScheduledPost
    │
    ▼
claimNextPost(slot)
    │
    ├─ row found → (existing publish flow, unchanged)
    │
    └─ null → getRecentAngles(env, 5)
              → draftPost(env, slot, recentAngles)    ← Gemini 3 Flash Preview
              → insertDraftedRow(env, slot, draft)    ← status='ready', source='gemini-autodraft'
              → claimNextPost(slot) again             ← atomic pop via RPC
              → (existing publish flow)
```

The auto-draft branch is a strict superset — once a row is claimed (whether from a manual seed or auto-draft), the downstream code path is byte-identical.

### Why Gemini, not Anthropic

- `GOOGLE_AI_STUDIO_KEY` was already a wrangler secret for `generateImage()`. No new vendor, no new billing, no new secrets.
- Gemini 3 Flash Preview supports `responseMimeType: 'application/json'` + `responseJsonSchema` — structured output that forces exactly `{angle, caption, postPrompt, storyPrompt}`. No prompt-hacking.
- Cost: ~$0.0074 per draft call (10k input × $0.50/M + 800 output × $3.00/M). 90 calls/month = $0.67/month, likely $0 on free tier (3 RPD << 100 RPD allowance).

### Single-image reuse (post + story from one generation)

Instead of generating two images (4:5 + 9:16), the Worker generates **one 9:16 image** and reuses it:
- **Story**: full 9:16 via `renderUrl(env, path, 1080, 1920)`
- **Post**: center-cropped to 4:5 via `renderUrl(env, path, 1080, 1350)` — Supabase Storage's cover resize takes the middle ~70% vertically

This halves Gemini image-gen credits. The prompt instructs Gemini to compose key content (subject, text overlay) in the center of the frame so the 4:5 crop doesn't lose anything important.

### Key files

| File | Role |
|---|---|
| `src/draft.ts` | `draftPost()` + `callGemini()` with primary/fallback chain + `validateDraft()` |
| `src/prompts.ts` | System prompt (joined array, biome-safe) + `responseJsonSchema` |
| `src/content-references.ts` | Build-time bundled markdown + JSON (brand voice references) |
| `src/modules.d.ts` | Ambient `declare module '*.md'` for TypeScript |
| `src/scheduled.ts` | Auto-draft branch when `claimNextPost` returns null |
| `src/queue.ts` | `getRecentAngles()`, `insertDraftedRow()` (uses `Prefer: return=headers-only`) |
| `src/index.ts` | `/run-slot?dry-run=1` for zero-cost prompt tuning |
| `wrangler.toml` | `[[rules]] type="Text" globs=["**/*.md"]` for `.md` imports |

## Gotchas discovered

### 1. Wrangler does NOT bundle `.md` by default

Wrangler 4.x default text loaders cover `.txt`, `.html`, `.sql` — but **not `.md`**. Importing `.md` without a `[[rules]]` block in `wrangler.toml` silently produces an empty string at runtime (no build error). This was confirmed via Cloudflare Workers docs (context7 lookup):

```toml
# REQUIRED for .md imports — not optional
[[rules]]
type = "Text"
globs = ["**/*.md"]
fallthrough = true
```

`fallthrough = true` preserves the default rules alongside this one.

### 2. PostgREST schema cache doesn't reload instantly after ALTER TABLE

Adding a nullable column via `ALTER TABLE` is metadata-only (zero-risk), but PostgREST's schema cache may take up to ~100ms to reload via the `pgrst_watch` event trigger. If the Worker tries to INSERT referencing the new `source` column before the cache reloads, PostgREST returns **PGRST204** ("Could not find the column in the schema cache").

**Verification step**: after `supabase db push`, wait 1-2 seconds, then test-insert a row with the new column. If it 404s, force a reload:
```sql
NOTIFY pgrst, 'reload schema';
```

Supabase projects have the `pgrst_watch` trigger pre-configured, so this is usually automatic.

### 3. Gemini `finishReason` AND `promptFeedback.blockReason` are separate failure modes

- **`finishReason`** fires mid-generation when the output is blocked (SAFETY, RECITATION, PROHIBITED_CONTENT, MAX_TOKENS).
- **`promptFeedback.blockReason`** fires pre-generation when the *input* is blocked. When set, `candidates` is typically absent.

Both must be handled. Checking only `finishReason` misses input-level blocks, which fall through to a generic "no text" error without triggering the fallback model.

```typescript
// Check input-level block BEFORE candidates
const promptBlockReason = data.promptFeedback?.blockReason;
if (promptBlockReason) {
  // fall through to fallback model
}

// Then check output-level block
const finishReason = candidate?.finishReason;
if (finishReason && finishReason !== 'STOP' && RETRYABLE_FINISH_REASONS.has(finishReason)) {
  // fall through to fallback model
}
```

### 4. Gemini `responseJsonSchema` does not support `minLength`/`maxLength` on strings

The Gemini structured output is a subset of JSON Schema Draft 7. It does NOT support:
- `minLength` / `maxLength` (on strings)
- `pattern` (regex)
- `$ref`, `oneOf`, `anyOf`, `allOf`

Length bounds must be enforced in a runtime validator (`validateDraft`), not in the schema.

### 5. Double-publish race on concurrent auto-draft inserts

If `/run-slot` fires manually at the same moment a cron runs, both can land in the auto-draft branch, both insert a `ready` row for the same (slot, scheduled_for) — producing two published posts.

**Fix**: partial unique index:
```sql
CREATE UNIQUE INDEX idx_social_post_queue_autodraft_unique_ready
  ON public.social_post_queue (slot, scheduled_for)
  WHERE status = 'ready' AND source = 'gemini-autodraft';
```

Scoped to autodraft only — manual seeds via `fill-queue.ts` retain the ability to queue multiple rows for the same slot/date.

### 6. PostgREST `return=headers-only` is cheaper than `return=representation` for getting the inserted row id

The id is available in the `Location` header (`/social_post_queue?id=eq.<uuid>`). No need to transfer the full row body:

```typescript
const res = await fetch(url, {
  method: 'POST',
  headers: { ...headers(env), Prefer: 'return=headers-only' },
  body: JSON.stringify({ /* ... */ }),
});
const location = res.headers.get('Location');
const id = location?.match(/id=eq\.([0-9a-f-]+)/i)?.[1];
```

### 7. Auto-draft failures produce no row to `markFailed`

When the Gemini draft / insert / re-claim fails, there's no queue row yet. The handler logs the error and exits — `markFailed` can't be called on a non-existent row. The next cron tick retries from scratch.

**Observability gap**: failures are visible only in `wrangler tail` logs. If Gemini is persistently broken, posts stop going out with no alert. Follow-up: add a PostHog capture or Betterstack alert for "auto-draft failed N consecutive times."

### 8. `insert as ready → re-claim via RPC` preserves the atomic pop contract

Don't bypass `claim_next_social_post()` by inserting directly as `status='publishing'`. The RPC does three things atomically: `ready→publishing`, `attempts++`, `last_attempt_at=now()`. Doing these manually would duplicate logic and lose `FOR UPDATE SKIP LOCKED` safety.

## Prevention

1. **Never put business-critical scheduled work on Claude's sandbox.** The egress allowlist is opaque and the failure mode is silent. See the [original migration doc](./scheduled-social-worker-cron-migration.md).
2. **Test wrangler module rules with `wrangler deploy --dry-run`** before assuming imports work. The build succeeding doesn't mean the content is non-empty.
3. **After any Supabase migration, verify the PostgREST schema cache** with a test insert before relying on the new column from the Worker.
4. **For any LLM structured output, enforce bounds in a runtime validator** — don't rely on the schema alone.
5. **For any concurrent-safe insert pattern, add a partial unique index** rather than relying on application-level checks.

## Testing

```bash
# Dry-run (no publish, no insert) — test Gemini drafting:
curl "$WORKER_URL/run-slot?slot=afternoon&dry-run=1" \
  -H "X-Auth-Key: $WORKER_AUTH_KEY" | jq .draft

# Real end-to-end (draft + publish):
curl "$WORKER_URL/run-slot?slot=afternoon" \
  -H "X-Auth-Key: $WORKER_AUTH_KEY"

# Verify queue row:
curl "$SUPABASE_URL/rest/v1/social_post_queue?order=created_at.desc&limit=1" \
  -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY"

# Monitor real cron:
cd infra/social-worker && wrangler tail --format pretty

# Local dev:
wrangler dev --test-scheduled
curl "http://localhost:8787/__scheduled?cron=0+14+*+*+*"
```

## Verification

End-to-end smoke tests on 2026-04-13:

1. **Dry-run** across all three slots — distinct angles, MotoVault voice, prompt lengths within 40-1000 bounds.
2. **Afternoon real publish** — `social_post_queue` row: `source='gemini-autodraft'`, `status='published'`, `attempts=1`, both image URLs populated, `post_results` + `story_results` with IG/FB IDs.
3. **Evening real publish** (single-image reuse) — same source image for post (1080×1350 center crop) and story (1080×1920). Visual inspection confirmed both crops retain key content.
4. **Bundle size**: 101.51 KiB / 22.90 KiB gzipped — 10% of free-tier 1MB limit.
5. **Pre-push hook**: lint ✅, typecheck ✅, 223 tests ✅.

## Related

- [Scheduled social worker — sandbox egress migration](./scheduled-social-worker-cron-migration.md) — the original migration that moved publishing from Claude to Cloudflare cron. This doc extends it with the auto-draft capability.
- Plan: `docs/plans/2026-04-11-004-feat-worker-gemini-autodraft-plan.md` — full implementation plan with deepening research, rollout steps, and review findings.
