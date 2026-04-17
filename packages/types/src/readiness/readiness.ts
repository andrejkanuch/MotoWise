/**
 * Pre-ride "Ready to ride" check.
 *
 * Reads only data that callers already have (trip, waypoints, bike, fuel)
 * and produces a deterministic report. Not a web-service call — cheap to
 * recompute whenever the underlying data changes so UIs can animate in
 * real-time as stops/details are filled in.
 *
 * Pure — safe to import from any app (mobile, web, api) and any runtime
 * (Node, RN, browser). No framework imports allowed here.
 */

export type Severity = 'required' | 'recommended';

export interface ReadinessItem {
  key: string;
  label: string;
  /** Short note shown when expanded / when the check fails. */
  note?: string;
  passed: boolean;
  severity: Severity;
}

export interface ReadinessReport {
  /** 0..1 — required items carry more weight than recommended ones. */
  score: number;
  passed: number;
  total: number;
  items: ReadinessItem[];
}

/** Alias introduced for cross-app naming parity (todo #135). */
export type ReadinessResult = ReadinessReport;

export interface ReadinessInputTrip {
  startDate?: string | null;
  endDate?: string | null;
  visibility?: 'private' | 'unlisted' | 'public' | null;
  participantCount?: number | null;
  waypoints: Array<{ lat: number; lng: number; sortOrder: number; name?: string | null }>;
  /**
   * Straight-line distance in kilometres between consecutive stops when
   * route geometry isn't available. Passed in pre-computed so callers
   * don't have to reimplement haversine here. Optional.
   */
  legDistancesKm?: number[];
}

export interface ReadinessInputBike {
  id?: string | null;
  tankLiters: number;
  kmPerLiter: number;
}

/** Combined input shape for callers that prefer a single argument. */
export interface ReadinessInput {
  trip: ReadinessInputTrip;
  bike: ReadinessInputBike | null;
}

interface Options {
  now?: Date;
}

/**
 * Safety factor applied to a bike's theoretical range (tank × km/L).
 * Matches `FuelStopsService.calculateEffectiveRange` on the API side —
 * keep in sync until both consumers import this constant directly.
 */
export const FUEL_RANGE_SAFETY_FACTOR = 0.8;

const REQUIRED_WEIGHT = 2;
const RECOMMENDED_WEIGHT = 1;

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function computeLegDistancesKm(waypoints: ReadinessInputTrip['waypoints']): number[] {
  const sorted = [...waypoints].sort((a, b) => a.sortOrder - b.sortOrder);
  const legs: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    legs.push(haversineKm(sorted[i - 1], sorted[i]));
  }
  return legs;
}

