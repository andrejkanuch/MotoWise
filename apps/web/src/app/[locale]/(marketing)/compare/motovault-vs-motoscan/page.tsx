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
  const t = await getTranslations('VsMotoScan');
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: getCanonicalUrl(locale, '/compare/motovault-vs-motoscan'),
      languages: getHreflangMap('/compare/motovault-vs-motoscan'),
    },
  };
}

const CONFIG: VsComparePageConfig = {
  namespace: 'VsMotoScan',
  competitorName: 'MotoScan',
  breadcrumbLabel: 'MotoVault vs MotoScan',
  titleKey: 'heroTitle',
  subtitleKey: 'heroSubtitle',
  testingPreambleKey: 'testingPreamble',
  quickVerdictKey: 'quickVerdict',
  comparison: {
    keyStyle: 'flat',
    titleKey: 'parityMatrixTitle',
    marks: [
      { mv: 'yes', comp: 'no' }, // AI symptom diagnostics
      { mv: 'no', comp: 'yes' }, // ECU fault code reading
      { mv: 'no', comp: 'yes' }, // clear / reset fault codes
      { mv: 'no', comp: 'yes' }, // live sensor data
      { mv: 'no', comp: 'yes' }, // battery monitoring
      { mv: 'yes', comp: 'no' }, // maintenance reminders
      { mv: 'yes', comp: 'no' }, // expense tracking
      { mv: 'yes', comp: 'no' }, // learning content
      { mv: 'yes', comp: 'partial' }, // works on any brand
      { mv: 'yes', comp: 'no' }, // trip planning / ride logging
    ],
  },
  whenToChoose: { titleKey: 'whenToChooseCompetitorTitle', bodyKey: 'whenToChooseCompetitor' },
  pricing: { keyStyle: 'flat', titleKey: 'pricingTableTitle', rows: 3, narrativeKey: 'pricing' },
  faqCount: 4,
  related: ['eatsleepride', 'rever'],
};

export default async function VsMotoScanPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('VsMotoScan');

  const canonical = getCanonicalUrl(locale, '/compare/motovault-vs-motoscan');

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
      pageKey: '/compare/motovault-vs-motoscan',
    }),
    buildBreadcrumbList(
      [
        { name: 'Home', url: getCanonicalUrl(locale) },
        { name: 'Compare', url: getCanonicalUrl(locale, '/compare') },
        { name: 'MotoVault vs MotoScan', url: canonical },
      ],
      locale,
      '/compare/motovault-vs-motoscan',
    ),
    buildFAQPage(faqItems, `${locale}/compare/motovault-vs-motoscan/faq`),
  );

  return (
    <>
      <JsonLdGraph nodes={graph} />
      <VsComparePage {...CONFIG} />
    </>
  );
}
