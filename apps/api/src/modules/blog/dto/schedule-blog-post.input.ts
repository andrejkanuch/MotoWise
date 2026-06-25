import { Field, ID, InputType } from '@nestjs/graphql';

@InputType()
export class ScheduleBlogPostInput {
  @Field(() => ID)
  id: string;

  @Field()
  scheduledFor: string;
}
