import { Inject, Injectable, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import type { TypeaheadResult } from './models/typeahead-result.model';

const MAX_LIMIT = 20;

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(@Inject(SUPABASE_ADMIN) private readonly supabase: SupabaseClient) {}

  async typeahead(
    q: string | null,
    _near: { lat: number; lng: number } | null,
    limit: number,
  ): Promise<TypeaheadResult> {
    if (!q || q.trim() === '') {
      return { routes: [], places: [] };
    }

    const sanitized = q.trim();
    const safeLimit = Math.min(Math.max(limit, 1), MAX_LIMIT);

    const { data, error } = await this.supabase.rpc('typeahead_search', {
      search_term: sanitized,
      result_limit: safeLimit,
    });

    if (error) {
      this.logger.error(`Typeahead search failed: ${error.message}`, error);
      return { routes: [], places: [] };
    }

    const rows = (data ?? []) as Array<{
      source: string;
      id: string | number;
      name: string;
      slug: string | null;
      kind: string | null;
      country_code: string;
      region_code: string | null;
      population: number | null;
      sim: number;
    }>;

    const routes = rows
      .filter((r) => r.source === 'route')
      .map((r) => ({
        id: String(r.id),
        name: r.name,
        slug: r.slug ?? '',
        countryCode: r.country_code,
        regionCode: r.region_code ?? undefined,
      }));

    const places = rows
      .filter((r) => r.source === 'place')
      .map((r) => ({
        id: Number(r.id),
        name: r.name,
        kind: r.kind ?? '',
        countryCode: r.country_code,
        regionCode: r.region_code ?? undefined,
        population: r.population ?? 0,
      }));

    return { routes, places };
  }
}
