import {
  RIDER_INSIGHTS_GROUP,
  RIDER_INSIGHTS_MIN_QUALIFYING_RIDES,
  type RiderInsights,
  RiderInsightsSchema,
  RiderInsightsWindowSchema,
} from '@motovault/types';
import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveTier } from '../../common/entitlements/resolve-tier';
import { unwrapServiceRole } from '../../common/supabase/unwrap';
import { localDateIn, resolveRiderTimeZone } from '../../common/time-zone/rider-time-zone';
import { TIERS } from '../entitlements/entitlements.types';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import { RevenueCatService } from '../webhooks/revenuecat.service';
import { buildRiderInsights } from './build-rider-insights';
import {
  RIDER_INSIGHTS_ROUTE_TOLERANCE_M,
  RIDER_INSIGHTS_SEASON_RPC,
  type SeasonRow,
} from './rider-insights.types';

/** Every detail group: locked groups are built from the same detail, so all are always read. */
const ALL_GROUPS = Object.values(RIDER_INSIGHTS_GROUP);
const YEAR_LENGTH = 4;

export interface RiderInsightsArgs {
  from?: string | null;
  to?: string | null;
  timeZone?: string | null;
  /** Ask RevenueCat first, so a purchase the webhook has not delivered yet unlocks now. */
  refreshEntitlement?: boolean | null;
}

interface Window {
  from: string;
  to: string;
}

const seasonOf = (year: number): Window => ({ from: `${year}-01-01`, to: `${year}-12-31` });

@Injectable()
export class RiderInsightsService {
  private readonly logger = new Logger(RiderInsightsService.name);

  constructor(
    @Inject(SUPABASE_ADMIN) private readonly supabaseAdmin: SupabaseClient,
    private readonly revenueCatService: RevenueCatService,
  ) {}

  /**
   * One season of insights. The rider's real tier is resolved first (never
   * `user.tier`, which reads Pro for everyone while enforcement is off), then
   * the season is read with the service-role client for this rider's id only.
   *
   * Without an explicit window the season is the calendar year in the rider's
   * zone, except that the previous year stays while the new one has fewer than
   * five qualifying rides and the previous one has rides.
   */
  async getRiderInsights(userId: string, args: RiderInsightsArgs = {}): Promise<RiderInsights> {
    const explicit = this.explicitWindow(args);

    if (args.refreshEntitlement) await this.revenueCatService.fetchSubscriberEntitlements(userId);
    const isPro = (await resolveTier(this.supabaseAdmin, userId)) === TIERS.PRO;

    const row = explicit
      ? await this.readSeason(userId, explicit)
      : await this.readShownSeason(userId, args.timeZone);

    const parsed = RiderInsightsSchema.safeParse(buildRiderInsights(row, isPro));
    if (!parsed.success) {
      this.logger.error(`riderInsights failed its contract for ${userId}: ${parsed.error.message}`);
      throw new InternalServerErrorException('Could not build rider insights');
    }
    return parsed.data;
  }

  private explicitWindow(args: RiderInsightsArgs): Window | null {
    if (args.from == null && args.to == null) return null;
    const parsed = RiderInsightsWindowSchema.safeParse({ from: args.from, to: args.to });
    if (!parsed.success) {
      throw new BadRequestException(
        'from and to must both be dates (YYYY-MM-DD), from on or before to',
      );
    }
    return parsed.data;
  }

  private async readShownSeason(
    userId: string,
    timeZone: string | null | undefined,
  ): Promise<SeasonRow> {
    const zone = await resolveRiderTimeZone(this.supabaseAdmin, userId, timeZone);
    const year = Number(localDateIn(zone).slice(0, YEAR_LENGTH));

    const current = await this.readSeason(userId, seasonOf(year));
    if (current.coverage.qualifying_rides >= RIDER_INSIGHTS_MIN_QUALIFYING_RIDES) return current;

    const previous = await this.readSeason(userId, seasonOf(year - 1));
    return previous.coverage.rides > 0 ? previous : current;
  }

  private async readSeason(userId: string, window: Window): Promise<SeasonRow> {
    const result = await this.supabaseAdmin.rpc(RIDER_INSIGHTS_SEASON_RPC, {
      p_user_id: userId,
      p_from: window.from,
      p_to: window.to,
      p_groups: ALL_GROUPS,
      p_tolerance: RIDER_INSIGHTS_ROUTE_TOLERANCE_M,
    });
    return unwrapServiceRole<SeasonRow>(result, {
      logger: this.logger,
      op: 'riderInsightsSeason',
      message: 'Could not read rider insights',
    });
  }
}
