/**
 * MotoVault Social API — Cloudflare Worker
 *
 * Proxies Meta Graph API + Gemini image generation with secrets stored
 * server-side. Called by Claude Code remote triggers to publish social posts.
 *
 * Endpoints:
 *   POST /publish-post    — Publish photo to IG + FB
 *   POST /publish-story   — Publish story to IG + FB
 *   POST /generate-image  — Generate image via Gemini
 *   GET  /health          — Health check
 */

interface Env {
  META_API_KEY: string;
  META_PAGE_ID: string;
  META_IG_USER_ID: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  GOOGLE_AI_STUDIO_KEY: string;
  WORKER_AUTH_KEY: string;
}

const GRAPH_API = 'https://graph.facebook.com/v22.0';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Auth check
    const authKey = request.headers.get('X-Auth-Key');
    if (authKey !== env.WORKER_AUTH_KEY) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const url = new URL(request.url);

    try {
      switch (url.pathname) {
        case '/health':
          return json({ ok: true, service: 'motovault-social-api' });

        case '/publish-post':
          return handlePublishPost(request, env);

        case '/publish-story':
          return handlePublishStory(request, env);

        case '/generate-image':
          return handleGenerateImage(request, env);

        default:
          return json({ error: 'Not found' }, 404);
      }
    } catch (err: any) {
      return json({ error: err.message || 'Internal error' }, 500);
    }
  },
};

// ---------------------------------------------------------------------------
// Publish photo post to Instagram + Facebook
// ---------------------------------------------------------------------------

async function handlePublishPost(request: Request, env: Env): Promise<Response> {
  const body = await request.json<{
    image_base64: string;
    caption: string;
    platform?: 'instagram' | 'facebook' | 'both';
  }>();

  const platform = body.platform || 'both';
  const results: Record<string, any> = {};

  // Upload image to Supabase for public URL (needed by Instagram)
  const imageBytes = base64ToUint8Array(body.image_base64);
  const filename = `publish/${Date.now()}-post.png`;
  const imageUrl = await uploadToSupabase(env, filename, imageBytes);

  // Facebook post
  if (platform === 'both' || platform === 'facebook') {
    const fbRes = await graphPost(`${env.META_PAGE_ID}/photos`, {
      url: imageUrl,
      message: body.caption,
      access_token: env.META_API_KEY,
    });
    results.facebook = { post_id: fbRes.post_id || fbRes.id, success: !fbRes.error };
    if (fbRes.error) results.facebook.error = fbRes.error;
  }

  // Instagram post
  if (platform === 'both' || platform === 'instagram') {
    // Step 1: Create container
    const container = await graphPost(`${env.META_IG_USER_ID}/media`, {
      image_url: imageUrl,
      caption: body.caption,
      access_token: env.META_API_KEY,
    });

    if (container.id) {
      // Wait for processing
      await waitForIgProcessing(container.id, env.META_API_KEY);

      // Step 2: Publish
      const pub = await graphPost(`${env.META_IG_USER_ID}/media_publish`, {
        creation_id: container.id,
        access_token: env.META_API_KEY,
      });
      results.instagram = { media_id: pub.id, success: !pub.error };
      if (pub.error) results.instagram.error = pub.error;
    } else {
      results.instagram = { success: false, error: container.error };
    }
  }

  return json({ results });
}

// ---------------------------------------------------------------------------
// Publish story to Instagram + Facebook
// ---------------------------------------------------------------------------

