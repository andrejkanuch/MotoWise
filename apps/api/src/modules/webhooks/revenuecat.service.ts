import {
  RC_ATTRIBUTE_HAS_HAD_TRIAL,
  RC_ATTRIBUTE_TRUE,
  REVENUECAT_ENTITLEMENT_PRO,
} from '@motovault/types';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/nestjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readAnalyticsDecision } from '../analytics/analytics-consent';
import { postHogCaptureTarget, sendPostHogBatch } from '../analytics/posthog-capture';
import { MetaEventsService } from '../meta/meta-events.service';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import type { RevenueCatEvent } from './dto/revenuecat-event.dto';
import {
  buildRevenueCatPostHogEvent,
  FAIL_CLOSED_DECISIONS,
  isPaidConversion,
  isTrialStart,
  purchaseSourceForStore,
  RC_ENVIRONMENT_PRODUCTION,
  revenueCatPostHogEventName,
  type StoredAnalyticsDecisions,
  UUID_REGEX,
} from './revenuecat-posthog';
import { NON_RENEWING_GRANT, type NonRenewingGrant, nonRenewingGrant } from './revenuecat-products';

const RC_API_BASE = 'https://api.revenuecat.com/v1' as const;
const EVENT_TRANSFER = 'TRANSFER' as const;
const EVENT_NON_RENEWING_PURCHASE = 'NON_RENEWING_PURCHASE' as const;

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

/**
 * The expiry handed to the RPC. A lifetime SKU is forced to NULL (= never
 * expires) whatever RC sent; a TRANSFER uses the receiver's resolved state;
 * everything else (incl. a time-limited non-renewing grant) uses the event's.
 */
