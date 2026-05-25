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
import {
  generateImage,
  generatePhoneMockup,
  publishCarousel,
  publishPost,
  publishStory,
  uint8ArrayToBase64,
} from './publish';
import {
  claimNextPost,
  getRecentAngles,
  hasSlotServedToday,
  insertDraftedRow,
  markFailed,
  markPublished,
  type SlotName,
} from './queue';
import { SCREENSHOT_CATALOG } from './screenshots';

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
    // Guard: if this slot already published today (e.g. a manual /run-slot
    // fired earlier), don't auto-draft a duplicate. The DB unique index
    // (migration 00134) is the hard safety net; this is the cheap early exit.
    const alreadyServed = await hasSlotServedToday(env, slot);
    if (alreadyServed) {
      console.log(`[scheduled] slot=${slot} — already served today, skipping auto-draft`);
      return;
    }

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
      // Log a structured JSON line so Cloudflare's log filtering can alert
      // on repeated auto-draft failures (the "observability gap" — no row
      // exists to markFailed, so failures were previously invisible outside
      // of wrangler tail).
      console.error(
        JSON.stringify({
          event: 'autodraft_failed',
          slot,
          cron,
          error: message.slice(0, 500),
          timestamp: new Date().toISOString(),
        }),
      );
      return;
    }
  }

  console.log(`[scheduled] slot=${slot} id=${row.id} angle=${row.angle} attempt=${row.attempts}`);

  try {
    // Step 2a: fetch real app screenshots and composite them into phone mockups.
    // Each screenshot is sent to Gemini to generate a polished 4:5 marketing
    // image showing the screenshot on a phone mockup against a dark background.
    const screenshotBase64: string[] = [];
    if (row.screenshot_keys?.length) {
      console.log(
        `[scheduled] id=${row.id} generating ${row.screenshot_keys.length} phone mockup(s): ${row.screenshot_keys.join(', ')}`,
      );
      const fetched = await Promise.all(
        row.screenshot_keys.map(async (key) => {
          const entry = SCREENSHOT_CATALOG[key];
          if (!entry) {
            console.warn(`[scheduled] id=${row.id} unknown screenshot key "${key}" — skipping`);
            return null;
          }
          try {
            // Fetch the raw screenshot from Supabase Storage
            const screenshotUrl = `${env.SUPABASE_URL}/storage/v1/object/public/social-media/${entry.storagePath}`;
            const res = await fetch(screenshotUrl);
            if (!res.ok) {
              console.warn(
                `[scheduled] id=${row.id} screenshot "${key}" fetch failed (${res.status})`,
              );
              return null;
            }
            const rawBase64 = uint8ArrayToBase64(new Uint8Array(await res.arrayBuffer()));

            // Composite into a phone mockup via Gemini
            const mockupBase64 = await generatePhoneMockup(env, rawBase64);
            console.log(`[scheduled] id=${row.id} mockup ready for "${key}"`);
            return mockupBase64;
          } catch (err) {
            console.warn(
              `[scheduled] id=${row.id} mockup "${key}" failed: ${err instanceof Error ? err.message : err}`,
            );
            return null;
          }
        }),
      );
      for (const b64 of fetched) {
        if (b64) screenshotBase64.push(b64);
      }
      console.log(
        `[scheduled] id=${row.id} ${screenshotBase64.length} mockup(s) ready for carousel`,
      );
    }

    // Step 2b: generate ONE atmospheric image at 9:16. When screenshots exist
    // the prompt instructs Gemini to produce a purely atmospheric scene (no
    // phone/UI). The 9:16 is reused for both post + story — publishPost
    // center-crops to 4:5, publishStory uses 9:16 as-is.
    const image = await generateImage(env, row.story_prompt, '9:16');

    console.log(`[scheduled] id=${row.id} image ready (engine=${image.engine})`);

    // Steps 3–4: publish. Platform-specific captions via the captions map —
    // a single call uploads the image once and publishes to both platforms in
    // parallel. When facebook_caption is null (e.g. manually-seeded rows),
    // fall back to the shared caption for both platforms.
    const captions = {
      instagram: row.caption,
      facebook: row.facebook_caption ?? row.caption,
    };

    let postOutcome: { image_url: string; results: import('./queue').PostResults };
    if (screenshotBase64.length > 0) {
      const carouselImages = [image.image_base64, ...screenshotBase64];
      console.log(`[scheduled] id=${row.id} publishing carousel (${carouselImages.length} slides)`);

      const result = await publishCarousel(env, {
        images_base64: carouselImages,
        captions,
      });
      postOutcome = { image_url: result.image_urls[0], results: result.results };
    } else {
      const result = await publishPost(env, {
        image_base64: image.image_base64,
        captions,
      });
      postOutcome = result;
    }

    // Stories have no caption, so no platform-specific text needed — single
    // 'both' call with link sticker for app store taps.
    const storyOutcome = await publishStory(env, {
      image_base64: image.image_base64,
      platform: 'both',
      link: 'https://motovault.app/download',
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
