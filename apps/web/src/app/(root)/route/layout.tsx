import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { Footer } from '@/components/marketing/footer';
import { Navbar } from '@/components/marketing/navbar';
import '@/components/marketing/design-system.css';

/**
 * The namespaces this section's client subtree reads (`useTranslations('X')`
 * in the navbar, its language switcher, the store buttons, the sticky
 * bar, the cookie banner and the error boundary). Only these cross to the
 * client: the whole catalogue is ~300 KB of RSC payload on every page.
 */
const CLIENT_NAMESPACES = [
  'CookieBanner',
  'Cta',
  'Error',
  'LanguageSwitcher',
  'Navbar',
  'StickyBar',
] as const;

type Messages = Awaited<ReturnType<typeof getMessages>>;

function pickNamespaces(messages: Messages, namespaces: readonly string[]): Messages {
  const all = messages as Record<string, unknown>;
  return Object.fromEntries(namespaces.map((ns) => [ns, all[ns]])) as Messages;
}

export default async function RouteLayout({ children }: { children: React.ReactNode }) {
  const messages = pickNamespaces(await getMessages(), CLIENT_NAMESPACES);

  return (
    <NextIntlClientProvider messages={messages}>
      <div className="mv-marketing">
        <Navbar />
        <main>{children}</main>
        <Footer />
      </div>
    </NextIntlClientProvider>
  );
}
