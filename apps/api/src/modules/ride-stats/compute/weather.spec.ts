import { describe, expect, it, vi } from 'vitest';
import { fetchRideWeather, isWeatherEnabled, WEATHER_ENABLED_ENV } from './weather';

describe('isWeatherEnabled', () => {
  it('is off unless the flag is exactly "true" and a key is set', () => {
    const config = (values: Record<string, string>) => ({ get: (k: string) => values[k] });
    expect(isWeatherEnabled(config({}))).toBe(false);
    expect(isWeatherEnabled(config({ [WEATHER_ENABLED_ENV]: 'true' }))).toBe(false);
    expect(
      isWeatherEnabled(config({ [WEATHER_ENABLED_ENV]: 'yes', OPEN_METEO_API_KEY: 'k' })),
    ).toBe(false);
    expect(
      isWeatherEnabled(config({ [WEATHER_ENABLED_ENV]: 'true', OPEN_METEO_API_KEY: 'k' })),
    ).toBe(true);
  });
});

describe('fetchRideWeather', () => {
  it('summarises the hours the ride spans: min and max temperature, and wet with any rain', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        hourly: {
          time: ['2026-06-06T08:00', '2026-06-06T09:00', '2026-06-06T10:00'],
          temperature_2m: [14.2, 17.8, 19.1],
          precipitation: [0, 0.4, 0],
        },
      }),
    });
    const result = await fetchRideWeather(
      {
        start: { lat: 42.46, lng: -2.44 },
        startedAt: '2026-06-06T08:10:00Z',
        endedAt: '2026-06-06T10:20:00Z',
        apiKey: 'key',
      },
      fetchFn,
    );
    const url = new URL(fetchFn.mock.calls[0][0]);
    expect(url.host).toBe('customer-api.open-meteo.com');
    expect(url.searchParams.get('start_hour')).toBe('2026-06-06T08:00');
    expect(url.searchParams.get('end_hour')).toBe('2026-06-06T10:00');
    expect(url.searchParams.get('apikey')).toBe('key');
    expect(result).toEqual({
      tempMinC: 14.2,
      tempMaxC: 19.1,
      wet: true,
      weather: {
        source: 'open-meteo',
        hours: [
          { time: '2026-06-06T08:00', temperatureC: 14.2, precipitationMm: 0 },
          { time: '2026-06-06T09:00', temperatureC: 17.8, precipitationMm: 0.4 },
          { time: '2026-06-06T10:00', temperatureC: 19.1, precipitationMm: 0 },
        ],
      },
    });
  });

  it('gives null when the service fails', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    const result = await fetchRideWeather(
      {
        start: { lat: 1, lng: 1 },
        startedAt: '2026-06-06T08:10:00Z',
        endedAt: '2026-06-06T09:00:00Z',
        apiKey: 'k',
      },
      fetchFn,
    );
    expect(result).toBeNull();
  });
});
