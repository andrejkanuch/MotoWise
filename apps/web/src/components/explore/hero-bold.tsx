import Image from 'next/image';
import { Suspense } from 'react';
import { ExploreSearchBar } from '@/components/explore-search-bar';
import { Figure } from './primitives';
import { formatNumber } from './utils';

const HERO_PHOTO = '/images/hero-explore.jpg';

interface HeroBoldProps {
  totalRoutes: number;
  totalCountries: number;
  countries: Array<{ code: string; label: string }>;
}

/**
 * Explore hero: a condensed headline, the real route and country counts as
 * figures, and the search field. The photograph carries the emotion; the
 * one authored motion is the headline settling in once.
 */
export function HeroBold({ totalRoutes, totalCountries, countries }: HeroBoldProps) {
  const hasCounts = totalRoutes > 0 && totalCountries > 0;

  return (
    <div className="xp-hero-bleed">
      <section className="xp-wrap xp-hero">
        <div className="xp-hero-copy">
          <h1 className="mv-section-title xp-h1 xp-rise">Routes worth the detour</h1>
          <p className="xp-lede xp-rise xp-rise-2">
            Motorcycle routes mapped by riders, each with its distance, climb and riding time.
            Search a place, or pick a country from the list below.
          </p>

          {hasCounts && (
            <div className="xp-figures xp-hero-figures xp-rise xp-rise-2">
              <Figure value={formatNumber(totalRoutes)} label="routes" size="xl" />
              <Figure value={formatNumber(totalCountries)} label="countries" size="xl" />
            </div>
          )}

          <div className="xp-hero-search">
            <Suspense>
              <ExploreSearchBar countries={countries} />
            </Suspense>
          </div>
        </div>

        <div className="xp-hero-photo">
          <Image
            src={HERO_PHOTO}
            alt="A rider leaning through a guard-railed bend on a mountain pass at dusk"
            fill
            priority
            // ≤1024 the 16:9 box spans the viewport. Above, the bleed column is
            // cover-scaled by its height (≈ 700 × 1.79 ≈ 1250 CSS px of image),
            // so ask for the source's own 1376px width: nothing larger exists.
            sizes="(max-width: 1024px) 100vw, 1376px"
          />
        </div>
      </section>
    </div>
  );
}
