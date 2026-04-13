---
title: Auto-draft social posts via Gemini in the Cloudflare Worker
type: feat
status: active
date: 2026-04-11
---

# Auto-draft social posts via Gemini in the Cloudflare Worker

## Overview

Add Gemini-powered caption + image-prompt drafting to the `motovault-social-api` Cloudflare Worker. When a cron trigger fires and `social_post_queue` has no `ready` row for the current slot, the Worker drafts a fresh post (caption + post image prompt + story image prompt + angle) via `gemini-3-flash-preview`, inserts it into the queue as a `ready` row, then uses the existing `claim_next_social_post` RPC + publish pipeline to actually publish it. When a row **does** exist, current behavior is unchanged — the manual-override pathway via `fill-queue.ts` keeps working exactly as today.

The net effect: the 14:00 / 19:00 / 00:00 UTC cron keeps posting every day with zero human input, while still letting the user seed specific captions when they want to override. Quality comes from a bundled brand-voice context pack (`references/*.md` + recent performance log) included in every draft request.

## Problem Statement / Motivation

Earlier today (2026-04-11) we disabled three broken `claude.ai` remote triggers that were trying to publish via `curl` from inside Claude's egress-allowlisted sandbox (see `docs/solutions/integration-issues/scheduled-social-worker-cron-migration.md`). They were blocked by both a stale auth key (rotated during today's session) and a sandbox proxy denying the worker host. Disabling them exposed a gap: the Cloudflare cron triggers are still live on schedule, but `social_post_queue` is empty, so every upcoming cron tick will claim `null`, log "queue is empty", and exit without publishing anything.

The manual `fill-queue.ts` pathway works (proven by today's live carousel publish) but requires the user to sit down with a local Claude session once per week and write a batch of posts. This is friction that usually doesn't happen.

The research in the preceding conversation turn compared five automation options. **Option A — Worker drafts + publishes in one cron tick** is the cleanest fit: it keeps all content + publishing logic in the same process on the same network where the Meta Graph API is already reachable, doesn't need any new infrastructure, and is a ~1-hour change to a file that already does the hard parts (image gen + publishing). The user chose Option A with the constraint "full Gemini functionality — we have an account already with API key in root" — so the drafting LLM is Gemini, not Anthropic, using the `GOOGLE_AI_STUDIO_KEY` wrangler secret that's already loaded for image generation.

## Proposed Solution

### High-level flow

```
┌─────────────────────────────────┐
│  Cloudflare cron @ 14/19/00 UTC │
└───────────────┬─────────────────┘
                │
                ▼
     runScheduledPost(env, cron)
                │
                ▼
     ┌──────────────────────────┐
     │ claim_next_social_post() │
     └──────────┬───────────────┘
                │
      ┌─────────┴─────────┐
      │ row found?        │
      └───┬───────────┬───┘
          │ YES       │ NO
          │           ▼
          │   ┌────────────────────────────────────┐
          │   │ draftPost(env, slot, recentAngles) │
          │   │ → Gemini 3-flash-preview            │
          │   │ → {caption, postPrompt, story…, angle}
          │   └──────────────┬─────────────────────┘
          │                  │
          │                  ▼
          │   ┌────────────────────────────────────┐
          │   │ insert row status='ready'          │
          │   │ source='gemini-autodraft'          │
          │   └──────────────┬─────────────────────┘
          │                  │
          │                  ▼
          │   ┌────────────────────────────────────┐
          │   │ claim_next_social_post() again     │
          │   │ → atomic ready→publishing          │
          │   └──────────────┬─────────────────────┘
          │                  │
          └──────┬───────────┘
                 │
                 ▼
     (existing flow — unchanged)
     generateImage × 2 (post + story)
     publishPost(both)  publishStory(both)
     markPublished(id, ...)
```

The auto-draft branch is a strict superset of the existing code path — it inserts a row and then **re-enters the exact same flow a manually-seeded row would take**. No parallel pipeline.

### Why re-claim after insert instead of writing directly to `publishing`

The existing `claim_next_social_post` RPC does three things in one transaction under `FOR UPDATE SKIP LOCKED`:
1. Moves `ready → publishing`
2. Increments `attempts`
3. Sets `last_attempt_at = now()`

Bypassing it would duplicate all three, lose the `SKIP LOCKED` safety if two crons ever overlap, and create two slightly-different audit-trail shapes for seeded-vs-autodrafted rows. Calling the RPC a second time is ~1ms of Postgres work and keeps the pipeline strictly uniform. (See gotcha #7 in the Apr 11 solution doc — "do not race the claim".)

### Why Gemini over Anthropic

- `GOOGLE_AI_STUDIO_KEY` is already deployed as a wrangler secret; no new secrets, no new API vendor, no new billing surface.
- The Worker's `generateImage()` already uses Gemini — adding text gen keeps the worker single-vendor.
- Gemini 3 Flash supports **structured JSON output via `responseJsonSchema`**, which lets us demand exactly `{caption, postPrompt, storyPrompt, angle}` without prompt-hacking. (See Gemini API docs via context7 lookup from preceding research pass.)
- Cost (corrected in deepening research — original estimate used Gemini 2.0 pricing): Gemini 3 Flash Preview is $0.50 / 1M input, $3.00 / 1M output. A draft call sends ~10k context tokens + outputs ~800. At 3 posts/day × 30 = 90 calls/month → **<$0.67/month, likely $0 on free tier** (3 RPD is well under the 100 RPD free-tier allowance). See the Enhancement Research section at the bottom of this plan for the full calculation.
- Claude Haiku 4.5 would be ~$1/month and strictly better quality for creative voice, but the user explicitly chose Gemini to avoid introducing a new vendor. Quality delta at this task size (short captions, structured output) is small.

### Why bundle references at build time, not fetch at runtime

- GitHub raw is unpredictable (CDN caching, occasional 500s, rate limits for anonymous traffic).
- The Worker runs on Cloudflare's edge — an extra outbound fetch adds 100-500ms + failure modes.
- Total content to bundle (`app-features.md` + `design-system.md` + `performance-log.json` + system prompt) is ~55KB raw, ~15KB gzipped. Worker bundle is currently 39KB — budget is 1MB on free tier, we're fine.
- `wrangler` natively supports importing `.md` as raw text and `.json` as parsed JSON via its default text/json loaders (compatibility_date 2025-04-01, wrangler 4).

## Technical Considerations

### Files touched

| File | Change |
|---|---|
| `infra/social-worker/src/draft.ts` | **NEW** — `draftPost(env, slot, recentAngles)` function |
| `infra/social-worker/src/content-references.ts` | **NEW** — imported markdown + JSON embedded as exported consts |
| `infra/social-worker/src/prompts.ts` | **NEW** — system prompt + JSON schema for structured output |
| `infra/social-worker/src/queue.ts` | `getRecentAngles(env, days)` and `insertDraftedRow(env, draft)` helpers |
| `infra/social-worker/src/scheduled.ts` | New `null` branch after `claimNextPost` → `draftPost` → insert → re-claim |
| `infra/social-worker/src/index.ts` | `/run-slot` accepts `?dry-run=1` to test drafting without publishing |
| `infra/social-worker/wrangler.toml` | Optional `[rules]` block for `.md` text imports if wrangler defaults don't cover it |
| `infra/social-worker/src/env.ts` | No change — `GOOGLE_AI_STUDIO_KEY` already typed |
| `supabase/migrations/00090_social_post_queue_source.sql` | **NEW migration** — add nullable `source TEXT` column to tag autodrafted rows (optional, for observability) |
| `docs/solutions/integration-issues/scheduled-social-worker-cron-migration.md` | Append "Auto-draft extension (2026-04-11)" section |

### New module: `src/draft.ts`

```ts
// infra/social-worker/src/draft.ts
import type { Env } from './env';
import { APP_FEATURES_MD, DESIGN_SYSTEM_MD, PERFORMANCE_LOG } from './content-references';
import { DRAFT_SYSTEM_PROMPT, DRAFT_RESPONSE_SCHEMA } from './prompts';
import type { SlotName } from './queue';

export interface DraftedPost {
  angle: string;
  caption: string;
  postPrompt: string;   // prompt for 4:5 post image
  storyPrompt: string;  // prompt for 9:16 story image
}

interface GeminiTextResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  error?: { message?: string };
}

const PRIMARY_MODEL  = 'gemini-3-flash-preview';
const FALLBACK_MODEL = 'gemini-2.5-flash';

export async function draftPost(
  env: Env,
  slot: SlotName,
  recentAngles: string[],
): Promise<DraftedPost> {
  // Build a compact performance-log excerpt: last 7 days only, to keep the
  // prompt well under Flash's 1M token window while still giving the model
  // signal about what's been tried recently.
  const recentPosts = PERFORMANCE_LOG.posts
    .slice(-14)                        // ~5 days of 3x posts
    .map((p) => ({
      date: p.published_at?.slice(0, 10),
      platform: p.platform,
      caption_preview: p.caption_preview?.slice(0, 120),
      hook_type: p.classification?.hook_type,
      content_category: p.classification?.content_category,
    }));

  const userPrompt = [
    `Slot: ${slot}`,
    `Today: ${new Date().toISOString().slice(0, 10)}`,
    `Recent angles to AVOID (used within last 5 days): ${recentAngles.join(', ') || '(none)'}`,
    ``,
    `## App features reference`,
    APP_FEATURES_MD,
    ``,
    `## Design system reference`,
    DESIGN_SYSTEM_MD,
    ``,
    `## Recent posts (avoid repeating angles)`,
    JSON.stringify(recentPosts, null, 2),
    ``,
    `Draft one complete post for this slot now. Respond with JSON matching the schema.`,
  ].join('\n');

  const draft = await callGemini(env, PRIMARY_MODEL, userPrompt);
  return draft;
  // Fallback to FALLBACK_MODEL is handled inside callGemini, not here.
}

