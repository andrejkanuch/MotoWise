const mockRequestPermissions = jest.fn();
const mockGetLastKnown = jest.fn();
const mockGetCurrent = jest.fn();

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: () => mockRequestPermissions(),
  getLastKnownPositionAsync: () => mockGetLastKnown(),
  getCurrentPositionAsync: (opts: unknown) => mockGetCurrent(opts),
  Accuracy: { Low: 1 },
}));

// react-query is imported by the hook module; stub so importing doesn't pull native deps.
jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn() }));

import { resolveWeatherLocation } from '../use-weather-forecast';

const point = (lat: number, lon: number) => ({ coords: { latitude: lat, longitude: lon } });

beforeEach(() => {
  mockRequestPermissions.mockReset();
  mockGetLastKnown.mockReset();
  mockGetCurrent.mockReset();
});

describe('resolveWeatherLocation', () => {
  it('returns denied (no coords) when permission is not granted', async () => {
    mockRequestPermissions.mockResolvedValue({ status: 'denied' });
    await expect(resolveWeatherLocation()).resolves.toEqual({ status: 'denied', coords: null });
    expect(mockGetCurrent).not.toHaveBeenCalled();
  });

  it('uses the last known position when available (no live fix needed)', async () => {
    mockRequestPermissions.mockResolvedValue({ status: 'granted' });
    mockGetLastKnown.mockResolvedValue(point(40.1, -74.2));
    await expect(resolveWeatherLocation()).resolves.toEqual({
      status: 'granted',
      coords: { lat: 40.1, lon: -74.2 },
    });
    expect(mockGetCurrent).not.toHaveBeenCalled();
  });

  it('falls back to a live fix when no last known position exists', async () => {
    mockRequestPermissions.mockResolvedValue({ status: 'granted' });
    mockGetLastKnown.mockResolvedValue(null);
    mockGetCurrent.mockResolvedValue(point(51.5, -0.1));
    await expect(resolveWeatherLocation()).resolves.toEqual({
      status: 'granted',
      coords: { lat: 51.5, lon: -0.1 },
    });
  });

  it('returns unavailable instead of rejecting when GPS cannot get a fix (MOTO-VAULT-REACT-NATIVE-19)', async () => {
    mockRequestPermissions.mockResolvedValue({ status: 'granted' });
    mockGetLastKnown.mockResolvedValue(null);
    mockGetCurrent.mockRejectedValue(
      new Error('Current location is unavailable. Make sure that location services are enabled'),
    );
    // The promise must RESOLVE (never reject) so the unawaited caller can't leak.
    await expect(resolveWeatherLocation()).resolves.toEqual({
      status: 'unavailable',
      coords: null,
    });
  });

  it('returns unavailable when the permission request itself throws', async () => {
    mockRequestPermissions.mockRejectedValue(new Error('boom'));
    await expect(resolveWeatherLocation()).resolves.toEqual({
      status: 'unavailable',
      coords: null,
    });
  });
});
