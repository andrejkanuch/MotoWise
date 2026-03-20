import Image from 'next/image';

interface FeatureScreenshotProps {
  src: string;
  alt: string;
  side?: 'left' | 'right';
  className?: string;
}

export function FeatureScreenshot({
  src,
  alt,
  side = 'right',
  className = '',
}: FeatureScreenshotProps) {
  return (
    <div
      className={`reveal-on-scroll mx-auto flex max-w-6xl items-center gap-8 px-6 py-16 ${
        side === 'left' ? 'md:flex-row-reverse' : ''
      } ${className}`}
    >
      <div className="relative mx-auto w-[260px] shrink-0 md:w-[280px]">
        {/* Phone frame */}
        <div className="relative rounded-[2.5rem] border-[6px] border-neutral-800 bg-neutral-900 p-1.5 shadow-2xl shadow-primary-500/10 ring-1 ring-neutral-700/50">
          {/* Dynamic Island */}
          <div className="absolute left-1/2 top-0 z-10 h-5 w-24 -translate-x-1/2 rounded-b-2xl bg-neutral-800" />

          {/* Screen */}
          <div className="overflow-hidden rounded-[2rem]">
            <Image
              src={src}
              alt={alt}
              width={1206}
              height={2622}
              className="block w-full"
              sizes="280px"
              loading="lazy"
            />
          </div>

          {/* Home indicator */}
          <div className="mx-auto mt-1.5 h-1 w-20 rounded-full bg-neutral-700" />
        </div>

        {/* Glow behind phone */}
        <div
          className="pointer-events-none absolute inset-0 -z-10 blur-3xl"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 50% 50%, oklch(0.55 0.17 230 / 0.15), transparent)',
          }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

export function FeatureScreenshotPair({
  screenshots,
}: {
  screenshots: { src: string; alt: string }[];
}) {
  return (
    <div className="reveal-on-scroll mx-auto flex max-w-4xl items-center justify-center gap-6 px-6 py-16 md:gap-10">
      {screenshots.map((shot, i) => (
        <div key={shot.src} className="relative w-[220px] shrink-0 md:w-[260px]">
          <div
            className="relative rounded-[2.5rem] border-[6px] border-neutral-800 bg-neutral-900 p-1.5 shadow-2xl shadow-primary-500/10 ring-1 ring-neutral-700/50"
            style={{
              transform: i === 0 ? 'rotate(-3deg)' : 'rotate(3deg)',
            }}
          >
            <div className="absolute left-1/2 top-0 z-10 h-5 w-24 -translate-x-1/2 rounded-b-2xl bg-neutral-800" />
            <div className="overflow-hidden rounded-[2rem]">
              <Image
                src={shot.src}
                alt={shot.alt}
                width={1206}
                height={2622}
                className="block w-full"
                sizes="260px"
                loading="lazy"
              />
            </div>
            <div className="mx-auto mt-1.5 h-1 w-20 rounded-full bg-neutral-700" />
          </div>

          <div
            className="pointer-events-none absolute inset-0 -z-10 blur-3xl"
            style={{
              background:
                'radial-gradient(ellipse 80% 60% at 50% 50%, oklch(0.55 0.17 230 / 0.12), transparent)',
            }}
            aria-hidden="true"
          />
        </div>
      ))}
    </div>
  );
}
