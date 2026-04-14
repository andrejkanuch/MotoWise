import { getTranslations } from 'next-intl/server';
import { StoreButtons } from './store-buttons';

export async function CtaSection() {
  const t = await getTranslations('Cta');

  return (
    <section id="cta" className="border-t border-neutral-800/30 px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-neutral-50 sm:text-4xl">
          {t('headline')}
        </h2>
        <p className="mt-4 text-base text-neutral-400">{t('subtitle')}</p>

        <div className="mt-8 flex justify-center">
          <StoreButtons />
        </div>

        <p className="mt-6 text-xs text-neutral-600">{t('trustFree')}</p>
      </div>
    </section>
  );
}
