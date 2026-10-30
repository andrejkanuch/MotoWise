import Image from 'next/image';

/**
 * The feature page's screenshot moment: one real device frame (the page's
 * single `.mv-phone-mockup`, Direction: max one per page) beside a second
 * shot cropped onto a surface panel with a hairline keyline. Asymmetric by
 * construction: two treatments, baselines aligned, no tilt, no glows. This is
 * the page's one authored entrance (`.mv-reveal`, scroll-timeline driven).
 */
export function FeatureScreenshotPair({
  screenshots,
}: {
  screenshots: { src: string; alt: string }[];
}) {
  const [first, second] = screenshots;
  if (!first) return null;

  return (
    <div className="mv-section-inner mv-reveal" style={{ paddingTop: 0, paddingBottom: 0 }}>
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
