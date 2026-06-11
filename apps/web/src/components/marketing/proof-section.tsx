import { getTranslations } from 'next-intl/server';
import { ProofStat } from './proof-stat';

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
        <ProofStat key={stat.label} value={stat.value} suffix={stat.suffix} label={stat.label} />
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
