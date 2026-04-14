import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Redis } from '@upstash/redis';
import { REDIS } from '../redis/redis.constants';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import type { FuelRangeSummary, FuelStop } from './models/fuel-stop.model';

/** Overpass API element shape */
interface OverpassElement {
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

/** Overpass API response shape */
interface OverpassResponse {
  elements: OverpassElement[];
}

/** Safety margin — only count 80% of theoretical range */
const RANGE_SAFETY_FACTOR = 0.8;

/** Cache TTL for Overpass results: 24 hours in seconds */
const OVERPASS_CACHE_TTL_S = 86_400;

/** Default fuel efficiency (km/L) when we can't compute from logs */
const DEFAULT_KM_PER_LITER = 18;

/** Default tank capacity (liters) when bike data is unavailable */
const DEFAULT_TANK_LITERS = 15;

@Injectable()
export class FuelStopsService {
  private readonly logger = new Logger(FuelStopsService.name);

  /** In-memory rate limiter — last Overpass request timestamp */
  private lastOverpassRequestMs = 0;

  constructor(
    @Inject(SUPABASE_USER) private readonly supabase: SupabaseClient,
    @Inject(REDIS) private readonly redis: Redis | null,
  ) {}

  // ==========================================
  // Core Calculations
  // ==========================================

  /**
   * Effective range with 80% safety margin.
   * e.g. 15L tank * 20 km/L * 0.8 = 240 km effective range
   */
  calculateEffectiveRange(tankLiters: number, kmPerLiter: number): number {
    return tankLiters * kmPerLiter * RANGE_SAFETY_FACTOR;
  }

  /**
   * Compute a human-readable fuel range summary.
   */
  computeFuelRangeSummary(routeDistanceKm: number, effectiveRangeKm: number): FuelRangeSummary {
    const stopsRequired =
      effectiveRangeKm > 0 ? Math.max(0, Math.ceil(routeDistanceKm / effectiveRangeKm) - 1) : 0;

    let summary: string;
    if (stopsRequired === 0) {
      summary = 'You can complete this route without refueling.';
    } else if (stopsRequired === 1) {
      summary = "You'll need to refuel 1 time along this route.";
    } else {
      summary = `You'll need to refuel ${stopsRequired} times along this route.`;
    }

    return { effectiveRangeKm, stopsRequired, summary };
  }

  // ==========================================
  // Overpass API Integration
  // ==========================================