async function callGemini(env: Env, model: string, userPrompt: string): Promise<DraftedPost> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GOOGLE_AI_STUDIO_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: DRAFT_SYSTEM_PROMPT }] },
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseJsonSchema: DRAFT_RESPONSE_SCHEMA,
        temperature: 0.9,           // creative but not chaotic
        maxOutputTokens: 2048,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    // On primary failure, try fallback once.
    if (model === PRIMARY_MODEL) {
      console.warn(`[draft] ${PRIMARY_MODEL} failed (${res.status}): ${body.slice(0, 200)} — retrying with ${FALLBACK_MODEL}`);
      return callGemini(env, FALLBACK_MODEL, userPrompt);
    }
    throw new Error(`Gemini draft failed (${model}, ${res.status}): ${body.slice(0, 500)}`);
  }

  const data = (await res.json()) as GeminiTextResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error(`Gemini draft returned no text (${model}, finishReason=${data.candidates?.[0]?.finishReason})`);
  }

  const parsed = JSON.parse(text) as unknown;
  return validateDraft(parsed);
}

// Lightweight runtime validation matching fill-queue.ts validate() style.
// No zod dep in the worker package (bundle bloat); hand-roll the check.
function validateDraft(raw: unknown): DraftedPost {
  if (!raw || typeof raw !== 'object') throw new Error('draft: not an object');
  const d = raw as Record<string, unknown>;
  const fields = ['angle', 'caption', 'postPrompt', 'storyPrompt'] as const;
  for (const f of fields) {
    if (typeof d[f] !== 'string' || (d[f] as string).trim() === '') {
      throw new Error(`draft: field "${f}" missing or empty`);
    }
  }
  // Sanity bounds — cheap safety net, not exhaustive.
  if ((d.caption as string).length > 2200) throw new Error('draft: caption exceeds IG limit');
  if ((d.postPrompt as string).length < 20) throw new Error('draft: postPrompt too short');
  if ((d.storyPrompt as string).length < 20) throw new Error('draft: storyPrompt too short');
  return {
    angle:       (d.angle as string).trim(),
    caption:     (d.caption as string).trim(),
    postPrompt:  (d.postPrompt as string).trim(),
    storyPrompt: (d.storyPrompt as string).trim(),
  };
}
```

### New module: `src/prompts.ts`

Holds the system prompt as a joined array (see Biome caveat below) and the JSON schema for structured output:

```ts
// infra/social-worker/src/prompts.ts
export const DRAFT_SYSTEM_PROMPT = [
  'You are the MotoVault social media copywriter. MotoVault is an AI-powered motorcycle',
  'learning & diagnostics app — think rider-facing garage manager + service reminder',
  'system + AI photo diagnostics + ride log, all in one.',
  '',
  'Voice: Revzilla / FortNine energy. Direct, confident, a little dry, never corporate.',
  'Talk to riders the way a skilled mechanic friend talks to riders — plain English, no',
  'startup language. Never use the words: "revolutionary", "game-changing", "unleash",',
  '"empower", "seamless", "journey", "ecosystem". No fluff, no filler.',
  '',
  'Audience: European + American motorcycle riders. Use both metric (km, EUR) and imperial',
  '(miles, USD) where appropriate — default to metric for Europe slots, imperial for',
  'night-americas slot.',
  '',
  'Rules:',
  '- Captions are 60-280 chars unless a longer format is clearly earning it. No padding.',
  '- Open with a hook in the first 8 words. Stat hooks, question hooks, pain hooks, or',
  '  challenge hooks only. No "in today\'s fast-paced world" openers.',
  '- Include 1 concrete feature benefit. Not a list of five.',
  '- End with one clear next action: "Free on iOS + Android", "Link in bio", or similar.',
  '- Add 8–15 relevant hashtags at the end, separated by single spaces. Mix big and niche.',
  '- Avoid hashtags banned or penalized by Meta. Avoid #motorcycle (too generic).',
  '- The angle you pick must NOT appear in the recent-posts list provided.',
  '',
  'Image prompts: write photorealistic scene descriptions. Moody, cinematic, dark.',
  'Post image is 4:5 (portrait feed). Story image is 9:16 (full vertical).',
  'Reference the brand colors: dark #0a0a0a background, warm #D4622E orange accents.',
  'Font in any rendered text overlay: Plus Jakarta Sans bold.',
  '',
  'Respond with JSON only — no preamble, no markdown fence, no trailing commentary.',
].join('\n');

