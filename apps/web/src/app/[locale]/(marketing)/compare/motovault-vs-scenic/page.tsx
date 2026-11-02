import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { VsComparePage, type VsComparePageConfig } from '@/components/marketing/compare-page';
import { JsonLdGraph } from '@/components/marketing/json-ld-graph';
import { getCanonicalUrl, getHreflangMap } from '@/lib/constants';
import { buildBreadcrumbList, buildFAQPage, buildGraph, buildWebPage } from '@/lib/seo/schema';

export const revalidate = 604800; // 7 days — repo-sourced, rebuilds on deploy

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('VsScenic');
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: getCanonicalUrl(locale, '/compare/motovault-vs-scenic'),
      languages: getHreflangMap('/compare/motovault-vs-scenic'),
    },
  };
}

const CONFIG: VsComparePageConfig = {
  namespace: 'VsScenic',
  competitorName: 'Scenic',
  breadcrumbLabel: 'MotoVault vs Scenic',
  titleKey: 'heroTitle',
  subtitleKey: 'heroSubtitle',
  testingPreambleKey: 'testingPreamble',
  quickVerdictKey: 'quickVerdict',
  comparison: {
    keyStyle: 'flat',
    titleKey: 'parityMatrixTitle',
    marks: [
      { mv: 'yes', comp: 'no' }, // platform support (iOS + Android vs iOS only)
      { mv: 'partial', comp: 'yes' }, // curvy-road route planning
      { mv: 'partial', comp: 'yes' }, // offline maps
      { mv: 'yes', comp: 'yes' }, // waypoint editing
      { mv: 'no', comp: 'yes' }, // Apple Watch companion
      { mv: 'yes', comp: 'no' }, // maintenance tracking
      { mv: 'yes', comp: 'no' }, // expense tracking
      { mv: 'yes', comp: 'no' }, // AI photo diagnostics
      { mv: 'yes', comp: 'no' }, // structured learning
      { mv: 'yes', comp: 'no' }, // community / RSVPs
    ],
  },
  whenToChoose: { titleKey: 'whenToChooseCompetitorTitle', bodyKey: 'whenToChooseCompetitor' },
  pricing: { keyStyle: 'flat', titleKey: 'pricingTableTitle', rows: 3, narrativeKey: 'pricing' },
  faqCount: 4,
  related: ['kurviger', 'rever'],
};

export default async function VsScenicPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('VsScenic');

  const canonical = getCanonicalUrl(locale, '/compare/motovault-vs-scenic');

  const faqItems = [0, 1, 2, 3].map((i) => ({
    question: t(`faq.${i}.question`),
    answer: t(`faq.${i}.answer`),
  }));

  const graph = buildGraph(
    buildWebPage({
      url: canonical,
      name: t('title'),
      description: t('description'),
      locale,
      pageKey: '/compare/motovault-vs-scenic',
    }),
    buildBreadcrumbList(
      [
        { name: 'Home', url: getCanonicalUrl(locale) },
        { name: 'Compare', url: getCanonicalUrl(locale, '/compare') },
        { name: 'MotoVault vs Scenic', url: canonical },
      ],
      locale,
      '/compare/motovault-vs-scenic',
    ),
    buildFAQPage(faqItems, `${locale}/compare/motovault-vs-scenic/faq`),
  );

  return (
    <>
      <JsonLdGraph nodes={graph} />
      <VsComparePage {...CONFIG} />
    </>
  );
}
