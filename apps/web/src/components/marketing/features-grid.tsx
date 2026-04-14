import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

const FEATURES = [
  {
    key: 'trip' as const,
    screenshot: '/images/features/trip-planning/trip-detail-hero-anon.png',
    altKey: 'tripAlt',
    href: '/features/trip-planning',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-5"
        aria-hidden="true"
      >
        <path d="M12 22s7-7.58 7-13a7 7 0 1 0-14 0c0 5.42 7 13 7 13z" />
        <circle cx="12" cy="9" r="2.5" />
      </svg>
    ),
  },
  {
    key: 'maintenance' as const,
    screenshot: '/images/features/maintenance.png',
    altKey: 'maintenanceAlt',
    href: '/features/garage-management',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-5"
        aria-hidden="true"
      >
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94L6.73 20.2a2 2 0 0 1-2.83 0l-.1-.1a2 2 0 0 1 0-2.83l6.73-6.73A6 6 0 0 1 18.47 2.53" />
      </svg>
    ),
  },
  {
    key: 'expenses' as const,
    screenshot: '/images/features/expenses.png',
    altKey: 'expensesAlt',
    href: '/features/trip-planning',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-5"
        aria-hidden="true"
      >
        <path d="M12 2v20" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
] as const;

export async function FeaturesGrid() {
  const t = await getTranslations('Features');
  const tTest = await getTranslations('Testimonials');

  return (
    <section id="features" className="px-6 py-24 lg:py-28">
      <div className="mx-auto max-w-6xl">
        {/* Section header */}
        <div className="reveal-on-scroll mb-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-neutral-50 sm:text-4xl">
            {t('sectionTitle')}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-neutral-400">{t('sectionSubtitle')}</p>
        </div>

        {/* 3-column features */}
        <div className="grid gap-8 md:grid-cols-3">
          {FEATURES.map((feature) => (
            <Link
              key={feature.key}
              href={feature.href as '/features/trip-planning'}
              className="reveal-on-scroll group"
            >
              {/* Screenshot */}
              <div className="overflow-hidden rounded-2xl bg-neutral-900 transition-transform duration-300 group-hover:-translate-y-1">
                <Image
                  src={feature.screenshot}
                  alt={t(feature.altKey)}
                  width={1206}
                  height={2622}
                  className="block w-full"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              </div>

              {/* Text */}
              <div className="mt-5 flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-neutral-800 text-warm-400">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-neutral-50 transition-colors group-hover:text-warm-400">
                    {t(`${feature.key}.title`)}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-neutral-400">
                    {t(`${feature.key}.tagline`)}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Plus line — acknowledge other features without a full card */}
        <p className="mt-12 text-center text-sm text-neutral-500">{t('plusLine')}</p>

        {/* Single testimonial */}
        <blockquote className="reveal-on-scroll mx-auto mt-16 max-w-2xl border-l-2 border-warm-500 py-1 pl-6">
          <p className="text-lg leading-relaxed text-neutral-200 italic">
            &ldquo;{tTest('items.2.quote')}&rdquo;
          </p>
          <footer className="mt-3 text-sm text-neutral-500">
            {tTest('items.2.name')} — {tTest('items.2.bike')}
          </footer>
        </blockquote>
      </div>
    </section>
  );
}
