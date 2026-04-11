import { Field, InputType, Int } from '@nestjs/graphql';
import { GqlMaintenancePriority } from '../../../common/enums/graphql-enums';

@InputType()
export class UpdateMaintenanceTaskInput {
  @Field({ nullable: true })
  title?: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  dueDate?: string;

  @Field(() => Int, { nullable: true })
  targetMileage?: number;

  @Field(() => GqlMaintenancePriority, { nullable: true })
  priority?: string;

  @Field({ nullable: true })
  notes?: string;

  @Field(() => [String], { nullable: true })
  partsNeeded?: string[];

  // MOT-139 multi-stage reminder flags
  @Field({ nullable: true })
  remind30d?: boolean;

  @Field({ nullable: true })
  remind7d?: boolean;

  @Field({ nullable: true })
  remind1d?: boolean;
}
