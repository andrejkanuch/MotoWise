import { NOTIFICATION_KIND } from '@motovault/types';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { differenceInHours } from 'date-fns';
import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import { PG_ERROR } from '../../common/supabase/unwrap';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import { resolveRideIdlePushCopy } from './ride-idle-push-copy';

/**
 * Hours without a GPS signal before we ask the rider whether they're still out.
 * Deliberately longer than a fuel or lunch stop, and paired with auto-pause on the
 * device (which already suppresses stationary time from the ride's moving total).
 */
export const IDLE_NUDGE_HOURS = 2;

/**
 * Hours without a GPS signal before the ride is ended for the rider. Long enough
 * that a genuine all-day trip with a hotel stop gets a nudge first and can be kept
 * alive by simply riding again (any new waypoint resets "last signal").
 */
export const IDLE_AUTO_END_HOURS = 24;

/** Statuses that represent an in-progress ride. */
const ACTIVE_RIDE_STATUSES = ['recording', 'paused'] as const;

/** Marker written to `rides.auto_ended_reason` by this sweep (see migration 00173). */
export const AUTO_END_REASON_IDLE = 'idle_timeout' as const;

const NUDGE_STAGE = 'nudge' as const;
const AUTO_END_STAGE = 'auto_end' as const;

const EXPO_DEVICE_NOT_REGISTERED = 'DeviceNotRegistered' as const;
const EXPO_SEND_TIMEOUT_MS = 15_000;
/** Safety valve: bound one run's work. Overflow is logged, never silently dropped. */
const MAX_RIDES_PER_RUN = 500;

/** Earth radius in metres, for the waypoint-track distance reconstruction. */
const EARTH_RADIUS_M = 6_371_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    timer.unref?.();
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export interface RideIdleSummary {
  /** Active rides examined this run. */
  examined: number;
  /** Rides that crossed the nudge threshold and got a push. */
  nudged: number;
  /** Rides ended by this run. */
  autoEnded: number;
  /** Rides already nudged/ended by an earlier run (dedup claim conflict). */
  skipped: number;
  /** Rides whose push send failed outright; the nudge claim is released for retry. */
  failed: number;
  /** Idle rides whose owner has no registered device — ended/nudged silently. */
  noToken: number;
}

interface ActiveRideRow {
  id: string;
  user_id: string;
  started_at: string;
  status: string;
}

interface WaypointRow {
  recorded_at: string;
  latitude: number;
  longitude: number;
}

/** Great-circle distance between two fixes, in metres. */
function haversineM(a: WaypointRow, b: WaypointRow): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

@Injectable()
export class RideIdleService {
  private readonly logger = new Logger(RideIdleService.name);
  private readonly expo = new Expo();

  // System sweep: reads rides/waypoints/tokens across all users, so the
  // service-role client with explicit filters, per the Supabase client rules.
  constructor(@Inject(SUPABASE_ADMIN) private readonly adminClient: SupabaseClient) {}

