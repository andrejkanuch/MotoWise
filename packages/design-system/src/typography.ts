export const fontFamily = {
  sans: '"Plus Jakarta Sans", "Inter", ui-sans-serif, system-ui, sans-serif',
  heading: '"Plus Jakarta Sans", "Inter", ui-sans-serif, system-ui, sans-serif',
  mono: '"Geist Mono", ui-monospace, monospace',
} as const;

export const typeScale = {
  display: { size: 32, weight: '700', lineHeight: 1.2 },
  h1: { size: 28, weight: '700', lineHeight: 1.25 },
  h2: { size: 24, weight: '600', lineHeight: 1.3 },
  h3: { size: 20, weight: '600', lineHeight: 1.4 },
  body: { size: 16, weight: '400', lineHeight: 1.5 },
  bodySm: { size: 14, weight: '400', lineHeight: 1.5 },
  caption: { size: 12, weight: '500', lineHeight: 1.4 },
} as const;

export type FontFamily = typeof fontFamily;
export type TypeScale = typeof typeScale;
