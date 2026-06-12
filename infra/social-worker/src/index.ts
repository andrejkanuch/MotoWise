/**
 * MotoVault Social API — Cloudflare Worker
 *
 * Proxies Meta Graph API + Gemini image generation with secrets stored
 * server-side AND runs the scheduled publishing pipeline via cron triggers.
 *
 * HTTP endpoints (all require X-Auth-Key: $WORKER_AUTH_KEY):
 *   GET  /health          — health check
 *   POST /publish-post     — publish photo to IG + FB
 *   POST /publish-carousel — publish multi-image album (2–10 slides) to IG + FB
 *   POST /publish-story    — publish story to IG + FB
 *   POST /generate-image   — generate image via Gemini
 *
 * Cron triggers (defined in wrangler.toml):
 *   0 14 * * *   — afternoon slot
 *   0 19 * * *   — evening slot
 *   0 0  * * *   — night-americas slot
 *
 * Both entrypoints share the same core functions in publish.ts.
 */
import { z } from 'zod';
import { draftPost } from './draft';
import type { Env } from './env';
import { createJob, getJob, updateJob } from './jobs';
import {
  type AspectRatio,
  base64ToUint8Array,
  composeShowcaseImage,
  generateImage,
  generatePhoneMockup,
  headlineOverlay,
  publishCarousel,
  publishPost,
  publishStory,
  uint8ArrayToBase64,
  uploadToSupabase,
} from './publish';
import { getRecentAngles, type SlotName } from './queue';
import { CRON_TO_SLOT, runScheduledPost } from './scheduled';
import { BRAND_ICON_STORAGE_PATH, fetchBucketBytes, SCREENSHOT_CATALOG } from './screenshots';

/** Constant-time string comparison to prevent timing attacks on auth keys. */
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBuf = enc.encode(a);
  const bBuf = enc.encode(b);
  if (aBuf.byteLength !== bBuf.byteLength) return false;
  return crypto.subtle.timingSafeEqual(aBuf, bBuf);
}

// -- Zod schemas for HTTP endpoint validation (P2-8) --------------------------

const publishPostSchema = z.object({
  image_base64: z.string().min(1).max(20_000_000),
  caption: z.string().min(1).max(2200),
  platform: z.enum(['instagram', 'facebook', 'both']).optional(),
});

const publishCarouselSchema = z.object({
  images_base64: z.array(z.string().min(1).max(20_000_000)).min(2).max(10),
  caption: z.string().min(1).max(2200),
  platform: z.enum(['instagram', 'facebook', 'both']).optional(),
});

const publishStorySchema = z.object({
  image_base64: z.string().min(1).max(20_000_000),
  platform: z.enum(['instagram', 'facebook', 'both']).optional(),
});

const generateImageSchema = z.object({
  prompt: z.string().min(1).max(2000),
  aspect_ratio: z.enum(['4:5', '9:16', '1:1']).optional(),
});

const publishNowSchema = z.object({
  topic: z.string().min(1).max(500),
  caption: z.string().min(1).max(2200).optional(),
  facebook_caption: z.string().min(1).max(2200).optional(),
  image_prompt: z.string().min(1).max(2000).optional(),
  platform: z.enum(['instagram', 'facebook', 'both']).optional(),
});

