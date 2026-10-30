import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { FeatureCta } from '@/components/marketing/feature-cta';
import { FeatureScreenshotPair } from '@/components/marketing/feature-screenshot';
import { JsonLdGraph } from '@/components/marketing/json-ld-graph';
import { StoreButtons } from '@/components/marketing/store-buttons';
import { Link } from '@/i18n/navigation';
import { getCanonicalUrl } from '@/lib/constants';
import { CtaPageType, CtaPlacement } from '@/lib/cta-taxonomy';
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

/** Reading copy: Body 17/1.6 on a 68ch measure. */
const BODY_STYLE = {
  margin: 0,
  fontSize: '17px',
  lineHeight: 1.6,
  color: 'var(--mv-ink-2)',
  maxWidth: '68ch',
  textWrap: 'pretty',
} as const;

/** Compact body for list rows, table cells and FAQ answers: 16/1.55. */
const BODY_COMPACT_STYLE = { ...BODY_STYLE, fontSize: '16px', lineHeight: 1.55 } as const;

/** Meta line: 13/18 500 in ink-3. */
const META_STYLE = {
  margin: 0,
  fontSize: '13px',
  lineHeight: '18px',
  fontWeight: 500,
  color: 'var(--mv-ink-3)',
} as const;

const PARAGRAPH_GAP = { first: '16px', rest: '24px' } as const;

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

function CrumbSeparator() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

