import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { RootShell } from '../root-shell';

export { rootMetadata as metadata, rootViewport as viewport } from '../root-metadata';

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
  const messages = (await getMessages()) as Record<string, unknown>;

  return (
    <RootShell locale={locale} cookieBannerMessages={{ CookieBanner: messages.CookieBanner }}>
      <NextIntlClientProvider locale={locale} messages={messages}>
        {children}
      </NextIntlClientProvider>
    </RootShell>
  );
}
