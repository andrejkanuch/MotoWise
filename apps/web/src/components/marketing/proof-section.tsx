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
 *  users always see the real numbers. With no App Store rating the row is
 *  three figures wide; nothing stands in for the missing one. */
export async function ProofSection({ appStoreRating }: ProofSectionProps) {
  const t = await getTranslations('Proof');

  const stats: ProofStat[] = [
    { value: '5', label: t('toolsLabel') },
    { value: '0', suffix: t('obdSuffix'), label: t('cameraLabel') },
    { value: '100', suffix: '%', label: t('freeLabel') },
    ...(appStoreRating
      ? [
          {
            value: appStoreRating.ratingValue,
            suffix: t('ratingOutOf'),
            label: t('ratingLabelCount', { count: appStoreRating.reviewCount }),
          },
        ]
      : []),
  ];

  return (
    <section
      id="proof"
      className={`mv-section-stats mv-grid-stats${appStoreRating ? '' : ' proof-grid-3'}`}
    >
      {stats.map((stat) => (
        <div key={stat.label}>
          <div className="proof-figure-row">
            <span className="mv-figure proof-figure">{stat.value}</span>
            {stat.suffix && (
              <span className="mv-figure proof-suffix" style={{ fontWeight: 500 }}>
                {stat.suffix}
              </span>
            )}
          </div>
          <p className="proof-label">{stat.label}</p>
        </div>
      ))}
      <style
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static CSS
        dangerouslySetInnerHTML={{
          __html: `
            .proof-grid-3 { grid-template-columns: repeat(3, 1fr); }
            .proof-figure-row { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
            .proof-figure { font-size: clamp(44px, 4.5vw, 64px); line-height: 1; color: var(--mv-ink); }
            .proof-suffix { font-size: clamp(20px, 2vw, 28px); line-height: 1; color: var(--mv-ink-2); }
            .proof-label {
              margin: 12px 0 0;
              color: var(--mv-ink-3);
              font-size: 14px;
              line-height: 1.5;
              max-width: 260px;
              letter-spacing: -0.005em;
            }
            @media (max-width: 900px) { .proof-grid-3 { grid-template-columns: 1fr 1fr; } }
            @media (max-width: 480px) { .proof-grid-3 { grid-template-columns: 1fr; } }
          `,
        }}
      />
    </section>
  );
}
