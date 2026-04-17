/**
 * Period-of-day grouping for trip waypoints.
 *
 * Riders think in chunks — "morning twisties → lunch → afternoon pass →
 * evening hotel" — not a flat list of 11 stops. This utility groups a day's
 * waypoints into those semantic buckets while preserving sortOrder within
 * each bucket and leaving unlabelled stops in a top "unset" bucket so
 * legacy trips still render cleanly.
 */

export type PeriodOfDay = 'morning' | 'afternoon' | 'evening';

export const PERIOD_ORDER: readonly PeriodOfDay[] = ['morning', 'afternoon', 'evening'] as const;

export const PERIOD_LABEL: Record<PeriodOfDay, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
};

export const PERIOD_HINT: Record<PeriodOfDay, string> = {
  morning: 'Coffee · twisties · first tank',
  afternoon: 'Lunch · the big road of the day',
  evening: 'Dinner · hotel · route home',
};

export interface PeriodGroup<T> {
  period: PeriodOfDay | null;
  label: string;
  items: T[];
}

export function groupByPeriod<T extends { periodOfDay?: PeriodOfDay | null; sortOrder: number }>(
  waypoints: T[],
): PeriodGroup<T>[] {
  const buckets: Record<PeriodOfDay | 'unset', T[]> = {
    unset: [],
    morning: [],
    afternoon: [],
    evening: [],
  };

  for (const wp of waypoints) {
    const key = wp.periodOfDay ?? 'unset';
    buckets[key].push(wp);
  }

  // Preserve sortOrder inside each bucket.
  for (const key of Object.keys(buckets) as Array<keyof typeof buckets>) {
    buckets[key].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  const groups: PeriodGroup<T>[] = [];
  if (buckets.unset.length > 0) {
    groups.push({ period: null, label: 'Stops', items: buckets.unset });
  }
  for (const p of PERIOD_ORDER) {
    if (buckets[p].length > 0) {
      groups.push({ period: p, label: PERIOD_LABEL[p], items: buckets[p] });
    }
  }
  return groups;
}
