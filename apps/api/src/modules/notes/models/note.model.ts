import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';

// `photos` is a @ResolveField on NotesResolver (request-scoped DataLoader).
@ObjectType()
export class Note {
  @Field(() => ID)
  id: string;

  @Field()
  motorcycleId: string;

  @Field()
  text: string;

  // Raw value in the bike's distance unit.
  @Field(() => Int, { nullable: true })
  odometer?: number;

  @Field()
  createdAt: string;

  @Field()
  updatedAt: string;

  @Field({ nullable: true })
  linkedTaskId?: string;

  // Null when there is no link or the linked task has been deleted.
  @Field({ nullable: true })
  linkedTaskTitle?: string;

  @Field({ nullable: true })
  linkedExpenseId?: string;

  @Field(() => Float, { nullable: true })
  linkedExpenseAmount?: number;

  @Field({ nullable: true })
  linkedExpenseCurrency?: string;
}
