/**
 * Core publishing logic — Gemini image generation, Meta Graph API posting,
 * Supabase Storage uploads.
 *
 * Exported as plain async functions (no HTTP parsing) so both the `fetch`
 * handler and the `scheduled` handler can call them directly.
 */
import type { Env } from './env';

const GRAPH_API = 'https://graph.facebook.com/v22.0';

export type AspectRatio = '4:5' | '9:16' | '1:1';
export type Platform = 'instagram' | 'facebook' | 'both';

export interface GeneratedImage {
  image_base64: string;
  mime_type: string;
  engine: 'gemini-3.1-flash-image' | 'gemini-3-pro-image' | 'imagen-4-fallback';
  aspect_ratio: AspectRatio;
}

export interface PublishResult {
  image_url: string;
  results: {
    facebook?: { post_id?: string; success: boolean; error?: unknown };
    instagram?: { media_id?: string; story_id?: string; success: boolean; error?: unknown };
  };
}

// ---------------------------------------------------------------------------
// Image generation (Gemini primary, Gemini Pro fallback, Imagen 4 fallback)
// ---------------------------------------------------------------------------

interface GeminiPart {
  inlineData?: { data: string; mimeType?: string };
}
interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
  error?: { message?: string };
}
interface ImagenResponse {
  predictions?: Array<{ bytesBase64Encoded: string }>;
  error?: { message?: string };
}

