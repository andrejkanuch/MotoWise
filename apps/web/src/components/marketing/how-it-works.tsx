import { getTranslations } from 'next-intl/server';

const STEPS = [
  {
    number: '01',
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
        <path d="M3 9V6a3 3 0 0 1 3-3h3" />
        <path d="M15 3h3a3 3 0 0 1 3 3v3" />
        <path d="M21 15v3a3 3 0 0 1-3 3h-3" />
        <path d="M9 21H6a3 3 0 0 1-3-3v-3" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    number: '02',
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
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <path d="M9 14l2 2 4-4" />
      </svg>
    ),
  },
  {
    number: '03',
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
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
    ),
  },
] as const;

export async function HowItWorks() {
  const t = await getTranslations('HowItWorks');

  return (
    <section className="px-6 py-28">
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

        {/* Steps */}
        <div className="relative grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-12">
          {/* Connector lines (desktop only) */}
          <div
            className="pointer-events-none absolute inset-x-0 top-12 hidden md:block"
            aria-hidden="true"
          >
            <div className="mx-auto flex max-w-[66%] items-center">
              <div
                className="draw-line h-[2px] flex-1 bg-neutral-700"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(90deg, currentColor 0, currentColor 8px, transparent 8px, transparent 14px)',
                  color: 'var(--color-neutral-700)',
                }}
              />
            </div>
          </div>

          {STEPS.map((step, index) => (
            <div
              key={step.number}
              className="reveal-on-scroll relative flex flex-col items-center text-center"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Numbered circle with icon inside */}
              <div className="step-circle mb-8 flex size-[88px] items-center justify-center rounded-full bg-gradient-to-br from-warm-400 to-signature-600 p-[2px]">
                <div className="flex size-full flex-col items-center justify-center gap-0.5 rounded-full bg-neutral-950">
                  <span className="text-xl font-bold leading-none text-neutral-50">
                    {step.number}
                  </span>
                  <div className="text-warm-400">{step.icon}</div>
                </div>
              </div>

              {/* Card */}
              <div className="card-lift w-full rounded-xl border border-neutral-800/60 bg-neutral-900/50 p-8 backdrop-blur-sm">
                <h3 className="text-lg font-semibold text-neutral-50">
                  {t(`step${index + 1}Title`)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-300">
                  {t(`step${index + 1}Desc`)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
