import { RIDER_INSIGHTS_STATUS, type RiderInsightsStatus } from '@motovault/types';
import { Field, Float, Int, ObjectType } from '@nestjs/graphql';
import {
  RiderInsightsBestRides,
  RiderInsightsCostPerKm,
  RiderInsightsRhythm,
  RiderInsightsRideRef,
  RiderInsightsRoadCharacter,
  RiderInsightsTerritory,
} from './rider-insights-groups.model';

@ObjectType()
export class RiderInsightsSeason {
  @Field({ description: 'First local date of the season shown, YYYY-MM-DD.' })
  from: string;

  @Field({ description: 'Last local date of the season shown, YYYY-MM-DD.' })
  to: string;
}

@ObjectType()
export class RiderInsightsTotals {
  @Field(() => Int)
  rides: number;

  @Field(() => Float)
  distanceM: number;

  @Field(() => Int)
  countries: number;
}

@ObjectType()
export class RiderInsightsQualifyingCoverage {
  @Field(() => Int)
  withStats: number;

  @Field(() => Int)
  withRoute: number;

  @Field(() => Int)
  withWaypoints: number;

  @Field(() => Int)
  withBands: number;

  @Field(() => Int)
  withLean: number;

  @Field(() => Int)
  withMovingTime: number;
}

@ObjectType()
export class RiderInsightsCoverage {
  @Field(() => Int)
  rides: number;

  @Field(() => Int)
  qualifyingRides: number;

  @Field(() => Int, { description: 'Rides whose stats are not computed yet.' })
  pendingRides: number;

  @Field(() => Int)
  ridesWithBike: number;

  @Field(() => RiderInsightsQualifyingCoverage, {
    description: 'Counts over the qualifying rides, for "from N of M rides".',
  })
  qualifying: RiderInsightsQualifyingCoverage;
}

@ObjectType()
export class RiderInsightsLatestRide {
  @Field()
  rideId: string;

  @Field()
  localDate: string;

  @Field(() => Float)
  distanceM: number;

  @Field(() => [String], { description: 'ISO codes this ride added to the season.' })
  newCountries: string[];
}

@ObjectType()
export class RiderInsightsLongestRide extends RiderInsightsRideRef {
  @Field(() => Float)
  distanceM: number;

  @Field(() => Float, { nullable: true })
  movingTimeS: number | null;

  @Field(() => Float)
  durationS: number;

  @Field(() => String, { nullable: true })
  startPlace: string | null;

  @Field(() => String, { nullable: true })
  endPlace: string | null;
}

@ObjectType()
export class RiderInsightsWeek {
  @Field({ description: 'Monday of the week, YYYY-MM-DD.' })
  weekStart: string;

  @Field(() => Int)
  rides: number;

  @Field(() => Float)
  distanceM: number;
}

@ObjectType()
export class RiderInsightsRegion {
  @Field({ description: '<iso_a2>.<admin1_code>' })
  key: string;

  @Field()
  isoA2: string;

  @Field(() => String, { nullable: true })
  name: string | null;

  @Field(() => Int)
  rides: number;

  @Field(() => Float)
  distanceM: number;

  @Field(() => [Float], { nullable: true, description: '[west, south, east, north]' })
  bounds: number[] | null;

  @Field(() => [String], { description: 'Encoded polylines (precision 5), oldest ride first.' })
  routes: string[];
}

@ObjectType()
export class RiderInsightsCountry {
  @Field()
  isoA2: string;

  @Field(() => String, { nullable: true })
  name: string | null;

  @Field()
  firstDate: string;

  @Field()
  firstRideId: string;

  @Field(() => Int)
  rides: number;

  @Field(() => Float)
  distanceM: number;
}

@ObjectType()
export class RiderInsightsBike {
  @Field(() => String, { nullable: true, description: 'Null is Unassigned: rides without a bike.' })
  motorcycleId: string | null;

  @Field(() => String, { nullable: true })
  name: string | null;

  @Field(() => Int)
  rides: number;

  @Field(() => Float)
  distanceM: number;

  @Field(() => Float)
  movingTimeS: number;
}

@ObjectType()
export class RiderInsightsBikes {
  @Field(() => RIDER_INSIGHTS_STATUS, {
    description: 'READY or MISSING_INPUT (no ride has a bike).',
  })
  status: RiderInsightsStatus;

  @Field(() => [RiderInsightsBike], { nullable: true })
  items?: RiderInsightsBike[];
}

@ObjectType({ description: 'One season of a rider’s insights, gated by their real tier.' })
export class RiderInsights {
  @Field()
  isPro: boolean;

  @Field(() => RiderInsightsSeason)
  season: RiderInsightsSeason;

  @Field(() => RiderInsightsTotals)
  totals: RiderInsightsTotals;

  @Field(() => RiderInsightsCoverage)
  coverage: RiderInsightsCoverage;

  @Field(() => RiderInsightsLatestRide, { nullable: true })
  latestRide: RiderInsightsLatestRide | null;

  @Field(() => RiderInsightsLongestRide, { nullable: true })
  longestRide: RiderInsightsLongestRide | null;

  @Field(() => [RiderInsightsWeek])
  ribbon: RiderInsightsWeek[];

  @Field(() => [RiderInsightsRegion], {
    description: 'Most distance first: the first is the main map, the rest the region tiles.',
  })
  regions: RiderInsightsRegion[];

  @Field(() => [RiderInsightsCountry])
  countries: RiderInsightsCountry[];

  @Field(() => RiderInsightsBikes)
  bikes: RiderInsightsBikes;

  @Field(() => RiderInsightsTerritory)
  territory: RiderInsightsTerritory;

  @Field(() => RiderInsightsRoadCharacter)
  roadCharacter: RiderInsightsRoadCharacter;

  @Field(() => RiderInsightsRhythm)
  rhythm: RiderInsightsRhythm;

  @Field(() => RiderInsightsBestRides)
  bestRides: RiderInsightsBestRides;

  @Field(() => RiderInsightsCostPerKm)
  costPerKm: RiderInsightsCostPerKm;
}
