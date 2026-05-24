/**
 * Core publishing logic — AI SDK image generation, Meta Graph API posting,
 * Supabase Storage uploads.
 *
 * Image generation uses the Vercel AI SDK (`ai` + provider packages) so we
 * can swap models/providers by changing a string. Primary: OpenAI gpt-image-2.
 * Fallback chain: Google Gemini image → Imagen 4.
 *
 * Exported as plain async functions (no HTTP parsing) so both the `fetch`
 * handler and the `scheduled` handler can call them directly.
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { generateImage as aiGenerateImage } from 'ai';
import type { Env } from './env';
import type { PostResults } from './queue';

const GRAPH_API = 'https://graph.facebook.com/v22.0';

export type AspectRatio = '4:5' | '9:16' | '1:1';
export type Platform = 'instagram' | 'facebook' | 'both';

/** Per-platform caption map. When provided, each platform gets its own caption. */
export interface PlatformCaptions {
  instagram: string;
  facebook: string;
}

export interface GeneratedImage {
  image_base64: string;
  mime_type: string;
  engine: string;
  aspect_ratio: AspectRatio;
}

export interface PublishResult {
  image_url: string;
  results: PostResults;
}

// ---------------------------------------------------------------------------
// Image generation (AI SDK — OpenAI primary, Google fallback)
// ---------------------------------------------------------------------------

/** Map our aspect ratios to OpenAI's supported sizes. */
const OPENAI_SIZE_MAP: Record<AspectRatio, '1024x1536' | '1536x1024' | '1024x1024'> = {
  '4:5': '1024x1536',
  '9:16': '1024x1536',
  '1:1': '1024x1024',
};

