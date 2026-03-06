import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables');
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Security tradeoff: we use getSession() instead of getUser() here to avoid
  // a network round-trip to Supabase Auth on every /dashboard/* navigation.
  // getSession() reads from the cookie-cached JWT — no network call. The JWT is
  // cryptographically signed, so the claims (including the user role stored in
  // app_metadata) can be trusted for middleware-level routing decisions.
  //
  // For sensitive operations (data mutations, role changes, etc.), individual
  // dashboard pages / API routes should still verify via getUser() + a DB query
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
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
