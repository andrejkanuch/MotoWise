import {
  RIDER_INSIGHTS_HEADLINE_STEP,
  RIDER_INSIGHTS_MIN_QUALIFYING_RIDES,
  RIDER_INSIGHTS_RHYTHM_GRID,
  RIDER_INSIGHTS_STATUS,
  RIDER_INSIGHTS_TEASER_SHARE_STEP,
  type RiderInsights,
  type RiderInsightsBestRides,
  type RiderInsightsBikes,
  type RiderInsightsCostPerKm,
  type RiderInsightsDistanceSource,
  type RiderInsightsRhythm,
  type RiderInsightsRoadCharacter,
  type RiderInsightsStatus,
  type RiderInsightsTerritory,
  roundToStep,
} from '@motovault/types';
import type {
  SeasonBands,
  SeasonBestRide,
  SeasonRankedBendsRide,
  SeasonRow,
} from './rider-insights.types';

/**
 * Turns one `rider_insights_season` row into the `riderInsights` contract for a
 * rider of the given real tier.
 *
 * A locked group is BUILT from its allowlist (one rounded headline plus the
 * teaser), never by deleting keys from the detail, so a field added to the RPC
 * later cannot leak to a free rider by default. The caller validates the result
 * against `RiderInsightsSchema` and returns the parsed object.
 */

const { READY, COMPUTING, NOT_ENOUGH, MISSING_INPUT, LOCKED } = RIDER_INSIGHTS_STATUS;

interface SeasonContext {
  qualifyingRides: number;
  pendingRides: number;
  isPro: boolean;
}

/** not_enough, then computing, then missing_input, then locked (non-Pro), then ready. */
function statusOf(ctx: SeasonContext, missingInput: boolean): RiderInsightsStatus {
  if (ctx.qualifyingRides < RIDER_INSIGHTS_MIN_QUALIFYING_RIDES) return NOT_ENOUGH;
  if (ctx.pendingRides > 0) return COMPUTING;
  if (missingInput) return MISSING_INPUT;
  return ctx.isPro ? READY : LOCKED;
}

/** The statuses that carry nothing but their name. */
type BareStatus = Exclude<RiderInsightsStatus, typeof READY | typeof LOCKED>;

function isBare(status: RiderInsightsStatus): status is BareStatus {
  return status !== READY && status !== LOCKED;
}

const rideRef = (ride: { ride_id: string; name: string | null; local_date: string }) => ({
  rideId: ride.ride_id,
  name: ride.name,
  localDate: ride.local_date,
});

const rankedBendsRide = (ride: SeasonRankedBendsRide) => ({
  ...rideRef(ride),
  distanceM: ride.distance_m,
  bendsPer10km: ride.bends_per_10km,
});

const bestRide = (ride: SeasonBestRide) => ({
  ...rideRef(ride),
  distanceM: ride.distance_m,
  climbM: ride.climb_m,
  bendsPer10km: ride.bends_per_10km,
  movingTimeS: ride.moving_time_s,
});

function bandShares(bandKm: SeasonBands, routedKm: number): SeasonBands {
  const shareOf = (km: number) => roundToStep(km / routedKm, RIDER_INSIGHTS_TEASER_SHARE_STEP);
  return {
    straight: shareOf(bandKm.straight),
    sweeping: shareOf(bandKm.sweeping),
    twisty: shareOf(bandKm.twisty),
    tight: shareOf(bandKm.tight),
  };
}

/**
 * The rhythm teaser: 0 for a slot with no rides, else 1 to 3 by the slot's
 * count as a share of the rider's busiest slot, so the grid's shape is the
 * rider's own and no slot carries its count.
 */
function rhythmLevels(grid: number[][]): number[][] {
  const busiest = Math.max(0, ...grid.flat());
  return grid.map((day) =>
    day.map((rides) =>
      rides > 0 ? Math.ceil((RIDER_INSIGHTS_RHYTHM_GRID.MAX_LEVEL * rides) / busiest) : 0,
    ),
  );
}

