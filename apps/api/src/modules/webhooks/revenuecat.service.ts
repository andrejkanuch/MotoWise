import { RC_ATTRIBUTE_HAS_HAD_TRIAL, RC_ATTRIBUTE_TRUE } from '@motovault/types';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/nestjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readAnalyticsDecision } from '../analytics/analytics-consent';
import { postHogCaptureTarget, sendPostHogBatch } from '../analytics/posthog-capture';
import { MetaEventsService } from '../meta/meta-events.service';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import type { RevenueCatEvent } from './dto/revenuecat-event.dto';
import {
  type ProResolution,
  type RcSubscriberResponse,
  RESOLUTION_FAILURE,
  type ResolvedProState,
  resolveProEntitlement,
} from './revenuecat-entitlement';
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
/** RevenueCat `environment` for Stripe test mode, App Store sandbox/TestFlight and Play testers. */
export const RC_ENVIRONMENT_SANDBOX = 'SANDBOX' as const;
const ENV_SANDBOX_ALLOWED_USER_IDS = 'REVENUECAT_SANDBOX_ALLOWED_USER_IDS' as const;
const ENV_RC_SECRET_API_KEY = 'REVENUECAT_SECRET_API_KEY' as const;
/**
 * Per RevenueCat REST call. RevenueCat drops a webhook delivery after 60s and
 * retries it, so the lookup must leave room for the RPC; same budget as the
 * billing-portal RevenueCat/Stripe calls.
 */
export const RC_REQUEST_TIMEOUT_MS = 8_000;
const RPC_NAME = 'process_revenuecat_event' as const;
/** PostgREST: no function matches the named arguments (00187 not applied yet). */
const PGRST_FUNCTION_NOT_FOUND = 'PGRST202' as const;
/**
 * Event types that change what the rider is entitled to, so the users row is
 * (re)derived from the live entitlement. Source: RevenueCat's webhook event
 * types (https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields).
 * Refunds arrive as CANCELLATION (cancel_reason CUSTOMER_SUPPORT); a reversed
 * Apple refund as REFUND_REVERSED.
 *
 * Every other type — TEST, SUBSCRIBER_ALIAS, EXPERIMENT_ENROLLMENT,
 * INVOICE_ISSUANCE, VIRTUAL_CURRENCY_TRANSACTION, and any type RevenueCat adds
 * later — is only logged: no lookup, no p_rc_*, and the RPC's fallback leaves
 * the row alone. Writing the entitlement there flipped every never-paid rider
 * from free/free to free/expired on an experiment enrollment.
 */
export const ENTITLEMENT_EVENT_TYPES = [
  'INITIAL_PURCHASE',
  'RENEWAL',
  'NON_RENEWING_PURCHASE',
  'PRODUCT_CHANGE',
  'CANCELLATION',
  'UNCANCELLATION',
  'BILLING_ISSUE',
  'EXPIRATION',
  'SUBSCRIPTION_PAUSED',
  'SUBSCRIPTION_EXTENDED',
  'TEMPORARY_ENTITLEMENT_GRANT',
  'REFUND_REVERSED',
  'TRANSFER',
] as const;
const ENTITLEMENT_EVENT_TYPE_SET: ReadonlySet<string> = new Set(ENTITLEMENT_EVENT_TYPES);
/** Sentry `rc_entitlement` tag values. */
const RC_ENTITLEMENT_TAG = {
  DEFERRED: 'deferred',
  FALLBACK: 'fallback',
  MISSING_ENTITLEMENT: RESOLUTION_FAILURE.MISSING_ENTITLEMENT,
} as const;
type RcEntitlementTag = (typeof RC_ENTITLEMENT_TAG)[keyof typeof RC_ENTITLEMENT_TAG];
/**
 * Event types whose event-type fallback leaves the row wrong for good:
 * EXPIRATION writes free/expired, and CANCELLATION / BILLING_ISSUE overwrite a
 * lifetime row's NULL expiry with the old subscription's (#273); TRANSFER
 * downgrades the sources but leaves the receiver untouched (the event carries
 * no product). For these, a TRANSIENT lookup failure must not fall back:
 * the event row would be written, so RevenueCat's redelivery would hit
 * already_processed. The webhook fails instead, before the RPC, and
 * RevenueCat redelivers it.
 */
