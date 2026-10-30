import { Check, ChevronDown, type LucideProps, Minus, X } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { ComponentType, ReactNode } from 'react';
import { FeatureCta } from '@/components/marketing/feature-cta';
import { Link } from '@/i18n/navigation';
import { CtaPageType } from '@/lib/cta-taxonomy';

/**
 * The "Spec Sheet": shared chrome for every /compare page in the Trackside
 * world (docs/design/web-race-plate-redesign/DIRECTION.md).
 *
 * - Condensed display face for the H1, section titles and figures; the body
 *   face for every sentence, label, cell and button.
 * - Everything sits on the page surface with --mv-line hairlines. The final
 *   verdict is the one card-styled element a page may carry.
 * - Yes / partial / no are Lucide marks in ink (yes) and ink-3 (partial, no),
 *   each with a text alternative. Copper marks links only.
 * - Shared strings (breadcrumb, section titles, mark labels) live in the
 *   `Compare` namespace; per-competitor copy stays in its `Vs*` namespace in
 *   either the flat or the nested key style.
 *
 * Both schemes: every colour is a --mv-* token (dark :root, light
 * html:not(.dark)).
 */

export type CompareMark = 'yes' | 'partial' | 'no';

/** Every compare page, keyed by the id its `Compare.pages.<id>` copy uses. */
export const COMPARE_PAGES = {
  ridelog: { href: '/compare/motovault-vs-ridelog' },
  rever: { href: '/compare/motovault-vs-rever' },
  calimoto: { href: '/compare/motovault-vs-calimoto' },
  kurviger: { href: '/compare/motovault-vs-kurviger' },
  eatsleepride: { href: '/compare/motovault-vs-eatsleepride' },
  scenic: { href: '/compare/motovault-vs-scenic' },
  motoscan: { href: '/compare/motovault-vs-motoscan' },
  motormanage: { href: '/compare/motovault-vs-motormanage' },
  motoShed: { href: '/compare/motovault-vs-moto-shed' },
  alternatives: { href: '/compare/alternatives' },
  maintVsRide: { href: '/compare/maintenance-vs-ride-apps' },
} as const;

export type ComparePageId = keyof typeof COMPARE_PAGES;

export const HEAD_TO_HEAD_IDS = [
  'ridelog',
  'rever',
  'calimoto',
  'kurviger',
  'eatsleepride',
  'scenic',
  'motoscan',
  'motormanage',
  'motoShed',
] as const satisfies readonly ComparePageId[];

export const GUIDE_IDS = [
  'alternatives',
  'maintVsRide',
] as const satisfies readonly ComparePageId[];

export interface CompareSourceLink {
  labelKey: string;
  href: string;
}

export interface VsComparePageConfig {
  namespace: string;
  /** Competitor display name: table headers on nested-style pages. */
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
    /** i18n key for the section heading (flat pages); nested pages use the shared one. */
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
  related: ReadonlyArray<ComparePageId>;
}

/* ── Scoped styles: one sheet per page, unique `mv-cmp-` prefix ──
   Hover, focus, selection and the FAQ marker cannot be inline, so the
   spec-sheet grammar lives here instead of in a global file. */

