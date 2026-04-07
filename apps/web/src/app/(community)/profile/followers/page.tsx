'use client';

import type { GetFollowersQuery } from '@motovault/graphql';
import { GetFollowersDocument, GetFollowingDocument, MeDocument } from '@motovault/graphql';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { gqlFetcher } from '@/lib/graphql-client';

type FollowEdge = GetFollowersQuery['getFollowers']['edges'][number];

const TABS = ['Followers', 'Following'] as const;
type Tab = (typeof TABS)[number];

export default function FollowersPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Followers');

  const { data: meData } = useQuery({
    queryKey: ['me'],
    queryFn: () => gqlFetcher(MeDocument),
  });

  const userId = meData?.me?.id;

  const followersQuery = useInfiniteQuery({
    queryKey: ['followers', userId],
    queryFn: ({ pageParam }) =>
      gqlFetcher(GetFollowersDocument, {
        userId: userId!,
        first: 20,
        after: pageParam ?? undefined,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.getFollowers.pageInfo.hasNextPage
        ? lastPage.getFollowers.pageInfo.endCursor
        : undefined,
    enabled: !!userId,
  });

  const followingQuery = useInfiniteQuery({
    queryKey: ['following', userId],
    queryFn: ({ pageParam }) =>
      gqlFetcher(GetFollowingDocument, {
        userId: userId!,
        first: 20,
        after: pageParam ?? undefined,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.getFollowing.pageInfo.hasNextPage
        ? lastPage.getFollowing.pageInfo.endCursor
        : undefined,
    enabled: !!userId,
  });

  const activeQuery = activeTab === 'Followers' ? followersQuery : followingQuery;
  const edges: FollowEdge[] =
    activeTab === 'Followers'
      ? (followersQuery.data?.pages.flatMap((p) => p.getFollowers.edges) ?? [])
      : (followingQuery.data?.pages.flatMap((p) => p.getFollowing.edges) ?? []);

  return (
    <div>
      <h1 className="text-xl font-bold text-neutral-50">Connections</h1>

      {/* Tabs */}
      <div className="mt-4 flex border-b border-neutral-800">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-warm-400 text-warm-400'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* List */}
      {activeQuery.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-700 border-t-warm-400" />
        </div>
      ) : edges.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-neutral-500">
            {activeTab === 'Followers' ? 'No followers yet.' : 'You are not following anyone yet.'}
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {edges.map(({ node }) => {
            const name = node.displayName ?? node.publicUsername ?? 'Rider';
            const initial = name.charAt(0).toUpperCase();
            const username = node.publicUsername;
            const href = username ? `/rider/${username}` : '#';

            return (
              <a
                key={`${node.followerId}-${node.followingId}`}
                href={href}
                className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900/50 p-3 transition-colors hover:border-neutral-700"
              >
                {node.avatarUrl ? (
                  // biome-ignore lint/performance/noImgElement: user avatar from Supabase storage
                  <img
                    src={node.avatarUrl}
                    alt={name}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-800 text-sm font-bold text-neutral-300">
                    {initial}
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-neutral-100">{name}</p>
                  {username && <p className="text-xs text-neutral-500">@{username}</p>}
                </div>
              </a>
            );
          })}

          {/* Load more */}
          {activeQuery.hasNextPage && (
            <div className="flex justify-center py-4">
              <button
                type="button"
                onClick={() => activeQuery.fetchNextPage()}
                disabled={activeQuery.isFetchingNextPage}
                className="rounded-full bg-neutral-800 px-6 py-2.5 text-sm font-medium text-neutral-300 transition-colors hover:bg-neutral-700 disabled:opacity-50"
              >
                {activeQuery.isFetchingNextPage ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