export default {
  // -------------------------------------------------------------------------
  // HTTP entrypoint
  // -------------------------------------------------------------------------
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const authKey = request.headers.get('X-Auth-Key') ?? '';
    if (!timingSafeEqual(authKey, env.WORKER_AUTH_KEY)) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const url = new URL(request.url);

    try {
      switch (url.pathname) {
        case '/health':
          return json({ ok: true, service: 'motovault-social-api' });

        case '/publish-post': {
          const body = publishPostSchema.parse(await request.json());
          const result = await publishPost(env, body);
          return json(result);
        }

        case '/publish-carousel': {
          const body = publishCarouselSchema.parse(await request.json());
          const result = await publishCarousel(env, body);
          return json(result);
        }

        case '/publish-story': {
          const body = publishStorySchema.parse(await request.json());
          const result = await publishStory(env, body);
          return json(result);
        }

        case '/generate-image': {
          const body = generateImageSchema.parse(await request.json());
          const result = await generateImage(
            env,
            body.prompt,
            body.aspect_ratio as AspectRatio | undefined,
          );
          return json(result);
        }

        case '/run-slot': {
          // Manually invoke the scheduled publishing pipeline for a given
          // slot. Uses the exact same code path as the cron trigger — claims
          // the next queued row, generates images, publishes, marks done.
          // Useful for retries and end-to-end testing without waiting for the
          // next cron tick.
          //
          // Optional ?dry-run=1 generates a Gemini draft for the slot WITHOUT
          // inserting, claiming, or publishing. Returns the drafted payload
          // so prompts can be tuned against live API responses without
          // burning Meta posts. Zero-cost smoke test.
          const slot = url.searchParams.get('slot');
          const dryRun = url.searchParams.get('dry-run') === '1';
          const cron = Object.entries(CRON_TO_SLOT).find(([, s]) => s === slot)?.[0];
          if (!cron) {
            return json(
              {
                error: 'slot must be one of: afternoon, evening, night-americas',
              },
              400,
            );
          }
          if (dryRun) {
            const recentAngles = await getRecentAngles(env, 5);
            const draft = await draftPost(env, slot as SlotName, recentAngles);
            return json({
              dry_run: true,
              slot,
              recent_angles_avoided: recentAngles,
              draft,
            });
          }
          await runScheduledPost(env, cron);
          return json({ ok: true, slot, cron });
        }

        case '/publish-now': {
          // Fire-and-forget ad-hoc publish. Returns a job ID immediately,
          // runs the full pipeline (draft → image → mockups → publish) in
          // ctx.waitUntil(). Poll GET /job/:id for progress.
          // Completely bypasses social_post_queue — no queue reads or writes.
          const body = publishNowSchema.parse(await request.json());
          const dryRun = url.searchParams.get('dry-run') === '1';

          // Dry-run is synchronous — just draft, no images or publishing.
          if (dryRun) {
            const recentAngles = await getRecentAngles(env, 5);
            const draft = await draftPost(env, 'afternoon' as SlotName, recentAngles, body.topic);
            return json({ dry_run: true, topic: body.topic, draft });
          }

          const jobId = crypto.randomUUID();
          await createJob(env.JOBS, jobId, body.topic);

          ctx.waitUntil(runPublishNow(env, jobId, body));

          return json({
            job_id: jobId,
            status: 'pending',
            poll_url: `/job/${jobId}`,
          });
        }

        case '/test-showcase': {
          // Compose a showcase image (real screenshot + brand icon as
          // reference images) and upload it to Supabase for inspection.
          // Never touches Meta. ?key=<catalog-key>&headline=<text>
          const key = url.searchParams.get('key') ?? 'expense-insights-total-cost';
          const entry = SCREENSHOT_CATALOG[key];
          if (!entry) return json({ error: `Unknown key: ${key}` }, 400);

          const scene =
            url.searchParams.get('scene') ??
            'A motorcyclist in a black riding jacket and gloves holds a phone up toward the camera, screen facing the lens. Behind them, out of focus, a parked adventure motorcycle on a golden-hour alpine road. Moody, cinematic, warm key light, shallow depth of field.';
          const headline = url.searchParams.get('headline');
          const scenePrompt = headline ? scene + headlineOverlay(headline, false) : scene;

          const [screenshot, brandIcon] = await Promise.all([
            fetchBucketBytes(env, entry.storagePath),
            fetchBucketBytes(env, BRAND_ICON_STORAGE_PATH),
          ]);

          const image = await composeShowcaseImage(env, scenePrompt, screenshot, brandIcon);
          const path = `test/${Date.now()}-showcase-${key}.png`;
          await uploadToSupabase(env, path, base64ToUint8Array(image.image_base64));
          return json({
            success: true,
            key,
            engine: image.engine,
            url: `${env.SUPABASE_URL}/storage/v1/object/public/social-media/${path}`,
          });
        }

        case '/test-mockup': {
          const key = url.searchParams.get('key') ?? 'home-dashboard-hero';
          const entry = SCREENSHOT_CATALOG[key];
          if (!entry) return json({ error: `Unknown key: ${key}` }, 400);

          const screenshotUrl = `${env.SUPABASE_URL}/storage/v1/object/public/social-media/${entry.storagePath}`;
          const screenshotRes = await fetch(screenshotUrl);
          if (!screenshotRes.ok)
            return json({ error: `Fetch failed: ${screenshotRes.status}` }, 500);
          const rawB64 = uint8ArrayToBase64(new Uint8Array(await screenshotRes.arrayBuffer()));

          try {
            const model = url.searchParams.get('model') ?? undefined;
            const mockupB64 = await generatePhoneMockup(env, rawB64, model);
            return json({ success: true, mockup_size: mockupB64.length, key, model });
          } catch (err) {
            return json(
              {
                error: err instanceof Error ? err.message : String(err),
                key,
              },
              500,
            );
          }
        }

        default: {
          // GET /job/:id — poll async job status
          const jobMatch = url.pathname.match(/^\/job\/([0-9a-f-]+)$/);
          if (jobMatch) {
            const job = await getJob(env.JOBS, jobMatch[1]);
            if (!job) return json({ error: 'Job not found' }, 404);
            return json(job);
          }
          return json({ error: 'Not found' }, 404);
        }
      }
    } catch (err: unknown) {
      // Zod validation errors get a 400 with field-level details.
      if (err instanceof z.ZodError) {
        return json({ error: 'Validation failed', issues: err.issues }, 400);
      }
      // All other errors: log full details server-side, return generic message.
      const errorId = crypto.randomUUID();
      console.error(JSON.stringify({ errorId, error: err instanceof Error ? err.message : err }));
      return json({ error: 'Internal error', error_id: errorId }, 500);
    }
  },

  // -------------------------------------------------------------------------
  // Cron entrypoint
  // -------------------------------------------------------------------------
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    // ctx.waitUntil keeps the Worker alive for the full publish flow
    // (image gen + Meta Graph calls can take 30–60s). Without it the Worker
    // terminates as soon as scheduled() returns.
    ctx.waitUntil(runScheduledPost(env, controller.cron));
  },
} satisfies ExportedHandler<Env>;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// Async publish-now pipeline (runs in ctx.waitUntil)
// ---------------------------------------------------------------------------