const COMPARE_CSS = `
.mv-cmp-page { color: var(--mv-ink); }
.mv-cmp-page ::selection { background: var(--mv-copper); color: var(--mv-on-copper); }
.mv-cmp-page :focus-visible { outline: 2px solid var(--mv-focus); outline-offset: 3px; border-radius: 4px; }
.mv-cmp-wrap { max-width: 1040px; margin: 0 auto; padding-left: 24px; padding-right: 24px; }
.mv-cmp-wrap.is-wide { max-width: 1160px; }
.mv-cmp-h1 { font-family: var(--mv-font-display); font-weight: 700; font-size: clamp(44px, 6.4vw, 80px); line-height: 0.96; letter-spacing: 0.002em; margin: 0; text-wrap: balance; }
.mv-cmp-h2 { font-family: var(--mv-font-display); font-weight: 600; font-size: clamp(28px, 3.4vw, 40px); line-height: 1.02; letter-spacing: 0.002em; margin: 0; text-wrap: balance; }
.mv-cmp-h3 { font-family: var(--mv-font-display); font-weight: 600; font-size: 24px; line-height: 1.08; letter-spacing: 0.002em; margin: 0; }
.mv-cmp-sub { font-size: 16px; font-weight: 600; line-height: 1.4; color: var(--mv-ink); margin: 0; }
.mv-cmp-lede { color: var(--mv-ink-2); font-size: 18px; line-height: 1.55; max-width: 58ch; margin: 0; text-wrap: pretty; }
.mv-cmp-body { color: var(--mv-ink-2); font-size: 16px; line-height: 1.6; max-width: 68ch; margin: 0; text-wrap: pretty; }
.mv-cmp-body.is-strong { color: var(--mv-ink); font-size: 17px; }
.mv-cmp-body.is-full { max-width: none; }
.mv-cmp-note { color: var(--mv-ink-3); font-size: 14px; line-height: 1.55; max-width: 72ch; margin: 0; text-wrap: pretty; }
.mv-cmp-meta { color: var(--mv-ink-4); font-size: 13px; line-height: 1.5; margin: 0; font-variant-numeric: tabular-nums; }
.mv-cmp-figure { font-family: var(--mv-font-display); font-weight: 500; font-variant-numeric: tabular-nums; font-feature-settings: 'tnum'; color: var(--mv-ink); margin: 0; }
.mv-cmp-link { color: var(--mv-copper-text); font-weight: 600; text-decoration: none; text-underline-offset: 4px; transition: color 0.2s var(--mv-ease); }
.mv-cmp-link:hover { color: var(--mv-copper-hover); text-decoration: underline; }
.mv-cmp-link.is-ext { text-decoration: underline; text-decoration-color: var(--mv-copper-border); font-weight: 500; }
.mv-cmp-link.is-ext:hover { text-decoration-color: currentColor; }
.mv-cmp-crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0; padding: 0; list-style: none; font-size: 13px; color: var(--mv-ink-3); }
.mv-cmp-crumbs li { display: flex; align-items: center; gap: 8px; }
.mv-cmp-crumbs a { color: inherit; text-decoration: none; transition: color 0.2s var(--mv-ease); }
.mv-cmp-crumbs a:hover { color: var(--mv-ink); }
.mv-cmp-crumbs [aria-current] { color: var(--mv-ink-2); }
.mv-cmp-crumbs .mv-cmp-sep { color: var(--mv-ink-4); }
.mv-cmp-table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; font-feature-settings: 'tnum'; }
.mv-cmp-table th { font-family: var(--mv-font-body); font-size: 13px; font-weight: 500; color: var(--mv-ink-3); text-align: left; padding: 0 20px 10px 0; border-bottom: 1px solid var(--mv-line-step); white-space: nowrap; }
.mv-cmp-table th.is-mv { color: var(--mv-ink); font-weight: 600; }
.mv-cmp-table th.is-row { font-size: 14px; font-weight: 500; line-height: 1.5; color: var(--mv-ink); padding: 13px 20px 13px 0; border-bottom: 1px solid var(--mv-line); white-space: normal; vertical-align: top; }
.mv-cmp-table td { font-size: 14px; line-height: 1.5; padding: 13px 20px 13px 0; border-bottom: 1px solid var(--mv-line); vertical-align: top; color: var(--mv-ink-2); }
.mv-cmp-table .is-label { color: var(--mv-ink); font-weight: 500; }
.mv-cmp-table .is-note { color: var(--mv-ink-3); }
.mv-cmp-table .is-figure { font-family: var(--mv-font-display); font-weight: 500; font-size: 16px; color: var(--mv-ink); }
.mv-cmp-table .is-figure.is-comp { color: var(--mv-ink-2); }
.mv-cmp-table .is-center { text-align: center; padding-left: 10px; padding-right: 10px; }
.mv-cmp-table .is-sticky { position: sticky; left: 0; z-index: 1; background: var(--mv-bg); }
.mv-cmp-mark { display: inline-flex; align-items: flex-start; gap: 8px; }
.mv-cmp-mark svg { flex: none; margin-top: 3px; }
.mv-cmp-mark.is-solo svg { margin-top: 0; }
.mv-cmp-mark[data-mark='yes'] { color: var(--mv-ink); }
.mv-cmp-mark[data-mark='partial'], .mv-cmp-mark[data-mark='no'] { color: var(--mv-ink-3); }
.mv-cmp-list { list-style: none; margin: 0; padding: 0; border-bottom: 1px solid var(--mv-line); }
.mv-cmp-list > li { border-top: 1px solid var(--mv-line); }
.mv-cmp-rule { background: var(--mv-line); }
.mv-cmp-faq { border-bottom: 1px solid var(--mv-line); }
.mv-cmp-faq details { border-top: 1px solid var(--mv-line); }
.mv-cmp-faq summary { display: flex; align-items: center; justify-content: space-between; gap: 16px; cursor: pointer; padding: 16px 0; font-size: 16px; font-weight: 600; line-height: 1.4; color: var(--mv-ink); list-style: none; }
.mv-cmp-faq summary::-webkit-details-marker { display: none; }
.mv-cmp-faq summary svg { flex: none; color: var(--mv-ink-3); transition: transform 0.25s var(--mv-ease); }
.mv-cmp-faq details[open] summary svg { transform: rotate(180deg); }
.mv-cmp-faq .mv-cmp-body { padding: 0 0 18px; }
.mv-cmp-card { background: var(--mv-surface); border-radius: var(--mv-radius-card); padding: clamp(24px, 4vw, 40px); }
@media (prefers-reduced-motion: reduce) {
  .mv-cmp-faq summary svg, .mv-cmp-link, .mv-cmp-crumbs a { transition: none; }
}
`;

