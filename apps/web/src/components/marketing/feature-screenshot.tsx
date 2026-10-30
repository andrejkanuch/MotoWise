import Image from 'next/image';

interface FeatureScreenshotProps {
  src: string;
  alt: string;
  side?: 'left' | 'right';
  className?: string;
}

/**
 * A single app screenshot cropped onto a surface panel (no device chrome —
 * the page's one full phone frame lives in {@link FeatureScreenshotPair}).
 * Sits flat on the ramp: surface step + hairline, no shadows, no glows.
 */
export function FeatureScreenshot({
  src,
  alt,
  side = 'right',
  className = '',
}: FeatureScreenshotProps) {
  return (
    <div
      className={`reveal-on-scroll ${className}`}
      style={{
        maxWidth: 'var(--mv-container)',
        margin: '0 auto',
        padding: '0 24px',
        display: 'flex',
        justifyContent: side === 'left' ? 'flex-start' : 'flex-end',
      }}
    >
      <div
        style={{
          width: 'min(420px, 100%)',
          aspectRatio: '4 / 5',
          background: 'var(--mv-surface)',
          border: '1px solid var(--mv-line)',
          borderRadius: 'var(--mv-radius-card)',
          overflow: 'hidden',
        }}
      >
        <Image
          src={src}
          alt={alt}
          width={1206}
          height={2622}
          sizes="420px"
          loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
        />
      </div>
    </div>
  );
}

/**
 * The feature page's screenshot moment: one real device frame (the page's
 * single `.mv-phone-mockup` — Direction: max one per page) beside a second
 * shot cropped onto a surface panel. Asymmetric by construction: different
 * treatments, baselines aligned, no tilt theatre, no glows.
 */
export function FeatureScreenshotPair({
  screenshots,
}: {
  screenshots: { src: string; alt: string }[];
}) {
  const [first, second] = screenshots;
  if (!first) return null;

  return (
    <div className="mv-section-inner reveal-on-scroll" style={{ paddingTop: 0 }}>
      <div className="mv-grid-2" style={{ alignItems: 'end', gap: '48px' }}>
        <div className="mv-phone-mockup" style={{ margin: '0 auto' }}>
          <div style={{ overflow: 'hidden', borderRadius: '35px', height: '100%' }}>
            <Image
              src={first.src}
              alt={first.alt}
              width={1206}
              height={2622}
              sizes="320px"
              loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
            />
          </div>
        </div>

        {second ? (
          <div
            style={{
              width: 'min(440px, 100%)',
              aspectRatio: '4 / 5',
              background: 'var(--mv-surface)',
              border: '1px solid var(--mv-line)',
              borderRadius: 'var(--mv-radius-card)',
              overflow: 'hidden',
              justifySelf: 'start',
            }}
          >
            <Image
              src={second.src}
              alt={second.alt}
              width={1206}
              height={2622}
              sizes="440px"
              loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
