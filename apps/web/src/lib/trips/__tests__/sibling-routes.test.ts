import { describe, expect, it } from 'vitest';
import type { TripTemplateNode } from '@/lib/fetch-places';
import { selectSiblingRoutes, siblingsAreRegionScoped } from '../sibling-routes';

const trip = (
  id: string,
  slug: string | null,
  regionCode: string | null,
  countryCode: string | null = 'US',
): TripTemplateNode => ({ id, slug, regionCode, countryCode }) as unknown as TripTemplateNode;

describe('selectSiblingRoutes', () => {
  it('excludes the current trip by slug, case-insensitively', () => {
    const all = [trip('1', 'alpha', 'ca'), trip('2', 'beta', 'ca'), trip('3', 'gamma', 'ca')];
    const result = selectSiblingRoutes(all, 'ca', 'ALPHA');
    expect(result.map((r) => r.slug)).toEqual(['beta', 'gamma']);
  });

  it('drops trips missing slug, region, or country (would render /trips// soft-404s)', () => {
    const all = [
      trip('1', null, 'ca'),
      trip('2', 'beta', null),
      trip('3', 'gamma', 'ca', null),
      trip('4', 'delta', 'ca'),
    ];
    expect(selectSiblingRoutes(all, 'ca', 'x').map((r) => r.slug)).toEqual(['delta']);
  });

  it('prefers same-region trips when there are at least 3', () => {
    const all = [
      trip('1', 'a', 'ca'),
      trip('2', 'b', 'ca'),
      trip('3', 'c', 'ca'),
      trip('4', 'd', 'ny'),
    ];
    const result = selectSiblingRoutes(all, 'ca', 'x');
    expect(result).toHaveLength(3);
    expect(result.every((r) => r.regionCode === 'ca')).toBe(true);
  });

  it('falls back to country-wide when the region has fewer than 3 siblings', () => {
    const all = [trip('1', 'a', 'ca'), trip('2', 'b', 'ny'), trip('3', 'c', 'tx')];
    expect(
      selectSiblingRoutes(all, 'ca', 'x')
        .map((r) => r.slug)
        .sort(),
    ).toEqual(['a', 'b', 'c']);
  });

  it('caps the result at the limit', () => {
    const all = Array.from({ length: 10 }, (_, i) => trip(String(i), `s${i}`, 'ny'));
    expect(selectSiblingRoutes(all, 'ca', 'x')).toHaveLength(6);
  });
});

describe('siblingsAreRegionScoped', () => {
  it('is true when every route is in the region (case-insensitive)', () => {
    expect(siblingsAreRegionScoped([trip('1', 'a', 'CA'), trip('2', 'b', 'ca')], 'ca')).toBe(true);
  });

  it('is false when results are a country-wide fallback', () => {
    expect(siblingsAreRegionScoped([trip('1', 'a', 'ca'), trip('2', 'b', 'ny')], 'ca')).toBe(false);
  });

  it('is false when there are no siblings', () => {
    expect(siblingsAreRegionScoped([], 'ca')).toBe(false);
  });
});
