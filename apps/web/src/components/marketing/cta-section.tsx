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
    <>
      {/* Top gradient transition: dark → warm */}
      <div
        className="h-20 w-full"
        style={{
          background: 'linear-gradient(to bottom, var(--color-neutral-950), var(--color-warm-400))',
        }}
      />

      <section id="cta" className="bg-warm-400 px-4 py-24 md:py-32">
        <div className="reveal-on-scroll mx-auto max-w-3xl">
          {/* Social proof line */}
          <p className="mb-4 text-center text-sm font-semibold uppercase tracking-wider text-primary-600">
            {t('socialProof')}
          </p>

          <h2 className="text-center text-5xl font-extrabold tracking-tight text-primary-950 md:text-6xl">
            {t('headline')}
          </h2>

          <p className="mt-4 text-center text-lg text-primary-800">{t('subtitle')}</p>

          {/* Waitlist signup form */}
          <div className="mt-8 flex justify-center">
            <WaitlistForm />
          </div>

          {/* Trust badges */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-6">
            {(['trustFree', 'trustNoCard', 'trustCancel'] as const).map((key) => (
              <div
                key={key}
                className="flex items-center gap-2 text-sm font-medium text-primary-700"
              >
                <CheckIcon />
                <span>{t(key)}</span>
              </div>
            ))}
          </div>

          <p className="mt-6 text-center text-sm text-primary-700">{t('disclaimer')}</p>
        </div>
      </section>

      {/* Bottom gradient transition: warm → dark */}
      <div
        className="h-20 w-full"
        style={{
          background: 'linear-gradient(to bottom, var(--color-warm-400), var(--color-neutral-950))',
        }}
      />
    </>
  );
}