function Paragraphs({ body }: { body: string | string[] }) {
  const paragraphs = Array.isArray(body) ? body : [body];
  return (
    <>
      {paragraphs.map((paragraph, index) => (
        <p
          key={paragraph}
          style={{
            ...BODY_STYLE,
            marginTop: index === 0 ? PARAGRAPH_GAP.first : PARAGRAPH_GAP.rest,
          }}
        >
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
 * links and the closing primary action alone. Every heading sits on the shared
 * scale (`.mv-section-title`, `.mv-h2`, `.mv-h3`), every hairline list is
 * `.mv-rows`, and the page runs on two rhythm intervals: 96 for the light
 * sections, 120–160 for the two deeper bands. Every colour is a `--mv-*`
 * token, so both schemes work.
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

      {/* Hero: breadcrumb, condensed headline, the lede and the store buttons
          on the ground; an app object beside it when the page has one */}
      <header className="mv-section-hero" style={{ paddingTop: '120px', paddingBottom: '64px' }}>
        <div style={{ maxWidth: 'var(--mv-container)', margin: '0 auto' }}>
          <nav aria-label="Breadcrumb" style={{ marginBottom: '40px' }}>
            <ol className="mv-crumbs" style={{ margin: 0 }}>
              <li>
                <Link href="/">{t('breadcrumbHome')}</Link>
              </li>
              <li>
                <CrumbSeparator />
                <Link href="/features">{t('breadcrumbFeatures')}</Link>
              </li>
              <li>
                <CrumbSeparator />
                <span aria-current="page">{breadcrumbTitle}</span>
              </li>
            </ol>
          </nav>

          <div
            className={heroVisual ? 'grid gap-12 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]' : ''}
            style={{ alignItems: 'end' }}
          >
            <div>
              <h1 className="mv-section-title" style={{ maxWidth: '14ch' }}>
                {t('heroTitle')}
              </h1>
              <p className="mv-section-sub">{t('heroSubtitle')}</p>
              <div style={{ marginTop: '32px' }}>
                <StoreButtons pageType={CtaPageType.Feature} placement={CtaPlacement.Hero} />
              </div>
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
      <section className="mv-section" style={{ paddingTop: '96px', paddingBottom: '96px' }}>
        <div
          className={
            wideFeatureList ? '' : 'grid gap-12 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]'
          }
          style={{ alignItems: 'start' }}
        >
          <h2 className="mv-h2" style={{ maxWidth: '18ch' }}>
            {featureBlock.title}
          </h2>
          <ul
            className={wideFeatureList ? 'mv-rows grid md:grid-cols-2 md:gap-x-20' : 'mv-rows'}
            style={{ marginTop: wideFeatureList ? '48px' : 0 }}
          >
            {featureBlock.items.map((item) => (
              <li key={item.title} className="mv-row" style={{ alignItems: 'start' }}>
                <div>
                  <h3 className="mv-h3">{item.title}</h3>
                  {item.desc ? (
                    <p style={{ ...BODY_COMPACT_STYLE, marginTop: '8px', maxWidth: '56ch' }}>
                      {item.desc}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Steps: the one numbered list, because the order is the point. The
          numeral stays a margin figure at every width. */}
      {steps ? (
        <section style={{ background: 'var(--mv-bg-2)' }}>
          <div className="mv-section-inner">
            <h2 className="mv-h2" style={{ maxWidth: '20ch' }}>
              {steps.title}
            </h2>
            <ol className="mv-rows" style={{ marginTop: '48px' }}>
              {steps.items.map((step, index) => (
                <li
                  key={step.title}
                  className="mv-row grid-cols-[48px_minmax(0,1fr)] md:grid-cols-[64px_minmax(0,5fr)_minmax(0,7fr)]"
                  style={{ display: 'grid', alignItems: 'start', gap: '12px 40px' }}
                >
                  <span
                    className="mv-figure"
                    aria-hidden="true"
                    style={{ fontSize: '40px', lineHeight: 1, color: 'var(--mv-ink-3)' }}
                  >
                    {index + 1}
                  </span>
                  <h3 className="mv-h3">{step.title}</h3>
                  <p
                    className="col-start-2 md:col-start-auto"
                    style={{ ...BODY_COMPACT_STYLE, maxWidth: '58ch' }}
                  >
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : null}

      {/* Demo: the block unique to this page, restyled to tokens */}
      {demo ? (
        <section className="mv-section" style={{ paddingTop: '96px', paddingBottom: '48px' }}>
          <div
            className={demo.wide ? '' : 'grid gap-16 md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]'}
            style={{ alignItems: 'start' }}
          >
            <div>
              <h2 className="mv-h2" style={{ maxWidth: '16ch' }}>
                {demo.title}
              </h2>
              {demo.body ? <p className="mv-section-sub">{demo.body}</p> : null}
            </div>
            <div style={{ marginTop: demo.wide ? '48px' : 0, minWidth: 0 }}>{demo.content}</div>
          </div>
        </section>
      ) : null}

      {/* Comparison table: hairline rows, the first column names the row */}
      {table ? (
        <section
          className="mv-section"
          style={{ paddingTop: demo ? 0 : '96px', paddingBottom: '96px' }}
        >
          <div style={{ maxWidth: '820px' }}>
            <h2 className="mv-h2" style={{ maxWidth: '16ch' }}>
              {table.title}
            </h2>
            {table.body ? <p className="mv-section-sub">{table.body}</p> : null}
          </div>
          <div style={{ marginTop: '40px', overflowX: 'auto' }}>
            <table className="mv-table" style={{ minWidth: '560px', color: 'var(--mv-ink-2)' }}>
              <thead>
                <tr>
                  {table.columns.map((column) => (
                    <th key={column} scope="col">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map(([head, ...cells]) => (
                  <tr key={head}>
                    <th scope="row">{head}</th>
                    {cells.map((cell) => (
                      <td key={cell}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* Long-form: the deeper ramp step carries the editorial read — the
          heaviest block, so it gets the generous interval. The band itself
          separates, so no dividers inside. */}
      <section style={{ background: 'var(--mv-bg-2)' }}>
        <div className="mv-section-inner" style={{ paddingBottom: '160px' }}>
          <div style={{ maxWidth: '820px' }}>
            <h2 className="mv-h2">{longFormBlock.title}</h2>
            <p className="mv-section-sub">{longFormBlock.intro}</p>
            {longFormBlock.sections.map((section) => (
              <div key={section.title} style={{ marginTop: '64px' }}>
                <h3 className="mv-h3">{section.title}</h3>
                <Paragraphs body={section.body} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ: hairline <details> rows directly on the page surface */}
      <section className="mv-section" style={{ paddingTop: '96px', paddingBottom: '96px' }}>
        <div style={{ maxWidth: '820px' }}>
          <h2 className="mv-h2">{t('faqTitle')}</h2>
          <div className="mv-rows" style={{ marginTop: '40px' }}>
            {faqItems.map(({ question, answer }, index) => (
              <details
                key={question}
                className="group"
                open={index === 0}
                style={{ borderBottom: '1px solid var(--mv-line)' }}
              >
                <summary
                  className="mv-row [&::-webkit-details-marker]:hidden"
                  style={{ cursor: 'pointer', listStyle: 'none' }}
                >
                  <span
                    style={{
                      fontSize: '17px',
                      fontWeight: 600,
                      lineHeight: 1.45,
                      color: 'var(--mv-ink)',
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
                    style={{ marginLeft: 'auto' }}
                    aria-hidden="true"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </summary>
                <p style={{ ...BODY_COMPACT_STYLE, padding: '0 40px 16px 0' }}>{answer}</p>
              </details>
            ))}
          </div>

          <p
            style={{
              margin: '40px 0 0',
              fontSize: '15px',
              lineHeight: 1.45,
              color: 'var(--mv-ink-3)',
            }}
          >
            {t('faqMore')}{' '}
            <Link href="/support" className="mv-link">
              {t('faqSupportLink')}
            </Link>
          </p>
          {/* Hub-and-spoke inbound link: every feature page feeds the /compare
              money page for internal-link equity + discovery. */}
          <p style={{ margin: '16px 0 0', fontSize: '15px', lineHeight: 1.45 }}>
            <Link href="/compare" className="mv-link is-tall">
              {tCompare('compareInboundLink')}
              <ArrowIcon />
            </Link>
          </p>
        </div>

        {related.length > 0 ? (
          <div style={{ marginTop: '64px' }}>
            <p style={META_STYLE}>{tIndex('relatedTitle')}</p>
            <ul className="mv-rows grid md:grid-cols-2 md:gap-x-20" style={{ marginTop: '16px' }}>
              {related.map((href) => (
                <li key={href}>
                  <Link href={href} className="mv-row">
                    <span className="mv-h3">{tIndex(FEATURE_ROUTE_TITLE_KEY[href])}</span>
                    <ArrowIcon />
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