export function computeReadiness(
  trip: ReadinessInputTrip,
  bike: ReadinessInputBike | null,
  opts: Options = {},
): ReadinessReport {
  const now = opts.now ?? new Date();
  const items: ReadinessItem[] = [];

  // 1. Route basics — start + finish
  const hasRoute = trip.waypoints.length >= 2;
  items.push({
    key: 'route',
    label: 'Route has a start and a finish',
    passed: hasRoute,
    note: hasRoute
      ? undefined
      : 'A trip needs at least two stops so navigation can compute a route.',
    severity: 'required',
  });

  // 2. Trip dates sane — start not in the past
  let datesOk = true;
  let datesNote: string | undefined;
  if (trip.startDate) {
    const start = new Date(trip.startDate);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (start.getTime() < today.getTime()) {
      datesOk = false;
      datesNote = 'Start date is in the past — update it before you ride.';
    }
  } else {
    datesOk = false;
    datesNote = 'Add a start date so participants know when to show up.';
  }
  items.push({
    key: 'dates',
    label: 'Trip dates set',
    passed: datesOk,
    note: datesNote,
    severity: 'required',
  });

  // 3. Fuel — longest inter-stop gap vs bike range
  const range = bike ? bike.tankLiters * bike.kmPerLiter * FUEL_RANGE_SAFETY_FACTOR : null;
  const legs = trip.legDistancesKm ?? computeLegDistancesKm(trip.waypoints);
  const longestLegKm = legs.length > 0 ? Math.max(...legs) : 0;
  let fuelOk = true;
  let fuelNote: string | undefined;
  if (!bike) {
    fuelOk = false;
    fuelNote = 'Add a primary bike so we can check fuel range against your route.';
  } else if (range && longestLegKm > range) {
    fuelOk = false;
    fuelNote = `Longest gap ${Math.round(longestLegKm)}km > ${Math.round(range)}km range — add a fuel stop.`;
  } else if (range) {
    fuelNote = `Longest gap ${Math.round(longestLegKm)}km / ${Math.round(range)}km range`;
  }
  items.push({
    key: 'fuel',
    label: 'Fuel range covers longest gap',
    passed: fuelOk,
    note: fuelNote,
    severity: 'required',
  });

  // 4. Someone knows your route — trip is public/unlisted or has participants
  const hasWitness =
    (trip.participantCount ?? 0) > 1 ||
    trip.visibility === 'public' ||
    trip.visibility === 'unlisted';
  items.push({
    key: 'witness',
    label: 'Someone knows your route',
    passed: hasWitness,
    note: hasWitness
      ? undefined
      : 'Invite a rider, share the trip, or make it unlisted so someone has the link.',
    severity: 'recommended',
  });

  // 5. Primary bike picked — implies documents/service records nearby
  items.push({
    key: 'bike',
    label: 'Primary bike selected',
    passed: !!bike?.id,
    note: bike?.id
      ? undefined
      : 'Pick a primary bike in Garage so service history powers the other checks.',
    severity: 'recommended',
  });

  // 6. Stops are named — not just default "Stop 3" labels
  const unnamedCount = trip.waypoints.filter(
    (wp) => !wp.name || /^stop\s*\d+$/i.test(wp.name),
  ).length;
  items.push({
    key: 'names',
    label: 'Stops are named',
    passed: unnamedCount === 0,
    note:
      unnamedCount === 0
        ? undefined
        : `${unnamedCount} ${unnamedCount === 1 ? 'stop is' : 'stops are'} still using a default label.`,
    severity: 'recommended',
  });

  // Weighted score
  let totalWeight = 0;
  let earnedWeight = 0;
  for (const item of items) {
    const w = item.severity === 'required' ? REQUIRED_WEIGHT : RECOMMENDED_WEIGHT;
    totalWeight += w;
    if (item.passed) earnedWeight += w;
  }

  return {
    score: totalWeight === 0 ? 0 : earnedWeight / totalWeight,
    passed: items.filter((i) => i.passed).length,
    total: items.length,
    items,
  };
}

/**
 * Format the readiness report as a plain-text "tank-bag brief" that can
 * be copied or shared. Pre-PDF stopgap — keeps the feature shippable
 * without a server round-trip.
 */
export function formatReadinessBrief(params: {
  tripTitle: string;
  startDate?: string | null;
  endDate?: string | null;
  waypoints: Array<{ name: string; notes?: string | null }>;
  readiness: ReadinessReport;
}): string {
  const { tripTitle, startDate, endDate, waypoints, readiness } = params;
  const dates = startDate && endDate ? `${startDate} → ${endDate}` : startDate || 'Dates TBD';

  const stopLines = waypoints
    .map((w, i) => `  ${i + 1}. ${w.name}${w.notes ? ` — ${w.notes}` : ''}`)
    .join('\n');

  const checks = readiness.items
    .map((i) => `  ${i.passed ? '✓' : '✗'} ${i.label}${i.note ? ` (${i.note})` : ''}`)
    .join('\n');

  return [
    `🏍 ${tripTitle}`,
    dates,
    '',
    `Ready to ride: ${Math.round(readiness.score * 100)}%  (${readiness.passed}/${readiness.total})`,
    '',
    'Checklist',
    '---------',
    checks,
    '',
    'Stops',
    '-----',
    stopLines,
    '',
    'Generated by MotoWise',
  ].join('\n');
}
