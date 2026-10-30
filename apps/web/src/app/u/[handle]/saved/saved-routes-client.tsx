'use client';

import { Star } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SavedTripNode } from '../../../../lib/fetch-saved-routes';
import { formatDistance } from '../../../../lib/format-utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/graphql';

const PUBLIC_SAVED_TRIPS_QUERY = `
  query PublicSavedTrips($handle: String!, $first: Int, $after: String) {
    publicSavedTrips(handle: $handle, first: $first, after: $after) {
      edges {
        node {
          id
          title
          distanceM
          elevationGainM
          surfaceType
          isMotovaultPick
          averageRating
          reviewCount
          organiser {
            id
            displayName
            publicUsername
            avatarUrl
          }
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const SURFACE_LABELS: Record<string, string> = {
  paved: 'Paved',
  mixed: 'Mixed',
  'off-road': 'Off-road',
};

interface SavedRoutesClientProps {
  handle: string;
  initialEndCursor?: string;
}

export function SavedRoutesClient({ handle, initialEndCursor }: SavedRoutesClientProps) {
  const [routes, setRoutes] = useState<SavedTripNode[]>([]);
  const [endCursor, setEndCursor] = useState(initialEndCursor);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (loading || !hasNextPage || !endCursor) return;
    setLoading(true);

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: PUBLIC_SAVED_TRIPS_QUERY,
          variables: { handle, first: 20, after: endCursor },
        }),
      });
      const json = await res.json();
      const data = json.data?.publicSavedTrips;
      if (!data) return;

      const newRoutes = data.edges.map((edge: { node: SavedTripNode }) => edge.node);
      setRoutes((prev) => [...prev, ...newRoutes]);
      setEndCursor(data.pageInfo.endCursor);
      setHasNextPage(data.pageInfo.hasNextPage);
    } catch {
      // Silently fail — user can scroll again
    } finally {
      setLoading(false);
    }
  }, [loading, hasNextPage, endCursor, handle]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <>
      {/* Additional loaded routes continue the same hairline list */}
      {routes.length > 0 && (
        <ul className="mv-rows is-open">
          {routes.map((route) => (
            <SavedRouteRow key={route.id} route={route} />
          ))}
        </ul>
      )}

      {/* Intersection observer sentinel */}
      {hasNextPage && (
        <div ref={sentinelRef} className="sp-loading" aria-live="polite">
          {loading ? 'Loading more routes…' : ''}
        </div>
      )}
    </>
  );
}

/**
 * One saved route as a hairline row on the shared .mv-row grammar. Shared by the
 * server-rendered first page and the client-loaded pages, so both read alike.
 */
export function SavedRouteRow({
  route,
}: {
  route: {
    id: string;
    title: string;
    distanceM?: number | null;
    elevationGainM?: number | null;
    surfaceType?: string | null;
    isMotovaultPick: boolean;
    averageRating?: number | null;
    reviewCount: number;
    organiser: { displayName: string; publicUsername?: string | null };
  };
}) {
  const surfaceLabel = route.surfaceType ? SURFACE_LABELS[route.surfaceType] : null;
  const hasRating = route.averageRating != null && route.reviewCount > 0;
  const by = `by ${route.organiser.displayName}${
    route.organiser.publicUsername ? ` @${route.organiser.publicUsername}` : ''
  }`;

  return (
    <li>
      <a className="mv-row sp-row" href={`/trips/${route.id}`}>
        <div className="sp-row-body">
          <div className="sp-row-title">{route.title || 'Unnamed route'}</div>
          <div className="sp-row-meta">
            {route.distanceM != null && <span>{formatDistance(route.distanceM)}</span>}
            {(route.elevationGainM ?? 0) > 0 && (
              <span>{Math.round(route.elevationGainM ?? 0)} m climb</span>
            )}
            {surfaceLabel && <span>{surfaceLabel}</span>}
            {hasRating && (
              <span>
                <Star size={14} aria-hidden="true" fill="currentColor" />
                {route.averageRating?.toFixed(1)} ({route.reviewCount})
              </span>
            )}
            {!hasRating && route.reviewCount > 0 && (
              <span>
                {route.reviewCount} {route.reviewCount === 1 ? 'review' : 'reviews'}
              </span>
            )}
            {route.isMotovaultPick && <span>Editor's pick</span>}
            <span>{by}</span>
          </div>
        </div>
      </a>
    </li>
  );
}
