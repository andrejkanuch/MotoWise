import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchService } from './search.service';

/** Helper to build a mock Supabase client with configurable rpc results */
function createMockSupabase(rpcResults: Record<string, { data: unknown; error: unknown }> = {}) {
  return {
    rpc: vi.fn((fnName: string, _params?: Record<string, unknown>) => {
      const result = rpcResults[fnName] ?? { data: [], error: null };
      return Promise.resolve(result);
    }),
  } as unknown as import('@supabase/supabase-js').SupabaseClient;
}

function makeRouteRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'route-1',
    name: 'Pacific Coast Highway',
    slug: 'pacific-coast-highway',
    country_code: 'us',
    region_code: 'ca',
    surface_type: 'paved',
    distance_m: 100000,
    elevation_gain_m: 500,
    rating_avg: 4.8,
    rating_count: 12,
    text_rank: 0.9,
    geo_rank: 0.7,
    ...overrides,
  };
}

describe('SearchService', () => {
  let service: SearchService;
  let mockSupabase: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    mockSupabase = createMockSupabase();
    service = new SearchService(mockSupabase as never);
    // Inject the mock via the private field
    (service as unknown as { supabase: unknown }).supabase = mockSupabase;
  });

  // ------------------------------------------------------------------
  // searchRoutes
  // ------------------------------------------------------------------

  describe('searchRoutes', () => {
    it('returns ranked results for a text query', async () => {
      const row1 = makeRouteRow({ id: 'r1', text_rank: 0.9, geo_rank: 0.5 });
      const row2 = makeRouteRow({ id: 'r2', text_rank: 0.4, geo_rank: 0.8 });
      mockSupabase.rpc = vi.fn().mockResolvedValue({ data: [row1, row2], error: null });

      const result = await service.searchRoutes({ q: 'pacific coast' });

      expect(result.results).toHaveLength(2);
      expect(result.results[0].id).toBe('r1');
      expect(result.results[1].id).toBe('r2');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('search_routes', expect.objectContaining({
        search_query: 'pacific coast',
      }));
    });

    it('returns results with empty query (fallback to rating sort)', async () => {
      const row = makeRouteRow({ text_rank: 0, geo_rank: 0 });
      mockSupabase.rpc = vi.fn().mockResolvedValue({ data: [row], error: null });

      const result = await service.searchRoutes({});

      expect(result.results).toHaveLength(1);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('search_routes', expect.objectContaining({
        search_query: '',
      }));
    });

    it('applies AND semantics for surfaceTypes + countryCode filters', async () => {
      mockSupabase.rpc = vi.fn().mockResolvedValue({ data: [], error: null });

      await service.searchRoutes({
        q: 'mountain',
        surfaceTypes: ['gravel', 'dirt'],
        countryCode: 'us',
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('search_routes', expect.objectContaining({
        filter_surface_types: ['gravel', 'dirt'],
        filter_country_code: 'us',
      }));
    });

    it('paginates: first page then next page with cursor — no overlap', async () => {
      const page1Rows = Array.from({ length: 3 }, (_, i) =>
        makeRouteRow({ id: `r${i}`, text_rank: 0.5, geo_rank: 0.5 }),
      );
      // 3 items + 1 extra = hasNextPage
      mockSupabase.rpc = vi.fn().mockResolvedValue({ data: [...page1Rows, makeRouteRow({ id: 'r3' })], error: null });

      const page1 = await service.searchRoutes({ first: 3 });

      expect(page1.results).toHaveLength(3);
      expect(page1.hasNextPage).toBe(true);
      expect(page1.endCursor).toBe('r2');

      // Page 2: use the cursor
      const page2Rows = [makeRouteRow({ id: 'r3' }), makeRouteRow({ id: 'r4' })];
      mockSupabase.rpc = vi.fn().mockResolvedValue({ data: page2Rows, error: null });

      const page2 = await service.searchRoutes({ first: 3, after: page1.endCursor });

      expect(page2.results).toHaveLength(2);
      expect(page2.hasNextPage).toBe(false);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('search_routes', expect.objectContaining({
        page_cursor: 'r2',
      }));

      // No overlap between pages
      const page1Ids = page1.results.map((r) => r.id);
      const page2Ids = page2.results.map((r) => r.id);
      const overlap = page1Ids.filter((id) => page2Ids.includes(id));
      expect(overlap).toHaveLength(0);
    });

    it('computes score as text_rank * 0.6 + geo_rank * 0.4', async () => {
      const row = makeRouteRow({ text_rank: 0.8, geo_rank: 0.5 });
      mockSupabase.rpc = vi.fn().mockResolvedValue({ data: [row], error: null });

      const result = await service.searchRoutes({ q: 'test' });

      const expected = 0.8 * 0.6 + 0.5 * 0.4; // 0.68
      expect(result.results[0].score).toBeCloseTo(expected);
    });
  });

  // ------------------------------------------------------------------
  // typeahead
  // ------------------------------------------------------------------

  describe('typeahead', () => {
    it('returns empty arrays immediately for empty query', async () => {
      const result = await service.typeahead('');

      expect(result).toEqual({ routes: [], places: [] });
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it('returns empty arrays immediately for whitespace-only query', async () => {
      const result = await service.typeahead('   ');

      expect(result).toEqual({ routes: [], places: [] });
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it('returns fuzzy matches for a partial name', async () => {
      const routeRows = [
        { id: 'r1', name: 'Pacific Coast Highway', slug: 'pacific-coast', country_code: 'us', region_code: 'ca' },
        { id: 'r2', name: 'Pacific Rim', slug: 'pacific-rim', country_code: 'ca', region_code: 'bc' },
      ];
      const placeRows = [
        { place_id: 'p1', name: 'Pacific Beach', country_code: 'us', region_code: 'ca' },
      ];

      mockSupabase.rpc = vi.fn((fnName: string) => {
        if (fnName === 'typeahead_routes') return Promise.resolve({ data: routeRows, error: null });
        if (fnName === 'typeahead_places') return Promise.resolve({ data: placeRows, error: null });
        return Promise.resolve({ data: [], error: null });
      });

      const result = await service.typeahead('Pacif');

      expect(result.routes).toHaveLength(2);
      expect(result.routes[0].name).toBe('Pacific Coast Highway');
      expect(result.places).toHaveLength(1);
      expect(result.places[0].name).toBe('Pacific Beach');
    });

    it('maps results from snake_case to camelCase', async () => {
      const routeRows = [
        { id: 'r1', name: 'Test Route', slug: 'test', country_code: 'us', region_code: 'ca' },
      ];
      const placeRows = [
        { place_id: 'p1', name: 'Test Place', country_code: 'us', region_code: 'tx' },
      ];

      mockSupabase.rpc = vi.fn((fnName: string) => {
        if (fnName === 'typeahead_routes') return Promise.resolve({ data: routeRows, error: null });
        if (fnName === 'typeahead_places') return Promise.resolve({ data: placeRows, error: null });
        return Promise.resolve({ data: [], error: null });
      });

      const result = await service.typeahead('test');

      // Routes: country_code → countryCode, region_code → regionCode
      const route = result.routes[0];
      expect(route).toHaveProperty('countryCode', 'us');
      expect(route).toHaveProperty('regionCode', 'ca');
      expect(route).not.toHaveProperty('country_code');
      expect(route).not.toHaveProperty('region_code');

      // Places: place_id → placeId, country_code → countryCode, region_code → regionCode
      const place = result.places[0];
      expect(place).toHaveProperty('placeId', 'p1');
      expect(place).toHaveProperty('countryCode', 'us');
      expect(place).toHaveProperty('regionCode', 'tx');
      expect(place).not.toHaveProperty('place_id');
      expect(place).not.toHaveProperty('country_code');
      expect(place).not.toHaveProperty('region_code');
    });
  });
});
