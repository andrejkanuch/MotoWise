import { useTranslations } from 'next-intl';

function MotorcycleSVG() {
  return (
    <svg
      viewBox="0 0 800 500"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full"
      aria-hidden="true"
    >
      {/* Rear wheel */}
      <circle cx="200" cy="380" r="95" stroke="var(--color-neutral-700)" strokeWidth="8" />
      <circle cx="200" cy="380" r="70" stroke="var(--color-neutral-800)" strokeWidth="3" />
      <circle cx="200" cy="380" r="12" fill="var(--color-neutral-700)" />
      {/* Front wheel */}
      <circle cx="620" cy="380" r="95" stroke="var(--color-neutral-700)" strokeWidth="8" />
      <circle cx="620" cy="380" r="70" stroke="var(--color-neutral-800)" strokeWidth="3" />
      <circle cx="620" cy="380" r="12" fill="var(--color-neutral-700)" />
      {/* Swingarm */}
      <path
        d="M200 380 L380 300"
        stroke="var(--color-neutral-700)"
        strokeWidth="6"
        strokeLinecap="round"
      />
      {/* Frame / body */}
      <path
        d="M380 300 L340 230 L420 180 L520 190 L560 230 L620 290"
        stroke="var(--color-neutral-700)"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Tank */}
      <path
        d="M380 220 Q420 170 500 185 L520 200 L400 230 Z"
        fill="var(--color-neutral-800)"
        stroke="var(--color-neutral-700)"
        strokeWidth="4"
      />
      {/* Seat */}
      <path
        d="M340 232 Q360 200 400 215 L380 235 Z"
        fill="var(--color-neutral-800)"
        stroke="var(--color-neutral-700)"
        strokeWidth="3"
      />
      {/* Fork */}
      <path
        d="M560 230 L620 380"
        stroke="var(--color-neutral-700)"
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* Handlebar */}
      <path
        d="M545 210 L575 195"
        stroke="var(--color-neutral-700)"
        strokeWidth="6"
        strokeLinecap="round"
      />
      {/* Exhaust */}
      <path
        d="M320 290 L260 340 Q240 355 250 365"
        stroke="var(--color-neutral-800)"
        strokeWidth="8"
        strokeLinecap="round"
      />
      {/* Engine block */}
      <rect
        x="360"
        y="260"
        width="80"
        height="55"
        rx="8"
        fill="var(--color-neutral-800)"
        stroke="var(--color-neutral-700)"
        strokeWidth="3"
      />
      {/* Chain */}
      <path
        d="M200 380 L400 300"
        stroke="var(--color-neutral-800)"
        strokeWidth="2"
        strokeDasharray="6 4"
      />
    </svg>
  );
}

const SPEED_LINES = [
  { top: '22%', duration: '2s', delay: '0s', width: '180px' },
  { top: '38%', duration: '2.5s', delay: '0.6s', width: '240px' },
  { top: '55%', duration: '3s', delay: '1.2s', width: '160px' },
  { top: '70%', duration: '2.2s', delay: '0.3s', width: '200px' },
] as const;

export function Hero() {
  const t = useTranslations('Hero');

  return (
    <section className="hero-scroll-root relative h-screen w-full overflow-hidden">
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
      <div className="relative z-10 mx-auto flex h-full max-w-7xl items-center px-6">
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

          <p className="mt-6 max-w-lg text-lg text-neutral-400">{t('subtitle')}</p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            {/* Primary CTA */}
            <a
              href="#cta"
              className="group relative inline-flex items-center justify-center overflow-hidden rounded-full bg-warm-500 px-8 py-3 font-semibold text-neutral-950 transition-colors hover:bg-warm-400"
            >
              <span className="absolute inset-0 -translate-x-full bg-warm-300 transition-transform duration-300 ease-out group-hover:translate-x-0" />
              <span className="relative">{t('downloadCta')}</span>
            </a>

            {/* Secondary CTA */}
            <a
              href="#features"
              className="inline-flex items-center justify-center rounded-full border border-neutral-700 px-8 py-3 text-neutral-300 transition-colors hover:border-neutral-500 hover:text-neutral-100"
            >
              {t('exploreFeatures')}
            </a>
          </div>
        </div>

        {/* Right: Motorcycle SVG (~45%) */}
        <div
          className="hero-moto-parallax pointer-events-none absolute inset-0 flex items-center justify-end opacity-20 md:relative md:w-[45%] md:opacity-40"
          aria-hidden="true"
        >
          <div className="w-full max-w-2xl">
            <MotorcycleSVG />
          </div>
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
