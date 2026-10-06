import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { safeRedirectPath } from '@/lib/safe-redirect';
import {
  isNewWebOAuthAccount,
  SIGNUP_PLATFORM_METADATA_KEY,
  WEB_SIGNUP_PLATFORM,
  WELCOME_PATH,
} from '@/lib/signup-platform';

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

  const newWebAccount = isNewWebOAuthAccount(data.user);
  if (newWebAccount) {
    // Best effort: without the tag the signup is still counted, as `app`.
    await supabase.auth.updateUser({
      data: { [SIGNUP_PLATFORM_METADATA_KEY]: WEB_SIGNUP_PLATFORM },
    });
  }

  // Redirect within the web app (same-origin internal path only). A Google or
  // Apple sign-in from /login can create the account, so a new account goes to
  // the app hand-off instead of the default garage.
  let destination = safeRedirectPath(redirect);
  if (newWebAccount && destination === '/garage') destination = WELCOME_PATH;
  return NextResponse.redirect(`${origin}${destination}`);
}
