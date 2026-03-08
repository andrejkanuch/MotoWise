import { getLocale, getTranslations } from 'next-intl/server';
import { Footer } from '@/components/marketing/footer';
import { Navbar } from '@/components/marketing/navbar';
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
      siteName: 'MotoWise',
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
      languages: {
        en: BASE_URL,
        es: `${BASE_URL}/es`,
        de: `${BASE_URL}/de`,
        'x-default': BASE_URL,
      },
    },
  };
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark grain-overlay min-h-screen bg-neutral-950 text-neutral-50">
      <Navbar />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
