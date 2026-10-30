import * as Sentry from '@sentry/nextjs';
import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { compileMDX } from 'next-mdx-remote/rsc';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';
import { AuthorBio } from '@/components/marketing/author-bio';
import { AuthorByline } from '@/components/marketing/author-byline';
import { Breadcrumb } from '@/components/marketing/breadcrumb';
import { ContextualAppCta } from '@/components/marketing/contextual-app-cta';
import { JsonLdGraph } from '@/components/marketing/json-ld-graph';
import { TableOfContents } from '@/components/marketing/table-of-contents';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { getAuthor, getDefaultAuthor } from '@/lib/authors';
import {
  getArticleBySlug,
  getArticleHreflangMap,
  getArticleSlugs,
  getCanonicalArticleUrl,
  getRelatedArticles,
} from '@/lib/blog';
import { extractMakeModel, extractModel, resolveCtaAngle } from '@/lib/blog-cta';
import { stripHtmlComments } from '@/lib/blog-mdx';
import { BASE_URL, getCanonicalUrl } from '@/lib/constants';
import { CtaPlacement } from '@/lib/cta-taxonomy';
import type { TocHeading } from '@/lib/rehype-extract-headings';
import { rehypeExtractHeadings } from '@/lib/rehype-extract-headings';
import {
  buildArticle,
  buildBreadcrumbList,
  buildFAQPage,
  buildGraph,
  buildWebPage,
} from '@/lib/seo/schema';
import '@/components/marketing/trackside-read.css';

// An unknown slug was rendering `not-found` at HTTP 200 (a soft-404 Google
// indexes as a real page). This route was never instrumented with
// reportSoftNotFound, so unlike the trip/explore routes it never showed up in
// Sentry at all — found by probing /blog/<nonexistent> directly. The cause was
// `app/loading.tsx` streaming a shell above the page; that file is gone, so
// `notFound()` here is a real 404 and no `dynamicParams = false` is needed.
//
// Removing it also fixes a live freshness bug: articles are DB-sourced
// (lib/supabase-blog.ts), not repo-sourced as an earlier comment here claimed, and
// a daily job publishes new ones. With `dynamicParams = false` every article
// published after a deploy 404'd until the next unrelated merge. generateStaticParams
// stays — it prerenders the known set at build time and unknown slugs now render
// on demand.
export const revalidate = 604800; // 7 days; invalidated on demand via /api/revalidate

interface BlogArticlePageProps {
  params: Promise<{ slug: string; locale: string }>;
}

