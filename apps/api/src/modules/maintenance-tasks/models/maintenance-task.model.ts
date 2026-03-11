import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import {
  GqlMaintenancePriority,
  GqlMaintenanceTaskSource,
  GqlMaintenanceTaskStatus,
} from '../../../common/enums/graphql-enums';
import { TaskPhoto } from './task-photo.model';

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

  @Field(() => GqlMaintenanceTaskSource)
  source: string;

  @Field({ nullable: true })
  oemScheduleId?: string;

  @Field(() => Int, { nullable: true })
  intervalKm?: number;

  @Field(() => Int, { nullable: true })
  intervalDays?: number;

  @Field()
  isRecurring: boolean;

  @Field(() => [TaskPhoto])
  photos: TaskPhoto[];

  @Field(() => Float, { nullable: true })
  cost?: number;

  @Field(() => Float, { nullable: true })
  partsCost?: number;

  @Field(() => Float, { nullable: true })
  laborCost?: number;

  @Field({ nullable: true })
  currency?: string;

  @Field()
  createdAt: string;

  @Field()
  updatedAt: string;
}
