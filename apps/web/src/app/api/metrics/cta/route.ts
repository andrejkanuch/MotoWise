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

/** Beacons never read the response — always resolve 204, validate defensively. */
const noContent = () => new NextResponse(null, { status: 204 });

export async function POST(req: NextRequest) {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token) return noContent();

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
