import type { LatLng } from '../../../common/polyline';

/**
 * Weather at ride time is a separate step with its own marker
 * (`ride_stats.weather_fetched_at`). It stays OFF until the commercial
 * Open-Meteo licence is bought: both the flag and the customer key are needed.
 */
export const WEATHER_ENABLED_ENV = 'RIDE_STATS_WEATHER_ENABLED';
export const WEATHER_API_KEY_ENV = 'OPEN_METEO_API_KEY';

/** Commercial endpoint (the `customer-` host needs the key). Serves the past ~3 months. */
const OPEN_METEO_URL = 'https://customer-api.open-meteo.com/v1/forecast';
/** Any hour with at least this much rain makes the ride wet. */
const WET_PRECIPITATION_MM = 0.2;

export function isWeatherEnabled(config: { get(key: string): string | undefined }): boolean {
  return config.get(WEATHER_ENABLED_ENV) === 'true' && !!config.get(WEATHER_API_KEY_ENV);
}

export interface RideWeather {
  tempMinC: number;
  tempMaxC: number;
  wet: boolean;
  weather: {
    source: 'open-meteo';
    hours: Array<{ time: string; temperatureC: number; precipitationMm: number }>;
  };
}

type FetchFn = (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

/** `YYYY-MM-DDTHH:00` in UTC, the hour the instant falls in. */
function utcHour(iso: string): string {
  return `${new Date(iso).toISOString().slice(0, 13)}:00`;
}

/** Hourly temperature and rain at the start point over the ride's hours (UTC). Null on any failure. */
export async function fetchRideWeather(
  input: { start: LatLng; startedAt: string; endedAt: string; apiKey: string },
  fetchFn: FetchFn = fetch,
): Promise<RideWeather | null> {
  const url = new URL(OPEN_METEO_URL);
  url.searchParams.set('latitude', input.start.lat.toFixed(4));
  url.searchParams.set('longitude', input.start.lng.toFixed(4));
  url.searchParams.set('hourly', 'temperature_2m,precipitation');
  url.searchParams.set('timezone', 'GMT');
  url.searchParams.set('start_hour', utcHour(input.startedAt));
  url.searchParams.set('end_hour', utcHour(input.endedAt));
  url.searchParams.set('apikey', input.apiKey);

  try {
    const response = await fetchFn(url.toString());
    if (!response.ok) return null;
    const body = (await response.json()) as {
      hourly?: { time?: string[]; temperature_2m?: number[]; precipitation?: number[] };
    };
    const time = body.hourly?.time ?? [];
    const temps = body.hourly?.temperature_2m ?? [];
    const rain = body.hourly?.precipitation ?? [];
    const hours = time
      .map((t, i) => ({ time: t, temperatureC: temps[i], precipitationMm: rain[i] ?? 0 }))
      .filter((h) => typeof h.temperatureC === 'number');
    if (hours.length === 0) return null;
    const temperatures = hours.map((h) => h.temperatureC);
    return {
      tempMinC: Math.min(...temperatures),
      tempMaxC: Math.max(...temperatures),
      wet: hours.some((h) => h.precipitationMm >= WET_PRECIPITATION_MM),
      weather: { source: 'open-meteo', hours },
    };
  } catch {
    return null;
  }
}
