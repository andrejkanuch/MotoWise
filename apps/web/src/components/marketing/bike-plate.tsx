import type { CSSProperties } from 'react';

type PlateState = 'ready' | 'due' | 'overdue';

/** The state in words, for readers who cannot see the fill (colourblind,
 *  sunlight, screen readers). Pages pass a translated `stateLabel` where
 *  the plate is localized. */
const STATE_WORD: Record<PlateState, string> = {
  ready: 'Ready',
  due: 'Due soon',
  overdue: 'Overdue',
};

/**
 * The Bike Plate — the one object the site shares with the app
 * (apps/mobile/DESIGN.md, "Bike Plate (signature)"). Readiness is the fill
 * colour (bone = ready, signal = due soon, red = overdue), the figure is set
 * in the condensed plate face with tabular digits, and the identity edge
 * carries the racing number and the bike. The livery stripe through the
 * top-right corner is the only diagonal on the page.
 */
export function BikePlate({
  figure,
  unit,
  caption,
  racingNumber,
  identity,
  state = 'ready',
  stateLabel,
  settle,
  size,
  style,
}: {
  figure: string;
  unit: string;
  caption: string;
  racingNumber: string;
  identity: string;
  state?: PlateState;
  /** Translated state word; defaults to English. */
  stateLabel?: string;
  /** The signature settle (plate + stripe). One per page family; 'late'
   *  delays it so the home hero reads photo-settles → stripe-lays. */
  settle?: boolean | 'late';
  /** 'hero' = DESIGN.md's hero anatomy (figure 64); default is the compact plate. */
  size?: 'hero';
  style?: CSSProperties;
}) {
  // The visible text already reads in order (figure, caption, identity); the
  // state word is appended for readers who cannot see the fill.
  const word = stateLabel ?? STATE_WORD[state];
  return (
    <div
      className="mv-plate"
      data-state={state}
      data-settle={settle === true ? '' : settle || undefined}
      data-size={size}
      style={style}
    >
      <span className="mv-plate-stripe" aria-hidden="true" />
      <div className="mv-plate-figure-row">
        <span className="mv-plate-figure">{figure}</span>
        <span className="mv-plate-unit">{unit}</span>
      </div>
      <div className="mv-plate-caption">
        {caption}
        <span className="sr-only"> · {word}</span>
      </div>
      <div className="mv-plate-edge">
        <span className="mv-plate-edge-number">{racingNumber}</span>
        <span className="mv-plate-edge-identity" title={identity}>
          {identity}
        </span>
      </div>
    </div>
  );
}
