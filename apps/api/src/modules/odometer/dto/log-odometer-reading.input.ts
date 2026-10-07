import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class LogOdometerReadingInput {
  @Field()
  motorcycleId: string;

  // Raw value in the bike's distance unit.
  @Field(() => Int)
  value: number;

  // ISO datetime. Omitted = now; an earlier date back-dates the reading.
  @Field({ nullable: true })
  recordedAt?: string;
}
