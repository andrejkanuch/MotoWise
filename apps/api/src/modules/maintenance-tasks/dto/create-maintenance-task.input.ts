import { Field, Float, InputType, Int } from '@nestjs/graphql';
import {
  GqlMaintenancePriority,
  GqlMaintenanceTaskStatus,
} from '../../../common/enums/graphql-enums';

@InputType()
export class CreateMaintenanceTaskInput {
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

  @Field(() => GqlMaintenancePriority, { nullable: true, defaultValue: 'medium' })
  priority?: string;

  @Field({ nullable: true })
  notes?: string;

  @Field(() => [String], { nullable: true })
  partsNeeded?: string[];

  @Field({ nullable: true, defaultValue: false })
  isRecurring?: boolean;

  @Field(() => Int, { nullable: true })
  intervalKm?: number;

  @Field(() => Int, { nullable: true })
  intervalDays?: number;

  // MOT-139 multi-stage reminder flags
  @Field({ nullable: true })
  remind30d?: boolean;

  @Field({ nullable: true })
  remind7d?: boolean;

  @Field({ nullable: true })
  remind1d?: boolean;

  // Create-as-completed: log work already done in a single call. When status
  // is 'completed', completedAt/completedMileage record when/at-what-odometer.
  @Field(() => GqlMaintenanceTaskStatus, { nullable: true })
  status?: string;

  @Field({ nullable: true })
  completedAt?: string;

  @Field(() => Int, { nullable: true })
  completedMileage?: number;

  // Cost of already-done work. When status is 'completed' and the total is > 0,
  // create() fires the auto-expense (R4 gap, U3) — mirroring complete().
  @Field(() => Float, { nullable: true })
  cost?: number;

  @Field(() => Float, { nullable: true })
  partsCost?: number;

  @Field(() => Float, { nullable: true })
  laborCost?: number;

  @Field({ nullable: true })
  currency?: string;
}
