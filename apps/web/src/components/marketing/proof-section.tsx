import { getTranslations } from 'next-intl/server';

interface ProofSectionProps {
  appStoreRating?: { ratingValue: string; reviewCount: string } | null;
}

interface ProofStat {
  value: string;
  suffix?: string;
  label: string;
}

/** The page's one stat row: honest figures in the condensed face with tabular
 *  numerals, left-aligned on the page surface, hairlines above and below
 *  (the `.mv-section-stats` shell). Server-rendered — crawlers and no-JS
 *  users always see the real numbers. */
export async function ProofSection({ appStoreRating }: ProofSectionProps) {
  const t = await getTranslations('Proof');

  const stats: ProofStat[] = [
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
    <section id="proof" className="mv-section-stats mv-grid-stats">
      {stats.map((stat) => (
        <div key={stat.label}>
          <div
            className="mv-figure"
            style={{
              fontSize: 'clamp(40px, 4.5vw, 64px)',
              lineHeight: 1,
              color: 'var(--mv-ink)',
            }}
          >
            {stat.value}
            {stat.suffix && (
              <span style={{ fontSize: '0.45em', fontWeight: 500, color: 'var(--mv-ink-2)' }}>
                {stat.suffix}
              </span>
            )}
          </div>
          <div
            style={{
              marginTop: '12px',
              color: 'var(--mv-ink-3)',
              fontSize: '14px',
              lineHeight: 1.5,
              maxWidth: '240px',
              letterSpacing: '-0.005em',
            }}
          >
            {stat.label}
          </div>
        </div>
      ))}
    </section>
  );
}
