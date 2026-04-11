import { Field, Float, ID, InputType, Int } from '@nestjs/graphql';

@InputType()
export class UpdateGroupRideInput {
  @Field(() => ID)
  groupRideId: string;

  @Field({ nullable: true })
  title?: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  dateTime?: string;

  @Field(() => Float, { nullable: true })
  meetingPointLat?: number;

  @Field(() => Float, { nullable: true })
  meetingPointLng?: number;

  @Field({ nullable: true })
  meetingPointName?: string;

  @Field(() => Int, { nullable: true })
  maxRiders?: number;
}
