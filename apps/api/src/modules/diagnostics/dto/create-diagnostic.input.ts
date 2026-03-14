import { Field, InputType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';

@InputType()
export class CreateDiagnosticInput {
  @Field({ nullable: true })
  motorcycleId?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  wizardAnswers?: { symptoms?: string; location?: string; timing?: string };

  @Field({ defaultValue: false })
  dataSharingOptedIn: boolean;
}
