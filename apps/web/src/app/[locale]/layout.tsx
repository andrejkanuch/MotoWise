import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { RootShell } from '../root-shell';

export { rootMetadata as metadata, rootViewport as viewport } from '../root-metadata';

/**
 * The namespaces the localized client subtree reads (`useTranslations('X')`
 * in 'use client' files under app/[locale], and client components the server
 * pages import). Only these cross to the client: the whole catalogue is
 * ~390 KB of Flight payload on every page. Pages read everything else with
 * `getTranslations` on the server. `src/app/__tests__/intl-provider-contract.test.ts`
 * fails when a client component reads a namespace missing here.
 */
const LOCALE_CLIENT_NAMESPACES = [
  'Blog',
  'Cta',
  'Error',
  'Hero',
  'LanguageSwitcher',
  'Navbar',
  'StickyBar',
] as const;

type Messages = Awaited<ReturnType<typeof getMessages>>;

function pickNamespaces(messages: Messages, namespaces: readonly string[]): Messages {
  const all = messages as Record<string, unknown>;
  return Object.fromEntries(namespaces.map((ns) => [ns, all[ns]])) as Messages;
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * Root layout for the localized tree. `setRequestLocale` runs before any
 * other next-intl call in the request, so `getMessages()`/`getTranslations()`
 * below resolve THIS locale (see root-shell.tsx for the bug this fixes) and
 * the marketing layout's `force-static` keeps working.
 */
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  const allMessages = await getMessages();
  const messages = pickNamespaces(allMessages, LOCALE_CLIENT_NAMESPACES);

  return (
    <RootShell
      locale={locale}
      cookieBannerMessages={{ CookieBanner: (allMessages as Record<string, unknown>).CookieBanner }}
    >
      <NextIntlClientProvider locale={locale} messages={messages}>
        {children}
      </NextIntlClientProvider>
    </RootShell>
  );
}
