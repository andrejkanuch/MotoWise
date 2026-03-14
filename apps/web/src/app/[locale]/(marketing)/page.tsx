import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CtaSection } from '@/components/marketing/cta-section';
import { Faq } from '@/components/marketing/faq';
import { FeaturesGrid } from '@/components/marketing/features-grid';
import { Hero } from '@/components/marketing/hero';
import { HowItWorks } from '@/components/marketing/how-it-works';
import { SocialProofBar } from '@/components/marketing/social-proof-bar';
import { Testimonials } from '@/components/marketing/testimonials';
import { BASE_URL } from '@/lib/constants';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata');
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: BASE_URL,
    },
  };
}

function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data requires dangerouslySetInnerHTML
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  );
}

export default async function HomePage() {
  const tJsonLd = await getTranslations('JsonLd');
  const tFaq = await getTranslations('Faq');

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: tJsonLd('organizationName'),
    url: BASE_URL,
    logo: `${BASE_URL}/icon.png`,
    description: tJsonLd('organizationDescription'),
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'support@motovault.app',
      contactType: 'customer support',
    },
    sameAs: [],
  };

  const softwareAppSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: tJsonLd('organizationName'),
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'iOS, Android',
    description: tJsonLd('organizationDescription'),
    url: BASE_URL,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  };

  const faqItems = Array.from({ length: 6 }, (_, i) => ({
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
      <JsonLd data={faqSchema} />
      <Hero />
      <SocialProofBar />
      <HowItWorks />
      <FeaturesGrid />
      <Testimonials />
      <CtaSection />
      <Faq />
    </>
  );
}
