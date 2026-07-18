import { type FilteredLocation, gpsFilter, type ProcessResult } from '../ride-gps-filter';

beforeEach(() => {
  gpsFilter.reset();
});

/** Assert an accepted result and return its location for further assertions. */
function expectAccepted(result: ProcessResult): FilteredLocation {
  expect(result.status).toBe('accepted');
  if (result.status !== 'accepted') throw new Error('expected accepted result');
  return result.location;
}

describe('GPSFilter heading sanitization', () => {
  const baseArgs = {
    lat: 45.5,
    lng: -122.6,
    alt: 100,
    speed: 10,
    accuracy: 5,
    ts: Date.now(),
  };

  const headingCases: Array<{ name: string; input: number | null | undefined; expected: number | null }> = [
    { name: 'passes valid heading through (0–360)', input: 180, expected: 180 },
    { name: 'passes heading 0 through', input: 0, expected: 0 },
    { name: 'passes heading 360 through', input: 360, expected: 360 },
    { name: 'converts heading -1 (GPS unavailable) to null', input: -1, expected: null },
    { name: 'converts any negative heading to null', input: -45, expected: null },
    { name: 'converts null heading to null', input: null, expected: null },
    { name: 'converts undefined heading to null', input: undefined, expected: null },
  ];

  for (const { name, input, expected } of headingCases) {
    it(name, () => {
      const result = gpsFilter.process(
        baseArgs.lat,
        baseArgs.lng,
        baseArgs.alt,
        baseArgs.speed,
        input,
        baseArgs.accuracy,
        baseArgs.ts,
      );
      const location = expectAccepted(result);
      expect(location.heading).toBe(expected);
    });
  }
});

describe('GPSFilter process status classification (U5: speed → 0 on stop)', () => {
  const lat = 45.5;
  const lng = -122.6;

  it('classifies a normal moving sample as accepted', () => {
    const result = gpsFilter.process(lat, lng, 100, 10, 90, 5, 1000);
    const location = expectAccepted(result);
    expect(location.speed).toBeGreaterThan(0);
  });

  it('classifies a stopped rider (low speed, no displacement) as stationary', () => {
    // First an accepted moving point establishes lastAccepted.
    gpsFilter.process(lat, lng, 100, 10, 90, 5, 1000);
    // Then a run of zero-speed samples at the same spot. The speed smoother lags
    // one or two samples, so stationary fires once the smoothed speed decays < 1.
    let result = gpsFilter.process(lat, lng, 100, 0, null, 5, 2000);
    for (let t = 3000; t <= 6000; t += 1000) {
      result = gpsFilter.process(lat, lng, 100, 0, null, 5, t);
    }
    expect(result.status).toBe('stationary');
  });

  it('classifies a poor-accuracy sample as rejected (not stationary)', () => {
    const result = gpsFilter.process(lat, lng, 100, 0, null, 80, 1000);
    expect(result.status).toBe('rejected');
  });

  it('classifies an impossible teleport as rejected', () => {
    gpsFilter.process(lat, lng, 100, 10, 90, 5, 1000);
    // ~1.5 km jump in 1s → far above the 90 m/s teleport gate.
    const result = gpsFilter.process(lat + 0.015, lng, 100, 10, 90, 5, 2000);
    expect(result.status).toBe('rejected');
  });

  it('does not corrupt distance across a stop (R8: anchor held during stationary run)', () => {
    // A: accepted anchor.
    gpsFilter.process(lat, lng, 100, 10, 90, 5, 1000);
    // A run of stationary samples at the same spot. These must not add phantom
    // distance or leave a drifted anchor.
    for (let t = 2000; t <= 6000; t += 1000) {
      gpsFilter.process(lat, lng, 100, 0, null, 5, t);
    }
    // B: a real ~100m move north (0.0009° lat ≈ 100m). segmentDistance must be
    // the real geographic distance measured from A — not zero, not inflated.
    const b = expectAccepted(gpsFilter.process(lat + 0.0009, lng, 100, 10, 90, 5, 7000));
    expect(b.segmentDistance).toBeGreaterThan(70);
    expect(b.segmentDistance).toBeLessThan(130);
  });

  it('does not change max speed on a stationary sample', () => {
    gpsFilter.process(lat, lng, 100, 10, 90, 5, 1000);
    const maxBefore = gpsFilter.stats.maxSpeed;
    gpsFilter.process(lat + 0.000001, lng, 100, 0, null, 5, 2000);
    expect(gpsFilter.stats.maxSpeed).toBe(maxBefore);
  });
});
