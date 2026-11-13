import { GetWeatherForecastDocument } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import { format, isSaturday, isSunday, parseISO } from 'date-fns';
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { WEATHER_ENABLED } from '../config/feature-flags';
import { gqlFetcher } from '../lib/graphql-client';
import { QUERY_CRITICALITY } from '../lib/query-criticality';
import { queryKeys } from '../lib/query-keys';
import { requestForegroundLocationPermission } from '../utils/location-permission';

// --- Public types ---

export interface DayForecast {
  date: Date;
  tempMax: number;
  tempMin: number;
  precipProbability: number | null;
  weatherCode: number;
  label: string;
}

export interface WeatherSummary {
  headline: string;
  days: DayForecast[];
  isGoodWeekend: boolean;
}

// 'unavailable' = permission granted but the device couldn't produce a fix
// (GPS cold start, indoors, low-end hardware). Distinct from 'denied'.
export type LocationStatus = 'pending' | 'granted' | 'denied' | 'unavailable';

export interface Coordinates {
  lat: number;
  lon: number;
}

export interface ResolvedWeatherLocation {
  status: LocationStatus;
  coords: Coordinates | null;
}

/**
 * Resolve the device location for the weather forecast, translating every
 * failure mode into a typed result instead of a rejected promise.
 *
 * expo-location rejects with "Current location is unavailable" when it can't
 * get a fix even with permission granted (GPS cold start, indoors, low-end
 * hardware). Previously that rejection escaped an uncaught `try/finally` and
 * surfaced as an unhandled rejection. (Sentry MOTO-VAULT-REACT-NATIVE-19)
 */
export async function resolveWeatherLocation(): Promise<ResolvedWeatherLocation> {
  try {
    const { status } = await requestForegroundLocationPermission();
    if (status !== 'granted') return { status: 'denied', coords: null };

    const point =
      (await Location.getLastKnownPositionAsync()) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
    return {
      status: 'granted',
      coords: { lat: point.coords.latitude, lon: point.coords.longitude },
    };
  } catch {
    return { status: 'unavailable', coords: null };
  }
}

export interface UseWeatherResult {
  /** False while weather is switched off (WEATHER_ENABLED, issue 272): render nothing. */
  enabled: boolean;
  data: WeatherSummary | undefined;
  isLoading: boolean;
  locationStatus: LocationStatus;
  requestPermission: () => void;
  coords: Coordinates | null;
}

const WMO_THRESHOLDS = [
  { max: 1, label: 'Clear' },
  { max: 3, label: 'Cloudy' },
  { max: 48, label: 'Fog' },
  { max: 57, label: 'Drizzle' },
  { max: 67, label: 'Rain' },
  { max: 77, label: 'Snow' },
  { max: 82, label: 'Showers' },
  { max: 86, label: 'Snow showers' },
  { max: 99, label: 'Thunderstorm' },
] as const;

function weatherCodeToLabel(code: number): string {
  for (const t of WMO_THRESHOLDS) {
    if (code <= t.max) return t.label;
  }
  return 'Unknown';
}

function isDry(code: number): boolean {
  return code <= 3;
}

function buildHeadline(days: DayForecast[]): string {
  if (days.length === 0) return '';

  const today = days[0];
  const dayName = format(today.date, 'EEEE');
  const temp = Math.round(today.tempMax);

  for (let i = 0; i < days.length; i++) {
    if (!isDry(days[i].weatherCode)) {
      if (i === 0) {
        return `${dayName} · ${temp}°C · ${days[i].label} today`;
      }
      const lastDryDay = days[i - 1].date;
      return `${dayName} · ${temp}°C · Dry through ${format(lastDryDay, 'EEE')}`;
    }
  }

  return `${dayName} · ${temp}°C · Dry all week`;
}

// --- Fetcher ---

export const WEATHER_DISABLED_MESSAGE = 'Weather is disabled (WEATHER_ENABLED=false, issue 272)';

/**
 * Reads the forecast through the API's `weatherForecast` proxy, which holds the
 * Open-Meteo key (issue 272). The device never calls a weather provider itself.
 * A provider outage reaches the app as SERVICE_UNAVAILABLE, which the global
 * query handler downgrades (`query-client.ts`).
 */
export async function fetchForecast(coords: Coordinates): Promise<WeatherSummary> {
  // Second line of defence: even a caller that bypasses the hook cannot fetch
  // weather while the switch is off.
  if (!WEATHER_ENABLED) throw new Error(WEATHER_DISABLED_MESSAGE);

  const { weatherForecast } = await gqlFetcher(GetWeatherForecastDocument, { input: coords });

  const days: DayForecast[] = weatherForecast.days.map((day) => ({
    date: parseISO(day.date),
    tempMax: day.tempMax,
    tempMin: day.tempMin,
    precipProbability: day.precipProbability,
    weatherCode: day.weatherCode,
    label: weatherCodeToLabel(day.weatherCode),
  }));

  const headline = buildHeadline(days);

  const isGoodWeekend = days
    .filter((d) => isSaturday(d.date) || isSunday(d.date))
    .every((d) => isDry(d.weatherCode));

  return { headline, days, isGoodWeekend };
}

// --- Hook ---

const noop = () => {};

const DISABLED_RESULT: UseWeatherResult = {
  enabled: false,
  data: undefined,
  isLoading: false,
  locationStatus: 'unavailable',
  requestPermission: noop,
  coords: null,
};

/**
 * Weather switched off (issue 272): no location request, no query, no fetch.
 * Uses no hooks, so swapping it in at module load keeps the rules of hooks.
 */
function useDisabledWeatherForecast(): UseWeatherResult {
  return DISABLED_RESULT;
}

function useLiveWeatherForecast(): UseWeatherResult {
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('pending');
  const isResolving = useRef(false);

  const resolveLocation = useCallback(async () => {
    if (isResolving.current) return;
    isResolving.current = true;
    try {
      const result = await resolveWeatherLocation();
      setLocationStatus(result.status);
      if (result.coords) setCoords(result.coords);
    } finally {
      isResolving.current = false;
    }
  }, []);

  useEffect(() => {
    resolveLocation();
  }, [resolveLocation]);

  const query = useQuery({
    queryKey: queryKeys.weatherForecast.byCoords(coords?.lat, coords?.lon),
    queryFn: () => fetchForecast(coords as Coordinates),
    enabled: coords != null,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    // The strip renders null without a forecast (weather-strip.tsx). Four
    // attempts against a down provider buy nothing but battery.
    retry: 1,
    // Decorative surface: a provider outage must neither page us nor raise a
    // modal the rider can do nothing about. Our own bugs inside the query are
    // still reported in full — see the downgrade rules in `query-client.ts`.
    meta: { criticality: QUERY_CRITICALITY.ENHANCEMENT },
  });

  return {
    enabled: true,
    data: query.data,
    isLoading: query.isLoading,
    locationStatus,
    requestPermission: resolveLocation,
    coords,
  };
}

/**
 * Chosen once at module load from the build-time WEATHER_ENABLED switch, so the
 * hook identity never changes between renders.
 */
export const useWeatherForecast: () => UseWeatherResult = WEATHER_ENABLED
  ? useLiveWeatherForecast
  : useDisabledWeatherForecast;
