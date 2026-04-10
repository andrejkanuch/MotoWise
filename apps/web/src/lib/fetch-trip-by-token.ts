import 'server-only';
import {
  type ResolveTripByTokenResponse,
  ResolveTripByTokenResponseSchema,
  TripShareTokenSchema,
} from '@motovault/types';
import { notFound } from 'next/navigation';
import { getSupabaseServerClient } from '@/lib/supabase-server';

/**
 * Resolves a trip by its opaque share token via the `resolve_trip_by_token`
 * RPC. The RPC is SECURITY DEFINER and returns a generic "Trip not found"
 * exception on any failure (invalid token, revoked, unpublished, etc.) to
 * avoid an existence oracle. This helper treats every failure mode the same
 * way — `notFound()`.
 *
 * Token shape is validated up front via the shared `TripShareTokenSchema`
 * branded type (same source of truth used by mobile + API) so we never hit
 * the RPC with obviously malformed input. The response is parsed via the
 * shared Zod schema; a shape drift (e.g. schema mismatch after a migration)
 * is treated as a hard 404 rather than a cast.
 */
export async function fetchTripByToken(token: string): Promise<ResolveTripByTokenResponse> {
  const parsedToken = TripShareTokenSchema.safeParse(token);
  if (!parsedToken.success) notFound();

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc('resolve_trip_by_token', {
    p_token: parsedToken.data,
  });
  if (error || !data) notFound();

  const parsed = ResolveTripByTokenResponseSchema.safeParse(data);
  if (!parsed.success) notFound();
  return parsed.data;
}
