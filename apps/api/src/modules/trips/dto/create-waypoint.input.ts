import { Field, Float, ID, InputType, Int } from '@nestjs/graphql';

@InputType()
export class CreateWaypointInput {
  @Field(() => ID)
  tripId: string;

  @Field()
  type: string;

  @Field()
  name: string;

  @Field(() => Float)
  lat: number;

  @Field(() => Float)
  lng: number;

  @Field({ nullable: true })
  notes?: string;

  @Field(() => Int)
  sortOrder: number;
}
