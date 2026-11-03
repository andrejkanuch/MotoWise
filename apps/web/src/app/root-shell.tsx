import { Barlow_Condensed } from 'next/font/google';
import Script from 'next/script';
import { NextIntlClientProvider } from 'next-intl';
import { AnalyticsWithConsent } from '@/components/analytics-consent';
import { AnalyticsIdentity } from '@/components/analytics-identity';
import { CookieConsentBanner, CookieConsentProvider } from '@/components/cookie-consent';
import { MetaPixel } from '@/components/meta-pixel';
import { NavigationProgress } from '@/components/navigation-progress';
import { WebVitalsReporter } from '@/components/web-vitals-reporter';
import { HERO_ASSIGN_SCRIPT } from '@/lib/hero-experiment';
import { THEME_INIT_SCRIPT } from '@/lib/theme-init-script';
import { QueryProvider } from '@/providers/query-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import './globals.css';

// The Race Plate display face (apps/mobile/DESIGN.md): condensed numerals
// and headlines. Loaded here so every surface resolves --font-plate. It is the
// only web font in the shell: sentences use the system stack (--mv-font-body),
// code the system mono (--mv-font-mono); Piel loads its own face.
const barlowCondensed = Barlow_Condensed({
  weight: ['500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-plate',
});

/**
 * The <html>/<body> shell shared by the app's two root layouts:
 * `app/[locale]/layout.tsx` (localized marketing pages) and
 * `app/(root)/layout.tsx` (root-only routes: auth, garage, explore, trips,
 * pro, admin…). Two roots exist so the locale segment sits ABOVE everything
 * that resolves messages: with one shared root layout, its `getLocale()` ran
 * before `setRequestLocale()` and — under the marketing layout's
 * `force-static`, where `headers()` is empty — cached the default locale for
 * the whole request, so every /de, /fr, … page rendered in English.
 *
 * `cookieBannerMessages` is only the CookieBanner namespace: the banner is
 * the one client component that needs messages outside the localized tree.
 */
export function RootShell({
  locale,
  cookieBannerMessages,
  children,
}: {
  locale: string;
  cookieBannerMessages: Record<string, unknown>;
  children: React.ReactNode;
}) {
  return (
    <html
      lang={locale}
      className={`${barlowCondensed.variable} antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: inline script required to prevent FOUC on theme load
          dangerouslySetInnerHTML={{
            __html: THEME_INIT_SCRIPT,
          }}
        />
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: assigns the home hero A/B variant before first paint (lib/hero-experiment.ts)
          dangerouslySetInnerHTML={{
            __html: HERO_ASSIGN_SCRIPT,
          }}
        />
        <link rel="dns-prefetch" href="https://tpsoneenbrmdwvzcbifw.supabase.co" />
        <link rel="dns-prefetch" href="https://connect.facebook.net" />
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
                <AnalyticsIdentity />
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
