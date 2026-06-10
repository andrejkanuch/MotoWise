import { Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Redis } from '@upstash/redis';
import { REDIS } from '../redis/redis.constants';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import type { BrowsePlace } from './models/browse-place.model';

/** Taxonomy is effectively static — cache for an hour (powers SSR + sitemap). */
const TAXONOMY_CACHE_TTL_S = 60 * 60;
const COUNTRIES_CACHE_KEY = 'places:countries';
const regionsCacheKey = (countryCode: string) => `places:regions:${countryCode}`;

/** When `places` has no country row yet (matches web explore fallback). */
const COUNTRY_FALLBACK: Record<string, string> = {
  US: 'United States',
  DE: 'Germany',
  AT: 'Austria',
  CH: 'Switzerland',
  IT: 'Italy',
  ES: 'Spain',
  FR: 'France',
  GB: 'United Kingdom',
  PT: 'Portugal',
  GR: 'Greece',
  HR: 'Croatia',
  NO: 'Norway',
  SE: 'Sweden',
  RO: 'Romania',
  CZ: 'Czech Republic',
};

interface PlaceRow {
  id: string | number;
  kind: string;
  name: string;
  country_code: string;
  region_code: string | null;
  latitude?: number;
  longitude?: number;
  population?: number | null;
  parent_id?: string | null;
  route_count?: number | null;
}

@Injectable()
export class PlacesService {
  private readonly logger = new Logger(PlacesService.name);

  constructor(
    @Inject(SUPABASE_USER) private readonly supabase: SupabaseClient,
    @Inject(REDIS) private readonly redis: Redis | null,
  ) {}

  private mapPlace(row: PlaceRow): BrowsePlace {
    const id = String(row.id);
    const countryCode = row.country_code.toUpperCase();
    const slug =
      row.kind === 'country'
        ? row.country_code.toLowerCase()
        : (row.region_code?.toLowerCase() ?? row.country_code.toLowerCase());
    return {
      id,
      kind: row.kind,
      name: row.name,
      countryCode,
      regionCode: row.region_code ?? undefined,
      slug,
      parentId: row.parent_id ?? undefined,
      routeCount: row.route_count ?? 0,
    };
  }

  async browseCountries(): Promise<BrowsePlace[]> {
    // This endpoint (SSR + sitemap) is what got the throttler removed; cache the
    // static taxonomy for an hour. Null-safe: skip caching when Redis is absent.
    if (this.redis) {
      const cached = await this.redis.get<BrowsePlace[]>(COUNTRIES_CACHE_KEY);
      if (cached) return cached;
    }

    const { data, error } = await this.supabase
      .from('places')
      .select(
        'id, kind, name, country_code, region_code, latitude, longitude, population, route_count',
      )
      .eq('kind', 'country')
      .order('name', { ascending: true });

    if (error) {
      this.logger.error(`browseCountries: ${error.message}`);
      throw new InternalServerErrorException(`browseCountries: ${error.message}`);
    }

    const countries = (data ?? []).map((r) => this.mapPlace(r as PlaceRow));
    if (this.redis && countries.length > 0) {
      await this.redis.set(COUNTRIES_CACHE_KEY, countries, { ex: TAXONOMY_CACHE_TTL_S });
    }
    return countries;
  }

  async browseCountryBySlug(slug: string): Promise<BrowsePlace | null> {
    const code = slug.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) return null;

    const { data, error } = await this.supabase
      .from('places')
      .select(
        'id, kind, name, country_code, region_code, latitude, longitude, population, route_count',
      )
      .eq('kind', 'country')
      .eq('country_code', code)
      .maybeSingle();

    if (!error && data) {
      return this.mapPlace(data as PlaceRow);
    }

    const name = COUNTRY_FALLBACK[code];
    if (!name) return null;
    return {
      id: code,
      kind: 'country',
      name,
      countryCode: code,
      slug: slug.trim().toLowerCase(),
      routeCount: 0,
    };
  }

  async browseRegionsByCountrySlug(countrySlug: string): Promise<BrowsePlace[]> {
    const country = await this.browseCountryBySlug(countrySlug);
    if (!country) return [];

    const cacheKey = regionsCacheKey(country.countryCode);
    if (this.redis) {
      const cached = await this.redis.get<BrowsePlace[]>(cacheKey);
      if (cached) return cached;
    }

    const { data, error } = await this.supabase
      .from('places')
      .select(
        'id, kind, name, country_code, region_code, latitude, longitude, population, route_count',
      )
      .eq('kind', 'region')
      .eq('country_code', country.countryCode)
      .gt('population', 0)
      .order('population', { ascending: false });

    if (error) {
      this.logger.error(`browseRegionsByCountrySlug: ${error.message}`);
      throw new InternalServerErrorException(`browseRegionsByCountrySlug: ${error.message}`);
    }

    const regions = (data ?? []).map((r) => this.mapPlace(r as PlaceRow));
    if (this.redis && regions.length > 0) {
      await this.redis.set(cacheKey, regions, { ex: TAXONOMY_CACHE_TTL_S });
    }
    return regions;
  }

  async browseExploreRegion(
    countrySlug: string,
    regionSlug: string,
  ): Promise<{ country: BrowsePlace; region: BrowsePlace } | null> {
    const country = await this.browseCountryBySlug(countrySlug);
    if (!country) return null;

    const { data, error } = await this.supabase
      .from('places')
      .select(
        'id, kind, name, country_code, region_code, latitude, longitude, population, route_count',
      )
      .eq('kind', 'region')
      .eq('country_code', country.countryCode)
      .eq('region_code', regionSlug)
      .maybeSingle();

    if (error) {
      this.logger.error(`browseExploreRegion: ${error.message}`);
      throw new InternalServerErrorException(`browseExploreRegion: ${error.message}`);
    }
    if (!data) return null;
    return { country, region: this.mapPlace(data as PlaceRow) };
  }
}
