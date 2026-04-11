import { Field, ObjectType } from '@nestjs/graphql';
import { GqlAffiliatePartner } from '../../../common/enums/graphql-enums';

@ObjectType()
export class AffiliateProduct {
  @Field(() => GqlAffiliatePartner)
  partner: string;

  @Field()
  affiliateUrl: string;

  @Field()
  productUrl: string;

  @Field()
  tracked: boolean;
}
