import type { RouteForJsonLd } from '@motovault/types';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/constants', () => ({
  BASE_URL: 'https://motovault.app',
}));

import {
  breadcrumbSchema,
  regionToPlace,
  routeToTouristAttraction,
  websiteSchema,
} from '../jsonld';

import { buildArticle, buildSoftwareApplication } from '../schema';

describe('routeToTouristAttraction', () => {
  const baseRoute: RouteForJsonLd = {
    name: 'Pacific Coast Highway',
    description: 'A scenic coastal ride along the California coast.',
    editorialDescription: null,
    distanceM: 120_000,
    elevationGainM: 500,
    surfaceType: 'paved',
    ratingAvg: null,
    ratingCount: 0,
    startLat: 34.0259,
    startLng: -118.7798,
    countryCode: 'us',
    regionSlug: 'ca',
    slug: 'pacific-coast-highway',
    countryName: 'United States',
    regionName: 'California',
  };

  it('produces @type TouristAttraction, name, canonical url, and geo', () => {
    const result = routeToTouristAttraction(baseRoute);

    expect(result['@type']).toBe('TouristAttraction');
    expect(result.name).toBe('Pacific Coast Highway');
    expect(result.url).toBe('https://motovault.app/route/us/ca/pacific-coast-highway');
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

  it('omits aggregateRating when ratingCount is 0', () => {
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
      ratingValue: '4.7',
      reviewCount: '15',
      bestRating: '5',
      worstRating: '1',
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
      countryCode: 'us',
      regionSlug: 'ca',
      countryName: 'United States',
      description: 'Top motorcycle routes in California.',
    });

    expect(result['@type']).toBe('Place');
    expect(result.name).toBe('California');
    expect(result.description).toBe('Top motorcycle routes in California.');
    expect(result.url).toBe('https://motovault.app/explore/us/ca');
    expect(result.address).toEqual({
      '@type': 'PostalAddress',
      addressRegion: 'California',
      addressCountry: 'United States',
    });
  });
});

describe('websiteSchema', () => {
  it('produces a valid WebSite schema', () => {
    const result = websiteSchema();

    expect(result['@type']).toBe('WebSite');
    expect(result.name).toBe('MotoVault');
    expect(result.url).toBe('https://motovault.app');
  });
});

describe('buildArticle', () => {
  const baseArticle = {
    url: 'https://motovault.app/blog/test-article',
    headline: 'Test Article',
    description: 'A test article.',
    image: 'https://motovault.app/images/blog/test-hero.webp',
    datePublished: '2026-01-01',
    dateModified: '2026-05-01',
    authorName: 'Andrej Kanuch',
    authorUrl: 'https://motovault.app/about',
    locale: 'en',
    slug: 'test-article',
  };

  it('uses canonical URL for @id, not locale-namespaced path', () => {
    const result = buildArticle(baseArticle);
    expect(result['@id']).toBe('https://motovault.app/blog/test-article#article');
  });

  it('uses locale-prefixed canonical URL for non-English @id', () => {
    const result = buildArticle({
      ...baseArticle,
      url: 'https://motovault.app/fr/blog/test-article',
      locale: 'fr',
    });
    expect(result['@id']).toBe('https://motovault.app/fr/blog/test-article#article');
  });

  it('emits image as ImageObject with dimensions', () => {
    const result = buildArticle(baseArticle);
    const images = result.image as Array<Record<string, unknown>>;
    expect(images).toHaveLength(1);
    expect(images[0]['@type']).toBe('ImageObject');
    expect(images[0].url).toBe(baseArticle.image);
    expect(images[0].width).toBe(1200);
    expect(images[0].height).toBe(630);
  });

  it('includes wordCount when provided', () => {
    const result = buildArticle({ ...baseArticle, wordCount: 2500 });
    expect(result.wordCount).toBe(2500);
  });

  it('omits wordCount when not provided', () => {
    const result = buildArticle(baseArticle);
    expect(result.wordCount).toBeUndefined();
  });

  it('omits wordCount when zero', () => {
    const result = buildArticle({ ...baseArticle, wordCount: 0 });
    expect(result.wordCount).toBeUndefined();
  });
});

describe('buildSoftwareApplication', () => {
  it('includes aggregateRating when provided', () => {
    const result = buildSoftwareApplication({
      name: 'MotoVault',
      description: 'Test',
      aggregateRating: { ratingValue: '4.6', reviewCount: '48' },
    });
    expect(result.aggregateRating).toEqual({
      '@type': 'AggregateRating',
      ratingValue: '4.6',
      reviewCount: '48',
      bestRating: '5',
      worstRating: '1',
    });
  });

  it('omits aggregateRating when not provided', () => {
    const result = buildSoftwareApplication({
      name: 'MotoVault',
      description: 'Test',
    });
    expect(result.aggregateRating).toBeUndefined();
  });
});

describe('breadcrumbSchema', () => {
  it('produces a BreadcrumbList with correct positions', () => {
    const result = breadcrumbSchema([
      { name: 'Home', url: 'https://motovault.app' },
      { name: 'Explore', url: 'https://motovault.app/explore' },
      { name: 'United States', url: 'https://motovault.app/explore/us' },
      { name: 'California', url: 'https://motovault.app/explore/us/ca' },
    ]);

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
    const result = breadcrumbSchema([{ name: 'Home', url: 'https://motovault.app' }]);

    const items = result.itemListElement as Array<Record<string, unknown>>;
    expect(items).toHaveLength(1);
    expect(items[0].position).toBe(1);
  });
});
