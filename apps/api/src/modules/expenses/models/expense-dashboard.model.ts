import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class MonthlyBucket {
  @Field(() => Int)
  month: number;

  @Field(() => Int)
  year: number;

  @Field(() => Float)
  fuel: number;

  @Field(() => Float)
  maintenance: number;

  @Field(() => Float)
  parts: number;

  @Field(() => Float)
  gear: number;

  @Field(() => Float)
  tires: number;

  @Field(() => Float)
  insurance: number;

  @Field(() => Float)
  registration: number;

  @Field(() => Float)
  tolls: number;

  @Field(() => Float)
  parking: number;

  @Field(() => Float)
  modifications: number;

  @Field(() => Float)
  training: number;

  @Field(() => Float)
  total: number;
}

@ObjectType()
export class CategoryTotal {
  @Field()
  category: string;

  @Field(() => Float)
  total: number;
}

@ObjectType()
export class ExpenseDashboardSummary {
  @Field(() => Float)
  currentYearTotal: number;

  @Field(() => Float)
  previousYearTotal: number;

  @Field(() => Float)
  allTimeTotal: number;

  @Field(() => Int)
  expenseCount: number;

  @Field(() => [MonthlyBucket])
  monthlyBuckets: MonthlyBucket[];

  @Field(() => [CategoryTotal])
  categoryTotals: CategoryTotal[];
}
