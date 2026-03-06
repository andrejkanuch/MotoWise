import { Field, InputType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';

@InputType()
export class UpdateUserInput {
  @Field({ nullable: true })
  fullName?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  preferences?: Record<string, unknown>;
}
