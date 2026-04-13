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
import { draftPost } from './draft';
import type { Env } from './env';
import {
  type AspectRatio,
  generateImage,
  type Platform,
  publishCarousel,
  publishPost,
  publishStory,
} from './publish';
import { getRecentAngles, type SlotName } from './queue';
import { CRON_TO_SLOT, runScheduledPost } from './scheduled';

export default {
  // -------------------------------------------------------------------------
  // HTTP entrypoint
  // -------------------------------------------------------------------------
  async fetch(request: Request, env: Env): Promise<Response> {
    const authKey = request.headers.get('X-Auth-Key');
    if (authKey !== env.WORKER_AUTH_KEY) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const url = new URL(request.url);

    try {
      switch (url.pathname) {
        case '/health':
          return json({ ok: true, service: 'motovault-social-api' });

        case '/publish-post': {
          const body = (await request.json()) as {
            image_base64: string;
            caption: string;
            platform?: Platform;
          };
          const result = await publishPost(env, body);
          return json(result);
        }

        case '/publish-carousel': {
          const body = (await request.json()) as {
            images_base64: string[];
            caption: string;
            platform?: Platform;
          };
          const result = await publishCarousel(env, body);
          return json(result);
        }

        case '/publish-story': {
          const body = (await request.json()) as {
            image_base64: string;
            platform?: Platform;
          };
          const result = await publishStory(env, body);
          return json(result);
        }

        case '/generate-image': {
          const body = (await request.json()) as {
            prompt: string;
            aspect_ratio?: AspectRatio;
          };
          const result = await generateImage(env, body.prompt, body.aspect_ratio);
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

        default:
          return json({ error: 'Not found' }, 404);
      }
    } catch (err: unknown) {
      return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
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
