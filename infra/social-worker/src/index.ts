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
import {
  type AspectRatio,
  generateImage,
  generatePhoneMockup,
  publishCarousel,
  publishPost,
  publishStory,
} from './publish';
import { getRecentAngles, type SlotName } from './queue';
import { CRON_TO_SLOT, runScheduledPost } from './scheduled';

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

export default {
  // -------------------------------------------------------------------------
  // HTTP entrypoint
  // -------------------------------------------------------------------------
  async fetch(request: Request, env: Env): Promise<Response> {
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

        case '/test-mockup': {
          // Debug endpoint: test phone mockup generation with a screenshot key
          const key = url.searchParams.get('key') ?? 'home-dashboard-hero';
          const { SCREENSHOT_CATALOG } = await import('./screenshots');
          const entry = SCREENSHOT_CATALOG[key];
          if (!entry) return json({ error: `Unknown key: ${key}` }, 400);

          const screenshotUrl = `${env.SUPABASE_URL}/storage/v1/object/public/social-media/${entry.storagePath}`;
          const screenshotRes = await fetch(screenshotUrl);
          if (!screenshotRes.ok)
            return json({ error: `Fetch failed: ${screenshotRes.status}` }, 500);
          const { uint8ArrayToBase64 } = await import('./publish');
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

        default:
          return json({ error: 'Not found' }, 404);
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
