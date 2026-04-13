/**
 * Fetch a published route by slug for the public route detail page.
 * Uses Supabase REST directly (no auth needed — routes are public).
 */

export interface PublicRoute {
  id: string;
  name?: string;
  description?: string;
  polyline: string;
  distanceM: number;
  elevationGainM?: number;
  surfaceType?: string;
  curvatureIndex?: number;
  isMotovaultPick: boolean;
  editorialDescription?: string;
  ratingAvg?: number;
  ratingCount: number;
  commentCount: number;
  startLat?: number;
  startLng?: number;
  createdAt: string;
  contributorDisplayName?: string;
  contributorUsername?: string;
  contributorAvatarUrl?: string;
}

interface RouteRow {
  id: string;
  name: string | null;
  description: string | null;
  polyline: string;
  distance_m: number;
  elevation_gain_m: number | null;
  surface_type: string | null;
  curvature_index: number | null;
  is_motovault_pick: boolean;
  editorial_description: string | null;
  rating_avg: number | null;
  rating_count: number;
  comment_count: number;
  start_lat: number | null;
  start_lng: number | null;
  created_at: string;
  users: {
    display_name: string | null;
    public_username: string | null;
    avatar_url: string | null;
  } | null;
}

export async function fetchRouteBySlug(slug: string): Promise<PublicRoute | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) return null;

  try {
    // Routes use the slug as the ID for now (UUID-based)
    const res = await fetch(
      `${supabaseUrl}/rest/v1/routes?id=eq.${slug}&status=eq.published&select=id,name,description,polyline,distance_m,elevation_gain_m,surface_type,curvature_index,is_motovault_pick,editorial_description,rating_avg,rating_count,comment_count,start_lat,start_lng,created_at,users:contributor_user_id(display_name,public_username,avatar_url)`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        next: { revalidate: 3600 },
      },
    );

    if (!res.ok) return null;

    const rows = (await res.json()) as RouteRow[];
    if (!rows.length) return null;

    const row = rows[0];
    return {
      id: row.id,
      name: row.name ?? undefined,
      description: row.description ?? undefined,
      polyline: row.polyline,
      distanceM: row.distance_m,
      elevationGainM: row.elevation_gain_m ?? undefined,
      surfaceType: row.surface_type ?? undefined,
      curvatureIndex: row.curvature_index ?? undefined,
      isMotovaultPick: row.is_motovault_pick,
      editorialDescription: row.editorial_description ?? undefined,
      ratingAvg: row.rating_avg ?? undefined,
      ratingCount: row.rating_count,
      commentCount: row.comment_count,
      startLat: row.start_lat ?? undefined,
      startLng: row.start_lng ?? undefined,
      createdAt: row.created_at,
      contributorDisplayName: row.users?.display_name ?? undefined,
      contributorUsername: row.users?.public_username ?? undefined,
      contributorAvatarUrl: row.users?.avatar_url ?? undefined,
    };
  } catch {
    return null;
  }
}
