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
}

@ObjectType()
export class RecallResult {
  @Field(() => Int)
  count: number;

  @Field(() => [Recall])
  recalls: Recall[];

  @Field()
  checkedAt: string;

  @Field({ nullable: true })
  vinUsed?: string;
}
