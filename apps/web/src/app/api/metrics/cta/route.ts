import { type NextRequest, NextResponse } from 'next/server';
import { captureAnonymousCount } from '@/lib/anonymous-counter';
import { CtaPageType, CtaPlacement, StorePlatform } from '@/lib/cta-taxonomy';

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
// Forwarded through captureAnonymousCount (no person, no cookies, no stored IP).
// The consent-independent total is `store_cta_click_server`; the consented
// subset remains `store_cta_click`.
// -------------------------------------------------------------------

const SERVER_EVENT = 'store_cta_click_server';
const MAX_SLUG_LENGTH = 200;
const MAX_SOURCE_LENGTH = 50;

const PAGE_TYPES = new Set<string>(Object.values(CtaPageType));
const PLATFORMS = new Set<string>(Object.values(StorePlatform));
const PLACEMENTS = new Set<string>(Object.values(CtaPlacement));

// Lightweight per-IP fixed-window throttle so a single client can't flood the
// PostHog relay. In-memory + per-instance (serverless), so it's a best-effort
// cap that matches the endpoint's best-effort nature — it blunts abuse from a
// warm instance without adding a KV/Redis dependency. Over-limit beacons are
// silently dropped (204, never forwarded).
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;
// Hard entry cap so a burst of distinct IPs (all unexpired) can't grow the map
// without bound or turn every request into a full-map scan — the pruning below
// only reclaims EXPIRED entries, which does nothing when they're all live.
const RATE_LIMIT_MAX_ENTRIES = 5000;
const rateHits = new Map<string, { count: number; reset: number }>();

function isRateLimited(ip: string, now: number): boolean {
  const entry = rateHits.get(ip);
  if (!entry || now >= entry.reset) {
    rateHits.set(ip, { count: 1, reset: now + RATE_LIMIT_WINDOW_MS });
    if (rateHits.size > RATE_LIMIT_MAX_ENTRIES) {
      // First reclaim expired entries; if still over cap (all live), evict oldest
      // insertion-order entries until under the cap so memory stays bounded.
      for (const [key, value] of rateHits) if (now >= value.reset) rateHits.delete(key);
      for (const key of rateHits.keys()) {
        if (rateHits.size <= RATE_LIMIT_MAX_ENTRIES) break;
        rateHits.delete(key);
      }
    }
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}

/** Beacons never read the response — always resolve 204, validate defensively. */
const noContent = () => new NextResponse(null, { status: 204 });

export async function POST(req: NextRequest) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) return noContent();

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(ip, Date.now())) return noContent();

  let body: {
    page_type?: unknown;
    placement?: unknown;
    platform?: unknown;
    slug?: unknown;
    utm_source?: unknown;
  };
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
  const placement =
    typeof body.placement === 'string' && PLACEMENTS.has(body.placement)
      ? body.placement
      : undefined;
  const slug = typeof body.slug === 'string' ? body.slug.slice(0, MAX_SLUG_LENGTH) : undefined;
  // Free text from the visitor's URL — lowercase and cap it so a crafted link
  // can't mint unbounded distinct values in the breakdown.
  const utmSource =
    typeof body.utm_source === 'string' && body.utm_source
      ? body.utm_source.slice(0, MAX_SOURCE_LENGTH).toLowerCase()
      : undefined;

  await captureAnonymousCount(SERVER_EVENT, {
    page_type: pageType,
    platform,
    ...(placement ? { placement } : {}),
    ...(slug ? { slug } : {}),
    ...(utmSource ? { utm_source: utmSource } : {}),
  });

  return noContent();
}
