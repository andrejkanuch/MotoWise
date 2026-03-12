import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import type { RevenueCatEvent } from './dto/revenuecat-event.dto';

@Injectable()
export class RevenueCatService {
  private readonly logger = new Logger(RevenueCatService.name);

  constructor(
    private readonly configService: ConfigService,
    @Inject(SUPABASE_ADMIN) private readonly adminClient: SupabaseClient,
  ) {}

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

  async cancelSubscription(userId: string): Promise<void> {
    const rcApiKey = this.configService.get<string>('REVENUECAT_SECRET_API_KEY');
    if (!rcApiKey) {
      this.logger.warn(
        'REVENUECAT_SECRET_API_KEY not configured — skipping subscription cancellation',
      );
      return;
    }

    try {
      const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${rcApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok && response.status !== 404) {
        throw new Error(`RevenueCat API returned ${response.status}`);
      }

      this.logger.log(`RevenueCat subscriber ${userId} deleted`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new Error(`RevenueCat cancellation failed: ${message}`);
    }
  }
}
