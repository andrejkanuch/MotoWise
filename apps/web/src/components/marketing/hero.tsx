'use client';
import { useTranslations } from 'next-intl';
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
              willChange: 'transform',
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
              willChange: 'transform',
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
          <h1 className="min-w-0 text-[clamp(2.5rem,7vw,6rem)] font-extrabold leading-[1.05] tracking-tight text-neutral-50">
            {t('line1')}
            <br />
            <span>
              <span className="text-warm-400">{t('line2')}</span> {t('line3')}
            </span>
          </h1>

          {/* Gradient accent line */}
          <div className="accent-line-enter mt-4 h-1 w-32 rounded-full bg-signature-500" />

          <p className="mt-6 max-w-lg text-xl text-neutral-300">{t('subtitle')}</p>

          <div className="mt-12 flex flex-wrap items-center gap-4">
            {/* App Store CTA with glow */}
            <a
              href={STORE_LINKS.appStore}
              className="cta-primary cta-glow group relative inline-flex items-center justify-center overflow-hidden rounded-full bg-warm-500 px-6 sm:px-10 py-4 text-base sm:text-lg font-semibold text-neutral-950 shadow-lg shadow-warm-500/25 transition-colors hover:bg-warm-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
            >
              <span className="absolute inset-0 -translate-x-full bg-warm-300 transition-transform duration-300 ease-out group-hover:translate-x-0" />
              <span className="relative">{t('downloadCta')}</span>
            </a>

            {/* Google Play CTA */}
            <a
              href={STORE_LINKS.googlePlay}
              className="cta-secondary inline-flex items-center justify-center rounded-full border-2 border-neutral-600 px-6 sm:px-8 py-3.5 text-neutral-300 transition-colors hover:border-neutral-500 hover:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
            >
              Google Play
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
