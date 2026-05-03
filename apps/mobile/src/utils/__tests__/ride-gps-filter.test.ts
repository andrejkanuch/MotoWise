import { gpsFilter } from '../ride-gps-filter';

beforeEach(() => {
  gpsFilter.reset();
});

describe('GPSFilter heading sanitization', () => {
  const baseArgs = {
    lat: 45.5,
    lng: -122.6,
    alt: 100,
    speed: 10,
    accuracy: 5,
    ts: Date.now(),
  };

  it('passes valid heading through (0–360)', () => {
    const result = gpsFilter.process(
      baseArgs.lat,
      baseArgs.lng,
      baseArgs.alt,
      baseArgs.speed,
      180,
      baseArgs.accuracy,
      baseArgs.ts,
    );
    expect(result).not.toBeNull();
    expect(result?.heading).toBe(180);
  });

  it('passes heading 0 through', () => {
    const result = gpsFilter.process(
      baseArgs.lat,
      baseArgs.lng,
      baseArgs.alt,
      baseArgs.speed,
      0,
      baseArgs.accuracy,
      baseArgs.ts,
    );
    expect(result).not.toBeNull();
    expect(result?.heading).toBe(0);
  });

  it('passes heading 360 through', () => {
    const result = gpsFilter.process(
      baseArgs.lat,
      baseArgs.lng,
      baseArgs.alt,
      baseArgs.speed,
      360,
      baseArgs.accuracy,
      baseArgs.ts,
    );
    expect(result).not.toBeNull();
    expect(result?.heading).toBe(360);
  });

  it('converts heading -1 (GPS unavailable) to null', () => {
    const result = gpsFilter.process(
      baseArgs.lat,
      baseArgs.lng,
      baseArgs.alt,
      baseArgs.speed,
      -1,
      baseArgs.accuracy,
      baseArgs.ts,
    );
    expect(result).not.toBeNull();
    expect(result?.heading).toBeNull();
  });

  it('converts any negative heading to null', () => {
    const result = gpsFilter.process(
      baseArgs.lat,
      baseArgs.lng,
      baseArgs.alt,
      baseArgs.speed,
      -45,
      baseArgs.accuracy,
      baseArgs.ts,
    );
    expect(result).not.toBeNull();
    expect(result?.heading).toBeNull();
  });

  it('converts null heading to null', () => {
    const result = gpsFilter.process(
      baseArgs.lat,
      baseArgs.lng,
      baseArgs.alt,
      baseArgs.speed,
      null,
      baseArgs.accuracy,
      baseArgs.ts,
    );
    expect(result).not.toBeNull();
    expect(result?.heading).toBeNull();
  });

  it('converts undefined heading to null', () => {
    const result = gpsFilter.process(
      baseArgs.lat,
      baseArgs.lng,
      baseArgs.alt,
      baseArgs.speed,
      undefined,
      baseArgs.accuracy,
      baseArgs.ts,
    );
    expect(result).not.toBeNull();
    expect(result?.heading).toBeNull();
  });
});
