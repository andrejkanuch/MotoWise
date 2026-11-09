import { RIDER_INSIGHTS_STATUS, type RiderInsightsStatus } from '@motovault/types';
import { Field, Float, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

/**
 * The Pro insight groups. Each has a status; `headline` and `teaser` are set
 * for a locked group, `headline` and `detail` for a ready one, and nothing else
 * for the other statuses. The service fills them only from the validated
 * contract, so a locked group never resolves a `detail`.
 */

registerEnumType(RIDER_INSIGHTS_STATUS, {
  name: 'RiderInsightsStatus',
  description:
    'A group state. Precedence: NOT_ENOUGH (under five qualifying rides), COMPUTING (a ride has no stats yet), MISSING_INPUT, LOCKED (not Pro), READY.',
});

@ObjectType()
export class RiderInsightsRideRef {
  @Field()
  rideId: string;

  @Field(() => String, { nullable: true })
  name: string | null;

  @Field({ description: 'YYYY-MM-DD in the ride’s own zone.' })
  localDate: string;
}

@ObjectType()
export class RiderInsightsBands {
  @Field(() => Float)
  straight: number;

  @Field(() => Float)
  sweeping: number;

  @Field(() => Float)
  twisty: number;

  @Field(() => Float)
  tight: number;
}

// ---- Territory ---------------------------------------------------------

@ObjectType()
export class RiderInsightsFurthestPoint {
  @Field()
  rideId: string;

  @Field()
  localDate: string;

  @Field(() => Float, { description: 'Metres from home.' })
  distanceM: number;

  @Field(() => Float)
  lat: number;

  @Field(() => Float)
  lng: number;
}

@ObjectType()
export class RiderInsightsTerritoryDetail {
  @Field(() => Int)
  exploredCells: number;

  @Field(() => Float)
  exploredKm2: number;

  @Field(() => Float)
  routedM: number;

  @Field(() => Float)
  newRoadM: number;

  @Field(() => Float, { nullable: true, description: 'New road over routed distance, 0-1.' })
  newRoadShare: number | null;

  @Field(() => RiderInsightsFurthestPoint, { nullable: true })
  furthest: RiderInsightsFurthestPoint | null;
}

@ObjectType()
export class RiderInsightsTerritory {
  @Field(() => RIDER_INSIGHTS_STATUS)
  status: RiderInsightsStatus;

  @Field(() => Float, { nullable: true, description: 'Explored km², to the nearest 10.' })
  headline?: number;

  @Field(() => RiderInsightsTerritoryDetail, { nullable: true })
  detail?: RiderInsightsTerritoryDetail;
}

// ---- Road character ----------------------------------------------------

@ObjectType()
export class RiderInsightsBendsRide extends RiderInsightsRideRef {
  @Field(() => Float)
  distanceM: number;

  @Field(() => Float, { nullable: true })
  bendsPer10km: number | null;
}

@ObjectType()
export class RiderInsightsLeanBands {
  @Field(() => Int)
  corners: number;

  @Field(() => Float, { description: 'Share of corners, 0-1. An estimate, never a single angle.' })
  under20: number;

  @Field(() => Float)
  from20to30: number;

  @Field(() => Float)
  from30to40: number;

  @Field(() => Float)
  from40: number;
}

@ObjectType()
export class RiderInsightsRoadCharacterDetail {
  @Field(() => RiderInsightsBands)
  bandKm: RiderInsightsBands;

  @Field(() => Float)
  routedKm: number;

  @Field(() => Int)
  bendsCount: number;

  @Field(() => Float, { nullable: true })
  bendsPer10km: number | null;

  @Field(() => Int)
  ridesWithBands: number;

  @Field(() => Int)
  ridesWithLean: number;

  @Field(() => [RiderInsightsBendsRide])
  twistiest: RiderInsightsBendsRide[];

  @Field(() => [RiderInsightsBendsRide])
  straightest: RiderInsightsBendsRide[];

  @Field(() => RiderInsightsLeanBands, { nullable: true })
  lean: RiderInsightsLeanBands | null;
}

@ObjectType()
export class RiderInsightsRoadCharacterTeaser {
  @Field(() => RiderInsightsBands, {
    description: 'Band shares of routed distance, to the nearest 10%.',
  })
  bandShares: RiderInsightsBands;
}

@ObjectType()
export class RiderInsightsRoadCharacter {
  @Field(() => RIDER_INSIGHTS_STATUS)
  status: RiderInsightsStatus;

  @Field(() => Float, {
    nullable: true,
    description: 'Bends per 10 km, to the nearest whole bend.',
  })
  headline?: number;

  @Field(() => RiderInsightsRoadCharacterTeaser, { nullable: true })
  teaser?: RiderInsightsRoadCharacterTeaser;

  @Field(() => RiderInsightsRoadCharacterDetail, { nullable: true })
  detail?: RiderInsightsRoadCharacterDetail;
}

// ---- Rhythm ------------------------------------------------------------

@ObjectType()
export class RiderInsightsRhythmDetail {
  @Field(() => [[Int]], {
    description:
      'Ride counts: 7 rows Monday..Sunday by 4 columns morning, afternoon, evening, night.',
  })
  grid: number[][];

  @Field(() => Int)
  rides: number;

  @Field(() => Int)
  weekendRides: number;

  @Field(() => Float, { nullable: true })
  weekendShare: number | null;

  @Field(() => Float, { nullable: true })
  medianDistanceM: number | null;

  @Field(() => Float, { nullable: true })
  medianMovingTimeS: number | null;

  @Field(() => Int)
  ridesWithMovingTime: number;
}

@ObjectType()
export class RiderInsightsRhythmTeaser {
  @Field(() => [[Int]], { description: 'The grid as levels 0 (no rides) to 3 (busiest).' })
  grid: number[][];
}

@ObjectType()
export class RiderInsightsRhythm {
  @Field(() => RIDER_INSIGHTS_STATUS)
  status: RiderInsightsStatus;

  @Field(() => Float, {
    nullable: true,
    description: 'Weekend share of rides, 0-1, to the nearest 10%.',
  })
  headline?: number;

  @Field(() => RiderInsightsRhythmTeaser, { nullable: true })
  teaser?: RiderInsightsRhythmTeaser;

  @Field(() => RiderInsightsRhythmDetail, { nullable: true })
  detail?: RiderInsightsRhythmDetail;
}

// ---- Best rides --------------------------------------------------------

@ObjectType()
export class RiderInsightsBestRide extends RiderInsightsRideRef {
  @Field(() => Float)
  distanceM: number;

  @Field(() => Float, { nullable: true, description: 'Corrected climb, metres.' })
  climbM: number | null;

  @Field(() => Float, { nullable: true })
  bendsPer10km: number | null;

  @Field(() => Float, { nullable: true })
  movingTimeS: number | null;
}

@ObjectType()
export class RiderInsightsBestRidesDetail {
  @Field(() => Int)
  count: number;

  @Field(() => [RiderInsightsBestRide])
  byDistance: RiderInsightsBestRide[];

  @Field(() => [RiderInsightsBestRide])
  byClimb: RiderInsightsBestRide[];

  @Field(() => [RiderInsightsBestRide])
  byBends: RiderInsightsBestRide[];
}

@ObjectType()
export class RiderInsightsBestRidesTeaser {
  @Field(() => Int)
  count: number;
}

@ObjectType()
export class RiderInsightsBestRides {
  @Field(() => RIDER_INSIGHTS_STATUS)
  status: RiderInsightsStatus;

  @Field(() => Float, { nullable: true, description: 'Qualifying rides ranked.' })
  headline?: number;

  @Field(() => RiderInsightsBestRidesTeaser, { nullable: true })
  teaser?: RiderInsightsBestRidesTeaser;

  @Field(() => RiderInsightsBestRidesDetail, { nullable: true })
  detail?: RiderInsightsBestRidesDetail;
}

// ---- Cost per km (Pro recap card) --------------------------------------

@ObjectType()
export class RiderInsightsCostPerKmItem {
  @Field()
  currency: string;

  @Field(() => Float)
  spend: number;

  @Field(() => Int)
  expenseCount: number;

  @Field(() => Float)
  distanceM: number;

  @Field({ description: 'odometer, tracked or mixed.' })
  distanceSource: string;

  @Field(() => Float, { nullable: true })
  costPerKm: number | null;
}

@ObjectType({ description: 'A locked card carries its status only (the client shows its title).' })
export class RiderInsightsCostPerKm {
  @Field(() => RIDER_INSIGHTS_STATUS)
  status: RiderInsightsStatus;

  @Field(() => [RiderInsightsCostPerKmItem], {
    nullable: true,
    description: 'One row per currency, most spend first.',
  })
  items?: RiderInsightsCostPerKmItem[];
}
