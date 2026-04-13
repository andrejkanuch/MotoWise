/**
 * Cron-triggered publishing pipeline.
 *
 * Flow per slot:
 *   1. claim_next_social_post(slot)        → atomic pop from queue
 *   1a. (if empty) draftPost() via Gemini  → insert as 'ready' → re-claim
 *   2. generateImage(post_prompt,  4:5)    → Gemini
 *   3. generateImage(story_prompt, 9:16)   → Gemini
 *   4. publishPost({ image, caption })     → Meta (FB + IG)
 *   5. publishStory({ image })             → Meta (FB + IG)
 *   6. markPublished(id, ...)              → queue row → 'published'
 *
 * Step 1a is the Gemini auto-draft branch added alongside migration 00090.
 * When the queue has no ready row for the current slot, the Worker drafts
 * one inline via gemini-3-flash-preview, inserts it with status='ready'
 * and source='gemini-autodraft', then re-enters the exact same claim +
 * publish path a manually-seeded row would take. The fill-queue.ts manual-
 * override pathway remains the preferred way to queue specific posts —
 * auto-draft only runs when nothing is queued.
 *
 * Any failure in 2–5 calls markFailed which either retries (attempts < 3) or
 * parks the row as 'failed' for manual review. Failures in step 1a (Gemini
 * draft / insert / re-claim) are logged and the cron exits — next tick will
 * retry. There's no row to markFailed at that point.
 */
import { draftPost } from './draft';
import type { Env } from './env';
import { generateImage, publishPost, publishStory } from './publish';
import {
  claimNextPost,
  getRecentAngles,
  insertDraftedRow,
  markFailed,
  markPublished,
  type SlotName,
} from './queue';

export const CRON_TO_SLOT: Record<string, SlotName> = {
  '0 14 * * *': 'afternoon',
  '0 19 * * *': 'evening',
  '0 0 * * *': 'night-americas',
};

export async function runScheduledPost(env: Env, cron: string): Promise<void> {
  const slot = CRON_TO_SLOT[cron];
  if (!slot) {
    console.error(`[scheduled] unrecognized cron: "${cron}"`);
    return;
  }

  console.log(`[scheduled] slot=${slot} cron=${cron} — claiming next post`);

  let row = await claimNextPost(env, slot);

  // Auto-draft branch: if the queue is empty for this slot, ask Gemini to
  // draft a fresh post, insert it as 'ready', then re-claim via the same
  // RPC so attempts/last_attempt_at stay on the canonical update path.
  if (!row) {
    console.log(`[scheduled] slot=${slot} — queue empty, auto-drafting via Gemini`);
    try {
      const recentAngles = await getRecentAngles(env, 5);
      console.log(`[scheduled] slot=${slot} avoiding ${recentAngles.length} recent angles`);

      const draft = await draftPost(env, slot, recentAngles);
      console.log(
        `[scheduled] slot=${slot} draft ready angle="${draft.angle}" caption_len=${draft.caption.length}`,
      );

      const insertedId = await insertDraftedRow(env, slot, draft);
      console.log(`[scheduled] slot=${slot} inserted row id=${insertedId}`);

      row = await claimNextPost(env, slot);
      if (!row) {
        // Benign concurrency case: a parallel cron tick or manual /run-slot
        // claimed the row we just inserted before we could re-claim it. That
        // other invocation will handle the publish — we exit cleanly. Not an
        // error. If this log ever fires unexpectedly and the row isn't
        // published by another path, check for RLS drift or schema-cache
        // staleness on social_post_queue.
        console.log(
          `[scheduled] slot=${slot} — drafted row already claimed by another run (id=${insertedId})`,
        );
        return;
      }
    } catch (err) {
      const message = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
      console.error(`[scheduled] slot=${slot} auto-draft failed: ${message}`);
      // No row exists to markFailed. Next cron tick will retry. If Gemini is
      // persistently broken this shows up as a cadence gap — observable via
      // missing posts on IG/FB and via wrangler tail.
      return;
    }
  }

  console.log(`[scheduled] slot=${slot} id=${row.id} angle=${row.angle} attempt=${row.attempts}`);

  try {
    // Step 2: generate ONE image at 9:16 and reuse for both post + story.
    // publishPost renders it as 1080x1350 (4:5 center-crop via Supabase
    // Storage /render), publishStory renders it as 1080x1920 (9:16, near
    // exact). This halves Gemini image-gen credits per publish cycle.
    // The story_prompt is used because 9:16 is the taller format — cropping
    // down to 4:5 works cleanly, while scaling up from 4:5 to 9:16 would
    // require upscaling (which Supabase render does NOT do).
    const image = await generateImage(env, row.story_prompt, '9:16');

    console.log(`[scheduled] id=${row.id} image ready (engine=${image.engine})`);

    // Steps 3–4: publish sequentially so a story failure doesn't orphan a
    // successful post and vice versa — easier to reason about on retry.
    const postOutcome = await publishPost(env, {
      image_base64: image.image_base64,
      caption: row.caption,
      platform: 'both',
    });

    const storyOutcome = await publishStory(env, {
      image_base64: image.image_base64,
      platform: 'both',
    });

    await markPublished(env, row.id, {
      post_image_url: postOutcome.image_url,
      story_image_url: storyOutcome.image_url,
      post_results: postOutcome.results,
      story_results: storyOutcome.results,
    });

    console.log(`[scheduled] id=${row.id} PUBLISHED`);
  } catch (err) {
    const message = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
    console.error(`[scheduled] id=${row.id} FAILED: ${message}`);
    try {
      await markFailed(env, row.id, message);
    } catch (markErr) {
      console.error(`[scheduled] id=${row.id} markFailed also failed:`, markErr);
    }
  }
}
