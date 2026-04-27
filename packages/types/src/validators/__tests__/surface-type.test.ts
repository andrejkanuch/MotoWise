import { describe, expect, it } from 'vitest';
import { DiscoverTripsFilterSchema } from '../discover-trip';
import { DiscoverRoutesFilterSchema, ShareRideToDiscoverInputSchema } from '../route';
import { SurfaceTypeInputSchema, SurfaceTypeSchema, TripTemplateFiltersSchema } from '../trip';

describe('SurfaceTypeSchema', () => {
  it('accepts DB values', () => {
    expect(SurfaceTypeSchema.parse('paved')).toBe('paved');
    expect(SurfaceTypeSchema.parse('off-road')).toBe('off-road');
  });

  it('rejects GraphQL enum key off_road', () => {
    expect(() => SurfaceTypeSchema.parse('off_road')).toThrow();
  });
});

describe('SurfaceTypeInputSchema', () => {
  it('accepts DB value off-road', () => {
    expect(SurfaceTypeInputSchema.parse('off-road')).toBe('off-road');
  });

  it('normalises GraphQL enum key off_road to off-road', () => {
    expect(SurfaceTypeInputSchema.parse('off_road')).toBe('off-road');
  });

  it('passes through other values unchanged', () => {
    expect(SurfaceTypeInputSchema.parse('paved')).toBe('paved');
    expect(SurfaceTypeInputSchema.parse('mixed')).toBe('mixed');
    expect(SurfaceTypeInputSchema.parse('unknown')).toBe('unknown');
  });

  it('rejects invalid values', () => {
    expect(() => SurfaceTypeInputSchema.parse('gravel')).toThrow();
  });
});

describe('TripTemplateFiltersSchema surfaceType', () => {
  it('accepts off_road and normalises to off-road', () => {
    const result = TripTemplateFiltersSchema.parse({ surfaceType: 'off_road' });
    expect(result.surfaceType).toBe('off-road');
  });

  it('accepts off-road as-is', () => {
    const result = TripTemplateFiltersSchema.parse({ surfaceType: 'off-road' });
    expect(result.surfaceType).toBe('off-road');
  });
});

describe('DiscoverTripsFilterSchema surfaceType', () => {
  it('accepts off_road and normalises', () => {
    const result = DiscoverTripsFilterSchema.parse({ surfaceType: 'off_road' });
    expect(result.surfaceType).toBe('off-road');
  });
});

describe('ShareRideToDiscoverInputSchema surfaceType', () => {
  it('accepts off_road and normalises', () => {
    const result = ShareRideToDiscoverInputSchema.parse({
      rideId: '550e8400-e29b-41d4-a716-446655440000',
      surfaceType: 'off_road',
    });
    expect(result.surfaceType).toBe('off-road');
  });
});

describe('DiscoverRoutesFilterSchema surfaceTypes', () => {
  it('normalises off_road in array', () => {
    const result = DiscoverRoutesFilterSchema.parse({
      surfaceTypes: ['paved', 'off_road', 'mixed'],
    });
    expect(result.surfaceTypes).toEqual(['paved', 'off-road', 'mixed']);
  });
});
