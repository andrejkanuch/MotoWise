interface AppPreviewProps {
  imageSrc: string;
  alt: string;
  className?: string;
}

export function AppPreview({ imageSrc, alt, className = '' }: AppPreviewProps) {
  return (
    <div className={`phone-float ${className}`}>
      {/* Phone frame */}
      <div
        className="relative mx-auto w-[280px] rounded-[2.5rem] border-[6px] border-neutral-700 bg-neutral-900 p-2 shadow-2xl shadow-primary-500/10"
        style={{
          transform: 'perspective(1000px) rotateY(-5deg) rotateX(2deg)',
        }}
      >
        {/* Notch */}
        <div className="absolute left-1/2 top-0 z-10 h-6 w-28 -translate-x-1/2 rounded-b-2xl bg-neutral-700" />

        {/* Screen */}
        <div className="overflow-hidden rounded-[2rem] bg-neutral-950">
          {/* Status bar placeholder */}
          <div className="flex h-8 items-center justify-between bg-neutral-900 px-6">
            <span className="text-[10px] text-neutral-500">9:41</span>
            <div className="flex gap-1">
              <div className="h-1.5 w-3 rounded-sm bg-neutral-600" />
              <div className="h-1.5 w-1.5 rounded-full bg-neutral-600" />
              <div className="h-1.5 w-3 rounded-sm bg-neutral-600" />
            </div>
          </div>

          {/* App screenshot */}
          {/* biome-ignore lint/performance/noImgElement: next/image not needed for decorative marketing preview */}
          <img src={imageSrc} alt={alt} className="block w-full" loading="eager" />
        </div>

        {/* Home indicator */}
        <div className="mx-auto mt-2 h-1 w-24 rounded-full bg-neutral-600" />
      </div>

      {/* Glow behind phone */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 50% 50%, oklch(0.55 0.17 230 / 0.2), transparent)',
        }}
        aria-hidden="true"
      />
    </div>
  );
}
