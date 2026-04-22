import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../../supabase/supabase-admin.provider';
import { SUPABASE_USER } from '../../supabase/supabase-user.provider';
import type { Trip, TripConnection } from '../models/trip.model';
import { mapRowToTrip, TRIP_SELECT, type TripRow } from './trip-lifecycle.service';

// --- Template-specific columns appended to the base TRIP_SELECT ---

const TEMPLATE_SELECT = `${TRIP_SELECT},
  is_template, slug, country_code, region_code, city, polyline,
  distance_m, elevation_gain_m, estimated_duration_minutes,
  surface_type, curvature_index, view_count, clone_count,
  average_rating, review_count, is_featured, is_motovault_pick,
  published_at, is_flagged, day_count, start_lat, start_lng`;

/** Extended row shape for template queries (base TripRow + template fields) */
interface TemplateRow extends TripRow {
  is_template: boolean;
  slug: string | null;
  country_code: string | null;
  region_code: string | null;
  city: string | null;
  polyline: string | null;
  distance_m: number | null;
  elevation_gain_m: number | null;
  estimated_duration_minutes: number | null;
  surface_type: string | null;
  curvature_index: number | null;
  view_count: number;
  clone_count: number;
  average_rating: number | null;
  review_count: number;
  is_featured: boolean;
  is_motovault_pick: boolean;
  published_at: string | null;
  is_flagged: boolean;
  day_count: number | null;
  start_lat: number | null;
  start_lng: number | null;
}

export interface TemplatesFilter {
  country?: string;
  difficulty?: string;
  dayCountMin?: number;
  dayCountMax?: number;
  surfaceType?: string;
  searchText?: string;
}

@Injectable()
export class TripTemplatesService {
  private readonly logger = new Logger(TripTemplatesService.name);

  constructor(
    @Inject(SUPABASE_USER) private readonly supabase: SupabaseClient,
    @Inject(SUPABASE_ADMIN) private readonly supabaseAdmin: SupabaseClient,
  ) {}

  // ==========================================
  // Queries
  // ==========================================

