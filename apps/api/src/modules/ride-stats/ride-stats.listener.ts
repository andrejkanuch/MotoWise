import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RIDE_EVENTS, type RideCompletedEvent } from '../../common/constants/events';
import { RideStatsService } from './ride-stats.service';

/**
 * Computes a ride's stats as soon as it completes, however it ended (rider,
 * app auto-end, server idle sweep, stale on start). A failure here is only
 * logged: the ride stays stale and the sweep computes it, reporting failures.
 */
@Injectable()
export class RideStatsListener {
  private readonly logger = new Logger(RideStatsListener.name);

  constructor(private readonly rideStats: RideStatsService) {}

  @OnEvent(RIDE_EVENTS.COMPLETED, { async: true })
  async onRideCompleted(payload: RideCompletedEvent): Promise<void> {
    try {
      const result = await this.rideStats.computeRide(payload.rideId);
      this.logger.log(`ride stats for ride ${payload.rideId}: ${result}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`ride stats failed for ride ${payload.rideId}, left for the sweep: ${msg}`);
    }
  }
}
