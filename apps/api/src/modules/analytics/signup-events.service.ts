import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import { hasAnalyticsConsent, NO_CONSENT_PROPERTIES } from './analytics-consent';
import {
  type PostHogCaptureEvent,
  postHogCaptureTarget,
  SERVER_EVENT_PROPERTIES,
  sendPostHogBatch,
} from './posthog-capture';

/**
 * The one canonical signup event. See migration 00174 for why this is a sweep
 * rather than an insert-time trigger, and for the reconciliation query that is
 * this unit's real acceptance gate.
 */
export const SIGNUP_EVENT = 'signup_completed' as const;

/**
 * Single constant bucket for users who declined analytics. Not an identifier: it
 * is the same string for everyone, so it aggregates to a count and nothing else.
 */
export const ANONYMOUS_DISTINCT_ID = 'signup-no-consent';

/**
 * Where an account was created. The web tags its sign-ups (00188); the app
 * sends no tag, and the web and the app are the only places an account is made,
 * so an untagged account is an app sign-up.
 */
const SIGNUP_PLATFORM = { Web: 'web', App: 'app' } as const;
type SignupPlatform = (typeof SIGNUP_PLATFORM)[keyof typeof SIGNUP_PLATFORM];

/** The rider can edit their own metadata: accept only the known tag. */
function signupPlatformFrom(raw: string | null | undefined): SignupPlatform {
  return raw === SIGNUP_PLATFORM.Web ? SIGNUP_PLATFORM.Web : SIGNUP_PLATFORM.App;
}

/** Bound one sweep's work. The claim RPC applies the same cap. */
export const MAX_SIGNUPS_PER_RUN = 200;

/** PostHog's batch endpoint accepts many events per request; keep payloads modest. */
const CAPTURE_BATCH_SIZE = 50;

/**
 * A user claimed for emission, as returned by `claim_pending_signup_events`.
 * snake_case because it is a raw RPC row; mapped to camelCase below.
 */
interface PendingSignupRow {
  user_id: string;
  created_at: string;
  auth_method: string | null;
  /**
   * The rider's decision: the account's, else the one sent with sign-up; NULL
   * when neither exists (00184). See `hasAnalyticsConsent`.
   */
  analytics_enabled: boolean | null;
  currency: string | null;
  measurement_system: string | null;
  /**
   * `raw_user_meta_data.signup_platform` (00188). Absent until that migration
   * is applied, which reads as an app sign-up.
   */
  signup_platform?: string | null;
}

/**
 * Why the sweep did nothing, when it did nothing.
 *
 * Added 2026-08-25 after a real incident. Migration 00174's claim RPC raised
 * `column reference "user_id" is ambiguous` on every call, so the sweep claimed
 * nobody for a full day. It went unnoticed because all three of these outcomes
 * returned the identical body `{claimed:0,identified:0,anonymous:0,released:0}`
 * with HTTP 200:
 *
 *   - nothing was pending (the healthy case),
 *   - POSTHOG_PROJECT_TOKEN was unset (fail-closed),
 *   - the claim RPC errored (broken).
 *
 * pg_cron logged 19 consecutive "succeeded" runs against a function that could
 * never succeed. `outcome` makes the three distinguishable from the response
 * alone, without reading Render logs.
 */
export const SWEEP_OUTCOME = {
  /** Ran normally. `claimed` may still legitimately be 0. */
  OK: 'ok',
  /** No PostHog token configured — deliberately claimed nothing. */
  NO_TOKEN: 'no_token',
  /** The claim RPC raised. This is a bug, not an empty queue. */
  CLAIM_FAILED: 'claim_failed',
  /** Claimed, but PostHog rejected the batch; claims were released for retry. */
  CAPTURE_FAILED: 'capture_failed',
} as const;

export type SweepOutcome = (typeof SWEEP_OUTCOME)[keyof typeof SWEEP_OUTCOME];

export interface SignupSweepSummary {
  claimed: number;
  identified: number;
  anonymous: number;
  released: number;
  outcome: SweepOutcome;
}

@Injectable()
export class SignupEventsService {
  private readonly logger = new Logger(SignupEventsService.name);

  constructor(
    @Inject(SUPABASE_ADMIN) private readonly supabase: SupabaseClient,
    private readonly config: ConfigService,
  ) {}

