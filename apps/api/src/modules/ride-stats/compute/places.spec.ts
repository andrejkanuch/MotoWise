import { describe, expect, it, vi } from 'vitest';
import { createPlacesLookup, PLACES_RPC, placesFromRpc } from './places';

const READY = (countries: Array<{ iso_a2: string; core_m: number; first_at: number }>) => ({
  reference_ready: true,
  countries,
  start_place: { name: 'Logroño', iso_a2: 'ES', admin1_code: '27' },
  end_place: { name: 'Haro', iso_a2: 'ES', admin1_code: '27' },
});

describe('placesFromRpc', () => {
  it('a route 300 m into France counts Spain only (it never reaches 500 m inside France)', () => {
    // The helper measures route length inside each country's 500 m-shrunk core.
    const result = placesFromRpc(
      READY([
        { iso_a2: 'ES', core_m: 41_000, first_at: 0 },
        { iso_a2: 'FR', core_m: 0, first_at: 0.6 },
      ]),
    );
    expect(result).toEqual({
      countries: ['ES'],
      startRegion: 'ES.27',
      startPlace: 'Logroño',
      endPlace: 'Haro',
    });
  });

  it('counts a country only with at least 1 km inside its core, in order of first entry', () => {
    const result = placesFromRpc(
      READY([
        { iso_a2: 'FR', core_m: 1_200, first_at: 0.7 },
        { iso_a2: 'AD', core_m: 900, first_at: 0.5 },
        { iso_a2: 'ES', core_m: 30_000, first_at: 0 },
      ]),
    );
    expect(result).not.toBe('reference_missing');
    expect(result !== 'reference_missing' && result.countries).toEqual(['ES', 'FR']);
  });

  it('has no region or towns when no place lies within 25 km', () => {
    const result = placesFromRpc({
      reference_ready: true,
      countries: [],
      start_place: null,
      end_place: null,
    });
    expect(result).toEqual({ countries: [], startRegion: null, startPlace: null, endPlace: null });
  });

  it('reports the reference data as missing when the helper says it is not loaded', () => {
    expect(
      placesFromRpc({ reference_ready: false, countries: [], start_place: null, end_place: null }),
    ).toBe('reference_missing');
  });
});

describe('createPlacesLookup', () => {
  it('calls the helper with the route as EWKT and the start and end points', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: READY([]), error: null });
    const lookup = createPlacesLookup({ rpc } as never);
    await lookup([
      { lat: 42.46, lng: -2.44 },
      { lat: 42.57, lng: -2.85 },
    ]);
    expect(rpc).toHaveBeenCalledWith(PLACES_RPC, {
      p_route: 'SRID=4326;LINESTRING(-2.440000 42.460000,-2.850000 42.570000)',
      p_start_lat: 42.46,
      p_start_lng: -2.44,
      p_end_lat: 42.57,
      p_end_lng: -2.85,
    });
  });

  it('throws when the helper fails', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } });
    const lookup = createPlacesLookup({ rpc } as never);
    await expect(
      lookup([
        { lat: 1, lng: 1 },
        { lat: 2, lng: 2 },
      ]),
    ).rejects.toThrow('boom');
  });
});
