/**
 * Pins the weather data path (issue 272): the forecast comes from the API's
 * `weatherForecast` proxy, never from a provider called on the device. The
 * unlicensed free Open-Meteo endpoint must not come back.
 */

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Low: 1 },
}));

// These tests pin the enabled path, so they run with weather forced ON. The
// real build ships it OFF; see weather-disabled.test.ts.
jest.mock('../../config/feature-flags', () => ({ WEATHER_ENABLED: true }));

// react-query is imported by the hook module; stub so importing doesn't pull native deps.
jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn() }));

const mockGqlFetcher = jest.fn();
jest.mock('../../lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockGqlFetcher(...args),
}));

import { GetWeatherForecastDocument } from '@motovault/graphql';
import { fetchForecast } from '../use-weather-forecast';

const COORDS = { lat: 48.2, lon: 16.4 };

const day = (date: string, weatherCode: number, precipProbability: number | null = 10) => ({
  date,
  tempMax: 14.4,
  tempMin: 6,
  precipProbability,
  weatherCode,
});

let fetchSpy: jest.Mock;

beforeEach(() => {
  fetchSpy = jest.fn();
  global.fetch = fetchSpy as unknown as typeof fetch;
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('fetchForecast', () => {
  it('reads the forecast through the API proxy and makes no direct provider request', async () => {
    mockGqlFetcher.mockResolvedValue({ weatherForecast: { days: [day('2026-11-09', 1)] } });

    await fetchForecast(COORDS);

    expect(mockGqlFetcher).toHaveBeenCalledWith(GetWeatherForecastDocument, {
      input: { lat: 48.2, lon: 16.4 },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('builds the summary from the proxied days', async () => {
    // 2026-11-09 is a Monday; the weekend (14th, 15th) is wet.
    mockGqlFetcher.mockResolvedValue({
      weatherForecast: {
        days: [
          day('2026-11-09', 1),
          day('2026-11-10', 2),
          day('2026-11-11', 61, null),
          day('2026-11-14', 0),
          day('2026-11-15', 63),
        ],
      },
    });

    const summary = await fetchForecast(COORDS);

    expect(summary.headline).toBe('Monday · 14°C · Dry through Tue');
    expect(summary.isGoodWeekend).toBe(false);
    expect(summary.days[0]).toMatchObject({ tempMax: 14.4, precipProbability: 10, label: 'Clear' });
    expect(summary.days[2]).toMatchObject({ precipProbability: null, label: 'Rain' });
  });

  it('passes an API error through unchanged so the global handler can classify it', async () => {
    const error = Object.assign(new Error('Weather forecast is unavailable'), {
      response: { errors: [{ extensions: { code: 'SERVICE_UNAVAILABLE' } }] },
    });
    mockGqlFetcher.mockRejectedValue(error);

    await expect(fetchForecast(COORDS)).rejects.toBe(error);
  });
});
