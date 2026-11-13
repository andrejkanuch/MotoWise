import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { WeatherForecast } from './models/weather-forecast.model';

/**
 * Open-Meteo's customer endpoint. The free `api.open-meteo.com` endpoint is
 * licensed for non-commercial use only (issue 272), so this service never
 * falls back to it.
 */
export const OPEN_METEO_FORECAST_URL = 'https://customer-api.open-meteo.com/v1/forecast';

const DAILY_FIELDS =
  'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code';
const FORECAST_DAYS = 5;
const CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_CACHE_ENTRIES = 2_000;
const REQUEST_TIMEOUT_MS = 10_000;

const WEATHER_UNAVAILABLE_MESSAGE = 'Weather forecast is unavailable';

interface OpenMeteoDaily {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_probability_max: Array<number | null>;
  weather_code: number[];
}

interface CacheEntry {
  data: WeatherForecast;
  expiresAt: number;
}

/**
 * Rounds to 0.1° (about 11 km). Riders in the same area share one cache entry
 * and one upstream call, and the provider never gets a precise location.
 */
export function roundCoordinate(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Proxies the daily forecast from Open-Meteo's paid plan. The key
 * (OPEN_METEO_API_KEY) stays on the server. With no key the query answers
 * SERVICE_UNAVAILABLE, which the app treats as "no weather".
 */
@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly config: ConfigService) {}

  async getForecast(lat: number, lon: number): Promise<WeatherForecast> {
    const apiKey = this.config.get<string>('OPEN_METEO_API_KEY');
    if (!apiKey) throw new ServiceUnavailableException(WEATHER_UNAVAILABLE_MESSAGE);

    const point = { lat: roundCoordinate(lat), lon: roundCoordinate(lon) };
    const cacheKey = `${point.lat},${point.lon}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) return cached.data;

    const forecast = await this.fetchForecast(point, apiKey);

    this.cache.delete(cacheKey);
    if (this.cache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    this.cache.set(cacheKey, { data: forecast, expiresAt: Date.now() + CACHE_TTL_MS });
    return forecast;
  }

  private async fetchForecast(
    point: { lat: number; lon: number },
    apiKey: string,
  ): Promise<WeatherForecast> {
    const params = new URLSearchParams({
      latitude: String(point.lat),
      longitude: String(point.lon),
      daily: DAILY_FIELDS,
      timezone: 'auto',
      forecast_days: String(FORECAST_DAYS),
      apikey: apiKey,
    });

    let response: Response;
    try {
      response = await fetch(`${OPEN_METEO_FORECAST_URL}?${params}`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      // The URL holds the key, so the fetch error is not logged.
      this.logger.warn('Open-Meteo forecast request did not complete');
      throw new ServiceUnavailableException(WEATHER_UNAVAILABLE_MESSAGE);
    }

    if (!response.ok) {
      // A 401 or 403 means the key is wrong or the plan has lapsed.
      this.logger.error(`Open-Meteo forecast request failed: ${response.status}`);
      throw new ServiceUnavailableException(WEATHER_UNAVAILABLE_MESSAGE);
    }

    const { daily } = (await response.json()) as { daily: OpenMeteoDaily };
    return {
      days: daily.time.map((date, i) => ({
        date,
        tempMax: daily.temperature_2m_max[i],
        tempMin: daily.temperature_2m_min[i],
        precipProbability: daily.precipitation_probability_max[i] ?? null,
        weatherCode: daily.weather_code[i],
      })),
    };
  }
}
