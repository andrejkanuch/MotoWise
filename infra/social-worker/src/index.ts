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

  // Primary: Gemini 3.1 Flash Image — native 4:5 and 9:16 support + text rendering
  const gemini31Url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${env.GOOGLE_AI_STUDIO_KEY}`;

  const res = await fetch(gemini31Url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: body.prompt }] }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: {
          aspectRatio: aspectRatio,
          imageSize: '2K',
        },
      },
    }),
  });

  const data = await res.json<any>();

  if (res.ok) {
    const parts = data.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p: any) => p.inlineData);

    if (imagePart) {
      return json({
        image_base64: imagePart.inlineData.data,
        mime_type: imagePart.inlineData.mimeType || 'image/png',
        engine: 'gemini-3.1-flash-image',
        aspect_ratio: aspectRatio,
      });
    }
  }

  // Fallback 1: Gemini 3 Pro Image (Nano Banana Pro)
  const gemini3ProUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${env.GOOGLE_AI_STUDIO_KEY}`;

  const res2 = await fetch(gemini3ProUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: body.prompt }] }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: {
          aspectRatio: aspectRatio,
          imageSize: '2K',
        },
      },
    }),
  });

  const data2 = await res2.json<any>();

  if (res2.ok) {
    const parts2 = data2.candidates?.[0]?.content?.parts || [];
    const imagePart2 = parts2.find((p: any) => p.inlineData);

    if (imagePart2) {
      return json({
        image_base64: imagePart2.inlineData.data,
        mime_type: imagePart2.inlineData.mimeType || 'image/png',
        engine: 'gemini-3-pro-image',
        aspect_ratio: aspectRatio,
      });
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
      instances: [{ prompt: body.prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: imagenRatioMap[aspectRatio],
        outputOptions: { mimeType: 'image/png' },
      },
    }),
  });

  const data3 = await res3.json<any>();

  if (res3.ok && data3.predictions?.length > 0) {
    return json({
      image_base64: data3.predictions[0].bytesBase64Encoded,
      mime_type: 'image/png',
      engine: 'imagen-4-fallback',
      aspect_ratio: aspectRatio,
    });
  }

  return json(
    {
      error: 'All image generation engines failed',
      details: {
        gemini31: data.error?.message || 'No image',
        gemini3pro: data2.error?.message || 'No image',
        imagen4: data3.error?.message || 'No predictions',
      },
    },
    500,
  );
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
