'use client';

import type { GetFollowersQuery } from '@motovault/graphql';
import { GetFollowersDocument, GetFollowingDocument, MeDocument } from '@motovault/graphql';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { gqlFetcher } from '@/lib/graphql-client';
import { Avatar } from '../avatar';
import '@/app/(community)/garage/garage.css';

type FollowEdge = GetFollowersQuery['getFollowers']['edges'][number];

const TAB_KEYS = ['followers', 'following'] as const;
type Tab = (typeof TAB_KEYS)[number];

/**
 * /profile/followers: the rider's followers and following as hairline rows
 * (.mv-rows, 44 px+ targets) under an .mv-segmented control; selection is a
 * raised surface, never copper. Read-only: following happens in the app.
 */
export default function FollowersPage() {
  const t = useTranslations('Followers');
  const [activeTab, setActiveTab] = useState<Tab>('followers');

  const { data: meData } = useQuery({
    queryKey: ['me'],
    queryFn: () => gqlFetcher(MeDocument),
  });

  const userId = meData?.me?.id;

  const followersQuery = useInfiniteQuery({
    queryKey: ['followers', userId],
    queryFn: ({ pageParam }) =>
      gqlFetcher(GetFollowersDocument, {
        userId: userId ?? '',
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
        userId: userId ?? '',
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

  const activeQuery = activeTab === 'followers' ? followersQuery : followingQuery;
  const edges: FollowEdge[] =
    activeTab === 'followers'
      ? (followersQuery.data?.pages.flatMap((p) => p.getFollowers.edges) ?? [])
      : (followingQuery.data?.pages.flatMap((p) => p.getFollowing.edges) ?? []);

  return (
    <div className="garage-page">
      <div className="garage-inner">
        <h1 className="mv-section-title prof-title">{t('title')}</h1>

        {/* The segmented control's own grammar (pressed buttons), not ARIA tabs: both stay in the Tab order. */}
        <div className="mv-segmented prof-tabs">
          {TAB_KEYS.map((tab) => (
            <button
              key={tab}
              type="button"
              aria-pressed={activeTab === tab}
              onClick={() => setActiveTab(tab)}
            >
              {t(tab)}
            </button>
          ))}
        </div>

        <div aria-busy={activeQuery.isLoading || undefined}>
          {activeQuery.isLoading ? (
            <div className="prof-empty">
              <div className="prof-spinner" role="status" aria-label={t('loading')} />
            </div>
          ) : activeQuery.isError ? (
            // A failed load is not an empty list: name it and offer the retry.
            <div className="prof-empty" role="alert">
              <p className="prof-quiet">
                {t('failedToLoad')} {t('failedBody')}
              </p>
              <button
                type="button"
                className="mv-btn mv-btn-ghost"
                onClick={() => activeQuery.refetch()}
              >
                {t('retry')}
              </button>
            </div>
          ) : edges.length === 0 ? (
            <div className="prof-empty">
              <p className="prof-quiet">
                {activeTab === 'followers' ? t('noFollowers') : t('noFollowing')}
              </p>
            </div>
          ) : (
            <>
              <ul className="mv-rows is-open prof-list">
                {edges.map(({ node }) => {
                  const name = node.displayName ?? node.publicUsername ?? 'Rider';
                  const initial = name.charAt(0).toUpperCase();
                  const username = node.publicUsername;
                  const person = (
                    <>
                      <Avatar
                        src={node.avatarUrl}
                        alt=""
                        initial={initial}
                        className="prof-person-avatar"
                      />
                      <span className="prof-person-text">
                        <span className="mv-row-title prof-person-name">{name}</span>
                        {username && (
                          <span className="mv-row-sub prof-person-handle">@{username}</span>
                        )}
                      </span>
                    </>
                  );

                  // A rider without a public username has no page: a row, not a link to nowhere.
                  return (
                    <li key={`${node.followerId}-${node.followingId}`}>
                      {username ? (
                        <a href={`/rider/${username}`} className="mv-row prof-person">
                          {person}
                        </a>
                      ) : (
                        <span className="mv-row prof-person">{person}</span>
                      )}
                    </li>
                  );
                })}
              </ul>

              {activeQuery.hasNextPage && (
                <div className="prof-more">
                  <button
                    type="button"
                    onClick={() => activeQuery.fetchNextPage()}
                    disabled={activeQuery.isFetchingNextPage}
                    className="mv-btn mv-btn-ghost"
                  >
                    {activeQuery.isFetchingNextPage ? t('loading') : t('loadMore')}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