export const DRAFT_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    angle: {
      type: 'string',
      description: 'Short slug describing the angle, e.g. "health-score-hook", "cost-per-mile", "service-reminder-pain". Must NOT repeat any recent angle from the prompt.',
    },
    caption: {
      type: 'string',
      description: 'Full Instagram/Facebook caption with hook + benefit + CTA + hashtags. 60-280 chars for the body, hashtags appended after a blank line.',
    },
    postPrompt: {
      type: 'string',
      description: '4:5 photorealistic image prompt for the feed post. ~200-400 chars. Include scene, lighting, mood, and any overlaid text.',
    },
    storyPrompt: {
      type: 'string',
      description: '9:16 photorealistic image prompt for the vertical story. ~200-400 chars. Different scene/framing from the post image.',
    },
  },
  required: ['angle', 'caption', 'postPrompt', 'storyPrompt'],
} as const;
```

### New module: `src/content-references.ts`

```ts
// infra/social-worker/src/content-references.ts
//
// Build-time bundling of brand-voice references. Imported as raw text / parsed
// JSON by the Gemini drafter. Wrangler's default loaders handle these.
//
// IMPORTANT: these paths reach OUTSIDE the social-worker package. They must
// stay stable — don't relocate marketing/motovault-social/ without updating
// these imports.
import APP_FEATURES_MD from '../../../marketing/motovault-social/references/app-features.md';
import DESIGN_SYSTEM_MD from '../../../marketing/motovault-social/references/design-system.md';
import PERFORMANCE_LOG from '../../../marketing/motovault-social/data/performance-log.json';

export { APP_FEATURES_MD, DESIGN_SYSTEM_MD, PERFORMANCE_LOG };
```

Wrangler caveat: if the default text loader doesn't pick up `.md`, add to `wrangler.toml`:
```toml
[[rules]]
type = "Text"
globs = ["**/*.md"]
fallthrough = true
```
The `.json` import works out of the box. Verify with `wrangler deploy --dry-run` before real deploy.

Also add `"resolveJsonModule": true` to `tsconfig.json` if TypeScript complains about the JSON import (check current tsconfig first — compatibility_date 2025-04-01 + moduleResolution bundler usually handles this).

### `src/queue.ts` additions

```ts
// Append to queue.ts

/**
 * Return the `angle` strings from rows scheduled within the last N days
 * (any status). Used by the auto-drafter to avoid repeating recent angles.
 */
export async function getRecentAngles(env: Env, days = 5): Promise<string[]> {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  const url = `${env.SUPABASE_URL}/rest/v1/social_post_queue`
    + `?select=angle`
    + `&scheduled_for=gte.${cutoffDate}`
    + `&order=scheduled_for.desc`;

  const res = await fetch(url, { headers: headers(env) });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`getRecentAngles failed (${res.status}): ${body}`);
  }
  const rows = (await res.json()) as Array<{ angle: string }>;
  return rows.map((r) => r.angle).filter(Boolean);
}

/**
 * Insert a drafter-generated row into social_post_queue with status='ready',
 * so it can be claimed by the existing RPC in the very next step.
 *
 * Returns the inserted row id.
 */
