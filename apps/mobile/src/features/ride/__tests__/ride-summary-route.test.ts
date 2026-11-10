// The ride summary's map line, built from the ride's recorded points.
import { palette } from '@motovault/design-system';
import { buildSummaryRoute } from '../ride-summary-route';

const point = (latitude: number, longitude: number, speedMps: number) => ({
  latitude,
  longitude,
  speedMps,
});

describe('buildSummaryRoute', () => {
  it('has no line with fewer than two points', () => {
    expect(buildSummaryRoute([])).toBeNull();
    expect(buildSummaryRoute([point(42, -2, 10)])).toBeNull();
  });

  it('draws the points in order, padded bounds, start and end', () => {
    const route = buildSummaryRoute([
      point(42, -2, 5),
      point(42.1, -1.9, 15),
      point(42.2, -1.8, 30),
    ]);
    expect(route?.geojson.features[0].geometry).toEqual({
      type: 'LineString',
      coordinates: [
        [-2, 42],
        [-1.9, 42.1],
        [-1.8, 42.2],
      ],
    });
    expect(route?.startPoint).toEqual([-2, 42]);
    expect(route?.endPoint).toEqual([-1.8, 42.2]);
    expect(route?.bounds.sw[0]).toBeCloseTo(-2.005);
    expect(route?.bounds.ne[1]).toBeCloseTo(42.205);
  });

  it('colours the line by speed band, from start to end', () => {
    // 5 m/s = 18 km/h (slow), 15 m/s = 54 km/h (medium), 30 m/s = 108 km/h (fast).
    const route = buildSummaryRoute([
      point(42, -2, 5),
      point(42.1, -1.9, 15),
      point(42.2, -1.8, 30),
    ]);
    expect(route?.colorStops).toEqual([
      [0, palette.speedSlow],
      [0.5, palette.speedMedium],
      [1, palette.speedFast],
    ]);
  });
});
