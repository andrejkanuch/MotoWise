import { Field, Float, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class Waypoint {
  @Field()
  recordedAt: string;

  @Field(() => Float)
  latitude: number;

  @Field(() => Float)
  longitude: number;

  @Field(() => Float, { nullable: true })
  altitude?: number;

  @Field(() => Float, { nullable: true })
  speedMps?: number;

  @Field(() => Float, { nullable: true })
  accuracy?: number;
}
