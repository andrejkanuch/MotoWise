import type { Currency } from '@motovault/types';
import { getLocales } from 'expo-localization';
import { SUPPORTED_CURRENCIES } from './currencies';

const IMPERIAL_REGIONS = new Set(['US', 'GB', 'LR', 'MM']);

/**
 * Auto-detect currency from device locale.
 * Uses expo-localization (proven on Hermes) instead of Intl.NumberFormat.
 * Falls back to EUR if locale data is unavailable or currency is unsupported.
 */
export function detectCurrency(): Currency {
  const locale = getLocales()[0];
  const code = locale?.currencyCode ?? '';
  if (SUPPORTED_CURRENCIES.has(code as Currency)) return code as Currency;
  return 'EUR';
}

/**
 * Auto-detect measurement system from device locale.
 * Returns 'imperial' for US/GB/LR/MM, 'metric' for everyone else.
 * Uses measurementSystem first, falls back to regionCode.
 */
export function detectMeasurementSystem(): 'metric' | 'imperial' {
  const locale = getLocales()[0];

  // expo-localization provides measurementSystem directly on supported platforms
  if (locale?.measurementSystem) {
    return locale.measurementSystem === 'us' || locale.measurementSystem === 'uk'
      ? 'imperial'
      : 'metric';
  }

  // Fallback: check region code
  const region = locale?.regionCode ?? '';
  return IMPERIAL_REGIONS.has(region) ? 'imperial' : 'metric';
}

/**
 * Auto-detect mileage unit from measurement system.
 */
export function detectMileageUnit(): 'mi' | 'km' {
  return detectMeasurementSystem() === 'imperial' ? 'mi' : 'km';
}
