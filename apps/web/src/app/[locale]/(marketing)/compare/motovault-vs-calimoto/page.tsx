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
  const t = await getTranslations('VsCalimoto');
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: getCanonicalUrl(locale, '/compare/motovault-vs-calimoto'),
      languages: getHreflangMap('/compare/motovault-vs-calimoto'),
    },
  };
}

const CONFIG: VsComparePageConfig = {
  namespace: 'VsCalimoto',
  competitorName: 'Calimoto',
  breadcrumbLabel: 'MotoVault vs Calimoto',
  titleKey: 'heroTitle',
  subtitleKey: 'heroSubtitle',
  updatedAtKey: 'updatedAt',
  testingPreambleKey: 'testingPreamble',
  quickVerdictKey: 'quickVerdict',
  comparison: {
    keyStyle: 'flat',
    titleKey: 'parityMatrixTitle',
    marks: [
      { mv: 'yes', comp: 'partial' }, // multi-day trip planning
      { mv: 'yes', comp: 'no' }, // AI photo diagnostics
      { mv: 'yes', comp: 'no' }, // maintenance reminders
      { mv: 'yes', comp: 'no' }, // expense tracking
      { mv: 'yes', comp: 'yes' }, // GPS ride recording
      { mv: 'partial', comp: 'yes' }, // offline maps
      { mv: 'yes', comp: 'partial' }, // social / RSVPs
      { mv: 'yes', comp: 'partial' }, // rider profile / community
      { mv: 'no', comp: 'no' }, // marketplace
      { mv: 'yes', comp: 'yes' }, // route sharing
    ],
  },
  wins: {
    mvTitleKey: 'mvWins',
    compTitleKey: 'cmWins',
    mvItemPrefix: 'mvWin',
    compItemPrefix: 'cmWin',
    count: 4,
  },
  whenToChoose: { titleKey: 'whenToChooseCompetitorTitle', bodyKey: 'whenToChooseCompetitor' },
  pricing: { keyStyle: 'flat', titleKey: 'pricingTableTitle', rows: 3, narrativeKey: 'pricing' },
  verdict: { bodyKey: 'verdict' },
  faqCount: 4,
  related: ['ridelog', 'rever'],
};

export default async function VsCalimotoPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('VsCalimoto');

  const canonical = getCanonicalUrl(locale, '/compare/motovault-vs-calimoto');

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
      pageKey: '/compare/motovault-vs-calimoto',
    }),
    buildBreadcrumbList(
      [
        { name: 'Home', url: getCanonicalUrl(locale) },
        { name: 'Compare', url: getCanonicalUrl(locale, '/compare') },
        { name: 'MotoVault vs Calimoto', url: canonical },
      ],
      locale,
      '/compare/motovault-vs-calimoto',
    ),
    buildFAQPage(faqItems, `${locale}/compare/motovault-vs-calimoto/faq`),
  );

  return (
    <>
      <JsonLdGraph nodes={graph} />
      <VsComparePage {...CONFIG} />
    </>
  );
}
