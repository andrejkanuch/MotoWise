/**
 * MotoVault Social API — Cloudflare Worker
 *
 * Proxies Meta Graph API + Gemini image generation with secrets stored
 * server-side AND runs the scheduled publishing pipeline via cron triggers.
 *
 * HTTP endpoints (all require X-Auth-Key: $WORKER_AUTH_KEY):
 *   GET  /health          — health check
 *   POST /publish-post    — publish photo to IG + FB
 *   POST /publish-story   — publish story to IG + FB
 *   POST /generate-image  — generate image via Gemini
 *
 * Cron triggers (defined in wrangler.toml):
 *   0 14 * * *   — afternoon slot
 *   0 19 * * *   — evening slot
 *   0 0  * * *   — night-americas slot
 *
 * Both entrypoints share the same core functions in publish.ts.
 */
import type { Env } from './env';
import {
  type AspectRatio,
  generateImage,
  type Platform,
  publishPost,
  publishStory,
} from './publish';
import { runScheduledPost } from './scheduled';

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
