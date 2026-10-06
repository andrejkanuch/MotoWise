/**
 * Issue 272: Open-Meteo's free endpoint is licensed for non-commercial use only,
 * so with WEATHER_ENABLED off the app must make ZERO requests to it: no fetch,
 * no react-query query, and no location prompt on the weather's behalf.
 *
 * Uses the REAL feature-flags module (no mock), so flipping the shipped switch
 * back to `true` fails this test and forces a deliberate update alongside a
 * licensed provider.
 */

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Low: 1 },
}));

jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn() }));

import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { WEATHER_ENABLED } from '../../config/feature-flags';
import {
  fetchForecast,
  useWeatherForecast,
  WEATHER_DISABLED_MESSAGE,
} from '../use-weather-forecast';

const COORDS = { lat: 48.2, lon: 16.4 };

let fetchSpy: jest.Mock;

beforeEach(() => {
  fetchSpy = jest.fn();
  global.fetch = fetchSpy as unknown as typeof fetch;
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('weather disabled (issue 272)', () => {
  it('ships with the switch off', () => {
    expect(WEATHER_ENABLED).toBe(false);
  });

  it('useWeatherForecast returns a disabled state without querying, locating or fetching', () => {
    // The disabled implementation uses no React hooks, so it can be called directly.
    const result = useWeatherForecast();

    expect(result).toMatchObject({
      enabled: false,
      data: undefined,
      isLoading: false,
      coords: null,
    });
    result.requestPermission();

    expect(useQuery).not.toHaveBeenCalled();
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(Location.getForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fetchForecast refuses to call the provider', async () => {
    await expect(fetchForecast(COORDS)).rejects.toThrow(WEATHER_DISABLED_MESSAGE);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
