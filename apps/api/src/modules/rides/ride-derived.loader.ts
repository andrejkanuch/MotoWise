import { Injectable, Logger, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import { type RideDerived, RidesService } from './rides.service';

/**
 * Batches the `Ride` fields that come from `ride_stats`, so a page of rides is
 * one read per field family instead of one per ride.
 *
 * Request-scoped: every owner-only load in a request is for the signed-in
 * rider, and the field resolver loads only rides whose owner is that rider, so
 * the owner id captured from load() is the one the batch filters by.
 */
@Injectable({ scope: Scope.REQUEST })
export class RideDerivedLoader {
  private readonly logger = new Logger(RideDerivedLoader.name);
  private ownerUserId: string | null = null;
  private readonly derived: DataLoader<string, RideDerived | null>;
  private readonly startCountry: DataLoader<string, string | null>;

  constructor(private readonly ridesService: RidesService) {
    this.derived = new DataLoader(async (rideIds) => {
      const byRide = await this.ridesService.findDerivedByRideIds(this.ownerUserId ?? '', rideIds);
      return rideIds.map((id) => byRide.get(id) ?? null);
    });
    this.startCountry = new DataLoader(async (rideIds) => {
      // `region` is a legacy field every client still reads: a failed lookup is a
      // missing region, never an error on the whole ride list.
      try {
        const byRide = await this.ridesService.findStartCountryNames(rideIds);
        return rideIds.map((id) => byRide.get(id) ?? null);
      } catch (err) {
        this.logger.warn(
          `Start country lookup failed: ${err instanceof Error ? err.message : err}`,
        );
        return rideIds.map(() => null);
      }
    });
  }

  /** The ride's derived fields, or null while its stats are pending. Owner only. */
  loadDerived(rideId: string, ownerUserId: string): Promise<RideDerived | null> {
    this.ownerUserId = ownerUserId;
    return this.derived.load(rideId);
  }

  /** The name of the country the ride started in, or null. */
  loadStartCountry(rideId: string): Promise<string | null> {
    return this.startCountry.load(rideId);
  }
}
