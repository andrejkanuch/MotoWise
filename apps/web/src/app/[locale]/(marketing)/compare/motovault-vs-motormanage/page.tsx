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
  const t = await getTranslations('VsMotorManage');
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: getCanonicalUrl(locale, '/compare/motovault-vs-motormanage'),
      languages: getHreflangMap('/compare/motovault-vs-motormanage'),
    },
  };
}

const CONFIG: VsComparePageConfig = {
  namespace: 'VsMotorManage',
  competitorName: 'MotorManage',
  breadcrumbLabel: 'MotoVault vs MotorManage',
  titleKey: 'h1',
  subtitleKey: 'subtitle',
  appDescriptions: true,
  comparison: {
    keyStyle: 'nested',
    marks: [
      { mv: 'yes', comp: 'yes' }, // maintenance tracking
      { mv: 'yes', comp: 'yes' }, // expense logging
      { mv: 'yes', comp: 'yes' }, // service schedules
      { mv: 'yes', comp: 'no' }, // AI diagnostics
      { mv: 'yes', comp: 'no' }, // trip planning
      { mv: 'yes', comp: 'no' }, // route discovery
      { mv: 'yes', comp: 'no' }, // learning content
      { mv: 'yes', comp: 'yes' }, // multiple bikes
      { mv: 'yes', comp: 'yes' }, // Android support
      { mv: 'yes', comp: 'no' }, // ride recording
    ],
  },
  pricing: { keyStyle: 'nested', rows: 3 },
  verdict: { titleKey: 'verdictHeading', bodyKey: 'verdictText' },
  faqCount: 4,
  related: [
    {
      href: '/compare',
      title: 'Best Motorcycle Apps 2026',
      description: 'Full feature matrix and ranking of 10 motorcycle apps.',
    },
    {
      href: '/compare/motovault-vs-moto-shed',
      title: 'MotoVault vs Moto Shed',
      description: 'Simple service logger vs full motorcycle companion platform.',
    },
    {
      href: '/compare/motovault-vs-motoscan',
      title: 'MotoVault vs MotoScan',
      description: 'AI diagnostics vs hardware OBD-II scanning.',
    },
  ],
};

export default async function VsMotorManagePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('VsMotorManage');

  const canonical = getCanonicalUrl(locale, '/compare/motovault-vs-motormanage');

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
      pageKey: '/compare/motovault-vs-motormanage',
    }),
    buildBreadcrumbList(
      [
        { name: 'Home', url: getCanonicalUrl(locale) },
        { name: 'Compare', url: getCanonicalUrl(locale, '/compare') },
        { name: 'MotoVault vs MotorManage', url: canonical },
      ],
      locale,
      '/compare/motovault-vs-motormanage',
    ),
    buildFAQPage(faqItems, `${locale}/compare/motovault-vs-motormanage/faq`),
  );

  return (
    <>
      <JsonLdGraph nodes={graph} />
      <VsComparePage {...CONFIG} />
    </>
  );
}
