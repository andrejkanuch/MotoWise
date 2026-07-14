import type { RouteResult } from '../mapbox-directions';
import { chunkCoordinates, getRouteSegments } from '../mapbox-directions';

type Coordinate = { lat: number; lng: number };

const makeCoords = (n: number): Coordinate[] =>
  Array.from({ length: n }, (_, i) => ({ lat: i, lng: i }));

/**
 * Build a fake Mapbox Directions response for a request of `n` waypoints:
 * n-1 legs, geometry as a straight line through the n input points, and totals
 * derived from the leg count so stitching math is verifiable.
 */
const mapboxResponse = (coords: Coordinate[]) => {
  const legCount = coords.length - 1;
  return {
    code: 'Ok',
    routes: [
      {
        distance: legCount * 100,
        duration: legCount * 10,
        geometry: {
          type: 'LineString',
          coordinates: coords.map((c) => [c.lng, c.lat]),
        },
        legs: Array.from({ length: legCount }, () => ({ distance: 100, duration: 10 })),
      },
    ],
  };
};

const originalFetch = global.fetch;

beforeEach(() => {
  process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN = 'test-token';
});

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe('chunkCoordinates', () => {
  it('returns a single window when at or under the 25-waypoint cap', () => {
    expect(chunkCoordinates(makeCoords(25))).toHaveLength(1);
    expect(chunkCoordinates(makeCoords(2))).toEqual([makeCoords(2)]);
  });

  it('splits into overlapping windows sharing a boundary waypoint', () => {
    const chunks = chunkCoordinates(makeCoords(49));
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(25); // indices 0..24
    expect(chunks[1]).toHaveLength(25); // indices 24..48
    // Seam: last of window 0 === first of window 1
    expect(chunks[0][chunks[0].length - 1]).toEqual(chunks[1][0]);
  });

  it('never produces a window with fewer than 2 waypoints', () => {
    for (const n of [26, 27, 50, 51, 100]) {
      for (const chunk of chunkCoordinates(makeCoords(n))) {
        expect(chunk.length).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

describe('getRouteSegments', () => {
  it('returns null (does not throw) below the minimum waypoint count', async () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    await expect(getRouteSegments(makeCoords(1))).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('makes a single request for <=25 waypoints', async () => {
    const fetchSpy = jest.fn(async (url: string) => {
      const path = url.split('/driving/')[1].split('?')[0];
      const coords = path.split(';').map((p) => {
        const [lng, lat] = p.split(',').map(Number);
        return { lat, lng };
      });
      return { ok: true, json: async () => mapboxResponse(coords) } as Response;
    });
    global.fetch = fetchSpy as unknown as typeof fetch;

    const result = (await getRouteSegments(makeCoords(10))) as RouteResult;
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.legs).toHaveLength(9);
  });

  it('chunks >25 waypoints and stitches legs, totals, and geometry', async () => {
    const fetchSpy = jest.fn(async (url: string) => {
      const path = url.split('/driving/')[1].split('?')[0];
      const coords = path.split(';').map((p) => {
        const [lng, lat] = p.split(',').map(Number);
        return { lat, lng };
      });
      return { ok: true, json: async () => mapboxResponse(coords) } as Response;
    });
    global.fetch = fetchSpy as unknown as typeof fetch;

    const result = (await getRouteSegments(makeCoords(49))) as RouteResult;

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    // 49 waypoints → 48 legs total, no double counting across the seam.
    expect(result.legs).toHaveLength(48);
    expect(result.totalDistanceM).toBe(48 * 100);
    expect(result.totalDurationS).toBe(48 * 10);
    // Geometry visits every waypoint exactly once (seam de-duplicated).
    expect(result.geometry.coordinates).toHaveLength(49);
    expect(result.geometry.coordinates[0]).toEqual([0, 0]);
    expect(result.geometry.coordinates[48]).toEqual([48, 48]);
  });

  it('returns null if any window fails', async () => {
    let call = 0;
    const fetchSpy = jest.fn(async (url: string) => {
      call += 1;
      if (call === 2)
        return { ok: false, status: 429, statusText: 'Too Many Requests' } as Response;
      const path = url.split('/driving/')[1].split('?')[0];
      const coords = path.split(';').map((p) => {
        const [lng, lat] = p.split(',').map(Number);
        return { lat, lng };
      });
      return { ok: true, json: async () => mapboxResponse(coords) } as Response;
    });
    global.fetch = fetchSpy as unknown as typeof fetch;

    await expect(getRouteSegments(makeCoords(49))).resolves.toBeNull();
  });

  it('returns null when the access token is missing', async () => {
    process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN = '';
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    await expect(getRouteSegments(makeCoords(5))).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
