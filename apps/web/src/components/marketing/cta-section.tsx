import { getTranslations } from 'next-intl/server';
import { StoreButtons } from './store-buttons';

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
    <section id="cta" className="relative overflow-hidden px-6 py-28 md:py-36">
      {/* Stage backdrop — darker than page background */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            'linear-gradient(to bottom, transparent, oklch(0.08 0.01 260 / 0.6) 15%, oklch(0.08 0.01 260 / 0.6) 85%, transparent)',
        }}
      />

      {/* Warm radial glow — stronger */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% 40%, oklch(0.76 0.13 70 / 0.18), transparent)',
        }}
      />

      {/* Full-width gradient divider */}
      <div className="absolute inset-x-0 top-0 h-px" aria-hidden="true">
        <div
          className="mx-auto h-full w-full max-w-3xl"
          style={{
            background:
              'linear-gradient(to right, transparent, oklch(0.76 0.13 70 / 0.5) 30%, oklch(0.76 0.13 70 / 0.5) 70%, transparent)',
          }}
        />
      </div>

      <div className="reveal-on-scroll relative mx-auto max-w-3xl">
        {/* Social proof line */}
        <p className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
          {t('socialProof')}
        </p>

        <h2 className="text-center text-4xl font-bold leading-[1.05] tracking-tight text-neutral-50 text-balance md:text-5xl lg:text-6xl">
          {t('headline')}
        </h2>

        <p className="mt-4 text-center text-lg text-neutral-300">{t('subtitle')}</p>

        {/* Download buttons */}
        <div className="mt-8 flex justify-center">
          <StoreButtons />
        </div>

        {/* Trust badges */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-6">
          {(['trustFree', 'trustNoCard'] as const).map((key) => (
            <div key={key} className="flex items-center gap-2 text-sm font-medium text-neutral-400">
              <CheckIcon />
              <span>{t(key)}</span>
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-sm text-neutral-500">{t('disclaimer')}</p>

        {/* Personality line — surfacing the console easter egg */}
        <p className="mt-8 text-center text-sm italic text-neutral-600">{t('personality')}</p>
      </div>
    </section>
  );
}
