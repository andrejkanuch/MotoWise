import { useQuery } from '@tanstack/react-query';
import { format, isSaturday, isSunday, parseISO } from 'date-fns';
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';

// --- Open-Meteo API types ---

interface OpenMeteoDailyResponse {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_probability_max: number[];
  weather_code: number[];
}

interface OpenMeteoResponse {
  daily: OpenMeteoDailyResponse;
}

// --- Public types ---

export interface DayForecast {
  date: Date;
  tempMax: number;
  tempMin: number;
  precipProbability: number;
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
    const { status } = await Location.requestForegroundPermissionsAsync();
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

const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast';
const DAILY_PARAMS =
  'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code';

async function fetchForecast(coords: Coordinates): Promise<WeatherSummary> {
  const url = `${OPEN_METEO_BASE}?latitude=${coords.lat}&longitude=${coords.lon}&daily=${DAILY_PARAMS}&timezone=auto&forecast_days=5`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);

  const data: OpenMeteoResponse = await res.json();
  const { daily } = data;

  const days: DayForecast[] = daily.time.map((dateStr, i) => ({
    date: parseISO(dateStr),
    tempMax: daily.temperature_2m_max[i],
    tempMin: daily.temperature_2m_min[i],
    precipProbability: daily.precipitation_probability_max[i],
    weatherCode: daily.weather_code[i],
    label: weatherCodeToLabel(daily.weather_code[i]),
  }));

  const headline = buildHeadline(days);

  const isGoodWeekend = days
    .filter((d) => isSaturday(d.date) || isSunday(d.date))
    .every((d) => isDry(d.weatherCode));

  return { headline, days, isGoodWeekend };
}

// --- Hook ---

export function useWeatherForecast(): UseWeatherResult {
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
    queryKey: ['weather-forecast', coords?.lat, coords?.lon],
    queryFn: () => fetchForecast(coords as Coordinates),
    enabled: coords != null,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    locationStatus,
    requestPermission: resolveLocation,
    coords,
  };
}
