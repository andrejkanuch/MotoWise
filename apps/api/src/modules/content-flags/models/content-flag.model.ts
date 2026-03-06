import { Field, ID, ObjectType } from '@nestjs/graphql';
import { GqlFlagStatus } from '../../../common/enums/graphql-enums';

@ObjectType()
export class ContentFlag {
  @Field(() => ID)
  id: string;

  @Field()
  articleId: string;

  @Field()
  userId: string;

  @Field({ nullable: true })
  sectionReference?: string;

  @Field()
  comment: string;

  @Field(() => GqlFlagStatus)
  status: string;

  @Field()
  createdAt: string;
}
