import { getTranslations } from 'next-intl/server';
import { type CSSProperties, Fragment, type ReactNode } from 'react';
import { FeatureCta } from '@/components/marketing/feature-cta';
import { Link } from '@/i18n/navigation';
import { CtaPageType } from '@/lib/cta-taxonomy';

/**
 * Shared "Spec Sheet" template for the /compare/motovault-vs-* pages
 * (Trackside direction — docs/design/web-race-plate-redesign/DIRECTION.md).
 *
 * The ten head-to-head pages previously duplicated ~500 lines of layout each;
 * they are now thin wrappers around this component. Two content families are
 * supported through the config:
 * - "flat" key style  (parityRow{i}Feature / pricingRow{i}Plan, with Notes
 *   columns, testing preamble, quick verdict, wins columns, pricing narrative)
 * - "nested" key style (parity.{i}.label / pricing.{i}.label, three columns,
 *   app-description intro)
 *
 * Everything renders on the page surface with --mv-line hairlines; the final
 * verdict is the single allowed card per page.
 */

export type CompareMark = 'yes' | 'partial' | 'no';

export interface CompareRelatedLink {
  href: string;
  title: string;
  description: string;
}

export interface CompareSourceLink {
  labelKey: string;
  href: string;
}

export interface VsComparePageConfig {
  namespace: string;
  /** Competitor display name — used for hardcoded table headers (nested style). */
  competitorName: string;
  /** Current-page breadcrumb label (matches the BreadcrumbList JSON-LD). */
  breadcrumbLabel: string;
  titleKey: string;
  subtitleKey: string;
  updatedAtKey?: string;
  /** RideLog carries a "same name, different app" note. */
  disambiguation?: { titleKey: string; noteKey: string };
  testingPreambleKey?: string;
  quickVerdictKey?: string;
  /** Nested-style pages open with one paragraph per app instead of a verdict. */
  appDescriptions?: boolean;
  comparison: {
    keyStyle: 'flat' | 'nested';
    /** i18n key for the section heading (flat pages); nested pages hardcode it. */
    titleKey?: string;
    /** Per-row yes/partial/no for the MotoVault and competitor cells. */
    marks: ReadonlyArray<{ mv: CompareMark; comp: CompareMark }>;
  };
  wins?: {
    mvTitleKey: string;
    compTitleKey: string;
    mvItemPrefix: string;
    compItemPrefix: string;
    count: number;
  };
  whenToChoose?: { titleKey: string; bodyKey: string };
  pricing: {
    keyStyle: 'flat' | 'nested';
    titleKey?: string;
    rows: number;
    narrativeKey?: string;
  };
  sources?: { headingKey: string; noteKey: string; links: ReadonlyArray<CompareSourceLink> };
  verdict: { titleKey?: string; bodyKey: string };
  faqCount: number;
  related: ReadonlyArray<CompareRelatedLink>;
}

/* ── Shared type styles (Condensed Means Number Rule: display face for
      headings and figures, body face for sentences) ── */

export const compareH1Style: CSSProperties = {
  fontFamily: 'var(--mv-font-display)',
  fontWeight: 700,
  fontSize: 'clamp(42px, 6vw, 72px)',
  lineHeight: 0.98,
  letterSpacing: '0.002em',
  color: 'var(--mv-ink)',
  margin: 0,
};

export const compareH2Style: CSSProperties = {
  fontFamily: 'var(--mv-font-display)',
  fontWeight: 600,
  fontSize: 'clamp(26px, 3.2vw, 34px)',
  lineHeight: 1.05,
  letterSpacing: '0.002em',
  color: 'var(--mv-ink)',
  margin: 0,
};

export const compareH3Style: CSSProperties = {
  fontFamily: 'var(--mv-font-display)',
  fontWeight: 600,
  fontSize: 22,
  lineHeight: 1.1,
  color: 'var(--mv-ink)',
  margin: 0,
};

export const compareBodyStyle: CSSProperties = {
  color: 'var(--mv-ink-2)',
  fontSize: 16,
  lineHeight: 1.6,
  letterSpacing: '-0.005em',
  maxWidth: '68ch',
};

