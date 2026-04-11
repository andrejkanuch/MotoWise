import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AppShowcase } from '@/components/marketing/app-showcase';
import { CtaSection } from '@/components/marketing/cta-section';
import { Faq } from '@/components/marketing/faq';
import { FeaturesGrid } from '@/components/marketing/features-grid';
import { Hero } from '@/components/marketing/hero';
import { HowItWorks } from '@/components/marketing/how-it-works';
import { JsonLdGraph } from '@/components/marketing/json-ld-graph';
import { SocialProofBar } from '@/components/marketing/social-proof-bar';
import { getCanonicalUrl, getHreflangMap } from '@/lib/constants';
import {
  buildFAQPage,
  buildGraph,
  buildOrganization,
  buildSoftwareApplication,
  buildWebSite,
} from '@/lib/seo/schema';

// Edge cache for 1 hour, stale-while-revalidate for 24 hours.
export const revalidate = 3600;

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
      languages: getHreflangMap('/'),
    },
  };
}

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tJsonLd = await getTranslations('JsonLd');
  const tFaq = await getTranslations('Faq');

  const faqItems = Array.from({ length: 8 }, (_, i) => ({
    question: tFaq(`items.${i}.question`),
    answer: tFaq(`items.${i}.answer`),
  }));

  const graph = buildGraph(
    buildOrganization({
      name: tJsonLd('organizationName'),
      description: tJsonLd('organizationDescription'),
    }),
    buildWebSite({
      name: tJsonLd('organizationName'),
      description: tJsonLd('organizationDescription'),
      locale,
    }),
    buildSoftwareApplication({
      name: tJsonLd('organizationName'),
      description: tJsonLd('organizationDescription'),
      // aggregateRating intentionally omitted until real App Store + Play
      // Store numbers are pulled and displayed as visible text on the page.
    }),
    buildFAQPage(faqItems, `${locale}/home/faq`),
  );

  return (
    <>
      <JsonLdGraph nodes={graph} />
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
