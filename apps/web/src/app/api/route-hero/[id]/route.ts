import { createClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { getFallbackHeroBuffer } from '@/lib/map/fallback-hero';
import { getStaticImageProvider } from '@/lib/map/static-image-provider';

export const revalidate = 86400; // 24-hour ISR cache

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STORAGE_BUCKET = 'route-heroes';

const IMMUTABLE_HEADERS = {
  'Cache-Control': 'public, max-age=31536000, immutable',
} as const;

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Missing Supabase env vars for route-hero handler');
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function fallbackResponse(): NextResponse {
  return new NextResponse(getFallbackHeroBuffer(), {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // 1. Validate UUID format
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid route ID' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // 2. Check Supabase Storage for cached image
  const storagePath = `${id}.png`;

  const { data: existingFile } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, 60);

  // 3. If cached, redirect to the signed URL (301, immutable)
  if (existingFile?.signedUrl) {
    // Use the public URL instead if the bucket is public
    const { data: publicUrl } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);

    if (publicUrl?.publicUrl) {
      return NextResponse.redirect(publicUrl.publicUrl, {
        status: 301,
        headers: IMMUTABLE_HEADERS,
      });
    }

    return NextResponse.redirect(existingFile.signedUrl, {
      status: 302,
      headers: {
        'Cache-Control': 'public, max-age=86400',
      },
    });
  }

  // 4. Fetch route polyline from database
  const { data: route, error: routeError } = await supabase
    .from('routes')
    .select('polyline')
    .eq('id', id)
    .single();

  if (routeError || !route?.polyline) {
    console.error(`[route-hero] Route not found or missing polyline: ${id}`, routeError);
    return fallbackResponse();
  }

  // 5. Build static map URL and fetch the image
  const provider = getStaticImageProvider();
  const mapUrl = provider.buildUrl({
    polyline: route.polyline,
    width: 1200,
    height: 630,
  });

  let imageBuffer: ArrayBuffer;

  try {
    const mapResponse = await fetch(mapUrl, { signal: AbortSignal.timeout(10_000) });

    if (!mapResponse.ok) {
      console.error(`[route-hero] Map provider returned ${mapResponse.status} for route ${id}`);
      return fallbackResponse();
    }

    imageBuffer = await mapResponse.arrayBuffer();
  } catch (err) {
    console.error(`[route-hero] Failed to fetch map image for route ${id}`, err);
    return fallbackResponse();
  }

  // 6. Upload to Supabase Storage for future cache hits
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, imageBuffer, {
      contentType: 'image/png',
      upsert: true,
    });

  if (uploadError) {
    console.error(`[route-hero] Failed to cache image for route ${id}`, uploadError);
    // Non-fatal — still serve the image we fetched
  }

  // 7. Redirect to the public/signed URL now that it exists
  const { data: publicUrl } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);

  if (publicUrl?.publicUrl) {
    return NextResponse.redirect(publicUrl.publicUrl, {
      status: 301,
      headers: IMMUTABLE_HEADERS,
    });
  }

  // Final fallback: serve the image bytes directly
  return new NextResponse(imageBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      ...IMMUTABLE_HEADERS,
    },
  });
}