const thStyle: CSSProperties = {
  fontFamily: 'var(--mv-font-body)',
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--mv-ink-3)',
  textAlign: 'left',
  padding: '0 20px 10px 0',
  borderBottom: '1px solid var(--mv-line-step)',
  whiteSpace: 'nowrap',
};

const tdStyle: CSSProperties = {
  fontSize: 14,
  lineHeight: 1.5,
  padding: '13px 20px 13px 0',
  borderBottom: '1px solid var(--mv-line)',
  verticalAlign: 'top',
};

/** Row numbers: condensed tabular figures in the quietest ink. */
const rowNumberStyle: CSSProperties = {
  ...tdStyle,
  fontFamily: 'var(--mv-font-display)',
  fontWeight: 600,
  fontVariantNumeric: 'tabular-nums',
  color: 'var(--mv-ink-4)',
  fontSize: 15,
  width: 36,
};

/** Price cells: condensed tabular figures (data, not sentences). */
const priceCellStyle: CSSProperties = {
  ...tdStyle,
  fontFamily: 'var(--mv-font-display)',
  fontWeight: 500,
  fontVariantNumeric: 'tabular-nums',
  fontSize: 15,
  color: 'var(--mv-ink)',
};

/* ── Marks: affirmatives in --mv-go, negatives in --mv-ink-4 (never the
      plate triad). Decorative — the adjacent prose carries the meaning. ── */

export function MarkGlyph({ mark }: { mark: CompareMark }) {
  if (mark === 'yes') {
    return (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--mv-go)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ flexShrink: 0, marginTop: 3 }}
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  if (mark === 'no') {
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--mv-ink-4)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ flexShrink: 0, marginTop: 3.5 }}
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    );
  }
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--mv-ink-3)"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      style={{ flexShrink: 0, marginTop: 3.5 }}
    >
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function MarkedCell({ mark, children }: { mark: CompareMark; children: ReactNode }) {
  return (
    <span style={{ display: 'flex', gap: 8 }}>
      <MarkGlyph mark={mark} />
      <span>{children}</span>
    </span>
  );
}

/* ── Breadcrumb (shared by every compare page) ── */

