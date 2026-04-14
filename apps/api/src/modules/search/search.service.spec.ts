import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchService } from './search.service';

/** Helper to build a mock Supabase client with configurable rpc results */
function createMockSupabase(rpcResults: Record<string, { data: unknown; error: unknown }> = {}) {
  // Supabase's PostgREST builder is a thenable chain — every method returns `this`,
  // and awaiting it resolves to { data, error }.
  let resolveValue = { data: [] as unknown[], error: null as unknown };
  const fromChain: Record<string, unknown> = {};

  for (const m of ['select', 'eq', 'ilike', 'in', 'gte', 'lte', 'lt', 'order', 'limit']) {
    fromChain[m] = vi.fn(() => fromChain);
  }

  // Make the chain thenable so `await query` resolves
  // biome-ignore lint/suspicious/noThenProperty: Supabase query builders are thenable
  fromChain.then = (resolve: (v: unknown) => void) => {
    resolve(resolveValue);
    return fromChain;
  };

  return {
    rpc: vi.fn((fnName: string, _params?: Record<string, unknown>) => {
      const result = rpcResults[fnName] ?? { data: [], error: null };
      return Promise.resolve(result);
    }),
    from: vi.fn(() => fromChain),
    _fromChain: fromChain,
    _setResolveValue: (val: { data: unknown; error: unknown }) => {
      resolveValue = val;
    },
  } as unknown as import('@supabase/supabase-js').SupabaseClient;
}

function makeTypeaheadRow(overrides: Record<string, unknown> = {}) {
  return {
    source: 'route',
    id: 'route-1',
    name: 'Pacific Coast Highway',
    slug: 'pacific-coast-highway',
    kind: null,
    country_code: 'us',
    region_code: 'ca',
    population: null,
    sim: 0.85,
    ...overrides,
  };
}

describe('SearchService', () => {
  let service: SearchService;
  let mockSupabase: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    service = new SearchService(mockSupabase as never);
    (service as unknown as { supabase: unknown }).supabase = mockSupabase;
  });

  // ------------------------------------------------------------------
  // typeahead
  // ------------------------------------------------------------------

  describe('typeahead', () => {
    it('returns empty arrays for null query', async () => {
      const result = await service.typeahead(null, null, 8);

      expect(result).toEqual({ routes: [], places: [] });
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it('returns empty arrays for empty string query', async () => {
      const result = await service.typeahead('', null, 8);

      expect(result).toEqual({ routes: [], places: [] });
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it('returns empty arrays for whitespace-only query', async () => {
      const result = await service.typeahead('   ', null, 8);

      expect(result).toEqual({ routes: [], places: [] });
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it('calls typeahead_search RPC with trimmed query', async () => {
      mockSupabase.rpc = vi.fn().mockResolvedValue({ data: [], error: null });

      await service.typeahead('  pacific  ', null, 8);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('typeahead_search', {
        search_term: 'pacific',
        result_limit: 8,
      });
    });

    it('truncates query to 100 characters', async () => {
      mockSupabase.rpc = vi.fn().mockResolvedValue({ data: [], error: null });
      const longQuery = 'a'.repeat(200);

      await service.typeahead(longQuery, null, 8);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('typeahead_search', {
        search_term: 'a'.repeat(100),
        result_limit: 8,
      });
    });

    it('clamps limit to MAX_TYPEAHEAD_LIMIT (20)', async () => {
      mockSupabase.rpc = vi.fn().mockResolvedValue({ data: [], error: null });

      await service.typeahead('test', null, 999);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('typeahead_search', {
        search_term: 'test',
        result_limit: 20,
      });
    });

    it('clamps limit minimum to 1', async () => {
      mockSupabase.rpc = vi.fn().mockResolvedValue({ data: [], error: null });

      await service.typeahead('test', null, -5);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('typeahead_search', {
        search_term: 'test',
        result_limit: 1,
      });
    });

    it('splits RPC results into routes and places', async () => {
      const rows = [
        makeTypeaheadRow({ source: 'route', id: 'r1', name: 'Route A', slug: 'route-a' }),
        makeTypeaheadRow({ source: 'route', id: 'r2', name: 'Route B', slug: 'route-b' }),
        makeTypeaheadRow({
          source: 'place',
          id: '123',
          name: 'Romania',
          kind: 'country',
          country_code: 'ro',
          population: 19000000,
        }),
      ];
      mockSupabase.rpc = vi.fn().mockResolvedValue({ data: rows, error: null });

      const result = await service.typeahead('ro', null, 8);

      expect(result.routes).toHaveLength(2);
      expect(result.places).toHaveLength(1);
    });

    it('maps route results from snake_case to camelCase', async () => {
      const rows = [
        makeTypeaheadRow({
          source: 'route',
          id: 'r1',
          name: 'Test Route',
          slug: 'test-route',
          country_code: 'us',
          region_code: 'ca',
        }),
      ];
      mockSupabase.rpc = vi.fn().mockResolvedValue({ data: rows, error: null });

      const result = await service.typeahead('test', null, 8);

      const route = result.routes[0];
      expect(route).toEqual({
        id: 'r1',
        name: 'Test Route',
        slug: 'test-route',
        countryCode: 'us',
        regionCode: 'ca',
      });
    });

    it('maps place results from snake_case to camelCase', async () => {
      const rows = [
        makeTypeaheadRow({
          source: 'place',
          id: '456',
          name: 'Romania',
          kind: 'country',
          country_code: 'ro',
          region_code: null,
          population: 19000000,
        }),
      ];
      mockSupabase.rpc = vi.fn().mockResolvedValue({ data: rows, error: null });

      const result = await service.typeahead('roman', null, 8);

      const place = result.places[0];
      expect(place).toEqual({
        id: 456,
        name: 'Romania',
        kind: 'country',
        countryCode: 'ro',
        regionCode: undefined,
        population: 19000000,
      });
    });

    it('returns empty arrays on RPC error', async () => {
      mockSupabase.rpc = vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: 'function not found', code: '42883' } });

      const result = await service.typeahead('test', null, 8);

      expect(result).toEqual({ routes: [], places: [] });
    });

    it('handles null data from RPC gracefully', async () => {
      mockSupabase.rpc = vi.fn().mockResolvedValue({ data: null, error: null });

      const result = await service.typeahead('test', null, 8);

      expect(result).toEqual({ routes: [], places: [] });
    });
  });

  // ------------------------------------------------------------------
  // searchRoutes (fallback path)
  // ------------------------------------------------------------------

  describe('searchRoutes', () => {
    it('falls back to basic query when search_routes_raw RPC fails', async () => {
      // Make RPC fail to trigger fallback
      mockSupabase.rpc = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'function does not exist', code: '42883' },
      });

      const result = await service.searchRoutes('test');

      expect(result.edges).toHaveLength(0);
      expect(result.pageInfo.hasNextPage).toBe(false);
      // Should have called from() for the fallback
      expect(mockSupabase.from).toHaveBeenCalledWith('routes');
    });

    it('clamps first to 50 max', async () => {
      mockSupabase.rpc = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'rpc not found', code: '42883' },
      });

      await service.searchRoutes('test', undefined, undefined, 100);

      const mockFrom = (mockSupabase as unknown as { _fromChain: Record<string, unknown> })
        ._fromChain;
      // The fallback should limit to 51 (50+1 for hasNextPage check)
      expect(mockFrom.limit).toHaveBeenCalledWith(51);
    });
  });
});
