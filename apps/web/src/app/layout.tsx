import { GeistMono } from 'geist/font/mono';
import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import Script from 'next/script';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { AnalyticsWithConsent } from '@/components/analytics-consent';
import { CookieConsentBanner, CookieConsentProvider } from '@/components/cookie-consent';
import { MetaPixel } from '@/components/meta-pixel';
import { NavigationProgress } from '@/components/navigation-progress';
import { WebVitalsReporter } from '@/components/web-vitals-reporter';
import { QueryProvider } from '@/providers/query-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://motovault.app'),
  title: {
    default: 'MotoVault',
    template: '%s | MotoVault',
  },
  description: 'Motorcycle maintenance, expense tracking & ride logging platform',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '16x16 32x32 48x48' },
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  manifest: '/site.webmanifest',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a0a0a',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // TODO(perf, big-refactor): getLocale()/getMessages() here read request
  // headers and force EVERY route into dynamic rendering, because this root
  // layout sits above the [locale] segment and cannot call setRequestLocale().
  // Marketing pages neutralize this with `export const dynamic = 'force-static'`
  // (see (marketing)/layout.tsx), which is the pragmatic fix and works today.
  //
  // Investigated 2026-06-15: the clean fix is NOT a simple "move getMessages
  // into [locale]". `<html lang>` still needs the locale here, and Next 16's
  // `next/root-params` only exposes segments that PRECEDE the root layout — but
  // this root layout sits at app/ above [locale], with many non-localed routes
  // (/login, /signup, /garage, /admin, /t, /r, /u) sharing it, so [locale] is
  // not a root param and `locale()` does not resolve. A real decouple requires
  // either multiple root layouts (route groups, duplicated <html>/<body> +
  // providers, full reloads between groups) or `localePrefix: 'always'` URL
  // routing (an SEO-sensitive URL change). Both are large, separately-reviewed
  // initiatives — out of scope. Keep force-static on marketing until then.
  const locale = await getLocale();
  const messages = await getMessages();
  // Only pass the CookieBanner namespace to avoid bloating the client bundle
  const cookieBannerMessages = { CookieBanner: (messages as Record<string, unknown>).CookieBanner };
  return (
    <html
      lang={locale}
      className={`${plusJakarta.variable} ${GeistMono.variable} antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: inline script required to prevent FOUC on theme load
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.classList.add('dark')`,
          }}
        />
        <link rel="dns-prefetch" href="https://tpsoneenbrmdwvzcbifw.supabase.co" />
        <link rel="dns-prefetch" href="https://connect.facebook.net" />
        {/* next/font/google already emits a content-hashed preload for the
            primary Plus Jakarta Sans weight — don't duplicate it with a
            hand-pinned URL that will drift when Google rotates file hashes. */}
        <link
          rel="alternate"
          type="application/rss+xml"
          title="MotoVault Blog"
          href="/blog/feed.xml"
        />
        <meta name="apple-itunes-app" content="app-id=6760291360" />
        {process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN && (
          <Script
            defer
            data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
            src="https://plausible.io/js/script.js"
            strategy="afterInteractive"
          />
        )}
      </head>
      <body className="bg-[--color-surface] text-[--color-on-surface] m-0">
        <ThemeProvider>
          <CookieConsentProvider>
            {/* Replaces the deleted app/loading.tsx — a client component, so it
                creates no Suspense boundary and cannot turn a notFound() into a
                streamed 200. Never swap this back for a loading.tsx. */}
            <NavigationProgress />
            <QueryProvider>{children}</QueryProvider>
            <NextIntlClientProvider locale={locale} messages={cookieBannerMessages}>
              <CookieConsentBanner />
            </NextIntlClientProvider>
            {process.env.NODE_ENV === 'production' && (
              <>
                <AnalyticsWithConsent />
                <MetaPixel />
                <WebVitalsReporter />
              </>
            )}
          </CookieConsentProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
