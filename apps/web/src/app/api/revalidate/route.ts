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
 *
 * This route already gated on a shared secret, but it now also triggers a paid
 * production deploy, so the cost of that secret being brute-forced went up.
 */
function safeCompare(a: string, b: string): boolean {
  const hmac = (v: string) => createHmac('sha256', TIMING_SAFE_KEY).update(v).digest();
  return timingSafeEqual(hmac(a), hmac(b));
}

/** Deploy-hook POST budget. Revalidation already succeeded; never hang the response. */
const DEPLOY_HOOK_TIMEOUT_MS = 10_000;

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

  const redeployed = await requestRedeploy(paths);

  return NextResponse.json({ revalidated: true, tags, paths, redeployed });
}

/**
 * Ask Vercel to rebuild, so a newly published trip stops 404ing.
 *
 * The trip/explore routes set `dynamicParams = false` so an unknown URL is a real
 * 404 instead of a 200 soft-404 (MOTOVAULT-WEB-Q/P/R). The cost of that is a new
 * gap: `generateStaticParams` only runs at build time, so a trip published after
 * the last deploy is not in the param list and `revalidatePath` cannot add it —
 * it would 404 until the next unrelated merge. Triggering a deploy hook closes
 * the gap (~2 min) and is the piece that makes `dynamicParams = false` safe for
 * regularly-published content.
 *
 * Deliberately NOT conditional on the path being new. This route is fire-and-forget
 * from the API's perspective and has no way to know the build's param list, so
 * "is this slug already prerendered?" is not answerable here — and guessing wrong
 * in the cheap direction (skipping a rebuild a new trip needed) reinstates the
 * 404 this exists to prevent. The cost of guessing wrong in the safe direction is
 * a redundant build on an edit; Vercel coalesces concurrent hook triggers, so the
 * worst case is one extra deploy, not a queue. An earlier version of this was
 * named `...IfNewPath`, which promised a check it never performed.
 *
 * Best-effort by design: revalidation has already succeeded by this point, so a
 * missing, slow, or failing hook must not turn that into a 500 — hence the
 * timeout and the swallowed error. The response reports what happened instead.
 */
async function requestRedeploy(paths: string[]): Promise<boolean> {
  const hook = process.env.VERCEL_DEPLOY_HOOK_URL;
  if (!hook || paths.length === 0) return false;

  // Only paths whose route depends on a build-time param list are worth a rebuild;
  // everything else is fully covered by revalidatePath above.
  const needsParams = paths.some((p) =>
    /^\/(?:[a-z]{2}(?:-[A-Z]{2})?\/)?(?:trips|explore)\//.test(p),
  );
  if (!needsParams) return false;

  try {
    // Bounded: an unresponsive hook must not hold the revalidate response open.
    const res = await fetch(hook, {
      method: 'POST',
      signal: AbortSignal.timeout(DEPLOY_HOOK_TIMEOUT_MS),
    });
    if (!res.ok) console.warn(`[revalidate] deploy hook returned ${res.status}`);
    return res.ok;
  } catch (err) {
    console.warn(`[revalidate] deploy hook failed: ${(err as Error).message}`);
    return false;
  }
}