export function CompareStyles() {
  return (
    <style
      // biome-ignore lint/security/noDangerouslySetInnerHtml: static CSS
      dangerouslySetInnerHTML={{ __html: COMPARE_CSS }}
    />
  );
}

/* ── Marks ── */

const MARKS: Record<
  CompareMark,
  { Icon: ComponentType<LucideProps>; labelKey: 'markYes' | 'markPartial' | 'markNo' }
> = {
  yes: { Icon: Check, labelKey: 'markYes' },
  partial: { Icon: Minus, labelKey: 'markPartial' },
  no: { Icon: X, labelKey: 'markNo' },
};

export type CompareMarkLabels = Record<CompareMark, string>;

export async function getCompareMarkLabels(): Promise<CompareMarkLabels> {
  const tc = await getTranslations('Compare');
  return { yes: tc('markYes'), partial: tc('markPartial'), no: tc('markNo') };
}

/**
 * A yes / partial / no mark with its text alternative. Pass `children` to set
 * the mark beside a sentence; omit it for a bare cell (the label stays for
 * screen readers).
 */
export function CompareMarkCell({
  mark,
  label,
  children,
}: {
  mark: CompareMark;
  label: string;
  children?: ReactNode;
}) {
  const { Icon } = MARKS[mark];
  return (
    <span className={children ? 'mv-cmp-mark' : 'mv-cmp-mark is-solo'} data-mark={mark}>
      <Icon size={15} strokeWidth={mark === 'yes' ? 2.5 : 2} aria-hidden="true" />
      <span className="sr-only">{label}</span>
      {children ? <span>{children}</span> : null}
    </span>
  );
}

/* ── Breadcrumb ── */

