import { InternalServerErrorException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlacesService } from './places.service';

/** Chainable stub for the `places` lookup — resolves at `.maybeSingle()`. */
function makePlacesQueryStub(result: { data: unknown; error: unknown }) {
  const stub: Record<string, unknown> = {};
  const chain = () => stub;
  for (const method of ['select', 'eq', 'order', 'gt']) {
    stub[method] = vi.fn(chain);
  }
  stub.maybeSingle = vi.fn(() => Promise.resolve(result));
  return stub;
}

/** Chainable, thenable stub for the `trips` count query. */
function makeCountQueryStub(result: { count: number | null; error: unknown }) {
  const stub: Record<string, unknown> = {};
  const chain = () => stub;
  for (const method of ['select', 'eq', 'ilike']) {
    stub[method] = vi.fn(chain);
  }
  // biome-ignore lint/suspicious/noThenProperty: mocking PostgREST's thenable builder
  stub.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return stub;
}

describe('PlacesService.browseCountryBySlug', () => {
  let service: PlacesService;
  let placesStub: ReturnType<typeof makePlacesQueryStub>;
  let countStub: ReturnType<typeof makeCountQueryStub>;

  const buildService = (opts: {
    placeRow?: unknown;
    templateCount?: number | null;
    countError?: unknown;
  }) => {
    placesStub = makePlacesQueryStub({ data: opts.placeRow ?? null, error: null });
    countStub = makeCountQueryStub({
      count: opts.templateCount ?? 0,
      error: opts.countError ?? null,
    });
    const supabaseUser = { from: vi.fn(() => placesStub) };
    const supabaseAdmin = { from: vi.fn(() => countStub) };
    service = new PlacesService(
      supabaseUser as unknown as SupabaseClient,
      supabaseAdmin as unknown as SupabaseClient,
      null,
    );
    // biome-ignore lint/suspicious/noExplicitAny: test access to private logger
    vi.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the taxonomy row when places has one (no count query)', async () => {
    buildService({
      placeRow: {
        id: 42,
        kind: 'country',
        name: 'Italy',
        country_code: 'IT',
        region_code: null,
        route_count: 12,
      },
    });

    const place = await service.browseCountryBySlug('it');

    expect(place).toMatchObject({ name: 'Italy', countryCode: 'IT', routeCount: 12 });
    expect(countStub.select).not.toHaveBeenCalled();
  });

  it('synthesizes a country from published trips when places has no row (Sentry MOTOVAULT-WEB-R)', async () => {
    buildService({ templateCount: 4 });

    const place = await service.browseCountryBySlug('br');

    expect(place).toMatchObject({
      name: 'Brazil',
      countryCode: 'BR',
      slug: 'br',
      routeCount: 4,
    });
  });

  it('keeps resolving curated fallback countries even with zero published trips', async () => {
    buildService({ templateCount: 0 });

    const place = await service.browseCountryBySlug('se');

    expect(place).toMatchObject({ name: 'Sweden', countryCode: 'SE', routeCount: 0 });
  });

  it('returns null for a real country with no places row and no published trips', async () => {
    buildService({ templateCount: 0 });

    expect(await service.browseCountryBySlug('bt')).toBeNull();
  });

  it('returns null for unassigned or malformed codes without querying trips', async () => {
    buildService({ templateCount: 99 });

    expect(await service.browseCountryBySlug('zz')).toBeNull();
    expect(await service.browseCountryBySlug('not-a-code')).toBeNull();
    expect(countStub.select).not.toHaveBeenCalled();
  });

  it('throws when the template count query fails, instead of baking a 404 into ISR', async () => {
    buildService({ countError: { message: 'connection reset' } });

    await expect(service.browseCountryBySlug('br')).rejects.toThrow(InternalServerErrorException);
  });
});