export async function generateImage(
  env: Env,
  prompt: string,
  aspectRatio: AspectRatio = '4:5',
): Promise<GeneratedImage> {
  // Primary: Gemini 3.1 Flash Image (native 4:5 + 9:16 + text rendering)
  const gemini31Url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${env.GOOGLE_AI_STUDIO_KEY}`;

  const res = await fetch(gemini31Url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: { aspectRatio, imageSize: '2K' },
      },
    }),
  });

  const data = (await res.json()) as GeminiResponse;

  if (res.ok) {
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p) => p.inlineData);
    if (imagePart?.inlineData) {
      return {
        image_base64: imagePart.inlineData.data,
        mime_type: imagePart.inlineData.mimeType ?? 'image/png',
        engine: 'gemini-3.1-flash-image',
        aspect_ratio: aspectRatio,
      };
    }
  }

  // Fallback 1: Gemini 3 Pro Image (Nano Banana Pro)
  const gemini3ProUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${env.GOOGLE_AI_STUDIO_KEY}`;

  const res2 = await fetch(gemini3ProUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: { aspectRatio, imageSize: '2K' },
      },
    }),
  });

  const data2 = (await res2.json()) as GeminiResponse;

  if (res2.ok) {
    const parts2 = data2.candidates?.[0]?.content?.parts ?? [];
    const imagePart2 = parts2.find((p) => p.inlineData);
    if (imagePart2?.inlineData) {
      return {
        image_base64: imagePart2.inlineData.data,
        mime_type: imagePart2.inlineData.mimeType ?? 'image/png',
        engine: 'gemini-3-pro-image',
        aspect_ratio: aspectRatio,
      };
    }
  }

  // Fallback 2: Imagen 4 (no text overlay, but correct ratios for 9:16)
  const imagenRatioMap: Record<AspectRatio, string> = {
    '4:5': '3:4',
    '9:16': '9:16',
    '1:1': '1:1',
  };
  const imagenUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${env.GOOGLE_AI_STUDIO_KEY}`;

  const res3 = await fetch(imagenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: imagenRatioMap[aspectRatio],
        outputOptions: { mimeType: 'image/png' },
      },
    }),
  });

  const data3 = (await res3.json()) as ImagenResponse;

  if (res3.ok && data3.predictions && data3.predictions.length > 0) {
    return {
      image_base64: data3.predictions[0].bytesBase64Encoded,
      mime_type: 'image/png',
      engine: 'imagen-4-fallback',
      aspect_ratio: aspectRatio,
    };
  }

  throw new Error(
    `All image generation engines failed: gemini31=${data.error?.message ?? 'no image'}, ` +
      `gemini3pro=${data2.error?.message ?? 'no image'}, ` +
      `imagen4=${data3.error?.message ?? 'no predictions'}`,
  );
}

// ---------------------------------------------------------------------------
// Publish photo post
// ---------------------------------------------------------------------------

export async function publishPost(
  env: Env,
  params: { image_base64: string; caption: string; platform?: Platform },
): Promise<PublishResult> {
  const platform = params.platform ?? 'both';
  const results: PublishResult['results'] = {};

  const imageBytes = base64ToUint8Array(params.image_base64);
  const path = `publish/${Date.now()}-post.png`;
  await uploadToSupabase(env, path, imageBytes);

  // Instagram feed posts: exact 4:5 at 1080x1350 (Meta's recommended spec).
  // Supabase Storage's render endpoint crops Gemini's near-4:5 output to the
  // pixel-exact target.
  const imageUrl = renderUrl(env, path, 1080, 1350);

  if (platform === 'both' || platform === 'facebook') {
    const fbRes = await graphPost(`${env.META_PAGE_ID}/photos`, {
      url: imageUrl,
      message: params.caption,
      access_token: env.META_API_KEY,
    });
    results.facebook = {
      post_id: fbRes.post_id ?? fbRes.id,
      success: !fbRes.error,
      ...(fbRes.error ? { error: fbRes.error } : {}),
    };
  }

  if (platform === 'both' || platform === 'instagram') {
    const container = await graphPost(`${env.META_IG_USER_ID}/media`, {
      image_url: imageUrl,
      caption: params.caption,
      access_token: env.META_API_KEY,
    });

    if (container.id) {
      await waitForIgProcessing(container.id, env.META_API_KEY);
      const pub = await graphPost(`${env.META_IG_USER_ID}/media_publish`, {
        creation_id: container.id,
        access_token: env.META_API_KEY,
      });
      results.instagram = {
        media_id: pub.id,
        success: !pub.error,
        ...(pub.error ? { error: pub.error } : {}),
      };
    } else {
      results.instagram = { success: false, error: container.error };
    }
  }

  return { image_url: publicUrl(env, path), results };
}

// ---------------------------------------------------------------------------
// Publish carousel (multi-image album)
// ---------------------------------------------------------------------------

export interface PublishCarouselResult {
  image_urls: string[];
  results: {
    facebook?: { post_id?: string; success: boolean; error?: unknown };
    instagram?: { media_id?: string; success: boolean; error?: unknown };
  };
}

/**
 * Publish a carousel post to Instagram (multi-image album) and Facebook
 * (multi-photo feed post).
 *
 * Instagram carousel flow (per Meta Graph API v22):
 *   1. For each image: POST /{ig-user-id}/media with is_carousel_item=true
 *      → returns a child container id
 *   2. POST /{ig-user-id}/media with media_type=CAROUSEL and
 *      children=id1,id2,... plus the caption → parent container id
 *   3. Wait for parent FINISHED, then POST /{ig-user-id}/media_publish
 *
 * Facebook multi-photo flow:
 *   1. For each image: POST /{page-id}/photos with published=false
 *      → returns photo ids
 *   2. POST /{page-id}/feed with message + attached_media=[{media_fbid:...}]
 *
 * Meta allows 2–10 items per carousel. Caller must pass 2–10 images.
 */
export async function publishCarousel(
  env: Env,
  params: { images_base64: string[]; caption: string; platform?: Platform },
): Promise<PublishCarouselResult> {
  const platform = params.platform ?? 'both';
  const results: PublishCarouselResult['results'] = {};

  if (params.images_base64.length < 2 || params.images_base64.length > 10) {
    throw new Error(`Carousel requires 2–10 images (got ${params.images_base64.length})`);
  }

  // Upload all slides to Supabase Storage and build the pixel-exact 1080x1350
  // render URLs Meta expects for 4:5 feed posts. Using Promise.all keeps the
  // worker request time bounded by the slowest upload rather than the sum.
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

  // -- Instagram -----------------------------------------------------------
  if (platform === 'both' || platform === 'instagram') {
    try {
      // Step 1: create a child container per slide.
      const childIds: string[] = [];
      for (const imageUrl of imageUrls) {
        const child = await graphPost(`${env.META_IG_USER_ID}/media`, {
          image_url: imageUrl,
          is_carousel_item: 'true',
          access_token: env.META_API_KEY,
        });
        if (!child.id) {
          throw new Error(`IG child container failed: ${JSON.stringify(child.error ?? child)}`);
        }
        // Per Meta docs, children must also reach FINISHED before the parent
        // can reference them. Skipping this causes sporadic "Media ID is not
        // available" errors on media_publish.
        await waitForIgProcessing(child.id, env.META_API_KEY);
        childIds.push(child.id);
      }

      // Step 2: create the parent CAROUSEL container.
      const parent = await graphPost(`${env.META_IG_USER_ID}/media`, {
        media_type: 'CAROUSEL',
        children: childIds.join(','),
        caption: params.caption,
        access_token: env.META_API_KEY,
      });

      if (!parent.id) {
        throw new Error(`IG parent container failed: ${JSON.stringify(parent.error ?? parent)}`);
      }

      await waitForIgProcessing(parent.id, env.META_API_KEY);

      // Step 3: publish the parent.
      const pub = await graphPost(`${env.META_IG_USER_ID}/media_publish`, {
        creation_id: parent.id,
        access_token: env.META_API_KEY,
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
  }

  // -- Facebook ------------------------------------------------------------
  if (platform === 'both' || platform === 'facebook') {
    try {
      // Step 1: upload each photo unpublished to get back photo ids.
      const photoIds: string[] = [];
      for (const imageUrl of imageUrls) {
        const photo = await graphPost(`${env.META_PAGE_ID}/photos`, {
          url: imageUrl,
          published: 'false',
          access_token: env.META_API_KEY,
        });
        if (!photo.id) {
          throw new Error(`FB photo upload failed: ${JSON.stringify(photo.error ?? photo)}`);
        }
        photoIds.push(photo.id);
      }

      // Step 2: create a feed post that attaches all photos as a multi-photo
      // post. `attached_media` must be a JSON-encoded array of {media_fbid}.
      const feedRes = await graphPost(`${env.META_PAGE_ID}/feed`, {
        message: params.caption,
        attached_media: JSON.stringify(photoIds.map((id) => ({ media_fbid: id }))),
        access_token: env.META_API_KEY,
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
  }

  return { image_urls: publicUrls, results };
}

// ---------------------------------------------------------------------------
// Publish story
// ---------------------------------------------------------------------------

export async function publishStory(
  env: Env,
  params: { image_base64: string; platform?: Platform },
): Promise<PublishResult> {
  const platform = params.platform ?? 'both';
  const results: PublishResult['results'] = {};

  const imageBytes = base64ToUint8Array(params.image_base64);
  const path = `publish/${Date.now()}-story.png`;
  await uploadToSupabase(env, path, imageBytes);

  // Instagram and Facebook stories: exact 9:16 at 1080x1920. Gemini's 9:16
  // output lands close (~1536x2752) but not pixel-exact, which causes IG to
  // letterbox. The render URL forces the exact target dimensions via cover
  // crop so Meta receives a true 9:16 image.
  const imageUrl = renderUrl(env, path, 1080, 1920);

  if (platform === 'both' || platform === 'instagram') {
    const container = await graphPost(`${env.META_IG_USER_ID}/media`, {
      image_url: imageUrl,
      media_type: 'STORIES',
      access_token: env.META_API_KEY,
    });

    if (container.id) {
      await waitForIgProcessing(container.id, env.META_API_KEY);
      const pub = await graphPost(`${env.META_IG_USER_ID}/media_publish`, {
        creation_id: container.id,
        access_token: env.META_API_KEY,
      });
      results.instagram = {
        story_id: pub.id,
        success: !pub.error,
        ...(pub.error ? { error: pub.error } : {}),
      };
    } else {
      results.instagram = { success: false, error: container.error };
    }
  }

  if (platform === 'both' || platform === 'facebook') {
    // Two-step: upload unpublished photo, then publish as story
    const photo = await graphPost(`${env.META_PAGE_ID}/photos`, {
      url: imageUrl,
      published: 'false',
      access_token: env.META_API_KEY,
    });

    if (photo.id) {
      const story = await graphPost(`${env.META_PAGE_ID}/photo_stories`, {
        photo_id: photo.id,
        access_token: env.META_API_KEY,
      });
      results.facebook = {
        post_id: story.post_id ?? story.id,
        success: !story.error,
        ...(story.error ? { error: story.error } : {}),
      };
    } else {
      results.facebook = { success: false, error: photo.error };
    }
  }

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

async function graphPost(endpoint: string, params: Record<string, string>): Promise<GraphResponse> {
  const res = await fetch(`${GRAPH_API}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  return (await res.json()) as GraphResponse;
}

