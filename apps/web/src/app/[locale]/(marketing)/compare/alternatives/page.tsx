import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  COMPARE_CHECKED_DATE,
  COMPARE_SECTION,
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

  const dated = { date: COMPARE_CHECKED_DATE };

  return (
    <div className="mv-cmp-page">
      <CompareStyles />
      <JsonLdGraph nodes={graph} />

      {/* Hero: the check date is printed once, under the next heading */}
      <header className={`mv-cmp-wrap ${COMPARE_SECTION.header}`}>
        <CompareBreadcrumb current={t('breadcrumbLabel')} />
        <h1 className="mv-section-title">{t('heroTitle')}</h1>
        <p className="mv-section-sub">{t('heroSubtitle')}</p>
      </header>

      {/* Pick by priority: how it was checked, then one hairline row per
          priority. First viewport, so no entrance. */}
      <section className={`mv-cmp-wrap ${COMPARE_SECTION.prose}`}>
        <h2 className="mv-h2">{t('bestForTitle')}</h2>
        <p className="mv-cmp-note mt-4">{t('testingPreamble', dated)}</p>
        <ul className="mv-rows mt-8">
          {BEST_FOR_INDICES.map((i) => (
            <li key={i} className="mv-row mv-cmp-grid-row md:grid-cols-[240px_1fr]">
              <h3 className="mv-cmp-sub">{t(`bestFor${i}Title`)}</h3>
              <p className="mv-cmp-body is-compact is-full">{t(`bestFor${i}Body`)}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Pricing snapshot: hairline table, condensed figures */}
      <section className={`mv-cmp-wrap ${COMPARE_SECTION.weight}`}>
        <h2 className="mv-h2">{t('pricingTableTitle')}</h2>
        {/* biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be keyboard-reachable */}
        <section className="mv-cmp-tablewrap mt-8" tabIndex={0} aria-label={t('pricingTableTitle')}>
          <table className="mv-table mv-cmp-table" style={{ minWidth: 720 }}>
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
                  <th scope="row">{t(`pricingRow${i}App`)}</th>
                  <td className="mv-figure is-comp">{t(`pricingRow${i}Free`)}</td>
                  <td className="mv-figure">{t(`pricingRow${i}Paid`)}</td>
                  <td className="is-note">{t(`pricingRow${i}Notes`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </section>

      {/* Alternatives to each popular app */}
      <section className={`mv-cmp-wrap ${COMPARE_SECTION.prose}`}>
        <h2 className="mv-h2">{t('altToTitle')}</h2>
        <p className="mv-cmp-note mt-4">{t('altToSubtitle')}</p>
        <div className="mv-rows mt-8">
          {ALT_INDICES.map((i) => (
            <article
              key={i}
              id={t(`alt${i}.appName`).toLowerCase().replace(/\s+/g, '-')}
              className="mv-row mv-cmp-grid-row md:grid-cols-[240px_1fr]"
            >
              <h3 className="mv-h3">{t(`alt${i}.title`)}</h3>
              <div>
                <p className="mv-cmp-body is-compact">{t(`alt${i}.why`)}</p>
                <p className="mv-cmp-body is-compact mt-3">
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
      <section className={`mv-cmp-wrap ${COMPARE_SECTION.prose}`}>
        <h2 className="mv-h2">{t('whenToChooseCompetitorTitle')}</h2>
        <p className="mv-cmp-body mt-5">{t('whenToChooseCompetitor')}</p>
      </section>

      {/* What one app replaces: four jobs as hairline rows */}
      <section className={`mv-cmp-wrap ${COMPARE_SECTION.prose}`}>
        <h2 className="mv-h2">{t('switchTitle')}</h2>
        <p className="mv-cmp-note mt-4">{t('switchSubtitle')}</p>
        <ul className="mv-rows mt-10">
          {SWITCH_INDICES.map((i) => (
            <li key={i} className="mv-row mv-cmp-grid-row md:grid-cols-[240px_1fr]">
              <h3 className="mv-cmp-sub">{t(`switch${i}.title`)}</h3>
              <p className="mv-cmp-body is-compact is-full">{t(`switch${i}.description`)}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Related comparisons */}
      <section className={`mv-cmp-wrap ${COMPARE_SECTION.prose}`}>
        <CompareLinkList ids={['maintVsRide', 'rever', 'ridelog', 'calimoto']} />
      </section>

      {/* FAQ */}
      <section className={`mv-cmp-wrap ${COMPARE_SECTION.faq}`}>
        <CompareFaq items={faqItems} />
      </section>

      <FeatureCta pageType={CtaPageType.Compare} />
    </div>
  );
}
