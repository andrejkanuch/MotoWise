import { redirect } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { CommunityNav } from '@/components/community-nav';
import { mvFontsClassName } from '@/lib/fonts';
import { getSupabaseServerClient } from '@/lib/supabase-server';

export default async function CommunityLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const messages = await getMessages();

  // Read display name from user metadata for the nav bar
  const displayName =
    user.user_metadata?.display_name ?? user.user_metadata?.full_name ?? user.email;

  return (
    <NextIntlClientProvider messages={messages}>
      {/* mvFontsClassName: Instrument Serif + the --mv-font-* tokens resolved on
          this wrapper (see lib/fonts.ts). */}
      <div
        className={mvFontsClassName}
        style={{ minHeight: '100vh', background: 'var(--mv-page)' }}
      >
        <CommunityNav displayName={displayName} />
        <main>{children}</main>
      </div>
    </NextIntlClientProvider>
  );
}
