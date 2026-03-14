import { getTranslations } from 'next-intl/server';

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

          {/* Download buttons — TODO: replace with actual store URLs */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <a
              href="#cta"
              className="cta-primary inline-flex items-center gap-2 rounded-2xl bg-primary-950 px-8 py-4 text-base font-semibold text-neutral-50 transition-colors hover:bg-primary-900"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="size-5" aria-hidden="true">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              Download on App Store
            </a>
            <a
              href="#cta"
              className="cta-primary inline-flex items-center gap-2 rounded-2xl bg-primary-950 px-8 py-4 text-base font-semibold text-neutral-50 transition-colors hover:bg-primary-900"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="size-5" aria-hidden="true">
                <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.807 1.626a1 1 0 0 1 0 1.732l-2.807 1.626L15.206 12l2.492-2.492zM5.864 3.458L16.8 9.791l-2.302 2.302-8.634-8.635z" />
              </svg>
              Get it on Google Play
            </a>
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