  /**
   * Find rides that are still recording but have stopped producing GPS, then nudge
   * or end them.
   *
   * Why this runs server-side at all: of the 10 rides found stuck in `recording` on
   * 2026-08-03 (max 72 days), 8 had ZERO waypoints — the device had stopped
   * reporting entirely. A client-side timer cannot fire in an app that was killed,
   * so the only reliable place to notice is here.
   */
  async sweepIdleRides(): Promise<RideIdleSummary> {
    const now = new Date();

    const { data: rides, error } = await this.adminClient
      .from('rides')
      .select('id, user_id, started_at, status')
      .in('status', ACTIVE_RIDE_STATUSES as unknown as string[])
      .is('deleted_at', null)
      // Oldest first, so the cap defers the NEWEST rides to the next run. Without an
      // explicit order Postgres may return the same arbitrary subset every hour and
      // the oldest idle rides — exactly the ones needing the sweep — starve forever.
      // Matches the partial index idx_rides_active_for_idle_sweep (migration 00173).
      .order('started_at', { ascending: true })
      .limit(MAX_RIDES_PER_RUN);

    if (error) {
      this.logger.error(`sweepIdleRides ride query failed: ${error.message} (${error.code})`);
      throw error;
    }

    const active = (rides ?? []) as ActiveRideRow[];
    if (active.length === MAX_RIDES_PER_RUN) {
      this.logger.warn(
        `sweepIdleRides hit the ${MAX_RIDES_PER_RUN}-ride cap; overflow deferred to the next run.`,
      );
    }
    const empty: RideIdleSummary = {
      examined: 0,
      nudged: 0,
      autoEnded: 0,
      skipped: 0,
      failed: 0,
      noToken: 0,
    };
    if (active.length === 0) return empty;

    // Classify each ride by how long since its last GPS fix. `lastSignal` falls back
    // to started_at for rides that never produced a waypoint (the majority of real
    // cases — an accidental start, or uploads that never landed).
    const nudgeTargets: Array<{ ride: ActiveRideRow; idleHours: number }> = [];
    const endTargets: Array<{ ride: ActiveRideRow; lastSignal: Date; track: WaypointRow[] }> = [];

    // Classification needs ONE value — the newest `recorded_at`. Most active rides are
    // perfectly healthy, so loading each full track here would move hundreds of
    // thousands of waypoint rows every hour to read a single timestamp. The track is
    // fetched below only for rides actually being ended, which need it to rebuild
    // `distance_m`.
    for (const ride of active) {
      const lastSignal = (await this.loadLastFix(ride.id)) ?? new Date(ride.started_at);
      const idleHours = differenceInHours(now, lastSignal);

      if (idleHours >= IDLE_AUTO_END_HOURS) {
        endTargets.push({ ride, lastSignal, track: await this.loadTrack(ride.id) });
      } else if (idleHours >= IDLE_NUDGE_HOURS) {
        nudgeTargets.push({ ride, idleHours });
      }
    }

    if (nudgeTargets.length === 0 && endTargets.length === 0) {
      return { ...empty, examined: active.length };
    }

    const userIds = [...new Set([...nudgeTargets, ...endTargets].map((t) => t.ride.user_id))];
    const tokensByUser = await this.loadTokens(userIds);
    const localeByUser = await this.loadLocales(userIds);

    const messages: ExpoPushMessage[] = [];
    // Which rides got a nudge claim, so send failures can be attributed to the right
    // stage: only a failed NUDGE is retryable, and only its claim may be released.
    const nudgedRideIds = new Set<string>();
    let skipped = 0;
    let autoEnded = 0;
    let noToken = 0;

    // --- Auto-end first: the data correction matters more than the notification, so
    // --- it is applied even when the rider has no device to push to.
    for (const { ride, lastSignal, track } of endTargets) {
      const ended = await this.endIdleRide(ride, lastSignal, track);
      if (!ended) continue;
      autoEnded++;

      const { error: logError } = await this.adminClient
        .from('ride_idle_nudge_log')
        .insert({ user_id: ride.user_id, ride_id: ride.id, stage: AUTO_END_STAGE });
      if (logError && logError.code !== PG_ERROR.UNIQUE_VIOLATION) {
        this.logger.error(`idle log insert failed for ride ${ride.id}: ${logError.message}`);
      }

      const tokens = (tokensByUser.get(ride.user_id) ?? []).filter((t) => Expo.isExpoPushToken(t));
      if (tokens.length === 0) {
        noToken++;
        continue;
      }
      const copy = resolveRideIdlePushCopy(localeByUser.get(ride.user_id));
      for (const to of tokens) {
        messages.push({
          to,
          sound: 'default',
          title: copy.endedTitle,
          body: copy.endedBody,
          data: { kind: NOTIFICATION_KIND.RIDE_IDLE, rideId: ride.id, autoEnded: true },
        });
      }
    }

    // --- Then the nudges. Claim before sending so a concurrent tick can't double-push.
    for (const { ride, idleHours } of nudgeTargets) {
      const tokens = (tokensByUser.get(ride.user_id) ?? []).filter((t) => Expo.isExpoPushToken(t));
      if (tokens.length === 0) {
        noToken++; // nothing to send — don't waste a dedup claim
        continue;
      }

      const { error: logError } = await this.adminClient
        .from('ride_idle_nudge_log')
        .insert({ user_id: ride.user_id, ride_id: ride.id, stage: NUDGE_STAGE });
      if (logError) {
        if (logError.code === PG_ERROR.UNIQUE_VIOLATION) skipped++;
        else this.logger.error(`idle log insert failed for ride ${ride.id}: ${logError.message}`);
        continue;
      }

      const copy = resolveRideIdlePushCopy(localeByUser.get(ride.user_id));
      for (const to of tokens) {
        messages.push({
          to,
          sound: 'default',
          title: copy.nudgeTitle,
          body: copy.nudgeBody(idleHours),
          data: { kind: NOTIFICATION_KIND.RIDE_IDLE, rideId: ride.id, autoEnded: false },
        });
      }
      nudgedRideIds.add(ride.id);
    }

    const failedRideIds = await this.dispatch(messages);

    // Attribute failures to their stage. An auto-end is ALREADY applied to the ride,
    // so a failed auto-end push must never release its claim (that would re-end the
    // ride) and must never be subtracted from the nudge count.
    const failedNudges = [...failedRideIds].filter((id) => nudgedRideIds.has(id));

    if (failedNudges.length > 0) {
      const { error: releaseError } = await this.adminClient
        .from('ride_idle_nudge_log')
        .delete()
        .eq('stage', NUDGE_STAGE)
        .in('ride_id', failedNudges);
      if (releaseError) {
        this.logger.error(
          `sweepIdleRides failed to release ${failedNudges.length} nudge claim(s): ${releaseError.message}`,
        );
      }
    }

    const failed = failedRideIds.size;
    const nudged = nudgedRideIds.size - failedNudges.length;
    const summary = `sweepIdleRides: examined=${active.length} nudged=${nudged} autoEnded=${autoEnded} skipped=${skipped} failed=${failed} noToken=${noToken}`;
    if (failed > 0) this.logger.warn(summary);
    else this.logger.log(summary);

    return { examined: active.length, nudged, autoEnded, skipped, failed, noToken };
  }

