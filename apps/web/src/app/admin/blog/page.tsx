'use client';

import type { AdminBlogPostsQuery } from '@motovault/graphql';
import {
  AdminBlogPostsDocument,
  DeleteBlogPostDocument,
  PublishBlogPostDocument,
  UnpublishBlogPostDocument,
} from '@motovault/graphql';
import { BlogPostStatus } from '@motovault/types';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { ADMIN_BLOG_LIST_KEY, StatusBadge } from '@/components/admin/blog-status';
import { gqlFetcher } from '@/lib/graphql-client';

type Edge = AdminBlogPostsQuery['adminBlogPosts']['edges'][number];

const PAGE_SIZE = 25;

function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-neutral-600 border-t-neutral-200 align-[-2px]"
      aria-hidden="true"
    />
  );
}

/** Pick the en title (else first translation) for the list row label. */
function rowTitle(node: Edge['node']): string {
  const en = node.translations.find((t) => t.locale === 'en') ?? node.translations[0];
  return en?.title ?? node.slug;
}

export default function AdminBlogListPage() {
  const queryClient = useQueryClient();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } =
    useInfiniteQuery({
      queryKey: ADMIN_BLOG_LIST_KEY,
      initialPageParam: null as string | null,
      queryFn: ({ pageParam }) =>
        gqlFetcher(AdminBlogPostsDocument, {
          input: { first: PAGE_SIZE, after: pageParam },
        }),
      getNextPageParam: (last) =>
        last.adminBlogPosts.pageInfo.hasNextPage
          ? last.adminBlogPosts.pageInfo.endCursor
          : undefined,
    });

  const edges = data?.pages.flatMap((p) => p.adminBlogPosts.edges) ?? [];
  const total = data?.pages[0]?.adminBlogPosts.totalCount ?? 0;

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setPendingId(id);
    setRowError((prev) => {
      const { [id]: _drop, ...rest } = prev;
      return rest;
    });
    try {
      await fn();
      await queryClient.invalidateQueries({ queryKey: ADMIN_BLOG_LIST_KEY });
    } catch (err) {
      setRowError((prev) => ({
        ...prev,
        [id]: err instanceof Error ? err.message : 'Action failed',
      }));
    } finally {
      setPendingId((cur) => (cur === id ? null : cur));
    }
  };

  const onDelete = (id: string) => {
    if (!confirm('Delete this post and all its translations? This cannot be undone.')) return;
    void act(id, () => gqlFetcher(DeleteBlogPostDocument, { id }));
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-neutral-50">Blog</h1>
          <p className="mt-2 text-neutral-400">
            {total} {total === 1 ? 'post' : 'posts'} · drafts, scheduled, and published.
          </p>
        </div>
        <Link
          href="/admin/blog/new"
          className="px-4 py-2 rounded-lg bg-neutral-100 text-neutral-900 text-sm font-medium hover:bg-white transition-colors no-underline"
        >
          New post
        </Link>
      </div>

      {isLoading && (
        <div className="mt-10 flex justify-center py-24">
          <Spinner />
        </div>
      )}

      {isError && !isLoading && (
        <div className="mt-10 p-6 border border-red-900 rounded-2xl bg-neutral-900 text-center">
          <p className="text-red-400">Failed to load posts.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 px-4 py-2 rounded-lg bg-neutral-100 text-neutral-900 text-sm font-medium hover:bg-white transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !isError && edges.length === 0 && (
        <div className="mt-10 p-12 border border-neutral-800 rounded-2xl bg-neutral-900 text-center">
          <p className="text-neutral-300 font-medium">No posts yet</p>
          <p className="mt-1 text-sm text-neutral-500">Create your first post to get started.</p>
        </div>
      )}

      {!isLoading && !isError && edges.length > 0 && (
        <div className="mt-8 space-y-2">
          {edges.map(({ node }) => {
            const inFlight = pendingId === node.id;
            const isPublished = node.status === BlogPostStatus.PUBLISHED;
            return (
              <div
                key={node.id}
                className="flex items-center gap-4 p-4 rounded-xl border border-neutral-800 bg-neutral-900"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/admin/blog/${node.id}`}
                      className="text-sm font-semibold text-neutral-50 truncate hover:underline"
                    >
                      {rowTitle(node)}
                    </Link>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400">
                      {node.type}
                    </span>
                    <StatusBadge status={node.status} scheduledFor={node.scheduledFor} />
                  </div>
                  <p className="mt-1 text-xs text-neutral-500 font-mono truncate">
                    {node.slug} · {node.translations.length} locale
                    {node.translations.length === 1 ? '' : 's'}
                  </p>
                  {rowError[node.id] && (
                    <p className="mt-1 text-xs text-red-400">{rowError[node.id]}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isPublished ? (
                    <button
                      type="button"
                      disabled={inFlight}
                      onClick={() =>
                        act(node.id, () => gqlFetcher(UnpublishBlogPostDocument, { id: node.id }))
                      }
                      className="px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-200 text-xs hover:bg-neutral-800 transition-colors disabled:opacity-50"
                    >
                      {inFlight ? <Spinner /> : 'Unpublish'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={inFlight}
                      onClick={() =>
                        act(node.id, () => gqlFetcher(PublishBlogPostDocument, { id: node.id }))
                      }
                      className="px-3 py-1.5 rounded-lg border border-emerald-800 text-emerald-300 text-xs hover:bg-emerald-950/40 transition-colors disabled:opacity-50"
                    >
                      {inFlight ? <Spinner /> : 'Publish'}
                    </button>
                  )}
                  <Link
                    href={`/admin/blog/${node.id}`}
                    className="px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-200 text-xs hover:bg-neutral-800 transition-colors no-underline"
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    disabled={inFlight}
                    onClick={() => onDelete(node.id)}
                    className="px-3 py-1.5 rounded-lg border border-red-900 text-red-300 text-xs hover:bg-red-950/40 transition-colors disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}

          {hasNextPage && (
            <div className="pt-4 flex justify-center">
              <button
                type="button"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="px-4 py-2 rounded-lg border border-neutral-700 text-neutral-200 text-sm hover:bg-neutral-800 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
              >
                {isFetchingNextPage && <Spinner />}
                Load more
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
