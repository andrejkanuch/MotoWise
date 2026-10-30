import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  CompareBreadcrumb,
  CompareFaq,
  CompareLinkList,
  CompareStyles,
} from '@/components/marketing/compare-page';
import { FeatureCta } from '@/components/marketing/feature-cta';
import { JsonLdGraph } from '@/components/marketing/json-ld-graph';
import { getCanonicalUrl, getHreflangMap } from '@/lib/constants';
import { CtaPageType } from '@/lib/cta-taxonomy';
import { buildBreadcrumbList, buildFAQPage, buildGraph, buildWebPage } from '@/lib/seo/schema';

export const revalidate = 604800; // 7 days — repo-sourced, rebuilds on deploy

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('CompareAlternatives');
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: getCanonicalUrl(locale, '/compare/alternatives'),
      languages: getHreflangMap('/compare/alternatives'),
    },
  };
}

const ALT_INDICES = [0, 1, 2, 3, 4, 5] as const;
const BEST_FOR_INDICES = [0, 1, 2, 3, 4] as const;
const PRICING_ROWS = [0, 1, 2, 3, 4] as const;
const SWITCH_INDICES = [0, 1, 2, 3] as const;
const FAQ_INDICES = [0, 1, 2, 3] as const;

export default async function AlternativesPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('CompareAlternatives');

  const canonical = getCanonicalUrl(locale, '/compare/alternatives');

  const faqItems = FAQ_INDICES.map((i) => ({
    question: t(`faq.${i}.question`),
    answer: t(`faq.${i}.answer`),
  }));

  const graph = buildGraph(
    buildWebPage({
      url: canonical,
      name: t('title'),
      description: t('description'),
      locale,
      pageKey: '/compare/alternatives',
    }),
    buildBreadcrumbList(
      [
        { name: 'Home', url: getCanonicalUrl(locale) },
        { name: 'Compare', url: getCanonicalUrl(locale, '/compare') },
        { name: 'Alternatives', url: canonical },
      ],
      locale,
      '/compare/alternatives',
    ),
    buildFAQPage(faqItems, `${locale}/compare/alternatives/faq`),
  );

  return (
    <div className="mv-cmp-page">
      <CompareStyles />
      <JsonLdGraph nodes={graph} />

      {/* Hero */}
      <header className="mv-cmp-wrap pt-28 md:pt-32">
        <CompareBreadcrumb current={t('breadcrumbLabel')} />
        <h1 className="mv-cmp-h1 mt-8">{t('heroTitle')}</h1>
        <p className="mv-cmp-lede mt-6">{t('heroSubtitle')}</p>
        <p className="mv-cmp-meta mt-4">{t('updatedAt')}</p>
      </header>

      {/* Pick by priority: how we tested, then one entry per priority.
          The reveal is this page's one authored entrance. */}
      <section className="mv-cmp-wrap pt-16 md:pt-20">
        <h2 className="mv-cmp-h2">{t('bestForTitle')}</h2>
        <p className="mv-cmp-note mt-4">{t('testingPreamble')}</p>
        <ul className="mv-cmp-list mv-reveal mt-8">
          {BEST_FOR_INDICES.map((i) => (
            <li key={i} className="py-6">
              <h3 className="mv-cmp-sub">{t(`bestFor${i}Title`)}</h3>
              <p className="mv-cmp-body mt-2" style={{ fontSize: 15 }}>
                {t(`bestFor${i}Body`)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* Pricing snapshot: hairline table, condensed figures */}
      <section className="mv-cmp-wrap pt-20 md:pt-28">
        <h2 className="mv-cmp-h2">{t('pricingTableTitle')}</h2>
        <div className="mt-8 overflow-x-auto">
          <table className="mv-cmp-table" style={{ minWidth: 720 }}>
            <thead>
              <tr>
                <th scope="col">{t('pricingHeaderApp')}</th>
                <th scope="col">{t('pricingHeaderFree')}</th>
                <th scope="col">{t('pricingHeaderPaid')}</th>
                <th scope="col">{t('pricingHeaderNotes')}</th>
              </tr>
            </thead>
            <tbody>
              {PRICING_ROWS.map((i) => (
                <tr key={i}>
                  <th scope="row" className="is-row">
                    {t(`pricingRow${i}App`)}
                  </th>
                  <td className="is-figure is-comp">{t(`pricingRow${i}Free`)}</td>
                  <td className="is-figure">{t(`pricingRow${i}Paid`)}</td>
                  <td className="is-note">{t(`pricingRow${i}Notes`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Alternatives to each popular app */}
      <section className="mv-cmp-wrap pt-20 md:pt-28">
        <h2 className="mv-cmp-h2">{t('altToTitle')}</h2>
        <p className="mv-cmp-note mt-4">{t('altToSubtitle')}</p>
        <div className="mt-8" style={{ borderBottom: '1px solid var(--mv-line)' }}>
          {ALT_INDICES.map((i) => (
            <article
              key={i}
              id={t(`alt${i}.appName`).toLowerCase().replace(/\s+/g, '-')}
              className="grid gap-x-10 gap-y-3 py-8 md:grid-cols-[240px_1fr]"
              style={{ borderTop: '1px solid var(--mv-line)' }}
            >
              <h3 className="mv-cmp-h3">{t(`alt${i}.title`)}</h3>
              <div>
                <p className="mv-cmp-body" style={{ fontSize: 15 }}>
                  {t(`alt${i}.why`)}
                </p>
                <p className="mv-cmp-body mt-3" style={{ fontSize: 15 }}>
                  <strong style={{ color: 'var(--mv-ink)', fontWeight: 600 }}>
                    {t('considerLabel')}
                  </strong>{' '}
                  {t(`alt${i}.consider`)}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* When a specialist wins */}
      <section className="mv-cmp-wrap pt-20 md:pt-28">
        <h2 className="mv-cmp-h2">{t('whenToChooseCompetitorTitle')}</h2>
        <p className="mv-cmp-body mt-5">{t('whenToChooseCompetitor')}</p>
      </section>

      {/* Why riders switch: four reasons, two columns */}
      <section className="mv-cmp-wrap pt-20 md:pt-28">
        <h2 className="mv-cmp-h2">{t('switchTitle')}</h2>
        <p className="mv-cmp-note mt-4">{t('switchSubtitle')}</p>
        <div className="mt-10 grid gap-x-12 gap-y-8 sm:grid-cols-2">
          {SWITCH_INDICES.map((i) => (
            <div key={i} className="pt-4" style={{ borderTop: '1px solid var(--mv-line)' }}>
              <h3 className="mv-cmp-sub">{t(`switch${i}.title`)}</h3>
              <p className="mv-cmp-body is-full mt-2" style={{ fontSize: 15 }}>
                {t(`switch${i}.description`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Related comparisons */}
      <section className="mv-cmp-wrap pt-20 md:pt-28">
        <CompareLinkList ids={['maintVsRide', 'rever', 'ridelog', 'calimoto']} />
      </section>

      {/* FAQ */}
      <section className="mv-cmp-wrap py-20 md:py-28">
        <CompareFaq items={faqItems} />
      </section>

      <FeatureCta pageType={CtaPageType.Compare} />
    </div>
  );
}