  /**
   * Timestamp of a ride's newest GPS fix, or null when it never produced one.
   *
   * This is the whole input to idle classification, so it must stay a single-row read:
   * it runs once per active ride, every hour, for rides that are overwhelmingly fine.
   * A read failure returns null (same as "no fixes"), which classifies on `started_at`
   * rather than skipping the ride forever behind a transient error.
   */
  private async loadLastFix(rideId: string): Promise<Date | null> {
    const { data, error } = await this.adminClient
      .from('ride_waypoints')
      .select('recorded_at')
      .eq('ride_id', rideId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      this.logger.warn(`loadLastFix failed for ride ${rideId}: ${error.message}`);
      return null;
    }
    const recordedAt = (data as { recorded_at?: string } | null)?.recorded_at;
    return recordedAt ? new Date(recordedAt) : null;
  }

  /** Waypoints for a ride, oldest first. Empty for rides that never uploaded any. */
  private async loadTrack(rideId: string): Promise<WaypointRow[]> {
    const { data, error } = await this.adminClient
      .from('ride_waypoints')
      .select('recorded_at, latitude, longitude')
      .eq('ride_id', rideId)
      .order('recorded_at', { ascending: true });
    if (error) {
      // Treat an unreadable track as "no signal": the ride still gets nudged/ended on
      // started_at rather than being skipped forever by a transient query failure.
      this.logger.warn(`loadTrack failed for ride ${rideId}: ${error.message}`);
      return [];
    }
    return (data ?? []) as WaypointRow[];
  }

  /**
   * End an idle ride, trimming `ended_at` back to its last GPS fix.
   *
   * The trim is the whole point: completing an abandoned ride with `ended_at = now()`
   * is what produced the 605-hour "completed" rides in production. `distance_m` is
   * reconstructed from the waypoint track so the saved ride still shows the distance
   * actually covered rather than a blank.
   */
  private async endIdleRide(
    ride: ActiveRideRow,
    lastSignal: Date,
    track: WaypointRow[],
  ): Promise<boolean> {
    const patch: Record<string, unknown> = {
      status: 'completed',
      ended_at: lastSignal.toISOString(),
      auto_ended_reason: AUTO_END_REASON_IDLE,
    };

    if (track.length >= 2) {
      let metres = 0;
      for (let i = 1; i < track.length; i++) metres += haversineM(track[i - 1], track[i]);
      patch.distance_m = Math.round(metres);
    }

    const { data, error } = await this.adminClient
      .from('rides')
      .update(patch)
      .eq('id', ride.id)
      // Guard against a race with a rider who ended it themselves between our read
      // and this write — never overwrite a genuine rider-supplied end.
      .in('status', ACTIVE_RIDE_STATUSES as unknown as string[])
      // Returning the row is how the guard above is *observed*. A filter that matches
      // nothing is not an error in Postgres, so without this the caller would count an
      // auto-end that never happened, write an `auto_end` claim, and push "Ride saved —
      // we stopped your ride where the GPS did" to a rider who had just stopped it.
      .select('id');

    if (error) {
      this.logger.error(`endIdleRide failed for ride ${ride.id}: ${error.message}`);
      return false;
    }
    if (!data || (data as unknown[]).length === 0) {
      this.logger.log(`endIdleRide skipped ride ${ride.id}: no longer active (rider ended it).`);
      return false;
    }
    return true;
  }

