import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Footer } from '@/components/marketing/footer';
import { Navbar } from '@/components/marketing/navbar';
import { StickyAppBar } from '@/components/marketing/sticky-app-bar';
import { routing } from '@/i18n/routing';
import { BASE_URL } from '@/lib/constants';
import '@/components/marketing/design-system.css';

// force-static + this segment config makes every marketing page statically
// prerendered (ISR via each page's `revalidate`). Without it the shared root
// layout's dynamic getMessages()/getLocale() (it sits above the [locale]
// segment, so it can't call setRequestLocale) forces these routes dynamic —
// the cause of the ~2s TTFB measured in the field. No marketing page reads
// request data server-side, so static rendering is safe here.
// NOTE: the cleaner long-term fix is to move i18n message loading out of the
// root layout into the [locale] layout so force-static isn't needed — that is
// a larger refactor (root layout is shared by all non-localed routes too).
export const dynamic = 'force-static';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  // Derive locale from the route param (static) instead of getLocale() (which
  // reads request headers → dynamic), so metadata generation stays static.
  const { locale } = await params;
  setRequestLocale(locale);
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
  return (
    <div className="mv-marketing">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:px-4 focus:py-2"
        style={{ background: 'var(--mv-copper)', color: 'var(--mv-on-copper)' }}
      >
        Skip to content
      </a>
      <link rel="preconnect" href="https://tpsoneenbrmdwvzcbifw.supabase.co" />
      <link
        rel="preload"
        as="image"
        href="/images/marketing/hero-dusk-ride.jpg"
        media="(min-aspect-ratio: 4/5)"
        fetchPriority="high"
      />
      <link
        rel="preload"
        as="image"
        href="/images/marketing/hero-dusk-ride-portrait.jpg"
        media="(max-aspect-ratio: 4/5)"
        fetchPriority="high"
      />
      <Navbar />
      <main id="main-content">{children}</main>
      <Footer />
      <StickyAppBar />
    </div>
  );
}
