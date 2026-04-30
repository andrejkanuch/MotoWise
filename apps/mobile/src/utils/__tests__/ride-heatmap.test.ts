import {
  buildAnnualRecap,
  buildHeatmapFeatureCollection,
  buildLifetimeTotals,
  decodePolyline,
  encodePolyline,
} from '../ride-heatmap';

describe('decodePolyline', () => {
  it('decodes the canonical Mapbox example', () => {
    // Classic Google-encoded polyline example from the reference doc.
    const encoded = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';
    const decoded = decodePolyline(encoded);
    expect(decoded).toEqual([
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
    ]);
  });

  it('returns empty array for empty input', () => {
    expect(decodePolyline('')).toEqual([]);
  });
});

describe('encodePolyline', () => {
  it('encodes the canonical example and round-trips with decode', () => {
    const points: [number, number][] = [
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
    ];
    const encoded = encodePolyline(points);
    expect(encoded).toBe('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    expect(decodePolyline(encoded)).toEqual(points);
  });

  it('returns empty string for empty input', () => {
    expect(encodePolyline([])).toBe('');
  });

  it('round-trips arbitrary coordinates', () => {
    const points: [number, number][] = [
      [48.8566, 2.3522],
      [48.8584, 2.2945],
      [48.8738, 2.295],
    ];
    const decoded = decodePolyline(encodePolyline(points));
    for (let i = 0; i < points.length; i++) {
      expect(decoded[i][0]).toBeCloseTo(points[i][0], 4);
      expect(decoded[i][1]).toBeCloseTo(points[i][1], 4);
    }
  });
});

describe('buildHeatmapFeatureCollection', () => {
  const encoded = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';

  it('drops rides without a polyline and flips to lng/lat ordering', () => {
    const fc = buildHeatmapFeatureCollection([
      { id: 'r1', startedAt: '2026-01-01', routePolyline: encoded, distanceM: 100 },
      { id: 'r2', startedAt: '2026-01-01', routePolyline: null, distanceM: 50 },
    ]);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].properties.rideId).toBe('r1');
    // decodePolyline produced [lat, lng], GeoJSON must be [lng, lat].
    expect(fc.features[0].geometry.coordinates[0]).toEqual([-120.2, 38.5]);
  });
});

describe('buildAnnualRecap', () => {
  const rides = [
    {
      id: 'r1',
      startedAt: '2025-06-01T10:00:00Z',
      distanceM: 120_000,
      region: 'DE',
      name: 'Harz loop',
    },
    {
      id: 'r2',
      startedAt: '2025-08-15T10:00:00Z',
      distanceM: 80_000,
      region: 'AT',
      name: 'Grossglockner',
    },
    {
      id: 'r3',
      startedAt: '2024-05-01T10:00:00Z',
      distanceM: 999_999,
      region: 'CH',
      name: 'Prior year',
    },
  ];

  it('scopes to the given year and picks the longest ride', () => {
    const recap = buildAnnualRecap(rides, 2025);
    expect(recap).toMatchObject({
      year: 2025,
      rideCount: 2,
      totalDistanceM: 200_000,
      countries: ['AT', 'DE'],
      longestRide: { id: 'r1', distanceM: 120_000, name: 'Harz loop' },
    });
  });

  it('returns zeroes when the year is empty', () => {
    const recap = buildAnnualRecap(rides, 2020);
    expect(recap.rideCount).toBe(0);
    expect(recap.totalDistanceM).toBe(0);
    expect(recap.countries).toEqual([]);
    expect(recap.longestRide).toBeUndefined();
  });
});

describe('buildLifetimeTotals', () => {
  it('aggregates every ride and dedupes countries', () => {
    const totals = buildLifetimeTotals([
      { id: 'r1', startedAt: '2025-06-01', distanceM: 120_000, region: 'DE' },
      { id: 'r2', startedAt: '2024-05-01', distanceM: 100_000, region: 'DE' },
      { id: 'r3', startedAt: '2023-03-01', distanceM: 80_000, region: 'AT' },
    ]);
    expect(totals).toEqual({
      rideCount: 3,
      totalDistanceM: 300_000,
      countries: ['AT', 'DE'],
    });
  });
});