  private async loadTokens(userIds: string[]): Promise<Map<string, string[]>> {
    const { data, error } = await this.adminClient
      .from('device_push_tokens')
      .select('user_id, token')
      .in('user_id', userIds);
    if (error) {
      this.logger.error(`sweepIdleRides token query failed: ${error.message}`);
      throw error;
    }
    const byUser = new Map<string, string[]>();
    for (const row of (data ?? []) as Array<{ user_id: string; token: string }>) {
      const list = byUser.get(row.user_id) ?? [];
      list.push(row.token);
      byUser.set(row.user_id, list);
    }
    return byUser;
  }

  private async loadLocales(userIds: string[]): Promise<Map<string, string | null>> {
    // preferences is a service-role-only read (00141); preferences.locale is the app language.
    const { data, error } = await this.adminClient
      .from('users')
      .select('id, preferences')
      .in('id', userIds);
    if (error) {
      this.logger.error(`sweepIdleRides user query failed: ${error.message}`);
      throw error;
    }
    const byUser = new Map<string, string | null>();
    for (const row of (data ?? []) as Array<{ id: string; preferences: unknown }>) {
      const prefs = (row.preferences ?? {}) as { locale?: string | null };
      byUser.set(row.id, prefs.locale ?? null);
    }
    return byUser;
  }

  /**
   * Send in Expo-sized chunks. Returns rideIds whose send fully failed — no device
   * accepted — so only those nudge claims are released. A ride with ≥1 accepted
   * device keeps its claim so the delivered device isn't pushed twice.
   */
  private async dispatch(messages: ExpoPushMessage[]): Promise<Set<string>> {
    if (messages.length === 0) return new Set<string>();

    const rideIdOf = (m: ExpoPushMessage): string | undefined =>
      (m.data as { rideId?: string } | undefined)?.rideId;

    const failed = new Set<string>();
    const succeeded = new Set<string>();

    for (const chunk of this.expo.chunkPushNotifications(messages)) {
      try {
        const tickets = await withTimeout(
          this.expo.sendPushNotificationsAsync(chunk),
          EXPO_SEND_TIMEOUT_MS,
          'Expo push send',
        );
        for (let i = 0; i < tickets.length; i++) {
          const ticket = tickets[i];
          const rid = rideIdOf(chunk[i]);
          if (ticket.status !== 'error') {
            if (rid) succeeded.add(rid);
            continue;
          }
          if (rid) failed.add(rid);
          this.logger.warn(
            `Expo push ticket error (ride ${rid ?? 'unknown'}): ${ticket.details?.error ?? 'unknown'}`,
          );
          if (ticket.details?.error === EXPO_DEVICE_NOT_REGISTERED) {
            const dead = chunk[i].to;
            const token = Array.isArray(dead) ? dead[0] : dead;
            // Isolate the prune so a failed cleanup can't bubble into the chunk-wide
            // catch and falsely mark already-delivered rides as failed.
            try {
              const { error: pruneError } = await this.adminClient
                .from('device_push_tokens')
                .delete()
                .eq('token', token);
              if (pruneError) this.logger.warn(`Failed to prune dead token: ${pruneError.message}`);
            } catch (pruneErr) {
              this.logger.warn(`Failed to prune dead token: ${(pruneErr as Error).message}`);
            }
          }
        }
      } catch (err) {
        this.logger.error('Expo push send failed for a chunk', err as Error);
        for (const m of chunk) {
          const rid = rideIdOf(m);
          if (rid) failed.add(rid);
        }
      }
    }

    for (const rid of succeeded) failed.delete(rid);
    return failed;
  }
}
