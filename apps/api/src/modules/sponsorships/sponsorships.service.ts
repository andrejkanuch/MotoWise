import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import type { Sponsorship } from './models/sponsorship.model';

@Injectable()
export class SponsorshipsService {
  private readonly logger = new Logger(SponsorshipsService.name);

  constructor(
    @Inject(SUPABASE_USER) private readonly supabase: SupabaseClient,
    @Inject(SUPABASE_ADMIN) private readonly supabaseAdmin: SupabaseClient,
    private readonly configService: ConfigService,
  ) {}

  /** Returns true when the FEATURE_SPONSORSHIPS env var is truthy */
  isEnabled(): boolean {
    const flag = this.configService.get<string>('FEATURE_SPONSORSHIPS', '');
    return flag === 'true' || flag === '1';
  }

  /** Fetch active sponsorships for a given route */
  async getActiveByRoute(routeId: string): Promise<Sponsorship[]> {
    if (!this.isEnabled()) return [];

    const { data, error } = await this.supabase
      .from('sponsorships')
      .select('*')
      .eq('route_id', routeId)
      .eq('status', 'active')
      .lte('starts_at', new Date().toISOString())
      .or(`ends_at.is.null,ends_at.gte.${new Date().toISOString()}`)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`getActiveByRoute failed: ${error.message}`);
      return [];
    }

    return (data ?? []).map(this.mapRow);
  }

  /**
   * Atomically increment impressions_count + spend (with budget clamp and
   * auto-pause) via the track_sponsorship_impression RPC (audit H8). The RPC
   * is service_role-only — the previous user-client read-modify-write both
   * raced on spent_this_month and silently no-oped under RLS for any viewer
   * who wasn't the sponsor.
   *
   * @returns true when an active, in-window sponsorship was updated
   */
  async trackImpression(sponsorshipId: string): Promise<boolean> {
    if (!this.isEnabled()) return false;

    const { data, error } = await this.supabaseAdmin.rpc('track_sponsorship_impression', {
      p_id: sponsorshipId,
    });

    if (error) {
      this.logger.error(`trackImpression failed: ${error.message}`);
      return false;
    }

    return data === true;
  }

  /** Atomically increment clicks_count via the track_sponsorship_click RPC (audit H8). */
  async trackClick(sponsorshipId: string): Promise<boolean> {
    if (!this.isEnabled()) return false;

    const { data, error } = await this.supabaseAdmin.rpc('track_sponsorship_click', {
      p_id: sponsorshipId,
    });

    if (error) {
      this.logger.error(`trackClick failed: ${error.message}`);
      return false;
    }

    return data === true;
  }

  /** Map a snake_case DB row to a camelCase Sponsorship */
  private mapRow(row: Record<string, unknown>): Sponsorship {
    return {
      id: row.id as string,
      sponsorId: row.sponsor_id as string,
      routeId: row.route_id as string,
      placementType: row.placement_type as string,
      title: row.title as string,
      description: (row.description as string) ?? undefined,
      imageUrl: (row.image_url as string) ?? undefined,
      ctaText: (row.cta_text as string) ?? undefined,
      ctaUrl: (row.cta_url as string) ?? undefined,
      impressionsCount: row.impressions_count as number,
      clicksCount: row.clicks_count as number,
      status: row.status as string,
      startsAt: new Date(row.starts_at as string),
      endsAt: row.ends_at ? new Date(row.ends_at as string) : undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}
