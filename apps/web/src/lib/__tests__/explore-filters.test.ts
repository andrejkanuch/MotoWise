import { describe, expect, it } from 'vitest';
import { buildSearchAttempts, mapDuration } from '../explore-filters';

describe('mapDuration', () => {
  it('maps multi-day to a 2+ day floor', () => {
    expect(mapDuration('multi')).toEqual({ dayCountMin: 2 });
  });

  it('collapses every single-day label to dayCountMax: 1', () => {
    for (const d of ['short', 'medium', 'long', 'day']) {
      expect(mapDuration(d)).toEqual({ dayCountMax: 1 });
    }
  });

  it('returns no bounds for empty/unknown durations', () => {
    expect(mapDuration(undefined)).toEqual({});
    expect(mapDuration('')).toEqual({});
    expect(mapDuration('decade')).toEqual({});
  });
});

describe('buildSearchAttempts', () => {
  it('leads with the exact query (nothing dropped)', () => {
    const [first] = buildSearchAttempts({ q: 'alps', country: 'IT', duration: 'long' });
    expect(first.dropped).toEqual([]);
    expect(first.filter).toEqual({ searchText: 'alps', country: 'it', dayCountMax: 1 });
  });

  it('reproduces the Clarksville dead-end recovery: drops the unmatched text, keeps place + length', () => {
    // The real failure: q="clarksville, tn" matches no route, but US has routes.
    const attempts = buildSearchAttempts({ q: 'clarksville, tn', country: 'US', duration: 'long' });
    const dropOrder = attempts.map((a) => a.dropped);

    // exact → drop length → drop query (keep US + length) → ...
    expect(dropOrder[0]).toEqual([]);
    expect(dropOrder[1]).toEqual(['duration']);
    expect(dropOrder[2]).toEqual(['query']);

    // The attempt that recovers keeps the country, so it can surface US routes.
    const recovery = attempts[2];
    expect(recovery.filter).toEqual({ country: 'us', dayCountMax: 1 });
  });

  it('THE BUG: a no-match city must never hide a country that has routes', () => {
    // Regression for the session where "clarksville, tn" + US + duration
    // dead-ended even though the US had 26 routes. The ladder must keep the
    // country (broadening to its routes) BEFORE it ever abandons the place.
    const attempts = buildSearchAttempts({ q: 'clarksville, tn', country: 'US', duration: 'long' });

    const firstDropsQuery = attempts.findIndex((a) => a.dropped.includes('query'));
    const firstDropsCountry = attempts.findIndex((a) => a.dropped.includes('country'));

    // The text is relaxed before the place.
    expect(firstDropsQuery).toBeGreaterThanOrEqual(0);
    expect(firstDropsQuery).toBeLessThan(firstDropsCountry);

    // And the attempt that drops the text still searches within the country,
    // so the country's routes surface instead of an empty page.
    expect(attempts[firstDropsQuery].filter.country).toBe('us');
    expect(attempts[firstDropsQuery].filter.searchText).toBeUndefined();
  });

  it('always ends with an unfiltered attempt so it never dead-ends when routes exist', () => {
    const attempts = buildSearchAttempts({ q: 'nowhere', country: 'US', duration: 'multi' });
    expect(attempts.at(-1)?.filter).toEqual({});
  });

  it('dedupes relaxations that collapse to the same filter', () => {
    // No country set: dropping "country" is a no-op and must not create duplicates.
    const attempts = buildSearchAttempts({ q: 'coast', duration: 'long' });
    const keys = attempts.map((a) => JSON.stringify(a.filter));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('only reports inputs the user actually set as dropped', () => {
    // Text-only search: relaxations may drop "country"/"duration", but neither
    // was set, so `dropped` should never list them.
    const attempts = buildSearchAttempts({ q: 'dolomites' });
    for (const a of attempts) {
      expect(a.dropped).not.toContain('country');
      expect(a.dropped).not.toContain('duration');
    }
  });

  it('trims whitespace-only queries to undefined', () => {
    const [first] = buildSearchAttempts({ q: '   ', country: 'FR' });
    expect(first.filter).toEqual({ country: 'fr' });
  });
});
