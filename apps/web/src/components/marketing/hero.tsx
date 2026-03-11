import { useTranslations } from 'next-intl';
import { AppPreview } from './app-preview';

const SPEED_LINES = [
  { top: '22%', duration: '2s', delay: '0s', width: '180px' },
  { top: '38%', duration: '2.5s', delay: '0.6s', width: '240px' },
  { top: '55%', duration: '3s', delay: '1.2s', width: '160px' },
  { top: '70%', duration: '2.2s', delay: '0.3s', width: '200px' },
] as const;

export function Hero() {
  const t = useTranslations('Hero');

  return (
    <section className="hero-scroll-root relative min-h-screen w-full overflow-hidden">
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

      {/* Speed lines */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        {SPEED_LINES.map((line) => (
          <div
            key={line.top}
            className="absolute right-0 h-px bg-gradient-to-l from-neutral-700/60 to-transparent"
            style={{
              top: line.top,
              width: line.width,
              willChange: 'transform',
              animation: `speed-line ${line.duration} ease-in-out ${line.delay} infinite`,
            }}
          />
        ))}
      </div>

      {/* Main content container */}
      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl items-center px-6 py-24">
        {/* Left: Text content (~55%) */}
        <div className="hero-text-fade relative z-20 w-full md:w-[55%]">
          <h1 className="text-[clamp(2.5rem,7vw,6rem)] font-extrabold leading-tight tracking-tight text-neutral-50">
            {t('line1')}
            <br />
            <span>
              <span className="bg-gradient-to-r from-primary-400 to-accent-500 bg-clip-text text-transparent">
                {t('line2')}
              </span>{' '}
              {t('line3')}
            </span>
          </h1>

          {/* Gradient accent line */}
          <div className="mt-4 h-[3px] w-[120px] rounded-full bg-gradient-to-r from-primary-400 to-accent-500" />

          <p className="mt-6 max-w-lg text-lg text-neutral-400">{t('subtitle')}</p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            {/* Primary CTA with glow */}
            <a
              href="#cta"
              className="group relative inline-flex items-center justify-center overflow-hidden rounded-full bg-warm-500 px-8 py-3 font-semibold text-neutral-950 shadow-lg shadow-warm-500/25 transition-colors hover:bg-warm-400"
            >
              <span className="absolute inset-0 -translate-x-full bg-warm-300 transition-transform duration-300 ease-out group-hover:translate-x-0" />
              <span className="relative">{t('downloadCta')}</span>
            </a>

            {/* Secondary CTA with glass effect */}
            <a
              href="#features"
              className="inline-flex items-center justify-center rounded-full border border-neutral-700 bg-neutral-900/30 px-8 py-3 text-neutral-300 backdrop-blur-sm transition-colors hover:border-neutral-500 hover:text-neutral-100"
            >
              {t('exploreFeatures')}
            </a>
          </div>
        </div>

        {/* Right: App Preview Phone Mockup (~45%) */}
        <div
          className="hero-moto-parallax pointer-events-none absolute inset-0 flex items-center justify-end opacity-30 md:relative md:w-[45%] md:opacity-100"
          aria-hidden="true"
        >
          <AppPreview
            imageSrc="/images/app-preview-home.png"
            alt="MotoWise app home screen showing fleet health"
          />
        </div>
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
          className="animate-bounce text-neutral-500"
          role="img"
        >
          <title>{t('scrollDown')}</title>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </section>
  );
}
