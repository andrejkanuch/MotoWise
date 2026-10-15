import { useQuery } from '@tanstack/react-query';
import { QUERY_META } from '../lib/query-meta';
import { motorcyclesOptions } from '../lib/query-options';

/**
 * The bike's display name — nickname, else make and model — from the bike list
 * every other screen caches. `null` until that list has loaded, or when the id
 * is unknown. Observes the list rather than reading the cache once, so the name
 * appears when the list arrives after the screen opened; nearly always a cache
 * hit, since Home and Garage fetch it and it is persisted. A failed first load
 * costs a label, not an alert: this observer renders its own absence.
 */
export function useBikeName(motorcycleId: string | null | undefined): string | null {
  const { data } = useQuery({
    ...motorcyclesOptions(),
    select: (list) => {
      const bike = list.myMotorcycles.find((m) => m.id === motorcycleId);
      return bike ? bike.nickname || `${bike.make} ${bike.model}` : null;
    },
    meta: QUERY_META.OWN_ERROR_UI,
  });
  return data ?? null;
}
