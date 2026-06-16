import {
  MyRidesForHeatmapDocument,
  type MyRidesForHeatmapQuery,
  type MyRidesForHeatmapQueryVariables,
} from '@motovault/graphql';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { gqlFetcher } from '../lib/graphql-client';
import { queryKeys } from '../lib/query-keys';
import { decodePolyline } from '../utils/polyline';

const PAGE_SIZE = 50;
const MAX_PAGES = 20;
/** Keep every Nth point to cap total at ~5 000. */
const DOWNSAMPLE_STEP = 5;
const MAX_POINTS = 5_000;

export function useRideHeatmapData({ enabled }: { enabled: boolean }) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: queryKeys.rides.heatmap,
    queryFn: ({ pageParam }: { pageParam: string | null }) => {
      const variables: MyRidesForHeatmapQueryVariables = {
        first: PAGE_SIZE,
        after: pageParam,
      };
      return gqlFetcher(MyRidesForHeatmapDocument, variables);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: MyRidesForHeatmapQuery) => {
      const pi = lastPage?.myRides?.pageInfo;
      return pi?.hasNextPage ? (pi.endCursor ?? null) : null;
    },
    // The heatmap eagerly pages up to 20×50 rides — by far the heaviest ride
    // query. Keep it fresh for 5 min so re-entering the screen (or a sibling
    // mounting it) doesn't refetch every page; a ride save still invalidates
    // `rides.all` and marks it stale for the next view.
    staleTime: 5 * 60 * 1000,
    enabled,
  });

  const pagesLoaded = data?.pages?.length ?? 0;

  // Eagerly page until MAX_PAGES (same pattern as profile heatmap screen).
  useEffect(() => {
    if (enabled && hasNextPage && !isFetchingNextPage && pagesLoaded < MAX_PAGES) {
      fetchNextPage();
    }
  }, [enabled, hasNextPage, isFetchingNextPage, pagesLoaded, fetchNextPage]);

  const heatmapGeoJSON = useMemo((): GeoJSON.FeatureCollection | null => {
    if (!enabled || !data?.pages) return null;

    const allCoords: [number, number][] = [];

    for (const page of data.pages) {
      for (const edge of page.myRides.edges) {
        const polyline = edge.node.routePolyline;
        if (!polyline) continue;
        try {
          const decoded = decodePolyline(polyline);
          // Take every Nth point from each ride
          for (let i = 0; i < decoded.length; i += DOWNSAMPLE_STEP) {
            allCoords.push(decoded[i]);
          }
        } catch {
          // Skip malformed polylines
        }
      }
    }

    // If still over budget after per-ride downsampling, thin globally
    let coords = allCoords;
    if (coords.length > MAX_POINTS) {
      const step = Math.ceil(coords.length / MAX_POINTS);
      const thinned: [number, number][] = [];
      for (let i = 0; i < coords.length; i += step) {
        thinned.push(coords[i]);
      }
      coords = thinned;
    }

    if (coords.length === 0) return null;

    return {
      type: 'FeatureCollection',
      features: coords.map(([lng, lat]) => ({
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'Point' as const,
          coordinates: [lng, lat],
        },
      })),
    };
  }, [enabled, data?.pages]);

  return { heatmapGeoJSON, isLoading: isLoading || isFetchingNextPage };
}
