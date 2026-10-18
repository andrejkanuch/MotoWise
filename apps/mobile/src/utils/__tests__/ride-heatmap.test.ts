import type { TFunction } from 'i18next';
import {
  buildAnnualRecap,
  buildHeatmapFeatureCollection,
  buildLifetimeTotals,
  buildRecapShareMessage,
  decodePolyline,
  encodePolyline,
  heatmapBounds,
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

describe('heatmapBounds', () => {
  it('frames every ridden line in [lng, lat]', () => {
    const fc = buildHeatmapFeatureCollection([
      {
        id: 'a',
        startedAt: '2026-05-01T10:00:00Z',
        routePolyline: encodePolyline([
          [38.5, -120.2],
          [40.7, -120.95],
        ]),
      },
      {
        id: 'b',
        startedAt: '2026-06-01T10:00:00Z',
        routePolyline: encodePolyline([
          [36.1, -115.1],
          [36.2, -115.3],
        ]),
      },
    ]);
    const bounds = heatmapBounds(fc);
    expect(bounds?.paddingTop).toBe(40);
    expect(bounds?.ne[0]).toBeCloseTo(-115.1, 4);
    expect(bounds?.ne[1]).toBeCloseTo(40.7, 4);
    expect(bounds?.sw[0]).toBeCloseTo(-120.95, 4);
    expect(bounds?.sw[1]).toBeCloseTo(36.1, 4);
  });

  it('is null when no ride has a line', () => {
    expect(heatmapBounds({ type: 'FeatureCollection', features: [] })).toBeNull();
  });
});

describe('buildRecapShareMessage', () => {
  const fakeT = ((key: string, opts?: Record<string, unknown>) =>
    `${key}${opts ? ` ${JSON.stringify(opts)}` : ''}`) as unknown as TFunction;
  const miles = (m: number) => `${Math.round(m / 1609.344)} mi`;

  it('passes counts for pluralisation and formats distance in the rider unit', () => {
    const message = buildRecapShareMessage(
      {
        year: 2026,
        rideCount: 1,
        totalDistanceM: 415_200,
        countries: ['US'],
        longestRide: { id: 'a', distanceM: 415_200, name: 'Tail of the Dragon' },
      },
      fakeT,
      miles,
    );
    expect(message.split('\n')).toEqual([
      'heatmap.shareIntro {"year":2026,"distance":"258 mi","count":1}',
      'heatmap.shareCountries {"count":1,"list":"US"}',
      'heatmap.shareTopRide {"name":"Tail of the Dragon","distance":"258 mi"}',
      'heatmap.shareVia',
    ]);
  });

  it('leaves out countries and the top ride when there are none', () => {
    const message = buildRecapShareMessage(
      { year: 2026, rideCount: 2, totalDistanceM: 0, countries: [] },
      fakeT,
      miles,
    );
    expect(message.split('\n')).toHaveLength(2);
  });
});
