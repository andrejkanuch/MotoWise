import { Field, Float, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class Expense {
  @Field(() => ID)
  id: string;

  @Field()
  motorcycleId: string;

  @Field(() => Float)
  amount: number;

  @Field()
  category: string;

  @Field()
  date: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  maintenanceTaskId?: string;

  @Field()
  createdAt: string;
}
