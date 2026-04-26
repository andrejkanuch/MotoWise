import type { CookieMethodsServer } from '@supabase/ssr';
import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { resolveUuidToSlug } from './lib/redirect/uuid-to-slug';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const isDev = process.env.NODE_ENV === 'development';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';

// H2 trip/ride share links: lock down headers to capability-URL conventions.
// Preview-bot UAs get a head-only teaser response so they never fire the
// resolve_trip_by_token RPC (keeps audit noise low + scraper caches static).
const PREVIEW_BOT_RE =
  /(Slackbot|WhatsApp|facebookexternalhit|Twitterbot|Discordbot|LinkedInBot|TelegramBot)/i;

const SHARE_LINK_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' https://*.mapbox.com https://api.mapbox.com https://*.supabase.co data:",
  "font-src 'self'",
  "connect-src 'self' https://api.mapbox.com",
  "frame-ancestors 'none'",
].join('; ');

const SHARE_LINK_TEASER_HTML = `<!DOCTYPE html><html><head>
<title>Shared on MotoVault</title>
<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">
<meta property="og:title" content="Shared on MotoVault">
<meta property="og:description" content="Open MotoVault to view this ride.">
<meta name="referrer" content="no-referrer">
</head><body></body></html>`;

function isShareLinkRoute(pathname: string): boolean {
  return pathname.startsWith('/t/') || pathname.startsWith('/r/');
}

function applyShareLinkHeaders(response: NextResponse) {
  // Overrides applySecurityHeaders for /t/* and /r/* — stricter CSP, no
  // referrer, no edge caching. These headers take precedence over the
  // default security headers because share tokens must not leak via
  // Referer, must not be cached by any shared cache, and must not be
  // indexed by search engines.
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
  response.headers.set('Content-Security-Policy', SHARE_LINK_CSP);
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
}

// Defense-in-depth: drop obviously-local hosts from CSP in production. If
// `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_API_URL` get misconfigured to a
// localhost/loopback value in a prod deploy, the string would otherwise leak
// into `connect-src` (auditable as a misconfiguration signal) without ever
// serving a useful request. Also guards against relative URLs that produce
// invalid CSP directives.
function sanitizeCspHost(url: string): string {
  if (!url) return '';
  if (isDev) return url;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    if (
      host === 'localhost' ||
      host === '0.0.0.0' ||
      host.startsWith('127.') ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.endsWith('.local')
    ) {
      return '';
    }
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return '';
  }
}

function buildCspHeader(nonce: string): string {
  const connectSources = [
    "'self'",
    sanitizeCspHost(supabaseUrl),
    sanitizeCspHost(apiUrl),
    isDev ? 'http://localhost:4000' : '',
    'https://www.google-analytics.com',
    'https://*.analytics.google.com',
    'https://*.googletagmanager.com',
    // Vercel Analytics (@vercel/analytics is still mounted in layout.tsx
    // alongside PostHog — remove this line when Vercel Analytics is retired).
    'https://vitals.vercel-insights.com',
    'https://connect.facebook.net',
    'https://www.facebook.com',
  ]
    .filter(Boolean)
    .join(' ');

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://www.googletagmanager.com https://www.google-analytics.com https://connect.facebook.net https://va.vercel-scripts.com https://api.mapbox.com${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline' https://api.mapbox.com",
    "img-src 'self' data: https: https://www.facebook.com",
    "font-src 'self' https://fonts.gstatic.com",
    "worker-src 'self' blob:",
    `connect-src ${connectSources} https://*.mapbox.com`,
    "frame-ancestors 'none'",
  ].join('; ');
}

function applySecurityHeaders(response: NextResponse, nonce: string) {
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  response.headers.set('Content-Security-Policy', buildCspHeader(nonce));
}

// Public marketing paths that are safe to cache at the edge. Excludes admin,
// community (feed/garage/profile), auth, and share-link routes which are
// user-specific or token-scoped.
const MARKETING_CACHEABLE_RE =
  /^\/($|explore|features|compare|tools|blog|press|about|support|privacy|terms|account-deletion|(?:en|de|fr|es|it)(?:\/|$))/;

function isMarketingCacheable(pathname: string): boolean {
  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/rider/') ||
    pathname.startsWith('/ride/') ||
    pathname.startsWith('/feed') ||
    pathname.startsWith('/garage') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/t/') ||
    pathname.startsWith('/r/')
  ) {
    return false;
  }
  return MARKETING_CACHEABLE_RE.test(pathname);
}

function applyMarketingCacheHeader(response: NextResponse) {
  // Edge cache for 1 hour, serve stale for up to 24 hours while revalidating.
  // Matches the route segment `revalidate = 3600` hint used by (marketing) pages.
  response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
}

// Returns true if the request carries a Supabase auth cookie, meaning the
// page may render user-specific server components (nav avatar, CTA variants,
// etc.) and must NOT be served from a shared edge cache.
function hasSupabaseSession(request: NextRequest): boolean {
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith('sb-') && cookie.name.endsWith('-auth-token')) {
      return true;
    }
  }
  return false;
}

const intlMiddleware = createIntlMiddleware(routing);

