import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import {
  GqlMaintenancePriority,
  GqlMaintenanceTaskStatus,
} from '../../../common/enums/graphql-enums';

@ObjectType()
export class MaintenanceTask {
  @Field(() => ID)
  id: string;

  @Field()
  userId: string;

  @Field()
  motorcycleId: string;

  @Field()
  title: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  dueDate?: string;

  @Field(() => Int, { nullable: true })
  targetMileage?: number;

  @Field(() => GqlMaintenancePriority)
  priority: string;

  @Field(() => GqlMaintenanceTaskStatus)
  status: string;

  @Field({ nullable: true })
  notes?: string;

  @Field(() => [String], { nullable: true })
  partsNeeded?: string[];

  @Field({ nullable: true })
  completedAt?: string;

  @Field(() => Int, { nullable: true })
  completedMileage?: number;

  @Field()
  createdAt: string;

  @Field()
  updatedAt: string;
}
