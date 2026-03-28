import { Analytics } from '@vercel/analytics/next';
import { GeistMono } from 'geist/font/mono';
import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { getLocale } from 'next-intl/server';
import { AnalyticsWithConsent } from '@/components/analytics-consent';
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
  description: 'AI-powered motorcycle learning & diagnostics platform',
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
        <link
          rel="alternate"
          type="application/rss+xml"
          title="MotoVault Blog"
          href="/blog/feed.xml"
        />
        <meta name="apple-itunes-app" content="app-id=6745417382" />
      </head>
      <body className="bg-[--color-surface] text-[--color-on-surface] m-0">
        {children}
        <Analytics />
        <AnalyticsWithConsent />
      </body>
    </html>
  );
}
