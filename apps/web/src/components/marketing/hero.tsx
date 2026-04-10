'use client';
import { useTranslations } from 'next-intl';
import posthog from 'posthog-js';
import { trackEvent } from '@/lib/meta-pixel';
import { AppPreview } from './app-preview';
import { HeroCarousel } from './hero-carousel';
import { STORE_LINKS } from './store-buttons';

const SPEED_LINES = [
  { top: '22%', duration: '2s', delay: '0s', width: '180px' },
  { top: '38%', duration: '2.5s', delay: '0.6s', width: '240px' },
  { top: '55%', duration: '3s', delay: '1.2s', width: '160px' },
  { top: '70%', duration: '2.2s', delay: '0.3s', width: '200px' },
] as const;

/** Secondary wind layer — slower, wider, lower opacity for depth */
const WIND_LINES = [
  { top: '30%', duration: '5s', delay: '0.8s', width: '320px' },
  { top: '60%', duration: '6s', delay: '2s', width: '280px' },
  { top: '80%', duration: '5.5s', delay: '0s', width: '260px' },
] as const;

export function Hero() {
  const t = useTranslations('Hero');

  return (
    <section className="hero-scroll-root relative w-full overflow-hidden">
      {/* Background gradient layer */}
      <div className="hero-bg-parallax absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-950 via-neutral-950 to-neutral-900" />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 60% 50% at 70% 40%, oklch(0.25 0.02 260 / 0.5), transparent)',
          }}
        />
      </div>

      {/* Speed lines — primary fast layer */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        {SPEED_LINES.map((line) => (
          <div
            key={line.top}
            className="absolute right-0 h-px bg-gradient-to-l from-warm-500/20 to-transparent"
            style={{
              top: line.top,
              width: line.width,
              animation: `speed-line ${line.duration} ease-in-out ${line.delay} infinite`,
            }}
          />
        ))}
        {/* Secondary wind layer — slower, wider streaks for depth */}
        {WIND_LINES.map((line) => (
          <div
            key={`wind-${line.top}`}
            className="absolute right-0 h-[2px] bg-gradient-to-l from-neutral-500/8 via-neutral-400/5 to-transparent"
            style={{
              top: line.top,
              width: line.width,
              animation: `speed-line-slow ${line.duration} ease-in-out ${line.delay} infinite`,
            }}
          />
        ))}
      </div>

      {/* Main content container */}
      <div className="relative z-10 mx-auto flex max-w-7xl items-center px-6 pb-16 pt-32 md:pb-24 md:pt-40">
        {/* Left: Text content (~55%) */}
        <div className="hero-text-fade relative z-20 w-full md:w-[55%]">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
            {t('seoTitle')}
          </p>
          <h1
            className="min-w-0 text-[clamp(2.5rem,7vw,6rem)] font-extrabold leading-[1.05] tracking-tight"
            style={{
              overflowWrap: 'anywhere',
              hyphens: 'auto',
              textShadow: '0 2px 32px oklch(0.76 0.13 70 / 0.18)',
            }}
          >
            <span className="bg-gradient-to-r from-neutral-50 via-neutral-50 to-warm-300 bg-clip-text text-transparent">
              {t('line1')}
            </span>
            <br />
            <span>
              <span className="text-warm-400">{t('line2')}</span>{' '}
              <span className="bg-gradient-to-r from-neutral-50 to-warm-200 bg-clip-text text-transparent">
                {t('line3')}
              </span>
            </span>
          </h1>

          {/* Gradient accent line */}
          <div className="accent-line-enter mt-4 h-1 w-32 rounded-full bg-signature-500" />

          <p className="mt-6 max-w-lg text-xl leading-relaxed text-neutral-300">{t('subtitle')}</p>

          {/* Download tagline */}
          <p className="mt-10 flex items-center gap-2 text-sm font-medium text-warm-400">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            {t('downloadCta')} — iOS &amp; Android
          </p>

          {/* Platform-explicit store buttons */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <a
              href={STORE_LINKS.appStore}
              onClick={() => {
                trackEvent('Lead', { content_name: 'App Download', content_category: 'ios' });
                posthog.capture('app_download_clicked', { platform: 'ios', location: 'hero' });
              }}
              aria-label="Download on the App Store"
              className="cta-primary cta-glow group relative inline-flex items-center gap-3 overflow-hidden rounded-2xl bg-neutral-50 px-5 py-3 text-neutral-950 shadow-lg shadow-neutral-950/25 transition-all hover:-translate-y-0.5 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
            >
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
                className="shrink-0"
              >
                <path d="M17.05 12.536c-.02-2.13 1.738-3.153 1.816-3.202-.99-1.449-2.532-1.647-3.081-1.672-1.313-.133-2.56.774-3.228.774-.667 0-1.693-.754-2.783-.733-1.433.021-2.754.834-3.49 2.117-1.49 2.583-.381 6.406 1.069 8.503.71 1.026 1.555 2.18 2.662 2.14 1.069-.042 1.474-.693 2.767-.693 1.293 0 1.657.693 2.79.67 1.152-.02 1.881-1.046 2.584-2.075.813-1.191 1.148-2.347 1.17-2.406-.026-.012-2.255-.865-2.276-3.423zm-2.1-6.297c.595-.716.994-1.714.886-2.706-.856.035-1.89.57-2.5 1.285-.55.633-1.029 1.645-.9 2.618.954.074 1.924-.485 2.514-1.197z" />
              </svg>
              <span className="flex flex-col items-start leading-tight">
                <span className="text-[10px] font-medium uppercase tracking-wider opacity-70">
                  Download on the
                </span>
                <span className="text-lg font-bold">App Store</span>
              </span>
            </a>

            <a
              href={STORE_LINKS.googlePlay}
              onClick={() => {
                trackEvent('Lead', { content_name: 'App Download', content_category: 'android' });
                posthog.capture('app_download_clicked', { platform: 'android', location: 'hero' });
              }}
              aria-label="Get it on Google Play"
              className="group relative inline-flex items-center gap-3 rounded-2xl border-2 border-neutral-700 bg-neutral-900/80 px-5 py-3 text-neutral-50 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-neutral-500 hover:bg-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
            >
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="shrink-0"
              >
                <path
                  fill="#00D7FE"
                  d="M3.18 1.67a2 2 0 0 0-1.18 1.83v17a2 2 0 0 0 1.18 1.83L13.54 12 3.18 1.67z"
                />
                <path
                  fill="#FFCE00"
                  d="M17.89 15.5l3.69-2.1a2 2 0 0 0 0-3.47l-3.69-2.1-4.35 3.83 4.35 3.84z"
                />
                <path fill="#00F076" d="M3.18 1.67L13.54 12l4.35-3.83L4.5 1a2 2 0 0 0-1.32.67z" />
                <path
                  fill="#F4433C"
                  d="M3.18 22.33a2 2 0 0 0 1.32.67L17.89 15.5 13.54 12 3.18 22.33z"
                />
              </svg>
              <span className="flex flex-col items-start leading-tight">
                <span className="text-[10px] font-medium uppercase tracking-wider opacity-70">
                  Get it on
                </span>
                <span className="text-lg font-bold">Google Play</span>
              </span>
            </a>
          </div>
        </div>

        {/* Right: App Preview Phone Mockup (~45%) */}
        <div
          className="hero-moto-parallax pointer-events-none hidden items-center justify-end md:relative md:flex md:w-[45%]"
          aria-hidden="true"
        >
          <AppPreview>
            <HeroCarousel />
          </AppPreview>
        </div>
      </div>

      {/* Tachometer sweep — motorcycle signature moment */}
      <div className="tach-sweep pointer-events-none hidden md:block" aria-hidden="true">
        <svg viewBox="0 0 200 200" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="tach-sweep-grad" x1="0" y1="100" x2="200" y2="100">
              <stop offset="0%" stopColor="oklch(0.76 0.13 70)" />
              <stop offset="75%" stopColor="oklch(0.65 0.2 45)" />
              <stop offset="100%" stopColor="oklch(0.55 0.25 30)" />
            </linearGradient>
          </defs>
          <path
            d="M30 170 A90 90 0 0 1 170 170"
            stroke="oklch(1 0 0 / 0.06)"
            strokeWidth="2"
            fill="none"
          />
          <path d="M30 170 A90 90 0 0 1 170 170" className="tach-sweep-arc" />
          <line
            x1="100"
            y1="100"
            x2="100"
            y2="25"
            stroke="oklch(0.76 0.13 70)"
            strokeWidth="2"
            strokeLinecap="round"
            className="tach-needle"
          />
          <circle cx="100" cy="100" r="4" fill="oklch(0.76 0.13 70)" />
          <path
            d="M150 40 A90 90 0 0 1 170 170"
            stroke="oklch(0.55 0.25 30)"
            strokeWidth="4"
            fill="none"
            className="tach-redline"
          />
        </svg>
      </div>

      {/* Scroll indicator */}
      <div
        className="hero-scroll-indicator absolute inset-x-0 bottom-8 z-20 flex justify-center"
        aria-hidden="true"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="scroll-hint text-neutral-500"
          role="img"
        >
          <title>{t('scrollDown')}</title>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </section>
  );
}
