import Link from 'next/link';
import { relativeTrip } from '@/lib/seo/canonical';

interface TripCardProps {
  country: string;
  region: string;
  slug: string;
  name?: string;
}

/**
 * A styled link card for embedding trip references in MDX guides.
 * Renders as a static link — no GraphQL calls during MDX compilation.
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
    <Link
      href={relativeTrip(country, region, slug)}
      className="my-4 flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 transition-colors hover:border-amber-500/40 hover:bg-neutral-900/80"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-lg">
        {'\u{1F3CD}'}
      </span>
      <div className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-neutral-100">{displayName}</span>
        <span className="block text-xs text-neutral-500">View trip details on MotoVault</span>
      </div>
      <span className="shrink-0 text-sm text-amber-400">&rarr;</span>
    </Link>
  );
}
