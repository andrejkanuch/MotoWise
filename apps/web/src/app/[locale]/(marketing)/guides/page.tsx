import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { JsonLdGraph } from '@/components/marketing/json-ld-graph';
import { Link } from '@/i18n/navigation';
import { getCanonicalUrl } from '@/lib/constants';
import { getGuides } from '@/lib/guides';
import { buildBreadcrumbList, buildGraph, buildWebPage } from '@/lib/seo/schema';

export const revalidate = 604800; // 7 days — repo-sourced, rebuilds on deploy

interface GuidesPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: GuidesPageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);

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
    alternates: {
      canonical: getCanonicalUrl(locale, '/guides'),
    },
    openGraph: {
      title: 'Motorcycle Guides — Routes, Tips & Riding Advice',
      description:
        'In-depth motorcycle guides covering the best routes in Europe, South America, and the Alps.',
      type: 'website',
      url: getCanonicalUrl(locale, '/guides'),
    },
  };
}

export default async function GuidesPage({ params }: GuidesPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const guides = getGuides();

  const graph = buildGraph(
    buildWebPage({
      url: getCanonicalUrl(locale, '/guides'),
      name: 'Motorcycle Guides',
      description:
        'In-depth motorcycle guides covering the best routes in Europe, South America, and the Alps.',
      locale,
      pageKey: '/guides',
    }),
    buildBreadcrumbList(
      [
        { name: 'Home', url: getCanonicalUrl(locale) },
        { name: 'Guides', url: getCanonicalUrl(locale, '/guides') },
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
          <h1 className="text-4xl font-bold tracking-tight text-neutral-50 sm:text-5xl">
            Motorcycle Guides
          </h1>
          <p className="mt-4 text-lg text-neutral-400">
            In-depth guides for planning your next motorcycle adventure — routes, seasons, gear, and
            local tips.
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {guides.map((guide) => (
            <Link
              key={guide.slug}
              href={`/guides/${guide.slug}`}
              className="group rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 transition-colors hover:border-neutral-700 hover:bg-neutral-900/80"
            >
              <div className="mb-3 flex items-center gap-3 text-sm text-neutral-500">
                <time dateTime={guide.frontmatter.date}>
                  {new Date(guide.frontmatter.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </time>
              </div>
              <h2 className="mb-3 text-xl font-semibold text-neutral-100 transition-colors group-hover:text-white">
                {guide.frontmatter.title}
              </h2>
              <p className="mb-4 text-sm leading-relaxed text-neutral-400">
                {guide.frontmatter.description}
              </p>
              <span className="text-sm font-medium text-amber-400 transition-colors group-hover:text-amber-300">
                Read guide &rarr;
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
