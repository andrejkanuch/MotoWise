import { Field, InputType } from '@nestjs/graphql';

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
}