  async sweepPendingSignups(): Promise<SignupSweepSummary> {
    const empty = (outcome: SweepOutcome): SignupSweepSummary => ({
      claimed: 0,
      identified: 0,
      anonymous: 0,
      released: 0,
      outcome,
    });

    const target = postHogCaptureTarget(this.config);
    if (!target) {
      // Fail closed WITHOUT claiming. Claiming first and then discovering there is
      // nowhere to send would silently burn every pending user's one-and-only
      // emission, which the PK on signup_event_log makes unrecoverable except by
      // hand-deleting log rows.
      this.logger.warn('POSTHOG_PROJECT_TOKEN unset; skipping signup-event sweep');
      return empty(SWEEP_OUTCOME.NO_TOKEN);
    }

    const { data, error } = await this.supabase.rpc('claim_pending_signup_events', {
      p_limit: MAX_SIGNUPS_PER_RUN,
    });
    if (error) {
      this.logger.error(`Failed to claim pending signup events: ${error.message}`);
      return empty(SWEEP_OUTCOME.CLAIM_FAILED);
    }

    const rows = (data ?? []) as PendingSignupRow[];
    if (rows.length === 0) return empty(SWEEP_OUTCOME.OK);

    const events = rows.map((row) => this.buildEvent(row));
    const identified = rows.filter((row) => hasAnalyticsConsent(row.analytics_enabled)).length;

    const delivered = await this.capture(events, target);
    if (!delivered) {
      // Give the claims back so the next tick retries rather than losing them.
      const released = await this.releaseClaims(rows.map((row) => row.user_id));
      return {
        claimed: rows.length,
        identified: 0,
        anonymous: 0,
        released,
        outcome: SWEEP_OUTCOME.CAPTURE_FAILED,
      };
    }

    this.logger.log(
      `Emitted ${rows.length} signup events (${identified} identified, ${rows.length - identified} anonymous)`,
    );
    return {
      claimed: rows.length,
      identified,
      anonymous: rows.length - identified,
      released: 0,
      outcome: SWEEP_OUTCOME.OK,
    };
  }

  /**
   * One PostHog event per claimed user.
   *
   * Two things here are load-bearing and differ from the web CTA counter
   * (apps/web/src/app/api/metrics/cta/route.ts), which is otherwise the in-repo
   * pattern this follows:
   *
   *  1. `distinct_id` is the real user id, and `$process_person_profile` is NOT
   *     disabled — the event must land on the identified person so it can be
   *     used as a funnel step alongside the client-side events. The CTA counter
   *     deliberately does the opposite because it is an anonymous tally.
   *
   *  2. `timestamp` is the row's `created_at`, not now(). This is what makes the
   *     sweep's schedule an irrelevance rather than a measurement artefact.
   *
   * Consent: a user who saved `analyticsEnabled: false` still needs to be
   * COUNTED — otherwise the reconciliation gate can never pass — but must not be
   * identifiable. No saved decision is treated as consent for now; see
   * `hasAnalyticsConsent`. So they are emitted under a single constant bucket with
   * person processing off, which is a tally, not a profile. The rule itself
   * lives in `analytics-consent.ts`, shared with the RevenueCat webhook. Emitting an
   * identified event for someone who declined analytics would contradict the
   * app's own privacy toggle regardless of legal basis.
   *
   * Deliberately absent: email, name, or any other direct identifier. The
   * analytics store must not become a second copy of the user table. Device
   * platform and locale are also absent because `public.users` does not carry
   * them — they are already on the identified person from client-side events.
   * `signup_platform` (web or app) is sent because the client-side signup events
   * are consent-gated and reach almost no web signups; it is the only way to
   * measure how many web signups go on to open the app.
   */
  private buildEvent(row: PendingSignupRow): PostHogCaptureEvent {
    const consented = hasAnalyticsConsent(row.analytics_enabled);
    const properties: Record<string, unknown> = {
      auth_method: row.auth_method ?? 'email',
      currency: row.currency ?? undefined,
      measurement_system: row.measurement_system ?? undefined,
      signup_platform: signupPlatformFrom(row.signup_platform),
      // Lets an analyst tell this apart from the legacy client-side events while
      // both series exist.
      emitted_by: 'server_sweep',
      ...SERVER_EVENT_PROPERTIES,
    };
    if (!consented) Object.assign(properties, NO_CONSENT_PROPERTIES);
    return {
      event: SIGNUP_EVENT,
      distinct_id: consented ? row.user_id : ANONYMOUS_DISTINCT_ID,
      timestamp: row.created_at,
      properties,
    };
  }

  /** Returns true when every batch was accepted. */
  private async capture(
    events: PostHogCaptureEvent[],
    target: { url: string; token: string },
  ): Promise<boolean> {
    for (let i = 0; i < events.length; i += CAPTURE_BATCH_SIZE) {
      const failure = await sendPostHogBatch(target, events.slice(i, i + CAPTURE_BATCH_SIZE));
      if (failure) {
        this.logger.error(`PostHog batch capture ${failure}`);
        return false;
      }
    }
    return true;
  }

  private async releaseClaims(userIds: string[]): Promise<number> {
    const { data, error } = await this.supabase.rpc('release_signup_event_claims', {
      p_user_ids: userIds,
    });
    if (error) {
      // The claims stay burned. Loud, because the fix is manual: delete the
      // affected signup_event_log rows so the sweep can retry them.
      this.logger.error(
        `Could not release ${userIds.length} signup-event claims after a capture failure — ` +
          `those users will NOT be re-emitted until their signup_event_log rows are deleted: ${error.message}`,
      );
      return 0;
    }
    return typeof data === 'number' ? data : userIds.length;
  }
}
