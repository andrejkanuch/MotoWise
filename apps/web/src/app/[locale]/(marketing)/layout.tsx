import { Instrument_Serif } from 'next/font/google';
import { headers } from 'next/headers';
import { getLocale, getTranslations } from 'next-intl/server';
import { CursorDot } from '@/components/marketing/cursor-dot';
import { Footer } from '@/components/marketing/footer';
import { Navbar } from '@/components/marketing/navbar';
import { routing } from '@/i18n/routing';
import { BASE_URL } from '@/lib/constants';
import '@/components/marketing/design-system.css';

const instrumentSerif = Instrument_Serif({
  weight: '400',
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-instrument-serif',
  display: 'swap',
  adjustFontFallback: true,
});

export async function generateMetadata() {
  const locale = await getLocale();
  const t = await getTranslations('Metadata');

  return {
    title: {
      default: t('title'),
      template: t('titleTemplate'),
    },
    description: t('description'),
    openGraph: {
      siteName: 'MotoVault',
      locale,
      type: 'website',
      images: [
        {
          url: '/og-image.png',
          width: 1200,
          height: 630,
          alt: 'MotoVault - Learn, Track, Ride Smarter',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      site: '@motovault',
      images: [
        {
          url: '/og-image.png',
          width: 1200,
          height: 630,
          alt: 'MotoVault - AI-powered motorcycle platform',
        },
      ],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large' as const },
    },
    alternates: {
      languages: Object.fromEntries([
        ...routing.locales.map((l) => [l, l === 'en' ? BASE_URL : `${BASE_URL}/${l}`]),
        ['x-default', BASE_URL],
      ]),
    },
  };
}

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? '';

  return (
    <div className={`mv-marketing ${instrumentSerif.variable}`}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:px-4 focus:py-2 focus:text-white"
        style={{ background: 'var(--mv-warm-500)' }}
      >
        Skip to content
      </a>
      <link rel="preconnect" href="https://tpsoneenbrmdwvzcbifw.supabase.co" />
      <link rel="preload" as="image" href="/images/marketing/hero-rider.jpg" fetchPriority="high" />
      <CursorDot />
      <Navbar />
      <main id="main-content">{children}</main>
      <Footer />

      {/* Console easter egg for curious riders */}
      <script
        nonce={nonce}
        suppressHydrationWarning
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static console message
        dangerouslySetInnerHTML={{
          __html: `console.log("%c\\u{1F3CD}\\uFE0F MotoVault","font-size:24px;font-weight:900;color:#D4622E;");console.log("%cYour bike deserves better than a spreadsheet.","font-size:14px;color:#a3a3a3;");console.log("%cBuilding something cool? support@motovault.app","font-size:12px;color:#737373;");`,
        }}
      />
    </div>
  );
}
