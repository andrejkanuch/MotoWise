import { type MeasurementSystem, metersToUnit, mileageUnitLabel } from '@motovault/types';
import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { RIDE_EVENTS } from '../../common/constants/events';
import { buildConnection, decodeCursor, encodeCursor } from '../../common/pagination/connection';
import { PG_ERROR, unwrap } from '../../common/supabase/unwrap';
import { POSTGRES_REAL, QUERY_LIMITS } from '../../config/constants';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import type { EndRideInput } from './dto/end-ride.input';
import type { StartRideInput } from './dto/start-ride.input';
import type { UpdateRideInput } from './dto/update-ride.input';
import type { UploadWaypointsInput } from './dto/upload-waypoints.input';
import type { Ride } from './models/ride.model';
import type { RideConnection } from './models/ride-connection.model';
import type { Waypoint } from './models/waypoint.model';

const MAX_WAYPOINTS_PER_RIDE = QUERY_LIMITS.MAX_WAYPOINTS_PER_RIDE;

/**
 * Postgres SQLSTATE class → whether a retry could ever succeed. Matched by class
 * prefix so every code in the class is covered.
 *
 *   transient — 08 connection exception
 *               40 transaction rollback (40001 serialization, 40P01 deadlock)
 *               53 insufficient resources (53300 too_many_connections)
 *               57 operator intervention (57014 statement_timeout)
 *   permanent — 22 data exception (22003 numeric_value_out_of_range, …)
 *               23 integrity constraint violation (23502 not-null, 23503 FK)
 *
 * A `permanent` class used to fall through to 500 alongside genuinely unknown
 * failures, and the mobile sync queue treats 5xx as retryable: one poison batch
 * burned five retries with exponential backoff and a Sentry event each, which is
 * how 48 events landed in 43 minutes for a handful of bad payloads
 * (MOTO-VAULT-NODE-NESTJS-8). The payload is the problem, so it must come back as
 * a 4xx that dead-letters once. Unknown classes still map to 500 — an unknown
 * failure is worth retrying, and worth alerting on.
 */
const PG_ERROR_CLASS_DISPOSITION = {
  '08': 'transient',
  '40': 'transient',
  '53': 'transient',
  '57': 'transient',
  '22': 'permanent',
  '23': 'permanent',
} as const;

type PgDisposition = (typeof PG_ERROR_CLASS_DISPOSITION)[keyof typeof PG_ERROR_CLASS_DISPOSITION];

function pgDisposition(code: string | null | undefined): PgDisposition | 'unknown' {
  if (!code) return 'unknown';
  const match = Object.entries(PG_ERROR_CLASS_DISPOSITION).find(([cls]) => code.startsWith(cls));
  return match ? match[1] : 'unknown';
}

/**
 * Coerce a client-supplied float into a value a Postgres `real` column accepts.
 *
 * `ride_waypoints.altitude / speed_mps / heading / accuracy` are all REAL (00047),
 * and Postgres rejects rather than rounds a non-zero magnitude below the smallest
 * normal float4. Because the insert is one multi-row upsert, ONE such sample failed
 * the entire batch — up to 500 waypoints lost per bad fix, reported as an opaque
 * 500: `pg 22003: "1.366286406007969e-77" is out of range for type real`
 * (MOTO-VAULT-NODE-NESTJS-8). Zod cannot catch it either; a denormal satisfies
 * every range check on WaypointSchema.
 *
 * A sub-normal magnitude is physically zero for all four of these quantities, so it
 * collapses to 0 rather than being dropped — the fix must not turn a numeric glitch
 * into a hole in the rider's track.
 */
function toRealColumn(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const magnitude = Math.abs(value);
  if (magnitude < POSTGRES_REAL.MIN_MAGNITUDE) return 0;
  if (magnitude > POSTGRES_REAL.MAX_MAGNITUDE) {
    return Math.sign(value) * POSTGRES_REAL.MAX_MAGNITUDE;
  }
  return value;
}

@Injectable()
export class RidesService {
  private readonly logger = new Logger(RidesService.name);

