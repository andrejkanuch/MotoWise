import { redirect } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { CommunityNav } from '@/components/community-nav';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import '@/components/marketing/design-system.css';

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
      {/* .mv-root: the face, the ground, selection and the focus ring for every signed-in surface. */}
      <div className="mv-root" style={{ minHeight: '100vh' }}>
        <CommunityNav displayName={displayName} />
        <main>{children}</main>
      </div>
    </NextIntlClientProvider>
  );
}
