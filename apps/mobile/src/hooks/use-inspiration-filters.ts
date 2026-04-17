import {
  type DiscoverRoutesFilterInput,
  SavedRoutesDocument,
  type SavedRoutesQuery,
} from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { gqlFetcher } from '../lib/graphql-client';
import { queryKeys } from '../lib/query-keys';

/**
 * Builds three "inspiration" filter variants for the Discover empty state.
 * All three are meant to be shown as separate horizontal sections in parallel.
 */

type SavedRouteNode = SavedRoutesQuery['savedRoutes']['edges'][number]['node'];

export interface InspirationFilters {
  /** Highly rated, short-distance loops — a single Saturday's worth. */
  weekend: DiscoverRoutesFilterInput;
  /** Seasonal heuristic driven by the current month. */
  season: { filter: DiscoverRoutesFilterInput; label: string };
  /** Top-rated routes sharing the surface type the rider saves most. */
  becauseYouLiked: { filter: DiscoverRoutesFilterInput; anchorName: string | null } | null;
}

function seasonalFilter(month: number): { filter: DiscoverRoutesFilterInput; label: string } {
  // Months are 0-indexed.
  if (month >= 10 || month <= 2) {
    // Nov-Feb: cold / wet — keep it paved + top rated.
    return {
      filter: { surfaceTypes: ['paved'], highlyRatedOnly: true },
      label: 'Stay paved this week',
    };
  }
  if (month >= 8 && month <= 10) {
    // Sep-Nov: autumn, foliage rides — mixed surfaces shine.
    return {
      filter: { surfaceTypes: ['mixed'], highlyRatedOnly: true },
      label: 'Great in fall foliage',
    };
  }
  // Spring / summer — go chase twisties.
  return {
    filter: { minTwistScore: 7, highlyRatedOnly: true },
    label: 'Summer twisties',
  };
}

function mostCommonSurface(routes: SavedRouteNode[]): string | null {
  const counts = new Map<string, number>();
  for (const r of routes) {
    if (!r.surfaceType) continue;
    counts.set(r.surfaceType, (counts.get(r.surfaceType) ?? 0) + 1);
  }
  let best: { type: string; count: number } | null = null;
  for (const [type, count] of counts) {
    if (!best || count > best.count) best = { type, count };
  }
  return best?.type ?? null;
}

export function useInspirationFilters(enabled = true): InspirationFilters {
  const now = new Date();
  const season = useMemo(() => seasonalFilter(now.getMonth()), [now.getMonth()]);

  // Only the user's saved-routes call runs while signed-in. If it fails or is
  // empty we just skip the "because you liked" section.
  const { data } = useQuery({
    queryKey: queryKeys.routes.saved,
    queryFn: () => gqlFetcher(SavedRoutesDocument, { first: 20, after: null }),
    enabled,
    staleTime: 15 * 60 * 1000,
  });

  const savedRoutes: SavedRouteNode[] = useMemo(
    () => data?.savedRoutes.edges.map((e) => e.node) ?? [],
    [data],
  );

  const becauseYouLiked = useMemo(() => {
    if (savedRoutes.length === 0) return null;
    const surface = mostCommonSurface(savedRoutes);
    if (!surface) return null;
    // Pick the most-recently-saved route as the "anchor" for the label.
    const anchorName = savedRoutes[0]?.name ?? null;
    return {
      filter: {
        surfaceTypes: [surface],
        highlyRatedOnly: true,
      } as DiscoverRoutesFilterInput,
      anchorName,
    };
  }, [savedRoutes]);

  const weekend: DiscoverRoutesFilterInput = {
    lengthRanges: ['50to100'],
    highlyRatedOnly: true,
    sortByRating: true,
  };

  return { weekend, season, becauseYouLiked };
}
