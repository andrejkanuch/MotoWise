import { Inject, Injectable, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { RevalidationService } from '../../../common/revalidation/revalidation.service';
import { SUPABASE_ADMIN } from '../../supabase/supabase-admin.provider';
import {
  TEMPLATE_LOCATION_COLUMNS,
  type TemplateLocationRow,
  templateRowRevalidation,
} from '../trip-revalidation';

/**
 * Refreshes the web's cached explore + trip pages after a trip mutation. Those
 * pages are cached for 30 days, so every mutation that changes what they show
 * (trip edit or delete, waypoints, moderation, reviews) calls one of these.
 * Best-effort: never throws, because the mutation has already succeeded.
 */
@Injectable()
export class TripPageRevalidator {
  private readonly logger = new Logger(TripPageRevalidator.name);

  constructor(
    @Inject(SUPABASE_ADMIN) private readonly supabaseAdmin: SupabaseClient,
    private readonly revalidation: RevalidationService,
  ) {}

  /** For a row that already carries {@link TEMPLATE_LOCATION_COLUMNS}. No-op for a non-template. */
  fromRow(row: TemplateLocationRow | null | undefined): void {
    const payload = templateRowRevalidation(row);
    if (payload) this.revalidation.revalidate(payload);
  }

  /** Looks the trip up first. A failed lookup only skips the refresh. */
  async forTrip(tripId: string): Promise<void> {
    const { data, error } = await this.supabaseAdmin
      .from('trips')
      .select(TEMPLATE_LOCATION_COLUMNS)
      .eq('id', tripId)
      .maybeSingle();
    if (error) {
      this.logger.warn(`trip page lookup failed: ${error.message} (${error.code})`);
      return;
    }
    this.fromRow(data);
  }
}
