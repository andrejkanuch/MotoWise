import * as Sentry from '@sentry/nextjs';
import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { compileMDX } from 'next-mdx-remote/rsc';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';
import { AuthorBio } from '@/components/marketing/author-bio';
import { AuthorByline } from '@/components/marketing/author-byline';
import { ContextualAppCta } from '@/components/marketing/contextual-app-cta';
import { JsonLdGraph } from '@/components/marketing/json-ld-graph';
import { TableOfContents } from '@/components/marketing/table-of-contents';
import { Link } from '@/i18n/navigation';
import { getAuthor, getDefaultAuthor } from '@/lib/authors';
import {
  getArticleBySlug,
  getArticleHreflangMap,
  getArticleSlugs,
  getCanonicalArticleUrl,
  getRelatedArticles,
} from '@/lib/blog';
import { extractModel, resolveCtaAngle } from '@/lib/blog-cta';
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

export const revalidate = 604800; // 7 days — repo-sourced, rebuilds on deploy

interface BlogArticlePageProps {
  params: Promise<{ slug: string; locale: string }>;
}

export async function generateStaticParams() {
  return (await getArticleSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: BlogArticlePageProps): Promise<Metadata> {
  const { slug, locale } = await params;
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

const mdxComponents = {
  h2: (props: React.ComponentProps<'h2'>) => (
    <h2 className="mt-12 mb-4 text-2xl font-bold text-neutral-50" {...props} />
  ),
  h3: (props: React.ComponentProps<'h3'>) => (
    <h3 className="mt-8 mb-3 text-xl font-semibold text-neutral-100" {...props} />
  ),
  p: (props: React.ComponentProps<'p'>) => (
    <p className="mb-4 leading-relaxed text-neutral-300" {...props} />
  ),
  a: (props: React.ComponentProps<'a'>) => (
    <a className="text-amber-400 underline hover:text-amber-300" {...props} />
  ),
  ul: (props: React.ComponentProps<'ul'>) => (
    <ul className="mb-4 list-disc space-y-1 pl-6 text-neutral-300" {...props} />
  ),
  ol: (props: React.ComponentProps<'ol'>) => (
    <ol className="mb-4 list-decimal space-y-1 pl-6 text-neutral-300" {...props} />
  ),
  li: (props: React.ComponentProps<'li'>) => <li className="text-neutral-300" {...props} />,
  strong: (props: React.ComponentProps<'strong'>) => (
    <strong className="text-neutral-200" {...props} />
  ),
  table: (props: React.ComponentProps<'table'>) => (
    <div className="mb-6 overflow-x-auto">
      <table className="w-full border-collapse text-sm text-neutral-300" {...props} />
    </div>
  ),
  th: (props: React.ComponentProps<'th'>) => (
    <th
      className="border border-neutral-700 bg-neutral-800 px-4 py-2 text-left font-semibold text-neutral-200"
      {...props}
    />
  ),
  td: (props: React.ComponentProps<'td'>) => (
    <td className="border border-neutral-800 px-4 py-2" {...props} />
  ),
};

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
      <article className="mx-auto max-w-3xl px-6 py-24">
        <nav className="mb-8 flex items-center gap-2 text-sm text-neutral-500">
          <Link href="/" className="hover:text-neutral-300">
            Home
          </Link>
          <span aria-hidden="true">/</span>
          <Link href="/blog" className="hover:text-neutral-300">
            Blog
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-neutral-400 truncate">{article.title}</span>
        </nav>

        <Link
          href="/blog"
          className="mb-6 inline-block text-sm font-medium text-amber-400 transition-colors hover:text-amber-300"
        >
          &larr; {t('backToBlog')}
        </Link>

        <header className="mb-12">
          {article.heroImage && (
            <div className="relative mb-8 aspect-[21/9] overflow-hidden rounded-2xl">
              <Image
                src={article.heroImage}
                alt={article.heroAlt || article.title}
                fill
                className="object-cover"
                priority
                sizes="(max-width: 768px) 100vw, 768px"
              />
            </div>
          )}
          <h1 className="text-3xl font-bold tracking-tight text-neutral-50 sm:text-4xl">
            {article.title}
          </h1>
          <div className="mt-5">
            <AuthorByline author={author} date={article.date} locale={locale} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
            <span>
              {article.readingTime} {t('readingTime')}
            </span>
          </div>
        </header>

        <TableOfContents headings={headings} />

        <div className="prose prose-invert max-w-none">
          {head}
          {tail && (
            <div className="not-prose">
              <ContextualAppCta angle={ctaAngle} model={ctaModel} slug={slug} />
            </div>
          )}
          {tail}
        </div>

        <section
          aria-label="Data disclaimer"
          className="mt-12 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-neutral-900/50 p-5"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mt-0.5 h-5 w-5 shrink-0 text-amber-400"
          >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
          <p className="text-sm leading-relaxed text-amber-200/90">
            {article.specData === true
              ? "The figures in this article are informative only and can vary by model year and market. Always verify every specification against your official owner's and service manual before performing any maintenance."
              : "This article is for general information only. Always confirm details against official manufacturer documentation and your owner's manual before acting on them."}
          </p>
        </section>

        {article.faq && article.faq.length > 0 && (
          <section className="mt-16" aria-labelledby="faq-heading">
            <h2 id="faq-heading" className="mb-6 text-2xl font-bold text-neutral-50">
              Frequently Asked Questions
            </h2>
            <div className="divide-y divide-neutral-800 border-y border-neutral-800">
              {article.faq.map((item) => (
                <details key={item.question} className="group py-4">
                  <summary className="flex cursor-pointer items-center justify-between gap-4 text-base font-semibold text-neutral-100 marker:content-none">
                    {item.question}
                    <span
                      aria-hidden="true"
                      className="text-amber-400 transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-3 leading-relaxed text-neutral-300">{item.answer}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        <div className="mt-16">
          <AuthorBio author={author} />
        </div>

        <div className="mt-16">
          <ContextualAppCta
            angle={ctaAngle}
            model={ctaModel}
            slug={slug}
            placement={CtaPlacement.EndArticle}
          />
        </div>

        {related.length > 0 && (
          <section className="mt-16">
            <h2 className="mb-6 text-xl font-semibold text-neutral-100">Related Articles</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((relatedArticle) => (
                <Link
                  key={relatedArticle.slug}
                  href={`/blog/${relatedArticle.slug}`}
                  className="group rounded-xl border border-neutral-800 bg-neutral-900/50 p-5 transition-colors hover:border-amber-500/30"
                >
                  <h3 className="mb-2 text-sm font-semibold text-neutral-200 group-hover:text-amber-400 line-clamp-2">
                    {relatedArticle.title}
                  </h3>
                  <p className="text-xs text-neutral-500 line-clamp-2">{relatedArticle.excerpt}</p>
                  <span className="mt-3 inline-block text-xs text-amber-400">
                    {relatedArticle.readingTime} min read
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>
    </>
  );
}