export async function generateImage(
  env: Env,
  prompt: string,
  aspectRatio: AspectRatio = '4:5',
): Promise<GeneratedImage> {
  // --- Primary: OpenAI gpt-image-2 ---
  try {
    const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
    const { image } = await aiGenerateImage({
      model: openai.image('gpt-image-2'),
      prompt,
      size: OPENAI_SIZE_MAP[aspectRatio],
      providerOptions: { openai: { quality: 'high' } },
      abortSignal: AbortSignal.timeout(45_000),
    });

    return {
      image_base64: image.base64,
      mime_type: 'image/png',
      engine: 'openai-gpt-image-2',
      aspect_ratio: aspectRatio,
    };
  } catch (err) {
    console.warn(
      `[generateImage] gpt-image-2 failed: ${err instanceof Error ? err.message : err} — trying Gemini`,
    );
  }

  // --- Fallback 1: Google Gemini image model ---
  try {
    const google = createGoogleGenerativeAI({ apiKey: env.GOOGLE_AI_STUDIO_KEY });
    const { image } = await aiGenerateImage({
      model: google.image('gemini-2.5-flash-image'),
      prompt,
      aspectRatio: aspectRatio === '4:5' ? '3:4' : aspectRatio,
      abortSignal: AbortSignal.timeout(30_000),
    });

    return {
      image_base64: image.base64,
      mime_type: 'image/png',
      engine: 'google-gemini-image',
      aspect_ratio: aspectRatio,
    };
  } catch (err) {
    console.warn(
      `[generateImage] Gemini image failed: ${err instanceof Error ? err.message : err} — trying Imagen 4`,
    );
  }

  // --- Fallback 2: Google Imagen 4 ---
  try {
    const google = createGoogleGenerativeAI({ apiKey: env.GOOGLE_AI_STUDIO_KEY });
    const { image } = await aiGenerateImage({
      model: google.image('imagen-4.0-generate-001'),
      prompt,
      aspectRatio: aspectRatio === '4:5' ? '3:4' : aspectRatio,
      abortSignal: AbortSignal.timeout(30_000),
    });

    return {
      image_base64: image.base64,
      mime_type: 'image/png',
      engine: 'google-imagen-4',
      aspect_ratio: aspectRatio,
    };
  } catch (err) {
    throw new Error(
      `All image generation engines failed. Last error: ${err instanceof Error ? err.message : err}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Publish photo post
// ---------------------------------------------------------------------------

/**
 * Publish a single-image post. Accepts either a single `caption` string
 * (used for both platforms) or a `captions` map for platform-specific text.
 * Uploads the image once, then publishes to IG and FB in parallel.
 */
export async function publishPost(
  env: Env,
  params: {
    image_base64: string;
    caption?: string;
    captions?: PlatformCaptions;
    platform?: Platform;
  },
): Promise<PublishResult> {
  const platform = params.platform ?? 'both';
  const igCaption = params.captions?.instagram ?? params.caption ?? '';
  const fbCaption = params.captions?.facebook ?? params.caption ?? '';

  // Upload once, reuse for both platforms.
  const imageBytes = base64ToUint8Array(params.image_base64);
  const path = `publish/${Date.now()}-post.png`;
  await uploadToSupabase(env, path, imageBytes);

  // Instagram feed posts: exact 4:5 at 1080x1350 (Meta's recommended spec).
  const imageUrl = renderUrl(env, path, 1080, 1350);

  // Publish to both platforms in parallel when applicable.
  const tasks: Array<Promise<void>> = [];
  const results: PostResults = {};

  if (platform === 'both' || platform === 'facebook') {
    tasks.push(
      (async () => {
        try {
          const fbRes = await graphPost(env, `${env.META_PAGE_ID}/photos`, {
            url: imageUrl,
            message: fbCaption,
          });
          results.facebook = {
            post_id: fbRes.post_id ?? fbRes.id,
            success: !fbRes.error,
            ...(fbRes.error ? { error: fbRes.error } : {}),
          };
        } catch (err) {
          results.facebook = {
            success: false,
            error: err instanceof Error ? err.message : err,
          };
        }
      })(),
    );
  }

  if (platform === 'both' || platform === 'instagram') {
    tasks.push(
      (async () => {
        try {
          const container = await graphPost(env, `${env.META_IG_USER_ID}/media`, {
            image_url: imageUrl,
            caption: igCaption,
          });

          if (container.id) {
            await waitForIgProcessing(env, container.id);
            const pub = await graphPost(env, `${env.META_IG_USER_ID}/media_publish`, {
              creation_id: container.id,
            });
            results.instagram = {
              media_id: pub.id,
              success: !pub.error,
              ...(pub.error ? { error: pub.error } : {}),
            };
          } else {
            results.instagram = { success: false, error: container.error };
          }
        } catch (err) {
          results.instagram = {
            success: false,
            error: err instanceof Error ? err.message : err,
          };
        }
      })(),
    );
  }

  await Promise.all(tasks);
  return { image_url: publicUrl(env, path), results };
}

// ---------------------------------------------------------------------------
// Publish carousel (multi-image album)
// ---------------------------------------------------------------------------

export interface PublishCarouselResult {
  image_urls: string[];
  results: PostResults;
}

/**
 * Publish a carousel post to Instagram (multi-image album) and Facebook
 * (multi-photo feed post).
 *
 * Accepts either a single `caption` or a `captions` map for per-platform text.
 * Uploads images once, then publishes to both platforms in parallel.
 *
 * Instagram carousel flow (per Meta Graph API v22):
 *   1. For each image: POST /{ig-user-id}/media with is_carousel_item=true
 *   2. POST /{ig-user-id}/media with media_type=CAROUSEL + children + caption
 *   3. Wait for parent FINISHED, then POST /{ig-user-id}/media_publish
 *
 * Meta allows 2–10 items per carousel.
 */
export async function publishCarousel(
  env: Env,
  params: {
    images_base64: string[];
    caption?: string;
    captions?: PlatformCaptions;
    platform?: Platform;
  },
): Promise<PublishCarouselResult> {
  const platform = params.platform ?? 'both';
  const igCaption = params.captions?.instagram ?? params.caption ?? '';
  const fbCaption = params.captions?.facebook ?? params.caption ?? '';

  if (params.images_base64.length < 2 || params.images_base64.length > 10) {
    throw new Error(`Carousel requires 2–10 images (got ${params.images_base64.length})`);
  }

  // Upload all images once.
  const timestamp = Date.now();
  const paths = await Promise.all(
    params.images_base64.map(async (b64, i) => {
      const path = `publish/${timestamp}-carousel-${i}.png`;
      await uploadToSupabase(env, path, base64ToUint8Array(b64));
      return path;
    }),
  );
  const imageUrls = paths.map((p) => renderUrl(env, p, 1080, 1350));
  const publicUrls = paths.map((p) => publicUrl(env, p));

  // Publish to both platforms in parallel.
  const tasks: Array<Promise<void>> = [];
  const results: PostResults = {};

  // -- Instagram -----------------------------------------------------------
  if (platform === 'both' || platform === 'instagram') {
    tasks.push(
      (async () => {
        try {
          const childIds: string[] = [];
          for (const imageUrl of imageUrls) {
            const child = await graphPost(env, `${env.META_IG_USER_ID}/media`, {
              image_url: imageUrl,
              is_carousel_item: 'true',
            });
            if (!child.id) {
              throw new Error(`IG child container failed: ${JSON.stringify(child.error ?? child)}`);
            }
            await waitForIgProcessing(env, child.id);
            childIds.push(child.id);
          }

          const parent = await graphPost(env, `${env.META_IG_USER_ID}/media`, {
            media_type: 'CAROUSEL',
            children: childIds.join(','),
            caption: igCaption,
          });

          if (!parent.id) {
            throw new Error(
              `IG parent container failed: ${JSON.stringify(parent.error ?? parent)}`,
            );
          }

          await waitForIgProcessing(env, parent.id);

          const pub = await graphPost(env, `${env.META_IG_USER_ID}/media_publish`, {
            creation_id: parent.id,
          });

          results.instagram = {
            media_id: pub.id,
            success: !pub.error,
            ...(pub.error ? { error: pub.error } : {}),
          };
        } catch (err) {
          results.instagram = {
            success: false,
            error: err instanceof Error ? err.message : err,
          };
        }
      })(),
    );
  }

  // -- Facebook ------------------------------------------------------------
  if (platform === 'both' || platform === 'facebook') {
    tasks.push(
      (async () => {
        try {
          const photoIds: string[] = [];
          for (const imageUrl of imageUrls) {
            const photo = await graphPost(env, `${env.META_PAGE_ID}/photos`, {
              url: imageUrl,
              published: 'false',
            });
            if (!photo.id) {
              throw new Error(`FB photo upload failed: ${JSON.stringify(photo.error ?? photo)}`);
            }
            photoIds.push(photo.id);
          }

          const feedRes = await graphPost(env, `${env.META_PAGE_ID}/feed`, {
            message: fbCaption,
            attached_media: JSON.stringify(photoIds.map((id) => ({ media_fbid: id }))),
          });

          results.facebook = {
            post_id: feedRes.post_id ?? feedRes.id,
            success: !feedRes.error,
            ...(feedRes.error ? { error: feedRes.error } : {}),
          };
        } catch (err) {
          results.facebook = {
            success: false,
            error: err instanceof Error ? err.message : err,
          };
        }
      })(),
    );
  }

  await Promise.all(tasks);
  return { image_urls: publicUrls, results };
}

// ---------------------------------------------------------------------------
// Publish story
// ---------------------------------------------------------------------------

export async function publishStory(
  env: Env,
  params: { image_base64: string; platform?: Platform; link?: string },
): Promise<PublishResult> {
  const platform = params.platform ?? 'both';
  const results: PostResults = {};

  const imageBytes = base64ToUint8Array(params.image_base64);
  const path = `publish/${Date.now()}-story.png`;
  await uploadToSupabase(env, path, imageBytes);

  const imageUrl = renderUrl(env, path, 1080, 1920);

  // Publish to both platforms in parallel.
  const tasks: Array<Promise<void>> = [];

  if (platform === 'both' || platform === 'instagram') {
    tasks.push(
      (async () => {
        try {
          const storyParams: Record<string, string> = {
            image_url: imageUrl,
            media_type: 'STORIES',
          };
          if (params.link) {
            storyParams.link = params.link;
          }
          const container = await graphPost(env, `${env.META_IG_USER_ID}/media`, storyParams);

          if (container.id) {
            await waitForIgProcessing(env, container.id);
            const pub = await graphPost(env, `${env.META_IG_USER_ID}/media_publish`, {
              creation_id: container.id,
            });
            results.instagram = {
              story_id: pub.id,
              success: !pub.error,
              ...(pub.error ? { error: pub.error } : {}),
            };
          } else {
            results.instagram = { success: false, error: container.error };
          }
        } catch (err) {
          results.instagram = {
            success: false,
            error: err instanceof Error ? err.message : err,
          };
        }
      })(),
    );
  }

  if (platform === 'both' || platform === 'facebook') {
    tasks.push(
      (async () => {
        try {
          const photo = await graphPost(env, `${env.META_PAGE_ID}/photos`, {
            url: imageUrl,
            published: 'false',
          });

          if (photo.id) {
            const story = await graphPost(env, `${env.META_PAGE_ID}/photo_stories`, {
              photo_id: photo.id,
            });
            results.facebook = {
              post_id: story.post_id ?? story.id,
              success: !story.error,
              ...(story.error ? { error: story.error } : {}),
            };
          } else {
            results.facebook = { success: false, error: photo.error };
          }
        } catch (err) {
          results.facebook = {
            success: false,
            error: err instanceof Error ? err.message : err,
          };
        }
      })(),
    );
  }

  await Promise.all(tasks);
  return { image_url: publicUrl(env, path), results };
}

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------

interface GraphResponse {
  id?: string;
  post_id?: string;
  status_code?: string;
  error?: unknown;
}

/**
 * POST to Meta Graph API. The access token is always sent via the request
 * body (form-encoded) — never in the URL query string.
 */
async function graphPost(
  env: Env,
  endpoint: string,
  params: Record<string, string>,
): Promise<GraphResponse> {
  const res = await fetch(`${GRAPH_API}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...params, access_token: env.META_API_KEY }).toString(),
  });
  const data = (await res.json()) as GraphResponse;
  if (data.error) {
    console.error(`[graphPost] ${endpoint} error:`, JSON.stringify(data.error));
  }
  return data;
}

