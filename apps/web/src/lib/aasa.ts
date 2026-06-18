import { NextResponse } from 'next/server';

/**
 * Apple App Site Association (AASA) JSON for Universal Links.
 *
 * Shared by the canonical `/.well-known/apple-app-site-association` route and
 * the bare-root `/apple-app-site-association` route. Apple only fetches the
 * `.well-known` path, but the bare root is requested by tooling, validators,
 * and humans — a `next.config` rewrite did NOT cover it (afterFiles rewrites
 * don't fire for App Router's not-found path), so it's served by a real route
 * handler instead.
 *
 * See https://developer.apple.com/documentation/xcode/supporting-associated-domains
 */
export function buildAasaResponse(): NextResponse {
  const teamId = process.env.APPLE_TEAM_ID;
  const bundle = 'com.motovault.app';

  if (!teamId) {
    return new NextResponse('APPLE_TEAM_ID not configured', { status: 500 });
  }

  const body = {
    applinks: {
      details: [
        {
          appIDs: [`${teamId}.${bundle}`],
          components: [
            { '/': '/t/*', comment: 'Trip share URLs' },
            { '/': '/r/*', comment: 'Legacy ride capability URLs' },
            { '/': '/ride/*', comment: 'Public ride pages → app' },
            { '/': '/routes/*', comment: 'Route UUID pages → app' },
            { '/': '/route/*', comment: 'Canonical route slug pages → app' },
            { '/': '/trips/*', comment: 'Trip template pages → app' },
          ],
        },
      ],
    },
    webcredentials: { apps: [`${teamId}.${bundle}`] },
  };

  return NextResponse.json(body, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
