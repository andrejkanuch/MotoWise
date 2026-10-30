import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { FeatureCta } from '@/components/marketing/feature-cta';
import { FeatureScreenshotPair } from '@/components/marketing/feature-screenshot';
import { JsonLdGraph } from '@/components/marketing/json-ld-graph';
import { Link } from '@/i18n/navigation';
import { getCanonicalUrl } from '@/lib/constants';
import { buildBreadcrumbList, buildFAQPage, buildGraph, buildWebPage } from '@/lib/seo/schema';

/** One entry of the feature list. A description is optional for catalogue rows. */
export interface FeatureItem {
  title: string;
  desc?: string;
}

/** One step of a flow. Steps are the one list the template numbers: the order carries meaning. */
export interface FeatureStep {
  title: string;
  body: string;
}

/** One editorial section of the long-form read. A body can run several paragraphs. */
export interface FeatureSection {
  title: string;
  body: string | string[];
}

export interface FeatureFaqItem {
  question: string;
  answer: string;
}

/** A block unique to one page (a depiction of the app, a curriculum, a sample result). */
export interface FeatureDemo {
  title: string;
  body?: string;
  content: ReactNode;
  /** Render the content full-width beneath the copy instead of beside it. */
  wide?: boolean;
}

/** A small comparison table: the first column names the row. */
export interface FeatureTable {
  title: string;
  body?: string;
  columns: string[];
  rows: string[][];
}

/** The sibling feature pages a page can point to. Titles come from `FeaturesIndex`. */
export type FeatureRoute =
  | '/features/trip-planning'
  | '/features/ai-diagnostics'
  | '/features/garage-management'
  | '/features/learning-paths'
  | '/features/maintenance'
  | '/features/expense-tracking'
  | '/features/ride-tracking';

const FEATURE_ROUTE_TITLE_KEY: Record<FeatureRoute, string> = {
  '/features/trip-planning': 'tripPlanningTitle',
  '/features/ai-diagnostics': 'diagnosticsTitle',
  '/features/garage-management': 'garageTitle',
  '/features/learning-paths': 'learningTitle',
  '/features/maintenance': 'maintenanceTitle',
  '/features/expense-tracking': 'expensesTitle',
  '/features/ride-tracking': 'ridesTitle',
};

const DEFAULT_FAQ_COUNT = 4;

interface FeatureContentPageProps {
  locale: string;
  namespace: string;
  route: FeatureRoute;
  /** First entry fills the page's one phone frame; the second is cropped onto a panel. */
  screenshots: { src: string; alt: string }[];
  /** An app object (a Bike Plate, a route) that sits beside the headline. */
  heroVisual?: ReactNode;
  /** Defaults to `featuresTitle` + `f1…f3` keys of the namespace. */
  features?: { title: string; items: FeatureItem[] };
  steps?: { title: string; items: FeatureStep[] };
  demo?: FeatureDemo;
  table?: FeatureTable;
  /** Defaults to `longFormTitle`, `longFormIntro` + `s1…s3` keys of the namespace. */
  longForm?: { title: string; intro: string; sections: FeatureSection[] };
  /** Defaults to `faq.0…faq.3` of the namespace. */
  faqItems?: FeatureFaqItem[];
  related?: FeatureRoute[];
}

const H2_STYLE = {
  margin: 0,
  fontSize: 'clamp(34px, 4.2vw, 56px)',
  fontWeight: 700,
  lineHeight: 1.02,
  color: 'var(--mv-ink)',
  textWrap: 'balance',
} as const;

const H3_STYLE = {
  margin: 0,
  fontSize: '19px',
  fontWeight: 600,
  lineHeight: 1.3,
  color: 'var(--mv-ink)',
  letterSpacing: '-0.005em',
} as const;

const BODY_STYLE = {
  margin: 0,
  fontSize: '16px',
  lineHeight: 1.65,
  color: 'var(--mv-ink-2)',
} as const;

const LINK_STYLE = {
  color: 'var(--mv-copper-text)',
  textDecoration: 'underline',
  textUnderlineOffset: '4px',
} as const;

function ArrowIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function Paragraphs({ body, style }: { body: string | string[]; style: typeof BODY_STYLE }) {
  const paragraphs = Array.isArray(body) ? body : [body];
  return (
    <>
      {paragraphs.map((paragraph, index) => (
        <p key={paragraph} style={{ ...style, marginTop: index === 0 ? '16px' : '20px' }}>
          {paragraph}
        </p>
      ))}
    </>
  );
}

