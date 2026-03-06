import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class CreateDiagnosticInput {
  @Field()
  motorcycleId: string;

  @Field({ nullable: true })
  wizardAnswers?: string;

  @Field({ defaultValue: false })
  dataSharingOptedIn: boolean;
}
