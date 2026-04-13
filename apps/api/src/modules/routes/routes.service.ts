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
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import type { DiscoverRoutesFilterInput } from './dto/discover-routes-filter.input';
import type { Route, RouteConnection, RouteContributor } from './models/route.model';

/** Row shape from routes + users join */
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
  status: string;
  created_at: string;
  contributor_user_id: string;
  start_lat?: number;
  start_lng?: number;
  users: {
    id: string;
    display_name: string | null;
    public_username: string | null;
    avatar_url: string | null;
  } | null;
}

/** Row shape from ride waypoints */
interface WaypointRow {
  latitude: number;
  longitude: number;
  altitude: number | null;
  recorded_at: string;
  speed_mps: number | null;
}

@Injectable()
export class RoutesService {
  private readonly logger = new Logger(RoutesService.name);

  constructor(
    @Inject(SUPABASE_USER) private readonly supabase: SupabaseClient,
    @Inject(SUPABASE_ADMIN) private readonly supabaseAdmin: SupabaseClient,
  ) {}

  async discoverRoutes(
    filter: DiscoverRoutesFilterInput | undefined,
    first: number,
    after?: string,
  ): Promise<RouteConnection> {
    const limit = Math.min(first, 50);

    // Use raw SQL via RPC for spatial queries since Supabase client doesn't support PostGIS natively
    // For now, use the standard client with basic filters; PostGIS spatial filtering done via RPC
    let query = this.supabase
      .from('routes')
      .select(
        'id, name, description, polyline, distance_m, elevation_gain_m, surface_type, curvature_index, is_motovault_pick, editorial_description, rating_avg, rating_count, comment_count, status, created_at, contributor_user_id, users:contributor_user_id(id, display_name, public_username, avatar_url)',
      )
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    // Apply basic filters
    if (filter) {
      // Surface type filter
      if (filter.surfaceTypes && filter.surfaceTypes.length > 0) {
        query = query.in('surface_type', filter.surfaceTypes);
      }

      // Highly rated only
      if (filter.highlyRatedOnly) {
        query = query.gte('rating_avg', 4.0).gte('rating_count', 3);
      }

      // Length ranges
      if (filter.lengthRanges && filter.lengthRanges.length > 0) {
        const conditions: string[] = [];
        for (const range of filter.lengthRanges) {
          switch (range) {
            case 'under50':
              conditions.push('distance_m.lt.50000');
              break;
            case '50to100':
              conditions.push('and(distance_m.gte.50000,distance_m.lt.100000)');
              break;
            case '100to200':
              conditions.push('and(distance_m.gte.100000,distance_m.lt.200000)');
              break;
            case '200to500':
              conditions.push('and(distance_m.gte.200000,distance_m.lt.500000)');
              break;
            case 'over500':
              conditions.push('distance_m.gte.500000');
              break;
          }
        }
        // OR logic for length ranges is complex with Supabase client
        // For v1, filter the simplest case
        if (filter.lengthRanges.length === 1) {
          const r = filter.lengthRanges[0];
          if (r === 'under50') query = query.lt('distance_m', 50000);
          else if (r === '50to100') query = query.gte('distance_m', 50000).lt('distance_m', 100000);
          else if (r === '100to200')
            query = query.gte('distance_m', 100000).lt('distance_m', 200000);
          else if (r === '200to500')
            query = query.gte('distance_m', 200000).lt('distance_m', 500000);
          else if (r === 'over500') query = query.gte('distance_m', 500000);
        }
      }

      // Elevation ranges
      if (filter.elevationRanges && filter.elevationRanges.length === 1) {
        const e = filter.elevationRanges[0];
        if (e === 'flat') query = query.lt('elevation_gain_m', 200);
        else if (e === 'moderate')
          query = query.gte('elevation_gain_m', 200).lt('elevation_gain_m', 800);
        else if (e === 'mountainous') query = query.gte('elevation_gain_m', 800);
      }
    }

    // Cursor pagination
    if (after) {
      const decoded = Buffer.from(after, 'base64').toString('utf-8');
      if (Number.isNaN(Date.parse(decoded))) {
        throw new BadRequestException('Invalid cursor');
      }
      query = query.lt('created_at', decoded);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(`discoverRoutes failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to fetch routes');
    }

    const rows = (data ?? []) as unknown as RouteRow[];
    const hasNextPage = rows.length > limit;
    const sliced = hasNextPage ? rows.slice(0, limit) : rows;

    const edges = sliced.map((row) => {
      const node = this.mapRouteRow(row);
      return {
        node,
        cursor: Buffer.from(row.created_at).toString('base64'),
      };
    });

    const lastEdge = edges[edges.length - 1];

    return {
      edges,
      pageInfo: {
        hasNextPage,
        endCursor: lastEdge?.cursor,
      },
    };
  }

  async routeDetail(routeId: string): Promise<Route> {
    const { data, error } = await this.supabaseAdmin
      .from('routes')
      .select(
        'id, name, description, polyline, distance_m, elevation_gain_m, surface_type, curvature_index, is_motovault_pick, editorial_description, rating_avg, rating_count, comment_count, status, created_at, contributor_user_id, users:contributor_user_id(id, display_name, public_username, avatar_url)',
      )
      .eq('id', routeId)
      .eq('status', 'published')
      .single();

    if (error || !data) {
      throw new NotFoundException('Route not found');
    }

    return this.mapRouteRow(data as unknown as RouteRow);
  }

  async shareRideToDiscover(
    userId: string,
    input: { rideId: string; name?: string; surfaceType?: string },
  ): Promise<Route> {
    // 1. Fetch the ride (must be owned by user, completed, with polyline)
    const { data: ride, error: rideError } = await this.supabase
      .from('rides')
      .select('id, user_id, route_polyline, distance_m, elevation_gain, elevation_loss, status')
      .eq('id', input.rideId)
      .single();

    if (rideError || !ride) {
      throw new NotFoundException('Ride not found');
    }

    if (ride.user_id !== userId) {
      throw new ForbiddenException('You can only share your own rides');
    }

    if (ride.status !== 'completed') {
      throw new BadRequestException('Only completed rides can be shared');
    }

    if (!ride.route_polyline) {
      throw new BadRequestException('Ride has no route data');
    }

    // 2. Check if already shared
    const { data: existing } = await this.supabase
      .from('routes')
      .select('id')
      .eq('source_ride_id', input.rideId)
      .single();

    if (existing) {
      throw new BadRequestException('This ride is already shared on Discover');
    }

    // 3. Decode polyline to get waypoints for PostGIS geography
    const points = this.decodePolyline(ride.route_polyline);

    if (points.length < 2) {
      throw new BadRequestException('Route is too short to share');
    }

    // 4. Crop first/last 500m for privacy
    const croppedPoints = this.cropRouteEnds(points, 500);

    if (croppedPoints.length < 2) {
      throw new BadRequestException('Route is too short after privacy cropping');
    }

    // 5. Build PostGIS LINESTRING and cropped polyline
    const linestring = `LINESTRING(${croppedPoints.map((p) => `${p[1]} ${p[0]}`).join(',')})`;
    const startPoint = `POINT(${croppedPoints[0][1]} ${croppedPoints[0][0]})`;
    const endPoint = `POINT(${croppedPoints[croppedPoints.length - 1][1]} ${croppedPoints[croppedPoints.length - 1][0]})`;
    const croppedPolyline = this.encodePolyline(croppedPoints);

    // 6. Calculate curvature index
    const curvatureIndex = this.calculateCurvatureIndex(croppedPoints);

    // 7. Insert route using admin client (to set geography columns via raw SQL)
    const { data: route, error: insertError } = await this.supabaseAdmin
      .from('routes')
      .insert({
        contributor_user_id: userId,
        source_ride_id: input.rideId,
        name: input.name ?? null,
        polyline: croppedPolyline,
        distance_m: ride.distance_m,
        elevation_gain_m: ride.elevation_gain ?? null,
        surface_type: input.surfaceType ?? 'unknown',
        curvature_index: curvatureIndex,
      })
      .select('id')
      .single();

    if (insertError || !route) {
      this.logger.error(`shareRideToDiscover insert failed: ${insertError?.message}`);
      throw new InternalServerErrorException('Failed to share route');
    }

    // 8. Update geography columns via raw SQL (Supabase client can't set geography directly)
    const { error: geoError } = await this.supabaseAdmin.rpc('update_route_geography', {
      route_uuid: route.id,
      linestring_wkt: linestring,
      start_wkt: startPoint,
      end_wkt: endPoint,
    });

    if (geoError) {
      this.logger.warn(`Failed to set geography for route ${route.id}: ${geoError.message}`);
      // Non-fatal — route still exists, just without spatial indexing
    }

    // 9. Return the created route
    return this.routeDetail(route.id);
  }

  async unshareRoute(routeId: string, userId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('routes')
      .delete()
      .eq('id', routeId)
      .eq('contributor_user_id', userId);

    if (error) {
      this.logger.error(`unshareRoute failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to unshare route');
    }

    return true;
  }

  async exportRouteGPX(routeId: string): Promise<{ gpx: string; filename: string }> {
    // Fetch route + source ride waypoints
    const { data: route, error: routeError } = await this.supabaseAdmin
      .from('routes')
      .select('id, name, source_ride_id, polyline, distance_m, elevation_gain_m')
      .eq('id', routeId)
      .eq('status', 'published')
      .single();

    if (routeError || !route) {
      throw new NotFoundException('Route not found');
    }

    // Try to get detailed waypoints from source ride
    let waypoints: WaypointRow[] = [];
    if (route.source_ride_id) {
      const { data: wpData } = await this.supabaseAdmin
        .from('ride_waypoints')
        .select('latitude, longitude, altitude, recorded_at, speed_mps')
        .eq('ride_id', route.source_ride_id)
        .order('recorded_at', { ascending: true });

      waypoints = (wpData ?? []) as WaypointRow[];
    }

    // Fallback: decode polyline if no waypoints
    if (waypoints.length === 0) {
      const points = this.decodePolyline(route.polyline);
      waypoints = points.map((p, i) => ({
        latitude: p[0],
        longitude: p[1],
        altitude: null,
        recorded_at: new Date(Date.now() + i * 1000).toISOString(),
        speed_mps: null,
      }));
    }

    // Crop endpoints for privacy (same 500m crop)
    // For GPX we still apply privacy cropping
    const points = waypoints.map((w): [number, number] => [w.latitude, w.longitude]);
    const croppedIndices = this.getCropIndices(points, 500);
    const croppedWaypoints = waypoints.slice(croppedIndices.start, croppedIndices.end);

    const routeName = route.name ?? 'MotoVault Route';
    const sanitizedName = routeName.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-');

    const gpx = this.buildGpxXml(routeName, croppedWaypoints);

    return { gpx, filename: `${sanitizedName}-motovault.gpx` };
  }

  // --- Private helpers ---

  private mapRouteRow(row: RouteRow): Route {
    const contributor: RouteContributor = {
      id: row.users?.id ?? row.contributor_user_id,
      displayName: row.users?.display_name ?? 'Rider',
      publicUsername: row.users?.public_username ?? undefined,
      avatarUrl: row.users?.avatar_url ?? undefined,
    };

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
      status: row.status,
      createdAt: row.created_at,
      contributor,
      startLat: row.start_lat ?? undefined,
      startLng: row.start_lng ?? undefined,
    };
  }

