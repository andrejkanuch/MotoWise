import { getTranslations } from 'next-intl/server';

type FeatureKey = 'diag' | 'learn' | 'garage' | 'progress' | 'community';

const GRID_CLASSES: Record<FeatureKey, string> = {
  diag: 'md:col-span-2 lg:[grid-area:diag]',
  learn: 'lg:row-span-2 lg:[grid-area:learn]',
  garage: 'lg:row-span-2 lg:[grid-area:garage]',
  progress: 'lg:row-span-2 lg:[grid-area:progress]',
  community: 'lg:[grid-area:community]',
};

const FEATURES = [
  {
    key: 'diag' as const,
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
        <circle cx="12" cy="12" r="3.5" />
        <path d="M3 9V6a3 3 0 0 1 3-3h3" />
        <path d="M15 3h3a3 3 0 0 1 3 3v3" />
        <path d="M21 15v3a3 3 0 0 1-3 3h-3" />
        <path d="M9 21H6a3 3 0 0 1-3-3v-3" />
      </svg>
    ),
  },
  {
    key: 'learn' as const,
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
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
        <path d="M9 7h6" />
        <path d="M9 11h4" />
      </svg>
    ),
  },
  {
    key: 'garage' as const,
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
    key: 'progress' as const,
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
        <path d="M3 3v18h18" />
        <path d="M7 16l4-8 4 5 5-9" />
      </svg>
    ),
  },
  {
    key: 'community' as const,
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
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
];

export async function FeaturesGrid() {
  const t = await getTranslations('Features');

  return (
    <section id="features" className="px-4 py-24">
      <div className="mx-auto max-w-7xl">
        {/* Section header */}
        <div className="reveal-on-scroll mb-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-neutral-50 sm:text-4xl lg:text-5xl">
            {t('sectionTitle')}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-neutral-400">{t('sectionSubtitle')}</p>
        </div>

        {/* Bento grid */}
        <div className="features-bento grid auto-rows-[minmax(220px,auto)] grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <article
              key={feature.key}
              className={`reveal-on-scroll group relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 transition-colors hover:border-neutral-700 md:p-8 ${GRID_CLASSES[feature.key]}`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Radial glow — intensifies on hover */}
              <div
                className="pointer-events-none absolute inset-0 opacity-40 transition-opacity duration-300 group-hover:opacity-100"
                style={{
                  background: `radial-gradient(ellipse at 50% 0%, ${feature.glowColor}, transparent 70%)`,
                }}
              />

              {/* Bottom accent on hover */}
              <div className="absolute inset-x-0 bottom-0 h-[2px] bg-transparent transition-colors duration-300 group-hover:bg-primary-500/50" />

              {/* Content */}
              <div className="relative z-10 flex h-full flex-col">
                <div className="flex items-start justify-between">
                  <div
                    className={`mb-4 flex size-10 items-center justify-center rounded-xl bg-neutral-800/80 transition-transform duration-300 group-hover:rotate-[5deg] group-hover:scale-105 ${feature.accentClass}`}
                  >
                    {feature.icon}
                  </div>

                  {/* Metric badge */}
                  <span className="rounded-full border border-neutral-700 bg-neutral-800 px-3 py-1 text-xs font-medium text-accent-400">
                    {t(`${feature.key}.badge`)}
                  </span>
                </div>

                <h3 className="text-lg font-semibold text-neutral-50">
                  {t(`${feature.key}.title`)}
                </h3>
                <p className={`mt-1 text-sm font-medium ${feature.accentClass}`}>
                  {t(`${feature.key}.tagline`)}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-neutral-400">
                  {t(`${feature.key}.description`)}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
