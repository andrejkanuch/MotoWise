'use client';

import { BlogPostType } from '@motovault/types';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Link } from '@/i18n/navigation';
import type { Article } from '@/lib/blog';
import { applyBlogFilters } from '@/lib/blog-filters';

type Category = { slug: string; name: string };
type SearchStatus = 'idle' | 'loading' | 'error';

const TYPE_OPTIONS = Object.values(BlogPostType);

/**
 * Reader search + filters (plan U8). The full article list is passed in from the
 * statically-generated page; type/category/keyword filtering runs client-side
 * over it, while free-text search hits the FTS RPC via `/api/blog/search`.
 * Search state lives in the URL (`?q/type/category/keyword`) so results are
 * shareable; the unfiltered view renders the full grid (the static base).
 */
export function BlogSearch({
  articles,
  categories,
  locale,
  strings,
}: {
  articles: Article[];
  categories: Category[];
  locale: string;
  strings: { readingTime: string; readMore: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const q = searchParams.get('q')?.trim() ?? '';
  const type = searchParams.get('type') ?? '';
  const category = searchParams.get('category') ?? '';
  const keyword = searchParams.get('keyword') ?? '';

  const [input, setInput] = useState(q);
  const [searchSlugs, setSearchSlugs] = useState<string[] | null>(null);
  const [status, setStatus] = useState<SearchStatus>('idle');

  // Keep the input in sync if the URL changes externally (back/forward, shared link).
  useEffect(() => {
    setInput(q);
  }, [q]);

  // Run the FTS RPC (server route) whenever the committed query changes.
  useEffect(() => {
    if (!q) {
      setSearchSlugs(null);
      setStatus('idle');
      return;
    }
    const ctrl = new AbortController();
    setStatus('loading');
    fetch(`/api/blog/search?q=${encodeURIComponent(q)}&locale=${encodeURIComponent(locale)}`, {
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('search failed'))))
      .then((data: { slugs: string[] }) => {
        setSearchSlugs(data.slugs);
        setStatus('idle');
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setStatus('error');
      });
    return () => ctrl.abort();
  }, [q, locale]);

  const setParams = (mutate: (p: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const toggleParam = (key: string, value: string) =>
    setParams((p) => {
      if (p.get(key) === value) p.delete(key);
      else p.set(key, value);
    });

  const submitQuery = (e: React.FormEvent) => {
    e.preventDefault();
    setParams((p) => {
      const next = input.trim();
      if (next) p.set('q', next);
      else p.delete('q');
    });
  };

  const clearAll = () => router.push(pathname, { scroll: false });

  const isActive = Boolean(q || type || category || keyword);

  const results = useMemo(
    () =>
      applyBlogFilters(articles, {
        searchSlugs: q ? searchSlugs : null,
        type,
        category,
        keyword,
      }),
    [articles, q, searchSlugs, type, category, keyword],
  );

  const categoryName = (slug: string) => categories.find((c) => c.slug === slug)?.name ?? slug;
  const showResults = isActive;
  const searchPending = Boolean(q) && status === 'loading';

  return (
    <div className="mb-12">
      {/* Search bar */}
      <form onSubmit={submitQuery} className="flex gap-2">
        <input
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search articles…"
          aria-label="Search articles"
          className="flex-1 rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3 text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-600 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-neutral-950 transition-colors hover:bg-amber-400"
        >
          Search
        </button>
      </form>

      {/* Browse facets */}
      <div className="mt-4 flex flex-wrap gap-2">
        {TYPE_OPTIONS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => toggleParam('type', t)}
            className={`rounded-full border px-3 py-1 text-sm capitalize transition-colors ${
              type === t
                ? 'border-amber-500 bg-amber-500/15 text-amber-300'
                : 'border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
            }`}
          >
            {t}
          </button>
        ))}
        {categories.map((c) => (
          <button
            key={c.slug}
            type="button"
            onClick={() => toggleParam('category', c.slug)}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${
              category === c.slug
                ? 'border-amber-500 bg-amber-500/15 text-amber-300'
                : 'border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Active filters */}
      {isActive && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-neutral-500">Filters:</span>
          {q && <FilterChip label={`“${q}”`} onRemove={() => setParams((p) => p.delete('q'))} />}
          {type && <FilterChip label={type} onRemove={() => setParams((p) => p.delete('type'))} />}
          {category && (
            <FilterChip
              label={categoryName(category)}
              onRemove={() => setParams((p) => p.delete('category'))}
            />
          )}
          {keyword && (
            <FilterChip
              label={`#${keyword}`}
              onRemove={() => setParams((p) => p.delete('keyword'))}
            />
          )}
          <button
            type="button"
            onClick={clearAll}
            className="ml-1 text-amber-400 underline-offset-2 hover:underline"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Results / states */}
      <div className="mt-10">
        {status === 'error' ? (
          <p className="text-neutral-400">
            Search is temporarily unavailable — browse by category above instead.
          </p>
        ) : searchPending ? (
          <CardSkeletons />
        ) : showResults && results.length === 0 ? (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-10 text-center">
            <p className="text-neutral-300">No posts found{q ? ` for “${q}”` : ''}.</p>
            <button
              type="button"
              onClick={clearAll}
              className="mt-3 text-sm font-medium text-amber-400 hover:text-amber-300"
            >
              Clear search
            </button>
          </div>
        ) : (
          showResults && <ArticleGrid articles={results} strings={strings} />
        )}
      </div>

      {/* The unfiltered base grid — present in the static HTML, hidden once a
          filter/search is active (so crawlers always get the full listing). */}
      {!isActive && <ArticleGrid articles={articles} strings={strings} />}
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-800 px-3 py-1 text-neutral-200">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label} filter`}
        className="text-neutral-400 hover:text-neutral-100"
      >
        ✕
      </button>
    </span>
  );
}

function CardSkeletons() {
  return (
    <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-44 animate-pulse rounded-2xl border border-neutral-800 bg-neutral-900/50"
        />
      ))}
    </div>
  );
}

function ArticleGrid({
  articles,
  strings,
}: {
  articles: Article[];
  strings: { readingTime: string; readMore: string };
}) {
  return (
    <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
      {articles.map((article) => (
        <Link
          key={article.slug}
          href={`/blog/${article.slug}`}
          className="group rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 transition-colors hover:border-neutral-700 hover:bg-neutral-900/80"
        >
          <div className="mb-3 flex items-center gap-3 text-sm text-neutral-500">
            <time dateTime={article.date}>
              {new Date(article.date).toLocaleDateString('en-US', {
                timeZone: 'UTC',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
            <span aria-hidden="true">&middot;</span>
            <span>
              {article.readingTime} {strings.readingTime}
            </span>
          </div>
          <h2 className="mb-3 text-xl font-semibold text-neutral-100 transition-colors group-hover:text-white">
            {article.title}
          </h2>
          <p className="mb-4 text-sm leading-relaxed text-neutral-400">{article.excerpt}</p>
          <span className="text-sm font-medium text-amber-400 transition-colors group-hover:text-amber-300">
            {strings.readMore} &rarr;
          </span>
        </Link>
      ))}
    </div>
  );
}
