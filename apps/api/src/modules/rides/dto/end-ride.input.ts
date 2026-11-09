import { Field, Float, InputType, Int } from '@nestjs/graphql';

@InputType()
export class EndRideInput {
  @Field()
  rideId: string;

  @Field()
  endedAt: string;

  // Defaulted (not Float!) so abandoned-ride recovery and the forgot-to-stop
  // auto-end path — which legitimately have no computed distance — can omit it
  // without tripping BAD_USER_INPUT. (Sentry MOTO-VAULT-REACT-NATIVE-1J)
  @Field(() => Float, { defaultValue: 0 })
  distanceM?: number;

  @Field(() => Float, { nullable: true })
  maxSpeedMps?: number;

  @Field(() => Float, { nullable: true })
  avgSpeedMps?: number;

  @Field(() => Float, { nullable: true })
  elevationGain?: number;

  @Field(() => Float, { nullable: true })
  elevationLoss?: number;

  @Field({ nullable: true })
  routePolyline?: string;

  @Field(() => Float, { nullable: true })
  gpsQuality?: number;

  @Field(() => Int, { defaultValue: 0 })
  pausedDurationS: number;

  @Field(() => Int, { defaultValue: 0 })
  autoPausedDurationS: number;

  @Field(() => Float, { nullable: true })
  maxLeanAngle?: number;

  // String rather than an enum, so a value this server does not know (sent by a
  // newer app) never fails GraphQL validation; the Zod schema turns it into null.
  /** How the ride ended: rider_phone, rider_carplay, client_auto or new_ride_save. */
  @Field(() => String, { nullable: true })
  endSource?: string | null;

  /** leisure, commute, tour, errand, track, offroad or other. */
  @Field(() => String, { nullable: true })
  purpose?: string | null;

  @Field(() => Boolean, { nullable: true })
  passenger?: boolean | null;

  /** Odometer reading at the end, in the bike's distance unit. Replaces the GPS-distance mileage update. */
  @Field(() => Float, { nullable: true })
  odometerAtEnd?: number | null;
}
