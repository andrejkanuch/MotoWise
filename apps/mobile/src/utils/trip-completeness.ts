/**
 * Planning-completeness score used by the TripCard ring (P4.2).
 *
 * Distinct from P2.1 readiness (which needs bike/weather/etc) — this one
 * answers "is this trip actually planned?" from data the card already has so
 * we can nudge riders to finish their drafts without extra queries.
 */

export interface TripCompletenessInput {
  description?: string | null;
  waypointCount: number;
  dayCount: number;
  participantCount: number;
  maxRiders: number;
}

export interface TripCompleteness {
  percent: number; // 0..100
  filled: number;
  total: number;
  missing: string[];
}

/**
 * Deliberately tiny — the card rings shouldn't pretend to be a readiness
 * scoring system. Four booleans, each worth a quarter of the ring.
 */
export function computeTripCompleteness(input: TripCompletenessInput): TripCompleteness {
  const dims: Array<{ ok: boolean; missingCopy: string }> = [
    {
      ok: (input.description ?? '').trim().length >= 20,
      missingCopy: 'Add a short description',
    },
    { ok: input.waypointCount >= 1, missingCopy: 'Add at least one stop' },
    {
      // At least one stop per day on average — an "11 stops over 3 days" trip
      // counts even if one day has none.
      ok: input.dayCount === 0 || input.waypointCount >= input.dayCount,
      missingCopy: 'Add more stops so each day has one',
    },
    {
      ok: input.participantCount >= 1 || input.maxRiders <= 1,
      missingCopy: 'Share the trip or invite riders',
    },
  ];

  const filled = dims.filter((d) => d.ok).length;
  const total = dims.length;
  const percent = Math.round((filled / total) * 100);
  const missing = dims.filter((d) => !d.ok).map((d) => d.missingCopy);

  return { percent, filled, total, missing };
}
