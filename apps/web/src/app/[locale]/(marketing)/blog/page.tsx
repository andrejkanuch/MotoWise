import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { getArticles } from '@/lib/blog';
import { BASE_URL } from '@/lib/constants';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Blog');
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: `${BASE_URL}/blog`,
      languages: Object.fromEntries([
        ...routing.locales.map((l) => [
          l,
          l === 'en' ? `${BASE_URL}/blog` : `${BASE_URL}/${l}/blog`,
        ]),
        ['x-default', `${BASE_URL}/blog`],
      ]),
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

export default async function BlogPage() {
  const t = await getTranslations('Blog');
  const articles = getArticles('en');

  const blogSchema = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: t('title'),
    description: t('description'),
    url: `${BASE_URL}/blog`,
    publisher: {
      '@type': 'Organization',
      name: 'MotoVault',
      url: BASE_URL,
      logo: `${BASE_URL}/icon.png`,
    },
    blogPost: articles.map((article) => ({
      '@type': 'BlogPosting',
      headline: article.title,
      description: article.excerpt,
      datePublished: article.date,
      author: {
        '@type': 'Organization',
        name: article.author,
      },
      url: `${BASE_URL}/blog/${article.slug}`,
    })),
  };

  return (
    <>
      <JsonLd data={blogSchema} />
      <section className="mx-auto max-w-5xl px-6 py-24">
        <div className="mb-16 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-neutral-50 sm:text-5xl">
            {t('title')}
          </h1>
          <p className="mt-4 text-lg text-neutral-400">{t('description')}</p>
        </div>

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
              <h2 className="mb-3 text-xl font-semibold text-neutral-100 transition-colors group-hover:text-white">
                {article.title}
              </h2>
              <p className="mb-4 text-sm leading-relaxed text-neutral-400">{article.excerpt}</p>
              <span className="text-sm font-medium text-amber-400 transition-colors group-hover:text-amber-300">
                {t('readMore')} &rarr;
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