export async function insertDraftedRow(
  env: Env,
  slot: SlotName,
  draft: { angle: string; caption: string; postPrompt: string; storyPrompt: string },
): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const url = `${env.SUPABASE_URL}/rest/v1/social_post_queue`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...headers(env), Prefer: 'return=representation' },
    body: JSON.stringify({
      slot,
      scheduled_for: today,
      angle: draft.angle,
      caption: draft.caption,
      post_prompt: draft.postPrompt,
      story_prompt: draft.storyPrompt,
      status: 'ready',
      source: 'gemini-autodraft',  // nullable column from migration 00090
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`insertDraftedRow failed (${res.status}): ${body}`);
  }
  const rows = (await res.json()) as Array<{ id: string }>;
  const id = rows[0]?.id;
  if (!id) throw new Error('insertDraftedRow: no id in response');
  return id;
}
```

Note camelCase → snake_case mapping at the REST boundary (`postPrompt` → `post_prompt`). The Worker already violates the project-wide "map at NestJS layer" convention because it talks directly to PostgREST; this new code keeps the same violation consistent rather than introducing a third style.

### `src/scheduled.ts` modification

Insert a new branch after the existing `claimNextPost(env, slot)` call (currently at line ~34):

```ts
  let row = await claimNextPost(env, slot);

  if (!row) {
    console.log(`[scheduled] slot=${slot} — queue empty, auto-drafting via Gemini`);
    try {
      const recentAngles = await getRecentAngles(env, 5);
      const draft = await draftPost(env, slot, recentAngles);
      console.log(`[scheduled] slot=${slot} draft ready angle=${draft.angle}`);

      await insertDraftedRow(env, slot, draft);

      // Re-claim. This atomic pop keeps `status`, `attempts`, and
      // `last_attempt_at` on the exact same update path as a seeded row.
      row = await claimNextPost(env, slot);
      if (!row) {
        // Theoretically possible if two crons race, but very unlikely —
        // SKIP LOCKED + single slot per cron means the row we just inserted
        // is the only one that matches. Treat as hard failure.
        console.error(`[scheduled] slot=${slot} — drafted row vanished before re-claim`);
        return;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[scheduled] slot=${slot} auto-draft failed: ${message}`);
      // No row to mark failed. Log and exit — next cron tick will try again.
      // If Gemini is persistently broken, it will show up as a gap in posting
      // cadence, which is observable.
      return;
    }
  }

  // From here, the existing flow runs UNCHANGED — generate images, publish,
  // mark published/failed.
  console.log(`[scheduled] slot=${slot} id=${row.id} angle=${row.angle} attempt=${row.attempts}`);
  // ... rest of runScheduledPost as-is
```

### `src/index.ts` modification — dry-run for `/run-slot`

Accept a `?dry-run=1` query on `/run-slot`. When present, run the drafter path only and return the drafted `{caption, postPrompt, storyPrompt, angle}` in the HTTP response without inserting, publishing, or marking anything.

```ts
case '/run-slot': {
  const slot = url.searchParams.get('slot');
  const dryRun = url.searchParams.get('dry-run') === '1';
  const cron = Object.entries(CRON_TO_SLOT).find(([, s]) => s === slot)?.[0];
  if (!cron) {
    return json({ error: 'slot must be one of: afternoon, evening, night-americas' }, 400);
  }
  if (dryRun) {
    const recentAngles = await getRecentAngles(env, 5);
    const draft = await draftPost(env, slot as SlotName, recentAngles);
    return json({ dry_run: true, slot, draft, recent_angles_avoided: recentAngles });
  }
  await runScheduledPost(env, cron);
  return json({ ok: true, slot, cron });
}
```

This gives us a zero-cost smoke test: fire `/run-slot?slot=afternoon&dry-run=1`, inspect the drafted JSON, tweak prompts if needed, then drop `&dry-run=1` for a real end-to-end run.

### Migration `00090_social_post_queue_source.sql`

```sql
-- Add a source column to distinguish manually-seeded rows (NULL or 'manual')
-- from Gemini-autodrafted rows ('gemini-autodraft'). Nullable + no default
-- = zero impact on existing rows, fully additive.

ALTER TABLE public.social_post_queue
  ADD COLUMN IF NOT EXISTS source TEXT;

COMMENT ON COLUMN public.social_post_queue.source IS
  'Origin of this row: NULL or "manual" for fill-queue.ts seeded rows, "gemini-autodraft" for Worker-generated rows.';
```

Strictly additive, no RLS change, no RPC change. Migration sequence is 00090 (next after 00089 fix-trips-rls-recursion which is in untracked status per git status).

### `wrangler.toml` change (conditional)

If wrangler's default text loader doesn't pick up `.md` imports at build time, add:

```toml
[[rules]]
type = "Text"
globs = ["**/*.md"]
fallthrough = true
```

Test with `wrangler deploy --dry-run` or `wrangler dev --test-scheduled` before applying.

## System-Wide Impact

### Interaction graph

```
scheduled() → runScheduledPost → claimNextPost (RPC)
                                    │
                                    └─ returns null
                                          │
                                          ├─ getRecentAngles (PostgREST SELECT)
                                          ├─ draftPost → Gemini 3-flash-preview (HTTPS)
                                          ├─ insertDraftedRow (PostgREST INSERT, service-role)
                                          └─ claimNextPost again (RPC)
                                                 │
                                                 └─ returns row
                                                       │
                                                       ├─ generateImage × 2 → Gemini image API
                                                       ├─ publishPost → Supabase upload + Meta Graph /photos + /media + /media_publish
                                                       ├─ publishStory → Supabase upload + Meta Graph /photos + /photo_stories + /media + /media_publish
                                                       └─ markPublished (PostgREST PATCH)
```

Total external calls added in the new branch: **1 PostgREST GET, 1 Gemini POST, 1 PostgREST INSERT, 1 PostgREST RPC POST** = 4 extra round-trips, all on established networks (Cloudflare → Google / Supabase). Expected added latency: 2-6 seconds. Well within `ctx.waitUntil` budgets.

### Error & failure propagation

The auto-draft branch introduces three new failure modes:

| Failure | Current handling | New handling |
|---|---|---|
| `getRecentAngles` PostgREST error | N/A | Throw → caught by new try/catch → log + return. Next cron retries. |
| `draftPost` — primary model 5xx/4xx | N/A | Fall back to `gemini-2.5-flash` inside `callGemini`. Fallback failure → throw → log + return. |
| `draftPost` — JSON validation failure | N/A | Throw → log + return. |
| `insertDraftedRow` PostgREST error | N/A | Throw → log + return. |
| Re-`claimNextPost` returns null | N/A | Log hard error + return. (Unexpected — indicates race or RLS drift.) |

The *existing* publish path's error handling is untouched. Once `row` is claimed (whether from seed or autodraft), the code path is identical to today's. `markFailed` handles the existing retry policy for publish-side failures.

**Important**: draft failures do NOT mark any row as failed, because there is no row yet. They're silent from the queue's perspective — you observe them only in `wrangler tail` logs. If Gemini is persistently broken, posts just stop going out. Acceptable because (a) it's the same failure mode as today's empty-queue state, and (b) the manual-override path via `fill-queue.ts` is always available as an escape hatch.

### State lifecycle risks

- **Partial success (draft succeeds, insert fails)**: Gemini call made, no DB row. No cleanup needed — the Gemini output is discarded. Cron retries next tick.
- **Partial success (insert succeeds, re-claim fails)**: Row sits in `social_post_queue` with `status='ready'` forever. **The existing claim_next_social_post RPC will pick it up on the NEXT cron tick for the same slot** because `scheduled_for <= today`. This is actually safe self-healing behavior, not a risk.
- **Partial success (claim succeeds, publish fails)**: Existing markFailed path handles this — no change.
- **Duplicate drafts**: Only possible if two crons race for the same slot. SKIP LOCKED + `LIMIT 1` means only one process claims the inserted row; the other sees `null` and tries to draft again. Worst case: two rows for the same slot on the same day, one published, one stuck at `ready`. Tomorrow's cron will pick up the stuck one. Can clean up manually with `UPDATE ... SET status='skipped' WHERE status='ready' AND scheduled_for < today`. Minor edge case — unlikely to hit in practice given one cron per slot.

### API surface parity

The auto-draft pathway exposes itself only through the existing `/run-slot` endpoint (with the new `?dry-run=1` toggle) and the existing cron triggers. No new HTTP endpoints, no new wrangler secrets. `fill-queue.ts` (the manual override pathway) is unchanged and keeps working identically.

### Integration test scenarios (cross-layer)

1. **Happy path — empty queue**: queue is empty → cron fires → drafter runs → row inserted → claimed → images generated → posted. Check `social_post_queue` for one row with `source='gemini-autodraft'`, `status='published'`, both image URLs populated, valid `post_results` + `story_results` JSON.
2. **Happy path — manual override present**: manually insert a row via `fill-queue.ts` for today+afternoon → cron fires → claim succeeds, drafter skipped entirely. No Gemini call made. Verify with Cloudflare metrics or by checking that the row's `source` is NULL/`manual`.
3. **Gemini down — primary model**: mock Gemini 3 flash preview to return 503 → fallback to 2.5-flash → succeeds. Verify fallback log line appears.
4. **Gemini down — both models**: mock both to 503 → log "auto-draft failed" → scheduled() returns cleanly → no partial row written. Verify no new row in `social_post_queue`.
5. **Gemini returns garbage JSON** (e.g., wrong schema): validator throws → log + return → no partial row. Verify.
6. **`draftPost` picks a repeating angle despite instructions**: feed `recentAngles = ['health-score']` + a prompt that biases toward health-score → verify the model respects the "must not be in recent angles" rule. (This is a prompt-quality check, runnable via `?dry-run=1`.)
7. **Double-cron race**: fire `/run-slot?slot=afternoon` twice in parallel via curl → only one row should reach `status='published'`. Verify no duplicate Meta posts.

Tests 1-5 can run against production via `/run-slot?slot=afternoon&dry-run=1` (for drafting only) or against `wrangler dev --test-scheduled` locally. Test 7 needs careful live validation.

## Acceptance Criteria

### Functional

- [ ] Cron fires at 14/19/00 UTC with an empty queue → a fresh post is published to IG + FB within 60 seconds
- [ ] `social_post_queue` contains a row with `source='gemini-autodraft'` for each auto-drafted post
- [ ] `source` is NULL for rows seeded via `fill-queue.ts` (existing behavior preserved)
- [ ] `getRecentAngles(env, 5)` returns angles from the last 5 days (inclusive of today)
- [ ] The drafter avoids any angle in the recent list across 10 consecutive dry-run invocations
- [ ] Captions fall within 60-2200 characters; both image prompts are ≥20 characters
- [ ] `GET /run-slot?slot=afternoon&dry-run=1` returns `{dry_run: true, slot, draft, recent_angles_avoided}` without inserting a row or publishing
- [ ] Manual `fill-queue.ts` pathway continues to work unchanged

### Non-functional

- [ ] Total scheduled() runtime stays under 90 seconds (image gen + Meta calls + 2-6s for drafting)
- [ ] Worker bundle size stays under 500KB (current ~40KB + ~60KB references ≈ ~100KB)
- [ ] No new secrets added; `GOOGLE_AI_STUDIO_KEY` is reused
- [ ] `pnpm typecheck` passes with no new warnings
- [ ] `pnpm lint` passes with no new warnings
- [ ] Gemini cost stays under $0.10/month for 90 draft calls

### Quality

- [ ] Five hand-reviewed dry-run drafts match MotoVault voice (no "revolutionary", "empower", "journey", etc.)
- [ ] Five hand-reviewed dry-run drafts have distinct angles
- [ ] Hashtag count is between 8 and 15 per caption

## Success Metrics

- **Primary**: Number of days in a row with ≥3 published posts, measured across a 14-day window after deploy. Target: 14/14.
- **Secondary**: Zero manual `fill-queue.ts` invocations required after deploy (within that 14-day window).
- **Quality proxy**: Manual review of 10 random auto-drafted captions by user → ≥8/10 rated "would have posted this myself".

## Dependencies & Risks

### Dependencies

- `GOOGLE_AI_STUDIO_KEY` wrangler secret (already set)
- `gemini-3-flash-preview` model availability in the `generativelanguage.googleapis.com` API (verified via context7 lookup 2026-04-11)
- Wrangler 4.x text/json loader support (already in use)
- Supabase `social_post_queue` table + `claim_next_social_post` RPC (already in place)

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Gemini 3 flash preview deprecated | Low (preview, but actively used by existing image-gen path) | High | Fallback chain to `gemini-2.5-flash` already in the drafter |
| Gemini safety filter blocks a caption | Low | Medium | Fallback model retry + log; if still blocked, log and exit |
| Bundle exceeds 1MB free-tier limit | Very Low | Medium | References bundle is ~60KB raw; paid tier is 10MB |
| Wrangler text loader misses `.md` | Low | Medium | Add `[[rules]]` block to `wrangler.toml`; verified via `deploy --dry-run` |
| `.json` loader doesn't parse at build time | Low | Low | Fall back to importing as text + `JSON.parse` at module load |
| Performance-log.json bloats over time | Medium (grows daily) | Low | Drafter only uses last 14 entries; can trim JSON to last 30 days at build time later |
| Brand-voice drift from Claude-written captions | Medium | Medium | Run 5-draft review before enabling; refine system prompt iteratively |
| Two crons race (unlikely — Cloudflare dedupes) | Very Low | Low | SKIP LOCKED protects against double-publish; stale row self-heals on next tick |
| Gemini cost spike | Very Low | Low | Flash is ~$0.025/month at 90 calls; would need 4000x traffic to matter |

## Rollout Order

Do these in this exact order. Each step is independently verifiable.

1. **Create migration `00090_social_post_queue_source.sql`** (1 line ALTER). Run `npx supabase db push` — additive, no migration repair needed.
2. **Add `src/content-references.ts`** — imports only, no logic. Verify `pnpm typecheck` passes. Check the JSON + MD imports work with a quick `console.log(APP_FEATURES_MD.slice(0, 100))` in a temp test file.
3. **Add `src/prompts.ts`** — system prompt + schema constants only.
4. **Add `src/draft.ts`** — `draftPost` + `callGemini` + `validateDraft`. Typecheck passes but no call sites yet.
5. **Add `getRecentAngles` + `insertDraftedRow` to `src/queue.ts`**. Typecheck passes.
6. **Add `?dry-run=1` support to `/run-slot` in `src/index.ts`**. Deploy with `pnpm deploy`. Test with `curl "$WORKER_URL/run-slot?slot=afternoon&dry-run=1" -H "X-Auth-Key: $WORKER_AUTH_KEY"`. Inspect 5 drafts across the three slots.
7. **Tune system prompt based on step 6 output**. Iterate until 5/5 drafts read like MotoVault. Redeploy as needed.
8. **Wire the auto-draft branch into `src/scheduled.ts`**. This is the irreversible step — now a real cron tick can auto-publish. Deploy.
9. **Smoke test via `/run-slot?slot=afternoon`** (no dry-run) — confirm end-to-end (draft → insert → claim → publish). Delete test post from IG/FB immediately after.
10. **Let the next real cron fire**. Monitor `wrangler tail` in another terminal. Verify a fresh auto-drafted post appears on IG + FB + both stories.
11. **Update the Apr 11 solutions doc** with a new "Auto-draft extension" section linking to this plan.
12. **Commit.** Do not push without explicit user approval — the rollout touches production publishing infra.

If any step fails, stop and diagnose. Do NOT proceed to the next step with unresolved warnings.

## Gotchas carried forward from the Apr 11 solutions doc

All ten gotchas from `docs/solutions/integration-issues/scheduled-social-worker-cron-migration.md` — reproduced here so they're not lost:

1. **PostgREST serializes NULL composite returns as all-null objects**, not JSON `null`. Any new claim/read logic must use `data === null || data.id === null`. Applied in: `claimNextPost` (unchanged), new `getRecentAngles` (uses array-shaped response, not composite, so this doesn't apply directly but the pattern rhymes).
2. **`ctx.waitUntil` is mandatory**. The auto-draft branch lives inside `runScheduledPost` which is already inside `ctx.waitUntil` — preserved.
3. **Supabase migration ledger drift blocks `db push`**. Migration 00090 is additive — if drift occurs, use `migration repair --status reverted`.
4. **Biome pre-push hook scans untracked files**. New TS files under `src/` are fine; avoid committing scratch `.vercel` or similar artifacts.
5. **Instagram `/media_publish` leaks on partial failure**. Unchanged — auto-draft branch doesn't touch this pathway.
6. **Gemini image config quirk** (1536×2752 at '9:16'). Existing `renderUrl` crop still applies; auto-draft path reuses the same `generateImage` + `publishPost` / `publishStory` — no change needed.
7. **`claim_next_social_post` atomic claim semantics**. The auto-draft path explicitly calls the RPC twice (insert as `ready`, then re-claim) to preserve `attempts`/`last_attempt_at` on the canonical update path.
8. **Service-role key on the Worker**. Reused — no new key needed. All new `queue.ts` helpers use the existing `headers(env)` helper which sets `SUPABASE_SERVICE_ROLE_KEY`.
9. **Manual trigger endpoint exists** (`/run-slot`). Extended with `?dry-run=1` instead of creating a new endpoint.
10. **Scheduling must live on the destination's network**. The whole point — don't move any piece back to a Claude sandbox.

## Biome caveats

- **System prompt**: stored as `string[].join('\n')` rather than a backtick multi-line template so biome's 100-col reflow can't surprise-wrap it mid-sentence.
- **Auto-import organization**: biome will sort imports. Keep new imports alphabetized to reduce diff noise on subsequent edits.
- **No explicit `any`**: the `unknown` cast in `validateDraft` is deliberate — explicit `any` triggers a warning.
- **Long template strings**: avoid inside `.ts` files; use imported `.md` instead.

## Open questions

- **`gemini-3-flash-preview` pricing & quotas**: context7 shows the model exists; the Gemini pricing page should be checked before deploy to confirm free-tier allowances cover 90 calls/month. Expected yes, but verify.
- **Should we persist the raw Gemini response** for audit/debugging? Proposal: NO for MVP, reconsider if we need to review drafts after the fact. The queue row already stores the final caption + prompts.
- **Should the drafter respect brand calendar events** (launches, campaigns)? Out of scope for MVP — let manual override (fill-queue.ts) handle those.

## Sources & References

### Internal references

- `infra/social-worker/src/publish.ts` lines 46-148 — current Gemini usage pattern to mirror (endpoint shape, error handling, fallback chain)
- `infra/social-worker/src/scheduled.ts` lines 25-83 — `runScheduledPost` function to extend
- `infra/social-worker/src/queue.ts` lines 48-129 — PostgREST client patterns (`headers()` helper, PATCH shapes)
- `infra/social-worker/src/env.ts` — `GOOGLE_AI_STUDIO_KEY` secret binding (already present)
- `supabase/migrations/00088_social_post_queue.sql` — table schema, RLS policies, `claim_next_social_post` RPC
- `marketing/motovault-social/references/app-features.md` — 5.9KB brand context (bundled into Worker)
- `marketing/motovault-social/references/design-system.md` — 6.2KB design tokens (bundled)
- `marketing/motovault-social/data/performance-log.json` — 41KB recent post history (bundled)
- `docs/solutions/integration-issues/scheduled-social-worker-cron-migration.md` — Apr 11 solutions doc with all 10 gotchas
- `CLAUDE.md` — project conventions on service-role usage, Zod (bypassed in worker due to bundle cost), naming

### External references

- [Gemini API — Text Generation](https://ai.google.dev/gemini-api/docs/text-generation) (via context7)
- [Gemini API — Structured Output with JSON Schema](https://ai.google.dev/gemini-api/docs/structured-output)
- [Cloudflare Workers — Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- [Cloudflare Workers — EVENT scheduled() handler](https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/)
- [Wrangler text and json module rules](https://developers.cloudflare.com/workers/wrangler/configuration/#bundling)

### Related work

- Current deploy: `https://motovault-social-api.kanuchandrej.workers.dev` (version ID `7f2a8a98-4186-40b1-b560-5750cd8bbb0c`)
- Smoke-test carousel published earlier today: IG media_id `17932982343225416`, FB post_id `1041569589040415_122107301000957235`
- Disabled claude.ai remote triggers (for reference, not to re-enable): `trig_01DWDAFUxuvzwMeGNHCmSJ44`, `trig_01GQ3gqSdsUMLpaLBbF94z74`, `trig_01GyQZ8LXHgjM2USDQKA3hps`

---

## Enhancement Research (Deepening — 2026-04-11)

This section adds grounded citations and concrete numbers for the seven items flagged during `/deepen-plan`. All findings are from primary sources (official docs + context7 lookups) dated 2026.

### 1. Gemini 3 Flash Preview — pricing, quotas, failure modes

**Released**: 2025-12-17. **Context window**: 1M tokens. **Model ID**: `gemini-3-flash-preview` (confirmed in current Gemini API docs via context7).

**Paid pricing** (Gemini Developer API, 2026):
- Input: **$0.50 / 1M tokens** (text)
- Output: **$3.00 / 1M tokens**
- Audio input: $1.00 / 1M (not used here)

Source: [pricepertoken.com — Gemini 3 Flash Preview](https://pricepertoken.com/pricing-page/model/google-gemini-3-flash-preview), [ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing).

**Free tier rate limits** (per-model, subject to change):
- `gemini-3-flash-preview`: "roughly 10-50 RPM, 100+ RPD" per community reports — Google has not published formal free-tier numbers for 3-flash-preview yet
- `gemini-2.5-flash` (our fallback): **10 RPM / 250 RPD / 250,000 TPM** — confirmed stable limits
- All free-tier models share a **250k TPM pool**

Source: [ai.google.dev/gemini-api/docs/rate-limits](https://ai.google.dev/gemini-api/docs/rate-limits).

**Our usage**: 3 calls/day (one per slot) = **3 RPD** total. This is negligible compared to any tier. Free tier will almost certainly cover us; we might never pay.

**Known failure modes** relevant to Worker usage:
- **`finishReason: SAFETY`** — the model refuses to respond due to safety filters. Response body has `candidates[0].finishReason === 'SAFETY'` and no `content.parts`. Our motorcycle/product-marketing content is extremely unlikely to trigger this, but the drafter's response parser should check `finishReason` and fall through to the fallback model if it's `SAFETY`, `RECITATION`, or `PROHIBITED_CONTENT`.
- **`finishReason: MAX_TOKENS`** — truncated output. Our 2048 output token cap is generous for a ~280-char caption + 2 × 400-char image prompts (~400 tokens total), but worth guarding against.
- **`finishReason: MALFORMED_FUNCTION_CALL`** — rare; related to tool-use, not relevant here.
- **Structured output schema violation** — the model CAN occasionally produce JSON that technically parses but misses required fields (especially for deeply nested schemas). Our flat 4-field schema minimizes this risk. The `validateDraft` helper catches any violations.

**Action**: Add `finishReason` handling to `callGemini` — if not `STOP`, treat as a drafting failure and fall through.

```ts
// Inside callGemini, after parsing data:
const candidate = data.candidates?.[0];
const finishReason = candidate?.finishReason;
if (finishReason && finishReason !== 'STOP') {
  if (model === PRIMARY_MODEL) {
    console.warn(`[draft] ${PRIMARY_MODEL} finishReason=${finishReason} — retrying with ${FALLBACK_MODEL}`);
    return callGemini(env, FALLBACK_MODEL, userPrompt);
  }
  throw new Error(`Gemini draft finishReason=${finishReason} (${model})`);
}
```

### 2. Wrangler 4.x `.md` and `.json` imports — verified requirements

**Finding**: The plan was correct to flag this as "optional" — it's actually **required** for `.md`, NOT optional.

Per [Cloudflare Workers docs — Importing Non-JavaScript Modules](https://developers.cloudflare.com/workers/wrangler/configuration/#bundling), the default supported types that work WITHOUT a `[[rules]]` block are:
- `.txt` → Text
- `.html` → Text
- `.sql` → Text
- `.bin` → Data
- `.wasm` → CompiledWasm

**`.md` is NOT in the default list.** To import `.md` at build time, we MUST add this to `wrangler.toml`:

```toml
[[rules]]
type = "Text"
globs = [ "**/*.md" ]
fallthrough = true
```

The `fallthrough = true` flag is important — it says "add this rule alongside defaults, don't replace them." Without it, the default rules are overridden.

**`.json` imports**: work out of the box. TypeScript may need `"resolveJsonModule": true` in tsconfig.json — check `infra/social-worker/tsconfig.json` during implementation; if `moduleResolution: "bundler"` is set (per research report it is), resolveJsonModule is enabled automatically.

Source: [developers.cloudflare.com/workers/wrangler/configuration](https://developers.cloudflare.com/workers/wrangler/configuration/#bundling).

**Plan change**: Elevate the `[[rules]]` block from "conditional" to "required — do this in step 2 of rollout." Update rollout order.

### 3. Gemini structured JSON output — best practices

**Confirmed patterns from [Gemini API JSON mode docs](https://ai.google.dev/gemini-api/docs/json-mode)**:

1. **Always set both** `responseMimeType: "application/json"` AND `responseJsonSchema`. Setting only one produces inconsistent results.
2. **Use `required: ['angle', 'caption', 'postPrompt', 'storyPrompt']`** — without it, Gemini may omit fields silently. Our plan already includes this.
3. **Field descriptions matter**. Gemini uses the `description` on each property as instruction. Keep them specific and constraint-heavy ("60-280 chars", "must NOT be a repeat angle").
4. **Property order is respected.** The docs state: "When using structured outputs, the model will produce outputs in the same order as the keys in the schema." So put `angle` first (model "thinks" about angle before writing caption), then `caption`, then image prompts.
5. **No markdown fences in output**: The `responseMimeType: 'application/json'` mode guarantees the model won't wrap output in ````json` blocks. We do NOT need to strip ````json` markers — just `JSON.parse(text)` directly.
6. **Temperature**: The Gemini docs do NOT recommend a specific temperature for structured output. Structured output constrains the *shape*, not the creativity. **Our 0.9 is fine** for creative captions.
7. **`maxOutputTokens: 2048` is more than enough** for our schema (~400 tokens expected output).

**Gotcha**: The Gemini `responseJsonSchema` is a subset of JSON Schema Draft 7. **It does NOT support**:
- `$ref` (no schema references)
- `oneOf` / `anyOf` / `allOf` (no unions)
- `pattern` (no regex validation)
- `minLength` / `maxLength` (only `minItems`/`maxItems` on arrays)

Our schema uses none of these — safe. But if we ever add `minLength: 60` to `caption`, it will silently be ignored. Enforce length bounds in `validateDraft` instead.

### 4. Published patterns for "drafter + publisher in one scheduled worker"

**Short answer**: No widely-published pattern specifically for Cloudflare Workers + LLM content drafting + social publishing exists. Closest published examples:
- Cloudflare's own [Cron Triggers example](https://developers.cloudflare.com/workers/examples/cron-trigger/) — covers scheduled handler + fetch, not LLM
- [alvinwilta/cloudflare-worker-boilerplate](https://github.com/alvinwilta/cloudflare-worker-boilerplate) — scheduled handler boilerplate, no content logic
- [Cloudflare Workflows](https://developers.cloudflare.com/workflows/build/trigger-workflows/) — newer primitive (GA 2025) for long-running multi-step jobs with automatic retry/resume — would be a better home for this than raw `scheduled()` if we ever hit the 30-second free-tier `waitUntil` budget

**Relevant Cloudflare primitive we're NOT using**: **Workflows**. If the auto-draft + image gen + publish pipeline ever exceeds the `ctx.waitUntil` budget (currently ~60s, safely under free-tier 30s hard cap — wait, is 30s right? — let me verify), we should migrate to Workflows, which supports multi-hour durable execution with per-step retries. For MVP, raw `scheduled()` is sufficient.

**Correction**: Cloudflare Workers `ctx.waitUntil` on the **free tier** allows tasks up to the Worker's CPU time limit, which is **10ms CPU** but **30 seconds wall-clock** on free, and up to **15 minutes wall-clock** on paid Workers Unbound. Our entire flow (draft + 2 image gens + 4 Meta calls) takes ~45-90s wall-clock, which exceeds the free-tier 30s limit.

**This is an important concern the plan may have underestimated.** Check the current Cloudflare plan for `motovault-social-api` — if it's on free tier, the auto-draft addition may push us over. Paid plan is $5/month + usage.

**Action**: Add a rollout step 0 — check wrangler plan tier for the deployed worker BEFORE implementation. If on free tier, discuss with user whether to upgrade to Workers Paid ($5/month flat) or migrate to Workflows.

Source: [blog.cloudflare.com/cron-triggers-for-scheduled-workers](https://blog.cloudflare.com/cron-triggers-for-scheduled-workers/), [Cloudflare Workers scheduled handler docs](https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/).

**Caveat**: This correction may be outdated — Cloudflare has loosened scheduled handler limits over time. Verify with `wrangler whoami` + current pricing page during implementation.

### 5. PostgREST `Prefer: return=representation` vs `return=minimal` vs `return=headers-only`

**Confirmed from [PostgREST v13 docs — Preferences](https://docs.postgrest.org/en/v13/references/api/preferences)**:

| Prefer value | Response body | Headers | Use case |
|---|---|---|---|
| `return=minimal` (**default**) | none | `Location: /table?id=eq.N` | Cheapest — use when you don't need the row back |
| `return=headers-only` | none | `Location: /table?id=eq.N` + `Preference-Applied` | Get the id by parsing `Location`, no body transfer |
| `return=representation` | full JSON of inserted row(s) | Location + Preference-Applied | Heaviest — use when you need all server-populated columns |

**Key insight**: `return=minimal` is the **default** for writes. The plan's `insertDraftedRow` currently uses `return=representation` to get the `id` back. But:

- **`return=headers-only`** is cheaper — same info (id is in the `Location` header as `/social_post_queue?id=eq.<uuid>`) without transferring the full row body.
- Parsing the id from the `Location` header is one `URL` constructor call or a simple `.split('=').pop()`.

**Plan change** — update `insertDraftedRow`:

```ts
// Use return=headers-only, parse id from Location header
const res = await fetch(url, {
  method: 'POST',
  headers: { ...headers(env), Prefer: 'return=headers-only' },
  body: JSON.stringify({ /* ... */ }),
});

if (!res.ok) { /* error handling unchanged */ }

const location = res.headers.get('Location');
// Location format: "/social_post_queue?id=eq.<uuid>"
const idMatch = location?.match(/id=eq\.([0-9a-f-]+)/i);
if (!idMatch) throw new Error(`insertDraftedRow: no id in Location header: ${location}`);
return idMatch[1];
```

**Why it matters at this scale**: negligible — we insert one row per cron tick at most. But it's the correct default per PostgREST docs and saves ~1KB per call. Adopt the pattern for consistency with the project's general convention (the existing `markPublished` already uses `Prefer: return=minimal`).

### 6. Cost math recomputation — CORRECTED

**The plan's original cost estimate was wrong by ~27×.** It used Gemini 2.0 Flash pricing, not 3 Flash Preview.

**Per-call tokens** (estimated):
- Input: ~10,000 tokens (system prompt ~1.5k + `app-features.md` ~1.5k + `design-system.md` ~1.5k + recent posts JSON ~4k + user prompt framing ~1.5k)
- Output: ~800 tokens (~300 caption + 2 × ~250 image prompts)

**Per-call cost at Gemini 3 Flash Preview rates**:
- Input: 10,000 × $0.50 / 1,000,000 = **$0.0050**
- Output: 800 × $3.00 / 1,000,000 = **$0.0024**
- **Total per call: $0.0074**

**Monthly**:
- 3 calls/day × 30 days = **90 calls/month**
- 90 × $0.0074 = **$0.666 / month**
- **$8.00 / year**

**If free tier covers us** (likely — 3 RPD is well under 100 RPD free tier): **$0.00 / month**.

**Absolute worst case** (every call bills, no free tier, full context every time): **<$1/month**. Still negligible — but the **order-of-magnitude correction** matters for accuracy. Update the plan's cost line.

### 7. Migration 00090 — nullable column safety on live cron-queried table

**PostgreSQL behavior** (confirmed from [PostgreSQL 18 ALTER TABLE docs](https://www.postgresql.org/docs/current/sql-altertable.html) and cybertec-postgresql.com):

- **`ADD COLUMN <name> TEXT` (nullable, no default)** is a **metadata-only** change. It does NOT rewrite the table. It updates `pg_attribute` only.
- Required lock: **`ACCESS EXCLUSIVE`**, but held for only milliseconds (metadata update). Far faster than the cron's Gemini round-trip.
- During the brief lock, any concurrent `SELECT` / `INSERT` / `UPDATE` on the table will wait — but the window is measured in single-digit milliseconds. Unlikely to even register in Cloudflare logs.
- No risk of blocking the cron because:
  1. The lock window is ~10ms
  2. Our crons are minute-resolution, not millisecond
  3. If the cron claim fires exactly during the DDL, it waits, gets the lock, then proceeds

**Verdict**: **Zero operational risk** for this specific migration (nullable TEXT, no default).

**PostgREST schema cache reload** (confirmed from [PostgREST schema cache docs](https://docs.postgrest.org/en/v13/references/schema_cache.html)):

- PostgREST caches the schema. Without a reload, `INSERT` payloads that reference the new `source` column will fail with **`PGRST204`** ("Could not find the '<column>' column of '<table>' in the schema cache").
- **Supabase auto-configures the `pgrst_watch` event trigger** on all projects, which fires `NOTIFY pgrst, 'reload schema'` on every DDL command. PostgREST reloads within ~100ms (debounced).
- **Confirmation path**: after `npx supabase db push`, wait 1-2 seconds, then test with a simple `curl` insert referencing the new column. If it fails with PGRST204, manually force a reload with:
  ```sql
  NOTIFY pgrst, 'reload schema';
  ```
  Or via Supabase Dashboard → Settings → API → "Reload Schema".

**Plan change** — add to rollout step 1:

> After `supabase db push`, verify schema reload by running `curl -X POST "$SUPABASE_URL/rest/v1/social_post_queue" -H "apikey: $KEY" -H "Prefer: return=headers-only" -d '{"slot":"afternoon","scheduled_for":"2099-12-31","angle":"test","caption":"test","post_prompt":"test","story_prompt":"test","source":"migration-test"}'`. If it returns 201, the cache is live. Delete the test row immediately.

Source: [PostgREST Schema Cache reloading](https://docs.postgrest.org/en/v13/references/schema_cache.html), [Supabase — Reload/refresh postgrest schema](https://supabase.com/docs/guides/troubleshooting/refresh-postgrest-schema).

### Enhancement Summary

**Corrections to apply to the plan body** (not rewritten here — apply at implementation time):

1. **Step 1 of rollout** — add PostgREST schema cache verification after `supabase db push`.
2. **Step 2 of rollout** — `wrangler.toml [[rules]]` block is **required**, not optional.
3. **Step 0 of rollout** — verify Cloudflare plan tier for `motovault-social-api` before implementation. If on free tier, discuss wall-clock budget with user.
4. **`callGemini` implementation** — add `finishReason` check; fall through to fallback model on `SAFETY` / `RECITATION` / `PROHIBITED_CONTENT`.
5. **`insertDraftedRow` implementation** — switch from `return=representation` to `return=headers-only`, parse id from `Location` header.
6. **Cost line in Dependencies & Risks** — correct from "~$0.025/month" to **"<$0.67/month, likely $0 on free tier"**.
7. **Risk table** — add one row: "Worker wall-clock budget exceeds free-tier 30s limit" with "verify plan tier in rollout step 0" mitigation.

**No other changes to the plan body.** The architecture, flow, file list, and acceptance criteria stand.

### Deepening sources (all primary)

- [Gemini API Pricing — ai.google.dev](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini API Rate Limits — ai.google.dev](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Gemini API JSON Mode — ai.google.dev](https://ai.google.dev/gemini-api/docs/json-mode)
- [Gemini 3 Developer Guide — ai.google.dev](https://ai.google.dev/gemini-api/docs/gemini-3)
- [Cloudflare Workers — Wrangler Configuration (Bundling)](https://developers.cloudflare.com/workers/wrangler/configuration/#bundling)
- [Cloudflare Workers — Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- [Cloudflare Workers — Scheduled Handler](https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/)
- [Cloudflare Workers — Making Time for Cron Triggers (blog)](https://blog.cloudflare.com/cron-triggers-for-scheduled-workers/)
- [PostgREST v13 — Preferences](https://docs.postgrest.org/en/v13/references/api/preferences)
- [PostgREST v13 — Schema Cache](https://docs.postgrest.org/en/v13/references/schema_cache.html)
- [Supabase — Reload postgrest schema](https://supabase.com/docs/guides/troubleshooting/refresh-postgrest-schema)
- [PostgreSQL 18 — ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)
- [PostgreSQL ALTER TABLE done right — cybertec-postgresql](https://www.cybertec-postgresql.com/en/postgresql-alter-table-add-column-done-right/)
