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
  const t = await getTranslations('VsRideLog');
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: getCanonicalUrl(locale, '/compare/motovault-vs-ridelog'),
      languages: getHreflangMap('/compare/motovault-vs-ridelog'),
    },
  };
}

const CONFIG: VsComparePageConfig = {
  namespace: 'VsRideLog',
  competitorName: 'RideLog',
  breadcrumbLabel: 'MotoVault vs RideLog',
  titleKey: 'heroTitle',
  subtitleKey: 'heroSubtitle',
  updatedAtKey: 'updatedAt',
  disambiguation: { titleKey: 'disambiguationTitle', noteKey: 'disambiguationNote' },
  testingPreambleKey: 'testingPreamble',
  quickVerdictKey: 'quickVerdict',
  comparison: {
    keyStyle: 'flat',
    titleKey: 'parityMatrixTitle',
    marks: [
      { mv: 'yes', comp: 'no' }, // multi-day trip planning
      { mv: 'yes', comp: 'no' }, // AI photo diagnostics
      { mv: 'yes', comp: 'yes' }, // maintenance reminders
      { mv: 'yes', comp: 'yes' }, // expense tracking
      { mv: 'yes', comp: 'yes' }, // GPS ride recording
      { mv: 'partial', comp: 'partial' }, // offline maps
      { mv: 'yes', comp: 'no' }, // social / RSVPs
      { mv: 'yes', comp: 'no' }, // rider profile / community
      { mv: 'no', comp: 'no' }, // marketplace
      { mv: 'yes', comp: 'partial' }, // route sharing
    ],
  },
  wins: {
    mvTitleKey: 'mvWins',
    compTitleKey: 'rlWins',
    mvItemPrefix: 'mvWin',
    compItemPrefix: 'rlWin',
    count: 4,
  },
  whenToChoose: { titleKey: 'whenToChooseCompetitorTitle', bodyKey: 'whenToChooseCompetitor' },
  pricing: { keyStyle: 'flat', titleKey: 'pricingTableTitle', rows: 3, narrativeKey: 'pricing' },
  verdict: { bodyKey: 'verdict' },
  faqCount: 4,
  related: [
    {
      href: '/compare',
      title: 'Best Motorcycle Apps 2026',
      description: 'Full feature matrix and ranking of 10 motorcycle apps.',
    },
    {
      href: '/compare/motovault-vs-rever',
      title: 'MotoVault vs REVER',
      description: 'How MotoVault compares to the popular REVER ride-tracking app.',
    },
    {
      href: '/compare/motovault-vs-calimoto',
      title: 'MotoVault vs Calimoto',
      description: 'Navigation-focused Calimoto vs all-in-one MotoVault.',
    },
  ],
};

export default async function VsRideLogPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('VsRideLog');

  const canonical = getCanonicalUrl(locale, '/compare/motovault-vs-ridelog');

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
      pageKey: '/compare/motovault-vs-ridelog',
    }),
    buildBreadcrumbList(
      [
        { name: 'Home', url: getCanonicalUrl(locale) },
        { name: 'Compare', url: getCanonicalUrl(locale, '/compare') },
        { name: 'MotoVault vs RideLog', url: canonical },
      ],
      locale,
      '/compare/motovault-vs-ridelog',
    ),
    buildFAQPage(faqItems, `${locale}/compare/motovault-vs-ridelog/faq`),
  );

  return (
    <>
      <JsonLdGraph nodes={graph} />
      <VsComparePage {...CONFIG} />
    </>
  );
}
