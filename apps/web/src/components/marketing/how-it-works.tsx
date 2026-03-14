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
        <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
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
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
        <path d="M9 7h6" />
        <path d="M9 11h4" />
      </svg>
    ),
  },
] as const;

export async function HowItWorks() {
  const t = await getTranslations('HowItWorks');

  return (
    <section className="px-4 py-32">
      <div className="mx-auto max-w-7xl">
        {/* Section header */}
        <div className="reveal-on-scroll mb-20 text-center">
          <h2 className="text-4xl font-extrabold tracking-tight text-neutral-50 sm:text-5xl lg:text-6xl">
            {t('sectionTitle')}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-neutral-400">{t('sectionSubtitle')}</p>
        </div>

        {/* Steps */}
        <div className="relative grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-8">
          {/* Connector lines (desktop only) */}
          <div
            className="pointer-events-none absolute inset-x-0 top-[44px] hidden md:block"
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
                  <span className="text-xl font-extrabold leading-none text-neutral-50">
                    {step.number}
                  </span>
                  <div className="text-warm-400">{step.icon}</div>
                </div>
              </div>

              {/* Card */}
              <div className="card-lift w-full rounded-2xl border-2 border-neutral-800 bg-neutral-900/70 p-8">
                <h3 className="text-xl font-semibold text-neutral-50">
                  {t(`step${index + 1}Title`)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-400">
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
