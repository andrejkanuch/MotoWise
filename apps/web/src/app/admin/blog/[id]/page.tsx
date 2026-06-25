'use client';

import { AdminBlogPostDocument } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { use } from 'react';
import { BlogEditor } from '@/components/admin/blog-editor';
import { gqlFetcher } from '@/lib/graphql-client';

export default function EditBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'blog-post', id],
    queryFn: () => gqlFetcher(AdminBlogPostDocument, { id }),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-neutral-600 border-t-neutral-200" />
      </div>
    );
  }

  if (isError || !data?.adminBlogPost) {
    return (
      <div className="max-w-2xl">
        <p className="text-red-400">Post not found or failed to load.</p>
        <Link href="/admin/blog" className="mt-3 inline-block text-sm text-neutral-300 underline">
          Back to posts
        </Link>
      </div>
    );
  }

  return <BlogEditor post={data.adminBlogPost} />;
}
