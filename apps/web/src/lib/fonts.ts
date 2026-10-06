import { Instrument_Serif } from 'next/font/google';

/**
 * Instrument Serif for the signed-in web app (garage, profile, app handoff).
 * Upright only: the redesign never italicises it, so the italic face is not
 * downloaded. Plus Jakarta Sans (--font-sans) and Geist Mono
 * (--font-geist-mono) are already loaded by the root layout.
 */
export const instrumentSerif = Instrument_Serif({
  weight: '400',
  style: 'normal',
  subsets: ['latin'],
  variable: '--font-instrument-serif',
  display: 'swap',
});

/**
 * Put on the wrapper of any surface that uses the --mv-font-* tokens. It sets
 * --font-instrument-serif AND re-declares the --mv-font-* tokens on the same
 * element (`.mv-fonts` in mv-tokens.css), so --mv-font-serif resolves to the
 * loaded face rather than the unhashed fallback name.
 */
export const mvFontsClassName = `${instrumentSerif.variable} mv-fonts`;
