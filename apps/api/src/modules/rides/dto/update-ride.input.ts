import { Field, Float, InputType } from '@nestjs/graphql';

@InputType()
export class UpdateRideInput {
  @Field()
  rideId: string;

  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  mileageApplied?: boolean;

  @Field({ nullable: true })
  isPublic?: boolean;

  /** leisure, commute, tour, errand, track, offroad or other; null clears it. */
  @Field(() => String, { nullable: true })
  purpose?: string | null;

  /** Whether a passenger rode along; null clears it. */
  @Field(() => Boolean, { nullable: true })
  passenger?: boolean | null;

  /** Odometer read after the ride, in the bike's own unit; logged as the ride's end reading. */
  @Field(() => Float, { nullable: true })
  odometerAtEnd?: number | null;
}
