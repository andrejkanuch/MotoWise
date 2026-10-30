import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { BlogSearch } from '@/components/marketing/blog-search';
import { JsonLd } from '@/components/marketing/json-ld';
import { routing } from '@/i18n/routing';
import { getArticles, getBlogCategories } from '@/lib/blog';
import { BASE_URL, getCanonicalUrl } from '@/lib/constants';
import '@/components/marketing/trackside-read.css';

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
      <section className="mv-index">
        <header>
          <h1 className="mv-index-h1">{t('title')}</h1>
          <p className="mv-index-lede">{t('description')}</p>
        </header>

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
