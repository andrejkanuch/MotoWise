import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { LatLng } from '../../../common/polyline';
import { toEwktLineString } from './track';

/**
 * The SQL helper that measures a route against the reference geodata.
 * Contract, service role only:
 *   ride_stats_places(p_route text, p_start_lat float8, p_start_lng float8,
 *                     p_end_lat float8, p_end_lng float8) RETURNS jsonb
 *   {
 *     reference_ready: boolean,        -- ref_country_parts has rows
 *     countries: [{ iso_a2, core_m, first_at }],
 *       -- per country: metres of the route inside its `core` parts (the
 *       -- country shrunk 500 m inward), and the route fraction (0-1) where the
 *       -- route first enters it
 *     start_place / end_place: { name, iso_a2, admin1_code } | null
 *       -- the nearest ref_places town within 25 km of the start / end
 *   }
 */
export const PLACES_RPC = 'ride_stats_places';

/** A country counts with at least this much route inside its 500 m-shrunk core. */
export const COUNTRY_MIN_CORE_M = 1_000;

const placeSchema = z
  .object({ name: z.string(), iso_a2: z.string(), admin1_code: z.string().nullable() })
  .nullable();

const rpcSchema = z.object({
  reference_ready: z.boolean(),
  countries: z.array(z.object({ iso_a2: z.string(), core_m: z.number(), first_at: z.number() })),
  start_place: placeSchema,
  end_place: placeSchema,
});

export interface RidePlaces {
  /** ISO alpha-2, in order of first entry. */
  countries: string[];
  /** `<iso_a2>.<admin1_code>`, the ref_regions key. */
  startRegion: string | null;
  startPlace: string | null;
  endPlace: string | null;
}

export const REFERENCE_MISSING = 'reference_missing' as const;
export type PlacesOutcome = RidePlaces | typeof REFERENCE_MISSING;
export type PlacesLookup = (route: readonly LatLng[]) => Promise<PlacesOutcome>;

export function placesFromRpc(raw: unknown): PlacesOutcome {
  const parsed = rpcSchema.parse(raw);
  if (!parsed.reference_ready) return REFERENCE_MISSING;
  const countries = parsed.countries
    .filter((c) => c.core_m >= COUNTRY_MIN_CORE_M)
    .sort((a, b) => a.first_at - b.first_at)
    .map((c) => c.iso_a2);
  const start = parsed.start_place;
  return {
    countries,
    startRegion: start?.admin1_code ? `${start.iso_a2}.${start.admin1_code}` : null,
    startPlace: start?.name ?? null,
    endPlace: parsed.end_place?.name ?? null,
  };
}

/** Places for a route through the service-role client. */
export function createPlacesLookup(supabaseAdmin: SupabaseClient): PlacesLookup {
  return async (route) => {
    const start = route[0];
    const end = route[route.length - 1];
    const { data, error } = await supabaseAdmin.rpc(PLACES_RPC, {
      p_route: toEwktLineString(route),
      p_start_lat: start.lat,
      p_start_lng: start.lng,
      p_end_lat: end.lat,
      p_end_lng: end.lng,
    });
    if (error) throw new Error(`${PLACES_RPC} failed: ${error.message}`);
    return placesFromRpc(data);
  };
}
