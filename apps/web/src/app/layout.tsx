import { Analytics } from '@vercel/analytics/next';
import { GeistMono } from 'geist/font/mono';
import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import Script from 'next/script';
import { getLocale } from 'next-intl/server';
import { AnalyticsWithConsent } from '@/components/analytics-consent';
import { CookieConsentProvider } from '@/components/cookie-consent';
import { PostHogPageView } from '@/components/posthog-pageview';
import { WebVitalsReporter } from '@/components/web-vitals-reporter';
import { QueryProvider } from '@/providers/query-provider';
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
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${plusJakarta.variable} ${GeistMono.variable} antialiased`}>
      <head>
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
        <meta name="apple-itunes-app" content="app-id=6745417382" />
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
        <CookieConsentProvider>
          <QueryProvider>{children}</QueryProvider>
          <Analytics />
          <AnalyticsWithConsent />
          <PostHogPageView />
          <WebVitalsReporter />
        </CookieConsentProvider>
      </body>
    </html>
  );
}
