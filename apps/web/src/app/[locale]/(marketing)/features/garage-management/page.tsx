import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BikePlate } from '@/components/marketing/bike-plate';
import { FeatureContentPage } from '@/components/marketing/feature-content-page';
import { getCanonicalUrl, getHreflangMap } from '@/lib/constants';

export const revalidate = 604800; // 7 days — repo-sourced, rebuilds on deploy

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('FeaturesGarage');
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: getCanonicalUrl(locale, '/features/garage-management'),
      languages: getHreflangMap('/features/garage-management'),
    },
  };
}

const FEATURE_KEYS = ['multiBike', 'nhtsa', 'history', 'reminders'] as const;

const LONG_FORM_KEYS = ['MultiBike', 'Scheduling', 'Resale'] as const;

/** The depicted service timeline: one bike's log, as the app shows it. */
const MAINT_ROWS = [
  { index: 1, status: 'done' },
  { index: 2, status: 'due' },
  { index: 3, status: 'done' },
  { index: 4, status: 'upcoming' },
  { index: 5, status: 'done' },
] as const;

/** Status ink inside the depiction only (Triad Belongs to State Rule). */
const MAINT_STATUS_INK: Record<(typeof MAINT_ROWS)[number]['status'], string> = {
  done: 'var(--mv-go)',
  due: 'var(--mv-due-ink)',
  upcoming: 'var(--mv-ink-3)',
};

const CELL_STYLE = {
  padding: '16px 24px 16px 0',
  borderTop: '1px solid var(--mv-line)',
  verticalAlign: 'top',
} as const;

function MaintenanceTimeline({ t }: { t: Awaited<ReturnType<typeof getTranslations>> }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          minWidth: '640px',
          borderCollapse: 'collapse',
          fontSize: '15px',
          lineHeight: 1.45,
          color: 'var(--mv-ink-2)',
        }}
      >
        <thead>
          <tr>
            {[t('maintColTask'), t('maintColWhen'), t('maintColOdometer'), t('maintColStatus')].map(
              (column) => (
                <th
                  key={column}
                  scope="col"
                  style={{
                    textAlign: 'left',
                    fontWeight: 500,
                    fontSize: '13px',
                    color: 'var(--mv-ink-3)',
                    padding: '0 24px 12px 0',
                  }}
                >
                  {column}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {MAINT_ROWS.map(({ index, status }) => (
            <tr key={index}>
              <th scope="row" style={{ ...CELL_STYLE, textAlign: 'left', fontWeight: 400 }}>
                <span style={{ display: 'block', fontWeight: 600, color: 'var(--mv-ink)' }}>
                  {t(`maint${index}Label`)}
                </span>
                <span style={{ display: 'block', fontSize: '13px', color: 'var(--mv-ink-3)' }}>
                  {t(`maint${index}Sub`)}
                </span>
              </th>
              <td className="mv-figure" style={{ ...CELL_STYLE, fontSize: '17px' }}>
                {t(`maint${index}Date`)}
              </td>
              <td
                className="mv-figure"
                style={{ ...CELL_STYLE, fontSize: '17px', color: 'var(--mv-ink-3)' }}
              >
                {t(`maint${index}Miles`)}
              </td>
              <td
                style={{
                  ...CELL_STYLE,
                  fontSize: '14px',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  color: MAINT_STATUS_INK[status],
                }}
              >
                {t(`maint${index}Status`)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function GarageManagementPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('FeaturesGarage');

  return (
    <FeatureContentPage
      locale={locale}
      namespace="FeaturesGarage"
      route="/features/garage-management"
      screenshots={[
        {
          src: '/images/marketing/mw/garage.png',
          alt: 'MotoVault garage with every bike, its odometer and what is due next',
        },
        {
          src: '/images/marketing/mw/service-history.png',
          alt: 'MotoVault service history for one bike',
        },
      ]}
      heroVisual={
        <BikePlate
          figure="14,820"
          unit="mi"
          caption={t('plateCaption')}
          racingNumber="07"
          identity={t('plateIdentity')}
          state="due"
        />
      }
      features={{
        title: t('featuresTitle'),
        items: FEATURE_KEYS.map((key) => ({ title: t(`${key}Title`), desc: t(`${key}Desc`) })),
      }}
      demo={{
        title: t('maintTitle'),
        body: t('maintSubtitle'),
        content: <MaintenanceTimeline t={t} />,
        wide: true,
      }}
      longForm={{
        title: t('longFormTitle'),
        intro: t('longFormIntro'),
        sections: LONG_FORM_KEYS.map((key) => ({
          title: t(`longForm${key}Title`),
          body: t(`longForm${key}`),
        })),
      }}
      faqItems={[0, 1, 2, 3, 4].map((i) => ({
        question: t(`faq.${i}.question`),
        answer: t(`faq.${i}.answer`),
      }))}
      related={['/features/maintenance', '/features/expense-tracking']}
    />
  );
}
