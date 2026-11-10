import { isIanaTimeZone } from '@motovault/types';
import { Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Zone used when neither the request nor the rider's rides name a valid one. */
export const DEFAULT_TIME_ZONE = 'UTC';

const RIDE_PRIVATE_DETAILS_TABLE = 'ride_private_details';
const logger = new Logger('resolveRiderTimeZone');

/**
 * The zone a rider's day, week and season buckets are read in: the requested
 * zone when it is a real IANA zone, else the device zone of the rider's latest
 * ride (owner-only `ride_private_details`, read with the service-role client
 * and filtered by the rider's id), else UTC. A failed lookup falls back to UTC
 * rather than failing the read.
 */
export async function resolveRiderTimeZone(
  supabaseAdmin: SupabaseClient,
  userId: string,
  requested: string | null | undefined,
): Promise<string> {
  if (requested && isIanaTimeZone(requested)) return requested;

  const { data, error } = await supabaseAdmin
    .from(RIDE_PRIVATE_DETAILS_TABLE)
    .select('time_zone')
    .eq('user_id', userId)
    .not('time_zone', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    logger.warn(`Latest ride zone read failed for ${userId}: ${error.message} (${error.code})`);
    return DEFAULT_TIME_ZONE;
  }
  const latest = (data as { time_zone: string | null } | null)?.time_zone;
  return latest && isIanaTimeZone(latest) ? latest : DEFAULT_TIME_ZONE;
}

/** The calendar date (YYYY-MM-DD) of `at` in `zone`. */
export function localDateIn(zone: string, at: Date = new Date()): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}
