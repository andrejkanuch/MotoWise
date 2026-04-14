import { getTranslations } from 'next-intl/server';

export async function HowItWorks() {
  const t = await getTranslations('HowItWorks');

  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-2xl font-bold tracking-tight text-neutral-50 sm:text-3xl">
          {t('sectionTitle')}
        </h2>
        <p className="mt-3 text-base text-neutral-400">{t('sectionSubtitle')}</p>

        <ol className="mt-12 space-y-10">
          {[1, 2, 3].map((num) => (
            <li key={num} className="flex gap-5">
              <span className="shrink-0 text-sm font-medium tabular-nums text-neutral-600">
                {String(num).padStart(2, '0')}
              </span>
              <div>
                <h3 className="text-base font-semibold text-neutral-100">{t(`step${num}Title`)}</h3>
                <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-neutral-400">
                  {t(`step${num}Desc`)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
