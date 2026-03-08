import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { GqlMaintenancePriority } from '../../../common/enums/graphql-enums';

@ObjectType()
export class OemSchedule {
  @Field(() => ID)
  id: string;

  @Field()
  make: string;

  @Field({ nullable: true })
  model?: string;

  @Field(() => Int, { nullable: true })
  yearFrom?: number;

  @Field(() => Int, { nullable: true })
  yearTo?: number;

  @Field()
  taskName: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => Int, { nullable: true })
  intervalKm?: number;

  @Field(() => Int, { nullable: true })
  intervalDays?: number;

  @Field(() => GqlMaintenancePriority)
  priority: string;

  @Field({ nullable: true })
  engineType?: string;

  @Field(() => Int, { nullable: true })
  engineCcMin?: number;

  @Field(() => Int, { nullable: true })
  engineCcMax?: number;

  @Field(() => Int)
  sortOrder: number;

  @Field()
  createdAt: string;
}
