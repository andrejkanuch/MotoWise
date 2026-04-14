import { NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

/**
 * Apple App Site Association (AASA) file for Universal Links.
 * Served from /.well-known/apple-app-site-association with Content-Type: application/json.
 *
 * Serves trip share links (/t/*) and ride share links (/r/*) from the MotoVault app.
 *
 * See https://developer.apple.com/documentation/xcode/supporting-associated-domains
 */
export async function GET() {
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
