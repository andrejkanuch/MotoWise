import { getLocale, getTranslations } from 'next-intl/server';
import { Footer } from '@/components/marketing/footer';
import { Navbar } from '@/components/marketing/navbar';
import { routing } from '@/i18n/routing';
import { BASE_URL } from '@/lib/constants';

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
      images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      images: ['/og-image.png'],
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

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark grain-overlay min-h-screen bg-neutral-950 text-neutral-50">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:bg-primary-500 focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <Navbar />
      <main id="main-content">{children}</main>
      <Footer />

      {/* Console easter egg for curious riders */}
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static console message
        dangerouslySetInnerHTML={{
          __html: `console.log("%c🏍️ MotoVault","font-size:24px;font-weight:900;color:#D4622E;");console.log("%cYour bike deserves better than a spreadsheet.","font-size:14px;color:#a3a3a3;");console.log("%cBuilding something cool? hello@motovault.app","font-size:12px;color:#737373;");`,
        }}
      />
    </div>
  );
}
