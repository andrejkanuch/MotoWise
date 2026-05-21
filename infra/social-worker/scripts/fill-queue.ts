#!/usr/bin/env tsx
/**
 * fill-queue.ts — seed social_post_queue with upcoming posts.
 *
 * Run locally (NOT from a Claude sandbox). Requires env vars:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   pnpm --filter @motovault/social-worker fill-queue posts.json
 *   # or from repo root:
 *   tsx infra/social-worker/scripts/fill-queue.ts posts.json
 *
 * posts.json format (array of PostInput):
 * [
 *   {
 *     "slot": "afternoon" | "evening" | "night-americas",
 *     "scheduled_for": "2026-04-12",
 *     "angle": "health-score",
 *     "caption": "Your bike has a grade. A, B, C, D, or F...",
 *     "post_prompt": "Photorealistic sport motorcycle on Nevada highway...",
 *     "story_prompt": "Vertical cinematic shot..."
 *   }
 * ]
 *
 * Existing rows with the same (slot, scheduled_for) are replaced — this makes
 * the script idempotent and safe to re-run after edits.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface PostInput {
  slot: 'afternoon' | 'evening' | 'night-americas';
  scheduled_for: string; // YYYY-MM-DD
  angle: string;
  caption: string;
  facebook_caption?: string; // FB-tailored caption (falls back to caption if omitted)
  post_prompt: string;
  story_prompt: string;
  screenshot_keys?: string[]; // optional screenshot catalog keys
}

const SLOTS = new Set(['afternoon', 'evening', 'night-americas']);

function die(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function validate(input: unknown, index: number): PostInput {
  if (typeof input !== 'object' || input === null) {
    die(`posts[${index}] is not an object`);
  }
  const p = input as Record<string, unknown>;
  const requiredStrings = [
    'slot',
    'scheduled_for',
    'angle',
    'caption',
    'post_prompt',
    'story_prompt',
  ];
  for (const key of requiredStrings) {
    if (typeof p[key] !== 'string' || (p[key] as string).length === 0) {
      die(`posts[${index}].${key} must be a non-empty string`);
    }
  }
  if (!SLOTS.has(p.slot as string)) {
    die(`posts[${index}].slot must be one of: afternoon, evening, night-americas`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.scheduled_for as string)) {
    die(`posts[${index}].scheduled_for must be YYYY-MM-DD`);
  }
  return p as unknown as PostInput;
}

async function main(): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    die('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in env');
  }

  const filePath = process.argv[2];
  if (!filePath) {
    die('Usage: fill-queue.ts <posts.json>');
  }

  const absPath = resolve(process.cwd(), filePath);
  let raw: string;
  try {
    raw = readFileSync(absPath, 'utf8');
  } catch (err) {
    die(`Cannot read ${absPath}: ${(err as Error).message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    die(`Invalid JSON in ${absPath}: ${(err as Error).message}`);
  }

  if (!Array.isArray(parsed)) {
    die('posts.json must be a JSON array');
  }

  const posts = parsed.map((p, i) => validate(p, i));
  console.log(`→ Seeding ${posts.length} post(s) into social_post_queue`);

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };

  // Delete existing 'ready' rows for the same (slot, scheduled_for) so this
  // script is idempotent. We only touch 'ready' — never overwrite rows that
  // are publishing/published/failed (those are audit trail).
  for (const p of posts) {
    const deleteUrl =
      `${supabaseUrl}/rest/v1/social_post_queue` +
      `?slot=eq.${encodeURIComponent(p.slot)}` +
      `&scheduled_for=eq.${encodeURIComponent(p.scheduled_for)}` +
      `&status=eq.ready`;
    const res = await fetch(deleteUrl, { method: 'DELETE', headers });
    if (!res.ok && res.status !== 404) {
      const body = await res.text();
      die(`Failed to clear existing ready row for ${p.slot}@${p.scheduled_for}: ${body}`);
    }
  }

  // Insert all posts in a single batch.
  const insertUrl = `${supabaseUrl}/rest/v1/social_post_queue`;
  const res = await fetch(insertUrl, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify(
      posts.map((p) => ({
        slot: p.slot,
        scheduled_for: p.scheduled_for,
        angle: p.angle,
        caption: p.caption,
        facebook_caption: p.facebook_caption ?? null,
        post_prompt: p.post_prompt,
        story_prompt: p.story_prompt,
        screenshot_keys: p.screenshot_keys?.length ? p.screenshot_keys : null,
        status: 'ready',
      })),
    ),
  });

  if (!res.ok) {
    const body = await res.text();
    die(`Insert failed (${res.status}): ${body}`);
  }

  const inserted = (await res.json()) as Array<{
    id: string;
    slot: string;
    scheduled_for: string;
    angle: string;
  }>;
  for (const row of inserted) {
    console.log(`  ✓ ${row.scheduled_for}  ${row.slot.padEnd(15)}  ${row.angle}  (${row.id})`);
  }
  console.log(`\n✓ Queued ${inserted.length} post(s)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
