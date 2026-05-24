import { Field, Float, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class RideRecord {
  @Field()
  recordType: string;

  @Field(() => Float)
  value: number;

  @Field()
  unit: string;

  @Field()
  achievedAt: string;

  @Field(() => Float, { nullable: true })
  previousValue?: number;

  @Field({ nullable: true })
  rideId?: string;
}
