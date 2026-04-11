import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { JsonLdGraph } from '@/components/marketing/json-ld-graph';
import { Link } from '@/i18n/navigation';
import {
  BIKE_FIXTURES,
  type BikePageData,
  findBikePage,
  PAGE_TYPES,
  type PageType,
} from '@/lib/bikes/bike-data';
import { scoreBikePage } from '@/lib/bikes/quality-gate';
import { BASE_URL, getCanonicalUrl } from '@/lib/constants';
import { buildBreadcrumbList, buildFAQPage, buildGraph, buildWebPage } from '@/lib/seo/schema';

export const dynamic = 'force-static';
export const dynamicParams = false;
export const revalidate = 3600;

interface PageProps {
  params: Promise<{
    locale: string;
    make: string;
    model: string;
    year: string;
    pageType: string;
  }>;
}

export async function generateStaticParams() {
  // English only for MVP — next-intl merges [locale] automatically.
  return BIKE_FIXTURES.map((page) => ({
    make: page.makeSlug,
    model: page.modelSlug,
    year: String(page.year),
    pageType: page.pageType,
  }));
}

function pageTypeLabel(pageType: PageType): string {
  switch (pageType) {
    case 'overview':
      return 'Overview';
    case 'maintenance-schedule':
      return 'Maintenance Schedule';
    case 'common-problems':
      return 'Common Problems';
    case 'cost-of-ownership':
      return 'Cost of Ownership';
    case 'service-intervals':
      return 'Service Intervals';
  }
}

function pageUrl(page: BikePageData): string {
  return `/bikes/${page.makeSlug}/${page.modelSlug}/${page.year}/${page.pageType}`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const p = await params;
  setRequestLocale(p.locale);
  if (!(PAGE_TYPES as readonly string[]).includes(p.pageType)) return {};
  const page = findBikePage(p);
  if (!page) return {};

  const gate = scoreBikePage(page, BIKE_FIXTURES);
  const canonical = getCanonicalUrl(p.locale, pageUrl(page));

  return {
    // Fixture titles already include "| MotoVault". Use `absolute` to bypass the
    // root layout's "%s | MotoVault" template and avoid double-suffixing.
    title: { absolute: page.title },
    description: page.description,
    alternates: {
      canonical,
      // Bike pages are English-only for MVP.
      languages: { 'x-default': `${BASE_URL}${pageUrl(page)}` },
    },
    robots: gate.passes
      ? { index: true, follow: true }
      : { index: false, follow: true, googleBot: { index: false, follow: true } },
  };
}

export default async function BikeLeafPage({ params }: PageProps) {
  const p = await params;
  setRequestLocale(p.locale);
  if (!(PAGE_TYPES as readonly string[]).includes(p.pageType)) notFound();
  const page = findBikePage(p);
  if (!page) notFound();

  const canonical = getCanonicalUrl(p.locale, pageUrl(page));
  const pageKey = pageUrl(page);

  const graph = buildGraph(
    buildWebPage({
      url: canonical,
      name: page.title,
      description: page.description,
      locale: p.locale,
      pageKey,
    }),
    buildBreadcrumbList(
      [
        { name: 'Home', url: getCanonicalUrl(p.locale) },
        { name: 'Bikes', url: getCanonicalUrl(p.locale, '/bikes') },
        {
          name: `${page.year} ${page.make} ${page.model}`,
          url: getCanonicalUrl(
            p.locale,
            `/bikes/${page.makeSlug}/${page.modelSlug}/${page.year}/overview`,
          ),
        },
        { name: pageTypeLabel(page.pageType), url: canonical },
      ],
      p.locale,
      pageKey,
    ),
    page.faqItems.length ? buildFAQPage(page.faqItems, `${p.locale}${pageKey}/faq`) : null,
  );

  return (
    <>
      <JsonLdGraph nodes={graph} />

      <nav aria-label="Breadcrumb" className="px-6 pt-20 md:pt-24">
        <ol className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 text-sm text-neutral-500">
          <li>
            <Link href="/" className="transition-colors hover:text-neutral-300">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/bikes" className="transition-colors hover:text-neutral-300">
              Bikes
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              href={`/bikes/${page.makeSlug}/${page.modelSlug}/${page.year}/overview`}
              className="transition-colors hover:text-neutral-300"
            >
              {page.year} {page.make} {page.model}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <span className="text-neutral-300" aria-current="page">
              {pageTypeLabel(page.pageType)}
            </span>
          </li>
        </ol>
      </nav>

      <section className="px-6 pb-10 pt-8 md:pt-12">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
            {page.year} {page.make} {page.model}
          </p>
          <h1 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl lg:text-5xl">
            {page.h1}
          </h1>
        </div>
      </section>

      <section className="px-6 py-10">
        <div className="mx-auto max-w-3xl space-y-6 text-neutral-300 leading-relaxed">
          {page.bodyParagraphs.map((paragraph, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static fixture ordering is stable
            <p key={i}>{paragraph}</p>
          ))}
        </div>
      </section>

      <section className="px-6 py-10">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-4 text-2xl font-semibold tracking-tight text-neutral-50">
            Key specifications
          </h2>
          <div className="overflow-hidden rounded-xl border border-neutral-800/60">
            <table className="w-full">
              <tbody>
                {page.specs.map((spec) => (
                  <tr
                    key={spec.label}
                    className="border-b border-neutral-800/40 last:border-b-0 odd:bg-neutral-900/30"
                  >
                    <th
                      scope="row"
                      className="px-4 py-3 text-left text-sm font-medium text-neutral-400 sm:px-6"
                    >
                      {spec.label}
                    </th>
                    <td className="px-4 py-3 text-sm text-neutral-200 sm:px-6">{spec.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {page.telemetry && page.telemetry.length > 0 && (
        <section className="px-6 py-10">
          <div className="mx-auto max-w-3xl rounded-xl border border-warm-500/30 bg-warm-500/5 p-6 md:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-warm-400">
              From MotoVault owners
            </p>
            <ul className="mt-4 space-y-3">
              {page.telemetry.map((item) => (
                <li key={item.label} className="text-sm text-neutral-300">
                  <span className="font-semibold text-neutral-100">{item.label}:</span> {item.value}{' '}
                  <span className="text-xs text-neutral-500">({item.source})</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="px-6 py-10">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-6 text-2xl font-semibold tracking-tight text-neutral-50">
            Frequently asked questions
          </h2>
          <div className="space-y-4">
            {page.faqItems.map((item) => (
              <div
                key={item.question}
                className="rounded-xl border border-neutral-800/60 bg-neutral-900/50 p-6"
              >
                <h3 className="font-semibold text-neutral-100">{item.question}</h3>
                <p className="mt-3 text-sm text-neutral-400 leading-relaxed">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-10">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-4 text-lg font-semibold text-neutral-200">
            More on the {page.year} {page.make} {page.model}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {PAGE_TYPES.filter((pt) => pt !== page.pageType).map((pt) => (
              <li key={pt}>
                <Link
                  href={`/bikes/${page.makeSlug}/${page.modelSlug}/${page.year}/${pt}`}
                  className="block rounded-lg border border-neutral-800/60 bg-neutral-950/60 px-4 py-3 text-sm text-neutral-300 transition-colors hover:border-warm-500/40 hover:text-neutral-100"
                >
                  {pageTypeLabel(pt)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
