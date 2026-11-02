import { Check, ChevronDown, ChevronRight, type LucideProps, Minus, X } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { ComponentType, ReactNode } from 'react';
import { FeatureCta } from '@/components/marketing/feature-cta';
import { Link } from '@/i18n/navigation';
import { CtaPageType } from '@/lib/cta-taxonomy';

/**
 * The "Spec Sheet": shared chrome for every /compare page in the Trackside
 * world (docs/design/web-race-plate-redesign/DIRECTION.md).
 *
 * - The shared kit carries the type and the devices: `.mv-section-title`,
 *   `.mv-h2`, `.mv-h3`, `.mv-section-sub`, `.mv-crumbs`, `.mv-rows` /
 *   `.mv-row`, `.mv-table`, `.mv-link`, `.mv-figure`, `.mv-disclosure`. Only
 *   the compare-specific grammar (mark cells, the sticky matrix column, the
 *   directory rows) lives in the sheet below.
 * - Everything sits on the page surface with --mv-line hairlines; no card.
 *   The verdict is one prose paragraph and the check date is printed once per
 *   page (under the spec sheet, or in the header where there is no sheet).
 * - Yes / partial / no are Lucide marks in ink (yes) and ink-3 (partial, no),
 *   each with a text alternative. Copper marks links only; directory rows
 *   are ink and take copper on hover, so the verb keeps its rarity.
 * - Shared strings (breadcrumb, section titles, mark labels) live in the
 *   `Compare` namespace; per-competitor copy stays in its `Vs*` namespace in
 *   either the flat or the nested key style.
 * - Rhythm: two intervals. Weight sections (tables, the verdict card) open at
 *   96/128; prose sections at 64/96.
 *
 * Both schemes: every colour is a --mv-* token (dark :root, light
 * html:not(.dark)).
 */

export type CompareMark = 'yes' | 'partial' | 'no';

/**
 * The one date every compare page quotes: when features and prices were last
 * checked against the store listings. Interpolated as `{date}` into the
 * `testingPreamble` / `methodology` copy (or `updatedAt` on pages without a
 * spec sheet) — once per page.
 */
export const COMPARE_CHECKED_DATE = 'April 2026';

/** Section rhythm: Tailwind padding classes for the two intervals. */
export const COMPARE_SECTION = {
  /** Tables, the matrix: 96 / 128. */
  weight: 'pt-24 md:pt-32',
  /** Prose, lists, related links: 64 / 96. */
  prose: 'pt-16 md:pt-24',
  /** The closing FAQ before the CTA band. */
  faq: 'pt-24 pb-24 md:pt-32 md:pb-40',
  /** The header after the navbar. */
  header: 'pt-24 md:pt-30',
} as const;

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
  whenToChoose?: { titleKey: string; bodyKey: string };
  pricing: {
    keyStyle: 'flat' | 'nested';
    titleKey?: string;
    rows: number;
    narrativeKey?: string;
  };
  sources?: { headingKey: string; noteKey: string; links: ReadonlyArray<CompareSourceLink> };
  /** Pages without a `quickVerdictKey` close with one prose verdict instead. */
  verdict?: { titleKey: string; bodyKey: string };
  faqCount: number;
  related: ReadonlyArray<ComparePageId>;
}

/* ── Scoped styles: one sheet per page, unique `mv-cmp-` prefix ──
   Only what the shared kit does not carry: the container's gutters, the
   compare text registers, mark cells, matrix modifiers, the directory rows
   and the FAQ summary. */

