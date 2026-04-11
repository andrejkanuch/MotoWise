import { Field, InputType } from '@nestjs/graphql';
import { GqlAffiliatePartner } from '../../../common/enums/graphql-enums';

@InputType()
export class TrackClickInput {
  @Field(() => GqlAffiliatePartner)
  partner: string;

  @Field()
  productUrl: string;

  @Field({ nullable: true })
  diagnosisType?: string;
}
