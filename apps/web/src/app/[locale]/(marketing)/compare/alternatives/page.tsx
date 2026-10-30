import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  CompareBreadcrumb,
  CompareFaq,
  CompareRelatedLinks,
  compareBodyStyle,
  compareH1Style,
  compareH2Style,
  compareH3Style,
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

const RELATED_LINKS = [
  {
    href: '/compare',
    title: 'Best Motorcycle Apps 2026',
    description: 'Full feature matrix and ranking of 10 motorcycle apps.',
  },
  {
    href: '/compare/maintenance-vs-ride-apps',
    title: 'Maintenance Apps vs. Ride Trackers',
    description: 'Two categories, two jobs. Do you need both?',
  },
] as const;

const thStyle = {
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--mv-ink-3)',
  textAlign: 'left',
  padding: '0 20px 10px 0',
  borderBottom: '1px solid var(--mv-line-step)',
  whiteSpace: 'nowrap',
} as const;

const tdStyle = {
  fontSize: 14,
  lineHeight: 1.5,
  padding: '13px 20px 13px 0',
  borderBottom: '1px solid var(--mv-line)',
  verticalAlign: 'top',
} as const;

/** Price cells: condensed tabular figures. */
const priceCellStyle = {
  ...tdStyle,
  fontFamily: 'var(--mv-font-display)',
  fontWeight: 500,
  fontVariantNumeric: 'tabular-nums',
  fontSize: 15,
  color: 'var(--mv-ink)',
} as const;

