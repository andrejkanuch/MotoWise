import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class AddExpensePhotoInput {
  @Field()
  expenseId: string;

  @Field()
  storagePath: string;

  @Field(() => Int, { nullable: true })
  fileSizeBytes?: number;
}
