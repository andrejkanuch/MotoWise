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
import { getDefaultAuthor } from '@/lib/authors';
import { getCanonicalUrl, getHreflangMap } from '@/lib/constants';
import { getAppStoreRating } from '@/lib/seo/app-store-rating';
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
  const tHome = await getTranslations('Home');

  const [rating, faqItems] = await Promise.all([
    getAppStoreRating(),
    Promise.resolve(
      Array.from({ length: 4 }, (_, i) => ({
        question: tFaq(`items.${i}.question`),
        answer: tFaq(`items.${i}.answer`),
      })),
    ),
  ]);

  const founder = getDefaultAuthor();
  const graph = buildGraph(
    buildOrganization({
      name: tJsonLd('organizationName'),
      description: tJsonLd('organizationDescription'),
      founder: {
        name: founder.name,
        jobTitle: founder.role,
        sameAs: founder.socials
          ? Object.values(founder.socials).filter((url): url is string => Boolean(url))
          : undefined,
      },
    }),
    buildWebSite({
      name: tJsonLd('organizationName'),
      description: tJsonLd('organizationDescription'),
      locale,
    }),
    buildSoftwareApplication({
      name: tJsonLd('organizationName'),
      description: tJsonLd('organizationDescription'),
      aggregateRating: rating ?? undefined,
    }),
    buildFAQPage(faqItems, `${locale}/home/faq`),
  );

  return (
    <>
      <JsonLdGraph nodes={graph} />
      <Hero />
      {/* The AI-extractable site definition opens the manifesto block, left-aligned
          in the container; the proof row follows the quote so the "why believe it"
          comes before the four feature blocks. */}
      <ManifestoSection definition={tHome('siteDefinition')} />
      <ProofSection appStoreRating={rating} />
      <FeaturesGrid />
      <DiagnosticsDemo />
      <Faq />
      <CtaSection />
    </>
  );
}
