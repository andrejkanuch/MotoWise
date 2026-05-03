import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CtaSection } from '@/components/marketing/cta-section';
import { DiagnosticsDemo } from '@/components/marketing/diagnostics-demo';
import { Faq } from '@/components/marketing/faq';
import { FeaturesGrid } from '@/components/marketing/features-grid';
import { Hero } from '@/components/marketing/hero';
import { JsonLdGraph } from '@/components/marketing/json-ld-graph';
import { ManifestoSection } from '@/components/marketing/manifesto-section';
import { ProofSection } from '@/components/marketing/proof-section';
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

  const faqItems = Array.from({ length: 4 }, (_, i) => ({
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
    }),
    buildFAQPage(faqItems, `${locale}/home/faq`),
  );

  return (
    <>
      <JsonLdGraph nodes={graph} />
      <Hero />
      {/* AI-extractable site definition — visible to crawlers, subtle for users */}
      <p
        style={{
          maxWidth: '48rem',
          margin: '0 auto',
          padding: '16px 24px 0',
          textAlign: 'center',
          fontSize: '12px',
          lineHeight: '1.5',
          color: 'var(--mv-ink-3)',
        }}
      >
        MotoVault is a free motorcycle management app that combines trip planning,
        maintenance tracking, expense logging, and AI-powered diagnostics in a single
        platform for riders. Available on iOS and Android, MotoVault supports over 12,000
        motorcycle models from the NHTSA Vehicle Product Information Catalog database.
      </p>
      <ManifestoSection />
      <FeaturesGrid />
      <ProofSection />
      <DiagnosticsDemo />
      <Faq />
      <CtaSection />
    </>
  );
}
