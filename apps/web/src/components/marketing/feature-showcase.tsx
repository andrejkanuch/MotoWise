import Image from 'next/image';

interface ShowcaseItem {
  label: string;
  title: string;
  description: string;
  bullets?: string[];
  screenshot: { src: string; alt: string };
  stat?: { value: string; label: string };
}

export function FeatureShowcase({ items }: { items: ShowcaseItem[] }) {
  return (
    <div className="space-y-24 md:space-y-32">
      {items.map((item, i) => {
        const reversed = i % 2 === 1;
        return (
          <div
            key={item.title}
            className={`reveal-on-scroll mx-auto flex max-w-6xl flex-col items-center gap-10 px-6 md:gap-16 ${
              reversed ? 'md:flex-row-reverse' : 'md:flex-row'
            }`}
          >
            {/* Phone mockup */}
            <div className="relative w-[240px] shrink-0 md:w-[280px]">
              <div className="relative rounded-[2.5rem] border-[6px] border-neutral-800 bg-neutral-900 p-1.5 shadow-2xl ring-1 ring-neutral-700/50">
                <div className="absolute left-1/2 top-0 z-10 h-5 w-24 -translate-x-1/2 rounded-b-2xl bg-neutral-800" />
                <div className="overflow-hidden rounded-[2rem]">
                  <Image
                    src={item.screenshot.src}
                    alt={item.screenshot.alt}
                    width={1206}
                    height={2622}
                    className="block w-full"
                    sizes="280px"
                    loading="lazy"
                  />
                </div>
                <div className="mx-auto mt-1.5 h-1 w-20 rounded-full bg-neutral-700" />
              </div>
              {/* Glow */}
              <div
                className="pointer-events-none absolute inset-0 -z-10 blur-3xl"
                style={{
                  background:
                    'radial-gradient(ellipse 80% 60% at 50% 50%, oklch(0.55 0.17 230 / 0.12), transparent)',
                }}
                aria-hidden="true"
              />
            </div>

            {/* Text content */}
            <div className="flex-1 text-center md:text-left">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
                {item.label}
              </p>
              <h3 className="text-2xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-3xl lg:text-4xl">
                {item.title}
              </h3>
              <p className="mt-4 text-lg leading-relaxed text-neutral-400">{item.description}</p>

              {item.bullets && item.bullets.length > 0 && (
                <ul className="mt-6 space-y-3">
                  {item.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-3 text-neutral-300">
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="mt-0.5 shrink-0 text-accent-400"
                        aria-hidden="true"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              )}

              {item.stat && (
                <div className="mt-8 inline-flex rounded-xl border border-neutral-800 bg-neutral-900/50 px-6 py-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-warm-400">{item.stat.value}</p>
                    <p className="mt-1 text-xs text-neutral-500">{item.stat.label}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface FlowStep {
  number: string;
  title: string;
  description: string;
  screenshot: { src: string; alt: string };
}

export function FeatureFlow({
  label,
  title,
  steps,
}: {
  label: string;
  title: string;
  steps: FlowStep[];
}) {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <div className="reveal-on-scroll mb-16 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
            {label}
          </p>
          <h2 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl">
            {title}
          </h2>
        </div>

        <div className="relative">
          {/* Vertical connector line (desktop) */}
          <div
            className="pointer-events-none absolute left-1/2 top-0 hidden h-full w-px -translate-x-1/2 md:block"
            style={{
              backgroundImage:
                'repeating-linear-gradient(180deg, var(--color-neutral-700) 0, var(--color-neutral-700) 8px, transparent 8px, transparent 16px)',
            }}
            aria-hidden="true"
          />

          <div className="space-y-16 md:space-y-24">
            {steps.map((step, i) => {
              const reversed = i % 2 === 1;
              return (
                <div
                  key={step.number}
                  className={`reveal-on-scroll flex flex-col items-center gap-8 md:gap-12 ${
                    reversed ? 'md:flex-row-reverse' : 'md:flex-row'
                  }`}
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  {/* Text side */}
                  <div className="flex flex-1 flex-col items-center text-center md:items-end md:text-right">
                    {!reversed && (
                      <StepContent
                        number={step.number}
                        title={step.title}
                        description={step.description}
                        align="right"
                      />
                    )}
                    {reversed && (
                      <StepContent
                        number={step.number}
                        title={step.title}
                        description={step.description}
                        align="left"
                      />
                    )}
                  </div>

                  {/* Center dot */}
                  <div className="relative z-10 hidden md:block">
                    <div className="flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-warm-400 to-signature-600 p-[2px]">
                      <div className="flex size-full items-center justify-center rounded-full bg-neutral-950">
                        <span className="text-sm font-bold text-neutral-50">{step.number}</span>
                      </div>
                    </div>
                  </div>

                  {/* Screenshot side */}
                  <div className="flex flex-1 justify-center">
                    <div className="relative w-[200px] md:w-[220px]">
                      <div className="relative rounded-[2rem] border-[5px] border-neutral-800 bg-neutral-900 p-1 shadow-xl ring-1 ring-neutral-700/50">
                        <div className="absolute left-1/2 top-0 z-10 h-4 w-20 -translate-x-1/2 rounded-b-xl bg-neutral-800" />
                        <div className="overflow-hidden rounded-[1.5rem]">
                          <Image
                            src={step.screenshot.src}
                            alt={step.screenshot.alt}
                            width={1206}
                            height={2622}
                            className="block w-full"
                            sizes="220px"
                            loading="lazy"
                          />
                        </div>
                        <div className="mx-auto mt-1 h-0.5 w-16 rounded-full bg-neutral-700" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function StepContent({
  number,
  title,
  description,
  align,
}: {
  number: string;
  title: string;
  description: string;
  align: 'left' | 'right';
}) {
  return (
    <div
      className={`max-w-sm ${align === 'left' ? 'md:items-start md:text-left' : 'md:items-end md:text-right'}`}
    >
      {/* Mobile step number */}
      <div className="mb-4 flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-warm-400 to-signature-600 p-[2px] md:hidden">
        <div className="flex size-full items-center justify-center rounded-full bg-neutral-950">
          <span className="text-sm font-bold text-neutral-50">{number}</span>
        </div>
      </div>
      <h3 className="text-xl font-bold text-neutral-50">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-neutral-400">{description}</p>
    </div>
  );
}
