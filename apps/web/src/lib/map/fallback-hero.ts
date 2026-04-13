/**
 * Branded fallback SVG for route hero images.
 * Returned as a PNG-compatible response when the map tile provider fails.
 */

const FALLBACK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a1a2e"/>
      <stop offset="100%" stop-color="#16213e"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <!-- Road lines -->
  <path d="M0 400 Q300 350 600 380 T1200 360" stroke="#2a2a4a" stroke-width="3" fill="none" opacity="0.5"/>
  <path d="M0 420 Q300 370 600 400 T1200 380" stroke="#2a2a4a" stroke-width="2" fill="none" opacity="0.3"/>
  <path d="M0 440 Q300 390 600 420 T1200 400" stroke="#2a2a4a" stroke-width="1" fill="none" opacity="0.2"/>
  <!-- Map pin icon -->
  <g transform="translate(560, 240)">
    <path d="M40 0C18 0 0 18 0 40c0 30 40 60 40 60s40-30 40-60c0-22-18-40-40-40zm0 54c-8 0-14-6-14-14s6-14 14-14 14 6 14 14-6 14-14 14z" fill="#4a90d9" opacity="0.8"/>
  </g>
  <!-- Brand text -->
  <text x="600" y="560" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="18" fill="#666" letter-spacing="3">MOTOVAULT</text>
</svg>`;

export function getFallbackHeroSvg(): string {
  return FALLBACK_SVG;
}

export function getFallbackHeroBuffer(): Buffer {
  return Buffer.from(FALLBACK_SVG, 'utf-8');
}
