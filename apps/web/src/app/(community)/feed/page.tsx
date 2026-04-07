'use client';

import type { GetRideFeedQuery } from '@motovault/graphql';
import { GetRideFeedDocument, ToggleKudosDocument } from '@motovault/graphql';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDate, formatDistance } from '@/lib/format-utils';
import { gqlFetcher } from '@/lib/graphql-client';

type FeedEdge = GetRideFeedQuery['rideFeed']['edges'][number];

function computeDuration(startedAt: string, endedAt: string | null | undefined): string {
  if (!endedAt) return '';
  const seconds = Math.floor((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000);
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours >= 1) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export default function FeedPage() {
  const queryClient = useQueryClient();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } =
    useInfiniteQuery({
      queryKey: ['rideFeed'],
      queryFn: ({ pageParam }) =>
        gqlFetcher(GetRideFeedDocument, { first: 15, after: pageParam ?? undefined }),
      initialPageParam: null as string | null,
      getNextPageParam: (lastPage) =>
        lastPage.rideFeed.pageInfo.hasNextPage ? lastPage.rideFeed.pageInfo.endCursor : undefined,
    });

  const kudosMutation = useMutation({
    mutationFn: (rideId: string) => gqlFetcher(ToggleKudosDocument, { rideId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rideFeed'] });
    },
  });

  const allEdges: FeedEdge[] = data?.pages.flatMap((page) => page.rideFeed.edges) ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-700 border-t-warm-400" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-20 text-center">
        <p className="text-neutral-400">Failed to load feed. Please try again.</p>
      </div>
    );
  }

  if (allEdges.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-xl font-bold text-neutral-200">No rides yet</p>
        <p className="mt-2 text-neutral-500">Follow riders to see their adventures here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-neutral-50">Feed</h1>
      {allEdges.map(({ node: ride }) => {
        const bikeName =
          ride.bike?.nickname ??
          (ride.bike ? `${ride.bike.year} ${ride.bike.make} ${ride.bike.model}` : null);
        const duration = computeDuration(ride.startedAt, ride.endedAt);

        return (
          <article
            key={ride.id}
            className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5 transition-colors hover:border-neutral-700"
          >
            {/* Rider header */}
            <div className="flex items-center gap-3">
              {ride.rider.avatarUrl ? (
                // biome-ignore lint/performance/noImgElement: user avatar from Supabase storage
                <img
                  src={ride.rider.avatarUrl}
                  alt={ride.rider.displayName}
                  className="h-9 w-9 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-800 text-sm font-bold text-neutral-300">
                  {ride.rider.displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <a
                  href={`/rider/${ride.rider.publicUsername}`}
                  className="text-sm font-semibold text-neutral-100 hover:underline"
                >
                  {ride.rider.displayName}
                </a>
                <p className="text-xs text-neutral-500">{formatDate(ride.startedAt)}</p>
              </div>
            </div>

            {/* Route thumbnail */}
            {ride.routeThumbnailUri && (
              // biome-ignore lint/performance/noImgElement: route thumbnail from Supabase storage
              <img
                src={ride.routeThumbnailUri}
                alt="Route map"
                className="mt-3 h-40 w-full rounded-xl object-cover"
              />
            )}

            {/* Ride name */}
            {ride.name && <p className="mt-3 font-semibold text-neutral-100">{ride.name}</p>}

            {/* Stats */}
            <div className="mt-2 flex flex-wrap gap-3 text-sm text-neutral-400">
              {ride.distanceM != null && <span>{formatDistance(ride.distanceM)}</span>}
              {duration && <span>{duration}</span>}
              {bikeName && <span>{bikeName}</span>}
            </div>

            {/* AI Summary */}
            {ride.aiSummary && (
              <p className="mt-2 text-sm leading-relaxed text-neutral-400 line-clamp-3">
                {ride.aiSummary}
              </p>
            )}

            {/* Kudos */}
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => kudosMutation.mutate(ride.id)}
                disabled={kudosMutation.isPending}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  ride.hasKudos
                    ? 'bg-warm-500/15 text-warm-400'
                    : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-300'
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <title>Kudos</title>
                  <path
                    d="M8 14s-5.5-3.5-5.5-7.5C2.5 4 4.5 2.5 8 5c3.5-2.5 5.5-1 5.5 1.5S8 14 8 14z"
                    fill={ride.hasKudos ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    strokeWidth="1.2"
                  />
                </svg>
                {ride.kudosCount > 0 && <span>{ride.kudosCount}</span>}
              </button>
            </div>
          </article>
        );
      })}

      {/* Load more */}
      {hasNextPage && (
        <div className="flex justify-center py-4">
          <button
            type="button"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="rounded-full bg-neutral-800 px-6 py-2.5 text-sm font-medium text-neutral-300 transition-colors hover:bg-neutral-700 disabled:opacity-50"
          >
            {isFetchingNextPage ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