function expirationFor(
  event: RevenueCatEvent,
  transfer: TransferResolution | null,
  grant: NonRenewingGrant | null,
): string | null {
  if (grant === NON_RENEWING_GRANT.LIFETIME) return null;
  if (transfer) return transfer.expirationAt;
  return toIso(event.expiration_at_ms);
}

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

    // NON_RENEWING_PURCHASE covers every non-subscription product, so it means
    // lifetime Pro ONLY for a known lifetime SKU. A product with an expiry is a
    // time-limited grant; anything else (consumable, unknown SKU) grants nothing.
    // (Health reports are a free feature; the old paid-IAP path was removed.)
    const grant = event.type === EVENT_NON_RENEWING_PURCHASE ? nonRenewingGrant(event) : null;
    if (grant === NON_RENEWING_GRANT.NONE) {
      this.reportUngrantedNonRenewing(event);
      return;
    }
    const expirationAt = expirationFor(event, transfer, grant);

    // Strip PII-bearing subscriber attributes; keep the rest for forensics.
    const { subscriber_attributes: _attrs, ...payload } = event;

    const { error } = await this.adminClient.rpc('process_revenuecat_event', {
      p_event_id: event.id,
      p_event_type: event.type,
      p_app_user_id: event.app_user_id,
      p_expiration_at: expirationAt,
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

    const purchaseSource = purchaseSourceForStore(event.store);
    this.logger.log(
      `Processed ${event.type} for user ${event.app_user_id} (source: ${purchaseSource})`,
    );

    // First trial on any store → flag the RC customer so Targeting serves the
    // no-trial offering everywhere else (fire and forget).
    if (isTrialStart(event)) {
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

    // Product analytics (fire and forget). Runs only after the RPC accepted the
    // event, so a duplicate delivery (already_processed, above) is never re-sent.
    this.captureToPostHog(event).catch((err) => {
      this.logger.error(`PostHog capture failed for ${event.id}: ${err}`);
    });
  }

  /**
   * A NON_RENEWING_PURCHASE for a product that is neither a known lifetime SKU
   * nor time-limited. Granting it would hand out Pro forever (the RPC maps a
   * NULL expiry to lifetime), so the event is acknowledged without touching the
   * user and surfaced for a human: either a new lifetime SKU is missing from
   * LIFETIME_PRODUCT_IDS (that buyer needs a manual grant) or a consumable was
   * sold. Returning normally (HTTP 200) stops RevenueCat retrying.
   */
  private reportUngrantedNonRenewing(event: RevenueCatEvent): void {
    const message = `NON_RENEWING_PURCHASE ${event.id}: product "${event.product_id ?? 'unknown'}" is not a lifetime SKU and has no expiry — no Pro granted`;
    this.logger.warn(message);
    Sentry.captureMessage(message, {
      level: 'warning',
      tags: { webhook: 'revenuecat', rc_event_type: event.type },
      extra: {
        eventId: event.id,
        appUserId: event.app_user_id,
        productId: event.product_id ?? null,
        store: event.store ?? null,
        environment: event.environment ?? null,
        entitlementIds: event.entitlement_ids ?? null,
      },
    });
  }

  /**
   * Send the event to PostHog so paid subscribers can be broken down by
   * acquisition source next to the client-side events. Replaces RevenueCat's own
   * PostHog integration, which must stay OFF (it would double count, and it
   * cannot honour a rider's analytics opt-out). Sandbox events are never sent.
   * Never throws into the webhook: a lost analytics event is logged, not retried.
   */
  private async captureToPostHog(event: RevenueCatEvent): Promise<void> {
    const eventName = revenueCatPostHogEventName(event.type);
    if (!eventName) return;
    if (event.environment !== RC_ENVIRONMENT_PRODUCTION) return;
    const target = postHogCaptureTarget(this.configService);
    if (!target) {
      this.logger.warn(`POSTHOG_PROJECT_TOKEN unset; ${event.id} not sent to PostHog`);
      return;
    }

    const decisions = await this.loadAnalyticsDecisions(
      event.app_user_id,
      purchaseSourceForStore(event.store) === 'web',
    );
    const failure = await sendPostHogBatch(target, [
      buildRevenueCatPostHogEvent(event, eventName, decisions),
    ]);
    if (failure) this.logger.error(`PostHog capture of ${event.id} ${failure}`);
  }

  /**
   * The rider's saved analytics decisions, read where the signup sweep reads
   * them. The sign-up metadata is read only when it can matter: always for a web
   * purchase (a "no" there wins), else only when the account has no decision.
   * Fails CLOSED: an unreadable source counts as "no", so the event goes to the
   * anonymous bucket, never to an identified person.
   */
  private async loadAnalyticsDecisions(
    userId: string,
    isWebPurchase: boolean,
  ): Promise<StoredAnalyticsDecisions> {
    const { data: user, error } = await this.adminClient
      .from('users')
      .select('preferences')
      .eq('id', userId)
      .maybeSingle();
    if (error || !user) return FAIL_CLOSED_DECISIONS;

    const account = readAnalyticsDecision(user.preferences, undefined);
    if (account !== null && !isWebPurchase) return { account, signup: null };

    const { data: auth, error: authError } = await this.adminClient.auth.admin.getUserById(userId);
    if (authError) return { account, signup: false };
    return { account, signup: readAnalyticsDecision(undefined, auth.user?.user_metadata) };
  }

  private async fireMetaEvent(event: RevenueCatEvent, purchaseSource: string): Promise<void> {
    // StartTrial on a trial start; Subscribe on the first paid conversion ONLY,
    // or ad attribution counts every billing cycle as a new conversion.
    const trialStart = isTrialStart(event);
    const paidConversion = isPaidConversion(event);
    if (!trialStart && !paidConversion) return;

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

    if (trialStart) {
      this.logger.log(`StartTrial for ${event.app_user_id} (purchase_source: ${purchaseSource})`);
      await this.metaEventsService.sendAppEvent({
        eventName: 'StartTrial',
        userEmail: user.email,
        userId: event.app_user_id,
      });
    } else if (paidConversion) {
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
