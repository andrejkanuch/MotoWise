import { latLngToCell } from 'h3-js';
import {
  COMPUTE_CHUNK_POINTS,
  type ResampledTrack,
  type TrackFix,
  type YieldFn,
  yieldToEventLoop,
} from './track';

/**
 * Territory cells are H3 resolution 9. Changing it is a stats version bump and a
 * full recompute before any reader deploys: cells at different resolutions
 * never match.
 */
export const TERRITORY_H3_RESOLUTION = 9;

/**
 * Points interpolated across a stored step longer than this are left out: a
 * straight line over a long signal loss is not a road the rider rode.
 */
const MAX_INTERPOLATED_STEP_M = 1_000;

function cellHex(lat: number, lng: number): string {
  return latLngToCell(lat, lng, TERRITORY_H3_RESOLUTION);
}

function hexToBigInt(hex: string): bigint {
  return BigInt(`0x${hex}`);
}

/** An H3 index as the decimal string of its 64-bit value (the `bigint` column's text form). */
function cellId(lat: number, lng: number): string {
  return hexToBigInt(cellHex(lat, lng)).toString();
}

export interface CellsResult {
  /** Distinct cells, sorted ascending by value, as decimal strings (they exceed 2^53). */
  cells: string[];
  startCell: string | null;
}

export async function computeCells(
  track: ResampledTrack,
  fixes: readonly TrackFix[],
  yieldFn: YieldFn = yieldToEventLoop,
): Promise<CellsResult> {
  // Raw H3 hex; consecutive points mostly share a cell, so repeats skip the Set.
  const seen = new Set<string>();
  let prev: string | null = null;
  const add = (hex: string) => {
    if (hex !== prev) seen.add(hex);
    prev = hex;
  };
  for (let i = 0; i < fixes.length; i++) {
    if (i > 0 && i % COMPUTE_CHUNK_POINTS === 0) await yieldFn();
    add(cellHex(fixes[i].lat, fixes[i].lng));
  }
  for (let i = 0; i < track.lat.length; i++) {
    if (i > 0 && i % COMPUTE_CHUNK_POINTS === 0) await yieldFn();
    if (track.fixStepM[i] > MAX_INTERPOLATED_STEP_M) continue;
    add(cellHex(track.lat[i], track.lng[i]));
  }
  const cells = [...seen]
    .map(hexToBigInt)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((c) => c.toString());
  return { cells, startCell: fixes.length > 0 ? cellId(fixes[0].lat, fixes[0].lng) : null };
}