export async function generateStaticParams() {
  return (await getArticleSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: BlogArticlePageProps): Promise<Metadata> {
  const { slug, locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    return { title: 'Article Not Found', robots: { index: false, follow: false } };
  }
  setRequestLocale(locale);
  const article = await getArticleBySlug(slug, locale);

  if (!article) {
    return { title: 'Article Not Found' };
  }

  const ogImage = article.heroImage || '/og-image.png';
  // Self-canonical only when a real translation exists; fallback locales
  // (English content under /ja, /pl, /pt-BR, or any untranslated slug) point at
  // the English URL so Google doesn't treat them as duplicate pages.
  const canonicalUrl = await getCanonicalArticleUrl(slug, locale);

  return {
    title: article.title,
    description: article.excerpt,
    keywords: article.keywords,
    authors: [{ name: article.author }],
    alternates: {
      canonical: canonicalUrl,
      languages: await getArticleHreflangMap(slug),
    },
    openGraph: {
      title: article.title,
      description: article.excerpt,
      type: 'article',
      publishedTime: article.date,
      authors: [article.author],
      url: canonicalUrl,
      images: [{ url: ogImage, width: 1200, height: 630, alt: article.heroAlt || article.title }],
    },
  };
}

// The reading column is styled once in trackside-read.css (`.mv-read-body`):
// condensed h2/h3, 17px body at 1.6, hairline tables, mono only for code.
// MDX elements render as plain HTML; tables get a scroll wrapper so a wide
// spec table never breaks the 60ch measure on a phone.
const mdxComponents = {
  table: (props: React.ComponentProps<'table'>) => (
    <div className="mv-read-table">
      <table {...props} />
    </div>
  ),
};

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

/** Inject the mid-article CTA after this many top-level H2 sections. */
const MID_CTA_AFTER_H2 = 2;
const H2_DELIMITER = '\n## ';

/**
 * Split an MDX body just before the (n+1)-th H2 so a CTA can be rendered between
 * the two halves. Returns null when there aren't enough H2s to place the CTA
 * comfortably mid-article (it must leave at least one section after it), so the
 * caller renders the body in one piece. Only top-level `## ` headings count —
 * the delimiter includes the leading newline, so `### ` and inline `##` are
 * unaffected.
 */
function splitAfterNthH2(source: string, n: number): { head: string; tail: string } | null {
  const parts = source.split(H2_DELIMITER);
  // parts[0] is the pre-heading intro; each later part is one H2 section.
  if (parts.length < n + 2) return null;
  return {
    head: parts.slice(0, n + 1).join(H2_DELIMITER),
    tail: H2_DELIMITER + parts.slice(n + 1).join(H2_DELIMITER),
  };
}

export default async function BlogArticlePage({ params }: BlogArticlePageProps) {
  const { slug, locale } = await params;
  // The `[locale]` segment is untrusted. `src/proxy.ts` skips any path with a
  // dot in it, so /motovault.app/blog/<slug> reaches this route with
  // locale === 'motovault.app' and used to 500 on Intl (MOTOVAULT-WEB-16).
  // `[locale]/layout.tsx` also notFound()s an unknown locale, but Next renders
  // layouts and pages concurrently, so the layout's throw does not stop this
  // render — the page has to guard for itself. next-intl's own docs make this
  // explicit: validate the locale BEFORE handing it to setRequestLocale, in
  // every layout AND page.
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  const t = await getTranslations('Blog');
  const article = await getArticleBySlug(slug, locale);

  if (!article) {
    notFound();
  }

  const headings: TocHeading[] = [];

  // Generated article bodies occasionally carry raw HTML comments, which are
  // invalid MDX and would kill the whole page (Sentry MOTOVAULT-WEB-S).
  const mdxSource = stripHtmlComments(article.content);

  const compile = (source: string) =>
    compileMDX({
      source,
      options: {
        mdxOptions: {
          remarkPlugins: [remarkGfm],
          rehypePlugins: [rehypeSlug, rehypeExtractHeadings(headings)],
        },
      },
      components: mdxComponents,
    });

  // Intent-matched CTA injected mid-article (after the 2nd H2, once the reader
  // has some context) — the conversion driver. We split the source and compile
  // head/tail so the CTA lands as real SSR DOM between them; short articles with
  // too few H2s fall back to a single render (the end-of-article CTA still runs).
  const ctaAngle = resolveCtaAngle(article);
  const ctaModel = extractModel(article.title);
  const ctaMakeModel = extractMakeModel(article.title);
  const split = splitAfterNthH2(mdxSource, MID_CTA_AFTER_H2);

  // A single article with malformed MDX must not 500 the route. Compile defensively:
  // report the failure with enough context to fix the source, then render a clean
  // 404 rather than the generic error boundary. (Sentry MOTOVAULT-WEB-S)
  let head: Awaited<ReturnType<typeof compileMDX>>['content'];
  let tail: Awaited<ReturnType<typeof compileMDX>>['content'] | null = null;
  try {
    if (split) {
      head = (await compile(split.head)).content;
      tail = (await compile(split.tail)).content;
    } else {
      head = (await compile(mdxSource)).content;
    }
  } catch {
    // The split may have landed inside a code fence / MDX expression, making one
    // half invalid on its own. Fall back to rendering the whole body in one
    // piece before giving up — a mid-article CTA is never worth 404-ing a good
    // article. Reset headings so the retry doesn't duplicate the TOC.
    tail = null;
    headings.length = 0;
    try {
      head = (await compile(mdxSource)).content;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { area: 'blog', op: 'compileMDX' },
        extra: { slug, locale, contentPreview: article.content.slice(0, 500) },
      });
      notFound();
    }
  }

  const related = await getRelatedArticles(slug, article.category, locale);
  const author = getAuthor(article.author) ?? getDefaultAuthor();
  const readingTime = splitReadingTime(article.readingTime);

  // Use the canonical URL (English for fallback locales) so the JSON-LD graph
  // self-identifies as the same URL as <link rel="canonical">, rather than the
  // locale-prefixed duplicate.
  const articleUrl = await getCanonicalArticleUrl(slug, locale);
  const heroImageUrl = article.heroImage
    ? `${BASE_URL}${article.heroImage}`
    : `${BASE_URL}/og-image.png`;

  const graph = buildGraph(
    buildWebPage({
      url: articleUrl,
      name: article.title,
      description: article.excerpt,
      locale,
      pageKey: `/blog/${slug}`,
      image: heroImageUrl,
    }),
    buildBreadcrumbList(
      [
        { name: 'Home', url: getCanonicalUrl(locale) },
        { name: 'Blog', url: getCanonicalUrl(locale, '/blog') },
        { name: article.title, url: articleUrl },
      ],
      locale,
      `/blog/${slug}`,
    ),
    buildArticle({
      url: articleUrl,
      headline: article.title,
      description: article.excerpt,
      image: heroImageUrl,
      datePublished: article.date,
      dateModified: article.dateModified ?? article.date,
      authorName: author.name,
      authorUrl: `${BASE_URL}/about`,
      authorJobTitle: author.role,
      authorBio: author.bio,
      authorKnowsAbout: author.credentials,
      // Verified profiles only — empty until real handles are added to the registry.
      authorSameAs: author.socials
        ? Object.values(author.socials).filter((url): url is string => Boolean(url))
        : undefined,
      locale,
      slug,
      wordCount: article.wordCount,
    }),
    article.faq && article.faq.length > 0
      ? buildFAQPage(article.faq, `${locale}/blog/${slug}/faq`)
      : null,
  );

  return (
    <>
      <JsonLdGraph nodes={graph} />
      <article className="mv-read">
        <Breadcrumb
          items={[
            { label: 'Home', href: '/' },
            { label: 'Blog', href: '/blog' },
            { label: article.title },
          ]}
        />

        <header>
          <h1 className="mv-read-h1">{article.title}</h1>
          <p className="mv-read-lede">{article.excerpt}</p>
          <AuthorByline author={author} date={article.date} />
          <div className="mv-read-meta">
            <span>
              <span className="mv-figure">{readingTime.figure}</span>
              {readingTime.rest ? ` ${readingTime.rest}` : ''} {t('readingTime')}
            </span>
            {article.dateModified && article.dateModified !== article.date && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  Updated{' '}
                  <time dateTime={article.dateModified}>{formatDate(article.dateModified)}</time>
                </span>
              </>
            )}
          </div>
          {article.heroImage && (
            <div className="mv-read-hero">
              <Image
                src={article.heroImage}
                alt={article.heroAlt || article.title}
                fill
                className="object-cover"
                priority
                sizes="(max-width: 768px) 100vw, 760px"
              />
            </div>
          )}
        </header>

        <TableOfContents headings={headings} />

        {/* One app CTA per post: mid-article after the second H2 when the body
            splits, otherwise once after the body (short posts, or a split that
            landed inside a code fence). */}
        <div className="mv-read-body">
          {head}
          {tail && (
            <ContextualAppCta
              angle={ctaAngle}
              model={ctaModel}
              makeModel={ctaMakeModel}
              slug={slug}
            />
          )}
          {tail}
        </div>
        {!tail && (
          <ContextualAppCta
            angle={ctaAngle}
            model={ctaModel}
            makeModel={ctaMakeModel}
            slug={slug}
            placement={CtaPlacement.EndArticle}
          />
        )}

        <section aria-label="Data disclaimer" className="mv-read-note">
          <p>
            {article.specData === true
              ? "The figures in this article are informative only and can vary by model year and market. Always verify every specification against your official owner's and service manual before performing any maintenance."
              : "This article is for general information only. Always confirm details against official manufacturer documentation and your owner's manual before acting on them."}
          </p>
        </section>

        {article.faq && article.faq.length > 0 && (
          <section className="mv-read-section" aria-labelledby="faq-heading">
            <h2 id="faq-heading" className="mv-read-h2">
              Questions riders ask
            </h2>
            <div className="mv-read-faq">
              {article.faq.map((item) => (
                <details key={item.question} className="mv-disclosure is-plus">
                  <summary>
                    {item.question}
                    <svg
                      className="mv-disclosure-mark"
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
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </summary>
                  <p className="mv-read-faq-answer">{item.answer}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        <AuthorBio author={author} />

        {related.length > 0 && (
          <section className="mv-read-section" aria-labelledby="related-heading">
            <h2 id="related-heading" className="mv-read-label">
              {t('relatedArticles')}
            </h2>
            <ul className="mv-rows">
              {related.map((relatedArticle) => {
                const reading = splitReadingTime(relatedArticle.readingTime);
                return (
                  <li key={relatedArticle.slug}>
                    <Link href={`/blog/${relatedArticle.slug}`} className="mv-row">
                      <span>
                        <span className="mv-row-title">{relatedArticle.title}</span>
                        <span className="mv-row-sub">{relatedArticle.excerpt}</span>
                      </span>
                      <span className="mv-row-aside">
                        <span className="mv-figure">{reading.figure}</span>
                        {reading.rest ? ` ${reading.rest}` : ''} {t('readingTime')}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </article>
    </>
  );
}
