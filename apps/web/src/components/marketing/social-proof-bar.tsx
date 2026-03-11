import { getTranslations } from 'next-intl/server';

const STATS = [
  { key: 'riders', countKey: 'ridersCount' },
  { key: 'diagnostics', countKey: 'diagnosticsCount' },
  { key: 'bikes', countKey: 'bikesCount' },
] as const;

export async function SocialProofBar() {
  const t = await getTranslations('SocialProof');

  return (
    <section className="border-y border-neutral-800/50 bg-neutral-950 px-4 py-16">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-center gap-12 md:flex-row md:gap-20">
        {STATS.map((stat, index) => (
          <div
            key={stat.key}
            className="reveal-on-scroll text-center"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <p className="bg-gradient-to-r from-primary-400 to-accent-500 bg-clip-text text-5xl font-extrabold tabular-nums text-transparent">
              {t(stat.countKey)}
            </p>
            <p className="mt-2 text-sm font-medium uppercase tracking-wider text-neutral-500">
              {t(stat.key)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
