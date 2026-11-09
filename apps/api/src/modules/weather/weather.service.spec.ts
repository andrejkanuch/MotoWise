import 'reflect-metadata';
import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OPEN_METEO_FORECAST_URL, roundCoordinate, WeatherService } from './weather.service';

const KEY = 'om_test_key';

const DAILY = {
  time: ['2026-11-09', '2026-11-10'],
  temperature_2m_max: [14.2, 11.8],
  temperature_2m_min: [6.1, 4.9],
  precipitation_probability_max: [10, null],
  weather_code: [1, 61],
};

function makeService(env: Record<string, string | undefined> = { OPEN_METEO_API_KEY: KEY }) {
  const config = { get: (k: string) => env[k] } as unknown as ConfigService;
  return new WeatherService(config);
}

let fetchMock: ReturnType<typeof vi.fn>;

function respond(status: number, body: unknown = { daily: DAILY }) {
  fetchMock.mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

function requestedUrl(call = 0): URL {
  return new URL(fetchMock.mock.calls[call][0] as string);
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('WeatherService', () => {
  it('calls the licensed customer endpoint with the key and the rounded point', async () => {
    respond(200);
    await makeService().getForecast(48.2082, 16.3738);

    const url = requestedUrl();
    expect(`${url.origin}${url.pathname}`).toBe(OPEN_METEO_FORECAST_URL);
    expect(url.hostname).not.toBe('api.open-meteo.com');
    expect(url.searchParams.get('apikey')).toBe(KEY);
    expect(url.searchParams.get('latitude')).toBe('48.2');
    expect(url.searchParams.get('longitude')).toBe('16.4');
    expect(url.searchParams.get('forecast_days')).toBe('5');
    expect(url.searchParams.get('timezone')).toBe('auto');
  });

  it('maps the daily arrays to days, keeping a missing precipitation value as null', async () => {
    respond(200);
    await expect(makeService().getForecast(48.2, 16.4)).resolves.toEqual({
      days: [
        { date: '2026-11-09', tempMax: 14.2, tempMin: 6.1, precipProbability: 10, weatherCode: 1 },
        {
          date: '2026-11-10',
          tempMax: 11.8,
          tempMin: 4.9,
          precipProbability: null,
          weatherCode: 61,
        },
      ],
    });
  });

  it('serves riders in the same 0.1° cell from one upstream call until the cache expires', async () => {
    vi.useFakeTimers();
    respond(200);
    const service = makeService();

    await service.getForecast(48.21, 16.37);
    await service.getForecast(48.24, 16.41);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await service.getForecast(48.31, 16.37);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(30 * 60 * 1000 + 1);
    await service.getForecast(48.21, 16.37);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('refuses without a key and never calls a provider', async () => {
    await expect(makeService({}).getForecast(48.2, 16.4)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    401, 429, 503,
  ])('answers SERVICE_UNAVAILABLE on HTTP %i and caches nothing', async (status) => {
    respond(status);
    const service = makeService();

    await expect(service.getForecast(48.2, 16.4)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    respond(200);
    await service.getForecast(48.2, 16.4);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('answers SERVICE_UNAVAILABLE when the request does not complete', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    await expect(makeService().getForecast(48.2, 16.4)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});

describe('roundCoordinate', () => {
  it.each([
    [48.2082, 48.2],
    [16.35, 16.4],
    [-33.86, -33.9],
    [0.04, 0],
  ])('%d → %d', (value, expected) => {
    expect(roundCoordinate(value)).toBeCloseTo(expected, 10);
  });
});
