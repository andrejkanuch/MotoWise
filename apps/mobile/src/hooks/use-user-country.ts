import { isSupportedCountry, type SupportedCountryCode } from '@motovault/types';
import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { reverseGeocodeCountryCode } from '../utils/mapbox-geocoding';

async function detectUserCountry(): Promise<SupportedCountryCode | null> {
  const { status } = await Location.getForegroundPermissionsAsync();
  if (status !== 'granted') return null;

  const loc = await Location.getLastKnownPositionAsync();
  const coords =
    loc ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
  const code = await reverseGeocodeCountryCode(coords.coords.latitude, coords.coords.longitude);
  if (code && isSupportedCountry(code)) return code;
  return null;
}

export function useUserCountry() {
  return useQuery({
    queryKey: ['user-country'],
    queryFn: detectUserCountry,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}
