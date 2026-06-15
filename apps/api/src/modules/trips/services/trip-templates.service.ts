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
import { mapboxCountryShortCodeFromJson } from '../../../common/mapbox-geocode';
import { buildConnection, decodeCursor, encodeCursor } from '../../../common/pagination/connection';
import { applySlugFilters } from '../../../common/slug-lookup';
import { SUPABASE_ADMIN } from '../../supabase/supabase-admin.provider';
import { SUPABASE_USER } from '../../supabase/supabase-user.provider';
import type { Trip, TripConnection } from '../models/trip.model';
import {
  mapRowToTrip,
  mapRowToWaypoint,
  TRIP_DETAIL_SELECT,
  type TripRow,
  type WaypointRow,
} from './trip-lifecycle.service';

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

    let query = this.supabaseAdmin
      .from('trips')
      .select(TRIP_DETAIL_SELECT)
      .eq('is_template', true)
      .eq('is_flagged', false)
      .order('published_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1);

    // Apply filters
    if (filter?.country) {
      query = query.eq('country_code', filter.country.toUpperCase());
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
      const decoded = decodeCursor(after);
      if (decoded) {
        const [publishedAt, id] = decoded;
        query = query.or(
          `published_at.lt.${publishedAt},and(published_at.eq.${publishedAt},id.lt.${id})`,
        );
      }
    }

    const { data, error } = await query;
    if (error) {
      this.logger.error(`listTemplates failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to fetch templates');
    }

    return buildConnection({
      rows: (data ?? []) as unknown as TripRow[],
      limit,
      mapNode: (row) => mapRowToTrip(row),
      cursorOf: (row) => encodeCursor(row.published_at ?? row.created_at, row.id),
    });
  }

  /**
   * Discover typeahead returns `routes.id`. Template rows use `discover_trips.slug`
   * (often different from `routes.slug` after sanitization), so slug path resolution
   * can miss. This follows migrated_from_route_id → discover_trips → trips.
   */
  async getTemplateIdForRouteId(routeId: string): Promise<string | null> {
    const { data: dt, error: dtError } = await this.supabaseAdmin
      .from('discover_trips')
      .select('id')
      .eq('migrated_from_route_id', routeId)
      .maybeSingle();

    if (dtError) {
      this.logger.warn(`getTemplateIdForRouteId discover_trips: ${dtError.message}`);
      return null;
    }
    if (!dt?.id) {
      return null;
    }

    const { data: trip, error: tripError } = await this.supabaseAdmin
      .from('trips')
      .select('id')
      .eq('migrated_from_discover_trip_id', dt.id)
      .eq('is_template', true)
      .eq('is_flagged', false)
      .maybeSingle();

    if (tripError) {
      this.logger.warn(`getTemplateIdForRouteId trips: ${tripError.message}`);
      return null;
    }
    return (trip?.id as string | undefined) ?? null;
  }

  async getTemplateBySlug(country: string, region: string, slug: string): Promise<Trip> {
    // Use admin client — this is called from @Public() resolvers (tripBySlug, tripReviews, similarTrips)
    // where there is no authenticated user. The user client with anon key may not have
    // sufficient RLS access for the trips + trip_waypoints join.
    const query = this.supabaseAdmin
      .from('trips')
      .select(
        `${TRIP_DETAIL_SELECT}, trip_waypoints(id, trip_id, sort_order, day_index, type, name, lat, lng, notes, period_of_day)`,
      )
      .eq('is_template', true)
      .eq('is_flagged', false);
    const { data, error } = await applySlugFilters(query, country, region, slug).single();

    if (error || !data) throw new NotFoundException('Template not found');
    const trip = mapRowToTrip(data as unknown as TripRow);
    const wpRows = (data as Record<string, unknown>).trip_waypoints as WaypointRow[] | undefined;
    if (wpRows?.length) {
      trip.waypoints = wpRows.map(mapRowToWaypoint);
    }
    return trip;
  }

  async getTemplateById(id: string): Promise<Trip> {
    const { data, error } = await this.supabase
      .from('trips')
      .select(TRIP_DETAIL_SELECT)
      .eq('id', id)
      .eq('is_template', true)
      .eq('is_flagged', false)
      .single();

    if (error || !data) throw new NotFoundException('Template not found');
    return mapRowToTrip(data as unknown as TripRow);
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
            const cc = mapboxCountryShortCodeFromJson(await geoRes.json());
            if (cc) countryCode = cc;
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
      .select(TRIP_DETAIL_SELECT)
      .single();

    if (updateError) {
      this.logger.error(`publishAsTemplate failed: ${updateError.message} (${updateError.code})`);
      throw new InternalServerErrorException('Failed to publish template');
    }

    return mapRowToTrip(updated as unknown as TripRow);
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
      if (error.code === 'P0003')
        throw new BadRequestException('You have already cloned this template');

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
  // Sitemap
  // ==========================================

  async sitemapPublishedTrips(): Promise<
    Array<{ countryCode: string; regionCode: string; slug: string; updatedAt: string }>
  > {
    const { data, error } = await this.supabaseAdmin
      .from('trips')
      .select('country_code, region_code, slug, updated_at')
      .eq('is_template', true)
      .eq('is_flagged', false)
      .not('country_code', 'is', null)
      .not('region_code', 'is', null)
      .not('slug', 'is', null)
      .limit(10000);

    if (error) {
      this.logger.warn(`sitemapPublishedTrips: ${error.message}`);
      return [];
    }

    return (data ?? []).map((row) => ({
      countryCode: row.country_code as string,
      regionCode: row.region_code as string,
      slug: row.slug as string,
      updatedAt: row.updated_at as string,
    }));
  }

  // ==========================================
  // Similar trips
  // ==========================================

  /**
   * Find similar published templates by country + difficulty + duration band.
   * Excludes the source trip itself.
   */
  async findSimilarTrips(
    slug: string,
    country: string,
    region: string,
    limit = 6,
  ): Promise<Trip[]> {
    // First get the source trip's difficulty and day_count for matching
    const sourceQuery = this.supabaseAdmin
      .from('trips')
      .select('id, difficulty, day_count')
      .eq('is_template', true);
    const { data: source, error: sourceErr } = await applySlugFilters(
      sourceQuery,
      country,
      region,
      slug,
    ).single();

    if (sourceErr || !source) return [];

    // Find similar: same country, closest difficulty, duration within ±1 day
    const minDays = Math.max(1, (source.day_count ?? 1) - 1);
    const maxDays = (source.day_count ?? 1) + 1;

    let query = this.supabaseAdmin
      .from('trips')
      .select(TRIP_DETAIL_SELECT)
      .eq('is_template', true)
      .eq('is_flagged', false)
      .eq('country_code', country.toUpperCase())
      .neq('id', source.id)
      .gte('day_count', minDays)
      .lte('day_count', maxDays)
      .order('average_rating', { ascending: false, nullsFirst: false })
      .limit(limit);

    // Prefer same difficulty, but don't exclude others
    if (source.difficulty) {
      query = query.eq('difficulty', source.difficulty);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(`findSimilarTrips failed: ${error.message}`);
      return [];
    }

    return (data ?? []).map((row) => mapRowToTrip(row as unknown as TripRow));
  }

  // ==========================================
  // Helpers
  // ==========================================

  private generateSlug(title: string): string {
    return title
      .normalize('NFKD') // split accents from base letters (é → e + combining mark)
      .replace(/[̀-ͯ]/g, '') // strip the combining diacritics
      .toLowerCase()
      .replace(/[‐-―]/g, '-') // en/em/figure dashes → hyphen ("Zion–Mount" → "zion-mount")
      .replace(/[^a-z0-9\s-]/g, ' ') // other punctuation → space, preserving word breaks
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 75)
      .replace(/-$/, ''); // a 75-char cut can land on a hyphen
  }
}
