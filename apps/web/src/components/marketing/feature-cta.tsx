import { getTranslations } from 'next-intl/server';
import { StoreButtons } from './store-buttons';

export async function FeatureCta() {
  const t = await getTranslations('Cta');
  return (
    <section className="relative overflow-hidden px-6 py-24">
      {/* Warm radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% 40%, oklch(0.76 0.13 70 / 0.08), transparent)',
        }}
      />

      <div className="reveal-on-scroll relative mx-auto max-w-2xl text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
          {t('socialProof')}
        </p>
        <h2 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl">
          {t('headline')}
        </h2>
        <p className="mt-4 text-lg text-neutral-300">{t('subtitle')}</p>
        <div className="mt-8 flex justify-center">
          <StoreButtons />
        </div>
      </div>
    </section>
  );
}