  constructor(
    @Inject(SUPABASE_USER) private readonly supabase: SupabaseClient,
    @Inject(SUPABASE_ADMIN) private readonly supabaseAdmin: SupabaseClient,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async startRide(userId: string, input: StartRideInput): Promise<Ride> {
    this.logger.log(`startRide: userId=${userId}, rideId=${input.rideId}`);

    // Auto-end any stale active rides so the unique-index
    // (rides_one_active_per_user) doesn't block the new insert.
    // This handles cases where a previous ride wasn't properly ended
    // (app crash, reinstall, cleared local data).
    await this.closeStaleRides(userId);

    const { data, error } = await this.supabase
      .from('rides')
      .insert({
        id: input.rideId,
        user_id: userId,
        motorcycle_id: input.motorcycleId ?? null,
        status: 'recording',
        started_at: input.startedAt,
      })
      .select()
      .single();

    if (error || !data) {
      this.logger.error(`startRide failed: ${error?.message} (${error?.code})`);
      throw new BadRequestException('Failed to start ride');
    }
    return this.mapRow(data);
  }

  /**
   * Complete any still-active rides for this user so the new one can be inserted.
   *
   * `ended_at` is TRIMMED BACK to each stale ride's last GPS fix rather than set to
   * `now()`. Using `now()` (the previous behaviour) meant a ride abandoned weeks ago
   * was completed *as a weeks-long ride*: production held "completed" rides of up to
   * 605 hours (25 days), which then polluted history, rollups and personal records.
   * Rides that never produced a waypoint collapse to zero duration (ended_at =
   * started_at), which is the honest representation of an accidental start.
   *
   * `auto_ended_reason: 'stale_on_start'` marks these so stats can exclude them —
   * a forgotten ride must never set a "longest ride" record. (Migration 00173.)
   */
  private async closeStaleRides(userId: string): Promise<void> {
    const { data: stale, error } = await this.supabase
      .from('rides')
      .select('id, started_at')
      .eq('user_id', userId)
      .in('status', ['recording', 'paused'])
      .is('deleted_at', null);

    if (error) {
      this.logger.error(`closeStaleRides lookup failed: ${error.message} (${error.code})`);
      return;
    }
    const staleRides = (stale ?? []) as Array<{ id: string; started_at: string }>;
    if (staleRides.length === 0) return;

    for (const ride of staleRides) {
      // Last recorded fix = the real end of riding. Ordered query + limit 1 rather
      // than an aggregate so this works through the RLS-scoped user client.
      const { data: lastWaypoint, error: waypointError } = await this.supabase
        .from('ride_waypoints')
        .select('recorded_at')
        .eq('ride_id', ride.id)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (waypointError) {
        // A transient failure here (statement timeout) is indistinguishable in `data`
        // from "this ride has no waypoints", so the fallback below collapses a real
        // multi-hour ride to zero duration and the true end time is unrecoverable.
        // Log it so that collapse is visible rather than silent.
        this.logger.error(
          `closeStaleRides waypoint lookup failed for ride ${ride.id}: ${waypointError.message} (${waypointError.code}) — ended_at falls back to started_at`,
        );
      }

      const endedAt =
        (lastWaypoint as { recorded_at?: string } | null)?.recorded_at ?? ride.started_at;

      const { data: closed, error: updateError } = await this.supabase
        .from('rides')
        .update({
          status: 'completed',
          ended_at: endedAt,
          auto_ended_reason: 'stale_on_start',
        })
        .eq('id', ride.id)
        // Same race guard as RideIdleService.endIdleRide: a second device can complete
        // this ride while this one starts a new one, and matching on `id` alone would
        // overwrite that genuine rider-supplied end with a trimmed `ended_at` and a
        // 'stale_on_start' marker that wrongly excludes it from records.
        .in('status', ['recording', 'paused'])
        .is('deleted_at', null)
        // Returning the row is how that guard is observed — a filter matching nothing
        // is not an error, so without this we would emit ride.completed for a ride we
        // did not actually close.
        .select('id');

      if (updateError) {
        this.logger.error(
          `closeStaleRides failed to close ride ${ride.id}: ${updateError.message} (${updateError.code})`,
        );
        continue;
      }
      if (!closed || closed.length === 0) {
        this.logger.log(`closeStaleRides skipped ride ${ride.id}: no longer active`);
        continue;
      }

      // Same reason as the idle sweep: this path bypasses endRide, so without an
      // explicit emit the ride's distance never reaches ride_rollups. `autoEndedReason`
      // keeps it out of personal records and out of AI summary generation.
      this.eventEmitter.emit(RIDE_EVENTS.COMPLETED, {
        rideId: ride.id,
        userId,
        locale: 'en',
        autoEndedReason: 'stale_on_start',
      });
    }
  }

  async endRide(
    userId: string,
    input: EndRideInput,
  ): Promise<{
    ride: Ride;
    triggeredMaintenanceTasks: { id: string; title: string; priority: string }[];
  }> {
    this.logger.log(`endRide: userId=${userId}, rideId=${input.rideId}`);

    // The rider's own end always clears `auto_ended_reason`: if the system had marked
    // this ride, the rider superseding it makes the ride genuinely rider-ended, and
    // the marker would otherwise keep excluding it from personal records forever.
    const endPatch = {
      status: 'completed',
      ended_at: input.endedAt,
      distance_m: input.distanceM,
      max_speed_mps: input.maxSpeedMps ?? null,
      avg_speed_mps: input.avgSpeedMps ?? null,
      elevation_gain: input.elevationGain ?? null,
      elevation_loss: input.elevationLoss ?? null,
      route_polyline: input.routePolyline ?? null,
      gps_quality: input.gpsQuality ?? null,
      paused_duration_s: input.pausedDurationS,
      auto_paused_duration_s: input.autoPausedDurationS,
      auto_ended_reason: null,
      ...(input.maxLeanAngle != null && { max_lean_angle: input.maxLeanAngle }),
    };

    const { data, error } = await this.supabase
      .from('rides')
      .update(endPatch)
      .eq('id', input.rideId)
      .eq('user_id', userId)
      .in('status', ['recording', 'paused'])
      .is('deleted_at', null)
      .select()
      .single();

    let row = data;

    if (error || !row) {
      if (error?.code === PG_ERROR.NOT_FOUND) {
        const { data: existing } = await this.supabase
          .from('rides')
          .select('*')
          .eq('id', input.rideId)
          .eq('user_id', userId)
          .eq('status', 'completed')
          .is('deleted_at', null)
          .single();

        const autoEndedReason = (existing as { auto_ended_reason?: string | null } | null)
          ?.auto_ended_reason;

        if (existing && autoEndedReason) {
          // NOT an idempotent retry — the SYSTEM ended this ride under the rider, and
          // they have now come back and stopped it themselves. Their payload is the
          // authoritative one: the sweep's `ended_at` is only the last fix it happened
          // to receive, and its `distance_m` was reconstructed from that partial track.
          // Treating this as "already completed" discarded a real ride (waypoints do
          // upload to completed rides, so the track was already stored) and returned
          // success, leaving the rider a locally-computed summary that matched nothing
          // saved, and no odometer application at all.
          const { data: reclaimed, error: reclaimError } = await this.supabase
            .from('rides')
            .update(endPatch)
            .eq('id', input.rideId)
            .eq('user_id', userId)
            .eq('status', 'completed')
            // Only ever overwrite a SYSTEM-ended ride; a rider-ended one stays
            // idempotent, which is what MOT-140 added this branch for.
            .not('auto_ended_reason', 'is', null)
            .is('deleted_at', null)
            .select()
            .single();

          if (reclaimed) {
            this.logger.log(
              `endRide: ride ${input.rideId} was system-ended (${autoEndedReason}) — rider's end reclaims it`,
            );
            row = reclaimed;
          } else {
            this.logger.error(
              `endRide: failed to reclaim system-ended ride ${input.rideId}: ${reclaimError?.message}`,
            );
            return { ride: this.mapRow(existing), triggeredMaintenanceTasks: [] };
          }
        } else if (existing) {
          // Idempotent retry (MOT-140): a sync-queue retry or duplicate tap arrives
          // after the ride is already completed by the rider; the status filter above
          // matched 0 rows. Return it as success — do NOT re-emit ride.completed or
          // re-apply mileage.
          this.logger.log(`endRide: ride ${input.rideId} already completed — idempotent success`);
          return { ride: this.mapRow(existing), triggeredMaintenanceTasks: [] };
        }
      }

      if (!row) {
        this.logger.error(`endRide failed: ${error?.message} (${error?.code})`);
        throw new BadRequestException('Failed to end ride');
      }
    }

    const ride = this.mapRow(row);
    let triggeredMaintenanceTasks: { id: string; title: string; priority: string }[] = [];

    // MOT-140: claim-first odometer sync. A single conditional UPDATE flips
    // mileage_applied false→true and returns the row to exactly ONE caller;
    // concurrent endRides (two devices) and retries match 0 rows and skip the
    // odometer, so mileage is applied exactly once with no read-modify-write race.
    const { data: claimed } = await this.supabase
      .from('rides')
      .update({ mileage_applied: true })
      .eq('id', input.rideId)
      .eq('user_id', userId)
      .eq('mileage_applied', false)
      .select('distance_m, motorcycle_id')
      .single();

    const motorcycleId = claimed?.motorcycle_id;
    const distanceM = claimed?.distance_m ?? 0;

    if (claimed && motorcycleId && distanceM > 0) {
      try {
        // Defense-in-depth: filter by user_id alongside RLS
        const { data: bike } = await this.supabase
          .from('motorcycles')
          .select('current_mileage')
          .eq('id', motorcycleId)
          .eq('user_id', userId)
          .single();

        // MOT-140: current_mileage is stored RAW in the user's measurement-system
        // unit (docs/plans/odometer-unit-normalization.md). Ride distance comes
        // from GPS in meters, so convert meters → that unit before accumulating.
        // Use the GLOBAL measurement_system (service-role read), not the
        // deprecated per-bike mileage_unit. target_mileage below is in the same
        // raw unit, so the due comparison stays valid.
        const { data: userRow } = await this.supabaseAdmin
          .from('users')
          .select('measurement_system')
          .eq('id', userId)
          .single();
        const system = (userRow?.measurement_system as MeasurementSystem | null) ?? 'metric';
        const unit = mileageUnitLabel(system);
        const roundedDelta = Math.round(metersToUnit(distanceM, unit));
        const newMileage = (bike?.current_mileage ?? 0) + roundedDelta;

        const nowIso = new Date().toISOString();

        await this.supabase
          .from('motorcycles')
          .update({
            current_mileage: newMileage,
            mileage_updated_at: nowIso,
            odometer_sync_source: 'gps_ride',
            odometer_last_ride_id: input.rideId,
          })
          .eq('id', motorcycleId)
          .eq('user_id', userId);

        // NOTE: mileage_applied was already claimed above, so a failure in this
        // block leaves it true — the ride won't re-sync on retry. A missed
        // odometer update is rare and user-correctable via manual edit; this is
        // the deliberate trade for race-free exactly-once application.
        this.logger.log(
          `Odometer sync: +${roundedDelta}${unit} to motorcycle ${motorcycleId} (total: ${newMileage}${unit}, ride=${input.rideId})`,
        );

        // Check for maintenance tasks that are now due. target_mileage and
        // current_mileage are both in the same raw user unit, so this is valid.
        const { data: dueTasks } = await this.supabase
          .from('maintenance_tasks')
          .select('id, title, priority')
          .eq('motorcycle_id', motorcycleId)
          .eq('status', 'pending')
          .not('target_mileage', 'is', null)
          .lte('target_mileage', newMileage);

        if (dueTasks && dueTasks.length > 0) {
          triggeredMaintenanceTasks = dueTasks;
          this.logger.log(
            `${dueTasks.length} maintenance task(s) triggered for motorcycle ${motorcycleId}`,
          );
        }
      } catch (mileageError) {
        const msg = mileageError instanceof Error ? mileageError.message : String(mileageError);
        this.logger.warn(`Failed to apply mileage: ${msg}`);
        // Non-fatal — ride is already saved
      }
    }

    // Emit event for async AI ride summary generation
    this.eventEmitter.emit(RIDE_EVENTS.COMPLETED, {
      rideId: ride.id,
      userId,
      locale: 'en', // TODO: pass user's preferred locale
    });

    return { ride, triggeredMaintenanceTasks };
  }

  async uploadWaypoints(userId: string, input: UploadWaypointsInput): Promise<number> {
    this.logger.log(
      `uploadWaypoints: userId=${userId}, rideId=${input.rideId}, count=${input.waypoints.length}`,
    );

    // Verify ride ownership
    const { data: ride, error: rideError } = await this.supabase
      .from('rides')
      .select('id')
      .eq('id', input.rideId)
      .eq('user_id', userId)
      .in('status', ['recording', 'paused', 'completed'])
      .is('deleted_at', null)
      .single();

    if (rideError || !ride) {
      throw new NotFoundException('Ride not found or not active');
    }

    // Check waypoint quota. This is a SOFT abuse guard, not a correctness gate:
    // a transient read failure (pooler hiccup, statement timeout) must not block
    // the user's own waypoints from persisting. On a count error we log and skip
    // enforcement — the cap is re-checked on the next successful upload. Blocking
    // here was a source of opaque 500s (Sentry MOTO-VAULT-REACT-NATIVE-1J).
    const { count, error: countError } = await this.supabase
      .from('ride_waypoints')
      .select('ride_id', { count: 'exact', head: true })
      .eq('ride_id', input.rideId);

    if (countError) {
      this.logger.warn(
        `uploadWaypoints: quota count failed, proceeding without it: ${countError.message} (${countError.code}) rideId=${input.rideId}`,
      );
    }

    // Over the cap: TRUNCATE the batch, never reject it. Throwing 400 here turned
    // the quota into a poison pill — the recorder re-enqueues a fresh chunk every
    // CHUNK_SIZE GPS fixes, and every one of them was permanently rejected, so a
    // single long ride produced hundreds of dead-lettered payloads and one Sentry
    // event each (MOTO-VAULT-REACT-NATIVE-1M: 351 of 391 events, ONE rider, one
    // release). Storing what fits holds the cap just as firmly while letting the
    // client's sync queue drain, which is what stops the loop on builds already in
    // the field — they cannot be fixed by a client-side change. The return value is
    // the number actually stored, so the caller is never told more was kept than was.
    const accepted = countError
      ? input.waypoints
      : input.waypoints.slice(0, Math.max(0, MAX_WAYPOINTS_PER_RIDE - (count ?? 0)));

    if (accepted.length === 0) {
      this.logger.warn(
        `uploadWaypoints: ride ${input.rideId} already at the ${MAX_WAYPOINTS_PER_RIDE}-waypoint cap — dropped ${input.waypoints.length}`,
      );
      return 0;
    }
    if (accepted.length < input.waypoints.length) {
      this.logger.warn(
        `uploadWaypoints: ride ${input.rideId} truncated to the cap — stored ${accepted.length} of ${input.waypoints.length}`,
      );
    }

    // INSERT...ON CONFLICT DO NOTHING for idempotency. Every REAL column goes
    // through toRealColumn — one unrepresentable float fails the whole upsert.
    const rows = accepted.map((wp) => ({
      ride_id: input.rideId,
      recorded_at: wp.recordedAt,
      latitude: wp.latitude,
      longitude: wp.longitude,
      altitude: toRealColumn(wp.altitude),
      speed_mps: toRealColumn(wp.speedMps),
      heading: toRealColumn(wp.heading),
      accuracy: toRealColumn(wp.accuracy),
    }));

    const { error } = await this.supabase.from('ride_waypoints').upsert(rows, {
      onConflict: 'ride_id,recorded_at',
      ignoreDuplicates: true,
    });

    if (error) {
      this.throwWaypointUploadError(error, input);
    }

    return accepted.length;
  }

  /**
   * Translate a waypoint-upsert Postgres error into the right HTTP exception and
   * make it diagnosable. Disposition is a table lookup
   * (PG_ERROR_CLASS_DISPOSITION) rather than a chain of ifs, and only `unknown`
   * reaches 500 — see that table for why a permanent failure must not.
   *
   * Three things about AllExceptionsFilter govern what each branch actually
   * delivers, and they are not obvious from here:
   *
   * 1. The filter maps HTTP status → `extensions.code` (400 → BAD_REQUEST,
   *    503 → SERVICE_UNAVAILABLE, 500 → INTERNAL_SERVER_ERROR). That code is the
   *    ONLY signal the mobile queue classifies on, because a GraphQL error still
   *    returns HTTP 200. BAD_REQUEST is in the queue's NON_RETRYABLE_CODES, so the
   *    `permanent` branch is what makes a poison batch dead-letter after one try.
   * 2. The filter passes `exception.message` through only for status < 500. So the
   *    SQLSTATE in the `permanent` message REACHES the client; the one in the
   *    `transient` message is replaced with "Internal server error" and is there
   *    purely for the log line and local debugging.
   * 3. The filter calls Sentry.captureException only for non-HttpExceptions and
   *    status >= 500. Routing class 22/23 to 400 therefore also stops these being
   *    reported to Sentry at all — deliberate (they were pure retry noise), but it
   *    means a NEW class-22/23 failure mode is visible only in the Render logs via
   *    the logger.error below. `cause` still carries the code for the 500 branch,
   *    which is the one Sentry keeps.
   */
  private throwWaypointUploadError(error: PostgrestError, input: UploadWaypointsInput): never {
    this.logger.error(
      `uploadWaypoints failed: ${error.message} (${error.code}) rideId=${input.rideId} count=${input.waypoints.length}`,
    );
    const code = error.code ?? 'unknown';
    const cause = new Error(`pg ${code}: ${error.message}`);
    const options = { cause };

    const WAYPOINT_UPLOAD_EXCEPTIONS: Record<PgDisposition | 'unknown', () => Error> = {
      transient: () =>
        new ServiceUnavailableException(`Failed to upload waypoints (${code})`, options),
      // 4xx so the mobile sync queue dead-letters once instead of retrying a
      // payload the database will refuse every time.
      permanent: () =>
        new BadRequestException(`Waypoint upload rejected: invalid data (${code})`, options),
      unknown: () => new InternalServerErrorException('Failed to upload waypoints', options),
    };

    throw WAYPOINT_UPLOAD_EXCEPTIONS[pgDisposition(error.code)]();
  }

  async updateRide(userId: string, input: UpdateRideInput): Promise<Ride> {
    this.logger.log(`updateRide: userId=${userId}, rideId=${input.rideId}`);

    const updates: Record<string, unknown> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.mileageApplied !== undefined) updates.mileage_applied = input.mileageApplied;
    if (input.isPublic !== undefined) {
      // Dual-write: `visibility` is canonical (RLS gates on it); `is_public` stays in
      // sync until every SQL consumer is migrated and the column is dropped (00143).
      updates.is_public = input.isPublic;
      updates.visibility = input.isPublic ? 'public' : 'private';
    }

    const { data, error } = await this.supabase
      .from('rides')
      .update(updates)
      .eq('id', input.rideId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .select()
      .single();

    if (error || !data) {
      this.logger.error(`updateRide failed: ${error?.message} (${error?.code})`);
      throw new BadRequestException('Failed to update ride');
    }
    return this.mapRow(data);
  }

  async deleteRide(userId: string, id: string): Promise<boolean> {
    this.logger.log(`deleteRide: userId=${userId}, rideId=${id}`);

    // Goes through soft_delete_ride (00176) rather than a direct UPDATE. A
    // soft delete sets deleted_at, which makes the new row fail the
    // `deleted_at IS NULL` SELECT policy, and PostgreSQL applies SELECT
    // policies to the new row of an UPDATE whenever the statement reads table
    // columns — a WHERE clause is enough — so the statement is rejected
    // outright even though the UPDATE WITH CHECK passes. This used to be worked
    // around with supabaseAdmin, which bypasses RLS wholesale and moved the
    // ownership check into `.eq('user_id', userId)` here. The RPC is SECURITY
    // DEFINER instead: the SELECT policy does not apply to it, and it pins
    // `user_id = auth.uid()` internally, so ownership stays in the database.
    // See docs/solutions/architecture/soft-delete-rejected-by-select-rls-policy.md.
    //
    // It also folds in the already-deleted check that previously needed a
    // second admin round trip: `true` means the ride is deleted and theirs,
    // whether this call did it or a duplicate tap / sync-queue retry already
    // had.
    const { data, error } = await this.supabase.rpc('soft_delete_ride', { ride_id: id });

    if (error) {
      this.logger.error(`deleteRide failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to delete ride');
    }

    if (data === false) {
      this.logger.warn(`deleteRide: no ride matched id=${id} for this user`);
      throw new NotFoundException('Ride not found');
    }

    return true;
  }

  // ==========================================
  // Ride visibility + sharing (privacy feature)
  // ==========================================

  /** Update a ride's visibility setting. Owner-only via RLS. */
  async updateRideVisibility(
    userId: string,
    rideId: string,
    visibility: 'private' | 'unlisted' | 'public',
  ): Promise<Ride> {
    // Dual-write is_public until every SQL consumer is migrated off it (00143)
    const { data, error } = await this.supabase
      .from('rides')
      .update({ visibility, is_public: visibility === 'public' })
      .eq('id', rideId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundException('Ride not found');
    }
    return this.mapRow(data);
  }

  /** Grant a specific user read access to a private ride. */
  async shareRide(userId: string, rideId: string, sharedWithUserId: string): Promise<boolean> {
    const { error } = await this.supabase.from('ride_shares').insert({
      ride_id: rideId,
      shared_with_user_id: sharedWithUserId,
      shared_by_user_id: userId,
    });

    if (error) {
      // Idempotent on duplicate — already shared
      if (error.code === PG_ERROR.UNIQUE_VIOLATION) return true;
      this.logger.error(`shareRide failed: ${error.message}`);
      throw new BadRequestException('Failed to share ride');
    }
    return true;
  }

  /** Revoke a user's access to a previously shared private ride. */
  async unshareRide(userId: string, rideId: string, sharedWithUserId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('ride_shares')
      .delete()
      .eq('ride_id', rideId)
      .eq('shared_with_user_id', sharedWithUserId)
      .eq('shared_by_user_id', userId);

    if (error) {
      this.logger.error(`unshareRide failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to unshare ride');
    }
    return true;
  }

  /** List users the ride has been shared with. Owner-only (or admin via RLS). */
  async listRideShares(
    userId: string,
    rideId: string,
  ): Promise<Array<{ sharedWithUserId: string; sharedAt: string }>> {
    const { data, error } = await this.supabase
      .from('ride_shares')
      .select('shared_with_user_id, created_at')
      .eq('ride_id', rideId)
      .eq('shared_by_user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`listRideShares failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to list ride shares');
    }

    return (data ?? []).map((row) => ({
      sharedWithUserId: row.shared_with_user_id as string,
      sharedAt: row.created_at as string,
    }));
  }

  async myRides(
    userId: string,
    first: number,
    after?: string,
    motorcycleId?: string,
  ): Promise<RideConnection> {
    this.logger.debug(`myRides: userId=${userId}, first=${first}, after=${after}`);

    const limit = Math.min(first, 50);
    // Explicit column list matches Ride model fields (see rides/models/ride.model.ts
    // + mapRow below). Avoids shipping heavy `metadata` / `weather_snapshot` / `ai_summary`
    // blobs that the GraphQL surface doesn't expose. `count: 'estimated'` keeps totalCount
    // cheap for large histories — we don't need exact row count for pagination.
    let query = this.supabase
      .from('rides')
      .select(
        'id, user_id, motorcycle_id, status, name, started_at, ended_at, distance_m, max_speed_mps, avg_speed_mps, max_lean_angle, elevation_gain, elevation_loss, route_polyline, route_thumbnail_uri, gps_quality, paused_duration_s, auto_paused_duration_s, mileage_applied, is_public, visibility, region, created_at, updated_at',
        { count: 'estimated' },
      )
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('started_at', { ascending: false })
      .limit(limit + 1);

    if (motorcycleId) {
      query = query.eq('motorcycle_id', motorcycleId);
    }

    if (after) {
      const decoded = decodeCursor(after);
      if (!decoded) {
        throw new BadRequestException('Invalid cursor');
      }
      query = query.lt('started_at', decoded[0]);
    }

    const { data, error, count } = await query;

    // Routed through `unwrap` (rather than a hand-rolled throw) so a PostgREST
    // token rejection becomes a 401 the client can refresh on, instead of the
    // opaque 500 that paged as MOTO-VAULT-NODE-NESTJS-C.
    const rows = unwrap(
      { data, error },
      { logger: this.logger, op: 'myRides', message: 'Failed to fetch rides' },
    );

    return buildConnection({
      rows: rows ?? [],
      limit,
      mapNode: (row) => this.mapRow(row),
      cursorOf: (row) => encodeCursor(row.started_at),
      totalCount: count ?? 0,
      hasPreviousPage: !!after,
    });
  }

  async getPublicRide(id: string): Promise<Ride> {
    this.logger.debug(`getPublicRide: rideId=${id}`);

    // `visibility` is the canonical access column (RLS gates on it); the previous
    // is_public gate disagreed with RLS whenever the two columns drifted (audit C6).
    const { data, error } = await this.supabaseAdmin
      .from('rides')
      .select(
        'id, user_id, motorcycle_id, status, name, started_at, ended_at, distance_m, max_speed_mps, avg_speed_mps, max_lean_angle, elevation_gain, elevation_loss, gps_quality, paused_duration_s, auto_paused_duration_s, mileage_applied, visibility, region, route_polyline, route_thumbnail_uri, created_at, updated_at',
      )
      .eq('id', id)
      .eq('visibility', 'public')
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      throw new NotFoundException('Ride not found');
    }
    return this.mapRow(data);
  }

