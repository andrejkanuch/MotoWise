import { getFormatter, getTranslations } from 'next-intl/server';

interface ProofSectionProps {
  appStoreRating?: { ratingValue: string; reviewCount: string } | null;
}

interface ProofStat {
  value: string;
  suffix?: string;
  label: string;
}

const CATALOGUE_MODELS = 12_000;
const EXPENSE_CATEGORIES = 14;

/** The page's one stat row: honest figures in the condensed face with tabular
 *  numerals, grouped left on the page surface with hairlines above and below
 *  (the `.mv-section-stats` shell). Server-rendered — crawlers and no-JS
 *  users always see the real numbers. The figures are counts the product
 *  can stand behind: models in the catalogue, expense categories, and the
 *  App Store rating when there is one; nothing stands in for a missing one. */
export async function ProofSection({ appStoreRating }: ProofSectionProps) {
  const t = await getTranslations('Proof');
  const fmt = await getFormatter();

  const stats: ProofStat[] = [
    { value: fmt.number(CATALOGUE_MODELS), suffix: '+', label: t('modelsLabel') },
    { value: String(EXPENSE_CATEGORIES), label: t('categoriesLabel') },
    ...(appStoreRating
      ? [
          {
            value: appStoreRating.ratingValue,
            suffix: t('ratingOutOf'),
            label: t('ratingLabelCount', { count: Number(appStoreRating.reviewCount) }),
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
               the width as equal tiles; two or three wrap the same way. */
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
