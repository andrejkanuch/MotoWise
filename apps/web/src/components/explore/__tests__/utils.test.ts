import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/constants', () => ({ BASE_URL: 'https://motovault.app' }));

import type { TripTemplateNode } from '@/lib/fetch-places';

const { tripHref } = await import('../utils');

const trip = (p: Partial<TripTemplateNode>): TripTemplateNode => p as unknown as TripTemplateNode;

describe('tripHref', () => {
  it('lowercases a complete trip path so it matches the canonical URL', () => {
    expect(
      tripHref(trip({ id: '1', slug: 'Cape-Ride', countryCode: 'ZA', regionCode: 'ZA-WC' })),
    ).toBe('/trips/za/za-wc/cape-ride');
  });

  it('falls back to /trips/{id} when geo fields are missing', () => {
    expect(tripHref(trip({ id: 'abc', slug: null, countryCode: 'ZA', regionCode: 'ZA-WC' }))).toBe(
      '/trips/abc',
    );
  });
});
