'use client';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import posthog from 'posthog-js';
import { STORE_LINKS } from './store-buttons';

export function Hero() {
  const t = useTranslations('Hero');

  return (
    <section className="relative min-h-[90vh] w-full overflow-hidden">
      {/* Background — real motorcycle photography */}
      <Image
        src="/images/hero-bg-dark.jpg"
        alt=""
        fill
        priority
        className="object-cover object-center"
        sizes="100vw"
        quality={85}
      />
      {/* Extra gradient for text readability + bottom fade */}
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            'linear-gradient(to bottom, oklch(0.1 0 0 / 0.4) 0%, oklch(0.1 0 0 / 0.25) 40%, oklch(0.1 0 0 / 0.9) 100%)',
        }}
      />

      {/* Content */}
      <div className="relative z-10 mx-auto flex max-w-7xl flex-col items-center gap-12 px-6 pb-20 pt-36 md:flex-row md:items-center md:gap-8 md:pb-28 md:pt-44">
        {/* Left — text + CTA */}
        <div className="w-full md:w-[50%]">
          <h1 className="text-[clamp(2.5rem,6vw,5rem)] font-extrabold leading-[1.05] tracking-tight text-neutral-50">
            {t('line1')}
            <br />
            <span className="text-warm-400">{t('line2')}</span>{' '}
            {t('line3')}
          </h1>

          <p className="mt-6 max-w-md text-lg leading-relaxed text-neutral-300">
            {t('subtitleShort')}
          </p>

          {/* Store buttons */}
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <a
              href={STORE_LINKS.appStore}
              onClick={() => {
                posthog.capture('app_download_clicked', { platform: 'ios', location: 'hero' });
              }}
              aria-label="Download on the App Store"
              className="cta-primary cta-glow inline-flex items-center gap-2.5 rounded-full bg-warm-500 px-7 py-3.5 text-base font-semibold text-neutral-950 shadow-lg shadow-warm-500/20 transition-colors hover:bg-warm-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              App Store
            </a>

            <a
              href={STORE_LINKS.googlePlay}
              onClick={() => {
                posthog.capture('app_download_clicked', { platform: 'android', location: 'hero' });
              }}
              aria-label="Get it on Google Play"
              className="cta-secondary inline-flex items-center gap-2.5 rounded-full border-2 border-neutral-600 px-7 py-3.5 text-base font-medium text-neutral-300 transition-colors hover:border-neutral-400 hover:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M3.61 1.814L13.793 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.61-.92zM14.5 12.707l2.302 2.302-10.937 6.15 8.635-8.452zm3.476-1.414L20.6 12.89a1 1 0 010 1.72l-2.21 1.286-2.538-2.538 2.124-2.065zM5.965 3.164l10.937 6.15L14.5 11.293 5.965 3.164z" />
              </svg>
              Google Play
            </a>
          </div>

          <p className="mt-6 text-sm text-neutral-500">
            {t('trustLine')}
          </p>
        </div>

        {/* Right — real screenshots with CSS transforms, not a pre-baked composite */}
        <div className="relative hidden w-[50%] md:block" aria-hidden="true">
          <div className="relative mx-auto" style={{ maxWidth: 420, aspectRatio: '3/4' }}>
            {/* Primary: Trip planning map — large, slight tilt */}
            <div
              className="absolute inset-0 overflow-hidden rounded-3xl shadow-2xl shadow-neutral-950/60 ring-1 ring-neutral-700/40"
              style={{
                transform: 'perspective(1200px) rotateY(-4deg) rotateX(1deg)',
              }}
            >
              <Image
                src="/images/features/trip-planning/trip-detail-hero-anon.png"
                alt="MotoVault trip planning — route on a live map"
                width={1206}
                height={2622}
                className="block h-full w-full object-cover object-top"
                priority
                sizes="420px"
              />
            </div>

            {/* Secondary: Maintenance dashboard — smaller, overlapping bottom-right */}
            <div
              className="absolute -bottom-8 -right-12 w-[55%] overflow-hidden rounded-2xl shadow-2xl shadow-neutral-950/70 ring-1 ring-neutral-700/40"
              style={{
                transform: 'perspective(1200px) rotateY(3deg) rotateX(2deg)',
              }}
            >
              <Image
                src="/images/features/bike-details.png"
                alt="MotoVault maintenance tracker — BMW R 1250 GS"
                width={1206}
                height={2622}
                className="block w-full"
                priority
                sizes="240px"
              />
            </div>

            {/* Subtle warm glow behind the screenshots */}
            <div
              className="pointer-events-none absolute -inset-16 -z-10 rounded-full opacity-30"
              style={{
                background:
                  'radial-gradient(ellipse at 50% 50%, oklch(0.6 0.12 60 / 0.4), transparent 70%)',
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
