import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SupabaseClient } from '@supabase/supabase-js';
import { MetaEventsService } from '../meta/meta-events.service';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import type { RevenueCatEvent } from './dto/revenuecat-event.dto';

@Injectable()
export class RevenueCatService {
  private readonly logger = new Logger(RevenueCatService.name);

  constructor(
    private readonly configService: ConfigService,
    @Inject(SUPABASE_ADMIN) private readonly adminClient: SupabaseClient,
    private readonly metaEventsService: MetaEventsService,
  ) {}

  async processEvent(event: RevenueCatEvent): Promise<void> {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(event.app_user_id)) {
      this.logger.log(
        `Skipping event ${event.id}: app_user_id "${event.app_user_id}" is not a UUID`,
      );
      return;
    }

    // NON_RENEWING_PURCHASE (lifetime Pro) is handled by process_revenuecat_event
    // like every other purchase event — it grants Pro with no expiry. (Health
    // reports are a free feature; the old paid-IAP path was removed.)
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

    const purchaseSource = this.mapStoreToPurchaseSource(event.store);
    this.logger.log(
      `Processed ${event.type} for user ${event.app_user_id} (source: ${purchaseSource})`,
    );

    // Fire Meta CAPI events for ad attribution (fire and forget)
    this.fireMetaEvent(event, purchaseSource).catch((err) => {
      this.logger.warn(`Meta CAPI event failed for ${event.id}: ${err}`);
    });
  }

  /**
   * Map RevenueCat store identifier to a human-readable purchase source.
   * RC_BILLING = Stripe (web checkout via RevenueCat Web Billing).
   */
  private mapStoreToPurchaseSource(
    store: string | undefined,
  ): 'ios' | 'android' | 'web' | 'unknown' {
    switch (store) {
      case 'APP_STORE':
      case 'app_store':
        return 'ios';
      case 'PLAY_STORE':
      case 'play_store':
        return 'android';
      case 'STRIPE':
      case 'stripe':
      case 'RC_BILLING':
      case 'rc_billing':
        return 'web';
      default:
        return 'unknown';
    }
  }

  private async fireMetaEvent(event: RevenueCatEvent, purchaseSource: string): Promise<void> {
    // StartTrial: INITIAL_PURCHASE with trial period
    const isTrialStart = event.type === 'INITIAL_PURCHASE' && event.period_type === 'TRIAL';

    // Subscribe: first paid conversion ONLY — direct purchase, a lifetime
    // (non-renewing) purchase, or the single RENEWAL that converts a trial.
    // Plain monthly renewals must NOT re-fire Subscribe, or ad attribution
    // counts every billing cycle as a new conversion.
    const isPaidConversion =
      (event.type === 'INITIAL_PURCHASE' && event.period_type !== 'TRIAL') ||
      event.type === 'NON_RENEWING_PURCHASE' ||
      (event.type === 'RENEWAL' && event.is_trial_conversion === true);

    if (!isTrialStart && !isPaidConversion) return;

    // Look up user email from app_user_id
    const { data: user } = await this.adminClient
      .from('users')
      .select('email')
      .eq('id', event.app_user_id)
      .single();

    if (!user?.email) {
      this.logger.warn(`Cannot send Meta event: no email found for user ${event.app_user_id}`);
      return;
    }

    if (isTrialStart) {
      this.logger.log(`StartTrial for ${event.app_user_id} (purchase_source: ${purchaseSource})`);
      await this.metaEventsService.sendAppEvent({
        eventName: 'StartTrial',
        userEmail: user.email,
        userId: event.app_user_id,
      });
    } else if (isPaidConversion) {
      this.logger.log(
        `Subscribe for ${event.app_user_id} (purchase_source: ${purchaseSource}, ${event.currency} ${event.price})`,
      );
      await this.metaEventsService.sendAppEvent({
        eventName: 'Subscribe',
        userEmail: user.email,
        userId: event.app_user_id,
        value: event.price,
        currency: event.currency,
      });
    }
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
