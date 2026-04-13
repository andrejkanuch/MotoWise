import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class UpdateHandleInput {
  @Field()
  handle: string;
}
