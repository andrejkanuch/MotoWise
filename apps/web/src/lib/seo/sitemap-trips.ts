import type { SitemapPublishedTripsQuery } from '@motovault/graphql';
import { canonicalCountry, canonicalRegion, canonicalTrip } from './canonical';

export type PublishedTrip = SitemapPublishedTripsQuery['sitemapPublishedTrips'][number];

export interface SitemapEntry {
  url: string;
  lastModified: Date;
}

/** `/trips/{country}/{region}/{slug}` detail-page entries (lowercased to match canonical). */
export function tripDetailEntries(trips: PublishedTrip[], now: Date): SitemapEntry[] {
  return trips.map((t) => ({
    url: canonicalTrip(
      t.countryCode.toLowerCase(),
      t.regionCode.toLowerCase(),
      t.slug.toLowerCase(),
    ),
    lastModified: t.updatedAt ? new Date(t.updatedAt) : now,
  }));
}

/**
 * `/explore/{country}` and `/explore/{country}/{region}` discovery entries,
 * deduped, derived from the same published-trips list.
 */
export function exploreDiscoveryEntries(trips: PublishedTrip[], now: Date): SitemapEntry[] {
  const countrySet = new Set<string>();
  const regionSet = new Set<string>();
  for (const t of trips) {
    countrySet.add(t.countryCode.toLowerCase());
    regionSet.add(`${t.countryCode.toLowerCase()}/${t.regionCode.toLowerCase()}`);
  }
  const countries = [...countrySet].map((cc) => ({ url: canonicalCountry(cc), lastModified: now }));
  const regions = [...regionSet].map((key) => {
    const [cc, rs] = key.split('/');
    return { url: canonicalRegion(cc, rs), lastModified: now };
  });
  return [...countries, ...regions];
}
