import { MileageUnit } from '@motovault/types';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SupabaseClient } from '@supabase/supabase-js';
import { POPULAR_MAKES } from '../motorcycles/nhtsa.service';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import {
  type AnalyticsDecision,
  hasExplicitAnalyticsConsent,
  NO_CONSENT_PROPERTIES,
  readAnalyticsDecision,
} from './analytics-consent';
import {
  type PostHogCaptureEvent,
  postHogCaptureTarget,
  SERVER_EVENT_PROPERTIES,
  sendPostHogBatch,
} from './posthog-capture';

/**
 * #365 T05e: server-side events that make two DB-only facts readable in PostHog
 * (plan §3A.0 rule 6, D2b option B): junk onboarding makes (FS-R2-5) and
 * sub-floor first rides (FS-PO4b DB share).
 */
export const SERVER_EVENT = {
  ONBOARDING_BIKE_CREATED: 'onboarding_bike_created',
  RIDE_SAVED: 'ride_saved',
} as const;

export type ServerEventName = (typeof SERVER_EVENT)[keyof typeof SERVER_EVENT];

/**
 * One constant, non-identifying `distinct_id` per event for riders without a
 * stored "yes" (same idea as `ANONYMOUS_DISTINCT_ID` in the signup sweep).
 */
export const NO_CONSENT_DISTINCT_ID = {
  [SERVER_EVENT.ONBOARDING_BIKE_CREATED]: 'onboarding-bike-no-consent',
  [SERVER_EVENT.RIDE_SAVED]: 'ride-saved-no-consent',
} as const satisfies Record<ServerEventName, string>;

/** How much of the bike the rider gave in onboarding. */
export const CAPTURE_LEVEL = {
  MAKE: 'make',
  MODEL: 'model',
  NONE: 'none',
} as const;

export type CaptureLevel = (typeof CAPTURE_LEVEL)[keyof typeof CAPTURE_LEVEL];

/** Fewest letters a make not on the known list must have (FS-R2-5, T25's rule). */
export const MIN_MAKE_LETTERS = 3;

/** The HUD's end-ride floors (`apps/mobile/src/utils/ride-constants.ts`); `below_min` matches `below_min_ride`. */
export const RIDE_FLOOR = {
  MIN_DISTANCE_M: 50,
  MIN_DURATION_S: 30,
} as const;

/** Tells these events apart from client ones (`signup_completed` uses 'server_sweep'). */
export const EMITTED_BY_SERVER_MUTATION = 'server_mutation';

/** `save_trigger` when an older app sends no `endSource`. */
export const UNKNOWN_SAVE_TRIGGER = 'unknown';

const LETTER = /\p{L}/gu;

/** A make is valid when it has at least {@link MIN_MAKE_LETTERS} letters or is a known make. */
export function isValidMake(make: string): boolean {
  const trimmed = make.trim();
  if (POPULAR_MAKES.has(trimmed.toUpperCase())) return true;
  return (trimmed.match(LETTER)?.length ?? 0) >= MIN_MAKE_LETTERS;
}

export function captureLevelOf(make: string | null | undefined, model: string | null | undefined) {
  if (!make?.trim()) return CAPTURE_LEVEL.NONE;
  return model?.trim() ? CAPTURE_LEVEL.MODEL : CAPTURE_LEVEL.MAKE;
}

export interface OnboardingBikeFacts {
  make: string;
  model: string | null | undefined;
  mileageUnit: string | null | undefined;
}

export interface RideSavedFacts {
  rideId: string;
  startedAt: string;
  endedAt: string | null | undefined;
  /** Null when the save carried no distance; counted as sub-floor, as the DB check does. */
  distanceM: number | null | undefined;
  durationS: number | null | undefined;
  endSource: string | null | undefined;
}

/**
 * Builds and sends the #365 server events. Every public method resolves and never
 * throws, so a capture failure can never fail the mutation that called it.
 *
 * Consent (plan §3A.0 rule 6): only a stored "yes" identifies the rider. A "no",
 * no decision yet, or an unreadable decision goes to the event's constant bucket
 * with {@link NO_CONSENT_PROPERTIES}. No email, make text or any other personal
 * or free-text field is ever sent.
 */
@Injectable()
export class ServerEventsService {
  private readonly logger = new Logger(ServerEventsService.name);

  constructor(
    @Inject(SUPABASE_ADMIN) private readonly supabaseAdmin: SupabaseClient,
    private readonly config: ConfigService,
  ) {}

