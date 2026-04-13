'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SavedRouteNode } from '../../../../lib/fetch-saved-routes';
import { formatDistance } from '../../../../lib/format-utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/graphql';

const PUBLIC_SAVED_ROUTES_QUERY = `
  query PublicSavedRoutes($handle: String!, $first: Int, $after: String) {
    publicSavedRoutes(handle: $handle, first: $first, after: $after) {
      edges {
        node {
          id
          name
          distanceM
          elevationGainM
          surfaceType
          isMotovaultPick
          ratingAvg
          ratingCount
          commentCount
          contributor {
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

interface SavedRoutesClientProps {
  handle: string;
  initialEndCursor?: string;
}

export function SavedRoutesClient({ handle, initialEndCursor }: SavedRoutesClientProps) {
  const [routes, setRoutes] = useState<SavedRouteNode[]>([]);
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
          query: PUBLIC_SAVED_ROUTES_QUERY,
          variables: { handle, first: 20, after: endCursor },
        }),
      });
      const json = await res.json();
      const data = json.data?.publicSavedRoutes;
      if (!data) return;

      const newRoutes = data.edges.map(
        (edge: { node: SavedRouteNode }) => edge.node,
      );
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
      {/* Additional loaded routes */}
      {routes.length > 0 && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {routes.map((route) => (
            <ClientRouteCard key={route.id} route={route} />
          ))}
        </div>
      )}

      {/* Intersection observer sentinel */}
      {hasNextPage && (
        <div ref={sentinelRef} className="flex justify-center py-6">
          {loading && (
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
          )}
        </div>
      )}
    </>
  );
}

function ClientRouteCard({ route }: { route: SavedRouteNode }) {
  const surfaceLabel =
    route.surfaceType === 'paved'
      ? 'Paved'
      : route.surfaceType === 'mixed'
        ? 'Mixed'
        : route.surfaceType === 'off-road'
          ? 'Off-road'
          : null;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 transition-shadow hover:shadow-sm">
      <div className="flex items-center gap-2">
        <svg
          className="h-4 w-4 shrink-0 text-blue-600"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z"
          />
        </svg>
        <h3 className="flex-1 truncate text-sm font-semibold text-neutral-900">
          {route.name ?? 'Unnamed Route'}
        </h3>
        {route.isMotovaultPick && (
          <span className="shrink-0 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
            Pick
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-neutral-600">
        <span className="font-medium">{formatDistance(route.distanceM)}</span>
        {(route.elevationGainM ?? 0) > 0 && (
          <span>{Math.round(route.elevationGainM ?? 0)}m elev.</span>
        )}
        {surfaceLabel && <span>{surfaceLabel}</span>}
        {route.ratingAvg != null && route.ratingCount > 0 && (
          <span className="flex items-center gap-1">
            <svg className="h-3 w-3 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            {route.ratingAvg.toFixed(1)} ({route.ratingCount})
          </span>
        )}
        {route.commentCount > 0 && <span>{route.commentCount} reviews</span>}
      </div>

      <p className="mt-2 text-xs text-neutral-400">
        by {route.contributor.displayName}
        {route.contributor.publicUsername ? ` @${route.contributor.publicUsername}` : ''}
      </p>
    </div>
  );
}
