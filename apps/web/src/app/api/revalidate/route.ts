import { revalidatePath, revalidateTag } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { routing } from '@/i18n/routing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  const inputPaths = isStringArray(body.paths) ? body.paths : [];
  // Fan each path out to its locale variants; dedupe so a path passed both bare
  // and localized isn't revalidated twice.
  const paths = [...new Set(inputPaths.flatMap(localeVariants))];

  // Next 16: revalidateTag requires a cacheLife profile; 'max' gives
  // stale-while-revalidate semantics (serve stale, refresh in the background).
  for (const tag of tags) revalidateTag(tag, 'max');
  for (const path of paths) revalidatePath(path);

  const redeployed = await requestRedeployIfNewPath(paths);

  return NextResponse.json({ revalidated: true, tags, paths, redeployed });
}

/**
 * Ask Vercel to rebuild when a path we were told about does not exist yet.
 *
 * The trip/explore routes set `dynamicParams = false` so an unknown URL is a real
 * 404 instead of a 200 soft-404 (MOTOVAULT-WEB-Q/P/R). The cost of that is a new
 * gap: `generateStaticParams` only runs at build time, so a trip published after
 * the last deploy is not in the param list and `revalidatePath` cannot add it —
 * it would 404 until the next unrelated merge. Triggering a deploy hook closes
 * the gap (~2 min) and is the piece that makes `dynamicParams = false` safe for
 * regularly-published content.
 *
 * Best-effort by design: revalidation has already happened by this point, so a
 * missing/failing hook must not turn a successful revalidate into a 500. The
 * response reports what happened instead.
 */
async function requestRedeployIfNewPath(paths: string[]): Promise<boolean> {
  const hook = process.env.VERCEL_DEPLOY_HOOK_URL;
  if (!hook || paths.length === 0) return false;

  // Only paths that can be affected by a stale param list are worth a rebuild —
  // a trip/explore URL. Everything else is already covered by revalidatePath.
  const needsParams = paths.some((p) =>
    /^\/(?:[a-z]{2}(?:-[A-Z]{2})?\/)?(?:trips|explore)\//.test(p),
  );
  if (!needsParams) return false;

  try {
    const res = await fetch(hook, { method: 'POST' });
    if (!res.ok) console.warn(`[revalidate] deploy hook returned ${res.status}`);
    return res.ok;
  } catch (err) {
    console.warn(`[revalidate] deploy hook failed: ${(err as Error).message}`);
    return false;
  }
}
