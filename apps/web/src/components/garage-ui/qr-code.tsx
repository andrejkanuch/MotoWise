import { APP_HANDOFF_URL, buildQrPath } from './handoff';
import './garage-ui.css';

/** QR tile sizes from the spec: module size / tile padding / radius. */
export const QrSize = {
  /** 112 / 12 / 12: desktop rail. */
  Rail: 'rail',
  /** 104 / 10 / 12: tablet band. */
  Band: 'band',
  /** 148 / 14 / 14: empty-garage hero. */
  Hero: 'hero',
  /** 208 / 18 / 16: post-signup "Get the app" page. */
  Spotlight: 'spotlight',
} as const;
export type QrSize = (typeof QrSize)[keyof typeof QrSize];

// The URL never changes, so the matrix is computed once per server/client bundle.
const HANDOFF_QR = buildQrPath(APP_HANDOFF_URL);

/**
 * The QR code for https://motovault.app/get on its light tile. Dark modules
 * (--mv-qr-ink) on --mv-qr-tile in every theme, for scan reliability. Server-safe.
 *
 * `label` is the accessible name (e.g. "QR code linking to motovault.app/get");
 * the visible link and Copy button next to it are the text alternative.
 */
export function QrCode({ size = QrSize.Rail, label }: { size?: QrSize; label: string }) {
  const tileClass = size === QrSize.Rail ? 'mvg-qr' : `mvg-qr mvg-qr--${size}`;
  return (
    <div className={tileClass}>
      <svg
        viewBox={`0 0 ${HANDOFF_QR.size} ${HANDOFF_QR.size}`}
        role="img"
        aria-label={label}
        focusable="false"
      >
        <path fill="currentColor" d={HANDOFF_QR.d} />
      </svg>
    </div>
  );
}
