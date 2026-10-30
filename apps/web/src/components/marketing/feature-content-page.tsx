import Image from 'next/image';
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

/** The seven feature pages this template lays out. */
export type FeatureRoute =
  | '/features/trip-planning'
  | '/features/ai-diagnostics'
  | '/features/garage-management'
  | '/features/learning-paths'
  | '/features/maintenance'
  | '/features/expense-tracking'
  | '/features/ride-tracking';

const DEFAULT_FAQ_COUNT = 4;

interface FeatureContentPageProps {
  locale: string;
  namespace: string;
  route: FeatureRoute;
  /** First entry fills the page's one phone frame; the second is cropped onto a panel. */
  screenshots: { src: string; alt: string }[];
  /** An app object (a Bike Plate, a route) that sits beside the headline. */
  heroVisual?: ReactNode;
  /**
   * Without a `heroVisual`, the first screenshot is cut into the hero's right
   * column (the band's bottom edge crops it) and the pair below keeps the
   * rest. Pass `false` when the first shot is too small to carry that size.
   */
  heroCut?: boolean;
  /** Defaults to `featuresTitle` + `f1…f3` keys of the namespace. */
  features?: { title: string; items: FeatureItem[] };
  steps?: { title: string; items: FeatureStep[] };
  demo?: FeatureDemo;
  table?: FeatureTable;
  /** Defaults to `longFormTitle`, `longFormIntro` + `s1…s3` keys of the namespace. */
  longForm?: { title: string; intro: string; sections: FeatureSection[] };
  /** Defaults to `faq.0…faq.3` of the namespace. */
  faqItems?: FeatureFaqItem[];
}

/** Reading copy: Body 17/1.6 on the shared prose measure (60ch, ~75–80 characters). */
const BODY_STYLE = {
  margin: 0,
  fontSize: '17px',
  lineHeight: 1.6,
  color: 'var(--mv-ink-2)',
  maxWidth: 'var(--mv-measure)',
  textWrap: 'pretty',
} as const;

/** Compact body for list rows, table cells and FAQ answers: 16/1.55. */
const BODY_COMPACT_STYLE = { ...BODY_STYLE, fontSize: '16px', lineHeight: 1.55 } as const;

const PARAGRAPH_GAP = { first: '16px', rest: '24px' } as const;

/** Space between the hero's hairline and the phone frame when the hero took the first shot. */
const PAIR_GAP_AFTER_CUT = 96;

/* Template-scoped styles (the pair's own `<style>` pattern):
   - The hero cut: the first screenshot stands on the hero's bottom hairline,
     cropped by it, on a frameless crop radius (the page's one device frame
     stays in the pair below).
   - The comparison table scrolls inside a focusable region with the row
     header pinned, like the compare matrix. */
const FEATURE_PAGE_CSS = `
.mv-hero-cut {
  width: 380px;
  max-width: 100%;
  height: 440px;
  overflow: hidden;
  border: 1px solid var(--mv-line);
  border-bottom: 0;
  border-radius: var(--mv-radius-crop) var(--mv-radius-crop) 0 0;
  background: var(--mv-surface);
}
.mv-hero-cut img { width: 100%; height: auto; display: block; }
@media (max-width: 900px) {
  .mv-hero-cut { width: 300px; height: 340px; }
}
.mv-feature-tablewrap { margin-top: 40px; overflow-x: auto; -webkit-overflow-scrolling: touch; }
.mv-feature-tablewrap th[scope='row'] { position: sticky; left: 0; z-index: 1; padding-right: 16px; background: var(--mv-bg); }
`;

function ArrowIcon() {
  return (
    <svg
      width="16"
      height="16"
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
      width="16"
      height="16"
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
 * the /compare link and the closing primary action alone. The store buttons
 * appear twice: the hero and the closing CTA. Every heading sits on the shared
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
  heroCut = true,
  features,
  steps,
  demo,
  table,
  longForm,
  faqItems: faqItemsProp,
}: FeatureContentPageProps) {
  const t = await getTranslations(namespace);
  // The /compare inbound link lives in its own namespace so the copy is
  // written once, not per feature.
  const tCompare = await getTranslations('Compare');
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

  // B2: a page without an app object opens on its first screenshot instead
  // of on text alone; that one image is the hero's, so it loads eagerly at high
  // priority (Next 16 deprecates `priority`; the docs prefer this pair).
  const heroShot = !heroVisual && heroCut ? (screenshots[0] ?? null) : null;
  const pairScreenshots = heroShot ? screenshots.slice(1) : screenshots;
  const heroHasAside = Boolean(heroVisual || heroShot);

  return (
    <>
      <JsonLdGraph nodes={graph} />
      <style
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static CSS
        dangerouslySetInnerHTML={{ __html: FEATURE_PAGE_CSS }}
      />

      {/* Hero: breadcrumb, condensed headline, the lede and the store buttons
          on the ground; an app object beside it when the page has one, else
          the first screenshot cut by the hero's bottom hairline */}
      <header
        className="mv-section-hero"
        style={{ paddingTop: '120px', paddingBottom: heroShot ? 0 : '64px' }}
      >
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
          className={
            heroHasAside ? 'grid gap-12 min-[901px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]' : ''
          }
          style={{
            alignItems: 'end',
            borderBottom: heroShot ? '1px solid var(--mv-line)' : undefined,
          }}
        >
          <div className={heroShot ? 'min-[901px]:pb-16' : undefined}>
            <h1 className="mv-section-title" style={{ maxWidth: '14ch', overflowWrap: 'anywhere' }}>
              {t('heroTitle')}
            </h1>
            <p className="mv-section-sub">{t('heroSubtitle')}</p>
            <div style={{ marginTop: '32px' }}>
              <StoreButtons pageType={CtaPageType.Feature} placement={CtaPlacement.Hero} />
            </div>
          </div>
          {heroVisual ? (
            <div
              style={{ maxWidth: '440px', width: '100%' }}
              className="min-[901px]:justify-self-end"
            >
              {heroVisual}
            </div>
          ) : null}
          {heroShot ? (
            <div className="mv-hero-cut min-[901px]:justify-self-end">
              <Image
                src={heroShot.src}
                alt={heroShot.alt}
                width={1206}
                height={2622}
                sizes="(max-width: 900px) 300px, 380px"
                loading="eager"
                fetchPriority="high"
              />
            </div>
          ) : null}
        </div>
      </header>

      {/* The page's one authored moment: the phone frame (and its panel) rise in */}
      <FeatureScreenshotPair
        screenshots={pairScreenshots}
        paddingTop={heroShot ? PAIR_GAP_AFTER_CUT : 0}
      />

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
          {/* biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be keyboard-reachable */}
          <section className="mv-feature-tablewrap" tabIndex={0} aria-label={table.title}>
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
          </section>
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
                className="mv-disclosure"
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
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ marginLeft: 'auto', flex: 'none' }}
                    aria-hidden="true"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </summary>
                <p style={{ ...BODY_COMPACT_STYLE, padding: '0 40px 16px 0' }}>{answer}</p>
              </details>
            ))}
          </div>

          {/* Hub-and-spoke inbound link: every feature page feeds the /compare
              money page for internal-link equity + discovery. */}
          <p style={{ margin: '40px 0 0', fontSize: '15px', lineHeight: 1.45 }}>
            <Link href="/compare" className="mv-link is-tall">
              {tCompare('compareInboundLink')}
              <ArrowIcon />
            </Link>
          </p>
        </div>
      </section>

      <FeatureCta />
    </>
  );
}
