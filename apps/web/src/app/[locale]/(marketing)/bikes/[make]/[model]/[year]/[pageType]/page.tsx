import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Breadcrumb } from '@/components/marketing/breadcrumb';
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
import '@/components/marketing/trackside-read.css';

export const dynamic = 'force-static';
export const dynamicParams = false;
export const revalidate = 604800; // 7 days — repo-sourced, rebuilds on deploy

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

const PAGE_TYPE_LABEL: Record<PageType, string> = {
  overview: 'Overview',
  'maintenance-schedule': 'Maintenance schedule',
  'common-problems': 'Common problems',
  'cost-of-ownership': 'Cost of ownership',
  'service-intervals': 'Service intervals',
};

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
  const bikeName = `${page.year} ${page.make} ${page.model}`;
  const overviewHref = `/bikes/${page.makeSlug}/${page.modelSlug}/${page.year}/overview`;

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
          name: bikeName,
          url: getCanonicalUrl(p.locale, overviewHref),
        },
        { name: PAGE_TYPE_LABEL[page.pageType], url: canonical },
      ],
      p.locale,
      pageKey,
    ),
    page.faqItems.length ? buildFAQPage(page.faqItems, `${p.locale}${pageKey}/faq`) : null,
  );

  return (
    <>
      <JsonLdGraph nodes={graph} />

      <article className="mv-read">
        <Breadcrumb
          items={[
            { label: 'Home', href: '/' },
            { label: 'Bikes', href: '/bikes' },
            { label: bikeName, href: overviewHref },
            { label: PAGE_TYPE_LABEL[page.pageType] },
          ]}
        />

        <header className="mv-reveal">
          <h1 className="mv-read-h1">{page.h1}</h1>
          <p className="mv-read-lede">{page.description}</p>
        </header>

        <div className="mv-read-body" style={{ marginTop: 40 }}>
          {page.bodyParagraphs.map((paragraph, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static fixture ordering is stable
            <p key={i}>{paragraph}</p>
          ))}
        </div>

        <section className="mv-read-section" aria-labelledby="specs-heading">
          <h2 id="specs-heading" className="mv-read-h2">
            Key specifications
          </h2>
          <dl className="mv-defs">
            {page.specs.map((spec) => (
              <div key={spec.label}>
                <dt>{spec.label}</dt>
                <dd>{spec.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {page.telemetry && page.telemetry.length > 0 && (
          <section className="mv-read-section" aria-labelledby="telemetry-heading">
            <h2 id="telemetry-heading" className="mv-read-h2">
              From MotoVault owners
            </h2>
            <dl className="mv-defs">
              {page.telemetry.map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>
                    {item.value}
                    <span className="mv-rows-sub">{item.source}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {page.faqItems.length > 0 && (
          <section className="mv-read-section" aria-labelledby="faq-heading">
            <h2 id="faq-heading" className="mv-read-h2">
              Questions owners ask
            </h2>
            <div className="mv-read-body">
              {page.faqItems.map((item) => (
                <div key={item.question}>
                  <h3 style={{ fontSize: 22 }}>{item.question}</h3>
                  <p>{item.answer}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mv-read-section" aria-labelledby="more-heading">
          <h2 id="more-heading" className="mv-read-label">
            More on the {bikeName}
          </h2>
          <ul className="mv-rows">
            {PAGE_TYPES.filter((pt) => pt !== page.pageType).map((pt) => (
              <li key={pt}>
                <Link href={`/bikes/${page.makeSlug}/${page.modelSlug}/${page.year}/${pt}`}>
                  {PAGE_TYPE_LABEL[pt]}
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
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </article>
    </>
  );
}
