import { type NextRequest, NextResponse } from 'next/server';
import { CtaPageType, StorePlatform } from '@/lib/cta-taxonomy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// -------------------------------------------------------------------
// Consent-independent download-intent counter
// -------------------------------------------------------------------
// PostHog stays opted-out until the visitor accepts the cookie banner
// (instrumentation-client.ts: opt_out_capturing_by_default), so the client
// `store_cta_click` event undercounts real download intent ~2–3×. The store
// anchors additionally fire a cookieless navigator.sendBeacon() here (see
// pingCtaCounter in lib/analytics.ts) so raw intent is measurable regardless of
// consent.
//
// We forward a server-side PostHog event under a SINGLE anonymous bucket with
// $process_person_profile:false — no person profile is ever created, so the
// distinct_id is a constant label, not an identifier. No cookies, no stored IP,
// no user id. The consent-independent total is `store_cta_click_server`; the
// consented subset remains `store_cta_click`.
// -------------------------------------------------------------------

const POSTHOG_CAPTURE_URL = 'https://eu.i.posthog.com/capture/';
const ANON_DISTINCT_ID = 'cta-counter-anon';
const SERVER_EVENT = 'store_cta_click_server';
const MAX_SLUG_LENGTH = 200;

const PAGE_TYPES = new Set<string>(Object.values(CtaPageType));
const PLATFORMS = new Set<string>(Object.values(StorePlatform));

// Lightweight per-IP fixed-window throttle so a single client can't flood the
// PostHog relay. In-memory + per-instance (serverless), so it's a best-effort
// cap that matches the endpoint's best-effort nature — it blunts abuse from a
// warm instance without adding a KV/Redis dependency. Over-limit beacons are
// silently dropped (204, never forwarded).
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateHits = new Map<string, { count: number; reset: number }>();

function isRateLimited(ip: string, now: number): boolean {
  const entry = rateHits.get(ip);
  if (!entry || now >= entry.reset) {
    rateHits.set(ip, { count: 1, reset: now + RATE_LIMIT_WINDOW_MS });
    // Opportunistic prune so the map can't grow unbounded on a long-lived instance.
    if (rateHits.size > 5000) {
      for (const [key, value] of rateHits) if (now >= value.reset) rateHits.delete(key);
    }
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}

/** Beacons never read the response — always resolve 204, validate defensively. */
const noContent = () => new NextResponse(null, { status: 204 });

export async function POST(req: NextRequest) {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token) return noContent();

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(ip, Date.now())) return noContent();

  let body: { page_type?: unknown; platform?: unknown; slug?: unknown };
  try {
    body = await req.json();
  } catch {
    return noContent();
  }

  const pageType =
    typeof body.page_type === 'string' && PAGE_TYPES.has(body.page_type) ? body.page_type : null;
  const platform =
    typeof body.platform === 'string' && PLATFORMS.has(body.platform) ? body.platform : null;
  if (!pageType || !platform) return noContent();
  const slug = typeof body.slug === 'string' ? body.slug.slice(0, MAX_SLUG_LENGTH) : undefined;

  try {
    await fetch(POSTHOG_CAPTURE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_key: token,
        event: SERVER_EVENT,
        distinct_id: ANON_DISTINCT_ID,
        properties: {
          page_type: pageType,
          platform,
          ...(slug ? { slug } : {}),
          $process_person_profile: false,
        },
      }),
      // Best-effort counter — never let a stalled capture endpoint hold the
      // route handler open. Abort after 2s; the beacon still returns 204.
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // best-effort counter — swallow network errors + the abort, never fail the beacon
  }

  return noContent();
}
