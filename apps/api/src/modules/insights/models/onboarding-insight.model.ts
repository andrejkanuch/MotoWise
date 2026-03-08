import { Field, ObjectType } from '@nestjs/graphql';
import { GqlInsightType } from '../../../common/enums/graphql-enums';

@ObjectType()
export class OnboardingInsight {
  @Field(() => String)
  icon: string;

  @Field(() => String)
  title: string;

  @Field(() => String)
  body: string;

  @Field(() => GqlInsightType)
  type: GqlInsightType;
}
