import { Field, Float, InputType, Int } from '@nestjs/graphql';

@InputType()
export class CompleteMaintenanceTaskInput {
  @Field(() => Int, { nullable: true })
  completedMileage?: number;

  @Field(() => Float, { nullable: true })
  cost?: number;

  @Field(() => Float, { nullable: true })
  partsCost?: number;

  @Field(() => Float, { nullable: true })
  laborCost?: number;

  @Field({ nullable: true })
  currency?: string;
}
