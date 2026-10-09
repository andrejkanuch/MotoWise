import { Field, Int, ObjectType } from '@nestjs/graphql';

/** Single NHTSA recall campaign (MOT-142). */
@ObjectType()
export class Recall {
  @Field()
  campaignNumber: string;

  @Field()
  reportDate: string;

  @Field()
  component: string;

  @Field()
  summary: string;

  @Field()
  consequence: string;

  @Field()
  remedy: string;

  /** The rider marked this campaign as done for this bike (00189). */
  @Field()
  acknowledged: boolean;

  /** When the rider marked it as done; null while the recall is open. */
  @Field(() => String, { nullable: true })
  acknowledgedAt?: string | null;
}

@ObjectType()
export class RecallResult {
  /** Open recalls: returned by NHTSA and not marked as done by the rider. */
  @Field(() => Int)
  count: number;

  /** Recalls the rider marked as done. `count + acknowledgedCount = recalls.length`. */
  @Field(() => Int)
  acknowledgedCount: number;

  /** Open recalls first, then acknowledged ones (most recently marked first). */
  @Field(() => [Recall])
  recalls: Recall[];

  @Field()
  checkedAt: string;

  @Field({ nullable: true })
  vinUsed?: string;
}
