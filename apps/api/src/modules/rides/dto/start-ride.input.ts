import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class StartRideInput {
  @Field()
  rideId: string;

  @Field({ nullable: true })
  motorcycleId?: string;

  @Field()
  startedAt: string;

  /** The device's IANA time zone at ride start. A non-IANA value is stored as null. */
  @Field(() => String, { nullable: true })
  timeZone?: string | null;
}