export async function CompareBreadcrumb({
  current,
  underCompare = true,
}: {
  current: string;
  underCompare?: boolean;
}) {
  const tc = await getTranslations('Compare');
  const trail: ReadonlyArray<{ label: string; href?: string }> = [
    { label: tc('breadcrumbHome'), href: '/' },
    ...(underCompare ? [{ label: tc('breadcrumbCompare'), href: '/compare' }] : []),
    { label: current },
  ];
  return (
    <nav aria-label="Breadcrumb">
      <ol className="mv-cmp-crumbs">
        {trail.map((item, i) => (
          <li key={item.label}>
            {i > 0 ? (
              <span aria-hidden="true" className="mv-cmp-sep">
                /
              </span>
            ) : null}
            {item.href ? (
              <Link href={item.href}>{item.label}</Link>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/* ── FAQ: hairline <details> on the page surface ── */

export async function CompareFaq({
  items,
}: {
  items: ReadonlyArray<{ question: string; answer: string }>;
}) {
  const tc = await getTranslations('Compare');
  return (
    <>
      <h2 className="mv-cmp-h2">{tc('faqTitle')}</h2>
      <div className="mv-cmp-faq mt-8" style={{ maxWidth: 760 }}>
        {items.map(({ question, answer }) => (
          <details key={question}>
            <summary>
              <span>{question}</span>
              <ChevronDown size={18} strokeWidth={2} aria-hidden="true" />
            </summary>
            <p className="mv-cmp-body" style={{ fontSize: 15 }}>
              {answer}
            </p>
          </details>
        ))}
      </div>
    </>
  );
}

/* ── Comparison list: title link and a one-line verdict per row ── */

export async function CompareLinkList({
  ids,
  heading,
}: {
  ids: ReadonlyArray<ComparePageId>;
  heading?: string;
}) {
  const tc = await getTranslations('Compare');
  return (
    <>
      <h2 className="mv-cmp-h2">{heading ?? tc('relatedTitle')}</h2>
      <ul className="mv-cmp-list mt-6">
        {ids.map((id) => (
          <li key={id} className="grid gap-x-8 gap-y-1 py-4 md:grid-cols-[260px_1fr]">
            <Link href={COMPARE_PAGES[id].href} className="mv-cmp-link" style={{ fontSize: 16 }}>
              {tc(`pages.${id}.title`)}
            </Link>
            <p className="mv-cmp-body is-full" style={{ fontSize: 15 }}>
              {tc(`pages.${id}.verdict`)}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ── The head-to-head page body ── */

export async function VsComparePage(config: VsComparePageConfig) {
  const [t, tc, markLabels] = await Promise.all([
    getTranslations(config.namespace),
    getTranslations('Compare'),
    getCompareMarkLabels(),
  ]);
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
    : {
        feature: tc('headerFeature'),
        mv: tc('headerMotoVault'),
        comp: config.competitorName,
        notes: null,
      };

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
    : {
        plan: tc('headerPlan'),
        mv: tc('headerMotoVault'),
        comp: config.competitorName,
        notes: null,
      };

  const pricingRows = Array.from({ length: pricing.rows }, (_, i) => ({
    plan: pricingFlat ? t(`pricingRow${i}Plan`) : t(`pricing.${i}.label`),
    mv: pricingFlat ? t(`pricingRow${i}Mv`) : t(`pricing.${i}.mv`),
    comp: pricingFlat ? t(`pricingRow${i}Competitor`) : t(`pricing.${i}.comp`),
    notes: pricingFlat ? t(`pricingRow${i}Notes`) : null,
  }));

  const winColumns = wins
    ? [
        { titleKey: wins.mvTitleKey, itemPrefix: wins.mvItemPrefix },
        { titleKey: wins.compTitleKey, itemPrefix: wins.compItemPrefix },
      ]
    : [];

  return (
    <div className="mv-cmp-page">
      <CompareStyles />

      {/* Hero: breadcrumb, one condensed H1, the lede, the date. Left-aligned. */}
      <header className="mv-cmp-wrap pt-28 md:pt-32">
        <CompareBreadcrumb current={config.breadcrumbLabel} />
        <h1 className="mv-cmp-h1 mt-8">{t(config.titleKey)}</h1>
        <p className="mv-cmp-lede mt-6">{t(config.subtitleKey)}</p>
        {config.updatedAtKey ? <p className="mv-cmp-meta mt-4">{t(config.updatedAtKey)}</p> : null}
      </header>

      {/* Disambiguation (RideLog shares its name with other apps) */}
      {config.disambiguation ? (
        <section className="mv-cmp-wrap pt-12">
          <p className="mv-cmp-body" style={{ fontSize: 15 }}>
            <strong style={{ color: 'var(--mv-ink)', fontWeight: 600 }}>
              {t(config.disambiguation.titleKey)}
            </strong>{' '}
            {t(config.disambiguation.noteKey)}
          </p>
        </section>
      ) : null}

      {/* Quick verdict: plain prose */}
      {config.quickVerdictKey ? (
        <section className="mv-cmp-wrap pt-16 md:pt-20">
          <h2 className="mv-cmp-h2">{tc('quickVerdictTitle')}</h2>
          <p className="mv-cmp-body is-strong mt-5">{t(config.quickVerdictKey)}</p>
        </section>
      ) : null}

      {/* App descriptions: two typographic columns, hairline between */}
      {config.appDescriptions ? (
        <section className="mv-cmp-wrap pt-16 md:pt-20">
          <div className="grid gap-10 lg:grid-cols-[1fr_1px_1fr] lg:gap-12">
            <div>
              <h2 className="mv-cmp-h3">{t('mvHeading')}</h2>
              <p className="mv-cmp-body mt-4">{t('mvDescription')}</p>
            </div>
            <div aria-hidden="true" className="mv-cmp-rule hidden lg:block" />
            <div>
              <h2 className="mv-cmp-h3">{t('compHeading')}</h2>
              <p className="mv-cmp-body mt-4">{t('compDescription')}</p>
            </div>
          </div>
        </section>
      ) : null}

      {/* The spec sheet: how we tested, then one table with hairline rows.
          The reveal is this page's one authored entrance. */}
      <section className="mv-cmp-wrap pt-20 md:pt-28">
        <h2 className="mv-cmp-h2">
          {comparison.titleKey ? t(comparison.titleKey) : tc('specSheetTitle')}
        </h2>
        {config.testingPreambleKey ? (
          <p className="mv-cmp-note mt-4">{t(config.testingPreambleKey)}</p>
        ) : null}
        <div className="mv-reveal mt-8 overflow-x-auto">
          <table className="mv-cmp-table" style={{ minWidth: comparisonHead.notes ? 760 : 560 }}>
            <thead>
              <tr>
                <th scope="col">{comparisonHead.feature}</th>
                <th scope="col" className="is-mv">
                  {comparisonHead.mv}
                </th>
                <th scope="col">{comparisonHead.comp}</th>
                {comparisonHead.notes ? <th scope="col">{comparisonHead.notes}</th> : null}
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr key={row.feature}>
                  <th scope="row" className="is-row">
                    {row.feature}
                  </th>
                  <td>
                    <CompareMarkCell mark={row.marks.mv} label={markLabels[row.marks.mv]}>
                      {row.mv}
                    </CompareMarkCell>
                  </td>
                  <td>
                    <CompareMarkCell mark={row.marks.comp} label={markLabels[row.marks.comp]}>
                      {row.comp}
                    </CompareMarkCell>
                  </td>
                  {row.notes !== null ? <td className="is-note">{row.notes}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Where each wins: two plain lists, hairline between */}
      {wins ? (
        <section className="mv-cmp-wrap pt-20 md:pt-28">
          <div className="grid gap-10 lg:grid-cols-[1fr_1px_1fr] lg:gap-12">
            {winColumns.map(({ titleKey, itemPrefix }, col) => (
              <div key={titleKey} className={col === 1 ? 'lg:col-start-3' : undefined}>
                <h2 className="mv-cmp-h3">{t(titleKey)}</h2>
                <ul className="mv-cmp-list mt-5">
                  {Array.from({ length: wins.count }, (_, i) => `${itemPrefix}${i}`).map(
                    (itemKey) => (
                      <li
                        key={itemKey}
                        className="mv-cmp-body is-full py-3"
                        style={{ fontSize: 15 }}
                      >
                        {t(itemKey)}
                      </li>
                    ),
                  )}
                </ul>
              </div>
            ))}
            <div
              aria-hidden="true"
              className="mv-cmp-rule hidden lg:col-start-2 lg:row-start-1 lg:block"
            />
          </div>
        </section>
      ) : null}

      {/* Pricing: the table, then the narrative. Figures in the condensed face. */}
      <section className="mv-cmp-wrap pt-20 md:pt-28">
        <h2 className="mv-cmp-h2">{pricing.titleKey ? t(pricing.titleKey) : tc('pricingTitle')}</h2>
        <div className="mt-8 overflow-x-auto">
          <table className="mv-cmp-table" style={{ minWidth: pricingHead.notes ? 680 : 520 }}>
            <thead>
              <tr>
                <th scope="col">{pricingHead.plan}</th>
                <th scope="col" className="is-mv">
                  {pricingHead.mv}
                </th>
                <th scope="col">{pricingHead.comp}</th>
                {pricingHead.notes ? <th scope="col">{pricingHead.notes}</th> : null}
              </tr>
            </thead>
            <tbody>
              {pricingRows.map((row) => (
                <tr key={row.plan}>
                  <td className="is-label">{row.plan}</td>
                  <td className="is-figure">{row.mv}</td>
                  <td className="is-figure is-comp">{row.comp}</td>
                  {row.notes !== null ? <td className="is-note">{row.notes}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pricing.narrativeKey ? (
          <p className="mv-cmp-body mt-8">{t(pricing.narrativeKey)}</p>
        ) : null}
      </section>

      {/* When the competitor is the right pick */}
      {config.whenToChoose ? (
        <section className="mv-cmp-wrap pt-20 md:pt-28">
          <h2 className="mv-cmp-h2">{t(config.whenToChoose.titleKey)}</h2>
          <p className="mv-cmp-body mt-5">{t(config.whenToChoose.bodyKey)}</p>
        </section>
      ) : null}

      {/* Sources: external, verify first-hand */}
      {config.sources ? (
        <section className="mv-cmp-wrap pt-20 md:pt-28">
          <h2 className="mv-cmp-h3">{t(config.sources.headingKey)}</h2>
          <p className="mv-cmp-note mt-4">{t(config.sources.noteKey)}</p>
          <ul className="mt-4 flex flex-col gap-2" style={{ fontSize: 14 }}>
            {config.sources.links.map(({ labelKey, href }) => (
              <li key={labelKey}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mv-cmp-link is-ext"
                >
                  {t(labelKey)}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Final verdict: the one card on the page */}
      <section className="mv-cmp-wrap pt-20 md:pt-28">
        <div className="mv-cmp-card">
          <h2 className="mv-cmp-h2">
            {config.verdict.titleKey ? t(config.verdict.titleKey) : tc('finalVerdictTitle')}
          </h2>
          <p className="mv-cmp-body is-strong mt-5">{t(config.verdict.bodyKey)}</p>
        </div>
      </section>

      {/* Related comparisons: title and one-line verdict per row */}
      <section className="mv-cmp-wrap pt-20 md:pt-28">
        <CompareLinkList ids={config.related} />
      </section>

      {/* FAQ */}
      <section className="mv-cmp-wrap py-20 md:py-28">
        <CompareFaq items={faqItems} />
      </section>

      <FeatureCta pageType={CtaPageType.Compare} />
    </div>
  );
}
