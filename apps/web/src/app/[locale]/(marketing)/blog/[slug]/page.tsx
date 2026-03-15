import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { getArticleBySlug, getArticleSlugs, getArticleUrl } from '@/lib/blog';
import { BASE_URL } from '@/lib/constants';

interface BlogArticlePageProps {
  params: Promise<{ slug: string; locale: string }>;
}

export async function generateStaticParams() {
  return getArticleSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: BlogArticlePageProps): Promise<Metadata> {
  const { slug, locale } = await params;
  const article = getArticleBySlug(slug);

  if (!article) {
    return { title: 'Article Not Found' };
  }

  return {
    title: article.title,
    description: article.excerpt,
    keywords: article.keywords,
    authors: [{ name: article.author }],
    alternates: {
      canonical: getArticleUrl(slug, 'en'),
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
    },
  };
}

function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data requires dangerouslySetInnerHTML
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  );
}

export default async function BlogArticlePage({ params }: BlogArticlePageProps) {
  const { slug } = await params;
  const t = await getTranslations('Blog');
  const article = getArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: article.title,
    description: article.excerpt,
    datePublished: article.date,
    author: {
      '@type': 'Organization',
      name: article.author,
      url: BASE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: 'MotoVault',
      url: BASE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${BASE_URL}/icon.png`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': getArticleUrl(slug, 'en'),
    },
    keywords: article.keywords.join(', '),
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: BASE_URL,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Blog',
        item: `${BASE_URL}/blog`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: article.title,
        item: getArticleUrl(slug, 'en'),
      },
    ],
  };

  return (
    <>
      <JsonLd data={articleSchema} />
      <JsonLd data={breadcrumbSchema} />
      <article className="mx-auto max-w-3xl px-6 py-24">
        <nav className="mb-8">
          <Link
            href="/blog"
            className="text-sm font-medium text-amber-400 transition-colors hover:text-amber-300"
          >
            &larr; {t('backToBlog')}
          </Link>
        </nav>

        <header className="mb-12">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-50 sm:text-4xl">
            {article.title}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-neutral-500">
            <span>
              {t('by')} {article.author}
            </span>
            <span aria-hidden="true">&middot;</span>
            <time dateTime={article.date}>
              {t('publishedOn')}{' '}
              {new Date(article.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
            <span aria-hidden="true">&middot;</span>
            <span>
              {article.readingTime} {t('readingTime')}
            </span>
          </div>
        </header>

        <div
          className="prose prose-invert max-w-none prose-headings:text-neutral-50 prose-p:text-neutral-300 prose-p:leading-relaxed prose-a:text-amber-400 hover:prose-a:text-amber-300 prose-strong:text-neutral-200 prose-li:text-neutral-300 prose-code:rounded-lg prose-code:bg-neutral-900 prose-code:px-2 prose-code:py-1"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Article HTML content is authored internally and sanitized
          dangerouslySetInnerHTML={{ __html: article.content }}
        />

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
            Get Early Access
          </Link>
        </div>
      </article>
    </>
  );
}