/**
 * The shared feature-page template in the Trackside voice. One file lays out
 * all seven feature pages: a condensed headline on the ground, the page's one
 * phone frame beside a cropped panel, a plain feature list, and the long-form
 * read on the deeper ramp step. Pages with a flow, a unique depiction or a
 * comparison pass those in as slots; nothing is wrapped in a card, numbers
 * appear only where the order means something (steps), and copper is spent on
 * links and the closing primary action alone. Every colour is a `--mv-*` token,
 * so both schemes work.
 */
export async function FeatureContentPage({
  locale,
  namespace,
  route,
  screenshots,
  heroVisual,
  features,
  steps,
  demo,
  table,
  longForm,
  faqItems: faqItemsProp,
  related = [],
}: FeatureContentPageProps) {
  const t = await getTranslations(namespace);
  // The /compare inbound link and the sibling-feature titles live in their own
  // namespaces so the copy is written once, not per feature.
  const tCompare = await getTranslations('Compare');
  const tIndex = await getTranslations('FeaturesIndex');
  const canonical = getCanonicalUrl(locale, route);

  const faqItems =
    faqItemsProp ??
    Array.from({ length: DEFAULT_FAQ_COUNT }, (_, i) => ({
      question: t(`faq.${i}.question`),
      answer: t(`faq.${i}.answer`),
    }));

  const featureBlock = features ?? {
    title: t('featuresTitle'),
    items: [1, 2, 3].map((i) => ({ title: t(`f${i}Title`), desc: t(`f${i}Desc`) })),
  };

  const longFormBlock = longForm ?? {
    title: t('longFormTitle'),
    intro: t('longFormIntro'),
    sections: [1, 2, 3].map((i) => ({ title: t(`s${i}Title`), body: t(`s${i}Body`) })),
  };

  const breadcrumbTitle = t.has('breadcrumbTitle') ? t('breadcrumbTitle') : t('title');

  const graph = buildGraph(
    buildWebPage({
      url: canonical,
      name: t('title'),
      description: t('description'),
      locale,
      pageKey: route,
    }),
    buildBreadcrumbList(
      [
        { name: 'Home', url: getCanonicalUrl(locale) },
        { name: 'Features', url: getCanonicalUrl(locale, '/features') },
        { name: t('title'), url: canonical },
      ],
      locale,
      route,
    ),
    buildFAQPage(faqItems, `${locale}${route}/faq`),
  );

  const wideFeatureList = featureBlock.items.length > 4;

  return (
    <>
      <JsonLdGraph nodes={graph} />

      {/* Hero: breadcrumb + condensed headline on the ground, an app object beside it when the page has one */}
      <header className="mv-section-hero" style={{ paddingTop: '128px', paddingBottom: '64px' }}>
        <div style={{ maxWidth: 'var(--mv-container)', margin: '0 auto' }}>
          <nav aria-label="Breadcrumb" style={{ marginBottom: '40px' }}>
            <ol
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '10px',
                listStyle: 'none',
                margin: 0,
                padding: 0,
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--mv-ink-3)',
              }}
            >
              <li>
                <Link href="/" style={{ color: 'var(--mv-ink-3)', textDecoration: 'none' }}>
                  {t('breadcrumbHome')}
                </Link>
              </li>
              <li aria-hidden="true" style={{ color: 'var(--mv-ink-4)' }}>
                /
              </li>
              <li>
                <Link href="/features" style={{ color: 'var(--mv-ink-3)', textDecoration: 'none' }}>
                  {t('breadcrumbFeatures')}
                </Link>
              </li>
              <li aria-hidden="true" style={{ color: 'var(--mv-ink-4)' }}>
                /
              </li>
              <li>
                <span aria-current="page" style={{ color: 'var(--mv-ink)' }}>
                  {breadcrumbTitle}
                </span>
              </li>
            </ol>
          </nav>

          <div
            className={heroVisual ? 'grid gap-12 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]' : ''}
            style={{ alignItems: 'end' }}
          >
            <div>
              <h1 className="mv-section-title" style={{ maxWidth: '14ch', textWrap: 'balance' }}>
                {t('heroTitle')}
              </h1>
              <p className="mv-section-sub">{t('heroSubtitle')}</p>
            </div>
            {heroVisual ? (
              <div style={{ maxWidth: '440px', width: '100%' }} className="md:justify-self-end">
                {heroVisual}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {/* The page's one authored moment: the phone frame and its panel rise in */}
      <FeatureScreenshotPair screenshots={screenshots} />

      {/* Feature list: a plain hairline list on the ground. Short lists sit
          beside their title; catalogues of five or more run in two columns. */}
      <section className="mv-section" style={{ paddingTop: '120px', paddingBottom: '120px' }}>
        <div
          className={
            wideFeatureList ? '' : 'grid gap-12 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]'
          }
          style={{ alignItems: 'start' }}
        >
          <h2 style={{ ...H2_STYLE, maxWidth: '18ch' }} className="mv-display">
            {featureBlock.title}
          </h2>
          <ul
            className={wideFeatureList ? 'grid md:grid-cols-2 md:gap-x-20' : ''}
            style={{
              listStyle: 'none',
              margin: wideFeatureList ? '48px 0 0' : 0,
              padding: 0,
              borderBottom: '1px solid var(--mv-line)',
            }}
          >
            {featureBlock.items.map((item) => (
              <li
                key={item.title}
                style={{ padding: '22px 0', borderTop: '1px solid var(--mv-line)' }}
              >
                <h3 style={{ ...H3_STYLE, fontSize: '17px' }}>{item.title}</h3>
                {item.desc ? (
                  <p
                    style={{
                      ...BODY_STYLE,
                      marginTop: '8px',
                      fontSize: '15px',
                      lineHeight: 1.6,
                      maxWidth: '56ch',
                    }}
                  >
                    {item.desc}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Steps: the one numbered list, because the order is the point */}
      {steps ? (
        <section style={{ background: 'var(--mv-bg-2)' }}>
          <div className="mv-section-inner">
            <h2 style={{ ...H2_STYLE, maxWidth: '20ch' }} className="mv-display">
              {steps.title}
            </h2>
            <ol
              style={{
                listStyle: 'none',
                margin: '56px 0 0',
                padding: 0,
                borderBottom: '1px solid var(--mv-line)',
              }}
            >
              {steps.items.map((step, index) => (
                <li
                  key={step.title}
                  className="grid gap-x-10 gap-y-3 md:grid-cols-[64px_minmax(0,5fr)_minmax(0,7fr)]"
                  style={{ padding: '28px 0', borderTop: '1px solid var(--mv-line)' }}
                >
                  <span
                    className="mv-figure"
                    aria-hidden="true"
                    style={{ fontSize: '40px', lineHeight: 1, color: 'var(--mv-ink-3)' }}
                  >
                    {index + 1}
                  </span>
                  <h3 style={{ ...H3_STYLE, fontSize: '20px' }}>{step.title}</h3>
                  <p style={{ ...BODY_STYLE, fontSize: '15px', maxWidth: '58ch' }}>{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : null}

      {/* Demo: the block unique to this page, restyled to tokens */}
      {demo ? (
        <section className="mv-section" style={{ paddingTop: '120px', paddingBottom: '120px' }}>
          <div
            className={demo.wide ? '' : 'grid gap-12 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]'}
            style={{ alignItems: 'center' }}
          >
            <div style={{ maxWidth: '520px' }}>
              <h2 style={{ ...H2_STYLE, maxWidth: '16ch' }} className="mv-display">
                {demo.title}
              </h2>
              {demo.body ? (
                <p style={{ ...BODY_STYLE, marginTop: '20px', fontSize: '17px' }}>{demo.body}</p>
              ) : null}
            </div>
            <div style={{ marginTop: demo.wide ? '48px' : 0, minWidth: 0 }}>{demo.content}</div>
          </div>
        </section>
      ) : null}

      {/* Comparison table: hairline rows, the first column names the row */}
      {table ? (
        <section
          className="mv-section"
          style={{ paddingTop: demo ? 0 : '120px', paddingBottom: '120px' }}
        >
          <div style={{ maxWidth: '820px' }}>
            <h2 style={{ ...H2_STYLE, maxWidth: '16ch' }} className="mv-display">
              {table.title}
            </h2>
            {table.body ? (
              <p style={{ ...BODY_STYLE, marginTop: '20px', fontSize: '17px', maxWidth: '56ch' }}>
                {table.body}
              </p>
            ) : null}
          </div>
          <div style={{ marginTop: '40px', overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                minWidth: '560px',
                borderCollapse: 'collapse',
                fontSize: '15px',
                lineHeight: 1.5,
                color: 'var(--mv-ink-2)',
              }}
            >
              <thead>
                <tr>
                  {table.columns.map((column) => (
                    <th
                      key={column}
                      scope="col"
                      style={{
                        textAlign: 'left',
                        fontWeight: 500,
                        fontSize: '13px',
                        color: 'var(--mv-ink-3)',
                        padding: '0 24px 14px 0',
                        borderBottom: '1px solid var(--mv-line)',
                      }}
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map(([head, ...cells]) => (
                  <tr key={head}>
                    <th
                      scope="row"
                      style={{
                        textAlign: 'left',
                        fontWeight: 600,
                        color: 'var(--mv-ink)',
                        padding: '18px 24px 18px 0',
                        borderBottom: '1px solid var(--mv-line)',
                        verticalAlign: 'top',
                      }}
                    >
                      {head}
                    </th>
                    {cells.map((cell) => (
                      <td
                        key={cell}
                        style={{
                          padding: '18px 24px 18px 0',
                          borderBottom: '1px solid var(--mv-line)',
                          verticalAlign: 'top',
                        }}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* Long-form: the deeper ramp step carries the editorial read; the band
          itself separates, so no dividers inside. */}
      <section style={{ background: 'var(--mv-bg-2)' }}>
        <div className="mv-section-inner">
          <div style={{ maxWidth: '820px' }}>
            <h2 className="mv-display" style={H2_STYLE}>
              {longFormBlock.title}
            </h2>
            <p style={{ ...BODY_STYLE, marginTop: '28px', fontSize: '18px', lineHeight: 1.6 }}>
              {longFormBlock.intro}
            </p>
            {longFormBlock.sections.map((section) => (
              <div key={section.title} style={{ marginTop: '64px' }}>
                <h3 style={H3_STYLE}>{section.title}</h3>
                <Paragraphs body={section.body} style={BODY_STYLE} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ: hairline <details> rows directly on the page surface */}
      <section className="mv-section" style={{ paddingTop: '120px', paddingBottom: '120px' }}>
        <div style={{ maxWidth: '820px' }}>
          <h2 className="mv-display" style={H2_STYLE}>
            {t('faqTitle')}
          </h2>
          <div style={{ marginTop: '40px', borderBottom: '1px solid var(--mv-line)' }}>
            {faqItems.map(({ question, answer }, index) => (
              <details
                key={question}
                className="group"
                open={index === 0}
                style={{ borderTop: '1px solid var(--mv-line)' }}
              >
                <summary
                  className="[&::-webkit-details-marker]:hidden"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '20px 0',
                    minHeight: '44px',
                    cursor: 'pointer',
                    listStyle: 'none',
                  }}
                >
                  <span
                    style={{
                      fontSize: '17px',
                      fontWeight: 500,
                      color: 'var(--mv-ink)',
                      letterSpacing: '-0.005em',
                    }}
                  >
                    {question}
                  </span>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="transition-transform duration-300 group-open:rotate-180"
                    style={{ marginLeft: 'auto', flexShrink: 0, color: 'var(--mv-ink-4)' }}
                    aria-hidden="true"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </summary>
                <p
                  style={{
                    ...BODY_STYLE,
                    padding: '0 40px 24px 0',
                    fontSize: '15px',
                    maxWidth: '64ch',
                  }}
                >
                  {answer}
                </p>
              </details>
            ))}
          </div>

          <p style={{ margin: '40px 0 0', fontSize: '15px', color: 'var(--mv-ink-3)' }}>
            {t('faqMore')}{' '}
            <Link href="/support" style={LINK_STYLE}>
              {t('faqSupportLink')}
            </Link>
          </p>
          {/* Hub-and-spoke inbound link: every feature page feeds the /compare
              money page for internal-link equity + discovery. */}
          <p style={{ margin: '12px 0 0', fontSize: '15px' }}>
            <Link
              href="/compare"
              style={{
                ...LINK_STYLE,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 500,
              }}
            >
              {tCompare('compareInboundLink')}
              <ArrowIcon />
            </Link>
          </p>
        </div>

        {related.length > 0 ? (
          <div style={{ marginTop: '96px' }}>
            <h2
              style={{ ...H3_STYLE, fontSize: '15px', color: 'var(--mv-ink-3)', fontWeight: 500 }}
            >
              {tIndex('relatedTitle')}
            </h2>
            <ul
              className="grid md:grid-cols-2 md:gap-x-20"
              style={{
                listStyle: 'none',
                margin: '16px 0 0',
                padding: 0,
                borderBottom: '1px solid var(--mv-line)',
              }}
            >
              {related.map((href) => (
                <li key={href} style={{ borderTop: '1px solid var(--mv-line)' }}>
                  <Link
                    href={href}
                    className="mv-display"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '16px',
                      padding: '24px 0',
                      fontSize: 'clamp(26px, 2.6vw, 34px)',
                      fontWeight: 600,
                      lineHeight: 1.05,
                      color: 'var(--mv-ink)',
                      textDecoration: 'none',
                    }}
                  >
                    {tIndex(FEATURE_ROUTE_TITLE_KEY[href])}
                    <span style={{ color: 'var(--mv-copper-text)', display: 'inline-flex' }}>
                      <ArrowIcon />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <FeatureCta />
    </>
  );
}
