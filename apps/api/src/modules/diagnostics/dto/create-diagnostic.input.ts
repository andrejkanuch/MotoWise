import { Field, InputType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';

@InputType()
export class CreateDiagnosticInput {
  @Field()
  motorcycleId: string;

  @Field(() => GraphQLJSON, { nullable: true })
  wizardAnswers?: Record<string, string>;

  @Field({ defaultValue: false })
  dataSharingOptedIn: boolean;
}
