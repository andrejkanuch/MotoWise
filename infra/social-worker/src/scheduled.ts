/**
 * Cron-triggered publishing pipeline.
 *
 * Flow per slot:
 *   1. claim_next_social_post(slot)        → atomic pop from queue
 *   2. generateImage(post_prompt,  4:5)    → Gemini
 *   3. generateImage(story_prompt, 9:16)   → Gemini
 *   4. publishPost({ image, caption })     → Meta (FB + IG)
 *   5. publishStory({ image })             → Meta (FB + IG)
 *   6. markPublished(id, ...)              → queue row → 'published'
 *
 * Any failure in 2–5 calls markFailed which either retries (attempts < 3) or
 * parks the row as 'failed' for manual review.
 */
import type { Env } from './env';
import { generateImage, publishPost, publishStory } from './publish';
import { claimNextPost, markFailed, markPublished, type SlotName } from './queue';

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

  const row = await claimNextPost(env, slot);
  if (!row) {
    console.warn(`[scheduled] slot=${slot} — queue is empty, nothing to publish`);
    return;
  }

  console.log(`[scheduled] slot=${slot} id=${row.id} angle=${row.angle} attempt=${row.attempts}`);

  try {
    // Steps 2–3: generate both images in parallel.
    const [postImage, storyImage] = await Promise.all([
      generateImage(env, row.post_prompt, '4:5'),
      generateImage(env, row.story_prompt, '9:16'),
    ]);

    console.log(
      `[scheduled] id=${row.id} images ready (post=${postImage.engine}, story=${storyImage.engine})`,
    );

    // Steps 4–5: publish sequentially so a story failure doesn't orphan a
    // successful post and vice versa — easier to reason about on retry.
    const postOutcome = await publishPost(env, {
      image_base64: postImage.image_base64,
      caption: row.caption,
      platform: 'both',
    });

    const storyOutcome = await publishStory(env, {
      image_base64: storyImage.image_base64,
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
