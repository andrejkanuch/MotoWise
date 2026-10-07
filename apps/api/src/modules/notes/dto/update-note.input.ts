import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class UpdateNoteInput {
  @Field({ nullable: true })
  text?: string;

  // Explicit null clears the odometer stamp; omitted leaves it unchanged.
  @Field(() => Int, { nullable: true })
  odometer?: number | null;
}
