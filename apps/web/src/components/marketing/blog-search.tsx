'use client';

import { BlogPostType } from '@motovault/types';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Link } from '@/i18n/navigation';
import type { BlogListItem } from '@/lib/blog';
import { applyBlogFilters } from '@/lib/blog-filters';

type Category = { slug: string; name: string };
type SearchStatus = 'idle' | 'loading' | 'error';

const TYPE_OPTIONS = Object.values(BlogPostType);

/** Chip labels are cased in the source string, never by CSS (Rule 5). */
const TYPE_LABEL: Record<BlogPostType, string> = {
  [BlogPostType.GUIDE]: 'Guide',
  [BlogPostType.MAINTENANCE]: 'Maintenance',
  [BlogPostType.TRIP]: 'Trip',
  [BlogPostType.GEAR]: 'Gear',
};

function typeLabel(value: string): string {
  return TYPE_LABEL[value as BlogPostType] ?? value;
}

/** Reading-time strings arrive as "7 min" / "7"; keep the figure condensed. */
function splitReadingTime(value: string): { figure: string; rest: string } {
  const match = /^(\d+)\s*(.*)$/.exec(value.trim());
  return match ? { figure: match[1], rest: match[2] } : { figure: value, rest: '' };
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Reader search + filters (plan U8). The list-only article shape (no body, no
 * FAQ, no author — see `BlogListItem`) is passed in from the statically-generated
 * page; type/category/keyword filtering runs client-side over it, while free-text
 * search hits the FTS RPC via `/api/blog/search`.
 * Search state lives in the URL (`?q/type/category/keyword`) so results are
 * shareable; the unfiltered view renders the full editorial feed (the static base).
 */
export function BlogSearch({
  articles,
  categories,
  locale,
  strings,
}: {
  articles: BlogListItem[];
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
    <div>
      <form onSubmit={submitQuery} className="mv-search">
        <input
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search articles"
          aria-label="Search articles"
          className="mv-field-input"
        />
        <button type="submit" className="mv-btn mv-btn-primary">
          Search
        </button>
      </form>

      <div className="mv-chips">
        {TYPE_OPTIONS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => toggleParam('type', t)}
            aria-pressed={type === t}
            className="mv-chip"
          >
            {TYPE_LABEL[t]}
          </button>
        ))}
        {categories.map((c) => (
          <button
            key={c.slug}
            type="button"
            onClick={() => toggleParam('category', c.slug)}
            aria-pressed={category === c.slug}
            className="mv-chip"
          >
            {c.name}
          </button>
        ))}
      </div>

      {isActive && (
        <div className="mv-active-filters mv-enter-down">
          <span>Showing</span>
          {q && <FilterChip label={`“${q}”`} onRemove={() => setParams((p) => p.delete('q'))} />}
          {type && (
            <FilterChip
              label={typeLabel(type)}
              onRemove={() => setParams((p) => p.delete('type'))}
            />
          )}
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
          <button type="button" onClick={clearAll} className="mv-link is-quiet">
            Clear all filters
          </button>
        </div>
      )}

      {status === 'error' ? (
        <p className="mv-empty mv-enter-down" role="status">
          Search didn't load. Pick a category above, or try the search again in a moment.
        </p>
      ) : searchPending ? (
        <RowSkeletons />
      ) : showResults && results.length === 0 ? (
        <div className="mv-empty mv-enter-down" role="status">
          <p style={{ margin: 0 }}>No articles match{q ? ` “${q}”` : ' these filters'}.</p>
          <button
            type="button"
            onClick={clearAll}
            className="mv-link is-quiet"
            style={{ marginTop: 8 }}
          >
            Clear the search
          </button>
        </div>
      ) : (
        showResults && (
          <div className="mv-enter-down">
            <ArticleFeed articles={results} strings={strings} featured={false} />
          </div>
        )
      )}

      {/* The unfiltered base feed — present in the static HTML, hidden once a
          filter/search is active (so crawlers always get the full listing). */}
      {!isActive && <ArticleFeed articles={articles} strings={strings} featured />}
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="mv-chip" data-active="true">
      <span className="mv-chip-label" title={label}>
        {label}
      </span>
      <button type="button" onClick={onRemove} aria-label={`Remove ${label} filter`}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </span>
  );
}

function RowSkeletons() {
  return (
    <div className="mv-skeleton-rows" role="status" aria-label="Searching articles">
      <div />
      <div />
      <div />
    </div>
  );
}

/**
 * Editorial feed: hairline rows with the date and reading time in the margin.
 * The first item of the unfiltered feed is featured — larger title, hero image
 * when the article has one — so the page has a front, not a grid.
 */
function ArticleFeed({
  articles,
  strings,
  featured,
}: {
  articles: BlogListItem[];
  strings: { readingTime: string; readMore: string };
  featured: boolean;
}) {
  return (
    <ol className="mv-feed">
      {articles.map((article, index) => {
        const isFeatured = featured && index === 0;
        const reading = splitReadingTime(article.readingTime);
        return (
          <li key={article.slug} className={`mv-feed-item${isFeatured ? ' is-featured' : ''}`}>
            <Link href={`/blog/${article.slug}`}>
              {isFeatured && article.heroImage && (
                <div className="mv-feed-hero">
                  <Image
                    src={article.heroImage}
                    alt={article.heroAlt || ''}
                    fill
                    sizes="(max-width: 920px) 100vw, 920px"
                    className="object-cover"
                    priority
                  />
                </div>
              )}
              <div className="mv-feed-meta">
                <time dateTime={article.date}>{formatDate(article.date)}</time>
                <span>
                  <span className="mv-figure">{reading.figure}</span>{' '}
                  {reading.rest ? `${reading.rest} ` : ''}
                  {strings.readingTime}
                </span>
              </div>
              <div>
                {/* The whole row is the link, so the title is the link text; the
                    featured "read" line is decoration for sighted readers only. */}
                <h2 className={isFeatured ? 'mv-h2' : 'mv-feed-title'}>{article.title}</h2>
                <p className="mv-feed-excerpt">{article.excerpt}</p>
                {isFeatured && (
                  <span className="mv-feed-more" aria-hidden="true">
                    {strings.readMore}
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </span>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
