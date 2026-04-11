/**
 * social_post_queue client.
 *
 * All calls use the service-role key to bypass RLS. Never expose these
 * functions over HTTP without auth.
 */
import type { Env } from './env';

export type SlotName = 'afternoon' | 'evening' | 'night-americas';
export type QueueStatus = 'ready' | 'publishing' | 'published' | 'failed' | 'skipped';

export interface QueueRow {
  id: string;
  slot: SlotName;
  scheduled_for: string; // ISO date (YYYY-MM-DD)
  angle: string;
  caption: string;
  post_prompt: string;
  story_prompt: string;
  status: QueueStatus;
  attempts: number;
  last_attempt_at: string | null;
  published_at: string | null;
  post_image_url: string | null;
  story_image_url: string | null;
  post_results: unknown;
  story_results: unknown;
  error: string | null;
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
  post_results: unknown;
  story_results: unknown;
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
