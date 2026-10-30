import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { postAuthDestination } from '@/lib/post-auth-redirect';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const redirect = searchParams.get('redirect');

  if (!code) {
    return NextResponse.redirect(`${origin}/login`);
  }

  // If redirect points to the mobile app scheme, forward the code
  // so the mobile Supabase client can exchange it for a session
  if (redirect?.startsWith('motovault://')) {
    const mobileUrl = new URL(redirect);
    mobileUrl.searchParams.set('code', code);
    return NextResponse.redirect(mobileUrl.toString());
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>,
        ) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        },
      },
    },
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login`);
  }

  // Redirect within the web app (same-origin internal path only). A rider's
  // first session (email confirmation, first Google/Apple login) lands on the
  // post-signup "Get the app" screen instead of /garage; an explicit
  // ?redirect= always wins. See lib/post-auth-redirect.ts.
  const destination = postAuthDestination({ redirect, user: data.user });
  return NextResponse.redirect(`${origin}${destination}`);
}
