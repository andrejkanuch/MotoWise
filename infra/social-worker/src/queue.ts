/**
 * social_post_queue client.
 *
 * All calls use the service-role key to bypass RLS. Never expose these
 * functions over HTTP without auth.
 */
import type { Env } from './env';

export type SlotName = 'afternoon' | 'evening' | 'night-americas';
export type QueueStatus = 'ready' | 'publishing' | 'published' | 'failed' | 'skipped';

/** Shared type for platform publish results — used by QueueRow, MarkPublishedInput, and scraper. */
export interface PostResults {
  facebook?: { post_id?: string; success: boolean; error?: unknown };
  instagram?: { media_id?: string; story_id?: string; success: boolean; error?: unknown };
}

export interface QueueRow {
  id: string;
  slot: SlotName;
  scheduled_for: string; // ISO date (YYYY-MM-DD)
  angle: string;
  caption: string;
  facebook_caption: string | null;
  post_prompt: string;
  story_prompt: string;
  status: QueueStatus;
  attempts: number;
  last_attempt_at: string | null;
  published_at: string | null;
  post_image_url: string | null;
  story_image_url: string | null;
  post_results: PostResults | null;
  story_results: PostResults | null;
  error: string | null;
  source: string | null; // 'manual' | 'gemini-autodraft' | null (migration 00090)
  screenshot_keys: string[] | null; // screenshot catalog keys (migration 00104)
  created_at: string;
  updated_at: string;
}

function headers(env: Env): Record<string, string> {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Atomically pop the next ready row for a slot. Delegates to the
 * `claim_next_social_post` PL/pgSQL function (SELECT + UPDATE in one
 * transaction with FOR UPDATE SKIP LOCKED).
 *
 * Returns null if nothing is ready.
 */
export async function claimNextPost(env: Env, slot: SlotName): Promise<QueueRow | null> {
  const url = `${env.SUPABASE_URL}/rest/v1/rpc/claim_next_social_post`;
  const res = await fetch(url, {
    method: 'POST',
    headers: headers(env),
    body: JSON.stringify({ p_slot: slot }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`claim_next_social_post failed (${res.status}): ${body}`);
  }

  // PostgREST serializes a NULL composite-type return as an object with all
  // fields set to null (NOT as JSON `null`). Detect the empty-queue case by
  // checking whether the primary key is null.
  const data = (await res.json()) as (QueueRow & { id: string | null }) | null;
  if (data === null || data.id === null) {
    return null;
  }
  return data as QueueRow;
}

export interface MarkPublishedInput {
  post_image_url: string;
  story_image_url: string;
  post_results: PostResults;
  story_results: PostResults;
}

export async function markPublished(
  env: Env,
  id: string,
  input: MarkPublishedInput,
): Promise<void> {
  const url = `${env.SUPABASE_URL}/rest/v1/social_post_queue?id=eq.${id}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { ...headers(env), Prefer: 'return=minimal' },
    body: JSON.stringify({
      status: 'published',
      published_at: new Date().toISOString(),
      post_image_url: input.post_image_url,
      story_image_url: input.story_image_url,
      post_results: input.post_results,
      story_results: input.story_results,
      error: null,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`markPublished failed (${res.status}): ${body}`);
  }
}

export async function markFailed(env: Env, id: string, error: string): Promise<void> {
  const url = `${env.SUPABASE_URL}/rest/v1/social_post_queue?id=eq.${id}`;
  // Reset to 'ready' so the next cron can retry — unless we've already burned
  // 3 attempts, in which case leave it as 'failed' for manual review.
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { ...headers(env), Prefer: 'return=representation' },
    body: JSON.stringify({ status: 'failed', error: error.slice(0, 2000) }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`markFailed failed (${res.status}): ${body}`);
  }

  // Re-open for retry if under the attempts threshold.
  const rows = (await res.json()) as Array<{ attempts: number }>;
  const attempts = rows[0]?.attempts ?? 99;
  if (attempts < 3) {
    await fetch(url, {
      method: 'PATCH',
      headers: { ...headers(env), Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'ready' }),
    });
  }
}

/**
 * Return the `angle` strings from rows scheduled within the last N days
 * (any status). Used by the Gemini drafter to avoid repeating recent
 * themes when the queue is empty and a fresh post needs to be drafted.
 */
export async function getRecentAngles(env: Env, days = 5): Promise<string[]> {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  const url =
    `${env.SUPABASE_URL}/rest/v1/social_post_queue` +
    `?select=angle` +
    `&scheduled_for=gte.${cutoffDate}` +
    `&order=scheduled_for.desc`;

  const res = await fetch(url, { headers: headers(env) });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`getRecentAngles failed (${res.status}): ${body}`);
  }
  const rows = (await res.json()) as Array<{ angle: string | null }>;
  // Dedupe while preserving order — the most recent instance of each angle wins.
  const seen = new Set<string>();
  const result: string[] = [];
  for (const row of rows) {
    if (row.angle && !seen.has(row.angle)) {
      seen.add(row.angle);
      result.push(row.angle);
    }
  }
  return result;
}

/**
 * Insert a Gemini-drafted row into social_post_queue with status='ready'
 * and source='gemini-autodraft'. Returns the inserted row id.
 *
 * Uses `Prefer: return=headers-only` so PostgREST sends back the id via
 * the `Location` header without transferring the full row body. Cheaper
 * than return=representation for a single-id read.
 *
 * The row is inserted as 'ready' so the very next `claim_next_social_post`
 * call can atomically pop it — keeping attempts/last_attempt_at on the
 * same canonical update path as a manually-seeded row.
 */
export async function insertDraftedRow(
  env: Env,
  slot: SlotName,
  draft: {
    angle: string;
    caption: string;
    facebookCaption: string;
    postPrompt: string;
    storyPrompt: string;
    screenshotKeys?: string[];
  },
): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const url = `${env.SUPABASE_URL}/rest/v1/social_post_queue`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { ...headers(env), Prefer: 'return=headers-only' },
    body: JSON.stringify({
      slot,
      scheduled_for: today,
      angle: draft.angle,
      caption: draft.caption,
      facebook_caption: draft.facebookCaption,
      post_prompt: draft.postPrompt,
      story_prompt: draft.storyPrompt,
      screenshot_keys: draft.screenshotKeys?.length ? draft.screenshotKeys : null,
      status: 'ready',
      source: 'gemini-autodraft',
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`insertDraftedRow failed (${res.status}): ${body}`);
  }

  // PostgREST sets Location: /social_post_queue?id=eq.<uuid>
  const location = res.headers.get('Location') ?? res.headers.get('location');
  if (!location) {
    throw new Error('insertDraftedRow: no Location header in response');
  }
  const match = location.match(/id=eq\.([0-9a-f-]+)/i);
  if (!match) {
    throw new Error(`insertDraftedRow: could not parse id from Location: ${location}`);
  }
  return match[1];
}
