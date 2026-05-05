import {
  type CreateDiscoverTripReviewInput,
  type DiscoverTripsFilter,
  type DiscoverTripWaypoint,
  DiscoverTripWaypointSchema,
  type ModerateDiscoverTripInput,
  type PublishTripToDiscoverInput,
} from '@motovault/types/validators';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { applySlugFilters } from '../../common/slug-lookup';
import { mapboxCountryShortCodeFromJson } from '../../common/mapbox-geocode';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import {
  DiscoverTripAlreadyClonedError,
  DiscoverTripNotFoundError,
  DiscoverTripNotOwnedError,
  DiscoverTripQualityGateError,
} from './errors/discover-trip.errors';
import type {
  DiscoverTrip,
  DiscoverTripConnection,
  DiscoverTripContributor,
  DiscoverTripReview,
} from './models/discover-trip.model';

// --- DB row select columns (never SELECT *) ---

const DISCOVER_TRIP_COLUMNS = `
  id, slug, title, description, difficulty, day_count, waypoints, polyline,
  start_lat, start_lng, contributor_user_id, source_trip_id,
  forked_from_discover_trip_id, country_code, region_code, city,
  distance_m, elevation_gain_m, estimated_duration_minutes,
  surface_type, curvature_index, status, is_featured, is_motovault_pick,
  view_count, clone_count, average_rating, review_count,
  published_at, updated_at,
  users:contributor_user_id(id, display_name, public_username, avatar_url, is_public)
`.trim();

interface DiscoverTripRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  difficulty: string;
  day_count: number;
  waypoints: unknown;
  polyline: string | null;
  start_lat: number | null;
  start_lng: number | null;
  contributor_user_id: string | null;
  source_trip_id: string | null;
  forked_from_discover_trip_id: string | null;
  country_code: string;
  region_code: string | null;
  city: string | null;
  distance_m: number | null;
  elevation_gain_m: number | null;
  estimated_duration_minutes: number | null;
  surface_type: string | null;
  curvature_index: number | null;
  status: string;
  is_featured: boolean;
  is_motovault_pick: boolean;
  view_count: number;
  clone_count: number;
  average_rating: number | null;
  review_count: number;
  published_at: string;
  updated_at: string;
  users: {
    id: string;
    display_name: string | null;
    public_username: string | null;
    avatar_url: string | null;
    is_public: boolean;
  } | null;
}

@Injectable()
export class DiscoverTripsService {
  private readonly logger = new Logger(DiscoverTripsService.name);

  constructor(
    @Inject(SUPABASE_USER) private readonly supabase: SupabaseClient,
    @Inject(SUPABASE_ADMIN) private readonly supabaseAdmin: SupabaseClient,
  ) {}

  // ==========================================
  // Queries
  // ==========================================

  async list(
    filter: DiscoverTripsFilter | undefined,
    first: number,
    after?: string,
  ): Promise<DiscoverTripConnection> {
    const limit = Math.min(first, 50);

    let query = this.supabase
      .from('discover_trips')
      .select(DISCOVER_TRIP_COLUMNS)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1);

    // Apply filters
    if (filter?.country) {
      query = query.eq('country_code', filter.country);
    }
    if (filter?.difficulty) {
      query = query.eq('difficulty', filter.difficulty);
    }
    if (filter?.dayCountMin != null) {
      query = query.gte('day_count', filter.dayCountMin);
    }
    if (filter?.dayCountMax != null) {
      query = query.lte('day_count', filter.dayCountMax);
    }
    if (filter?.surfaceType) {
      query = query.eq('surface_type', filter.surfaceType);
    }

    // Full-text search (websearch_to_tsquery handles natural input safely)
    if (filter?.searchText?.trim()) {
      query = query.textSearch('search_tsv', filter.searchText.trim(), {
        type: 'websearch',
        config: 'english',
      });
    }

    // Cursor pagination: composite (published_at, id)
    if (after) {
      const decoded = this.decodeCursor(after);
      if (decoded) {
        query = query.or(
          `published_at.lt.${decoded.publishedAt},and(published_at.eq.${decoded.publishedAt},id.lt.${decoded.id})`,
        );
      }
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as unknown as DiscoverTripRow[];
    const hasNextPage = rows.length > limit;
    const edges = rows.slice(0, limit).map((row) => ({
      node: this.mapRow(row),
      cursor: this.encodeCursor(row.published_at, row.id),
    }));

    return {
      edges,
      pageInfo: {
        hasNextPage,
        endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : undefined,
      },
    };
  }

  async getBySlug(country: string, region: string, slug: string): Promise<DiscoverTrip> {
    const query = this.supabase
      .from('discover_trips')
      .select(DISCOVER_TRIP_COLUMNS)
      .eq('status', 'published');
    const { data, error } = await applySlugFilters(query, country, region, slug).single();

    if (error || !data) throw new DiscoverTripNotFoundError();
    return this.mapRow(data as unknown as DiscoverTripRow);
  }

