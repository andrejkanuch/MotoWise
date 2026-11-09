import { z } from 'zod';

/**
 * The `riderInsights` contract: what the API may return for one season.
 *
 * Every object is strict, and the API returns the PARSED result, so a key that
 * is not listed here can never reach a client. That is what keeps Pro detail
 * off a free response: a locked group is a status, one rounded headline and
 * its teaser, and nothing else.
 */

/** A group's state. Precedence: not_enough, then computing, then missing_input, then locked. */
export const RIDER_INSIGHTS_STATUS = {
  READY: 'ready',
  COMPUTING: 'computing',
  NOT_ENOUGH: 'not_enough',
  MISSING_INPUT: 'missing_input',
  LOCKED: 'locked',
} as const;
export type RiderInsightsStatus =
  (typeof RIDER_INSIGHTS_STATUS)[keyof typeof RIDER_INSIGHTS_STATUS];

/** Detail groups the season read computes, by their RPC names. */
export const RIDER_INSIGHTS_GROUP = {
  TERRITORY: 'territory',
  ROAD_CHARACTER: 'road_character',
  RHYTHM: 'rhythm',
  BEST_RIDES: 'best_rides',
  BIKES: 'bikes',
  COUNTRIES: 'countries',
} as const;
export type RiderInsightsGroup = (typeof RIDER_INSIGHTS_GROUP)[keyof typeof RIDER_INSIGHTS_GROUP];

/** Qualifying rides a season needs before its Pro groups show (and before a new year's season replaces the previous one). */
export const RIDER_INSIGHTS_MIN_QUALIFYING_RIDES = 5;

/**
 * What each locked headline is, and the step it is rounded to. A headline is
 * the one number a locked row may carry (the paywall copy is built from it).
 */
export const RIDER_INSIGHTS_HEADLINE_STEP = {
  /** Explored area, km², to the nearest 10. */
  TERRITORY_EXPLORED_KM2: 10,
  /** Bends per 10 km, to the nearest whole bend. */
  ROAD_CHARACTER_BENDS_PER_10KM: 1,
  /** Weekend share of rides (0-1), to the nearest 10%. */
  RHYTHM_WEEKEND_SHARE: 0.1,
  /** Qualifying rides ranked (a count). */
  BEST_RIDES_COUNT: 1,
} as const;

/** Road-character band shares in a teaser are rounded to this step (10%). */
export const RIDER_INSIGHTS_TEASER_SHARE_STEP = 0.1;
/** The rhythm teaser grid: 7 days (Monday first) by 4 day parts, each 0 (no rides) to 3 (busiest quartile). */
export const RIDER_INSIGHTS_RHYTHM_GRID = { DAYS: 7, PARTS: 4, MAX_LEVEL: 3 } as const;

/** Rounds to a multiple of `step`, cleaning float noise (0.30000000000000004 -> 0.3). */
export function roundToStep(value: number, step: number): number {
  return Number((Math.round(value / step) * step).toFixed(6));
}

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

const isoDate = z.iso.date();
const count = z.number().int().nonnegative();
const metres = z.number().nonnegative();
const share = z.number().min(0).max(1);

const statusOnly = <S extends RiderInsightsStatus>(status: S) =>
  z.strictObject({ status: z.literal(status) });

const notEnough = statusOnly(RIDER_INSIGHTS_STATUS.NOT_ENOUGH);
const computing = statusOnly(RIDER_INSIGHTS_STATUS.COMPUTING);
const missingInput = statusOnly(RIDER_INSIGHTS_STATUS.MISSING_INPUT);

const RideRefSchema = z.strictObject({
  rideId: z.uuid(),
  name: z.string().nullable(),
  localDate: isoDate,
});

const BandsSchema = z.strictObject({
  straight: z.number().nonnegative(),
  sweeping: z.number().nonnegative(),
  twisty: z.number().nonnegative(),
  tight: z.number().nonnegative(),
});

// ---------------------------------------------------------------------------
// Pro groups: ready and locked shapes
// ---------------------------------------------------------------------------

