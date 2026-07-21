import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { DownloadAppButton } from '@/components/download-app-button';
import { JsonLdGraph } from '@/components/marketing/json-ld-graph';
import { TableOfContents } from '@/components/marketing/table-of-contents';
import { Link } from '@/i18n/navigation';
import { BASE_URL, getEnglishOnlyAlternates } from '@/lib/constants';
import { CtaPageType } from '@/lib/cta-taxonomy';
import { compileGuide, getGuideBySlug, getGuideSlugs } from '@/lib/guides';
import { buildArticle, buildBreadcrumbList, buildGraph, buildWebPage } from '@/lib/seo/schema';

export const revalidate = 604800; // 7 days — repo-sourced, rebuilds on deploy

interface GuidePageProps {
  params: Promise<{ slug: string; locale: string }>;
}

export async function generateStaticParams() {
  return getGuideSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: GuidePageProps): Promise<Metadata> {
  const { slug, locale } = await params;
  setRequestLocale(locale);
  const guide = getGuideBySlug(slug);

  if (!guide) {
    return { title: 'Guide Not Found' };
  }

  const { frontmatter } = guide;
  // Guides are authored in English only and served identically under every
  // locale prefix, so they canonicalize to the unprefixed English URL with
  // x-default only (this override discards the marketing layout's inherited
  // all-locale languages map). See getEnglishOnlyAlternates.
  const alternates = getEnglishOnlyAlternates(`/guides/${slug}`);
  const guideUrl = alternates.canonical;
  const ogImage = frontmatter.heroImage || '/og-image.png';

  return {
    title: frontmatter.title,
    description: frontmatter.description,
    keywords: frontmatter.keywords,
    authors: [{ name: frontmatter.author }],
    alternates,
    openGraph: {
      title: frontmatter.title,
      description: frontmatter.description,
      type: 'article',
      publishedTime: frontmatter.date,
      authors: [frontmatter.author],
      url: guideUrl,
      images: [{ url: ogImage, width: 1200, height: 630, alt: frontmatter.title }],
    },
  };
}

export default async function GuidePage({ params }: GuidePageProps) {
  const { slug, locale } = await params;
  setRequestLocale(locale);

  const compiled = await compileGuide(slug);
  if (!compiled) {
    notFound();
  }

  const { frontmatter, content, headings } = compiled;
  // Match the canonical set in generateMetadata: guides are English-only, so
  // JSON-LD/schema URLs point to the unprefixed English URL under every locale.
  const guideUrl = getEnglishOnlyAlternates(`/guides/${slug}`).canonical;
  const heroImageUrl = frontmatter.heroImage
    ? `${BASE_URL}${frontmatter.heroImage}`
    : `${BASE_URL}/og-image.png`;

  const graph = buildGraph(
    buildWebPage({
      url: guideUrl,
      name: frontmatter.title,
      description: frontmatter.description,
      locale,
      pageKey: `/guides/${slug}`,
      image: heroImageUrl,
    }),
    buildBreadcrumbList(
      [
        // English-only guides: breadcrumb URLs match the EN canonical (see guideUrl).
        { name: 'Home', url: BASE_URL },
        { name: 'Guides', url: getEnglishOnlyAlternates('/guides').canonical },
        { name: frontmatter.title, url: guideUrl },
      ],
      locale,
      `/guides/${slug}`,
    ),
    buildArticle({
      url: guideUrl,
      headline: frontmatter.title,
      description: frontmatter.description,
      image: heroImageUrl,
      datePublished: frontmatter.date,
      dateModified: frontmatter.date,
      authorName: frontmatter.author,
      authorUrl: `${BASE_URL}/about`,
      locale,
      slug,
    }),
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
          <Link href="/guides" className="hover:text-neutral-300">
            Guides
          </Link>
          <span aria-hidden="true">/</span>
          <span className="truncate text-neutral-400">{frontmatter.title}</span>
        </nav>

        <Link
          href="/guides"
          className="mb-6 inline-block text-sm font-medium text-amber-400 transition-colors hover:text-amber-300"
        >
          &larr; All Guides
        </Link>

        <header className="mb-12">
          {frontmatter.heroImage && (
            <div className="relative mb-8 aspect-[21/9] overflow-hidden rounded-2xl">
              <Image
                src={frontmatter.heroImage}
                alt={frontmatter.title}
                fill
                className="object-cover"
                priority
                sizes="(max-width: 768px) 100vw, 768px"
              />
            </div>
          )}
          <h1 className="text-3xl font-bold tracking-tight text-neutral-50 sm:text-4xl">
            {frontmatter.title}
          </h1>
          <div className="mt-4 flex items-center gap-3 text-sm text-neutral-500">
            <span>{frontmatter.author}</span>
            <span aria-hidden="true">&middot;</span>
            <time dateTime={frontmatter.date}>
              {new Date(frontmatter.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
          </div>
        </header>

        <TableOfContents headings={headings} />

        <div className="prose prose-invert max-w-none">{content}</div>

        <div className="mt-16 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8 text-center">
          <h2 className="mb-3 text-xl font-semibold text-neutral-100">
            Plan your next motorcycle trip with MotoVault
          </h2>
          <p className="mb-6 text-neutral-400">
            Discover curated routes, track your rides, and plan multi-day trips with waypoints, GPX
            export, and community reviews.
          </p>
          <DownloadAppButton pageType={CtaPageType.Guide} slug={slug} />
        </div>
      </article>
    </>
  );
}
