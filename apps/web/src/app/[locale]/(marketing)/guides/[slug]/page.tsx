import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Breadcrumb } from '@/components/marketing/breadcrumb';
import { ContextualAppCta } from '@/components/marketing/contextual-app-cta';
import { JsonLdGraph } from '@/components/marketing/json-ld-graph';
import { TableOfContents } from '@/components/marketing/table-of-contents';
import { CtaAngle } from '@/lib/blog-cta';
import { BASE_URL, getEnglishOnlyAlternates } from '@/lib/constants';
import { CtaPageType, CtaPlacement } from '@/lib/cta-taxonomy';
import { compileGuide, getGuideBySlug, getGuideSlugs } from '@/lib/guides';
import { buildArticle, buildBreadcrumbList, buildGraph, buildWebPage } from '@/lib/seo/schema';
import '@/components/marketing/trackside-read.css';

export const revalidate = 604800; // 7 days — repo-sourced, rebuilds on deploy

interface GuidePageProps {
  params: Promise<{ slug: string; locale: string }>;
}

// No `dynamicParams = false`: an unknown guide is a real 404 because there is no
// longer a Suspense boundary above the page (`app/loading.tsx` deleted — that was
// the actual cause of the 200 soft-404s, same class as the blog route). Guides are
// repo-sourced, so generateStaticParams below still enumerates every real one at
// build time; dropping the flag just means unknown slugs 404 from the page rather
// than from the router, uniformly with the trip and explore families.
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

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default async function GuidePage({ params }: GuidePageProps) {
  const { slug, locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Blog');

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
      <article className="mv-read">
        <Breadcrumb
          items={[
            { label: 'Home', href: '/' },
            { label: 'Guides', href: '/guides' },
            { label: frontmatter.title },
          ]}
        />

        <header>
          <h1 className="mv-read-h1">{frontmatter.title}</h1>
          <p className="mv-read-lede">{frontmatter.description}</p>
          <div className="mv-read-meta">
            <span>{frontmatter.author}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={frontmatter.date}>{formatDate(frontmatter.date)}</time>
          </div>
          {frontmatter.heroImage && (
            <div className="mv-read-hero">
              <Image
                src={frontmatter.heroImage}
                alt={frontmatter.title}
                fill
                className="object-cover"
                priority
                sizes="(max-width: 768px) 100vw, 760px"
              />
            </div>
          )}
        </header>

        <TableOfContents headings={headings} />

        <div className="mv-read-body">{content}</div>

        <div className="mv-read-section">
          <ContextualAppCta
            angle={CtaAngle.Guide}
            model={null}
            slug={slug}
            placement={CtaPlacement.EndArticle}
            pageType={CtaPageType.Guide}
            headline={t('ctaTripHeadline')}
          />
        </div>
      </article>
    </>
  );
}
