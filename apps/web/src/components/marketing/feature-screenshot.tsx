import Image from 'next/image';

/* The pair shares one axis: the phone closes to the end of its column and the
   panel starts its own, so the two objects meet around the 48px gap. Below
   900px they stack and both start at the gutter. The frame is capped at 280px
   on this surface (the hero above it carries the page's headline). */
const SCREENSHOT_PAIR_CSS = `
.mv-shot-pair .mv-phone-mockup { width: 280px; margin: 0; justify-self: end; }
.mv-shot-screen { overflow: hidden; border-radius: var(--mv-radius-screen); height: 100%; }
.mv-shot-panel {
  width: min(440px, 100%);
  aspect-ratio: 4 / 5;
  background: var(--mv-surface);
  border-radius: var(--mv-radius-card);
  overflow: hidden;
  justify-self: start;
}
@media (max-width: 900px) {
  .mv-shot-pair .mv-phone-mockup { width: 240px; justify-self: start; }
}
@media (max-width: 480px) {
  .mv-shot-pair .mv-phone-mockup { width: 220px; }
}
`;

/**
 * The feature page's screenshot moment: one real device frame (the page's
 * single `.mv-phone-mockup`, Direction: max one per page) beside a second
 * shot cropped onto a surface panel (the screenshot carries the app's own
 * chrome, so the panel draws no keyline of its own). Asymmetric by
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
    <div
      className="mv-section-inner mv-reveal mv-shot-pair"
      style={{ paddingTop: 0, paddingBottom: 0 }}
    >
      <style
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static CSS
        dangerouslySetInnerHTML={{ __html: SCREENSHOT_PAIR_CSS }}
      />
      <div className="mv-grid-2" style={{ alignItems: 'end', gap: '48px' }}>
        <div className="mv-phone-mockup">
          <div className="mv-shot-screen">
            <Image
              src={first.src}
              alt={first.alt}
              width={1206}
              height={2622}
              sizes="280px"
              loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
            />
          </div>
        </div>

        {second ? (
          <div className="mv-shot-panel">
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
