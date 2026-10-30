import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FeatureContentPage } from '@/components/marketing/feature-content-page';
import { getCanonicalUrl, getHreflangMap } from '@/lib/constants';

export const revalidate = 604800; // 7 days — repo-sourced, rebuilds on deploy

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('FeaturesDiagnostics');
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: getCanonicalUrl(locale, '/features/ai-diagnostics'),
      languages: getHreflangMap('/features/ai-diagnostics'),
    },
  };
}

type Translator = Awaited<ReturnType<typeof getTranslations>>;

const ISSUE_INDEXES = [1, 2, 3, 4, 5, 6, 7, 8] as const;
const STEP_INDEXES = [1, 2, 3, 4] as const;
const FAQ_INDEXES = [0, 1, 2, 3, 4] as const;
const LONG_FORM_KEYS = ['How', 'Examples', 'Comparison'] as const;

/** The sample result's probable causes with their share, as the app reports them. */
const CAUSES = [
  { index: 1, share: 60 },
  { index: 2, share: 25 },
  { index: 3, share: 15 },
] as const;

const FACT_STYLE = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '16px',
  padding: '12px 0',
  borderTop: '1px solid var(--mv-line)',
  fontSize: '15px',
  lineHeight: 1.45,
} as const;

/**
 * One diagnosis as the app returns it: the finding, its severity and
 * confidence, probable causes with their share, tools, difficulty and the
 * next step. A single surface step (no keyline: the hairline rows are the
 * only lines); status ink appears because this is a depiction of the app
 * (Triad Belongs to State Rule).
 */
function DiagnosisResult({ t }: { t: Translator }) {
  const facts = [
    { label: t('resultToolsLabel'), value: t('resultToolsValue') },
    { label: t('resultDifficultyLabel'), value: t('resultDifficultyValue') },
  ];

  return (
    <div
      style={{
        background: 'var(--mv-surface)',
        borderRadius: 'var(--mv-radius-card)',
        padding: '24px',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px 20px',
          fontSize: '13px',
          fontWeight: 500,
          color: 'var(--mv-ink-3)',
        }}
      >
        <span>
          {t('resultSeverityLabel')}{' '}
          <span style={{ color: 'var(--mv-due-ink)' }}>{t('resultSeverityValue')}</span>
        </span>
        <span>
          {t('resultConfidenceLabel')}{' '}
          <span className="mv-figure" style={{ fontSize: '15px', color: 'var(--mv-ink)' }}>
            {t('resultConfidenceValue')}
          </span>
        </span>
      </div>
      <h3 className="mv-h3" style={{ marginTop: '12px' }}>
        {t('scanTitle')}
      </h3>
      <p
        style={{ margin: '10px 0 0', fontSize: '15px', lineHeight: 1.55, color: 'var(--mv-ink-2)' }}
      >
        {t('scanBody')}
      </p>

      <div
        style={{ marginTop: '24px', fontSize: '13px', fontWeight: 500, color: 'var(--mv-ink-3)' }}
      >
        {t('resultCausesLabel')}
      </div>
      <ol style={{ listStyle: 'none', margin: '8px 0 0', padding: 0 }}>
        {CAUSES.map(({ index, share }) => (
          <li key={index} style={{ padding: '10px 0' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '16px',
                fontSize: '15px',
                lineHeight: 1.45,
                color: 'var(--mv-ink)',
              }}
            >
              <span>{t(`resultCause${index}`)}</span>
              <span className="mv-figure" style={{ fontSize: '15px' }}>
                {share}%
              </span>
            </div>
            <div
              aria-hidden="true"
              style={{
                marginTop: '8px',
                height: '4px',
                borderRadius: 'var(--mv-radius-track)',
                background: 'var(--mv-surface-3)',
              }}
            >
              <div
                style={{
                  width: `${share}%`,
                  height: '100%',
                  borderRadius: 'var(--mv-radius-track)',
                  background: 'var(--mv-ink-2)',
                }}
              />
            </div>
          </li>
        ))}
      </ol>

      <dl style={{ margin: '16px 0 0', padding: 0 }}>
        {facts.map((fact) => (
          <div key={fact.label} style={FACT_STYLE}>
            <dt style={{ color: 'var(--mv-ink-3)', flexShrink: 0 }}>{fact.label}</dt>
            <dd style={{ margin: 0, color: 'var(--mv-ink)', textAlign: 'right' }}>{fact.value}</dd>
          </div>
        ))}
        <div style={{ ...FACT_STYLE, flexDirection: 'column', gap: '6px' }}>
          <dt style={{ color: 'var(--mv-ink-3)' }}>{t('resultNextLabel')}</dt>
          <dd style={{ margin: 0, color: 'var(--mv-ink)', lineHeight: 1.5 }}>
            {t('resultNextValue')}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export default async function AiDiagnosticsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('FeaturesDiagnostics');

  return (
    <FeatureContentPage
      locale={locale}
      namespace="FeaturesDiagnostics"
      route="/features/ai-diagnostics"
      screenshots={[
        { src: '/images/marketing/mw/diagnostic-result.png', alt: t('showcaseAlt') },
        {
          src: '/images/marketing/mw/diagnose-hub.png',
          alt: 'MotoVault diagnose hub with past diagnoses for the bike',
        },
      ]}
      // No current capture of the diagnosis screens: keep them out of the hero.
      heroCut={false}
      features={{
        title: t('issuesTitle'),
        items: ISSUE_INDEXES.map((i) => ({ title: t(`issue${i}`) })),
      }}
      steps={{
        title: t('howItWorksTitle'),
        items: [
          ...STEP_INDEXES.map((i) => ({ title: t(`step${i}Title`), body: t(`step${i}Desc`) })),
          { title: t('resultTitle'), body: t('resultDesc') },
        ],
      }}
      demo={{
        title: t('resultDemoTitle'),
        body: t('resultDemoBody'),
        content: <DiagnosisResult t={t} />,
      }}
      longForm={{
        title: t('longFormTitle'),
        intro: t('longFormIntro'),
        sections: LONG_FORM_KEYS.map((key) => ({
          title: t(`longForm${key}Title`),
          body: t(`longForm${key}`),
        })),
      }}
      faqItems={FAQ_INDEXES.map((i) => ({
        question: t(`faq.${i}.question`),
        answer: t(`faq.${i}.answer`),
      }))}
    />
  );
}
