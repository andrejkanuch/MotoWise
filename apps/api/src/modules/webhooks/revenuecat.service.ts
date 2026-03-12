import { Inject, Injectable, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import type { RevenueCatEvent } from './dto/revenuecat-event.dto';

@Injectable()
export class RevenueCatService {
  private readonly logger = new Logger(RevenueCatService.name);

  constructor(@Inject(SUPABASE_ADMIN) private readonly adminClient: SupabaseClient) {}

  async processEvent(event: RevenueCatEvent): Promise<void> {
    const { error } = await this.adminClient.rpc('process_revenuecat_event', {
      p_event_id: event.id,
      p_event_type: event.type,
      p_app_user_id: event.app_user_id,
      p_expiration_at: event.expiration_at_ms
        ? new Date(event.expiration_at_ms).toISOString()
        : null,
      p_period_type: event.period_type ?? null,
    });

    if (error) {
      if (error.message?.includes('already_processed')) {
        this.logger.log(`Event ${event.id} already processed, skipping`);
        return;
      }
      this.logger.error(`Failed to process event ${event.id}: ${error.message}`);
      throw error;
    }

    this.logger.log(`Processed ${event.type} for user ${event.app_user_id}`);
  }
}
