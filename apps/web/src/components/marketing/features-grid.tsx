import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

type FeatureKey = 'trip' | 'maintenance' | 'expenses' | 'rides' | 'diag' | 'garage';

const GRID_CLASSES: Record<FeatureKey, string> = {
  trip:
    'md:col-span-2 lg:col-span-3 lg:[grid-area:trip] border-warm-500/40 bg-gradient-to-br from-neutral-900/90 via-neutral-900/60 to-neutral-900/30',
  maintenance:
    'md:col-span-2 lg:[grid-area:maintenance] border-warm-500/30 bg-gradient-to-br from-neutral-900/80 to-neutral-900/40',
  expenses: 'lg:row-span-2 lg:[grid-area:expenses]',
  rides: 'lg:row-span-2 lg:[grid-area:rides]',
  diag: 'lg:row-span-2 lg:[grid-area:diag]',
  garage: 'lg:[grid-area:garage]',
};

const ICON_HOVER: Record<FeatureKey, string> = {
  trip: 'icon-rev-hover', // route animates
  maintenance: 'icon-spin-hover', // wrench turns
  expenses: 'icon-rev-hover', // chart pops
  rides: 'icon-rev-hover', // map pulses
  diag: 'icon-rev-hover', // scanner pulses
  garage: 'icon-rev-hover', // garage pulses
};

const FEATURE_LINKS: Partial<Record<FeatureKey, string>> = {
  trip: '/features/trip-planning',
  diag: '/features/ai-diagnostics',
  garage: '/features/garage-management',
};

const FEATURES = [
  {
    key: 'trip' as const,
    accentClass: 'text-warm-400',
    glowColor: 'oklch(0.70 0.16 150 / 0.10)',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-6"
        aria-hidden="true"
      >
        <path d="M12 22s7-7.58 7-13a7 7 0 1 0-14 0c0 5.42 7 13 7 13z" />
        <circle cx="12" cy="9" r="2.5" />
      </svg>
    ),
  },
  {
    key: 'maintenance' as const,
    accentClass: 'text-warm-400',
    glowColor: 'oklch(0.76 0.13 70 / 0.08)',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-6"
        aria-hidden="true"
      >
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94L6.73 20.2a2 2 0 0 1-2.83 0l-.1-.1a2 2 0 0 1 0-2.83l6.73-6.73A6 6 0 0 1 18.47 2.53" />
      </svg>
    ),
  },
  {
    key: 'expenses' as const,
    accentClass: 'text-accent-400',
    glowColor: 'oklch(0.65 0.15 160 / 0.08)',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-6"
        aria-hidden="true"
      >
        <path d="M12 2v20" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    key: 'rides' as const,
    accentClass: 'text-primary-400',
    glowColor: 'oklch(0.65 0.14 230 / 0.08)',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-6"
        aria-hidden="true"
      >
        <path d="M3 6l6-3 6 3 6-3v14l-6 3-6-3-6 3V6z" />
        <path d="M9 3v14" />
        <path d="M15 6v14" />
      </svg>
    ),
  },
  {
    key: 'diag' as const,
    accentClass: 'text-signature-400',
    glowColor: 'oklch(0.68 0.15 45 / 0.08)',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-6"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="3.5" />
        <path d="M3 9V6a3 3 0 0 1 3-3h3" />
        <path d="M15 3h3a3 3 0 0 1 3 3v3" />
        <path d="M21 15v3a3 3 0 0 1-3 3h-3" />
        <path d="M9 21H6a3 3 0 0 1-3-3v-3" />
      </svg>
    ),
  },
  {
    key: 'garage' as const,
    accentClass: 'text-primary-300',
    glowColor: 'oklch(0.76 0.1 230 / 0.08)',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-6"
        aria-hidden="true"
      >
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
];

export async function FeaturesGrid() {
  const t = await getTranslations('Features');

  return (
    <section id="features" className="px-6 py-28 lg:py-32">
      <div className="mx-auto max-w-7xl">
        {/* Section header */}
        <div className="reveal-on-scroll mb-16 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
            {t('sectionLabel')}
          </p>
          <h2 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 text-balance sm:text-4xl lg:text-5xl">
            {t('sectionTitle')}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-neutral-400">{t('sectionSubtitle')}</p>
        </div>

        {/* Bento grid */}
        <div className="features-bento grid auto-rows-[minmax(220px,auto)] grid-cols-1 gap-5 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
          {FEATURES.map((feature, index) => {
            const href = FEATURE_LINKS[feature.key];
            const cardClassName = `card-lift reveal-on-scroll group relative overflow-hidden rounded-xl border border-neutral-800/60 bg-neutral-900/50 p-8 backdrop-blur-sm transition-colors hover:border-warm-500/40 md:p-10 ${GRID_CLASSES[feature.key]}`;

            const cardContent = (
              <>
                {/* Radial glow — intensifies on hover */}
                <div
                  className="pointer-events-none absolute inset-0 opacity-40 transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    background: `radial-gradient(ellipse at 50% 0%, ${feature.glowColor}, transparent 70%)`,
                  }}
                />

                {/* Maintenance hero card — ambient glow ring */}
                {feature.key === 'maintenance' && (
                  <div
                    className="maintenance-hero-glow pointer-events-none absolute -right-16 -top-16 size-64 rounded-full"
                    aria-hidden="true"
                    style={{
                      background:
                        'radial-gradient(circle, oklch(0.76 0.13 70 / 0.15), transparent 70%)',
                    }}
                  />
                )}

                {/* Bottom accent on hover */}
                <div className="absolute inset-x-0 bottom-0 h-[3px] bg-transparent transition-colors duration-300 group-hover:bg-warm-500" />

                {/* Content */}
                <div className="relative z-10 flex h-full min-w-0 flex-col">
                  <div className="flex items-start justify-between">
                    <div
                      className={`mb-4 flex size-10 items-center justify-center rounded-xl bg-neutral-800/80 ${ICON_HOVER[feature.key]} ${feature.accentClass}`}
                    >
                      {feature.icon}
                    </div>

                    {/* Metric badge */}
                    <span className="badge-pop rounded-full border border-warm-500/30 bg-warm-500/10 px-3 py-1 text-xs font-medium text-warm-400">
                      {t(`${feature.key}.badge`)}
                    </span>
                  </div>

                  <h3 className="text-lg font-semibold text-neutral-50">
                    {t(`${feature.key}.title`)}
                  </h3>
                  <p className={`mt-1 text-sm font-medium ${feature.accentClass}`}>
                    {t(`${feature.key}.tagline`)}
                  </p>
                  <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-neutral-300">
                    {t(`${feature.key}.description`)}
                  </p>
                </div>
              </>
            );

            return href ? (
              <Link
                key={feature.key}
                href={href}
                className={cardClassName}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {cardContent}
              </Link>
            ) : (
              <article
                key={feature.key}
                className={cardClassName}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {cardContent}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
