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
  const t = await getTranslations('VsMotoShed');
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: getCanonicalUrl(locale, '/compare/motovault-vs-moto-shed'),
      languages: getHreflangMap('/compare/motovault-vs-moto-shed'),
    },
  };
}

const CONFIG: VsComparePageConfig = {
  namespace: 'VsMotoShed',
  competitorName: 'Moto Shed',
  breadcrumbLabel: 'MotoVault vs Moto Shed',
  titleKey: 'h1',
  subtitleKey: 'subtitle',
  appDescriptions: true,
  comparison: {
    keyStyle: 'nested',
    marks: [
      { mv: 'yes', comp: 'yes' }, // maintenance tracking
      { mv: 'yes', comp: 'yes' }, // expense logging
      { mv: 'yes', comp: 'yes' }, // service reminders
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
  sources: {
    headingKey: 'sourcesHeading',
    noteKey: 'sourcesNote',
    links: [
      {
        labelKey: 'sourceAppStore',
        href: 'https://apps.apple.com/us/app/moto-shed-bike-maintenance/id6758318635',
      },
      {
        labelKey: 'sourceGooglePlay',
        href: 'https://play.google.com/store/apps/details?id=com.bikeshed.maintenance',
      },
      { labelKey: 'sourceDeveloper', href: 'https://toddclement.net/moto-shed.html' },
    ],
  },
  verdict: { titleKey: 'verdictHeading', bodyKey: 'verdictText' },
  faqCount: 4,
  related: ['motormanage', 'ridelog'],
};

export default async function VsMotoShedPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('VsMotoShed');

  const canonical = getCanonicalUrl(locale, '/compare/motovault-vs-moto-shed');

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
      pageKey: '/compare/motovault-vs-moto-shed',
    }),
    buildBreadcrumbList(
      [
        { name: 'Home', url: getCanonicalUrl(locale) },
        { name: 'Compare', url: getCanonicalUrl(locale, '/compare') },
        { name: 'MotoVault vs Moto Shed', url: canonical },
      ],
      locale,
      '/compare/motovault-vs-moto-shed',
    ),
    buildFAQPage(faqItems, `${locale}/compare/motovault-vs-moto-shed/faq`),
  );

  return (
    <>
      <JsonLdGraph nodes={graph} />
      <VsComparePage {...CONFIG} />
    </>
  );
}