async function waitForIgProcessing(
  containerId: string,
  token: string,
  maxWait = 30,
): Promise<void> {
  for (let i = 0; i < maxWait; i++) {
    const res = await fetch(`${GRAPH_API}/${containerId}?fields=status_code&access_token=${token}`);
    const data = (await res.json()) as GraphResponse;
    if (data.status_code === 'FINISHED') return;
    if (data.status_code === 'ERROR') throw new Error('Instagram processing failed');
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('Instagram processing timeout');
}

/**
 * Upload bytes to Supabase Storage and return the storage path. Use
 * `publicUrl()` for the raw image and `renderUrl()` for on-the-fly image
 * transformations (needed to coerce Gemini output to exact aspect ratios
 * that Instagram and Facebook accept without letterboxing).
 */
async function uploadToSupabase(env: Env, path: string, data: Uint8Array): Promise<string> {
  const url = `${env.SUPABASE_URL}/storage/v1/object/social-media/${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
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

/**
 * Supabase Storage on-the-fly image transform. Forces exact pixel dimensions
 * with a cover resize, which Meta requires for feed posts (1080x1350 for 4:5)
 * and stories (1080x1920 for 9:16). Gemini's image models return near-target
 * ratios but not pixel-exact — passing the transformed URL to Meta guarantees
 * Instagram and Facebook render the image without letterboxing.
 */
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