  private decodePolyline(encoded: string): [number, number][] {
    const points: [number, number][] = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
      let shift = 0;
      let result = 0;
      let byte: number;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      lat += result & 1 ? ~(result >> 1) : result >> 1;

      shift = 0;
      result = 0;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      lng += result & 1 ? ~(result >> 1) : result >> 1;

      points.push([lat / 1e5, lng / 1e5]);
    }
    return points;
  }

  private encodePolyline(points: [number, number][]): string {
    let encoded = '';
    let prevLat = 0;
    let prevLng = 0;

    for (const [lat, lng] of points) {
      const latE5 = Math.round(lat * 1e5);
      const lngE5 = Math.round(lng * 1e5);
      encoded += this.encodeValue(latE5 - prevLat);
      encoded += this.encodeValue(lngE5 - prevLng);
      prevLat = latE5;
      prevLng = lngE5;
    }

    return encoded;
  }

  private encodeValue(value: number): string {
    let v = value < 0 ? ~(value << 1) : value << 1;
    let encoded = '';
    while (v >= 0x20) {
      encoded += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    encoded += String.fromCharCode(v + 63);
    return encoded;
  }

  /** Crop first/last `meters` from a route for privacy */
  private cropRouteEnds(points: [number, number][], meters: number): [number, number][] {
    const indices = this.getCropIndices(points, meters);
    return points.slice(indices.start, indices.end);
  }

  private getCropIndices(
    points: [number, number][],
    meters: number,
  ): { start: number; end: number } {
    let startIdx = 0;
    let distFromStart = 0;
    for (let i = 1; i < points.length; i++) {
      distFromStart += this.haversine(points[i - 1], points[i]);
      if (distFromStart >= meters) {
        startIdx = i;
        break;
      }
    }

    let endIdx = points.length;
    let distFromEnd = 0;
    for (let i = points.length - 1; i > startIdx; i--) {
      distFromEnd += this.haversine(points[i], points[i - 1]);
      if (distFromEnd >= meters) {
        endIdx = i;
        break;
      }
    }

    return { start: startIdx, end: endIdx };
  }

  /** Haversine distance in meters between two [lat, lng] points */
  private haversine(a: [number, number], b: [number, number]): number {
    const R = 6371000;
    const dLat = ((b[0] - a[0]) * Math.PI) / 180;
    const dLng = ((b[1] - a[1]) * Math.PI) / 180;
    const aLat = (a[0] * Math.PI) / 180;
    const bLat = (b[0] * Math.PI) / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(aLat) * Math.cos(bLat) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  /** Calculate curvature index: total heading change / total distance */
  private calculateCurvatureIndex(points: [number, number][]): number {
    if (points.length < 3) return 0;

    let totalHeadingChange = 0;
    let totalDistance = 0;

    for (let i = 1; i < points.length - 1; i++) {
      const h1 = this.bearing(points[i - 1], points[i]);
      const h2 = this.bearing(points[i], points[i + 1]);
      let diff = Math.abs(h2 - h1);
      if (diff > 180) diff = 360 - diff;
      totalHeadingChange += diff;
      totalDistance += this.haversine(points[i - 1], points[i]);
    }
    totalDistance += this.haversine(points[points.length - 2], points[points.length - 1]);

    return totalDistance > 0 ? totalHeadingChange / (totalDistance / 1000) : 0;
  }

  /** Bearing in degrees from point a to point b */
  private bearing(a: [number, number], b: [number, number]): number {
    const aLat = (a[0] * Math.PI) / 180;
    const bLat = (b[0] * Math.PI) / 180;
    const dLng = ((b[1] - a[1]) * Math.PI) / 180;
    const y = Math.sin(dLng) * Math.cos(bLat);
    const x = Math.cos(aLat) * Math.sin(bLat) - Math.sin(aLat) * Math.cos(bLat) * Math.cos(dLng);
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  }

  private buildGpxXml(name: string, waypoints: WaypointRow[]): string {
    const trkpts = waypoints
      .map((w) => {
        let pt = `      <trkpt lat="${w.latitude}" lon="${w.longitude}">`;
        if (w.altitude != null) pt += `\n        <ele>${w.altitude.toFixed(1)}</ele>`;
        pt += `\n        <time>${w.recorded_at}</time>`;
        pt += '\n      </trkpt>';
        return pt;
      })
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="MotoVault"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${this.escapeXml(name)}</name>
    <desc>Exported from MotoVault</desc>
    <time>${new Date().toISOString()}</time>
  </metadata>
  <trk>
    <name>${this.escapeXml(name)}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ==========================================
  // Route Reviews
  // ==========================================

  async getRouteReviews(routeId: string, first: number, after?: string) {
    const limit = Math.min(first, 50);

    const { count } = await this.supabaseAdmin
      .from('route_reviews')
      .select('*', { count: 'exact', head: true })
      .eq('route_id', routeId);

    let query = this.supabaseAdmin
      .from('route_reviews')
      .select(
        'id, rating, text, condition_tags, created_at, user_id, bike_id, users:user_id(id, display_name, public_username, avatar_url), motorcycles:bike_id(make, model, year)',
      )
      .eq('route_id', routeId)
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    if (after) {
      const decoded = Buffer.from(after, 'base64').toString('utf-8');
      if (Number.isNaN(Date.parse(decoded))) throw new BadRequestException('Invalid cursor');
      query = query.lt('created_at', decoded);
    }

    const { data, error } = await query;
    if (error) {
      this.logger.error(`getRouteReviews failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to fetch reviews');
    }

    const rows = data ?? [];
    const hasNextPage = rows.length > limit;
    const sliced = hasNextPage ? rows.slice(0, limit) : rows;

    const reviews = sliced.map((row: Record<string, unknown>) => {
      const users = row.users as {
        id: string;
        display_name: string | null;
        public_username: string | null;
        avatar_url: string | null;
      } | null;
      const moto = row.motorcycles as { make: string; model: string; year: number } | null;
      return {
        id: row.id as string,
        rating: row.rating as number,
        text: (row.text as string) ?? undefined,
        conditionTags: (row.condition_tags as string[]) ?? [],
        createdAt: row.created_at as string,
        author: {
          id: users?.id ?? (row.user_id as string),
          displayName: users?.display_name ?? 'Rider',
          publicUsername: users?.public_username ?? undefined,
          avatarUrl: users?.avatar_url ?? undefined,
        },
        bike: moto ? { make: moto.make, model: moto.model, year: moto.year } : undefined,
      };
    });

    const last = sliced[sliced.length - 1];
    return {
      reviews,
      hasNextPage,
      endCursor: last ? Buffer.from(last.created_at as string).toString('base64') : undefined,
      totalCount: count ?? 0,
    };
  }

  async createRouteReview(
    userId: string,
    input: {
      routeId: string;
      rating: number;
      text?: string;
      conditionTags?: string[];
      bikeId?: string;
    },
  ) {
    const { data, error } = await this.supabase
      .from('route_reviews')
      .insert({
        route_id: input.routeId,
        user_id: userId,
        rating: input.rating,
        text: input.text ?? null,
        condition_tags: input.conditionTags ?? [],
        bike_id: input.bikeId ?? null,
      })
      .select(
        'id, rating, text, condition_tags, created_at, user_id, users:user_id(id, display_name, public_username, avatar_url)',
      )
      .single();

    if (error) {
      if (error.code === '23505')
        throw new BadRequestException('You have already reviewed this route');
      this.logger.error(`createRouteReview failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to create review');
    }

    const users = (data as Record<string, unknown>).users as {
      id: string;
      display_name: string | null;
      public_username: string | null;
      avatar_url: string | null;
    } | null;
    return {
      id: data.id,
      rating: data.rating as number,
      text: (data.text as string | null) ?? undefined,
      conditionTags: (data.condition_tags as string[]) ?? [],
      createdAt: data.created_at as string,
      author: {
        id: users?.id ?? userId,
        displayName: users?.display_name ?? 'Rider',
        publicUsername: users?.public_username ?? undefined,
        avatarUrl: users?.avatar_url ?? undefined,
      },
    };
  }

  // ==========================================
  // Route Saves (Bookmarks)
  // ==========================================

  async saveRoute(userId: string, routeId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('route_saves')
      .insert({ route_id: routeId, user_id: userId });

    if (error) {
      if (error.code === '23505') return true; // Already saved
      this.logger.error(`saveRoute failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to save route');
    }
    return true;
  }

  async unsaveRoute(userId: string, routeId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('route_saves')
      .delete()
      .eq('route_id', routeId)
      .eq('user_id', userId);

    if (error) {
      this.logger.error(`unsaveRoute failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to unsave route');
    }
    return true;
  }

  async publicSavedRoutes(
    handle: string,
    first: number,
    after?: string,
  ): Promise<RouteConnection> {
    // 1. Look up user by public_username — must be public
    const { data: user, error: userError } = await this.supabaseAdmin
      .from('users')
      .select('id, is_public')
      .eq('public_username', handle)
      .single();

    if (userError || !user) {
      throw new NotFoundException('User not found');
    }

    if (!user.is_public) {
      throw new NotFoundException('User not found');
    }

    // 2. Fetch saved routes for that user
    const limit = Math.min(first, 50);

    let query = this.supabaseAdmin
      .from('route_saves')
      .select(
        'route_id, saved_at, routes:route_id(id, name, description, polyline, distance_m, elevation_gain_m, surface_type, curvature_index, is_motovault_pick, editorial_description, rating_avg, rating_count, comment_count, status, created_at, contributor_user_id, users:contributor_user_id(id, display_name, public_username, avatar_url))',
      )
      .eq('user_id', user.id)
      .order('saved_at', { ascending: false })
      .limit(limit + 1);

    if (after) {
      const decoded = Buffer.from(after, 'base64').toString('utf-8');
      if (Number.isNaN(Date.parse(decoded))) {
        throw new BadRequestException('Invalid cursor');
      }
      query = query.lt('saved_at', decoded);
    }

    const { data, error } = await query;
    if (error) {
      this.logger.error(`publicSavedRoutes failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to fetch saved routes');
    }

    const rows = data ?? [];
    const hasNextPage = rows.length > limit;
    const sliced = hasNextPage ? rows.slice(0, limit) : rows;

    const edges = sliced
      .filter((row: Record<string, unknown>) => row.routes != null)
      .map((row: Record<string, unknown>) => {
        const node = this.mapRouteRow(row.routes as unknown as RouteRow);
        return {
          node,
          cursor: Buffer.from(row.saved_at as string).toString('base64'),
        };
      });

    const lastEdge = edges[edges.length - 1];

    return {
      edges,
      pageInfo: {
        hasNextPage,
        endCursor: lastEdge?.cursor,
      },
    };
  }

  async getSavedRoutes(userId: string, first: number, after?: string) {
    const limit = Math.min(first, 50);

    let query = this.supabase
      .from('route_saves')
      .select(
        'route_id, saved_at, routes:route_id(id, name, polyline, distance_m, elevation_gain_m, surface_type, rating_avg, rating_count, is_motovault_pick, contributor_user_id, users:contributor_user_id(id, display_name, public_username, avatar_url))',
      )
      .eq('user_id', userId)
      .order('saved_at', { ascending: false })
      .limit(limit + 1);

    if (after) {
      const decoded = Buffer.from(after, 'base64').toString('utf-8');
      if (Number.isNaN(Date.parse(decoded))) throw new BadRequestException('Invalid cursor');
      query = query.lt('saved_at', decoded);
    }

    const { data, error } = await query;
    if (error) {
      this.logger.error(`getSavedRoutes failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to fetch saved routes');
    }

    const rows = data ?? [];
    const hasNextPage = rows.length > limit;
    const sliced = hasNextPage ? rows.slice(0, limit) : rows;

    return {
      saves: sliced.map((row: Record<string, unknown>) => ({
        routeId: row.route_id as string,
        savedAt: row.saved_at as string,
        route: row.routes ? this.mapRouteRow(row.routes as unknown as RouteRow) : undefined,
      })),
      hasNextPage,
    };
  }

  // ==========================================
  // Premium Waitlist
  // ==========================================

  async joinPremiumWaitlist(userId: string, feature: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('premium_waitlist')
      .insert({ user_id: userId, feature });

    if (error) {
      if (error.code === '23505') return true; // Already on waitlist
      this.logger.error(`joinPremiumWaitlist failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to join waitlist');
    }
    return true;
  }
}