export const RiderInsightsTerritoryDetailSchema = z.strictObject({
  exploredCells: count,
  exploredKm2: z.number().nonnegative(),
  routedM: metres,
  newRoadM: metres,
  newRoadShare: share.nullable(),
  furthest: z
    .strictObject({
      rideId: z.uuid(),
      localDate: isoDate,
      distanceM: metres,
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .nullable(),
});

export const RiderInsightsTerritorySchema = z.discriminatedUnion('status', [
  notEnough,
  computing,
  missingInput,
  z.strictObject({ status: z.literal(RIDER_INSIGHTS_STATUS.LOCKED), headline: z.number() }),
  z.strictObject({
    status: z.literal(RIDER_INSIGHTS_STATUS.READY),
    headline: z.number(),
    detail: RiderInsightsTerritoryDetailSchema,
  }),
]);

const RankedBendsRideSchema = RideRefSchema.extend({
  distanceM: metres,
  bendsPer10km: z.number().nonnegative().nullable(),
});

export const RiderInsightsRoadCharacterDetailSchema = z.strictObject({
  bandKm: BandsSchema,
  routedKm: z.number().nonnegative(),
  bendsCount: count,
  bendsPer10km: z.number().nonnegative().nullable(),
  ridesWithBands: count,
  ridesWithLean: count,
  twistiest: z.array(RankedBendsRideSchema),
  straightest: z.array(RankedBendsRideSchema),
  /** Share of corners per estimated lean band. Never a single degree value. */
  lean: z
    .strictObject({
      corners: count,
      under20: share,
      from20to30: share,
      from30to40: share,
      from40: share,
    })
    .nullable(),
});

export const RiderInsightsRoadCharacterSchema = z.discriminatedUnion('status', [
  notEnough,
  computing,
  missingInput,
  z.strictObject({
    status: z.literal(RIDER_INSIGHTS_STATUS.LOCKED),
    headline: z.number(),
    /** Band shares of routed distance, each rounded to 10%. */
    teaser: z.strictObject({ bandShares: BandsSchema }),
  }),
  z.strictObject({
    status: z.literal(RIDER_INSIGHTS_STATUS.READY),
    headline: z.number(),
    detail: RiderInsightsRoadCharacterDetailSchema,
  }),
]);

const gridOf = <T extends z.ZodType>(cell: T) =>
  z
    .array(z.array(cell).length(RIDER_INSIGHTS_RHYTHM_GRID.PARTS))
    .length(RIDER_INSIGHTS_RHYTHM_GRID.DAYS);

export const RiderInsightsRhythmDetailSchema = z.strictObject({
  /** Ride counts: rows Monday..Sunday, columns morning, afternoon, evening, night. */
  grid: gridOf(count),
  rides: count,
  weekendRides: count,
  weekendShare: share.nullable(),
  medianDistanceM: metres.nullable(),
  medianMovingTimeS: z.number().nonnegative().nullable(),
  ridesWithMovingTime: count,
});

export const RiderInsightsRhythmSchema = z.discriminatedUnion('status', [
  notEnough,
  computing,
  missingInput,
  z.strictObject({
    status: z.literal(RIDER_INSIGHTS_STATUS.LOCKED),
    headline: z.number(),
    /** The same grid as levels 0 (no rides) to 3 (the rider's busiest quartile). */
    teaser: z.strictObject({
      grid: gridOf(z.number().int().min(0).max(RIDER_INSIGHTS_RHYTHM_GRID.MAX_LEVEL)),
    }),
  }),
  z.strictObject({
    status: z.literal(RIDER_INSIGHTS_STATUS.READY),
    headline: z.number(),
    detail: RiderInsightsRhythmDetailSchema,
  }),
]);

const BestRideSchema = RideRefSchema.extend({
  distanceM: metres,
  climbM: z.number().nullable(),
  bendsPer10km: z.number().nonnegative().nullable(),
  movingTimeS: z.number().nonnegative().nullable(),
});

export const RiderInsightsBestRidesDetailSchema = z.strictObject({
  count,
  byDistance: z.array(BestRideSchema),
  byClimb: z.array(BestRideSchema),
  byBends: z.array(BestRideSchema),
});

export const RiderInsightsBestRidesSchema = z.discriminatedUnion('status', [
  notEnough,
  computing,
  missingInput,
  z.strictObject({
    status: z.literal(RIDER_INSIGHTS_STATUS.LOCKED),
    headline: z.number(),
    teaser: z.strictObject({ count }),
  }),
  z.strictObject({
    status: z.literal(RIDER_INSIGHTS_STATUS.READY),
    headline: z.number(),
    detail: RiderInsightsBestRidesDetailSchema,
  }),
]);

/** Which distance a cost-per-km row divides by. */
export const RIDER_INSIGHTS_DISTANCE_SOURCE = {
  ODOMETER: 'odometer',
  TRACKED: 'tracked',
  MIXED: 'mixed',
} as const;
export type RiderInsightsDistanceSource =
  (typeof RIDER_INSIGHTS_DISTANCE_SOURCE)[keyof typeof RIDER_INSIGHTS_DISTANCE_SOURCE];

/** Cost per km is a Pro recap card: a locked card is its title only, so it carries no number. */
export const RiderInsightsCostPerKmItemSchema = z.strictObject({
  currency: z.string().length(3),
  spend: z.number().nonnegative(),
  expenseCount: count,
  distanceM: metres,
  distanceSource: z.enum(RIDER_INSIGHTS_DISTANCE_SOURCE),
  costPerKm: z.number().nonnegative().nullable(),
});

export const RiderInsightsCostPerKmSchema = z.discriminatedUnion('status', [
  notEnough,
  computing,
  missingInput,
  statusOnly(RIDER_INSIGHTS_STATUS.LOCKED),
  z.strictObject({
    status: z.literal(RIDER_INSIGHTS_STATUS.READY),
    items: z.array(RiderInsightsCostPerKmItemSchema).min(1),
  }),
]);

// ---------------------------------------------------------------------------
// Free blocks
// ---------------------------------------------------------------------------

export const RiderInsightsBikesSchema = z.discriminatedUnion('status', [
  missingInput,
  z.strictObject({
    status: z.literal(RIDER_INSIGHTS_STATUS.READY),
    items: z.array(
      z.strictObject({
        /** Null is "Unassigned": rides without a bike. */
        motorcycleId: z.uuid().nullable(),
        name: z.string().nullable(),
        rides: count,
        distanceM: metres,
        movingTimeS: z.number().nonnegative(),
      }),
    ),
  }),
]);

export const RiderInsightsCountrySchema = z.strictObject({
  isoA2: z.string().length(2),
  name: z.string().nullable(),
  firstDate: isoDate,
  firstRideId: z.uuid(),
  rides: count,
  distanceM: metres,
});

export const RiderInsightsRegionSchema = z.strictObject({
  key: z.string(),
  isoA2: z.string(),
  name: z.string().nullable(),
  rides: count,
  distanceM: metres,
  /** [west, south, east, north], or null when none of its rides has a track. */
  bounds: z.array(z.number()).length(4).nullable(),
  /** Encoded polylines (precision 5), one per ride with a track, oldest first. */
  routes: z.array(z.string()),
});

export const RiderInsightsSchema = z.strictObject({
  /** Whether the rider's real tier is Pro (the groups are already gated by it). */
  isPro: z.boolean(),
  season: z.strictObject({ from: isoDate, to: isoDate }),
  totals: z.strictObject({ rides: count, distanceM: metres, countries: count }),
  coverage: z.strictObject({
    rides: count,
    qualifyingRides: count,
    pendingRides: count,
    ridesWithBike: count,
    qualifying: z.strictObject({
      withStats: count,
      withRoute: count,
      withWaypoints: count,
      withBands: count,
      withLean: count,
      withMovingTime: count,
    }),
  }),
  latestRide: z
    .strictObject({
      rideId: z.uuid(),
      localDate: isoDate,
      distanceM: metres,
      newCountries: z.array(z.string().length(2)),
    })
    .nullable(),
  longestRide: RideRefSchema.extend({
    distanceM: metres,
    movingTimeS: z.number().nonnegative().nullable(),
    durationS: z.number().nonnegative(),
    startPlace: z.string().nullable(),
    endPlace: z.string().nullable(),
  }).nullable(),
  ribbon: z.array(z.strictObject({ weekStart: isoDate, rides: count, distanceM: metres })),
  /** Most distance first: element 0 is the main map, the rest are the region tiles (at most 3). */
  regions: z.array(RiderInsightsRegionSchema).max(4),
  countries: z.array(RiderInsightsCountrySchema),
  bikes: RiderInsightsBikesSchema,
  territory: RiderInsightsTerritorySchema,
  roadCharacter: RiderInsightsRoadCharacterSchema,
  rhythm: RiderInsightsRhythmSchema,
  bestRides: RiderInsightsBestRidesSchema,
  costPerKm: RiderInsightsCostPerKmSchema,
});
export type RiderInsights = z.infer<typeof RiderInsightsSchema>;
export type RiderInsightsTerritory = z.infer<typeof RiderInsightsTerritorySchema>;
export type RiderInsightsRoadCharacter = z.infer<typeof RiderInsightsRoadCharacterSchema>;
export type RiderInsightsRhythm = z.infer<typeof RiderInsightsRhythmSchema>;
export type RiderInsightsBestRides = z.infer<typeof RiderInsightsBestRidesSchema>;
export type RiderInsightsCostPerKm = z.infer<typeof RiderInsightsCostPerKmSchema>;
export type RiderInsightsBikes = z.infer<typeof RiderInsightsBikesSchema>;

/** `riderInsights` arguments: an explicit window needs both dates, from on or before to. */
export const RiderInsightsWindowSchema = z
  .strictObject({ from: isoDate, to: isoDate })
  .refine((window) => window.from <= window.to, { message: 'from must be on or before to' });
export type RiderInsightsWindow = z.infer<typeof RiderInsightsWindowSchema>;
