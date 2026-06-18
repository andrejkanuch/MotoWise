import { revalidatePath, revalidateTag } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * On-demand revalidation for DB-sourced static pages (trips, explore taxonomy).
 *
 * These pages render statically with long `revalidate` windows to keep ISR /
 * Data Cache writes low (see the per-page `revalidate` values). This endpoint
 * lets the API invalidate the relevant pages the instant content changes — e.g.
 * when a trip is published or edited — so freshness no longer depends on short
 * revalidation intervals.
 *
 * Auth: shared secret in the `x-revalidate-secret` header (REVALIDATE_SECRET).
 * Body: `{ tags?: string[]; paths?: string[] }`. Tags map to {@link CACHE_TAGS};
 * paths are concrete URLs (e.g. `/explore/ca/bc`, `/trips/ca/bc/<slug>`).
 *
 * Example (API → web on trip publish):
 *   curl -X POST "$WEB_URL/api/revalidate" \
 *     -H "x-revalidate-secret: $REVALIDATE_SECRET" \
 *     -H 'content-type: application/json' \
 *     -d '{"tags":["trips"],"paths":["/explore/ca/bc","/trips/ca/bc/the-slug"]}'
 */
export async function POST(req: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || req.headers.get('x-revalidate-secret') !== secret) {
    return NextResponse.json({ revalidated: false, error: 'unauthorized' }, { status: 401 });
  }

  let body: { tags?: unknown; paths?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ revalidated: false, error: 'invalid json' }, { status: 400 });
  }

  const isStringArray = (v: unknown): v is string[] =>
    Array.isArray(v) && v.every((item) => typeof item === 'string');

  const tags = isStringArray(body.tags) ? body.tags : [];
  const paths = isStringArray(body.paths) ? body.paths : [];

  // Next 16: revalidateTag requires a cacheLife profile; 'max' gives
  // stale-while-revalidate semantics (serve stale, refresh in the background).
  for (const tag of tags) revalidateTag(tag, 'max');
  for (const path of paths) revalidatePath(path);

  return NextResponse.json({ revalidated: true, tags, paths });
}