export function CompareBreadcrumb({
  items,
}: {
  items: ReadonlyArray<{ label: string; href?: string }>;
}) {
  return (
    <nav aria-label="Breadcrumb">
      <ol
        className="flex flex-wrap items-center gap-2"
        style={{ fontSize: 13, color: 'var(--mv-ink-3)' }}
      >
        {items.map((item, i) => (
          <li key={item.label} className="flex items-center gap-2">
            {i > 0 ? (
              <span aria-hidden="true" style={{ color: 'var(--mv-ink-4)' }}>
                /
              </span>
            ) : null}
            {item.href ? (
              <Link
                href={item.href}
                className="transition-colors"
                style={{ color: 'var(--mv-ink-3)' }}
              >
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" style={{ color: 'var(--mv-ink-2)' }}>
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/* ── FAQ: hairline <details> on the page surface ── */

export function CompareFaq({
  items,
}: {
  items: ReadonlyArray<{ question: string; answer: string }>;
}) {
  return (
    <div style={{ borderBottom: '1px solid var(--mv-line)' }}>
      {items.map(({ question, answer }) => (
        <details key={question} style={{ borderTop: '1px solid var(--mv-line)' }}>
          <summary
            className="cursor-pointer"
            style={{
              padding: '16px 0',
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--mv-ink)',
              letterSpacing: '-0.005em',
            }}
          >
            {question}
          </summary>
          <p style={{ ...compareBodyStyle, fontSize: 15, padding: '0 0 18px', margin: 0 }}>
            {answer}
          </p>
        </details>
      ))}
    </div>
  );
}

/* ── Related comparisons: plain link list, no cards ── */

export function CompareRelatedLinks({
  heading,
  links,
}: {
  heading?: string;
  links: ReadonlyArray<CompareRelatedLink>;
}) {
  return (
    <>
      <h2 style={compareH2Style}>{heading ?? 'Related comparisons'}</h2>
      <ul className="mt-6" style={{ borderBottom: '1px solid var(--mv-line)' }}>
        {links.map(({ href, title, description }) => (
          <li
            key={href}
            className="flex flex-col gap-x-6 gap-y-0.5 py-3 sm:flex-row sm:items-baseline"
            style={{ borderTop: '1px solid var(--mv-line)' }}
          >
            <Link
              href={href}
              className="shrink-0 transition-colors"
              style={{ color: 'var(--mv-copper-text)', fontSize: 15, fontWeight: 600 }}
            >
              {title}
            </Link>
            <span style={{ color: 'var(--mv-ink-3)', fontSize: 14 }}>{description}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ── The head-to-head page body ── */

export async function VsComparePage(config: VsComparePageConfig) {
  const t = await getTranslations(config.namespace);
  const { comparison, pricing, wins } = config;
  const flat = comparison.keyStyle === 'flat';
  const pricingFlat = pricing.keyStyle === 'flat';

  const faqItems = Array.from({ length: config.faqCount }, (_, i) => ({
    question: t(`faq.${i}.question`),
    answer: t(`faq.${i}.answer`),
  }));

  const comparisonHead = flat
    ? {
        feature: t('parityHeaderFeature'),
        mv: t('parityHeaderMv'),
        comp: t('parityHeaderCompetitor'),
        notes: t('parityHeaderNotes'),
      }
    : { feature: 'Feature', mv: 'MotoVault', comp: config.competitorName, notes: null };

  const comparisonRows = comparison.marks.map((marks, i) => ({
    marks,
    feature: flat ? t(`parityRow${i}Feature`) : t(`parity.${i}.label`),
    mv: flat ? t(`parityRow${i}Mv`) : t(`parity.${i}.mv`),
    comp: flat ? t(`parityRow${i}Competitor`) : t(`parity.${i}.comp`),
    notes: flat ? t(`parityRow${i}Notes`) : null,
  }));

  const pricingHead = pricingFlat
    ? {
        plan: t('pricingHeaderPlan'),
        mv: t('pricingHeaderMv'),
        comp: t('pricingHeaderCompetitor'),
        notes: t('pricingHeaderNotes'),
      }
    : { plan: 'Plan', mv: 'MotoVault', comp: config.competitorName, notes: null };

  const pricingRows = Array.from({ length: pricing.rows }, (_, i) => ({
    plan: pricingFlat ? t(`pricingRow${i}Plan`) : t(`pricing.${i}.label`),
    mv: pricingFlat ? t(`pricingRow${i}Mv`) : t(`pricing.${i}.mv`),
    comp: pricingFlat ? t(`pricingRow${i}Competitor`) : t(`pricing.${i}.comp`),
    notes: pricingFlat ? t(`pricingRow${i}Notes`) : null,
  }));

  return (
    <>
      {/* Hero — one condensed H1, left-aligned, on the page surface */}
      <header className="mx-auto max-w-5xl px-6 pt-28 md:pt-32">
        <CompareBreadcrumb
          items={[
            { label: 'Home', href: '/' },
            { label: 'Compare', href: '/compare' },
            { label: config.breadcrumbLabel },
          ]}
        />
        <h1 className="mt-8" style={compareH1Style}>
          {t(config.titleKey)}
        </h1>
        <p className="mt-6" style={{ ...compareBodyStyle, fontSize: 17, maxWidth: '58ch' }}>
          {t(config.subtitleKey)}
        </p>
        {config.updatedAtKey ? (
          <p className="mt-3" style={{ fontSize: 13, color: 'var(--mv-ink-4)' }}>
            {t(config.updatedAtKey)}
          </p>
        ) : null}
      </header>

      {/* Disambiguation note (RideLog shares its name with other apps) */}
      {config.disambiguation ? (
        <section className="mx-auto max-w-5xl px-6 pt-14">
          <p style={{ ...compareBodyStyle, fontSize: 15 }}>
            <strong style={{ color: 'var(--mv-ink)', fontWeight: 600 }}>
              {t(config.disambiguation.titleKey)}
            </strong>{' '}
            {t(config.disambiguation.noteKey)}
          </p>
        </section>
      ) : null}

      {/* Quick verdict — plain prose, no tinted card */}
      {config.quickVerdictKey ? (
        <section className="mx-auto max-w-5xl px-6 pt-16 md:pt-20">
          <h2 style={compareH2Style}>Quick verdict</h2>
          <p className="mt-5" style={{ ...compareBodyStyle, fontSize: 17, color: 'var(--mv-ink)' }}>
            {t(config.quickVerdictKey)}
          </p>
        </section>
      ) : null}

      {/* App descriptions — two plain typographic columns */}
      {config.appDescriptions ? (
        <section className="mx-auto max-w-5xl px-6 pt-16 md:pt-20">
          <div className="grid gap-10 lg:grid-cols-[1fr_1px_1fr] lg:gap-12">
            <div>
              <h2 style={compareH3Style}>{t('mvHeading')}</h2>
              <p className="mt-4" style={compareBodyStyle}>
                {t('mvDescription')}
              </p>
            </div>
            <div
              aria-hidden="true"
              className="hidden lg:block"
              style={{ background: 'var(--mv-line)' }}
            />
            <div>
              <h2 style={compareH3Style}>{t('compHeading')}</h2>
              <p className="mt-4" style={compareBodyStyle}>
                {t('compDescription')}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {/* Comparison table — the spec sheet. One table, hairline rows, no card */}
      <section className="mx-auto max-w-5xl px-6 pt-20 md:pt-28">
        <h2 style={compareH2Style}>
          {comparison.titleKey ? t(comparison.titleKey) : 'Detailed feature comparison'}
        </h2>
        {config.testingPreambleKey ? (
          <p
            className="mt-4"
            style={{ ...compareBodyStyle, fontSize: 14, color: 'var(--mv-ink-3)' }}
          >
            {t(config.testingPreambleKey)}
          </p>
        ) : null}
        <div className="mt-8 overflow-x-auto">
          <table
            className="w-full"
            style={{ borderCollapse: 'collapse', minWidth: comparisonHead.notes ? 760 : 560 }}
          >
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 36 }}>
                  <span className="sr-only">Row</span>
                </th>
                <th style={thStyle}>{comparisonHead.feature}</th>
                <th style={thStyle}>{comparisonHead.mv}</th>
                <th style={thStyle}>{comparisonHead.comp}</th>
                {comparisonHead.notes ? <th style={thStyle}>{comparisonHead.notes}</th> : null}
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row, i) => (
                <tr key={row.feature}>
                  <td style={rowNumberStyle}>{String(i + 1).padStart(2, '0')}</td>
                  <td style={{ ...tdStyle, color: 'var(--mv-ink)', fontWeight: 500 }}>
                    {row.feature}
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--mv-ink-2)' }}>
                    <MarkedCell mark={row.marks.mv}>{row.mv}</MarkedCell>
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--mv-ink-2)' }}>
                    <MarkedCell mark={row.marks.comp}>{row.comp}</MarkedCell>
                  </td>
                  {row.notes !== null ? (
                    <td style={{ ...tdStyle, color: 'var(--mv-ink-3)' }}>{row.notes}</td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Who wins — two plain typographic columns, hairline between */}
      {wins ? (
        <section className="mx-auto max-w-5xl px-6 pt-20 md:pt-28">
          <div className="grid gap-10 lg:grid-cols-[1fr_1px_1fr] lg:gap-12">
            {[
              { titleKey: wins.mvTitleKey, itemPrefix: wins.mvItemPrefix },
              { titleKey: wins.compTitleKey, itemPrefix: wins.compItemPrefix },
            ].map(({ titleKey, itemPrefix }, col) => (
              <Fragment key={titleKey}>
                {col === 1 ? (
                  <div
                    aria-hidden="true"
                    className="hidden lg:block"
                    style={{ background: 'var(--mv-line)' }}
                  />
                ) : null}
                <div>
                  <h2 style={compareH3Style}>{t(titleKey)}</h2>
                  <ul className="mt-5" style={{ borderBottom: '1px solid var(--mv-line)' }}>
                    {Array.from({ length: wins.count }, (_, i) => `${itemPrefix}${i}`).map(
                      (itemKey) => (
                        <li
                          key={itemKey}
                          style={{
                            ...compareBodyStyle,
                            fontSize: 15,
                            padding: '12px 0',
                            borderTop: '1px solid var(--mv-line)',
                            maxWidth: 'none',
                          }}
                        >
                          {t(itemKey)}
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              </Fragment>
            ))}
          </div>
        </section>
      ) : null}

      {/* Pricing — one section: table, then the narrative */}
      <section className="mx-auto max-w-5xl px-6 pt-20 md:pt-28">
        <h2 style={compareH2Style}>{pricing.titleKey ? t(pricing.titleKey) : 'Pricing'}</h2>
        <div className="mt-8 overflow-x-auto">
          <table
            className="w-full"
            style={{ borderCollapse: 'collapse', minWidth: pricingHead.notes ? 680 : 520 }}
          >
            <thead>
              <tr>
                <th style={thStyle}>{pricingHead.plan}</th>
                <th style={thStyle}>{pricingHead.mv}</th>
                <th style={thStyle}>{pricingHead.comp}</th>
                {pricingHead.notes ? <th style={thStyle}>{pricingHead.notes}</th> : null}
              </tr>
            </thead>
            <tbody>
              {pricingRows.map((row) => (
                <tr key={row.plan}>
                  <td style={{ ...tdStyle, color: 'var(--mv-ink)', fontWeight: 500 }}>
                    {row.plan}
                  </td>
                  <td style={priceCellStyle}>{row.mv}</td>
                  <td style={{ ...priceCellStyle, color: 'var(--mv-ink-2)' }}>{row.comp}</td>
                  {row.notes !== null ? (
                    <td style={{ ...tdStyle, color: 'var(--mv-ink-3)' }}>{row.notes}</td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pricing.narrativeKey ? (
          <p className="mt-8" style={compareBodyStyle}>
            {t(pricing.narrativeKey)}
          </p>
        ) : null}
      </section>

      {/* When the competitor is the right pick */}
      {config.whenToChoose ? (
        <section className="mx-auto max-w-5xl px-6 pt-20 md:pt-28">
          <h2 style={compareH2Style}>{t(config.whenToChoose.titleKey)}</h2>
          <p className="mt-5" style={compareBodyStyle}>
            {t(config.whenToChoose.bodyKey)}
          </p>
        </section>
      ) : null}

      {/* Sources (external, verify first-hand) */}
      {config.sources ? (
        <section className="mx-auto max-w-5xl px-6 pt-20 md:pt-28">
          <h2 style={compareH3Style}>{t(config.sources.headingKey)}</h2>
          <p
            className="mt-4"
            style={{ ...compareBodyStyle, fontSize: 14, color: 'var(--mv-ink-3)' }}
          >
            {t(config.sources.noteKey)}
          </p>
          <ul className="mt-4 flex flex-col gap-2">
            {config.sources.links.map(({ labelKey, href }) => (
              <li key={labelKey}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors"
                  style={{
                    color: 'var(--mv-copper-text)',
                    fontSize: 14,
                    fontWeight: 500,
                    textDecoration: 'underline',
                    textUnderlineOffset: 4,
                  }}
                >
                  {t(labelKey)}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Verdict — the one allowed card on the page */}
      <section className="mx-auto max-w-5xl px-6 pt-20 md:pt-28">
        <div
          style={{
            background: 'var(--mv-surface)',
            border: '1px solid var(--mv-line)',
            borderRadius: 'var(--mv-radius-card)',
            padding: 'clamp(24px, 4vw, 40px)',
          }}
        >
          <h2 style={compareH2Style}>
            {config.verdict.titleKey ? t(config.verdict.titleKey) : 'Final verdict'}
          </h2>
          <p className="mt-5" style={{ ...compareBodyStyle, fontSize: 17, color: 'var(--mv-ink)' }}>
            {t(config.verdict.bodyKey)}
          </p>
        </div>
      </section>

      {/* Related comparisons — plain links */}
      <section className="mx-auto max-w-5xl px-6 pt-20 md:pt-28">
        <CompareRelatedLinks links={config.related} />
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
