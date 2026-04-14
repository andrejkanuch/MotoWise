import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
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
    @Inject(SUPABASE_ADMIN) readonly _supabaseAdmin: SupabaseClient,
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

  /** Increment impressions_count for a sponsorship */
  async trackImpression(sponsorshipId: string): Promise<boolean> {
    if (!this.isEnabled()) return false;

    const { data: existing, error: fetchError } = await this.supabase
      .from('sponsorships')
      .select('id, impressions_count, cost_per_impression, spent_this_month, monthly_budget')
      .eq('id', sponsorshipId)
      .eq('status', 'active')
      .single();

    if (fetchError || !existing) {
      throw new NotFoundException(`Sponsorship ${sponsorshipId} not found or inactive`);
    }

    const newSpent = Number(existing.spent_this_month) + Number(existing.cost_per_impression);

    const { error } = await this.supabase
      .from('sponsorships')
      .update({
        impressions_count: existing.impressions_count + 1,
        spent_this_month: newSpent,
        // Auto-pause if budget is exhausted
        ...(newSpent >= Number(existing.monthly_budget) && Number(existing.monthly_budget) > 0
          ? { status: 'paused' }
          : {}),
      })
      .eq('id', sponsorshipId);

    if (error) {
      this.logger.error(`trackImpression failed: ${error.message}`);
      return false;
    }

    return true;
  }

  /** Increment clicks_count for a sponsorship */
  async trackClick(sponsorshipId: string): Promise<boolean> {
    if (!this.isEnabled()) return false;

    const { data: existing, error: fetchError } = await this.supabase
      .from('sponsorships')
      .select('id, clicks_count')
      .eq('id', sponsorshipId)
      .eq('status', 'active')
      .single();

    if (fetchError || !existing) {
      throw new NotFoundException(`Sponsorship ${sponsorshipId} not found or inactive`);
    }

    const { error } = await this.supabase
      .from('sponsorships')
      .update({ clicks_count: existing.clicks_count + 1 })
      .eq('id', sponsorshipId);

    if (error) {
      this.logger.error(`trackClick failed: ${error.message}`);
      return false;
    }

    return true;
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
      costPerImpression: Number(row.cost_per_impression),
      monthlyBudget: Number(row.monthly_budget),
      spentThisMonth: Number(row.spent_this_month),
      startsAt: new Date(row.starts_at as string),
      endsAt: row.ends_at ? new Date(row.ends_at as string) : undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}
