import { Inject, Injectable, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import type { BrowsePlace } from './models/browse-place.model';

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

  constructor(@Inject(SUPABASE_USER) private readonly supabase: SupabaseClient) {}

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
    const { data, error } = await this.supabase
      .from('places')
      .select('id, kind, name, country_code, region_code, latitude, longitude, population')
      .eq('kind', 'country')
      .order('name', { ascending: true });

    if (error) {
      this.logger.error(`browseCountries: ${error.message}`);
      throw new Error(`browseCountries: ${error.message}`);
    }
    return (data ?? []).map((r) => this.mapPlace(r as PlaceRow));
  }

  async browseCountryBySlug(slug: string): Promise<BrowsePlace | null> {
    const code = slug.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) return null;

    const { data, error } = await this.supabase
      .from('places')
      .select('id, kind, name, country_code, region_code, latitude, longitude, population')
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

    const { data, error } = await this.supabase
      .from('places')
      .select('id, kind, name, country_code, region_code, latitude, longitude, population')
      .eq('kind', 'region')
      .eq('country_code', country.countryCode)
      .gt('population', 0)
      .order('population', { ascending: false });

    if (error) {
      this.logger.error(`browseRegionsByCountrySlug: ${error.message}`);
      throw new Error(`browseRegionsByCountrySlug: ${error.message}`);
    }
    return (data ?? []).map((r) => this.mapPlace(r as PlaceRow));
  }

  async browseExploreRegion(
    countrySlug: string,
    regionSlug: string,
  ): Promise<{ country: BrowsePlace; region: BrowsePlace } | null> {
    const country = await this.browseCountryBySlug(countrySlug);
    if (!country) return null;

    const { data, error } = await this.supabase
      .from('places')
      .select('id, kind, name, country_code, region_code, latitude, longitude, population')
      .eq('kind', 'region')
      .eq('country_code', country.countryCode)
      .eq('region_code', regionSlug)
      .maybeSingle();

    if (error || !data) return null;
    return { country, region: this.mapPlace(data as PlaceRow) };
  }
}
