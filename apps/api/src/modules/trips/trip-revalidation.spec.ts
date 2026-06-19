import { describe, expect, it } from 'vitest';
import { tripTemplateRevalidation } from './trip-revalidation';

describe('tripTemplateRevalidation', () => {
  it('always sends the places tag', () => {
    expect(tripTemplateRevalidation().tags).toEqual(['places']);
  });

  it('returns only the explore hub path when nothing is provided', () => {
    expect(tripTemplateRevalidation().paths).toEqual(['/explore']);
    expect(tripTemplateRevalidation(null, null, null).paths).toEqual(['/explore']);
  });

  it('adds the country explore hub + /trips/<cc> listing when a country is present', () => {
    expect(tripTemplateRevalidation('CA').paths).toEqual(['/explore', '/explore/ca', '/trips/ca']);
  });

  it('adds the region explore page when country+region present (no slug => no trip detail)', () => {
    expect(tripTemplateRevalidation('CA', 'BC').paths).toEqual([
      '/explore',
      '/explore/ca',
      '/trips/ca',
      '/explore/ca/bc',
    ]);
  });

  it('adds the lowercased trip-detail path when country+region+slug are present', () => {
    expect(tripTemplateRevalidation('CA', 'BC', 'Sea-To-Sky').paths).toEqual([
      '/explore',
      '/explore/ca',
      '/trips/ca',
      '/explore/ca/bc',
      '/trips/ca/bc/sea-to-sky',
    ]);
  });

  it('drops the trip-detail path when a slug is present but the region is missing', () => {
    expect(tripTemplateRevalidation('CA', null, 'slug').paths).toEqual([
      '/explore',
      '/explore/ca',
      '/trips/ca',
    ]);
  });
});
