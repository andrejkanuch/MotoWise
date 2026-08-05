import { createHmac, timingSafeEqual } from 'node:crypto';
import { revalidatePath, revalidateTag } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { routing } from '@/i18n/routing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TIMING_SAFE_KEY = 'revalidate-timing-safe-compare' as const;

/**
 * Constant-time secret comparison, matching the pattern the API's own public
 * webhook controllers use (`safeCompare` in ride-idle-check.controller.ts and
 * maintenance-due-push.controller.ts). HMAC first so both sides are fixed-length,
 * since timingSafeEqual throws on a length mismatch — and a raw `!==` leaks the
 * secret's length and a prefix-match position through response timing.
 */
function safeCompare(a: string, b: string): boolean {
  const hmac = (v: string) => createHmac('sha256', TIMING_SAFE_KEY).update(v).digest();
  return timingSafeEqual(hmac(a), hmac(b));
}

/**
 * Expand a non-localized path to every locale variant it's served at. The
 * default locale is served bare (localePrefix: 'as-needed'); other locales get
 * a `/<locale>` prefix. revalidatePath doesn't cascade across locale prefixes,
 * so the API sends bare paths and we fan them out here — locale routing is the
 * web app's knowledge, not the API's.
 */
function localeVariants(path: string): string[] {
  if (!path.startsWith('/')) return [path];
  return [
    path,
    ...routing.locales
      .filter((locale) => locale !== routing.defaultLocale)
      .map((locale) => `/${locale}${path === '/' ? '' : path}`),
  ];
}

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
 * A `staticParamsChanged` flag and a Vercel deploy-hook trigger used to live here,
 * because `dynamicParams = false` meant a newly published trip could not be served
 * without a rebuild. No route sets that flag any more — unknown URLs are generated
 * on demand and 404 only when the content genuinely does not exist — so both are
 * gone. An extra `staticParamsChanged` key in a request body is ignored, not an
 * error, so an API caller still sending it keeps working.
 *
 * Example (API → web on trip publish):
 *   curl -X POST "$WEB_URL/api/revalidate" \
 *     -H "x-revalidate-secret: $REVALIDATE_SECRET" \
 *     -H 'content-type: application/json' \
 *     -d '{"tags":["trips"],"paths":["/explore/ca/bc","/trips/ca/bc/the-slug"]}'
 */
export async function POST(req: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  const provided = req.headers.get('x-revalidate-secret');
  if (!secret || !provided || !safeCompare(provided, secret)) {
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
  const inputPaths = isStringArray(body.paths) ? body.paths : [];
  // Fan each path out to its locale variants; dedupe so a path passed both bare
  // and localized isn't revalidated twice.
  const paths = [...new Set(inputPaths.flatMap(localeVariants))];

  // Next 16: revalidateTag requires a cacheLife profile; 'max' gives
  // stale-while-revalidate semantics (serve stale, refresh in the background).
  for (const tag of tags) revalidateTag(tag, 'max');
  for (const path of paths) revalidatePath(path);

  return NextResponse.json({ revalidated: true, tags, paths });
}