  async captureOnboardingBikeCreated(userId: string, bike: OnboardingBikeFacts): Promise<void> {
    await this.safely(
      SERVER_EVENT.ONBOARDING_BIKE_CREATED,
      async () => ({
        capture_level: captureLevelOf(bike.make, bike.model),
        make_valid: isValidMake(bike.make),
        // The RPC stores 'mi' when the app sends no unit.
        mileage_unit: bike.mileageUnit === MileageUnit.KM ? MileageUnit.KM : MileageUnit.MI,
      }),
      userId,
    );
  }

  async captureRideSaved(userId: string, ride: RideSavedFacts): Promise<void> {
    await this.safely(
      SERVER_EVENT.RIDE_SAVED,
      async () => {
        const distanceM = typeof ride.distanceM === 'number' ? Math.round(ride.distanceM) : null;
        const durationS = typeof ride.durationS === 'number' ? Math.round(ride.durationS) : null;
        return {
          below_min:
            (distanceM ?? 0) < RIDE_FLOOR.MIN_DISTANCE_M ||
            (durationS ?? 0) < RIDE_FLOOR.MIN_DURATION_S,
          distance_m: distanceM,
          duration_s: durationS,
          is_first: await this.isFirstRide(userId, ride),
          save_trigger: ride.endSource ?? UNKNOWN_SAVE_TRIGGER,
        };
      },
      userId,
      ride.endedAt ?? undefined,
    );
  }

  private async safely(
    event: ServerEventName,
    buildProperties: () => Promise<Record<string, unknown>>,
    userId: string,
    timestamp?: string,
  ): Promise<void> {
    try {
      const target = postHogCaptureTarget(this.config);
      if (!target) return;
      const [properties, decision] = await Promise.all([
        buildProperties(),
        this.loadDecision(userId),
      ]);
      const failure = await sendPostHogBatch(target, [
        buildServerEvent(event, userId, decision, properties, timestamp),
      ]);
      if (failure) this.logger.warn(`PostHog capture of ${event} ${failure}`);
    } catch (err) {
      this.logger.warn(
        `PostHog capture of ${event} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * The rider's decision, read where the signup sweep reads it. Fails CLOSED: an
   * unreadable source counts as "no decision", which is "no" here.
   */
  private async loadDecision(userId: string): Promise<AnalyticsDecision> {
    const { data: user, error } = await this.supabaseAdmin
      .from('users')
      .select('preferences')
      .eq('id', userId)
      .maybeSingle();
    if (error) return null;
    const account = readAnalyticsDecision(user?.preferences, undefined);
    if (account !== null) return account;

    const { data: auth, error: authError } =
      await this.supabaseAdmin.auth.admin.getUserById(userId);
    if (authError) return null;
    return readAnalyticsDecision(undefined, auth.user?.user_metadata);
  }

  /**
   * First ride as `queries/db/fs-po4b-first-ride.sql` defines it: no ride of this
   * rider, deleted or not, started before this one. Service role because the user
   * client hides deleted rides; the read is filtered by the caller's own id.
   */
  private async isFirstRide(userId: string, ride: RideSavedFacts): Promise<boolean> {
    const { count, error } = await this.supabaseAdmin
      .from('rides')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .neq('id', ride.rideId)
      .lt('started_at', ride.startedAt);
    if (error) throw new Error(`first-ride count failed: ${error.message}`);
    return (count ?? 0) === 0;
  }
}

/** UTC midnight of `iso` (or of now): the only time a no-consent event carries. */
export function utcDayStart(iso: string | undefined, now: Date = new Date()): string {
  const at = iso ? new Date(iso) : now;
  const day = Number.isNaN(at.getTime()) ? now : at;
  // toISOString is always UTC, so its date part is the UTC day.
  return `${day.toISOString().slice(0, 10)}T00:00:00.000Z`;
}

/**
 * One event: the user id only with a stored "yes", else the event's constant bucket.
 * A no-consent event's time is cut to the UTC day (as the RevenueCat webhook does):
 * an exact time plus distance and duration could be matched back to the rider's
 * row outside PostHog. The day keeps weekly buckets right.
 */
export function buildServerEvent(
  event: ServerEventName,
  userId: string,
  decision: AnalyticsDecision | undefined,
  properties: Record<string, unknown>,
  timestamp?: string,
): PostHogCaptureEvent {
  const consented = hasExplicitAnalyticsConsent(decision);
  const sentAt = consented ? timestamp : utcDayStart(timestamp);
  return {
    event,
    distinct_id: consented ? userId : NO_CONSENT_DISTINCT_ID[event],
    ...(sentAt && { timestamp: sentAt }),
    properties: {
      ...properties,
      emitted_by: EMITTED_BY_SERVER_MUTATION,
      ...SERVER_EVENT_PROPERTIES,
      ...(consented ? {} : NO_CONSENT_PROPERTIES),
    },
  };
}
