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
  const t = await getTranslations('VsEatSleepRide');
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: getCanonicalUrl(locale, '/compare/motovault-vs-eatsleepride'),
      languages: getHreflangMap('/compare/motovault-vs-eatsleepride'),
    },
  };
}

const CONFIG: VsComparePageConfig = {
  namespace: 'VsEatSleepRide',
  competitorName: 'EatSleepRIDE',
  breadcrumbLabel: 'MotoVault vs EatSleepRIDE',
  titleKey: 'heroTitle',
  subtitleKey: 'heroSubtitle',
  updatedAtKey: 'updatedAt',
  testingPreambleKey: 'testingPreamble',
  quickVerdictKey: 'quickVerdict',
  comparison: {
    keyStyle: 'flat',
    titleKey: 'parityMatrixTitle',
    marks: [
      { mv: 'yes', comp: 'no' }, // maintenance tracking
      { mv: 'yes', comp: 'no' }, // AI photo diagnostics
      { mv: 'yes', comp: 'no' }, // expense tracking
      { mv: 'yes', comp: 'no' }, // learning content
      { mv: 'yes', comp: 'yes' }, // GPS ride recording
      { mv: 'no', comp: 'yes' }, // crash detection
      { mv: 'partial', comp: 'yes' }, // social feed
      { mv: 'yes', comp: 'yes' }, // group ride RSVPs
      { mv: 'no', comp: 'yes' }, // friend / live tracking
      { mv: 'yes', comp: 'partial' }, // multi-day trip planning
    ],
  },
  wins: {
    mvTitleKey: 'mvWins',
    compTitleKey: 'rvWins',
    mvItemPrefix: 'mvWin',
    compItemPrefix: 'rvWin',
    count: 4,
  },
  whenToChoose: { titleKey: 'whenToChooseCompetitorTitle', bodyKey: 'whenToChooseCompetitor' },
  pricing: { keyStyle: 'flat', titleKey: 'pricingTableTitle', rows: 3, narrativeKey: 'pricing' },
  verdict: { bodyKey: 'verdict' },
  faqCount: 4,
  related: ['rever', 'motoscan'],
};

export default async function VsEatSleepRidePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('VsEatSleepRide');

  const canonical = getCanonicalUrl(locale, '/compare/motovault-vs-eatsleepride');

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
      pageKey: '/compare/motovault-vs-eatsleepride',
    }),
    buildBreadcrumbList(
      [
        { name: 'Home', url: getCanonicalUrl(locale) },
        { name: 'Compare', url: getCanonicalUrl(locale, '/compare') },
        { name: 'MotoVault vs EatSleepRIDE', url: canonical },
      ],
      locale,
      '/compare/motovault-vs-eatsleepride',
    ),
    buildFAQPage(faqItems, `${locale}/compare/motovault-vs-eatsleepride/faq`),
  );

  return (
    <>
      <JsonLdGraph nodes={graph} />
      <VsComparePage {...CONFIG} />
    </>
  );
}