const DEFER_ON_TRANSIENT_EVENT_TYPES: ReadonlySet<string> = new Set([
  'EXPIRATION',
  'CANCELLATION',
  'BILLING_ISSUE',
  'TRANSFER',
]);
/** How a failed RevenueCat lookup is handled. */
const LOOKUP_FAILURE = {
  /** Timeout, network error, 408, 429, 5xx: worth a redelivery. */
  TRANSIENT: 'transient',
  /** Key unset, other 4xx, malformed body, untrusted entitlement: retrying will not help. */
  PERMANENT: 'permanent',
} as const;
type LookupFailure = (typeof LOOKUP_FAILURE)[keyof typeof LOOKUP_FAILURE];

/** `AbortSignal.timeout` rejects with TimeoutError (AbortError on older runtimes). */
const ABORT_ERROR_NAMES: ReadonlySet<string> = new Set(['TimeoutError', 'AbortError']);

const isTransientStatus = (status: number): boolean =>
  status === HttpStatus.REQUEST_TIMEOUT ||
  status === HttpStatus.TOO_MANY_REQUESTS ||
  status >= HttpStatus.INTERNAL_SERVER_ERROR;

const toIso = (ms: number | null | undefined): string | null =>
  ms ? new Date(ms).toISOString() : null;

/**
 * The event's own expiry, logged with the event and used by the event-type
 * fallback. A lifetime SKU is forced to NULL (= never expires) whatever RC
 * sent; a TRANSFER (which carries none) uses the receiver's resolved state.
 */
function expirationFor(
  event: RevenueCatEvent,
  transfer: ResolvedProState | null,
  grant: NonRenewingGrant | null,
): string | null {
  if (grant === NON_RENEWING_GRANT.LIFETIME) return null;
  if (transfer) return transfer.expiresAt;
  return toIso(event.expiration_at_ms);
}

@Injectable()
export class RevenueCatService {
  private readonly logger = new Logger(RevenueCatService.name);
  /** Users whose SANDBOX events may write entitlements (env, validated at boot). */
  private readonly sandboxAllowedUserIds: ReadonlySet<string>;

  constructor(
    private readonly configService: ConfigService,
    @Inject(SUPABASE_ADMIN) private readonly adminClient: SupabaseClient,
    private readonly metaEventsService: MetaEventsService,
  ) {
    this.sandboxAllowedUserIds = new Set(
      this.configService.get<string[]>(ENV_SANDBOX_ALLOWED_USER_IDS) ?? [],
    );
  }

