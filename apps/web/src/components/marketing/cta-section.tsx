import { getTranslations } from 'next-intl/server';
import { WaitlistForm } from './waitlist-form';

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export async function CtaSection() {
  const t = await getTranslations('Cta');

  return (
    <section
      id="cta"
      className="relative overflow-hidden px-6 py-24 md:py-32"
    >
      {/* Warm radial glow background */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% 40%, oklch(0.76 0.13 70 / 0.12), transparent)',
        }}
      />

      {/* Decorative accent line */}
      <div className="mx-auto mb-8 h-px w-24 bg-warm-500" aria-hidden="true" />

      <div className="reveal-on-scroll relative mx-auto max-w-3xl">
        {/* Social proof line */}
        <p className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
          {t('socialProof')}
        </p>

        <h2 className="text-center text-4xl font-bold leading-[1.1] tracking-tight text-neutral-50 md:text-5xl lg:text-6xl">
          {t('headline')}
        </h2>

        <p className="mt-4 text-center text-lg text-neutral-300">{t('subtitle')}</p>

        {/* Waitlist signup form */}
        <div className="mt-8 flex justify-center">
          <WaitlistForm />
        </div>

        {/* Trust badges */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-6">
          {(['trustFree', 'trustNoCard'] as const).map((key) => (
            <div
              key={key}
              className="flex items-center gap-2 text-sm font-medium text-neutral-400"
            >
              <CheckIcon />
              <span>{t(key)}</span>
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-sm text-neutral-500">{t('disclaimer')}</p>

        {/* Personality line — surfacing the console easter egg */}
        <p className="mt-8 text-center text-sm italic text-neutral-600">
          {t('personality')}
        </p>
      </div>
    </section>
  );
}
