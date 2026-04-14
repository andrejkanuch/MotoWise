import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Current quota usage for a gated feature' })
export class QuotaStatus {
  @Field(() => String, { description: 'Feature identifier (e.g. gpx_export)' })
  feature!: string;

  @Field(() => Int, { description: 'Monthly limit (-1 = unlimited)' })
  limit!: number;

  @Field(() => Int, { description: 'Number of uses this month' })
  used!: number;

  @Field(() => Int, {
    description: 'Remaining uses this month (-1 = unlimited)',
  })
  remaining!: number;

  @Field(() => String, { description: 'ISO date when quota resets (1st of next month)' })
  resetDate!: string;

  @Field(() => Boolean, { description: 'True when remaining = 0 (and limit is not unlimited)' })
  isExhausted!: boolean;
}
