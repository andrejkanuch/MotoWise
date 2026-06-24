import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { BlogSearch } from '@/components/marketing/blog-search';
import { JsonLd } from '@/components/marketing/json-ld';
import { routing } from '@/i18n/routing';
import { getArticles, getBlogCategories } from '@/lib/blog';
import { BASE_URL, getCanonicalUrl } from '@/lib/constants';

interface BlogPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: BlogPageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Blog');
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: getCanonicalUrl(locale, '/blog'),
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

export default async function BlogPage({ params }: BlogPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Blog');
  const [articles, categories] = await Promise.all([getArticles(locale), getBlogCategories()]);

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
        '@type': 'Person',
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

        <Suspense fallback={null}>
          <BlogSearch
            articles={articles}
            categories={categories}
            locale={locale}
            strings={{ readingTime: t('readingTime'), readMore: t('readMore') }}
          />
        </Suspense>
      </section>
    </>
  );
}
