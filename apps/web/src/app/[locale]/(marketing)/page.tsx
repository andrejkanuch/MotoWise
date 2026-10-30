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
      {/* AI-extractable site definition — visible to crawlers, quiet for riders:
          body face, ink-3, left-aligned inside the container */}
      <div style={{ maxWidth: 'var(--mv-container)', margin: '0 auto', padding: '24px 40px 0' }}>
        <p
          style={{
            margin: 0,
            maxWidth: '72ch',
            fontFamily: 'var(--mv-font-body)',
            fontSize: '13px',
            lineHeight: 1.5,
            color: 'var(--mv-ink-3)',
            textAlign: 'left',
          }}
        >
          {tHome('siteDefinition')}
        </p>
      </div>
      <ManifestoSection />
      <FeaturesGrid />
      <ProofSection appStoreRating={rating} />
      <DiagnosticsDemo />
      <Faq />
      <CtaSection />
    </>
  );
}
