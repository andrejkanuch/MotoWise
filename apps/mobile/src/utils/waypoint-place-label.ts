import { useEffect, useState } from 'react';
import { reverseGeocodeShortLabel } from './mapbox-geocoding';

/** Human-readable lat/lng when we have no place name yet. */
export function formatShortCoords(lat: number, lng: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}°${ns}, ${Math.abs(lng).toFixed(2)}°${ew}`;
}

/**
 * True when the only "name" we have is the generic start/end label (migrated
 * templates often store literal "Start" / "End" with real coords).
 */
export function isStartEndPlaceholderName(wp: { name: string; type: string }): boolean {
  const t = (wp.type ?? '').toLowerCase();
  if (t !== 'start' && t !== 'end') return false;
  const n = (wp.name ?? '').trim().toLowerCase();
  return n === '' || n === 'start' || n === 'end';
}

type Wp = { id: string; name: string; type: string; lat: number; lng: number };

/**
 * For placeholder start/end waypoints, show coordinates immediately then
 * replace with Mapbox reverse-geocode when available. Other waypoints: `name` as-is.
 *
 * Dependencies must be primitives — the parent often passes a new `wp` object each render;
 * a `[wp]` dep would re-run the effect every time, reset to coords, and fight the geocode
 * result (flicker).
 */
export function useResolvedWaypointLabel(wp: Wp): string {
  const { name, type, lat, lng } = wp;

  const [label, setLabel] = useState(() =>
    isStartEndPlaceholderName({ name, type }) ? formatShortCoords(lat, lng) : '',
  );

  useEffect(() => {
    if (!isStartEndPlaceholderName({ name, type })) return;
    // Deps are primitives so this does not re-run on every parent render (unlike a new `wp` object).
    setLabel(formatShortCoords(lat, lng));
    let cancelled = false;
    void reverseGeocodeShortLabel(lat, lng).then((placeName) => {
      if (!cancelled && placeName) setLabel(placeName);
    });
    return () => {
      cancelled = true;
    };
  }, [lat, lng, name, type]);

  if (!isStartEndPlaceholderName({ name, type })) return name;
  return label;
}
