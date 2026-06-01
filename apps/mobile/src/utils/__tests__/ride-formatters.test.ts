import {
  distanceUnitLabel,
  formatDistance,
  formatDistanceValue,
  formatDuration,
  formatElapsed,
  formatElevation,
  formatSpeed,
  formatSpeedValue,
  speedUnitLabel,
} from '../ride-formatters';

describe('formatDistance', () => {
  it('uses one decimal under 10 units and rounds at/above (metric)', () => {
    expect(formatDistance(5000)).toBe('5.0 km'); // 5 km < 10 → 1 decimal
    expect(formatDistance(42000)).toBe('42 km'); // 42 km >= 10 → rounded
  });

  it('converts to miles for imperial with the same <10 boundary', () => {
    expect(formatDistance(1609.34, 'imperial')).toBe('1.0 mi');
    expect(formatDistance(50000, 'imperial')).toBe('31 mi'); // 50000/1609.34 ≈ 31.07
  });

  it('formatDistanceValue omits the unit suffix', () => {
    expect(formatDistanceValue(5000)).toBe('5.0');
    expect(formatDistanceValue(42000, 'imperial')).toBe('26'); // 42000/1609.34 ≈ 26.1
  });

  it('distanceUnitLabel reflects the system', () => {
    expect(distanceUnitLabel()).toBe('km');
    expect(distanceUnitLabel('imperial')).toBe('mi');
  });
});

describe('formatSpeed', () => {
  it('converts m/s to km/h (×3.6) for metric', () => {
    expect(formatSpeed(10)).toBe('36 km/h');
    expect(formatSpeedValue(10)).toBe(36);
  });

  it('converts m/s to mph (×2.237) for imperial', () => {
    expect(formatSpeed(10, 'imperial')).toBe('22 mph');
    expect(formatSpeedValue(10, 'imperial')).toBe(22);
    expect(speedUnitLabel('imperial')).toBe('mph');
  });
});

describe('formatElevation', () => {
  it('rounds meters for metric and converts to feet (×3.281) for imperial', () => {
    expect(formatElevation(123.4)).toBe('123 m');
    expect(formatElevation(100, 'imperial')).toBe('328 ft');
  });
});

describe('formatDuration / formatElapsed', () => {
  it('formats duration as "Xh Ym" or "Ym"', () => {
    expect(formatDuration(3661)).toBe('1h 1m');
    expect(formatDuration(120)).toBe('2m');
    expect(formatDuration(0)).toBe('0m');
  });

  it('formats elapsed as zero-padded HH:MM:SS', () => {
    expect(formatElapsed(3661)).toBe('01:01:01');
    expect(formatElapsed(59)).toBe('00:00:59');
  });
});
