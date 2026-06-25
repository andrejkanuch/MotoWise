import { type NextRequest, NextResponse } from 'next/server';
import { searchBlogPostSlugs } from '@/lib/blog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Reader full-text search (plan U8). The base /blog listing stays statically
 * generated; only this query-driven endpoint is dynamic. The client submits a
 * query and gets back published slugs in rank order, then renders cards from the
 * article list it already holds. Type/category/keyword filters are applied
 * client-side over that list.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  const locale = req.nextUrl.searchParams.get('locale') ?? 'en';
  if (!q) return NextResponse.json({ slugs: [] });

  // Bound hostile input — the RPC also guards length, this avoids the round-trip.
  if (q.length > 200) return NextResponse.json({ slugs: [] });

  try {
    const slugs = await searchBlogPostSlugs(q, locale);
    return NextResponse.json({ slugs });
  } catch (err) {
    console.error('[blog/search] failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'search_unavailable' }, { status: 503 });
  }
}