export default async function AlternativesPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('CompareAlternatives');

  const canonical = getCanonicalUrl(locale, '/compare/alternatives');

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
    <>
      <JsonLdGraph nodes={graph} />

      {/* Hero — one condensed H1, left-aligned */}
      <header className="mx-auto max-w-5xl px-6 pt-28 md:pt-32">
        <CompareBreadcrumb
          items={[
            { label: 'Home', href: '/' },
            { label: 'Compare', href: '/compare' },
            { label: 'Alternatives' },
          ]}
        />
        <h1 className="mt-8" style={compareH1Style}>
          {t('heroTitle')}
        </h1>
        <p className="mt-6" style={{ ...compareBodyStyle, fontSize: 17, maxWidth: '58ch' }}>
          {t('heroSubtitle')}
        </p>
        <p className="mt-3" style={{ fontSize: 13, color: 'var(--mv-ink-4)' }}>
          {t('updatedAt')}
        </p>
      </header>

      {/* Best-for guide — hairline list, no cards */}
      <section className="mx-auto max-w-5xl px-6 pt-16 md:pt-20">
        <h2 style={compareH2Style}>{t('bestForTitle')}</h2>
        <p className="mt-4" style={{ ...compareBodyStyle, fontSize: 14, color: 'var(--mv-ink-3)' }}>
          {t('testingPreamble')}
        </p>
        <div className="mt-8" style={{ borderBottom: '1px solid var(--mv-line)' }}>
          {BEST_FOR_INDICES.map((i) => (
            <article key={i} className="py-6" style={{ borderTop: '1px solid var(--mv-line)' }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--mv-ink)', margin: 0 }}>
                {t(`bestFor${i}Title`)}
              </h3>
              <p className="mt-2" style={{ ...compareBodyStyle, fontSize: 15 }}>
                {t(`bestFor${i}Body`)}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Pricing snapshot — hairline table, condensed figures */}
      <section className="mx-auto max-w-5xl px-6 pt-20 md:pt-28">
        <h2 style={compareH2Style}>{t('pricingTableTitle')}</h2>
        <div className="mt-8 overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: 720 }}>
            <thead>
              <tr>
                <th style={thStyle}>{t('pricingHeaderApp')}</th>
                <th style={thStyle}>{t('pricingHeaderFree')}</th>
                <th style={thStyle}>{t('pricingHeaderPaid')}</th>
                <th style={thStyle}>{t('pricingHeaderNotes')}</th>
              </tr>
            </thead>
            <tbody>
              {PRICING_ROWS.map((i) => (
                <tr key={i}>
                  <td style={{ ...tdStyle, color: 'var(--mv-ink)', fontWeight: 500 }}>
                    {t(`pricingRow${i}App`)}
                  </td>
                  <td style={{ ...priceCellStyle, color: 'var(--mv-ink-2)' }}>
                    {t(`pricingRow${i}Free`)}
                  </td>
                  <td style={priceCellStyle}>{t(`pricingRow${i}Paid`)}</td>
                  <td style={{ ...tdStyle, color: 'var(--mv-ink-3)' }}>
                    {t(`pricingRow${i}Notes`)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Alternatives to popular apps — hairline articles */}
      <section className="mx-auto max-w-5xl px-6 pt-20 md:pt-28">
        <h2 style={compareH2Style}>{t('altToTitle')}</h2>
        <p className="mt-4" style={{ ...compareBodyStyle, fontSize: 15, color: 'var(--mv-ink-3)' }}>
          {t('altToSubtitle')}
        </p>
        <div className="mt-8" style={{ borderBottom: '1px solid var(--mv-line)' }}>
          {ALT_INDICES.map((i) => (
            <article
              key={i}
              id={t(`alt${i}.appName`).toLowerCase().replace(/\s+/g, '-')}
              className="py-8"
              style={{ borderTop: '1px solid var(--mv-line)' }}
            >
              <h3 style={compareH3Style}>{t(`alt${i}.title`)}</h3>
              <p className="mt-3" style={{ ...compareBodyStyle, fontSize: 15 }}>
                {t(`alt${i}.why`)}
              </p>
              <p className="mt-3" style={{ ...compareBodyStyle, fontSize: 15 }}>
                <strong style={{ color: 'var(--mv-ink)', fontWeight: 600 }}>
                  Consider MotoVault
                </strong>{' '}
                — {t(`alt${i}.consider`)}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* When a specialist wins */}
      <section className="mx-auto max-w-5xl px-6 pt-20 md:pt-28">
        <h2 style={compareH2Style}>{t('whenToChooseCompetitorTitle')}</h2>
        <p className="mt-5" style={compareBodyStyle}>
          {t('whenToChooseCompetitor')}
        </p>
      </section>

      {/* Why riders switch — plain two-column grid */}
      <section className="mx-auto max-w-5xl px-6 pt-20 md:pt-28">
        <h2 style={compareH2Style}>{t('switchTitle')}</h2>
        <p className="mt-4" style={{ ...compareBodyStyle, fontSize: 15, color: 'var(--mv-ink-3)' }}>
          {t('switchSubtitle')}
        </p>
        <div className="mt-10 grid gap-x-12 gap-y-8 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="pt-4" style={{ borderTop: '1px solid var(--mv-line)' }}>
              <h3
                className="flex items-baseline gap-3"
                style={{ fontSize: 15, fontWeight: 600, color: 'var(--mv-ink)', margin: 0 }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    fontFamily: 'var(--mv-font-display)',
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                    fontSize: 18,
                    color: 'var(--mv-ink-4)',
                  }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                {t(`switch${i}.title`)}
              </h3>
              <p className="mt-2" style={{ ...compareBodyStyle, fontSize: 14, maxWidth: 'none' }}>
                {t(`switch${i}.description`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Related comparisons — plain links */}
      <section className="mx-auto max-w-5xl px-6 pt-20 md:pt-28">
        <CompareRelatedLinks links={RELATED_LINKS} />
      </section>

      {/* FAQ — hairline details */}
      <section className="mx-auto max-w-5xl px-6 py-20 md:py-28">
        <h2 style={compareH2Style}>Frequently asked questions</h2>
        <div className="mt-8" style={{ maxWidth: 760 }}>
          <CompareFaq items={faqItems} />
        </div>
      </section>

      <FeatureCta pageType={CtaPageType.Compare} />
    </>
  );
}
