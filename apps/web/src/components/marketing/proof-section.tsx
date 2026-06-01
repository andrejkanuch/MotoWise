import { getTranslations } from 'next-intl/server';

interface ProofSectionProps {
  appStoreRating?: { ratingValue: string; reviewCount: string } | null;
}

export async function ProofSection({ appStoreRating }: ProofSectionProps) {
  const t = await getTranslations('Proof');

  const stats = [
    { value: '4', label: t('toolsLabel') },
    { value: '0', suffix: ` ${t('obdSuffix')}`, label: t('cameraLabel') },
    { value: '100', suffix: '%', label: t('freeLabel') },
    ...(appStoreRating
      ? [
          {
            value: appStoreRating.ratingValue,
            suffix: ` ★ (${appStoreRating.reviewCount})`,
            label: t('ratingLabel'),
          },
        ]
      : [{ value: 'iOS', suffix: ' + Android', label: t('nativeLabel') }]),
  ];

  return (
    <section
      id="proof"
      style={{
        padding: '120px 40px',
        maxWidth: 'var(--mv-container)',
        margin: '0 auto',
        borderTop: '1px solid var(--mv-line)',
        borderBottom: '1px solid var(--mv-line)',
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '48px',
      }}
      className="proof-grid"
    >
      {stats.map((stat) => (
        <div
          key={stat.label}
          style={{
            borderLeft: '1px solid var(--mv-line)',
            paddingLeft: '24px',
          }}
        >
          <div
            style={{
              fontSize: 'clamp(40px, 4.5vw, 68px)',
              fontWeight: 500,
              letterSpacing: '-0.04em',
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--mv-ink)',
            }}
          >
            {stat.value}
            {stat.suffix && (
              <span
                style={{
                  fontSize: '0.5em',
                  fontWeight: 400,
                  color: 'var(--mv-ink-2)',
                }}
              >
                {stat.suffix}
              </span>
            )}
          </div>
          <div
            style={{
              marginTop: '14px',
              color: 'var(--mv-ink-3)',
              fontSize: '13px',
              letterSpacing: '-0.005em',
            }}
          >
            {stat.label}
          </div>
        </div>
      ))}

      <style
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static CSS
        dangerouslySetInnerHTML={{
          __html: `
            @media (max-width: 820px) {
              .proof-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 40px !important; padding: 80px 24px !important; }
            }
          `,
        }}
      />
    </section>
  );
}
