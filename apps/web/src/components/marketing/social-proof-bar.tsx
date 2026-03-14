import { getTranslations } from 'next-intl/server';

const STATS = [
  { key: 'riders', countKey: 'ridersCount' },
  { key: 'diagnostics', countKey: 'diagnosticsCount' },
  { key: 'bikes', countKey: 'bikesCount' },
] as const;

export async function SocialProofBar() {
  const t = await getTranslations('SocialProof');

  return (
    <section className="border-t-2 border-warm-500/30 bg-neutral-950 px-4 py-20">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-center gap-12 md:flex-row md:gap-20">
        {STATS.map((stat, index) => (
          <div
            key={stat.key}
            className="reveal-on-scroll text-center"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <p className="text-6xl font-extrabold tabular-nums text-warm-400 md:text-7xl">
              {t(stat.countKey)}
            </p>
            <p className="mt-2 text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">
              {t(stat.key)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
