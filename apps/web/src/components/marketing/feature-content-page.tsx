import { getTranslations } from 'next-intl/server';
import { FeatureCta } from '@/components/marketing/feature-cta';
import { FeatureScreenshotPair } from '@/components/marketing/feature-screenshot';
import { JsonLdGraph } from '@/components/marketing/json-ld-graph';
import { Link } from '@/i18n/navigation';
import { getCanonicalUrl } from '@/lib/constants';
import { buildBreadcrumbList, buildFAQPage, buildGraph, buildWebPage } from '@/lib/seo/schema';

interface FeatureContentPageProps {
  locale: string;
  namespace: string;
  route: string;
  screenshots: { src: string; alt: string }[];
  /**
   * Kept for backward compatibility with the seven feature pages. The
   * Trackside direction replaced the icon-tile grid with a numbered
   * editorial list (plate-chip markers), so the icons are no longer drawn.
   */
  featureIcons?: readonly [string, string, string];
}

/**
 * Shared feature-page template in the Trackside voice: condensed display
 * headlines, left-aligned editorial sections sitting directly on the graphite
 * ramp (no card wrappers), plate-chip numerals instead of icon tiles, and
 * copper strictly on actions. All colours come from the `--mv-*` tokens so
 * both schemes work.
 */
export async function FeatureContentPage({
  locale,
  namespace,
  route,
  screenshots,
}: FeatureContentPageProps) {
  const t = await getTranslations(namespace);
  // Second translator for the shared /compare inbound link — keeps the copy in
  // the single `Compare` namespace instead of duplicating a key into every
  // feature namespace.
  const tCompare = await getTranslations('Compare');
  const canonical = getCanonicalUrl(locale, route);

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

  const features = [
    { titleKey: 'f1Title', descKey: 'f1Desc' },
    { titleKey: 'f2Title', descKey: 'f2Desc' },
    { titleKey: 'f3Title', descKey: 'f3Desc' },
  ] as const;

  const sections = [
    { titleKey: 's1Title', bodyKey: 's1Body' },
    { titleKey: 's2Title', bodyKey: 's2Body' },
    { titleKey: 's3Title', bodyKey: 's3Body' },
  ] as const;

  return (
    <>
      <JsonLdGraph nodes={graph} />

      {/* Hero: breadcrumb + condensed display headline, left-aligned on the ground */}
      <header className="mv-section-hero" style={{ paddingTop: '128px', paddingBottom: '72px' }}>
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
                  {t('title')}
                </span>
              </li>
            </ol>
          </nav>

          <h1 className="mv-section-title" style={{ maxWidth: '16ch' }}>
            {t('heroTitle')}
          </h1>
          <p className="mv-section-sub">{t('heroSubtitle')}</p>
        </div>
      </header>

      <FeatureScreenshotPair screenshots={screenshots} />

      {/* Feature list: asymmetric editorial split — big title left, numbered
          plate-chip list right. No cards, no icon tiles; spacing separates. */}
      <section className="mv-section">
        <div className="mv-grid-2" style={{ alignItems: 'start' }}>
          <h2 className="mv-section-title reveal-on-scroll">{t('featuresTitle')}</h2>
          <ol
            className="reveal-on-scroll"
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '48px',
            }}
          >
            {features.map(({ titleKey, descKey }, index) => (
              <li key={titleKey} style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                <span className="mv-plate-chip" aria-hidden="true" style={{ marginTop: '2px' }}>
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: '17px',
                      fontWeight: 600,
                      color: 'var(--mv-ink)',
                      letterSpacing: '-0.005em',
                    }}
                  >
                    {t(titleKey)}
                  </h3>
                  <p
                    style={{
                      margin: '8px 0 0',
                      fontSize: '15px',
                      lineHeight: 1.6,
                      color: 'var(--mv-ink-2)',
                      maxWidth: '52ch',
                    }}
                  >
                    {t(descKey)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Long-form: a deeper step on the ramp carries the editorial read —
          the band itself separates, so no dividers anywhere inside. */}
      <section style={{ background: 'var(--mv-bg-2)' }}>
        <div className="mv-section-inner" style={{ maxWidth: '820px' }}>
          <h2
            className="mv-display reveal-on-scroll"
            style={{
              margin: 0,
              fontSize: 'clamp(36px, 4.5vw, 56px)',
              fontWeight: 700,
              lineHeight: 1.02,
            }}
          >
            {t('longFormTitle')}
          </h2>
          <p
            style={{
              margin: '28px 0 0',
              fontSize: '18px',
              lineHeight: 1.6,
              color: 'var(--mv-ink-2)',
            }}
          >
            {t('longFormIntro')}
          </p>
          {sections.map(({ titleKey, bodyKey }) => (
            <div key={titleKey} style={{ marginTop: '72px' }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: '19px',
                  fontWeight: 600,
                  color: 'var(--mv-ink)',
                  letterSpacing: '-0.005em',
                }}
              >
                {t(titleKey)}
              </h3>
              <p
                style={{
                  margin: '16px 0 0',
                  fontSize: '16px',
                  lineHeight: 1.65,
                  color: 'var(--mv-ink-2)',
                }}
              >
                {t(bodyKey)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ: hairline <details> rows directly on the page surface */}
      <section className="mv-section" style={{ maxWidth: '820px' }}>
        <h2
          className="mv-display reveal-on-scroll"
          style={{
            margin: 0,
            fontSize: 'clamp(32px, 4vw, 48px)',
            fontWeight: 700,
            lineHeight: 1.02,
          }}
        >
          {t('faqTitle')}
        </h2>
        <div style={{ marginTop: '48px', borderBottom: '1px solid var(--mv-line)' }}>
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
                  alignItems: 'baseline',
                  gap: '16px',
                  padding: '20px 0',
                  minHeight: '44px',
                  cursor: 'pointer',
                  listStyle: 'none',
                }}
              >
                <span
                  className="mv-figure"
                  aria-hidden="true"
                  style={{ fontSize: '16px', color: 'var(--mv-ink-4)' }}
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
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
                  margin: 0,
                  padding: '0 0 24px 34px',
                  fontSize: '15px',
                  lineHeight: 1.65,
                  color: 'var(--mv-ink-2)',
                  maxWidth: '62ch',
                }}
              >
                {answer}
              </p>
            </details>
          ))}
        </div>

        <p style={{ margin: '40px 0 0', fontSize: '15px', color: 'var(--mv-ink-3)' }}>
          {t('faqMore')}{' '}
          <Link
            href="/support"
            style={{
              color: 'var(--mv-copper-text)',
              textDecoration: 'underline',
              textUnderlineOffset: '4px',
            }}
          >
            {t('faqSupportLink')}
          </Link>
        </p>
        {/* Hub-and-spoke inbound link: every feature page feeds the /compare
            money page for internal-link equity + discovery. */}
        <p style={{ margin: '12px 0 0', fontSize: '15px' }}>
          <Link
            href="/compare"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 500,
              color: 'var(--mv-copper-text)',
              textDecoration: 'underline',
              textUnderlineOffset: '4px',
            }}
          >
            {tCompare('compareInboundLink')}
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
          </Link>
        </p>
      </section>

      <FeatureCta />
    </>
  );
}
