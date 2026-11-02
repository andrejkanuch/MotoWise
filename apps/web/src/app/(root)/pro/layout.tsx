import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { Footer } from '@/components/marketing/footer';
import { Navbar } from '@/components/marketing/navbar';
import { MAIN_CONTENT_ID, SkipLink } from '@/components/skip-link';
import '@/components/marketing/design-system.css';

/**
 * The namespaces the /pro client subtree reads: the navbar and its language
 * switcher. The pages themselves are English-only and carry their copy in
 * place, and the footer is a server component. Only these cross to the
 * client: the whole catalogue is ~300 KB of RSC payload.
 */
const PRO_CLIENT_NAMESPACES = ['Navbar', 'LanguageSwitcher'] as const;

type Messages = Awaited<ReturnType<typeof getMessages>>;

function pickNamespaces(messages: Messages, namespaces: readonly string[]): Messages {
  const all = messages as Record<string, unknown>;
  return Object.fromEntries(namespaces.map((ns) => [ns, all[ns]])) as Messages;
}

export default async function ProLayout({ children }: { children: React.ReactNode }) {
  const messages = pickNamespaces(await getMessages(), PRO_CLIENT_NAMESPACES);

  return (
    <NextIntlClientProvider messages={messages}>
      <div className="mv-marketing">
        <SkipLink />
        <Navbar />
        <main id={MAIN_CONTENT_ID}>{children}</main>
        <Footer />
      </div>
    </NextIntlClientProvider>
  );
}
