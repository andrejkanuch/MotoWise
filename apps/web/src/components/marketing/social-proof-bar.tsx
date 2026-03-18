import { getTranslations } from 'next-intl/server';

const STATS = [
  { key: 'riders', countKey: 'ridersCount' },
  { key: 'diagnostics', countKey: 'diagnosticsCount' },
  { key: 'bikes', countKey: 'bikesCount' },
] as const;

export async function SocialProofBar() {
  const t = await getTranslations('SocialProof');

  return (
    <section className="relative bg-neutral-950 px-6 py-20">
      {/* Top gradient rule */}
      <div
        className="absolute inset-x-0 top-0 mx-auto h-px max-w-5xl"
        style={{
          background: 'linear-gradient(90deg, transparent, oklch(0.76 0.13 70 / 0.4), transparent)',
        }}
        aria-hidden="true"
      />

      <div className="mx-auto flex max-w-5xl flex-col items-center justify-center gap-12 md:flex-row md:gap-16">
        {STATS.map((stat, index) => (
          <div
            key={stat.key}
            className="reveal-on-scroll flex items-center gap-12 text-center md:gap-16"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div>
              <p className="bg-gradient-to-b from-warm-300 to-warm-500 bg-clip-text text-6xl font-extrabold tabular-nums text-transparent md:text-7xl">
                {t(stat.countKey)}
              </p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.25em] text-neutral-400">
                {t(stat.key)}
              </p>
            </div>
            {index < STATS.length - 1 && (
              <div className="hidden h-14 w-px bg-neutral-800 md:block" aria-hidden="true" />
            )}
          </div>
        ))}
      </div>

      {/* Bottom gradient rule */}
      <div
        className="absolute inset-x-0 bottom-0 mx-auto h-px max-w-5xl"
        style={{
          background: 'linear-gradient(90deg, transparent, oklch(0.76 0.13 70 / 0.4), transparent)',
        }}
        aria-hidden="true"
      />
    </section>
  );
}
