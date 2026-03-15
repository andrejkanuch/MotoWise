import { getTranslations } from 'next-intl/server';
import { WaitlistForm } from './waitlist-form';

export async function FeatureCta() {
  const t = await getTranslations('Cta');
  return (
    <section className="px-4 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-extrabold tracking-tight text-neutral-50 sm:text-4xl">
          {t('headline')}
        </h2>
        <p className="mt-4 text-lg text-neutral-400">{t('subtitle')}</p>
        <div className="mt-8 flex justify-center">
          <WaitlistForm />
        </div>
      </div>
    </section>
  );
}
