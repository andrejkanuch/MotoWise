import { type NextRequest, NextResponse } from 'next/server';
import { buildStaticMapUrl } from '../../../../lib/map/static-image-provider';

/**
 * GET /api/route-hero/[id]
 *
 * Returns a static map hero image for a route.
 * Fetches the route polyline from Supabase, builds a Mapbox Static Image URL,
 * proxies the image, and caches aggressively (route polylines are immutable).
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!id || id.length < 10) {
    return NextResponse.json({ error: 'Invalid route ID' }, { status: 400 });
  }

  // Fetch route polyline from Supabase (admin/anon is fine — routes are public)
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const res = await fetch(
    `${supabaseUrl}/rest/v1/routes?id=eq.${id}&status=eq.published&select=polyline`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      next: { revalidate: 86400 }, // Cache for 24h — polylines are immutable
    },
  );

  if (!res.ok) {
    return NextResponse.json({ error: 'Route fetch failed' }, { status: 502 });
  }

  const rows = (await res.json()) as { polyline: string }[];
  if (!rows.length || !rows[0].polyline) {
    return NextResponse.json({ error: 'Route not found' }, { status: 404 });
  }

  const mapUrl = buildStaticMapUrl({
    polyline: rows[0].polyline,
    width: 1280,
    height: 640,
    strokeColor: '3366e6',
    strokeWidth: 5,
    retina: true,
  });

  // Proxy the image from Mapbox
  const imgRes = await fetch(mapUrl);

  if (!imgRes.ok) {
    return NextResponse.json({ error: 'Map image generation failed' }, { status: 502 });
  }

  const imgBuffer = await imgRes.arrayBuffer();

  return new NextResponse(imgBuffer, {
    status: 200,
    headers: {
      'Content-Type': imgRes.headers.get('Content-Type') ?? 'image/png',
      'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
    },
  });
}
