import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { BASE_URL } from './constants';

export interface Article {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  author: string;
  date: string;
  readingTime: string;
  keywords: string[];
  locale: string;
  heroImage?: string;
  heroAlt?: string;
  category?: string;
}

const CONTENT_DIR = path.join(process.cwd(), 'content/blog');
const ALLOWED_LOCALES = ['en', 'es', 'de', 'fr', 'it'] as const;

const articlesCache = new Map<string, { articles: Article[]; timestamp: number }>();
const CACHE_TTL = process.env.NODE_ENV === 'production' ? 300_000 : 5_000;

function readArticlesFromDisk(locale: string): Article[] {
  if (!ALLOWED_LOCALES.includes(locale as (typeof ALLOWED_LOCALES)[number])) return [];
  const localeDir = path.join(CONTENT_DIR, locale);
  if (!fs.existsSync(localeDir)) return [];

  const files = fs.readdirSync(localeDir).filter((f) => f.endsWith('.mdx'));
  return files
    .map((file) => {
      const source = fs.readFileSync(path.join(localeDir, file), 'utf-8');
      const { data, content } = matter(source);
      return {
        slug: data.slug || file.replace('.mdx', ''),
        title: data.title || '',
        excerpt: data.excerpt || '',
        content,
        author: data.author || 'MotoVault Team',
        date: data.date || '',
        readingTime: data.readingTime || '5',
        keywords: data.keywords || [],
        locale: data.locale || locale,
        heroImage: data.heroImage,
        heroAlt: data.heroAlt,
        category: data.category,
      } satisfies Article;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getArticles(locale: string = 'en'): Article[] {
  const cached = articlesCache.get(locale);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.articles;

  let articles = readArticlesFromDisk(locale);
  if (articles.length === 0 && locale !== 'en') {
    articles = readArticlesFromDisk('en');
  }

  articlesCache.set(locale, { articles, timestamp: Date.now() });
  return articles;
}

export function getArticleBySlug(slug: string, locale: string = 'en'): Article | undefined {
  return getArticles(locale).find((a) => a.slug === slug);
}

export function getArticleSlugs(locale: string = 'en'): string[] {
  return getArticles(locale).map((a) => a.slug);
}

export function getArticleUrl(slug: string, locale: string): string {
  const prefix = locale === 'en' ? '' : `/${locale}`;
  return `${BASE_URL}${prefix}/blog/${slug}`;
}

export function getRelatedArticles(
  currentSlug: string,
  category: string | undefined,
  locale: string = 'en',
  limit: number = 3,
): Article[] {
  const articles = getArticles(locale);
  if (!category) return articles.filter((a) => a.slug !== currentSlug).slice(0, limit);
  const sameCategory = articles.filter((a) => a.slug !== currentSlug && a.category === category);
  const others = articles.filter((a) => a.slug !== currentSlug && a.category !== category);
  return [...sameCategory, ...others].slice(0, limit);
}