async function adminAuth(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Parameters<NonNullable<CookieMethodsServer['setAll']>>[0]) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Security tradeoff: we use getSession() instead of getUser() here to avoid
  // a network round-trip to Supabase Auth on every /admin/* navigation.
  // getSession() reads from the cookie-cached JWT — no network call. The JWT is
  // cryptographically signed, so the claims (including the user role stored in
  // app_metadata) can be trusted for middleware-level routing decisions.
  //
  // For sensitive operations (data mutations, role changes, etc.), individual
  // admin pages / API routes should still verify via getUser() + a DB query
  // against public.users to guard against stale JWTs.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Not logged in — redirect to login
  if (!session?.user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Fast path: read role from JWT claims (app_metadata is set by Supabase Auth
  // triggers / admin API and included in the signed JWT).
  const roleFromJwt = session.user.app_metadata?.role;

  if (roleFromJwt === 'admin') {
    return response;
  }

  // Fallback: if the JWT doesn't carry the role claim yet (e.g. the
  // handle_new_user trigger hasn't populated app_metadata), hit the DB.
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', session.user.id)
    .single();

  if (profile?.role !== 'admin') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return response;
}

const PROTECTED_PREFIXES = ['/feed', '/garage', '/profile'];

const PUBLIC_PREFIXES = [
  '/rider/',
  '/ride/',
  '/login',
  '/signup',
  '/forgot-password',
  '/auth/callback',
];

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

async function communityAuth(request: NextRequest) {
  // CRITICAL: supabaseResponse must be reassigned inside setAll
  // so cookie updates from getUser() session refresh are preserved.
  // See: https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Parameters<NonNullable<CookieMethodsServer['setAll']>>[0]) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        supabaseResponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  // Use getSession() to read from cookies (no network call).
  // getUser() validates with Supabase Auth but can fail during the
  // brief window after signInWithPassword before cookies propagate.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}

// EU/EEA + UK + CH — visitors from these countries require GDPR consent
// before analytics tracking. Everyone else gets auto-opted-in.
const CONSENT_REQUIRED_COUNTRIES = new Set([
  // EU 27
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
  // EEA
  'IS',
  'LI',
  'NO',
  // UK (UK GDPR) + Switzerland (FADP)
  'GB',
  'CH',
]);

function applyRegionCookie(request: NextRequest, response: NextResponse) {
  // Skip if the cookie already exists — only set once per browser.
  if (request.cookies.has('mv_region')) return;

  const country = request.headers.get('x-vercel-ip-country') ?? '';
  const region = CONSENT_REQUIRED_COUNTRIES.has(country) ? 'EU' : 'OTHER';
  const secure = request.nextUrl.protocol === 'https:' ? '; Secure' : '';
  // 1-year lifetime — region doesn't change often.
  response.headers.append(
    'Set-Cookie',
    `mv_region=${region}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`,
  );
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const { pathname } = request.nextUrl;

  // H2: share-link routes (/t/:token, /r/:token) — run FIRST, before any
  // other branch. Preview-bot UAs get a head-only teaser and never reach
  // the SSR route. Regular viewers get the page with locked-down headers.
  if (isShareLinkRoute(pathname)) {
    const ua = request.headers.get('user-agent') ?? '';
    if (PREVIEW_BOT_RE.test(ua)) {
      return new NextResponse(SHARE_LINK_TEASER_HTML, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300, s-maxage=300',
          'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet',
        },
      });
    }
    const response = NextResponse.next({ request });
    applyShareLinkHeaders(response);
    return response;
  }

  // UUID→slug redirect: /routes/{uuid} → /route/{country}/{region}/{slug} when slug exists.
  // If the route has no slug yet (or lookup fails), fall through to app/routes/[id]/page.tsx
  // which loads by UUID via GraphQL — do NOT return a bare JSON 404 here.
  const uuidMatch = pathname.match(/^\/routes\/([0-9a-f-]+)/i);
  if (uuidMatch) {
    const resolved = await resolveUuidToSlug(uuidMatch[1]);
    if (resolved) {
      const canonicalUrl = `/route/${resolved.country}/${resolved.region}/${resolved.slug}`;
      return NextResponse.redirect(new URL(canonicalUrl, request.url), 301);
    }
  }

  // Plural /rides/:id (old mobile share URL) → /ride/:id
  const ridesPluralMatch = pathname.match(/^\/rides\/([0-9a-f-]+)\/?$/i);
  if (ridesPluralMatch) {
    return NextResponse.redirect(new URL(`/ride/${ridesPluralMatch[1]}`, request.url), 301);
  }

  // Pass nonce to Next.js so it can apply it to inline scripts
  request.headers.set('x-nonce', nonce);

  let response: NextResponse;

  // Admin routes: run auth guard (no locale processing)
  if (pathname.startsWith('/admin')) {
    response = await adminAuth(request);
  } else if (isProtectedRoute(pathname) && !isPublicRoute(pathname)) {
    // Community protected routes: require authenticated session
    response = await communityAuth(request);
  } else if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/rider/') ||
    pathname.startsWith('/ride/') ||
    pathname.startsWith('/explore') ||
    pathname.startsWith('/route/') ||
    pathname.startsWith('/routes/') ||
    pathname.startsWith('/pro') ||
    pathname.startsWith('/ingest')
  ) {
    // Auth + public community routes + explore + route detail + pro + PostHog proxy (/ingest → next.config rewrites): skip locale processing
    response = NextResponse.next({ request });
  } else {
    // All other routes: run next-intl locale detection + routing
    response = intlMiddleware(request) as NextResponse;
  }

  // Apply nonce-based CSP and security headers to all responses
  if (!response.headers.has('Location')) {
    applySecurityHeaders(response, nonce);
    if (isMarketingCacheable(pathname) && !hasSupabaseSession(request)) {
      applyMarketingCacheHeader(response);
    }
  }

  // Set mv_region cookie (EU vs OTHER) for client-side consent logic.
  applyRegionCookie(request, response);

  return response;
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
