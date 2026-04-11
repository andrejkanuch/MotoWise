import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AppShowcase } from '@/components/marketing/app-showcase';
import { CtaSection } from '@/components/marketing/cta-section';
import { Faq } from '@/components/marketing/faq';
import { FeaturesGrid } from '@/components/marketing/features-grid';
import { Hero } from '@/components/marketing/hero';
import { HowItWorks } from '@/components/marketing/how-it-works';
import { JsonLd } from '@/components/marketing/json-ld';
import { SocialProofBar } from '@/components/marketing/social-proof-bar';
import { BASE_URL, getCanonicalUrl } from '@/lib/constants';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Metadata');
  return {
    title: { absolute: t('title') },
    description: t('description'),
    alternates: {
      canonical: getCanonicalUrl(locale),
    },
  };
}

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tJsonLd = await getTranslations('JsonLd');
  const tFaq = await getTranslations('Faq');

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${BASE_URL}/#organization`,
    name: tJsonLd('organizationName'),
    url: BASE_URL,
    logo: {
      '@type': 'ImageObject',
      url: `${BASE_URL}/icon.png`,
      width: 512,
      height: 512,
    },
    description: tJsonLd('organizationDescription'),
    foundingDate: '2025',
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'support@motovault.app',
      contactType: 'customer support',
    },
    sameAs: [
      'https://apps.apple.com/us/app/motovault/id6760291360',
      'https://play.google.com/store/apps/details?id=com.motovault.app',
    ],
  };

  const softwareAppSchema = {
    '@context': 'https://schema.org',
    '@type': 'MobileApplication',
    '@id': `${BASE_URL}/#app`,
    name: tJsonLd('organizationName'),
    applicationCategory: 'UtilitiesApplication',
    applicationSubCategory: 'Motorcycle Maintenance',
    operatingSystem: ['iOS', 'Android'],
    description: tJsonLd('organizationDescription'),
    url: BASE_URL,
    downloadUrl: [
      'https://apps.apple.com/us/app/motovault/id6760291360',
      'https://play.google.com/store/apps/details?id=com.motovault.app',
    ],
    screenshot: [
      {
        '@type': 'ImageObject',
        url: `${BASE_URL}/images/propagation-images/motovault-home-1206x2622.png`,
        caption: 'MotoVault home screen showing garage and diagnostics',
      },
    ],
    featureList: [
      'Maintenance tracking with smart service reminders',
      'Expense management with cost-per-mile analytics',
      'GPS ride recording with route maps, speed, and elevation',
      'AI motorcycle diagnostics from photos',
      'Digital garage management for unlimited bikes',
    ],
    offers: [
      {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        name: 'Free',
      },
      {
        '@type': 'Offer',
        price: '4.99',
        priceCurrency: 'USD',
        name: 'MotoVault Pro',
        description: 'Unlock all features with a 7-day free trial',
      },
    ],
    creator: { '@id': `${BASE_URL}/#organization` },
  };

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${BASE_URL}/#website`,
    name: 'MotoVault',
    url: BASE_URL,
    description: tJsonLd('organizationDescription'),
    publisher: { '@id': `${BASE_URL}/#organization` },
    inLanguage: 'en',
  };

  const faqItems = Array.from({ length: 8 }, (_, i) => ({
    question: tFaq(`items.${i}.question`),
    answer: tFaq(`items.${i}.answer`),
  }));

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return (
    <>
      <JsonLd data={organizationSchema} />
      <JsonLd data={softwareAppSchema} />
      <JsonLd data={websiteSchema} />
      <JsonLd data={faqSchema} />
      <Hero />
      <SocialProofBar />
      <FeaturesGrid />
      <HowItWorks />
      <AppShowcase />
      <CtaSection />
      <Faq />
    </>
  );
}
