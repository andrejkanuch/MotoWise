import { Field, Float, ID, ObjectType } from '@nestjs/graphql';
import { GqlDiagnosticSeverity } from '../../../common/enums/graphql-enums';

@ObjectType()
export class Diagnostic {
  @Field(() => ID)
  id: string;

  @Field()
  userId: string;

  @Field()
  motorcycleId: string;

  @Field(() => GqlDiagnosticSeverity, { nullable: true })
  severity?: string;

  @Field(() => Float, { nullable: true })
  confidence?: number;

  @Field({ nullable: true })
  relatedArticleId?: string;

  @Field()
  dataSharingOptedIn: boolean;

  @Field()
  createdAt: string;
}
