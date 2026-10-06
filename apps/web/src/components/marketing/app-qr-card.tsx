import { palette } from '@motovault/design-system';
import { renderSVG } from 'uqr';

/** A QR code to `url` with a "scan with your phone" caption. Server Component. */
export function AppQrCard({ url, className = '' }: { url: string; className?: string }) {
  const svg = renderSVG(url, {
    border: 1,
    whiteColor: palette.white,
    blackColor: palette.neutral950,
  });
  return (
    <figure
      className={`w-56 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 text-center ${className}`}
    >
      <div
        className="overflow-hidden rounded-xl [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG generated server-side by uqr from our own URL
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <figcaption className="mt-4 text-sm text-neutral-400">Scan with your phone camera</figcaption>
    </figure>
  );
}
