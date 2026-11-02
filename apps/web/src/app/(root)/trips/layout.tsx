import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { Footer } from '@/components/marketing/footer';
import { Navbar } from '@/components/marketing/navbar';
import '@/components/marketing/design-system.css';
import { pickNamespaces } from '@/i18n/pick-namespaces';

/**
 * The namespaces this section's client subtree reads (`useTranslations('X')`
 * in the navbar, its language switcher, the store buttons, the GPX button's sign-in modal (AuthV2), the sticky
 * bar, the cookie banner and the error boundary). Only these cross to the
 * client: the whole catalogue is ~300 KB of RSC payload on every page.
 */
const CLIENT_NAMESPACES = [
  'AuthV2',
  'CookieBanner',
  'Cta',
  'Error',
  'LanguageSwitcher',
  'Navbar',
  'StickyBar',
] as const;

export default async function TripsLayout({ children }: { children: React.ReactNode }) {
  const messages = pickNamespaces(await getMessages(), CLIENT_NAMESPACES);

  return (
    <NextIntlClientProvider messages={messages}>
      <div className="mv-marketing">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:px-4 focus:py-2"
          style={{ background: 'var(--mv-copper)', color: 'var(--mv-on-copper)' }}
        >
          Skip to content
        </a>
        <Navbar />
        <main id="main-content">{children}</main>
        <Footer />
      </div>
    </NextIntlClientProvider>
  );
}
