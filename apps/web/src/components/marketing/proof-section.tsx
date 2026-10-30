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
 *  numerals, grouped left on the page surface with hairlines above and below
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
    <section id="proof" className="mv-section-stats proof-row">
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
            /* Figures group left with generous separation instead of filling
               the width as equal tiles; three or four wrap the same way. */
            .proof-row { display: flex; flex-wrap: wrap; gap: 48px 96px; }
            .proof-row > div { max-width: 260px; }
            .proof-figure-row { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
            .proof-figure { font-size: 64px; line-height: 64px; color: var(--mv-ink); }
            .proof-suffix { font-size: 32px; line-height: 1; color: var(--mv-ink-2); }
            .proof-label {
              margin: 12px 0 0;
              color: var(--mv-ink-3);
              font-size: 15px;
              line-height: 1.45;
              letter-spacing: 0;
              text-wrap: pretty;
            }
            @media (max-width: 900px) { .proof-row { gap: 40px 64px; } }
            @media (max-width: 480px) {
              .proof-row { gap: 32px; }
              .proof-figure { font-size: 56px; line-height: 56px; }
              .proof-suffix { font-size: 28px; }
            }
          `,
        }}
      />
    </section>
  );
}
