import type { CSSProperties } from 'react';

type PlateState = 'ready' | 'due' | 'overdue';

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
  style,
}: {
  figure: string;
  unit: string;
  caption: string;
  racingNumber: string;
  identity: string;
  state?: PlateState;
  style?: CSSProperties;
}) {
  return (
    <div className="mv-plate" data-state={state} style={style}>
      <span className="mv-plate-stripe" aria-hidden="true" />
      <div className="mv-plate-figure-row">
        <span className="mv-plate-figure">{figure}</span>
        <span className="mv-plate-unit">{unit}</span>
      </div>
      <div className="mv-plate-caption">{caption}</div>
      <div className="mv-plate-edge">
        <span className="mv-plate-edge-number">{racingNumber}</span>
        <span className="mv-plate-edge-identity">{identity}</span>
      </div>
    </div>
  );
}
