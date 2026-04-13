import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class SurfaceReport {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  routeId: string;

  @Field(() => ID)
  userId: string;

  @Field()
  reportedAt: string;

  @Field()
  condition: string;

  @Field({ nullable: true })
  note?: string;

  @Field({ nullable: true })
  photoUrl?: string;
}

@ObjectType()
export class ConditionAggregate {
  @Field()
  condition: string;

  @Field(() => Int)
  count: number;
}

@ObjectType()
export class RouteConditions {
  @Field(() => [SurfaceReport])
  recentReports: SurfaceReport[];

  @Field(() => [ConditionAggregate])
  aggregates: ConditionAggregate[];
}