  async processEvent(event: RevenueCatEvent): Promise<void> {
    if (!UUID_REGEX.test(event.app_user_id)) {
      this.logger.log(
        `Skipping event ${event.id}: app_user_id "${event.app_user_id}" is not a UUID`,
      );
      return;
    }

    if (this.isIgnoredSandboxEvent(event)) return;

    // NON_RENEWING_PURCHASE covers every non-subscription product, so it means
    // lifetime Pro ONLY for a known lifetime SKU. A product with an expiry is a
    // time-limited grant; anything else (consumable, unknown SKU) grants nothing.
    // (Health reports are a free feature; the old paid-IAP path was removed.)
    const grant = event.type === EVENT_NON_RENEWING_PURCHASE ? nonRenewingGrant(event) : null;
    if (grant === NON_RENEWING_GRANT.NONE) {
      this.reportUngrantedNonRenewing(event);
      return;
    }

    // RevenueCat is the source of truth (issue #273): the users row is written
    // from the subscriber's live Pro entitlement, which knows about every
    // purchase (a lifetime purchase outlives an old subscription's EXPIRATION;
    // a refund removes it). Unresolved → the RPC's event-type logic (fallback).
    // Only for events that can change the entitlement (see ENTITLEMENT_EVENT_TYPES).
    const resolved = ENTITLEMENT_EVENT_TYPE_SET.has(event.type)
      ? await this.resolveProState(event)
      : null;
    const transferredFrom =
      event.type === EVENT_TRANSFER
        ? (event.transferred_from ?? []).filter((id) => UUID_REGEX.test(id))
        : null;
    // TRANSFER carries no product/expiry of its own: log the receiver's.
    const transfer = event.type === EVENT_TRANSFER ? resolved : null;
    const expirationAt = expirationFor(event, transfer, grant);

    // Strip PII-bearing subscriber attributes; keep the rest for forensics.
    const { subscriber_attributes: _attrs, ...payload } = event;

    const legacyArgs = {
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
      p_payload: resolved ? { ...payload, motovault_rc_entitlement: resolved } : payload,
    };
    const error = await this.callRpc(event, legacyArgs, resolved);

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
   * SANDBOX purchases (Stripe test cards, App Store sandbox / TestFlight, Play
   * license testers) cost nothing, so they must not write real entitlements to
   * the production database — anyone with a sandbox key and card 4242 could
   * otherwise grant themselves Pro. Only users on the
   * REVENUECAT_SANDBOX_ALLOWED_USER_IDS allowlist are processed. An ignored
   * event is logged and breadcrumbed, never recorded, and the webhook still
   * answers 200 so RevenueCat does not retry it.
   */
  private isIgnoredSandboxEvent(event: RevenueCatEvent): boolean {
    if (event.environment !== RC_ENVIRONMENT_SANDBOX) return false;
    if (this.sandboxAllowedUserIds.has(event.app_user_id.toLowerCase())) return false;
    const message = `Ignoring SANDBOX ${event.type} ${event.id}: user ${event.app_user_id} is not on the sandbox allowlist`;
    this.logger.log(message);
    Sentry.addBreadcrumb({
      category: 'revenuecat.webhook',
      level: 'info',
      message,
      data: {
        eventId: event.id,
        eventType: event.type,
        appUserId: event.app_user_id,
        productId: event.product_id ?? null,
        store: event.store ?? null,
      },
    });
    return true;
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
   * The subscriber's live Pro state from RevenueCat (v1 `GET /subscribers`,
   * RevenueCat's recommended post-webhook sync). Null when it cannot be
   * resolved — key unset, timeout, non-2xx, bad body, or a sandbox-backed
   * entitlement for a non-allowlisted user — and the RPC then falls back to the
   * event-type logic. Every null is reported to Sentry: while it lasts, the
   * #273 downgrade can happen again. Throws instead (see
   * DEFER_ON_TRANSIENT_EVENT_TYPES) when the failure is transient and the event could
   * take Pro away, so RevenueCat redelivers it.
   */
  private async resolveProState(event: RevenueCatEvent): Promise<ResolvedProState | null> {
    const rcApiKey = this.configService.get<string>(ENV_RC_SECRET_API_KEY);
    if (!rcApiKey) {
      return this.unresolved(event, `${ENV_RC_SECRET_API_KEY} not set`, LOOKUP_FAILURE.PERMANENT);
    }
    let response: Response;
    try {
      response = await fetch(
        `${RC_API_BASE}/subscribers/${encodeURIComponent(event.app_user_id)}`,
        {
          headers: { Authorization: `Bearer ${rcApiKey}` },
          signal: AbortSignal.timeout(RC_REQUEST_TIMEOUT_MS),
        },
      );
    } catch (err) {
      // Network error or the request timeout (TimeoutError / AbortError).
      const message = err instanceof Error ? err.message : String(err);
      return this.unresolved(
        event,
        `RC subscriber lookup failed: ${message}`,
        LOOKUP_FAILURE.TRANSIENT,
      );
    }
    if (!response.ok) {
      return this.unresolved(
        event,
        `RC subscriber lookup returned ${response.status}`,
        isTransientStatus(response.status) ? LOOKUP_FAILURE.TRANSIENT : LOOKUP_FAILURE.PERMANENT,
      );
    }
    let resolution: ProResolution;
    try {
      const body = (await response.json()) as RcSubscriberResponse;
      resolution = resolveProEntitlement(body, {
        nowMs: Date.now(),
        sandboxAllowed: this.sandboxAllowedUserIds.has(event.app_user_id.toLowerCase()),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // The request timeout also covers reading the body.
      const timedOut = err instanceof Error && ABORT_ERROR_NAMES.has(err.name);
      return this.unresolved(
        event,
        `RC subscriber lookup returned an unreadable body: ${message}`,
        timedOut ? LOOKUP_FAILURE.TRANSIENT : LOOKUP_FAILURE.PERMANENT,
      );
    }
    if (!resolution.resolved) {
      if (resolution.failure === RESOLUTION_FAILURE.MISSING_ENTITLEMENT) {
        // Likely a renamed/detached entitlement: its own tag, so it is not lost
        // among ordinary fallbacks. Handled exactly like a permanent failure.
        this.reportUnresolved(event, resolution.reason, RC_ENTITLEMENT_TAG.MISSING_ENTITLEMENT, {
          productIds: resolution.productIds ?? [],
        });
        return null;
      }
      return this.unresolved(event, resolution.reason, LOOKUP_FAILURE.PERMANENT);
    }
    return resolution.state;
  }

  /**
   * A lookup that did not resolve. Permanent failures, and transient ones on
   * events that cannot take Pro away, fall back to the event-type logic (null).
   * A transient failure on a downgrade-capable event throws BEFORE the RPC, so
   * no event row is written, the webhook answers 5xx and RevenueCat redelivers
   * it with backoff. If RevenueCat stays down past its redelivery window the
   * event is lost and the rider keeps their current state: every deferral is
   * reported to Sentry (`rc_entitlement: deferred`) for a manual check.
   */
  private unresolved(event: RevenueCatEvent, reason: string, failure: LookupFailure): null {
    if (failure === LOOKUP_FAILURE.TRANSIENT && DEFER_ON_TRANSIENT_EVENT_TYPES.has(event.type)) {
      const message = `RevenueCat ${event.type} ${event.id}: entitlement not resolved (${reason}); deferring so RevenueCat redelivers it`;
      this.captureEntitlementWarning(event, message, RC_ENTITLEMENT_TAG.DEFERRED, reason);
      throw new Error(message);
    }
    this.reportUnresolved(event, reason);
    return null;
  }

  private reportUnresolved(
    event: RevenueCatEvent,
    reason: string,
    tag: RcEntitlementTag = RC_ENTITLEMENT_TAG.FALLBACK,
    extra: Record<string, unknown> = {},
  ): void {
    const message = `RevenueCat ${event.type} ${event.id}: entitlement not resolved (${reason}); falling back to event-type state`;
    this.captureEntitlementWarning(event, message, tag, reason, extra);
  }

  /** Logs and reports an unresolved entitlement lookup (deferred or fallback). */
  private captureEntitlementWarning(
    event: RevenueCatEvent,
    message: string,
    tag: RcEntitlementTag,
    reason: string,
    extra: Record<string, unknown> = {},
  ): void {
    this.logger.warn(message);
    Sentry.captureMessage(message, {
      level: 'warning',
      tags: { webhook: 'revenuecat', rc_event_type: event.type, rc_entitlement: tag },
      extra: {
        eventId: event.id,
        appUserId: event.app_user_id,
        productId: event.product_id ?? null,
        environment: event.environment ?? null,
        reason,
        ...extra,
      },
    });
  }

  /**
   * Calls the RPC with the resolved state (00187's p_rc_* parameters). If the
   * database does not have 00187 yet (PGRST202: no function with these named
   * arguments), retries once with the 00185 arguments — the event-type
   * fallback — and reports it, so deploying the API first degrades instead of
   * failing every webhook.
   */
  private async callRpc(
    event: RevenueCatEvent,
    legacyArgs: Record<string, unknown>,
    resolved: ResolvedProState | null,
  ): Promise<{ message?: string; code?: string } | null> {
    if (!resolved) {
      const { error } = await this.adminClient.rpc(RPC_NAME, legacyArgs);
      return error;
    }
    const { error } = await this.adminClient.rpc(RPC_NAME, {
      ...legacyArgs,
      p_rc_tier: resolved.tier,
      p_rc_status: resolved.status,
      p_rc_expires_at: resolved.expiresAt,
    });
    if (error?.code !== PGRST_FUNCTION_NOT_FOUND) return error;
    this.reportUnresolved(
      event,
      'process_revenuecat_event has no p_rc_* parameters (00187 not applied)',
    );
    const retry = await this.adminClient.rpc(RPC_NAME, legacyArgs);
    return retry.error;
  }

  /** Server-side customer attribute write (secret key). */
  private async setCustomerAttributes(
    userId: string,
    attributes: Record<string, string>,
  ): Promise<void> {
    const rcApiKey = this.configService.get<string>(ENV_RC_SECRET_API_KEY);
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
    const rcApiKey = this.configService.get<string>(ENV_RC_SECRET_API_KEY);
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
