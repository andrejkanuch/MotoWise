import {
  type DiscoverRoutesFilterInput,
  SavedTripsDocument,
  type SavedTripsQuery,
} from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { gqlFetcher } from '../lib/graphql-client';
import { queryKeys } from '../lib/query-keys';

/**
 * Builds three "inspiration" filter variants for the Discover empty state.
 * All three are meant to be shown as separate horizontal sections in parallel.
 */

type SavedTripNode = SavedTripsQuery['savedTrips']['edges'][number]['node'];

export interface InspirationFilters {
  /** Highly rated, short-distance loops — a single Saturday's worth. */
  weekend: DiscoverRoutesFilterInput;
  /** Seasonal heuristic driven by the current month. */
  season: { filter: DiscoverRoutesFilterInput; label: string };
  /** Top-rated routes sharing the surface type the rider saves most. */
  becauseYouLiked: { filter: DiscoverRoutesFilterInput; anchorName: string | null } | null;
}

type Season = 'winter' | 'spring' | 'summer' | 'autumn';

// Months are 0-indexed. Dec + Jan + Feb = winter, etc.
const SEASON_BY_MONTH: Record<number, Season> = {
  0: 'winter', // Jan
  1: 'winter', // Feb
  2: 'spring', // Mar
  3: 'spring', // Apr
  4: 'spring', // May
  5: 'summer', // Jun
  6: 'summer', // Jul
  7: 'summer', // Aug
  8: 'autumn', // Sep
  9: 'autumn', // Oct
  10: 'autumn', // Nov
  11: 'winter', // Dec
};

const SEASON_VARIANT: Record<Season, { filter: DiscoverRoutesFilterInput; label: string }> = {
  winter: {
    filter: { surfaceTypes: ['paved'], highlyRatedOnly: true },
    label: 'Stay paved this week',
  },
  spring: {
    filter: { minTwistScore: 7, highlyRatedOnly: true },
    label: 'Spring twisties',
  },
  summer: {
    filter: { minTwistScore: 7, highlyRatedOnly: true },
    label: 'Summer twisties',
  },
  autumn: {
    filter: { surfaceTypes: ['mixed'], highlyRatedOnly: true },
    label: 'Great in fall foliage',
  },
};

// Stable reference so consumers memoising on `weekend` don't churn.
const WEEKEND_FILTER: DiscoverRoutesFilterInput = {
  lengthRanges: ['50to100'],
  highlyRatedOnly: true,
  sortByRating: true,
};

function seasonalFilter(month: number): { filter: DiscoverRoutesFilterInput; label: string } {
  const season = SEASON_BY_MONTH[month] ?? 'summer';
  return SEASON_VARIANT[season];
}

function mostCommonSurface(trips: SavedTripNode[]): string | null {
  const counts = new Map<string, number>();
  for (const t of trips) {
    if (!t.surfaceType) continue;
    counts.set(t.surfaceType, (counts.get(t.surfaceType) ?? 0) + 1);
  }
  let best: { type: string; count: number } | null = null;
  for (const [type, count] of counts) {
    if (!best || count > best.count) best = { type, count };
  }
  return best?.type ?? null;
}

export function useInspirationFilters(enabled = true): InspirationFilters {
  // Compute once per mount — the "season of the week" isn't going to flip
  // mid-render, and pulling `new Date()` out of the render path keeps the
  // returned object reference-stable for Discover's memoised consumers.
  const month = useMemo(() => new Date().getMonth(), []);

  // Only the user's saved-trips call runs while signed-in. If it fails or is
  // empty we just skip the "because you liked" section.
  const { data } = useQuery({
    queryKey: queryKeys.savedTrips.all,
    queryFn: () => gqlFetcher(SavedTripsDocument, { first: 20, after: null }),
    enabled,
    staleTime: 15 * 60 * 1000,
  });

  const savedTrips: SavedTripNode[] = useMemo(
    () => data?.savedTrips?.edges?.map((e) => e.node) ?? [],
    [data],
  );

  return useMemo<InspirationFilters>(() => {
    const season = seasonalFilter(month);

    let becauseYouLiked: InspirationFilters['becauseYouLiked'] = null;
    if (savedTrips.length > 0) {
      const surface = mostCommonSurface(savedTrips);
      if (surface) {
        becauseYouLiked = {
          filter: {
            surfaceTypes: [surface],
            highlyRatedOnly: true,
          },
          // Pick the most-recently-saved trip as the "anchor" for the label.
          anchorName: savedTrips[0]?.title ?? null,
        };
      }
    }

    return {
      weekend: WEEKEND_FILTER,
      season,
      becauseYouLiked,
    };
  }, [month, savedTrips]);
}
