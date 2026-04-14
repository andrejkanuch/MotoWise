import { getTranslations } from 'next-intl/server';

const STATS = [
  { key: 'riders', countKey: 'ridersCount' },
  { key: 'maintenance', countKey: 'maintenanceCount' },
  { key: 'bikes', countKey: 'bikesCount' },
] as const;

export async function SocialProofBar() {
  const t = await getTranslations('SocialProof');

  return (
    <section className="border-y border-neutral-800/30 px-6 py-12">
      <div className="mx-auto flex max-w-5xl flex-wrap justify-center gap-x-16 gap-y-6">
        {STATS.map((stat) => (
          <p key={stat.key} className="text-sm text-neutral-400">
            <span className="mr-1.5 text-2xl font-bold tabular-nums text-neutral-100">
              {t(stat.countKey)}
            </span>
            {t(stat.key)}
          </p>
        ))}
      </div>
    </section>
  );
}
