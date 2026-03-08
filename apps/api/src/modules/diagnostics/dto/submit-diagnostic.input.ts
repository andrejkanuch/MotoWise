import { Field, InputType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';

@InputType()
export class SubmitDiagnosticInput {
  @Field()
  motorcycleId: string;

  @Field()
  photoBase64: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  wizardAnswers?: Record<string, string>;

  @Field({ defaultValue: false })
  dataSharingOptedIn: boolean;
}
