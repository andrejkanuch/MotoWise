import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { JsonLd } from '@/components/marketing/json-ld';
import { routing } from '@/i18n/routing';
import { BASE_URL, getCanonicalUrl } from '@/lib/constants';
import { TclocsChecklist } from './tclocs-checklist';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('TclocsChecklist');
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: getCanonicalUrl(locale, '/tools/tclocs-checklist'),
      languages: Object.fromEntries([
        ...routing.locales.map((l) => [l, getCanonicalUrl(l, '/tools/tclocs-checklist')]),
        ['x-default', `${BASE_URL}/tools/tclocs-checklist`],
      ]),
    },
  };
}

export default async function TclocsChecklistPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('TclocsChecklist');

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Tools', item: `${BASE_URL}/tools` },
      {
        '@type': 'ListItem',
        position: 3,
        name: t('title'),
        item: `${BASE_URL}/tools/tclocs-checklist`,
      },
    ],
  };

  const categories = [
    {
      id: 'tires',
      letter: 'T',
      name: t('catTires'),
      items: [
        t('tirePressure'),
        t('tireTread'),
        t('tireCracks'),
        t('tireValves'),
        t('tireBearings'),
      ],
    },
    {
      id: 'controls',
      letter: 'C',
      name: t('catControls'),
      items: [
        t('controlFrontBrake'),
        t('controlRearBrake'),
        t('controlClutch'),
        t('controlThrottle'),
        t('controlHorn'),
      ],
    },
    {
      id: 'lights',
      letter: 'L',
      name: t('catLights'),
      items: [
        t('lightHeadlight'),
        t('lightTail'),
        t('lightBrake'),
        t('lightTurnSignals'),
        t('lightDashboard'),
      ],
    },
    {
      id: 'oil',
      letter: 'O',
      name: t('catOil'),
      items: [t('oilLevel'), t('oilLeaks'), t('oilColor'), t('oilCoolant')],
    },
    {
      id: 'chassis',
      letter: 'C',
      name: t('catChassis'),
      items: [t('chassisFrame'), t('chassisSuspension'), t('chassisFasteners'), t('chassisChain')],
    },
    {
      id: 'stands',
      letter: 'S',
      name: t('catStands'),
      items: [t('standsSide'), t('standsCenter'), t('standsSwitch')],
    },
  ];

  const labels = {
    overallProgress: t('overallProgress'),
    items: t('items'),
    readyToRide: t('readyToRide'),
    resetAll: t('resetAll'),
    printChecklist: t('printChecklist'),
    ctaTitle: t('ctaTitle'),
    ctaDesc: t('ctaDesc'),
    getEarlyAccess: t('getEarlyAccess'),
    timerTitle: t('timerTitle'),
    timerStart: t('timerStart'),
    timerRunning: t('timerRunning'),
    timerComplete: t('timerComplete'),
    personalBest: t('personalBest'),
    newRecord: t('newRecord'),
    noBestYet: t('noBestYet'),
    downloadPdf: t('downloadPdf'),
    pdfTitle: t('pdfTitle'),
    pdfDate: t('pdfDate'),
    pdfStatus: t('pdfStatus'),
    pdfComplete: t('pdfComplete'),
    pdfIncomplete: t('pdfIncomplete'),
    pdfFooter: t('pdfFooter'),
    pdfCta: t('pdfCta'),
    pdfWebsite: t('pdfWebsite'),
  };

  return (
    <>
      <JsonLd data={breadcrumbSchema} />

      {/* Hero */}
      <section className="px-4 pb-8 pt-24 md:pt-32">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-neutral-50 sm:text-5xl md:text-6xl">
            <span className="text-warm-400">{t('heroTitleAccent')}</span> {t('heroTitleRest')}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-400">
            {t('heroSubtitle')} <strong className="text-neutral-300">{t('heroCategories')}</strong>.
          </p>
        </div>
      </section>

      {/* Checklist */}
      <TclocsChecklist categories={categories} labels={labels} />

      {/* SEO Content */}
      <section className="px-4 py-16 print:hidden">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold text-neutral-50">{t('seoTitle')}</h2>
          <div className="mt-6 space-y-4 text-neutral-400">
            <p>{t('seoP1')}</p>
            <p>{t('seoP2')}</p>
            <p>{t('seoP3')}</p>
          </div>
        </div>
      </section>
    </>
  );
}
