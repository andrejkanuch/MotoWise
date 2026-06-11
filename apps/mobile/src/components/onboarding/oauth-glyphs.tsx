import Svg, { Path } from 'react-native-svg';

/**
 * Shared-within-onboarding OAuth brand glyphs.
 *
 * Brand marks are the one sanctioned exception to the ONBOARDING_COLORS rule:
 * Apple and Google require their official colors to render correctly and to
 * satisfy each platform's brand guidelines. The Apple mark is monochrome and
 * adapts to its button background (dark on the white Apple button); the Google
 * "G" uses its fixed four-color palette.
 */

type AppleGlyphProps = {
  /** Square size in px. */
  size?: number;
  /** Override fill — defaults to black so it reads on Apple's white button. */
  color?: string;
};

/** Apple logo mark (monochrome single path). */
export function AppleGlyph({ size = 18, color = '#000' }: AppleGlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M17.05 12.54c-.02-2.05 1.67-3.03 1.75-3.08-.95-1.4-2.44-1.59-2.97-1.61-1.26-.13-2.47.74-3.11.74-.64 0-1.64-.72-2.69-.7-1.38.02-2.66.8-3.37 2.04-1.44 2.49-.37 6.18 1.03 8.2.68.99 1.5 2.1 2.57 2.06 1.03-.04 1.42-.66 2.67-.66 1.24 0 1.6.66 2.69.64 1.11-.02 1.82-1 2.5-2 .79-1.15 1.11-2.27 1.13-2.32-.02-.01-2.17-.83-2.19-3.3zM15.01 6.6c.57-.69.95-1.65.85-2.6-.82.03-1.81.54-2.39 1.23-.52.61-.98 1.59-.86 2.52.91.07 1.84-.46 2.4-1.15z"
      />
    </Svg>
  );
}

type GoogleGlyphProps = {
  /** Square size in px. */
  size?: number;
};

/** Official multicolor Google "G". */
export function GoogleGlyph({ size = 18 }: GoogleGlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <Path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <Path
        fill="#FBBC05"
        d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <Path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </Svg>
  );
}