/**
 * Poll an IG media container until it reaches FINISHED status.
 *
 * Note: Meta's Graph API GET endpoints require the access_token as a query
 * parameter — the Authorization: Bearer header is only documented for the
 * WhatsApp Cloud API, not the Instagram/Facebook Graph API. POST endpoints
 * are safe because the token travels in the form-encoded body, not the URL.
 */
async function waitForIgProcessing(env: Env, containerId: string, maxWait = 20): Promise<void> {
  for (let i = 0; i < maxWait; i++) {
    const res = await fetch(
      `${GRAPH_API}/${containerId}?fields=status_code,status&access_token=${env.META_API_KEY}`,
    );
    const data = (await res.json()) as GraphResponse & { status?: string };
    if (data.status_code === 'FINISHED') return;
    if (data.status_code === 'ERROR') {
      throw new Error(`Instagram processing failed: ${JSON.stringify(data)}`);
    }
    if (data.error) {
      throw new Error(`Instagram container check error: ${JSON.stringify(data.error)}`);
    }
    if (i === 0 || i % 5 === 0) {
      console.log(
        `[waitForIg] container=${containerId} poll=${i} status_code=${data.status_code ?? 'none'} status=${data.status ?? 'none'}`,
      );
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(
    `Instagram processing timeout after ${maxWait * 2}s for container ${containerId}`,
  );
}

/** Upload image bytes to Supabase Storage using the service role key. */
async function uploadToSupabase(env: Env, path: string, data: Uint8Array): Promise<string> {
  const url = `${env.SUPABASE_URL}/storage/v1/object/social-media/${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'image/png',
      'x-upsert': 'true',
    },
    body: data,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase upload failed: ${err}`);
  }

  return path;
}

function publicUrl(env: Env, path: string): string {
  return `${env.SUPABASE_URL}/storage/v1/object/public/social-media/${path}`;
}

function renderUrl(env: Env, path: string, width: number, height: number): string {
  return (
    `${env.SUPABASE_URL}/storage/v1/render/image/public/social-media/${path}` +
    `?width=${width}&height=${height}&resize=cover`
  );
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Convert a Uint8Array to base64 using chunked conversion to avoid
 * hitting the max call stack size on large arrays.
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
