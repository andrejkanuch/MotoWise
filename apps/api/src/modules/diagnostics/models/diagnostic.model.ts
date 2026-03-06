import { Field, Float, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class Diagnostic {
  @Field(() => ID)
  id: string;

  @Field()
  userId: string;

  @Field()
  motorcycleId: string;

  @Field({ nullable: true })
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
