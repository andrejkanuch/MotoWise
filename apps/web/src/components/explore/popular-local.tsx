'use client';

import { useEffect, useState } from 'react';
import { PopularStrip, type PopularTrip, WORLD } from './popular-strip';

/** Set by the edge (proxy) when it knows the visitor's country; read first. */
const COUNTRY_COOKIE = 'mv_country';

/** A bare language tag (no region) → the country it most likely means. */
const LANG_TO_COUNTRY: Record<string, string> = {
  sk: 'SK',
  cs: 'CZ',
  de: 'DE',
  fr: 'FR',
  it: 'IT',
  es: 'ES',
  pt: 'PT',
  nl: 'NL',
  pl: 'PL',
  ro: 'RO',
  hr: 'HR',
  el: 'GR',
  no: 'NO',
  nb: 'NO',
  sv: 'SE',
  da: 'DK',
  fi: 'FI',
  hu: 'HU',
  bg: 'BG',
  sl: 'SI',
  et: 'EE',
  lv: 'LV',
  lt: 'LT',
  ga: 'IE',
  en: 'US',
  ja: 'JP',
  ko: 'KR',
  tr: 'TR',
};

function readCountryCookie(): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COUNTRY_COOKIE}=([A-Za-z]{2})`));
  return match?.[1].toUpperCase();
}

/** Region subtags first ("de-AT" → AT), then the bare language map. */
function countryFromLanguages(languages: readonly string[]): string | undefined {
  for (const tag of languages) {
    const region = tag.match(/^[a-z]{2,3}-([A-Za-z]{2})\b/)?.[1];
    if (region) return region.toUpperCase();
  }
  for (const tag of languages) {
    const mapped = LANG_TO_COUNTRY[tag.slice(0, 2).toLowerCase()];
    if (mapped) return mapped;
  }
  return undefined;
}

interface PopularLocalProps {
  /** The world strip: what the static page renders and what crawlers see. */
  world: PopularTrip[];
  /** Pre-rendered strips for the countries with the most routes, by ISO code. */
  byCountry: Record<string, { name: string; trips: PopularTrip[] }>;
}

/**
 * "Start in <country>": the page stays static (no headers() in the render
 * path), so the visitor's country is resolved after mount from the edge
 * cookie or the browser's languages, and the strip swaps to that country's
 * routes when the page holds them. Otherwise the world strip stays.
 */
export function PopularLocal({ world, byCountry }: PopularLocalProps) {
  const [country, setCountry] = useState<string | undefined>(undefined);

  useEffect(() => {
    const code = readCountryCookie() ?? countryFromLanguages(navigator.languages ?? []);
    if (code && byCountry[code]) setCountry(code);
  }, [byCountry]);

  const local = country ? byCountry[country] : undefined;
  if (local) return <PopularStrip trips={local.trips} countryName={local.name} />;
  return <PopularStrip trips={world} countryName={WORLD} />;
}
