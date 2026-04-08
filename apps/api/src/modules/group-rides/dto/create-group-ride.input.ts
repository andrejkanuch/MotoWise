import { Field, Float, InputType, Int } from '@nestjs/graphql';

@InputType()
export class CreateGroupRideInput {
  @Field()
  title: string;

  @Field()
  description: string;

  @Field()
  dateTime: string;

  @Field(() => Float)
  meetingPointLat: number;

  @Field(() => Float)
  meetingPointLng: number;

  @Field({ nullable: true })
  meetingPointName?: string;

  @Field({ nullable: true })
  routeId?: string;

  @Field({ nullable: true })
  routeDescription?: string;

  @Field()
  difficulty: string;

  @Field(() => Int)
  maxRiders: number;
}