async function runPublishNow(
  env: Env,
  jobId: string,
  body: z.infer<typeof publishNowSchema>,
): Promise<void> {
  const kv = env.JOBS;
  const platform = body.platform ?? 'both';

  try {
    // Step 1: Draft
    await updateJob(kv, jobId, { status: 'running', step: 'drafting' });
    const needsDraft = !body.caption || !body.image_prompt;
    let caption = body.caption ?? '';
    let facebookCaption = body.facebook_caption ?? '';
    let imagePrompt = body.image_prompt ?? '';
    if (needsDraft) {
      const recentAngles = await getRecentAngles(env, 5);
      const draft = await draftPost(env, 'afternoon' as SlotName, recentAngles, body.topic);
      if (!body.caption) caption = draft.caption;
      if (!body.facebook_caption) facebookCaption = draft.facebookCaption;
      if (!body.image_prompt) imagePrompt = draft.storyPrompt;
    }

    // Step 2: Generate atmospheric image at 4:5 for feed posts
    await updateJob(kv, jobId, { step: 'generating_image' });
    const image = await generateImage(env, imagePrompt, '4:5');

    // Step 3: Publish single image to Meta
    await updateJob(kv, jobId, { step: 'publishing' });
    const captions = { instagram: caption, facebook: facebookCaption || caption };

    const postResult = await publishPost(env, {
      image_base64: image.image_base64,
      captions,
      platform,
    });

    // // Story publishing (commented out for now)
    // const storyResult = await publishStory(env, {
    //   image_base64: image.image_base64,
    //   platform,
    //   link: 'https://motovault.app/download',
    // });

    await updateJob(kv, jobId, {
      status: 'completed',
      step: 'completed',
      result: {
        caption,
        image_engine: image.engine,
        post: postResult,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[publish-now] job=${jobId} FAILED: ${message}`);
    await updateJob(kv, jobId, { status: 'failed', step: 'failed', error: message });
  }
}
