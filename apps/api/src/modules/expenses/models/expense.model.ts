import { Field, Float, ID, ObjectType } from '@nestjs/graphql';
import { ExpensePhoto } from './expense-photo.model';

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

  @Field()
  currency: string;

  @Field({ nullable: true })
  maintenanceTaskId?: string;

  @Field()
  createdAt: string;

  // Resolved in ExpensesResolver.photos (MOT-143)
  @Field(() => [ExpensePhoto], { nullable: true })
  photos?: ExpensePhoto[];
}