function territory(row: SeasonRow, ctx: SeasonContext): RiderInsightsTerritory {
  const t = row.groups.territory;
  const status = statusOf(ctx, row.coverage.qualifying.with_route === 0);
  if (isBare(status)) return { status };
  const headline = roundToStep(t.explored_km2, RIDER_INSIGHTS_HEADLINE_STEP.TERRITORY_EXPLORED_KM2);
  if (status === LOCKED) return { status, headline };
  return {
    status: READY,
    headline,
    detail: {
      exploredCells: t.explored_cells,
      exploredKm2: t.explored_km2,
      routedM: t.routed_m,
      newRoadM: t.new_road_m,
      newRoadShare: t.new_road_share,
      furthest: t.furthest
        ? {
            rideId: t.furthest.ride_id,
            localDate: t.furthest.local_date,
            distanceM: t.furthest.distance_m,
            lat: t.furthest.lat,
            lng: t.furthest.lng,
          }
        : null,
    },
  };
}

function roadCharacter(row: SeasonRow, ctx: SeasonContext): RiderInsightsRoadCharacter {
  const rc = row.groups.road_character;
  const noBands =
    row.coverage.qualifying.with_bands === 0 || rc.bends_per_10km == null || rc.routed_km <= 0;
  const status = statusOf(ctx, noBands);
  if (isBare(status)) return { status };
  // Non-null here: a null bends_per_10km made the group missing_input above.
  const bendsPer10km = rc.bends_per_10km as number;
  const headline = roundToStep(
    bendsPer10km,
    RIDER_INSIGHTS_HEADLINE_STEP.ROAD_CHARACTER_BENDS_PER_10KM,
  );
  if (status === LOCKED) {
    return { status, headline, teaser: { bandShares: bandShares(rc.band_km, rc.routed_km) } };
  }
  return {
    status: READY,
    headline,
    detail: {
      bandKm: { ...rc.band_km },
      routedKm: rc.routed_km,
      bendsCount: rc.bends_count,
      bendsPer10km,
      ridesWithBands: rc.rides_with_bands,
      ridesWithLean: rc.rides_with_lean,
      twistiest: rc.twistiest.map(rankedBendsRide),
      straightest: rc.straightest.map(rankedBendsRide),
      lean: rc.lean
        ? {
            corners: rc.lean.corners,
            under20: rc.lean.under20,
            from20to30: rc.lean.from20to30,
            from30to40: rc.lean.from30to40,
            from40: rc.lean.from40,
          }
        : null,
    },
  };
}

function rhythm(row: SeasonRow, ctx: SeasonContext): RiderInsightsRhythm {
  const r = row.groups.rhythm;
  const status = statusOf(ctx, r.weekend_share == null);
  if (isBare(status)) return { status };
  // Non-null here: a null weekend_share made the group missing_input above.
  const weekendShare = r.weekend_share as number;
  const headline = roundToStep(weekendShare, RIDER_INSIGHTS_HEADLINE_STEP.RHYTHM_WEEKEND_SHARE);
  if (status === LOCKED) return { status, headline, teaser: { grid: rhythmLevels(r.grid) } };
  return {
    status: READY,
    headline,
    detail: {
      grid: r.grid.map((day) => [...day]),
      rides: r.rides,
      weekendRides: r.weekend_rides,
      weekendShare,
      medianDistanceM: r.median_distance_m,
      medianMovingTimeS: r.median_moving_time_s,
      ridesWithMovingTime: r.rides_with_moving_time,
    },
  };
}

function bestRides(row: SeasonRow, ctx: SeasonContext): RiderInsightsBestRides {
  const b = row.groups.best_rides;
  const status = statusOf(ctx, false);
  if (isBare(status)) return { status };
  const headline = roundToStep(b.count, RIDER_INSIGHTS_HEADLINE_STEP.BEST_RIDES_COUNT);
  if (status === LOCKED) return { status, headline, teaser: { count: b.count } };
  return {
    status: READY,
    headline,
    detail: {
      count: b.count,
      byDistance: b.by_distance.map(bestRide),
      byClimb: b.by_climb.map(bestRide),
      byBends: b.by_bends.map(bestRide),
    },
  };
}

