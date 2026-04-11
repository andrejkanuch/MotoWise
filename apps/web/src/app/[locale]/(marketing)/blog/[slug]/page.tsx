import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { compileMDX } from 'next-mdx-remote/rsc';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';
import { AuthorBio } from '@/components/marketing/author-bio';
import { AuthorByline } from '@/components/marketing/author-byline';
import { JsonLd } from '@/components/marketing/json-ld';
import { TableOfContents } from '@/components/marketing/table-of-contents';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { getAuthor, getDefaultAuthor } from '@/lib/authors';
import { getArticleBySlug, getArticleSlugs, getArticleUrl, getRelatedArticles } from '@/lib/blog';
import { BASE_URL, getCanonicalUrl } from '@/lib/constants';
import type { TocHeading } from '@/lib/rehype-extract-headings';
import { rehypeExtractHeadings } from '@/lib/rehype-extract-headings';

interface BlogArticlePageProps {
  params: Promise<{ slug: string; locale: string }>;
}

export async function generateStaticParams() {
  return getArticleSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: BlogArticlePageProps): Promise<Metadata> {
  const { slug, locale } = await params;
  setRequestLocale(locale);
  const article = getArticleBySlug(slug, locale);

  if (!article) {
    return { title: 'Article Not Found' };
  }

  const ogImage = article.heroImage || '/og-image.png';

  return {
    title: article.title,
    description: article.excerpt,
    keywords: article.keywords,
    authors: [{ name: article.author }],
    alternates: {
      canonical: getArticleUrl(slug, locale),
      languages: Object.fromEntries([
        ...routing.locales.map((l) => [l, getArticleUrl(slug, l)]),
        ['x-default', getArticleUrl(slug, 'en')],
      ]),
    },
    openGraph: {
      title: article.title,
      description: article.excerpt,
      type: 'article',
      publishedTime: article.date,
      authors: [article.author],
      url: getArticleUrl(slug, locale),
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

const CATEGORY_LABELS: Record<string, string> = {
  diy: 'DIY Tutorials',
  maintenance: 'Maintenance',
  troubleshooting: 'Troubleshooting',
  'brand-specific': 'Brand-Specific Guides',
  'cost-analysis': 'Cost Analysis',
  safety: 'Safety',
};

export default async function BlogArticlePage({ params }: BlogArticlePageProps) {
  const { slug, locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Blog');
  const article = getArticleBySlug(slug, locale);

  if (!article) {
    notFound();
  }

  const headings: TocHeading[] = [];

  const { content } = await compileMDX({
    source: article.content,
    options: {
      mdxOptions: {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [rehypeSlug, rehypeExtractHeadings(headings)],
      },
    },
    components: mdxComponents,
  });

  const related = getRelatedArticles(slug, article.category, locale);
  const author = getAuthor(article.author) ?? getDefaultAuthor();

  const wordCount = article.wordCount || article.content.split(/\s+/).length;
  const articleUrl = getArticleUrl(slug, locale);

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: article.title,
    description: article.excerpt,
    datePublished: article.date,
    dateModified: article.dateModified || article.date,
    image: article.heroImage ? `${BASE_URL}${article.heroImage}` : `${BASE_URL}/og-image.png`,
    author: {
      '@type': 'Person',
      name: 'Andrej Kanuch',
      url: `${BASE_URL}/about`,
      jobTitle: 'Founder & Developer',
      worksFor: {
        '@type': 'Organization',
        name: 'MotoVault',
        url: BASE_URL,
      },
    },
    publisher: {
      '@type': 'Organization',
      '@id': `${BASE_URL}/#organization`,
      name: 'MotoVault',
      url: BASE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${BASE_URL}/icon.png`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': articleUrl,
    },
    keywords: article.keywords.join(', '),
    wordCount,
    articleSection: article.category
      ? CATEGORY_LABELS[article.category] || article.category
      : undefined,
    inLanguage: locale,
    isAccessibleForFree: true,
    timeRequired: `PT${article.readingTime}M`,
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: getCanonicalUrl(locale),
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Blog',
        item: getCanonicalUrl(locale, '/blog'),
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: article.title,
        item: articleUrl,
      },
    ],
  };

  return (
    <>
      <JsonLd data={articleSchema} />
      <JsonLd data={breadcrumbSchema} />
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

        <div className="prose prose-invert max-w-none">{content}</div>

        <div className="mt-16">
          <AuthorBio author={author} />
        </div>

        <div className="mt-16 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8 text-center">
          <h2 className="mb-3 text-xl font-semibold text-neutral-100">
            Ready to take control of your motorcycle maintenance?
          </h2>
          <p className="mb-6 text-neutral-400">
            MotoVault combines AI diagnostics, structured learning, and garage management in one
            app.
          </p>
          <Link
            href="/"
            className="inline-block rounded-full bg-amber-500 px-8 py-3 text-sm font-semibold text-neutral-950 transition-colors hover:bg-amber-400"
          >
            Download Free
          </Link>
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
