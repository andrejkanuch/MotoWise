import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { JsonLdGraph } from '@/components/marketing/json-ld-graph';
import { Link } from '@/i18n/navigation';
import { BASE_URL, getEnglishOnlyAlternates } from '@/lib/constants';
import { getGuides } from '@/lib/guides';
import { buildBreadcrumbList, buildGraph, buildWebPage } from '@/lib/seo/schema';

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
      <section className="mx-auto max-w-5xl px-6 py-24">
        <div className="mb-16 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-(--mv-ink) sm:text-5xl">
            Motorcycle Guides
          </h1>
          <p className="mt-4 text-lg text-(--mv-ink-2)">
            In-depth guides for planning your next motorcycle adventure — routes, seasons, gear, and
            local tips.
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {guides.map((guide) => (
            <Link
              key={guide.slug}
              href={`/guides/${guide.slug}`}
              className="group rounded-2xl border border-(--mv-line) bg-(--mv-surface) p-6 transition-colors hover:border-(--mv-line-step) hover:bg-(--mv-surface-2)"
            >
              <div className="mb-3 flex items-center gap-3 text-sm text-(--mv-ink-3)">
                <time dateTime={guide.frontmatter.date}>
                  {new Date(guide.frontmatter.date).toLocaleDateString('en-US', {
                    timeZone: 'UTC',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </time>
              </div>
              <h2 className="mb-3 text-xl font-semibold text-(--mv-ink)">
                {guide.frontmatter.title}
              </h2>
              <p className="mb-4 text-sm leading-relaxed text-(--mv-ink-2)">
                {guide.frontmatter.description}
              </p>
              <span className="text-sm font-medium text-(--mv-copper-text) transition-colors group-hover:text-(--mv-copper-hover)">
                Read guide &rarr;
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
