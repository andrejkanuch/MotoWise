import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/constants', () => ({
  BASE_URL: 'https://motovault.app',
}));

import {
  routeToTouristAttraction,
  regionToPlace,
  websiteSchema,
  breadcrumbSchema,
} from '../jsonld';

describe('routeToTouristAttraction', () => {
  const baseRoute = {
    name: 'Pacific Coast Highway',
    description: 'A scenic coastal ride along the California coast.',
    url: 'https://motovault.app/route/us/ca/pacific-coast',
    latitude: 34.0259,
    longitude: -118.7798,
    countryCode: 'us',
    regionName: 'California',
  };

  it('produces valid @context, @type, name, and geo', () => {
    const result = routeToTouristAttraction(baseRoute);

    expect(result['@context']).toBe('https://schema.org');
    expect(result['@type']).toBe('TouristAttraction');
    expect(result.name).toBe('Pacific Coast Highway');
    expect(result.geo).toEqual({
      '@type': 'GeoCoordinates',
      latitude: 34.0259,
      longitude: -118.7798,
    });
  });

  it('omits aggregateRating when ratingCount < 3', () => {
    const result = routeToTouristAttraction({
      ...baseRoute,
      ratingAvg: 4.5,
      ratingCount: 2,
    });

    expect(result.aggregateRating).toBeUndefined();
  });

  it('omits aggregateRating when ratingCount is undefined', () => {
    const result = routeToTouristAttraction(baseRoute);

    expect(result.aggregateRating).toBeUndefined();
  });

  it('includes aggregateRating when ratingCount >= 3', () => {
    const result = routeToTouristAttraction({
      ...baseRoute,
      ratingAvg: 4.7,
      ratingCount: 15,
    });

    expect(result.aggregateRating).toEqual({
      '@type': 'AggregateRating',
      ratingValue: 4.7,
      reviewCount: 15,
      bestRating: 5,
      worstRating: 1,
    });
  });

  it('includes aggregateRating at exactly 3 ratings', () => {
    const result = routeToTouristAttraction({
      ...baseRoute,
      ratingAvg: 3.0,
      ratingCount: 3,
    });

    expect(result.aggregateRating).toBeDefined();
  });
});

describe('regionToPlace', () => {
  it('produces a valid Place schema', () => {
    const result = regionToPlace({
      name: 'California',
      description: 'Top motorcycle routes in California.',
      url: 'https://motovault.app/explore/us/ca',
      countryCode: 'us',
    });

    expect(result['@context']).toBe('https://schema.org');
    expect(result['@type']).toBe('Place');
    expect(result.name).toBe('California');
    expect(result.description).toBe('Top motorcycle routes in California.');
    expect(result.url).toBe('https://motovault.app/explore/us/ca');
    expect(result.address).toEqual({
      '@type': 'PostalAddress',
      addressCountry: 'us',
    });
  });
});

describe('websiteSchema', () => {
  it('produces a valid WebSite schema', () => {
    const result = websiteSchema({ name: 'MotoVault' });

    expect(result['@context']).toBe('https://schema.org');
    expect(result['@type']).toBe('WebSite');
    expect(result.name).toBe('MotoVault');
    expect(result.url).toBe('https://motovault.app');
  });

  it('accepts a custom url', () => {
    const result = websiteSchema({ name: 'MotoVault', url: 'https://custom.app' });

    expect(result.url).toBe('https://custom.app');
  });
});

describe('breadcrumbSchema', () => {
  it('produces a valid BreadcrumbList with correct positions', () => {
    const result = breadcrumbSchema([
      { name: 'Home', url: 'https://motovault.app' },
      { name: 'Explore', url: 'https://motovault.app/explore' },
      { name: 'United States', url: 'https://motovault.app/explore/us' },
      { name: 'California', url: 'https://motovault.app/explore/us/ca' },
    ]);

    expect(result['@context']).toBe('https://schema.org');
    expect(result['@type']).toBe('BreadcrumbList');

    const items = result.itemListElement as Array<Record<string, unknown>>;
    expect(items).toHaveLength(4);

    expect(items[0].position).toBe(1);
    expect(items[0].name).toBe('Home');
    expect(items[0]['@type']).toBe('ListItem');

    expect(items[1].position).toBe(2);
    expect(items[1].name).toBe('Explore');

    expect(items[2].position).toBe(3);
    expect(items[2].name).toBe('United States');

    expect(items[3].position).toBe(4);
    expect(items[3].name).toBe('California');
    expect(items[3].item).toBe('https://motovault.app/explore/us/ca');
  });

  it('handles a single-item breadcrumb', () => {
    const result = breadcrumbSchema([
      { name: 'Home', url: 'https://motovault.app' },
    ]);

    const items = result.itemListElement as Array<Record<string, unknown>>;
    expect(items).toHaveLength(1);
    expect(items[0].position).toBe(1);
  });
});
