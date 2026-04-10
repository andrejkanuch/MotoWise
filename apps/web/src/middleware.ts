import { type NextRequest, NextResponse } from 'next/server';

/**
 * Preview-bot unfurlers (Slack, WhatsApp, Facebook, Twitter/X, Discord,
 * LinkedIn, Telegram) get a static head-only HTML response — we never hit
 * the `resolve_trip_by_token` RPC for them. This prevents link unfurling
 * from burning tokens (rate-limits) and also keeps the teaser OG fully
 * generic, with no trip-specific data in any preview card.
 */
const PREVIEW_BOT_RE =
  /(Slackbot|WhatsApp|facebookexternalhit|Twitterbot|Discordbot|LinkedInBot|TelegramBot)/i;

const TEASER_HTML = `<!DOCTYPE html><html><head>
<meta charset="utf-8">
<title>Shared on MotoVault</title>
<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">
<meta property="og:title" content="Shared on MotoVault">
<meta property="og:description" content="Open MotoVault to view.">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="Shared on MotoVault">
<meta name="twitter:description" content="Open MotoVault to view.">
</head><body></body></html>`;

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isTrip = path.startsWith('/t/');
  const isRide = path.startsWith('/r/');
  if (!isTrip && !isRide) {
    return NextResponse.next();
  }

  const ua = req.headers.get('user-agent') ?? '';
  if (PREVIEW_BOT_RE.test(ua)) {
    return new NextResponse(TEASER_HTML, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
        'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet',
        'Referrer-Policy': 'no-referrer',
      },
    });
  }

  const res = NextResponse.next();
  res.headers.set('Cache-Control', 'private, no-store, max-age=0');
  res.headers.set('Referrer-Policy', 'no-referrer');
  res.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
  res.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' https://*.mapbox.com https://api.mapbox.com https://*.supabase.co data:; connect-src 'self' https://api.mapbox.com; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; frame-ancestors 'none';",
  );
  return res;
}

export const config = {
  matcher: ['/t/:path*', '/r/:path*'],
};