const COMPARE_CSS = `
.mv-cmp-page { color: var(--mv-ink); }
.mv-cmp-page .mv-section-title { overflow-wrap: anywhere; }
.mv-cmp-wrap { max-width: var(--mv-container); margin: 0 auto; padding-left: 40px; padding-right: 40px; }
@media (max-width: 900px) { .mv-cmp-wrap { padding-left: 24px; padding-right: 24px; } }
@media (max-width: 480px) { .mv-cmp-wrap { padding-left: 20px; padding-right: 20px; } }
.mv-cmp-sub { font-size: 20px; font-weight: 600; line-height: 1.25; color: var(--mv-ink); margin: 0; }
/* No margin shorthand on the text registers: this sheet is unlayered, so a
   \`margin: 0\` here beat every Tailwind \`mt-*\` on them and collapsed the
   H2 → body interval (Tailwind's preflight already zeroes <p> margins). */
.mv-cmp-body { color: var(--mv-ink-2); font-size: 17px; line-height: 1.6; max-width: var(--mv-measure); text-wrap: pretty; }
.mv-cmp-body.is-compact { font-size: 16px; line-height: 1.55; }
.mv-cmp-body.is-strong { color: var(--mv-ink); }
.mv-cmp-body.is-ink { color: var(--mv-ink); font-weight: 500; }
.mv-cmp-body.is-full { max-width: none; }
.mv-cmp-note { color: var(--mv-ink-3); font-size: 15px; line-height: 1.45; max-width: var(--mv-measure); text-wrap: pretty; }
.mv-cmp-meta { color: var(--mv-ink-3); font-size: 13px; line-height: 18px; margin: 0; font-variant-numeric: tabular-nums; text-wrap: pretty; }
.mv-cmp-page .mv-cmp-grid-row { display: grid; align-items: start; gap: 4px 40px; }
.mv-cmp-page .mv-cmp-grid-row > p { max-width: var(--mv-measure); }
.mv-cmp-page .mv-rows .mv-link { font-size: 16px; line-height: 1.55; }
/* The kit's \`.mv-rows { margin: 0 }\` is unlayered too, so the H2 → list
   interval is set here: 24 to a directory list, 32 to the FAQ. */
.mv-cmp-page .mv-h2 + .mv-rows { margin-top: 24px; }
.mv-cmp-page .mv-h2 + .mv-cmp-faq { margin-top: 32px; }
.mv-cmp-dirlink { font-size: 17px; font-weight: 600; line-height: 1.45; color: var(--mv-ink); text-decoration: none; }
.mv-cmp-dirlink:hover { color: var(--mv-copper-text); text-decoration: underline; text-underline-offset: 3px; }
.mv-cmp-sources { margin: 16px 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; font-size: 15px; line-height: 1.45; }
.mv-cmp-tablewrap { max-width: 1040px; overflow-x: auto; -webkit-overflow-scrolling: touch; }
.mv-cmp-tablewrap.is-wide { max-width: none; }
.mv-cmp-tablewrap:focus-visible { outline-offset: -2px; }
@supports (animation-timeline: scroll()) {
  .mv-cmp-tablewrap { animation: mv-cmp-edge linear both; animation-timeline: scroll(self inline); }
}
@keyframes mv-cmp-edge {
  0%, 99% { mask-image: linear-gradient(90deg, black calc(100% - 24px), transparent); }
  100% { mask-image: none; }
}
.mv-cmp-table thead th { white-space: nowrap; }
.mv-cmp-table th.is-sticky { min-width: 140px; max-width: 220px; }
.mv-cmp-table th.is-mv { color: var(--mv-ink); font-weight: 600; }
.mv-cmp-table th.is-mv, .mv-cmp-table td.is-mv { background: var(--mv-surface); }
.mv-cmp-table .is-label { color: var(--mv-ink); font-weight: 500; }
.mv-cmp-table .is-note { color: var(--mv-ink-3); }
.mv-cmp-table .is-comp { color: var(--mv-ink-2); }
.mv-cmp-table .is-center { text-align: center; padding-left: 8px; padding-right: 8px; }
.mv-cmp-table .is-sticky { position: sticky; left: 0; z-index: 1; background: var(--mv-bg); }
.mv-cmp-mark { display: inline-flex; align-items: flex-start; gap: 8px; }
.mv-cmp-mark svg { flex: none; margin-top: 3px; }
.mv-cmp-mark.is-solo svg { margin-top: 0; }
.mv-cmp-mark[data-mark='yes'] { color: var(--mv-ink); }
.mv-cmp-mark[data-mark='partial'], .mv-cmp-mark[data-mark='no'] { color: var(--mv-ink-3); }
.mv-cmp-rule { background: var(--mv-line); }
.mv-cmp-faq details { border-bottom: 1px solid var(--mv-line); }
.mv-cmp-faq summary { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 44px; padding: 12px 0; cursor: pointer; font-size: 17px; font-weight: 600; line-height: 1.45; color: var(--mv-ink); list-style: none; }
.mv-cmp-faq summary::-webkit-details-marker { display: none; }
.mv-cmp-faq summary svg { flex: none; }
.mv-cmp-faq .mv-cmp-body { padding: 0 0 16px; }
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
      <Icon size={16} strokeWidth={mark === 'yes' ? 2.5 : 2} aria-hidden="true" />
      <span className="sr-only">{label}</span>
      {children ? <span>{children}</span> : null}
    </span>
  );
}

/* ── Breadcrumb: the shared `.mv-crumbs`, 40px above the H1 ── */

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
    <nav aria-label="Breadcrumb" style={{ marginBottom: 40 }}>
      <ol className="mv-crumbs" style={{ margin: 0 }}>
        {trail.map((item, i) => (
          <li key={item.label}>
            {i > 0 ? <ChevronRight size={16} strokeWidth={2} aria-hidden="true" /> : null}
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

/* ── FAQ: hairline <details> on the page surface; `.mv-disclosure` turns the
   chevron and eases the height (kit) ── */

export async function CompareFaq({
  items,
}: {
  items: ReadonlyArray<{ question: string; answer: string }>;
}) {
  const tc = await getTranslations('Compare');
  return (
    <>
      <h2 className="mv-h2">{tc('faqTitle')}</h2>
      <div className="mv-cmp-faq mv-rows mt-8" style={{ maxWidth: 760 }}>
        {items.map(({ question, answer }) => (
          <details key={question} className="mv-disclosure">
            <summary>
              <span>{question}</span>
              <ChevronDown size={16} strokeWidth={2} aria-hidden="true" />
            </summary>
            <p className="mv-cmp-body is-compact">{answer}</p>
          </details>
        ))}
      </div>
    </>
  );
}

/* ── Directory rows: the title is the link (ink, copper on hover), the
   one-line verdict beside it ── */

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
      <h2 className="mv-h2">{heading ?? tc('relatedTitle')}</h2>
      <ul className="mv-rows mt-6">
        {ids.map((id) => (
          <li key={id} className="mv-row mv-cmp-grid-row md:grid-cols-[260px_1fr]">
            <Link href={COMPARE_PAGES[id].href} className="mv-cmp-dirlink">
              {tc(`pages.${id}.title`)}
            </Link>
            <p className="mv-cmp-body is-compact is-full">{tc(`pages.${id}.verdict`)}</p>
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
  const { comparison, pricing } = config;
  const flat = comparison.keyStyle === 'flat';
  const pricingFlat = pricing.keyStyle === 'flat';
  const dated = { date: COMPARE_CHECKED_DATE };

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

  return (
    <div className="mv-cmp-page">
      <CompareStyles />

      {/* Hero: breadcrumb, one condensed H1, the lede. Left-aligned; the
          check date is printed once, under the spec sheet. */}
      <header className={`mv-cmp-wrap ${COMPARE_SECTION.header}`}>
        <CompareBreadcrumb current={config.breadcrumbLabel} />
        <h1 className="mv-section-title">{t(config.titleKey)}</h1>
        <p className="mv-section-sub">{t(config.subtitleKey)}</p>
      </header>

      {/* Disambiguation (RideLog shares its name with other apps) */}
      {config.disambiguation ? (
        <section className="mv-cmp-wrap pt-12">
          <p className="mv-cmp-body is-compact">
            <strong style={{ color: 'var(--mv-ink)', fontWeight: 600 }}>
              {t(config.disambiguation.titleKey)}
            </strong>{' '}
            {t(config.disambiguation.noteKey)}
          </p>
        </section>
      ) : null}

      {/* The verdict: one prose paragraph, stated once */}
      {config.quickVerdictKey ? (
        <section className={`mv-cmp-wrap ${COMPARE_SECTION.prose}`}>
          <h2 className="mv-h2">{tc('quickVerdictTitle')}</h2>
          <p className="mv-cmp-body is-strong mt-5">{t(config.quickVerdictKey)}</p>
        </section>
      ) : null}

      {/* App descriptions: two typographic columns, hairline between — the one
          place the page uses the split grid */}
      {config.appDescriptions ? (
        <section className={`mv-cmp-wrap ${COMPARE_SECTION.prose}`}>
          <div className="grid gap-10 lg:grid-cols-[1fr_1px_1fr] lg:gap-12">
            <div>
              <h2 className="mv-h2">{t('mvHeading')}</h2>
              <p className="mv-cmp-body mt-5">{t('mvDescription')}</p>
            </div>
            <div aria-hidden="true" className="mv-cmp-rule hidden lg:block" />
            <div>
              <h2 className="mv-h2">{t('compHeading')}</h2>
              <p className="mv-cmp-body mt-5">{t('compDescription')}</p>
            </div>
          </div>
        </section>
      ) : null}

      {/* The spec sheet: how it was checked (the page's one date), then one
          table with hairline rows. The reveal is this page's one authored
          entrance: it sits below the fold on every page of the family. */}
      <section className={`mv-cmp-wrap mv-reveal ${COMPARE_SECTION.weight}`}>
        <h2 className="mv-h2">
          {comparison.titleKey ? t(comparison.titleKey) : tc('specSheetTitle')}
        </h2>
        {config.testingPreambleKey ? (
          <p className="mv-cmp-note mt-4">{t(config.testingPreambleKey, dated)}</p>
        ) : null}
        <section
          className="mv-cmp-tablewrap mt-8"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be keyboard-reachable
          tabIndex={0}
          aria-label={comparison.titleKey ? t(comparison.titleKey) : tc('specSheetTitle')}
        >
          <table
            className="mv-table mv-cmp-table"
            style={{ minWidth: comparisonHead.notes ? 760 : 560 }}
          >
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
                  <th scope="row">{row.feature}</th>
                  <td className="is-mv">
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
        </section>
      </section>

      {/* Pricing: the table, then the narrative. Figures in the condensed face. */}
      <section className={`mv-cmp-wrap ${COMPARE_SECTION.weight}`}>
        <h2 className="mv-h2">{pricing.titleKey ? t(pricing.titleKey) : tc('pricingTitle')}</h2>
        <section
          className="mv-cmp-tablewrap mt-8"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be keyboard-reachable
          tabIndex={0}
          aria-label={pricing.titleKey ? t(pricing.titleKey) : tc('pricingTitle')}
        >
          <table
            className="mv-table mv-cmp-table"
            style={{ minWidth: pricingHead.notes ? 680 : 520 }}
          >
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
                  <td className="mv-figure is-mv">{row.mv}</td>
                  <td className="mv-figure is-comp">{row.comp}</td>
                  {row.notes !== null ? <td className="is-note">{row.notes}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        {pricing.narrativeKey ? (
          <p className="mv-cmp-body mt-8">{t(pricing.narrativeKey)}</p>
        ) : null}
      </section>

      {/* When the competitor is the right pick: the closing prose */}
      {config.whenToChoose ? (
        <section className={`mv-cmp-wrap ${COMPARE_SECTION.prose}`}>
          <h2 className="mv-h2">{t(config.whenToChoose.titleKey)}</h2>
          <p className="mv-cmp-body mt-5">{t(config.whenToChoose.bodyKey)}</p>
        </section>
      ) : null}

      {/* Sources: external, verify first-hand */}
      {config.sources ? (
        <section className={`mv-cmp-wrap ${COMPARE_SECTION.prose}`}>
          <h2 className="mv-h2">{t(config.sources.headingKey)}</h2>
          <p className="mv-cmp-note mt-4">{t(config.sources.noteKey)}</p>
          <ul className="mv-cmp-sources">
            {config.sources.links.map(({ labelKey, href }) => (
              <li key={labelKey}>
                <a href={href} target="_blank" rel="noopener noreferrer" className="mv-link">
                  {t(labelKey)}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* The verdict on pages that open with app descriptions instead of a
          quick verdict: one prose paragraph, no card */}
      {config.verdict ? (
        <section className={`mv-cmp-wrap ${COMPARE_SECTION.prose}`}>
          <h2 className="mv-h2">{t(config.verdict.titleKey)}</h2>
          <p className="mv-cmp-body is-strong mt-5">{t(config.verdict.bodyKey)}</p>
        </section>
      ) : null}

      {/* Related comparisons: title and one-line verdict per row */}
      <section className={`mv-cmp-wrap ${COMPARE_SECTION.prose}`}>
        <CompareLinkList ids={config.related} />
      </section>

      {/* FAQ */}
      <section className={`mv-cmp-wrap ${COMPARE_SECTION.faq}`}>
        <CompareFaq items={faqItems} />
      </section>

      <FeatureCta pageType={CtaPageType.Compare} />
    </div>
  );
}