  async getById(id: string): Promise<DiscoverTrip> {
    // RLS gates non-published access to contributor + admin only
    const { data, error } = await this.supabase
      .from('discover_trips')
      .select(DISCOVER_TRIP_COLUMNS)
      .eq('id', id)
      .eq('status', 'published')
      .single();

    if (error || !data) throw new DiscoverTripNotFoundError();
    return this.mapRow(data as unknown as DiscoverTripRow);
  }

  // ==========================================
  // Mutations
  // ==========================================

  async publishTripToDiscover(
    input: PublishTripToDiscoverInput,
    userId: string,
  ): Promise<DiscoverTrip> {
    // Verify trip ownership
    const { data: trip, error: tripError } = await this.supabase
      .from('trips')
      .select('id, title, description, difficulty, organiser_user_id, cloned_from_discover_trip_id')
      .eq('id', input.tripId)
      .single();

    if (tripError || !trip) throw new DiscoverTripNotFoundError();
    if (trip.organiser_user_id !== userId) throw new DiscoverTripNotOwnedError();

    // Fetch waypoints
    const { data: waypoints } = await this.supabase
      .from('trip_waypoints')
      .select('id, sort_order, day_index, type, name, notes, lat, lng')
      .eq('trip_id', input.tripId)
      .order('day_index', { ascending: true })
      .order('sort_order', { ascending: true });

    // Quality gate
    const missing: string[] = [];
    if (!trip.title) missing.push('title');
    if (!trip.description) missing.push('description');
    if (!trip.difficulty) missing.push('difficulty');
    if (!waypoints || waypoints.length < 2) missing.push('at least 2 waypoints');
    if (missing.length > 0) throw new DiscoverTripQualityGateError(missing);

    // Build waypoints JSONB
    const waypointsJson = (waypoints ?? []).map((w) => ({
      sortOrder: w.sort_order,
      dayIndex: w.day_index ?? 0,
      type: w.type,
      name: w.name,
      lat: w.lat,
      lng: w.lng,
      notes: w.notes ?? null,
    }));

    // Calculate day_count from waypoints
    const maxDayIndex = Math.max(0, ...waypointsJson.map((w) => w.dayIndex));
    const dayCount = maxDayIndex + 1;

    // Generate slug from title
    const slug = this.generateSlug(trip.title);

    // Determine forked_from if this trip was cloned from another discover trip
    const forkedFrom = trip.cloned_from_discover_trip_id ?? null;

    // Check if already published (re-publish = update existing snapshot)
    const { data: existing } = await this.supabase
      .from('discover_trips')
      .select('id')
      .eq('source_trip_id', input.tripId)
      .maybeSingle();

    // Derive country_code from start waypoint via Mapbox reverse geocode
    const startWp = waypointsJson.find((w) => w.type === 'start') ?? waypointsJson[0];
    let countryCode = 'XX';
    if (startWp) {
      try {
        const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;
        if (mapboxToken) {
          const geoRes = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${startWp.lng},${startWp.lat}.json?types=country&limit=1&access_token=${mapboxToken}`,
          );
          const cc = mapboxCountryShortCodeFromJson(await geoRes.json());
          if (cc) countryCode = cc;
        }
      } catch (e) {
        this.logger.warn('Reverse geocode failed, using XX', e);
      }
    }

    const payload = {
      slug,
      title: trip.title,
      description: trip.description,
      difficulty: trip.difficulty,
      day_count: dayCount,
      waypoints: waypointsJson,
      contributor_user_id: userId,
      source_trip_id: input.tripId,
      forked_from_discover_trip_id: forkedFrom,
      country_code: countryCode,
      status: 'published' as const,
    };

    let inserted: unknown;
    let insertError: unknown;

    if (existing) {
      // Re-publish: update existing snapshot (slug stays immutable)
      const {
        slug: _slug,
        source_trip_id: _src,
        contributor_user_id: _cuid,
        ...updatePayload
      } = payload;
      const result = await this.supabase
        .from('discover_trips')
        .update(updatePayload)
        .eq('id', existing.id)
        .select(DISCOVER_TRIP_COLUMNS)
        .single();
      inserted = result.data;
      insertError = result.error;
    } else {
      // First publish: insert new snapshot
      const result = await this.supabase
        .from('discover_trips')
        .insert(payload)
        .select(DISCOVER_TRIP_COLUMNS)
        .single();
      inserted = result.data;
      insertError = result.error;
    }

    if (insertError) throw insertError;
    if (!inserted) throw new DiscoverTripNotFoundError();

    return this.mapRow(inserted as unknown as DiscoverTripRow);
  }

  async unpublishFromDiscover(discoverTripId: string, userId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('discover_trips')
      .update({ status: 'unpublished' })
      .eq('id', discoverTripId)
      .eq('contributor_user_id', userId)
      .select('id')
      .single();

    if (error || !data) throw new DiscoverTripNotFoundError();
    return true;
  }

  async cloneDiscoverTrip(discoverTripId: string, userId: string): Promise<string> {
    // Call the atomic RPC (service_role needed for SECURITY DEFINER)
    const { data, error } = await this.supabaseAdmin.rpc('clone_discover_trip', {
      p_discover_trip_id: discoverTripId,
      p_user_id: userId,
    });

    if (error) {
      if (error.message?.includes('already cloned')) {
        throw new DiscoverTripAlreadyClonedError();
      }
      if (error.message?.includes('not found')) {
        throw new DiscoverTripNotFoundError();
      }
      throw error;
    }

    return data as string;
  }

  async createReview(
    input: CreateDiscoverTripReviewInput,
    userId: string,
  ): Promise<DiscoverTripReview> {
    const { data, error } = await this.supabase
      .from('discover_trip_reviews')
      .insert({
        discover_trip_id: input.discoverTripId,
        user_id: userId,
        rating: input.rating,
        text: input.text ?? null,
        condition_tags: input.conditionTags ?? [],
        bike_id: input.bikeId ?? null,
      })
      .select('id, discover_trip_id, user_id, rating, text, condition_tags, bike_id, created_at')
      .single();

    if (error) throw error;

    return {
      id: data.id,
      discoverTripId: data.discover_trip_id,
      userId: data.user_id,
      rating: data.rating,
      text: data.text,
      conditionTags: data.condition_tags ?? [],
      bikeId: data.bike_id,
      createdAt: data.created_at,
    };
  }

  async moderateTrip(input: ModerateDiscoverTripInput): Promise<DiscoverTrip> {
    const { data, error } = await this.supabaseAdmin
      .from('discover_trips')
      .update({ status: input.status })
      .eq('id', input.discoverTripId)
      .select(DISCOVER_TRIP_COLUMNS)
      .single();

    if (error || !data) throw new DiscoverTripNotFoundError();
    return this.mapRow(data as unknown as DiscoverTripRow);
  }

  async incrementViewCount(id: string): Promise<void> {
    // Fire-and-forget with error observation
    this.supabaseAdmin.rpc('increment_discover_trip_view', { p_id: id }).then(({ error }) => {
      if (error) this.logger.error('Failed to increment view count', error);
    });
  }

  // ==========================================
  // Helpers
  // ==========================================

  private mapRow(row: DiscoverTripRow): DiscoverTrip {
    // Parse waypoints through Zod (validates JSONB contract)
    let parsedWaypoints: DiscoverTripWaypoint[] = [];
    try {
      parsedWaypoints = z.array(DiscoverTripWaypointSchema).parse(row.waypoints);
    } catch (e) {
      this.logger.warn(`Invalid waypoints JSONB for discover_trip ${row.id}`, e);
      parsedWaypoints = [];
    }

    // Mask contributor for non-public users
    const contributor: DiscoverTripContributor = row.users?.is_public
      ? {
          id: row.users.id,
          displayName: row.users.display_name ?? 'Community Rider',
          publicUsername: row.users.public_username ?? undefined,
          avatarUrl: row.users.avatar_url ?? undefined,
        }
      : {
          displayName: 'Community Rider',
        };

    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      difficulty: row.difficulty,
      dayCount: row.day_count,
      waypoints: parsedWaypoints,
      polyline: row.polyline ?? undefined,
      startLat: row.start_lat ?? undefined,
      startLng: row.start_lng ?? undefined,
      contributor,
      countryCode: row.country_code,
      regionCode: row.region_code ?? undefined,
      city: row.city ?? undefined,
      distanceM: row.distance_m ?? undefined,
      elevationGainM: row.elevation_gain_m ?? undefined,
      estimatedDurationMinutes: row.estimated_duration_minutes ?? undefined,
      surfaceType: row.surface_type ?? undefined,
      curvatureIndex: row.curvature_index ?? undefined,
      status: row.status,
      isFeatured: row.is_featured,
      isMotovaultPick: row.is_motovault_pick,
      viewCount: row.view_count,
      cloneCount: row.clone_count,
      averageRating: row.average_rating ?? undefined,
      reviewCount: row.review_count,
      publishedAt: row.published_at,
      updatedAt: row.updated_at,
      forkedFromDiscoverTripId: row.forked_from_discover_trip_id ?? undefined,
    };
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 75);
  }

  private encodeCursor(publishedAt: string, id: string): string {
    return Buffer.from(`${publishedAt}|${id}`).toString('base64');
  }

  private decodeCursor(cursor: string): { publishedAt: string; id: string } | null {
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
      const parts = decoded.split('|');
      if (parts.length !== 2) return null;
      const [publishedAt, id] = parts;
      // Validate to prevent PostgREST filter injection via crafted cursors
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(publishedAt)) return null;
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
      return { publishedAt, id };
    } catch {
      return null;
    }
  }
}
