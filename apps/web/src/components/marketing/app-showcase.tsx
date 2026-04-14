import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ShowcaseImage } from './showcase-image';

const CAPABILITIES = [
  {
    titleKey: 'cap1Title',
    descKey: 'cap1Desc',
    screenshot: '/images/features/maintenance.png',
    altKey: 'cap1Alt',
    accentColor: 'oklch(0.76 0.13 70 / 0.12)',
    href: '/features/garage-management',
    icon: 'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94L6.73 20.2a2 2 0 01-2.83 0l-.1-.1a2 2 0 010-2.83l6.73-6.73A6 6 0 0118.47 2.53',
  },
  {
    titleKey: 'cap2Title',
    descKey: 'cap2Desc',
    screenshot: '/images/features/home.png',
    altKey: 'cap2Alt',
    accentColor: 'oklch(0.65 0.15 160 / 0.12)',
    href: '/features/trip-planning',
    icon: 'M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
  },
  {
    titleKey: 'cap3Title',
    descKey: 'cap3Desc',
    screenshot: '/images/features/diagnose-flow/result-overview.png',
    altKey: 'cap3Alt',
    accentColor: 'oklch(0.65 0.14 230 / 0.12)',
    href: '/features/ai-diagnostics',
    icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z',
  },
] as const;

export async function AppShowcase() {
  const t = await getTranslations('AppShowcase');

  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-2xl font-bold tracking-tight text-neutral-50 sm:text-3xl">
          {t('sectionTitle')}
        </h2>

        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {CAPABILITIES.map((cap) => (
            <Link
              key={cap.titleKey}
              href={cap.href as '/features/ai-diagnostics'}
              className="group"
            >
              {/* Screenshot — no fake phone frame */}
              <div className="overflow-hidden rounded-xl bg-neutral-900">
                <ShowcaseImage
                  src={cap.screenshot}
                  alt={t(cap.altKey)}
                  width={1206}
                  height={2622}
                  sizes="(max-width: 768px) 100vw, 300px"
                />
              </div>

              {/* Text */}
              <h3 className="mt-4 text-base font-semibold text-neutral-100 group-hover:text-warm-400 transition-colors">
                {t(cap.titleKey)}
              </h3>
              <p className="mt-1 text-sm text-neutral-400">{t(cap.descKey)}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
