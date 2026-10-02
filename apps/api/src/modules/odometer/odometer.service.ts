import { MileageUnit, metersToUnit } from '@motovault/types';
import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { Motorcycle } from '../motorcycles/models/motorcycle.model';
import { MotorcyclesService } from '../motorcycles/motorcycles.service';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import type { LogOdometerReadingInput } from './dto/log-odometer-reading.input';
import type { OdometerReading } from './models/odometer-reading.model';
import type { PendingRideDistance } from './models/pending-ride-distance.model';

const ODOMETER_READINGS_TABLE = 'odometer_readings';
const RIDES_TABLE = 'rides';
const LOG_ODOMETER_READING_RPC = 'log_odometer_reading';
const RIDE_STATUS_COMPLETED = 'completed';
const ODOMETER_READING_SELECT = 'id, value, recorded_at, source, ride_id';

export const ODOMETER_READINGS_DEFAULT_LIMIT = 20;
const ODOMETER_READINGS_MAX_LIMIT = 100;

const NO_PENDING_RIDES: PendingRideDistance = { rideCount: 0, distance: 0 };

interface OdometerReadingRow {
  id: string;
  value: number;
  recorded_at: string;
  source: string;
  ride_id: string | null;
}

/**
 * Odometer log (00181). The reading and the bike's `current_mileage` are written
 * together by the `log_odometer_reading` RPC; every other odometer write (ride
 * end, receipt scan, legacy `updateMotorcycle`) is logged by a database trigger,
 * so those services are deliberately not touched here.
 */
@Injectable()
export class OdometerService {
  private readonly logger = new Logger(OdometerService.name);

  constructor(
    @Inject(SUPABASE_USER) private readonly supabase: SupabaseClient,
    private readonly motorcyclesService: MotorcyclesService,
  ) {}

  /** Newest first. */
  async findReadings(
    userId: string,
    motorcycleId: string,
    limit: number = ODOMETER_READINGS_DEFAULT_LIMIT,
  ): Promise<OdometerReading[]> {
    const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), ODOMETER_READINGS_MAX_LIMIT);
    const { data, error } = await this.supabase
      .from(ODOMETER_READINGS_TABLE)
      .select(ODOMETER_READING_SELECT)
      .eq('user_id', userId)
      .eq('motorcycle_id', motorcycleId)
      .order('recorded_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(boundedLimit);

    if (error) {
      this.logger.error(`findReadings failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to fetch odometer readings');
    }
    return ((data ?? []) as OdometerReadingRow[]).map((row) => this.mapRow(row));
  }

  /**
   * Distance of tracked rides that never reached the odometer: completed rides
   * of this bike whose automatic sync did not apply (`mileage_applied = false`)
   * and that ended after the latest reading. Expressed in the bike's unit.
   */
  async pendingRideDistance(userId: string, motorcycleId: string): Promise<PendingRideDistance> {
    const bike = await this.motorcyclesService.findById(userId, motorcycleId);
    if (!bike) throw new NotFoundException('Motorcycle not found');

    const [latestReading] = await this.findReadings(userId, motorcycleId, 1);

    let query = this.supabase
      .from(RIDES_TABLE)
      .select('distance_m')
      .eq('user_id', userId)
      .eq('motorcycle_id', motorcycleId)
      .eq('status', RIDE_STATUS_COMPLETED)
      .eq('mileage_applied', false)
      .is('deleted_at', null)
      .gt('distance_m', 0);
    if (latestReading) query = query.gt('ended_at', latestReading.recordedAt);

    const { data, error } = await query;
    if (error) {
      this.logger.error(`pendingRideDistance failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to fetch pending ride distance');
    }

    const rides = (data ?? []) as { distance_m: number | null }[];
    if (rides.length === 0) return NO_PENDING_RIDES;

    const totalMeters = rides.reduce((sum, ride) => sum + (ride.distance_m ?? 0), 0);
    const unit = bike.distanceUnit === MileageUnit.MI ? MileageUnit.MI : MileageUnit.KM;
    return { rideCount: rides.length, distance: Math.round(metersToUnit(totalMeters, unit)) };
  }

  /**
   * Logs a reading and returns the bike. A value lower than the current one is
   * accepted on purpose: the client asks first, and a rider must be able to
   * correct a typo. A reading back-dated before the latest one is logged without
   * moving `currentMileage` (decided in the RPC).
   */
  async logReading(userId: string, input: LogOdometerReadingInput): Promise<Motorcycle> {
    this.logger.log(`logReading: userId=${userId}, motorcycleId=${input.motorcycleId}`);
    const { error } = await this.supabase.rpc(LOG_ODOMETER_READING_RPC, {
      p_motorcycle_id: input.motorcycleId,
      p_value: input.value,
      p_recorded_at: input.recordedAt ?? new Date().toISOString(),
    });

    if (error) {
      this.logger.error(`logReading failed: ${error.message} (${error.code})`);
      throw new BadRequestException('Failed to log odometer reading');
    }

    const bike = await this.motorcyclesService.findById(userId, input.motorcycleId);
    if (!bike) throw new NotFoundException('Motorcycle not found');
    return bike;
  }

  private mapRow(row: OdometerReadingRow): OdometerReading {
    return {
      id: row.id,
      value: row.value,
      recordedAt: row.recorded_at,
      source: row.source,
      rideId: row.ride_id ?? undefined,
    };
  }
}
