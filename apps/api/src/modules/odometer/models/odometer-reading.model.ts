import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class OdometerReading {
  @Field(() => ID)
  id: string;

  // Raw value in the bike's distance unit.
  @Field(() => Int)
  value: number;

  @Field()
  recordedAt: string;

  // 'manual' | 'gps_ride' | 'initial' | 'backfill' (OdometerReadingSource).
  @Field()
  source: string;

  @Field({ nullable: true })
  rideId?: string;
}
