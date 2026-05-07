import { redirect } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { CommunityNav } from '@/components/community-nav';
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
      <div style={{ minHeight: '100vh', background: 'oklch(0.085 0.008 55)' }}>
        <CommunityNav displayName={displayName} />
        <main>{children}</main>
      </div>
    </NextIntlClientProvider>
  );
}
