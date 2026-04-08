import type { CookieMethodsServer } from '@supabase/ssr';
import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const isDev = process.env.NODE_ENV === 'development';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';

function buildCspHeader(nonce: string): string {
  const connectSources = [
    "'self'",
    supabaseUrl,
    apiUrl,
    isDev ? 'http://localhost:4000' : '',
    'https://www.google-analytics.com',
    'https://*.analytics.google.com',
    'https://*.googletagmanager.com',
    'https://vitals.vercel-insights.com',
    'https://connect.facebook.net',
    'https://www.facebook.com',
  ]
    .filter(Boolean)
    .join(' ');

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://www.googletagmanager.com https://www.google-analytics.com https://connect.facebook.net https://va.vercel-scripts.com${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: https://www.facebook.com",
    "font-src 'self' https://fonts.gstatic.com",
    `connect-src ${connectSources}`,
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

const PROTECTED_PREFIXES = ['/feed', '/profile'];

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

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const { pathname } = request.nextUrl;

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
    pathname.startsWith('/ride/')
  ) {
    // Auth + public community routes: skip locale processing
    response = NextResponse.next({ request });
  } else {
    // All other routes: run next-intl locale detection + routing
    response = intlMiddleware(request) as NextResponse;
  }

  // Apply nonce-based CSP and security headers to all responses
  if (!response.headers.has('Location')) {
    applySecurityHeaders(response, nonce);
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
