import {
  RC_ATTRIBUTE_HAS_HAD_TRIAL,
  RC_ATTRIBUTE_TRUE,
  REVENUECAT_ENTITLEMENT_PRO,
} from '@motovault/types';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SupabaseClient } from '@supabase/supabase-js';
import { MetaEventsService } from '../meta/meta-events.service';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import type { RevenueCatEvent } from './dto/revenuecat-event.dto';

const RC_API_BASE = 'https://api.revenuecat.com/v1' as const;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EVENT_TRANSFER = 'TRANSFER' as const;
const EVENT_INITIAL_PURCHASE = 'INITIAL_PURCHASE' as const;
const PERIOD_TRIAL = 'TRIAL' as const;

/** The receiver's live subscription state, resolved from RC for a TRANSFER. */
interface TransferResolution {
  expirationAt: string | null;
  periodType: string | null;
  productId: string | null;
  store: string | null;
}

/** Subset of RC v1 `GET /subscribers/{id}` we read. */
interface RcSubscriberResponse {
  subscriber?: {
    entitlements?: Record<
      string,
      {
        expires_date: string | null;
        product_identifier?: string;
        grace_period_expires_date?: string | null;
      }
    >;
    subscriptions?: Record<
      string,
      { period_type?: string; store?: string; expires_date?: string | null }
    >;
  };
}

const toIso = (ms: number | null | undefined): string | null =>
  ms ? new Date(ms).toISOString() : null;

@Injectable()
export class RevenueCatService {
  private readonly logger = new Logger(RevenueCatService.name);

  constructor(
    private readonly configService: ConfigService,
    @Inject(SUPABASE_ADMIN) private readonly adminClient: SupabaseClient,
    private readonly metaEventsService: MetaEventsService,
  ) {}

  async processEvent(event: RevenueCatEvent): Promise<void> {
    if (!UUID_REGEX.test(event.app_user_id)) {
      this.logger.log(
        `Skipping event ${event.id}: app_user_id "${event.app_user_id}" is not a UUID`,
      );
      return;
    }

    // TRANSFER carries no product/expiry of its own — look the receiver up.
    const transfer = event.type === EVENT_TRANSFER ? await this.resolveTransfer(event) : null;
    const transferredFrom =
      event.type === EVENT_TRANSFER
        ? (event.transferred_from ?? []).filter((id) => UUID_REGEX.test(id))
        : null;

    // Strip PII-bearing subscriber attributes; keep the rest for forensics.
    const { subscriber_attributes: _attrs, ...payload } = event;

    // NON_RENEWING_PURCHASE (lifetime Pro) is handled by process_revenuecat_event
    // like every other purchase event — it grants Pro with no expiry. (Health
    // reports are a free feature; the old paid-IAP path was removed.)
    const { error } = await this.adminClient.rpc('process_revenuecat_event', {
      p_event_id: event.id,
      p_event_type: event.type,
      p_app_user_id: event.app_user_id,
      p_expiration_at: transfer ? transfer.expirationAt : toIso(event.expiration_at_ms),
      p_period_type: transfer ? transfer.periodType : (event.period_type ?? null),
      p_product_id: transfer ? transfer.productId : (event.product_id ?? null),
      p_store: transfer ? transfer.store : (event.store ?? null),
      p_environment: event.environment ?? null,
      p_is_trial_conversion: event.is_trial_conversion ?? null,
      p_purchased_at: toIso(event.purchased_at_ms),
      p_grace_period_expiration_at: toIso(event.grace_period_expiration_at_ms),
      p_transferred_from: transferredFrom,
      p_payload: payload,
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

    // First trial on any store → flag the RC customer so Targeting serves the
    // no-trial offering everywhere else (fire and forget).
    if (event.type === EVENT_INITIAL_PURCHASE && event.period_type === PERIOD_TRIAL) {
      this.setCustomerAttributes(event.app_user_id, {
        [RC_ATTRIBUTE_HAS_HAD_TRIAL]: RC_ATTRIBUTE_TRUE,
      }).catch((err) => {
        this.logger.warn(`RC attribute update failed for ${event.app_user_id}: ${err}`);
      });
    }

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
        value: event.price ?? undefined,
        currency: event.currency ?? undefined,
      });
    }
  }

  /**
   * Resolve what the TRANSFER receiver now holds. RC sends TRANSFER only to the
   * destination user and without product/expiry, so without this lookup the
   * receiver would stay on whatever tier they had until their next RENEWAL.
   * Returns null (leave the receiver untouched) when RC is unreachable or the
   * secret key is not configured; the sources are still downgraded by the RPC.
   */
  private async resolveTransfer(event: RevenueCatEvent): Promise<TransferResolution | null> {
    const rcApiKey = this.configService.get<string>('REVENUECAT_SECRET_API_KEY');
    if (!rcApiKey) {
      this.logger.warn(
        `TRANSFER ${event.id}: REVENUECAT_SECRET_API_KEY not set, receiver not synced`,
      );
      return null;
    }
    try {
      const response = await fetch(`${RC_API_BASE}/subscribers/${event.app_user_id}`, {
        headers: { Authorization: `Bearer ${rcApiKey}` },
      });
      if (!response.ok) {
        this.logger.warn(`TRANSFER ${event.id}: RC subscriber lookup returned ${response.status}`);
        return null;
      }
      const body = (await response.json()) as RcSubscriberResponse;
      const entitlement = body.subscriber?.entitlements?.[REVENUECAT_ENTITLEMENT_PRO];
      if (!entitlement) return null;
      const productId = entitlement.product_identifier ?? null;
      const subscription = productId ? body.subscriber?.subscriptions?.[productId] : undefined;
      if (!productId) return null;
      return {
        // null = lifetime (non-renewing) entitlement; the RPC keys "resolved"
        // off productId, so a null expiry is stored as-is, matching 00165.
        expirationAt: entitlement.expires_date ?? null,
        periodType: subscription?.period_type?.toUpperCase() ?? null,
        productId,
        store: subscription?.store?.toUpperCase() ?? null,
      };
    } catch (err) {
      this.logger.warn(`TRANSFER ${event.id}: RC subscriber lookup failed: ${err}`);
      return null;
    }
  }

  /** Server-side customer attribute write (secret key). */
  private async setCustomerAttributes(
    userId: string,
    attributes: Record<string, string>,
  ): Promise<void> {
    const rcApiKey = this.configService.get<string>('REVENUECAT_SECRET_API_KEY');
    if (!rcApiKey) {
      this.logger.warn('REVENUECAT_SECRET_API_KEY not configured — skipping attribute update');
      return;
    }
    const body = {
      attributes: Object.fromEntries(
        Object.entries(attributes).map(([key, value]) => [key, { value }]),
      ),
    };
    const response = await fetch(`${RC_API_BASE}/subscribers/${userId}/attributes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${rcApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`RevenueCat attributes API returned ${response.status}`);
    }
    this.logger.log(`RC attributes set for ${userId}: ${Object.keys(attributes).join(',')}`);
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
      const response = await fetch(`${RC_API_BASE}/subscribers/${userId}`, {
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