  async findById(userId: string, id: string): Promise<Ride> {
    this.logger.debug(`findById: userId=${userId}, rideId=${id}`);

    const { data, error } = await this.supabase
      .from('rides')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      throw new NotFoundException('Ride not found');
    }
    return this.mapRow(data);
  }

  async findWaypoints(userId: string, rideId: string, maxPoints?: number): Promise<Waypoint[]> {
    this.logger.debug(`findWaypoints: userId=${userId}, rideId=${rideId}, maxPoints=${maxPoints}`);

    // Verify ride ownership (RLS handles this, but explicit check for clear errors)
    const { data: ride, error: rideError } = await this.supabase
      .from('rides')
      .select('id')
      .eq('id', rideId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();

    if (rideError || !ride) {
      throw new NotFoundException('Ride not found');
    }

    // Fetch waypoints ordered by time, filter poor accuracy
    const { data, error } = await this.supabase
      .from('ride_waypoints')
      .select('recorded_at, latitude, longitude, altitude, speed_mps, accuracy')
      .eq('ride_id', rideId)
      .or(`accuracy.is.null,accuracy.lte.${QUERY_LIMITS.WAYPOINT_ACCURACY_THRESHOLD}`)
      .order('recorded_at', { ascending: true })
      .limit(QUERY_LIMITS.MAX_WAYPOINTS_PER_RIDE);

    if (error) {
      this.logger.error(`findWaypoints failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to fetch waypoints');
    }

    const rows = data ?? [];
    if (rows.length === 0) return [];

    // Server-side downsampling
    const limit = Math.min(
      Math.max(maxPoints ?? QUERY_LIMITS.WAYPOINT_QUERY_DEFAULT, 2),
      QUERY_LIMITS.WAYPOINT_QUERY_MAX,
    );
    const sampled = rows.length <= limit ? rows : this.downsample(rows, limit);

    return sampled.map((row) => ({
      recordedAt: row.recorded_at as string,
      latitude: row.latitude as number,
      longitude: row.longitude as number,
      altitude: (row.altitude as number) ?? undefined,
      speedMps: (row.speed_mps as number) ?? undefined,
      accuracy: (row.accuracy as number) ?? undefined,
    }));
  }

  private downsample<T>(rows: T[], maxPoints: number): T[] {
    if (rows.length <= maxPoints) return rows;
    const result: T[] = [rows[0]];
    const step = (rows.length - 1) / (maxPoints - 1);
    for (let i = 1; i < maxPoints - 1; i++) {
      result.push(rows[Math.round(i * step)]);
    }
    result.push(rows[rows.length - 1]);
    return result;
  }

  private mapRow(row: Record<string, unknown>): Ride {
    // `isPublic` is DERIVED from canonical `visibility` so old OTA bundles reading
    // either field always see consistent values (audit C6). The is_public fallback
    // covers selects that predate the visibility column in their column list.
    const visibility =
      (row.visibility as string) ?? ((row.is_public as boolean) ? 'public' : 'private');
    return {
      id: row.id as string,
      userId: row.user_id as string,
      motorcycleId: (row.motorcycle_id as string) ?? undefined,
      status: row.status as string,
      name: (row.name as string) ?? undefined,
      startedAt: row.started_at as string,
      endedAt: (row.ended_at as string) ?? undefined,
      durationS: row.ended_at
        ? Math.round(
            (new Date(row.ended_at as string).getTime() -
              new Date(row.started_at as string).getTime()) /
              1000,
          )
        : undefined,
      pausedDurationS: (row.paused_duration_s as number) ?? 0,
      autoPausedDurationS: (row.auto_paused_duration_s as number) ?? 0,
      distanceM: (row.distance_m as number) ?? undefined,
      maxSpeedMps: (row.max_speed_mps as number) ?? undefined,
      avgSpeedMps: (row.avg_speed_mps as number) ?? undefined,
      maxLeanAngle: (row.max_lean_angle as number) ?? undefined,
      elevationGain: (row.elevation_gain as number) ?? undefined,
      elevationLoss: (row.elevation_loss as number) ?? undefined,
      routePolyline: (row.route_polyline as string) ?? undefined,
      gpsQuality: (row.gps_quality as number) ?? undefined,
      mileageApplied: (row.mileage_applied as boolean) ?? false,
      isPublic: visibility === 'public',
      visibility,
      region: (row.region as string) ?? undefined,
      routeThumbnailUri: (row.route_thumbnail_uri as string) ?? undefined,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}