function costPerKm(row: SeasonRow, ctx: SeasonContext): RiderInsightsCostPerKm {
  const status = statusOf(ctx, row.cost_per_km.length === 0);
  if (status !== READY) return { status };
  return {
    status,
    items: row.cost_per_km.map((c) => ({
      currency: c.currency,
      spend: c.spend,
      expenseCount: c.expense_count,
      distanceM: c.distance_m,
      distanceSource: c.distance_source as RiderInsightsDistanceSource,
      costPerKm: c.cost_per_km,
    })),
  };
}

/** Bikes are free: ready for everyone, missing_input when no ride has a bike. */
function bikes(row: SeasonRow): RiderInsightsBikes {
  if (row.coverage.rides > 0 && row.coverage.rides_with_bike === 0)
    return { status: MISSING_INPUT };
  return {
    status: READY,
    items: row.groups.bikes.items.map((b) => ({
      motorcycleId: b.motorcycle_id,
      name: b.name,
      rides: b.rides,
      distanceM: b.distance_m,
      movingTimeS: b.moving_time_s,
    })),
  };
}

export function buildRiderInsights(row: SeasonRow, isPro: boolean): RiderInsights {
  const ctx: SeasonContext = {
    qualifyingRides: row.coverage.qualifying_rides,
    pendingRides: row.coverage.pending_rides,
    isPro,
  };
  const q = row.coverage.qualifying;
  return {
    isPro,
    season: { from: row.window.from, to: row.window.to },
    totals: {
      rides: row.totals.rides,
      distanceM: row.totals.distance_m,
      countries: row.totals.countries,
    },
    coverage: {
      rides: row.coverage.rides,
      qualifyingRides: row.coverage.qualifying_rides,
      pendingRides: row.coverage.pending_rides,
      ridesWithBike: row.coverage.rides_with_bike,
      qualifying: {
        withStats: q.with_stats,
        withRoute: q.with_route,
        withWaypoints: q.with_waypoints,
        withBands: q.with_bands,
        withLean: q.with_lean,
        withMovingTime: q.with_moving_time,
      },
    },
    latestRide: row.latest_ride
      ? {
          rideId: row.latest_ride.ride_id,
          localDate: row.latest_ride.local_date,
          distanceM: row.latest_ride.distance_m,
          newCountries: [...row.latest_ride.new_countries],
        }
      : null,
    longestRide: row.longest_ride
      ? {
          ...rideRef(row.longest_ride),
          distanceM: row.longest_ride.distance_m,
          movingTimeS: row.longest_ride.moving_time_s,
          durationS: row.longest_ride.duration_s,
          startPlace: row.longest_ride.start_place,
          endPlace: row.longest_ride.end_place,
        }
      : null,
    ribbon: row.ribbon.map((w) => ({
      weekStart: w.week_start,
      rides: w.rides,
      distanceM: w.distance_m,
    })),
    regions: row.regions.map((r) => ({
      key: r.key,
      isoA2: r.iso_a2,
      name: r.name,
      rides: r.rides,
      distanceM: r.distance_m,
      bounds: r.bounds ? [...r.bounds] : null,
      routes: [...r.routes],
    })),
    countries: row.groups.countries.items.map((c) => ({
      isoA2: c.iso_a2,
      name: c.name,
      firstDate: c.first_date,
      firstRideId: c.first_ride_id,
      rides: c.rides,
      distanceM: c.distance_m,
    })),
    bikes: bikes(row),
    territory: territory(row, ctx),
    roadCharacter: roadCharacter(row, ctx),
    rhythm: rhythm(row, ctx),
    bestRides: bestRides(row, ctx),
    costPerKm: costPerKm(row, ctx),
  };
}
