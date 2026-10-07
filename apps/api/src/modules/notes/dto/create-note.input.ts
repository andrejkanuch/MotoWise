import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class CreateNoteInput {
  @Field()
  motorcycleId: string;

  @Field()
  text: string;

  // Raw value in the bike's distance unit.
  @Field(() => Int, { nullable: true })
  odometer?: number;

  // Also create a low-priority, undated maintenance task from this note.
  @Field({ nullable: true })
  alsoCreateTask?: boolean;
}