  /**
   * Fetch fuel stops near a route's polyline via the Overpass API.
   * Results are cached for 24h in Redis (when available).
   */
  async getFuelStopsNearRoute(routeId: string, radiusKm = 5): Promise<FuelStop[]> {
    // 1. Fetch route polyline + start coordinates
    const { data: route, error } = await this.supabase
      .from('routes')
      .select('id, polyline, start_lat, start_lng, distance_m')
      .eq('id', routeId)
      .single();

    if (error || !route) {
      throw new NotFoundException(`Route ${routeId} not found`);
    }

    // 2. Decode polyline to get sample points along the route
    const points = this.decodePolyline(route.polyline);
    if (points.length === 0) {
      return [];
    }

    // 3. Sample points to avoid huge Overpass queries (max ~10 points)
    const sampledPoints = this.samplePoints(points, 10);

    // 4. Build cache key from route ID + radius
    const cacheKey = `fuel-stops:${routeId}:${radiusKm}`;

    // 5. Check cache
    if (this.redis) {
      const cached = await this.redis.get<FuelStop[]>(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for ${cacheKey}`);
        return cached;
      }
    }

    // 6. Query Overpass API
    const fuelStops = await this.queryOverpass(sampledPoints, radiusKm * 1000);

    // 7. Cache results
    if (this.redis && fuelStops.length > 0) {
      await this.redis.set(cacheKey, fuelStops, { ex: OVERPASS_CACHE_TTL_S });
    }

    return fuelStops;
  }

  /**
   * Estimate the bike's fuel efficiency from fuel logs, or fall back to defaults.
   * Returns { tankLiters, kmPerLiter }.
   */
  async getBikeFuelData(bikeId: string): Promise<{ tankLiters: number; kmPerLiter: number }> {
    // Try to compute average km/L from the user's fuel logs
    const { data: logs } = await this.supabase
      .from('fuel_logs')
      .select('odometer_km, fuel_litres, is_partial')
      .eq('motorcycle_id', bikeId)
      .eq('is_partial', false)
      .order('odometer_km', { ascending: true })
      .limit(20);

    let kmPerLiter = DEFAULT_KM_PER_LITER;

    if (logs && logs.length >= 2) {
      // Compute average consumption from consecutive full fill-ups
      let totalKm = 0;
      let totalLitres = 0;

      for (let i = 1; i < logs.length; i++) {
        const distKm = logs[i].odometer_km - logs[i - 1].odometer_km;
        if (distKm > 0) {
          totalKm += distKm;
          totalLitres += logs[i].fuel_litres;
        }
      }

      if (totalLitres > 0) {
        kmPerLiter = totalKm / totalLitres;
      }
    }

    // Tank capacity isn't in the DB schema — use metadata or default
    const { data: bike } = await this.supabase
      .from('motorcycles')
      .select('metadata')
      .eq('id', bikeId)
      .single();

    let tankLiters = DEFAULT_TANK_LITERS;
    if (bike?.metadata && typeof bike.metadata === 'object') {
      const meta = bike.metadata as Record<string, unknown>;
      if (typeof meta.tank_capacity_liters === 'number') {
        tankLiters = meta.tank_capacity_liters;
      }
    }

    return { tankLiters, kmPerLiter };
  }

  /**
   * Get route distance in km by route ID.
   */
  async getRouteDistanceKm(routeId: string): Promise<number> {
    const { data } = await this.supabase
      .from('routes')
      .select('distance_m')
      .eq('id', routeId)
      .single();

    return data?.distance_m ? data.distance_m / 1000 : 0;
  }

  // ==========================================
  // Private Helpers
  // ==========================================

  /**
   * Rate-limited Overpass API query for amenity=fuel near sampled route points.
   */
  private async queryOverpass(
    points: Array<{ lat: number; lng: number }>,
    radiusM: number,
  ): Promise<FuelStop[]> {
    // Enforce ~1 req/sec rate limit
    const now = Date.now();
    const elapsed = now - this.lastOverpassRequestMs;
    if (elapsed < 1000) {
      await this.delay(1000 - elapsed);
    }
    this.lastOverpassRequestMs = Date.now();

    // Build a union query for fuel stations near each sampled point
    const aroundStatements = points
      .map((p) => `node["amenity"="fuel"](around:${radiusM},${p.lat},${p.lng});`)
      .join('\n');

    const query = `
      [out:json][timeout:25];
      (
        ${aroundStatements}
      );
      out body;
    `.trim();

    try {
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      });

      if (!response.ok) {
        this.logger.warn(`Overpass API returned ${response.status}`);
        return [];
      }

      const data = (await response.json()) as OverpassResponse;

      // Deduplicate by OSM id
      const seen = new Set<number>();
      const stops: FuelStop[] = [];

      for (const el of data.elements) {
        if (seen.has(el.id)) continue;
        seen.add(el.id);

        stops.push({
          osmId: el.id,
          name: el.tags?.name ?? 'Fuel Station',
          lat: el.lat,
          lng: el.lon,
          amenity: el.tags?.amenity ?? 'fuel',
        });
      }

      this.logger.log(`Found ${stops.length} fuel stops near route`);
      return stops;
    } catch (err) {
      this.logger.error('Overpass API request failed', err);
      return [];
    }
  }

  /**
   * Decode a Google-encoded polyline string into lat/lng points.
   * https://developers.google.com/maps/documentation/utilities/polylinealgorithm
   */
  private decodePolyline(encoded: string): Array<{ lat: number; lng: number }> {
    const points: Array<{ lat: number; lng: number }> = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
      let result = 0;
      let shift = 0;
      let byte: number;

      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      lat += result & 1 ? ~(result >> 1) : result >> 1;

      result = 0;
      shift = 0;

      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      lng += result & 1 ? ~(result >> 1) : result >> 1;

      points.push({ lat: lat / 1e5, lng: lng / 1e5 });
    }

    return points;
  }

  /**
   * Evenly sample N points from an array.
   */
  private samplePoints(
    points: Array<{ lat: number; lng: number }>,
    maxPoints: number,
  ): Array<{ lat: number; lng: number }> {
    if (points.length <= maxPoints) return points;

    const sampled: Array<{ lat: number; lng: number }> = [];
    const step = (points.length - 1) / (maxPoints - 1);

    for (let i = 0; i < maxPoints; i++) {
      sampled.push(points[Math.round(i * step)]);
    }

    return sampled;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
