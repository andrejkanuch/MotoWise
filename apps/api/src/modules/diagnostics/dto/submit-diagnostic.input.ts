import { Field, InputType, Int } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';
import { GqlMotorcycleType, GqlUrgency } from '../../../common/enums/graphql-enums';

@InputType()
export class ManualBikeInfoInput {
  @Field(() => GqlMotorcycleType)
  type: string;

  @Field(() => Int, { nullable: true })
  year?: number;

  @Field({ nullable: true })
  make?: string;

  @Field({ nullable: true })
  model?: string;
}

@InputType()
export class SubmitDiagnosticInput {
  @Field({ nullable: true })
  motorcycleId?: string;

  @Field({ nullable: true })
  photoBase64?: string;

  @Field(() => ManualBikeInfoInput, { nullable: true })
  manualBikeInfo?: ManualBikeInfoInput;

  @Field({ nullable: true })
  freeTextDescription?: string;

  @Field({ nullable: true })
  additionalNotes?: string;

  @Field(() => GqlUrgency, { nullable: true })
  urgency?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  wizardAnswers?: { symptoms?: string; location?: string; timing?: string };

  @Field({ defaultValue: false })
  dataSharingOptedIn: boolean;
}
