import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Route } from './models/route.model';
import { RoutesService } from './routes.service';

describe('RoutesService', () => {
  let service: RoutesService;
  let mockUserClient: ReturnType<typeof createMockClient>;
  let mockAdminClient: ReturnType<typeof createMockClient>;

  const fakeRouteRow = {
    id: 'route-001',
    name: 'Stelvio Pass',
    description: 'A legendary Alpine pass',
    polyline: 'encodedPolyline',
    distance_m: 24500,
    elevation_gain_m: 1808,
    surface_type: 'paved',
    curvature_index: 42.5,
    is_motovault_pick: true,
    editorial_description: 'One of the best roads in Europe',
    rating_avg: 4.8,
    rating_count: 127,
    comment_count: 34,
    status: 'published',
    created_at: '2026-03-15T10:00:00Z',
    contributor_user_id: 'user-abc',
    start_lat: 46.5286,
    start_lng: 10.4531,
    slug: 'stelvio-pass',
    country_code: 'IT',
    region_code: 'IT-BZ',
    city: 'Bormio',
    users: {
      id: 'user-abc',
      display_name: 'Marco',
      public_username: 'marco_rider',
      avatar_url: 'https://example.com/avatar.jpg',
    },
  };

  function createChain() {
    const results: Array<{ data?: unknown; error?: unknown; count?: unknown }> = [];
    let callIndex = 0;

    const getResult = () => {
      const r = results[callIndex] ?? { data: null, error: null };
      callIndex++;
      return { data: null, error: null, ...r };
    };

    const chain: Record<string, unknown> = {};
    for (const m of [
      'select',
      'insert',
      'update',
      'delete',
      'upsert',
      'eq',
      'in',
      'is',
      'lt',
      'not',
      'gte',
      'order',
      'limit',
    ]) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    chain.single = vi.fn().mockImplementation(() => Promise.resolve(getResult()));
    chain.maybeSingle = vi.fn().mockImplementation(() => Promise.resolve(getResult()));
    // biome-ignore lint/suspicious/noThenProperty: Supabase query builders are thenable
    chain.then = vi
      .fn()
      .mockImplementation((resolve: (v: unknown) => void) => resolve(getResult()));

    return {
      chain: chain as Record<string, ReturnType<typeof vi.fn>>,
      pushResult: (r: { data?: unknown; error?: unknown; count?: unknown }) => results.push(r),
      resetIndex: () => {
        callIndex = 0;
      },
    };
  }

  function createMockClient() {
    const { chain, pushResult, resetIndex } = createChain();

    return {
      from: vi.fn().mockReturnValue(chain),
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
      _chain: chain,
      _pushResult: pushResult,
      _resetIndex: resetIndex,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockUserClient = createMockClient();
    mockAdminClient = createMockClient();

    service = new RoutesService(mockUserClient as never, mockAdminClient as never);
  });

  // ==========================================
  // Route model has new fields
  // ==========================================

  describe('Route model fields', () => {
    it('Route model has slug, countryCode, regionCode, city fields', () => {
      const route = new Route();
      route.slug = 'test-slug';
      route.countryCode = 'IT';
      route.regionCode = 'IT-BZ';
      route.city = 'Bormio';

      expect(route.slug).toBe('test-slug');
      expect(route.countryCode).toBe('IT');
      expect(route.regionCode).toBe('IT-BZ');
      expect(route.city).toBe('Bormio');
    });
  });

  // ==========================================
  // routeBySlug
  // ==========================================

  describe('findBySlug', () => {
    it('found route returns correct shape with slug, countryCode, regionCode, city', async () => {
      mockUserClient._pushResult({ data: fakeRouteRow });

      const result = await service.findBySlug('IT', 'IT-BZ', 'stelvio-pass');

      expect(result).not.toBeNull();
      expect(result?.slug).toBe('stelvio-pass');
      expect(result?.countryCode).toBe('IT');
      expect(result?.regionCode).toBe('IT-BZ');
      expect(result?.city).toBe('Bormio');
      expect(result?.id).toBe('route-001');
      expect(result?.name).toBe('Stelvio Pass');
      expect(result?.contributor.displayName).toBe('Marco');

      expect(mockUserClient.from).toHaveBeenCalledWith('routes');
      expect(mockUserClient._chain.eq).toHaveBeenCalledWith('status', 'published');
      expect(mockUserClient._chain.eq).toHaveBeenCalledWith('region_code', 'IT-BZ');
      expect(mockUserClient._chain.eq).toHaveBeenCalledWith('slug', 'stelvio-pass');
    });

    it('not found returns null', async () => {
      mockUserClient._pushResult({
        data: null,
        error: { message: 'Row not found', code: 'PGRST116' },
      });

      const result = await service.findBySlug('IT', 'IT-BZ', 'nonexistent-route');

      expect(result).toBeNull();
    });

    it('wrong region + correct slug returns null (composite key)', async () => {
      mockUserClient._pushResult({
        data: null,
        error: { message: 'Row not found', code: 'PGRST116' },
      });

      const result = await service.findBySlug('DE', 'DE-BY', 'stelvio-pass');

      expect(result).toBeNull();
      expect(mockUserClient._chain.eq).toHaveBeenCalledWith('region_code', 'DE-BY');
      expect(mockUserClient._chain.eq).toHaveBeenCalledWith('slug', 'stelvio-pass');
    });
  });

  // ==========================================
  // discoverRoutes includes new fields
  // ==========================================

  describe('discoverRoutes', () => {
    it('includes slug, countryCode, regionCode, city in response', async () => {
      mockUserClient._pushResult({ data: [fakeRouteRow] });

      const result = await service.discoverRoutes(undefined, 20);

      expect(result.edges).toHaveLength(1);
      const route = result.edges[0].node;
      expect(route.slug).toBe('stelvio-pass');
      expect(route.countryCode).toBe('IT');
      expect(route.regionCode).toBe('IT-BZ');
      expect(route.city).toBe('Bormio');
    });

    it('applies countryCode, motovaultPicksOnly, and rating sort when requested', async () => {
      mockUserClient._pushResult({ data: [fakeRouteRow] });

      await service.discoverRoutes(
        {
          countryCode: 'it',
          motovaultPicksOnly: true,
          sortByRating: true,
        },
        10,
      );

      expect(mockUserClient._chain.eq).toHaveBeenCalledWith('country_code', 'it');
      expect(mockUserClient._chain.eq).toHaveBeenCalledWith('is_motovault_pick', true);
      expect(mockUserClient._chain.order).toHaveBeenCalledWith('rating_avg', {
        ascending: false,
        nullsFirst: false,
      });
      expect(mockUserClient._chain.order).toHaveBeenCalledWith('rating_count', {
        ascending: false,
      });
    });

    it('filters by regionCode when provided', async () => {
      mockUserClient._pushResult({ data: [fakeRouteRow] });

      await service.discoverRoutes(
        {
          countryCode: 'IT',
          regionCode: 'IT-BZ',
          sortByRating: true,
        },
        10,
      );

      expect(mockUserClient._chain.eq).toHaveBeenCalledWith('region_code', 'it-bz');
    });
  });

  describe('sitemapPublishedRoutes', () => {
    it('maps published rows with country, region, slug', async () => {
      mockUserClient._pushResult({
        data: [
          {
            country_code: 'IT',
            region_code: 'IT-BZ',
            slug: 'stelvio-pass',
            updated_at: '2026-04-01T00:00:00Z',
          },
        ],
      });

      const rows = await service.sitemapPublishedRoutes();

      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual({
        countryCode: 'IT',
        regionCode: 'IT-BZ',
        slug: 'stelvio-pass',
        updatedAt: '2026-04-01T00:00:00Z',
      });
      expect(mockUserClient._chain.not).toHaveBeenCalledWith('country_code', 'is', null);
    });

    it('returns empty array on Supabase error', async () => {
      mockUserClient._pushResult({ data: null, error: { message: 'boom' } });

      const rows = await service.sitemapPublishedRoutes();

      expect(rows).toEqual([]);
    });
  });

  describe('routePathById', () => {
    it('returns canonical path when row exists', async () => {
      mockUserClient._pushResult({
        data: {
          slug: 'stelvio-pass',
          country_code: 'IT',
          region_code: 'IT-BZ',
        },
      });

      const path = await service.routePathById('550e8400-e29b-41d4-a716-446655440000');

      expect(path).toEqual({
        countryCode: 'IT',
        regionCode: 'IT-BZ',
        slug: 'stelvio-pass',
      });
      expect(mockUserClient._chain.maybeSingle).toHaveBeenCalled();
    });

    it('returns null when slug or geo columns missing', async () => {
      mockUserClient._pushResult({
        data: { slug: 'x', country_code: null, region_code: 'IT-BZ' },
      });

      const path = await service.routePathById('550e8400-e29b-41d4-a716-446655440000');

      expect(path).toBeNull();
    });
  });
});