  async listTemplates(
    filter: TemplatesFilter | undefined,
    first: number,
    after?: string,
  ): Promise<TripConnection> {
    const limit = Math.min(first, 50);

    let query = this.supabase
      .from('trips')
      .select(TEMPLATE_SELECT)
      .eq('is_template', true)
      .eq('is_flagged', false)
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

    // Full-text search
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
    if (error) {
      this.logger.error(`listTemplates failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to fetch templates');
    }

    const rows = (data ?? []) as unknown as TemplateRow[];
    const hasNextPage = rows.length > limit;
    const edges = rows.slice(0, limit).map((row) => ({
      node: this.mapTemplateRow(row),
      cursor: this.encodeCursor(row.published_at ?? row.created_at, row.id),
    }));

    return {
      edges,
      pageInfo: {
        hasNextPage,
        endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : undefined,
      },
    };
  }

  async getTemplateBySlug(country: string, region: string, slug: string): Promise<Trip> {
    const { data, error } = await this.supabase
      .from('trips')
      .select(TEMPLATE_SELECT)
      .eq('is_template', true)
      .eq('country_code', country)
      .eq('region_code', region)
      .eq('slug', slug)
      .eq('is_flagged', false)
      .single();

    if (error || !data) throw new NotFoundException('Template not found');
    return this.mapTemplateRow(data as unknown as TemplateRow);
  }

  async getTemplateById(id: string): Promise<Trip> {
    const { data, error } = await this.supabase
      .from('trips')
      .select(TEMPLATE_SELECT)
      .eq('id', id)
      .eq('is_template', true)
      .eq('is_flagged', false)
      .single();

    if (error || !data) throw new NotFoundException('Template not found');
    return this.mapTemplateRow(data as unknown as TemplateRow);
  }

  // ==========================================
  // Mutations
  // ==========================================

  async publishAsTemplate(userId: string, tripId: string): Promise<Trip> {
    // Verify trip ownership
    const { data: trip, error: tripError } = await this.supabase
      .from('trips')
      .select('id, title, description, organiser_user_id, country_code, is_template')
      .eq('id', tripId)
      .single();

    if (tripError || !trip) throw new NotFoundException('Trip not found');
    if (trip.organiser_user_id !== userId) {
      throw new ForbiddenException('Only the organiser can publish this trip as a template');
    }
    if (trip.is_template) {
      throw new BadRequestException('Trip is already published as a template');
    }

    // Fetch waypoints for quality gate
    const { data: waypoints } = await this.supabase
      .from('trip_waypoints')
      .select('id, sort_order, day_index, type, name, lat, lng')
      .eq('trip_id', tripId)
      .order('day_index', { ascending: true })
      .order('sort_order', { ascending: true });

    // Quality gate
    const missing: string[] = [];
    if (!trip.title) missing.push('title');
    if (!trip.description) missing.push('description');
    if (!waypoints || waypoints.length < 2) missing.push('at least 2 waypoints');
    if (missing.length > 0) {
      throw new BadRequestException(
        `Trip cannot be published as template — missing: ${missing.join(', ')}`,
      );
    }

    // Generate slug from title
    const slug = this.generateSlug(trip.title);

    // Calculate day_count from waypoints
    const maxDayIndex = Math.max(0, ...(waypoints ?? []).map((w) => w.day_index ?? 0));
    const dayCount = maxDayIndex + 1;

    // Derive country_code from start waypoint via Mapbox reverse geocode if not set
    let countryCode = trip.country_code ?? null;
    if (!countryCode) {
      const startWp =
        waypoints?.find((w) => w.type === 'start') ?? (waypoints ? waypoints[0] : null);
      if (startWp) {
        try {
          const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;
          if (mapboxToken) {
            const geoRes = await fetch(
              `https://api.mapbox.com/geocoding/v5/mapbox.places/${startWp.lng},${startWp.lat}.json?types=country&limit=1&access_token=${mapboxToken}`,
            );
            const geoJson = await geoRes.json();
            const cc = geoJson?.features?.[0]?.properties?.short_code;
            if (cc && typeof cc === 'string') countryCode = cc.toLowerCase();
          }
        } catch (e) {
          this.logger.warn('Reverse geocode failed, using null country_code', e);
        }
      }
    }

    // Compute start coords
    const startWp = waypoints?.find((w) => w.type === 'start') ?? (waypoints ? waypoints[0] : null);

    // Publish: SET is_template=true + published_at=now()
    const update: Record<string, unknown> = {
      is_template: true,
      published_at: new Date().toISOString(),
      slug,
      day_count: dayCount,
      ...(countryCode && { country_code: countryCode }),
      ...(startWp && { start_lat: startWp.lat, start_lng: startWp.lng }),
    };

    const { data: updated, error: updateError } = await this.supabase
      .from('trips')
      .update(update)
      .eq('id', tripId)
      .select(TEMPLATE_SELECT)
      .single();

    if (updateError) {
      this.logger.error(`publishAsTemplate failed: ${updateError.message} (${updateError.code})`);
      throw new InternalServerErrorException('Failed to publish template');
    }

    return this.mapTemplateRow(updated as unknown as TemplateRow);
  }

  async unpublishTemplate(userId: string, tripId: string): Promise<boolean> {
    // Verify ownership via user client (RLS + explicit check)
    const { data, error } = await this.supabase
      .from('trips')
      .update({ is_template: false })
      .eq('id', tripId)
      .eq('organiser_user_id', userId)
      .eq('is_template', true)
      .select('id')
      .single();

    if (error || !data) throw new NotFoundException('Template not found or not owned by you');
    return true;
  }

  async cloneTemplate(userId: string, tripId: string): Promise<string> {
    // Atomic RPC: copies trip + waypoints + adds organiser participant + increments clone_count
    const { data, error } = await this.supabaseAdmin.rpc('clone_trip_template', {
      p_trip_id: tripId,
      p_user_id: userId,
    });

    if (error) {
      this.logger.error(`cloneTemplate RPC failed: ${error.message} (${error.code})`);

      // Map known PG error codes to user-friendly exceptions
      if (error.code === 'P0002') throw new NotFoundException('Template not found');
      if (error.code === 'P0003') throw new BadRequestException('You have already cloned this template');

      throw new InternalServerErrorException('Failed to clone template');
    }

    if (!data) {
      throw new InternalServerErrorException('clone_trip_template returned no ID');
    }

    return data as string;
  }

  async incrementViewCount(id: string): Promise<void> {
    // Fire-and-forget with admin client (no RLS needed)
    Promise.resolve(this.supabaseAdmin.rpc('increment_trip_view', { p_id: id }))
      .then(({ error }) => {
        if (error) this.logger.error('Failed to increment view count', error);
      })
      .catch((e: unknown) => this.logger.error('increment_trip_view network error', e));
  }

  async moderateTemplate(
    userId: string,
    input: { tripId: string; isFlagged: boolean },
  ): Promise<boolean> {
    // Defense-in-depth: verify caller is admin even though resolver should guard this
    const { data: caller } = await this.supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();
    if (caller?.role !== 'admin') throw new ForbiddenException('Admin only');

    const { data, error } = await this.supabaseAdmin
      .from('trips')
      .update({ is_flagged: input.isFlagged })
      .eq('id', input.tripId)
      .eq('is_template', true)
      .select('id')
      .single();

    if (error || !data) throw new NotFoundException('Template not found');
    return true;
  }

  // ==========================================
  // Helpers
  // ==========================================

  /**
   * Maps a template row to the Trip model, enriching with template-specific
   * fields. Uses the base mapRowToTrip for core fields.
   */
  private mapTemplateRow(row: TemplateRow): Trip {
    const base = mapRowToTrip(row);

    // Extend with template-specific fields (these are available on Trip
    // via optional fields added by the template resolver).
    return {
      ...base,
      // Template-specific fields cast onto the Trip shape.
      // The resolver will expose these via @ResolveField or the model
      // will be extended in a future step.
      ...({
        isTemplate: row.is_template,
        slug: row.slug ?? undefined,
        countryCode: row.country_code ?? undefined,
        regionCode: row.region_code ?? undefined,
        city: row.city ?? undefined,
        polyline: row.polyline ?? undefined,
        distanceM: row.distance_m ?? undefined,
        elevationGainM: row.elevation_gain_m ?? undefined,
        estimatedDurationMinutes: row.estimated_duration_minutes ?? undefined,
        surfaceType: row.surface_type ?? undefined,
        curvatureIndex: row.curvature_index ?? undefined,
        viewCount: row.view_count,
        cloneCount: row.clone_count,
        averageRating: row.average_rating ?? undefined,
        reviewCount: row.review_count,
        isFeatured: row.is_featured,
        isMotovaultPick: row.is_motovault_pick,
        publishedAt: row.published_at ?? undefined,
        isFlagged: row.is_flagged,
        dayCount: row.day_count ?? undefined,
        startLat: row.start_lat ?? undefined,
        startLng: row.start_lng ?? undefined,
      } as Record<string, unknown>),
    } as Trip;
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
