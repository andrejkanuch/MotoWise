import { cellToLatLng, getResolution, latLngToCell } from 'h3-js';
import { describe, expect, it } from 'vitest';
import { drive } from './__fixtures__/roads';
import { computeCells, TERRITORY_H3_RESOLUTION } from './cells';
import { resampleTrack, type TrackFix } from './track';

const noYield = async () => {};

function toFixes(lat: number, lng: number, lengthM: number): TrackFix[] {
  return drive([{ kind: 'straight', lengthM }], { start: { lat, lng }, startHeadingDeg: 90 }).map(
    (f) => ({
      t: null,
      lat: f.latitude,
      lng: f.longitude,
      alt: null,
      speed: null,
      heading: null,
      accuracy: null,
    }),
  );
}

describe('computeCells', () => {
  it('lists each H3 resolution 9 cell along the route once, sorted, as decimal strings', async () => {
    const fixes = toFixes(48.1486, 17.1077, 3_000);
    const track = await resampleTrack(fixes, { useSpeed: false }, noYield);
    const { cells, startCell } = await computeCells(track, fixes, noYield);

    expect(TERRITORY_H3_RESOLUTION).toBe(9);
    const asBigInt = cells.map((c) => BigInt(c));
    expect([...asBigInt].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))).toEqual(asBigInt);
    expect(new Set(cells).size).toBe(cells.length);
    // A 3 km straight crosses roughly 3000 / 350 m-wide cells; every cell is res 9.
    expect(cells.length).toBeGreaterThan(8);
    expect(cells.length).toBeLessThan(30);
    for (const c of cells) expect(getResolution(BigInt(c).toString(16))).toBe(9);

    const expectedStart = BigInt(`0x${latLngToCell(48.1486, 17.1077, 9)}`).toString();
    expect(startCell).toBe(expectedStart);
    expect(cells).toContain(expectedStart);
  });

  it('includes the cell of every resampled point', async () => {
    const fixes = toFixes(42.4, -2.5, 1_000);
    const track = await resampleTrack(fixes, { useSpeed: false }, noYield);
    const { cells } = await computeCells(track, fixes, noYield);
    const end = latLngToCell(track.lat[track.lat.length - 1], track.lng[track.lng.length - 1], 9);
    expect(cells).toContain(BigInt(`0x${end}`).toString());
    expect(cellToLatLng(end)[0]).toBeCloseTo(42.4, 1);
  });

  it('keeps stored fixes but leaves out points interpolated across a stored step longer than 1 km', async () => {
    const a = {
      t: null,
      lat: 42.4,
      lng: -2.5,
      alt: null,
      speed: null,
      heading: null,
      accuracy: null,
    };
    const b = { ...a, lng: -2.45 }; // about 4 km east, one step
    const track = await resampleTrack([a, b], { useSpeed: false }, noYield);
    const { cells } = await computeCells(track, [a, b], noYield);
    expect(cells).toEqual(
      [
        BigInt(`0x${latLngToCell(42.4, -2.5, 9)}`).toString(),
        BigInt(`0x${latLngToCell(42.4, -2.45, 9)}`).toString(),
      ].sort((x, y) => (BigInt(x) < BigInt(y) ? -1 : 1)),
    );
  });

  it('gives no cells for an empty track', async () => {
    expect(
      await computeCells({ lat: [], lng: [], eligible: [], fixStepM: [] }, [], noYield),
    ).toEqual({
      cells: [],
      startCell: null,
    });
  });
});
