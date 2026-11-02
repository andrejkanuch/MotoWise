import Link from 'next/link';
import { relativeTrip } from '@/lib/seo/canonical';

interface TripCardProps {
  country: string;
  region: string;
  slug: string;
  name?: string;
}

/**
 * A trip reference embedded in MDX guides: one hairline row in the prose
 * column (the shared `.mv-row`; the row rules for the reading column live in
 * `trackside-read.css` as `.mv-read-body a.mv-trip-row`). No card, no icon
 * tile. Renders as a static link — no GraphQL calls during MDX compilation.
 *
 * The href must be the canonical three-segment trip path
 * (/trips/{country}/{region}/{slug}). A one-segment /trips/{slug} has no route:
 * it falls through to the trip-by-id page, which 404s any non-UUID segment.
 */
export function TripCard({ country, region, slug, name }: TripCardProps) {
  // ~28 canonical trip slugs carry an 8-hex dedup suffix (`furka-pass-6625deaf`),
  // so strip it before humanizing: without this the `name`-less fallback renders
  // "Furka Pass 6625Deaf". Every current card passes an explicit `name`; this
  // keeps the fallback usable for the next one that does not.
  const displayName =
    name ||
    slug
      .replace(/-[0-9a-f]{8}$/, '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <Link href={relativeTrip(country, region, slug)} className="mv-row mv-trip-row">
      <span>
        <span className="mv-row-title">{displayName}</span>
        <span className="mv-row-sub">Open the trip: route, waypoints and days</span>
      </span>
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
  );
}
