import type { Metadata } from 'next';
import Image from 'next/image';
import { setRequestLocale } from 'next-intl/server';
import { JsonLdGraph } from '@/components/marketing/json-ld-graph';
import { Link } from '@/i18n/navigation';
import { BASE_URL, getEnglishOnlyAlternates } from '@/lib/constants';
import { getGuides } from '@/lib/guides';
import { buildBreadcrumbList, buildGraph, buildWebPage } from '@/lib/seo/schema';
import '@/components/marketing/trackside-read.css';

export const revalidate = 604800; // 7 days — repo-sourced, rebuilds on deploy

interface GuidesPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: GuidesPageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);

  // Guides are English-only; every locale prefix serves identical content, so
  // canonical points to the unprefixed English URL (with x-default only) to
  // avoid duplicate-without-canonical in Search Console. See [slug]/page.tsx.
  const alternates = getEnglishOnlyAlternates('/guides');

  return {
    title: 'Motorcycle Guides — Routes, Tips & Riding Advice',
    description:
      'In-depth motorcycle guides covering the best routes in Europe, South America, and the Alps. Trip planning, gear advice, and riding tips from the MotoVault team.',
    keywords: [
      'motorcycle guides',
      'motorcycle routes',
      'motorcycle trip planning',
      'riding guides',
      'motorcycle touring',
    ],
    alternates,
    openGraph: {
      title: 'Motorcycle Guides — Routes, Tips & Riding Advice',
      description:
        'In-depth motorcycle guides covering the best routes in Europe, South America, and the Alps.',
      type: 'website',
      url: alternates.canonical,
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

export default async function GuidesPage({ params }: GuidesPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const guides = getGuides();

  // Guides are English-only, so JSON-LD/breadcrumb URLs use the unprefixed
  // English canonical to stay aligned with the page's <link rel=canonical>
  // (mixed locale-prefixed schema URLs feed the "Google chose different
  // canonical" bucket in Search Console).
  const canonical = getEnglishOnlyAlternates('/guides').canonical;

  const graph = buildGraph(
    buildWebPage({
      url: canonical,
      name: 'Motorcycle Guides',
      description:
        'In-depth motorcycle guides covering the best routes in Europe, South America, and the Alps.',
      locale,
      pageKey: '/guides',
    }),
    buildBreadcrumbList(
      [
        { name: 'Home', url: BASE_URL },
        { name: 'Guides', url: canonical },
      ],
      locale,
      '/guides',
    ),
  );

  return (
    <>
      <JsonLdGraph nodes={graph} />
      <section className="mv-index">
        <header className="mv-reveal">
          <h1 className="mv-index-h1">Motorcycle guides</h1>
          <p className="mv-index-lede">
            Routes, seasons, gear and local knowledge for the next trip, with the roads named and
            the trips linked.
          </p>
        </header>

        <ol className="mv-feed">
          {guides.map((guide, index) => {
            const isFeatured = index === 0;
            return (
              <li key={guide.slug} className={`mv-feed-item${isFeatured ? ' is-featured' : ''}`}>
                <Link href={`/guides/${guide.slug}`}>
                  {isFeatured && guide.frontmatter.heroImage && (
                    <div className="mv-feed-hero">
                      <Image
                        src={guide.frontmatter.heroImage}
                        alt=""
                        fill
                        sizes="(max-width: 920px) 100vw, 920px"
                        className="object-cover"
                        priority
                      />
                    </div>
                  )}
                  <div className="mv-feed-meta">
                    <time dateTime={guide.frontmatter.date}>
                      {formatDate(guide.frontmatter.date)}
                    </time>
                    <span>{guide.frontmatter.author}</span>
                  </div>
                  <div>
                    <h2 className="mv-feed-title">{guide.frontmatter.title}</h2>
                    <p className="mv-feed-excerpt">{guide.frontmatter.description}</p>
                    {isFeatured && (
                      <span className="mv-feed-more">
                        Read the guide
                        <svg
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
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}