async function handlePublishStory(request: Request, env: Env): Promise<Response> {
  const body = await request.json<{
    image_base64: string;
    platform?: 'instagram' | 'facebook' | 'both';
  }>();

  const platform = body.platform || 'both';
  const results: Record<string, any> = {};

  const imageBytes = base64ToUint8Array(body.image_base64);
  const filename = `publish/${Date.now()}-story.png`;
  const imageUrl = await uploadToSupabase(env, filename, imageBytes);

  // Instagram story
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
      results.instagram = { story_id: pub.id, success: !pub.error };
      if (pub.error) results.instagram.error = pub.error;
    } else {
      results.instagram = { success: false, error: container.error };
    }
  }

  // Facebook story (two-step: upload unpublished photo, then publish as story)
  if (platform === 'both' || platform === 'facebook') {
    // Step 1: Upload unpublished photo
    const photo = await graphPost(`${env.META_PAGE_ID}/photos`, {
      url: imageUrl,
      published: 'false',
      access_token: env.META_API_KEY,
    });

    if (photo.id) {
      // Step 2: Publish as story
      const story = await graphPost(`${env.META_PAGE_ID}/photo_stories`, {
        photo_id: photo.id,
        access_token: env.META_API_KEY,
      });
      results.facebook = { story_id: story.post_id || story.id, success: !story.error };
      if (story.error) results.facebook.error = story.error;
    } else {
      results.facebook = { success: false, error: photo.error };
    }
  }

  return json({ results });
}

// ---------------------------------------------------------------------------
// Generate image via Gemini
// ---------------------------------------------------------------------------

type AspectRatio = '4:5' | '9:16' | '1:1';

async function handleGenerateImage(request: Request, env: Env): Promise<Response> {
  const body = await request.json<{
    prompt: string;
    aspect_ratio?: AspectRatio;
  }>();

  const aspectRatio: AspectRatio = body.aspect_ratio || '4:5';

  // Imagen 4 supports: 1:1, 3:4, 4:3, 9:16, 16:9
  // Map 4:5 → 3:4 (closest supported portrait ratio)
  const imagenRatioMap: Record<AspectRatio, string> = {
    '4:5': '3:4',
    '9:16': '9:16',
    '1:1': '1:1',
  };
  const imagenRatio = imagenRatioMap[aspectRatio];

  const imagenUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${env.GOOGLE_AI_STUDIO_KEY}`;

  const res = await fetch(imagenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt: body.prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: imagenRatio,
        outputOptions: { mimeType: 'image/png' },
      },
    }),
  });

  const data = await res.json<any>();

  if (!res.ok) {
    // Fallback to Gemini if Imagen fails
    return handleGenerateImageGeminiFallback(body.prompt, env);
  }

  const predictions = data.predictions;
  if (!predictions || predictions.length === 0) {
    // Fallback to Gemini
    return handleGenerateImageGeminiFallback(body.prompt, env);
  }

  const imageBase64 = predictions[0].bytesBase64Encoded;
  return json({
    image_base64: imageBase64,
    mime_type: 'image/png',
    engine: 'imagen-4',
    aspect_ratio: aspectRatio,
  });
}

/** Fallback: use Gemini 2.5 Flash Image (no aspect ratio control) */
async function handleGenerateImageGeminiFallback(prompt: string, env: Env): Promise<Response> {
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${env.GOOGLE_AI_STUDIO_KEY}`;

  const res = await fetch(geminiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    }),
  });

  const data = await res.json<any>();

  if (!res.ok) {
    return json({ error: data.error?.message || 'Gemini API error' }, 500);
  }

  const parts = data.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((p: any) => p.inlineData);

  if (!imagePart) {
    const textPart = parts.find((p: any) => p.text);
    return json({ error: 'No image generated', text: textPart?.text }, 400);
  }

  return json({
    image_base64: imagePart.inlineData.data,
    mime_type: imagePart.inlineData.mimeType,
    engine: 'gemini-fallback',
    warning: 'Gemini fallback — aspect ratio may be 1:1',
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function graphPost(endpoint: string, params: Record<string, string>): Promise<any> {
  const res = await fetch(`${GRAPH_API}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  return res.json();
}

async function waitForIgProcessing(
  containerId: string,
  token: string,
  maxWait = 30,
): Promise<void> {
  for (let i = 0; i < maxWait; i++) {
    const res = await fetch(`${GRAPH_API}/${containerId}?fields=status_code&access_token=${token}`);
    const data = await res.json<any>();
    if (data.status_code === 'FINISHED') return;
    if (data.status_code === 'ERROR') throw new Error('Instagram processing failed');
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('Instagram processing timeout');
}

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

  return `${env.SUPABASE_URL}/storage/v1/object/public/social-media/${path}`;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function _uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
