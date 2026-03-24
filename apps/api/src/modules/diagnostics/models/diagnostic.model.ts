import { Field, Float, ID, ObjectType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';
import { GqlDiagnosticSeverity, GqlUrgency } from '../../../common/enums/graphql-enums';

@ObjectType()
export class Diagnostic {
  @Field(() => ID)
  id: string;

  @Field()
  userId: string;

  @Field({ nullable: true })
  motorcycleId?: string;

  @Field(() => GqlDiagnosticSeverity, { nullable: true })
  severity?: string;

  @Field(() => Float, { nullable: true })
  confidence?: number;

  @Field({ nullable: true })
  relatedArticleId?: string;

  @Field()
  status: string;

  @Field()
  dataSharingOptedIn: boolean;

  @Field(() => GqlUrgency, { nullable: true })
  urgency?: string;

  @Field()
  createdAt: string;

  @Field(() => GraphQLJSON, { nullable: true })
  resultJson?: Record<string, unknown>;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  photoUrl?: string;
}
