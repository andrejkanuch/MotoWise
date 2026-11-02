import { redirect } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { CommunityNav } from '@/components/community-nav';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import '@/components/marketing/design-system.css';
import { pickNamespaces } from '@/i18n/pick-namespaces';

/**
 * The namespaces the signed-in client subtree reads (`useTranslations('X')`
 * in the garage, profile, followers pages, the nav and the handoff kit).
 * Only these cross to the client: the whole catalogue is ~300 KB of RSC
 * payload. `src/app/__tests__/intl-provider-contract.test.ts` walks the tree and
 * fails when a client component reads a namespace that is not listed here
 * (a layout file may export only Next's fields, so the test reads this AST).
 */
const COMMUNITY_CLIENT_NAMESPACES = [
  'AppHandoff',
  'CommunityNav',
  'Followers',
  'Garage',
  'GarageV2',
  'Profile',
] as const;

export default async function CommunityLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const messages = pickNamespaces(await getMessages(), COMMUNITY_CLIENT_NAMESPACES);
  const t = await getTranslations('CommunityNav');

  // Read display name from user metadata for the nav bar
  const displayName =
    user.user_metadata?.display_name ?? user.user_metadata?.full_name ?? user.email;

  return (
    <NextIntlClientProvider messages={messages}>
      {/* .mv-root: the face, the ground, selection and the focus ring for every signed-in surface. */}
      <div className="mv-root" style={{ minHeight: '100vh' }}>
        {/* First tab stop: past the nav's seven controls, straight to the page. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:px-4 focus:py-2"
          style={{ background: 'var(--mv-copper)', color: 'var(--mv-on-copper)' }}
        >
          {t('skipToContent')}
        </a>
        <CommunityNav displayName={displayName} />
        <main id="main-content">{children}</main>
      </div>
    </NextIntlClientProvider>
  );
}
