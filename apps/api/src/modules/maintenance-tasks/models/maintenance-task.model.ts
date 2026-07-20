import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import {
  GqlMaintenancePriority,
  GqlMaintenanceTaskSource,
  GqlMaintenanceTaskStatus,
} from '../../../common/enums/graphql-enums';
import { MaintenanceTaskLineItem } from './task-line-item.model';
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

  /** Resolved on demand in MaintenanceTasksResolver.photos (request-scoped loader). */
  @Field(() => [TaskPhoto])
  photos?: TaskPhoto[];

  /** Structured service line items — resolved on demand via the loader. */
  @Field(() => [MaintenanceTaskLineItem])
  lineItems?: MaintenanceTaskLineItem[];

  @Field(() => Float, { nullable: true })
  cost?: number;

  @Field(() => Float, { nullable: true })
  partsCost?: number;

  @Field(() => Float, { nullable: true })
  laborCost?: number;

  /** Authoritative gross paid for the visit. Falls back to cost+parts+labor when null. */
  @Field(() => Float, { nullable: true })
  totalAmount?: number;

  /** Explicit tax/VAT on the visit; NULL when the receipt printed none. */
  @Field(() => Float, { nullable: true })
  taxAmount?: number;

  /** Printed tax rate as a percentage (e.g. 21). */
  @Field(() => Float, { nullable: true })
  taxRate?: number;

  @Field({ nullable: true })
  currency?: string;

  // MOT-139: multi-stage reminders
  @Field()
  remind30d: boolean;

  @Field()
  remind7d: boolean;

  @Field()
  remind1d: boolean;

  @Field()
  createdAt: string;

  @Field()
  updatedAt: string;
}
